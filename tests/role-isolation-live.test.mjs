import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
const db = new PGlite({ extensions: { pgcrypto } });
let checks=0;
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const session=n=>`10000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const denied=async(p,re=/permiso|permission|denied|autorizad|propio|Sesión|Membresía|ronda|QA|Dirección|cambió|Transición|cerrado/i)=>{await assert.rejects(p,re);checks++;};
async function actor(n){await db.exec('reset role');await db.query("select set_config('test.uid',$1,false),set_config('test.session',$2,false)",[n?id(n):'',n?session(n):'']);await db.exec('set role authenticated');}
async function scalar(q,args=[]){return Object.values((await db.query(q,args)).rows[0])[0];}
async function cmd(action,data,revision=null){return scalar('select public.workspace_command($1,$2,$3)',[action,data,revision]);}
async function admin(q,args=[]){await db.exec('reset role');return db.query(q,args);}
try {
await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;create schema extensions;create extension pgcrypto with schema extensions;
 create table auth.users(id uuid primary key,email text,encrypted_password text,updated_at timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id));
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('session_id',current_setting('test.session',true))$$;
 grant usage on schema auth to authenticated;
 grant execute on function auth.uid(),auth.jwt() to authenticated;
 create table public.usuarios(id uuid primary key references auth.users(id),rol text,nombre text,nombre_publico text,frase_seguridad text);
 alter table public.usuarios add column sello_editorial text;
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
for(let n=1;n<=12;n++) { await db.query("insert into auth.users values($1,$2,extensions.crypt('GBA-1234-SecureVault',extensions.gen_salt('bf',4)),now())",[id(n),`person${n}@gba.com`]);await db.query('insert into auth.sessions values($1,$2)',[session(n),id(n)]);await db.query('insert into public.usuarios values($1,$2,$3,$3,$4)',[id(n),n===1?'Dueño':'Usuario',`person${n}`,'old secret']); }
await db.query("insert into public.gimg_recruitment_reviewers values($1,'director')",[id(2)]);
await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261009123356_gimg_identity_role_isolation.sql',import.meta.url),'utf8'));
await actor(1);eq(await scalar('select gimg_recruitment_private.director()'),false);
await admin('delete from public.gimg_recruitment_reviewers');await db.query("insert into public.gimg_recruitment_reviewers values($1,'director')",[id(1)]);
await actor(1);eq(await scalar('select gimg_recruitment_private.director()'),true);eq(await scalar('select gimg_recruitment_private.reviewer()'),true);
await admin('update public.usuarios set rol=$1 where id=$2',['Admin',id(2)]);await actor(2);eq(await scalar('select gimg_recruitment_private.director()'),false);
await admin('update public.usuarios set rol=null where id=$1',[id(7)]);await db.query("insert into public.solicitudes_editoriales values($1,$2,'GIMG','GIMG')",[id(84),id(7)]);
await actor(1);const org=await scalar('select to_jsonb(public.vista_approve_editorial_request($1))',[id(84)]);eq(org.slug,'gimg');
await admin('select 1');eq((await db.query('select rol from public.usuarios where id=$1',[id(7)])).rows[0].rol,null);eq((await db.query('select rol from public.usuarios where id=$1',[id(1)])).rows[0].rol,'Dueño');
await denied(db.query('update public.usuarios set rol=$1 where id=$2',['gimg_direction',id(7)]),/rangos generales/);
await admin('delete from auth.sessions where user_id=$1',[id(1)]);await actor(1);eq(await scalar('select gimg_recruitment_private.director()'),false);
console.log(`PASS: ${checks} standalone role-isolation assertions without Workspace dependencies.`);
}catch(error){console.error(error.message,error.where||'');process.exitCode=1;}finally{await db.close();}
