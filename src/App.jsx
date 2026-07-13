import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import VISTAHome from './VISTAHome';
import VISTAAuth from './VISTAAuth';
import PerfilUsuario from './views/PerfilUsuario';

// Creamos un sub-componente para poder "sintonizar" el contexto
function MainApp() {
  const { user } = useAuth();
  const publicHandle = new URLSearchParams(window.location.search).get('profile');

  if (publicHandle) return <PerfilUsuario publicHandle={publicHandle} />;
  
  // El Router Maestro: Si hay sesión, entra a VISTA. Si no, al muro de Auth.
  return user ? <VISTAHome /> : <VISTAAuth onLogin={() => {}} />;
}

function App() {
  return (
    // AuthProvider envuelve todo el edificio
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
