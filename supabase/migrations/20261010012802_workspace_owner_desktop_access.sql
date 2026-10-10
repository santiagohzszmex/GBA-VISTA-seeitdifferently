-- Dueño has desktop access through current platform authority, without a code.
-- GIMG membership and editorial authority remain explicit, independent grants.
create or replace function public.workspace_license_status() returns jsonb
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 with entitlement as (
  select workspace_private.session_active() as session_valid,
   (workspace_private.allowed('platform.manage',null)
    and exists(select 1 from public.usuarios where id=auth.uid() and rol='Dueño')) as owner_access,
   (select max(expires_at) from public.workspace_licenses
    where user_id=auth.uid() and revoked_at is null
     and starts_at<=now() and expires_at>now()) as license_expiry
 )
 select jsonb_build_object(
  'active',session_valid and (owner_access or license_expiry is not null),
  'owner_access',session_valid and owner_access,
  -- Existing installed clients require a finite future ISO date to enter.
  -- This sentinel is not a issued license; every poll rechecks live authority.
  'expires_at',case when not session_valid then null
   when owner_access then timestamptz '9999-12-31 23:59:59+00'
   else license_expiry end
 ) from entitlement;
$$;
revoke all on function public.workspace_license_status() from public,anon;
grant execute on function public.workspace_license_status() to authenticated;
