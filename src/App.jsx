import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import VISTAHome from './VISTAHome';
import VISTAAuth from './VISTAAuth';
import PerfilUsuario from './views/PerfilUsuario';
import PerfilEditorial from './views/news/PerfilEditorial';
import WorkspaceView from './views/Workspace';
import NetworkPreview from './views/NetworkPreview';
import GlobalRadioPlayer from './components/radio/GlobalRadioPlayer';
import { RadioProvider } from './radio/RadioContext';

const SurveyPage = React.lazy(() => import('./views/SurveyPage'));
const isSurveyRoute = window.location.pathname.replace(/\/$/, '') === '/encuesta/partners'
  || new URLSearchParams(window.location.search).get('encuesta') === 'partners';

// Creamos un sub-componente para poder "sintonizar" el contexto
function MainApp() {
  const { user } = useAuth();
  const searchParams = new URLSearchParams(window.location.search);
  if (isSurveyRoute) return <React.Suspense fallback={<div className="min-h-screen bg-[#0a0a0a] text-white p-12">Abriendo VISTA…</div>}><SurveyPage previewMode={import.meta.env.DEV && searchParams.get('survey-preview') === '1'} /></React.Suspense>;
  const publicHandle = searchParams.get('profile');
  const publicEditorial = searchParams.get('editorial');
  const workspacePreview = import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('workspace-preview') === '1';
  const networkPreview = import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('network-preview') === '1';

  if (networkPreview) return <NetworkPreview previewMode />;
  if (workspacePreview) return <WorkspaceView previewMode />;
  if (publicHandle) return user
    ? <PerfilUsuario publicHandle={publicHandle} />
    : <VISTAAuth onLogin={() => {}} />;
  if (publicEditorial) return user
    ? <PerfilEditorial selloNombre={publicEditorial} publicEditorial />
    : <VISTAAuth onLogin={() => {}} />;
  
  // El Router Maestro: Si hay sesión, entra a VISTA. Si no, al muro de Auth.
  return user ? <VISTAHome /> : <VISTAAuth onLogin={() => {}} />;
}

function App() {
  return (
    <RadioProvider>
      {/* AuthProvider envuelve todo el edificio */}
      <AuthProvider>
        <MainApp />
        {!isSurveyRoute && <GlobalRadioPlayer />}
      </AuthProvider>
    </RadioProvider>
  );
}

export default App;
