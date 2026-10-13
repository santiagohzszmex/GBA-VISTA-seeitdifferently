import React from 'react';
import { BookOpen, FileText, Users } from 'lucide-react';
import { REFERENCE_KINDS } from './referenceModel';
import './supportDocuments.css';

const SUPPORT_KIND = { interview:'Entrevista', notes:'Notas', source:'Fuente', transcript:'Transcripción', working:'Documento de trabajo' };
const ASSIGNMENT_ROLE = { contributor:'Colaborador',direction:'Dirección', coordination:'Coordinación', production:'Producción', qa:'Calidad', research:'Investigación', writing:'Redacción', illustration:'Ilustración', design:'Diseño', photography:'Fotografía', layout:'Diseño editorial' };
export default function TeamWorkspace({ project, data, actorId, selectedSupportId, onOpenDocument, onOpenTask }) {
  const areas = data.team?.areas || data.areas.filter(area => area.project_id === project.id);
  const areaName = id => areas.find(area => area.id === id)?.name || 'Área';
  const members = data.team?.members || [];
  const sharedSupport = (data.support?.documents || []).filter(row => row.project_id === project.id && row.share_scope !== 'private');
  const references = (data.references || []).filter(row => row.project_id === project.id);
  const tasks = (data.tasks || []).filter(row => row.project_id === project.id);
  const memberName = id => members.find(member => member.user_id === id)?.display_name || (id === actorId ? 'Tú' : 'Integrante');
  return <section className="gw-team-space" aria-label={`Equipo de ${project.title}`}>
    <header><div><span className="gw-wk-eyebrow">{project.title}</span><h1>Equipo</h1><p>Integrantes y materiales compartidos que puedes consultar según tu acceso.</p></div></header>
    <section className="gw-team-members"><h2><Users size={18}/>Integrantes del equipo</h2>{members.length ? <ul>{members.map(member => <li key={member.user_id}><strong>{member.display_name || member.handle || 'Integrante'}</strong>{member.handle && <span>@{member.handle.replace(/^@/,'')}</span>}<small>{(member.area_ids || []).map(areaName).join(' · ') || 'Equipo de edición'}{member.assignment_roles?.length ? ` · ${member.assignment_roles.map(role=>ASSIGNMENT_ROLE[role] || role).join(', ')}` : ''}</small></li>)}</ul> : <p>Los integrantes disponibles aparecerán aquí.</p>}</section>
    <div className="gw-team-materials">
      <section><h2><FileText size={18}/>Documentos de apoyo compartidos</h2>{sharedSupport.length ? <ul>{sharedSupport.map(row => <li key={row.id}><button type="button" aria-current={row.id === selectedSupportId || undefined} onClick={() => onOpenDocument?.(row)}><strong>{row.title}</strong><small>{SUPPORT_KIND[row.document_kind] || row.document_kind} · {areaName(row.area_id)} · {memberName(row.author_id)}</small></button></li>)}</ul> : <p>Cuando alguien comparta un documento de apoyo con el área, aparecerá aquí.</p>}</section>
      <section><h2><BookOpen size={18}/>Referencias de la edición</h2>{references.length ? <ul>{references.map(row => <li key={row.id}><button type="button" onClick={() => onOpenDocument?.(row)}><strong>{row.title}</strong><small>{row.area_id ? row.area_name || areaName(row.area_id) : 'Toda la edición'}{row.kind ? ` · ${REFERENCE_KINDS[row.kind] || row.kind}` : ''}</small></button></li>)}</ul> : <p>No hay referencias disponibles para esta edición.</p>}</section>
      <section><h2><FileText size={18}/>Asignaciones accesibles</h2>{tasks.length ? <ul>{tasks.map(row => <li key={row.id}><button type="button" onClick={() => onOpenTask?.(row)}><strong>{row.title}</strong><small>{areaName(row.area_id)} · {memberName(row.responsible_id)}</small></button></li>)}</ul> : <p>No hay asignaciones accesibles en esta edición.</p>}</section>
    </div>
  </section>;
}
