import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs/promises';
export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const sid=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export async function fixture(){
 const db=new PGlite({extensions:{pgcrypto}});
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;create schema extensions;create extension pgcrypto with schema extensions;
 create table auth.users(id uuid primary key,email text,encrypted_password text,updated_at timestamptz,banned_until timestamptz,deleted_at timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),created_at timestamptz default now(),refreshed_at timestamp default now(),not_after timestamptz,aal text default 'aal1');
 create table auth.mfa_factors(id uuid primary key default gen_random_uuid(),user_id uuid,status text);
 create schema vault;create table vault.secrets(id uuid primary key default gen_random_uuid(),secret text not null,name text,key_id uuid);
 create view vault.decrypted_secrets as select id,key_id,secret as decrypted_secret from vault.secrets;
 create function vault.create_secret(new_secret text,new_name text default null,new_description text default '',new_key_id uuid default null) returns uuid language sql as $$insert into vault.secrets(secret,name) values(new_secret,new_name) returning id$$;
 create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;
 grant usage on schema auth to authenticated;
 grant execute on function auth.uid(),auth.jwt() to authenticated;
 create table public.usuarios(id uuid primary key references auth.users(id),rol text,nombre text,nombre_publico text,frase_seguridad text,sello_editorial text);
 create table public.editoriales(id uuid primary key default gen_random_uuid(),nombre text,slug text,descripcion text,created_by uuid);
 create table public.solicitudes_editoriales(id uuid primary key,usuario_id uuid,nombre_noticiero text,descripcion text);
 create function public.vista_is_platform_admin() returns boolean language sql stable security definer as $$select exists(select 1 from public.usuarios where id=auth.uid() and rol in ('Dueño','Admin'))$$;
 create function public.vista_editorial_slugify(value text) returns text language sql immutable strict as $$select trim(both '-' from regexp_replace(lower(value),'[^a-z0-9]+','-','g'))$$;
 create table public.editorial_invitations(id uuid primary key,editorial_id uuid references public.editoriales(id),invited_user_id uuid references auth.users(id),role text,status text,expires_at timestamptz,invited_by uuid,responded_at timestamptz,updated_at timestamptz);
 create table public.editorial_members(editorial_id uuid,usuario_id uuid,role text,status text,invited_by uuid,updated_at timestamptz,unique(editorial_id,usuario_id));
 create table public.editorial_audit_log(editorial_id uuid,actor_id uuid,action text,target_type text,target_id text,details jsonb);
 create table public.gimg_recruitment_reviewers(user_id uuid,role text);
 create schema gimg_recruitment_private;grant usage on schema gimg_recruitment_private to authenticated;
 create function gimg_recruitment_private.active_session() returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$select auth.uid() is not null and exists(select 1 from auth.sessions where user_id=auth.uid() and id::text=auth.jwt()->>'session_id')$$;
 create table gimg_recruitment_private.identities(user_id uuid,recovery_hash text);
 create function public.gimg_recover_identity(text,text,text) returns boolean language sql as $$select false$$;
 create function gimg_recruitment_private.recover_identity(text,text,text) returns boolean language sql as $$select false$$;`);
 for(let n=1;n<=8;n++){
  await db.query("insert into auth.users(id,email,encrypted_password,updated_at) values($1,$2,extensions.crypt('GBA-1234-SecureVault',extensions.gen_salt('bf',4)),now())",[id(n),`sepia-synthetic-${n}@example.invalid`]);
  await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sid(n),id(n)]);
  await db.query('insert into public.usuarios(id,rol,nombre,frase_seguridad) values($1,$2,$3,$4)',[id(n),n===1?'Dueño':null,`Persona sintética ${n}`,'synthetic recovery only']);
 }
 for(const file of ['202608010001_gba_workspace_phase1.sql','202608140001_public_keynotes.sql','20261010005048_workspace_gimg.sql','20261010005053_workspace_licenses.sql','20261010005130_gba_id_secure_gateway.sql','20261010012802_workspace_owner_desktop_access.sql'])await db.exec(await fs.readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 await db.exec(await fs.readFile(new URL('../../supabase/migrations/20261102233258_sepia_access_service.sql',import.meta.url),'utf8'));
 const scalar=async(q,p=[])=>Object.values((await db.query(q,p)).rows[0])[0];
 const gateway=async(op,data)=>db.transaction(async tx=>{await tx.exec('set local role service_role');return (await tx.query('select public.sepia_access_gateway($1,$2) value',[op,JSON.stringify(data)])).rows[0].value;});
 return {db,scalar,gateway};
}
