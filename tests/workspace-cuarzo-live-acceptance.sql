-- Transactional production acceptance. Every fixture and notification is rolled back.
begin;
create temporary table workspace_cuarzo_result(checks integer,credentials_preserved boolean,keynotes_preserved boolean,private_copies integer);
do $$
declare ids uuid[];sessions uuid[];n integer;checks integer:=0;u uuid;p uuid;q uuid;a uuid;b uuid;
 s jsonb;doc jsonb;rows jsonb;copy jsonb;send jsonb;target jsonb;delivery uuid;notice uuid;anchor uuid:=gen_random_uuid();
 ref jsonb;file jsonb;later_file jsonb;denied boolean;credentials text;keynotes text;
 gateway text:='cuarzo-transactional-acceptance';
begin
 select array_agg(gen_random_uuid()),array_agg(gen_random_uuid()) into ids,sessions from generate_series(1,8);
 select md5(coalesce(string_agg(id::text||coalesce(encrypted_password,''),'' order by id),'')) into credentials from auth.users;
 select md5(coalesce(string_agg(to_jsonb(k)::text,'' order by id),'')) into keynotes from public.gba_keynotes k;
 for n in 1..8 loop
  insert into auth.users(id,email,aud,role,raw_user_meta_data,is_sso_user,is_anonymous,created_at,updated_at)
  values(ids[n],'cuarzo-check-'||ids[n]||'@example.invalid','authenticated','authenticated','{}',false,false,now(),now());
  insert into auth.sessions(id,user_id,created_at,updated_at) values(sessions[n],ids[n],now(),now());
 end loop;
 select id into u from public.workspace_units where slug='gimg';
 insert into public.workspace_unit_memberships(unit_id,user_id,membership_status) select u,ids[x],'active' from generate_series(1,7)x;
 insert into public.workspace_access_grants(user_id,unit_id,access_role,scope_type,scope_id,reason)
 values(ids[1],u,'gimg_direction','unit',u,'Transactional Cuarzo acceptance');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[1],'session_id',sessions[1],'role','authenticated')::text,true);perform set_config('role','authenticated',true);
 p:=(public.workspace_command('project.create',jsonb_build_object('unit_id',u,'title','Cuarzo temporary source'))->>'id')::uuid;
 q:=(public.workspace_command('project.create',jsonb_build_object('unit_id',u,'title','Cuarzo temporary recipient'))->>'id')::uuid;
 select id into a from public.workspace_areas where project_id=p and specialty='research';select id into b from public.workspace_areas where project_id=q and specialty='text';
 perform set_config('role','postgres',true);
 insert into public.workspace_access_grants(user_id,unit_id,access_role,scope_type,scope_id,reason) values
 (ids[2],u,'gimg_area_lead','area',a,'Transactional area lead'),(ids[3],u,'gimg_contributor','area',a,'Transactional author'),
 (ids[4],u,'gimg_contributor','area',b,'Transactional recipient'),(ids[5],u,'gimg_quality_manager','unit',u,'Transactional QA'),
 (ids[6],u,'gimg_viewer','project',q,'Transactional viewer');
 for n in 2..4 loop
  insert into public.workspace_assignments(user_id,assignment_role,unit_id,project_id,area_id,assigned_by)
  values(ids[n],'researcher',u,case when n=4 then q else p end,case when n=4 then b else a end,ids[1]);
 end loop;
 insert into public.workspace_delegations(delegate_user_id,delegated_by,unit_id,scope_type,scope_id,permission_keys,starts_at,expires_at,reason)
 values(ids[6],ids[1],u,'project',q,array['reference.read'],now(),now()+interval '1 day','Transactional explicit viewer access');
 update workspace_private.original_limits set enabled=true,gateway_key_hash=encode(extensions.digest(gateway,'sha256'),'hex') where singleton;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[3],'session_id',sessions[3],'role','authenticated')::text,true);perform set_config('role','authenticated',true);
 doc:=jsonb_build_object('type','doc','attrs',jsonb_build_object('schemaVersion',2),'content',jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(
 jsonb_build_object('type','text','text','Preguntas privadas','marks',jsonb_build_array(jsonb_build_object('type','bold'))),
 jsonb_build_object('type','mention','attrs',jsonb_build_object('id',ids[4],'label','Fixture','anchorId',anchor))))));
 s:=public.workspace_save_support(p,jsonb_build_object('title','Cuarzo preguntas','area_id',a,'document_kind','research','content_document',doc,'editor_version',2,'credits','Transactional fixture','palette',jsonb_build_array('#123456')),0);
 if s->>'share_scope'<>'private' or exists(select 1 from public.workspace_deliverables where project_id=p) then raise exception 'Document created an assignment';end if;checks:=checks+1;
 rows:=public.workspace_document_recipients((s->>'id')::uuid);
 for n in 1..6 loop
  if n=3 then continue;end if;
  if not exists(select 1 from jsonb_array_elements(rows)x where x->>'user_id'=ids[n]::text) then raise exception 'Missing authorized role %',n;end if;checks:=checks+1;
 end loop;
 if exists(select 1 from jsonb_array_elements(rows)x where x->>'user_id' in(ids[7]::text,ids[8]::text,ids[3]::text)) then raise exception 'Reserve/outsider/self enumerated';end if;checks:=checks+1;
 if not exists(select 1 from jsonb_array_elements(public.workspace_support_mention_candidates((s->>'id')::uuid))x where x->>'user_id'=ids[4]::text) then raise exception 'Cross edition mention candidate missing';end if;checks:=checks+1;
 denied:=false;begin perform public.workspace_send_document((s->>'id')::uuid,array[ids[4],ids[8]],(s->>'revision')::integer);exception when sqlstate '42501' then denied:=true;end;
 if not denied or jsonb_array_length(public.workspace_document_inbox(u,true))<>0 then raise exception 'Invalid recipient partially sent';end if;checks:=checks+1;
 denied:=false;begin perform public.workspace_send_document((s->>'id')::uuid,array[ids[4]],0);exception when sqlstate '40001' then denied:=true;end;if not denied then raise exception 'Stale send accepted';end if;checks:=checks+1;
 ref:=public.workspace_prepare_support_original((s->>'id')::uuid,'Cuarzo.pdf');
 perform public.workspace_original_gate((ref->>'id')::uuid,gateway);
 file:=public.workspace_original_begin((ref->>'id')::uuid,'Cuarzo.pdf','application/pdf',8,repeat('c',64),gateway);perform public.workspace_original_finish((file->>'id')::uuid,true,gateway);
 send:=public.workspace_send_document((s->>'id')::uuid,array[ids[4],ids[4],ids[6]],(s->>'revision')::integer);
 if (send->>'sent')::integer<>2 or (public.workspace_send_document((s->>'id')::uuid,array[ids[4]],(s->>'revision')::integer)->>'sent')::integer<>0 then raise exception 'Send deduplication failed';end if;checks:=checks+1;
 rows:=public.workspace_document_inbox(u,true);if jsonb_array_length(rows)<>2 then raise exception 'Outbox missing';end if;checks:=checks+1;
 select (x->>'id')::uuid into delivery from jsonb_array_elements(rows)x where x->>'recipient_id'=ids[4]::text;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[4],'session_id',sessions[4],'role','authenticated')::text,true);
 rows:=public.workspace_document_inbox(u);if jsonb_array_length(rows)<>1 then raise exception 'Recipient inbox missing';end if;checks:=checks+1;
 copy:=public.workspace_read_document_delivery(delivery);
 if copy->'content_document'<>doc or copy->'palette'<>jsonb_build_array('#123456') or (copy->>'can_edit')::boolean or copy->>'read_at' is null then raise exception 'Copy content/read-only/read state failed';end if;checks:=checks+1;
 if copy->>'credits'<>'Transactional fixture' or copy->'content_document'->'attrs'->>'schemaVersion'<>'2' then raise exception 'Credits or schema changed';end if;checks:=checks+1;
 denied:=false;begin perform 1 from workspace_private.document_deliveries;exception when sqlstate '42501' then denied:=true;end;if not denied then raise exception 'Direct private-table read allowed';end if;checks:=checks+1;
 denied:=false;begin perform public.workspace_support_bundle(p);exception when sqlstate '42501' then denied:=true;end;if not denied then raise exception 'Cross edition send granted source project';end if;checks:=checks+1;
 denied:=false;begin perform public.workspace_save_support(p,s,(s->>'revision')::integer);exception when sqlstate '42501' then denied:=true;end;if not denied then raise exception 'Recipient edited author';end if;checks:=checks+1;
 if public.workspace_original_access((file->>'id')::uuid,true,gateway)->>'sha256'<>repeat('c',64) then raise exception 'Explicit original access failed';end if;checks:=checks+1;
 select (x->>'id')::uuid into notice from jsonb_array_elements(public.workspace_notifications()->'items')x where x->>'delivery_id'=delivery::text;
 target:=public.workspace_read_notification(notice,null);
 if notice is null or target->>'delivery_id'<>delivery::text or target->>'anchor_id'<>anchor::text then raise exception 'Mention notification anchor failed';end if;checks:=checks+1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[1],'session_id',sessions[1],'role','authenticated')::text,true);
 if jsonb_array_length(public.workspace_support_bundle(p)->'documents')<>0 then raise exception 'Direction read private author document';end if;checks:=checks+1;
 denied:=false;begin perform public.workspace_read_document_delivery(delivery);exception when sqlstate '42501' then denied:=true;end;if not denied then raise exception 'Direction read unaddressed copy';end if;checks:=checks+1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[6],'session_id',sessions[6],'role','authenticated')::text,true);
 rows:=public.workspace_document_inbox(u);if jsonb_array_length(rows)<>1 or (public.workspace_read_document_delivery((rows->0->>'id')::uuid)->>'can_edit')::boolean then raise exception 'Explicit viewer reading failed';end if;checks:=checks+1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[3],'session_id',sessions[3],'role','authenticated')::text,true);
 s:=public.workspace_save_support(p,s||jsonb_build_object('content_document',jsonb_build_object('type','doc','content',jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','New private text'))))),'editor_version',2),(s->>'revision')::integer);
 later_file:=public.workspace_original_begin((ref->>'id')::uuid,'Later.pdf','application/pdf',8,repeat('d',64),gateway);perform public.workspace_original_finish((later_file->>'id')::uuid,true,gateway);
 perform public.workspace_support_action((s->>'id')::uuid,'archive','{}',(s->>'revision')::integer);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[4],'session_id',sessions[4],'role','authenticated')::text,true);
 if public.workspace_read_document_delivery(delivery)->'content_document'<>doc then raise exception 'Sent snapshot changed';end if;checks:=checks+1;
 denied:=false;begin perform public.workspace_original_descriptor((later_file->>'id')::uuid);exception when sqlstate '42501' then denied:=true;end;if not denied then raise exception 'Later original leaked';end if;checks:=checks+1;
 perform set_config('role','postgres',true);update public.workspace_assignments set starts_at=now()-interval '2 days',expires_at=now()-interval '1 second' where user_id=ids[4];perform set_config('role','authenticated',true);
 denied:=false;begin perform public.workspace_read_document_delivery(delivery);exception when sqlstate '42501' then denied:=true;end;if not denied then raise exception 'Expired assignment read copy';end if;checks:=checks+1;
 perform set_config('role','postgres',true);update public.workspace_unit_memberships set membership_status='suspended' where user_id=ids[6] and unit_id=u;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[6],'session_id',sessions[6],'role','authenticated')::text,true);perform set_config('role','authenticated',true);
 denied:=false;begin perform public.workspace_document_inbox(u);exception when sqlstate '42501' then denied:=true;end;if not denied then raise exception 'Suspended recipient read inbox';end if;checks:=checks+1;
 perform set_config('role','postgres',true);delete from auth.sessions where id=sessions[3];
 perform set_config('request.jwt.claims',jsonb_build_object('sub',ids[3],'session_id',sessions[3],'role','authenticated')::text,true);perform set_config('role','authenticated',true);
 denied:=false;begin perform public.workspace_document_inbox(u,true);exception when sqlstate '42501' then denied:=true;end;if not denied then raise exception 'Revoked session read inbox';end if;checks:=checks+1;
 perform set_config('role','postgres',true);
 insert into workspace_cuarzo_result values(checks,
 credentials=(select md5(coalesce(string_agg(id::text||coalesce(encrypted_password,''),'' order by id),'')) from auth.users where not(id=any(ids))),
 keynotes=(select md5(coalesce(string_agg(to_jsonb(k)::text,'' order by id),'')) from public.gba_keynotes k),
 (select count(*)::integer from workspace_private.document_deliveries where document_id=(s->>'id')::uuid));
end;$$;
select * from workspace_cuarzo_result;
rollback;
