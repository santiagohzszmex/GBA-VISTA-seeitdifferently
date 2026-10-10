import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { createSessionLoader } from '../auth/sessionLoader';

const AuthContext = createContext();

export const AuthProvider = ({ children, productName = 'VISTA' }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const loader = useRef(null);

  useEffect(() => {
    let lastActivityUserId = null;
    let lastActivityAt = 0;
    let activityPending = false;
    const recordActivity = async userId => {
      if (!userId || activityPending) return;
      const now = Date.now();
      if (lastActivityUserId === userId && now - lastActivityAt < 10 * 60 * 1000) return;
      activityPending = true;
      try {
        const { error } = await supabase.rpc('vista_record_user_activity');
        if (!error) { lastActivityUserId = userId; lastActivityAt = now; }
      } catch { /* Activity reporting must never block access. */ } finally { activityPending = false; }
    };
    const sessionLoader = createSessionLoader({
      auth: supabase.auth,
      readProfile: async (userId, signal) => {
        const { data, error } = await supabase.from('usuarios').select('*').eq('id', userId).abortSignal(signal).maybeSingle();
        if (error) throw error;
        return data;
      },
      recordActivity,
      onUser: nextUser => {
        if (!nextUser) { lastActivityUserId = null; lastActivityAt = 0; }
        setUser(nextUser);
      },
      onLoading: setLoading,
      onError: setSessionError
    });
    loader.current = sessionLoader;
    void sessionLoader.start();

    const recordVisibleSession = async () => {
      if (document.visibilityState !== 'visible') return;
      const { data, error } = await supabase.auth.getSession();
      if (!error && data.session?.user?.id) void recordActivity(data.session.user.id);
    };
    document.addEventListener('visibilitychange', recordVisibleSession);
    return () => {
      document.removeEventListener('visibilitychange', recordVisibleSession);
      sessionLoader.dispose();
      if (loader.current === sessionLoader) loader.current = null;
    };
  }, []);

  const logout = async () => { await supabase.auth.signOut(); };
  const refreshUser = async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.user?.id) return null;
    const { data, error } = await supabase.from('usuarios').select('*').eq('id', sessionData.session.user.id).abortSignal(AbortSignal.timeout(12000)).maybeSingle();
    if (!error && data) setUser(data);
    return data || null;
  };
  const value = { user, isDueño: user?.rol === 'Dueño' || user?.rol === 'Admin', logout, refreshUser };

  return <AuthContext.Provider value={value}>
    {loading || sessionError ? <main className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] flex items-center justify-center px-6 font-sans" aria-busy={loading}>
      <div className="max-w-md text-center">
        <p className={productName === 'Workspace' ? 'text-3xl font-semibold tracking-tight mb-7' : 'font-serif italic text-5xl mb-7'}>{productName === 'Workspace' ? productName : 'VISTA.'}</p>
        {sessionError ? <>
          <p className="text-sm leading-7 text-[#6e6e73]" role="alert">{sessionError}</p>
          <button type="button" onClick={() => void loader.current?.restore()} className="mt-7 px-7 py-3 rounded-full bg-[#0066ff] text-white font-bold text-sm">Reintentar</button>
        </> : <p className="text-xs tracking-widest uppercase text-[#6e6e73]" role="status">Abriendo {productName}…</p>}
      </div>
    </main> : children}
  </AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
