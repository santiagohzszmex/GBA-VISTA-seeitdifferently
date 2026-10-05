-- Explicit opt-in for the paid Home slot; existing agreements retain their placements.
alter table public.network_partner_agreements add column home_enabled boolean not null default false;
alter table public.network_partner_agreements add column hero_video_url text not null default '';
alter table public.network_partner_agreements add constraint network_partner_home_placement check (not home_enabled or placement in('hero','both'));
create or replace function public.vista_save_network_partner(p_partner_id uuid,p_server_id uuid,p_data jsonb)
returns public.network_partner_agreements language plpgsql security definer set search_path=public,pg_temp as $$
declare v_result public.network_partner_agreements; v_start timestamptz:=(p_data->>'starts_at')::timestamptz; v_end timestamptz:=(p_data->>'ends_at')::timestamptz; v_placement text:=p_data->>'placement';
begin
  if auth.uid() is null or not public.vista_is_platform_admin() then raise exception 'Platform admin access required'; end if;
  if p_partner_id is not null and not exists(select 1 from public.network_partner_agreements where id=p_partner_id and server_id=p_server_id) then raise exception 'Partner agreement not found'; end if;
  if p_data->>'state'='active' then
    -- Serialize slot allocation so concurrent approvals cannot oversell heroes.
    perform pg_advisory_xact_lock(731921);
    if not exists(select 1 from public.network_servers where id=p_server_id and estado='aprobado') then raise exception 'Approve the server before activating a Partner'; end if;
    if v_placement in('hero','both') and (select count(*) from public.network_partner_agreements where state='active' and payment_confirmed and placement in('hero','both') and id<>coalesce(p_partner_id,'00000000-0000-0000-0000-000000000000'::uuid) and starts_at<v_end and ends_at>v_start)>=3 then raise exception 'The pilot has three hero slots for overlapping periods'; end if;
  end if;
  if coalesce(p_data->>'hero_image_url','')<>'' and (p_data->>'hero_image_url' !~ '^https://[^[:space:]]+$' or char_length(p_data->>'hero_image_url')>2000) then raise exception 'Hero image must use HTTPS'; end if;
  if coalesce((p_data->>'home_enabled')::boolean,false) and v_placement not in('hero','both') then raise exception 'Home requires a hero placement'; end if;
  if coalesce(p_data->>'hero_video_url','')<>'' and (p_data->>'hero_video_url' !~ '^https://[^[:space:]]+$' or char_length(p_data->>'hero_video_url')>2000) then raise exception 'Hero video must use HTTPS'; end if;
  insert into public.network_partner_agreements(id,server_id,placement,state,starts_at,ends_at,amount,currency,payment_confirmed,deliverables,hero_title,hero_description,hero_image_url,home_enabled,hero_video_url,created_by)
  values(coalesce(p_partner_id,gen_random_uuid()),p_server_id,v_placement,coalesce(p_data->>'state','draft'),v_start,v_end,coalesce((p_data->>'amount')::numeric,0),coalesce(p_data->>'currency','USD'),coalesce((p_data->>'payment_confirmed')::boolean,false),trim(coalesce(p_data->>'deliverables','')),trim(coalesce(p_data->>'hero_title','')),trim(coalesce(p_data->>'hero_description','')),trim(coalesce(p_data->>'hero_image_url','')),coalesce((p_data->>'home_enabled')::boolean,false),trim(coalesce(p_data->>'hero_video_url','')),auth.uid())
  on conflict(id) do update set placement=excluded.placement,state=excluded.state,starts_at=excluded.starts_at,ends_at=excluded.ends_at,amount=excluded.amount,currency=excluded.currency,payment_confirmed=excluded.payment_confirmed,deliverables=excluded.deliverables,hero_title=excluded.hero_title,hero_description=excluded.hero_description,hero_image_url=excluded.hero_image_url,home_enabled=excluded.home_enabled,hero_video_url=excluded.hero_video_url,updated_at=now()
  returning * into v_result;
  return v_result;
end;
$$;


-- Only aggregate intentional visits, never advertising impressions. One GBA ID
-- counts once per item, across its history, for every medium in the same ranking.
create or replace function public.vista_home_discovery()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return jsonb_build_object(
    'partners',coalesce((select jsonb_agg(jsonb_build_object(
      'server',vista_studios_private.server_card(s),
      'partner',jsonb_build_object('id',p.id,'hero_title',p.hero_title,'hero_description',p.hero_description,'hero_image_url',p.hero_image_url,'hero_video_url',p.hero_video_url)
    ) order by p.created_at,p.id) from public.network_partner_agreements p
    join public.network_servers s on s.id=p.server_id
    where s.estado='aprobado' and p.home_enabled and p.placement in('hero','both')
      and p.state='active' and p.payment_confirmed and p.starts_at<=now() and p.ends_at>now()),'[]'::jsonb),
    'ranking',coalesce((with content_reach as (
      select v.contenido_id,count(distinct v.usuario_id) as reach from public.vistas_usuario v group by v.contenido_id
    ), server_reach as (
      select e.server_id,count(distinct e.user_id) as reach from public.network_server_events e
      where e.event='profile_view' group by e.server_id
    ), ranked as (
      select c.id,case when c.categoria in('Periódico','PERIÓDICO','Periodico','PERIODICO','Noticia','NOTICIA') then 'newspaper' else 'video' end as kind,
        r.reach,c.created_at,to_jsonb(c) as item
      from public.contenido c join content_reach r on r.contenido_id=c.id
      where c.estado_publicacion='aprobado' and (c.publicar_at is null or c.publicar_at<=now())
        and c.categoria in('Periódico','PERIÓDICO','Periodico','PERIODICO','Noticia','NOTICIA',
          'General','GENERAL','Tutorial','TUTORIAL','Guía','GUÍA','Guia','GUIA','Gameplay','GAMEPLAY','Evento','EVENTO','Entrevista','ENTREVISTA','Actualidad','ACTUALIDAD','Documental','DOCUMENTAL','Película','PELÍCULA','Pelicula','PELICULA','Serie','SERIE','Original','ORIGINAL','Video','VIDEO')
      union all
      select s.id,'server',r.reach,s.created_at,vista_studios_private.server_card(s)
      from public.network_servers s join server_reach r on r.server_id=s.id where s.estado='aprobado'
    ), top_items as (
      select * from ranked where reach>0 order by reach desc,created_at desc,id,kind limit 10
    ) select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'reach',reach,'item',item) order by reach desc,created_at desc,id,kind) from top_items),'[]'::jsonb)
  );
end;
$$;
revoke all on function public.vista_home_discovery() from public,anon,authenticated;
grant execute on function public.vista_home_discovery() to authenticated;
