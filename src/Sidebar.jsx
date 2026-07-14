import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { useNotifications } from './hooks/useNotifications';
import { 
  Home, 
  Tv, 
  Search, 
  Library, 
  ShieldAlert, 
  Radio,
  LogOut,
  PenTool,
  Moon,
  Bell,
  FileUp,
  User
} from 'lucide-react';

function AllianceLogo({ className = "hover:scale-105 transition-transform duration-300" }) {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="12" cy="12" r="10.5" className="fill-blue-600" />
      <path d="M 9 1.94 Q 11 13 22.45 13 L 9 13 Z" className="fill-emerald-500" />
      <line x1="9" y1="1.5" x2="9" y2="22.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="13" x2="22.5" y2="13" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 9 1.94 Q 11 13 22.45 13" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const Sidebar = ({ activeTab, setActiveTab }) => {
  const { user, isDueño, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const sidebarRef = useRef(null);

  // Verificación de Roles
  const isEditor = user?.rol === 'Editor' || isDueño;

  useEffect(() => {
    const handleClickOutside = (event) => {
      // Ignorar clics en botones de la barra móvil para que no se cierre instantáneamente
      if (event.target.closest('.mobile-nav-btn')) return;
      
      if (menuRef.current && !menuRef.current.contains(event.target) && sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    if (window.confirm("¿Estás seguro de que deseas cerrar sesión en el ecosistema VISTA?")) {
      await logout();
    }
  };

  const navItems = [
    { id: 'home', label: 'Inicio', icon: <Home size={22} strokeWidth={1.5} /> },
    { id: 'originals', label: 'Originals', icon: <Tv size={22} strokeWidth={1.5} /> }, 
    { id: 'news', label: 'Noticias', icon: <Radio size={22} strokeWidth={1.5} /> },
    { id: 'publicar', label: 'Studio', icon: <PenTool size={22} strokeWidth={1.5} /> },
    { id: 'search', label: 'Buscar', icon: <Search size={22} strokeWidth={1.5} /> },
    { id: 'library', label: 'Biblioteca', icon: <Library size={22} strokeWidth={1.5} /> },
    { id: 'notifications', label: 'Avisos', icon: <Bell size={22} strokeWidth={1.5} /> },
  ];

  return (
    <>
      {/* =========================================================
          🖥️ VISTA ESCRITORIO (SIDEBAR IZQUIERDO)
      ========================================================= */}
      <div 
        ref={sidebarRef}
        className="hidden md:flex fixed left-0 top-0 h-screen w-24 hover:w-64 flex-col bg-[#fbfbfd]/90 backdrop-blur-2xl border-r border-[#d2d2d7]/50 z-[900] transition-all duration-500 group overflow-visible shadow-[4px_0_24px_rgba(0,0,0,0.02)]"
      >
        <div className="p-8 mb-4 flex items-center gap-5">
          <div className="min-w-[34px] flex items-center justify-center">
            <AllianceLogo />
          </div>
          <span className="font-serif italic text-2xl tracking-tight opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[#1d1d1f]">
            VISTA
          </span>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setShowMenu(false);
              }}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 ${
                activeTab === item.id 
                ? 'bg-[#1d1d1f] text-white shadow-md' 
                : 'text-[#86868b] hover:bg-black/5 hover:text-[#1d1d1f]'
              }`}
            >
              <div className="min-w-[24px] flex justify-center relative">
                {item.icon}
                {item.id === 'notifications' && unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center">{Math.min(unreadCount, 9)}</span>}
              </div>
              <span className="font-medium text-sm tracking-wide opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {item.label}
              </span>
            </button>
          ))}

          {isDueño && (
            <div className="pt-8 mt-8 border-t border-[#d2d2d7]/50">
              <p className="px-4 mb-3 text-[9px] font-bold text-[#86868b] uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-opacity">
                Admin Systems
              </p>
              <button
                onClick={() => {setActiveTab('mothership'); setShowMenu(false)}}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 ${
                  activeTab === 'mothership' 
                  ? 'bg-red-600 text-white shadow-lg shadow-red-500/20' 
                  : 'text-red-500/70 hover:bg-red-50 hover:text-red-600'
                }`}
              >
                <div className="min-w-[24px] flex justify-center"><ShieldAlert size={22} strokeWidth={1.5} /></div>
                <span className="font-bold text-sm tracking-tight opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  MOTHERSHIP
                </span>
              </button>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-[#d2d2d7]/50 bg-white/50 mt-auto">
           {/* TRIGGER DEL MENÚ: El cuadro del usuario ahora es el botón principal */}
           <button 
            onClick={() => setShowMenu(!showMenu)}
            className={`w-full flex items-center gap-4 p-2 rounded-2xl transition-all duration-300 border ${showMenu ? 'bg-black/5 border-blue-500/20' : 'border-transparent hover:bg-black/5'}`}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-100 to-blue-50 border border-[#d2d2d7] flex items-center justify-center text-sm font-black text-blue-600 min-w-[40px] shadow-sm">
              {(user?.nombre_publico || user?.nombre)?.slice(0, 2).toUpperCase() || 'GB'}
            </div>
            <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity overflow-hidden whitespace-nowrap text-left">
              <span className="text-sm font-bold truncate text-[#1d1d1f] tracking-tight">{user?.nombre_publico || user?.nombre || 'GBA ID'}</span>
              <span className="text-[9px] text-[#86868b] uppercase font-bold tracking-[0.2em]">
                {user?.rol || 'Ciudadano'}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* =========================================================
          📱 VISTA MÓVIL (BOTTOM NAVIGATION BAR)
      ========================================================= */}
      <div className="md:hidden fixed bottom-0 left-0 w-full h-[84px] bg-[#fbfbfd]/90 backdrop-blur-2xl border-t border-[#d2d2d7]/50 z-[900] flex items-center justify-between px-4 pb-4 pt-2 shadow-[0_-4px_24px_rgba(0,0,0,0.04)]">
        {/* Mostramos los primeros 4 items principales para no saturar */}
        {navItems.slice(0, 4).map((item) => (
          <button
            key={item.id}
            onClick={() => { setActiveTab(item.id); setShowMenu(false); }}
            className={`flex flex-col items-center justify-center w-14 gap-1.5 transition-colors ${activeTab === item.id ? 'text-[#0066FF]' : 'text-[#86868b]'}`}
          >
            {/* Ajustamos tamaño para móvil */}
            {React.cloneElement(item.icon, { size: 24, className: activeTab === item.id ? 'fill-blue-50/50' : '' })}
            <span className="text-[9px] font-bold tracking-wide">{item.label}</span>
          </button>
        ))}
        
        {/* Botón de Perfil / Menú Móvil */}
        <button 
          onClick={() => setShowMenu(!showMenu)}
          className={`mobile-nav-btn flex flex-col items-center justify-center w-14 gap-1.5 transition-colors ${showMenu ? 'text-[#0066FF]' : 'text-[#86868b]'}`}
        >
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm transition-all ${showMenu ? 'bg-blue-600 text-white border-none' : 'bg-gradient-to-tr from-blue-100 to-blue-50 border border-[#d2d2d7] text-blue-600'}`}>
            {(user?.nombre_publico || user?.nombre)?.slice(0, 2).toUpperCase() || 'GB'}
          </div>
          <span className="text-[9px] font-bold tracking-wide">Perfil</span>
        </button>
      </div>

      {/* =========================================================
          ⚙️ POPOVER DE CUENTA INTELIGENTE (RESPONSIVO)
      ========================================================= */}
      {showMenu && (
        <div 
          ref={menuRef}
          className="fixed left-4 right-4 bottom-24 md:left-28 md:right-auto md:bottom-6 md:w-72 max-h-[calc(100vh-7rem)] md:max-h-[calc(100vh-3rem)] overflow-y-auto bg-white/95 backdrop-blur-3xl rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.12)] p-2 animate-in slide-in-from-bottom-4 duration-300 z-[1000] text-[#1d1d1f] border border-[#d2d2d7]/60"
        >
          {/* IDENTIDAD */}
          <div className="p-5 bg-gradient-to-b from-white to-[#f5f5f7]/50 rounded-[2rem] border border-[#d2d2d7]/30 shadow-sm mb-2">
            <p className="text-[9px] font-black text-[#86868b] uppercase tracking-widest mb-3 opacity-50">GBA ID</p>
            <div className="overflow-hidden">
                <p className="font-bold text-lg truncate tracking-tight text-[#1d1d1f]">{user?.nombre || 'GBA ID'}</p>
                <p className="text-[10px] font-bold text-[#0066FF] mt-0.5 tracking-wider uppercase">ID: {user?.id?.split('-')[0] || 'GUEST-ID'}</p>
            </div>
          </div>

          {/* OPCIONES COMUNES (CIUDADANO) */}
          <div className="px-2 py-1 space-y-1 mb-1">
            <button className="w-full flex items-center justify-between px-3 py-3 hover:bg-[#f5f5f7] rounded-2xl transition-colors text-sm font-medium text-[#1d1d1f]">
              <div className="flex items-center gap-3"><Moon size={16} className="text-[#86868b]"/> Apariencia</div>
              <span className="text-[10px] font-black text-[#86868b]">CLARO</span>
            </button>
            <button onClick={() => {setActiveTab('notifications'); setShowMenu(false)}} className="w-full flex items-center justify-between px-3 py-3 hover:bg-[#f5f5f7] rounded-2xl transition-colors text-sm font-medium text-[#1d1d1f]">
              <div className="flex items-center gap-3"><Bell size={16} className="text-[#86868b]"/> Notificaciones</div>
              {unreadCount > 0 && <span className="min-w-6 h-6 px-2 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">{unreadCount}</span>}
            </button>
            <button onClick={() => {setActiveTab('profile'); setShowMenu(false)}} className="w-full flex items-center gap-3 px-3 py-3 hover:bg-[#f5f5f7] rounded-2xl transition-colors text-sm font-medium text-[#1d1d1f]">
              <User size={16} className="text-[#86868b]"/> {isEditor ? 'Mi perfil y estadísticas' : 'Mi perfil'}
            </button>
            
            {/* Buscador / Biblioteca en Móvil (Ya que no cabían en la barra inferior) */}
            <div className="md:hidden pt-1 border-t border-[#d2d2d7]/40 mt-1">
              <button onClick={() => {setActiveTab('search'); setShowMenu(false)}} className="w-full flex items-center gap-3 px-3 py-3 hover:bg-[#f5f5f7] rounded-2xl transition-colors text-sm font-medium text-[#1d1d1f]">
                <Search size={16} className="text-[#86868b]"/> Explorar Bóveda
              </button>
              <button onClick={() => {setActiveTab('library'); setShowMenu(false)}} className="w-full flex items-center gap-3 px-3 py-3 hover:bg-[#f5f5f7] rounded-2xl transition-colors text-sm font-medium text-[#1d1d1f]">
                <Library size={16} className="text-[#86868b]"/> Mi Biblioteca
              </button>
            </div>
          </div>

          {/* OPCIONES DE EDITOR (SOLO PARA EDITORES/ADMINS) */}
          {isEditor && (
            <div className="px-2 py-2 border-t border-[#d2d2d7]/40 mt-1 space-y-1">
               <p className="px-3 py-2 text-[9px] font-black text-[#86868b] uppercase tracking-[0.2em] opacity-60">Funciones de Prensa</p>
               <button onClick={() => {setActiveTab('publicar'); setShowMenu(false)}} className="w-full flex items-center gap-3 px-3 py-3 hover:bg-blue-50 text-blue-600 rounded-2xl transition-colors text-sm font-bold">
                 <FileUp size={16}/> Cargar Edición
               </button>
            </div>
          )}

          {/* MOTHERSHIP EN MÓVIL PARA EL DUEÑO */}
          {isDueño && (
            <div className="md:hidden px-2 py-2 border-t border-[#d2d2d7]/40 mt-1 space-y-1">
               <p className="px-3 py-2 text-[9px] font-black text-red-500 uppercase tracking-[0.2em] opacity-80">Admin Systems</p>
               <button onClick={() => {setActiveTab('mothership'); setShowMenu(false)}} className="w-full flex items-center gap-3 px-3 py-3 hover:bg-red-50 text-red-600 rounded-2xl transition-colors text-sm font-bold">
                 <ShieldAlert size={16}/> Mothership Command
               </button>
            </div>
          )}

          {/* CERRAR SESIÓN */}
          <div className="p-2 border-t border-[#d2d2d7]/40 mt-1">
            <button 
              onClick={handleLogout} 
              className="w-full flex items-center gap-3 px-3 py-3 hover:bg-red-50 text-[#86868b] hover:text-red-500 rounded-2xl transition-colors text-sm font-bold"
            >
              <LogOut size={16} /> Cerrar Sesión
            </button>
          </div>
          
          {/* Flecha del globo de diálogo (Visible solo en desktop) */}
          <div className="hidden md:block absolute top-[85%] -left-2 w-4 h-4 bg-[#fbfbfd] rotate-45 border-b border-l border-[#d2d2d7]/60"></div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
