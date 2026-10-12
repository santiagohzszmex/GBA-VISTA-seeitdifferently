import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { ReactRenderer } from '@tiptap/react';
import { exitSuggestion } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import Mention from '@tiptap/extension-mention';

const MentionList = forwardRef(function MentionList({ items, command }, ref) {
  const [selected, setSelected] = useState(0);
  useEffect(() => setSelected(0), [items]);
  const pick = index => { const person = items[index]; if (person?.user_id) command({ id: person.user_id, label: person.display_name, anchorId: crypto.randomUUID() }); };
  useImperativeHandle(ref, () => ({ onKeyDown: event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { setSelected(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length)); return true; }
    if (event.key === 'Enter' && items[selected]?.user_id) { pick(selected); return true; }
    return false;
  } }));
  return <div className="gw-opal-mentions" role="listbox" aria-label="Mencionar a un integrante">
    <small>Personas con acceso</small>
    {items.length ? items.map((person, index) => person.error ? <p key="error" role="alert">{person.error}</p> : <button type="button" key={person.user_id} role="option" aria-selected={index === selected} onMouseDown={event => event.preventDefault()} onClick={() => pick(index)}><span>{person.display_name}</span>{person.handle && <small>@{person.handle}</small>}</button>) : <p>No hay integrantes disponibles para esta mención.</p>}
  </div>;
});

export function mentionExtension(contextRef) {
  const pluginKey = new PluginKey('workspace-mentions');
  return Mention.extend({
    addAttributes() { return { ...this.parent?.(), anchorId: { default: null, parseHTML: element => element.getAttribute('data-mention-id'), renderHTML: attrs => ({ 'data-mention-id': attrs.anchorId }) } }; }
  }).configure({
    HTMLAttributes: { class: 'gw-opal-mention' },
    renderText: ({ node }) => `@${node.attrs.label || 'Integrante'}`,
    suggestion: {
      pluginKey,
      items: async ({ query }) => {
        try { return (await contextRef.current.candidates(contextRef.current.scope)).filter(person => `${person.display_name} ${person.handle || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0, 8); }
        catch { return [{ error: 'No pudimos consultar los integrantes. Vuelve a intentarlo.' }]; }
      },
      render: () => {
        let component, latest;
        const position = props => {
          const rect = props.clientRect?.(); if (!rect || !component) return;
          const element = component.element;
          element.style.position = 'fixed'; element.style.zIndex = '120';
          element.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - 310))}px`;
          element.style.top = `${Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - element.offsetHeight - 12))}px`;
        };
        return {
          onStart: props => { latest = props; component = new ReactRenderer(MentionList, { props, editor: props.editor }); document.body.appendChild(component.element); position(props); },
          onUpdate: props => { latest = props; component?.updateProps(props); position(props); },
          onKeyDown: props => { if (props.event.key === 'Escape') { exitSuggestion(latest.editor,pluginKey); return true; } return component?.ref?.onKeyDown(props.event) || false; },
          onExit: () => { component?.element.remove(); component?.destroy(); component = null; latest = null; }
        };
      }
    }
  });
}
