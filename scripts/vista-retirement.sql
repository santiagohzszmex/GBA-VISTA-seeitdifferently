-- Operator-only transition, executed in the same transaction as the catalog migration.
-- The caller supplies a reviewed manifest and sets vista.retirement_batch after capturing/rehearsing it.
do $$
declare v_batch uuid:=current_setting('vista.retirement_batch')::uuid; v_manifest jsonb;
 v_users uuid[];v_deleted uuid[];v_archived uuid[];v_keep uuid[];v_editorials uuid[];
 v_servers uuid[];v_studios uuid[];v_protected uuid[];v_before jsonb;v_after jsonb; r record;
begin
 select manifest into strict v_manifest from vista_retirement_private.batches where id=v_batch and completed_at is null for update;
 if not coalesce((select (evidence->>'typed_recovery')::boolean from vista_retirement_private.batches where id=v_batch),false) then raise exception 'Recovery rehearsal required';end if;
 select array_agg((x->>'id')::uuid) into v_users from jsonb_array_elements(v_manifest->'candidates') x;
 select array_agg((x->>'id')::uuid) into v_deleted from jsonb_array_elements(v_manifest->'content') x where x->>'action'='delete';
 select array_agg((x->>'id')::uuid) into v_archived from jsonb_array_elements(v_manifest->'content') x where x->>'action'='archive';
 select array_agg((x->>'id')::uuid) into v_keep from jsonb_array_elements(v_manifest->'content') x where x->>'action'='keep';
 select array_agg((x->>'id')::uuid) into v_editorials from jsonb_array_elements(v_manifest->'editorials') x;
 -- Lock identities before the final membership check; concurrent FK references cannot race deletion.
 perform 1 from auth.users where id=any(v_users) for update;
 select array_agg(distinct id) into v_protected from vista_retirement_private.protected_ids() id;
 if v_users is null or v_protected && v_users then raise exception 'A retirement identity now has protected work or a license';end if;
 if cardinality(v_keep)<>1 or not exists(select 1 from public.contenido where id=any(v_keep) and titulo='Ahuautle (GIMG)') then raise exception 'Ahuautle preservation guard failed';end if;
 if exists(select 1 from public.contenido where id=any(v_deleted) and editorial_id is null) then raise exception 'Only external editorial publications may be deleted';end if;
 if exists(select 1 from public.contenido where editorial_id=any(v_editorials) and not(id=any(v_deleted))) then raise exception 'Editorial includes a publication outside the delete manifest';end if;
 select jsonb_agg(to_jsonb(t) order by t.id) into v_before from public.usuarios t where id=any(v_protected);
 -- Keep business tables byte-for-byte unchanged, including licenses, originals, RBAC and documents.
 create temporary table vista_business_guard(relation_name text primary key,fingerprint text) on commit drop;
 for r in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and
  ((n.nspname='public' and c.relname ~ '^(workspace_|gba_|gimg_|anima_)') or (n.nspname='workspace_private' and c.relname not in ('id_secrets','id_audit','accounts','activation_limits','identity_rollout_backups')))
 loop
  execute format('insert into vista_business_guard select $1,md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb)::text) from %I.%I t',r.nspname,r.relname) using r.nspname||'.'||r.relname;
 end loop;
 select array_agg(id) into v_servers from public.network_servers where owner_id=any(v_users);
 select array_agg(id) into v_studios from public.development_studios where owner_id=any(v_users);
 -- Retire subject links explicitly; their polymorphic IDs are not foreign keys.
 delete from public.vista_conversations where subject_id=any(v_deleted);
 delete from public.vista_credits where subject_id=any(v_deleted);
 delete from public.contenido where id=any(v_deleted);
 update public.contenido set catalog_origin='gimg',archived_at=null,archived_by=null,archive_reason=null where id=any(v_keep);
 update public.contenido set catalog_origin='legacy',archived_at=transaction_timestamp(),archive_reason='Catálogo histórico anterior a VISTA · GIMG' where id=any(v_archived);
 delete from public.editoriales where id=any(v_editorials);
 -- Resolve NO ACTION relationships only in the retired ecosystem.
 delete from public.network_server_events where server_id=any(v_servers) or user_id=any(v_users) or partner_id in (select id from public.network_partner_agreements where server_id=any(v_servers) or created_by=any(v_users));
 delete from public.network_partner_agreements where server_id=any(v_servers) or created_by=any(v_users);
 delete from public.network_server_members where server_id=any(v_servers) or user_id=any(v_users);
 delete from public.network_servers where id=any(v_servers);
 update public.network_servers set developer_user_id=null where developer_user_id=any(v_users);
 update public.network_servers set developer_studio_id=null where developer_studio_id=any(v_studios);
 delete from public.development_studio_members where studio_id=any(v_studios) or user_id=any(v_users) or invited_by=any(v_users);
 delete from public.development_studios where id=any(v_studios);
 -- Archived originals remain intact; the original author is preserved in the private snapshot.
 update public.contenido set autor_id=null where autor_id=any(v_users);
 -- Revoke live sessions. Recovery deliberately requires a normal new login.
 delete from auth.sessions where user_id=any(v_users);
 delete from workspace_private.activation_limits where user_id=any(v_users);
 delete from workspace_private.id_audit where user_id=any(v_users);
 delete from workspace_private.id_secrets where user_id=any(v_users);
 delete from workspace_private.accounts where user_id=any(v_users);
 delete from auth.users where id=any(v_users);
 if exists(select 1 from public.usuarios where id=any(v_users)) or exists(select 1 from auth.users where id=any(v_users)) then raise exception 'Identity retirement incomplete';end if;
 if exists(select 1 from public.contenido where id=any(v_deleted)) or (select count(*) from public.contenido where id=any(v_archived) and archived_at is not null)<>cardinality(v_archived) then raise exception 'Catalog retirement incomplete';end if;
 select jsonb_agg(to_jsonb(t) order by t.id) into v_after from public.usuarios t where id=any(v_protected);
 if v_before is distinct from v_after then raise exception 'Protected profiles changed';end if;
 for r in select * from vista_business_guard loop
  execute format('select jsonb_build_object(''hash'',md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb)::text)) from %s t',r.relation_name::regclass) into v_after;
  if v_after->>'hash' is distinct from r.fingerprint then raise exception 'Conserved business table changed: %',r.relation_name;end if;
 end loop;
 update vista_retirement_private.batches set completed_at=transaction_timestamp(),evidence=evidence||jsonb_build_object('accounts_removed',cardinality(v_users),'publications_removed',cardinality(v_deleted),'publications_archived',cardinality(v_archived),'protected_accounts_unchanged',cardinality(v_protected),'business_tables_unchanged',(select count(*) from vista_business_guard)) where id=v_batch;
end $$;
