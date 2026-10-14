import {createHash} from 'node:crypto';
export const CUARZO_SCHEMA_QUERY = `select jsonb_build_object(
 'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'definition',pg_get_functiondef(p.oid)) order by n.nspname,p.proname)
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname in('workspace_document_recipients','workspace_send_document','workspace_document_inbox','workspace_read_document_delivery','workspace_support_mention_candidates','workspace_read_notification','workspace_notifications','workspace_save_support','workspace_original_descriptor','workspace_original_access'))
 or (n.nspname='workspace_private' and p.proname in('document_participant','document_delivery_for','opal_original_for','opal_original_download','notification_visible','support_create_for','support_for','support_editable','member','session_active','notification_allowed','scope_matches'))),
 'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'required',a.attnotnull) order by a.attnum) from pg_attribute a where a.attrelid='workspace_private.document_deliveries'::regclass and a.attnum>0 and not a.attisdropped),
 'constraints',(select jsonb_agg(pg_get_constraintdef(c.oid) order by c.conname) from pg_constraint c where c.conrelid='workspace_private.document_deliveries'::regclass and c.contype<>'n'),
 'role_permissions',(select jsonb_agg(to_jsonb(r) order by role,permission) from workspace_private.role_permissions r),
 'rls',(select relrowsecurity from pg_class where oid='workspace_private.document_deliveries'::regclass),
 'direct_authenticated',has_table_privilege('authenticated','workspace_private.document_deliveries','select'),
 'direct_anon',has_table_privilege('anon','workspace_private.document_deliveries','select'),
 'anonymous_send',has_function_privilege('anon','public.workspace_send_document(uuid,uuid[],integer)','execute')
) as evidence;`;
export function schemaFingerprint(evidence){return createHash('sha256').update(JSON.stringify(evidence)).digest('hex');}
export function verifySchemaEvidence(actual,expected){
 if(actual.rls!==true||actual.direct_authenticated!==false||actual.direct_anon!==false||actual.anonymous_send!==false)throw Error('Private schema privileges differ');
 if(actual.functions?.length!==22)throw Error('Incomplete function evidence');
 if(schemaFingerprint(actual)!==schemaFingerprint(expected))throw Error('Production schema differs from the role-tested local database');
 return {fingerprint:schemaFingerprint(actual),functions:actual.functions.length,rolePermissions:actual.role_permissions.length,matched:true};
}

// No fixture accounts, documents or grants. READ ONLY also prevents any guarded
// function from persisting data if an authorization guard unexpectedly fails.
export const CUARZO_READ_ONLY_SQL = `begin read only;
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
do $$declare q text;n integer:=0;begin
 foreach q in array array[
  'select public.workspace_document_recipients(''00000000-0000-0000-0000-000000000000'')',
  'select public.workspace_document_inbox(''00000000-0000-0000-0000-000000000000'')',
  'select public.workspace_read_document_delivery(''00000000-0000-0000-0000-000000000000'')',
  'select public.workspace_support_mention_candidates(''00000000-0000-0000-0000-000000000000'')',
  'select * from workspace_private.document_deliveries limit 1'
 ] loop
  begin execute q;raise exception 'Access unexpectedly allowed';
  exception when insufficient_privilege then n:=n+1;end;
 end loop;
 perform set_config('workspace.cuarzo_denials',n::text,true);
end$$;
set local role anon;
do $$begin
 begin perform public.workspace_send_document('00000000-0000-0000-0000-000000000000',array[]::uuid[],1);raise exception 'Anonymous send unexpectedly allowed';
 exception when insufficient_privilege then perform set_config('workspace.cuarzo_denials',(current_setting('workspace.cuarzo_denials')::integer+1)::text,true);end;
end$$;
reset role;
select jsonb_build_object('readOnly',current_setting('transaction_read_only')='on','denials',current_setting('workspace.cuarzo_denials')::integer,
 'migrationApplied',exists(select 1 from supabase_migrations.schema_migrations where name='workspace_cuarzo_documents'),
 'referencesTotal',(select count(*) from workspace_private.edition_references)) as acceptance;
rollback;`;
