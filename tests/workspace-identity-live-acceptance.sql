-- Always run inside BEGIN ... ROLLBACK. Only this disposable identity is changed.
create temporary table workspace_identity_test_result(checks integer, credentials_preserved boolean, keynotes_preserved boolean);
do $$
declare
 fixture uuid:=gen_random_uuid(); sid uuid:=gen_random_uuid();
 handle text:='workspace-identity-test-'||gen_random_uuid();
 secret text:='fixture recovery '||gen_random_uuid();
 legacy_code text:=encode(extensions.gen_random_bytes(24),'hex');
 origin text:='release-test-'||gen_random_uuid(); device text:=gen_random_uuid()::text;
 reply jsonb; original_passwords text; original_keynotes text; checks integer:=0;
begin
 select md5(string_agg(id::text||coalesce(encrypted_password,''),'' order by id)) into original_passwords from auth.users;
 select md5(coalesce(string_agg(to_jsonb(k)::text,'' order by id),'')) into original_keynotes from public.gba_keynotes k;
 reply:=public.gba_id_gateway('prepare',handle,'4826',secret,origin,device,null);
 if reply->>'prepared' is distinct from 'true' then raise exception 'Registration preparation failed';end if;checks:=checks+1;
 insert into auth.users(id,email,aud,role,encrypted_password,raw_user_meta_data,is_sso_user,is_anonymous,created_at,updated_at)
 values(fixture,'workspace-identity-test-'||fixture||'@example.invalid','authenticated','authenticated',extensions.crypt(encode(extensions.gen_random_bytes(32),'hex'),extensions.gen_salt('bf',12)),jsonb_build_object('nombre',handle),false,false,now(),now());
 reply:=public.gba_id_gateway('register',handle,'4826',secret,origin,device,fixture);
 if reply->>'user_id' is distinct from fixture::text then raise exception 'Registration failed';end if;checks:=checks+1;
 reply:=public.gba_id_gateway('login',upper(handle),'4826','',origin,device,null);
 if reply->>'user_id' is distinct from fixture::text then raise exception 'PIN login failed';end if;checks:=checks+1;
 reply:=public.gba_id_gateway('login',handle,'0000','',origin,device,null);
 if not reply ? 'error' then raise exception 'Incorrect PIN accepted';end if;checks:=checks+1;
 insert into auth.sessions(id,user_id,created_at,updated_at) values(sid,fixture,now(),now());
 perform set_config('request.jwt.claims',jsonb_build_object('sub',fixture,'session_id',sid,'role','authenticated')::text,true);
 if not workspace_private.session_active() then raise exception 'Session fixture is invalid';end if;checks:=checks+1;
 reply:=public.gba_id_gateway('recover',handle,'5739',secret,origin,device,null);
 if reply->>'user_id' is distinct from fixture::text then raise exception 'Recovery failed';end if;checks:=checks+1;
 if workspace_private.session_active() or exists(select 1 from auth.sessions where user_id=fixture) then raise exception 'Old session remained active';end if;checks:=checks+1;
 reply:=public.gba_id_gateway('login',handle,'4826','',origin,device,null);
 if not reply ? 'error' then raise exception 'Previous PIN remained valid';end if;checks:=checks+1;
 reply:=public.gba_id_gateway('login',handle,'5739','',origin,device,null);
 if reply->>'user_id' is distinct from fixture::text then raise exception 'Recovered PIN failed';end if;checks:=checks+1;
 insert into gimg_recruitment_private.identities(user_id,handle,recovery_hash) values(fixture,handle,encode(sha256(convert_to(legacy_code,'UTF8')),'hex'));
 reply:=public.gba_id_gateway('recover',handle,'6842',regexp_replace(legacy_code,'(.{8})','\1-','g'),origin,device,null);
 if reply->>'user_id' is distinct from fixture::text then raise exception 'Recruitment recovery code failed';end if;checks:=checks+1;
 if original_passwords is distinct from (select md5(string_agg(id::text||coalesce(encrypted_password,''),'' order by id)) from auth.users where id<>fixture) then raise exception 'Existing credentials changed';end if;
 if original_keynotes is distinct from (select md5(coalesce(string_agg(to_jsonb(k)::text,'' order by id),'')) from public.gba_keynotes k) then raise exception 'Keynotes changed';end if;
 insert into workspace_identity_test_result values(checks,true,true);
 perform set_config('request.jwt.claims','{}',true);
end;$$;
