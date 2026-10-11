import React from 'react';
import { UserRound } from 'lucide-react';
import { STATES } from './gimgModel';

/* Piezas visuales compartidas por Mi trabajo y Asignaciones.
   Sólo presentación: no leen permisos ni modifican datos. */

export const CLOSED_STATES = ['area_approved', 'in_qa', 'qa_approved', 'published', 'archived'];
const FINISHED_STATES = ['published', 'archived'];
const TONES = { pending: 'idle', assigned: 'info', in_progress: 'info', review: 'wait', changes_requested: 'warn', area_approved: 'ok', in_qa: 'wait', qa_approved: 'ok', published: 'ok', archived: 'idle', blocked: 'danger' };
const TZ = 'America/Mexico_City';
const dayFormat = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayKey = date => {
  const parts = Object.fromEntries(dayFormat.formatToParts(date).map(part => [part.type, part.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
};
const dayDiff = (a, b) => Math.round((dayKey(a) - dayKey(b)) / 86400000);

export function dateShort(value) {
  return value ? new Date(value).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: TZ }).replace('.', '') : 'Sin fecha';
}

/** Fecha corta con una nota relativa ("vence en 3 días") y un tono para resaltar lo urgente. */
export function dueInfo(value, state, now = new Date()) {
  const label = dateShort(value);
  if (!value) return { label, note: '', tone: '' };
  if (CLOSED_STATES.includes(state)) return { label, note: '', tone: '' };
  const diff = dayDiff(new Date(value), now);
  if (diff < 0) return { label, note: diff === -1 ? 'venció ayer' : `venció hace ${-diff} días`, tone: 'late' };
  if (diff === 0) return { label, note: 'vence hoy', tone: 'soon' };
  if (diff === 1) return { label, note: 'vence mañana', tone: 'soon' };
  if (diff <= 3) return { label, note: `vence en ${diff} días`, tone: 'soon' };
  return { label, note: `en ${diff} días`, tone: '' };
}

/** "hoy, 12:00 p. m." o "18 oct, 12:00 p. m." para el recibo de guardado. */
export function savedLabel(value, now = new Date()) {
  if (!value) return '';
  const date = new Date(value);
  const time = date.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
  return `${dayDiff(date, now) === 0 ? 'hoy' : dateShort(value)}, ${time}`;
}

export const isFinished = state => FINISHED_STATES.includes(state);

export function Status({ state }) {
  return <span className="gw-wk-status" data-tone={TONES[state] || 'idle'}><i aria-hidden="true" />{STATES[state] || state}</span>;
}

export const initials = name => (name || '').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();

export function Avatar({ name }) {
  return name
    ? <span className="gw-wk-avatar" aria-hidden="true">{initials(name)}</span>
    : <span className="gw-wk-avatar gw-wk-avatar-empty" aria-hidden="true"><UserRound size={14} /></span>;
}

export function DueLabel({ task }) {
  const due = dueInfo(task.due_at, task.state);
  return <span className="gw-wk-due" data-tone={due.tone || undefined}>{due.label}{due.note && <small>{due.note}</small>}</span>;
}
