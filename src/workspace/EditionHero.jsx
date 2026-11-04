import React from 'react';
import { BookMarked, CalendarClock } from 'lucide-react';
import { deliverySummary, deadlineDate } from './deadlines.mjs';
import { hueOf } from './workView';

const PROJECT_STATUS = { planned: 'En preparación', active: 'En curso', closed: 'Cerrada', archived: 'Archivada' };

/* Encabezado de la edición (1.7.2). Sólo resume las entregas que la persona ya puede ver. */
export default function EditionHero({ project, tasks }) {
  if (!project) return null;
  const summary = deliverySummary(tasks);
  const percent = summary.total ? Math.round(summary.delivered / summary.total * 100) : 0;
  return <div className="gw-edition-hero" data-hue={hueOf(project.id)}>
    <div className="gw-edition-hero-main">
      <span className="gw-edition-hero-icon" aria-hidden="true"><BookMarked size={20} /></span>
      <div>
        <p className="gw-edition-hero-eyebrow">Edición{PROJECT_STATUS[project.status] ? ` · ${PROJECT_STATUS[project.status]}` : ''}</p>
        <p className="gw-edition-hero-title">{project.title}</p>
      </div>
    </div>
    <dl className="gw-edition-hero-stats" aria-label="Avance de las entregas en tu alcance">
      <div><dt>Entregadas</dt><dd>{summary.delivered}<small>/{summary.total}</small></dd></div>
      <div data-tone={summary.late ? 'late' : undefined}><dt>Vencidas</dt><dd>{summary.late}</dd></div>
      <div data-tone={summary.soon ? 'soon' : undefined}><dt>Vencen pronto</dt><dd>{summary.soon}</dd></div>
      {project.ends_at && <div><dt><CalendarClock size={13} aria-hidden="true" />Cierre</dt><dd className="gw-edition-hero-date">{deadlineDate(project.ends_at)}</dd></div>}
    </dl>
    <div className="gw-edition-hero-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={`${percent}% de las entregas en tu alcance`}><span style={{ width: `${percent}%` }} /></div>
  </div>;
}
