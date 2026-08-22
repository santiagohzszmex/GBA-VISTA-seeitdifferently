begin;

create table if not exists public.vista_user_activity_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null default ((now() at time zone 'UTC')::date),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  visits integer not null default 1 check (visits > 0),
  primary key (user_id, activity_date)
);

create index if not exists vista_user_activity_daily_date_idx
  on public.vista_user_activity_daily (activity_date desc, user_id);

alter table public.vista_user_activity_daily enable row level security;
revoke all on table public.vista_user_activity_daily from public, anon, authenticated;

create or replace function public.vista_record_user_activity()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'UTC')::date;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  insert into public.vista_user_activity_daily (
    user_id, activity_date, first_seen_at, last_seen_at, visits
  ) values (
    v_user_id, v_today, now(), now(), 1
  )
  on conflict (user_id, activity_date) do update
  set last_seen_at = excluded.last_seen_at,
      visits = public.vista_user_activity_daily.visits + 1;
end;
$$;

create or replace function public.vista_admin_audience_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'UTC')::date;
  v_total_accounts integer := 0;
  v_active_7d integer := 0;
  v_active_today integer := 0;
  v_tracking_since date;
  v_coverage_days integer := 0;
  v_daily jsonb := '[]'::jsonb;
begin
  if not exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and u.rol in ('Dueño', 'Admin')
  ) then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  select count(*)::integer into v_total_accounts
  from public.usuarios;

  select count(distinct a.user_id)::integer into v_active_7d
  from public.vista_user_activity_daily a
  where a.activity_date between v_today - 6 and v_today;

  select count(distinct a.user_id)::integer into v_active_today
  from public.vista_user_activity_daily a
  where a.activity_date = v_today;

  select min(a.activity_date) into v_tracking_since
  from public.vista_user_activity_daily a;

  if v_tracking_since is not null then
    v_coverage_days := least(7, (v_today - v_tracking_since) + 1);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('date', series.activity_date, 'active_users', series.active_users)
      order by series.activity_date
    ),
    '[]'::jsonb
  ) into v_daily
  from (
    select day::date as activity_date, count(distinct activity.user_id)::integer as active_users
    from generate_series(v_today - 6, v_today, interval '1 day') as day
    left join public.vista_user_activity_daily activity
      on activity.activity_date = day::date
    group by day::date
  ) series;

  return jsonb_build_object(
    'active_7d', v_active_7d,
    'active_today', v_active_today,
    'total_accounts', v_total_accounts,
    'activity_rate', case
      when v_total_accounts = 0 then 0
      else round((v_active_7d::numeric / v_total_accounts::numeric) * 100, 1)
    end,
    'coverage_days', v_coverage_days,
    'tracking_since', v_tracking_since,
    'daily', v_daily
  );
end;
$$;

revoke all on function public.vista_record_user_activity() from public, anon;
revoke all on function public.vista_admin_audience_metrics() from public, anon;
grant execute on function public.vista_record_user_activity() to authenticated;
grant execute on function public.vista_admin_audience_metrics() to authenticated;

commit;
