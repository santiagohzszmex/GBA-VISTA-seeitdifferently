begin;

-- A public preview can be read anonymously, but engagement belongs to a GBA ID.
create or replace function public.vista_register_content_view(p_content_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.contenido c
    where c.id = p_content_id and c.estado_publicacion = 'aprobado'
  ) then
    return false;
  end if;

  insert into public.vistas_usuario (usuario_id, contenido_id)
  values (auth.uid(), p_content_id)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return false;
  end if;

  update public.contenido
  set vistas = coalesce(vistas, 0) + 1
  where id = p_content_id;

  return true;
end;
$$;

revoke all on function public.vista_register_content_view(uuid) from public, anon;
grant execute on function public.vista_register_content_view(uuid) to authenticated;

-- Retire the anonymous counter used by older clients.
do $$
begin
  if to_regprocedure('public.increment_vistas_contenido(uuid)') is not null then
    execute 'revoke all on function public.increment_vistas_contenido(uuid) from public, anon, authenticated';
  end if;
  if to_regprocedure('public.toggle_like(uuid,uuid)') is not null then
    execute 'revoke all on function public.toggle_like(uuid,uuid) from public, anon';
  end if;
end;
$$;

drop policy if exists "Interacciones insertables" on public.campania_interacciones;
create policy "GBA IDs registran interacciones de campania"
on public.campania_interacciones for insert
to authenticated
with check (auth.uid() is not null and usuario_id = auth.uid());

create or replace function public.toggle_campania_like(
  p_campania_id uuid,
  p_usuario_id uuid,
  p_liked boolean
)
returns table(likes_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or auth.uid() <> p_usuario_id then
    raise exception 'Authenticated GBA ID required';
  end if;

  if p_liked then
    insert into public.campania_likes (campania_id, usuario_id)
    values (p_campania_id, auth.uid())
    on conflict do nothing;
  else
    delete from public.campania_likes
    where campania_id = p_campania_id
      and usuario_id = auth.uid();
  end if;

  update public.campanias c
  set likes_count = (
    select count(*)::integer
    from public.campania_likes cl
    where cl.campania_id = p_campania_id
  )
  where c.id = p_campania_id;

  insert into public.campania_interacciones (campania_id, usuario_id, evento)
  values (p_campania_id, auth.uid(), case when p_liked then 'like' else 'unlike' end);

  return query
  select c.likes_count
  from public.campanias c
  where c.id = p_campania_id;
end;
$$;

revoke all on function public.toggle_campania_like(uuid, uuid, boolean) from public, anon;
grant execute on function public.toggle_campania_like(uuid, uuid, boolean) to authenticated;

-- A Network business can formally represent one editorial organization.
alter table public.network_businesses
  add column if not exists editorial_id uuid references public.editoriales(id) on delete set null;

create unique index if not exists network_businesses_editorial_unique
  on public.network_businesses (editorial_id)
  where editorial_id is not null;

create or replace function public.vista_link_network_editorial(
  p_business_id uuid,
  p_editorial_id uuid
)
returns public.network_businesses
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business public.network_businesses;
  v_result public.network_businesses;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_business
  from public.network_businesses
  where id = p_business_id
  for update;

  if v_business.id is null then
    raise exception 'Network profile not found';
  end if;
  if v_business.owner_id <> auth.uid() and not public.vista_is_platform_admin() then
    raise exception 'Network profile owner access required';
  end if;

  if p_editorial_id is not null then
    if not exists (select 1 from public.editoriales where id = p_editorial_id) then
      raise exception 'Editorial not found';
    end if;
    if not public.vista_is_platform_admin()
       and not public.vista_editorial_has_role(p_editorial_id, 'admin') then
      raise exception 'Editorial owner or admin access required';
    end if;
    if exists (
      select 1 from public.network_businesses
      where editorial_id = p_editorial_id and id <> p_business_id
    ) then
      raise exception 'This editorial is already linked to another Network profile';
    end if;
  end if;

  update public.network_businesses
  set editorial_id = p_editorial_id, updated_at = now()
  where id = p_business_id
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.vista_link_network_editorial(uuid, uuid) from public, anon;
grant execute on function public.vista_link_network_editorial(uuid, uuid) to authenticated;

commit;
