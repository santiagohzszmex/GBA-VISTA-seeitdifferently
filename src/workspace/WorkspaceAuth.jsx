import React, { useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { authenticateGbaId } from '../auth/identityGateway';
import workspaceIcon from '../../src-tauri/icons/128x128.png';
import './workspaceAuth.css';

export default function WorkspaceAuth() {
  const [mode, setMode] = useState('login');
  const [handle, setHandle] = useState('');
  const [pin, setPin] = useState('');
  const [recovery, setRecovery] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const nameInput = useRef(null);
  const recovering = mode === 'recover';

  function changeMode(nextMode) {
    setMode(nextMode);
    setPin('');
    setRecovery('');
    setConfirmation('');
    setShowPin(false);
    setError('');
    nameInput.current?.focus();
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    const name = handle.trim().replace(/^@/, '');
    if (name.length < 3 || name.length > 64) {
      setError('Escribe el nombre de tu GBA ID, de 3 a 64 caracteres.');
      nameInput.current?.focus();
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setError('Escribe tu PIN de 4 dígitos.');
      return;
    }
    if (recovering && (!recovery.trim() || pin !== confirmation)) {
      setError(!recovery.trim() ? 'Escribe tu código o frase de recuperación.' : 'Los dos PIN deben coincidir.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      await authenticateGbaId(mode, name, pin, recovering ? recovery.trim() : '');
    } catch (failed) {
      setError(failed.message || 'No pudimos entrar. Revisa tus datos e inténtalo de nuevo.');
      setPin('');
      setConfirmation('');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <main className="wa" aria-labelledby="workspace-access-title">
    <header className="wa-header"><div className="wa-brand"><img src={workspaceIcon} alt="" width="36" height="36" /><span>Workspace</span></div><span className="wa-byline">GBA Forge</span></header>
    <section className="wa-card">
      <img className="wa-icon" src={workspaceIcon} alt="" width="88" height="88" />
      <p className="wa-eyebrow">EL ESPACIO DE TRABAJO DE GIMG</p>
      <h1 id="workspace-access-title">{recovering ? 'Recupera tu acceso.' : 'Bienvenido a Workspace.'}</h1>
      <p className="wa-intro">{recovering ? 'Usa el código o la frase que guardaste al crear tu GBA ID y elige un nuevo PIN.' : 'Entra con tu GBA ID para continuar con tu equipo.'}</p>
      <form onSubmit={submit} aria-busy={busy}>
        <fieldset disabled={busy}>
          <label className="wa-field" htmlFor="workspace-gba-id">Tu GBA ID
            <input ref={nameInput} id="workspace-gba-id" name="username" autoComplete="username" type="text" maxLength={65} autoCapitalize="none" spellCheck="false" required value={handle} onChange={event => setHandle(event.target.value)} placeholder="Tu nombre o @usuario" aria-describedby="workspace-account-help" />
          </label>
          <p id="workspace-account-help" className="wa-field-help">{recovering ? 'El mismo nombre que usas para iniciar sesión.' : 'Si te postulaste a GIMG, usa el nombre de esa cuenta.'}</p>
          {recovering && <label className="wa-field" htmlFor="workspace-recovery">Código o frase de recuperación
            <input id="workspace-recovery" name="recovery" type="password" autoComplete="off" maxLength={256} required value={recovery} onChange={event => setRecovery(event.target.value)} />
          </label>}
          <div className="wa-field"><label htmlFor="workspace-pin">{recovering ? 'Nuevo PIN' : 'Tu PIN'}</label>
            <span className="wa-pin"><input id="workspace-pin" name="password" type={showPin ? 'text' : 'password'} inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} autoComplete={recovering ? 'new-password' : 'current-password'} required value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} aria-describedby="workspace-pin-help" /><button type="button" onClick={() => setShowPin(current => !current)} aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'} aria-pressed={showPin}>{showPin ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></span>
          </div>
          <p id="workspace-pin-help" className="wa-field-help">Tu clave de acceso de 4 dígitos.</p>
          {recovering && <label className="wa-field" htmlFor="workspace-pin-confirm">Confirma tu nuevo PIN
            <input id="workspace-pin-confirm" name="password-confirmation" type="password" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} autoComplete="new-password" required value={confirmation} onChange={event => setConfirmation(event.target.value.replace(/\D/g, '').slice(0, 4))} />
          </label>}
          {error && <p className="wa-error" role="alert">{error}</p>}
          <button className="wa-submit" type="submit">{busy ? <><Loader2 size={18} className="wa-spinner" aria-hidden="true" />Comprobando acceso…</> : <>{recovering ? 'Recuperar y entrar' : 'Entrar a Workspace'}<ArrowRight size={18} aria-hidden="true" /></>}</button>
        </fieldset>
      </form>
      <button className="wa-text-button" type="button" disabled={busy} onClick={() => changeMode(recovering ? 'login' : 'recover')}>{recovering ? 'Volver al inicio de sesión' : '¿Olvidaste tu PIN?'}</button>
      {!recovering && <p className="wa-team-note">Tus ediciones y asignaciones aparecerán cuando el equipo active tu acceso.</p>}
    </section>
    <footer className="wa-footer">GBA ID · Una misma cuenta para tu equipo.</footer>
  </main>;
}
