// Profile requests must run after Supabase has released its auth event lock.
export function createSessionLoader({ auth, readProfile, recordActivity, onUser, onLoading, onError, timeoutMs = 12000 }) {
  let disposed = false;
  let version = 0;
  let cancelPending;
  let pending;
  let pendingUserId;
  let loadedUserId;
  let subscription;
  const eventTimers = new Set();
  const current = request => !disposed && request === version;

  const clearSession = () => {
    version += 1;
    cancelPending?.();
    pending = null;
    pendingUserId = null;
    for (const timer of eventTimers) clearTimeout(timer);
    eventTimers.clear();
    loadedUserId = null;
    if (!disposed) { onUser(null); onError(''); onLoading(false); }
  };

  const run = (session, fetchSession = false, force = false) => {
    if (disposed) return Promise.resolve(null);
    const userId = session?.user?.id;
    if (!fetchSession && userId && !force) {
      if (pending && pendingUserId === userId) return pending;
      if (loadedUserId === userId) { void recordActivity(userId); return Promise.resolve(null); }
    }
    const request = ++version;
    cancelPending?.();
    const requestController = new AbortController();
    pendingUserId = userId;
    onError('');
    onLoading(true);
    let timer;
    const task = (async () => {
      if (fetchSession) {
        const result = await auth.getSession();
        if (result.error) throw result.error;
        session = result.data.session;
      }
      if (!current(request) || requestController.signal.aborted) return null;
      if (!session?.user?.id) { loadedUserId = null; onUser(null); return null; }
      pendingUserId = session.user.id;
      const profile = await readProfile(session.user.id, requestController.signal);
      if (!current(request) || requestController.signal.aborted) return null;
      if (!profile) {
        // Only a successful lookup with no account means the GBA ID is gone.
        // Network failures must preserve the existing session for a retry.
        await auth.signOut();
        if (current(request)) { loadedUserId = null; onUser(null); }
        return null;
      }
      loadedUserId = session.user.id;
      onUser(profile);
      void recordActivity(session.user.id);
      return profile;
    })();
    const deadline = new Promise((_, reject) => {
      cancelPending = () => { requestController.abort(); reject(new Error('Session request cancelled')); };
      timer = setTimeout(() => {
        requestController.abort();
        reject(new Error('La conexión está tardando más de lo habitual. Tu sesión se conserva; puedes reintentar.'));
      }, timeoutMs);
    });
    pending = Promise.race([task, deadline]).catch(error => {
      if (current(request)) onError(error.message?.startsWith('La conexión está tardando')
        ? error.message : 'No pudimos verificar tu sesión. Comprueba tu conexión y vuelve a intentarlo.');
      return null;
    }).finally(() => {
      clearTimeout(timer);
      if (current(request)) { pending = null; pendingUserId = null; cancelPending = null; onLoading(false); }
    });
    return pending;
  };

  return {
    restore: () => run(null, true, true),
    load: (session, force = false) => run(session, false, force),
    clearSession,
    start() {
      const { data } = auth.onAuthStateChange((event, session) => {
        if (disposed) return;
        if (event === 'SIGNED_OUT') { clearSession(); return; }
        if (!['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) return;
        const timer = setTimeout(() => {
          eventTimers.delete(timer);
          if (!disposed) void run(session, false, event === 'USER_UPDATED');
        }, 0);
        eventTimers.add(timer);
      });
      subscription = data.subscription;
      return run(null, true);
    },
    dispose() {
      disposed = true;
      version += 1;
      cancelPending?.();
      for (const timer of eventTimers) clearTimeout(timer);
      eventTimers.clear();
      subscription?.unsubscribe();
    }
  };
}
