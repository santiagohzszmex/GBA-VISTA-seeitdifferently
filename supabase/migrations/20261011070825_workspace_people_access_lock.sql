-- Workspace 1.5.6: serialize legacy membership creation against current administration.
create or replace function workspace_private.people_guard(u uuid,action text,value jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare person uuid;m public.workspace_unit_memberships;e timestamptz;g public.workspace_access_grants;d public.workspace_delegations;brief uuid;result jsonb:=value;key text;
begin
 if action not in('member.save','grant.save','assignment.save','delegation.save','grant.revoke','delegation.revoke') then return value;end if;
 perform workspace_private.require(case when action='member.save' then case when value->>'membership_status' in('suspended','inactive','departed') then 'unit.members.suspend' else 'unit.members.invite' end else 'unit.roles.grant' end,u);
 person:=nullif(value->>'user_id','')::uuid;
 if action='member.save' and person is null then select id into person from public.usuarios where lower(nombre)=lower(trim(leading '@' from trim(value->>'handle')));end if;
 if action='grant.revoke' then select * into g from public.workspace_access_grants where id=(value->>'id')::uuid and unit_id=u;person:=g.user_id;end if;
 if action='delegation.revoke' then select * into d from public.workspace_delegations where id=(value->>'id')::uuid and unit_id=u;person:=d.delegate_user_id;end if;
 if person is null then raise exception 'GBA ID o registro no encontrado';end if;
 -- Lock the stable profile before checking an existing or absent membership.
 -- New and legacy entry points now serialize the same target in the same order.
 perform 1 from public.usuarios where id=person for update;
 select * into m from public.workspace_unit_memberships where unit_id=u and user_id=person for update;
 result:=result||jsonb_build_object('user_id',person);
 if action='member.save' then
  if m.user_id is not null and value->>'membership_status' not in('suspended','inactive','departed') then perform workspace_private.require('unit.roles.grant',u);end if;
  if value->>'membership_status' in('suspended','inactive','departed') then
   if length(trim(coalesce(value->>'reason','')))<3 then raise exception 'Escribe el motivo del cambio de acceso';end if;
   if not(value?'expires_at') then result:=result||jsonb_build_object('expires_at',m.expires_at);end if;
  elsif nullif(value->>'expires_at','')::timestamptz<=now() then raise exception 'La vigencia debe estar en el futuro';end if;
  return result;
 end if;
 if action in('grant.revoke','delegation.revoke') then
  if length(trim(coalesce(value->>'reason','')))<3 then raise exception 'Escribe el motivo de la revocación';end if;
  return result;
 end if;
 if not workspace_private.member(u,person) then raise exception 'La persona necesita una membresía activa y vigente';end if;
 e:=workspace_private.member_expiry(u,person,nullif(value->>'expires_at','')::timestamptz);
 result:=result||jsonb_build_object('expires_at',e);
 if action='grant.save' and not exists(select 1 from workspace_private.role_permissions where role=value->>'access_role' and role like 'gimg_%') then raise exception 'Rol técnico inválido para GIMG';end if;
 if action='grant.save' and exists(select 1 from public.workspace_access_grants where user_id=person and unit_id=u and scope_type=value->>'scope_type' and scope_id=(value->>'scope_id')::uuid and revoked_at is null and (expires_at is null or expires_at>now())) then raise exception 'Ya existe un cargo vigente en ese alcance; modifica o quita el cargo anterior';end if;
 if action='delegation.save' then
  if e is null or e<=coalesce(nullif(value->>'starts_at','')::timestamptz,now()) then raise exception 'La delegación necesita un vencimiento futuro';end if;
  if jsonb_typeof(value->'permission_keys') is distinct from 'array' or jsonb_array_length(value->'permission_keys')=0 then raise exception 'Elige al menos un permiso';end if;
  for key in select jsonb_array_elements_text(value->'permission_keys') loop
   if not workspace_private.authorizes_scope(key,u,value->>'scope_type',(value->>'scope_id')::uuid) then raise exception 'No puedes delegar este permiso en ese alcance: %',key;end if;
   if not workspace_private.permission_delegable(key) then raise exception 'Este permiso no se puede delegar: %',key;end if;
   if key in('unit.members.invite','unit.members.suspend') and value->>'scope_type'<>'unit' then raise exception 'Los permisos del equipo requieren alcance de unidad';end if;
  end loop;
  if length(trim(coalesce(value->>'reason','')))<20 or length(value->>'reason')>10000 or lower(value->>'reason') like '%[escribe el motivo]%' then raise exception 'Completa el mandato escrito (mínimo 20 caracteres) con un motivo real';end if;
  insert into workspace_private.written_briefs(unit_id,text,created_by) values(u,trim(value->>'reason'),auth.uid()) returning id into brief;
  result:=result||jsonb_build_object('written_brief_id',brief);
 end if;
 return result;
end;$$;

revoke all on function workspace_private.people_guard(uuid,text,jsonb) from public,anon,authenticated;
