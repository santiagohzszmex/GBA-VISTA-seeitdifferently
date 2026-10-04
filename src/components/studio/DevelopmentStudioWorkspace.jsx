import React, { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  Check,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useDevelopmentStudios } from "../../hooks/useDevelopmentStudios";
import { networkRpc } from "../../hooks/useNetworkServers";
import { useAuth } from "../../context/AuthContext";
import { uploadToCloudinary } from "../../cloudinary";
import {
  EMPTY_STUDIO,
  STUDIO_ROLES,
  studioLink,
  studioPayload,
  validateStudio,
} from "../../studios/studioData";
import NetworkImageInput from "../network/NetworkImageInput";
import StudioTeam from "./StudioTeam";
import "../network/network.css";
import "../../studios/studios.css";
export default function DevelopmentStudioWorkspace() {
  const { user } = useAuth();
  const workspace = useDevelopmentStudios();
  const [id, setId] = useState(""),
    [tab, setTab] = useState("profile"),
    [form, setForm] = useState({ ...EMPTY_STUDIO }),
    [files, setFiles] = useState({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [rank, setRank] = useState(""),
    [progress, setProgress] = useState(""),
    [renames, setRenames] = useState({});
  const studio = workspace.studios.find((s) => s.id === id) || null;
  const edit = !studio || ["owner", "admin", "editor"].includes(studio.role);
  useEffect(() => {
    if (!id && workspace.studios.length) setId(workspace.studios[0].id);
  }, [id, workspace.studios]);
  useEffect(() => {
    setForm(studio ? studioPayload(studio) : { ...EMPTY_STUDIO });
    setFiles({});
    setRenames({});
    setTab("profile");
  }, [id]);
  const field = (key, value) => setForm((s) => ({ ...s, [key]: value }));
  const project = (index, key, value) =>
    field(
      "portfolio",
      form.portfolio.map((p, i) => (i === index ? { ...p, [key]: value } : p)),
    );
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = { ...validateStudio(form), rank_renames: renames };
      for (const [key, file] of Object.entries(files)) {
        if (!file) continue;
        setProgress("Subiendo imágenes a Cloudinary…");
        const url = await uploadToCloudinary(
          file,
          `VISTA_Studios/${studio?.slug || user.id}`,
        );
        if (!url)
          throw new Error(
            "No pudimos subir la imagen. Tus cambios siguen aquí.",
          );
        if (key.startsWith("project-")) {
          const i = Number(key.slice(8));
          payload.portfolio = payload.portfolio.map((p, index) =>
            index === i ? { ...p, image_url: url } : p,
          );
        } else payload[key] = url;
        setForm({ ...payload });
        setFiles((current) => ({ ...current, [key]: null }));
      }
      setProgress("Guardando estudio…");
      const next = await networkRpc("vista_save_development_studio", {
        p_id: studio?.id || null,
        p_data: payload,
      });
      workspace.update(next);
      setId(next.id);
      setForm(studioPayload(next));
      setRenames({});
      setNotice(
        "Estudio guardado. Tu perfil y portafolio ya están disponibles en Network.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setProgress("");
    }
  };
  const respond = async (type, target, accept) => {
    setBusy(true);
    setError("");
    try {
      await networkRpc(
        type === "studio" ? "vista_studio_respond" : "vista_respond_developer",
        type === "studio"
          ? { p_id: target, p_accept: accept }
          : { p_server_id: target, p_accept: accept },
      );
      await workspace.refresh();
      setNotice(accept ? "Participación confirmada." : "Invitación rechazada.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const renameRank = (from, to) => {
    field(
      "ranks",
      form.ranks.map((r) => (r === from ? to : r)),
    );
    const original =
      Object.keys(renames).find((r) => renames[r] === from) ||
      (studio?.ranks.includes(from) ? from : null);
    if (original) setRenames((current) => ({ ...current, [original]: to }));
  };
  const removeProject = (index) => {
    field(
      "portfolio",
      form.portfolio.filter((_, i) => i !== index),
    );
    setFiles((current) =>
      Object.fromEntries(
        Object.entries(current).flatMap(([key, file]) => {
          if (!key.startsWith("project-")) return [[key, file]];
          const i = Number(key.slice(8));
          return i === index
            ? []
            : [[`project-${i > index ? i - 1 : i}`, file]];
        }),
      ),
    );
  };
  return (
    <div className="vn">
      <header className="ds-editor-actions">
        <div>
          <p className="vn-eyebrow">Estudios de desarrollo</p>
          <h2 className="font-serif italic text-3xl mt-3">
            Un perfil para quienes crean mundos.
          </h2>
          <p className="vn-note">
            Registra tu estudio gratis, reúne al equipo y muestra lo que han
            desarrollado.
          </p>
        </div>
        <button
          className="vn-button vn-button-quiet self-start"
          disabled={busy}
          onClick={() => {
            setId("new");
            setForm({ ...EMPTY_STUDIO });
            setFiles({});
            setTab("profile");
            setNotice("");
            setError("");
          }}
        >
          <Plus size={15} />
          Registrar estudio gratis
        </button>
      </header>
      {(workspace.error || error) && (
        <p role="alert" className="vn-error mb-5">
          {error || workspace.error}
          {workspace.error && (
            <button className="vn-button mt-3" onClick={workspace.refresh}>
              Reintentar
            </button>
          )}
        </p>
      )}
      {notice && (
        <p className="vn-alert mb-5" role="status">
          {notice}
        </p>
      )}
      {[
        ...workspace.invitations.map((i) => ({
          ...i,
          type: "studio",
          target: i.studio_id,
        })),
        ...workspace.developerRequests.map((i) => ({
          ...i,
          type: "developer",
          target: i.server_id,
        })),
      ].map((i) => (
        <section className="ds-invite mb-4" key={`${i.type}-${i.target}`}>
          <strong className="text-sm">
            {i.nombre}
            <span className="block text-xs font-normal mt-1">
              {i.type === "studio"
                ? `Te invita como ${STUDIO_ROLES[i.role]}${i.rank ? ` · ${i.rank}` : ""}`
                : "Quiere reconocerte como desarrollador del servidor"}
            </span>
          </strong>
          <button
            className="vn-button"
            disabled={busy}
            onClick={() => respond(i.type, i.target, true)}
          >
            <Check size={14} />
            Aceptar
          </button>
          <button
            className="vn-button vn-button-quiet"
            disabled={busy}
            onClick={() => respond(i.type, i.target, false)}
          >
            Rechazar
          </button>
        </section>
      ))}
      {workspace.loading ? (
        <p className="vn-note py-10" role="status">
          Abriendo estudios…
        </p>
      ) : (
        <>
          {workspace.studios.length > 0 && (
            <div className="ds-editor-actions">
              <label className="ds-field w-full sm:max-w-sm">
                <span>Estudio activo</span>
                <select
                  className="vn-input"
                  value={id}
                  disabled={busy}
                  onChange={(e) => setId(e.target.value)}
                >
                  {workspace.studios.map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.nombre} · {STUDIO_ROLES[s.role]}
                    </option>
                  ))}
                  {id === "new" && <option value="new">Nuevo estudio</option>}
                </select>
              </label>
              {studio && (
                <a
                  className="vn-link self-end"
                  href={studioLink(studio.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver perfil público
                  <ArrowUpRight size={15} />
                </a>
              )}
            </div>
          )}
          {studio?.hidden && (
            <p className="vn-alert mb-5">
              Mothership ha ocultado este perfil. Puedes corregirlo y contactar
              con GBA para solicitar su revisión.
            </p>
          )}
          <nav className="ds-navigation" aria-label="Gestionar estudio">
            {[
              ["profile", "Perfil"],
              ["portfolio", "Portafolio"],
              ["ranks", "Cargos"],
              ...(studio ? [["team", "Equipo"]] : []),
            ].map(([key, label]) => (
              <button
                key={key}
                disabled={busy}
                type="button"
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </nav>
          {tab === "team" ? (
            <StudioTeam
              key={studio.id}
              studio={studio}
              onRefresh={async () => {
                await workspace.refresh();
                setId("");
              }}
            />
          ) : (
            <form
              onSubmit={submit}
              onInvalidCapture={(e) => {
                const section = e.target.closest("[data-studio-section]");
                if (section) {
                  setTab(section.dataset.studioSection);
                  const target = e.target;
                  requestAnimationFrame(() => target.focus());
                }
              }}
              className="ds-panel"
            >
              <fieldset disabled={busy || !edit} className="min-w-0">
                <div
                  data-studio-section="profile"
                  className={
                    tab === "profile" ? "grid sm:grid-cols-2 gap-5" : "hidden"
                  }
                >
                  <label className="ds-field sm:col-span-2">
                    <span>Nombre del estudio</span>
                    <input
                      className="vn-input"
                      value={form.nombre}
                      minLength={2}
                      maxLength={80}
                      required
                      onChange={(e) => field("nombre", e.target.value)}
                    />
                  </label>
                  <label className="ds-field sm:col-span-2">
                    <span>Descripción</span>
                    <textarea
                      className="vn-input"
                      rows={5}
                      minLength={20}
                      maxLength={1600}
                      required
                      value={form.descripcion}
                      onChange={(e) => field("descripcion", e.target.value)}
                    />
                  </label>
                  {[
                    ["website_url", "Sitio web"],
                    ["discord_url", "Discord"],
                    ["support_url", "Enlace para apoyar el estudio"],
                  ].map(([key, label]) => (
                    <label className="ds-field sm:col-span-2" key={key}>
                      <span>{label} · Opcional</span>
                      <input
                        className="vn-input"
                        type="url"
                        pattern="https://.*"
                        value={form[key]}
                        maxLength={2000}
                        onChange={(e) => field(key, e.target.value)}
                        placeholder="https://…"
                      />
                    </label>
                  ))}
                  {["logo_url", "portada_url"].map((key) => (
                    <NetworkImageInput
                      key={key}
                      label={
                        key === "logo_url"
                          ? "Logo del estudio"
                          : "Portada del estudio"
                      }
                      logo={key === "logo_url"}
                      value={form[key]}
                      file={files[key]}
                      onFileChange={(file) =>
                        setFiles((s) => ({ ...s, [key]: file }))
                      }
                      onUrlChange={(value) => field(key, value)}
                    />
                  ))}
                </div>
                <div
                  data-studio-section="portfolio"
                  className={tab === "portfolio" ? "" : "hidden"}
                >
                  <h3 className="font-serif italic text-2xl">Tu portafolio.</h3>
                  <p className="vn-note">
                    Muestra mapas, plugins, modpacks y otros proyectos. Los
                    servidores publicados que atribuyas al estudio se añaden
                    automáticamente en su perfil.
                  </p>
                  {form.portfolio.map((p, i) => (
                    <div className="ds-project-editor" key={i}>
                      <div className="flex justify-between mb-4">
                        <strong className="text-sm">Proyecto {i + 1}</strong>
                        <button
                          type="button"
                          aria-label={`Eliminar proyecto ${i + 1}`}
                          onClick={() => removeProject(i)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <label className="ds-field sm:col-span-2">
                          <span>Título</span>
                          <input
                            className="vn-input"
                            value={p.title}
                            minLength={2}
                            maxLength={100}
                            required
                            onChange={(e) =>
                              project(i, "title", e.target.value)
                            }
                          />
                        </label>
                        <label className="ds-field sm:col-span-2">
                          <span>Descripción</span>
                          <textarea
                            className="vn-input"
                            rows={3}
                            maxLength={800}
                            value={p.description}
                            onChange={(e) =>
                              project(i, "description", e.target.value)
                            }
                          />
                        </label>
                        <label className="ds-field sm:col-span-2">
                          <span>Enlace del proyecto · Opcional</span>
                          <input
                            className="vn-input"
                            type="url"
                            pattern="https://.*"
                            maxLength={2000}
                            value={p.url}
                            onChange={(e) => project(i, "url", e.target.value)}
                          />
                        </label>
                        <NetworkImageInput
                          label={`Imagen del proyecto ${i + 1}`}
                          value={p.image_url}
                          file={files[`project-${i}`]}
                          onFileChange={(file) =>
                            setFiles((s) => ({ ...s, [`project-${i}`]: file }))
                          }
                          onUrlChange={(value) =>
                            project(i, "image_url", value)
                          }
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="vn-button vn-button-quiet mt-5"
                    disabled={form.portfolio.length >= 30}
                    onClick={() =>
                      field("portfolio", [
                        ...form.portfolio,
                        { title: "", description: "", url: "", image_url: "" },
                      ])
                    }
                  >
                    <Plus size={15} />
                    Añadir proyecto
                  </button>
                </div>
                <div
                  data-studio-section="ranks"
                  className={tab === "ranks" ? "" : "hidden"}
                >
                  <h3 className="font-serif italic text-2xl">
                    Cargos del estudio.
                  </h3>
                  <p className="vn-note">
                    Define los cargos que mejor describen tu equipo. Puedes
                    tener un director, un desarrollador o un artista con el
                    mismo permiso de colaborador.
                  </p>
                  <div className="flex flex-wrap gap-3 my-6">
                    {form.ranks.map((r, i) => (
                      <span
                        key={i}
                        className="inline-flex gap-3 items-center p-3 border border-[#d2d2d7] rounded text-xs"
                      >
                        <input
                          aria-label={`Nombre del cargo ${i + 1}`}
                          className="bg-transparent outline-none w-32"
                          value={r}
                          maxLength={60}
                          onChange={(e) => renameRank(r, e.target.value)}
                        />
                        <button
                          type="button"
                          aria-label={`Eliminar cargo ${r}`}
                          onClick={() => {
                            field(
                              "ranks",
                              form.ranks.filter((v) => v !== r),
                            );
                            setRenames((current) =>
                              Object.fromEntries(
                                Object.entries(current).filter(
                                  ([from, to]) => to !== r,
                                ),
                              ),
                            );
                          }}
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <input
                      className="vn-input"
                      aria-label="Nuevo cargo"
                      placeholder="Por ejemplo: Artista 3D"
                      maxLength={60}
                      value={rank}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (rank.trim() && form.ranks.length < 30) {
                            field("ranks", [...form.ranks, rank.trim()]);
                            setRank("");
                          }
                        }
                      }}
                      onChange={(e) => setRank(e.target.value)}
                    />
                    <button
                      className="vn-button vn-button-quiet"
                      type="button"
                      disabled={!rank.trim() || form.ranks.length >= 30}
                      onClick={() => {
                        field("ranks", [...form.ranks, rank.trim()]);
                        setRank("");
                      }}
                    >
                      <Plus size={15} />
                      Añadir
                    </button>
                  </div>
                  <p className="vn-note">
                    Para retirar un cargo en uso, asigna primero otro a sus
                    integrantes desde Equipo.
                  </p>
                </div>
                {edit && (
                  <button className="vn-button mt-7" disabled={busy}>
                    <Save size={15} />
                    {busy
                      ? progress || "Guardando…"
                      : studio
                        ? "Guardar estudio"
                        : "Crear estudio gratuito"}
                  </button>
                )}
              </fieldset>
              {!edit && (
                <p className="vn-note">
                  Puedes consultar el equipo. Pide permiso de editor o
                  administrador para cambiar el perfil.
                </p>
              )}
              <p className="vn-note" role="status">
                {busy
                  ? progress
                  : "Las imágenes se suben a Cloudinary al guardar."}
              </p>
            </form>
          )}
        </>
      )}
    </div>
  );
}
