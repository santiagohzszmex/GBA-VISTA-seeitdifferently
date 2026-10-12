import React from 'react';
import { FONTS, FONT_SIZES } from './documentModel';
import { paragraphStyle } from './editorModel';
import { DocumentImage } from './DocumentContext';
function nodeContent(node, key) {
  if (!node || typeof node !== 'object') return null;
  const children = (node.content || []).map((child, index) => nodeContent(child, index));
  if (node.type === 'text') {
    let text = node.text || '';
    for (const [index, mark] of (node.marks || []).entries()) {
      const id = `${key}-${index}`;
      if (mark.type === 'bold') text = <strong key={id}>{text}</strong>;
      if (mark.type === 'italic') text = <em key={id}>{text}</em>;
      if (mark.type === 'underline') text = <u key={id}>{text}</u>;
      if (mark.type === 'strike') text = <s key={id}>{text}</s>;
      if (mark.type === 'highlight') text = <mark key={id} style={{backgroundColor: /^#[\da-f]{6}$/i.test(mark.attrs?.color || '') ? mark.attrs.color : '#FFF0A8'}}>{text}</mark>;
      if (mark.type === 'code') text = <code key={id}>{text}</code>;
      if (mark.type === 'textStyle') { const attrs = mark.attrs || {}; text = <span key={id} style={{ color: /^#[\da-f]{3,6}$/i.test(attrs.color || '') ? attrs.color : undefined, fontFamily: FONTS[attrs.fontFamily] ? attrs.fontFamily : undefined, fontSize: FONT_SIZES.includes(attrs.fontSize) ? attrs.fontSize : undefined }}>{text}</span>; }
      if (mark.type === 'link' && /^https?:\/\//i.test(mark.attrs?.href || '')) text = <a key={id} href={mark.attrs.href} target="_blank" rel="noopener noreferrer">{text}</a>;
    }
    return <React.Fragment key={key}>{text}</React.Fragment>;
  }
  if (node.type === 'mention') return <span key={key} className="gw-opal-mention" data-mention-id={node.attrs?.anchorId}>@{node.attrs?.label || 'Integrante'}</span>;
  if (node.type === 'originalImage') return <DocumentImage key={key} assetId={node.attrs?.assetId} caption={node.attrs?.caption} credits={node.attrs?.credits} />;
  if (node.type === 'heading') { const Tag = `h${Math.min(6, Math.max(1, Number(node.attrs?.level) || 2))}`; return <Tag key={key} style={paragraphStyle(node.attrs)}>{children}</Tag>; }
  const tags = { paragraph: 'p', bulletList: 'ul', orderedList: 'ol', listItem: 'li', blockquote: 'blockquote', codeBlock: 'pre', table:'table', tableRow:'tr', tableCell:'td', tableHeader:'th' };
  if (tags[node.type]) { const Tag = tags[node.type]; return <Tag key={key} style={paragraphStyle(node.attrs)}>{node.type === 'table' ? <tbody>{children}</tbody> : children}</Tag>; }
  if (node.type === 'hardBreak') return <br key={key} />;
  if (node.type === 'horizontalRule') return <hr key={key} />;
  return <React.Fragment key={key}>{children}</React.Fragment>;
}
export default function StructuredDocument({ document }) { return <div className="gw-document-content">{nodeContent(document, 'root')}</div>; }
