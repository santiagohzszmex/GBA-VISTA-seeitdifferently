import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { authenticateGbaId } from "../auth/identityGateway";
import {
  displayName,
  authName,
  validName,
  normalizePin,
  validPin,
  securePin,
} from "./identity.js";
export default function Identity({ onSession }) {
  const [mode, setMode] = useState("register"),
    [handle, setHandle] = useState(""),
    [pin, setPin] = useState(""),
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
    setPin("");
    setConfirmation("");
    setCode("");
  };
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const id = displayName(handle);
      if (!validName(id))
        throw Error(
          "Escribe tu nombre: de 3 a 64 caracteres, con letras, números o espacios.",
        );
      if (mode === "recover") {
        if (!validPin(pin) || pin !== confirmation)
          throw Error("Confirma tu nuevo PIN de 4 dígitos.");
        await authenticateGbaId('recover', id, pin, code.trim().replaceAll('-', '').toLowerCase(), true);
        await supabase.auth.signOut();
        switchMode("login");
        setError("Tu PIN se actualizó. Ahora puedes iniciar sesión.");
        return;
      }
      if (mode === "register") {
        if (!terms)
          throw Error("Confirma que has leído la información de tu cuenta.");
        if (!validPin(pin) || pin !== confirmation)
          throw Error("Elige y confirma un PIN de 4 dígitos.");
        const { data: available, error: lookupError } = await supabase.rpc(
          "gimg_id_available",
          { p_handle: id },
        );
        if (lookupError)
          throw Error(
            "No pudimos comprobar el identificador. Inténtalo de nuevo.",
          );
        if (!available)
          throw Error(
            "Ese nombre ya tiene un GBA ID. Inicia sesión o añade un apellido para distinguirte.",
          );
        const secret = Array.from(
          crypto.getRandomValues(new Uint8Array(24)),
          (x) => x.toString(16).padStart(2, "0"),
        ).join("");
        await authenticateGbaId('register', id, pin, secret, true);
        setRecovery(secret);
        setPin("");
        setConfirmation("");
        return;
      }
      if (!validPin(pin)) throw Error("Escribe tu PIN de 4 dígitos.");
      const session = await authenticateGbaId('login', id, pin);
      onSession(session);
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
        consultar su estado. Tu correo o teléfono de contacto se pide en el
        cuestionario, para coordinar contigo si resultas seleccionado.
      </p>
      {recovery ? (
        <div className="rg-recovery">
          <h3>Guarda tu código de recuperación.</h3>
          <p>
            Es la forma de recuperar tu cuenta si olvidas el PIN. Solo se
            muestra ahora. Consérvalo en un lugar privado.
          </p>
          <code>{recovery.match(/.{1,8}/g).join("-")}</code>
          <button
            type="button"
            className="rg-button secondary"
            onClick={() => {
              const blob = new Blob(
                [
                  `Tu nombre: ${displayName(handle)}\nCódigo de recuperación: ${recovery}\nGuarda este archivo en privado.\n`,
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
              disabled={busy}
              className={mode === "register" ? "active" : ""}
              onClick={() => switchMode("register")}
            >
              Crear GBA ID
            </button>
            <button
              type="button"
              disabled={busy}
              className={mode === "login" ? "active" : ""}
              onClick={() => switchMode("login")}
            >
              Ya tengo GBA ID
            </button>
          </div>
          <form onSubmit={submit}>
            <label className="rg-field">
              Tu nombre
              <input
                autoComplete="username"
                value={handle}
                minLength={3}
                maxLength={64}
                onChange={(e) => setHandle(e.target.value)}
                required
                placeholder="Por ejemplo, Luna García"
              />
              <small>
                Usa este mismo nombre para volver a entrar a tu GBA ID.
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
              {mode === "recover" ? "Nuevo PIN" : "Tu PIN"}
              <input
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={pin}
                maxLength={4}
                minLength={4}
                inputMode="numeric"
                pattern="[0-9]{4}"
                onChange={(e) => setPin(normalizePin(e.target.value))}
                required
              />
              <small>Un PIN de 4 dígitos, como el que ya usas en GBA ID.</small>
            </label>
            {mode !== "login" && (
              <label className="rg-field">
                Confirma tu PIN
                <input
                  type="password"
                  autoComplete="new-password"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  minLength={4}
                  maxLength={4}
                  value={confirmation}
                  onChange={(e) =>
                    setConfirmation(normalizePin(e.target.value))
                  }
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
                Entiendo que GBA guardará mi nombre y datos de acceso para
                gestionar mi postulación. Conservaré mi código de recuperación.
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
