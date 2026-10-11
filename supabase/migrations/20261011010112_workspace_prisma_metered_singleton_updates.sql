-- Explicit singleton predicates retain PostgREST safe-update protection.
create or replace function workspace_private.original_tick(p_operation text) returns void
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare l workspace_private.original_limits; month_day date:=date_trunc('month',now() at time zone 'UTC')::date; today date:=(now() at time zone 'UTC')::date;
begin
 select * into l from workspace_private.original_limits for update;
 if l.month_start<>month_day then l.month_start:=month_day;l.write_operations:=0;l.read_operations:=0;end if;
 if l.day_start<>today then l.day_start:=today;l.gateway_requests:=0;end if;
 if l.gateway_requests>=50000 or (p_operation='write' and l.write_operations>=200000) or (p_operation='read' and l.read_operations>=2000000) then raise exception 'Se alcanzó el límite de uso gratuito. Inténtalo en el siguiente periodo';end if;
 update workspace_private.original_limits set month_start=l.month_start,day_start=l.day_start,gateway_requests=l.gateway_requests+1,
 write_operations=l.write_operations+case when p_operation='write' then 1 else 0 end,read_operations=l.read_operations+case when p_operation='read' then 1 else 0 end where singleton;
end;$$;

create or replace function public.workspace_original_begin(p_reference_id uuid,p_name text,p_mime text,p_size integer,p_sha256 text,p_gateway_key text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare r workspace_private.edition_references;p public.workspace_projects;o workspace_private.reference_originals;l workspace_private.original_limits;
begin
 perform workspace_private.original_gateway(p_gateway_key);
 select * into r from workspace_private.edition_references where id=p_reference_id and archived_at is null for update;
 select * into p from public.workspace_projects where id=r.project_id;
 if r.id is null or not coalesce(workspace_private.reference_writable(r),false) or not workspace_private.allowed('asset.upload',p.unit_id,p.id,r.area_id) then raise exception 'Sin permiso para subir originales' using errcode='42501';end if;
 if p_mime not in('image/jpeg','image/png','image/webp','image/gif','image/tiff','image/avif','image/heic','image/heif','application/pdf') or (p_mime='application/pdf' and r.kind<>'moodboard') then raise exception 'PDF sólo para moodboards; formato no permitido';end if;
 if p_size is null or p_size not between 1 and 26214400 then raise exception 'Límite de 25 MB por archivo';end if;
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

-- Revalidate membership, assignment, delegation and reference state after R2 writes.
create or replace function public.workspace_original_finish(p_id uuid,p_success boolean,p_gateway_key text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare o workspace_private.reference_originals;r workspace_private.edition_references;p public.workspace_projects;
begin
 perform workspace_private.original_gateway(p_gateway_key);
 select * into o from workspace_private.reference_originals where id=p_id for update;
 if o.id is null or o.uploaded_by<>auth.uid() then raise exception 'Original no autorizado' using errcode='42501';end if;
 select * into r from workspace_private.edition_references where id=o.reference_id and archived_at is null;
 select * into p from public.workspace_projects where id=r.project_id;
 if r.id is null or not coalesce(workspace_private.reference_writable(r),false) or not workspace_private.allowed('asset.upload',p.unit_id,p.id,r.area_id) then raise exception 'Sin permiso para completar esta subida' using errcode='42501';end if;
 if p_success is null then raise exception 'Resultado de subida inválido';end if;
 if o.status<>'reserved' then raise exception 'Este original ya se procesó';end if;
 -- Failure is accepted only after the trusted gateway has confirmed R2 deletion.
 update workspace_private.reference_originals set status=case when p_success then 'ready' else 'failed' end,verified_at=case when p_success then now() end where id=o.id;
 if not p_success then update workspace_private.original_limits set allocated_bytes=allocated_bytes-o.size_bytes where singleton;end if;
 select * into r from workspace_private.edition_references where id=o.reference_id;select * into p from public.workspace_projects where id=r.project_id;
 perform workspace_private.log(p.unit_id,p.id,r.area_id,null,case when p_success then 'original.verified' else 'original.failed' end,o.id,jsonb_build_object('sha256',o.sha256,'size_bytes',o.size_bytes));
 return jsonb_build_object('id',o.id,'verified',p_success);
end;$$;

