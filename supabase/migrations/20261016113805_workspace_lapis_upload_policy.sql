-- Lapislázuli 1c. Runtime limits have ONE authority: this private row.
begin;
create table workspace_private.upload_policy(
 singleton boolean primary key default true check(singleton),
 reference_max_bytes bigint not null default 26214400 check(reference_max_bytes between 1 and 2147483647),
 png_max_bytes bigint not null default 18874368 check(png_max_bytes>0),
 layered_max_bytes bigint not null default 262144000 check(layered_max_bytes>0),
 max_pixels bigint not null default 40000000 check(max_pixels>0),
 draft_warn_days integer not null default 60,
 draft_retention_days integer not null default 90,
 images_enabled boolean not null default false,
 provisional boolean not null default true, revision integer not null default 1,
 check(draft_warn_days>0 and draft_retention_days>draft_warn_days)
);
insert into workspace_private.upload_policy default values;
alter table workspace_private.upload_policy enable row level security;
revoke all on workspace_private.upload_policy from public,anon,authenticated;
create function public.workspace_upload_policy() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
begin
 if not workspace_private.session_active() or not exists(select 1 from public.workspace_units u where u.slug='gimg' and workspace_private.member(u.id)) then raise exception 'Membresía activa requerida' using errcode='42501';end if;
 return (select to_jsonb(c)-'singleton' from workspace_private.upload_policy c where singleton);
end;$$;
revoke all on function public.workspace_upload_policy() from public,anon;
grant execute on function public.workspace_upload_policy() to authenticated;
create function workspace_private.upload_limit(p_kind text) returns bigint
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select case p_kind when 'reference' then reference_max_bytes when 'png' then png_max_bytes when 'layered' then layered_max_bytes end from workspace_private.upload_policy where singleton;
$$;
revoke all on function workspace_private.upload_limit(text) from public,anon,authenticated;

-- Preserve exact definitions for a non-destructive, explicit rollback.
create table workspace_private.lapis_function_backups(signature text primary key,definition text not null);
alter table workspace_private.lapis_function_backups enable row level security;
revoke all on workspace_private.lapis_function_backups from public,anon,authenticated;
do $$declare f record;definition text;replacement text;begin
 for f in select p.oid,p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in('public','workspace_private') and p.prokind='f'
 and p.proname in('workspace_original_gate','workspace_original_begin','workspace_reference_bundle','opal_reference_bundle_v1') loop
  definition:=pg_get_functiondef(f.oid);
  if position('26214400' in definition)>0 then
   insert into workspace_private.lapis_function_backups values(f.signature,definition);
   replacement:=replace(definition,'26214400','workspace_private.upload_limit(''reference'')');
   replacement:=replace(replacement,'Límite de 25 MB por archivo','El archivo supera el límite configurado');
   execute replacement;
  end if;
 end loop;
end;$$;
-- The command now enforces the live policy. Historic constraints cannot freeze it.
do $$declare c record;begin
 for c in select conname from pg_constraint where conrelid='workspace_private.reference_originals'::regclass and contype='c' and pg_get_constraintdef(oid) like '%26214400%' loop
  execute format('alter table workspace_private.reference_originals drop constraint %I',c.conname);
 end loop;
end;$$;
alter table workspace_private.reference_originals add constraint reference_original_size_positive check(size_bytes>0);
notify pgrst,'reload schema';
commit;
