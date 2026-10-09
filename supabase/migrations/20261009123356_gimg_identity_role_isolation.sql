-- Deployable against the current GIMG recruitment / Studio schema.
-- GBA personal ranks remain unchanged; appointments are explicit.
begin;

create or replace function gimg_recruitment_private.director()
returns boolean language sql stable security definer
set search_path=pg_catalog,pg_temp as $$
 select gimg_recruitment_private.active_session() and exists(
  select 1 from public.gimg_recruitment_reviewers
  where user_id=auth.uid() and role='director'
 );
$$;
create or replace function gimg_recruitment_private.reviewer()
returns boolean language sql stable security definer
set search_path=pg_catalog,pg_temp as $$
 select gimg_recruitment_private.active_session() and exists(
  select 1 from public.gimg_recruitment_reviewers
  where user_id=auth.uid() and role in('director','reviewer')
 );
$$;
revoke all on function gimg_recruitment_private.director(),gimg_recruitment_private.reviewer() from public,anon;
grant execute on function gimg_recruitment_private.director(),gimg_recruitment_private.reviewer() to authenticated;

create function gimg_recruitment_private.guard_global_role_domain()
returns trigger language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
begin
 if (tg_op='INSERT' or new.rol is distinct from old.rol) and new.rol::text ~* 'gimg' then
  raise exception 'Los cargos de GIMG se asignan en su unidad; no son rangos generales de GBA';
 end if;
 return new;
end;$$;
revoke all on function gimg_recruitment_private.guard_global_role_domain() from public,anon,authenticated;
create trigger usuarios_global_role_domain before insert or update of rol on public.usuarios
for each row execute function gimg_recruitment_private.guard_global_role_domain();


-- GIMG Studio membership also preserves the personal GBA rank.
create or replace function public.vista_editorial_respond_invitation(p_invitation_id uuid, p_accept boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.editorial_invitations%rowtype;
  v_name text;
begin
  select * into v_invitation
  from public.editorial_invitations
  where id = p_invitation_id
  for update;

  if v_invitation.id is null or v_invitation.invited_user_id <> auth.uid() then
    raise exception 'Invitation not found';
  end if;
  if v_invitation.status <> 'pending' or v_invitation.expires_at <= now() then
    raise exception 'Invitation is no longer available';
  end if;

  if p_accept then
    insert into public.editorial_members (
      editorial_id, usuario_id, role, status, invited_by
    ) values (
      v_invitation.editorial_id, auth.uid(), v_invitation.role, 'active', v_invitation.invited_by
    )
    on conflict (editorial_id, usuario_id) do update
      set role = excluded.role, status = 'active', invited_by = excluded.invited_by, updated_at = now();

    select nombre into v_name from public.editoriales where id = v_invitation.editorial_id;
    update public.usuarios
      set rol = case
        when lower(trim(v_name)) in ('gimg','global insight media group')
          or exists(select 1 from public.editoriales e where e.id=v_invitation.editorial_id and e.slug in ('gimg','global-insight-media-group')) then rol
        when rol in ('Dueño','Admin') then rol else 'Editor' end,
          sello_editorial = coalesce(nullif(sello_editorial, ''), v_name)
      where id = auth.uid();
  end if;

  update public.editorial_invitations
    set status = case when p_accept then 'accepted' else 'declined' end,
        responded_at = now(), updated_at = now()
    where id = p_invitation_id;

  insert into public.editorial_audit_log (editorial_id, actor_id, action, target_type, target_id, details)
  values (
    v_invitation.editorial_id, auth.uid(),
    case when p_accept then 'invitation_accepted' else 'invitation_declined' end,
    'invitation', p_invitation_id::text, '{}'::jsonb
  );
  return p_accept;
end;
$$;
revoke all on function public.vista_editorial_respond_invitation(uuid,boolean) from public,anon;
grant execute on function public.vista_editorial_respond_invitation(uuid,boolean) to authenticated;
-- Creating GIMG through Studio must also preserve the personal GBA rank.
create or replace function public.vista_approve_editorial_request(p_request_id uuid)
returns public.editoriales
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.solicitudes_editoriales%rowtype;
  v_result public.editoriales;
  v_slug text;
  v_suffix integer := 1;
begin
  if not public.vista_is_platform_admin() then
    raise exception 'Platform admin access required';
  end if;
  select * into v_request from public.solicitudes_editoriales where id = p_request_id for update;
  if v_request.id is null then raise exception 'Editorial request not found'; end if;
  if exists (select 1 from public.editoriales where lower(nombre) = lower(trim(v_request.nombre_noticiero))) then
    raise exception 'An editorial with this name already exists';
  end if;

  v_slug := coalesce(nullif(public.vista_editorial_slugify(v_request.nombre_noticiero), ''), 'editorial');
  while exists (select 1 from public.editoriales where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := coalesce(nullif(public.vista_editorial_slugify(v_request.nombre_noticiero), ''), 'editorial') || '-' || v_suffix;
  end loop;

  insert into public.editoriales (slug, nombre, descripcion, created_by)
  values (v_slug, trim(v_request.nombre_noticiero), trim(coalesce(v_request.descripcion, '')), v_request.usuario_id)
  returning * into v_result;

  insert into public.editorial_members (editorial_id, usuario_id, role, status, invited_by)
  values (v_result.id, v_request.usuario_id, 'owner', 'active', auth.uid());

  update public.usuarios
    set rol = case
      when lower(trim(v_result.nombre)) in ('gimg','global insight media group')
        or v_result.slug in ('gimg','global-insight-media-group') then rol
      else 'Editor' end,
      sello_editorial = v_result.nombre
    where id = v_request.usuario_id;
  delete from public.solicitudes_editoriales where id = p_request_id;
  insert into public.editorial_audit_log (editorial_id, actor_id, action, target_type, target_id)
  values (v_result.id, auth.uid(), 'editorial_created_from_request', 'user', v_request.usuario_id::text);
  return v_result;
end;
$$;

revoke all on function public.vista_approve_editorial_request(uuid) from public,anon;
grant execute on function public.vista_approve_editorial_request(uuid) to authenticated;
commit;
