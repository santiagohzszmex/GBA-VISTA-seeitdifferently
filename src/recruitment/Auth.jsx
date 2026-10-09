import React, { useState } from "react";
import { supabase } from "../supabaseClient";
const normalize = (v) =>
  v
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 24);
export default function Identity({ onSession }) {
  const [mode, setMode] = useState("register"),
    [handle, setHandle] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [code, setCode] = useState(""),
    [recovery, setRecovery] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [terms, setTerms] = useState(false),
    [saved, setSaved] = useState(false);
  const switchMode = (m) => {
    setMode(m);
    setError("");
    setPassword("");
    setConfirmation("");
    setCode("");
  };
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const id = normalize(handle);
      if (id.length < 3)
        throw Error("El identificador debe tener entre 3 y 24 caracteres.");
      if (mode === "recover") {
        if (password.length < 10 || password !== confirmation)
          throw Error("Confirma una nueva clave de al menos 10 caracteres.");
        const { data, error: failed } = await supabase.rpc(
          "gimg_recover_identity",
          {
            p_handle: id,
            p_code: code.trim().replaceAll("-", "").toLowerCase(),
            p_password: password,
          },
        );
        if (failed || !data)
          throw Error(
            "No pudimos recuperar el acceso. Revisa tu GBA ID y el código, o vuelve a intentar más tarde.",
          );
        switchMode("login");
        setError("Tu clave se actualizó. Ahora puedes iniciar sesión.");
        return;
      }
      if (mode === "register") {
        if (!terms)
          throw Error("Confirma que has leído la información de tu cuenta.");
        if (
          password.length < 10 ||
          password.length > 128 ||
          password !== confirmation
        )
          throw Error("Elige y confirma una clave de 10 a 128 caracteres.");
        const { data: available, error: lookupError } = await supabase.rpc(
          "gimg_id_available",
          { p_handle: id },
        );
        if (lookupError)
          throw Error(
            "No pudimos comprobar el identificador. Inténtalo de nuevo.",
          );
        if (!available)
          throw Error("Ese GBA ID ya está en uso. Elige otro o inicia sesión.");
        const secret = Array.from(
          crypto.getRandomValues(new Uint8Array(24)),
          (x) => x.toString(16).padStart(2, "0"),
        ).join("");
        const { data, error: failed } = await supabase.auth.signUp({
          email: `${id}@id.gba.software`,
          password,
          options: { data: { nombre: id, gimg_candidate: true } },
        });
        if (failed)
          throw Error(
            "No pudimos crear tu GBA ID. Espera un momento y vuelve a intentar.",
          );
        if (!data.session)
          throw Error(
            "El registro no pudo iniciar la sesión. Contacta a GBA; no vuelvas a crear otra cuenta.",
          );
        const digest = Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(secret),
            ),
          ),
          (x) => x.toString(16).padStart(2, "0"),
        ).join("");
        const { error: recoveryError } = await supabase.rpc(
          "gimg_init_identity",
          { p_hash: digest },
        );
        if (recoveryError) {
          await supabase.auth.signOut();
          throw Error(
            "La cuenta se creó, pero falta configurar su recuperación. Contacta a GBA indicando tu identificador.",
          );
        }
        setRecovery(secret);
        setPassword("");
        setConfirmation("");
        return;
      }
      const legacy = /^\d{4}$/.test(password);
      const { data, error: failed } = await supabase.auth.signInWithPassword({
        email: `${id}@${legacy ? "gba.com" : "id.gba.software"}`,
        password: legacy ? `GBA-${password}-SecureVault` : password,
      });
      if (failed || !data.session)
        throw Error(
          "GBA ID o clave incorrectos. Para una cuenta anterior, usa su clave de cuatro dígitos.",
        );
      onSession(data.session);
    } catch (failed) {
      setError(failed.message);
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    const { data } = await supabase.auth.getSession();
    onSession(data.session);
    setRecovery("");
  }
  return (
    <section className="rg-auth rg-panel" aria-labelledby="identity-title">
      <p className="rg-kicker">UNA CUENTA DE GBA</p>
      <h2 id="identity-title">
        Tu lugar en el equipo
        <br />
        empieza contigo.
      </h2>
      <p>
        GBA ID es la cuenta desarrollada por GBA para guardar tu postulación y
        consultar su estado. Tu correo de contacto se pide en el cuestionario,
        para coordinar contigo si resultas seleccionado.
      </p>
      {recovery ? (
        <div className="rg-recovery">
          <h3>Guarda tu código de recuperación.</h3>
          <p>
            Es la forma de recuperar tu cuenta si olvidas la clave. Solo se
            muestra ahora. Consérvalo en un lugar privado.
          </p>
          <code>{recovery.match(/.{1,8}/g).join("-")}</code>
          <button
            type="button"
            className="rg-button secondary"
            onClick={() => {
              const blob = new Blob(
                [
                  `GBA ID: ${handle}\nCódigo de recuperación: ${recovery}\nGuarda este archivo en privado.\n`,
                ],
                { type: "text/plain" },
              );
              const url = URL.createObjectURL(blob),
                a = document.createElement("a");
              a.href = url;
              a.download = "gba-id-recuperacion.txt";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Guardar código en un archivo
          </button>
          <label className="rg-check">
            <input
              type="checkbox"
              checked={saved}
              onChange={(e) => setSaved(e.target.checked)}
            />
            He guardado mi código en un lugar privado.
          </label>
          <button className="rg-button" disabled={!saved} onClick={finish}>
            Continuar con mi postulación →
          </button>
        </div>
      ) : (
        <>
          <div className="rg-tabs" role="group" aria-label="Acceso GBA ID">
            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => switchMode("register")}
            >
              Crear GBA ID
            </button>
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => switchMode("login")}
            >
              Ya tengo GBA ID
            </button>
          </div>
          <form onSubmit={submit}>
            <label className="rg-field">
              Tu GBA ID
              <input
                autoComplete="username"
                value={handle}
                minLength={3}
                maxLength={24}
                onChange={(e) => setHandle(normalize(e.target.value))}
                required
                placeholder="por.ejemplo.luna"
              />
              <small>
                Un identificador de presentación. Puedes elegir un alias.
              </small>
            </label>
            {mode === "recover" && (
              <label className="rg-field">
                Código de recuperación
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="off"
                  required
                />
              </label>
            )}
            <label className="rg-field">
              {mode === "recover" ? "Nueva clave" : "Tu clave"}
              <input
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                maxLength={128}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <small>
                {mode === "login"
                  ? "Las cuentas anteriores pueden usar su clave de cuatro dígitos."
                  : "Al menos 10 caracteres. Combina varias palabras que recuerdes."}
              </small>
            </label>
            {mode !== "login" && (
              <label className="rg-field">
                Confirma tu clave
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  required
                />
              </label>
            )}
            {mode === "register" && (
              <label className="rg-check">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                  required
                />
                Entiendo que GBA guardará mi identificador y credenciales de
                acceso para gestionar mi postulación. Conservaré mi código de
                recuperación.
              </label>
            )}
            {error && (
              <p role="alert" className="rg-error">
                {error}
              </p>
            )}
            <button className="rg-button" disabled={busy}>
              {busy
                ? "Un momento…"
                : mode === "register"
                  ? "Crear mi GBA ID →"
                  : mode === "recover"
                    ? "Recuperar acceso"
                    : "Iniciar sesión →"}
            </button>
          </form>
          <button
            className="rg-text-button"
            type="button"
            onClick={() => switchMode(mode === "recover" ? "login" : "recover")}
          >
            {mode === "recover"
              ? "Volver al acceso"
              : "Recuperar una cuenta creada aquí"}
          </button>
        </>
      )}
    </section>
  );
}
