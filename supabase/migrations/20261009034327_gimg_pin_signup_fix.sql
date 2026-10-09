begin;
-- Existing profile guards resolve unqualified es_staff()/auth_rol()/usuarios.
-- Add the trusted public schema only to our two profile-writing functions.
-- Public CREATE is denied to anon/authenticated in this project's schema ACL.
-- No global authorization function, role, grant or profile data is changed.
create or replace function gimg_recruitment_private.private_profile() returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 if new.raw_user_meta_data->>'gimg_candidate'='true' then update public.usuarios set perfil_publico=false,nombre_publico=nombre where id=new.id;end if;
 return new;
end;$$;
-- Normalise only the internal Auth address; the entered name stays readable.
create function gimg_recruitment_private.auth_name(p_name text) returns text language sql immutable security invoker set search_path=pg_catalog,pg_temp as $$
 select regexp_replace(translate(lower(trim(p_name)),'áéíóúüñ','aeiouun'),'[[:space:]]','','g');
$$;
revoke all on function gimg_recruitment_private.auth_name(text) from public,anon,authenticated;
create function gimg_recruitment_private.name_available(p_name text) returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select length(trim(p_name)) between 3 and 64
 and trim(p_name) ~* '^[a-z0-9áéíóúüñ ._-]+$'
 and gimg_recruitment_private.auth_name(p_name) ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
 and not exists(select 1 from public.usuarios u where lower(u.nombre)=lower(trim(p_name)))
 and not exists(select 1 from auth.users a where a.email in(gimg_recruitment_private.auth_name(p_name)||'@gba.com',gimg_recruitment_private.auth_name(p_name)||'@id.gba.software'));
$$;
revoke all on function gimg_recruitment_private.name_available(text) from public;
grant execute on function gimg_recruitment_private.name_available(text) to anon,authenticated;
create or replace function public.gimg_id_available(p_handle text) returns boolean language sql stable security invoker set search_path=pg_catalog,pg_temp as $$
 select gimg_recruitment_private.name_available(p_handle);
$$;
create or replace function gimg_recruitment_private.init_identity(p_hash text) returns boolean language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_handle text;
begin
 if auth.uid() is null or not gimg_recruitment_private.active_session() then raise exception 'Authentication required';end if;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid recovery hash';end if;
 select lower(regexp_replace(trim(u.nombre),'[[:space:]]+',' ','g')) into v_handle
 from public.usuarios u join auth.users a on a.id=u.id where u.id=auth.uid()
 and (a.email=lower(u.nombre)||'@id.gba.software' or
 (a.email=gimg_recruitment_private.auth_name(u.nombre)||'@gba.com' and a.raw_user_meta_data->>'gimg_candidate'='true'));
 if v_handle is null then raise exception 'Este método corresponde a las nuevas cuentas GBA ID';end if;
 insert into gimg_recruitment_private.identities(user_id,handle,recovery_hash) values(auth.uid(),v_handle,p_hash) on conflict(user_id) do nothing;
 update public.usuarios set perfil_publico=false where id=auth.uid();
 return true;
end;$$;
CREATE OR REPLACE FUNCTION gimg_recruitment_private.recover_identity(p_handle text, p_code text, p_password text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
declare v_fingerprint text;v_attempts integer;target uuid;headers jsonb;
begin
 p_handle:=lower(regexp_replace(trim(p_handle),'[[:space:]]+',' ','g'));
 if length(coalesce(p_password,''))<10 or length(p_password)>128 or p_code is null or p_code !~ '^[a-f0-9]{48}$' or p_handle is null or length(p_handle) not between 3 and 64 or p_handle !~* '^[a-z0-9áéíóúüñ ._-]+$' then return false;end if;
 headers:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}');
 v_fingerprint:=encode(sha256(convert_to(coalesce(split_part(headers->>'x-forwarded-for',',',1),'unknown')||':'||p_handle,'UTF8')),'hex');
 insert into gimg_recruitment_private.recovery_limits(key) values(v_fingerprint) on conflict(key) do update set attempts=case when gimg_recruitment_private.recovery_limits.started_at<now()-interval '1 hour' then 1 else gimg_recruitment_private.recovery_limits.attempts+1 end,started_at=case when gimg_recruitment_private.recovery_limits.started_at<now()-interval '1 hour' then now() else gimg_recruitment_private.recovery_limits.started_at end returning attempts into v_attempts;
 if v_attempts>8 then return false;end if;
 select user_id into target from gimg_recruitment_private.identities where handle=p_handle and recovery_hash=encode(sha256(convert_to(p_code,'UTF8')),'hex');
 if target is null then return false;end if;
 if exists(select 1 from auth.users where id=target and email like '%@gba.com') and p_password !~ '^GBA-[0-9]{4}-SecureVault$' then return false;end if;
 -- Match the existing Auth password-hash representation, revoke sessions and
 -- remove legacy recovery claims. Existing accounts never enter this branch.
 delete from auth.sessions where user_id=target;
 update auth.users set encrypted_password=extensions.crypt(p_password,extensions.gen_salt('bf',10)),updated_at=now() where id=target;
 return true;
end;$function$
;
commit;
