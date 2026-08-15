import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import VISTAHome from './VISTAHome';
import VISTAAuth from './VISTAAuth';
import PerfilUsuario from './views/PerfilUsuario';
import PerfilEditorial from './views/news/PerfilEditorial';
import WorkspaceView from './views/Workspace';
import NetworkPreview from './views/NetworkPreview';

// Creamos un sub-componente para poder "sintonizar" el contexto
function MainApp() {
  const { user } = useAuth();
  const searchParams = new URLSearchParams(window.location.search);
  const publicHandle = searchParams.get('profile');
  const publicEditorial = searchParams.get('editorial');
  const workspacePreview = import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('workspace-preview') === '1';
  const networkPreview = import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('network-preview') === '1';

  if (networkPreview) return <NetworkPreview previewMode />;
  if (workspacePreview) return <WorkspaceView previewMode />;
  if (publicHandle) return <PerfilUsuario publicHandle={publicHandle} />;
  if (publicEditorial) return <PerfilEditorial selloNombre={publicEditorial} publicEditorial />;
  
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
