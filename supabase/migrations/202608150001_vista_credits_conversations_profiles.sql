begin;

-- Credits are attached to existing records, so old publications can be credited
-- without republishing media or changing their original schema.
create table if not exists public.vista_credits (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('content', 'keynote', 'business')),
  subject_id uuid not null,
  contributor_id uuid references public.usuarios(id) on delete set null,
  display_name text not null,
  role text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  credit_position integer not null default 0,
  created_by uuid not null references public.usuarios(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(trim(display_name)) between 2 and 80),
  check (char_length(trim(role)) between 2 and 60)
);

create index if not exists vista_credits_subject
  on public.vista_credits (subject_type, subject_id, credit_position, created_at);
create index if not exists vista_credits_contributor
  on public.vista_credits (contributor_id, status, created_at desc);
create unique index if not exists vista_credits_verified_unique
  on public.vista_credits (subject_type, subject_id, contributor_id, lower(role))
  where contributor_id is not null and status <> 'declined';

create table if not exists public.vista_profile_follows (
  follower_id uuid not null references public.usuarios(id) on delete cascade,
  followed_id uuid not null references public.usuarios(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create index if not exists vista_profile_follows_followed
  on public.vista_profile_follows (followed_id, created_at desc);

create table if not exists public.vista_conversations (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('content', 'keynote', 'business')),
  subject_id uuid not null,
  author_id uuid not null references public.usuarios(id) on delete cascade,
  parent_id uuid references public.vista_conversations(id) on delete cascade,
  body text not null,
  status text not null default 'active' check (status in ('active', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(trim(body)) between 1 and 1200)
);

create index if not exists vista_conversations_subject
  on public.vista_conversations (subject_type, subject_id, created_at);

alter table public.notificaciones
  add column if not exists actor_id uuid references public.usuarios(id) on delete set null,
  add column if not exists target_type text,
  add column if not exists target_id uuid,
  add column if not exists action_url text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.vista_credits enable row level security;
alter table public.vista_profile_follows enable row level security;
alter table public.vista_conversations enable row level security;

revoke all on public.vista_credits from anon, authenticated;
revoke all on public.vista_profile_follows from anon, authenticated;
revoke all on public.vista_conversations from anon, authenticated;

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
    else false
  end;
$$;

create or replace function public.vista_list_credits(p_subject_type text, p_subject_id uuid)
returns table (
  id uuid,
  contributor_id uuid,
  display_name text,
  role text,
  status text,
  credit_position integer,
  handle text,
  profile_name text,
  can_manage boolean,
  can_respond boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    c.id,
    c.contributor_id,
    c.display_name,
    c.role,
    c.status,
    c.credit_position,
    u.nombre,
    coalesce(nullif(u.nombre_publico, ''), u.nombre),
    public.vista_can_manage_subject(p_subject_type, p_subject_id),
    c.contributor_id = auth.uid() and c.status = 'pending'
  from public.vista_credits c
  left join public.usuarios u on u.id = c.contributor_id
  where c.subject_type = p_subject_type
    and c.subject_id = p_subject_id
    and (
      c.status = 'accepted'
      or public.vista_can_manage_subject(p_subject_type, p_subject_id)
      or c.contributor_id = auth.uid()
    )
  order by c.credit_position, c.created_at;
$$;

create or replace function public.vista_replace_credits(
  p_subject_type text,
  p_subject_id uuid,
  p_credits jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_user_id uuid;
  v_user_handle text;
  v_user_public_name text;
  v_status text;
  v_display text;
  v_role text;
  v_position integer := 0;
  v_accepted text[];
  v_key text;
  v_credit_id uuid;
  v_action_url text := '/';
begin
  if not public.vista_can_manage_subject(p_subject_type, p_subject_id) then
    raise exception 'You cannot manage credits for this publication';
  end if;
  if jsonb_typeof(coalesce(p_credits, '[]'::jsonb)) <> 'array' then
    raise exception 'Credits must be an array';
  end if;
  if jsonb_array_length(coalesce(p_credits, '[]'::jsonb)) > 30 then
    raise exception 'A publication can contain up to 30 credits';
  end if;

  if p_subject_type = 'content' then
    v_action_url := '/?edition=' || p_subject_id::text;
  elsif p_subject_type = 'keynote' then
    select '/?keynote=' || slug into v_action_url from public.gba_keynotes where id = p_subject_id;
  elsif p_subject_type = 'business' then
    v_action_url := '/?network=1';
  end if;

  select array_agg(coalesce(contributor_id::text, '') || '|' || lower(role))
    into v_accepted
  from public.vista_credits
  where subject_type = p_subject_type and subject_id = p_subject_id and status = 'accepted';

  delete from public.vista_credits
  where subject_type = p_subject_type and subject_id = p_subject_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_credits, '[]'::jsonb))
  loop
    v_position := v_position + 1;
    v_role := left(trim(coalesce(v_item->>'role', '')), 60);
    if char_length(v_role) < 2 then raise exception 'Every credit requires a role'; end if;

    v_user_id := null;
    v_user_handle := null;
    v_user_public_name := null;
    if nullif(trim(coalesce(v_item->>'handle', '')), '') is not null then
      select id, nombre, nombre_publico
        into v_user_id, v_user_handle, v_user_public_name
      from public.usuarios
      where lower(nombre) = lower(trim(leading '@' from trim(v_item->>'handle')))
      limit 1;
      if v_user_id is null then
        raise exception 'GBA ID @% was not found', trim(leading '@' from trim(v_item->>'handle'));
      end if;
    end if;

    v_display := left(trim(coalesce(nullif(v_item->>'display_name', ''), v_user_public_name, v_user_handle, '')), 80);
    if char_length(v_display) < 2 then raise exception 'Every external credit requires a display name'; end if;

    v_key := coalesce(v_user_id::text, '') || '|' || lower(v_role);
    v_status := case
      when v_user_id is null or v_user_id = auth.uid() then 'accepted'
      when v_key = any(coalesce(v_accepted, '{}'::text[])) then 'accepted'
      else 'pending'
    end;

    insert into public.vista_credits (
      subject_type, subject_id, contributor_id, display_name, role, status, credit_position, created_by
    ) values (
      p_subject_type, p_subject_id, v_user_id, v_display, v_role, v_status, v_position, auth.uid()
    ) returning id into v_credit_id;

    if v_user_id is not null and v_status = 'pending' then
      insert into public.notificaciones (
        usuario_id, actor_id, tipo, titulo, mensaje, target_type, target_id, action_url, metadata
      ) values (
        v_user_id, auth.uid(), 'credito_pendiente', 'Nueva colaboración por confirmar',
        'Te acreditaron como ' || v_role || '. Revisa la atribución antes de mostrarla en tu perfil.',
        p_subject_type, p_subject_id, v_action_url, jsonb_build_object('credit_id', v_credit_id)
      );
    end if;
  end loop;
end;
$$;

create or replace function public.vista_respond_credit(p_credit_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_credit public.vista_credits%rowtype;
begin
  select * into v_credit from public.vista_credits where id = p_credit_id for update;
  if v_credit.id is null or v_credit.contributor_id <> auth.uid() then
    raise exception 'This credit does not belong to your GBA ID';
  end if;
  update public.vista_credits
  set status = case when p_accept then 'accepted' else 'declined' end, updated_at = now()
  where id = p_credit_id;
end;
$$;

create or replace function public.vista_profile_credits(p_user_id uuid)
returns table (
  id uuid,
  subject_type text,
  subject_id uuid,
  role text,
  display_name text,
  subject_title text,
  subject_image text,
  action_url text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    c.id,
    c.subject_type,
    c.subject_id,
    c.role,
    c.display_name,
    case c.subject_type
      when 'content' then (select titulo from public.contenido where id = c.subject_id)
      when 'keynote' then (select title from public.gba_keynotes where id = c.subject_id)
      when 'business' then (select nombre from public.network_businesses where id = c.subject_id)
    end,
    case c.subject_type
      when 'content' then (select coalesce(poster_url, banner_url) from public.contenido where id = c.subject_id)
      when 'business' then (select coalesce(logo_url, portada_url) from public.network_businesses where id = c.subject_id)
      else null
    end,
    case c.subject_type
      when 'content' then '/?edition=' || c.subject_id::text
      when 'keynote' then '/?keynote=' || (select slug from public.gba_keynotes where id = c.subject_id)
      else '/?network=1'
    end,
    c.created_at
  from public.vista_credits c
  where c.contributor_id = p_user_id and c.status = 'accepted'
    and public.vista_subject_exists(c.subject_type, c.subject_id)
  order by c.created_at desc;
$$;

create or replace function public.vista_profile_follow_state(p_profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'is_following', exists (
      select 1 from public.vista_profile_follows
      where follower_id = auth.uid() and followed_id = p_profile_id
    ),
    'followers', (select count(*) from public.vista_profile_follows where followed_id = p_profile_id),
    'following', (select count(*) from public.vista_profile_follows where follower_id = p_profile_id)
  );
$$;

create or replace function public.vista_set_profile_follow(p_profile_id uuid, p_follow boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_handle text;
  v_actor_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_profile_id = auth.uid() then raise exception 'You cannot follow your own profile'; end if;
  select nombre into v_handle from public.usuarios where id = p_profile_id and perfil_publico = true;
  if v_handle is null then raise exception 'Public profile not found'; end if;

  if p_follow then
    insert into public.vista_profile_follows (follower_id, followed_id)
    values (auth.uid(), p_profile_id)
    on conflict do nothing;
    if found then
      select coalesce(nullif(nombre_publico, ''), nombre) into v_actor_name from public.usuarios where id = auth.uid();
      insert into public.notificaciones (
        usuario_id, actor_id, tipo, titulo, mensaje, target_type, target_id, action_url
      ) values (
        p_profile_id, auth.uid(), 'nuevo_seguidor', 'Tienes un nuevo seguidor',
        v_actor_name || ' comenzó a seguir tu perfil.', 'profile', auth.uid(),
        '/?profile=' || (select nombre from public.usuarios where id = auth.uid())
      );
    end if;
  else
    delete from public.vista_profile_follows where follower_id = auth.uid() and followed_id = p_profile_id;
  end if;

  return public.vista_profile_follow_state(p_profile_id);
end;
$$;

create or replace function public.vista_list_conversation(p_subject_type text, p_subject_id uuid)
returns table (
  id uuid,
  author_id uuid,
  parent_id uuid,
  body text,
  created_at timestamptz,
  handle text,
  display_name text,
  can_delete boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    c.id, c.author_id, c.parent_id, c.body, c.created_at,
    u.nombre, coalesce(nullif(u.nombre_publico, ''), u.nombre),
    c.author_id = auth.uid() or public.vista_can_manage_subject(p_subject_type, p_subject_id)
  from public.vista_conversations c
  join public.usuarios u on u.id = c.author_id
  where c.subject_type = p_subject_type and c.subject_id = p_subject_id and c.status = 'active'
  order by c.created_at;
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
  end if;

  if v_recipient is not null and v_recipient <> auth.uid() then
    insert into public.notificaciones (
      usuario_id, actor_id, tipo, titulo, mensaje, target_type, target_id, action_url
    ) values (
      v_recipient, auth.uid(), 'conversacion', v_title, left(trim(p_body), 180),
      p_subject_type, p_subject_id, v_action_url
    );
  end if;
  return v_id;
end;
$$;

create or replace function public.vista_delete_conversation(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_message public.vista_conversations%rowtype;
begin
  select * into v_message from public.vista_conversations where id = p_conversation_id;
  if v_message.id is null then return; end if;
  if v_message.author_id <> auth.uid()
     and not public.vista_can_manage_subject(v_message.subject_type, v_message.subject_id) then
    raise exception 'You cannot remove this message';
  end if;
  update public.vista_conversations set status = 'deleted', body = '', updated_at = now() where id = p_conversation_id;
end;
$$;

create or replace function public.get_public_profile(p_handle text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'id', u.id,
    'handle', u.nombre,
    'nombre_publico', coalesce(nullif(u.nombre_publico, ''), u.nombre),
    'bio', coalesce(u.bio, ''),
    'avatar_url', u.avatar_url,
    'servidor', u.servidor,
    'nacion', u.nacion,
    'rol', u.rol,
    'sello_editorial', u.sello_editorial,
    'publicaciones', (select count(*) from public.contenido c where c.autor_id = u.id and c.estado_publicacion = 'aprobado'),
    'vistas', (select coalesce(sum(c.vistas), 0) from public.contenido c where c.autor_id = u.id and c.estado_publicacion = 'aprobado'),
    'likes', (select coalesce(sum(c.likes_count), 0) from public.contenido c where c.autor_id = u.id and c.estado_publicacion = 'aprobado'),
    'seguidores', (select count(*) from public.vista_profile_follows f where f.followed_id = u.id),
    'siguiendo', (select count(*) from public.vista_profile_follows f where f.follower_id = u.id),
    'colaboraciones', (select count(*) from public.vista_credits vc where vc.contributor_id = u.id and vc.status = 'accepted')
  )
  from public.usuarios u
  where lower(u.nombre) = lower(trim(leading '@' from p_handle)) and u.perfil_publico = true
  limit 1;
$$;

revoke all on function public.vista_can_manage_subject(text, uuid) from public, anon;
revoke all on function public.vista_subject_exists(text, uuid) from public, anon;
revoke all on function public.vista_list_credits(text, uuid) from public, anon;
revoke all on function public.vista_replace_credits(text, uuid, jsonb) from public, anon;
revoke all on function public.vista_respond_credit(uuid, boolean) from public, anon;
revoke all on function public.vista_profile_credits(uuid) from public, anon;
revoke all on function public.vista_profile_follow_state(uuid) from public, anon;
revoke all on function public.vista_set_profile_follow(uuid, boolean) from public, anon;
revoke all on function public.vista_list_conversation(text, uuid) from public, anon;
revoke all on function public.vista_add_conversation(text, uuid, text, uuid) from public, anon;
revoke all on function public.vista_delete_conversation(uuid) from public, anon;

grant execute on function public.vista_can_manage_subject(text, uuid) to authenticated;
grant execute on function public.vista_subject_exists(text, uuid) to authenticated;
grant execute on function public.vista_list_credits(text, uuid) to authenticated;
grant execute on function public.vista_replace_credits(text, uuid, jsonb) to authenticated;
grant execute on function public.vista_respond_credit(uuid, boolean) to authenticated;
grant execute on function public.vista_profile_credits(uuid) to authenticated;
grant execute on function public.vista_profile_follow_state(uuid) to authenticated;
grant execute on function public.vista_set_profile_follow(uuid, boolean) to authenticated;
grant execute on function public.vista_list_conversation(text, uuid) to authenticated;
grant execute on function public.vista_add_conversation(text, uuid, text, uuid) to authenticated;
grant execute on function public.vista_delete_conversation(uuid) to authenticated;

grant execute on function public.get_public_profile(text) to authenticated;

commit;
