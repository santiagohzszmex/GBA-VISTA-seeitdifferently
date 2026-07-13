import React from 'react';
import { Bell, CheckCheck, Newspaper } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';

export default function Notificaciones({ onNavigateNews }) {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();

  return (
    <div className="min-h-screen bg-[#fbfbfd] px-6 md:px-12 py-16 md:py-24 text-[#1d1d1f]">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-end justify-between gap-6 border-b border-[#d2d2d7]/60 pb-8 mb-8">
          <div><p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#0066FF] mb-3">GBA ID</p><h1 className="font-serif italic text-4xl md:text-6xl tracking-tight">Notificaciones.</h1><p className="text-[#86868b] mt-3">{unreadCount} pendientes</p></div>
          {unreadCount > 0 && <button type="button" onClick={markAllAsRead} className="px-4 py-3 border border-[#d2d2d7] bg-white rounded-xl text-xs font-bold flex items-center gap-2"><CheckCheck size={16}/>Marcar leídas</button>}
        </header>

        {loading ? <p className="py-16 text-center text-[#86868b]">Cargando avisos...</p> : notifications.length > 0 ? (
          <div className="divide-y divide-[#d2d2d7]/60 border-y border-[#d2d2d7]/60">
            {notifications.map(notification => (
              <button
                key={notification.id}
                type="button"
                onClick={() => { markAsRead(notification.id); if (notification.contenido_id) onNavigateNews?.({ id: notification.contenido_id }); }}
                className={`w-full text-left py-5 px-3 flex gap-4 transition-colors hover:bg-white ${notification.leida ? 'opacity-60' : ''}`}
              >
                <span className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${notification.leida ? 'bg-[#f5f5f7] text-[#86868b]' : 'bg-blue-50 text-[#0066FF]'}`}><Newspaper size={18}/></span>
                <span className="min-w-0 flex-1"><span className="font-bold block">{notification.titulo}</span><span className="text-sm text-[#86868b] block mt-1">{notification.mensaje}</span><span className="text-[10px] text-[#86868b] uppercase tracking-widest font-bold block mt-2">{new Date(notification.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</span></span>
                {!notification.leida && <span className="w-2.5 h-2.5 rounded-full bg-[#0066FF] mt-2 flex-shrink-0"/>}
              </button>
            ))}
          </div>
        ) : <div className="py-24 text-center border border-dashed border-[#d2d2d7] rounded-2xl"><Bell size={38} className="mx-auto text-[#d2d2d7] mb-4"/><p className="font-serif italic text-2xl">Todo está al día.</p><p className="text-sm text-[#86868b] mt-2">Aquí aparecerán publicaciones y avisos de las editoriales que sigues.</p></div>}
      </div>
    </div>
  );
}
