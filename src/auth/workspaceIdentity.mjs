export function workspaceIdentityRequest(mode, {handle, pin, confirmation = '', recovery = '', recoverySaved = false}) {
  if (!['login', 'register', 'recover'].includes(mode)) throw Error('Elige cómo quieres entrar.');
  const name = handle.trim().replace(/^@/, '').replace(/\s+/g, ' ');
  if (!/^[a-z0-9áéíóúüñ ._-]{3,64}$/i.test(name)) throw Error('Escribe un GBA ID de 3 a 64 caracteres, con letras, números, espacios, puntos, guiones o guiones bajos.');
  if (!/^\d{4}$/.test(pin)) throw Error('Escribe un PIN de 4 dígitos.');
  const secret = recovery.trim();
  if (mode !== 'login') {
    if (pin !== confirmation) throw Error('Los dos PIN deben coincidir.');
    if (!secret || secret.length > 256) throw Error('Escribe tu código o frase de recuperación.');
    if (mode === 'register' && secret.length < 8) throw Error('Elige una frase de recuperación de al menos 8 caracteres.');
    if (mode === 'register' && !recoverySaved) throw Error('Confirma que guardaste tu frase de recuperación en un lugar privado.');
  }
  return {action: mode, handle: name, pin, recovery: mode === 'login' ? '' : secret};
}
