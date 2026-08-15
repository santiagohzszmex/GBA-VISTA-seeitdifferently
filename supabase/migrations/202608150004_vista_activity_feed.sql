begin;

create table if not exists public.vista_updates (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.usuarios(id) on delete cascade,
  editorial_id uuid references public.editoriales(id) on delete cascade,
  business_id uuid references public.network_businesses(id) on delete cascade,
  body text not null,
  image_url text,
  link_url text,
  status text not null default 'active' check (status in ('active', 'deleted')),
  likes_count integer not null default 0 check (likes_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(trim(body)) between 1 and 600),
  check (num_nonnulls(editorial_id, business_id) <= 1)
);

create index if not exists vista_updates_recent
  on public.vista_updates (status, created_at desc);
create index if not exists vista_updates_author
  on public.vista_updates (author_id, status, created_at desc);
create index if not exists vista_updates_editorial
  on public.vista_updates (editorial_id, status, created_at desc);
create index if not exists vista_updates_business
  on public.vista_updates (business_id, status, created_at desc);

create table if not exists public.vista_update_likes (
  update_id uuid not null references public.vista_updates(id) on delete cascade,
  user_id uuid not null references public.usuarios(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (update_id, user_id)
);

create index if not exists vista_update_likes_user
  on public.vista_update_likes (user_id, created_at desc);

alter table public.vista_updates enable row level security;
alter table public.vista_update_likes enable row level security;
revoke all on public.vista_updates from anon, authenticated;
revoke all on public.vista_update_likes from anon, authenticated;

alter table public.vista_conversations
  drop constraint if exists vista_conversations_subject_type_check;
alter table public.vista_conversations
  add constraint vista_conversations_subject_type_check
  check (subject_type in ('content', 'keynote', 'business', 'update'));

create or replace function public.vista_can_manage_subject(p_subject_type text, p_subject_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_content public.contenido%rowtype;
  v_business public.network_businesses%rowtype;
begin
  if auth.uid() is null then return false; end if;
  if public.vista_is_platform_admin() then return true; end if;

  if p_subject_type = 'content' then
    select * into v_content from public.contenido where id = p_subject_id;
    return v_content.id is not null and (
      v_content.autor_id = auth.uid()
      or (v_content.editorial_id is not null and public.vista_editorial_has_role(v_content.editorial_id, 'editor'))
    );
  elsif p_subject_type = 'keynote' then
    return exists (select 1 from public.gba_keynotes where id = p_subject_id)
      and public.gba_workspace_has_role('approver');
  elsif p_subject_type = 'business' then
    select * into v_business from public.network_businesses where id = p_subject_id;
    return v_business.id is not null and v_business.owner_id = auth.uid();
  elsif p_subject_type = 'update' then
    return exists (
      select 1 from public.vista_updates
      where id = p_subject_id and author_id = auth.uid()
    );
  end if;

  return false;
end;
$$;

create or replace function public.vista_subject_exists(p_subject_type text, p_subject_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case p_subject_type
    when 'content' then exists (
      select 1 from public.contenido where id = p_subject_id and estado_publicacion = 'aprobado'
    )
    when 'keynote' then exists (
      select 1 from public.gba_keynotes where id = p_subject_id and is_published = true
    )
    when 'business' then exists (
      select 1 from public.network_businesses where id = p_subject_id and estado = 'aprobado'
    )
    when 'update' then exists (
      select 1 from public.vista_updates where id = p_subject_id and status = 'active'
    )
    else false
  end;
$$;

create or replace function public.vista_my_update_identities()
returns table (
  identity_type text,
  identity_id uuid,
  display_name text,
  handle text,
  image_url text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    'profile'::text,
    u.id,
    coalesce(nullif(u.nombre_publico, ''), u.nombre),
    u.nombre,
    u.avatar_url
  from public.usuarios u
  where u.id = auth.uid()

  union all

  select
    'editorial'::text,
    e.id,
    e.nombre,
    e.slug,
    e.logo_url
  from public.editorial_members em
  join public.editoriales e on e.id = em.editorial_id
  where em.usuario_id = auth.uid()
    and em.status = 'active'
    and em.role in ('owner', 'admin', 'editor', 'collaborator')

  union all

  select
    'business'::text,
    b.id,
    b.nombre,
    b.slug,
    b.logo_url
  from public.network_businesses b
  where b.owner_id = auth.uid() and b.estado = 'aprobado'
  order by 1, 3;
$$;

create or replace function public.vista_notify_mentions(
  p_body text,
  p_target_type text,
  p_target_id uuid,
  p_action_url text,
  p_exclude_user uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match text[];
  v_recipient uuid;
  v_actor_name text;
begin
  if auth.uid() is null then return; end if;
  select coalesce(nullif(nombre_publico, ''), nombre)
    into v_actor_name from public.usuarios where id = auth.uid();

  for v_match in
    select regexp_matches(coalesce(p_body, ''), '@([A-Za-z0-9_.-]{2,32})', 'g')
  loop
    select id into v_recipient
    from public.usuarios
    where lower(nombre) = lower(v_match[1]) and perfil_publico = true
    limit 1;

    if v_recipient is not null
       and v_recipient <> auth.uid()
       and v_recipient is distinct from p_exclude_user then
      insert into public.notificaciones (
        usuario_id, actor_id, tipo, titulo, mensaje, target_type, target_id, action_url
      ) values (
        v_recipient, auth.uid(), 'mencion', 'Te mencionaron en VISTA',
        v_actor_name || ' te mencionó en una conversación.',
        p_target_type, p_target_id, p_action_url
      );
    end if;
    v_recipient := null;
  end loop;
end;
$$;

create or replace function public.vista_create_update(
  p_body text,
  p_identity_type text default 'profile',
  p_identity_id uuid default null,
  p_image_url text default null,
  p_link_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_editorial_id uuid;
  v_business_id uuid;
  v_identity_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 600 then
    raise exception 'Update must contain between 1 and 600 characters';
  end if;
  if p_identity_type not in ('profile', 'editorial', 'business') then
    raise exception 'Invalid identity';
  end if;
  if nullif(trim(coalesce(p_image_url, '')), '') is not null
     and p_image_url !~ '^https://' then raise exception 'Image URL must use HTTPS'; end if;
  if nullif(trim(coalesce(p_link_url, '')), '') is not null
     and p_link_url !~ '^https?://' then raise exception 'Link URL must use HTTP or HTTPS'; end if;

  if p_identity_type = 'profile' then
    select coalesce(nullif(nombre_publico, ''), nombre)
      into v_identity_name from public.usuarios where id = auth.uid();
  elsif p_identity_type = 'editorial' then
    select e.id, e.nombre into v_editorial_id, v_identity_name
    from public.editoriales e
    join public.editorial_members em on em.editorial_id = e.id
    where e.id = p_identity_id and em.usuario_id = auth.uid()
      and em.status = 'active' and em.role in ('owner', 'admin', 'editor', 'collaborator');
    if v_editorial_id is null then raise exception 'Editorial publishing access required'; end if;
  else
    select id, nombre into v_business_id, v_identity_name
    from public.network_businesses
    where id = p_identity_id and owner_id = auth.uid() and estado = 'aprobado';
    if v_business_id is null then raise exception 'Approved business access required'; end if;
  end if;

  insert into public.vista_updates (
    author_id, editorial_id, business_id, body, image_url, link_url
  ) values (
    auth.uid(), v_editorial_id, v_business_id, trim(p_body),
    nullif(trim(coalesce(p_image_url, '')), ''),
    nullif(trim(coalesce(p_link_url, '')), '')
  ) returning id into v_id;

  if p_identity_type = 'editorial' then
    insert into public.notificaciones (
      usuario_id, actor_id, tipo, titulo, mensaje, editorial_id,
      target_type, target_id, action_url
    )
    select
      f.usuario_id, auth.uid(), 'nueva_actualizacion',
      'Nueva actualización de ' || v_identity_name,
      left(trim(p_body), 180), v_editorial_id,
      'update', v_id, '/?update=' || v_id::text
    from public.editoriales_seguidas f
    where f.editorial_id = v_editorial_id and f.notificar = true
      and f.usuario_id <> auth.uid();
  else
    insert into public.notificaciones (
      usuario_id, actor_id, tipo, titulo, mensaje,
      target_type, target_id, action_url
    )
    select
      f.follower_id, auth.uid(), 'nueva_actualizacion',
      'Nueva actualización de ' || v_identity_name,
      left(trim(p_body), 180), 'update', v_id, '/?update=' || v_id::text
    from public.vista_profile_follows f
    where f.followed_id = auth.uid() and f.follower_id <> auth.uid();
  end if;

  perform public.vista_notify_mentions(
    p_body, 'update', v_id, '/?update=' || v_id::text, null
  );
  return v_id;
end;
$$;

create or replace function public.vista_toggle_update_like(p_update_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_liked boolean;
  v_count integer;
  v_owner uuid;
  v_actor_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select author_id into v_owner from public.vista_updates
  where id = p_update_id and status = 'active';
  if v_owner is null then raise exception 'Update not found'; end if;

  if exists (
    select 1 from public.vista_update_likes
    where update_id = p_update_id and user_id = auth.uid()
  ) then
    delete from public.vista_update_likes
    where update_id = p_update_id and user_id = auth.uid();
    v_liked := false;
  else
    insert into public.vista_update_likes (update_id, user_id)
    values (p_update_id, auth.uid());
    v_liked := true;
    if v_owner <> auth.uid() then
      select coalesce(nullif(nombre_publico, ''), nombre)
        into v_actor_name from public.usuarios where id = auth.uid();
      insert into public.notificaciones (
        usuario_id, actor_id, tipo, titulo, mensaje,
        target_type, target_id, action_url
      ) values (
        v_owner, auth.uid(), 'like_actualizacion',
        'A alguien le gustó tu actualización',
        v_actor_name || ' indicó que le gusta tu actualización.',
        'update', p_update_id, '/?update=' || p_update_id::text
      );
    end if;
  end if;

  select count(*)::integer into v_count
  from public.vista_update_likes where update_id = p_update_id;
  update public.vista_updates set likes_count = v_count, updated_at = now()
  where id = p_update_id;
  return jsonb_build_object('liked', v_liked, 'likes_count', v_count);
end;
$$;

create or replace function public.vista_delete_update(p_update_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.vista_updates
    where id = p_update_id and (author_id = auth.uid() or public.vista_is_platform_admin())
  ) then raise exception 'You cannot delete this update'; end if;
  update public.vista_updates
  set status = 'deleted', body = '', image_url = null, link_url = null, updated_at = now()
  where id = p_update_id;
end;
$$;

create or replace function public.vista_list_activity(
  p_mode text default 'featured',
  p_limit integer default 30,
  p_profile_id uuid default null,
  p_focus_id uuid default null
)
returns table (
  item_kind text,
  item_id uuid,
  subject_type text,
  subject_id uuid,
  actor_type text,
  actor_id uuid,
  actor_name text,
  actor_handle text,
  actor_image text,
  title text,
  body text,
  image_url text,
  link_url text,
  action_url text,
  likes_count bigint,
  conversation_count bigint,
  is_liked boolean,
  can_delete boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with feed (
    item_kind,
    item_id,
    subject_type,
    subject_id,
    actor_type,
    actor_id,
    actor_name,
    actor_handle,
    actor_image,
    title,
    body,
    image_url,
    link_url,
    action_url,
    likes_count,
    conversation_count,
    is_liked,
    can_delete,
    created_at
  ) as (
    select
      'update'::text as item_kind,
      a.id as item_id,
      'update'::text as subject_type,
      a.id as subject_id,
      case when a.editorial_id is not null then 'editorial'
           when a.business_id is not null then 'business'
           else 'profile' end::text as actor_type,
      coalesce(a.editorial_id, a.business_id, a.author_id) as actor_id,
      coalesce(e.nombre, b.nombre, nullif(u.nombre_publico, ''), u.nombre)::text as actor_name,
      coalesce(e.slug, b.slug, u.nombre)::text as actor_handle,
      coalesce(e.logo_url, b.logo_url, u.avatar_url)::text as actor_image,
      null::text as title,
      a.body::text,
      a.image_url::text,
      a.link_url::text,
      ('/?update=' || a.id::text)::text as action_url,
      a.likes_count::bigint,
      (select count(*) from public.vista_conversations c
       where c.subject_type = 'update' and c.subject_id = a.id and c.status = 'active')::bigint,
      exists (select 1 from public.vista_update_likes l
              where l.update_id = a.id and l.user_id = auth.uid()) as is_liked,
      (a.author_id = auth.uid() or public.vista_is_platform_admin()) as can_delete,
      a.created_at
    from public.vista_updates a
    join public.usuarios u on u.id = a.author_id
    left join public.editoriales e on e.id = a.editorial_id
    left join public.network_businesses b on b.id = a.business_id
    where a.status = 'active'
      and (p_profile_id is null or a.author_id = p_profile_id)
      and (p_focus_id is null or a.id = p_focus_id)
      and (
        p_mode <> 'following'
        or a.author_id = auth.uid()
        or exists (select 1 from public.vista_profile_follows f where f.follower_id = auth.uid() and f.followed_id = a.author_id)
        or (a.editorial_id is not null and exists (
          select 1 from public.editoriales_seguidas ef
          where ef.usuario_id = auth.uid() and ef.editorial_id = a.editorial_id
        ))
      )

    union all

    select
      'edition'::text,
      c.id,
      'content'::text,
      c.id,
      case when c.editorial_id is not null then 'editorial' else 'profile' end::text,
      coalesce(c.editorial_id, c.autor_id),
      coalesce(e.nombre, nullif(u.nombre_publico, ''), u.nombre)::text,
      coalesce(e.slug, u.nombre)::text,
      coalesce(e.logo_url, u.avatar_url)::text,
      c.titulo::text,
      c.descripcion::text,
      coalesce(c.poster_url, c.banner_url)::text,
      null::text,
      ('/?edition=' || c.id::text)::text,
      coalesce(c.likes_count, 0)::bigint,
      (select count(*) from public.vista_conversations vc
       where vc.subject_type = 'content' and vc.subject_id = c.id and vc.status = 'active')::bigint,
      exists (select 1 from public.likes_contenido lc
              where lc.contenido_id = c.id and lc.usuario_id = auth.uid()),
      false,
      c.created_at
    from public.contenido c
    join public.usuarios u on u.id = c.autor_id
    left join public.editoriales e on e.id = c.editorial_id
    where c.estado_publicacion = 'aprobado' and c.es_comunidad = true
      and p_focus_id is null
      and (p_profile_id is null or c.autor_id = p_profile_id)
      and (
        p_mode <> 'following'
        or c.autor_id = auth.uid()
        or exists (select 1 from public.vista_profile_follows f where f.follower_id = auth.uid() and f.followed_id = c.autor_id)
        or (c.editorial_id is not null and exists (
          select 1 from public.editoriales_seguidas ef
          where ef.usuario_id = auth.uid() and ef.editorial_id = c.editorial_id
        ))
      )

    union all

    select
      'keynote'::text,
      k.id,
      'keynote'::text,
      k.id,
      'profile'::text,
      k.published_by,
      coalesce(nullif(u.nombre_publico, ''), u.nombre, 'GBA')::text,
      coalesce(u.nombre, 'gba')::text,
      u.avatar_url::text,
      k.title::text,
      k.summary::text,
      null::text,
      null::text,
      ('/?keynote=' || k.slug)::text,
      0::bigint,
      (select count(*) from public.vista_conversations vc
       where vc.subject_type = 'keynote' and vc.subject_id = k.id and vc.status = 'active')::bigint,
      false,
      false,
      k.published_at
    from public.gba_keynotes k
    left join public.usuarios u on u.id = k.published_by
    where k.is_published = true and p_focus_id is null
      and (p_profile_id is null or k.published_by = p_profile_id)
      and (
        p_mode <> 'following'
        or k.published_by = auth.uid()
        or exists (select 1 from public.vista_profile_follows f where f.follower_id = auth.uid() and f.followed_id = k.published_by)
      )
  )
  select
    f.item_kind, f.item_id, f.subject_type, f.subject_id,
    f.actor_type, f.actor_id, f.actor_name, f.actor_handle, f.actor_image,
    f.title, f.body, f.image_url, f.link_url, f.action_url,
    f.likes_count, f.conversation_count, f.is_liked, f.can_delete, f.created_at
  from feed f
  order by
    case when p_mode = 'featured' then
      extract(epoch from f.created_at) + least(259200, (f.likes_count * 14400) + (f.conversation_count * 7200))
    else extract(epoch from f.created_at) end desc
  limit greatest(1, least(coalesce(p_limit, 30), 60));
$$;

create or replace function public.vista_get_update_share(p_update_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', a.id,
    'body', a.body,
    'image_url', a.image_url,
    'actor_name', coalesce(e.nombre, b.nombre, nullif(u.nombre_publico, ''), u.nombre),
    'actor_handle', coalesce(e.slug, b.slug, u.nombre),
    'actor_type', case when a.editorial_id is not null then 'editorial'
                       when a.business_id is not null then 'business'
                       else 'profile' end,
    'created_at', a.created_at
  )
  from public.vista_updates a
  join public.usuarios u on u.id = a.author_id
  left join public.editoriales e on e.id = a.editorial_id
  left join public.network_businesses b on b.id = a.business_id
  where a.id = p_update_id and a.status = 'active';
$$;

create or replace function public.vista_add_conversation(
  p_subject_type text,
  p_subject_id uuid,
  p_body text,
  p_parent_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_recipient uuid;
  v_action_url text := '/';
  v_title text := 'Nueva respuesta';
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.vista_subject_exists(p_subject_type, p_subject_id) then raise exception 'Publication not found'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 1200 then raise exception 'Message must contain between 1 and 1200 characters'; end if;
  if p_parent_id is not null and not exists (
    select 1 from public.vista_conversations
    where id = p_parent_id and subject_type = p_subject_type and subject_id = p_subject_id and status = 'active'
  ) then raise exception 'Parent message not found'; end if;

  insert into public.vista_conversations (subject_type, subject_id, author_id, parent_id, body)
  values (p_subject_type, p_subject_id, auth.uid(), p_parent_id, trim(p_body))
  returning id into v_id;

  if p_parent_id is not null then
    select author_id into v_recipient from public.vista_conversations where id = p_parent_id;
  elsif p_subject_type = 'content' then
    select autor_id, '/?edition=' || id::text into v_recipient, v_action_url from public.contenido where id = p_subject_id;
    v_title := 'Nueva conversación en tu publicación';
  elsif p_subject_type = 'keynote' then
    select published_by, '/?keynote=' || slug into v_recipient, v_action_url from public.gba_keynotes where id = p_subject_id;
    v_title := 'Nueva conversación en una Keynote';
  elsif p_subject_type = 'business' then
    select owner_id into v_recipient from public.network_businesses where id = p_subject_id;
    v_title := 'Nueva conversación en tu perfil de Network';
  elsif p_subject_type = 'update' then
    select author_id, '/?update=' || id::text into v_recipient, v_action_url from public.vista_updates where id = p_subject_id;
    v_title := 'Nueva respuesta a tu actualización';
  end if;

  if v_recipient is not null and v_recipient <> auth.uid() then
    insert into public.notificaciones (
      usuario_id, actor_id, tipo, titulo, mensaje, target_type, target_id, action_url
    ) values (
      v_recipient, auth.uid(), 'conversacion', v_title, left(trim(p_body), 180),
      p_subject_type, p_subject_id, v_action_url
    );
  end if;
  perform public.vista_notify_mentions(
    p_body, p_subject_type, p_subject_id, v_action_url, v_recipient
  );
  return v_id;
end;
$$;

revoke all on function public.vista_my_update_identities() from public, anon;
revoke all on function public.vista_notify_mentions(text, text, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.vista_create_update(text, text, uuid, text, text) from public, anon;
revoke all on function public.vista_toggle_update_like(uuid) from public, anon;
revoke all on function public.vista_delete_update(uuid) from public, anon;
revoke all on function public.vista_list_activity(text, integer, uuid, uuid) from public, anon;
revoke all on function public.vista_get_update_share(uuid) from public;

grant execute on function public.vista_my_update_identities() to authenticated;
grant execute on function public.vista_create_update(text, text, uuid, text, text) to authenticated;
grant execute on function public.vista_toggle_update_like(uuid) to authenticated;
grant execute on function public.vista_delete_update(uuid) to authenticated;
grant execute on function public.vista_list_activity(text, integer, uuid, uuid) to authenticated;
grant execute on function public.vista_get_update_share(uuid) to anon, authenticated;

commit;
