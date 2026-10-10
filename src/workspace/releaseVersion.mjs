export function nativeParts(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version || '')) throw Error('Invalid native version');
  const parts = version.split('.').map(Number);
  if (parts.some(part => !Number.isSafeInteger(part) || part < 0)) throw Error('Invalid native version');
  return parts;
}
export function newerNative(version, previous) {
  const a = nativeParts(version), b = nativeParts(previous);
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index] > b[index];
  return false;
}
// Public maintenance versions use a fourth component; native SemVer encodes
// the base patch and its maintenance revision in one monotonically increasing patch.
export function toNativeVersion(version) {
  if (!/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(version || '')) throw Error('Invalid public version');
  const [major, minor, base, revision = 0] = version.split('.').map(Number);
  if (![major, minor, base, revision].every(Number.isSafeInteger) || revision > 99 || base * 100 + revision > 65535) throw Error('Invalid maintenance version');
  return `${major}.${minor}.${base * 100 + revision}`;
}
export function displayVersion(version) {
  const [major, minor, patch] = nativeParts(version);
  if (patch < 100) return version;
  const base = `${major}.${minor}.${Math.floor(patch / 100)}`;
  return patch % 100 ? `${base}.${patch % 100}` : base;
}
