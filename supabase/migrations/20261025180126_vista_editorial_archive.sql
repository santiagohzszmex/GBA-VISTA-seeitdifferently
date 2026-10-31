set lock_timeout='5s';
set statement_timeout='90s';
alter table public.contenido add column catalog_origin text not null default 'legacy',
 add column archived_at timestamptz, add column archived_by uuid,
 add column archive_reason text,
 add constraint contenido_catalog_origin_check check (catalog_origin in ('gimg','legacy'));
alter table public.contenido alter column catalog_origin set default 'gimg';
create index contenido_gimg_catalog on public.contenido(created_at desc) where catalog_origin='gimg' and archived_at is null and estado_publicacion='aprobado';
-- Replace legacy editorial policies: revoked helper RPCs must never be evaluated by a reader.
do $$ declare r record;begin
 for r in select policyname from pg_policies where schemaname='public' and tablename='contenido' loop
  execute format('drop policy %I on public.contenido',r.policyname);
 end loop;
end $$;
create policy "VISTA active GIMG catalog" on public.contenido for select to anon,authenticated
 using ((catalog_origin='gimg' and archived_at is null and estado_publicacion='aprobado') or (select public.es_staff()));
create policy "VISTA GIMG staff publication insert" on public.contenido for insert to authenticated with check ((select public.es_staff()));
create policy "VISTA GIMG staff publication update" on public.contenido for update to authenticated using ((select public.es_staff())) with check ((select public.es_staff()));
create policy "VISTA GIMG staff publication delete" on public.contenido for delete to authenticated using ((select public.es_staff()));
-- No new grant to the recovery vault or to an archived publication's originals.
-- Retired community APIs are disabled at their actual SECURITY DEFINER entry points.
do $$ declare r record;begin
 for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prokind='f' and p.prorettype<>'trigger'::regtype
  and (p.proname ~ '^(vista_|get_public_profile$|increment|toggle_like$)')
  and (pg_get_functiondef(p.oid) ~ '(contenido|network_servers|network_server_members|network_server_events|network_partner_agreements|network_businesses|editorial_members|editorial_invitations|development_studios|vista_conversations|vista_credits|vista_profile_follows|vista_updates|editoriales|solicitudes_editoriales)' or p.proname in ('vista_list_credits','vista_replace_credits','vista_respond_credit'))
 loop execute format('revoke all on function %s from public,anon,authenticated',r.oid::regprocedure);end loop;
 for r in select tablename from pg_tables where schemaname='public' and tablename in
 ('network_servers','network_server_members','network_server_events','network_partner_agreements','network_businesses','editoriales','editorial_members','editorial_invitations','editoriales_seguidas','solicitudes_editoriales','vista_updates','vista_update_likes','vista_conversations','vista_profile_follows','vista_credits')
 loop execute format('revoke all on table public.%I from public,anon,authenticated',r.tablename);end loop;
end $$;
