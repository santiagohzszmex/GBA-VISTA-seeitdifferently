import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import VISTAHome from './VISTAHome';
import VISTAAuth from './VISTAAuth';
import { SpeedInsights } from '@vercel/speed-insights/react';

// Creamos un sub-componente para poder "sintonizar" el contexto
function MainApp() {
  const { user } = useAuth();
  
  // El Router Maestro: Si hay sesión, entra a VISTA. Si no, al muro de Auth.
  return user ? <VISTAHome /> : <VISTAAuth onLogin={() => {}} />;
}

function App() {
  return (
    // AuthProvider envuelve todo el edificio
    <AuthProvider>
      <MainApp />
      <SpeedInsights />
    </AuthProvider>
  );
}

export default App;