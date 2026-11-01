-- New intake, separate from the previous applications, contacts and decisions.
set lock_timeout='5s';
update public.gimg_recruitment_cycles set is_open=false where key='gimg-otono-2026';
insert into public.gimg_recruitment_cycles(key,title,community,opens_at,closes_at,is_open,terms_version,target_places,reserve_places,closed_areas,remaining_places)
values('gimg-noviembre-2026','La siguiente etapa de GIMG · noviembre 2026','Plantel Nezahualcóyotl de la Escuela Preparatoria de la UAEMéx','2026-11-01 00:00:00-06','2026-11-16 00:00:00-06',true,'2026-11-01',5,5,'{}',
 '{"video_editing":1,"animation_2d":1,"animation_3d":1,"illustration":1,"design":1,"production":0,"research":0,"writing":0,"photography":0,"qa":0}');

-- Keep the deployed validator and review protections; change only the choice
-- list and per-cycle selection cap. Fail rather than replacing unexpected code.
do $$declare source text;marker text;begin
 source:=pg_get_functiondef('gimg_recruitment_private.validate_answers(jsonb,boolean)'::regprocedure);
 marker:='''production'',''research'',''writing'',''design'',''illustration'',''photography'',''qa''';
 if (length(source)-length(replace(source,marker,'')))/length(marker)<>2 then raise exception 'Unexpected recruitment area validator';end if;
 execute replace(source,marker,marker||',''video_editing'',''animation_2d'',''animation_3d''');
 source:=pg_get_functiondef('gimg_recruitment_private.review(uuid,jsonb,integer)'::regprocedure);
 marker:='case when v_decision=''accepted'' then 16 else 5 end';
 if strpos(source,marker)=0 then raise exception 'Unexpected recruitment review capacity';end if;
 execute replace(source,marker,'select case when v_decision=''accepted'' then case when c.key=''gimg-otono-2026'' then 16 else c.target_places end else c.reserve_places end from public.gimg_recruitment_cycles c join public.gimg_recruitment_applications a on a.cycle_key=c.key where a.id=p_id');
end;$$;

-- Both policies must constrain the actual cycle in the object path. The
-- restrictive guard also protects against pre-existing permissive policies.
alter policy gimg_sample_upload on storage.objects with check(
 bucket_id='gimg-recruitment' and gimg_recruitment_private.active_session()
 and (storage.foldername(name))[1]=auth.uid()::text
 and exists(select 1 from public.gimg_recruitment_cycles c where c.key=(storage.foldername(name))[2] and c.is_open and now()>=c.opens_at and now()<c.closes_at));
alter policy gimg_sample_upload_guard on storage.objects with check(
 bucket_id<>'gimg-recruitment' or (gimg_recruitment_private.active_session()
 and (storage.foldername(name))[1]=auth.uid()::text
 and exists(select 1 from public.gimg_recruitment_cycles c where c.key=(storage.foldername(name))[2] and c.is_open and now()>=c.opens_at and now()<c.closes_at)));
-- Public wrappers, execution grants, reviewer authority, immutable submissions,
-- contact isolation and all existing read/update/delete policies are unchanged.
reset lock_timeout;
notify pgrst,'reload schema';
