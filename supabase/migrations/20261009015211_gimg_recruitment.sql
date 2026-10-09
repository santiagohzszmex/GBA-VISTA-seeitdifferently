begin;
create schema if not exists gimg_recruitment_private;
revoke all on schema gimg_recruitment_private from public;
grant usage on schema gimg_recruitment_private to anon,authenticated;
create table public.gimg_recruitment_cycles (
 key text primary key,title text not null,community text not null,opens_at timestamptz not null,closes_at timestamptz not null,
 is_open boolean not null default false,terms_version text not null,target_places integer not null default 15,reserve_places integer not null default 5,
 check(closes_at>opens_at),check(target_places between 1 and 50),check(reserve_places between 0 and 20)
);
insert into public.gimg_recruitment_cycles values('gimg-otono-2026','El primer equipo de GIMG','Plantel Nezahualcóyotl de la Escuela Preparatoria de la UAEMéx','2026-10-08 00:00:00-06','2026-10-19 00:00:00-06',true,'2026-10-08',15,5);
create table public.gimg_recruitment_reviewers(user_id uuid primary key references auth.users(id) on delete cascade,role text not null check(role in('director','reviewer')),created_at timestamptz not null default now());
create table public.gimg_recruitment_applications (
 id uuid primary key default gen_random_uuid(),cycle_key text not null references public.gimg_recruitment_cycles(key),user_id uuid not null references auth.users(id),
 handle text not null,display_name text not null,confirmed_at timestamptz,answers jsonb not null default '{}'::jsonb,phase text not null default 'draft' check(phase in('draft','submitted')),
 terms_version text,accepted_at timestamptz,submitted_at timestamptz,updated_at timestamptz not null default now(),revision integer not null default 0,
 unique(cycle_key,user_id),check(jsonb_typeof(answers)='object' and octet_length(answers::text)<=20000)
);
create index gimg_recruitment_applications_date on public.gimg_recruitment_applications(cycle_key,submitted_at desc,id);
create table public.gimg_recruitment_reviews (
 application_id uuid primary key references public.gimg_recruitment_applications(id) on delete cascade,
 decision text not null default 'submitted' check(decision in('submitted','preselected','reserve','interview','accepted','not_selected')),
 published boolean not null default false,public_decision text not null default 'submitted',public_message text not null default '',public_role text not null default '',result_message text not null default '',assigned_role text not null default '',internal_notes text not null default '',
 availability_score integer not null default 0 check(availability_score between 0 and 10),motivation_score integer not null default 0 check(motivation_score between 0 and 10),
 scenario_score integer not null default 0 check(scenario_score between 0 and 20),evidence_score integer not null default 0 check(evidence_score between 0 and 5),
 updated_by uuid references auth.users(id),updated_at timestamptz not null default now(),revision integer not null default 0,
 check(length(result_message)<=2000 and length(internal_notes)<=4000 and length(assigned_role)<=200)
);
create table public.gimg_recruitment_contacts(application_id uuid primary key references public.gimg_recruitment_applications(id) on delete cascade,email text not null check(length(email)<=254),email_sent_at timestamptz);
create table public.gimg_recruitment_audit(id bigint generated always as identity primary key,application_id uuid references public.gimg_recruitment_applications(id),actor_id uuid references auth.users(id),action text not null,details jsonb not null default '{}',created_at timestamptz not null default now());
create table gimg_recruitment_private.identities(user_id uuid primary key references auth.users(id) on delete cascade,handle text not null unique,recovery_hash text not null,created_at timestamptz not null default now());
create table gimg_recruitment_private.recovery_limits(key text primary key,attempts integer not null default 1,started_at timestamptz not null default now());


create function gimg_recruitment_private.active_session() returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select auth.uid() is not null and exists(select 1 from auth.sessions where user_id=auth.uid() and id::text=auth.jwt()->>'session_id');
$$;
revoke all on function gimg_recruitment_private.active_session() from public;
grant execute on function gimg_recruitment_private.active_session() to authenticated;

create function gimg_recruitment_private.director() returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select gimg_recruitment_private.active_session() and (public.vista_is_platform_admin() or exists(select 1 from public.gimg_recruitment_reviewers where user_id=auth.uid() and role='director'));
$$;
create function gimg_recruitment_private.reviewer() returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select gimg_recruitment_private.active_session() and (gimg_recruitment_private.director() or exists(select 1 from public.gimg_recruitment_reviewers where user_id=auth.uid()));
$$;
revoke all on function gimg_recruitment_private.director(),gimg_recruitment_private.reviewer() from public;
grant execute on function gimg_recruitment_private.director(),gimg_recruitment_private.reviewer() to authenticated;

alter table public.gimg_recruitment_cycles enable row level security;
alter table public.gimg_recruitment_reviewers enable row level security;
alter table public.gimg_recruitment_applications enable row level security;
alter table public.gimg_recruitment_reviews enable row level security;
alter table public.gimg_recruitment_contacts enable row level security;
alter table public.gimg_recruitment_audit enable row level security;
alter table gimg_recruitment_private.identities enable row level security;
alter table gimg_recruitment_private.recovery_limits enable row level security;
revoke all on public.gimg_recruitment_cycles,public.gimg_recruitment_reviewers,public.gimg_recruitment_applications,public.gimg_recruitment_reviews,public.gimg_recruitment_contacts,public.gimg_recruitment_audit,gimg_recruitment_private.identities,gimg_recruitment_private.recovery_limits from public,anon,authenticated;
grant select on public.gimg_recruitment_cycles to anon,authenticated;
create policy recruitment_public_definition on public.gimg_recruitment_cycles for select to anon,authenticated using(true);
grant select on public.gimg_recruitment_applications,public.gimg_recruitment_reviews,public.gimg_recruitment_reviewers,public.gimg_recruitment_contacts,public.gimg_recruitment_audit to authenticated;
create policy recruitment_own_or_review on public.gimg_recruitment_applications for select to authenticated using((select gimg_recruitment_private.active_session()) and (user_id=(select auth.uid()) or (select gimg_recruitment_private.reviewer())));
create policy recruitment_internal_reviews on public.gimg_recruitment_reviews for select to authenticated using((select gimg_recruitment_private.reviewer()));
create policy recruitment_team on public.gimg_recruitment_reviewers for select to authenticated using(user_id=(select auth.uid()) or (select gimg_recruitment_private.director()));
create policy recruitment_contacts on public.gimg_recruitment_contacts for select to authenticated using(exists(select 1 from public.gimg_recruitment_applications a where a.id=application_id and ((a.user_id=auth.uid() and gimg_recruitment_private.active_session()) or (gimg_recruitment_private.reviewer() and exists(select 1 from public.gimg_recruitment_reviews r where r.application_id=a.id and r.published and r.public_decision='accepted')))));
create policy recruitment_audit on public.gimg_recruitment_audit for select to authenticated using((select gimg_recruitment_private.director()));

create function gimg_recruitment_private.validate_answers(a jsonb,complete boolean) returns jsonb language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
declare key text;value jsonb;allowed text[];words integer;cleaned jsonb:=a;field text;fields text[];
begin
 if a is null or jsonb_typeof(a)<>'object' or octet_length(a::text)>20000 then raise exception 'Invalid answers';end if;
 if exists(select 1 from jsonb_object_keys(a) k where k not in('area','secondary','community','coordination','hours','schedule','delay','changes','workspace','style','device','connection','experience','affinity','design_role','digital','illustration_role','production_role','motivation','scenario','sample','sample_url','sample_path','sample_name')) then raise exception 'Unknown field';end if;
 if a->>'area' is distinct from 'design' then cleaned:=cleaned-'affinity'-'design_role';end if;
 if a->>'area' is distinct from 'illustration' then cleaned:=cleaned-'digital'-'illustration_role';end if;
 if a->>'area' is distinct from 'production' then cleaned:=cleaned-'production_role';end if;
 if a->>'secondary'=a->>'area' then cleaned:=cleaned-'secondary';end if;
 if a->>'sample' is distinct from 'link' then cleaned:=cleaned-'sample_url';end if;
 if a->>'sample' is distinct from 'file' then cleaned:=cleaned-'sample_path'-'sample_name';end if;
 for key,value in select * from jsonb_each(cleaned) loop
  if key='schedule' then
   if jsonb_typeof(value)<>'array' or jsonb_array_length(value)>5 then raise exception 'Invalid schedule';end if;
   if exists(select 1 from jsonb_array_elements_text(value) v where v not in('morning','afternoon','night','weekend','variable')) or (select count(*)<>count(distinct v) from jsonb_array_elements_text(value) v) then raise exception 'Invalid schedule';end if;
   continue;
  end if;
  if jsonb_typeof(value)<>'string' or length(value#>>'{}')>4000 then raise exception 'Invalid text';end if;
  allowed:=case key
   when 'area' then array['production','research','writing','design','illustration','photography','qa']
   when 'secondary' then array['','production','research','writing','design','illustration','photography','qa']
   when 'community' then array['yes','no'] when 'coordination' then array['yes','maybe','no']
   when 'hours' then array['under2','2to4','5to7','8plus'] when 'delay' then array['notify','wait','reschedule','abandon']
   when 'changes' then array['yes','guided','no'] when 'workspace' then array['yes','learn','no']
   when 'style' then array['instructions','solutions','organizing','details','combination']
   when 'device' then array['windows','mac','both','tablet','shared','phone'] when 'connection' then array['stable','limited','support']
   when 'experience' then array['learn','practice','projects','lead'] when 'affinity' then array['use','learn','unable']
   when 'design_role' then array['lead','pages','any'] when 'digital' then array['yes','guided','no']
   when 'illustration_role' then array['lead','pieces','any'] when 'production_role' then array['lead','workspace','any']
   when 'sample' then array['none','link','file'] else null end;
  if allowed is not null and not (value#>>'{}')=any(allowed) then raise exception 'Invalid choice: %',key;end if;
 end loop;
 if complete then
  fields:=array['area','community','coordination','hours','delay','changes','workspace','style','device','connection','experience','motivation','scenario','sample'];
  fields:=fields||case cleaned->>'area' when 'design' then array['affinity','design_role'] when 'illustration' then array['digital','illustration_role'] when 'production' then array['production_role'] else array[]::text[] end;
  foreach field in array fields loop if length(trim(coalesce(cleaned->>field,'')))=0 then raise exception 'Missing field: %',field;end if;end loop;
  if jsonb_array_length(coalesce(cleaned->'schedule','[]'))<1 then raise exception 'Missing schedule';end if;
  words:=cardinality(regexp_split_to_array(trim(cleaned->>'motivation'),'\s+'));
  if words<40 or words>80 then raise exception 'Motivation must have 40 to 80 words';end if;
  words:=cardinality(regexp_split_to_array(trim(cleaned->>'scenario'),'\s+'));
  if words<1 or words>100 then raise exception 'Scenario must have up to 100 words';end if;
  if cleaned->>'sample'='link' and coalesce(cleaned->>'sample_url','') !~ '^https://[^[:space:]/]+(/[^[:space:]]*)?$' then raise exception 'Invalid sample URL';end if;
  if cleaned->>'sample'='file' and length(coalesce(cleaned->>'sample_path',''))=0 then raise exception 'Missing file';end if;
 end if;
 return cleaned;
end;$$;
revoke all on function gimg_recruitment_private.validate_answers(jsonb,boolean) from public,anon,authenticated;

create function gimg_recruitment_private.save_application(p_cycle text,p_answers jsonb,p_email text,p_complete boolean,p_terms text,p_truth boolean,p_revision integer) returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare c public.gimg_recruitment_cycles;old public.gimg_recruitment_applications;v_id uuid;v_handle text;v_name text;cleaned jsonb;
begin
 if auth.uid() is null or not gimg_recruitment_private.active_session() then raise exception 'Authentication required';end if;
 select * into c from public.gimg_recruitment_cycles where key=p_cycle for share;
 if not found or not c.is_open or now()<c.opens_at or now()>=c.closes_at then raise exception 'Convocatoria cerrada';end if;
 select * into old from public.gimg_recruitment_applications where user_id=auth.uid() and cycle_key=p_cycle for update;
 if old.phase='submitted' then
  if p_complete then return jsonb_build_object('id',old.id,'revision',old.revision,'submitted',true,'already_submitted',true);end if;
  raise exception 'Postulación ya enviada';
 end if;
 if old.id is not null and old.revision is distinct from p_revision then raise exception 'El borrador cambió en otra pestaña. Actualiza antes de guardar.';end if;
 cleaned:=gimg_recruitment_private.validate_answers(p_answers,p_complete);
 if p_email is not null and (length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Correo de contacto inválido';end if;
 if p_complete and (p_terms is distinct from c.terms_version or not coalesce(p_truth,false) or p_email is null) then raise exception 'Acepta las condiciones, confirma tus respuestas y completa el correo de contacto';end if;
 if cleaned->>'sample'='file' then
  if coalesce(cleaned->>'sample_path','') not like auth.uid()::text||'/'||p_cycle||'/%' then raise exception 'Archivo ajeno';end if;
  if p_complete and not exists(select 1 from storage.objects where bucket_id='gimg-recruitment' and name=cleaned->>'sample_path') then raise exception 'Archivo no confirmado';end if;
 end if;
 select nombre,coalesce(nullif(nombre_publico,''),nombre) into v_handle,v_name from public.usuarios where id=auth.uid();
 if v_handle is null then raise exception 'Completa tu GBA ID antes de postularte';end if;
 insert into public.gimg_recruitment_applications(cycle_key,user_id,handle,display_name,answers,phase,terms_version,accepted_at,submitted_at,revision)
 values(p_cycle,auth.uid(),v_handle,v_name,cleaned,case when p_complete then 'submitted' else 'draft' end,case when p_complete then p_terms end,case when p_complete then now() end,case when p_complete then now() end,1)
 on conflict(cycle_key,user_id) do update set answers=excluded.answers,phase=excluded.phase,terms_version=excluded.terms_version,accepted_at=excluded.accepted_at,submitted_at=excluded.submitted_at,revision=public.gimg_recruitment_applications.revision+1,updated_at=now() where public.gimg_recruitment_applications.phase='draft' and public.gimg_recruitment_applications.revision=p_revision
 returning id into v_id;
 if v_id is null then raise exception 'El borrador cambió. Actualiza antes de guardar.';end if;
 if p_email is not null then insert into public.gimg_recruitment_contacts(application_id,email) values(v_id,lower(trim(p_email))) on conflict(application_id) do update set email=excluded.email;else delete from public.gimg_recruitment_contacts where application_id=v_id;end if;
 if p_complete then
  insert into public.gimg_recruitment_reviews(application_id) values(v_id) on conflict do nothing;
  insert into public.gimg_recruitment_audit(application_id,actor_id,action,details) values(v_id,auth.uid(),'submitted',jsonb_build_object('terms_version',p_terms));
 end if;
 select * into old from public.gimg_recruitment_applications where id=v_id;
 return jsonb_build_object('id',v_id,'revision',old.revision,'submitted',p_complete);
end;$$;
revoke all on function gimg_recruitment_private.save_application(text,jsonb,text,boolean,text,boolean,integer) from public;
grant execute on function gimg_recruitment_private.save_application(text,jsonb,text,boolean,text,boolean,integer) to authenticated;
create function public.gimg_save_application(p_cycle text,p_answers jsonb,p_email text default null,p_complete boolean default false,p_terms text default null,p_truth boolean default false,p_revision integer default 0) returns jsonb language sql security invoker set search_path=pg_catalog,pg_temp as $$select gimg_recruitment_private.save_application(p_cycle,p_answers,p_email,p_complete,p_terms,p_truth,p_revision)$$;
revoke all on function public.gimg_save_application(text,jsonb,text,boolean,text,boolean,integer) from public;
grant execute on function public.gimg_save_application(text,jsonb,text,boolean,text,boolean,integer) to authenticated;

create function gimg_recruitment_private.candidate_result(p_cycle text) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare a public.gimg_recruitment_applications;r public.gimg_recruitment_reviews;
begin
 if auth.uid() is null or not gimg_recruitment_private.active_session() then raise exception 'Authentication required';end if;
 select * into a from public.gimg_recruitment_applications where cycle_key=p_cycle and user_id=auth.uid();
 if a.id is null then return null;end if;
 select * into r from public.gimg_recruitment_reviews where application_id=a.id and published;
 return jsonb_build_object('id',a.id,'phase',a.phase,'submitted_at',a.submitted_at,'decision',coalesce(r.public_decision,'submitted'),'message',coalesce(r.public_message,''),'assigned_role',coalesce(r.public_role,''),'confirmed_at',a.confirmed_at);
end;$$;
revoke all on function gimg_recruitment_private.candidate_result(text) from public;
grant execute on function gimg_recruitment_private.candidate_result(text) to authenticated;
create function public.gimg_candidate_result(p_cycle text) returns jsonb language sql security invoker set search_path=pg_catalog,pg_temp as $$select gimg_recruitment_private.candidate_result(p_cycle)$$;
revoke all on function public.gimg_candidate_result(text) from public;
grant execute on function public.gimg_candidate_result(text) to authenticated;

create function gimg_recruitment_private.review(p_id uuid,p_values jsonb,p_revision integer) returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare r public.gimg_recruitment_reviews;v_publish boolean;v_decision text;
begin
 if auth.uid() is null or not gimg_recruitment_private.reviewer() then raise exception 'Forbidden';end if;
 if exists(select 1 from jsonb_object_keys(p_values) k where k not in('decision','published','result_message','assigned_role','internal_notes','availability_score','motivation_score','scenario_score','evidence_score')) then raise exception 'Unknown review field';end if;
 select * into r from public.gimg_recruitment_reviews where application_id=p_id for update;
 if not found then raise exception 'Postulación no enviada';end if;
 if r.revision<>p_revision then raise exception 'Otra persona cambió esta revisión. Actualiza antes de guardar.';end if;
 if p_values is null or jsonb_typeof(p_values)<>'object' or octet_length(p_values::text)>12000 then raise exception 'Invalid review';end if;
 v_publish:=coalesce((p_values->>'published')::boolean,false);v_decision:=coalesce(p_values->>'decision','submitted');
 if (v_publish or v_decision<>r.decision) and not gimg_recruitment_private.director() then raise exception 'Solo Dirección decide y publica resultados';end if;
 if v_publish and v_decision in('accepted','reserve') then
  perform 1 from public.gimg_recruitment_cycles c join public.gimg_recruitment_applications a on a.cycle_key=c.key where a.id=p_id for update of c;
  if (select count(*) from public.gimg_recruitment_reviews other join public.gimg_recruitment_applications a on a.id=other.application_id where other.application_id<>p_id and other.published and other.public_decision=v_decision and a.cycle_key=(select cycle_key from public.gimg_recruitment_applications where id=p_id)) >= (case when v_decision='accepted' then 16 else 5 end) then raise exception 'Cupo del equipo o reserva alcanzado';end if;
 end if;
 update public.gimg_recruitment_reviews set decision=v_decision,published=(v_publish or r.published),public_decision=case when v_publish then v_decision else r.public_decision end,public_message=case when v_publish then coalesce(p_values->>'result_message','') else r.public_message end,public_role=case when v_publish then coalesce(p_values->>'assigned_role','') else r.public_role end,result_message=coalesce(p_values->>'result_message',''),assigned_role=coalesce(p_values->>'assigned_role',''),internal_notes=coalesce(p_values->>'internal_notes',''),availability_score=coalesce((p_values->>'availability_score')::integer,0),motivation_score=coalesce((p_values->>'motivation_score')::integer,0),scenario_score=coalesce((p_values->>'scenario_score')::integer,0),evidence_score=coalesce((p_values->>'evidence_score')::integer,0),updated_by=auth.uid(),updated_at=now(),revision=revision+1 where application_id=p_id returning * into r;
 insert into public.gimg_recruitment_audit(application_id,actor_id,action,details) values(p_id,auth.uid(),case when v_publish then 'result_published' else 'review_saved' end,jsonb_build_object('decision',v_decision,'revision',r.revision));
 return to_jsonb(r);
end;$$;
revoke all on function gimg_recruitment_private.review(uuid,jsonb,integer) from public;
grant execute on function gimg_recruitment_private.review(uuid,jsonb,integer) to authenticated;
create function public.gimg_review_application(p_id uuid,p_values jsonb,p_revision integer) returns jsonb language sql security invoker set search_path=pg_catalog,pg_temp as $$select gimg_recruitment_private.review(p_id,p_values,p_revision)$$;
revoke all on function public.gimg_review_application(uuid,jsonb,integer) from public;
grant execute on function public.gimg_review_application(uuid,jsonb,integer) to authenticated;

create function public.gimg_recruitment_access() returns jsonb language sql stable security invoker set search_path=pg_catalog,pg_temp as $$select jsonb_build_object('reviewer',gimg_recruitment_private.reviewer(),'director',gimg_recruitment_private.director())$$;
revoke all on function public.gimg_recruitment_access() from public;grant execute on function public.gimg_recruitment_access() to authenticated;
create function gimg_recruitment_private.set_reviewer(p_handle text,p_role text) returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare target uuid;
begin
 if auth.uid() is null or not gimg_recruitment_private.director() then raise exception 'Forbidden';end if;
 select id into target from public.usuarios where lower(nombre)=lower(trim(p_handle));
 if target is null then raise exception 'GBA ID no encontrado';end if;
 if p_role not in('director','reviewer','remove') then raise exception 'Rol inválido';end if;
 if p_role='remove' then delete from public.gimg_recruitment_reviewers where user_id=target;
 else insert into public.gimg_recruitment_reviewers(user_id,role) values(target,p_role) on conflict(user_id) do update set role=excluded.role;end if;
 insert into public.gimg_recruitment_audit(actor_id,action,details) values(auth.uid(),'reviewer_changed',jsonb_build_object('user_id',target,'role',p_role));
 return true;
end;$$;
revoke all on function gimg_recruitment_private.set_reviewer(text,text) from public;grant execute on function gimg_recruitment_private.set_reviewer(text,text) to authenticated;
create function public.gimg_set_reviewer(p_handle text,p_role text) returns boolean language sql security invoker set search_path=pg_catalog,pg_temp as $$select gimg_recruitment_private.set_reviewer(p_handle,p_role)$$;
revoke all on function public.gimg_set_reviewer(text,text) from public;grant execute on function public.gimg_set_reviewer(text,text) to authenticated;

create function gimg_recruitment_private.private_profile() returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
 if new.raw_user_meta_data->>'gimg_candidate'='true' then update public.usuarios set perfil_publico=false,nombre_publico=nombre where id=new.id;end if;return new;
end;$$;
revoke all on function gimg_recruitment_private.private_profile() from public,anon,authenticated;
create trigger zz_gimg_private_profile after insert on auth.users for each row execute function gimg_recruitment_private.private_profile();

create function gimg_recruitment_private.init_identity(p_hash text) returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_handle text;
begin
 if auth.uid() is null or not gimg_recruitment_private.active_session() then raise exception 'Authentication required';end if;
 if p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid recovery hash';end if;
 select u.nombre into v_handle from public.usuarios u join auth.users a on a.id=u.id where u.id=auth.uid() and a.email=lower(u.nombre)||'@id.gba.software';
 if v_handle is null then raise exception 'Este método corresponde a las nuevas cuentas GBA ID';end if;
 insert into gimg_recruitment_private.identities(user_id,handle,recovery_hash) values(auth.uid(),lower(v_handle),p_hash) on conflict(user_id) do nothing;
 update public.usuarios set perfil_publico=false where id=auth.uid();
 return true;
end;$$;
revoke all on function gimg_recruitment_private.init_identity(text) from public;grant execute on function gimg_recruitment_private.init_identity(text) to authenticated;
create function public.gimg_init_identity(p_hash text) returns boolean language sql security invoker set search_path=pg_catalog,pg_temp as $$select gimg_recruitment_private.init_identity(p_hash)$$;
revoke all on function public.gimg_init_identity(text) from public;grant execute on function public.gimg_init_identity(text) to authenticated;

-- Recovery is an intentionally anonymous credential endpoint. The high-entropy
-- proof is hashed server-side, has a bounded request budget, and is only valid
-- for identities enrolled in this flow. It never accepts a target UUID.
create function gimg_recruitment_private.recover_identity(p_handle text,p_code text,p_password text) returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_fingerprint text;v_attempts integer;target uuid;headers jsonb;
begin
 if length(coalesce(p_password,''))<10 or length(p_password)>128 or p_code !~ '^[a-f0-9]{48}$' or p_handle !~ '^[a-z0-9._-]{3,24}$' then return false;end if;
 headers:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}');
 v_fingerprint:=encode(sha256(convert_to(coalesce(split_part(headers->>'x-forwarded-for',',',1),'unknown')||':'||p_handle,'UTF8')),'hex');
 insert into gimg_recruitment_private.recovery_limits(key) values(v_fingerprint) on conflict(key) do update set attempts=case when gimg_recruitment_private.recovery_limits.started_at<now()-interval '1 hour' then 1 else gimg_recruitment_private.recovery_limits.attempts+1 end,started_at=case when gimg_recruitment_private.recovery_limits.started_at<now()-interval '1 hour' then now() else gimg_recruitment_private.recovery_limits.started_at end returning attempts into v_attempts;
 if v_attempts>8 then return false;end if;
 select user_id into target from gimg_recruitment_private.identities where handle=p_handle and recovery_hash=encode(sha256(convert_to(p_code,'UTF8')),'hex');
 if target is null then return false;end if;
 -- Match the existing Auth password-hash representation, revoke sessions and
 -- remove legacy recovery claims. Existing accounts never enter this branch.
 delete from auth.sessions where user_id=target;
 update auth.users set encrypted_password=extensions.crypt(p_password,extensions.gen_salt('bf',10)),updated_at=now() where id=target;
 return true;
end;$$;
revoke all on function gimg_recruitment_private.recover_identity(text,text,text) from public;grant execute on function gimg_recruitment_private.recover_identity(text,text,text) to anon,authenticated;
create function public.gimg_recover_identity(p_handle text,p_code text,p_password text) returns boolean language sql security invoker set search_path=pg_catalog,pg_temp as $$select gimg_recruitment_private.recover_identity(p_handle,p_code,p_password)$$;
revoke all on function public.gimg_recover_identity(text,text,text) from public;grant execute on function public.gimg_recover_identity(text,text,text) to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('gimg-recruitment','gimg-recruitment',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy gimg_sample_upload on storage.objects for insert to authenticated with check(bucket_id='gimg-recruitment' and gimg_recruitment_private.active_session() and (storage.foldername(name))[1]=auth.uid()::text and (storage.foldername(name))[2]='gimg-otono-2026' and exists(select 1 from public.gimg_recruitment_cycles c where c.key='gimg-otono-2026' and c.is_open and now()>=c.opens_at and now()<c.closes_at));
create policy gimg_sample_read on storage.objects for select to authenticated using(bucket_id='gimg-recruitment' and (((storage.foldername(name))[1]=auth.uid()::text and gimg_recruitment_private.active_session()) or gimg_recruitment_private.reviewer()));
-- Restrictive guards keep older permissive storage policies from opening this bucket.
create policy gimg_sample_anon_guard on storage.objects as restrictive for all to anon using(bucket_id<>'gimg-recruitment') with check(bucket_id<>'gimg-recruitment');
create policy gimg_sample_read_guard on storage.objects as restrictive for select to authenticated using(bucket_id<>'gimg-recruitment' or (((storage.foldername(name))[1]=auth.uid()::text and gimg_recruitment_private.active_session()) or gimg_recruitment_private.reviewer()));
create policy gimg_sample_upload_guard on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'gimg-recruitment' or (gimg_recruitment_private.active_session() and (storage.foldername(name))[1]=auth.uid()::text and (storage.foldername(name))[2]='gimg-otono-2026' and exists(select 1 from public.gimg_recruitment_cycles c where c.key='gimg-otono-2026' and c.is_open and now()>=c.opens_at and now()<c.closes_at)));
create policy gimg_sample_update_guard on storage.objects as restrictive for update to authenticated using(bucket_id<>'gimg-recruitment') with check(bucket_id<>'gimg-recruitment');
create policy gimg_sample_delete_guard on storage.objects as restrictive for delete to authenticated using(bucket_id<>'gimg-recruitment');
create function public.gimg_id_available(p_handle text) returns boolean language sql stable security invoker set search_path=pg_catalog,pg_temp as $$
 select p_handle ~ '^[a-z0-9._-]{3,24}$' and not public.vista_gba_id_exists(p_handle);
$$;
revoke all on function public.gimg_id_available(text) from public;grant execute on function public.gimg_id_available(text) to anon,authenticated;
create function gimg_recruitment_private.confirm_place(p_cycle text) returns boolean language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare target uuid;
begin
 if auth.uid() is null or not gimg_recruitment_private.active_session() then raise exception 'Authentication required';end if;
 select a.id into target from public.gimg_recruitment_applications a join public.gimg_recruitment_reviews r on r.application_id=a.id where a.user_id=auth.uid() and a.cycle_key=p_cycle and r.published and r.public_decision='accepted' for update of a;
 if target is null then raise exception 'No hay una plaza seleccionada para confirmar';end if;
 update public.gimg_recruitment_applications set confirmed_at=coalesce(confirmed_at,now()) where id=target;
 insert into public.gimg_recruitment_audit(application_id,actor_id,action) values(target,auth.uid(),'place_confirmed');return true;
end;$$;
revoke all on function gimg_recruitment_private.confirm_place(text) from public;grant execute on function gimg_recruitment_private.confirm_place(text) to authenticated;
create function public.gimg_confirm_place(p_cycle text) returns boolean language sql security invoker set search_path=pg_catalog,pg_temp as $$select gimg_recruitment_private.confirm_place(p_cycle)$$;
revoke all on function public.gimg_confirm_place(text) from public;grant execute on function public.gimg_confirm_place(text) to authenticated;

do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.gimg_recruitment_applications,public.gimg_recruitment_reviews;
 end if;
end $$;
commit;
