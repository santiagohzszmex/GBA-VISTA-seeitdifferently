-- Operator-only recovery vault. No API role can read account credentials or snapshots.
create schema if not exists vista_retirement_private;
revoke all on schema vista_retirement_private from public, anon, authenticated, service_role;
create table vista_retirement_private.batches (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(),
 manifest jsonb not null, evidence jsonb not null default '{}'::jsonb, completed_at timestamptz
);
create table vista_retirement_private.saved_rows (
 batch_id uuid not null references vista_retirement_private.batches(id),
 relation_name text not null, row_data jsonb not null,
 row_hash text generated always as (md5(row_data::text)) stored,
 unique(batch_id,relation_name,row_hash)
);
create index on vista_retirement_private.saved_rows(batch_id,relation_name);
create table vista_retirement_private.saved_objects (
 batch_id uuid not null references vista_retirement_private.batches(id), object_type text not null,
 object_name text not null, definition jsonb not null,
 primary key(batch_id,object_type,object_name)
);
alter table vista_retirement_private.batches enable row level security;
alter table vista_retirement_private.saved_rows enable row level security;
alter table vista_retirement_private.saved_objects enable row level security;
revoke all on all tables in schema vista_retirement_private from public,anon,authenticated,service_role;

-- Business references protect identities; merely having an identity/session does not classify use.
create function vista_retirement_private.protected_ids() returns setof uuid
language plpgsql stable security invoker set search_path=pg_catalog as $$
declare r record;
begin
 for r in
  select distinct ns.nspname,cl.relname,a.attname
  from pg_constraint co join pg_class cl on cl.oid=co.conrelid
  join pg_namespace ns on ns.oid=cl.relnamespace
  join pg_attribute a on a.attrelid=co.conrelid and a.attnum=co.conkey[1]
  where co.contype='f' and co.confrelid='auth.users'::regclass
   and (ns.nspname='workspace_private' or (ns.nspname='public' and cl.relname ~ '^(workspace_|gba_|gimg_|anima_)'))
   and cl.relname not in ('id_secrets','id_audit','accounts','activation_limits','identity_rollout_backups')
 loop
  return query execute format('select %I from %I.%I where %I is not null',r.attname,r.nspname,r.relname,r.attname);
 end loop;
 return query select id from public.usuarios where rol in ('Dueño','Admin');
 return query select emisor from public.transacciones where emisor is not null;
 return query select receptor from public.transacciones where receptor is not null;
 return query select unnest(collaborator_ids) from public.workspace_deliverables;
end $$;
revoke all on function vista_retirement_private.protected_ids() from public,anon,authenticated,service_role;

-- Exact typed recovery rehearsal into temporary tables: no users, hooks or notifications created.
create function vista_retirement_private.verify_snapshot(p_batch uuid) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare r record; v_name text; v_count bigint; v_same boolean; v_results jsonb:='[]';
begin
 for r in select relation_name,count(*) as total from vista_retirement_private.saved_rows where batch_id=p_batch group by relation_name loop
  v_name:='vista_restore_'||md5(r.relation_name);
  execute format('create temporary table %I on commit drop as select * from %s with no data',v_name,r.relation_name::regclass);
  execute format('insert into %I select * from jsonb_populate_recordset(null::%s,(select jsonb_agg(row_data) from vista_retirement_private.saved_rows where batch_id=$1 and relation_name=$2))',v_name,r.relation_name::regclass) using p_batch,r.relation_name;
  execute format('select count(*) from %I',v_name) into v_count;
  execute format('select not exists ((select to_jsonb(t) from %I t except all select row_data from vista_retirement_private.saved_rows where batch_id=$1 and relation_name=$2) union all (select row_data from vista_retirement_private.saved_rows where batch_id=$1 and relation_name=$2 except all select to_jsonb(t) from %I t))',v_name,v_name) into v_same using p_batch,r.relation_name;
  if not v_same or v_count<>r.total then raise exception 'Recovery mismatch: %',r.relation_name;end if;
  v_results:=v_results||jsonb_build_object('table',r.relation_name,'rows',v_count,'exact',true);
 end loop;
 return jsonb_build_object('typed_recovery',true,'tables',v_results);
end $$;
revoke all on function vista_retirement_private.verify_snapshot(uuid) from public,anon,authenticated,service_role;

-- Capture only the reviewed roots and their FK dependants. Active login tokens are never retained.
create function vista_retirement_private.capture_snapshot(p_manifest jsonb) returns uuid
language plpgsql security invoker set search_path=pg_catalog as $$
declare v_batch uuid; v_ids uuid[]; v_content uuid[]; v_editorials uuid[];
 r record; v_join text; v_added bigint; v_total bigint; v_pass integer:=0;
begin
 select array_agg((x->>'id')::uuid) into v_ids from jsonb_array_elements(p_manifest->'candidates') x;
 select array_agg((x->>'id')::uuid) into v_content from jsonb_array_elements(p_manifest->'content') x;
 select array_agg((x->>'id')::uuid) into v_editorials from jsonb_array_elements(p_manifest->'editorials') x;
 if v_ids is null or v_content is null or exists(select 1 from vista_retirement_private.protected_ids() p where p=any(v_ids)) then raise exception 'Manifest includes a protected identity or has no roots';end if;
 if (select count(*) from public.usuarios where id=any(v_ids))<>cardinality(v_ids) then raise exception 'Manifest identities changed';end if;
 if (select count(*) from public.contenido where id=any(v_content))<>cardinality(v_content) then raise exception 'Manifest catalog changed';end if;
 if exists(select 1 from public.editoriales where id=any(v_editorials) and not(created_by=any(v_ids))) then raise exception 'Editorial owner outside the reviewed retirement';end if;
 insert into vista_retirement_private.batches(manifest) values(p_manifest) returning id into v_batch;
 insert into vista_retirement_private.saved_rows(batch_id,relation_name,row_data)
 select v_batch,'auth.users',to_jsonb(t) from auth.users t where id=any(v_ids)
 union all select v_batch,'public.contenido',to_jsonb(t) from public.contenido t where id=any(v_content)
 union all select v_batch,'public.editoriales',to_jsonb(t) from public.editoriales t where id=any(v_editorials);
 for r in select * from (values ('network_servers'),('network_businesses'),('development_studios')) t(name) loop
  execute format('insert into vista_retirement_private.saved_rows(batch_id,relation_name,row_data) select $1,$2,to_jsonb(t) from public.%I t where owner_id=any($3) on conflict do nothing',r.name) using v_batch,'public.'||r.name,v_ids;
 end loop;
 -- Subjects are polymorphic, so they need explicit roots before FK traversal.
 for r in select * from (values ('vista_credits'),('vista_conversations')) t(name) loop
  execute format('insert into vista_retirement_private.saved_rows(batch_id,relation_name,row_data) select $1,$2,to_jsonb(t) from public.%I t where subject_id=any($3) on conflict do nothing',r.name) using v_batch,'public.'||r.name,v_content;
 end loop;
 loop
  v_total:=0;v_pass:=v_pass+1;
  for r in select co.conrelid,co.confrelid,co.conkey,co.confkey,cn.nspname as child_schema,cc.relname as child_name,pn.nspname as parent_schema,pc.relname as parent_name
   from pg_constraint co join pg_class cc on cc.oid=co.conrelid join pg_namespace cn on cn.oid=cc.relnamespace
   join pg_class pc on pc.oid=co.confrelid join pg_namespace pn on pn.oid=pc.relnamespace
   where co.contype='f' and cn.nspname in ('public','auth','workspace_private','gimg_recruitment_private')
    and not(cn.nspname='auth' and cc.relname in ('sessions','refresh_tokens','one_time_tokens','mfa_challenges','webauthn_challenges','oauth_authorizations','flow_state'))
    and exists(select 1 from vista_retirement_private.saved_rows where batch_id=v_batch and relation_name=pn.nspname||'.'||pc.relname)
  loop
   select string_agg(format('c.%I=p.%I',ca.attname,pa.attname),' and ' order by k.ord) into v_join
    from unnest(r.conkey,r.confkey) with ordinality k(child_num,parent_num,ord)
    join pg_attribute ca on ca.attrelid=r.conrelid and ca.attnum=k.child_num
    join pg_attribute pa on pa.attrelid=r.confrelid and pa.attnum=k.parent_num;
   execute format('insert into vista_retirement_private.saved_rows(batch_id,relation_name,row_data) select $1,$2,to_jsonb(c) from %I.%I c join jsonb_populate_recordset(null::%I.%I,(select jsonb_agg(row_data) from vista_retirement_private.saved_rows where batch_id=$1 and relation_name=$3)) p on %s on conflict do nothing',r.child_schema,r.child_name,r.parent_schema,r.parent_name,v_join)
    using v_batch,r.child_schema||'.'||r.child_name,r.parent_schema||'.'||r.parent_name;
   get diagnostics v_added=row_count;v_total:=v_total+v_added;
  end loop;
  exit when v_total=0;
  if v_pass>20 then raise exception 'Snapshot dependency traversal exceeded its bound';end if;
 end loop;
 -- Save policy/ACL definitions before changing visibility or withdrawing APIs.
 insert into vista_retirement_private.saved_objects
 select v_batch,'policy',policyname,to_jsonb(p) from pg_policies p where schemaname='public' and tablename='contenido';
 insert into vista_retirement_private.saved_objects
 select v_batch,'function',p.oid::regprocedure::text,jsonb_build_object('sql',pg_get_functiondef(p.oid),'acl',p.proacl::text)
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.prorettype<>'trigger'::regtype and (p.proname like 'vista_%' or p.proname in ('get_public_profile','toggle_like','incrementar_vista','increment_vistas_contenido'));
 insert into vista_retirement_private.saved_objects
 select v_batch,'table_grants',table_schema||'.'||table_name||':'||grantee||':'||privilege_type,to_jsonb(g) from information_schema.role_table_grants g where table_schema='public' and table_name ~ '^(contenido$|network_|editorial|vista_|development_studio)';
 return v_batch;
end $$;
revoke all on function vista_retirement_private.capture_snapshot(jsonb) from public,anon,authenticated,service_role;
