begin;
alter table public.gimg_recruitment_contacts alter column email drop not null;
alter table public.gimg_recruitment_contacts add column phone text;
alter table public.gimg_recruitment_contacts add constraint gimg_contact_one_channel check ((email is not null)::integer+(phone is not null)::integer=1);
alter table public.gimg_recruitment_contacts add constraint gimg_contact_phone_format check(phone is null or phone ~ '^\+[1-9][0-9]{7,14}$');
-- Contacts remain private. Reviewers may read submitted applications' contacts
-- before a decision; candidates can still read only their own contact.
alter policy recruitment_contacts on public.gimg_recruitment_contacts using(exists(select 1 from public.gimg_recruitment_applications a where a.id=application_id and ((a.user_id=auth.uid() and gimg_recruitment_private.active_session()) or (a.phase='submitted' and gimg_recruitment_private.reviewer()))));
create function gimg_recruitment_private.save_application_contact(p_cycle text,p_answers jsonb,p_email text,p_phone text,p_complete boolean,p_terms text,p_truth boolean,p_revision integer) returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
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
 p_email:=nullif(lower(trim(p_email)),'');
 p_phone:=nullif(trim(p_phone),'');
 if p_email is not null and p_phone is not null then raise exception 'Elige correo o teléfono, no ambos';end if;
 if p_phone is not null and p_phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'Teléfono de contacto inválido';end if;
 if p_email is not null and (length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Correo de contacto inválido';end if;
 if p_complete and (p_terms is distinct from c.terms_version or not coalesce(p_truth,false) or (p_email is null and p_phone is null)) then raise exception 'Acepta las condiciones, confirma tus respuestas y completa un correo o teléfono de contacto';end if;
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
 if p_email is not null or p_phone is not null then
  insert into public.gimg_recruitment_contacts(application_id,email,phone) values(v_id,p_email,p_phone)
  on conflict(application_id) do update set email=excluded.email,phone=excluded.phone;
 else delete from public.gimg_recruitment_contacts where application_id=v_id;end if;
 if p_complete then
  insert into public.gimg_recruitment_reviews(application_id) values(v_id) on conflict do nothing;
  insert into public.gimg_recruitment_audit(application_id,actor_id,action,details) values(v_id,auth.uid(),'submitted',jsonb_build_object('terms_version',p_terms));
 end if;
 select * into old from public.gimg_recruitment_applications where id=v_id;
 return jsonb_build_object('id',v_id,'revision',old.revision,'submitted',p_complete);
end;$$;

revoke all on function gimg_recruitment_private.save_application_contact(text,jsonb,text,text,boolean,text,boolean,integer) from public;
grant execute on function gimg_recruitment_private.save_application_contact(text,jsonb,text,text,boolean,text,boolean,integer) to authenticated;
create function public.gimg_save_application_contact(p_cycle text,p_answers jsonb,p_email text default null,p_phone text default null,p_complete boolean default false,p_terms text default null,p_truth boolean default false,p_revision integer default 0) returns jsonb language sql security invoker set search_path=pg_catalog,pg_temp as $$
 select gimg_recruitment_private.save_application_contact(p_cycle,p_answers,p_email,p_phone,p_complete,p_terms,p_truth,p_revision);
$$;
revoke all on function public.gimg_save_application_contact(text,jsonb,text,text,boolean,text,boolean,integer) from public;
grant execute on function public.gimg_save_application_contact(text,jsonb,text,text,boolean,text,boolean,integer) to authenticated;
-- Keep the original endpoint for open tabs and existing email-only clients.
create or replace function gimg_recruitment_private.save_application(p_cycle text,p_answers jsonb,p_email text,p_complete boolean,p_terms text,p_truth boolean,p_revision integer) returns jsonb language sql security definer set search_path=pg_catalog,pg_temp as $$
 select gimg_recruitment_private.save_application_contact(p_cycle,p_answers,p_email,null,p_complete,p_terms,p_truth,p_revision);
$$;
commit;
