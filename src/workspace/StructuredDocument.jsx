import React from 'react';
import { FONTS, FONT_SIZES } from './documentModel';
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
      if (mark.type === 'code') text = <code key={id}>{text}</code>;
      if (mark.type === 'textStyle') { const attrs = mark.attrs || {}; text = <span key={id} style={{ color: /^#[\da-f]{3,6}$/i.test(attrs.color || '') ? attrs.color : undefined, fontFamily: FONTS[attrs.fontFamily] ? attrs.fontFamily : undefined, fontSize: FONT_SIZES.includes(attrs.fontSize) ? attrs.fontSize : undefined }}>{text}</span>; }
      if (mark.type === 'link' && /^https?:\/\//i.test(mark.attrs?.href || '')) text = <a key={id} href={mark.attrs.href} target="_blank" rel="noopener noreferrer">{text}</a>;
    }
    return <React.Fragment key={key}>{text}</React.Fragment>;
  }
  if (node.type === 'heading') { const Tag = `h${Math.min(6, Math.max(1, Number(node.attrs?.level) || 2))}`; return <Tag key={key}>{children}</Tag>; }
  const tags = { paragraph: 'p', bulletList: 'ul', orderedList: 'ol', listItem: 'li', blockquote: 'blockquote', codeBlock: 'pre' };
  if (tags[node.type]) { const Tag = tags[node.type]; return <Tag key={key}>{children}</Tag>; }
  if (node.type === 'hardBreak') return <br key={key} />;
  if (node.type === 'horizontalRule') return <hr key={key} />;
  return <React.Fragment key={key}>{children}</React.Fragment>;
}
export default function StructuredDocument({ document }) { return <div className="gw-document-content">{nodeContent(document, 'root')}</div>; }
