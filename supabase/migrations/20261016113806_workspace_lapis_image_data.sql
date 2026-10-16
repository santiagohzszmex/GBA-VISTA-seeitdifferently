-- Lapislázuli 1b. Data/commands only; no upload endpoints or UI are enabled.
begin;
alter table public.workspace_deliverables add column kind text not null default 'document' check(kind in('document','image'));
alter table public.workspace_versions add column kind text not null default 'document' check(kind in('document','image'));
create table workspace_private.image_specs(
 deliverable_id uuid primary key references public.workspace_deliverables(id),
 min_width integer check(min_width>0),min_height integer check(min_height>0),
 background text not null default 'any' check(background in('any','transparent','opaque')),
 layer_policy text not null default 'if_present' check(layer_policy in('always','if_present','unnecessary')),
 layer_formats text[] not null default array['psd','tiff','kra','procreate','afphoto','clip']
 check(cardinality(layer_formats)>0 and layer_formats <@ array['psd','tiff','kra','procreate','afphoto','clip']::text[]),
 placement text not null default '' check(length(placement)<=500),offer_to_documents boolean not null default true,
 revision integer not null default 1,updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now()
);
create table workspace_private.image_assets(
 id uuid primary key default gen_random_uuid(),deliverable_id uuid not null references public.workspace_deliverables(id),
 owner_id uuid not null references auth.users(id),role text not null check(role in('png','layered')),
 object_key text not null unique,file_name text not null check(length(file_name) between 1 and 240 and file_name !~ '[[:cntrl:]/\\]'),
 size_bytes bigint not null check(size_bytes>0),sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 mime_type text not null,format text not null check(format in('png','psd','tiff','kra','procreate','afphoto','clip')),
 status text not null default 'reserved' check(status in('reserved','validated','failed')),
 verification text not null default 'unverified' check(verification in('unverified','header','zip_manifest','decoded')),
 width integer check(width>0),height integer check(height>0),has_transparency boolean,color_profile text,
 metadata jsonb not null default '{}' check(jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=16384),
 created_at timestamptz not null default now(),verified_at timestamptz,
 check((role='png' and format='png' and mime_type='image/png') or (role='layered' and format<>'png')),
 check(role<>'png' or status<>'validated' or (verification='decoded' and width is not null and height is not null))
);
create index image_assets_task on workspace_private.image_assets(deliverable_id,status);
create index image_assets_owner on workspace_private.image_assets(owner_id,created_at);
create table workspace_private.image_upload_sessions(
 id uuid primary key default gen_random_uuid(),asset_id uuid not null unique references workspace_private.image_assets(id),
 owner_id uuid not null references auth.users(id),upload_id text,
 state text not null default 'reserved' check(state in('reserved','receiving','validating','ready','cancelled','expired','failed')),
 reserved_bytes bigint not null check(reserved_bytes>0),received_bytes bigint not null default 0 check(received_bytes>=0 and received_bytes<=reserved_bytes),
 parts jsonb not null default '[]' check(jsonb_typeof(parts)='array' and octet_length(parts::text)<=1048576),
 expires_at timestamptz not null,created_at timestamptz not null default now(),check(expires_at>created_at)
);
create index image_upload_expiry on workspace_private.image_upload_sessions(expires_at) where state in('reserved','receiving','validating');
create index image_upload_owner on workspace_private.image_upload_sessions(owner_id);
create table workspace_private.image_drafts(
 deliverable_id uuid not null references public.workspace_deliverables(id),author_id uuid not null references auth.users(id),
 png_asset_id uuid references workspace_private.image_assets(id),layered_asset_id uuid references workspace_private.image_assets(id),
 has_layers boolean not null default false,credits text not null default '' check(length(credits)<=10000),
 note_document jsonb not null default '{"type":"doc","attrs":{"schemaVersion":2},"content":[]}' check(octet_length(note_document::text)<=1048576),
 base_version integer not null check(base_version>=0),revision integer not null default 1,
 updated_at timestamptz not null default now(),warned_at timestamptz,primary key(deliverable_id,author_id)
);
create index image_specs_author on workspace_private.image_specs(updated_by);
create index image_drafts_png on workspace_private.image_drafts(png_asset_id) where png_asset_id is not null;
create index image_drafts_layered on workspace_private.image_drafts(layered_asset_id) where layered_asset_id is not null;
create index image_drafts_owner on workspace_private.image_drafts(author_id,updated_at);
alter table public.workspace_versions add constraint workspace_version_task_identity unique(id,deliverable_id);
create table workspace_private.image_versions(
 version_id uuid primary key references public.workspace_versions(id),deliverable_id uuid not null references public.workspace_deliverables(id),
 spec_snapshot jsonb not null,note_document jsonb not null,has_layers boolean not null,
 author_declares_layers boolean not null,created_at timestamptz not null default now(),
 foreign key(version_id,deliverable_id) references public.workspace_versions(id,deliverable_id)
);
create index image_versions_task on workspace_private.image_versions(deliverable_id,version_id);
create table workspace_private.image_version_files(
 version_id uuid not null references workspace_private.image_versions(version_id),role text not null check(role in('png','layered')),
 asset_id uuid not null references workspace_private.image_assets(id),primary key(version_id,role)
);
create index image_version_assets on workspace_private.image_version_files(asset_id);
create table workspace_private.image_derivatives(
 id uuid primary key default gen_random_uuid(),asset_id uuid not null references workspace_private.image_assets(id),
 kind text not null check(kind in('thumbnail','preview')),object_key text not null unique,
 size_bytes bigint not null check(size_bytes>0),sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 width integer not null check(width>0),height integer not null check(height>0),generator_version text not null,
 metadata_stripped boolean not null check(metadata_stripped),created_at timestamptz not null default now(),unique(asset_id,kind,generator_version)
);
create table workspace_private.image_notes(
 id uuid primary key default gen_random_uuid(),version_id uuid not null references workspace_private.image_versions(version_id),
 author_id uuid not null references auth.users(id),kind text not null check(kind in('pin','box')),
 x numeric not null check(x>=0 and x<=1),y numeric not null check(y>=0 and y<=1),
 width numeric not null default 0 check(width>=0 and width<=1),height numeric not null default 0 check(height>=0 and height<=1),
 body_document jsonb not null check(octet_length(body_document::text)<=1048576),created_at timestamptz not null default now(),
 check(x+width<=1 and y+height<=1),check((kind='pin' and width=0 and height=0) or (kind='box' and width>0 and height>0))
);
create index image_notes_version on workspace_private.image_notes(version_id,created_at,id);
create index image_notes_author on workspace_private.image_notes(author_id);
create table workspace_private.image_note_replies(
 id uuid primary key default gen_random_uuid(),note_id uuid not null references workspace_private.image_notes(id),
 author_id uuid not null references auth.users(id),body_document jsonb not null check(octet_length(body_document::text)<=1048576),created_at timestamptz not null default now()
);
create index image_replies_note on workspace_private.image_note_replies(note_id,created_at,id);
create index image_replies_author on workspace_private.image_note_replies(author_id);
create table workspace_private.image_note_resolutions(
 id uuid primary key default gen_random_uuid(),note_id uuid not null references workspace_private.image_notes(id),
 verified_version_id uuid not null references workspace_private.image_versions(version_id),resolved boolean not null,
 actor_id uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create index image_resolutions_note on workspace_private.image_note_resolutions(note_id,created_at desc,id);
create index image_resolutions_version on workspace_private.image_note_resolutions(verified_version_id);
create index image_resolutions_actor on workspace_private.image_note_resolutions(actor_id);

-- A single shared quota ledger includes pending originals and derivatives.
-- Cancelling/expiry must NOT release these bytes until R2 deletion is confirmed
-- by the trusted gateway (implemented in Phase 2, not in this migration).
create function workspace_private.image_reserve_bytes() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$declare l workspace_private.original_limits;max_bytes bigint;begin
 if tg_table_name='image_assets' then max_bytes:=workspace_private.upload_limit(new.role);else max_bytes:=workspace_private.upload_limit('png');end if;
 if new.size_bytes>max_bytes then raise exception 'El archivo supera el límite configurado';end if;
 select * into strict l from workspace_private.original_limits where singleton for update;
 if l.allocated_bytes+new.size_bytes>l.capacity_bytes then raise exception 'Se alcanzó la capacidad de almacenamiento';end if;
 update workspace_private.original_limits set allocated_bytes=allocated_bytes+new.size_bytes where singleton;
 return new;
end;$$;
create trigger image_asset_quota before insert on workspace_private.image_assets for each row execute function workspace_private.image_reserve_bytes();
create trigger image_derivative_quota before insert on workspace_private.image_derivatives for each row execute function workspace_private.image_reserve_bytes();
revoke all on function workspace_private.image_reserve_bytes() from public,anon,authenticated;

create function workspace_private.image_version_readable(p_version uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select workspace_private.session_active() and exists(select 1 from workspace_private.image_versions v join public.workspace_deliverables t on t.id=v.deliverable_id join public.workspace_projects p on p.id=t.project_id where v.version_id=p_version and p.deleted_at is null and workspace_private.can_read_content(t.id));
$$;
create function workspace_private.image_immutable() returns trigger
language plpgsql set search_path=pg_catalog,pg_temp as $$begin raise exception 'La versión enviada es inmutable; crea una versión nueva';end;$$;
create trigger image_version_immutable before update or delete on workspace_private.image_versions for each row execute function workspace_private.image_immutable();
create trigger image_files_immutable before update or delete on workspace_private.image_version_files for each row execute function workspace_private.image_immutable();
create trigger image_notes_immutable before update or delete on workspace_private.image_notes for each row execute function workspace_private.image_immutable();
create trigger image_replies_immutable before update or delete on workspace_private.image_note_replies for each row execute function workspace_private.image_immutable();
create trigger image_resolutions_immutable before update or delete on workspace_private.image_note_resolutions for each row execute function workspace_private.image_immutable();
create function workspace_private.image_asset_frozen() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$begin
 if exists(select 1 from workspace_private.image_version_files where asset_id=old.id) then raise exception 'El original enviado es inmutable';end if;
 if tg_op='DELETE' then return old;end if;return new;
end;$$;
create trigger image_asset_frozen before update or delete on workspace_private.image_assets for each row execute function workspace_private.image_asset_frozen();
create function workspace_private.image_file_link() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$declare a workspace_private.image_assets;t public.workspace_deliverables;v public.workspace_versions;begin
 select * into a from workspace_private.image_assets where id=new.asset_id;
 select * into v from public.workspace_versions where id=new.version_id;
 select * into t from public.workspace_deliverables where id=v.deliverable_id;
 if a.deliverable_id is distinct from t.id or a.role<>new.role or a.status<>'validated' or v.kind<>'image' or v.version_number<>t.current_version+1 then raise exception 'Archivo ajeno, sin validar o versión congelada';end if;
 if not exists(select 1 from workspace_private.image_versions where version_id=v.id and deliverable_id=t.id) then raise exception 'Versión de otra asignación';end if;
 return new;
end;$$;
create trigger image_file_link before insert on workspace_private.image_version_files for each row execute function workspace_private.image_file_link();

-- SELECT policies are defense in depth. No direct client INSERT/UPDATE/DELETE.
do $$declare n text;begin
 foreach n in array array['image_specs','image_assets','image_upload_sessions','image_drafts','image_versions','image_version_files','image_derivatives','image_notes','image_note_replies','image_note_resolutions'] loop
  execute format('alter table workspace_private.%I enable row level security',n);
  execute format('revoke all on workspace_private.%I from public,anon,authenticated',n);
 end loop;
end;$$;
-- Original keys and upload state remain private even to preview-only clients.
grant select on workspace_private.image_specs,workspace_private.image_drafts,workspace_private.image_versions,workspace_private.image_notes,workspace_private.image_note_replies,workspace_private.image_note_resolutions to authenticated;
create policy image_spec_read on workspace_private.image_specs for select to authenticated using(workspace_private.can_read_task(deliverable_id));
create policy image_draft_read on workspace_private.image_drafts for select to authenticated using(author_id=(select auth.uid()) and workspace_private.can_read_content(deliverable_id));
create policy image_version_read on workspace_private.image_versions for select to authenticated using(workspace_private.image_version_readable(version_id));
create policy image_note_read on workspace_private.image_notes for select to authenticated using(workspace_private.image_version_readable(version_id));
create policy image_reply_read on workspace_private.image_note_replies for select to authenticated using(exists(select 1 from workspace_private.image_notes n where n.id=note_id and workspace_private.image_version_readable(n.version_id)));
create policy image_resolution_read on workspace_private.image_note_resolutions for select to authenticated using(workspace_private.image_version_readable(verified_version_id) and exists(select 1 from workspace_private.image_notes n where n.id=note_id and workspace_private.image_version_readable(n.version_id)));
revoke all on function workspace_private.image_version_readable(uuid) from public,anon;
grant execute on function workspace_private.image_version_readable(uuid) to authenticated;
revoke all on function workspace_private.image_immutable(),workspace_private.image_asset_frozen(),workspace_private.image_file_link() from public,anon,authenticated;

-- A separate command surface keeps legacy text editing untouched.
create function public.workspace_image_command(p_action text,p_deliverable_id uuid,p_data jsonb,p_revision integer) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare t public.workspace_deliverables;s workspace_private.image_specs;d workspace_private.image_drafts;a workspace_private.image_assets;b workspace_private.image_assets;n workspace_private.image_notes;v public.workspace_versions;target uuid;body jsonb;result jsonb;num integer;policy workspace_private.upload_policy;
begin
 if not workspace_private.session_active() then raise exception 'Sesión activa requerida' using errcode='42501';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>1100000 then raise exception 'Datos inválidos';end if;
 select * into t from public.workspace_deliverables where id=p_deliverable_id for update;
 if t.id is null or not workspace_private.can_read_task(t.id) or not exists(select 1 from public.workspace_projects where id=t.project_id and deleted_at is null and status='active') then raise exception 'Asignación no disponible' using errcode='42501';end if;
 select * into policy from workspace_private.upload_policy where singleton;
 if not policy.images_enabled then raise exception 'Lapislázuli todavía no está habilitado';end if;
 if p_action='spec.save' then
  perform workspace_private.require('task.assign',t.unit_id,t.project_id,t.area_id,t.id);
  if p_revision is distinct from t.revision then raise exception 'La asignación cambió; vuelve a cargar';end if;
  if t.state not in('pending','assigned','in_progress','changes_requested') then raise exception 'Reabre la asignación antes de modificar su ficha';end if;
  if coalesce(p_data->>'kind','image')='document' then
   if t.current_version>0 or exists(select 1 from workspace_private.image_assets where deliverable_id=t.id) or exists(select 1 from workspace_private.image_drafts where deliverable_id=t.id) then raise exception 'La asignación ya contiene imágenes';end if;
   update public.workspace_deliverables set kind='document' where id=t.id;
  else
   if p_data->>'kind' is not null and p_data->>'kind'<>'image' then raise exception 'Tipo inválido';end if;
   if t.kind='document' and (t.current_version>0 or exists(select 1 from workspace_private.drafts where deliverable_id=t.id)) then raise exception 'Conserva esta asignación de documento; crea otra para imagen';end if;
   insert into workspace_private.image_specs(deliverable_id,min_width,min_height,background,layer_policy,layer_formats,placement,offer_to_documents,updated_by)
   values(t.id,(p_data->>'min_width')::integer,(p_data->>'min_height')::integer,coalesce(p_data->>'background','any'),coalesce(p_data->>'layer_policy','if_present'),case when p_data?'layer_formats' then array(select jsonb_array_elements_text(p_data->'layer_formats')) else array['psd','tiff','kra','procreate','afphoto','clip'] end,coalesce(p_data->>'placement',''),coalesce((p_data->>'offer_to_documents')::boolean,true),auth.uid())
   on conflict(deliverable_id) do update set min_width=excluded.min_width,min_height=excluded.min_height,background=excluded.background,layer_policy=excluded.layer_policy,layer_formats=excluded.layer_formats,placement=excluded.placement,offer_to_documents=excluded.offer_to_documents,revision=workspace_private.image_specs.revision+1,updated_by=auth.uid(),updated_at=now();
   update public.workspace_deliverables set kind='image' where id=t.id;
  end if;
  select to_jsonb(z) into result from public.workspace_deliverables z where z.id=t.id;
 elsif p_action in('draft.save','version.submit') then
  perform workspace_private.require('content.edit_assigned',t.unit_id,t.project_id,t.area_id,t.id);
  if t.kind<>'image' or t.state not in('pending','assigned','in_progress','changes_requested') then raise exception 'Reabre la imagen antes de editar o enviar';end if;
  select * into s from workspace_private.image_specs where deliverable_id=t.id;
  select * into d from workspace_private.image_drafts where deliverable_id=t.id and author_id=auth.uid() for update;
  if p_revision is distinct from coalesce(d.revision,0) then raise exception 'El borrador cambió; vuelve a cargar';end if;
  if coalesce((p_data->>'base_version')::integer,-1)<>t.current_version then raise exception 'La versión base cambió';end if;
  body:=coalesce(p_data->'note_document','{"type":"doc","attrs":{"schemaVersion":2},"content":[]}'::jsonb);
  if body->>'type' is distinct from 'doc' then raise exception 'Nota inválida';end if;
  perform workspace_private.opal_validate(body);perform workspace_private.opal_assert_media(body,t.project_id);
  perform workspace_private.document_markdown(body);
  select * into a from workspace_private.image_assets where id=(p_data->>'png_asset_id')::uuid;
  select * into b from workspace_private.image_assets where id=(p_data->>'layered_asset_id')::uuid;
  if p_data->>'png_asset_id' is not null and (a.id is null or a.deliverable_id<>t.id or a.owner_id<>auth.uid() or a.role<>'png') then raise exception 'PNG de otra asignación' using errcode='42501';end if;
  if p_data->>'layered_asset_id' is not null and (b.id is null or b.deliverable_id<>t.id or b.owner_id<>auth.uid() or b.role<>'layered') then raise exception 'Capas de otra asignación' using errcode='42501';end if;
  if p_action='draft.save' then
   insert into workspace_private.image_drafts(deliverable_id,author_id,png_asset_id,layered_asset_id,has_layers,credits,note_document,base_version)
   values(t.id,auth.uid(),a.id,b.id,coalesce((p_data->>'has_layers')::boolean,false),coalesce(p_data->>'credits',(select coalesce(nombre_publico,nombre,'') from public.usuarios where id=auth.uid()),''),body,t.current_version)
   on conflict(deliverable_id,author_id) do update set png_asset_id=excluded.png_asset_id,layered_asset_id=excluded.layered_asset_id,has_layers=excluded.has_layers,credits=excluded.credits,note_document=excluded.note_document,base_version=excluded.base_version,revision=workspace_private.image_drafts.revision+1,updated_at=now(),warned_at=null returning to_jsonb(workspace_private.image_drafts.*) into result;
  else
   perform workspace_private.require('content.request_review',t.unit_id,t.project_id,t.area_id,t.id);
   if a.status is distinct from 'validated' or a.verification is distinct from 'decoded' or a.size_bytes>policy.png_max_bytes or a.width::bigint*a.height>policy.max_pixels then raise exception 'Se requiere un PNG válido y dentro de los límites de seguridad';end if;
   if exists(select 1 from workspace_private.image_upload_sessions x where x.asset_id in(a.id,b.id) and x.state<>'ready') then raise exception 'Hay una subida sin completar';end if;
   if (s.layer_policy='always' or (s.layer_policy='if_present' and coalesce((p_data->>'has_layers')::boolean,false))) and b.id is null then raise exception 'Falta el archivo con capas requerido';end if;
   if b.id is not null and (b.status<>'validated' or b.size_bytes>policy.layered_max_bytes or not b.format=any(s.layer_formats) or (b.format in('psd','tiff') and b.verification<>'header') or (b.format='kra' and b.verification<>'zip_manifest') or (b.format in('procreate','afphoto','clip') and b.verification<>'unverified')) then raise exception 'Adjunto sin validar o formato no permitido';end if;
   num:=t.current_version+1;
   insert into public.workspace_versions(deliverable_id,version_number,kind,credits,change_summary,author_id) values(t.id,num,'image',coalesce(p_data->>'credits',(select coalesce(nombre_publico,nombre,'') from public.usuarios where id=auth.uid()),''),coalesce(p_data->>'change_summary','Nueva versión de imagen'),auth.uid()) returning * into v;
   insert into workspace_private.image_versions(version_id,deliverable_id,spec_snapshot,note_document,has_layers,author_declares_layers) values(v.id,t.id,to_jsonb(s),body,b.id is not null,coalesce((p_data->>'has_layers')::boolean,false));
   insert into workspace_private.image_version_files values(v.id,'png',a.id);
   if b.id is not null then insert into workspace_private.image_version_files values(v.id,'layered',b.id);end if;
   update public.workspace_deliverables set current_version=num,state='review',area_approved_by=null,qa_approved_by=null,final_approved_by=null,final_approved_at=null where id=t.id;
   delete from workspace_private.image_drafts where deliverable_id=t.id and author_id=auth.uid();
   result:=to_jsonb(v);
  end if;
 elsif p_action in('note.add','note.reply','note.resolve','note.verify') then
  perform workspace_private.require('content.comment',t.unit_id,t.project_id,t.area_id,t.id);
  if t.state not in('review','in_qa','changes_requested','in_progress') then raise exception 'La imagen está en solo lectura';end if;
  if p_action='note.add' then
   target:=(p_data->>'version_id')::uuid;
  else
   select * into n from workspace_private.image_notes where id=(p_data->>'note_id')::uuid;
   target:=n.version_id;
  end if;
  if not exists(select 1 from workspace_private.image_versions where version_id=target and deliverable_id=t.id) or not workspace_private.image_version_readable(target) then raise exception 'Nota o versión de otra asignación' using errcode='42501';end if;
  if p_action in('note.add','note.reply') then
   body:=p_data->'body_document';
   if body->>'type' is distinct from 'doc' or octet_length(body::text)>1048576 or length(trim(workspace_private.document_markdown(body)))=0 then raise exception 'Nota vacía o inválida';end if;
   perform workspace_private.opal_validate(body);perform workspace_private.opal_assert_media(body,t.project_id);
   if p_action='note.add' then
    insert into workspace_private.image_notes(version_id,author_id,kind,x,y,width,height,body_document) values(target,auth.uid(),p_data->>'kind',(p_data->>'x')::numeric,(p_data->>'y')::numeric,coalesce((p_data->>'width')::numeric,0),coalesce((p_data->>'height')::numeric,0),body) returning to_jsonb(workspace_private.image_notes.*) into result;
   else
    insert into workspace_private.image_note_replies(note_id,author_id,body_document) values(n.id,auth.uid(),body) returning to_jsonb(workspace_private.image_note_replies.*) into result;
   end if;
  else
   if p_action='note.verify' then perform workspace_private.require('review.request_changes',t.unit_id,t.project_id,t.area_id,t.id);end if;
   target:=coalesce((p_data->>'verified_version_id')::uuid,n.version_id);
   if p_action='note.resolve' and target<>n.version_id then raise exception 'La verificación entre versiones requiere revisión';end if;
   if not exists(select 1 from workspace_private.image_versions where version_id=target and deliverable_id=t.id) then raise exception 'Versión de otra asignación' using errcode='42501';end if;
   if not exists(select 1 from public.workspace_versions nv join public.workspace_versions ov on ov.id=n.version_id where nv.id=target and nv.version_number>=ov.version_number) then raise exception 'No se verifica en una versión anterior';end if;
   if not exists(select 1 from workspace_private.image_version_files oldf join workspace_private.image_assets olda on olda.id=oldf.asset_id join workspace_private.image_version_files newf on newf.version_id=target and newf.role='png' join workspace_private.image_assets newa on newa.id=newf.asset_id where oldf.version_id=n.version_id and oldf.role='png' and olda.width::bigint*newa.height=newa.width::bigint*olda.height) then raise exception 'La proporción cambió; consulta la nota en su versión original';end if;
   insert into workspace_private.image_note_resolutions(note_id,verified_version_id,resolved,actor_id) values(n.id,target,coalesce((p_data->>'resolved')::boolean,true),auth.uid()) returning to_jsonb(workspace_private.image_note_resolutions.*) into result;
  end if;
 else raise exception 'Comando de imagen desconocido';end if;
 perform workspace_private.log(t.unit_id,t.project_id,t.area_id,t.id,'image.'||p_action,t.id,jsonb_build_object('result_id',result->>'id','version_id',result->>'version_id'));
 return result;
end;$$;
revoke all on function public.workspace_image_command(text,uuid,jsonb,integer) from public,anon;
grant execute on function public.workspace_image_command(text,uuid,jsonb,integer) to authenticated;

-- Prevent old clients/connector commands from bypassing the image contract.
alter function public.workspace_command(text,jsonb,integer) set schema workspace_private;
alter function workspace_private.workspace_command(text,jsonb,integer) rename to lapis_legacy_command;
create function public.workspace_command(p_action text,p_data jsonb,p_revision integer default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$begin
 if p_action='version.submit' and workspace_private.can_read_task((p_data->>'deliverable_id')::uuid) and exists(select 1 from public.workspace_deliverables where id=(p_data->>'deliverable_id')::uuid and kind='image') then raise exception 'Las imágenes se envían mediante su comando de imagen';end if;
 return workspace_private.lapis_legacy_command(p_action,p_data,p_revision);
end;$$;
revoke all on function workspace_private.lapis_legacy_command(text,jsonb,integer) from public,anon,authenticated;
revoke all on function public.workspace_command(text,jsonb,integer) from public,anon;
grant execute on function public.workspace_command(text,jsonb,integer) to authenticated;
notify pgrst,'reload schema';
commit;
