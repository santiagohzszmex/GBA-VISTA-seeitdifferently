-- Workspace 1.6.5 Ópalo. Support documents never create deliverables implicitly.
-- Existing roles, memberships, delegations and immutable approved versions stay authoritative.
create table workspace_private.support_documents (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.workspace_projects(id),
 area_id uuid not null references public.workspace_areas(id), author_id uuid not null references auth.users(id),
 title text not null check(length(trim(title)) between 1 and 180),
 document_kind text not null default 'notes' check(document_kind in('interview','notes','source','transcript','working')),
 content_document jsonb not null, content_markdown text not null default '', credits text not null default '' check(length(credits)<=10000),
 palette jsonb not null default '[]', revision integer not null default 1 check(revision>0),
 share_scope text not null default 'private' check(share_scope in('private','area','assignment')),
 linked_task_id uuid references public.workspace_deliverables(id), converted_task_id uuid references public.workspace_deliverables(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 check(content_document->>'type'='doc' and octet_length(content_document::text)<=1048576),
 check(jsonb_typeof(palette)='array' and jsonb_array_length(palette)<=24),
 check(share_scope<>'assignment' or linked_task_id is not null)
);
create index support_documents_project_area on workspace_private.support_documents(project_id,area_id) where archived_at is null;
create index support_documents_author on workspace_private.support_documents(author_id);
create index support_documents_linked on workspace_private.support_documents(linked_task_id);
create index support_documents_converted on workspace_private.support_documents(converted_task_id);
create table workspace_private.support_history (
 document_id uuid not null references workspace_private.support_documents(id), revision integer not null,
 snapshot jsonb not null, actor_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 primary key(document_id,revision),check(octet_length(snapshot::text)<=1100000)
);
create index support_history_actor on workspace_private.support_history(actor_id);
alter table workspace_private.support_documents enable row level security;
alter table workspace_private.support_history enable row level security;
revoke all on workspace_private.support_documents,workspace_private.support_history from public,anon,authenticated;
alter table workspace_private.edition_references add column support_id uuid references workspace_private.support_documents(id);
create index edition_references_support on workspace_private.edition_references(support_id) where support_id is not null;
alter table workspace_private.edition_references add column category text;
alter table workspace_private.edition_references add constraint reference_category_catalog check(category is null or category in(
 'concept','creative_direction','moodboard','common_palette','edition_guide','research_sources','research_methodology','interview_guide','research_context',
 'editorial_style','editorial_structure','editorial_vocabulary','fact_checking','illustration_characters','illustration_composition','illustration_palette','illustration_style',
 'photo_shot_list','photo_lighting','photo_documentation','photo_credits','design_grid','design_typography','design_hierarchy','design_exports','qa_checklist','qa_technical','production_naming','production_delivery'));
alter table workspace_private.notifications add column support_id uuid references workspace_private.support_documents(id);
create index notifications_support on workspace_private.notifications(support_id) where support_id is not null;

create table workspace_private.support_media (
 document_id uuid not null references workspace_private.support_documents(id),original_id uuid not null references workspace_private.reference_originals(id),primary key(document_id,original_id));
create index support_media_original on workspace_private.support_media(original_id);
alter table workspace_private.support_media enable row level security;
revoke all on workspace_private.support_media from public,anon,authenticated;

create function workspace_private.support_create_for(p_user uuid,p_project uuid,p_area uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select workspace_private.member(p.unit_id,p_user) and p.deleted_at is null and p.status not in('closed','archived')
 and exists(select 1 from public.workspace_areas a where a.id=p_area and a.project_id=p.id)
 and (workspace_private.notification_allowed(p_user,'task.create',p.unit_id,p.id,p_area)
 or exists(select 1 from public.workspace_deliverables t where t.project_id=p.id and t.area_id=p_area
 and (t.responsible_id=p_user or p_user=any(t.collaborator_ids)) and workspace_private.notification_allowed(p_user,'content.create',p.unit_id,p.id,t.area_id,t.id)))
 from public.workspace_projects p where p.id=p_project;
$$;
create function workspace_private.support_for(s workspace_private.support_documents,p_user uuid) returns boolean
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$declare p public.workspace_projects;begin
 select * into p from public.workspace_projects where id=s.project_id;
 if s.id is null or s.archived_at is not null or p.deleted_at is not null or not workspace_private.member(p.unit_id,p_user) then return false;end if;
 if s.author_id=p_user then return coalesce(workspace_private.support_create_for(p_user,p.id,s.area_id),false);end if;
 if s.share_scope='private' then return false;end if;
 if s.share_scope='assignment' then return workspace_private.opal_content_for(p_user,s.linked_task_id);end if;
 return workspace_private.opal_project_for(p_user,p.id) and (
 workspace_private.notification_allowed(p_user,'content.read',p.unit_id,p.id,s.area_id)
 or (workspace_private.notification_allowed(p_user,'reference.read',p.unit_id,p.id,s.area_id) and exists(
 select 1 from public.workspace_assignments a where a.user_id=p_user and a.unit_id=p.unit_id and a.project_id=p.id
 and (a.area_id is null or a.area_id=s.area_id) and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now()))));
end;$$;
create function workspace_private.support_editable(s workspace_private.support_documents) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select s.author_id=auth.uid() and s.archived_at is null and workspace_private.support_create_for(auth.uid(),s.project_id,s.area_id);
$$;
create function workspace_private.support_record(s workspace_private.support_documents,p_action text) returns void
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$declare p public.workspace_projects;begin
 select * into p from public.workspace_projects where id=s.project_id;
 insert into workspace_private.support_history(document_id,revision,snapshot,actor_id) values(s.id,s.revision,to_jsonb(s),auth.uid());
 perform workspace_private.log(p.unit_id,p.id,s.area_id,null,'support.'||p_action,s.id,jsonb_build_object('revision',s.revision,'share_scope',s.share_scope));
end;$$;
create function workspace_private.support_emit(s workspace_private.support_documents,previous jsonb) returns void
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$declare m record;p public.workspace_projects;begin
 if s.share_scope='private' then return;end if;
 select * into p from public.workspace_projects where id=s.project_id;
 for m in select distinct on(recipient) * from workspace_private.opal_mentions(s.content_document) loop
  if m.recipient=auth.uid() or not workspace_private.support_for(s,m.recipient) or exists(select 1 from workspace_private.opal_mentions(previous) old where old.recipient=m.recipient and old.anchor=m.anchor) then continue;end if;
  insert into workspace_private.notifications(recipient_id,unit_id,project_id,area_id,support_id,actor_id,event_key,event_type,title,body,anchor_id)
  values(m.recipient,p.unit_id,p.id,s.area_id,s.id,auth.uid(),'support-mention:'||s.id||':'||s.revision||':'||m.recipient,'support.mention','Te mencionaron en un documento de apoyo',s.title,m.anchor) on conflict do nothing;
 end loop;
end;$$;
create function public.workspace_support_bundle(p_project_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$declare docs jsonb;areas jsonb;begin
 if not workspace_private.session_active() or not workspace_private.can_read_project(p_project_id) then raise exception 'Sin acceso a esta edición' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(s)||jsonb_build_object('can_edit',workspace_private.support_editable(s),'can_convert',workspace_private.allowed('task.create',(select unit_id from public.workspace_projects where id=s.project_id),s.project_id,s.area_id),'originals',coalesce((
 select jsonb_agg(public.workspace_original_descriptor(o.id)) from workspace_private.reference_originals o join workspace_private.edition_references r on r.id=o.reference_id
 where r.support_id=s.id and r.deliverable_id is null and o.status='ready'),'[]')) order by s.updated_at desc),'[]') into docs
 from workspace_private.support_documents s where s.project_id=p_project_id and workspace_private.support_for(s,auth.uid());
 select coalesce(jsonb_agg(a.id),'[]') into areas from public.workspace_areas a where a.project_id=p_project_id and workspace_private.support_create_for(auth.uid(),p_project_id,a.id);
 return jsonb_build_object('documents',docs,'creation_areas',areas);
end;$$;
create function public.workspace_save_support(p_project_id uuid,p_data jsonb,p_revision integer) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$declare s workspace_private.support_documents;col jsonb;previous jsonb;begin
 if nullif(p_data->>'id','') is not null then
  select * into s from workspace_private.support_documents where id=(p_data->>'id')::uuid for update;
  if s.id is null or s.project_id<>p_project_id or not coalesce(workspace_private.support_editable(s),false) then raise exception 'Sin permiso para editar este documento' using errcode='42501';end if;
  if s.area_id is distinct from (p_data->>'area_id')::uuid then raise exception 'El área del documento se conserva';end if;
 else
  if p_revision is distinct from 0 then raise exception 'Revisión inválida';end if;
  s.project_id:=p_project_id;s.area_id:=(p_data->>'area_id')::uuid;s.author_id:=auth.uid();s.revision:=0;
  if not coalesce(workspace_private.support_create_for(auth.uid(),p_project_id,s.area_id),false) then raise exception 'Sin permiso para crear documentos propios en esta área' using errcode='42501';end if;
 end if;
 previous:=s.content_document;
 if s.revision is distinct from p_revision then raise exception 'El documento cambió en otra ventana; actualiza antes de guardar' using errcode='40001';end if;
 if coalesce((p_data->>'editor_version')::integer,0)<2 then raise exception 'Actualiza Workspace antes de editar';end if;
 perform workspace_private.opal_validate(p_data->'content_document');perform workspace_private.opal_assert_media(p_data->'content_document',p_project_id);
 for col in select value from jsonb_array_elements(coalesce(p_data->'palette','[]')) loop if col #>> '{}' !~ '^#[a-fA-F0-9]{6}$' then raise exception 'Código de color inválido';end if;end loop;
 if s.id is null then
  insert into workspace_private.support_documents(project_id,area_id,author_id,title,document_kind,content_document,content_markdown,credits,palette)
  values(p_project_id,s.area_id,auth.uid(),trim(p_data->>'title'),coalesce(p_data->>'document_kind','notes'),p_data->'content_document',workspace_private.document_markdown(p_data->'content_document'),coalesce(p_data->>'credits',''),coalesce(p_data->'palette','[]')) returning * into s;
 else
  update workspace_private.support_documents set title=trim(p_data->>'title'),document_kind=coalesce(p_data->>'document_kind',document_kind),content_document=p_data->'content_document',
  content_markdown=workspace_private.document_markdown(p_data->'content_document'),credits=coalesce(p_data->>'credits',''),palette=coalesce(p_data->'palette','[]'),revision=revision+1,updated_at=now() where id=s.id returning * into s;
 end if;
 delete from workspace_private.support_media where document_id=s.id;
 insert into workspace_private.support_media(document_id,original_id) select s.id,x.id from workspace_private.opal_image_ids(s.content_document) x;
 perform workspace_private.support_emit(s,previous);
 perform workspace_private.support_record(s,'saved');return to_jsonb(s)||jsonb_build_object('can_edit',true,'can_convert',workspace_private.allowed('task.create',(select unit_id from public.workspace_projects where id=s.project_id),s.project_id,s.area_id),
 'originals',coalesce((select jsonb_agg(public.workspace_original_descriptor(o.id)) from workspace_private.reference_originals o join workspace_private.edition_references r on r.id=o.reference_id where r.support_id=s.id and r.deliverable_id is null and o.status='ready'),'[]'));
end;$$;

-- Share, attach a frozen copy, convert to own delivery, and archive are separate actions.
create function public.workspace_support_action(p_id uuid,p_action text,p_data jsonb,p_revision integer) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare s workspace_private.support_documents;p public.workspace_projects;t public.workspace_deliverables;r workspace_private.edition_references;out jsonb;person uuid;assets uuid[];
begin
 select * into s from workspace_private.support_documents where id=p_id for update;
 if s.id is null or not coalesce(workspace_private.support_editable(s),false) then raise exception 'Sin permiso para modificar este documento' using errcode='42501';end if;
 if s.revision is distinct from p_revision then raise exception 'El documento cambió; actualiza antes de continuar' using errcode='40001';end if;
 select * into p from public.workspace_projects where id=s.project_id;
 if p_action='share' then
  if p_data->>'share_scope' not in('private','area') or p_data->>'share_scope' is null then raise exception 'Selecciona privado o compartir con tu área';end if;
  update workspace_private.support_documents set share_scope=p_data->>'share_scope',linked_task_id=null,revision=revision+1,updated_at=now() where id=s.id returning * into s;
  if s.share_scope='area' then
   perform workspace_private.support_emit(s,null);
   for person in select user_id from public.workspace_unit_memberships where unit_id=p.unit_id and user_id<>auth.uid() loop
    if workspace_private.support_for(s,person) then
     insert into workspace_private.notifications(recipient_id,unit_id,project_id,area_id,support_id,actor_id,event_key,event_type,title,body)
     values(person,p.unit_id,p.id,s.area_id,s.id,auth.uid(),'support:'||s.id||':'||s.revision,'support.shared','Documento compartido en tu área',s.title) on conflict do nothing;
    end if;
   end loop;
  end if;
 elsif p_action='link' then
  select * into t from public.workspace_deliverables where id=(p_data->>'linked_task_id')::uuid for update;
  if t.id is null or t.project_id<>s.project_id or t.area_id<>s.area_id or t.state not in('pending','assigned','in_progress','changes_requested')
   or not (workspace_private.allowed('content.edit_assigned',t.unit_id,t.project_id,t.area_id,t.id) or workspace_private.allowed('task.assign',t.unit_id,t.project_id,t.area_id,t.id)) then raise exception 'Sin permiso para vincular a este encargo abierto de tu área' using errcode='42501';end if;
  if (select count(*) from workspace_private.task_references where deliverable_id=t.id)>=30 then raise exception 'Límite de 30 materiales por encargo';end if;
  -- Capture current content; later private edits never alter this shared version.
  insert into workspace_private.edition_references(project_id,area_id,kind,title,content_document,content_markdown,palette,created_by,deliverable_id,purpose,support_id)
  values(s.project_id,s.area_id,'instructions',s.title,s.content_document,s.content_markdown,s.palette,s.author_id,t.id,'assignment',s.id) returning * into r;
  select coalesce(array_agg(o.id),'{}') into assets from workspace_private.reference_originals o join workspace_private.edition_references media on media.id=o.reference_id where media.support_id=s.id and media.deliverable_id is null and o.status='ready';
  insert into workspace_private.task_references(deliverable_id,source_id,reference_id,revision,snapshot,original_ids,linked_by) values(t.id,r.id,r.id,r.revision,to_jsonb(r)||jsonb_build_object('support_revision',s.revision),assets,auth.uid());
  update public.workspace_deliverables set revision=revision+1 where id=t.id;
  update workspace_private.support_documents set linked_task_id=t.id,revision=revision+1,updated_at=now() where id=s.id returning * into s;
 elsif p_action='convert' then
  if s.converted_task_id is not null then raise exception 'Este documento ya tiene una entrega vinculada';end if;
  perform workspace_private.require('task.create',p.unit_id,p.id,s.area_id);
  out:=public.workspace_command('task.create',jsonb_build_object('unit_id',p.unit_id,'project_id',p.id,'area_id',s.area_id,'title',s.title,'responsible_id',s.author_id),null);
  select * into t from public.workspace_deliverables where id=(out->>'id')::uuid;
  perform public.workspace_save_draft(t.id,jsonb_build_object('content_document',s.content_document,'credits',s.credits,'editor_version',2),0,0);
  update workspace_private.support_documents set converted_task_id=t.id,revision=revision+1,updated_at=now() where id=s.id returning * into s;
  perform workspace_private.support_record(s,p_action);
  perform public.workspace_support_action(s.id,'link',jsonb_build_object('linked_task_id',t.id),s.revision);
  select to_jsonb(x) into out from public.workspace_deliverables x where id=t.id;
  return out;
 elsif p_action='archive' then
  update workspace_private.support_documents set archived_at=now(),share_scope='private',linked_task_id=null,revision=revision+1,updated_at=now() where id=s.id returning * into s;
 else raise exception 'Acción de documento no permitida';end if;
 perform workspace_private.support_record(s,p_action);
 return case when p_action='convert' then out else to_jsonb(s)||jsonb_build_object('can_edit',true) end;
end;$$;
create function public.workspace_support_history(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$declare s workspace_private.support_documents;begin
 select * into s from workspace_private.support_documents where id=p_id;
 if s.author_id is distinct from auth.uid() or not coalesce(workspace_private.support_create_for(auth.uid(),s.project_id,s.area_id),false) then raise exception 'El historial privado pertenece a su autor' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('revision',h.revision,'created_at',h.created_at,'snapshot',h.snapshot) order by h.revision desc) from workspace_private.support_history h where document_id=p_id),'[]');
end;$$;
create function public.workspace_prepare_support_original(p_id uuid,p_title text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$declare s workspace_private.support_documents;r workspace_private.edition_references;begin
 select * into s from workspace_private.support_documents where id=p_id for update;
 if not coalesce(workspace_private.support_editable(s),false) then raise exception 'Sin permiso para subir al documento' using errcode='42501';end if;
 if (select count(*) from workspace_private.edition_references where support_id=s.id and deliverable_id is null)>=40 then raise exception 'Límite de 40 originales por documento';end if;
 insert into workspace_private.edition_references(project_id,area_id,kind,title,content_document,created_by,support_id)
 values(s.project_id,s.area_id,'instructions',p_title,jsonb_build_object('type','doc','attrs',jsonb_build_object('schemaVersion',2),'content','[]'::jsonb),auth.uid(),s.id) returning * into r;
 return to_jsonb(r);
end;$$;
create function public.workspace_team_bundle(p_project_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$declare p public.workspace_projects;area_ids uuid[];rows jsonb;begin
 select * into p from public.workspace_projects where id=p_project_id;
 if not workspace_private.session_active() or not workspace_private.can_read_project(p.id) then raise exception 'Sin acceso al equipo de esta edición' using errcode='42501';end if;
 select coalesce(array_agg(a.id),'{}') into area_ids from public.workspace_areas a where a.project_id=p.id and
 (workspace_private.allowed('unit.members.read',p.unit_id,p.id,a.id) or exists(select 1 from public.workspace_deliverables t where t.area_id=a.id and workspace_private.allowed('unit.members.read',p.unit_id,p.id,a.id,t.id)));
 select coalesce(jsonb_agg(jsonb_build_object('user_id',u.id,'display_name',coalesce(nullif(u.nombre_publico,''),u.nombre),'handle',u.nombre,
 'area_ids',coalesce((select jsonb_agg(distinct a.area_id) from public.workspace_assignments a where a.user_id=u.id and a.unit_id=p.unit_id and (a.project_id=p.id or a.project_id is null) and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now()) and (a.area_id=any(area_ids) or a.area_id is null)),'[]'),
 'assignment_roles',coalesce((select jsonb_agg(distinct a.assignment_role) from public.workspace_assignments a where a.user_id=u.id and a.unit_id=p.unit_id and (a.project_id=p.id or a.project_id is null) and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now()) and (a.area_id=any(area_ids) or a.area_id is null)),'[]')) order by u.nombre),'[]') into rows
 from public.usuarios u where cardinality(area_ids)>0 and workspace_private.member(p.unit_id,u.id)
 and workspace_private.opal_project_for(u.id,p.id) and exists(select 1 from public.workspace_assignments a where a.user_id=u.id and a.unit_id=p.unit_id and (a.project_id=p.id or a.project_id is null) and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now()) and (a.area_id=any(area_ids) or a.area_id is null));
 return jsonb_build_object('members',rows,'areas',coalesce((select jsonb_agg(to_jsonb(a)) from public.workspace_areas a where a.id=any(area_ids)),'[]'));
end;$$;

-- Support originals use the established R2 quota, byte checks and private gateway.
alter function workspace_private.opal_reference_for(workspace_private.edition_references,uuid) rename to support_reference_for_v1;
create function workspace_private.opal_reference_for(r workspace_private.edition_references,p_user uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select case when r.support_id is not null and r.deliverable_id is null then coalesce((select workspace_private.support_for(s,p_user) from workspace_private.support_documents s where s.id=r.support_id),false)
 else workspace_private.support_reference_for_v1(r,p_user) end;
$$;
alter function workspace_private.reference_writable(workspace_private.edition_references) rename to support_reference_writable_v1;
create function workspace_private.reference_writable(r workspace_private.edition_references) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select case when r.support_id is not null then r.deliverable_id is null and coalesce((select workspace_private.support_editable(s) from workspace_private.support_documents s where s.id=r.support_id),false)
 else workspace_private.support_reference_writable_v1(r) end;
$$;
alter function workspace_private.opal_original_for(workspace_private.reference_originals,uuid) rename to support_original_for_v1;
create function workspace_private.opal_original_for(o workspace_private.reference_originals,p_user uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select workspace_private.support_original_for_v1(o,p_user) or (o.status='ready' and exists(select 1 from workspace_private.support_media media join workspace_private.support_documents s on s.id=media.document_id where media.original_id=o.id and workspace_private.support_for(s,p_user))) or (o.status='ready' and exists(
 select 1 from workspace_private.task_references tr join public.workspace_deliverables t on t.id=tr.deliverable_id
 where o.id=any(tr.original_ids) and workspace_private.opal_project_for(p_user,t.project_id)
 and workspace_private.notification_allowed(p_user,'task.read',t.unit_id,t.project_id,t.area_id,t.id)));
$$;
alter function workspace_private.opal_original_download(workspace_private.reference_originals) rename to support_original_download_v1;
create function workspace_private.opal_original_download(o workspace_private.reference_originals) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select workspace_private.support_original_download_v1(o) or (workspace_private.opal_original_for(o,auth.uid()) and (
 exists(select 1 from workspace_private.edition_references r join workspace_private.support_documents s on s.id=r.support_id where r.id=o.reference_id and workspace_private.support_for(s,auth.uid())
 and workspace_private.support_create_for(auth.uid(),s.project_id,s.area_id))
 or exists(select 1 from workspace_private.task_references tr join public.workspace_deliverables t on t.id=tr.deliverable_id where o.id=any(tr.original_ids)
 and workspace_private.allowed('asset.download_source',t.unit_id,t.project_id,t.area_id,t.id))));
$$;
create function workspace_private.support_upload_allowed(r workspace_private.edition_references) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select workspace_private.reference_writable(r) and case when r.support_id is not null then true else
 coalesce((select workspace_private.allowed('asset.upload',p.unit_id,p.id,r.area_id,r.deliverable_id) from public.workspace_projects p where p.id=r.project_id),false) end;
$$;
alter function public.workspace_reference_bundle(uuid) set schema workspace_private;
alter function workspace_private.workspace_reference_bundle(uuid) rename to support_reference_bundle_v1;
create function public.workspace_reference_bundle(p_project_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$declare out jsonb;begin
 out:=workspace_private.support_reference_bundle_v1(p_project_id);
 return jsonb_set(out,'{references}',coalesce((select jsonb_agg(r) from jsonb_array_elements(out->'references') r where r->>'support_id' is null),'[]'));
end;$$;
alter function public.workspace_save_reference(uuid,jsonb,integer) set schema workspace_private;
alter function workspace_private.workspace_save_reference(uuid,jsonb,integer) rename to support_save_reference_v1;
create function public.workspace_save_reference(p_project_id uuid,p_data jsonb,p_revision integer) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$declare out jsonb;r workspace_private.edition_references;begin
 if exists(select 1 from workspace_private.edition_references where id=nullif(p_data->>'id','')::uuid and support_id is not null) then raise exception 'Edita el documento de apoyo desde Mi trabajo';end if;
 out:=workspace_private.support_save_reference_v1(p_project_id,p_data,p_revision);
 update workspace_private.edition_references set category=case when p_data ? 'category' then nullif(p_data->>'category','') else category end where id=(out->>'id')::uuid returning * into r;
 update workspace_private.reference_history set snapshot=to_jsonb(r) where reference_id=r.id and revision=r.revision;
 return to_jsonb(r);
end;$$;
alter function workspace_private.notification_visible(workspace_private.notifications) rename to support_notification_v1;
create function workspace_private.notification_visible(n workspace_private.notifications) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select case when n.support_id is not null then n.recipient_id=auth.uid() and workspace_private.session_active()
 and coalesce((select workspace_private.support_for(s,auth.uid()) from workspace_private.support_documents s where id=n.support_id),false)
 else workspace_private.support_notification_v1(n) end;
$$;
create or replace function public.workspace_notifications() returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$declare rows jsonb;unread integer;begin
 if not workspace_private.session_active() then raise exception 'Sesión revocada o cuenta suspendida' using errcode='42501';end if;
 perform workspace_private.queue_deadline_notices();
 select count(*)::integer into unread from workspace_private.notifications n where recipient_id=auth.uid() and read_at is null and workspace_private.notification_visible(n);
 select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc),'[]') into rows from(
 select n.id,n.event_type,n.title,n.body,n.project_id,n.deliverable_id,n.reference_id,n.support_id,n.anchor_id,n.created_at,n.read_at,p.title as edition_title
 from workspace_private.notifications n left join public.workspace_projects p on p.id=n.project_id where recipient_id=auth.uid() and workspace_private.notification_visible(n) order by created_at desc limit 60) x;
 return jsonb_build_object('items',rows,'unread_count',unread,'fetched_at',now());
end;$$;

create or replace function public.workspace_original_gate(p_reference_id uuid,p_gateway_key text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare r workspace_private.edition_references;p public.workspace_projects;
begin
 perform workspace_private.original_gateway(p_gateway_key);
 select * into r from workspace_private.edition_references where id=p_reference_id and archived_at is null;
 select * into p from public.workspace_projects where id=r.project_id;
 if r.id is null or not coalesce(workspace_private.support_upload_allowed(r),false) then raise exception 'Sin permiso para subir originales' using errcode='42501';end if;
 perform workspace_private.original_tick('request');
 return jsonb_build_object('kind',r.kind,'limit',26214400);
end;$$;

create or replace function public.workspace_original_begin(p_reference_id uuid,p_name text,p_mime text,p_size integer,p_sha256 text,p_gateway_key text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare r workspace_private.edition_references;p public.workspace_projects;o workspace_private.reference_originals;l workspace_private.original_limits;
begin
 perform workspace_private.original_gateway(p_gateway_key);
 select * into r from workspace_private.edition_references where id=p_reference_id and archived_at is null for update;
 select * into p from public.workspace_projects where id=r.project_id;
 if r.id is null or not coalesce(workspace_private.support_upload_allowed(r),false) then raise exception 'Sin permiso para subir originales' using errcode='42501';end if;
 if p_mime not in('image/jpeg','image/png','image/webp','image/gif','image/tiff','image/avif','image/heic','image/heif','application/pdf') then raise exception 'Selecciona un PDF o una imagen original; formato no permitido';end if;
 if p_size is null or p_size not between 1 and 26214400 then raise exception 'Límite de 25 MB por archivo';end if;
 if r.support_id is not null and (select count(*) from workspace_private.reference_originals original_row join workspace_private.edition_references media on media.id=original_row.reference_id where media.support_id=r.support_id and media.deliverable_id is null and original_row.status<>'failed')>=40 then raise exception 'Máximo 40 originales por documento';end if;
 if (select count(*) from workspace_private.reference_originals where reference_id=r.id and status<>'failed')>=40 then raise exception 'Máximo 40 originales por referencia';end if;
 select * into l from workspace_private.original_limits for update;
 if l.allocated_bytes+p_size>l.capacity_bytes then raise exception 'Se alcanzó el límite de 10 GB. No se permiten más subidas';end if;
 perform workspace_private.original_tick('write');
 o.id:=gen_random_uuid();o.object_key:=p.id::text||'/'||r.id::text||'/'||o.id::text;
 insert into workspace_private.reference_originals(id,reference_id,file_name,mime_type,size_bytes,sha256,object_key,uploaded_by)
 values(o.id,r.id,regexp_replace(p_name,'[[:cntrl:]/\\]','_','g'),p_mime,p_size,p_sha256,o.object_key,auth.uid()) returning * into o;
 update workspace_private.original_limits set allocated_bytes=allocated_bytes+p_size where singleton;
 perform workspace_private.log(p.unit_id,p.id,r.area_id,null,'original.reserved',o.id,jsonb_build_object('size_bytes',p_size));
 return to_jsonb(o);
end;$$;

-- Extend the existing connector dispatcher; all writes remain idempotent and scoped.
alter function workspace_private.connector_dispatch(text,jsonb) rename to support_connector_dispatch_v1;
create function workspace_private.connector_dispatch(p_method text,p_args jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$declare out jsonb;begin
 if p_method='support.bundle' then return public.workspace_support_bundle((p_args->>'project_id')::uuid);
 elsif p_method='team.bundle' then return public.workspace_team_bundle((p_args->>'project_id')::uuid);
 elsif p_method='support.save' then return public.workspace_save_support((p_args->>'project_id')::uuid,p_args->'data',(p_args->>'revision')::integer);
 elsif p_method='support.action' then return public.workspace_support_action((p_args->>'id')::uuid,p_args->>'action',coalesce(p_args->'data','{}'),(p_args->>'revision')::integer);
 elsif p_method='support.prepare' then return public.workspace_prepare_support_original((p_args->>'id')::uuid,p_args->>'title');
 elsif p_method='support.history' then return public.workspace_support_history((p_args->>'id')::uuid);
 elsif p_method='context' then
  out:=workspace_private.support_connector_dispatch_v1(p_method,p_args);
  if nullif(p_args->>'project_id','') is not null then out:=out||jsonb_build_object('support',public.workspace_support_bundle((p_args->>'project_id')::uuid),'team',public.workspace_team_bundle((p_args->>'project_id')::uuid));end if;
  return out;
 end if;
 return workspace_private.support_connector_dispatch_v1(p_method,p_args);
end;$$;

create or replace function public.workspace_connector_call(p_token text,p_method text,p_args jsonb default '{}',p_request_id uuid default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare c workspace_private.connector_sessions;old_claims text;old_claim text;old_sub text;fingerprint text;previous workspace_private.connector_requests;out jsonb;write_op boolean;o workspace_private.reference_originals;
begin
 if p_token !~ '^wsc_[a-f0-9]{64}$' or octet_length(p_args::text)>1100000 then raise exception 'Solicitud inválida' using errcode='42501';end if;
 select * into c from workspace_private.connector_sessions where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if c.id is null or c.revoked_at is not null or c.expires_at<=now() or not exists(select 1 from auth.sessions where id=c.session_id and user_id=c.actor_id) then raise exception 'Conexión vencida o revocada; vuelve a conectar' using errcode='42501';end if;
 if c.window_at<now()-interval '1 minute' then c.window_at:=now();c.window_count:=0;end if;
 if c.window_count>=300 then raise exception 'Espera un minuto antes de continuar el lote' using errcode='PT429';end if;
 update workspace_private.connector_sessions set window_at=c.window_at,window_count=c.window_count+1 where id=c.id;
 old_claims:=current_setting('request.jwt.claims',true);
 old_claim:=current_setting('request.jwt.claim',true);old_sub:=current_setting('request.jwt.claim.sub',true);
 perform set_config('request.jwt.claim','',true);perform set_config('request.jwt.claim.sub',c.actor_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',c.actor_id,'session_id',c.session_id,'role','authenticated')::text,true);
 if not workspace_private.session_active() then raise exception 'Cuenta suspendida' using errcode='42501';end if;
 if p_method='disconnect' then
  update workspace_private.connector_sessions set revoked_at=now() where id=c.id;delete from auth.sessions where id=c.session_id and user_id=c.actor_id;out:='true';
 else
  write_op:=p_method in('support.save','support.action','support.prepare','reference.save','task.material','task.create','task.references','draft.save','event.save','workspace_original_begin');
  if write_op and p_request_id is null then raise exception 'Falta la clave de reanudación';end if;
  fingerprint:=encode(extensions.digest(jsonb_build_object('method',p_method,'args',p_args-'p_gateway_key')::text,'sha256'),'hex');
  if write_op then
   -- Actor-wide lock also serializes reconnection retries from separate sessions.
   perform pg_advisory_xact_lock(hashtextextended(c.actor_id::text||':'||p_request_id::text,0));
   select * into previous from workspace_private.connector_requests where actor_id=c.actor_id and request_id=p_request_id;
   if previous.request_id is not null then
    if previous.payload_hash<>fingerprint then raise exception 'Esta clave de lote corresponde a otros datos';end if;
    -- Never return an old payload after its edition/task access was removed.
    if previous.result ? 'project_id' and not workspace_private.can_read_project((previous.result->>'project_id')::uuid) then raise exception 'El acceso al destino cambió' using errcode='42501';end if;
    if p_method like 'draft.%' or p_method in('task.references','task.material') then perform workspace_private.require(case when p_method='draft.save' then 'content.edit_assigned' else 'task.assign' end,(select unit_id from public.workspace_deliverables where id=(p_args->>'deliverable_id')::uuid),(select project_id from public.workspace_deliverables where id=(p_args->>'deliverable_id')::uuid),(select area_id from public.workspace_deliverables where id=(p_args->>'deliverable_id')::uuid),(p_args->>'deliverable_id')::uuid);end if;
    if p_method in('support.save','support.action','support.prepare') and not exists(select 1 from workspace_private.support_documents s where s.id=case when p_method='support.save' then (previous.result->>'id')::uuid else (p_args->>'id')::uuid end
      and s.author_id=auth.uid() and workspace_private.support_create_for(auth.uid(),s.project_id,s.area_id)
      and (s.archived_at is null or (p_method='support.action' and p_args->>'action'='archive'))) then raise exception 'El acceso al documento cambió' using errcode='42501';end if;
    if p_method='task.create' and not workspace_private.can_read_task((previous.result->>'id')::uuid) then raise exception 'El acceso al encargo cambió' using errcode='42501';end if;
    if p_method='reference.save' and not coalesce(workspace_private.reference_writable((select r from workspace_private.edition_references r where id=(previous.result->>'id')::uuid and archived_at is null)),false) then raise exception 'El acceso a la referencia cambió' using errcode='42501';end if;
    if p_method='workspace_original_begin' then
     perform workspace_private.connector_dispatch('workspace_original_gate',p_args);
     select * into o from workspace_private.reference_originals where id=(previous.result->>'id')::uuid;
     if o.status='failed' then raise exception 'La subida anterior falló; prepara otro intento explícito';end if;
     out:=to_jsonb(o);
    else out:=previous.result;end if;
   else
    out:=workspace_private.connector_dispatch(p_method,p_args);
    insert into workspace_private.connector_requests(actor_id,request_id,method,payload_hash,result) values(c.actor_id,p_request_id,p_method,fingerprint,out);
   end if;
  else out:=workspace_private.connector_dispatch(p_method,p_args);end if;
 end if;
 perform set_config('request.jwt.claims',coalesce(old_claims,''),true);
 perform set_config('request.jwt.claim',coalesce(old_claim,''),true);perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
 return out;
end;$$;

-- Internal helpers have no API grants. Public RPCs expose only authenticated paths.
do $$declare f record;begin
 for f in select p.oid::regprocedure as identity from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='workspace_private' and (p.proname like 'support_%' or p.proname in('opal_reference_for','reference_writable','opal_original_for','opal_original_download','notification_visible','connector_dispatch'))
 loop execute 'revoke all on function '||f.identity||' from public,anon,authenticated';end loop;
end;$$;
revoke all on function public.workspace_support_bundle(uuid),public.workspace_save_support(uuid,jsonb,integer),public.workspace_support_action(uuid,text,jsonb,integer),public.workspace_support_history(uuid),public.workspace_prepare_support_original(uuid,text),public.workspace_team_bundle(uuid) from public,anon;
grant execute on function public.workspace_support_bundle(uuid),public.workspace_save_support(uuid,jsonb,integer),public.workspace_support_action(uuid,text,jsonb,integer),public.workspace_support_history(uuid),public.workspace_prepare_support_original(uuid,text),public.workspace_team_bundle(uuid) to authenticated;
revoke all on function public.workspace_reference_bundle(uuid),public.workspace_save_reference(uuid,jsonb,integer) from public,anon;
grant execute on function public.workspace_reference_bundle(uuid),public.workspace_save_reference(uuid,jsonb,integer) to authenticated;
create or replace function public.workspace_read_notification(p_id uuid default null,p_before timestamptz default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare n workspace_private.notifications;changed integer;
begin
 if not workspace_private.session_active() then raise exception 'Sesión revocada o cuenta suspendida' using errcode='42501';end if;
 if p_id is not null then
  select * into n from workspace_private.notifications where id=p_id and recipient_id=auth.uid();
  if n.id is null or not workspace_private.notification_visible(n) then raise exception 'Aviso no disponible en tu alcance' using errcode='42501';end if;
  update workspace_private.notifications set read_at=coalesce(read_at,now()) where id=n.id and recipient_id=auth.uid();
  return jsonb_build_object('id',n.id,'project_id',n.project_id,'deliverable_id',n.deliverable_id,'reference_id',n.reference_id,'support_id',n.support_id,'event_type',n.event_type);
 end if;
 if p_before is null or p_before>now() then raise exception 'Selecciona los avisos que quieres marcar';end if;
 update workspace_private.notifications n set read_at=now() where recipient_id=auth.uid() and read_at is null and created_at<=p_before and workspace_private.notification_visible(n);
 get diagnostics changed=row_count;return jsonb_build_object('read',changed);
end;$$;
create or replace function public.workspace_original_finish(p_id uuid,p_success boolean,p_gateway_key text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare o workspace_private.reference_originals;r workspace_private.edition_references;p public.workspace_projects;
begin
 perform workspace_private.original_gateway(p_gateway_key);
 select * into o from workspace_private.reference_originals where id=p_id for update;
 if o.id is null or o.uploaded_by<>auth.uid() then raise exception 'Original no autorizado' using errcode='42501';end if;
 select * into r from workspace_private.edition_references where id=o.reference_id and archived_at is null;
 select * into p from public.workspace_projects where id=r.project_id;
 if r.id is null or not coalesce(workspace_private.support_upload_allowed(r),false) then raise exception 'Sin permiso para completar esta subida' using errcode='42501';end if;
 if p_success is null then raise exception 'Resultado de subida inválido';end if;
 if o.status<>'reserved' then raise exception 'Este original ya se procesó';end if;
 -- Failure is accepted only after the trusted gateway has confirmed R2 deletion.
 update workspace_private.reference_originals set status=case when p_success then 'ready' else 'failed' end,verified_at=case when p_success then now() end where id=o.id;
 if not p_success then update workspace_private.original_limits set allocated_bytes=allocated_bytes-o.size_bytes where singleton;end if;
 select * into r from workspace_private.edition_references where id=o.reference_id;select * into p from public.workspace_projects where id=r.project_id;
 perform workspace_private.log(p.unit_id,p.id,r.area_id,null,case when p_success then 'original.verified' else 'original.failed' end,o.id,jsonb_build_object('sha256',o.sha256,'size_bytes',o.size_bytes));
 return jsonb_build_object('id',o.id,'verified',p_success);
end;$$;
notify pgrst,'reload schema';
