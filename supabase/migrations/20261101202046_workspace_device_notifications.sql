-- Device subscriptions are private, session-bound capabilities, never directory data.
set lock_timeout='5s';
create table workspace_private.push_subscriptions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),
 session_id uuid not null references auth.sessions(id) on delete cascade,
 endpoint_hash bytea not null unique,subscription jsonb not null,label text not null,
 enabled_at timestamptz not null default now(),revoked_at timestamptz,last_success_at timestamptz,
 check(length(label) between 1 and 80),check(octet_length(subscription::text)<=4096)
);
create index push_subscriptions_session on workspace_private.push_subscriptions(session_id);
create index push_subscriptions_actor on workspace_private.push_subscriptions(user_id) where revoked_at is null;
create table workspace_private.push_jobs(
 id uuid primary key default gen_random_uuid(),subscription_id uuid not null references workspace_private.push_subscriptions(id) on delete cascade,
 notification_id uuid references workspace_private.notifications(id) on delete cascade,
 created_at timestamptz not null default now(),next_attempt_at timestamptz not null default now(),
 attempts integer not null default 0,lease uuid,leased_until timestamptz,finished_at timestamptz,status text not null default 'pending' check(status in('pending','sent','cancelled','failed')),
 unique(subscription_id,notification_id)
);
create index push_jobs_notice on workspace_private.push_jobs(notification_id);
create index push_jobs_ready on workspace_private.push_jobs(next_attempt_at) where status='pending';
create table workspace_private.push_settings(singleton boolean primary key default true check(singleton),secret_id uuid,gate_hash bytea);
insert into workspace_private.push_settings(singleton) values(true);
alter table workspace_private.push_subscriptions enable row level security;
alter table workspace_private.push_jobs enable row level security;
alter table workspace_private.push_settings enable row level security;
revoke all on workspace_private.push_subscriptions,workspace_private.push_jobs,workspace_private.push_settings from public,anon,authenticated;

-- Evaluate the original visibility chain using the enrolled, still-live session.
-- The actor always comes from protected database rows, never a client-supplied UUID.
create function workspace_private.push_allowed(s workspace_private.push_subscriptions,n workspace_private.notifications default null) returns boolean
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare previous text:=current_setting('request.jwt.claims',true);answer boolean;
begin
 if s.revoked_at is not null or not exists(select 1 from auth.sessions sess where sess.id=s.session_id and sess.user_id=s.user_id and ((to_jsonb(sess)->>'not_after') is null or (to_jsonb(sess)->>'not_after')::timestamptz>now())) then return false;end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',s.user_id,'session_id',s.session_id,'role','authenticated')::text,true);
 answer:=workspace_private.session_active() and exists(select 1 from public.workspace_units u where workspace_private.member(u.id));
 if n.id is not null then
  answer:=answer and n.recipient_id=s.user_id and n.read_at is null and n.created_at>=s.enabled_at and workspace_private.notification_visible(n);
  if n.event_type='deadline' and exists(select 1 from public.workspace_projects p where p.id=n.project_id and (p.deleted_at is not null or p.status in('closed','archived'))) then answer:=false;end if;
 end if;
 perform set_config('request.jwt.claims',coalesce(previous,''),true);return coalesce(answer,false);
exception when others then
 perform set_config('request.jwt.claims',coalesce(previous,''),true);raise;
end;$$;
revoke all on function workspace_private.push_allowed(workspace_private.push_subscriptions,workspace_private.notifications) from public,anon,authenticated,service_role;

create function public.workspace_push_preferences(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare s workspace_private.push_subscriptions;endpoint text;hash bytea;label text;sid uuid;result jsonb;
begin
 if not workspace_private.session_active() then raise exception 'Sesión no disponible' using errcode='42501';end if;
 if jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>5000 then raise exception 'Datos inválidos';end if;
 if p_action='status' then
  return jsonb_build_object('devices',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'label',x.label,'active',workspace_private.push_allowed(x),'last_success_at',x.last_success_at)) from workspace_private.push_subscriptions x where x.user_id=auth.uid() and x.revoked_at is null),'[]'));
 elsif p_action='disable' then
  update workspace_private.push_subscriptions set revoked_at=now() where id=(p_data->>'id')::uuid and user_id=auth.uid();
  update workspace_private.push_jobs j set status='cancelled',finished_at=now() from workspace_private.push_subscriptions x where x.id=j.subscription_id and x.user_id=auth.uid() and x.revoked_at is not null and j.status='pending';
  return jsonb_build_object('disabled',true);
 end if;
 if not exists(select 1 from public.workspace_units u where workspace_private.member(u.id)) then raise exception 'No tienes acceso activo a Workspace' using errcode='42501';end if;
 sid:=(auth.jwt()->>'session_id')::uuid;
 if p_action='register' then
  endpoint:=p_data->'subscription'->>'endpoint';label:=trim(coalesce(p_data->>'label','Navegador'));
  if length(label) not between 1 and 80 or label~'[[:cntrl:]]' or coalesce(length(endpoint),0) not between 30 and 2048
   or endpoint !~ '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)+push\.apple\.com|([a-z0-9-]+\.)?push\.services\.mozilla\.com|([a-z0-9-]+\.)?notify\.windows\.com)/[^[:space:]]+$'
   or coalesce(p_data->'subscription'->'keys'->>'p256dh','')!~'^[A-Za-z0-9_-]{87}=?$'
   or coalesce(p_data->'subscription'->'keys'->>'auth','')!~'^[A-Za-z0-9_-]{22}(==)?$' then raise exception 'Suscripción no válida';end if;
  hash:=sha256(convert_to(endpoint,'UTF8'));
  -- Serializes the user's subscription cap, including requests from two tabs.
  perform 1 from public.usuarios where id=auth.uid() for update;
  select * into s from workspace_private.push_subscriptions where endpoint_hash=hash for update;
  if s.id is not null and s.user_id<>auth.uid() then raise exception 'Vuelve a activar los avisos en este navegador' using errcode='23505';end if;
  if (s.id is null or s.revoked_at is not null) and (select count(*) from workspace_private.push_subscriptions where user_id=auth.uid() and revoked_at is null)>=8 then raise exception 'Retira un dispositivo anterior antes de añadir otro';end if;
  insert into workspace_private.push_subscriptions(user_id,session_id,endpoint_hash,subscription,label)
   values(auth.uid(),sid,hash,jsonb_build_object('endpoint',endpoint,'keys',jsonb_build_object('p256dh',p_data->'subscription'->'keys'->>'p256dh','auth',p_data->'subscription'->'keys'->>'auth')),label)
  on conflict(endpoint_hash) do update set session_id=excluded.session_id,subscription=excluded.subscription,label=excluded.label,enabled_at=now(),revoked_at=null returning * into s;
  return jsonb_build_object('id',s.id,'label',s.label,'active',true);
 elsif p_action='test' then
  select * into s from workspace_private.push_subscriptions where id=(p_data->>'id')::uuid and user_id=auth.uid() and session_id=sid and revoked_at is null for update;
  if s.id is null then raise exception 'Activa primero este navegador';end if;
  if exists(select 1 from workspace_private.push_jobs where subscription_id=s.id and notification_id is null and created_at>now()-interval '1 minute') then raise exception 'Espera un minuto antes de repetir la prueba';end if;
  insert into workspace_private.push_jobs(subscription_id) values(s.id);
  return jsonb_build_object('queued',true);
 end if;
 raise exception 'Acción no válida';
end;$$;
revoke all on function public.workspace_push_preferences(text,jsonb) from public,anon;
grant execute on function public.workspace_push_preferences(text,jsonb) to authenticated;

create function workspace_private.push_enqueue() returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $$begin
 if TG_OP='UPDATE' then
  if NEW.read_at is not null then update workspace_private.push_jobs set status='cancelled',finished_at=now() where notification_id=NEW.id and status='pending';end if;
 elsif NEW.read_at is null then
  insert into workspace_private.push_jobs(subscription_id,notification_id)
   select s.id,NEW.id from workspace_private.push_subscriptions s where s.user_id=NEW.recipient_id and s.revoked_at is null and s.enabled_at<=NEW.created_at
   on conflict(subscription_id,notification_id) do nothing;
 end if;return NEW;
end;$$;
revoke all on function workspace_private.push_enqueue() from public,anon,authenticated,service_role;
create trigger workspace_push_enqueue after insert or update of read_at on workspace_private.notifications for each row execute function workspace_private.push_enqueue();

create function workspace_private.push_gate(p_token text) returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$begin
 if p_token is null or length(p_token)<>64 or not exists(select 1 from workspace_private.push_settings where gate_hash=sha256(convert_to(p_token,'UTF8'))) then raise exception 'Acceso no disponible' using errcode='42501';end if;
end;$$;
revoke all on function workspace_private.push_gate(text) from public,anon,authenticated,service_role;

create function public.workspace_push_batch(p_token text,p_lease uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare j workspace_private.push_jobs;s workspace_private.push_subscriptions;n workspace_private.notifications;result jsonb:='[]';begin
 perform workspace_private.push_gate(p_token);
 for j in select * from workspace_private.push_jobs where status='pending' and next_attempt_at<=now() and (leased_until is null or leased_until<now()) order by next_attempt_at,id for update skip locked limit 12 loop
  select * into s from workspace_private.push_subscriptions where id=j.subscription_id;
  n:=null;if j.notification_id is not null then select * into n from workspace_private.notifications where id=j.notification_id;end if;
  if s.id is null or j.created_at<now()-interval '1 day' or j.attempts>=5 or (j.notification_id is not null and n.id is null) or not workspace_private.push_allowed(s,n) then
   update workspace_private.push_jobs set status='cancelled',finished_at=now() where id=j.id;continue;
  end if;
  update workspace_private.push_jobs set lease=p_lease,leased_until=now()+interval '2 minutes',attempts=attempts+1 where id=j.id;
  result:=result||jsonb_build_array(jsonb_build_object('id',j.id,'subscription',s.subscription,'owner',s.user_id,'notificationId',j.notification_id,'test',j.notification_id is null));
 end loop;return result;
end;$$;
create function public.workspace_push_result(p_token text,p_job uuid,p_lease uuid,p_status integer) returns void
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$declare j workspace_private.push_jobs;begin
 perform workspace_private.push_gate(p_token);
 select * into j from workspace_private.push_jobs where id=p_job and lease=p_lease and status='pending' for update;
 if j.id is null then return;end if;
 if p_status in(404,410) then
  update workspace_private.push_subscriptions set revoked_at=now() where id=j.subscription_id;
  update workspace_private.push_jobs set status='cancelled',finished_at=now() where subscription_id=j.subscription_id and status='pending';
 elsif p_status between 200 and 299 then
  update workspace_private.push_jobs set status='sent',finished_at=now(),lease=null,leased_until=null where id=j.id;
  update workspace_private.push_subscriptions set last_success_at=now() where id=j.subscription_id;
 else
  update workspace_private.push_jobs set status=case when attempts>=5 then 'failed' else 'pending' end,next_attempt_at=now()+interval '1 minute'*power(2,least(attempts,5)),lease=null,leased_until=null,finished_at=case when attempts>=5 then now() end where id=j.id;
 end if;
end;$$;
revoke all on function public.workspace_push_batch(text,uuid),public.workspace_push_result(text,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.workspace_push_batch(text,uuid),public.workspace_push_result(text,uuid,uuid,integer) to service_role;


alter function workspace_private.notification_visible(workspace_private.notifications) rename to notification_visible_before_device;
revoke all on function workspace_private.notification_visible_before_device(workspace_private.notifications) from public,anon,authenticated,service_role;
create function workspace_private.notification_visible(n workspace_private.notifications) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select case when n.event_type='deadline' and exists(select 1 from public.workspace_projects p where p.id=n.project_id and (p.deleted_at is not null or p.status in('closed','archived'))) then false else workspace_private.notification_visible_before_device(n) end;
$$;
revoke all on function workspace_private.notification_visible(workspace_private.notifications) from public,anon,authenticated,service_role;

-- Preserve every existing acknowledgement/route check and return one fresh snapshot.
alter function public.workspace_read_notification(uuid,timestamptz) rename to read_notification_before_device;
alter function public.read_notification_before_device(uuid,timestamptz) set schema workspace_private;
revoke all on function workspace_private.read_notification_before_device(uuid,timestamptz) from public,anon,authenticated,service_role;
create function public.workspace_read_notification(p_id uuid default null,p_before timestamptz default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$declare result jsonb;begin
 result:=workspace_private.read_notification_before_device(p_id,p_before);
 return result||jsonb_build_object('inbox',public.workspace_notifications());
end;$$;
revoke all on function public.workspace_read_notification(uuid,timestamptz) from public,anon;
grant execute on function public.workspace_read_notification(uuid,timestamptz) to authenticated;
reset lock_timeout;
notify pgrst,'reload schema';
