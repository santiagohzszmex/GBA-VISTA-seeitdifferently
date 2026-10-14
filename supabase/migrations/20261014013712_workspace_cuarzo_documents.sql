-- Cuarzo: explicit document delivery, independent of tasks and editorial approval.
-- Additive migration. Source documents, versions, roles and categories are preserved.
create table workspace_private.document_deliveries (
 id uuid primary key default gen_random_uuid(), unit_id uuid not null references public.workspace_units(id),
 document_id uuid not null references workspace_private.support_documents(id), revision integer not null,
 sender_id uuid not null references auth.users(id), recipient_id uuid not null references auth.users(id),
 snapshot jsonb not null, original_ids uuid[] not null default '{}',download_original_ids uuid[] not null default '{}',
 created_at timestamptz not null default now(), read_at timestamptz,
 unique(document_id,revision,recipient_id),check(sender_id<>recipient_id),
 check(revision>0 and octet_length(snapshot::text)<=1100000),check(cardinality(original_ids)<=100),check(download_original_ids <@ original_ids)
);
create index document_deliveries_recipient on workspace_private.document_deliveries(recipient_id,unit_id,created_at desc);
create index document_deliveries_sender on workspace_private.document_deliveries(sender_id,unit_id,created_at desc);
create index document_deliveries_unit on workspace_private.document_deliveries(unit_id);
create index document_deliveries_originals on workspace_private.document_deliveries using gin(original_ids);
create index document_deliveries_downloads on workspace_private.document_deliveries using gin(download_original_ids);
alter table workspace_private.document_deliveries enable row level security;
revoke all on workspace_private.document_deliveries from public,anon,authenticated;
alter table workspace_private.notifications add column delivery_id uuid references workspace_private.document_deliveries(id);
create index notifications_delivery on workspace_private.notifications(delivery_id) where delivery_id is not null;
alter table workspace_private.support_documents drop constraint support_documents_document_kind_check;
alter table workspace_private.support_documents add constraint support_documents_document_kind_check
 check(document_kind in('interview','notes','source','transcript','working','research'));

-- An active GIMG participant may receive an explicitly shared document across editions.
-- Never enumerate applicants/reserves, suspended users or expired assignments.
create function workspace_private.document_participant(p_unit uuid,p_user uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select workspace_private.member(p_unit,p_user) and exists(
 select 1 from public.workspace_projects p left join public.workspace_areas a on a.project_id=p.id
 left join public.workspace_deliverables t on t.project_id=p.id and t.area_id=a.id
 where p.unit_id=p_unit and p.deleted_at is null and (
 workspace_private.notification_allowed(p_user,'unit.members.read',p_unit,p.id,a.id,t.id)
 or workspace_private.notification_allowed(p_user,'reference.read',p_unit,p.id,a.id,t.id)
 or workspace_private.notification_allowed(p_user,'content.read',p_unit,p.id,a.id,t.id)));
$$;
create function workspace_private.document_delivery_for(d workspace_private.document_deliveries,p_user uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select d.id is not null and p_user in(d.sender_id,d.recipient_id)
 and workspace_private.document_participant(d.unit_id,p_user);
$$;
create function public.workspace_document_recipients(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare s workspace_private.support_documents;u uuid;begin
 select * into s from workspace_private.support_documents where id=p_id;
 if not coalesce(workspace_private.support_editable(s),false) then raise exception 'Sólo el autor puede elegir destinatarios de este documento' using errcode='42501';end if;
 select unit_id into u from public.workspace_projects where id=s.project_id;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',person.id,'display_name',coalesce(nullif(person.nombre_publico,''),person.nombre),'handle',person.nombre) order by person.nombre)
 from public.usuarios person join public.workspace_unit_memberships m on m.user_id=person.id and m.unit_id=u
 where person.id<>auth.uid() and workspace_private.document_participant(u,person.id)),'[]');
end;$$;
create function public.workspace_send_document(p_id uuid,p_recipients uuid[],p_revision integer) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare s workspace_private.support_documents;p public.workspace_projects;person uuid;d workspace_private.document_deliveries;
 snap jsonb;assets uuid[];downloads uuid[];sent integer:=0;begin
 select * into s from workspace_private.support_documents where id=p_id for update;
 if not coalesce(workspace_private.support_editable(s),false) then raise exception 'Sin permiso para enviar este documento' using errcode='42501';end if;
 if s.revision is distinct from p_revision then raise exception 'El documento cambió; guarda y revisa antes de enviarlo' using errcode='40001';end if;
 if coalesce(cardinality(p_recipients),0) not between 1 and 50 then raise exception 'Selecciona entre 1 y 50 destinatarios';end if;
 select * into p from public.workspace_projects where id=s.project_id;
 -- Validate the whole request before creating deliveries; invalid recipients never partially send.
 foreach person in array p_recipients loop
  if person is null or person=auth.uid() or not coalesce(workspace_private.document_participant(p.unit_id,person),false) then raise exception 'Uno de los destinatarios ya no está disponible en GIMG' using errcode='42501';end if;
 end loop;
 select coalesce(array_agg(distinct o.id),'{}') into assets from workspace_private.reference_originals o
 where o.status='ready' and workspace_private.opal_original_for(o,auth.uid()) and (exists(
 select 1 from workspace_private.edition_references r where r.id=o.reference_id and r.support_id=s.id and r.deliverable_id is null)
 or exists(select 1 from workspace_private.support_media m where m.document_id=s.id and m.original_id=o.id));
 select coalesce(array_agg(o.id),'{}') into downloads from workspace_private.reference_originals o where o.id=any(assets) and workspace_private.opal_original_download(o);
 snap:=jsonb_build_object('title',s.title,'content_document',s.content_document,'content_markdown',s.content_markdown,
 'credits',s.credits,'palette',s.palette,'document_kind',s.document_kind,'author_id',s.author_id,'edition_title',p.title,'project_id',p.id);
 for person in select distinct x from unnest(p_recipients)x loop
  insert into workspace_private.document_deliveries(unit_id,document_id,revision,sender_id,recipient_id,snapshot,original_ids,download_original_ids)
  values(p.unit_id,s.id,s.revision,auth.uid(),person,snap,assets,downloads)
  on conflict(document_id,revision,recipient_id) do nothing returning * into d;
  if d.id is not null then
   sent:=sent+1;
   insert into workspace_private.notifications(recipient_id,unit_id,project_id,delivery_id,actor_id,event_key,event_type,title,body,anchor_id)
   values(person,p.unit_id,p.id,d.id,auth.uid(),'document:'||d.id,'document.received','Te enviaron un documento',s.title,
    (select anchor from workspace_private.opal_mentions(s.content_document) where recipient=person limit 1)) on conflict do nothing;
   perform workspace_private.log(p.unit_id,p.id,s.area_id,null,'document.sent',d.id,jsonb_build_object('revision',s.revision,'recipient_id',person));
  end if;
 end loop;
 return jsonb_build_object('sent',sent,'revision',s.revision);
end;$$;
create function public.workspace_document_inbox(p_unit uuid,p_sent boolean default false,p_before timestamptz default null,p_before_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$begin
 if not workspace_private.document_participant(p_unit,auth.uid()) then raise exception 'Sin acceso a la bandeja de GIMG' using errcode='42501';end if;
 return coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc,id desc) from (
 select d.id,d.document_id,d.revision,d.created_at,d.read_at,d.sender_id,d.recipient_id,d.snapshot->>'title' as title,
 d.snapshot->>'edition_title' as edition_title,coalesce(nullif(s.nombre_publico,''),s.nombre) as sender_name,
 coalesce(nullif(r.nombre_publico,''),r.nombre) as recipient_name
 from workspace_private.document_deliveries d join public.usuarios s on s.id=d.sender_id join public.usuarios r on r.id=d.recipient_id
 where d.unit_id=p_unit and (case when p_sent then d.sender_id=auth.uid() else d.recipient_id=auth.uid() end)
 and (p_before is null or (d.created_at,d.id)<(p_before,p_before_id)) order by d.created_at desc,d.id desc limit 200)x),'[]');
end;$$;
create function public.workspace_read_document_delivery(p_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$declare d workspace_private.document_deliveries;assets jsonb;begin
 select * into d from workspace_private.document_deliveries where id=p_id;
 if not coalesce(workspace_private.document_delivery_for(d,auth.uid()),false) then raise exception 'Documento no disponible para tu cuenta' using errcode='42501';end if;
 if d.recipient_id=auth.uid() then
  update workspace_private.document_deliveries set read_at=coalesce(read_at,now()) where id=d.id returning * into d;
  update workspace_private.notifications set read_at=coalesce(read_at,now()) where delivery_id=d.id and recipient_id=auth.uid();
 end if;
 select coalesce(jsonb_agg(public.workspace_original_descriptor(o.id)),'[]') into assets from workspace_private.reference_originals o where o.id=any(d.original_ids) and o.status='ready';
 return d.snapshot||jsonb_build_object('id',d.id,'document_id',d.document_id,'revision',d.revision,'created_at',d.created_at,'read_at',d.read_at,'originals',assets,'can_edit',false);
end;$$;

-- Explicit delivery grants access only to the captured originals, never their container/siblings.
alter function workspace_private.opal_original_for(workspace_private.reference_originals,uuid) rename to cuarzo_original_for_base;
create function workspace_private.opal_original_for(o workspace_private.reference_originals,p_user uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select workspace_private.cuarzo_original_for_base(o,p_user) or (o.status='ready' and exists(
 select 1 from workspace_private.document_deliveries d where d.original_ids @> array[o.id] and workspace_private.document_delivery_for(d,p_user)));
$$;
alter function workspace_private.opal_original_download(workspace_private.reference_originals) rename to cuarzo_original_download_base;
create function workspace_private.opal_original_download(o workspace_private.reference_originals) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select workspace_private.cuarzo_original_download_base(o) or (o.status='ready' and exists(
 select 1 from workspace_private.document_deliveries d where d.download_original_ids @> array[o.id] and workspace_private.document_delivery_for(d,auth.uid())));
$$;
alter function workspace_private.notification_visible(workspace_private.notifications) rename to cuarzo_notification_base;
create function workspace_private.notification_visible(n workspace_private.notifications) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select case when n.delivery_id is not null then n.recipient_id=auth.uid() and coalesce((
 select workspace_private.document_delivery_for(d,auth.uid()) from workspace_private.document_deliveries d where d.id=n.delivery_id),false)
 else workspace_private.cuarzo_notification_base(n) end;
$$;
create or replace function public.workspace_notifications() returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$declare rows jsonb;unread integer;begin
 if not workspace_private.session_active() then raise exception 'Sesión revocada o cuenta suspendida' using errcode='42501';end if;
 perform workspace_private.queue_deadline_notices();
 select count(*)::integer into unread from workspace_private.notifications n where recipient_id=auth.uid() and read_at is null and workspace_private.notification_visible(n);
 select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc),'[]') into rows from(
 select n.id,n.event_type,n.title,n.body,n.project_id,n.deliverable_id,n.reference_id,n.support_id,n.delivery_id,n.anchor_id,n.created_at,n.read_at,p.title as edition_title
 from workspace_private.notifications n left join public.workspace_projects p on p.id=n.project_id where recipient_id=auth.uid() and workspace_private.notification_visible(n) order by created_at desc limit 60)x;
 return jsonb_build_object('items',rows,'unread_count',unread,'fetched_at',now());
end;$$;
-- Wrap the existing acknowledgement so all its revocation checks remain in effect.
alter function public.workspace_read_notification(uuid,timestamptz) rename to workspace_read_notification_cuarzo_base;
alter function public.workspace_read_notification_cuarzo_base(uuid,timestamptz) set schema workspace_private;
create function public.workspace_read_notification(p_id uuid default null,p_before timestamptz default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$declare out jsonb;n workspace_private.notifications;begin
 out:=workspace_private.workspace_read_notification_cuarzo_base(p_id,p_before);
 if p_id is not null then select * into n from workspace_private.notifications where id=p_id and recipient_id=auth.uid();
 out:=out||jsonb_build_object('delivery_id',n.delivery_id,'anchor_id',n.anchor_id);end if;return out;
end;$$;
-- Private documents can mention possible recipients; typing @ never grants access or sends.
create function public.workspace_support_mention_candidates(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$declare s workspace_private.support_documents;rows jsonb;begin
 select * into s from workspace_private.support_documents where id=p_id;
 rows:=public.workspace_document_recipients(p_id);
 if s.share_scope='private' then return rows;end if;
 return coalesce((select jsonb_agg(x) from jsonb_array_elements(rows)x where workspace_private.support_for(s,(x->>'user_id')::uuid)),'[]');
end;$$;

revoke all on function workspace_private.document_participant(uuid,uuid),workspace_private.document_delivery_for(workspace_private.document_deliveries,uuid),workspace_private.workspace_read_notification_cuarzo_base(uuid,timestamptz),workspace_private.opal_original_for(workspace_private.reference_originals,uuid),workspace_private.opal_original_download(workspace_private.reference_originals),workspace_private.notification_visible(workspace_private.notifications) from public,anon,authenticated;
revoke all on function public.workspace_document_recipients(uuid),public.workspace_send_document(uuid,uuid[],integer),public.workspace_document_inbox(uuid,boolean,timestamptz,uuid),public.workspace_read_document_delivery(uuid),public.workspace_support_mention_candidates(uuid),public.workspace_read_notification(uuid,timestamptz) from public,anon;
grant execute on function public.workspace_document_recipients(uuid),public.workspace_send_document(uuid,uuid[],integer),public.workspace_document_inbox(uuid,boolean,timestamptz,uuid),public.workspace_read_document_delivery(uuid),public.workspace_support_mention_candidates(uuid),public.workspace_read_notification(uuid,timestamptz) to authenticated;
notify pgrst,'reload schema';
