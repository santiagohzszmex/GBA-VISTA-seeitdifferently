import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import VISTAHome from './VISTAHome';
import VISTAAuth from './VISTAAuth';
import WorkspaceAuth from './workspace/WorkspaceAuth';
import PerfilUsuario from './views/PerfilUsuario';
import PerfilEditorial from './views/news/PerfilEditorial';
import WorkspaceView from './views/Workspace';
import NetworkPreview from './views/NetworkPreview';
import GlobalRadioPlayer from './components/radio/GlobalRadioPlayer';
import { RadioProvider } from './radio/RadioContext';

const StudioProfile = React.lazy(() => import('./views/StudioProfile'));
const WorkspacePublications = React.lazy(() => import('./workspace/WorkspacePublications'));
const SurveyPage = React.lazy(() => import('./views/SurveyPage'));
const UpdatePreview = import.meta.env.DEV ? React.lazy(() => import('./workspace/UpdatePreview')) : null;
const isSurveyRoute = window.location.pathname.replace(/\/$/, '') === '/encuesta/partners'
  || new URLSearchParams(window.location.search).get('encuesta') === 'partners';
const isWorkspaceRoute = window.location.pathname.replace(/\/$/, '') === '/workspace/web'
  || new URLSearchParams(window.location.search).get('workspace') === '1';

// Creamos un sub-componente para poder "sintonizar" el contexto
function MainApp() {
  const { user } = useAuth();
  const searchParams = new URLSearchParams(window.location.search);
  if (isSurveyRoute) return <React.Suspense fallback={<div className="min-h-screen bg-[#0a0a0a] text-white p-12">Abriendo VISTA…</div>}><SurveyPage previewMode={import.meta.env.DEV && searchParams.get('survey-preview') === '1'} /></React.Suspense>;
  if (isWorkspaceRoute) return user ? <WorkspaceView /> : <WorkspaceAuth />;
  if (searchParams.get('gimg-publications') === '1') return <React.Suspense fallback={<p>Cargando publicaciones…</p>}><WorkspacePublications /></React.Suspense>;
  const publicStudio = searchParams.get('studio');
  if (publicStudio) return user ? <React.Suspense fallback={<div className="p-12">Abriendo estudio…</div>}><StudioProfile slug={publicStudio}/></React.Suspense> : <VISTAAuth onLogin={() => {}}/>;
  const publicHandle = searchParams.get('profile');
  const publicEditorial = searchParams.get('editorial');
  const workspacePreview = import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('workspace-preview') === '1';
  const networkPreview = import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('network-preview') === '1';
  const authPreview = import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('auth-preview') === '1';

  if (authPreview) return <VISTAAuth onLogin={() => {}} />;
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
  React.useEffect(() => {
    if (!isWorkspaceRoute) return;
    document.title = 'Workspace · GIMG';
    const icon = document.createElement('link');
    icon.rel = 'icon';
    icon.type = 'image/png';
    icon.href = '/gba/workspace/workspace-icon.png';
    document.head.append(icon);
    return () => icon.remove();
  }, []);
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('workspace-update-preview')) return <React.Suspense fallback={<p>Cargando prueba local…</p>}><UpdatePreview /></React.Suspense>;
  return (
    <RadioProvider>
      {/* AuthProvider envuelve todo el edificio */}
      <AuthProvider productName={isWorkspaceRoute ? 'Workspace' : 'VISTA'}>
        <MainApp />
        {!isSurveyRoute && !isWorkspaceRoute && <GlobalRadioPlayer />}
      </AuthProvider>
    </RadioProvider>
  );
}

export default App;
