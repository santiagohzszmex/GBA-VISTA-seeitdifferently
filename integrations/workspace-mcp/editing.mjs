import { document, backup } from './documents.mjs';

export async function readDocument(rpc, { project_id, document_id, document_type }) {
  const context = await rpc('context', { project_id });
  let source, task;
  if (document_type === 'reference') source = context.references?.references?.find(row => row.id === document_id);
  else if (document_type === 'support') source = context.support?.documents?.find(row => row.id === document_id);
  else if (document_type === 'draft') {
    task = context.tasks?.find(row => row.id === document_id);
    if (task) source = await rpc('draft.get', { deliverable_id: task.id });
  } else throw Error('Tipo de documento inválido.');
  if (!source) throw Error('Documento fuera de tu acceso o sin borrador guardado. Consulta el contexto y usa su identificador exacto.');
  return { actor_id: context.actor_id, source, task, view: {
    project_id, document_id, document_type, title: source.title || task?.title,
    revision: source.revision, base_version: source.base_version,
    can_edit: document_type === 'draft' ? ['pending', 'assigned', 'in_progress', 'changes_requested'].includes(task.state) : source.can_edit === true,
    content_document: source.content_document, content_markdown: source.content_markdown,
    palette: source.palette, credits: source.credits, originals: source.originals,
  } };
}

function replaceText(content, replacements) {
  const next = structuredClone(content);
  for (const { find, replace, expected_count = 1 } of replacements) {
    if (!find) throw Error('El texto que buscas no puede estar vacío.');
    let count = 0;
    function visit(node) {
      if (node.type === 'text') { const pieces = node.text.split(find); count += pieces.length - 1; node.text = pieces.join(replace); }
      if (node.content) { node.content.forEach(visit); node.content = node.content.filter(child => child.type !== 'text' || child.text); }
    }
    visit(next);
    if (count !== expected_count) throw Error(`El fragmento aparece ${count} veces; esperabas ${expected_count}. Consulta el documento y prepara de nuevo los cambios. Si el texto atraviesa formatos, usa content_document.`);
  }
  return next;
}

export async function prepareDocumentEdit(rpc, { project_id, document_id, document_type, expected_revision, patch }) {
  const { actor_id, source, task, view } = await readDocument(rpc, { project_id, document_id, document_type });
  if (!view.can_edit) throw Error('Tu GBA ID puede consultar este documento, pero no editarlo.');
  if (source.revision !== expected_revision) throw Error('El documento cambió. Consulta su revisión actual antes de preparar la edición.');
  if (!Object.keys(patch).length) throw Error('Indica al menos un cambio.');
  if (document_type === 'draft' && ('title' in patch || 'palette' in patch)) throw Error('El borrador permite editar contenido y créditos; el título de la asignación se modifica desde Asignaciones.');
  if (document_type === 'reference' && 'credits' in patch) throw Error('Los créditos de las referencias se indican en el texto o en sus imágenes.');
  const modes = ['content_document', 'markdown', 'replacements'].filter(key => key in patch);
  if (modes.length > 1) throw Error('Usa una sola forma de cambiar el contenido: documento estructurado, Markdown o sustituciones.');
  let content = source.content_document || document(source.content_markdown || '', true);
  if ('content_document' in patch) content = structuredClone(patch.content_document);
  else if ('markdown' in patch) content = document(patch.markdown, true);
  else if ('replacements' in patch) content = replaceText(content, patch.replacements);
  if (content?.type !== 'doc' || !Array.isArray(content.content)) throw Error('Usa un documento estructurado válido del editor.');
  content = { ...content, attrs: { ...content.attrs, schemaVersion: 2 } };
  if (Buffer.byteLength(JSON.stringify(content)) > 1000000) throw Error('El documento supera el límite del editor.');
  const data = { content_document: content, content_markdown: backup(content), editor_version: 2 };
  let method, args;
  if (document_type === 'draft') {
    Object.assign(data, { credits: patch.credits ?? source.credits ?? '', asset_url: source.asset_url ?? '' });
    method = 'draft.save'; args = { deliverable_id: task.id, revision: expected_revision, base_version: source.base_version, data };
  } else {
    Object.assign(data, { id: source.id, title: patch.title ?? source.title, area_id: source.area_id, palette: patch.palette ?? source.palette ?? [] });
    if (document_type === 'reference') {
      data.kind = source.kind; method = 'reference.save';
    } else {
      Object.assign(data, { document_kind: source.document_kind, credits: patch.credits ?? source.credits ?? '' }); method = 'support.save';
    }
    args = { project_id, revision: expected_revision, data };
  }
  return { actor_id, method, args, preview: { ...view, title: data.title || view.title, content_document: content, content_markdown: data.content_markdown, palette: data.palette ?? view.palette, credits: data.credits ?? view.credits, changed_fields: Object.keys(patch) } };
}
