import React, { useCallback, useEffect, useState } from "react";
import { Check, LogOut, MailPlus, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { networkRpc } from "../../hooks/useNetworkServers";
import { profileLink, STUDIO_ROLES } from "../../studios/studioData";
function MemberRow({ member, studio, userId, busy, run }) {
  const [role, setRole] = useState(member.role),
    [rank, setRank] = useState(member.rank);
  useEffect(() => {
    setRole(member.role);
    setRank(member.rank);
  }, [member.role, member.rank]);
  const owner = studio.role === "owner";
  const editable = owner
    ? member.role !== "owner" || member.user_id === userId
    : studio.role === "admin" &&
      member.role !== "owner" &&
      member.role !== "admin";
  const options =
    member.role === "owner"
      ? ["owner"]
      : owner
        ? ["admin", "editor", "member"]
        : ["editor", "member"];
  return (
    <div className="ds-team-row">
      <div>
        <a className="vn-link" href={profileLink(member.handle)}>
          {member.name}
        </a>
        <p className="vn-note">
          @{member.handle} ·{" "}
          {member.state === "invited"
            ? "Invitación pendiente"
            : "Participación confirmada"}
        </p>
      </div>
      <label>
        <span className="sr-only">Cargo de {member.handle}</span>
        <select
          className="vn-input"
          value={rank}
          disabled={!editable || busy}
          onChange={(e) => setRank(e.target.value)}
        >
          <option value="">Sin cargo</option>
          {studio.ranks.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">Permisos de {member.handle}</span>
        <select
          className="vn-input"
          value={role}
          disabled={!editable || busy || member.user_id === userId}
          onChange={(e) => setRole(e.target.value)}
        >
          {[...new Set([...options, member.role])].map((r) => (
            <option key={r} value={r}>
              {STUDIO_ROLES[r]}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-1 flex-wrap">
        {editable && (
          <button
            type="button"
            className="vn-round"
            aria-label={`Guardar cargo y permisos de ${member.handle}`}
            disabled={busy || (role === member.role && rank === member.rank)}
            onClick={() =>
              run(
                "vista_studio_member",
                {
                  p_id: studio.id,
                  p_handle: member.handle,
                  p_role: role,
                  p_rank: rank,
                  p_action: "update",
                },
                "Cargo y permisos guardados.",
              )
            }
          >
            <Check size={16} />
          </button>
        )}
        {editable && member.user_id !== userId && (
          <button
            type="button"
            className="vn-round"
            disabled={busy}
            aria-label={`Retirar a ${member.handle}`}
            onClick={() =>
              run(
                "vista_studio_member",
                {
                  p_id: studio.id,
                  p_handle: member.handle,
                  p_role: member.role,
                  p_rank: member.rank,
                  p_action: "remove",
                },
                "Integrante retirado.",
              )
            }
          >
            <Trash2 size={15} />
          </button>
        )}
        {owner && member.state === "active" && member.user_id !== userId && (
          <button
            type="button"
            className="vn-link text-xs"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  `¿Transferir ${studio.nombre} a @${member.handle}? Tú pasarás a ser administrador.`,
                )
              )
                void run(
                  "vista_studio_transfer",
                  { p_id: studio.id, p_user_id: member.user_id },
                  "Propiedad transferida.",
                  true,
                );
            }}
          >
            Transferir propiedad
          </button>
        )}
      </div>
    </div>
  );
}
export default function StudioTeam({ studio, onRefresh }) {
  const { user } = useAuth();
  const [members, setMembers] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [handle, setHandle] = useState(""),
    [role, setRole] = useState("member"),
    [rank, setRank] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setMembers(await networkRpc("vista_studio_team", { p_id: studio.id }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [studio.id]);
  useEffect(() => {
    void load();
  }, [load]);
  const run = async (name, params, message, refresh = false) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await networkRpc(name, params);
      setNotice(message);
      if (refresh) await onRefresh();
      else await load();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const manage = ["owner", "admin"].includes(studio.role);
  return (
    <section className="ds-panel">
      <header>
        <h3 className="text-2xl font-serif italic">El equipo.</h3>
        <p className="vn-note">
          Los cargos aparecen en el perfil del estudio. Los permisos controlan
          quién puede editar: el administrador gestiona el perfil y los
          colaboradores; el editor solo modifica el perfil y el portafolio.
        </p>
      </header>
      {error && (
        <p className="vn-error mt-4" role="alert">
          {error}
          <button className="vn-link ml-3" disabled={busy} onClick={load}>
            Reintentar
          </button>
        </p>
      )}
      {notice && (
        <p className="vn-alert mt-4" role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p className="vn-note py-6" role="status">
          Abriendo equipo…
        </p>
      ) : (
        members.map((m) => (
          <MemberRow
            key={m.user_id}
            member={m}
            studio={studio}
            userId={user?.id}
            busy={busy}
            run={run}
          />
        ))
      )}
      {manage && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await run(
                "vista_studio_member",
                {
                  p_id: studio.id,
                  p_handle: handle,
                  p_role: role,
                  p_rank: rank,
                  p_action: "invite",
                },
                "Invitación enviada. Aparecerá en el equipo cuando la persona la acepte.",
              )
            )
              setHandle("");
          }}
          className="mt-6"
        >
          <h4 className="font-semibold text-sm mb-4">Invitar con GBA ID</h4>
          <fieldset disabled={busy} className="grid sm:grid-cols-3 gap-4">
            <label className="ds-field">
              <span>GBA ID</span>
              <input
                className="vn-input"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@nombre"
                required
              />
            </label>
            <label className="ds-field">
              <span>Cargo</span>
              <select
                className="vn-input"
                value={rank}
                onChange={(e) => setRank(e.target.value)}
              >
                <option value="">Sin cargo</option>
                {studio.ranks.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="ds-field">
              <span>Permisos</span>
              <select
                className="vn-input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {(studio.role === "owner"
                  ? ["member", "editor", "admin"]
                  : ["member", "editor"]
                ).map((r) => (
                  <option key={r} value={r}>
                    {STUDIO_ROLES[r]}
                  </option>
                ))}
              </select>
            </label>
            <button className="vn-button justify-self-start">
              <MailPlus size={15} />
              Enviar invitación
            </button>
          </fieldset>
        </form>
      )}
      {studio.role !== "owner" && (
        <button
          className="vn-link mt-7 text-sm"
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                "¿Salir del estudio? Tu participación dejará de aparecer en el equipo.",
              )
            )
              void run(
                "vista_studio_member",
                {
                  p_id: studio.id,
                  p_handle: user.nombre,
                  p_role: studio.role,
                  p_rank: studio.rank || "",
                  p_action: "leave",
                },
                "Has salido del estudio.",
                true,
              );
          }}
        >
          <LogOut size={15} />
          Salir del estudio
        </button>
      )}
    </section>
  );
}
