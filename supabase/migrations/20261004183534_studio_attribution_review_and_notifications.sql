begin;

-- Acknowledge invitations and expose attribution details only to Mothership.
create or replace function public.vista_studio_member(p_id uuid,p_handle text,p_role text,p_rank text,p_action text) returns void language plpgsql security definer set search_path='' as $$
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
  insert into public.notificaciones(usuario_id,actor_id,tipo,titulo,mensaje,action_url,target_type,target_id) values(v_user,auth.uid(),'invitacion_estudio','Invitación a un estudio',v_name||' te invita a formar parte de su equipo.','/?workspace=studios','studio',p_id);
 end if;
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
    insert into public.notificaciones(usuario_id,actor_id,tipo,titulo,mensaje,action_url,target_type,target_id) values(v_user,auth.uid(),'desarrollo_pendiente','Confirma tu participación',v_result.nombre||' quiere reconocerte como desarrollador.','/?workspace=studios','server',v_id);
  end if;
  return v_result;
end;
$$;

create or replace function public.vista_studio_respond(p_id uuid,p_accept boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión con tu GBA ID.'; end if;
 perform 1 from public.development_studios where id=p_id and not archived for update;
 if not found then raise exception 'Estudio no disponible.'; end if;
 update public.development_studio_members set state=case when p_accept then 'active' else 'declined' end,updated_at=now() where studio_id=p_id and user_id=auth.uid() and state='invited';
 if not found then raise exception 'Invitación no disponible.'; end if;
 update public.notificaciones set leida=true where usuario_id=auth.uid() and tipo='invitacion_estudio' and target_id=p_id;
end; $$;

create or replace function public.vista_respond_developer(p_server_id uuid,p_accept boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión con tu GBA ID.'; end if;
 update public.network_servers set developer_status=case when p_accept then 'accepted' else 'declined' end,updated_at=now()
 where id=p_server_id and developer_user_id=auth.uid() and developer_status='pending';
 if not found then raise exception 'Atribución no disponible.'; end if;
 update public.notificaciones set leida=true where usuario_id=auth.uid() and tipo='desarrollo_pendiente' and target_id=p_server_id;
end; $$;

create or replace function public.vista_admin_network()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or not public.vista_is_platform_admin() then raise exception 'Platform admin access required'; end if;
  return jsonb_build_object(
    'servers',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('owner_handle',u.nombre,'developer_handle',du.nombre,'developer_studio_name',ds.nombre) order by s.created_at desc) from public.network_servers s join public.usuarios u on u.id=s.owner_id left join public.usuarios du on du.id=s.developer_user_id left join public.development_studios ds on ds.id=s.developer_studio_id),'[]'::jsonb),
    'partners',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from public.network_partner_agreements p),'[]'::jsonb)
  );
end;
$$;
notify pgrst,'reload schema';
commit;
