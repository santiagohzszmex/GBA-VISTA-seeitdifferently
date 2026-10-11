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
 if not p_success then update workspace_private.original_limits set allocated_bytes=allocated_bytes-o.size_bytes;end if;
 select * into r from workspace_private.edition_references where id=o.reference_id;select * into p from public.workspace_projects where id=r.project_id;
 perform workspace_private.log(p.unit_id,p.id,r.area_id,null,case when p_success then 'original.verified' else 'original.failed' end,o.id,jsonb_build_object('sha256',o.sha256,'size_bytes',o.size_bytes));
 return jsonb_build_object('id',o.id,'verified',p_success);
end;$$;
