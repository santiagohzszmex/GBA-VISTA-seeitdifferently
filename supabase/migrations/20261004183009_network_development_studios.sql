begin;
-- Studio permissions and invitations are private; public profiles contain only confirmed attribution.
create schema if not exists vista_studios_private;
revoke all on schema vista_studios_private from public,anon,authenticated;
create table public.development_studios (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.usuarios(id),
 slug text not null unique, nombre text not null check(char_length(nombre) between 2 and 80),
 descripcion text not null check(char_length(descripcion) between 20 and 1600),
 logo_url text not null default '', portada_url text not null default '', website_url text not null default '', discord_url text not null default '', support_url text not null default '',
 ranks text[] not null default array['Dirección','Desarrollo','Diseño','Colaboración'],
 portfolio jsonb not null default '[]'::jsonb check(jsonb_typeof(portfolio)='array' and jsonb_array_length(portfolio)<=30),
 archived boolean not null default false, created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.development_studio_members (
 studio_id uuid not null references public.development_studios(id) on delete cascade,
 user_id uuid not null references public.usuarios(id), role text not null check(role in('owner','admin','editor','member')),
 rank text not null default '' check(char_length(rank)<=60), state text not null check(state in('active','invited','declined')),
 invited_by uuid references public.usuarios(id), updated_at timestamptz not null default now(), primary key(studio_id,user_id),
 check(role<>'owner' or state='active')
);
create unique index development_studio_one_owner on public.development_studio_members(studio_id) where role='owner';
create index development_studio_members_user on public.development_studio_members(user_id,state,studio_id);
create index development_studios_owner on public.development_studios(owner_id);
create index development_studio_members_inviter on public.development_studio_members(invited_by);
alter table public.development_studios enable row level security;
alter table public.development_studio_members enable row level security;
revoke all on public.development_studios,public.development_studio_members from public,anon,authenticated;

create function vista_studios_private.role_for(p_id uuid) returns text language sql stable security definer set search_path='' as $$
 select m.role from public.development_studio_members m join public.development_studios s on s.id=m.studio_id
 where auth.uid() is not null and m.studio_id=p_id and m.user_id=auth.uid() and m.state='active' and not s.archived;
$$;
create function vista_studios_private.check_url(p_url text) returns text language plpgsql immutable set search_path='' as $$
declare v text:=trim(coalesce(p_url,'')); begin
 if v<>'' and (v !~ '^https://[a-zA-Z0-9][^[:space:]]*\.[^[:space:]]+$' or v ~ '^https://[^/]*@' or char_length(v)>2000) then raise exception 'Utiliza un enlace HTTPS válido, sin credenciales.'; end if; return v;
end; $$;
create function vista_studios_private.card(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',s.id,'slug',s.slug,'nombre',s.nombre,'descripcion',s.descripcion,'logo_url',s.logo_url,'portada_url',s.portada_url)
 from public.development_studios s where auth.uid() is not null and s.id=p_id and not s.archived;
$$;
create function public.vista_studios_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión con tu GBA ID.'; end if;
 return jsonb_build_object('studios',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('role',m.role,'rank',m.rank) order by s.nombre)
 from public.development_studios s join public.development_studio_members m on m.studio_id=s.id where m.user_id=auth.uid() and m.state='active' and not s.archived),'[]'::jsonb),
 'invitations',coalesce((select jsonb_agg(jsonb_build_object('studio_id',s.id,'nombre',s.nombre,'role',m.role,'rank',m.rank) order by m.updated_at desc)
 from public.development_studio_members m join public.development_studios s on s.id=m.studio_id where m.user_id=auth.uid() and m.state='invited' and not s.archived),'[]'::jsonb));
end; $$;
create function public.vista_save_development_studio(p_id uuid,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid:=coalesce(p_id,gen_random_uuid()); v_role text; v_rank text; v_ranks text[]; v_portfolio jsonb:='[]'; v_item jsonb; v_result public.development_studios; v_renames jsonb:=coalesce(p_data->'rank_renames','{}'::jsonb); v_rename record;
begin
 if auth.uid() is null then raise exception 'Inicia sesión con tu GBA ID.'; end if;
 if p_id is not null then
  perform 1 from public.development_studios where id=p_id for update;
  v_role:=vista_studios_private.role_for(p_id);
  if v_role is null or v_role not in('owner','admin','editor') then raise exception 'No tienes permiso para editar este estudio.'; end if;
 else
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,416));
  if (select count(*) from public.development_studios where owner_id=auth.uid() and not archived)>=10 then raise exception 'Puedes registrar hasta 10 estudios.'; end if;
 end if;
 if char_length(trim(coalesce(p_data->>'nombre',''))) not between 2 and 80 or char_length(trim(coalesce(p_data->>'descripcion',''))) not between 20 and 1600 then raise exception 'Escribe un nombre de 2 a 80 caracteres y una descripción de 20 a 1600.'; end if;
 if jsonb_typeof(p_data->'ranks') is distinct from 'array' or jsonb_array_length(p_data->'ranks') not between 1 and 30 then raise exception 'Añade entre 1 y 30 cargos.'; end if;
 select array_agg(trim(value) order by ord) into v_ranks from jsonb_array_elements_text(p_data->'ranks') with ordinality as r(value,ord);
 foreach v_rank in array v_ranks loop if char_length(v_rank) not between 1 and 60 then raise exception 'Cada cargo debe tener entre 1 y 60 caracteres.'; end if; end loop;
 if cardinality(v_ranks)<>(select count(distinct lower(r)) from unnest(v_ranks) r) then raise exception 'No repitas cargos.'; end if;
 if jsonb_typeof(v_renames)<>'object' then raise exception 'Revisa los cambios de cargos.'; end if;
 for v_rename in select key,value from jsonb_each_text(v_renames) loop
   if not(v_rename.value=any(v_ranks)) or not exists(select 1 from public.development_studios where id=p_id and v_rename.key=any(ranks)) then raise exception 'Revisa los cambios de cargos.'; end if;
 end loop;
 if exists(select 1 from public.development_studio_members where studio_id=p_id and state in('active','invited') and rank<>'' and not(coalesce(v_renames->>rank,rank)=any(v_ranks))) then raise exception 'Asigna otro cargo a los integrantes antes de eliminar uno en uso.'; end if;
 if jsonb_typeof(p_data->'portfolio') is distinct from 'array' or jsonb_array_length(p_data->'portfolio')>30 then raise exception 'El portafolio admite hasta 30 proyectos.'; end if;
 for v_item in select value from jsonb_array_elements(p_data->'portfolio') loop
  if jsonb_typeof(v_item)<>'object' or char_length(trim(coalesce(v_item->>'title',''))) not between 2 and 100 or char_length(coalesce(v_item->>'description',''))>800 then raise exception 'Revisa el título y la descripción del proyecto.'; end if;
  v_portfolio:=v_portfolio||jsonb_build_array(jsonb_build_object('title',trim(v_item->>'title'),'description',trim(coalesce(v_item->>'description','')),'url',vista_studios_private.check_url(v_item->>'url'),'image_url',vista_studios_private.check_url(v_item->>'image_url')));
 end loop;
 insert into public.development_studios(id,owner_id,slug,nombre,descripcion,logo_url,portada_url,website_url,discord_url,support_url,ranks,portfolio)
 values(v_id,auth.uid(),public.vista_editorial_slugify(trim(p_data->>'nombre'))||'-'||left(v_id::text,8),trim(p_data->>'nombre'),trim(p_data->>'descripcion'),vista_studios_private.check_url(p_data->>'logo_url'),vista_studios_private.check_url(p_data->>'portada_url'),vista_studios_private.check_url(p_data->>'website_url'),vista_studios_private.check_url(p_data->>'discord_url'),vista_studios_private.check_url(p_data->>'support_url'),v_ranks,v_portfolio)
 on conflict(id) do update set nombre=excluded.nombre,descripcion=excluded.descripcion,logo_url=excluded.logo_url,portada_url=excluded.portada_url,website_url=excluded.website_url,discord_url=excluded.discord_url,support_url=excluded.support_url,ranks=excluded.ranks,portfolio=excluded.portfolio,updated_at=now()
 returning * into v_result;
 update public.development_studio_members set rank=coalesce(v_renames->>rank,rank),updated_at=now() where studio_id=p_id and v_renames ? rank;
 if p_id is null then insert into public.development_studio_members(studio_id,user_id,role,rank,state) values(v_id,auth.uid(),'owner',v_ranks[1],'active'); end if;
 return to_jsonb(v_result)||jsonb_build_object('role',coalesce(v_role,'owner'));
end; $$;
create function public.vista_studio_team(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_role text:=vista_studios_private.role_for(p_id); begin
 if v_role is null then raise exception 'Debes pertenecer al estudio.'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'handle',u.nombre,'name',coalesce(nullif(u.nombre_publico,''),u.nombre),'role',m.role,'rank',m.rank,'state',m.state) order by m.role='owner' desc,m.state,u.nombre)
 from public.development_studio_members m join public.usuarios u on u.id=m.user_id where m.studio_id=p_id and (m.state='active' or (m.state='invited' and v_role in('owner','admin')))),'[]');
end; $$;
create function public.vista_studio_member(p_id uuid,p_handle text,p_role text,p_rank text,p_action text) returns void language plpgsql security definer set search_path='' as $$
declare v_role text; v_target public.development_studio_members; v_user uuid; v_name text; begin
 if auth.uid() is null then raise exception 'Inicia sesión con tu GBA ID.'; end if;
 perform 1 from public.development_studios where id=p_id for update; v_role:=vista_studios_private.role_for(p_id);
 select id into v_user from public.usuarios where lower(nombre)=lower(trim(leading '@' from trim(p_handle)));
 if v_user is null then raise exception 'No existe ese GBA ID.'; end if;
 select * into v_target from public.development_studio_members where studio_id=p_id and user_id=v_user;
 if p_action='leave' then
  if v_user<>auth.uid() or v_role is null or v_role='owner' then raise exception 'El propietario debe transferir la propiedad antes de salir.'; end if;
  delete from public.development_studio_members where studio_id=p_id and user_id=v_user; return;
 end if;
 if v_role is null or v_role not in('owner','admin') then raise exception 'Solo la dirección del estudio puede administrar el equipo.'; end if;
 if p_action not in('invite','update','remove') or p_action is null then raise exception 'Acción no válida.'; end if;
 if (v_target.role='owner' and not(p_action='update' and v_user=auth.uid())) or (v_role='admin' and (v_target.role='admin' or p_role='admin')) or (v_user=auth.uid() and (p_action<>'update' or p_role<>v_role)) then raise exception 'No puedes cambiar esos permisos.'; end if;
 if p_action='remove' then
  delete from public.development_studio_members where studio_id=p_id and user_id=v_user; return;
 end if;
 if p_role is null or (p_role='owner' and v_target.role is distinct from 'owner') or p_role not in('owner','admin','editor','member') then raise exception 'Selecciona un permiso válido.'; end if;
 if coalesce(p_rank,'')<>'' and not exists(select 1 from public.development_studios s where s.id=p_id and p_rank=any(s.ranks)) then raise exception 'El cargo no pertenece al estudio.'; end if;
 if p_action='update' then
  if v_target.user_id is null or v_target.state not in('active','invited') then raise exception 'Integrante no encontrado.'; end if;
  update public.development_studio_members set role=p_role,rank=coalesce(p_rank,''),updated_at=now() where studio_id=p_id and user_id=v_user;
 else
  if v_target.state in('active','invited') then raise exception 'La persona ya pertenece al equipo o tiene una invitación pendiente.'; end if;
  if (select count(*) from public.development_studio_members where studio_id=p_id and state in('active','invited'))>=100 then raise exception 'El equipo admite hasta 100 integrantes.'; end if;
  insert into public.development_studio_members(studio_id,user_id,role,rank,state,invited_by) values(p_id,v_user,p_role,coalesce(p_rank,''),'invited',auth.uid())
  on conflict(studio_id,user_id) do update set role=excluded.role,rank=excluded.rank,state='invited',invited_by=auth.uid(),updated_at=now();
  select nombre into v_name from public.development_studios where id=p_id;
  insert into public.notificaciones(usuario_id,actor_id,tipo,titulo,mensaje,action_url) values(v_user,auth.uid(),'sistema','Invitación a un estudio',v_name||' te invita a formar parte de su equipo.','/?workspace=studios');
 end if;
end; $$;
create function public.vista_studio_respond(p_id uuid,p_accept boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión con tu GBA ID.'; end if;
 perform 1 from public.development_studios where id=p_id and not archived for update;
 if not found then raise exception 'Estudio no disponible.'; end if;
 update public.development_studio_members set state=case when p_accept then 'active' else 'declined' end,updated_at=now() where studio_id=p_id and user_id=auth.uid() and state='invited';
 if not found then raise exception 'Invitación no disponible.'; end if;
end; $$;
create function public.vista_studio_transfer(p_id uuid,p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.development_studios where id=p_id for update;
 if vista_studios_private.role_for(p_id) is distinct from 'owner' then raise exception 'Solo el propietario puede transferir el estudio.'; end if;
 if p_user_id=auth.uid() or not exists(select 1 from public.development_studio_members where studio_id=p_id and user_id=p_user_id and state='active') then raise exception 'Selecciona un integrante activo del equipo.'; end if;
 update public.development_studio_members set role='admin',updated_at=now() where studio_id=p_id and user_id=auth.uid();
 update public.development_studio_members set role='owner',updated_at=now() where studio_id=p_id and user_id=p_user_id;
 update public.development_studios set owner_id=p_user_id,updated_at=now() where id=p_id;
end; $$;
alter table public.development_studios add column hidden boolean not null default false;
alter table public.network_servers
 add column access_type text not null default 'direct' check(access_type in('direct','modpack','invitation')),
 add column access_url text not null default '',add column access_instructions text not null default '' check(char_length(access_instructions)<=1200),
 add column support_url text not null default '',
 add column developer_studio_id uuid references public.development_studios(id),
 add column developer_user_id uuid references public.usuarios(id),
 add column developer_status text not null default 'none' check(developer_status in('none','pending','accepted','declined')),
 add constraint network_single_developer check(developer_studio_id is null or developer_user_id is null);
-- Existing Discord-only listings remain valid under the new access choices.
update public.network_servers set access_type='invitation',access_url=discord_url where ip='' and discord_url<>'';
create index network_servers_developer_studio on public.network_servers(developer_studio_id);
create index network_servers_developer_user on public.network_servers(developer_user_id,developer_status);
create function vista_studios_private.developer(p_server public.network_servers) returns jsonb language sql stable security definer set search_path='' as $$
 select case when auth.uid() is null or p_server.developer_status<>'accepted' then null
 when p_server.developer_studio_id is not null then (select jsonb_build_object('type','studio','name',s.nombre,'slug',s.slug,'logo_url',s.logo_url) from public.development_studios s where s.id=p_server.developer_studio_id and not s.archived and not s.hidden)
 else (select jsonb_build_object('type','person','name',coalesce(nullif(u.nombre_publico,''),u.nombre),'handle',u.nombre) from public.usuarios u where u.id=p_server.developer_user_id and u.perfil_publico) end;
$$;
create function vista_studios_private.server_card(p_server public.network_servers) returns jsonb language sql stable security definer set search_path='' as $$
 select case when auth.uid() is not null then to_jsonb(p_server)-'owner_id'-'review_notes'-'partner_interest'-'partner_requested_at'-'developer_user_id'-'developer_studio_id'-'developer_status'||jsonb_build_object('developer',vista_studios_private.developer(p_server)) end;
$$;
create function public.vista_development_studio(p_slug text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_s public.development_studios; begin
 if auth.uid() is null then raise exception 'Inicia sesión con tu GBA ID.'; end if;
 select * into v_s from public.development_studios where slug=p_slug and not archived and not hidden;
 if not found then return null; end if;
 return (to_jsonb(v_s)-'owner_id'-'ranks'-'archived'-'hidden')||jsonb_build_object(
 'members',coalesce((select jsonb_agg(jsonb_build_object('name',case when u.perfil_publico then coalesce(nullif(u.nombre_publico,''),u.nombre) else 'Miembro del equipo' end,'handle',case when u.perfil_publico then u.nombre else null end,'rank',m.rank) order by m.role='owner' desc,m.rank,u.nombre)
 from public.development_studio_members m join public.usuarios u on u.id=m.user_id where m.studio_id=v_s.id and m.state='active'),'[]'::jsonb),
 'servers',coalesce((select jsonb_agg(vista_studios_private.server_card(s) order by s.nombre) from public.network_servers s where s.developer_studio_id=v_s.id and s.developer_status='accepted' and s.estado='aprobado'),'[]'::jsonb));
end; $$;
create function public.vista_studio_directory() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión con tu GBA ID.'; end if;
 return coalesce((select jsonb_agg(vista_studios_private.card(s.id) order by s.nombre) from public.development_studios s where not s.archived and not s.hidden),'[]'::jsonb);
end; $$;
create function public.vista_profile_studios(p_user_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión con tu GBA ID.'; end if;
 if not exists(select 1 from public.usuarios where id=p_user_id and (perfil_publico or id=auth.uid())) then return jsonb_build_object('studios','[]'::jsonb,'servers','[]'::jsonb); end if;
 return jsonb_build_object('studios',coalesce((select jsonb_agg(vista_studios_private.card(s.id)||jsonb_build_object('rank',m.rank) order by s.nombre)
 from public.development_studios s join public.development_studio_members m on m.studio_id=s.id where m.user_id=p_user_id and m.state='active' and not s.archived and not s.hidden),'[]'::jsonb),
 'servers',coalesce((select jsonb_agg(vista_studios_private.server_card(s) order by s.nombre) from public.network_servers s where s.developer_user_id=p_user_id and s.developer_status='accepted' and s.estado='aprobado'),'[]'::jsonb));
end; $$;
create function public.vista_my_developer_requests() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión con tu GBA ID.'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('server_id',s.id,'nombre',s.nombre) order by s.nombre) from public.network_servers s where s.developer_user_id=auth.uid() and s.developer_status='pending'),'[]'::jsonb);
end; $$;
create function public.vista_respond_developer(p_server_id uuid,p_accept boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión con tu GBA ID.'; end if;
 update public.network_servers set developer_status=case when p_accept then 'accepted' else 'declined' end,updated_at=now()
 where id=p_server_id and developer_user_id=auth.uid() and developer_status='pending';
 if not found then raise exception 'Atribución no disponible.'; end if;
end; $$;
create function public.vista_admin_studios() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.vista_is_platform_admin() then raise exception 'Solo Mothership puede moderar estudios.'; end if;
 return coalesce((select jsonb_agg(to_jsonb(s)-'portfolio'-'ranks'||jsonb_build_object('owner_handle',u.nombre) order by s.created_at desc) from public.development_studios s join public.usuarios u on u.id=s.owner_id),'[]'::jsonb);
end; $$;
create function public.vista_review_studio(p_id uuid,p_hidden boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.vista_is_platform_admin() then raise exception 'Solo Mothership puede moderar estudios.'; end if;
 update public.development_studios set hidden=coalesce(p_hidden,true),updated_at=now() where id=p_id;
 if not found then raise exception 'Estudio no encontrado.'; end if;
end; $$;

create or replace function public.vista_save_network_server(p_server_id uuid,p_data jsonb)
returns public.network_servers language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid:=coalesce(p_server_id,gen_random_uuid()); v_result public.network_servers; v_url text; v_access text:=coalesce(p_data->>'access_type','direct'); v_studio uuid:=nullif(p_data->>'developer_studio_id','')::uuid; v_user uuid; v_status text:='none'; v_old public.network_servers;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_server_id is not null then select * into v_old from public.network_servers where id=p_server_id for update; if not found then raise exception 'Server not found'; end if; else perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,417)); end if;
  if p_server_id is not null and not public.vista_network_can_manage(p_server_id) then raise exception 'Server manager access required'; end if;
  if p_server_id is null and (select count(*) from public.network_servers where owner_id=auth.uid())>=10 then raise exception 'Pilot limit: 10 servers per GBA ID'; end if;
  foreach v_url in array array[p_data->>'discord_url',p_data->>'website_url',p_data->>'map_url',p_data->>'logo_url',p_data->>'portada_url',p_data->>'access_url',p_data->>'support_url'] loop
    if coalesce(trim(v_url),'')<>'' and (v_url !~ '^https://[^[:space:]]+$' or char_length(v_url)>2000) then raise exception 'Links must be valid HTTPS URLs'; end if;
  end loop;
  if char_length(trim(coalesce(p_data->>'nombre',''))) not between 2 and 80 then raise exception 'Server name must contain 2 to 80 characters'; end if;
  if char_length(trim(coalesce(p_data->>'descripcion',''))) not between 20 and 1600 then raise exception 'Description must contain 20 to 1600 characters'; end if;
  if v_access not in('direct','modpack','invitation') then raise exception 'Selecciona un método de acceso.'; end if;
  perform vista_studios_private.check_url(p_data->>'access_url');
  perform vista_studios_private.check_url(p_data->>'support_url');
  if v_access='direct' and trim(coalesce(p_data->>'ip',''))='' then raise exception 'Añade la dirección IP del servidor.'; end if;
  if v_access='direct' and p_data->>'ip' !~ '^[a-zA-Z0-9._:-]+$' then raise exception 'Escribe una dirección IP, no instrucciones ni un enlace.'; end if;
  if v_access in('modpack','invitation') and trim(coalesce(p_data->>'access_url',''))='' then raise exception 'Añade el enlace al modpack o a la invitación.'; end if;
  if v_studio is not null and coalesce(p_data->>'developer_handle','')<>'' then raise exception 'Elige una persona o un estudio.'; end if;
  if v_studio is not null then
    if coalesce(v_old.developer_studio_id,'00000000-0000-0000-0000-000000000000')<>v_studio or v_old.developer_status<>'accepted' then
      perform 1 from public.development_studios where id=v_studio for update;
      if coalesce(vista_studios_private.role_for(v_studio),'') not in('owner','admin') then raise exception 'Solo puedes atribuir un estudio que administras.'; end if;
    end if;
    v_status:='accepted';
  elsif trim(coalesce(p_data->>'developer_handle',''))<>'' then
    select id into v_user from public.usuarios where lower(nombre)=lower(trim(leading '@' from trim(p_data->>'developer_handle')));
    if v_user is null then raise exception 'No existe ese GBA ID de desarrollador.'; end if;
    v_status:=case when v_user=auth.uid() then 'accepted' when v_old.developer_user_id=v_user then v_old.developer_status else 'pending' end;
  end if;
  insert into public.network_servers(id,owner_id,slug,nombre,headline,descripcion,ip,discord_url,website_url,map_url,logo_url,portada_url,idioma,edition,version,estilo,region,game_status,access_type,access_url,access_instructions,support_url,developer_studio_id,developer_user_id,developer_status)
  values(v_id,auth.uid(),public.vista_editorial_slugify(trim(p_data->>'nombre'))||'-'||left(v_id::text,8),trim(p_data->>'nombre'),trim(coalesce(p_data->>'headline','')),trim(p_data->>'descripcion'),trim(coalesce(p_data->>'ip','')),trim(coalesce(p_data->>'discord_url','')),trim(coalesce(p_data->>'website_url','')),trim(coalesce(p_data->>'map_url','')),trim(coalesce(p_data->>'logo_url','')),trim(coalesce(p_data->>'portada_url','')),trim(coalesce(p_data->>'idioma','Español')),coalesce(p_data->>'edition','java'),trim(coalesce(p_data->>'version','')),coalesce(p_data->>'estilo','Geopolítico'),trim(coalesce(p_data->>'region','')),coalesce(p_data->>'game_status','activo'),v_access,trim(coalesce(p_data->>'access_url','')),trim(coalesce(p_data->>'access_instructions','')),trim(coalesce(p_data->>'support_url','')),v_studio,v_user,v_status)
  on conflict(id) do update set
    nombre=excluded.nombre,headline=excluded.headline,descripcion=excluded.descripcion,ip=excluded.ip,
    discord_url=excluded.discord_url,website_url=excluded.website_url,map_url=excluded.map_url,logo_url=excluded.logo_url,portada_url=excluded.portada_url,
    idioma=excluded.idioma,edition=excluded.edition,version=excluded.version,estilo=excluded.estilo,region=excluded.region,game_status=excluded.game_status,
    access_type=excluded.access_type,access_url=excluded.access_url,access_instructions=excluded.access_instructions,support_url=excluded.support_url,developer_studio_id=excluded.developer_studio_id,developer_user_id=excluded.developer_user_id,developer_status=excluded.developer_status,
    estado=case when public.vista_is_platform_admin() or network_servers.estado='suspendido' then network_servers.estado else 'pendiente' end,
    review_notes=case when public.vista_is_platform_admin() or network_servers.estado='suspendido' then network_servers.review_notes else '' end,updated_at=now()
  returning * into v_result;
  if p_server_id is null then insert into public.network_server_members values(v_id,auth.uid(),'owner'); end if;
  if v_status='pending' and v_old.developer_user_id is distinct from v_user then
    insert into public.notificaciones(usuario_id,actor_id,tipo,titulo,mensaje,action_url) values(v_user,auth.uid(),'sistema','Confirma tu participación',v_result.nombre||' quiere reconocerte como desarrollador.','/?workspace=studios');
  end if;
  return v_result;
end;
$$;
create or replace function public.vista_my_network_servers()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('developer_handle',u.nombre) order by s.created_at desc)
    from public.network_servers s left join public.usuarios u on u.id=s.developer_user_id where exists(select 1 from public.network_server_members m where m.server_id=s.id and m.user_id=auth.uid())),'[]'::jsonb);
end;
$$;
create or replace function public.vista_network_directory()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return jsonb_build_object(
    'servers',coalesce((select jsonb_agg(vista_studios_private.server_card(s) order by s.nombre)
      from public.network_servers s where s.estado='aprobado'),'[]'::jsonb),
    'partners',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'server_id',p.server_id,'placement',p.placement,'starts_at',p.starts_at,'ends_at',p.ends_at,
      'hero_title',p.hero_title,'hero_description',p.hero_description,'hero_image_url',p.hero_image_url
    ) order by p.created_at,p.id)
    from public.network_partner_agreements p join public.network_servers s on s.id=p.server_id
    where s.estado='aprobado' and p.state='active' and p.payment_confirmed and p.starts_at<=now() and p.ends_at>now()),'[]'::jsonb)
  );
end;
$$;
create or replace function public.vista_network_report(p_server_id uuid,p_start timestamptz,p_end timestamptz,p_partner_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not public.vista_network_can_manage(p_server_id) then raise exception 'Server manager access required'; end if;
  if p_start is null or p_end is null or p_end<=p_start then raise exception 'Invalid reporting period'; end if;
  return (select jsonb_build_object('people',count(distinct user_id),'hero_views',count(*) filter(where event='hero_view'),'directory_views',count(*) filter(where event='directory_view'),'profile_views',count(*) filter(where event='profile_view'),'copy_ip',count(*) filter(where event='copy_ip'),'discord_click',count(*) filter(where event='discord_click'),'website_click',count(*) filter(where event='website_click'),'map_click',count(*) filter(where event='map_click'),'access_click',count(*) filter(where event='access_click'),'support_click',count(*) filter(where event='support_click'))
    from public.network_server_events where server_id=p_server_id and created_at>=p_start and created_at<p_end and (p_partner_id is null or partner_id=p_partner_id));
end;
$$;
alter table public.network_server_events drop constraint network_server_events_event_check;
 alter table public.network_server_events add constraint network_server_events_event_check check(event in('hero_view','directory_view','profile_view','copy_ip','discord_click','website_click','map_click','access_click','support_click'));
 revoke all on all functions in schema vista_studios_private from public,anon,authenticated;
revoke all on function public.vista_studios_workspace() from public,anon;
grant execute on function public.vista_studios_workspace() to authenticated;
revoke all on function public.vista_save_development_studio(uuid,jsonb) from public,anon;
grant execute on function public.vista_save_development_studio(uuid,jsonb) to authenticated;
revoke all on function public.vista_studio_team(uuid) from public,anon;
grant execute on function public.vista_studio_team(uuid) to authenticated;
revoke all on function public.vista_studio_member(uuid,text,text,text,text) from public,anon;
grant execute on function public.vista_studio_member(uuid,text,text,text,text) to authenticated;
revoke all on function public.vista_studio_respond(uuid,boolean) from public,anon;
grant execute on function public.vista_studio_respond(uuid,boolean) to authenticated;
revoke all on function public.vista_studio_transfer(uuid,uuid) from public,anon;
grant execute on function public.vista_studio_transfer(uuid,uuid) to authenticated;
revoke all on function public.vista_development_studio(text) from public,anon;
grant execute on function public.vista_development_studio(text) to authenticated;
revoke all on function public.vista_studio_directory() from public,anon;
grant execute on function public.vista_studio_directory() to authenticated;
revoke all on function public.vista_profile_studios(uuid) from public,anon;
grant execute on function public.vista_profile_studios(uuid) to authenticated;
revoke all on function public.vista_my_developer_requests() from public,anon;
grant execute on function public.vista_my_developer_requests() to authenticated;
revoke all on function public.vista_respond_developer(uuid,boolean) from public,anon;
grant execute on function public.vista_respond_developer(uuid,boolean) to authenticated;
revoke all on function public.vista_admin_studios() from public,anon;
grant execute on function public.vista_admin_studios() to authenticated;
revoke all on function public.vista_review_studio(uuid,boolean) from public,anon;
grant execute on function public.vista_review_studio(uuid,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
