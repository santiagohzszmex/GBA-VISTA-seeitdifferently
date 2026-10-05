-- Existing fichas keep their unclassified shared access until the owner specifies it.
alter table public.network_servers
  add column account_access text not null default 'unspecified' check(account_access in('unspecified','premium','non_premium','both_shared','both_separate')),
  add column ip_non_premium text not null default '' check(char_length(ip_non_premium)<=160),
  add column access_url_non_premium text not null default '' check(char_length(access_url_non_premium)<=2000);

create or replace function public.vista_save_network_server(p_server_id uuid,p_data jsonb)
returns public.network_servers language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid:=coalesce(p_server_id,gen_random_uuid()); v_result public.network_servers; v_url text; v_access text:=coalesce(p_data->>'access_type','direct'); v_studio uuid:=nullif(p_data->>'developer_studio_id','')::uuid; v_user uuid; v_status text:='none'; v_old public.network_servers; v_accounts text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_server_id is not null then select * into v_old from public.network_servers where id=p_server_id for update; if not found then raise exception 'Server not found'; end if; else perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,417)); end if;
  if p_server_id is not null and not public.vista_network_can_manage(p_server_id) then raise exception 'Server manager access required'; end if;
  if p_server_id is null and (select count(*) from public.network_servers where owner_id=auth.uid())>=10 then raise exception 'Pilot limit: 10 servers per GBA ID'; end if;
  v_accounts:=coalesce(p_data->>'account_access',v_old.account_access,'unspecified');
  if v_accounts not in('unspecified','premium','non_premium','both_shared','both_separate') then raise exception 'Selecciona el tipo de cuenta admitida.'; end if;
  if v_access='invitation' then v_accounts:='unspecified'; end if;
  p_data:=p_data||jsonb_build_object(
    'ip',case when v_access='direct' then trim(coalesce(p_data->>'ip','')) else '' end,
    'ip_non_premium',case when v_access='direct' and v_accounts='both_separate' then trim(coalesce(p_data->>'ip_non_premium',v_old.ip_non_premium,'')) else '' end,
    'access_url',case when v_access<>'direct' then trim(coalesce(p_data->>'access_url','')) else '' end,
    'access_url_non_premium',case when v_access='modpack' and v_accounts='both_separate' then trim(coalesce(p_data->>'access_url_non_premium',v_old.access_url_non_premium,'')) else '' end
  );
  if v_accounts='both_separate' and v_access='direct' and (p_data->>'ip_non_premium' !~ '^[a-zA-Z0-9._:-]+$' or char_length(p_data->>'ip_non_premium') not between 1 and 160) then raise exception 'Añade una dirección IP válida para no premium.'; end if;
  if v_accounts='both_separate' and v_access='modpack' and p_data->>'access_url_non_premium'='' then raise exception 'Añade el enlace al modpack para no premium.'; end if;
  perform vista_studios_private.check_url(p_data->>'access_url_non_premium');
  foreach v_url in array array[p_data->>'discord_url',p_data->>'website_url',p_data->>'map_url',p_data->>'logo_url',p_data->>'portada_url',p_data->>'access_url',p_data->>'access_url_non_premium',p_data->>'support_url'] loop
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
  insert into public.network_servers(id,owner_id,slug,nombre,headline,descripcion,ip,discord_url,website_url,map_url,logo_url,portada_url,idioma,edition,version,estilo,region,game_status,access_type,access_url,access_instructions,support_url,developer_studio_id,developer_user_id,developer_status,account_access,ip_non_premium,access_url_non_premium)
  values(v_id,auth.uid(),public.vista_editorial_slugify(trim(p_data->>'nombre'))||'-'||left(v_id::text,8),trim(p_data->>'nombre'),trim(coalesce(p_data->>'headline','')),trim(p_data->>'descripcion'),trim(coalesce(p_data->>'ip','')),trim(coalesce(p_data->>'discord_url','')),trim(coalesce(p_data->>'website_url','')),trim(coalesce(p_data->>'map_url','')),trim(coalesce(p_data->>'logo_url','')),trim(coalesce(p_data->>'portada_url','')),trim(coalesce(p_data->>'idioma','Español')),coalesce(p_data->>'edition','java'),trim(coalesce(p_data->>'version','')),coalesce(p_data->>'estilo','Geopolítico'),trim(coalesce(p_data->>'region','')),coalesce(p_data->>'game_status','activo'),v_access,trim(coalesce(p_data->>'access_url','')),trim(coalesce(p_data->>'access_instructions','')),trim(coalesce(p_data->>'support_url','')),v_studio,v_user,v_status,v_accounts,p_data->>'ip_non_premium',p_data->>'access_url_non_premium')
  on conflict(id) do update set
    nombre=excluded.nombre,headline=excluded.headline,descripcion=excluded.descripcion,ip=excluded.ip,
    discord_url=excluded.discord_url,website_url=excluded.website_url,map_url=excluded.map_url,logo_url=excluded.logo_url,portada_url=excluded.portada_url,
    idioma=excluded.idioma,edition=excluded.edition,version=excluded.version,estilo=excluded.estilo,region=excluded.region,game_status=excluded.game_status,
    account_access=excluded.account_access,ip_non_premium=excluded.ip_non_premium,access_url_non_premium=excluded.access_url_non_premium,access_type=excluded.access_type,access_url=excluded.access_url,access_instructions=excluded.access_instructions,support_url=excluded.support_url,developer_studio_id=excluded.developer_studio_id,developer_user_id=excluded.developer_user_id,developer_status=excluded.developer_status,
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

revoke all on function public.vista_save_network_server(uuid,jsonb) from public,anon;
grant execute on function public.vista_save_network_server(uuid,jsonb) to authenticated;
notify pgrst, 'reload schema';
