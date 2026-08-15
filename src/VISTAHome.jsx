import React, { lazy, Suspense, useState } from 'react';
import { useAuth } from './context/AuthContext';
import Sidebar from './Sidebar';

// Importación del ecosistema modular desde la carpeta views
import HomeView from './views/Home';
import OriginalsView from './views/Originals';
import NoticiasView from './views/news/Noticias';
import PerfilEditorialView from './views/news/PerfilEditorial'; // <-- Nueva vista importada
import BuscarView from './views/Buscar';
import BibliotecaView from './views/Biblioteca';
import PublicarView from './views/Publicar';
import MothershipView from './views/Mothership';
import WorkspaceView from './views/Workspace';
import NotificacionesView from './views/Notificaciones';
import PerfilUsuarioView from './views/PerfilUsuario';
import NetworkView from './views/NetworkPreview';
import WelcomeOverlay from './components/onboarding/WelcomeOverlay';
import SiteFooter from './components/common/SiteFooter';

const KeynotesView = lazy(() => import('./views/Keynotes'));

const replaceVistaLocation = (parameter = null, value = null) => {
  const url = new URL(window.location.href);
  url.search = '';
  if (parameter && value) url.searchParams.set(parameter, value);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
};

// Importación de los componentes de interacción global
import VideoPlayer from './components/player/VideoPlayer'; // <-- Importado
import ContentDetailModal from './components/modals/ContentDetailModal'; // <-- Importado

export default function VISTAHome() {
  const { user, isDueño } = useAuth();
  const sharedEditionId = new URLSearchParams(window.location.search).get('edition');
  const sharedCampaignId = new URLSearchParams(window.location.search).get('campaign');
  const sharedKeynoteSlug = new URLSearchParams(window.location.search).get('keynote');
  const sharedUpdateId = new URLSearchParams(window.location.search).get('update');
  const sharedNetwork = new URLSearchParams(window.location.search).get('network') === '1';
  const studioPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).get('studio-preview') === '1';
  const [activeTab, setActiveTab] = useState(sharedEditionId ? 'news' : sharedKeynoteSlug ? 'keynotes' : sharedNetwork ? 'network' : studioPreview ? 'publicar' : 'home');

  // Estados locales para el control de overlays e interacciones globales
  const [playingVideo, setPlayingVideo] = useState(null);
  const [selectedMovieInfo, setSelectedMovieInfo] = useState(null);
  const [selloSeleccionado, setSelloSeleccionado] = useState(''); // Estado para enrutar el Perfil Editorial
  const [focusedNewsId, setFocusedNewsId] = useState(sharedEditionId || null);
  const [focusedKeynoteSlug, setFocusedKeynoteSlug] = useState(sharedKeynoteSlug || null);
  const [showWelcome, setShowWelcome] = useState(() => window.localStorage.getItem('vista_show_welcome') === '1');
  const [studioInitialSection, setStudioInitialSection] = useState('publish');
  const showsSiteFooter = !['mothership', 'workspace', 'publicar', 'settings', 'notifications'].includes(activeTab);

  // Manejadores de acciones que serán inyectados a las vistas hijas
  const handlePlayVideo = (youtubeId) => {
    if (youtubeId) setPlayingVideo(youtubeId);
  };

  const handleSelectMovieInfo = (movie) => {
    if (movie) setSelectedMovieInfo(movie);
  };

  const handleNavigateNews = (item = null) => {
    const editionId = item?.id || null;
    setFocusedNewsId(editionId);
    setFocusedKeynoteSlug(null);
    replaceVistaLocation(editionId ? 'edition' : null, editionId);
    setActiveTab('news');
  };

  const handleNavigateKeynotes = (keynote = null) => {
    const keynoteSlug = keynote?.slug || null;
    setFocusedKeynoteSlug(keynoteSlug);
    setFocusedNewsId(null);
    replaceVistaLocation(keynoteSlug ? 'keynote' : null, keynoteSlug);
    setActiveTab('keynotes');
  };

  const handleKeynoteSelection = slug => {
    setFocusedKeynoteSlug(slug || null);
    replaceVistaLocation(slug ? 'keynote' : null, slug);
  };

  const handleOpenNetworkStudio = () => {
    setStudioInitialSection('network');
    replaceVistaLocation();
    setActiveTab('publicar');
  };

  const handleOpenEditorial = editorialKey => {
    if (!editorialKey) return;
    setSelloSeleccionado(editorialKey);
    replaceVistaLocation();
    setActiveTab('perfil_editorial');
  };

  const handleSidebarNavigation = tab => {
    if (tab === 'publicar') setStudioInitialSection('publish');
    setFocusedNewsId(null);
    setFocusedKeynoteSlug(null);
    replaceVistaLocation();
    setActiveTab(tab);
  };

  // El cerebro del tráfico: decide qué archivo montar según el Sidebar u acciones del usuario
  const renderView = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeView 
            onSelectMovie={handleSelectMovieInfo} 
            onPlay={handlePlayVideo} 
            onNavigateNews={handleNavigateNews}
            onNavigateKeynotes={handleNavigateKeynotes}
            initialCampaignId={sharedCampaignId}
            initialUpdateId={sharedUpdateId}
          />
        );
      case 'originals':
        return (
          <OriginalsView 
            onSelectMovie={handleSelectMovieInfo} 
            onPlay={handlePlayVideo} 
          />
        );
      case 'news':
        return (
          <NoticiasView 
            onSelectMovie={handleSelectMovieInfo} 
            setActiveTab={handleSidebarNavigation}
            setSelloSeleccionado={setSelloSeleccionado}
            focusedNewsId={focusedNewsId}
          />
        );
      case 'network':
        return <NetworkView onOpenStudio={handleOpenNetworkStudio} onOpenEditorial={handleOpenEditorial} />;
      case 'perfil_editorial': // <-- Nueva ruta interna para la prensa indexada
        return (
          <PerfilEditorialView 
            selloNombre={selloSeleccionado}
            setActiveTab={handleSidebarNavigation}
            onSelectMovie={handleSelectMovieInfo}
          />
        );
      case 'search':
        return (
          <BuscarView 
            onSelectMovie={handleSelectMovieInfo} 
            onPlay={handlePlayVideo} 
          />
        );
      case 'library':
        return (
          <BibliotecaView 
            onSelectMovie={handleSelectMovieInfo} 
            onPlay={handlePlayVideo} 
          />
        );
      case 'notifications':
        return <NotificacionesView onNavigateNews={handleNavigateNews} />;
      case 'keynotes':
        return <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-[#86868b]">Abriendo Keynote...</div>}><KeynotesView initialSlug={focusedKeynoteSlug} onSelectionChange={handleKeynoteSelection} onBackHome={() => handleSidebarNavigation('home')} /></Suspense>;
      case 'profile':
        return <PerfilUsuarioView setActiveTab={handleSidebarNavigation} />;
      case 'estadisticas': 
        return <PerfilUsuarioView setActiveTab={handleSidebarNavigation} initialSection="analytics" />;
      case 'publicar':
      case 'settings':
        return <PublicarView initialSection={studioInitialSection} />;
      case 'mothership':
        return isDueño ? (
          <MothershipView />
        ) : (
          <HomeView 
            onSelectMovie={handleSelectMovieInfo} 
            onPlay={handlePlayVideo} 
            onNavigateNews={handleNavigateNews}
            onNavigateKeynotes={handleNavigateKeynotes}
            initialCampaignId={sharedCampaignId}
            initialUpdateId={sharedUpdateId}
          />
        );
      case 'workspace':
        return <WorkspaceView />;
      default:
        return (
          <HomeView 
            onSelectMovie={handleSelectMovieInfo} 
            onPlay={handlePlayVideo} 
            onNavigateNews={handleNavigateNews}
            onNavigateKeynotes={handleNavigateKeynotes}
            initialCampaignId={sharedCampaignId}
            initialUpdateId={sharedUpdateId}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] font-sans selection:bg-[#1d1d1f] selection:text-white flex">
      
      {/* BARRA DE NAVEGACIÓN LATERAL */}
      <Sidebar activeTab={activeTab} setActiveTab={handleSidebarNavigation} user={user} />

      {/* ESCENARIO DE RENDERIZADO DINÁMICO */}
      <main className="flex-1 md:ml-24 pb-24 md:pb-0 overflow-x-hidden animate-in fade-in duration-500">
        {renderView()}
        {showsSiteFooter && <SiteFooter />}
      </main>

      {/* =================================================== */}
      {/* 🛠️ CAPAS SUPERPUESTAS GLOBALES (MODALES)              */}
      {/* =================================================== */}
      
      {/* 1. REPRODUCTOR DE VIDEO (PANTALLA COMPLETA) */}
      {playingVideo && (
        <VideoPlayer 
          youtubeId={playingVideo} 
          onClose={() => setPlayingVideo(null)} 
        />
      )}

      {/* 2. CENTRO DE INFORMACIÓN, DETALLES Y REPARTO */}
      {selectedMovieInfo && (
        <ContentDetailModal 
          movie={selectedMovieInfo} 
          onClose={() => setSelectedMovieInfo(null)}
          onPlay={(id) => {
            setPlayingVideo(id); // Dispara la reproducción cinematográfica
            setSelectedMovieInfo(null); // Limpia el foco del modal cerrándolo limpiamente
          }} 
        />
      )}

      {showWelcome && (
        <WelcomeOverlay
          onClose={() => setShowWelcome(false)}
          setActiveTab={handleSidebarNavigation}
          onSelectContent={handleSelectMovieInfo}
        />
      )}

    </div>
  );
}
