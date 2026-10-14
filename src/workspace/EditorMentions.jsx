import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { ReactRenderer } from '@tiptap/react';
import { exitSuggestion } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import Mention from '@tiptap/extension-mention';
import { editorVisibleBounds, placeEditorMenu } from './editorPlacement';

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
        let component, latest, observer, frame;
        const position = () => {
          if (!component || !latest || latest.editor.isDestroyed) return;
          const element = component.element;
          let anchor;
          try { anchor=latest.editor.view.coordsAtPos(latest.range.to); } catch { element.style.visibility='hidden'; return; }
          const bounds=editorVisibleBounds(latest.editor.view.dom);
          const placement=placeEditorMenu(anchor,{width:290,height:Math.min(300,element.scrollHeight || 300)},bounds);
          if (!placement) { element.style.visibility='hidden'; exitSuggestion(latest.editor.view,pluginKey); return; }
          Object.assign(element.style,{position:'fixed',zIndex:'120',visibility:'visible',
            left:`${placement.left}px`,top:`${placement.top}px`,maxHeight:`${placement.maxHeight}px`,maxWidth:`${placement.maxWidth}px`,overflowY:'auto'});
        };
        const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(position);};
        const cleanup=()=>{
          cancelAnimationFrame(frame);observer?.disconnect();
          window.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule);
          window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule);
          component?.element.remove();component?.destroy();component=null;latest=null;
        };
        return {
          onStart: props => {
            latest=props;component=new ReactRenderer(MentionList,{props,editor:props.editor});
            Object.assign(component.element.style,{position:'fixed',visibility:'hidden'});document.body.appendChild(component.element);
            window.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);
            window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
            observer=new ResizeObserver(schedule);observer.observe(component.element);schedule();
          },
          onUpdate: props => { latest=props;component?.updateProps(props);schedule(); },
          onKeyDown: props => { if (props.event.key === 'Escape') { exitSuggestion(latest.editor.view,pluginKey); return true; } return component?.ref?.onKeyDown(props.event) || false; },
          onExit: cleanup
        };
      }
    }
  });
}
