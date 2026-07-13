import React, { useEffect } from 'react';
import { useNews } from '../../hooks/useNews';
import { useEditorialFollow } from '../../hooks/useEditorialFollow';
import NewsCard from '../../components/news/NewsCard';
import { ShieldCheck, Eye, Heart, ArrowLeft, Newspaper, Activity, Bell, BellOff, Check, UserPlus } from 'lucide-react';

export default function PerfilEditorial({ selloNombre, setActiveTab, onSelectMovie }) {
  const { loading, editorialContent, editorialStats, fetchEditorialProfile, registrarVisita } = useNews();
  const {
    isFollowing,
    notificationsEnabled,
    followersCount,
    loading: followLoading,
    toggleFollow,
    toggleNotifications
  } = useEditorialFollow(selloNombre);

  // Cargar los datos del perfil del sello al montar la vista
  useEffect(() => {
    if (selloNombre) {
      fetchEditorialProfile(selloNombre);
    }
  }, [selloNombre, fetchEditorialProfile]);

  const handleReadNews = async (item) => {
    await registrarVisita(item.id);
    if (onSelectMovie) {
      onSelectMovie(item);
    }
  };

  if (loading && editorialContent.length === 0) {
    return (
      <div className="w-full min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-[#86868b]">
          <Activity className="animate-spin" size={28} />
          <p className="text-[10px] font-bold uppercase tracking-widest">Cargando perfil editorial...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#fbfbfd] pb-32 font-sans selection:bg-[#1d1d1f] selection:text-white">
      
      {/* BOTÓN DE RETORNO */}
      <div className="pt-8 px-6 md:px-12 max-w-[1800px] mx-auto">
        <button 
          onClick={() => setActiveTab && setActiveTab('news')}
          className="flex items-center gap-2 text-xs font-bold text-[#86868b] hover:text-[#1d1d1f] transition-colors uppercase tracking-wider"
        >
          <ArrowLeft size={16} /> Volver a Prensa
        </button>
      </div>

      {/* CABECERA DEL SELLO EDITORIAL */}
      <header className="pt-12 pb-16 px-6 md:px-12 max-w-[1800px] mx-auto border-b border-[#d2d2d7]/50 mb-16">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          
          <div className="space-y-4 min-w-0">
            <div className="flex items-center gap-2.5 text-[#0066FF]">
              <ShieldCheck size={22} />
              <span className="text-xs font-bold tracking-widest uppercase">Sello Verificado</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-serif italic tracking-tighter text-[#1d1d1f] leading-none">
              {selloNombre || 'Sello Independiente'}
            </h1>
            <p className="text-sm text-[#86868b] font-medium max-w-xl leading-relaxed">
              Catálogo oficial de publicaciones y documentos de prensa distribuidos dentro del ecosistema VISTA.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                onClick={toggleFollow}
                disabled={followLoading}
                className={`h-11 px-5 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-50 ${
                  isFollowing
                    ? 'bg-[#1d1d1f] text-white'
                    : 'bg-[#0066FF] hover:bg-[#0052cc] text-white'
                }`}
              >
                {isFollowing ? <Check size={17}/> : <UserPlus size={17}/>}
                {isFollowing ? 'Siguiendo' : 'Seguir editorial'}
              </button>
              {isFollowing && (
                <button
                  type="button"
                  onClick={toggleNotifications}
                  disabled={followLoading}
                  className="w-11 h-11 rounded-xl border border-[#d2d2d7] bg-white hover:bg-[#f5f5f7] flex items-center justify-center text-[#1d1d1f] disabled:opacity-50"
                  title={notificationsEnabled ? 'Desactivar avisos' : 'Activar avisos'}
                >
                  {notificationsEnabled ? <Bell size={17}/> : <BellOff size={17}/>}
                </button>
              )}
              <span className="text-xs font-bold text-[#86868b] px-2">
                {followersCount} {followersCount === 1 ? 'seguidor' : 'seguidores'}
              </span>
            </div>
          </div>

          {/* MÉTRICAS ACUMULADAS PÚBLICAS */}
          <div className="flex gap-4 flex-wrap">
            <div className="bg-white border border-[#d2d2d7] rounded-2xl px-6 py-4 shadow-[0_4px_12px_rgba(0,0,0,0.01)] min-w-[140px]">
              <div className="flex items-center gap-2 text-[#86868b] mb-1">
                <Eye size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Alcance</span>
              </div>
              <p className="text-2xl font-bold text-[#1d1d1f] tracking-tight">{editorialStats.totalVistas}</p>
              <p className="text-[10px] text-[#86868b] font-medium">Lecturas totales</p>
            </div>

            <div className="bg-white border border-[#d2d2d7] rounded-2xl px-6 py-4 shadow-[0_4px_12px_rgba(0,0,0,0.01)] min-w-[140px]">
              <div className="flex items-center gap-2 text-[#86868b] mb-1">
                <Heart size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Reacciones</span>
              </div>
              <p className="text-2xl font-bold text-[#1d1d1f] tracking-tight">{editorialStats.totalLikes}</p>
              <p className="text-[10px] text-[#86868b] font-medium">Aceptación global</p>
            </div>
          </div>

        </div>
      </header>

      {/* CUADRÍCULA DE PUBLICACIONES PROPIAS */}
      <div className="px-6 md:px-12 max-w-[1800px] mx-auto">
        <div className="flex items-center gap-3 mb-8 pb-4">
          <Newspaper size={20} className="text-[#1d1d1f]" />
          <h3 className="text-xl font-bold text-[#1d1d1f]">Archivo de Ediciones</h3>
          <span className="text-xs text-[#86868b] font-mono ml-auto">
            {editorialContent.length} documentos indexados
          </span>
        </div>

        {editorialContent.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {editorialContent.map((item) => (
              <NewsCard 
                key={item.id} 
                item={item} 
                onRead={handleReadNews}
                onNavigateProfile={null} // Desactivamos para evitar bucles dentro de su propio perfil
              />
            ))}
          </div>
        ) : (
          <div className="py-24 text-center border border-dashed border-[#d2d2d7] rounded-[2rem] bg-[#f5f5f7]">
            <p className="text-[#86868b] font-medium">Este sello editorial aún no cuenta con publicaciones aprobadas.</p>
          </div>
        )}
      </div>

    </div>
  );
}
