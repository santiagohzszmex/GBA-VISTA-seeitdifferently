export const FONTS = { 'Inter, system-ui, sans-serif': 'Inter', 'Georgia, serif': 'Georgia', 'Arial, sans-serif': 'Arial', 'Times New Roman, serif': 'Times New Roman' };
export const FONT_SIZES = ['12px', '14px', '16px', '18px', '24px', '32px'];
export const EMPTY_DOCUMENT = { type: 'doc', content: [{ type: 'paragraph' }] };
export function documentText(node) { return node?.type === 'text' ? node.text || '' : (node?.content || []).map(documentText).join(node?.type === 'doc' ? '\n' : ''); }
const codeFence = (text, minimum = 1) => '`'.repeat((text.match(/`+/g) || []).reduce((longest, run) => Math.max(longest, run.length), minimum - 1) + 1);
export function documentMarkdown(node) {
  const type = node?.type;
  let body = (node?.content || []).map(documentMarkdown).join('');
  if (type === 'text') {
    body = (node.text || '').replace(/[\\*_\[\]<>#`]/g, '\\$&');
    for (const mark of node.marks || []) {
      if (mark.type === 'bold') body = `**${body}**`;
      if (mark.type === 'italic') body = `*${body}*`;
      if (mark.type === 'strike') body = `~~${body}~~`;
      if (mark.type === 'code') { const fence = codeFence(node.text || ''); body = `${fence} ${node.text || ''} ${fence}`; }
      if (mark.type === 'link' && /^https?:\/\/[^\s<>]+$/.test(mark.attrs?.href || '')) body = `[${body}](${mark.attrs.href.replace(/\(/g, '%28').replace(/\)/g, '%29')})`;
    }
    return body;
  }
  if (type === 'paragraph') return `${body}\n\n`;
  if (type === 'heading') return `${'#'.repeat(Math.min(6, Math.max(1, node.attrs?.level || 2)))} ${body}\n\n`;
  if (type === 'hardBreak') return '\n';
  if (type === 'horizontalRule') return '\n---\n\n';
  if (type === 'bulletList' || type === 'orderedList') return (node.content || []).map((item, index) => `${type === 'bulletList' ? '-' : `${index + 1}.`} ${documentMarkdown(item).trimEnd().replace(/\n/g, '\n  ')}\n`).join('') + '\n';
  if (type === 'blockquote') return `> ${body.trimEnd().replace(/\n/g, '\n> ')}\n\n`;
  if (type === 'codeBlock') { body = documentText(node); const fence = codeFence(body, 3); return `${fence}\n${body}\n${fence}\n\n`; }
  return body;
}
export function taskIsMine(task, userId) { return task.responsible_id === userId || task.collaborator_ids?.includes(userId); }
export const EDITABLE_STATES = ['pending', 'assigned', 'in_progress', 'changes_requested'];
export function reviewAction(task, permissions, area) {
  if (task.state === 'review' && permissions[`review.approve_${area?.specialty}`]) return { action: 'task.transition', state: 'area_approved', label: 'Aceptar documento' };
  if (task.state === 'area_approved' && permissions['review.queue_qa']) return { action: 'task.transition', state: 'in_qa', label: 'Pasar a QA' };
  if (task.state === 'in_qa' && permissions['qa.approve'] && !task.qa_blocked) return { action: 'task.transition', state: 'qa_approved', label: 'Aprobar QA' };
  if (task.state === 'qa_approved' && !task.final_approved_by && permissions['publication.approve_final']) return { action: 'publication.approve', label: 'Aprobar publicación final' };
  if (task.state === 'qa_approved' && task.final_approved_by && permissions['publication.execute']) return { action: 'task.transition', state: 'published', label: 'Publicar en VISTA' };
  return null;
}

export function canReviewTask(task, permissions, area) { return Boolean(reviewAction(task, permissions, area) || (['review', 'in_qa'].includes(task.state) && permissions['review.request_changes'] && (task.state !== 'in_qa' || permissions['qa.approve']))); }
