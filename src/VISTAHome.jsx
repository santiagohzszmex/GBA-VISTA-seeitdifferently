import React, { lazy, Suspense, useState } from 'react';
import { supabase } from './supabaseClient';
import { isVideoContent } from './utils/contentTypes';
import { useAuth } from './context/AuthContext';
import Sidebar from './Sidebar';

// Importación del ecosistema modular desde la carpeta views
import HomeView from './views/Home';
import VideosView from './views/Videos';
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
import RadioLynexus from './views/RadioLynexus';

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
  const sharedContentId = new URLSearchParams(window.location.search).get('content');
  const [contentLinkError, setContentLinkError] = useState('');
  const sharedEditionId = new URLSearchParams(window.location.search).get('edition');
  const sharedCampaignId = new URLSearchParams(window.location.search).get('campaign');
  const sharedKeynoteSlug = new URLSearchParams(window.location.search).get('keynote');
  const sharedUpdateId = new URLSearchParams(window.location.search).get('update');
  const sharedNetwork = new URLSearchParams(window.location.search).get('network') === '1'
    || new URLSearchParams(window.location.search).has('server');
  const sharedRadioShortcode = new URLSearchParams(window.location.search).get('radio');
  const studioPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).get('studio-preview') === '1';
  const workspaceSection = new URLSearchParams(window.location.search).get('workspace');
  const [activeTab, setActiveTab] = useState(sharedEditionId ? 'news' : sharedKeynoteSlug ? 'keynotes' : sharedRadioShortcode ? 'radio' : sharedNetwork ? 'network' : ['studios','network'].includes(workspaceSection) ? 'publicar' : studioPreview ? 'publicar' : new URLSearchParams(window.location.search).get('videos') === '1' ? 'videos' : 'home');

  // Estados locales para el control de overlays e interacciones globales
  const [playingVideo, setPlayingVideo] = useState(null);
  const [selectedMovieInfo, setSelectedMovieInfo] = useState(null);
  const [selloSeleccionado, setSelloSeleccionado] = useState(''); // Estado para enrutar el Perfil Editorial
  const [focusedNewsId, setFocusedNewsId] = useState(sharedEditionId || null);
  const [focusedKeynoteSlug, setFocusedKeynoteSlug] = useState(sharedKeynoteSlug || null);
  const showWelcome = user?.onboarding_completado !== true;
  const [studioInitialSection, setStudioInitialSection] = useState(['studios','network'].includes(workspaceSection) ? workspaceSection : 'publish');
  const showsSiteFooter = !['mothership', 'workspace', 'publicar', 'settings', 'notifications', 'radio'].includes(activeTab);

  React.useEffect(() => {
    if (!sharedContentId || !user?.id) return;
    let active = true;
    setContentLinkError('');
    supabase.from('contenido').select('*').eq('id', sharedContentId).eq('estado_publicacion', 'aprobado').maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) { setContentLinkError('Esta publicación no está disponible.'); return; }
        if (isVideoContent(data)) setSelectedMovieInfo(data);
        else { setFocusedNewsId(data.id); setActiveTab('news'); }
      });
    return () => { active = false; };
  }, [sharedContentId, user?.id]);

  // Manejadores de acciones que serán inyectados a las vistas hijas
  const handlePlayVideo = (youtubeId, movie = null) => {
    if (youtubeId) {
      setPlayingVideo(youtubeId);
      if (movie?.id && isVideoContent(movie)) void supabase.rpc('vista_register_content_view', { p_content_id: movie.id });
    }
  };

  // Opening a video deliberately counts once per GBA ID; background autoplay does not.
  React.useEffect(() => {
    if (selectedMovieInfo?.id && isVideoContent(selectedMovieInfo)) {
      void supabase.rpc('vista_register_content_view', { p_content_id: selectedMovieInfo.id });
    }
  }, [selectedMovieInfo?.id]);

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

  const handleOpenRadio = station => {
    const shortcode = station?.station?.shortcode || station?.shortcode || sharedRadioShortcode || 'radio_lynexus';
    replaceVistaLocation('radio', shortcode);
    setActiveTab('radio');
  };

  React.useEffect(() => {
    const handleGlobalRadioNavigation = event => handleOpenRadio(event.detail);
    window.addEventListener('vista:navigate-radio', handleGlobalRadioNavigation);
    return () => window.removeEventListener('vista:navigate-radio', handleGlobalRadioNavigation);
  }, []);

  const handleSidebarNavigation = tab => {
    if (tab === 'publicar') setStudioInitialSection('publish');
    setFocusedNewsId(null);
    setFocusedKeynoteSlug(null);
    replaceVistaLocation();
    setActiveTab(tab);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
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
            onOpenRadio={handleOpenRadio}
            onOpenNetworkStudio={handleOpenNetworkStudio}
            initialCampaignId={sharedCampaignId}
            initialUpdateId={sharedUpdateId}
          />
        );
      case 'originals': // Compatibility for older internal navigation.
      case 'videos':
        return (
          <VideosView
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
      case 'radio':
        return <RadioLynexus />;
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
            onOpenRadio={handleOpenRadio}
            onOpenNetworkStudio={handleOpenNetworkStudio}
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
            onOpenRadio={handleOpenRadio}
            onOpenNetworkStudio={handleOpenNetworkStudio}
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
      
      {contentLinkError && <div role="alert" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9000] bg-white border border-[#d2d2d7] rounded-md shadow-lg p-4 text-sm text-[#1d1d1f]">{contentLinkError}<button className="ml-4 underline" onClick={() => { setContentLinkError(''); replaceVistaLocation(); }}>Cerrar</button></div>}
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
          onClose={() => { setSelectedMovieInfo(null); if (sharedContentId) replaceVistaLocation(); }}
          onPlay={(id) => {
            setPlayingVideo(id); // Dispara la reproducción cinematográfica
            setSelectedMovieInfo(null); // Limpia el foco del modal cerrándolo limpiamente
          }} 
        />
      )}

      {showWelcome && (
        <WelcomeOverlay
          setActiveTab={handleSidebarNavigation}
          onSelectContent={handleSelectMovieInfo}
        />
      )}

    </div>
  );
}
