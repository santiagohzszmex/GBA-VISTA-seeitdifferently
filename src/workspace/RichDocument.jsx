import './editorCompatibility';
import React from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { micromark } from 'micromark';
import { Bold, Italic, List, Undo2, Redo2 } from 'lucide-react';
import { documentMarkdown, EMPTY_DOCUMENT, FONTS, FONT_SIZES } from './documentModel';

const extensions = [StarterKit.configure({ link: { openOnClick: false } }), TextStyleKit];
export default function RichDocument({ initialDocument, initialMarkdown, onChange, disabled }) {
  const editor = useEditor({
    extensions, content: initialDocument || (initialMarkdown ? micromark(initialMarkdown) : EMPTY_DOCUMENT),
    shouldRerenderOnTransaction: false,
    editorProps: { attributes: { role: 'textbox', 'aria-label': 'Contenido del documento', 'aria-multiline': 'true', spellcheck: 'true' } },
    onCreate: ({ editor: instance }) => { const document = instance.getJSON(); onChange({ content_document: document, content_markdown: documentMarkdown(document) }, true); },
    onUpdate: ({ editor: instance }) => { const document = instance.getJSON(); onChange({ content_document: document, content_markdown: documentMarkdown(document) }); }
  });
  const state = useEditorState({ editor, selector: ({ editor: instance }) => instance ? { empty: instance.getText().trim() === '', bold: instance.isActive('bold'), italic: instance.isActive('italic'), list: instance.isActive('bulletList'), font: instance.getAttributes('textStyle').fontFamily || Object.keys(FONTS)[0], size: instance.getAttributes('textStyle').fontSize || '16px', color: instance.getAttributes('textStyle').color || '#303039', heading: instance.isActive('heading', { level: 2 }) ? 'heading' : 'paragraph', undo: instance.can().undo(), redo: instance.can().redo() } : null });
  React.useEffect(() => { editor?.setEditable(!disabled); }, [editor, disabled]);
  if (!editor || !state) return <p role="status">Abriendo documento…</p>;
  return <div className="gw-writing-editor">
    <div className="gw-format-toolbar" aria-label="Formato del documento">
      <label><span className="gw-sr-only">Estilo de párrafo</span><select value={state.heading} disabled={disabled} onChange={event => event.target.value === 'heading' ? editor.chain().focus().setHeading({ level: 2 }).run() : editor.chain().focus().setParagraph().run()}><option value="paragraph">Texto</option><option value="heading">Título</option></select></label>
      <label><span className="gw-sr-only">Tipografía</span><select value={state.font} disabled={disabled} onChange={event => editor.chain().focus().setFontFamily(event.target.value).run()}>{Object.entries(FONTS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label><span className="gw-sr-only">Tamaño del texto</span><select value={state.size} disabled={disabled} onChange={event => editor.chain().focus().setFontSize(event.target.value).run()}>{FONT_SIZES.map(size => <option value={size} key={size}>{size.replace('px', '')}</option>)}</select></label>
      <button type="button" aria-label="Negrita" aria-pressed={state.bold} disabled={disabled} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></button>
      <button type="button" aria-label="Cursiva" aria-pressed={state.italic} disabled={disabled} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></button>
      <button type="button" aria-label="Lista" aria-pressed={state.list} disabled={disabled} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={16} /></button>
      <label className="gw-text-color"><span className="gw-sr-only">Color del texto</span><input type="color" aria-label="Color del texto" value={/^#[\da-f]{6}$/i.test(state.color) ? state.color : '#303039'} disabled={disabled} onChange={event => editor.chain().focus().setColor(event.target.value).run()} /></label><label className="gw-color-code"><span className="gw-sr-only">Código de color del texto</span><input aria-label="Código de color del texto" defaultValue={state.color} key={state.color} pattern="#[a-fA-F0-9]{6}" placeholder="#303039" disabled={disabled} onBlur={event => { if (/^#[\da-f]{6}$/i.test(event.target.value)) editor.chain().focus().setColor(event.target.value).run(); }} /></label>
      <button type="button" aria-label="Deshacer" disabled={disabled || !state.undo} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={15} /></button><button type="button" aria-label="Rehacer" disabled={disabled || !state.redo} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={15} /></button>
    </div>
    <EditorContent editor={editor} className="gw-writing-paper" data-empty={state.empty || undefined} />
  </div>;
}
