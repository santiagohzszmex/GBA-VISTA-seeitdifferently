import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient'; 

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Buscar sesión guardada al abrir la página (Persistencia Automática)
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const { data: userData, error } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id', session.user.id)
          .single();

        // 🚨 EL DETECTOR DE FANTASMAS
        // Si hay error o no existe userData, significa que el GBA ID fue eliminado.
        if (error || !userData) {
          console.warn("Sesión fantasma detectada. Destruyendo token...");
          await supabase.auth.signOut();
          setUser(null);
        } else {
          // Si todo está bien, seteamos al usuario correctamente
          setUser(userData);
        }
      }
      setLoading(false);
    };

    fetchSession();

    // 2. Escuchar en tiempo real cuando alguien se loguea o se sale
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const { data: userData, error } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id', session.user.id)
          .single();
          
        if (error || !userData) {
          await supabase.auth.signOut();
          setUser(null);
        } else {
          setUser(userData);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return null;
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', session.user.id)
      .single();
    if (!error && data) setUser(data);
    return data || null;
  };

  const value = {
    user,
    isDueño: user?.rol === 'Dueño' || user?.rol === 'Admin',
    logout,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
