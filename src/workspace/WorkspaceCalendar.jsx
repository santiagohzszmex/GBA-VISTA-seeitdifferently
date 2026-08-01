import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Pencil,
  Plus,
  Save,
  X
} from 'lucide-react';
import { EVENT_STATUS, EVENT_TYPES } from './workspaceData';

const EVENT_COLORS = {
  keynote: '#2563eb',
  public_event: '#0891b2',
  internal: '#6b7280',
  deadline: '#dc2626',
  review: '#7c3aed'
};

const emptyEvent = {
  title: '',
  description: '',
  event_type: 'keynote',
  status: 'planned',
  visibility: 'workspace',
  starts_at: '',
  ends_at: '',
  linked_document_id: ''
};

const toLocalInput = date => {
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const sameDay = (left, right) => left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate();

function monthDays(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayIndex = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayIndex);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export default function WorkspaceCalendar({ access, events, documents, onSaveEvent }) {
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyEvent);
  const [saving, setSaving] = useState(false);
  const days = useMemo(() => monthDays(month), [month]);
  const selectedEvents = events
    .filter(event => sameDay(new Date(event.starts_at), selectedDate))
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const upcoming = events
    .filter(event => new Date(event.starts_at) >= new Date(month.getFullYear(), month.getMonth(), 1))
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
    .slice(0, 6);

  const openNew = date => {
    const start = new Date(date || selectedDate);
    start.setHours(18, 0, 0, 0);
    const end = new Date(start);
    end.setHours(19, 0, 0, 0);
    setForm({ ...emptyEvent, starts_at: toLocalInput(start), ends_at: toLocalInput(end) });
    setFormOpen(true);
  };

  const openEdit = event => {
    setForm({
      ...event,
      starts_at: toLocalInput(new Date(event.starts_at)),
      ends_at: event.ends_at ? toLocalInput(new Date(event.ends_at)) : '',
      linked_document_id: event.linked_document_id || ''
    });
    setFormOpen(true);
  };

  const submit = async event => {
    event.preventDefault();
    setSaving(true);
    const saved = await onSaveEvent({
      ...form,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      linked_document_id: form.linked_document_id || null
    });
    setSaving(false);
    if (saved) {
      setFormOpen(false);
      setSelectedDate(new Date(saved.starts_at));
    }
  };

  return (
    <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] border border-[#d9dce3] bg-white rounded-md overflow-hidden min-h-[calc(100vh-156px)]">
      <section className="min-w-0 border-b xl:border-b-0 xl:border-r border-[#e2e4e9]">
        <header className="min-h-16 px-4 md:px-6 border-b border-[#e2e4e9] flex flex-wrap items-center gap-3">
          <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8b9099]">Calendario compartido</p><h2 className="text-lg font-bold capitalize">{month.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</h2></div>
          <div className="flex items-center gap-1 ml-auto"><button type="button" className="ws-icon" title="Mes anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={16}/></button><button type="button" className="ws-secondary" onClick={() => { const today = new Date(); setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(today); }}>Hoy</button><button type="button" className="ws-icon" title="Mes siguiente" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={16}/></button></div>
          {access.can_edit && <button type="button" className="ws-primary" onClick={() => openNew()}><Plus size={14}/>Nuevo evento</button>}
        </header>

        <div className="grid grid-cols-7 border-b border-[#e2e4e9] bg-[#f7f8fa]">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => <div key={day} className="h-9 flex items-center justify-center text-[9px] font-black uppercase tracking-wider text-[#8b9099]">{day}</div>)}
        </div>
        <div className="grid grid-cols-7 auto-rows-[92px] md:auto-rows-[112px]">
          {days.map(day => {
            const dayEvents = events.filter(event => sameDay(new Date(event.starts_at), day)).slice(0, 3);
            const inMonth = day.getMonth() === month.getMonth();
            const selected = sameDay(day, selectedDate);
            return (
              <button key={day.toISOString()} type="button" onClick={() => setSelectedDate(day)} onDoubleClick={() => access.can_edit && openNew(day)} className={`min-w-0 border-r border-b border-[#eceef2] p-2 text-left align-top hover:bg-[#f8f9fb] ${!inMonth ? 'bg-[#fafafa] text-[#b6bac1]' : ''} ${selected ? 'ring-2 ring-inset ring-[#2563eb]' : ''}`}>
                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold ${sameDay(day, new Date()) ? 'bg-[#17191d] text-white' : ''}`}>{day.getDate()}</span>
                <span className="block space-y-1 mt-1">
                  {dayEvents.map(event => <span key={event.id} className="block truncate text-[8px] md:text-[9px] font-bold pl-1.5 border-l-2 text-[#4d525a]" style={{ borderColor: EVENT_COLORS[event.event_type] }}>{event.title}</span>)}
                  {events.filter(event => sameDay(new Date(event.starts_at), day)).length > 3 && <span className="block text-[8px] text-[#8b9099]">Más eventos</span>}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="bg-[#fafbfc]">
        <div className="p-5 border-b border-[#e2e4e9]"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8b9099]">{selectedDate.toLocaleDateString('es-MX', { weekday: 'long' })}</p><h3 className="text-lg font-bold mt-1 capitalize">{selectedDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}</h3></div>
        <div className="divide-y divide-[#e2e4e9]">
          {selectedEvents.map(event => {
            const linked = documents.find(document => document.id === event.linked_document_id);
            return <article key={event.id} className="p-5"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: EVENT_COLORS[event.event_type] }}/><span className="text-[9px] uppercase font-black tracking-wider text-[#8b9099]">{EVENT_TYPES[event.event_type]}</span>{access.can_edit && <button type="button" className="ws-icon ml-auto" onClick={() => openEdit(event)} title="Editar evento"><Pencil size={13}/></button>}</div><h4 className="font-bold text-sm mt-3">{event.title}</h4><p className="text-[10px] text-[#6f747d] leading-4 mt-2">{event.description || 'Sin descripción'}</p><div className="flex items-center gap-2 mt-3 text-[10px] text-[#8b9099]"><Clock3 size={12}/>{new Date(event.starts_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}{event.ends_at && ` – ${new Date(event.ends_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`}</div>{linked && <div className="flex items-center gap-2 mt-3 text-[10px] font-bold text-[#2563eb]"><FileText size={12}/>{linked.title}</div>}</article>;
          })}
          {!selectedEvents.length && <div className="p-8 text-center"><CalendarDays size={22} className="mx-auto text-[#c3c7ce]"/><p className="text-xs font-bold text-[#6f747d] mt-3">Día disponible</p><p className="text-[10px] text-[#9a9ea6] mt-1">No hay actividades programadas.</p></div>}
        </div>
        <div className="p-5 border-t border-[#e2e4e9]"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8b9099] mb-3">Próximamente</p>{upcoming.map(event => <div key={event.id} className="flex gap-3 py-2"><span className="text-lg font-bold tabular-nums text-[#2e3136] w-7">{new Date(event.starts_at).getDate()}</span><span className="min-w-0"><span className="block text-[10px] font-bold truncate">{event.title}</span><span className="block text-[9px] text-[#9a9ea6] mt-0.5">{new Date(event.starts_at).toLocaleDateString('es-MX', { month: 'short' })} · {EVENT_STATUS[event.status]}</span></span></div>)}</div>
      </aside>

      {formOpen && (
        <div className="fixed inset-0 z-[1400] bg-black/20 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={submit} className="w-full max-w-xl bg-white border border-[#d9dce3] shadow-2xl rounded-md overflow-hidden">
            <header className="h-16 px-5 border-b border-[#e2e4e9] flex items-center justify-between"><div><p className="text-[9px] uppercase tracking-widest font-black text-[#8b9099]">{form.id ? 'Registro existente' : 'Nuevo registro'}</p><h3 className="font-bold mt-0.5">{form.id ? 'Editar evento' : 'Programar evento'}</h3></div><button type="button" className="ws-icon" onClick={() => setFormOpen(false)} title="Cerrar"><X size={16}/></button></header>
            <div className="p-5 space-y-4">
              <label><span className="ws-label">Título</span><input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} className="ws-input" placeholder="Nombre del evento"/></label>
              <div className="grid md:grid-cols-3 gap-3"><label><span className="ws-label">Tipo</span><select value={form.event_type} onChange={event => setForm({ ...form, event_type: event.target.value })} className="ws-input">{Object.entries(EVENT_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="ws-label">Estado</span><select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })} className="ws-input">{Object.entries(EVENT_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="ws-label">Visibilidad</span><select value={form.visibility} onChange={event => setForm({ ...form, visibility: event.target.value })} className="ws-input"><option value="workspace">Todo Workspace</option><option value="restricted">Aprobadores</option></select></label></div>
              <div className="grid md:grid-cols-2 gap-3"><label><span className="ws-label">Inicio</span><input required type="datetime-local" value={form.starts_at} onChange={event => setForm({ ...form, starts_at: event.target.value })} className="ws-input"/></label><label><span className="ws-label">Fin</span><input type="datetime-local" min={form.starts_at} value={form.ends_at} onChange={event => setForm({ ...form, ends_at: event.target.value })} className="ws-input"/></label></div>
              <label><span className="ws-label">Documento relacionado</span><select value={form.linked_document_id} onChange={event => setForm({ ...form, linked_document_id: event.target.value })} className="ws-input"><option value="">Ninguno</option>{documents.map(document => <option key={document.id} value={document.id}>{document.title}</option>)}</select></label>
              <label><span className="ws-label">Descripción</span><textarea rows="4" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className="ws-input resize-none" placeholder="Propósito, participantes o preparación necesaria"/></label>
            </div>
            <footer className="px-5 py-4 border-t border-[#e2e4e9] bg-[#fafbfc] flex justify-end gap-2"><button type="button" className="ws-secondary" onClick={() => setFormOpen(false)}>Cancelar</button><button type="submit" className="ws-primary" disabled={saving}><Save size={14}/>{saving ? 'Guardando' : form.id ? 'Guardar cambios' : 'Programar'}</button></footer>
          </form>
        </div>
      )}
    </div>
  );
}
