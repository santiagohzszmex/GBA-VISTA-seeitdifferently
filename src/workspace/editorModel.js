export const DOCUMENT_SCHEMA = 2;
export const ALIGNMENTS = ['left', 'center', 'right', 'justify'];
export const LINE_HEIGHTS = ['1.3', '1.6', '1.8', '2'];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function walkDocument(document, visit) {
  function walk(node, path = []) { if (!node) return; visit(node, path); (node.content || []).forEach((child, index) => walk(child, [...path, index])); }
  walk(document);
}
export function mentionsOf(document) {
  const mentions = [];
  walkDocument(document, node => { if (node.type === 'mention' && UUID.test(node.attrs?.id || '') && UUID.test(node.attrs?.anchorId || '')) mentions.push({ ...node.attrs }); });
  return mentions;
}
export function paragraphStyle(attrs = {}) {
  return { textAlign: ALIGNMENTS.includes(attrs.textAlign) ? attrs.textAlign : undefined, lineHeight: LINE_HEIGHTS.includes(String(attrs.lineHeight)) ? String(attrs.lineHeight) : undefined };
}
export function escapeMarkdown(value) { return String(value || '').replace(/[\\*_\[\]<>#`]/g, '\\$&'); }
