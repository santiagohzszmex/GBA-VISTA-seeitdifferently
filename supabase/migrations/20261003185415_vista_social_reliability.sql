begin;

-- Archive removed attributions while retaining consent and stable invitation IDs.
alter table public.vista_credits add column if not exists is_active boolean not null default true;
drop index if exists public.vista_credits_verified_unique;
create unique index vista_credits_verified_unique
  on public.vista_credits(subject_type,subject_id,contributor_id,lower(role))
  where is_active and contributor_id is not null and status <> 'declined';

-- A removed social message may be empty; an active one may never be empty.
alter table public.vista_conversations drop constraint if exists vista_conversations_body_check;
alter table public.vista_conversations add constraint vista_conversations_body_check
  check ((status='deleted') or char_length(trim(body)) between 1 and 1200);
alter table public.vista_updates drop constraint if exists vista_updates_body_check;
alter table public.vista_updates add constraint vista_updates_body_check
  check ((status='deleted') or char_length(trim(body)) between 1 and 600);

create schema if not exists vista_social_private;
revoke all on schema vista_social_private from public,anon,authenticated;
create or replace function vista_social_private.subject_url(p_type text,p_id uuid)
returns text language sql stable security invoker set search_path='' as $$
  select case p_type
    when 'content' then '/?content='||p_id::text
    when 'keynote' then '/?keynote='||(select slug from public.gba_keynotes where id=p_id)
    when 'business' then '/?network=1'
    when 'update' then '/?update='||p_id::text
    else '/' end;
$$;
revoke all on function vista_social_private.subject_url(text,uuid) from public,anon,authenticated;

create or replace function public.vista_can_manage_subject(p_subject_type text, p_subject_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_content public.contenido%rowtype;
  v_business public.network_businesses%rowtype;
begin
  if auth.uid() is null then return false; end if;
  if not (case p_subject_type
    when 'content' then exists(select 1 from public.contenido where id=p_subject_id)
    when 'keynote' then exists(select 1 from public.gba_keynotes where id=p_subject_id)
    when 'business' then exists(select 1 from public.network_businesses where id=p_subject_id)
    when 'update' then exists(select 1 from public.vista_updates where id=p_subject_id)
    else false end) then return false; end if;
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
set search_path = ''
as $$
  select
    c.id,
    c.contributor_id,
    c.display_name,
    c.role,
    c.status,
    c.credit_position,
    case when u.perfil_publico or u.id=auth.uid() then u.nombre else null end,
    case when u.perfil_publico or u.id=auth.uid() then coalesce(nullif(u.nombre_publico, ''), u.nombre) else c.display_name end,
    public.vista_can_manage_subject(p_subject_type, p_subject_id),
    c.contributor_id = auth.uid() and c.status = 'pending'
  from public.vista_credits c
  left join public.usuarios u on u.id = c.contributor_id
  where c.subject_type = p_subject_type
    and c.subject_id = p_subject_id and c.is_active and auth.uid() is not null
    and (public.vista_subject_exists(p_subject_type,p_subject_id)
      or public.vista_can_manage_subject(p_subject_type,p_subject_id))
    and (
      c.status = 'accepted'
      or public.vista_can_manage_subject(p_subject_type, p_subject_id)
      or c.contributor_id = auth.uid()
    )
  order by c.credit_position, c.created_at;
$$;

create or replace function public.vista_replace_credits(p_subject_type text,p_subject_id uuid,p_credits jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_item jsonb; v_user_id uuid; v_handle text; v_public_name text;
  v_role text; v_display text; v_key text; v_status text;
  v_position integer:=0; v_credit_id uuid; v_requested_id uuid;
  v_prior public.vista_credits%rowtype;
  v_seen text[]:='{}'; v_keep uuid[]:='{}';
begin
  if auth.uid() is null or not coalesce(public.vista_can_manage_subject(p_subject_type,p_subject_id),false) then
    raise exception 'No puedes gestionar los créditos de esta publicación';
  end if;
  if p_credits is null or jsonb_typeof(p_credits)<>'array' then raise exception 'Los créditos deben ser una lista'; end if;
  if jsonb_array_length(p_credits)>30 then raise exception 'Puedes añadir hasta 30 créditos'; end if;
  perform pg_advisory_xact_lock(hashtextextended('credits:'||p_subject_type||p_subject_id::text,0));
  for v_item in select value from jsonb_array_elements(p_credits) loop
    if jsonb_typeof(v_item)<>'object' then raise exception 'Crédito inválido'; end if;
    v_role:=trim(coalesce(v_item->>'role',''));
    if char_length(v_role) not between 2 and 60 then raise exception 'Cada crédito necesita un rol de 2 a 60 caracteres'; end if;
    v_requested_id:=nullif(v_item->>'id','')::uuid;
    if v_requested_id is not null and not exists(select 1 from public.vista_credits where id=v_requested_id and subject_type=p_subject_type and subject_id=p_subject_id) then
      raise exception 'El crédito no pertenece a esta publicación';
    end if;
    v_user_id:=null; v_handle:=null; v_public_name:=null;
    if nullif(trim(v_item->>'handle'),'') is not null then
      select id,nombre,nombre_publico into v_user_id,v_handle,v_public_name from public.usuarios
      where lower(nombre)=lower(trim(leading '@' from trim(v_item->>'handle')))
        and (perfil_publico or id=auth.uid() or exists(select 1 from public.vista_credits c
          where c.id=v_requested_id and c.contributor_id=usuarios.id)) limit 1;
      if v_user_id is null then raise exception 'Selecciona un GBA ID público válido'; end if;
    elsif v_requested_id is not null and coalesce((v_item->>'external')::boolean,false)=false then
      -- A hidden profile can keep its existing attribution without exposing its handle.
      select c.contributor_id,u.nombre,u.nombre_publico into v_user_id,v_handle,v_public_name
      from public.vista_credits c left join public.usuarios u on u.id=c.contributor_id
      where c.id=v_requested_id and c.contributor_id is not null;
    end if;
    v_display:=trim(coalesce(nullif(v_item->>'display_name',''),nullif(v_public_name,''),v_handle,''));
    if char_length(v_display) not between 2 and 80 then raise exception 'Cada crédito necesita un nombre de 2 a 80 caracteres'; end if;
    v_key:=coalesce(v_user_id::text,'external:'||lower(v_display))||'|'||lower(v_role);
    if v_key=any(v_seen) then raise exception 'No repitas una persona con el mismo rol'; end if;
    v_seen:=array_append(v_seen,v_key);
    v_prior:=null;
    select * into v_prior from public.vista_credits c
      where c.subject_type=p_subject_type and c.subject_id=p_subject_id
        and c.contributor_id is not distinct from v_user_id and lower(c.role)=lower(v_role)
        and (v_user_id is not null or c.id=v_requested_id or lower(c.display_name)=lower(v_display))
      order by (c.id=v_requested_id) desc nulls last,c.is_active desc,c.created_at desc limit 1 for update;
    v_position:=v_position+1;
    if v_prior.id is not null then
      v_credit_id:=v_prior.id;
      update public.vista_credits set display_name=v_display,role=v_role,credit_position=v_position,is_active=true,updated_at=now()
        where id=v_credit_id;
    else
      v_status:=case when v_user_id is null or v_user_id=auth.uid() then 'accepted' else 'pending' end;
      insert into public.vista_credits(subject_type,subject_id,contributor_id,display_name,role,status,credit_position,created_by)
        values(p_subject_type,p_subject_id,v_user_id,v_display,v_role,v_status,v_position,auth.uid()) returning id into v_credit_id;
      if v_status='pending' then
        insert into public.notificaciones(usuario_id,actor_id,tipo,titulo,mensaje,target_type,target_id,action_url,metadata)
        values(v_user_id,auth.uid(),'credito_pendiente','Nueva colaboración por confirmar',
          'Te acreditaron como '||v_role||'. Confirma si participaste en esta publicación.',
          p_subject_type,p_subject_id,vista_social_private.subject_url(p_subject_type,p_subject_id),jsonb_build_object('credit_id',v_credit_id));
      end if;
    end if;
    v_keep:=array_append(v_keep,v_credit_id);
  end loop;
  update public.vista_credits set is_active=false,updated_at=now()
    where subject_type=p_subject_type and subject_id=p_subject_id and is_active and not(id=any(v_keep));
  update public.notificaciones n set leida=true,metadata=n.metadata||jsonb_build_object('credit_status','removed')
    where n.tipo='credito_pendiente' and n.target_type=p_subject_type and n.target_id=p_subject_id
      and exists(select 1 from public.vista_credits c where c.id::text=n.metadata->>'credit_id' and not c.is_active);
end;
$$;

create or replace function public.vista_respond_credit(p_credit_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_credit public.vista_credits%rowtype; v_status text;
begin
  if auth.uid() is null or p_accept is null then raise exception 'Necesitas una sesión válida y una respuesta'; end if;
  select * into v_credit from public.vista_credits where id=p_credit_id;
  if v_credit.id is null or v_credit.contributor_id is distinct from auth.uid() then raise exception 'Este crédito no pertenece a tu GBA ID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('credits:'||v_credit.subject_type||v_credit.subject_id::text,0));
  select * into v_credit from public.vista_credits where id=p_credit_id for update;
  if not v_credit.is_active then raise exception 'Esta invitación ya fue retirada'; end if;
  v_status:=case when p_accept then 'accepted' else 'declined' end;
  if v_credit.status<>v_status and v_credit.status<>'pending' then raise exception 'Esta invitación ya fue respondida'; end if;
  update public.vista_credits set status=v_status,updated_at=now() where id=p_credit_id;
  update public.notificaciones set leida=true,metadata=metadata||jsonb_build_object('credit_status',v_status)
    where usuario_id=auth.uid() and tipo='credito_pendiente' and metadata->>'credit_id'=p_credit_id::text;
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
set search_path = ''
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
      when 'content' then '/?content=' || c.subject_id::text
      when 'keynote' then '/?keynote=' || (select slug from public.gba_keynotes where id = c.subject_id)
      else '/?network=1'
    end,
    c.created_at
  from public.vista_credits c
  where c.contributor_id = p_user_id and c.status = 'accepted' and c.is_active and auth.uid() is not null
    and public.vista_subject_exists(c.subject_type, c.subject_id)
    and (p_user_id=auth.uid() or exists(select 1 from public.usuarios where id=p_user_id and perfil_publico))
  order by c.created_at desc;
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
set search_path = ''
as $$
  select
    c.id, c.author_id, c.parent_id, c.body, c.created_at,
    u.nombre, coalesce(nullif(u.nombre_publico, ''), u.nombre),
    c.author_id = auth.uid() or public.vista_can_manage_subject(p_subject_type, p_subject_id)
  from public.vista_conversations c
  join public.usuarios u on u.id = c.author_id
  where c.subject_type = p_subject_type and c.subject_id = p_subject_id and c.status = 'active' and auth.uid() is not null
    and (public.vista_subject_exists(p_subject_type,p_subject_id) or public.vista_can_manage_subject(p_subject_type,p_subject_id))
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
set search_path = ''
as $$
declare
  v_id uuid;
  v_recipient uuid;
  v_action_url text := vista_social_private.subject_url(p_subject_type,p_subject_id);
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
    select autor_id, vista_social_private.subject_url(p_subject_type,p_subject_id) into v_recipient, v_action_url from public.contenido where id = p_subject_id;
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

create or replace function public.vista_delete_conversation(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message public.vista_conversations%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_message from public.vista_conversations where id = p_conversation_id;
  if v_message.id is null then return; end if;
  if v_message.author_id is distinct from auth.uid()
     and not coalesce(public.vista_can_manage_subject(v_message.subject_type, v_message.subject_id),false) then
    raise exception 'You cannot remove this message';
  end if;
  update public.vista_conversations set status = 'deleted', body = '', updated_at = now() where id = p_conversation_id;
end;
$$;

create or replace function public.vista_delete_update(p_update_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.vista_updates
    where id = p_update_id and (author_id = auth.uid() or public.vista_is_platform_admin())
  ) then raise exception 'You cannot delete this update'; end if;
  update public.vista_updates
  set status = 'deleted', body = '', image_url = null, link_url = null, updated_at = now()
  where id = p_update_id;
end;
$$;

create or replace function public.get_public_profile(p_handle text)
returns jsonb
language sql
security definer
set search_path = ''
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
    'colaboraciones', (select count(*) from public.vista_credits vc where vc.contributor_id = u.id and vc.status = 'accepted' and vc.is_active and public.vista_subject_exists(vc.subject_type,vc.subject_id))
  )
  from public.usuarios u
  where lower(u.nombre) = lower(trim(leading '@' from p_handle)) and u.perfil_publico = true
  limit 1;
$$;

revoke all on function public.vista_can_manage_subject(text,uuid) from public,anon;
grant execute on function public.vista_can_manage_subject(text,uuid) to authenticated;
revoke all on function public.vista_list_credits(text,uuid) from public,anon;
grant execute on function public.vista_list_credits(text,uuid) to authenticated;
revoke all on function public.vista_replace_credits(text,uuid,jsonb) from public,anon;
grant execute on function public.vista_replace_credits(text,uuid,jsonb) to authenticated;
revoke all on function public.vista_respond_credit(uuid,boolean) from public,anon;
grant execute on function public.vista_respond_credit(uuid,boolean) to authenticated;
revoke all on function public.vista_profile_credits(uuid) from public,anon;
grant execute on function public.vista_profile_credits(uuid) to authenticated;
revoke all on function public.vista_list_conversation(text,uuid) from public,anon;
grant execute on function public.vista_list_conversation(text,uuid) to authenticated;
revoke all on function public.vista_add_conversation(text,uuid,text,uuid) from public,anon;
grant execute on function public.vista_add_conversation(text,uuid,text,uuid) to authenticated;
revoke all on function public.vista_delete_conversation(uuid) from public,anon;
grant execute on function public.vista_delete_conversation(uuid) to authenticated;
revoke all on function public.vista_delete_update(uuid) from public,anon;
grant execute on function public.vista_delete_update(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
