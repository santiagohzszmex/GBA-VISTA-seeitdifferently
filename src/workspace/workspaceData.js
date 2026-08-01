export const ROLE_LABELS = {
  owner: 'Propietario',
  admin: 'Administrador',
  approver: 'Aprobador',
  editor: 'Editor',
  commenter: 'Comentarista',
  reader: 'Lector'
};

export const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

export const ROLE_RANK = {
  owner: 60,
  admin: 50,
  approver: 40,
  editor: 30,
  commenter: 20,
  reader: 10
};

export const DOCUMENT_STATUS = {
  draft: 'Borrador',
  review: 'En revisión',
  approved: 'Aprobado',
  superseded: 'Sustituido',
  archived: 'Archivado'
};

export const EVENT_TYPES = {
  keynote: 'Keynote',
  public_event: 'Evento público',
  internal: 'Interno',
  deadline: 'Entrega',
  review: 'Revisión'
};

export const EVENT_STATUS = {
  planned: 'Planeado',
  confirmed: 'Confirmado',
  completed: 'Completado',
  cancelled: 'Cancelado'
};

export const DEMO_ACCESS = {
  role: 'owner',
  can_access: true,
  can_edit: true,
  can_approve: true,
  can_manage: true
};

export const DEMO_COLLECTIONS = [
  { id: 'direction', slug: 'direction', name: 'Dirección', description: 'Identidad, principios y decisiones fundacionales.', color: '#111111', position: 10, minimum_role: 'approver' },
  { id: 'keynotes', slug: 'keynotes', name: 'Keynotes', description: 'Borradores, guiones y presentaciones.', color: '#2563eb', position: 20, minimum_role: 'reader' },
  { id: 'products', slug: 'products', name: 'Productos', description: 'Definiciones de VISTA, ANIMA y Forge.', color: '#0891b2', position: 30, minimum_role: 'reader' },
  { id: 'architectures', slug: 'architectures', name: 'Arquitecturas', description: 'Especificaciones antes de programar.', color: '#7c3aed', position: 40, minimum_role: 'reader' },
  { id: 'business', slug: 'business', name: 'Negocio', description: 'Contexto económico e hipótesis comerciales.', color: '#15803d', position: 50, minimum_role: 'approver' }
];

export const DEMO_DOCUMENTS = [
  {
    id: 'doc-keynote',
    collection_id: 'keynotes',
    title: 'GBA Keynote 001',
    content_markdown: '## Idea central\n\nEscribe aquí el mensaje que debe recordar la audiencia.\n\n## Actualizaciones terminadas\n\n- Actualización 1\n- Actualización 2\n- Actualización 3\n\n## Estadísticas\n\nTodas las cifras deben incluir fuente y periodo.\n\n## Cierre\n\nPróxima Keynote: lunes 10 de agosto.',
    status: 'draft',
    version: 3,
    updated_at: '2026-08-01T17:35:00.000Z',
    updated_by: 'demo-owner'
  },
  {
    id: 'doc-workspace',
    collection_id: 'architectures',
    title: 'GBA Workspace · Fase 1',
    content_markdown: '## Objetivo\n\nCrear una memoria compartida para GBA con acceso mediante GBA ID.\n\n## Incluido\n\n- Colecciones y permisos\n- Documentos y revisiones\n- Calendario compartido\n- Exportación Markdown\n\n## Fuera de alcance\n\nLa edición simultánea pertenece a la Fase 2.',
    status: 'review',
    version: 2,
    updated_at: '2026-08-01T17:10:00.000Z',
    updated_by: 'demo-owner'
  },
  {
    id: 'doc-anima',
    collection_id: 'products',
    title: 'Carta fundacional de ANIMA',
    content_markdown: '## Propósito\n\nInvestigar métodos para entrenar y adaptar modelos bajo restricciones reales de RAM, CPU, energía y presupuesto.\n\n## Capas\n\n1. ANIMA Research\n2. ANIMA Runtime\n3. ANIMA Services',
    status: 'approved',
    version: 4,
    updated_at: '2026-07-31T22:00:00.000Z',
    updated_by: 'demo-owner'
  }
];

export const DEMO_EVENTS = [
  {
    id: 'event-keynote',
    title: 'GBA Keynote 001',
    description: 'Actualizaciones de VISTA y próximos pasos.',
    event_type: 'keynote',
    status: 'confirmed',
    visibility: 'workspace',
    starts_at: '2026-08-03T18:00:00-06:00',
    ends_at: '2026-08-03T19:00:00-06:00',
    linked_document_id: 'doc-keynote'
  },
  {
    id: 'event-review',
    title: 'Revisión de GBA Workspace',
    description: 'Aprobación de la arquitectura de Fase 1.',
    event_type: 'review',
    status: 'planned',
    visibility: 'workspace',
    starts_at: '2026-08-05T17:30:00-06:00',
    ends_at: '2026-08-05T18:00:00-06:00',
    linked_document_id: 'doc-workspace'
  },
  {
    id: 'event-deadline',
    title: 'Cierre de estadísticas semanales',
    description: 'Verificar fuentes y periodo antes de la siguiente Keynote.',
    event_type: 'deadline',
    status: 'planned',
    visibility: 'workspace',
    starts_at: '2026-08-09T20:00:00-06:00',
    ends_at: null,
    linked_document_id: null
  }
];

export const DEMO_MEMBERS = [
  { id: 'demo-owner', user_id: 'demo-owner', workspace_role: 'owner', status: 'active', handle: 'Santiago', display_name: 'Santiago Hernandez', platform_role: 'Dueño', created_at: '2026-08-01T16:00:00.000Z' },
  { id: 'demo-editor', user_id: 'demo-editor', workspace_role: 'editor', status: 'active', handle: 'ForgeTeam', display_name: 'GBA Forge', platform_role: 'Forge Engineer', created_at: '2026-08-01T16:15:00.000Z' },
  { id: 'demo-reader', user_id: 'demo-reader', workspace_role: 'reader', status: 'active', handle: 'EditorInvitado', display_name: 'Editor invitado', platform_role: 'Editor', created_at: '2026-08-01T16:30:00.000Z' }
];

export const DEMO_REVISIONS = {
  'doc-keynote': [
    { id: 'rev-k3', document_id: 'doc-keynote', revision_number: 3, title: 'GBA Keynote 001', status: 'draft', content_markdown: DEMO_DOCUMENTS[0].content_markdown, created_at: '2026-08-01T17:35:00.000Z' },
    { id: 'rev-k2', document_id: 'doc-keynote', revision_number: 2, title: 'GBA Keynote 001', status: 'draft', content_markdown: '## Idea central\n\nPendiente.\n\n## Actualizaciones\n\n- VISTA', created_at: '2026-08-01T16:40:00.000Z' },
    { id: 'rev-k1', document_id: 'doc-keynote', revision_number: 1, title: 'GBA Keynote 001', status: 'draft', content_markdown: '', created_at: '2026-08-01T16:05:00.000Z' }
  ]
};
