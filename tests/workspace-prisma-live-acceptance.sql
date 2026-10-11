-- Execute only inside BEGIN ... ROLLBACK. No test file is uploaded to live R2.
create temporary table workspace_prisma_test_result(checks integer,credentials_preserved boolean,keynotes_preserved boolean);
do $$
declare
 ids uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 sessions uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 u uuid; p uuid; other_p uuid; a uuid; other_a uuid; rich jsonb; concept jsonb; guide jsonb; mood jsonb; original jsonb; bundle jsonb;
 grant_id uuid; denied boolean; checks integer:=0; n integer; allocated_snapshot bigint; password_snapshot text; keynote_snapshot text; gateway_key text:='disposable-prisma-gateway-test';
begin
 select allocated_bytes into allocated_snapshot from workspace_private.original_limits;
 select md5(string_agg(id::text||coalesce(encrypted_password,''),'' order by id)) into password_snapshot from auth.users;
 select md5(coalesce(string_agg(to_jsonb(k)::text,'' order by id),'')) into keynote_snapshot from public.gba_keynotes k;
 for n in 1..8 loop
  insert into auth.users(id,email,aud,role,raw_user_meta_data,is_sso_user,is_anonymous,created_at,updated_at)
  values(ids[n],'workspace-prisma-test-'||ids[n]||'@example.invalid','authenticated','authenticated',jsonb_build_object('nombre','prisma-test-'||ids[n]),false,false,now(),now());
  insert into auth.sessions(id,user_id,created_at,updated_at) values(sessions[n],ids[n],now(),now());
 end loop;
 select id into u from public.workspace_units where slug='gimg';
 insert into public.workspace_unit_memberships(unit_id,user_id,membership_status) select u,x,'active' from unnest(ids) x;
 insert into public.workspace_access_grants(user_id,unit_id,access_role,scope_type,scope_id,reason)
 values(ids[1],u,'gimg_direction','unit',u,'Disposable Prisma acceptance'),(ids[2],u,'gimg_production_lead','unit',u,'Disposable Prisma acceptance'),(ids[4],u,'gimg_contributor','unit',u,'Disposable Prisma acceptance'),(ids[5],u,'gimg_quality_manager','unit',u,'Disposable Prisma acceptance');
 insert into public.workspace_access_grants(user_id,access_role,scope_type,reason) values(ids[6],'gba_platform_owner','platform','Disposable Prisma technical owner');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[1],'session_id',sessions[1],'role','authenticated')::text,true);perform set_config('role','authenticated',true);
 p:=(public.workspace_command('project.create',jsonb_build_object('unit_id',u,'title','Disposable Prisma edition'))->>'id')::uuid;
 other_p:=(public.workspace_command('project.create',jsonb_build_object('unit_id',u,'title','Unassigned Prisma edition'))->>'id')::uuid;
 select id into a from public.workspace_areas where project_id=p and specialty='art';select id into other_a from public.workspace_areas where project_id=p and specialty='research';
 perform public.workspace_command('task.create',jsonb_build_object('unit_id',u,'project_id',p,'area_id',a,'title','Disposable Prisma artist','responsible_id',ids[4]));
 perform set_config('role','postgres',true);
 insert into public.workspace_access_grants(user_id,unit_id,access_role,scope_type,scope_id,reason,expires_at)
 values(ids[3],u,'gimg_area_lead','area',a,'Disposable Prisma lead',null),(ids[7],u,'gimg_project_director','project',p,'Disposable Prisma direction',now()+interval '1 day'),(ids[8],u,'gimg_workspace_coordinator','project',p,'Disposable Prisma coordinator',null);
 insert into public.workspace_assignments(user_id,assignment_role,unit_id,project_id,area_id,assigned_by)
 values(ids[3],'area_lead',u,p,a,ids[1]),(ids[7],'direction',u,p,null,ids[1]),(ids[8],'production',u,p,null,ids[1]);
 rich:='{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Private reference original","marks":[{"type":"textStyle","attrs":{"color":"#673AB7","fontFamily":"Georgia, serif"}}]}]}]}'::jsonb;
 perform set_config('role','authenticated',true);
 concept:=public.workspace_save_reference(p,jsonb_build_object('kind','concept','title','Disposable concept','content_document',rich,'palette',jsonb_build_array('#673AB7')),0);
 if concept->'content_document'<>rich or concept->>'content_markdown' not like 'Private reference original%' then raise exception 'Reference content mismatch';end if;checks:=checks+1;
 concept:=public.workspace_save_reference(p,concept||jsonb_build_object('title','Updated disposable concept'),1);
 denied:=false;begin perform public.workspace_save_reference(p,concept,1);exception when serialization_failure then denied:=true;end;if not denied then raise exception 'Stale reference accepted';end if;checks:=checks+1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[2],'session_id',sessions[2],'role','authenticated')::text,true);
 denied:=false;begin perform public.workspace_save_reference(p,jsonb_build_object('kind','concept','title','Production concept','content_document',rich),0);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Production changed concept';end if;checks:=checks+1;
 perform public.workspace_save_reference(p,jsonb_build_object('kind','instructions','title','Production guide','content_document',rich),0);checks:=checks+1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[3],'session_id',sessions[3],'role','authenticated')::text,true);
 guide:=public.workspace_save_reference(p,jsonb_build_object('kind','instructions','area_id',a,'title','Art guide','content_document',rich),0);checks:=checks+1;
 denied:=false;begin perform public.workspace_save_reference(p,jsonb_build_object('kind','instructions','area_id',other_a,'title','Other area guide','content_document',rich),0);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Lead edited another area';end if;checks:=checks+1;
 for n in 4..6 loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[n],'session_id',sessions[n],'role','authenticated')::text,true);
  denied:=false;begin perform public.workspace_save_reference(p,jsonb_build_object('kind','concept','title','Unauthorized creative change','content_document',rich),0);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Unexpected creative authority';end if;checks:=checks+1;
 end loop;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[8],'session_id',sessions[8],'role','authenticated')::text,true);
 denied:=false;begin perform public.workspace_save_reference(p,jsonb_build_object('kind','concept','title','Coordinator concept','content_document',rich),0);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Coordinator changed concept';end if;checks:=checks+1;
 perform public.workspace_save_reference(p,jsonb_build_object('kind','instructions','title','Coordinator guide','content_document',rich),0);checks:=checks+1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[4],'session_id',sessions[4],'role','authenticated')::text,true);
 bundle:=public.workspace_reference_bundle(p);
 if jsonb_array_length(bundle->'references')<>4 then raise exception 'Assigned references missing';end if;checks:=checks+1;
 denied:=false;begin perform public.workspace_reference_bundle(other_p);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Unassigned edition leaked';end if;checks:=checks+1;
 denied:=false;begin perform 1 from workspace_private.edition_references;exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Private reference table leaked';end if;checks:=checks+1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[1],'session_id',sessions[1],'role','authenticated')::text,true);
 mood:=public.workspace_save_reference(p,jsonb_build_object('kind','moodboard','title','Private moodboard','content_document',rich),0);
 perform set_config('role','postgres',true);
 update workspace_private.original_limits set enabled=true,gateway_url='https://disposable-prisma.workers.dev',gateway_key_hash=encode(extensions.digest(gateway_key,'sha256'),'hex');
 perform set_config('role','authenticated',true);
 denied:=false;begin perform public.workspace_original_gate((mood->>'id')::uuid,'invalid');exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Gateway secret bypassed';end if;checks:=checks+1;
 denied:=false;begin perform public.workspace_original_begin((concept->>'id')::uuid,'Not moodboard.pdf','application/pdf',100,repeat('a',64),gateway_key);exception when others then if sqlerrm not like 'PDF sólo%' then raise;end if;denied:=true;end;if not denied then raise exception 'Concept accepted PDF';end if;checks:=checks+1;
 original:=public.workspace_original_begin((mood->>'id')::uuid,'Original.pdf','application/pdf',100,repeat('a',64),gateway_key);
 perform set_config('role','postgres',true);update public.workspace_unit_memberships set membership_status='inactive' where unit_id=u and user_id=ids[1];perform set_config('role','authenticated',true);
 denied:=false;begin perform public.workspace_original_finish((original->>'id')::uuid,true,gateway_key);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Removed member completed upload';end if;checks:=checks+1;
 perform set_config('role','postgres',true);update public.workspace_unit_memberships set membership_status='active' where unit_id=u and user_id=ids[1];perform set_config('role','authenticated',true);
 perform public.workspace_original_finish((original->>'id')::uuid,true,gateway_key);checks:=checks+1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[4],'session_id',sessions[4],'role','authenticated')::text,true);
 if (public.workspace_original_access((original->>'id')::uuid,false,gateway_key)->>'sha256')<>repeat('a',64) then raise exception 'Original metadata mismatch';end if;checks:=checks+1;
 denied:=false;begin perform public.workspace_original_finish((original->>'id')::uuid,false,gateway_key);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Other author released reservation';end if;checks:=checks+1;
 perform set_config('role','postgres',true);update workspace_private.original_limits set capacity_bytes=allocated_bytes;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[1],'session_id',sessions[1],'role','authenticated')::text,true);perform set_config('role','authenticated',true);
 denied:=false;begin perform public.workspace_original_begin((mood->>'id')::uuid,'Over capacity.png','image/png',1,repeat('a',64),gateway_key);exception when others then if sqlerrm not like 'Se alcanzó el límite de 10 GB%' then raise;end if;denied:=true;end;if not denied then raise exception 'Capacity exceeded';end if;checks:=checks+1;
 perform set_config('role','postgres',true);update workspace_private.original_limits set capacity_bytes=10000000000,write_operations=200000;
 perform set_config('role','authenticated',true);
 denied:=false;begin perform public.workspace_original_begin((mood->>'id')::uuid,'Over operation cap.png','image/png',1,repeat('a',64),gateway_key);exception when others then if sqlerrm not like 'Se alcanzó el límite de uso gratuito%' then raise;end if;denied:=true;end;if not denied then raise exception 'Operation cap exceeded';end if;checks:=checks+1;
 perform set_config('role','postgres',true);update workspace_private.original_limits set write_operations=0;
 perform set_config('role','authenticated',true);
 perform public.workspace_archive_reference((mood->>'id')::uuid,(mood->>'revision')::int);
 denied:=false;begin perform public.workspace_original_access((original->>'id')::uuid,false,gateway_key);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Archived original leaked';end if;checks:=checks+1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[7],'session_id',sessions[7],'role','authenticated')::text,true);
 denied:=false;begin perform public.workspace_save_reference(p,jsonb_build_object('kind','concept','title','Undelegated product concept','content_document',rich),0);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Product creative authority assumed';end if;checks:=checks+1;
 perform set_config('role','postgres',true);
 insert into public.workspace_delegations(delegate_user_id,delegated_by,unit_id,scope_type,scope_id,permission_keys,starts_at,expires_at,reason)
 values(ids[7],ids[1],u,'project',p,array['reference.manage_creative'],now()-interval '1 minute',now()+interval '1 minute','Explicit test creative mandate') returning id into grant_id;
 perform set_config('role','authenticated',true);
 perform public.workspace_save_reference(p,jsonb_build_object('kind','concept','title','Explicit product concept','content_document',rich),0);checks:=checks+1;
 perform set_config('role','postgres',true);update public.workspace_delegations set expires_at=now()-interval '1 second',starts_at=now()-interval '1 day' where id=grant_id;
 perform set_config('role','authenticated',true);
 denied:=false;begin perform public.workspace_save_reference(p,jsonb_build_object('kind','concept','title','Expired product concept','content_document',rich),0);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Expired creative authority accepted';end if;checks:=checks+1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[4],'session_id',gen_random_uuid(),'role','authenticated')::text,true);
 denied:=false;begin perform public.workspace_reference_bundle(p);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Revoked session accepted';end if;checks:=checks+1;
 perform set_config('role','postgres',true);
 if (select allocated_bytes from workspace_private.original_limits)<>allocated_snapshot+100 then raise exception 'Archive unexpectedly freed storage';end if;checks:=checks+1;
 insert into workspace_prisma_test_result select checks,
 password_snapshot=(select md5(string_agg(id::text||coalesce(encrypted_password,''),'' order by id)) from auth.users where not id=any(ids)),
 keynote_snapshot=(select md5(coalesce(string_agg(to_jsonb(k)::text,'' order by id),'')) from public.gba_keynotes k);
 if not (select credentials_preserved and keynotes_preserved from workspace_prisma_test_result) then raise exception 'Existing data changed';end if;
 if checks<>28 then raise exception 'Acceptance checks incomplete: %',checks;end if;
end;$$;
select * from workspace_prisma_test_result;
