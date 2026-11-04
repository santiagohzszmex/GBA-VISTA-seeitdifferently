-- Workspace 1.7.5 · Lapislázuli · Puente con Ultramar (contrato gba.workspace.ultramar/1).
-- Apagado por defecto. No crea roles ni cambia la matriz de permisos. No aprueba ni publica:
-- una versión enviada desde Ultramar entra en la revisión de área de siempre.

alter table workspace_private.upload_policy
 add column if not exists ultramar_enabled boolean not null default false,
 add column if not exists ultramar_package_max_bytes bigint not null default 262144000 check(ultramar_package_max_bytes>0),
 add column if not exists ultramar_pdf_max_bytes bigint not null default 104857600 check(ultramar_pdf_max_bytes>0),
 add column if not exists ultramar_preview_max_bytes bigint not null default 20971520 check(ultramar_preview_max_bytes>0);

create table workspace_private.ultramar_snapshots(
 id uuid primary key default gen_random_uuid(),
 deliverable_id uuid not null references public.workspace_deliverables(id),
 project_id uuid not null, unit_id uuid not null,
 version integer not null check(version>0),
 task_revision integer not null,
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=4000000),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(deliverable_id,version)
);
create table workspace_private.ultramar_reservations(
 id uuid primary key default gen_random_uuid(),
 deliverable_id uuid not null references public.workspace_deliverables(id),
 snapshot_id uuid not null references workspace_private.ultramar_snapshots(id),
 author_id uuid not null references auth.users(id),
 idempotency_key text not null check(idempotency_key ~ '^[A-Za-z0-9._-]{16,80}$'),
 base_revision integer not null,
 state text not null default 'reserved' check(state in('reserved','submitted','cancelled')),
 version_id uuid references public.workspace_versions(id),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '24 hours',
 unique(author_id,idempotency_key)
);
create table workspace_private.ultramar_files(
 reservation_id uuid not null references workspace_private.ultramar_reservations(id),
 role text not null check(role in('ultramar','pdf','preview')),
 file_name text not null check(length(file_name) between 1 and 240 and file_name !~ '[/\\]'),
 size_bytes bigint not null check(size_bytes>0),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 object_key text unique,
 verified_at timestamptz,
 validation jsonb not null default '{}'::jsonb,
 primary key(reservation_id,role)
);
create table workspace_private.ultramar_versions(
 version_id uuid primary key references public.workspace_versions(id),
 reservation_id uuid not null unique references workspace_private.ultramar_reservations(id),
 snapshot_id uuid not null references workspace_private.ultramar_snapshots(id)
);
alter table workspace_private.ultramar_snapshots enable row level security;
alter table workspace_private.ultramar_reservations enable row level security;
alter table workspace_private.ultramar_files enable row level security;
alter table workspace_private.ultramar_versions enable row level security;
revoke all on workspace_private.ultramar_snapshots,workspace_private.ultramar_reservations,workspace_private.ultramar_files,workspace_private.ultramar_versions from public,anon,authenticated;

-- JSON con claves ordenadas, compacto y UTF-8: la convención acordada con Ultramar (F1.13).
create function workspace_private.ultramar_canonical(j jsonb) returns text
language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
declare out text;
begin
 case jsonb_typeof(j)
  when 'object' then
   select '{'||coalesce(string_agg(to_jsonb(k)::text||':'||workspace_private.ultramar_canonical(v),',' order by k collate "C"),'')||'}' into out from jsonb_each(j) e(k,v);
  when 'array' then
   select '['||coalesce(string_agg(workspace_private.ultramar_canonical(v),',' order by n),'')||']' into out from jsonb_array_elements(j) with ordinality a(v,n);
  else out:=j::text;
 end case;
 return out;
end;$$;
create function workspace_private.ultramar_sha(j jsonb) returns text
language sql immutable set search_path=pg_catalog,pg_temp as $$
 select encode(extensions.digest(convert_to(workspace_private.ultramar_canonical(j),'UTF8'),'sha256'),'hex')
$$;

-- Puerta común: servicio encendido, sesión real, licencia Sepia ’01 vigente y conexión de Ultramar
-- ligada a esta misma sesión de Auth. Cerrar la conexión de Ultramar corta el puente.
create function workspace_private.ultramar_gate() returns void
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare sid uuid;
begin
 if not coalesce((select ultramar_enabled from workspace_private.upload_policy limit 1),false) then raise exception 'La conexión con Ultramar no está disponible todavía' using errcode='42501';end if;
 if not workspace_private.session_active() then raise exception 'Sesión no válida. Vuelve a iniciar sesión' using errcode='42501';end if;
 begin sid:=(auth.jwt()->>'session_id')::uuid;exception when others then sid:=null;end;
 if sid is null or not exists(select 1 from sepia_private.connections c where c.user_id=auth.uid() and c.app='ultramar' and c.auth_session_id=sid and c.revoked_at is null and c.expires_at>now()) then
  raise exception 'Conecta Ultramar con tu GBA ID para continuar' using errcode='42501';end if;
 if not exists(select 1 from sepia_private.licenses l where l.user_id=auth.uid() and l.revoked_at is null and l.starts_at<=now() and l.expires_at>now()) then
  raise exception 'Necesitas una licencia vigente de Sepia ’01 para usar Ultramar con Workspace' using errcode='42501';end if;
end;$$;

-- Asignación de maquetación accesible para quien la realiza.
create function workspace_private.ultramar_task(p_deliverable_id uuid,p_for_update boolean default false) returns public.workspace_deliverables
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare t public.workspace_deliverables;
begin
 if p_for_update then select * into t from public.workspace_deliverables where id=p_deliverable_id for update;
 else select * into t from public.workspace_deliverables where id=p_deliverable_id;end if;
 if t.id is null or not exists(select 1 from public.workspace_areas a where a.id=t.area_id and a.specialty='integration') then raise exception 'Asignación fuera de tu acceso' using errcode='42501';end if;
 if not (t.responsible_id=auth.uid() or auth.uid()=any(t.collaborator_ids)) then raise exception 'Asignación fuera de tu acceso' using errcode='42501';end if;
 perform workspace_private.require('content.edit_assigned',t.unit_id,t.project_id,t.area_id,t.id);
 perform workspace_private.require_open_project(t.project_id);
 return t;
end;$$;

-- Preparar: arma una instantánea inmutable con los materiales del encargo (task_references),
-- las indicaciones de la asignación y la página en puntos/RGB.
create function public.workspace_ultramar_prepare(p_deliverable_id uuid,p_data jsonb,p_revision integer) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare t public.workspace_deliverables;p jsonb:=coalesce(p_data->'pagina','{}'::jsonb);w float8;h float8;b jsonb;
 v integer;payload jsonb;textos jsonb;recursos jsonb;snap_id uuid:=gen_random_uuid();sha text;
begin
 if not coalesce((select ultramar_enabled from workspace_private.upload_policy limit 1),false) then raise exception 'La conexión con Ultramar no está disponible todavía' using errcode='42501';end if;
 if not workspace_private.session_active() then raise exception 'Sesión no válida. Vuelve a iniciar sesión' using errcode='42501';end if;
 select * into t from public.workspace_deliverables where id=p_deliverable_id for update;
 if t.id is null then raise exception 'Asignación fuera de tu acceso' using errcode='42501';end if;
 perform workspace_private.require('task.assign',t.unit_id,t.project_id,t.area_id,t.id);
 perform workspace_private.require_open_project(t.project_id);
 if not exists(select 1 from public.workspace_areas a where a.id=t.area_id and a.specialty='integration') then raise exception 'Sólo las asignaciones de integración y maquetación se abren en Ultramar';end if;
 if t.state not in('pending','assigned','in_progress','changes_requested') then raise exception 'La asignación está en revisión o cerrada';end if;
 if p_revision is distinct from t.revision then raise exception 'La asignación cambió; actualiza la vista' using errcode='40001';end if;
 begin w:=(p->>'ancho')::float8;h:=(p->>'alto')::float8;exception when others then raise exception 'Revisa el tamaño de página';end;
 b:=coalesce(p->'sangrado',jsonb_build_object('arriba',0,'derecha',0,'abajo',0,'izquierda',0));
 if w is null or h is null or w<=0 or h<=0 or w>14400 or h>14400 or coalesce(p->>'unidad','pt')<>'pt' or coalesce(p->>'colorModel','RGB')<>'RGB' then raise exception 'Revisa el tamaño de página (puntos, RGB)';end if;
 if jsonb_typeof(b)<>'object' or exists(select 1 from (values('arriba'),('derecha'),('abajo'),('izquierda')) s(k) where (b->>s.k) is null or (b->>s.k)::float8<0 or (b->>s.k)::float8>720) then raise exception 'Revisa el sangrado';end if;
 -- Textos: documentos aceptados ligados como materiales (instantánea ya guardada por task_references).
 -- Un documento antiguo sin estructura se entrega como párrafos de su texto, sin interpretar Markdown.
 select coalesce(jsonb_agg(jsonb_build_object(
   'referencia',jsonb_build_object('id',x.source_id::text,'version',x.version_label,'revision',x.revision::text,'sha256',workspace_private.ultramar_sha(jsonb_build_object('titulo',x.titulo,'bloques',x.bloques))),
   'titulo',x.titulo,'bloques',x.bloques) order by x.linked_at,x.source_id),'[]'::jsonb)
 into textos from (
  select r.source_id,r.revision,r.linked_at,coalesce(r.snapshot->>'title','') titulo,
   coalesce((select v.version_number::text from public.workspace_versions v where v.id=r.version_id),r.revision::text) version_label,
   coalesce(r.snapshot->'content_document'->'content',
    (select coalesce(jsonb_agg(jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text',l))) order by n),'[]'::jsonb)
     from regexp_split_to_table(coalesce(r.snapshot->>'content_markdown',''),E'\n') with ordinality m(l,n) where length(trim(l))>0)) bloques
  from workspace_private.task_references r where r.deliverable_id=t.id and r.version_id is not null) x;
 -- Originales: los ligados a los materiales del encargo, ya verificados en R2.
 select coalesce(jsonb_agg(jsonb_build_object(
   'referencia',jsonb_build_object('id',o.id::text,'version','1','revision','1','sha256',o.sha256),
   'nombre',o.file_name,'mime',o.mime_type,'bytes',o.size_bytes) order by o.created_at,o.id),'[]'::jsonb)
 into recursos from workspace_private.reference_originals o
 where o.status='ready' and o.id in(select unnest(r.original_ids) from workspace_private.task_references r where r.deliverable_id=t.id);
 select coalesce(max(version),0)+1 into v from workspace_private.ultramar_snapshots where deliverable_id=t.id;
 payload:=jsonb_build_object(
  'edicion',jsonb_build_object('id',t.project_id::text,'titulo',(select title from public.workspace_projects where id=t.project_id)),
  'asignacion',jsonb_build_object('id',t.id::text,'titulo',t.title),
  'instrucciones',left(coalesce(nullif(trim(p_data->>'instrucciones'),''),t.description,''),20000),
  'especificaciones',jsonb_build_object('unidad','pt','colorModel','RGB','ancho',to_jsonb(w),'alto',to_jsonb(h),
    'sangrado',jsonb_build_object('arriba',to_jsonb((b->>'arriba')::float8),'derecha',to_jsonb((b->>'derecha')::float8),'abajo',to_jsonb((b->>'abajo')::float8),'izquierda',to_jsonb((b->>'izquierda')::float8))),
  'textos',textos,'recursos',recursos);
 sha:=workspace_private.ultramar_sha(payload);
 insert into workspace_private.ultramar_snapshots(id,deliverable_id,project_id,unit_id,version,task_revision,payload,sha256,created_by)
 values(snap_id,t.id,t.project_id,t.unit_id,v,t.revision,payload,sha,auth.uid());
 return jsonb_build_object('id',snap_id,'version',v,'sha256',sha,'textos',jsonb_array_length(textos),'recursos',jsonb_array_length(recursos));
end;$$;

-- Catálogo para Ultramar: sólo asignaciones propias de integración con instantánea.
create function public.workspace_ultramar_assignments() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare out jsonb;
begin
 perform workspace_private.ultramar_gate();
 select coalesce(jsonb_agg(jsonb_build_object(
   'edicionId',t.project_id::text,'edicionTitulo',pr.title,'asignacionId',t.id::text,'titulo',t.title,
   'estado',t.state,'fechaLimite',t.due_at,'revision',t.revision,
   'instantanea',jsonb_build_object('id',s.id::text,'version',s.version::text,'revision',s.task_revision::text,'sha256',s.sha256)) order by t.due_at nulls last,t.title),'[]'::jsonb)
 into out
 from public.workspace_deliverables t
 join public.workspace_areas a on a.id=t.area_id and a.specialty='integration'
 join public.workspace_projects pr on pr.id=t.project_id and pr.status not in('closed','archived') and pr.deleted_at is null
 join lateral (select * from workspace_private.ultramar_snapshots s where s.deliverable_id=t.id order by s.version desc limit 1) s on true
 where (t.responsible_id=auth.uid() or auth.uid()=any(t.collaborator_ids))
   and t.state not in('published','archived')
   and workspace_private.allowed('content.edit_assigned',t.unit_id,t.project_id,t.area_id,t.id);
 return out;
end;$$;

create function public.workspace_ultramar_snapshot(p_deliverable_id uuid,p_snapshot_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare t public.workspace_deliverables;s workspace_private.ultramar_snapshots;
begin
 perform workspace_private.ultramar_gate();
 t:=workspace_private.ultramar_task(p_deliverable_id);
 if p_snapshot_id is null then select * into s from workspace_private.ultramar_snapshots where deliverable_id=t.id order by version desc limit 1;
 else select * into s from workspace_private.ultramar_snapshots where id=p_snapshot_id and deliverable_id=t.id;end if;
 if s.id is null then raise exception 'Esta asignación todavía no está preparada para Ultramar';end if;
 return s.payload||jsonb_build_object('referencia',jsonb_build_object('id',s.id::text,'version',s.version::text,'revision',s.task_revision::text,'sha256',s.sha256));
end;$$;

-- Original de una instantánea: sólo descriptor; los bytes se leen por la pasarela R2 existente
-- con la misma sesión (workspace_original_access vuelve a autorizar la lectura).
create function public.workspace_ultramar_original(p_deliverable_id uuid,p_snapshot_id uuid,p_resource_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare t public.workspace_deliverables;s workspace_private.ultramar_snapshots;o workspace_private.reference_originals;
begin
 perform workspace_private.ultramar_gate();
 t:=workspace_private.ultramar_task(p_deliverable_id);
 select * into s from workspace_private.ultramar_snapshots where id=p_snapshot_id and deliverable_id=t.id;
 if s.id is null or not exists(select 1 from jsonb_array_elements(s.payload->'recursos') r where r->'referencia'->>'id'=p_resource_id::text) then raise exception 'Recurso fuera de esta instantánea' using errcode='42501';end if;
 select * into o from workspace_private.reference_originals where id=p_resource_id and status='ready';
 if o.id is null then raise exception 'El original ya no está disponible';end if;
 return jsonb_build_object('id',o.id,'sha256',o.sha256,'bytes',o.size_bytes,'mime',o.mime_type,'ruta','/originals/'||o.id::text,'expira',now()+interval '5 minutes');
end;$$;

-- Reserva idempotente de un envío. Repetir la misma clave devuelve la misma reserva.
create function public.workspace_ultramar_reserve(p_deliverable_id uuid,p_snapshot_id uuid,p_base_revision integer,p_idempotency_key text,p_files jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare t public.workspace_deliverables;r workspace_private.ultramar_reservations;pol workspace_private.upload_policy;f jsonb;roles text[];limit_bytes bigint;
begin
 perform workspace_private.ultramar_gate();
 select * into r from workspace_private.ultramar_reservations where author_id=auth.uid() and idempotency_key=p_idempotency_key;
 if r.id is not null then
  if r.deliverable_id<>p_deliverable_id or r.snapshot_id<>p_snapshot_id then raise exception 'Esa clave de envío pertenece a otra asignación';end if;
  return jsonb_build_object('id',r.id,'estado',r.state,'version_id',r.version_id,'archivos',(select jsonb_agg(jsonb_build_object('rol',role,'verificado',verified_at is not null) order by role) from workspace_private.ultramar_files where reservation_id=r.id));
 end if;
 t:=workspace_private.ultramar_task(p_deliverable_id,true);
 perform workspace_private.require('content.request_review',t.unit_id,t.project_id,t.area_id,t.id);
 if t.state not in('pending','assigned','in_progress','changes_requested') then raise exception 'La asignación está en revisión o cerrada';end if;
 if p_base_revision is distinct from t.revision then raise exception 'La asignación cambió en Workspace; actualiza antes de enviar' using errcode='40001';end if;
 if not exists(select 1 from workspace_private.ultramar_snapshots where id=p_snapshot_id and deliverable_id=t.id) then raise exception 'Instantánea fuera de esta asignación' using errcode='42501';end if;
 if p_idempotency_key !~ '^[A-Za-z0-9._-]{16,80}$' then raise exception 'Clave de envío inválida';end if;
 if jsonb_typeof(p_files)<>'array' or jsonb_array_length(p_files)<>3 then raise exception 'Envía el archivo .ultramar, el PDF y la vista previa';end if;
 select array_agg(x->>'role' order by x->>'role') into roles from jsonb_array_elements(p_files) x;
 if roles is distinct from array['pdf','preview','ultramar'] then raise exception 'Envía el archivo .ultramar, el PDF y la vista previa';end if;
 select * into pol from workspace_private.upload_policy limit 1;
 insert into workspace_private.ultramar_reservations(deliverable_id,snapshot_id,author_id,idempotency_key,base_revision)
 values(t.id,p_snapshot_id,auth.uid(),p_idempotency_key,t.revision) returning * into r;
 for f in select * from jsonb_array_elements(p_files) loop
  limit_bytes:=case f->>'role' when 'ultramar' then pol.ultramar_package_max_bytes when 'pdf' then pol.ultramar_pdf_max_bytes else pol.ultramar_preview_max_bytes end;
  if (f->>'size_bytes')::bigint>limit_bytes then raise exception 'El archivo % supera el límite permitido',f->>'role';end if;
  if (f->>'role'='ultramar' and lower(f->>'file_name') !~ '\.ultramar$') or (f->>'role'='pdf' and lower(f->>'file_name') !~ '\.pdf$') or (f->>'role'='preview' and lower(f->>'file_name') !~ '\.png$') then raise exception 'Tipo de archivo no permitido para %',f->>'role';end if;
  insert into workspace_private.ultramar_files(reservation_id,role,file_name,size_bytes,sha256) values(r.id,f->>'role',f->>'file_name',(f->>'size_bytes')::bigint,lower(f->>'sha256'));
 end loop;
 return jsonb_build_object('id',r.id,'estado',r.state,'expira',r.expires_at,'archivos',(select jsonb_agg(jsonb_build_object('rol',role,'bytes',size_bytes,'verificado',false) order by role) from workspace_private.ultramar_files where reservation_id=r.id));
end;$$;

-- Sólo la pasarela (service_role) marca un archivo como recibido y validado (ZIP V1, PDF, PNG).
create function public.workspace_ultramar_file_verified(p_reservation_id uuid,p_role text,p_object_key text,p_sha256 text,p_size_bytes bigint,p_validation jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare f workspace_private.ultramar_files;
begin
 select * into f from workspace_private.ultramar_files where reservation_id=p_reservation_id and role=p_role for update;
 if f.reservation_id is null then raise exception 'Archivo no reservado';end if;
 if f.sha256<>lower(p_sha256) or f.size_bytes<>p_size_bytes then raise exception 'El archivo recibido no coincide con la reserva';end if;
 if coalesce(p_validation->>'ok','false')<>'true' then raise exception 'El archivo no pasó la validación';end if;
 update workspace_private.ultramar_files set object_key=p_object_key,verified_at=now(),validation=p_validation where reservation_id=p_reservation_id and role=p_role;
 return jsonb_build_object('rol',p_role,'verificado',true);
end;$$;

-- Confirmar: crea la nueva versión (área → QA → Dirección sin cambios). Idempotente.
create function public.workspace_ultramar_submit(p_reservation_id uuid,p_change_summary text default 'Maquetación enviada desde Ultramar') returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare r workspace_private.ultramar_reservations;t public.workspace_deliverables;s workspace_private.ultramar_snapshots;result jsonb;v_id uuid;
begin
 perform workspace_private.ultramar_gate();
 select * into r from workspace_private.ultramar_reservations where id=p_reservation_id and author_id=auth.uid() for update;
 if r.id is null then raise exception 'Envío fuera de tu acceso' using errcode='42501';end if;
 if r.state='submitted' then return jsonb_build_object('estado','submitted','version_id',r.version_id,'repetido',true);end if;
 if r.state<>'reserved' or r.expires_at<=now() then raise exception 'La reserva venció; vuelve a enviar';end if;
 t:=workspace_private.ultramar_task(r.deliverable_id,true);
 perform workspace_private.require('content.request_review',t.unit_id,t.project_id,t.area_id,t.id);
 if t.revision is distinct from r.base_revision then raise exception 'La asignación cambió en Workspace; actualiza antes de enviar' using errcode='40001';end if;
 if (select count(*) from workspace_private.ultramar_files where reservation_id=r.id and verified_at is not null)<>3 then raise exception 'Faltan archivos por subir o validar';end if;
 select * into s from workspace_private.ultramar_snapshots where id=r.snapshot_id;
 result:=public.workspace_command('version.submit',jsonb_build_object('project_id',t.project_id,'deliverable_id',t.id,'editor_version',2,
  'content_markdown','Maquetación enviada desde Ultramar (instantánea '||s.version||').','credits','','asset_url',null,
  'change_summary',left(coalesce(nullif(trim(p_change_summary),''),'Maquetación enviada desde Ultramar'),500)),t.revision);
 select id into v_id from public.workspace_versions where deliverable_id=t.id and version_number=(result->>'current_version')::integer;
 insert into workspace_private.ultramar_versions(version_id,reservation_id,snapshot_id) values(v_id,r.id,r.snapshot_id);
 update workspace_private.ultramar_reservations set state='submitted',version_id=v_id where id=r.id;
 return jsonb_build_object('estado','submitted','version_id',v_id,'version',(result->>'current_version')::integer);
end;$$;

-- Workspace (revisión): archivos de una versión enviada desde Ultramar, para quien ya puede leer la asignación.
create function public.workspace_ultramar_version_files(p_version_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare uv workspace_private.ultramar_versions;t public.workspace_deliverables;
begin
 if not workspace_private.session_active() then raise exception 'Sesión no válida' using errcode='42501';end if;
 select * into uv from workspace_private.ultramar_versions where version_id=p_version_id;
 if uv.version_id is null then return null;end if;
 select d.* into t from public.workspace_deliverables d join public.workspace_versions v on v.deliverable_id=d.id where v.id=p_version_id;
 perform workspace_private.require('task.read',t.unit_id,t.project_id,t.area_id,t.id);
 return jsonb_build_object('instantanea',(select version from workspace_private.ultramar_snapshots where id=uv.snapshot_id),
  'archivos',(select jsonb_agg(jsonb_build_object('rol',role,'nombre',file_name,'bytes',size_bytes,'sha256',sha256) order by role) from workspace_private.ultramar_files where reservation_id=uv.reservation_id));
end;$$;

revoke all on function workspace_private.ultramar_canonical(jsonb),workspace_private.ultramar_sha(jsonb),workspace_private.ultramar_gate(),workspace_private.ultramar_task(uuid,boolean) from public,anon,authenticated;
revoke all on function public.workspace_ultramar_prepare(uuid,jsonb,integer),public.workspace_ultramar_assignments(),public.workspace_ultramar_snapshot(uuid,uuid),
 public.workspace_ultramar_original(uuid,uuid,uuid),public.workspace_ultramar_reserve(uuid,uuid,integer,text,jsonb),public.workspace_ultramar_submit(uuid,text),
 public.workspace_ultramar_version_files(uuid),public.workspace_ultramar_file_verified(uuid,text,text,text,bigint,jsonb) from public,anon;
grant execute on function public.workspace_ultramar_prepare(uuid,jsonb,integer),public.workspace_ultramar_assignments(),public.workspace_ultramar_snapshot(uuid,uuid),
 public.workspace_ultramar_original(uuid,uuid,uuid),public.workspace_ultramar_reserve(uuid,uuid,integer,text,jsonb),public.workspace_ultramar_submit(uuid,text),
 public.workspace_ultramar_version_files(uuid) to authenticated;
revoke all on function public.workspace_ultramar_file_verified(uuid,text,text,text,bigint,jsonb) from authenticated;
grant execute on function public.workspace_ultramar_file_verified(uuid,text,text,text,bigint,jsonb) to service_role;
