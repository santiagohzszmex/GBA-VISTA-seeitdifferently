import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { accessVariants, normalizeServerAccess } from "../src/network/serverData.js";
const db = new PGlite();
let checks = 0;
const ids = {
  owner: "00000000-0000-0000-0000-000000000001",
  guest: "00000000-0000-0000-0000-000000000002",
  admin: "00000000-0000-0000-0000-000000000003",
  editor: "00000000-0000-0000-0000-000000000004",
  member: "00000000-0000-0000-0000-000000000005",
  stranger: "00000000-0000-0000-0000-000000000006",
};
const actor = async (key) => {
  await db.exec("reset role");
  await db.query("select set_config('test.uid',$1,false)", [ids[key] || ""]);
  await db.exec("set role authenticated");
};
const scalar = async (sql, args = []) =>
  Object.values((await db.query(sql, args)).rows[0])[0];
const ok = (a, b) => {
  assert.deepEqual(a, b);
  checks++;
};
const reject = async (promise) => {
  await assert.rejects(promise);
  checks++;
};
const root = process.cwd();
try {
  await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create table public.usuarios(id uuid primary key,nombre text,rol text,nombre_publico text,perfil_publico boolean default true);
create table public.notificaciones(id uuid default gen_random_uuid(),usuario_id uuid,actor_id uuid,tipo text,titulo text,mensaje text,action_url text,target_type text,target_id uuid,leida boolean default false);
create function public.vista_is_platform_admin() returns boolean language sql stable security definer set search_path=public,pg_temp as $$select exists(select 1 from usuarios where id=auth.uid() and rol in('Dueño','Admin'))$$;
create function public.vista_editorial_slugify(value text) returns text language sql as $$select regexp_replace(lower(value),'[^a-z0-9]+','-','g')$$;`);
  for (const [name, id] of Object.entries(ids))
    await db.query("insert into usuarios(id,nombre,rol) values($1,$2,$3)", [
      id,
      name,
      name === "admin" ? "Dueño" : "Ciudadano",
    ]);
  await db.exec(
    fs.readFileSync(
      root +
        "/supabase/migrations/20261003130735_network_server_partners_pilot.sql",
      "utf8",
    ),
  );
  await actor("owner");
  const payload = {
    nombre: "Servidor previo",
    descripcion: "Un servidor geopolítico previamente registrado.",
    discord_url: "https://discord.com/invite/legacy",
  };
  const legacy = await scalar(
    "select to_jsonb(vista_save_network_server(null,$1))",
    [payload],
  );
  await db.exec("reset role");
  await db.exec(
    fs.readFileSync(
      root +
        "/supabase/migrations/" +
        fs
          .readdirSync(root + "/supabase/migrations")
          .find((n) => n.endsWith("_network_development_studios.sql")),
      "utf8",
    ),
  );
  await db.exec(
    fs.readFileSync(
      root +
        "/supabase/migrations/" +
        fs
          .readdirSync(root + "/supabase/migrations")
          .find((n) =>
            n.endsWith("_studio_attribution_review_and_notifications.sql"),
          ),
      "utf8",
    ),
  );
  await db.exec(fs.readFileSync(root + "/supabase/migrations/" + fs.readdirSync(root + "/supabase/migrations").find(n => n.endsWith("_network_account_access.sql")), "utf8"));
  await actor(null);
  await reject(scalar("select vista_studios_workspace()"));
  await reject(scalar("select vista_studio_directory()"));
  await actor("owner");
  const draft = {
    nombre: "Estudio de prueba",
    descripcion: "Un equipo que desarrolla mundos y comunidades de Minecraft.",
    ranks: ["Dirección", "Desarrollo", "Diseño"],
    portfolio: [
      {
        title: "Mundo de prueba",
        description: "Proyecto comunitario",
        url: "https://example.com/mundo",
        image_url: "",
      },
    ],
  };
  const studio = await scalar("select vista_save_development_studio(null,$1)", [
    draft,
  ]);
  ok(studio.role, "owner");
  ok((await scalar("select vista_studios_workspace()")).studios.length, 1);
  ok(
    (await scalar("select vista_development_studio($1)", [studio.slug])).members
      .length,
    1,
  );
  await scalar("select vista_save_development_studio($1,$2)", [
    studio.id,
    {
      ...draft,
      ranks: ["Director", "Desarrollo", "Diseño"],
      rank_renames: { Dirección: "Director" },
    },
  ]);
  ok(
    (await scalar("select vista_studio_team($1)", [studio.id]))[0].rank,
    "Director",
  );
  await scalar("select vista_save_development_studio($1,$2)", [
    studio.id,
    { ...draft, rank_renames: { Director: "Dirección" } },
  ]);
  await reject(
    scalar("select vista_save_development_studio($1,$2)", [
      studio.id,
      { ...draft, rank_renames: { Otro: "Dirección" } },
    ]),
  );
  await reject(
    scalar("select vista_save_development_studio(null,$1)", [
      { ...draft, ranks: ["X", "x"] },
    ]),
  );
  await reject(
    scalar("select vista_save_development_studio(null,$1)", [
      { ...draft, support_url: "javascript:alert(1)" },
    ]),
  );
  await reject(
    scalar("select vista_save_development_studio(null,$1)", [
      {
        ...draft,
        portfolio: [
          { title: "Foo", url: "https://username:password@example.com" },
        ],
      },
    ]),
  );
  const invite = async (handle, role = "member", rank = "Desarrollo") =>
    scalar("select vista_studio_member($1,$2,$3,$4,'invite')", [
      studio.id,
      handle,
      role,
      rank,
    ]);
  await invite("guest");
  ok(
    (await scalar("select vista_development_studio($1)", [studio.slug])).members
      .length,
    1,
  );
  await actor("guest");
  ok((await scalar("select vista_studios_workspace()")).invitations.length, 1);
  await reject(
    scalar("select vista_save_development_studio($1,$2)", [studio.id, draft]),
  );
  await actor("stranger");
  await reject(scalar("select vista_studio_respond($1,true)", [studio.id]));
  await reject(scalar("select vista_studio_team($1)", [studio.id]));
  await actor("guest");
  await scalar("select vista_studio_respond($1,true)", [studio.id]);
  ok(
    (await scalar("select vista_development_studio($1)", [studio.slug])).members
      .length,
    2,
  );
  await reject(invite("member"));
  await reject(
    scalar(
      "select vista_studio_member($1,'guest','admin','Desarrollo','update')",
      [studio.id],
    ),
  );
  await actor("owner");
  await invite("editor", "editor");
  await actor("editor");
  await scalar("select vista_studio_respond($1,true)", [studio.id]);
  await scalar("select vista_save_development_studio($1,$2)", [
    studio.id,
    { ...draft, nombre: "Nuevo nombre" },
  ]);
  await reject(invite("member"));
  await actor("owner");
  await invite("member", "admin");
  await actor("member");
  await scalar("select vista_studio_respond($1,true)", [studio.id]);
  await reject(invite("stranger", "admin"));
  await reject(
    scalar(
      "select vista_studio_member($1,'owner','member','Diseño','update')",
      [studio.id],
    ),
  );
  await reject(
    scalar(
      "select vista_studio_member($1,'member','member','Diseño','update')",
      [studio.id],
    ),
  );
  await invite("stranger", "member", "Diseño");
  await actor("stranger");
  await scalar("select vista_studio_respond($1,false)", [studio.id]);
  ok((await scalar("select vista_studios_workspace()")).studios.length, 0);
  await actor("owner");
  await reject(
    scalar("select vista_save_development_studio($1,$2)", [
      studio.id,
      { ...draft, ranks: ["Dirección", "Diseño"] },
    ]),
  );
  await reject(
    scalar(
      "select vista_studio_member($1,'owner','owner','Dirección','remove')",
      [studio.id],
    ),
  );
  const serverPayload = {
    nombre: "Servidor del estudio",
    descripcion: "Un mundo desarrollado por el equipo de prueba.",
    access_type: "modpack",
    access_url: "https://modrinth.com/modpack/test",
    access_instructions: "Instala el modpack para conectarte.",
    support_url: "https://patreon.com/test",
    developer_studio_id: studio.id,
  };
  const server = await scalar(
    "select to_jsonb(vista_save_network_server(null,$1))",
    [serverPayload],
  );
  ok(server.ip, "");
  ok(server.developer_status, "accepted");
  await actor("guest");
  await reject(
    scalar("select to_jsonb(vista_save_network_server(null,$1))", [
      serverPayload,
    ]),
  );
  await actor("admin");
  await scalar("select vista_review_network_server($1,'aprobado',false,'')", [
    server.id,
  ]);
  await scalar("select vista_review_network_server($1,'rechazado',false,'Corrige la ficha')", [server.id]);
  ok((await scalar("select vista_admin_network()")).servers.find(s => s.id === server.id).estado, "rechazado");
  ok((await scalar("select vista_network_directory()")).servers.length, 0);
  await actor("owner");
  const resubmitted = await scalar("select to_jsonb(vista_save_network_server($1,$2))", [server.id, serverPayload]);
  ok(resubmitted.estado, "pendiente");
  ok(resubmitted.review_notes, "");
  await actor("admin");
  await scalar("select vista_review_network_server($1,'suspendido',false,'Pausa')", [server.id]);
  await actor("owner");
  const suspended = await scalar("select to_jsonb(vista_save_network_server($1,$2))", [server.id, serverPayload]);
  ok(suspended.estado, "suspendido");
  await actor("admin");
  await scalar("select vista_review_network_server($1,'aprobado',false,'')", [server.id]);
  await actor("guest");
  const published = (await scalar("select vista_network_directory()"))
    .servers[0];
  ok(published.developer.type, "studio");
  ok("developer_user_id" in published, false);
  ok("owner_id" in published, false);
  ok(
    (await scalar("select vista_development_studio($1)", [studio.slug])).servers
      .length,
    1,
  );
  await scalar(
    "select vista_track_network_event($1,'access_click','profile')",
    [server.id],
  );
  await scalar(
    "select vista_track_network_event($1,'support_click','profile')",
    [server.id],
  );
  await actor("owner");
  const report = await scalar(
    "select vista_network_report($1,now()-interval '1 day',now()+interval '1 day')",
    [server.id],
  );
  ok(report.access_click, 1);
  ok(report.support_click, 1);

  await actor("owner");
  const personServer = await scalar(
    "select to_jsonb(vista_save_network_server(null,$1))",
    [
      {
        ...serverPayload,
        nombre: "Desarrollo individual",
        developer_studio_id: null,
        developer_handle: "guest",
      },
    ],
  );
  ok(personServer.developer_status, "pending");
  await actor("admin");
  await scalar("select vista_review_network_server($1,'aprobado',false,'')", [
    personServer.id,
  ]);
  await actor("guest");
  ok((await scalar("select vista_my_developer_requests()")).length, 1);
  ok(
    (await scalar("select vista_network_directory()")).servers.find(
      (s) => s.id === personServer.id,
    ).developer,
    null,
  );
  await actor("stranger");
  await reject(
    scalar("select vista_respond_developer($1,true)", [personServer.id]),
  );
  await actor("guest");
  await scalar("select vista_respond_developer($1,true)", [personServer.id]);
  ok(
    (await scalar("select vista_profile_studios($1)", [ids.guest])).servers
      .length,
    1,
  );
  await db.exec("reset role");
  await db.query("update usuarios set perfil_publico=false where id=$1", [
    ids.guest,
  ]);
  await actor("stranger");
  ok(
    (await scalar("select vista_network_directory()")).servers.find(
      (s) => s.id === personServer.id,
    ).developer,
    null,
  );
  ok(
    (
      await scalar("select vista_development_studio($1)", [studio.slug])
    ).members.some((m) => m.handle === "guest"),
    false,
  );
  ok(
    (await scalar("select vista_profile_studios($1)", [ids.guest])).studios
      .length,
    0,
  );
  await actor("owner");
  await scalar("select vista_studio_transfer($1,$2)", [studio.id, ids.member]);
  ok(
    (await scalar("select vista_studios_workspace()")).studios[0].role,
    "admin",
  );
  await reject(
    scalar("select vista_studio_transfer($1,$2)", [studio.id, ids.owner]),
  );
  await scalar(
    "select vista_studio_member($1,'owner','admin','Dirección','leave')",
    [studio.id],
  );
  ok((await scalar("select vista_studios_workspace()")).studios.length, 0);
  await actor("member");
  await reject(
    scalar(
      "select vista_studio_member($1,'member','owner','Dirección','leave')",
      [studio.id],
    ),
  );
  await actor("admin");
  await scalar("select vista_review_studio($1,true)", [studio.id]);
  await actor("member");
  ok(await scalar("select vista_development_studio($1)", [studio.slug]), null);
  ok(
    (await scalar("select vista_network_directory()")).servers.find(
      (s) => s.id === server.id,
    ).developer,
    null,
  );
  await actor("owner");
  const previous = (await scalar("select vista_my_network_servers()")).find(
    (s) => s.id === legacy.id,
  );
  ok(previous.access_type, "invitation");
  ok(previous.access_url, payload.discord_url);
  await scalar("select to_jsonb(vista_save_network_server($1,$2))", [
    legacy.id,
    { ...previous, developer_handle: "" },
  ]);
  await reject(
    scalar("select to_jsonb(vista_save_network_server(null,$1))", [
      {
        ...serverPayload,
        developer_studio_id: null,
        access_url: "",
        access_type: "modpack",
      },
    ]),
  );
  await reject(
    scalar("select to_jsonb(vista_save_network_server(null,$1))", [
      {
        ...serverPayload,
        developer_studio_id: null,
        access_type: "direct",
        ip: "La IP está en el modpack",
      },
    ]),
  );
  const connection = { ...previous, developer_handle: '', access_type: 'direct', ip: 'premium.example.invalid', account_access: 'both_separate', ip_non_premium: 'free.example.invalid:25566' };
  const saveAccess = data => scalar("select to_jsonb(vista_save_network_server($1,$2))", [legacy.id, data]);
  let savedAccess = await saveAccess(connection);
  ok(savedAccess.ip_non_premium, connection.ip_non_premium);
  ok(savedAccess.account_access, 'both_separate');
  ok(savedAccess.access_url, '');
  await reject(saveAccess({ ...connection, ip_non_premium: '' }));
  await reject(saveAccess({ ...connection, ip_non_premium: 'https://bad.example' }));
  await reject(saveAccess({ ...connection, ip_non_premium: 'a'.repeat(161) }));
  await reject(saveAccess({ ...connection, account_access: 'invalid' }));
  const packs = { ...connection, access_type: 'modpack', access_url: 'https://example.com/premium', access_url_non_premium: 'https://example.com/no-premium' };
  savedAccess = await saveAccess(packs);
  ok(savedAccess.ip, '');
  ok(savedAccess.ip_non_premium, '');
  ok(savedAccess.access_url_non_premium, packs.access_url_non_premium);
  await reject(saveAccess({ ...packs, access_url_non_premium: '' }));
  await reject(saveAccess({ ...packs, access_url_non_premium: 'http://example.com/pack' }));
  await reject(saveAccess({ ...packs, access_url_non_premium: 'javascript:alert(1)' }));
  await actor('admin');
  await scalar("select vista_review_network_server($1,'aprobado',false,'')", [legacy.id]);
  const publicAccess = (await scalar("select vista_network_directory()")).servers.find(s=>s.id===legacy.id);
  ok(publicAccess.access_url_non_premium, packs.access_url_non_premium);
  ok(publicAccess.account_access, 'both_separate');
  await actor('stranger');
  await reject(saveAccess(packs));
  await actor('owner');
  // An older open tab omits the new fields: it must preserve both modpack URLs.
  const oldClient = { ...packs }; delete oldClient.account_access; delete oldClient.access_url_non_premium;
  ok((await saveAccess(oldClient)).access_url_non_premium, packs.access_url_non_premium);
  for (const mode of ['premium','non_premium','both_shared','unspecified']) {
    savedAccess = await saveAccess({ ...packs, account_access: mode });
    ok(savedAccess.account_access, mode);
    ok(savedAccess.access_url_non_premium, '');
    ok(accessVariants(savedAccess).length, 1);
  }
  savedAccess = await saveAccess({ ...packs, access_type: 'invitation' });
  ok(savedAccess.account_access, 'unspecified');
  ok(savedAccess.access_url_non_premium, '');
  ok(normalizeServerAccess(packs).ip, '');
  ok(normalizeServerAccess(packs).ip_non_premium, '');
  ok(accessVariants(packs).map(v=>v.label), ['Premium','No premium']);
  ok(normalizeServerAccess({ ...connection, account_access: 'premium' }).ip_non_premium, '');
  await db.exec("reset role");
  ok(await scalar("select has_function_privilege('anon','vista_save_network_server(uuid,jsonb)','execute')"), false);
  ok(await scalar("select relrowsecurity from pg_class where oid='public.network_servers'::regclass"), true);
  await db.exec("reset role");
  for (const table of ["development_studios", "development_studio_members"]) {
    ok(
      await scalar(
        "select relrowsecurity from pg_class where oid=$1::regclass",
        [table],
      ),
      true,
    );
    ok(
      await scalar("select has_table_privilege('authenticated',$1,'select')", [
        table,
      ]),
      false,
    );
  }
  const funcs = (
    await db.query(
      "select oid::regprocedure::text as signature,proconfig from pg_proc where proname like 'vista_studio%' or proname in('vista_save_development_studio','vista_development_studio','vista_my_developer_requests','vista_respond_developer','vista_admin_studios','vista_review_studio','vista_profile_studios')",
    )
  ).rows;
  for (const f of funcs) {
    ok(
      await scalar("select has_function_privilege('anon',$1,'execute')", [
        f.signature,
      ]),
      false,
    );
    ok(
      f.proconfig.some((c) => c.startsWith("search_path=")),
      true,
    );
  }
  console.log(
    `PASS ${checks} studio assertions: consent, permissions, ownership, privacy, moderation, server access and migration compatibility.`,
  );
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await db.close();
}
