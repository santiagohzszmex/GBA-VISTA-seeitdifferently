-- Disposable fixtures only; always execute inside BEGIN / ROLLBACK.
create temporary table workspace_reference_access_test_result(checks integer,credentials_preserved boolean,keynotes_preserved boolean);
do $$
declare ids uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];sessions uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 u uuid;p uuid;second uuid;a uuid;other_a uuid;g jsonb;r jsonb;bundle jsonb;task jsonb;asset jsonb;common_event uuid;own_guide uuid;hidden_guide uuid;
 n integer;checks integer:=0;kind text;denied boolean;passwords text;keynotes text;gateway_key text:='disposable-reference-access-gateway';
 empty_doc jsonb:='{"type":"doc","content":[{"type":"paragraph"}]}';
begin
 select md5(coalesce(string_agg(id::text||coalesce(encrypted_password,''),'' order by id),'')) into passwords from auth.users;
 select md5(coalesce(string_agg(to_jsonb(k)::text,'' order by id),'')) into keynotes from public.gba_keynotes k;
 for n in 1..3 loop
  insert into auth.users(id,email,aud,role,raw_user_meta_data,is_sso_user,is_anonymous,created_at,updated_at) values(ids[n],'reference-access-'||ids[n]||'@example.invalid','authenticated','authenticated','{}',false,false,now(),now());
  insert into auth.sessions(id,user_id,created_at,updated_at) values(sessions[n],ids[n],now(),now());
 end loop;
 select id into u from public.workspace_units where slug='gimg';
 insert into public.workspace_unit_memberships(unit_id,user_id,membership_status) select u,x,'active' from unnest(ids)x;
 insert into public.workspace_access_grants(user_id,unit_id,access_role,scope_type,scope_id,reason) values(ids[1],u,'gimg_direction','unit',u,'Disposable assignment bootstrap'),(ids[3],u,'gimg_contributor','unit',u,'Disposable private work');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[1],'session_id',sessions[1],'role','authenticated')::text,true);perform set_config('role','authenticated',true);
 p:=(public.workspace_command('project.create',jsonb_build_object('unit_id',u,'title','Disposable reference bootstrap'))->>'id')::uuid;
 second:=(public.workspace_command('project.create',jsonb_build_object('unit_id',u,'title','Unassigned reference edition'))->>'id')::uuid;
 select id into a from public.workspace_areas where project_id=p and specialty='research';select id into other_a from public.workspace_areas where project_id=p and specialty='art';
 g:=public.workspace_people_action(u,'assign',jsonb_build_object('userId',ids[2],'cargoKey','contributor','projectId',p,'functionKey','research'));
 common_event:=(public.workspace_command('event.save',jsonb_build_object('project_id',p,'title','Common milestone','kind','milestone','starts_at',now()+interval '1 day'))->>'id')::uuid;
 task:=public.workspace_command('task.create',jsonb_build_object('project_id',p,'area_id',a,'title','Private work from another person','responsible_id',ids[3]));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[3],'session_id',sessions[3],'role','authenticated')::text,true);
 task:=public.workspace_command('version.submit',jsonb_build_object('project_id',p,'deliverable_id',task->>'id','content_markdown','Private unaccepted draft','asset_url','https://private.example/source'),(task->>'revision')::integer);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[1],'session_id',sessions[1],'role','authenticated')::text,true);
 perform public.workspace_command('task.schedule',jsonb_build_object('project_id',p,'deliverable_id',task->>'id','due_at',now()+interval '2 days','priority','normal'),(task->>'revision')::integer);
 own_guide:=(public.workspace_save_reference(p,jsonb_build_object('kind','instructions','area_id',a,'title','Research instructions','content_document',empty_doc),0)->>'id')::uuid;
 hidden_guide:=(public.workspace_save_reference(p,jsonb_build_object('kind','instructions','area_id',other_a,'title','Other area instructions','content_document',empty_doc),0)->>'id')::uuid;
 perform set_config('role','postgres',true);update workspace_private.original_limits set enabled=true,gateway_url='https://disposable-reference-access.workers.dev',gateway_key_hash=encode(extensions.digest(gateway_key,'sha256'),'hex') where singleton;perform set_config('role','authenticated',true);
 foreach kind in array array['concept','creative_direction','moodboard','instructions'] loop
  r:=public.workspace_save_reference(p,jsonb_build_object('kind',kind,'title','File-only '||kind,'content_document',empty_doc,'palette',jsonb_build_array('#673AB7')),0);
  if trim(r->>'content_markdown',E' \n\r\t')<>'' or r->'palette'<>jsonb_build_array('#673AB7') then raise exception 'File-only reference failed';end if;checks:=checks+1;
  asset:=public.workspace_original_begin((r->>'id')::uuid,'Palette.pdf','application/pdf',100,repeat('a',64),gateway_key);perform public.workspace_original_finish((asset->>'id')::uuid,true,gateway_key);checks:=checks+1;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[2],'session_id',sessions[2],'role','authenticated')::text,true);
  if (public.workspace_original_access((asset->>'id')::uuid,true,gateway_key)->>'id')::uuid<>(asset->>'id')::uuid then raise exception 'Assigned member cannot download shared reference';end if;checks:=checks+1;
  denied:=false;begin perform public.workspace_original_gate((r->>'id')::uuid,gateway_key);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Contributor uploaded creative originals';end if;checks:=checks+1;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[1],'session_id',sessions[1],'role','authenticated')::text,true);
 end loop;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[2],'session_id',sessions[2],'role','authenticated')::text,true);
 if not exists(select 1 from public.workspace_projects where id=p) or exists(select 1 from public.workspace_projects where id=second) then raise exception 'Assignment discovery scope failed';end if;checks:=checks+1;
 if (select count(*) from public.workspace_areas where project_id=p)<>1 or not exists(select 1 from public.workspace_areas where id=a) then raise exception 'Assigned area metadata failed';end if;checks:=checks+1;
 bundle:=public.workspace_reference_bundle(p);
 if jsonb_array_length(bundle->'references')<>5 or not exists(select 1 from jsonb_array_elements(bundle->'references')v where (v->>'id')::uuid=own_guide) or exists(select 1 from jsonb_array_elements(bundle->'references')v where (v->>'id')::uuid=hidden_guide) then raise exception 'Area reference isolation failed';end if;checks:=checks+1;
 if exists(select 1 from public.workspace_deliverables where project_id=p) or exists(select 1 from public.workspace_versions where deliverable_id=(task->>'id')::uuid) then raise exception 'Private work leaked';end if;checks:=checks+1;
 denied:=false;begin perform public.workspace_draft((task->>'id')::uuid);exception when others then denied:=true;end;if not denied then raise exception 'Private working copy leaked';end if;checks:=checks+1;
 if (select count(*) from public.workspace_events where project_id=p)<>1 or not exists(select 1 from public.workspace_events where id=common_event) then raise exception 'Calendar task isolation failed';end if;checks:=checks+1;
 denied:=false;begin perform public.workspace_reference_bundle(second);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Unassigned reference edition leaked';end if;checks:=checks+1;
 denied:=false;begin perform public.workspace_command('task.create',jsonb_build_object('project_id',p,'area_id',a,'title','Attempt to assign another person','responsible_id',ids[3]));exception when others then denied:=true;end;if not denied then raise exception 'Contributor assigned another person';end if;checks:=checks+1;
 perform set_config('role','postgres',true);update public.workspace_unit_memberships set suspended_at=now() where unit_id=u and user_id=ids[2];perform set_config('role','authenticated',true);
 if exists(select 1 from public.workspace_projects where id=p) then raise exception 'Suspended membership retained edition';end if;checks:=checks+1;
 perform set_config('role','postgres',true);update public.workspace_unit_memberships set suspended_at=null where unit_id=u and user_id=ids[2];update public.workspace_access_grants set starts_at=now()-interval '2 seconds',expires_at=now()-interval '1 second' where id=(g->>'id')::uuid;perform set_config('role','authenticated',true);
 if exists(select 1 from public.workspace_projects where id=p) then raise exception 'Expired cargo retained edition';end if;checks:=checks+1;
 perform set_config('role','postgres',true);
 insert into workspace_reference_access_test_result values(checks,passwords=(select md5(coalesce(string_agg(id::text||coalesce(encrypted_password,''),'' order by id),'')) from auth.users where id<>all(ids)),keynotes=(select md5(coalesce(string_agg(to_jsonb(k)::text,'' order by id),'')) from public.gba_keynotes k));
 perform set_config('request.jwt.claims','{}',true);
end;$$;
