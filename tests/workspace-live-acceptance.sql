-- Disposable fixture only; always execute inside a transaction ending in ROLLBACK.
create temporary table workspace_release_test_result (checks integer, credentials_preserved boolean, keynotes_preserved boolean);
do $$
declare
 director uuid:=gen_random_uuid(); writer uuid:=gen_random_uuid(); artist uuid:=gen_random_uuid();
 ds uuid:=gen_random_uuid(); ws uuid:=gen_random_uuid(); ars uuid:=gen_random_uuid();
 unit uuid; project uuid; second_project uuid; area uuid; task jsonb; draft jsonb; refs jsonb; rich jsonb;
 original_passwords text; original_keynotes text; denied boolean; checks integer:=0;
begin
 select md5(string_agg(id::text||coalesce(encrypted_password,''),'' order by id)) into original_passwords from auth.users;
 select md5(coalesce(string_agg(to_jsonb(k)::text,'' order by id),'')) into original_keynotes from public.gba_keynotes k;
 insert into auth.users(id,email,aud,role,raw_user_meta_data,is_sso_user,is_anonymous,created_at,updated_at)
 select x.id,'workspace-test-'||x.id||'@example.invalid','authenticated','authenticated',jsonb_build_object('nombre','workspace-test-'||x.id),false,false,now(),now()
 from (values(director),(writer),(artist)) x(id);
 insert into auth.sessions(id,user_id,created_at,updated_at) values(ds,director,now(),now()),(ws,writer,now(),now()),(ars,artist,now(),now());
 select id into unit from public.workspace_units where slug='gimg';
 if unit is null then raise exception 'GIMG unit missing';end if;
 insert into public.workspace_unit_memberships(unit_id,user_id,membership_status) values(unit,director,'active'),(unit,writer,'active'),(unit,artist,'active');
 insert into public.workspace_access_grants(user_id,unit_id,access_role,scope_type,scope_id,reason)
 values(director,unit,'gimg_direction','unit',unit,'Disposable release acceptance'),(writer,unit,'gimg_contributor','unit',unit,'Disposable release acceptance'),(artist,unit,'gimg_contributor','unit',unit,'Disposable release acceptance');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',director,'session_id',ds,'role','authenticated')::text,true);
 perform set_config('role','authenticated',true);
 project:=(public.workspace_command('project.create',jsonb_build_object('unit_id',unit,'title','Disposable acceptance edition'))->>'id')::uuid;
 second_project:=(public.workspace_command('project.create',jsonb_build_object('unit_id',unit,'title','Unassigned acceptance edition'))->>'id')::uuid;
 select id into area from public.workspace_areas where project_id=project and specialty='research';
 task:=public.workspace_command('task.create',jsonb_build_object('unit_id',unit,'project_id',project,'area_id',area,'title','Disposable investigation','responsible_id',writer));
 perform public.workspace_command('task.create',jsonb_build_object('unit_id',unit,'project_id',project,'area_id',area,'title','Disposable reference reader','responsible_id',artist));
 perform set_config('role','postgres',true);
 insert into public.workspace_assignments(user_id,assignment_role,unit_id,project_id,assigned_by) values(artist,'illustration',unit,project,director);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',writer,'session_id',ws,'role','authenticated')::text,true);
 perform set_config('role','authenticated',true);
 rich:='{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Reviewed release investigation","marks":[{"type":"textStyle","attrs":{"color":"#663399","fontFamily":"Georgia, serif"}}]}]}]}'::jsonb;
 draft:=public.workspace_save_draft((task->>'id')::uuid,jsonb_build_object('content_document',rich,'content_markdown','Do not publish this spoof','credits','Disposable fixture'),0,0);
 if draft->>'content_markdown' not like 'Reviewed release investigation%' then raise exception 'Canonical document mismatch';end if;checks:=checks+1;
 if public.workspace_edition_documents(project)<>'[]'::jsonb then raise exception 'Private draft leaked into library';end if;checks:=checks+1;
 denied:=false;begin perform public.workspace_save_draft((task->>'id')::uuid,jsonb_build_object('content_document',rich),0,0);exception when serialization_failure then denied:=true;end;
 if not denied then raise exception 'Stale draft was accepted';end if;checks:=checks+1;
 denied:=false;begin perform 1 from workspace_private.drafts;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Private table was readable';end if;checks:=checks+1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',director,'session_id',ds,'role','authenticated')::text,true);
 if public.workspace_draft((task->>'id')::uuid) is not null then raise exception 'Direction read another author draft';end if;checks:=checks+1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',writer,'session_id',ws,'role','authenticated')::text,true);
 task:=public.workspace_submit_draft((task->>'id')::uuid,(draft->>'revision')::integer,(task->>'revision')::integer);
 if task->>'state'<>'review' or (task->>'current_version')::integer<>1 then raise exception 'Submission failed';end if;checks:=checks+1;
 if public.workspace_edition_documents(project)<>'[]'::jsonb then raise exception 'Unapproved submission leaked into library';end if;checks:=checks+1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',director,'session_id',ds,'role','authenticated')::text,true);
 task:=public.workspace_command('task.transition',jsonb_build_object('project_id',project,'deliverable_id',task->>'id','state','area_approved'),(task->>'revision')::integer);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',artist,'session_id',ars,'role','authenticated')::text,true);
 refs:=public.workspace_edition_documents(project);
 if jsonb_array_length(refs)<>1 or refs->0->'content_document'<>rich then raise exception 'Approved reference missing or altered';end if;checks:=checks+1;
 if exists(select 1 from public.workspace_versions where deliverable_id=(task->>'id')::uuid) then raise exception 'Raw submission leaked across assignments';end if;checks:=checks+1;
 denied:=false;begin perform public.workspace_edition_documents(second_project);exception when others then denied:=true;end;
 if not denied then raise exception 'Unassigned edition was readable';end if;checks:=checks+1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',director,'session_id',ds,'role','authenticated')::text,true);
 task:=public.workspace_command('review.reopen',jsonb_build_object('project_id',project,'deliverable_id',task->>'id','reason','A new release test version is needed'),(task->>'revision')::integer);
 if jsonb_array_length(public.workspace_edition_documents(project))<>1 then raise exception 'Reopening lost approved snapshot';end if;checks:=checks+1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',writer,'session_id',gen_random_uuid(),'role','authenticated')::text,true);
 denied:=false;begin perform public.workspace_draft((task->>'id')::uuid);exception when others then denied:=true;end;
 if not denied then raise exception 'Invalid session was accepted';end if;checks:=checks+1;
 perform set_config('role','postgres',true);
 insert into workspace_release_test_result select checks,
 original_passwords=(select md5(string_agg(id::text||coalesce(encrypted_password,''),'' order by id)) from auth.users where id not in(director,writer,artist)),
 original_keynotes=(select md5(coalesce(string_agg(to_jsonb(k)::text,'' order by id),'')) from public.gba_keynotes k);
 if checks<>12 then raise exception 'Acceptance checks incomplete';end if;
 if not (select credentials_preserved and keynotes_preserved from workspace_release_test_result) then raise exception 'Original identity or Keynotes changed';end if;
end;$$;
select * from workspace_release_test_result;
