-- Lapislázuli Phase 3. Additive, local only; never enables production images.
begin;
alter table workspace_private.upload_policy add column derivatives_enabled boolean not null default false;
-- Keep processors/tables available for a future reviewed implementation.
alter table workspace_private.image_drafts add column client_checks jsonb not null default '{}' check(jsonb_typeof(client_checks)='object' and octet_length(client_checks::text)<=8192);
-- PNG server validation now certifies structural header + actual bytes/hash, not raster decoding.
do $$declare c record;begin
 for c in select conname from pg_constraint where conrelid='workspace_private.image_assets'::regclass and contype='c' and pg_get_constraintdef(oid) like '%decoded%' loop
  execute format('alter table workspace_private.image_assets drop constraint %I',c.conname);
 end loop;
end;$$;
alter table workspace_private.image_assets add constraint image_png_structural check(role<>'png' or status<>'validated' or (verification in('header','decoded') and width is not null and height is not null));
do $$declare c record;begin
 for c in select conname from pg_constraint where conrelid='workspace_private.image_notes'::regclass and contype='c' and pg_get_constraintdef(oid) like '%kind%' loop
  execute format('alter table workspace_private.image_notes drop constraint %I',c.conname);
 end loop;
end;$$;
alter table workspace_private.image_notes add constraint image_note_kind check(kind in('general','pin','box'));
alter table workspace_private.image_notes add constraint image_note_geometry check((kind='general' and x=0 and y=0 and width=0 and height=0) or (kind='pin' and width=0 and height=0) or (kind='box' and width>0 and height>0));
create table workspace_private.image_quality_reports(
 version_id uuid primary key references workspace_private.image_versions(version_id),report jsonb not null,created_at timestamptz not null default now()
);
create table workspace_private.image_approval_warnings(
 id uuid primary key default gen_random_uuid(),version_id uuid not null references workspace_private.image_versions(version_id),
 reviewer_id uuid not null references auth.users(id),report jsonb not null,created_at timestamptz not null default now()
);
create index image_approval_warning_version on workspace_private.image_approval_warnings(version_id);
alter table workspace_private.image_quality_reports enable row level security;
alter table workspace_private.image_approval_warnings enable row level security;
revoke all on workspace_private.image_quality_reports,workspace_private.image_approval_warnings from public,anon,authenticated;
create trigger image_quality_frozen before update or delete on workspace_private.image_quality_reports for each row execute function workspace_private.image_immutable();
create trigger image_approval_frozen before update or delete on workspace_private.image_approval_warnings for each row execute function workspace_private.image_immutable();
alter table workspace_private.mention_snapshots add column image_note_id uuid references workspace_private.image_notes(id);
alter table workspace_private.notifications add column image_note_id uuid references workspace_private.image_notes(id),add column image_version_id uuid references workspace_private.image_versions(version_id);
create index notifications_image_note on workspace_private.notifications(image_note_id) where image_note_id is not null;

-- Carefully amend the prepared v2 command; historical migrations remain unchanged.
do $$declare f text;begin
 f:=pg_get_functiondef('public.workspace_image_command(text,uuid,jsonb,integer)'::regprocedure);
 if position($s$a.verification is distinct from 'decoded'$s$ in f)=0 then raise exception 'Unexpected image command source';end if;
 f:=replace(f,$s$if t.state not in('pending','assigned','in_progress','changes_requested') then raise exception 'Reabre la asignación antes de modificar su ficha'$s$,$s$if t.state not in('pending','assigned','in_progress','changes_requested','review','blocked') then raise exception 'Reabre la asignación antes de modificar su ficha'$s$);
 f:=replace(f,$s$a.verification is distinct from 'decoded'$s$,$s$a.verification not in('decoded','header')$s$);
 f:=replace(f,$s$if not exists(select 1 from workspace_private.image_version_files oldf$s$,$s$if n.kind<>'general' and not exists(select 1 from workspace_private.image_version_files oldf$s$);
 execute f;
 f:=pg_get_functiondef('public.workspace_image_storage(text,jsonb,text)'::regprocedure);
 if position($s$p_data->>'verification'<>'decoded'$s$ in f)=0 then raise exception 'Unexpected gateway source';end if;
 f:=replace(f,$s$p_data->>'verification'<>'decoded'$s$,$s$p_data->>'verification' not in('decoded','header')$s$);
 f:=replace(f,$s$jsonb_build_object('animation',p_data->>'animation')$s$,$s$jsonb_build_object('animation',p_data->>'animation','color_type',p_data->'color_type','raster_verified',false)$s$);
 execute f;
end;$$;

create function workspace_private.image_reviewer(t public.workspace_deliverables) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select workspace_private.allowed('review.request_changes',t.unit_id,t.project_id,t.area_id,t.id)
 or workspace_private.allowed('qa.approve',t.unit_id,t.project_id,t.area_id,t.id)
 or workspace_private.allowed('publication.approve_final',t.unit_id,t.project_id,t.area_id,t.id)
 or exists(select 1 from public.workspace_areas a where a.id=t.area_id and workspace_private.allowed('review.approve_'||a.specialty,t.unit_id,t.project_id,t.area_id,t.id));
$$;
revoke all on function workspace_private.image_reviewer(public.workspace_deliverables) from public,anon,authenticated;
create function workspace_private.image_quality(a workspace_private.image_assets,s workspace_private.image_specs,c jsonb) returns jsonb
language plpgsql immutable set search_path=pg_catalog,pg_temp as $$declare checks jsonb;trusted boolean;begin
 trusted:=c->>'sha256'=a.sha256;
 checks:=jsonb_build_array(
 jsonb_build_object('key','png','label','Cabecera PNG y huella del original','passed',a.status='validated' and a.verification in('header','decoded')),
 jsonb_build_object('key','decode','label','Decodificación local (declarada por el dispositivo)','passed',coalesce(trusted and c->>'decoded'='true',false)),
 jsonb_build_object('key','dimensions','label','Tamaño mínimo de la ficha','passed',(s.min_width is null or a.width>=s.min_width) and (s.min_height is null or a.height>=s.min_height)),
 jsonb_build_object('key','background','label','Fondo solicitado (comprobación local)','passed',s.background='any' or coalesce(trusted and c->>'decoded'='true' and case when s.background='transparent' then c->>'has_transparency'='true' else c->>'has_transparency'='false' end,false)),
 jsonb_build_object('key','profile','label','Perfil de color declarado sRGB','passed',coalesce(trusted and c->>'color_profile'='sRGB',false)));
 return jsonb_build_object('checks',checks,'all_passed',not exists(select 1 from jsonb_array_elements(checks) x where x->>'passed' is distinct from 'true'),'client_reported',true,'sha256',a.sha256);
end;$$;
revoke all on function workspace_private.image_quality(workspace_private.image_assets,workspace_private.image_specs,jsonb) from public,anon,authenticated;
create function workspace_private.image_emit(doc jsonb,t public.workspace_deliverables,v uuid,n uuid) returns void
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$declare m record;snap uuid;sender text;begin
 if (select count(*) from workspace_private.opal_mentions(doc))>50 then raise exception 'Usa hasta 50 menciones por documento';end if;
 select coalesce(nullif(nombre_publico,''),nombre,'Integrante') into sender from public.usuarios where id=auth.uid();
 for m in select distinct on(recipient) * from workspace_private.opal_mentions(doc) order by recipient,anchor loop
  if m.recipient=auth.uid() or not workspace_private.image_member_for(t.unit_id,m.recipient) or not workspace_private.image_allowed_for(m.recipient,'content.read',t.unit_id,t.project_id,t.area_id,t.id) then continue;end if;
  if snap is null then insert into workspace_private.mention_snapshots(kind,project_id,deliverable_id,version_id,document,title,image_note_id)
   values(case when n is null then 'version' else 'comment' end,t.project_id,t.id,v,doc,t.title,n) returning id into snap;end if;
  insert into workspace_private.notifications(recipient_id,unit_id,project_id,area_id,deliverable_id,actor_id,event_key,event_type,title,body,snapshot_id,anchor_id,image_note_id,image_version_id)
  values(m.recipient,t.unit_id,t.project_id,t.area_id,t.id,auth.uid(),'mention:'||snap||':'||m.recipient,'mention',sender||' te mencionó',t.title,snap,m.anchor,n,v) on conflict(recipient_id,event_key) do nothing;
 end loop;
end;$$;
revoke all on function workspace_private.image_emit(jsonb,public.workspace_deliverables,uuid,uuid) from public,anon,authenticated;
alter function public.workspace_image_command(text,uuid,jsonb,integer) set schema workspace_private;
alter function workspace_private.workspace_image_command(text,uuid,jsonb,integer) rename to lapis_image_command_v2;
create function public.workspace_image_command(p_action text,p_deliverable_id uuid,p_data jsonb,p_revision integer) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare t public.workspace_deliverables;n workspace_private.image_notes;v uuid;result jsonb;c jsonb;a workspace_private.image_assets;s workspace_private.image_specs;
begin
 if not workspace_private.session_active() then raise exception 'Sesión activa requerida' using errcode='42501';end if;
 select * into t from public.workspace_deliverables where id=p_deliverable_id for update;
 if t.id is null or not workspace_private.can_read_content(t.id) then raise exception 'Asignación fuera de tu acceso' using errcode='42501';end if;
 c:=coalesce(p_data->'client_checks','{}');
 if jsonb_typeof(c)<>'object' or octet_length(c::text)>8192 then raise exception 'Comprobaciones locales inválidas';end if;
 if p_action like 'note.%' then
  select * into n from workspace_private.image_notes where id=(p_data->>'note_id')::uuid;
  if p_action in('note.add','note.verify') and not workspace_private.image_reviewer(t) then raise exception 'Solo quienes revisan pueden publicar o verificar notas' using errcode='42501';end if;
  if p_action='note.reply' and not (workspace_private.image_reviewer(t) or t.responsible_id=auth.uid() or auth.uid()=any(t.collaborator_ids)) then raise exception 'No puedes responder en esta entrega' using errcode='42501';end if;
  if p_action='note.resolve' and not (workspace_private.image_reviewer(t) or n.author_id=auth.uid()) then raise exception 'Solo quien publicó la nota o quien revisa puede resolverla' using errcode='42501';end if;
  if p_action='note.add' and p_data->>'kind'='general' then p_data:=p_data||jsonb_build_object('x',0,'y',0,'width',0,'height',0);end if;
 end if;
 result:=workspace_private.lapis_image_command_v2(p_action,p_deliverable_id,p_data,p_revision);
 if p_action='draft.save' then
  update workspace_private.image_drafts set client_checks=c where deliverable_id=t.id and author_id=auth.uid();result:=result||jsonb_build_object('client_checks',c);
 elsif p_action='version.submit' then
  v:=(result->>'id')::uuid;select * into a from workspace_private.image_assets where id=(p_data->>'png_asset_id')::uuid;
  select * into s from workspace_private.image_specs where deliverable_id=t.id;
  insert into workspace_private.image_quality_reports values(v,workspace_private.image_quality(a,s,c),now());
  perform workspace_private.log(t.unit_id,t.project_id,t.area_id,t.id,'version.submit',v);
  perform workspace_private.image_emit(p_data->'note_document',t,v,null);
 elsif p_action in('note.add','note.reply') then
  if p_action='note.add' then select * into n from workspace_private.image_notes where id=(result->>'id')::uuid;end if;
  perform workspace_private.image_emit(p_data->'body_document',t,n.version_id,n.id);
 end if;
 return result;
end;$$;
revoke all on function workspace_private.lapis_image_command_v2(text,uuid,jsonb,integer) from public,anon,authenticated;
revoke all on function public.workspace_image_command(text,uuid,jsonb,integer) from public,anon;
grant execute on function public.workspace_image_command(text,uuid,jsonb,integer) to authenticated;
create function workspace_private.image_record_approval() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$begin
 if new.kind='image' and new.state='area_approved' and old.state is distinct from new.state then
  insert into workspace_private.image_approval_warnings(version_id,reviewer_id,report)
  select v.version_id,auth.uid(),q.report from workspace_private.image_versions v join public.workspace_versions w on w.id=v.version_id join workspace_private.image_quality_reports q on q.version_id=w.id
  where w.deliverable_id=new.id and w.version_number=new.current_version and q.report->>'all_passed' is distinct from 'true';
 end if;return new;
end;$$;
create trigger image_record_approval after update of state on public.workspace_deliverables for each row execute function workspace_private.image_record_approval();
revoke all on function workspace_private.image_record_approval() from public,anon,authenticated;

create function workspace_private.image_safe_asset(a workspace_private.image_assets) returns jsonb
language sql immutable set search_path=pg_catalog,pg_temp as $$
 select jsonb_build_object('id',a.id,'deliverable_id',a.deliverable_id,'role',a.role,'file_name',a.file_name,'size_bytes',a.size_bytes,'sha256',a.sha256,'mime_type',a.mime_type,'format',a.format,'status',a.status,'verification',a.verification,'width',a.width,'height',a.height);
$$;
revoke all on function workspace_private.image_safe_asset(workspace_private.image_assets) from public,anon,authenticated;
create function public.workspace_image_bundle(p_project_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$declare result jsonb;p workspace_private.upload_policy;begin
 if not workspace_private.session_active() or not workspace_private.can_read_project(p_project_id) then raise exception 'Edición fuera de tu acceso' using errcode='42501';end if;
 select * into p from workspace_private.upload_policy where singleton;
 if not p.images_enabled then return jsonb_build_object('enabled',false,'policy',to_jsonb(p)-'singleton');end if;
 with tasks as(select t.id from public.workspace_deliverables t where t.project_id=p_project_id and t.kind='image' and workspace_private.can_read_content(t.id)),
 versions as(select v.* from workspace_private.image_versions v where deliverable_id in(select id from tasks))
 select jsonb_build_object('enabled',true,'policy',to_jsonb(p)-'singleton',
 'specs',coalesce((select jsonb_object_agg(s.deliverable_id,to_jsonb(s)) from workspace_private.image_specs s join public.workspace_deliverables t on t.id=s.deliverable_id where t.project_id=p_project_id and workspace_private.can_read_task(t.id)),'{}'),
 'drafts',coalesce((select jsonb_object_agg(d.deliverable_id,to_jsonb(d)) from workspace_private.image_drafts d where d.deliverable_id in(select id from tasks) and d.author_id=auth.uid()),'{}'),
 'assets',coalesce((select jsonb_object_agg(a.id,workspace_private.image_safe_asset(a)) from workspace_private.image_assets a where a.deliverable_id in(select id from tasks) and (a.owner_id=auth.uid() or exists(select 1 from workspace_private.image_version_files f where f.asset_id=a.id))),'{}'),
 'versions',coalesce((select jsonb_object_agg(v.version_id,to_jsonb(v)||jsonb_build_object('files',(select jsonb_object_agg(f.role,f.asset_id) from workspace_private.image_version_files f where f.version_id=v.version_id),'quality',q.report)) from versions v left join workspace_private.image_quality_reports q on q.version_id=v.version_id),'{}'),
 'notes',coalesce((select jsonb_agg(n order by n.created_at,n.id) from workspace_private.image_notes n where n.version_id in(select version_id from versions)),'[]'),
 'replies',coalesce((select jsonb_agg(r order by r.created_at,r.id) from workspace_private.image_note_replies r join workspace_private.image_notes n on n.id=r.note_id where n.version_id in(select version_id from versions)),'[]'),
 'resolutions',coalesce((select jsonb_agg(r order by r.created_at,r.id) from workspace_private.image_note_resolutions r where r.verified_version_id in(select version_id from versions)),'[]'),
 'approvals',coalesce((select jsonb_agg(r order by r.created_at,r.id) from workspace_private.image_approval_warnings r where r.version_id in(select version_id from versions)),'[]')) into result;
 return result;
end;$$;
revoke all on function public.workspace_image_bundle(uuid) from public,anon;
grant execute on function public.workspace_image_bundle(uuid) to authenticated;

-- Derivative infrastructure remains stored but inactive. Cleanup is never disabled.
alter function public.workspace_image_maintenance(text,jsonb,text) set schema workspace_private;
alter function workspace_private.workspace_image_maintenance(text,jsonb,text) rename to lapis_image_maintenance_v2;
create function public.workspace_image_maintenance(p_action text,p_data jsonb,p_gateway_key text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$begin
 perform workspace_private.image_gateway_authorized(p_gateway_key);
 if p_action like 'preview.%' and not (select derivatives_enabled from workspace_private.upload_policy where singleton) then
  if p_action='preview.claim' then return null;end if;raise exception 'Los derivados están desactivados';
 end if;
 return workspace_private.lapis_image_maintenance_v2(p_action,p_data,p_gateway_key);
end;$$;
revoke all on function workspace_private.lapis_image_maintenance_v2(text,jsonb,text) from public,anon,authenticated;
revoke all on function public.workspace_image_maintenance(text,jsonb,text) from public;
grant execute on function public.workspace_image_maintenance(text,jsonb,text) to anon,authenticated;

-- Extend existing notification envelopes; retain all current visibility checks.
alter function public.workspace_read_notification(uuid,timestamptz) set schema workspace_private;
alter function workspace_private.workspace_read_notification(uuid,timestamptz) rename to lapis_read_notification_v2;
create function public.workspace_read_notification(p_id uuid default null,p_before timestamptz default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$declare r jsonb;n workspace_private.notifications;begin
 r:=workspace_private.lapis_read_notification_v2(p_id,p_before);
 select * into n from workspace_private.notifications where id=p_id and recipient_id=auth.uid();
 return r||jsonb_build_object('image_note_id',n.image_note_id,'image_version_id',n.image_version_id);
end;$$;
revoke all on function workspace_private.lapis_read_notification_v2(uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.workspace_read_notification(uuid,timestamptz) from public,anon;
grant execute on function public.workspace_read_notification(uuid,timestamptz) to authenticated;
-- Offering an image to Documents is saved only; Phase 6 implements reuse.
do $$declare f text;begin
 f:=pg_get_functiondef('workspace_private.capture_document_acceptance()'::regprocedure);
 f:=replace(f,$s$if new.state='area_approved'$s$,$s$if new.kind<>'image' and new.state='area_approved'$s$);
 execute f;
end;$$;
create function workspace_private.image_notification_target() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$declare t public.workspace_deliverables;begin
 select * into t from public.workspace_deliverables where id=new.deliverable_id and kind='image';
 if t.id is not null then
  if new.image_version_id is null then select id into new.image_version_id from public.workspace_versions where deliverable_id=t.id and version_number=t.current_version;end if;
  if new.event_type='document.accepted' then new.title:='Imagen aprobada por el área';end if;
 end if;return new;
end;$$;
create trigger image_notification_target before insert on workspace_private.notifications for each row execute function workspace_private.image_notification_target();
revoke all on function workspace_private.image_notification_target() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
