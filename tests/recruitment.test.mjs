import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  cleanAnswers,
  sectionsFor,
  validateAnswers,
  wordCount,
  csvCell,
  validEmail,
} from "../src/recruitment/model.js";
import {
  displayName,
  authName,
  validName,
  normalizePin,
  validPin,
  securePin,
} from "../src/recruitment/identity.js";
const db = new PGlite();
let count = 0;
const ok = (actual, expected) => {
  assert.deepEqual(actual, expected);
  count++;
};
const no = async (p, regex) => {
  await assert.rejects(p, regex);
  count++;
};
const first = "00000000-0000-0000-0000-000000000001",
  second = "00000000-0000-0000-0000-000000000002",
  director = "00000000-0000-0000-0000-000000000003",
  reviewer = "00000000-0000-0000-0000-000000000004";
const sid = (user) => user.replace("00000000-0000", "10000000-0000");
async function actor(user = "", role = "authenticated") {
  await db.exec("reset role");
  await db.query(
    "select set_config('test.uid',$1,false),set_config('test.session',$2,false)",
    [user, user ? sid(user) : ""],
  );
  await db.exec(`set role ${role}`);
}
async function scalar(sql, args = []) {
  return Object.values((await db.query(sql, args)).rows[0])[0];
}
const base = {
  area: "design",
  secondary: "writing",
  community: "yes",
  coordination: "maybe",
  hours: "2to4",
  schedule: ["afternoon", "weekend"],
  delay: "notify",
  changes: "guided",
  workspace: "learn",
  style: "combination",
  device: "windows",
  connection: "limited",
  experience: "learn",
  affinity: "learn",
  design_role: "any",
  motivation: Array(40).fill("motivación").join(" "),
  scenario:
    "Primero elegiría una jerarquía clara. Mantendría la retícula y los estilos para dar continuidad a las páginas.",
  sample: "none",
};
const save = (
  a = base,
  revision = 0,
  complete = false,
  email = "candidata@example.test",
  terms = null,
) =>
  scalar("select public.gimg_save_application($1,$2,$3,$4,$5,$6,$7)", [
    "gimg-otono-2026",
    a,
    email,
    complete,
    terms,
    complete,
    revision,
  ]);
const review = (id, values, revision = 0) =>
  scalar("select public.gimg_review_application($1,$2,$3)", [
    id,
    values,
    revision,
  ]);
try {
  ok(wordCount("  una\nrespuesta   breve "), 3);
  ok(
    validateAnswers({ ...base, contact_email: "candidata@example.test" }),
    null,
  );
  ok(validEmail("x@bad"), false);
  ok(validEmail("x@example.test"), true);
  ok(
    Boolean(
      validateAnswers({
        ...base,
        contact_email: "x@example.test",
        motivation: "breve",
      }),
    ),
    true,
  );
  ok(
    cleanAnswers({ ...base, area: "writing", scenario: "", affinity: "use" })
      .affinity,
    undefined,
  );
  ok(
    sectionsFor({ ...base, area: "production" })[2][1].includes(
      "production_role",
    ),
    true,
  );
  ok(csvCell("=2+2"), '"\'=2+2"');
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;create schema extensions;
 grant usage on schema auth,storage to anon,authenticated;
 create table auth.users(id uuid primary key,email text,encrypted_password text,raw_user_meta_data jsonb default '{}',updated_at timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('session_id',current_setting('test.session',true))$$;
 create table public.usuarios(id uuid primary key references auth.users(id),nombre text not null unique,nombre_publico text,perfil_publico boolean default true,rol text default 'Usuario',saldo numeric default 0,credito_usado numeric default 0,credito_limite numeric default 0,credito_activo boolean default false,care_level text,care_status text,care_expire timestamptz);
 create function public.vista_is_platform_admin() returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$select auth.uid()='${director}'::uuid$$;
 create function public.vista_gba_id_exists(p_handle text) returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$select exists(select 1 from public.usuarios where lower(nombre)=lower(p_handle))$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;grant select on storage.objects to anon;create policy legacy_storage_public on storage.objects for select to anon,authenticated using(true);create policy legacy_storage_insert on storage.objects for insert to authenticated with check(true);create policy legacy_storage_update on storage.objects for update to authenticated using(true) with check(true);create policy legacy_storage_delete on storage.objects for delete to authenticated using(true);
 create function storage.foldername(v text) returns text[] language sql as $$select string_to_array(v,'/')$$;
 create function extensions.gen_salt(v text,cost integer default 10) returns text language sql as $$select 'test-salt'$$;
 create function extensions.crypt(v text,s text) returns text language sql as $$select 'test-hash:'||v$$;
 `);
  for (const [id, name] of [
    [first, "primera"],
    [second, "segunda"],
    [director, "direccion"],
    [reviewer, "evaluador"],
  ]) {
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      id,
      `${name}@id.gba.software`,
    ]);
    await db.query(
      "insert into public.usuarios(id,nombre,nombre_publico) values($1,$2,$2)",
      [id, name],
    );
    await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
      sid(id),
      id,
    ]);
  }
  const migration = fs
    .readdirSync("supabase/migrations")
    .find((p) => p.endsWith("_gimg_recruitment.sql"));
  await db.exec(fs.readFileSync(`supabase/migrations/${migration}`, "utf8"));
  const fix = fs
    .readdirSync("supabase/migrations")
    .find((p) => p.endsWith("_gimg_pin_signup_fix.sql"));
  await db.exec(`create function public.auth_rol() returns text language sql stable security definer as $$select rol from usuarios where id=auth.uid()$$;
create function public.es_staff() returns boolean language sql stable security definer as $$select auth_rol() in ('Dueño','Admin')$$;
CREATE OR REPLACE FUNCTION public.proteger_campos_usuarios()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  if not es_staff() then
    if new.saldo            is distinct from old.saldo
       or new.rol           is distinct from old.rol
       or new.credito_usado is distinct from old.credito_usado
       or new.credito_limite is distinct from old.credito_limite
       or new.credito_activo is distinct from old.credito_activo
       or new.care_level    is distinct from old.care_level
       or new.care_status   is distinct from old.care_status
       or new.care_expire   is distinct from old.care_expire
    then
      raise exception 'No tienes permiso para modificar esos campos';
    end if;
  end if;
  return new;
end;
$function$
;

`);
  // Match the production trigger chain, including the existing profile guard.
  await db.exec(`create function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$begin insert into public.usuarios(id,nombre) values(new.id,new.raw_user_meta_data->>'nombre');return new;end;$$;
  create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
  create trigger trg_proteger_usuarios before update on public.usuarios for each row execute function public.proteger_campos_usuarios();
  grant select,update on public.usuarios to authenticated;`);
  const pinUser = "00000000-0000-0000-0000-000000000005";
  await no(
    db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,'mariaruiz@gba.com',$2)",
      [pinUser, { nombre: "María Ruiz", gimg_candidate: true }],
    ),
    /es_staff/,
  );
  await db.exec(fs.readFileSync(`supabase/migrations/${fix}`, "utf8"));
  await db.query(
    "insert into auth.users(id,email,raw_user_meta_data) values($1,'mariaruiz@gba.com',$2)",
    [pinUser, { nombre: "María Ruiz", gimg_candidate: true }],
  );
  ok(
    await scalar("select perfil_publico from public.usuarios where id=$1", [
      pinUser,
    ]),
    false,
  );
  ok(
    await scalar("select nombre_publico from public.usuarios where id=$1", [
      pinUser,
    ]),
    "María Ruiz",
  );
  await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
    sid(pinUser),
    pinUser,
  ]);
  await actor(pinUser);
  await no(
    db.query("update public.usuarios set rol='Admin' where id=$1", [pinUser]),
    /No tienes permiso/,
  );
  await no(
    db.query("update public.usuarios set saldo=100 where id=$1", [pinUser]),
    /No tienes permiso/,
  );
  const pinCode = "ab".repeat(24),
    pinHash = await scalar(
      "select encode(sha256(convert_to($1,'UTF8')),'hex')",
      [pinCode],
    );
  ok(await scalar("select public.gimg_init_identity($1)", [pinHash]), true);
  await actor("", "anon");
  ok(await scalar("select public.gimg_id_available('maria ruiz')"), false);
  ok(await scalar("select public.gimg_id_available('Otra Persona')"), true);
  ok(
    await scalar("select public.gimg_recover_identity($1,$2,$3)", [
      " MARÍA   RUIZ ",
      pinCode,
      "not-a-pin-password",
    ]),
    false,
  );
  ok(
    await scalar("select public.gimg_recover_identity($1,$2,$3)", [
      " MARÍA   RUIZ ",
      pinCode,
      securePin("0456"),
    ]),
    true,
  );
  await db.exec("reset role");
  ok(
    await scalar("select encrypted_password from auth.users where id=$1", [
      pinUser,
    ]),
    "test-hash:GBA-0456-SecureVault",
  );
  ok(displayName("  María    Ruiz "), "María Ruiz");
  ok(authName("  María    Ruiz "), "mariaruiz");
  ok(validName("María Ruiz"), true);
  ok(validName("<script>"), false);
  ok(normalizePin("a01-23x"), "0123");
  ok(validPin("0123"), true);
  ok(validPin("12345"), false);
  await db.exec(
    "update public.gimg_recruitment_cycles set opens_at=now()-interval '1 day',closes_at=now()+interval '1 day'",
  );
  await actor("", "anon");
  ok(
    await scalar("select count(*)::int from public.gimg_recruitment_cycles"),
    1,
  );
  await no(
    db.query("select * from public.gimg_recruitment_applications"),
    /permission denied/,
  );
  await no(save(), /permission denied/);
  await no(
    db.query("select * from gimg_recruitment_private.identities"),
    /permission denied/,
  );
  ok(await scalar("select public.gimg_id_available('primera')"), false);
  ok(await scalar("select public.gimg_id_available('libre')"), true);
  await actor(first);
  const draft = await save();
  ok(draft.revision, 1);
  await no(save(base, 0), /cambió/);
  await no(
    db.query(
      "update public.gimg_recruitment_applications set phase='submitted'",
    ),
    /permission denied/,
  );
  await no(save({ ...base, administrator: true }, 1), /Unknown field/);
  await no(
    save(
      { ...base, scenario: Array(101).fill("x").join(" ") },
      1,
      true,
      "x@example.test",
      "2026-10-08",
    ),
    /up to 100/,
  );
  await no(
    save(base, 1, true, "x@example.test", "wrong-version"),
    /condiciones/,
  );
  await no(
    save(
      {
        ...base,
        sample: "file",
        sample_path: `${second}/gimg-otono-2026/test.pdf`,
      },
      1,
      true,
      "x@example.test",
      "2026-10-08",
    ),
    /Archivo ajeno/,
  );
  const receipt = await save(
    base,
    1,
    true,
    "candidata@example.test",
    "2026-10-08",
  );
  ok(receipt.submitted, true);
  ok(
    (await save(base, 2, true, "candidata@example.test", "2026-10-08"))
      .already_submitted,
    true,
  );
  ok(
    await scalar("select count(*)::int from public.gimg_recruitment_reviews"),
    0,
  );
  ok(
    await scalar("select email from public.gimg_recruitment_contacts"),
    "candidata@example.test",
  );
  await no(save(base, 2), /ya enviada/);
  await no(review(receipt.id, { decision: "accepted" }), /Forbidden/);
  await actor(second);
  ok(
    await scalar(
      "select count(*)::int from public.gimg_recruitment_applications",
    ),
    0,
  );
  ok(
    await scalar("select count(*)::int from public.gimg_recruitment_contacts"),
    0,
  );
  ok(
    await scalar("select public.gimg_candidate_result('gimg-otono-2026')"),
    null,
  );
  await no(
    db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
      "gimg-recruitment",
      `${first}/gimg-otono-2026/foreign.pdf`,
    ]),
    /row-level security/,
  );
  await db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
    "gimg-recruitment",
    `${second}/gimg-otono-2026/own.pdf`,
  ]);
  ok(
    await scalar(
      "select count(*)::int from storage.objects where bucket_id='gimg-recruitment'",
    ),
    1,
  );
  await db.query("update storage.objects set name=$1 where bucket_id=$2", [
    `${second}/gimg-otono-2026/changed.pdf`,
    "gimg-recruitment",
  ]);
  ok(
    await scalar(
      "select name from storage.objects where bucket_id='gimg-recruitment'",
    ),
    `${second}/gimg-otono-2026/own.pdf`,
  );
  await db.exec(
    "delete from storage.objects where bucket_id='gimg-recruitment'",
  );
  ok(
    await scalar(
      "select count(*)::int from storage.objects where bucket_id='gimg-recruitment'",
    ),
    1,
  );
  await actor(first);
  ok(
    await scalar(
      "select count(*)::int from storage.objects where bucket_id='gimg-recruitment'",
    ),
    0,
  );
  await actor("", "anon");
  ok(
    await scalar(
      "select count(*)::int from storage.objects where bucket_id='gimg-recruitment'",
    ),
    0,
  );
  await actor(director);
  ok(
    await scalar(
      "select count(*)::int from public.gimg_recruitment_applications",
    ),
    1,
  );
  ok(
    await scalar("select count(*)::int from public.gimg_recruitment_contacts"),
    0,
  );
  ok(
    await scalar("select public.gimg_set_reviewer('evaluador','reviewer')"),
    true,
  );
  const values = {
    decision: "accepted",
    published: false,
    result_message: "Seleccionada para Diseño.",
    assigned_role: "Diseño de páginas",
    internal_notes: "Nota privada de evaluación",
    availability_score: 7,
    motivation_score: 8,
    scenario_score: 15,
    evidence_score: 0,
  };
  let r = await review(receipt.id, values);
  ok(r.revision, 1);
  await actor(first);
  let result = await scalar(
    "select public.gimg_candidate_result('gimg-otono-2026')",
  );
  ok(result.decision, "submitted");
  ok(result.internal_notes, undefined);
  await no(
    scalar("select public.gimg_confirm_place('gimg-otono-2026')"),
    /No hay una plaza/,
  );
  await actor(reviewer);
  ok(
    await scalar(
      "select count(*)::int from public.gimg_recruitment_applications",
    ),
    1,
  );
  await no(
    review(receipt.id, { ...values, published: true }, 1),
    /Solo Dirección/,
  );
  await actor(director);
  r = await review(receipt.id, { ...values, published: true }, 1);
  ok(r.public_decision, "accepted");
  ok(
    await scalar("select count(*)::int from public.gimg_recruitment_contacts"),
    1,
  );
  await no(
    review(receipt.id, { ...values, motivation_score: 11 }, 2),
    /check constraint/,
  );
  // Saving a different PRIVATE decision must not overwrite the public result.
  r = await review(
    receipt.id,
    {
      ...values,
      decision: "reserve",
      published: false,
      result_message: "Borrador nuevo",
    },
    2,
  );
  ok(r.public_decision, "accepted");
  ok(r.public_message, "Seleccionada para Diseño.");
  await actor(first);
  result = await scalar(
    "select public.gimg_candidate_result('gimg-otono-2026')",
  );
  ok(result.decision, "accepted");
  ok(result.message, "Seleccionada para Diseño.");
  ok(await scalar("select public.gimg_confirm_place('gimg-otono-2026')"), true);
  ok(
    Boolean(
      (await scalar("select public.gimg_candidate_result('gimg-otono-2026')"))
        .confirmed_at,
    ),
    true,
  );
  await actor(second);
  await no(
    scalar("select public.gimg_confirm_place('gimg-otono-2026')"),
    /No hay una plaza/,
  );
  await actor(first);
  const code = "ab".repeat(24),
    hash = await scalar("select encode(sha256(convert_to($1,'UTF8')),'hex')", [
      code,
    ]);
  ok(await scalar("select public.gimg_init_identity($1)", [hash]), true);
  await actor("", "anon");
  for (let n = 0; n < 2; n++)
    ok(
      await scalar("select public.gimg_recover_identity($1,$2,$3)", [
        "primera",
        "cd".repeat(24),
        "clave-de-prueba-nueva",
      ]),
      false,
    );
  ok(
    await scalar("select public.gimg_recover_identity($1,$2,$3)", [
      "primera",
      code,
      "clave-de-prueba-nueva",
    ]),
    true,
  );
  await actor(first);
  ok(
    await scalar(
      "select count(*)::int from public.gimg_recruitment_applications",
    ),
    0,
  );
  await no(save(base, 2), /Authentication required/);
  await db.exec("reset role");
  ok(
    await scalar("select count(*)::int from auth.sessions where user_id=$1", [
      first,
    ]),
    0,
  );
  await db.exec(
    "update public.gimg_recruitment_cycles set closes_at=now()-interval '1 hour',opens_at=now()-interval '1 day'",
  );
  await actor(second);
  await no(save(), /cerrada/);
  await actor("", "anon");
  for (let n = 0; n < 10; n++)
    ok(
      await scalar("select public.gimg_recover_identity($1,$2,$3)", [
        "segunda",
        "cd".repeat(24),
        "clave-de-prueba-nueva",
      ]),
      false,
    );
  await db.exec("reset role");
  ok(
    await scalar(
      "select attempts from gimg_recruitment_private.recovery_limits where key=encode(sha256(convert_to('unknown:segunda','UTF8')),'hex')",
    ),
    10,
  );
  console.log(
    `PASS: ${count} checks — private drafts, ownership, reviewer access, publication snapshots, private contact, deadline, conditional questions, recovery budget and session revocation.`,
  );
} catch (error) {
  console.error(error.message);
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  await db.close();
}
