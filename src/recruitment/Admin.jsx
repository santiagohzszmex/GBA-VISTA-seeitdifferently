import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import {
  AREAS,
  CYCLE,
  LABELS,
  QUESTIONS,
  areaName,
  label,
  warnings,
  csvCell,
  decisionMessage,
} from "./model";
export default function ReviewPanel({ director, user }) {
  const [rows, setRows] = useState([]),
    [reviews, setReviews] = useState({}),
    [contacts, setContacts] = useState({}),
    [selected, setSelected] = useState(null),
    [values, setValues] = useState(null),
    [area, setArea] = useState(""),
    [decision, setDecision] = useState(""),
    [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [updated, setUpdated] = useState(null),
    [member, setMember] = useState(""),
    [role, setRole] = useState("reviewer"),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      const all = [];
      for (let from = 0; ; from += 500) {
        const { data, error: failed } = await supabase
          .from("gimg_recruitment_applications")
          .select("*")
          .eq("cycle_key", CYCLE)
          .eq("phase", "submitted")
          .order("submitted_at", { ascending: false })
          .order("id")
          .range(from, from + 499);
        if (failed) throw failed;
        all.push(...data);
        if (data.length < 500) break;
      }
      const r = [],
        c = [];
      for (let from = 0; ; from += 500) {
        const { data, error: failed } = await supabase
          .from("gimg_recruitment_reviews")
          .select("*")
          .order("application_id")
          .range(from, from + 499);
        if (failed) throw failed;
        r.push(...data);
        if (data.length < 500) break;
      }
      for (let from = 0; ; from += 500) {
        const { data, error: failed } = await supabase
          .from("gimg_recruitment_contacts")
          .select("*")
          .order("application_id")
          .range(from, from + 499);
        if (failed) throw failed;
        c.push(...data);
        if (data.length < 500) break;
      }
      setRows(all);
      setReviews(Object.fromEntries(r.map((x) => [x.application_id, x])));
      setContacts(Object.fromEntries(c.map((x) => [x.application_id, x])));
      setUpdated(new Date());
      setError("");
    } catch {
      setError("No pudimos actualizar las postulaciones. Vuelve a intentar.");
    }
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30000);
    const channel = supabase
      .channel(`gimg-review-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "gimg_recruitment_applications",
        },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gimg_recruitment_reviews" },
        load,
      )
      .subscribe();
    const visible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load]);
  const filtered = rows.filter(
    (x) =>
      (!area || x.answers.area === area) &&
      (!decision || (reviews[x.id]?.decision || "submitted") === decision) &&
      (!search ||
        `${x.handle} ${x.display_name}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  const chosen = rows.find((x) => x.id === selected);
  function choose(x) {
    setSelected(x.id);
    setValues({ ...reviews[x.id] });
    setNotice("");
    setError("");
  }
  async function save(publish) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (
        publish &&
        (!values.result_message?.trim() || values.decision === "submitted")
      )
        throw Error(
          "Elige un resultado y escribe el mensaje que verá la persona.",
        );
      const fields = [
        "decision",
        "result_message",
        "assigned_role",
        "internal_notes",
        "availability_score",
        "motivation_score",
        "scenario_score",
        "evidence_score",
      ];
      const payload = Object.fromEntries(fields.map((k) => [k, values[k]]));
      payload.published = publish;
      const { data, error: failed } = await supabase.rpc(
        "gimg_review_application",
        { p_id: chosen.id, p_values: payload, p_revision: values.revision },
      );
      if (failed) throw failed;
      setValues(data);
      setNotice(
        publish
          ? "Resultado publicado en el GBA ID de la persona."
          : "Cambios guardados de forma privada. El resultado vigente solo cambia al publicarlo.",
      );
      await load();
    } catch (failed) {
      setError(failed.message || "No se pudo guardar la revisión.");
    } finally {
      setBusy(false);
    }
  }
  function downloadCsv() {
    const fields = [
      "gba_id",
      "nombre",
      "area",
      "fecha",
      "decision",
      "publicado",
      "base_40",
      "evidencia_5",
      "respuestas",
    ];
    const data = filtered.map((x) => {
      const r = reviews[x.id] || {};
      return [
        x.handle,
        x.display_name,
        areaName(x.answers.area),
        x.submitted_at,
        LABELS[r.decision || "submitted"],
        r.published ? "Sí" : "No",
        Number(r.availability_score || 0) +
          Number(r.motivation_score || 0) +
          Number(r.scenario_score || 0),
        r.evidence_score || 0,
        JSON.stringify(x.answers),
      ];
    });
    const blob = new Blob(
      [
        "\ufeff" +
          [fields, ...data]
            .map((row) => row.map(csvCell).join(","))
            .join("\r\n"),
      ],
      { type: "text/csv;charset=utf-8" },
    );
    const a = document.createElement("a"),
      url = URL.createObjectURL(blob);
    a.href = url;
    a.download = "gimg-postulaciones.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function sample(x) {
    setError("");
    const { data, error: failed } = await supabase.storage
      .from("gimg-recruitment")
      .createSignedUrl(x.answers.sample_path, 60);
    if (failed) setError("No se pudo abrir la muestra privada.");
    else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }
  async function addReviewer() {
    setBusy(true);
    const { error: failed } = await supabase.rpc("gimg_set_reviewer", {
      p_handle: member,
      p_role: role,
    });
    setBusy(false);
    if (failed) setError(failed.message);
    else {
      setNotice("Acceso al equipo de selección actualizado.");
      setMember("");
    }
  }
  return (
    <main className="rg-admin rg-wrap">
      <div className="rg-section-title">
        <div>
          <p className="rg-kicker">GIMG · REVISIÓN PRIVADA</p>
          <h1>El equipo empieza aquí.</h1>
          <p>
            Decisiones humanas, respuestas privadas y un registro del proceso.
          </p>
        </div>
        <button className="rg-button secondary" onClick={load}>
          Actualizar
        </button>
      </div>
      <div className="rg-stat-grid">
        <div>
          <strong>{rows.length}</strong>
          <span>Postulaciones recibidas</span>
        </div>
        <div>
          <strong>
            {
              rows.filter(
                (x) =>
                  reviews[x.id]?.published &&
                  reviews[x.id]?.public_decision === "accepted",
              ).length
            }
            /15
          </strong>
          <span>Seleccionadas</span>
        </div>
        <div>
          <strong>
            {
              rows.filter(
                (x) =>
                  reviews[x.id]?.published &&
                  reviews[x.id]?.public_decision === "reserve",
              ).length
            }
            /5
          </strong>
          <span>En reserva</span>
        </div>
        <div>
          <strong>
            {rows.filter((x) => !reviews[x.id]?.published).length}
          </strong>
          <span>Resultados pendientes</span>
        </div>
      </div>
      <div className="rg-area-stats">
        {AREAS.map(([key, name, places]) => {
          const count = rows.filter((x) => x.answers.area === key).length;
          return (
            <div key={key}>
              <span>{name}</span>
              <strong>
                {count} postulaciones · {places} plazas
              </strong>
              <div className="rg-meter">
                <i
                  style={{
                    width: `${rows.length ? (100 * count) / rows.length : 0}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="rg-muted">
        {updated
          ? `Actualizado a las ${updated.toLocaleTimeString("es-MX")}.`
          : "Cargando…"}{" "}
        Las estadísticas se actualizan al recibir cambios y cada 30 segundos.
      </p>
      <div className="rg-filters">
        <input
          aria-label="Buscar GBA ID"
          placeholder="Buscar GBA ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filtrar área"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        >
          <option value="">Todas las áreas</option>
          {AREAS.map(([key, name]) => (
            <option value={key} key={key}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar resultado"
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
        >
          <option value="">Todos los resultados</option>
          {Object.entries(LABELS)
            .filter(([k]) => k !== "draft")
            .map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
        </select>
        <button className="rg-button secondary" onClick={downloadCsv}>
          Exportar CSV
        </button>
      </div>
      {error && (
        <p className="rg-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="rg-notice" role="status">
          {notice}
        </p>
      )}
      <div className="rg-review-layout">
        <div className="rg-app-list">
          {filtered.map((x) => (
            <button
              className={selected === x.id ? "active" : ""}
              key={x.id}
              onClick={() => choose(x)}
            >
              <strong>@{x.handle}</strong>
              <span>{areaName(x.answers.area)}</span>
              <small>
                {LABELS[reviews[x.id]?.decision || "submitted"]}{" "}
                {reviews[x.id]?.published ? "· Publicado" : "· Privado"}
              </small>
            </button>
          ))}
          {!filtered.length && <p>No hay postulaciones con estos filtros.</p>}
        </div>
        {chosen && values ? (
          <section className="rg-panel rg-review-detail">
            <p className="rg-kicker">
              @{chosen.handle} · {areaName(chosen.answers.area)}
            </p>
            <h2>{chosen.display_name}</h2>
            <p>
              Folio {chosen.id.slice(0, 8).toUpperCase()} ·{" "}
              {new Date(chosen.submitted_at).toLocaleString("es-MX")}
            </p>
            {warnings(chosen.answers).map((w) => (
              <p className="rg-warning" key={w}>
                {w}
              </p>
            ))}
            <dl className="rg-answer-summary">
              {Object.entries(chosen.answers)
                .filter(
                  ([k]) =>
                    !["sample_path", "sample_name", "sample_url"].includes(k),
                )
                .map(([key, value]) => (
                  <div key={key}>
                    <dt>
                      {key === "area"
                        ? "Área principal"
                        : key === "motivation"
                          ? "Motivación"
                          : key === "scenario"
                            ? "Mini-situación"
                            : key === "secondary"
                              ? "Área secundaria"
                              : QUESTIONS[key]?.[0] ||
                                { sample: "Muestra de trabajo" }[key] ||
                                key}
                    </dt>
                    <dd>
                      {key === "area" || key === "secondary"
                        ? areaName(value)
                        : Array.isArray(value)
                          ? value.map((v) => label(key, v)).join(" · ")
                          : label(key, value)}
                    </dd>
                  </div>
                ))}
            </dl>
            {chosen.answers.sample === "file" && (
              <button
                className="rg-button secondary"
                onClick={() => sample(chosen)}
              >
                Abrir muestra privada
              </button>
            )}
            {chosen.answers.sample === "link" && (
              <a
                className="rg-button secondary"
                href={chosen.answers.sample_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver muestra enlazada ↗
              </a>
            )}
            <h3>Evaluación humana</h3>
            <div className="rg-score-grid">
              {[
                ["availability_score", "Disponibilidad", 10],
                ["motivation_score", "Motivación", 10],
                ["scenario_score", "Mini-situación", 20],
                ["evidence_score", "Evidencia opcional", 5],
              ].map(([key, name, max]) => (
                <label className="rg-field" key={key}>
                  {name} / {max}
                  <input
                    type="number"
                    min="0"
                    max={max}
                    value={values[key]}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        [key]: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            <p>
              Base:{" "}
              {values.availability_score +
                values.motivation_score +
                values.scenario_score}
              /40 · Evidencia: {values.evidence_score}/5
            </p>
            <label className="rg-field">
              Notas internas
              <textarea
                maxLength={4000}
                value={values.internal_notes}
                onChange={(e) =>
                  setValues((v) => ({ ...v, internal_notes: e.target.value }))
                }
              />
              <small>Solo el equipo de selección puede verlas.</small>
            </label>
            <label className="rg-field">
              Resultado
              <select
                disabled={!director}
                value={values.decision}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    decision: e.target.value,
                    result_message: decisionMessage(
                      e.target.value,
                      chosen.handle,
                      v.assigned_role,
                    ),
                  }))
                }
              >
                {Object.entries(LABELS)
                  .filter(([k]) => k !== "draft")
                  .map(([key, name]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="rg-field">
              Puesto propuesto
              <input
                value={values.assigned_role}
                maxLength={200}
                onChange={(e) =>
                  setValues((v) => ({ ...v, assigned_role: e.target.value }))
                }
              />
            </label>
            <label className="rg-field">
              Mensaje para la persona
              <textarea
                maxLength={2000}
                value={values.result_message}
                onChange={(e) =>
                  setValues((v) => ({ ...v, result_message: e.target.value }))
                }
              />
            </label>
            <div className="rg-actions">
              <button
                className="rg-button secondary"
                disabled={busy}
                onClick={() => save(false)}
              >
                Guardar revisión privada
              </button>
              {director && (
                <button
                  className="rg-button"
                  disabled={busy}
                  onClick={() => save(true)}
                >
                  Publicar resultado en GBA ID
                </button>
              )}
            </div>
            {values.published &&
              values.public_decision === "accepted" &&
              contacts[chosen.id] && (
                <div className="rg-contact-box">
                  <h3>Contacto de la persona seleccionada</h3>
                  <p>{contacts[chosen.id].email}</p>
                  <a
                    className="rg-button secondary"
                    href={`mailto:${contacts[chosen.id].email}?subject=${encodeURIComponent("Tu selección para el equipo de GIMG")}&body=${encodeURIComponent(values.public_message || decisionMessage("accepted", chosen.handle, values.public_role))}`}
                  >
                    Preparar correo de coordinación ↗
                  </a>
                  <p className="rg-muted">
                    Se abrirá tu correo. Envía desde tu cuenta @gba.software;
                    esta acción prepara el mensaje y no lo envía
                    automáticamente.
                  </p>
                </div>
              )}
          </section>
        ) : (
          <section className="rg-panel">
            <h2>Una perspectiva a la vez.</h2>
            <p>
              Selecciona una postulación para revisar sus respuestas. La
              puntuación orienta la decisión; ninguna respuesta produce una
              aceptación automática.
            </p>
          </section>
        )}
      </div>
      {director && (
        <section className="rg-panel rg-team-settings">
          <h2>Equipo de selección</h2>
          <p>
            Concede acceso solo a quienes revisarán esta convocatoria. Los
            permisos no cambian los rangos generales de su cuenta.
          </p>
          <div className="rg-filters">
            <input
              aria-label="GBA ID del evaluador"
              placeholder="GBA ID"
              value={member}
              onChange={(e) => setMember(e.target.value)}
            />
            <select
              aria-label="Permiso del evaluador"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="reviewer">Evaluación</option>
              <option value="director">Dirección</option>
              <option value="remove">Retirar acceso</option>
            </select>
            <button
              className="rg-button"
              disabled={busy || !member.trim()}
              onClick={addReviewer}
            >
              Actualizar permiso
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
