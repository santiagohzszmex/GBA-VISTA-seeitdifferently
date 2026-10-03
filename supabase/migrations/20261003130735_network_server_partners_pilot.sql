begin;

-- Authenticated pilot: free server listings and paid, time-bound GBA Partners.
-- Existing business profiles and newspaper archives are retained.
create table public.network_servers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.usuarios(id),
  slug text not null unique,
  nombre text not null check (char_length(nombre) between 2 and 80),
  headline text not null default '' check (char_length(headline) <= 160),
  descripcion text not null check (char_length(descripcion) between 20 and 1600),
  ip text not null default '' check (char_length(ip) <= 160),
  discord_url text not null default '',
  website_url text not null default '',
  map_url text not null default '',
  logo_url text not null default '',
  portada_url text not null default '',
  idioma text not null default 'Español' check (char_length(idioma) between 1 and 60),
  edition text not null default 'java' check (edition in ('java','bedrock','crossplay')),
  version text not null default '' check (char_length(version) <= 60),
  estilo text not null default 'Geopolítico' check (estilo in ('Geopolítico','Towny','Naciones','Roleplay')),
  region text not null default '' check (char_length(region) <= 80),
  game_status text not null default 'activo' check (game_status in ('activo','proximamente','mantenimiento')),
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobado','rechazado','suspendido')),
  verificada boolean not null default false,
  review_notes text not null default '',
  partner_interest text check (partner_interest in ('directory','hero','both')),
  partner_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.network_server_members (
  server_id uuid not null references public.network_servers(id) on delete cascade,
  user_id uuid not null references public.usuarios(id),
  role text not null check (role in ('owner','admin')),
  primary key(server_id,user_id)
);
create unique index network_server_one_owner on public.network_server_members(server_id) where role='owner';
create index network_server_member_user on public.network_server_members(user_id,server_id);
create index network_servers_directory on public.network_servers(estado,nombre);
create index network_servers_owner on public.network_servers(owner_id);

create table public.network_partner_agreements (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.network_servers(id),
  placement text not null check (placement in ('directory','hero','both')),
  state text not null default 'draft' check (state in ('draft','active','paused','ended')),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  amount numeric(12,2) not null default 0 check (amount>=0),
  currency text not null default 'USD' check (currency in ('USD','MXN','EUR')),
  payment_confirmed boolean not null default false,
  deliverables text not null default '' check (char_length(deliverables)<=2000),
  hero_title text not null default '' check (char_length(hero_title)<=100),
  hero_description text not null default '' check (char_length(hero_description)<=300),
  hero_image_url text not null default '',
  created_by uuid not null references public.usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (state<>'active' or (payment_confirmed and amount>0 and char_length(trim(deliverables))>=10))
);
create index network_partners_active on public.network_partner_agreements(state,starts_at,ends_at);
create index network_partners_server on public.network_partner_agreements(server_id);
create index network_partners_creator on public.network_partner_agreements(created_by);

create table public.network_server_events (
  id bigint generated always as identity primary key,
  server_id uuid not null references public.network_servers(id),
  user_id uuid not null references public.usuarios(id),
  partner_id uuid references public.network_partner_agreements(id),
  event text not null check (event in ('hero_view','directory_view','profile_view','copy_ip','discord_click','website_click','map_click')),
  source text not null check(source in ('hero','directory','profile')),
  event_day date not null default (now() at time zone 'UTC')::date,
  created_at timestamptz not null default now(),
  unique(server_id,user_id,event,source,event_day)
);
create index network_events_report on public.network_server_events(server_id,created_at,event);
create index network_events_partner on public.network_server_events(partner_id,created_at);
create index network_events_user on public.network_server_events(user_id);

alter table public.network_servers enable row level security;
alter table public.network_server_members enable row level security;
alter table public.network_partner_agreements enable row level security;
alter table public.network_server_events enable row level security;
revoke all on public.network_servers, public.network_server_members, public.network_partner_agreements, public.network_server_events from public,anon,authenticated;

-- Only scoped RPCs expose data. No direct client access to commercial amounts,
-- internal review notes, membership identifiers or individual audience events.
create or replace function public.vista_network_can_manage(p_server_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and (public.vista_is_platform_admin() or exists(
    select 1 from public.network_server_members where server_id=p_server_id and user_id=auth.uid()
  ));
$$;
revoke all on function public.vista_network_can_manage(uuid) from public,anon,authenticated;

create or replace function public.vista_network_directory()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return jsonb_build_object(
    'servers',coalesce((select jsonb_agg(to_jsonb(s)-'owner_id'-'review_notes'-'partner_interest'-'partner_requested_at' order by s.nombre)
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

create or replace function public.vista_my_network_servers()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc)
    from public.network_servers s where exists(select 1 from public.network_server_members m where m.server_id=s.id and m.user_id=auth.uid())),'[]'::jsonb);
end;
$$;

create or replace function public.vista_save_network_server(p_server_id uuid,p_data jsonb)
returns public.network_servers language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid:=coalesce(p_server_id,gen_random_uuid()); v_result public.network_servers; v_url text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_server_id is not null and not public.vista_network_can_manage(p_server_id) then raise exception 'Server manager access required'; end if;
  if p_server_id is null and (select count(*) from public.network_servers where owner_id=auth.uid())>=10 then raise exception 'Pilot limit: 10 servers per GBA ID'; end if;
  foreach v_url in array array[p_data->>'discord_url',p_data->>'website_url',p_data->>'map_url',p_data->>'logo_url',p_data->>'portada_url'] loop
    if coalesce(trim(v_url),'')<>'' and (v_url !~ '^https://[^[:space:]]+$' or char_length(v_url)>2000) then raise exception 'Links must be valid HTTPS URLs'; end if;
  end loop;
  if char_length(trim(coalesce(p_data->>'nombre',''))) not between 2 and 80 then raise exception 'Server name must contain 2 to 80 characters'; end if;
  if char_length(trim(coalesce(p_data->>'descripcion',''))) not between 20 and 1600 then raise exception 'Description must contain 20 to 1600 characters'; end if;
  if trim(coalesce(p_data->>'ip',''))='' and trim(coalesce(p_data->>'discord_url',''))='' then raise exception 'Add a server address or Discord link'; end if;
  insert into public.network_servers(id,owner_id,slug,nombre,headline,descripcion,ip,discord_url,website_url,map_url,logo_url,portada_url,idioma,edition,version,estilo,region,game_status)
  values(v_id,auth.uid(),public.vista_editorial_slugify(trim(p_data->>'nombre'))||'-'||left(v_id::text,8),trim(p_data->>'nombre'),trim(coalesce(p_data->>'headline','')),trim(p_data->>'descripcion'),trim(coalesce(p_data->>'ip','')),trim(coalesce(p_data->>'discord_url','')),trim(coalesce(p_data->>'website_url','')),trim(coalesce(p_data->>'map_url','')),trim(coalesce(p_data->>'logo_url','')),trim(coalesce(p_data->>'portada_url','')),trim(coalesce(p_data->>'idioma','Español')),coalesce(p_data->>'edition','java'),trim(coalesce(p_data->>'version','')),coalesce(p_data->>'estilo','Geopolítico'),trim(coalesce(p_data->>'region','')),coalesce(p_data->>'game_status','activo'))
  on conflict(id) do update set
    nombre=excluded.nombre,headline=excluded.headline,descripcion=excluded.descripcion,ip=excluded.ip,
    discord_url=excluded.discord_url,website_url=excluded.website_url,map_url=excluded.map_url,logo_url=excluded.logo_url,portada_url=excluded.portada_url,
    idioma=excluded.idioma,edition=excluded.edition,version=excluded.version,estilo=excluded.estilo,region=excluded.region,game_status=excluded.game_status,
    estado=case when public.vista_is_platform_admin() or network_servers.estado='suspendido' then network_servers.estado else 'pendiente' end,
    review_notes=case when public.vista_is_platform_admin() or network_servers.estado='suspendido' then network_servers.review_notes else '' end,updated_at=now()
  returning * into v_result;
  if p_server_id is null then insert into public.network_server_members values(v_id,auth.uid(),'owner'); end if;
  return v_result;
end;
$$;

create or replace function public.vista_request_network_partner(p_server_id uuid,p_placement text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.vista_network_can_manage(p_server_id) then raise exception 'Server manager access required'; end if;
  if p_placement not in ('directory','hero','both') or p_placement is null then raise exception 'Invalid placement'; end if;
  update public.network_servers set partner_interest=p_placement,partner_requested_at=now() where id=p_server_id;
end;
$$;

create or replace function public.vista_network_team(p_server_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not public.vista_network_can_manage(p_server_id) then raise exception 'Server manager access required'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'role',m.role,'handle',u.nombre) order by m.role desc,u.nombre)
    from public.network_server_members m join public.usuarios u on u.id=m.user_id where m.server_id=p_server_id),'[]'::jsonb);
end;
$$;

create or replace function public.vista_manage_network_member(p_server_id uuid,p_handle text,p_remove boolean default false)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid;
begin
  if auth.uid() is null or not(public.vista_is_platform_admin() or exists(select 1 from public.network_server_members where server_id=p_server_id and user_id=auth.uid() and role='owner')) then raise exception 'Server owner access required'; end if;
  select id into v_user from public.usuarios where lower(nombre)=lower(trim(leading '@' from trim(p_handle)));
  if v_user is null then raise exception 'GBA ID not found'; end if;
  if exists(select 1 from public.network_server_members where server_id=p_server_id and user_id=v_user and role='owner') then raise exception 'The server owner cannot be changed here'; end if;
  if p_remove then delete from public.network_server_members where server_id=p_server_id and user_id=v_user and role='admin';
  else insert into public.network_server_members values(p_server_id,v_user,'admin') on conflict(server_id,user_id) do nothing; end if;
end;
$$;

create or replace function public.vista_admin_network()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or not public.vista_is_platform_admin() then raise exception 'Platform admin access required'; end if;
  return jsonb_build_object(
    'servers',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('owner_handle',u.nombre) order by s.created_at desc) from public.network_servers s join public.usuarios u on u.id=s.owner_id),'[]'::jsonb),
    'partners',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from public.network_partner_agreements p),'[]'::jsonb)
  );
end;
$$;

create or replace function public.vista_review_network_server(p_server_id uuid,p_state text,p_verified boolean,p_notes text default '')
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or not public.vista_is_platform_admin() then raise exception 'Platform admin access required'; end if;
  if p_state not in('aprobado','rechazado','suspendido','pendiente') or p_state is null then raise exception 'Invalid review state'; end if;
  update public.network_servers set estado=p_state,verificada=coalesce(p_verified,false),review_notes=left(coalesce(p_notes,''),1000),updated_at=now() where id=p_server_id;
  if not found then raise exception 'Server not found'; end if;
end;
$$;

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
  insert into public.network_partner_agreements(id,server_id,placement,state,starts_at,ends_at,amount,currency,payment_confirmed,deliverables,hero_title,hero_description,hero_image_url,created_by)
  values(coalesce(p_partner_id,gen_random_uuid()),p_server_id,v_placement,coalesce(p_data->>'state','draft'),v_start,v_end,coalesce((p_data->>'amount')::numeric,0),coalesce(p_data->>'currency','USD'),coalesce((p_data->>'payment_confirmed')::boolean,false),trim(coalesce(p_data->>'deliverables','')),trim(coalesce(p_data->>'hero_title','')),trim(coalesce(p_data->>'hero_description','')),trim(coalesce(p_data->>'hero_image_url','')),auth.uid())
  on conflict(id) do update set placement=excluded.placement,state=excluded.state,starts_at=excluded.starts_at,ends_at=excluded.ends_at,amount=excluded.amount,currency=excluded.currency,payment_confirmed=excluded.payment_confirmed,deliverables=excluded.deliverables,hero_title=excluded.hero_title,hero_description=excluded.hero_description,hero_image_url=excluded.hero_image_url,updated_at=now()
  returning * into v_result;
  return v_result;
end;
$$;

create or replace function public.vista_track_network_event(p_server_id uuid,p_event text,p_source text,p_partner_id uuid default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.network_servers where id=p_server_id and estado='aprobado') then raise exception 'Approved server required'; end if;
  if p_partner_id is not null and not exists(select 1 from public.network_partner_agreements where id=p_partner_id and server_id=p_server_id and state='active' and payment_confirmed and starts_at<=now() and ends_at>now() and (p_source<>'hero' or placement in('hero','both'))) then raise exception 'Active Partner required'; end if;
  if p_source='hero' and p_partner_id is null then raise exception 'Hero events require an active Partner'; end if;
  if (p_event='hero_view' and p_source<>'hero') or (p_event='directory_view' and p_source<>'directory') or (p_event='profile_view' and p_source<>'profile') then raise exception 'Invalid event source'; end if;
  insert into public.network_server_events(server_id,user_id,partner_id,event,source) values(p_server_id,auth.uid(),p_partner_id,p_event,p_source) on conflict(server_id,user_id,event,source,event_day) do nothing;
end;
$$;

create or replace function public.vista_network_report(p_server_id uuid,p_start timestamptz,p_end timestamptz,p_partner_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not public.vista_network_can_manage(p_server_id) then raise exception 'Server manager access required'; end if;
  if p_start is null or p_end is null or p_end<=p_start then raise exception 'Invalid reporting period'; end if;
  return (select jsonb_build_object('people',count(distinct user_id),'hero_views',count(*) filter(where event='hero_view'),'directory_views',count(*) filter(where event='directory_view'),'profile_views',count(*) filter(where event='profile_view'),'copy_ip',count(*) filter(where event='copy_ip'),'discord_click',count(*) filter(where event='discord_click'),'website_click',count(*) filter(where event='website_click'),'map_click',count(*) filter(where event='map_click'))
    from public.network_server_events where server_id=p_server_id and created_at>=p_start and created_at<p_end and (p_partner_id is null or partner_id=p_partner_id));
end;
$$;

-- Every privileged entry point explicitly checks the GBA ID and its scope.
revoke all on function public.vista_network_directory(),public.vista_my_network_servers(),public.vista_save_network_server(uuid,jsonb),public.vista_request_network_partner(uuid,text),public.vista_network_team(uuid),public.vista_manage_network_member(uuid,text,boolean),public.vista_admin_network(),public.vista_review_network_server(uuid,text,boolean,text),public.vista_save_network_partner(uuid,uuid,jsonb),public.vista_track_network_event(uuid,text,text,uuid),public.vista_network_report(uuid,timestamptz,timestamptz,uuid) from public,anon;
grant execute on function public.vista_network_directory(),public.vista_my_network_servers(),public.vista_save_network_server(uuid,jsonb),public.vista_request_network_partner(uuid,text),public.vista_network_team(uuid),public.vista_manage_network_member(uuid,text,boolean),public.vista_admin_network(),public.vista_review_network_server(uuid,text,boolean,text),public.vista_save_network_partner(uuid,uuid,jsonb),public.vista_track_network_event(uuid,text,text,uuid),public.vista_network_report(uuid,timestamptz,timestamptz,uuid) to authenticated;

commit;
