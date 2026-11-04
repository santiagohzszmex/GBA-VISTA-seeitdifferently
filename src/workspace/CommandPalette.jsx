import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Layers, Archive, Settings, CornerDownLeft, BookMarked } from 'lucide-react';
import { EDITION_SECTIONS, SECTION_ICONS, SHORTCUT_KEY } from './WorkspaceNavigation';
import { StateChip, AreaTag } from './workView';
import { taskIsMine } from './documentModel';
import { deadlineStatus, deliveryGroup } from './deadlines.mjs';
import { isClosedEdition } from './editionState.mjs';

/* Buscador rápido ⌘K (1.7.2). Sólo navega: muestra secciones, entregas y ediciones
   que ya están cargadas con los permisos de la persona; no ejecuta acciones. */
const normalize = text => String(text || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es-MX');

export default function CommandPalette({ onClose, sections, counts, editions, currentEditionId, tasks, data, actorId, onSection, onEdition, onTask, onScreen }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef(null), list = useRef(null), previousFocus = useRef(typeof document !== 'undefined' ? document.activeElement : null);

  useEffect(() => { input.current?.focus(); return () => previousFocus.current?.focus?.(); }, []);

  const items = useMemo(() => {
    const q = normalize(query.trim());
    const match = (...texts) => !q || normalize(texts.join(' ')).includes(q);
    const areaName = task => data.areas?.find(area => area.id === task.area_id)?.name;
    const out = [];
    sections.forEach((id, index) => {
      if (!match(EDITION_SECTIONS[id], 'seccion')) return;
      const count = counts?.[id];
      out.push({ key: `section-${id}`, group: 'Secciones', label: EDITION_SECTIONS[id], Icon: SECTION_ICONS[id], meta: count?.value ? `${count.value} ${count.label}` : '', hint: `${SHORTCUT_KEY}${index + 1}`, run: () => onSection(id) });
    });
    const rank = task => (taskIsMine(task, actorId) && deliveryGroup(task) === 'pending' ? 0 : 2) + (deadlineStatus(task).key === 'late' ? 0 : 1);
    tasks.filter(task => match(task.title, areaName(task))).sort((a, b) => rank(a) - rank(b) || new Date(a.due_at || '9999') - new Date(b.due_at || '9999')).slice(0, q ? 25 : 8)
      .forEach(task => out.push({ key: `task-${task.id}`, group: q ? 'Entregas' : 'Entregas destacadas', label: task.title, task, area: areaName(task), mine: taskIsMine(task, actorId), run: () => onTask(task) }));
    editions.filter(edition => edition.id !== currentEditionId && match(edition.title, 'edicion')).forEach(edition => out.push({ key: `edition-${edition.id}`, group: 'Cambiar de edición', label: edition.title, Icon: BookMarked, meta: isClosedEdition(edition) ? 'Cerrada' : '', run: () => onEdition(edition) }));
    [['editions', 'Ediciones', Layers], ['closed', 'Ediciones cerradas', Archive], ['settings', 'Configuración', Settings]].forEach(([id, label, Icon]) => { if (match(label)) out.push({ key: `screen-${id}`, group: 'General', label, Icon, run: () => onScreen(id) }); });
    return out;
  }, [query, sections, counts, editions, currentEditionId, tasks, data, actorId, onSection, onEdition, onTask, onScreen]);

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => { list.current?.querySelector('[data-active=true]')?.scrollIntoView({ block: 'nearest' }); }, [active]);

  function run(item) { if (!item) return; onClose(); item.run(); }
  function onKeyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); setActive(index => Math.min(items.length - 1, index + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(0, index - 1)); }
    else if (event.key === 'Enter') { event.preventDefault(); run(items[active]); }
    else if (event.key === 'Tab') event.preventDefault();
  }

  let lastGroup = '';
  return <div className="gw-palette-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="gw-palette" role="dialog" aria-modal="true" aria-label="Buscar o ir a" onKeyDown={onKeyDown}>
      <div className="gw-palette-input"><Search size={18} aria-hidden="true" />
        <input ref={input} value={query} onChange={event => setQuery(event.target.value)} placeholder="Busca una entrega, sección o edición…" role="combobox" aria-expanded="true" aria-controls="gw-palette-list" aria-activedescendant={items[active] ? `gw-palette-${items[active].key}` : undefined} aria-autocomplete="list" />
        <kbd>Esc</kbd>
      </div>
      <ul id="gw-palette-list" ref={list} role="listbox" className="gw-palette-list">
        {items.map((item, index) => {
          const header = item.group !== lastGroup ? (lastGroup = item.group) : null;
          return <React.Fragment key={item.key}>
            {header && <li role="presentation" className="gw-palette-group">{header}</li>}
            <li id={`gw-palette-${item.key}`} role="option" aria-selected={index === active} data-active={index === active} onMouseMove={() => setActive(index)} onClick={() => run(item)}>
              {item.task ? <StateChip state={item.task.state} kind={item.task.kind} /> : item.Icon && <span className="gw-palette-icon"><item.Icon size={16} aria-hidden="true" /></span>}
              <span className="gw-palette-label">{item.label}{item.mine && <small>Tuya</small>}</span>
              {item.area && <AreaTag name={item.area} />}
              {item.meta && <span className="gw-palette-meta">{item.meta}</span>}
              {item.hint && <kbd>{item.hint}</kbd>}
            </li>
          </React.Fragment>;
        })}
        {!items.length && <li role="presentation" className="gw-palette-empty">Sin resultados para «{query}».</li>}
      </ul>
      <footer className="gw-palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> moverse</span><span><kbd><CornerDownLeft size={11} aria-hidden="true" /></kbd> abrir</span><span><kbd>{SHORTCUT_KEY}K</kbd> abrir o cerrar</span></footer>
    </div>
  </div>;
}
