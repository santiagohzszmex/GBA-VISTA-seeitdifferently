begin;
create schema if not exists vista_survey_private;
revoke all on schema vista_survey_private from public;
grant usage on schema vista_survey_private to anon,authenticated;

create table public.vista_surveys (
  key text primary key,
  title text not null,
  version integer not null default 1,
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.vista_surveys(key,title) values('vista-partners','El siguiente capítulo de VISTA');
alter table public.vista_surveys enable row level security;
revoke all on public.vista_surveys from public,anon,authenticated;
grant select on public.vista_surveys to anon,authenticated;
create policy survey_public_definition on public.vista_surveys for select to anon,authenticated using(true);
grant update(is_open) on public.vista_surveys to authenticated;
create policy survey_admin_control on public.vista_surveys for update to authenticated using((select public.vista_is_platform_admin())) with check((select public.vista_is_platform_admin()));

create table public.vista_survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_key text not null references public.vista_surveys(key),
  version integer not null,
  user_id uuid references auth.users(id) on delete set null,
  visitor_hash text not null,
  answers jsonb not null check(jsonb_typeof(answers)='object' and octet_length(answers::text)<=16000),
  created_at timestamptz not null default now(),
  unique(survey_key,visitor_hash)
);
create unique index vista_survey_user_once on public.vista_survey_responses(survey_key,user_id) where user_id is not null;
create index vista_survey_response_date on public.vista_survey_responses(survey_key,created_at desc,id);
create index vista_survey_response_user on public.vista_survey_responses(user_id) where user_id is not null;
alter table public.vista_survey_responses enable row level security;
revoke all on public.vista_survey_responses from public,anon,authenticated;
grant select on public.vista_survey_responses to authenticated;
create policy survey_admin_results on public.vista_survey_responses for select to authenticated using((select public.vista_is_platform_admin()));

create table vista_survey_private.rate_windows (
  fingerprint text primary key,
  window_start timestamptz not null,
  attempts integer not null check(attempts>0)
);
alter table vista_survey_private.rate_windows enable row level security;
revoke all on vista_survey_private.rate_windows from public,anon,authenticated;

-- This intentionally anonymous, narrowly scoped writer is kept outside the
-- exposed REST schema. The public invoker wrapper cannot read response data.
create function vista_survey_private.submit(p_token text,p_answers jsonb,p_version integer,p_honeypot text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
  v_survey public.vista_surveys;
  v_hash text;
  v_key text;
  v_item text;
  v_array jsonb;
  v_allowed text[];
  v_admin boolean;
  v_attempts integer;
  v_headers jsonb;
  v_ip text;
  v_rows integer;
begin
  if coalesce(p_honeypot,'')<>'' then raise exception 'Invalid submission'; end if;
  if p_token is null or p_token !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then raise exception 'Invalid response token'; end if;
  select * into v_survey from public.vista_surveys where key='vista-partners' for share;
  if not found or not v_survey.is_open then raise exception 'Survey closed'; end if;
  if p_version is distinct from v_survey.version then raise exception 'Survey version changed'; end if;
  if p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>16000 then raise exception 'Invalid answers'; end if;
  if exists(select 1 from jsonb_object_keys(p_answers) k where k not in ('roles','roles_other','country','country_other','frequency','content','content_other','server_info','server_info_other','placements','goal','goal_other','budget_status','budget_amount','currency','currency_other','payment','payment_other','comment')) then raise exception 'Unknown question'; end if;
  v_admin:=coalesce(p_answers->'roles' @> '["admin"]'::jsonb,false);
  if not v_admin and p_answers ?| array['placements','goal','goal_other','budget_status','budget_amount','currency','currency_other','payment','payment_other'] then raise exception 'Commercial answers require administrator profile'; end if;
  foreach v_key in array array['roles','content','server_info','placements','payment'] loop
    if v_key in('placements','payment') and not v_admin then continue; end if;
    v_array:=p_answers->v_key;
    if v_array is null or jsonb_typeof(v_array)<>'array' then raise exception 'Missing choices: %',v_key; end if;
    if jsonb_array_length(v_array)<1 or jsonb_array_length(v_array)>(case when v_key in('content','server_info') then 3 else 7 end) then raise exception 'Invalid number of choices: %',v_key; end if;
    v_allowed:=case v_key when 'roles' then array['player','admin','creator','new','other'] when 'content' then array['news','tutorials','servers','events','stories','other'] when 'server_info' then array['players','rules','economy','map','schedule','reviews','join','other'] when 'placements' then array['free','directory','hero','campaign','unsure'] else array['card','transfer','mercadopago','paypal','cash','other','unsure'] end;
    if exists(select 1 from jsonb_array_elements(v_array) e where jsonb_typeof(e)<>'string') then raise exception 'Invalid choice type'; end if;
    if exists(select 1 from jsonb_array_elements_text(v_array) e where not e=any(v_allowed)) then raise exception 'Unknown choice: %',v_key; end if;
    if (select count(*)<>count(distinct e) from jsonb_array_elements_text(v_array) e) then raise exception 'Duplicate choices'; end if;
    if v_array @> '["other"]'::jsonb and length(trim(coalesce(p_answers->>(v_key||'_other'),'')))=0 then raise exception 'Specify other choice: %',v_key; end if;
  end loop;
  if jsonb_typeof(p_answers->'country') is distinct from 'string' or (p_answers->>'country') !~ '^([A-Z]{2}|none|other)$' then raise exception 'Invalid country'; end if;
  if p_answers->>'country' not in('none','other') and not (p_answers->>'country')=any(array['AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ','BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ','CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ','DE','DJ','DK','DM','DO','DZ','EC','EE','EG','EH','ER','ES','ET','FI','FJ','FK','FM','FO','FR','GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY','HK','HM','HN','HR','HT','HU','ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT','JE','JM','JO','JP','KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ','LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY','MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ','NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ','OM','PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY','QA','RE','RO','RS','RU','RW','SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ','TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ','UA','UG','UM','US','UY','UZ','VA','VC','VE','VG','VI','VN','VU','WF','WS','YE','YT','ZA','ZM','ZW']) then raise exception 'Unknown country'; end if;
  if p_answers->>'country'='other' and length(trim(coalesce(p_answers->>'country_other','')))=0 then raise exception 'Specify country'; end if;
  if coalesce(p_answers->>'frequency','') not in('first','rare','weekly','daily') then raise exception 'Invalid visit frequency'; end if;
  for v_key,v_item in select key,value #>> '{}' from jsonb_each(p_answers) where key in('roles_other','country_other','content_other','server_info_other','goal_other','payment_other','comment') loop
    if jsonb_typeof(p_answers->v_key)<>'string' or length(v_item)>(case when v_key='comment' then 2000 else 200 end) then raise exception 'Invalid text: %',v_key; end if;
  end loop;
  if v_admin then
    if coalesce(p_answers->>'goal','') not in('visibility','visits','players','launch','other') then raise exception 'Invalid promotion goal'; end if;
    if p_answers->>'goal'='other' and length(trim(coalesce(p_answers->>'goal_other','')))=0 then raise exception 'Specify goal'; end if;
    if coalesce(p_answers->>'budget_status','') not in('amount','none','unsure') then raise exception 'Invalid budget answer'; end if;
    if p_answers->>'budget_status'='amount' then
      if jsonb_typeof(p_answers->'budget_amount') is distinct from 'number' or (p_answers->>'budget_amount')::numeric<0 or (p_answers->>'budget_amount')::numeric>10000000 then raise exception 'Invalid budget amount'; end if;
      if coalesce(p_answers->>'currency','') not in('MXN','USD','EUR','OTHER') then raise exception 'Invalid budget currency'; end if;
      if p_answers->>'currency'='OTHER' and coalesce(p_answers->>'currency_other','') !~ '^[A-Z]{3}$' then raise exception 'Specify currency code'; end if;
    elsif p_answers ?| array['budget_amount','currency','currency_other'] then raise exception 'Unexpected budget amount'; end if;
  end if;
  v_hash:=encode(sha256(convert_to(lower(p_token),'UTF8')),'hex');
  -- Idempotent retry: an uncertain network response must never count twice.
  if exists(select 1 from public.vista_survey_responses where survey_key=v_survey.key and (visitor_hash=v_hash or (auth.uid() is not null and user_id=auth.uid()))) then return jsonb_build_object('received',true,'already_submitted',true); end if;
  v_headers:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb);
  v_ip:=left(coalesce(v_headers->>'cf-connecting-ip',split_part(v_headers->>'x-forwarded-for',',',1),v_headers->>'x-real-ip',p_token),200);
  v_key:=encode(sha256(convert_to(v_ip,'UTF8')),'hex');
  insert into vista_survey_private.rate_windows(fingerprint,window_start,attempts) values(v_key,now(),1)
  on conflict(fingerprint) do update set attempts=case when vista_survey_private.rate_windows.window_start<now()-interval '10 minutes' then 1 else vista_survey_private.rate_windows.attempts+1 end,window_start=case when vista_survey_private.rate_windows.window_start<now()-interval '10 minutes' then now() else vista_survey_private.rate_windows.window_start end
  returning attempts into v_attempts;
  if v_attempts>12 then raise exception 'Too many responses. Try again later'; end if;
  delete from vista_survey_private.rate_windows where window_start<now()-interval '1 day';
  insert into public.vista_survey_responses(survey_key,version,user_id,visitor_hash,answers) values(v_survey.key,p_version,auth.uid(),v_hash,p_answers) on conflict do nothing;
  get diagnostics v_rows=row_count;
  return jsonb_build_object('received',true,'already_submitted',v_rows=0);
end;
$$;
revoke all on function vista_survey_private.submit(text,jsonb,integer,text) from public;
grant execute on function vista_survey_private.submit(text,jsonb,integer,text) to anon,authenticated;

create function public.vista_submit_survey(p_token text,p_answers jsonb,p_version integer,p_honeypot text default '')
returns jsonb language sql security invoker set search_path=pg_catalog,pg_temp as $$
  select vista_survey_private.submit(p_token,p_answers,p_version,p_honeypot);
$$;
revoke all on function public.vista_submit_survey(text,jsonb,integer,text) from public;
grant execute on function public.vista_submit_survey(text,jsonb,integer,text) to anon,authenticated;

-- Only admins can SELECT responses, including through Realtime. No new
-- realtime schema objects or policies are needed for Postgres Changes.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.vista_survey_responses,public.vista_surveys;
  end if;
end $$;
commit;
