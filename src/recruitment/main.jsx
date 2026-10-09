import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { supabase } from "../supabaseClient";
import Identity from "./Auth";
import ReviewPanel from "./Admin";
import {
  CYCLE,
  COMMUNITY,
  OPEN_AT,
  CLOSE_AT,
  TERMS_VERSION,
  AREAS,
  QUESTIONS,
  SCENARIOS,
  LABELS,
  sectionsFor,
  cleanAnswers,
  validateSection,
  validateAnswers,
  validEmail,
  normalizePhone,
  wordCount,
  areaName,
  label,
  warnings,
} from "./model";
import { TERMS } from "./terms";
import "./recruitment.css";
import "./recruitment-page.css";
const copy = {
  profile: [
    "Primero, tu perspectiva.",
    "El lugar donde quieres crear.",
    "Elige tu área principal. Si te interesa otra, también puedes indicarla.",
  ],
  availability: [
    "Encontrar nuestro ritmo.",
    "El tiempo también cuenta.",
    "Nos interesa tu disponibilidad real y cómo te gustaría colaborar.",
  ],
  technical: [
    "Cada herramienta abre una puerta.",
    "Lo que tienes. Lo que puedes aprender.",
    "Una conexión limitada o necesitar apoyo no te elimina automáticamente.",
  ],
  voice: [
    "Tu voz, en dos respuestas.",
    "Queremos conocer tu criterio.",
    "Una motivación breve y una situación del área que elegiste.",
  ],
  sample: [
    "Algo tuyo, si quieres.",
    "Lo que ya has creado.",
    "Una muestra es opcional. Tu correo o teléfono será un dato privado de contacto para la coordinación si resultas seleccionado.",
  ],
  review: [
    "Una última mirada.",
    "Esta es tu postulación.",
    "Revisa los datos y las dos respuestas. Después del envío podrás consultar el resultado con tu GBA ID.",
  ],
};
const preview =
  import.meta.env.DEV &&
  new URLSearchParams(location.search).get("preview") === "1";
const management =
  location.pathname.endsWith("/gestion") ||
  location.pathname.endsWith("/gestion/");
function Floral() {
  return (
    <div className="rg-floral" aria-hidden="true">
      <div className="rg-halo" />
      <div className="rg-flower">
        {Array.from({ length: 16 }, (_, i) => (
          <i key={i} style={{ "--petal": i }} />
        ))}
        <b />
      </div>
      <span className="rg-orbit one" />
      <span className="rg-orbit two" />
      <span className="rg-dot a" />
      <span className="rg-dot b" />
      <span className="rg-art-label">
        Una historia vive
        <br />
        cuando alguien la cuenta.
      </span>
    </div>
  );
}
function Choices({ name, answers, onChange }) {
  const [title, options] = QUESTIONS[name],
    multi = name === "schedule";
  const chosen = answers[name] || (multi ? [] : "");
  return (
    <fieldset className="rg-question">
      <legend>{title}</legend>
      <div className="rg-choices">
        {options.map(([value, text]) => {
          const active = multi ? chosen.includes(value) : chosen === value;
          return (
            <button
              type="button"
              className={active ? "selected" : ""}
              key={value}
              aria-pressed={active}
              onClick={() =>
                onChange(
                  name,
                  multi
                    ? active
                      ? chosen.filter((v) => v !== value)
                      : [...chosen, value]
                    : value,
                )
              }
            >
              <span className={`rg-choice-icon ${multi ? "square" : ""}`}>
                {active ? "✓" : ""}
              </span>
              {text}
            </button>
          );
        })}
      </div>
      {multi && <small>Puedes elegir varias opciones.</small>}
    </fieldset>
  );
}
function Conditions({ onClose }) {
  const close = useRef(null);
  useEffect(() => {
    close.current?.focus();
    const escape = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", escape);
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", escape);
      document.body.style.overflow = "";
      window.scrollTo(0, scrollY);
    };
  }, [onClose]);
  return (
    <div
      className="rg-terms-view"
      role="dialog"
      aria-modal="true"
      aria-label="Condiciones de participación y privacidad"
      onKeyDown={(e) => {
        if (e.key === "Tab") {
          const focusable = Array.from(
            e.currentTarget.querySelectorAll("button,a[href]"),
          );
          const first = focusable[0],
            last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }}
    >
      <header>
        <span>GIMG · GBA</span>
        <button
          ref={close}
          type="button"
          className="rg-button secondary"
          onClick={onClose}
        >
          Volver a mi postulación ←
        </button>
      </header>
      <article>
        <p className="rg-kicker">VERSIÓN {TERMS_VERSION}</p>
        <h1>
          Crear juntos.
          <br />
          Con acuerdos claros.
        </h1>
        {TERMS.map(([title, text]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
        <p>
          Contacto del proceso:{" "}
          <a href="mailto:contacto@gba.software">contacto@gba.software</a>
        </p>
        <button className="rg-button" onClick={onClose}>
          Volver a mi postulación
        </button>
      </article>
    </div>
  );
}
function Questionnaire({ session, user, definition, onBack }) {
  const reduced = useReducedMotion(),
    [answers, setAnswers] = useState({ sample: "none" }),
    [application, setApplication] = useState(null),
    [section, setSection] = useState("profile"),
    [terms, setTerms] = useState(false),
    [truth, setTruth] = useState(false),
    [showTerms, setShowTerms] = useState(false),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [saving, setSaving] = useState("loading"),
    [error, setError] = useState(""),
    [result, setResult] = useState(null),
    [direction, setDirection] = useState(1),
    [begun, setBegun] = useState(false),
    [loadAttempt, setLoadAttempt] = useState(0);
  const revision = useRef(0),
    initialized = useRef(false),
    saveQueue = useRef(Promise.resolve()),
    pending = useRef(null),
    heading = useRef(null),
    termsButton = useRef(null),
    generation = useRef(0),
    latest = useRef(answers);
  const steps = sectionsFor(answers),
    index = steps.findIndex(([s]) => s === section),
    [eyebrow, title, description] = copy[section];
  const closed =
    !definition.is_open ||
    Date.now() < Date.parse(definition.opens_at) ||
    Date.now() >= Date.parse(definition.closes_at);
  const loadResult = useCallback(async () => {
    if (preview) return;
    const { data, error: failed } = await supabase.rpc(
      "gimg_candidate_result",
      { p_cycle: CYCLE },
    );
    if (!failed) setResult(data);
  }, []);
  useEffect(() => {
    let active = true;
    initialized.current = false;
    async function load() {
      if (preview) {
        initialized.current = true;
        setSaving("saved");
        return;
      }
      const { data, error: failed } = await supabase
        .from("gimg_recruitment_applications")
        .select("*")
        .eq("cycle_key", CYCLE)
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!active) return;
      if (failed) {
        setError("No pudimos abrir tu borrador. Vuelve a intentar.");
        setSaving("error");
        return;
      }
      if (data) {
        revision.current = data.revision;
        const { data: contact } = await supabase
          .from("gimg_recruitment_contacts")
          .select("email,phone")
          .eq("application_id", data.id)
          .maybeSingle();
        if (!active) return;
        const restored = {
          ...data.answers,
          contact_email: contact?.email || "",
          contact_phone: contact?.phone || "",
          contact_method: contact?.phone ? "phone" : "email",
        };
        latest.current = restored;
        setAnswers(restored);
        setApplication(data);
      }
      initialized.current = true;
      setSaving("saved");
      loadResult();
    }
    load();
    return () => {
      active = false;
      generation.current++;
      clearTimeout(pending.current);
    };
  }, [session.user.id, loadResult, loadAttempt]);
  useEffect(() => {
    if (!application || application.phase !== "submitted" || preview) return;
    const timer = setInterval(loadResult, 30000);
    return () => clearInterval(timer);
  }, [application, loadResult]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [section, begun]);
  const persist = useCallback(
    (a, complete = false) => {
      if (preview) {
        setSaving("saved");
        return Promise.resolve({
          id: "preview",
          revision: 1,
          submitted: complete,
        });
      }
      if (!initialized.current)
        return Promise.reject(
          Error("Espera a que se abra tu borrador antes de continuar."),
        );
      const payload = cleanAnswers(a),
        email =
          payload.contact_method === "email" ? payload.contact_email : null,
        phone =
          payload.contact_method === "phone"
            ? normalizePhone(payload.contact_phone)
            : null;
      delete payload.contact_email;
      delete payload.contact_phone;
      delete payload.contact_method;
      const run = async () => {
        setSaving("saving");
        const { data, error: failed } = await supabase.rpc(
          "gimg_save_application_contact",
          {
            p_cycle: CYCLE,
            p_answers: payload,
            p_email: email && validEmail(email) ? email : null,
            p_phone: phone || null,
            p_complete: complete,
            p_terms: complete && terms ? TERMS_VERSION : null,
            p_truth: complete && truth,
            p_revision: revision.current,
          },
        );
        if (failed) {
          setSaving("error");
          throw Error(failed.message || "No pudimos guardar tu postulación.");
        }
        revision.current = data.revision;
        setSaving("saved");
        if (!complete)
          setApplication((current) => ({
            ...current,
            id: data.id,
            phase: "draft",
          }));
        return data;
      };
      const operation = saveQueue.current.catch(() => {}).then(run);
      saveQueue.current = operation;
      return operation;
    },
    [terms, truth],
  );
  function change(key, value) {
    setError("");
    let next = { ...latest.current, [key]: value };
    if (key === "area" && next.area !== latest.current.area) {
      delete next.scenario;
    }
    next = cleanAnswers(next);
    latest.current = next;
    setAnswers(next);
    setSaving("pending");
    clearTimeout(pending.current);
    const epoch = generation.current;
    if (initialized.current && !closed && application?.phase !== "submitted")
      pending.current = setTimeout(
        () =>
          persist(next).catch((failed) => {
            if (generation.current === epoch) setError(failed.message);
          }),
        900,
      );
  }
  async function leave() {
    clearTimeout(pending.current);
    if (initialized.current && !closed && application?.phase !== "submitted") {
      try {
        await persist(latest.current);
      } catch (failed) {
        setError(failed.message);
        return;
      }
    }
    onBack();
  }
  async function move(target, dir) {
    if (dir > 0) {
      const invalid = validateSection(section, answers);
      if (invalid) {
        setError(invalid);
        return;
      }
    }
    clearTimeout(pending.current);
    if (!closed) {
      try {
        await persist(latest.current);
      } catch (failed) {
        setError(failed.message);
        return;
      }
    }
    setError("");
    setDirection(dir);
    setSection(target);
  }
  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (
      !["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(
        file.type,
      ) ||
      file.size > 10485760
    ) {
      setError("Elige un PDF o imagen PNG, JPG o WEBP de hasta 10 MB.");
      return;
    }
    if (preview) {
      change("sample_path", `preview/${CYCLE}/${file.name}`);
      change("sample_name", file.name);
      return;
    }
    setUploading(true);
    setError("");
    const ext = {
        "application/pdf": "pdf",
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
      }[file.type],
      path = `${session.user.id}/${CYCLE}/${crypto.randomUUID()}.${ext}`;
    const { error: failed } = await supabase.storage
      .from("gimg-recruitment")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (failed)
      setError("No pudimos subir la muestra. Tus respuestas siguen guardadas.");
    else {
      change("sample_path", path);
      change("sample_name", file.name);
    }
    setUploading(false);
  }
  async function submit() {
    if (busy) return;
    const invalid = validateAnswers(answers);
    if (invalid) {
      setSection(invalid.section);
      setError(invalid.error);
      return;
    }
    if (!terms || !truth) {
      setError(
        "Lee y acepta las condiciones y confirma que tus respuestas son propias y verdaderas.",
      );
      return;
    }
    setBusy(true);
    setError("");
    clearTimeout(pending.current);
    try {
      const data = await persist(latest.current, true);
      setApplication((current) => ({
        ...current,
        id: data.id,
        phase: "submitted",
      }));
      setResult({
        phase: "submitted",
        decision: "submitted",
        id: data.id,
        message: "",
      });
      await loadResult();
    } catch (failed) {
      setError(failed.message);
    } finally {
      setBusy(false);
    }
  }
  async function confirmPlace() {
    setBusy(true);
    setError("");
    const { error: failed } = await supabase.rpc("gimg_confirm_place", {
      p_cycle: CYCLE,
    });
    if (failed) setError(failed.message);
    else await loadResult();
    setBusy(false);
  }
  const closeTerms = useCallback(() => {
    setShowTerms(false);
    setTimeout(() => termsButton.current?.focus(), 0);
  }, []);
  if (application?.phase === "submitted")
    return (
      <section className="rg-wrap rg-result">
        <p className="rg-kicker">TU GBA ID · @{user.nombre}</p>
        <h1>
          {result?.decision === "submitted"
            ? "Tu perspectiva ya está aquí."
            : LABELS[result?.decision] || "Tu postulación"}
        </h1>
        <p className="rg-lead">
          {result?.message ||
            "Recibimos tu postulación. El equipo de selección la revisará; podrás consultar aquí tu resultado con el mismo GBA ID."}
        </p>
        <div className="rg-panel">
          <p>
            Folio{" "}
            <strong>
              {String(result?.id || application.id)
                .slice(0, 8)
                .toUpperCase()}
            </strong>
          </p>
          {result?.assigned_role && (
            <p>
              Puesto propuesto: <strong>{result.assigned_role}</strong>
            </p>
          )}
          <p>
            Tu correo se utilizará para coordinación si resultas seleccionado.
          </p>
        </div>
        {result?.decision === "accepted" &&
          (result.confirmed_at ? (
            <p className="rg-notice">
              Ya confirmaste tu puesto. El equipo coordinará contigo los
              siguientes pasos.
            </p>
          ) : (
            <button
              className="rg-button"
              disabled={busy}
              onClick={confirmPlace}
            >
              Confirmar que acepto el puesto →
            </button>
          ))}{" "}
        {error && (
          <p className="rg-error" role="alert">
            {error}
          </p>
        )}
        <button className="rg-button secondary" onClick={loadResult}>
          Consultar resultado
        </button>
        <details className="rg-sent-summary">
          <summary>Ver mis respuestas enviadas</summary>
          <Summary answers={answers} />
        </details>
      </section>
    );
  if (!begun)
    return (
      <main className="rg-wrap rg-auth rg-panel">
        <p className="rg-kicker">ANTES DE COMENZAR · @{user.nombre}</p>
        <h1 style={{ fontSize: "clamp(34px,4vw,52px)" }}>
          Tu perspectiva importa.
        </h1>
        <p>
          Esta postulación tarda entre 7 y 10 minutos. Queremos conocer tu área,
          tu disponibilidad y cómo resolverías una situación sencilla. No
          necesitas experiencia profesional. El trabajo será digital y se
          organizará en GBA Workspace.
        </p>
        <label className="rg-check">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
          />
          He leído y acepto los{" "}
          <button
            ref={termsButton}
            className="rg-inline-button"
            type="button"
            onClick={() => setShowTerms(true)}
          >
            términos y condiciones de participación y privacidad
          </button>
          .
        </label>
        <label className="rg-check">
          <input
            type="checkbox"
            checked={truth}
            onChange={(e) => setTruth(e.target.checked)}
          />
          Confirmo que mis respuestas son propias y verdaderas.
        </label>
        {error && (
          <p className="rg-error" role="alert">
            {error}
          </p>
        )}
        {saving === "error" && !initialized.current ? (
          <button
            className="rg-button"
            onClick={() => {
              setError("");
              setSaving("loading");
              setLoadAttempt((n) => n + 1);
            }}
          >
            Volver a abrir mi borrador
          </button>
        ) : (
          <button
            className="rg-button"
            disabled={!terms || !truth || saving === "loading"}
            onClick={() => setBegun(true)}
          >
            Comenzar mi postulación →
          </button>
        )}
        <button className="rg-text-button" onClick={onBack}>
          ← Volver a la convocatoria
        </button>
        {showTerms && <Conditions onClose={closeTerms} />}
      </main>
    );
  return (
    <main className="rg-wrap rg-questionnaire">
      <div className="rg-progress-row">
        <button className="rg-text-button" onClick={leave}>
          ← Convocatoria
        </button>
        <span>@{user.nombre}</span>
        <span aria-live="polite">
          {saving === "saved"
            ? "Borrador guardado en tu GBA ID"
            : saving === "saving"
              ? "Guardando…"
              : saving === "error"
                ? "Guardado pendiente"
                : saving === "loading"
                  ? "Abriendo borrador…"
                  : "Cambios pendientes"}
        </span>
      </div>
      <div className="rg-meter">
        <i style={{ width: `${(100 * (index + 1)) / steps.length}%` }} />
      </div>
      <p className="rg-muted">
        Paso {index + 1} de {steps.length} · 7–10 minutos
      </p>
      {closed && (
        <p className="rg-warning">
          La convocatoria está cerrada. Puedes consultar lo guardado; ya no se
          reciben nuevos envíos.
        </p>
      )}
      <AnimatePresence mode="wait">
        <motion.section
          key={section}
          initial={{
            opacity: reduced ? 1 : 0,
            x: reduced ? 0 : direction * 18,
          }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: reduced ? 1 : 0, x: reduced ? 0 : -direction * 12 }}
          transition={{ duration: reduced ? 0 : 0.24 }}
          onAnimationComplete={() =>
            heading.current?.focus({ preventScroll: true })
          }
          className="rg-step"
        >
          <div className="rg-step-copy">
            <p className="rg-kicker">{eyebrow}</p>
            <h1 ref={heading} tabIndex={-1}>
              {title}
            </h1>
            <p>{description}</p>
            <span className="rg-step-mark" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            {section === "technical" && (
              <p className="rg-note">
                Trabajaremos con tareas digitales. Recibirás una explicación
                básica de Workspace; no necesitas saber programar.
              </p>
            )}
          </div>
          <div className="rg-step-fields">
            {section === "profile" && (
              <>
                <div className="rg-identity-strip">
                  GBA ID: <strong>@{user.nombre}</strong>
                  <br />
                  Nombre de presentación: {user.nombre_publico || user.nombre}
                </div>
                <Choices name="community" answers={answers} onChange={change} />
                <label className="rg-field">
                  Área principal
                  <select
                    value={answers.area || ""}
                    onChange={(e) => change("area", e.target.value)}
                  >
                    <option value="">Elige un área</option>
                    {AREAS.map(([key, name]) => (
                      <option key={key} value={key}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="rg-field">
                  Área secundaria · opcional
                  <select
                    value={answers.secondary || ""}
                    onChange={(e) => change("secondary", e.target.value)}
                  >
                    <option value="">Por ahora, solo mi área principal</option>
                    {AREAS.filter(([key]) => key !== answers.area).map(
                      ([key, name]) => (
                        <option key={key} value={key}>
                          {name}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <Choices
                  name="coordination"
                  answers={answers}
                  onChange={change}
                />
              </>
            )}
            {["availability", "technical"].includes(section) &&
              steps[index][1].map((key) => (
                <Choices
                  key={key}
                  name={key}
                  answers={answers}
                  onChange={change}
                />
              ))}
            {section === "voice" && (
              <>
                <label className="rg-field rg-long">
                  ¿Por qué quieres participar en GIMG y qué podrías aportar?
                  <textarea
                    value={answers.motivation || ""}
                    maxLength={4000}
                    onChange={(e) => change("motivation", e.target.value)}
                  />
                  <small>
                    {wordCount(answers.motivation)} palabras · de 40 a 80 · unos
                    2 minutos
                  </small>
                </label>
                <div className="rg-scenario">
                  <p className="rg-kicker">{areaName(answers.area)}</p>
                  <p>{SCENARIOS[answers.area]?.[0]}</p>
                  <h2>{SCENARIOS[answers.area]?.[1]}</h2>
                  <label className="rg-field">
                    Tu respuesta
                    <textarea
                      value={answers.scenario || ""}
                      maxLength={4000}
                      onChange={(e) => change("scenario", e.target.value)}
                    />
                    <small>
                      {wordCount(answers.scenario)} palabras · máximo 100 · unos
                      3 minutos
                    </small>
                  </label>
                </div>
              </>
            )}
            {section === "sample" && (
              <>
                <fieldset className="rg-question">
                  <legend>¿Quieres compartir una muestra propia?</legend>
                  <div className="rg-choices">
                    {[
                      [
                        "none",
                        "No tengo una muestra; deseo que se valore mi respuesta",
                      ],
                      ["link", "Compartir un enlace"],
                      ["file", "Subir un archivo"],
                    ].map(([key, text]) => (
                      <button
                        type="button"
                        className={answers.sample === key ? "selected" : ""}
                        aria-pressed={answers.sample === key}
                        key={key}
                        onClick={() => change("sample", key)}
                      >
                        <span className="rg-choice-icon">
                          {answers.sample === key ? "✓" : ""}
                        </span>
                        {text}
                      </button>
                    ))}
                  </div>
                </fieldset>
                {answers.sample === "link" && (
                  <label className="rg-field">
                    Enlace HTTPS a tu muestra
                    <input
                      type="url"
                      value={answers.sample_url || ""}
                      onChange={(e) => change("sample_url", e.target.value)}
                      placeholder="https://"
                    />
                  </label>
                )}
                {answers.sample === "file" && (
                  <label className="rg-upload">
                    {uploading
                      ? "Subiendo muestra…"
                      : answers.sample_name || "Seleccionar PDF o imagen"}
                    <input
                      type="file"
                      accept="application/pdf,image/png,image/jpeg,image/webp"
                      disabled={uploading}
                      onChange={upload}
                    />
                    <small>Hasta 10 MB. La muestra será privada.</small>
                  </label>
                )}
                <fieldset className="rg-contact-choice">
                  <legend>¿Cómo te contactamos si eres seleccionado?</legend>
                  <div
                    className="rg-tabs"
                    role="group"
                    aria-label="Medio de contacto"
                  >
                    <button
                      type="button"
                      aria-pressed={answers.contact_method !== "phone"}
                      className={
                        answers.contact_method !== "phone" ? "active" : ""
                      }
                      onClick={() => change("contact_method", "email")}
                    >
                      Correo electrónico
                    </button>
                    <button
                      type="button"
                      aria-pressed={answers.contact_method === "phone"}
                      className={
                        answers.contact_method === "phone" ? "active" : ""
                      }
                      onClick={() => change("contact_method", "phone")}
                    >
                      Teléfono
                    </button>
                  </div>
                  {answers.contact_method === "phone" ? (
                    <label className="rg-field">
                      Número de teléfono
                      <input
                        type="tel"
                        autoComplete="tel"
                        maxLength={30}
                        value={answers.contact_phone || ""}
                        onChange={(e) =>
                          change("contact_phone", e.target.value)
                        }
                        placeholder="55 1234 5678"
                      />
                      <small>
                        Para México, escribe 10 dígitos. Para otro país, incluye
                        + y su código de país.
                      </small>
                    </label>
                  ) : (
                    <label className="rg-field">
                      Correo electrónico
                      <input
                        type="email"
                        autoComplete="email"
                        maxLength={254}
                        value={answers.contact_email || ""}
                        onChange={(e) =>
                          change("contact_email", e.target.value)
                        }
                        placeholder="tu.correo@ejemplo.com"
                      />
                    </label>
                  )}
                  <p className="rg-muted">
                    El dato es privado: solo tú y el equipo autorizado pueden
                    verlo. Se utilizará para coordinar contigo si eres
                    seleccionado.
                  </p>
                </fieldset>
                <p className="rg-note">
                  No tener portafolio no elimina tu postulación.
                </p>
              </>
            )}
            {section === "review" && (
              <>
                <Summary
                  answers={answers}
                  onEdit={(target) => move(target, -1)}
                />
                {warnings(answers).map((w) => (
                  <p className="rg-warning" key={w}>
                    {w} El equipo revisará tu compatibilidad; este aviso no
                    decide por ti.
                  </p>
                ))}
                <label className="rg-check">
                  <input
                    type="checkbox"
                    checked={terms}
                    onChange={(e) => setTerms(e.target.checked)}
                  />
                  He leído y acepto los{" "}
                  <button
                    ref={termsButton}
                    className="rg-inline-button"
                    type="button"
                    onClick={() => setShowTerms(true)}
                  >
                    términos y condiciones de participación y privacidad
                  </button>
                  .
                </label>
                <label className="rg-check">
                  <input
                    type="checkbox"
                    checked={truth}
                    onChange={(e) => setTruth(e.target.checked)}
                  />
                  Confirmo que mis respuestas son propias y verdaderas.
                </label>
              </>
            )}
          </div>
        </motion.section>
      </AnimatePresence>
      <footer className="rg-sticky-nav">
        {error && (
          <p className="rg-error" role="alert">
            {error}
          </p>
        )}
        <div>
          <button
            className="rg-button secondary"
            onClick={() => (index ? move(steps[index - 1][0], -1) : leave())}
            disabled={busy || uploading}
          >
            ← {index ? "Anterior" : "Convocatoria"}
          </button>
          <span>Guardado por cuenta · respuestas privadas</span>
          {section === "review" ? (
            <button
              className="rg-button rg-submit"
              disabled={busy || uploading || closed || saving === "loading"}
              onClick={submit}
            >
              {busy ? "Confirmando envío…" : "Enviar mi postulación →"}
            </button>
          ) : (
            <button
              className="rg-button"
              disabled={
                busy ||
                uploading ||
                saving === "loading" ||
                !initialized.current
              }
              onClick={() => move(steps[index + 1][0], 1)}
            >
              Continuar →
            </button>
          )}
        </div>
      </footer>
      {showTerms && <Conditions onClose={closeTerms} />}
    </main>
  );
}
function Summary({ answers, onEdit }) {
  return (
    <dl className="rg-answer-summary">
      {sectionsFor(answers)
        .filter(([key]) => key !== "review")
        .map(([section, keys]) => (
          <div key={section}>
            <dt>
              {copy[section][0]}
              {onEdit && (
                <button type="button" onClick={() => onEdit(section)}>
                  Editar
                </button>
              )}
            </dt>
            <dd>
              {keys.map((key) => (
                <p key={key}>
                  <strong>
                    {QUESTIONS[key]?.[0] ||
                      {
                        area: "Área principal",
                        secondary: "Área secundaria",
                        motivation: "Motivación",
                        scenario: "Mini-situación",
                        sample: "Muestra",
                        contact_email: "Correo de contacto",
                        contact_phone: "Teléfono de contacto",
                      }[key]}
                    :{" "}
                  </strong>
                  {key === "area" || key === "secondary"
                    ? answers[key]
                      ? areaName(answers[key])
                      : "Sin área secundaria"
                    : Array.isArray(answers[key])
                      ? answers[key].map((v) => label(key, v)).join(" · ")
                      : key === "sample"
                        ? answers.sample === "none"
                          ? "Sin muestra"
                          : answers.sample === "link"
                            ? answers.sample_url
                            : answers.sample_name
                        : label(key, answers[key])}
                </p>
              ))}
            </dd>
          </div>
        ))}
    </dl>
  );
}
function App() {
  const [session, setSession] = useState(null),
    [user, setUser] = useState(null),
    [access, setAccess] = useState({}),
    [definition, setDefinition] = useState(
      preview
        ? { key: CYCLE, is_open: true, opens_at: OPEN_AT, closes_at: CLOSE_AT }
        : null,
    ),
    [view, setView] = useState("landing"),
    [loading, setLoading] = useState(!preview),
    [error, setError] = useState(""),
    [showTerms, setShowTerms] = useState(false);
  useEffect(() => {
    if (preview) {
      setLoading(false);
      return;
    }
    let mounted = true;
    let epoch = 0;
    async function restore(next) {
      const current = ++epoch;
      setSession(next);
      setUser(null);
      setAccess({});
      if (!next) {
        setUser(null);
        setAccess({});
        return;
      }
      const [profile, permissions] = await Promise.all([
        supabase
          .from("usuarios")
          .select("id,nombre,nombre_publico")
          .eq("id", next.user.id)
          .maybeSingle(),
        supabase.rpc("gimg_recruitment_access"),
      ]);
      if (!mounted || current !== epoch) return;
      if (profile.error || !profile.data) {
        setError("No pudimos abrir tu GBA ID. Reintenta el acceso.");
        return;
      }
      setUser(profile.data);
      setAccess(permissions.data || {});
    }
    async function load() {
      if (preview) {
        setLoading(false);
        return;
      }
      const { data, error: failed } = await supabase
        .from("gimg_recruitment_cycles")
        .select("*")
        .eq("key", CYCLE)
        .single();
      if (!mounted) return;
      if (failed)
        setError(
          "La convocatoria todavía no pudo abrirse. Vuelve a intentar en unos momentos.",
        );
      else setDefinition(data);
      const { data: auth } = await supabase.auth.getSession();
      await restore(auth.session);
      if (mounted) setLoading(false);
    }
    load();
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      queueMicrotask(() => restore(next));
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);
  function start() {
    if (preview) {
      setUser({
        id: "preview",
        nombre: "tu.gba.id",
        nombre_publico: "Tu nombre de presentación",
      });
      setSession({ user: { id: "preview" } });
      setView("questionnaire");
      return;
    }
    setView(user ? "questionnaire" : "identity");
  }
  async function login(next) {
    setSession(next);
    const { data, error: failed } = await supabase
      .from("usuarios")
      .select("id,nombre,nombre_publico")
      .eq("id", next.user.id)
      .single();
    if (failed) {
      setError("No pudimos abrir tu cuenta. Reintenta.");
      return;
    }
    setUser(data);
    setView("questionnaire");
  }
  const open =
    definition?.is_open &&
    Date.now() >= Date.parse(definition.opens_at) &&
    Date.now() < Date.parse(definition.closes_at);
  return (
    <div className="rg-root">
      <header className="rg-header rg-wrap">
        <a
          className="rg-brand"
          href="/convocatoria/gimg/"
          aria-label="Convocatoria GIMG"
        >
          <img src="/gba/assets/brand.svg" width="34" height="34" alt="" />
          <span>
            GBA <small>GIMG</small>
          </span>
        </a>
        <div>
          {user ? (
            <>
              <span>@{user.nombre}</span>
              <button
                className="rg-text-button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  setView("landing");
                }}
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <button
              className="rg-text-button"
              onClick={() => setView("identity")}
            >
              Mi GBA ID ↗
            </button>
          )}
        </div>
      </header>
      {loading ? (
        <main className="rg-wrap rg-loading" aria-busy="true">
          <h1>Una historia está por comenzar.</h1>
          <p>Abriendo la convocatoria…</p>
        </main>
      ) : management ? (
        user ? (
          access.reviewer ? (
            <ReviewPanel key={user.id} director={access.director} user={user} />
          ) : (
            <main className="rg-wrap rg-panel">
              <h1>Acceso del equipo de selección.</h1>
              <p>
                Esta cuenta no tiene permiso para revisar postulaciones. Pide a
                Dirección que añada tu GBA ID.
              </p>
            </main>
          )
        ) : (
          <main className="rg-wrap">
            <Identity onSession={login} />
          </main>
        )
      ) : view === "identity" ? (
        <main className="rg-wrap">
          <button className="rg-text-button" onClick={() => setView("landing")}>
            ← Volver a la convocatoria
          </button>
          <Identity onSession={login} />
        </main>
      ) : view === "questionnaire" && user && definition ? (
        <Questionnaire
          key={session.user.id}
          session={session}
          user={user}
          definition={definition}
          onBack={() => setView("landing")}
        />
      ) : (
        <main>
          <section className="rg-hero rg-wrap">
            <div>
              <p className="rg-kicker">
                CONVOCATORIA GIMG · CICLO EDITORIAL 2026
              </p>
              <h1>
                Hay historias
                <br />
                que merecen
                <br />
                <em>seguir vivas.</em>
              </h1>
              <p className="rg-lead">
                Forma parte del primer equipo editorial y creativo de Global
                Insight Media Group.
              </p>
              <p>
                Investigar. Escribir. Diseñar. Ilustrar. Encontrar una mirada y
                convertirla en una publicación que podamos compartir.
              </p>
              <div className="rg-actions">
                <button
                  className="rg-button"
                  onClick={start}
                  disabled={!definition && !preview}
                >
                  {user
                    ? "Mi postulación →"
                    : open
                      ? "Quiero participar →"
                      : "Consultar convocatoria →"}
                </button>
                <a className="rg-button secondary" href="#areas">
                  Conocer las áreas ↓
                </a>
              </div>
              <p className="rg-date">
                8–18 de octubre · 7–10 minutos · 15 plazas
              </p>
            </div>
            <Floral />
          </section>
          <section className="rg-community rg-wrap">
            <span>DIRIGIDA A</span>
            <h2>{COMMUNITY}</h2>
            <p>
              Una iniciativa editorial de GBA y GIMG. No necesitas experiencia
              profesional: buscamos compromiso, criterio y disposición para
              aprender junto a otras personas.
            </p>
          </section>
          <section className="rg-wrap rg-cycle">
            <p className="rg-kicker">UN CICLO PARA CREAR JUNTOS</p>
            <h2>
              Memoria. Imaginación.
              <br />
              Una mirada propia.
            </h2>
            <div className="rg-cycle-grid">
              <article>
                <span>01</span>
                <h3>Día de Muertos</h3>
                <p>
                  Una edición para contar, recordar y dar forma a las historias
                  que nos acompañan.
                </p>
              </article>
              <article>
                <span>02</span>
                <h3>Halloween</h3>
                <p>
                  Otra edición principal para explorar lo inquietante con
                  intención y criterio editorial.
                </p>
              </article>
              <article>
                <span>03</span>
                <h3>Tres microediciones</h3>
                <p>
                  Leyendas que encontrarán su lugar en publicaciones breves del
                  ciclo.
                </p>
              </article>
            </div>
          </section>
          <section className="rg-wrap rg-areas" id="areas">
            <p className="rg-kicker">MUCHAS FORMAS DE APORTAR</p>
            <h2>Encuentra tu lugar.</h2>
            <div>
              {AREAS.map(([key, name, places], i) => (
                <article key={key}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <h3>{name}</h3>
                  <p>{SCENARIOS[key][0]}</p>
                  <strong>
                    {places} {places === 1 ? "plaza" : "plazas"}
                  </strong>
                </article>
              ))}
            </div>
            <p className="rg-note">
              Las dos plazas de Producción incluyen Responsable de Producción y
              Coordinación de Producción y Workspace. Diseño incluye una
              responsabilidad de maquetación. Podrá haber hasta cinco personas
              en reserva.
            </p>
          </section>
          <section className="rg-how rg-wrap">
            <p className="rg-kicker">SENCILLO, A TU RITMO</p>
            <h2>
              Tu perspectiva.
              <br />
              Dos respuestas. Un comienzo.
            </h2>
            <div>
              <article>
                <strong>01</strong>
                <h3>Tu GBA ID</h3>
                <p>
                  Una cuenta desarrollada por GBA para guardar tu postulación y
                  consultar su estado. Entra con tu nombre y un PIN de 4
                  dígitos; conserva tu código de recuperación.
                </p>
              </article>
              <article>
                <strong>02</strong>
                <h3>Tu postulación</h3>
                <p>
                  Opciones claras, una motivación breve y una sola
                  mini-situación de tu área. La muestra de trabajo es opcional.
                </p>
              </article>
              <article>
                <strong>03</strong>
                <h3>Una revisión humana</h3>
                <p>
                  La decisión considera tus respuestas y la cobertura del
                  equipo. Tu resultado aparecerá en tu GBA ID; el correo se
                  usará para coordinar si eres seleccionado.
                </p>
              </article>
            </div>
            <p>
              El trabajo se organizará en GBA Workspace. El acceso se concederá
              después de la selección y confirmación del puesto.
            </p>
            <button className="rg-button" onClick={start}>
              Comenzar mi postulación →
            </button>
            <button
              className="rg-text-button"
              onClick={() => setShowTerms(true)}
            >
              Leer condiciones de participación y privacidad
            </button>
          </section>
        </main>
      )}
      {error && (
        <p className="rg-wrap rg-error" role="alert">
          {error}
        </p>
      )}
      <footer className="rg-footer rg-wrap">
        <span>GBA · Global Insight Media Group</span>
        <span>See it differently.</span>
        <a href="mailto:contacto@gba.software">Contacto del proceso ↗</a>
        {access.reviewer && (
          <a href="/convocatoria/gimg/gestion/">Gestión de postulaciones</a>
        )}
      </footer>
      {showTerms && <Conditions onClose={() => setShowTerms(false)} />}
      {preview && (
        <aside className="rg-preview">
          Vista de desarrollo: las respuestas no se envían.
        </aside>
      )}
    </div>
  );
}
const root =
  import.meta.hot?.data.root ??
  createRoot(document.getElementById("recruitment-root"));
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(<App />);
