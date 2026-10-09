// Browsers cap timers at a signed 32-bit delay. Recheck long licenses instead
// of interpreting that cap as the expiration time.
export function scheduleLicenseExpiry(expiresAt, expire, { now = Date.now, set = setTimeout, clear = clearTimeout } = {}) {
  let timer;
  let cancelled = false;
  const check = () => {
    if (cancelled) return;
    const remaining = Date.parse(expiresAt) - now();
    if (!Number.isFinite(remaining) || remaining <= 0) { expire(); return; }
    timer = set(check, Math.min(remaining, 2147483647));
  };
  check();
  return () => { cancelled = true; clear(timer); };
}
