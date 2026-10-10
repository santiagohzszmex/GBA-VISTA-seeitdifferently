export const WORKSPACE_DEMO = {
  projects: [
    { id: 'halloween-demo', unit_id: 'gimg-demo', title: 'Halloween', brief: '## Historias que se sienten cerca\n\nUna edición dedicada al miedo cotidiano y a las historias que sobreviven cuando se apaga la luz.\n\n### Dirección creativa\n\nEl equipo de arte trabajará con escenas íntimas, contrastes de luz y personajes que dejan espacio a la imaginación.\n\n### Investigación\n\nRegistrar el origen de cada historia y distinguir los testimonios de las interpretaciones del equipo.', status: 'active', revision: 1 },
    { id: 'muertos-demo', unit_id: 'gimg-demo', title: 'Día de Muertos', brief: '## Memoria y encuentro\n\nUna edición sobre las maneras en que recordamos.\n\n### Dirección creativa\n\nEl altar, los objetos y las historias familiares guían las referencias de esta edición.', status: 'planned', revision: 1 },
    { id: 'leyendas-demo', unit_id: 'gimg-demo', title: 'Leyendas', brief: '', status: 'planned', revision: 1 }
  ],
  areas: [
    { id: 'art-demo', project_id: 'halloween-demo', name: 'Ilustración', specialty: 'art' },
    { id: 'research-demo', project_id: 'halloween-demo', name: 'Investigación', specialty: 'research' },
    { id: 'muertos-art-demo', project_id: 'muertos-demo', name: 'Ilustración', specialty: 'art' }
  ],
  tasks: [
    { id: 'research-task-demo', project_id: 'halloween-demo', unit_id: 'gimg-demo', area_id: 'research-demo', title: 'El origen de las historias', description: 'Investigar las fuentes y sus distintas versiones.', responsible_id: 'demo-user', collaborator_ids: [], priority: 'normal', state: 'in_progress', due_at: '2026-10-25T18:00:00Z', current_version: 1, revision: 1, round: 0, extra_rounds: 0 },
    { id: 'cover-demo', project_id: 'halloween-demo', unit_id: 'gimg-demo', area_id: 'art-demo', title: 'Portada de Halloween', description: 'Preparar la portada y verificar créditos.', responsible_id: 'demo-user', collaborator_ids: [], priority: 'high', state: 'review', due_at: '2026-10-30T18:00:00Z', current_version: 1, revision: 1, round: 0, extra_rounds: 0 },
    { id: 'muertos-cover-demo', project_id: 'muertos-demo', unit_id: 'gimg-demo', area_id: 'muertos-art-demo', title: 'Portada de Día de Muertos', description: 'Preparar las primeras referencias visuales.', responsible_id: 'demo-user', collaborator_ids: [], priority: 'normal', state: 'assigned', due_at: '2026-11-01T18:00:00Z', current_version: 0, revision: 1, round: 0, extra_rounds: 0 }
  ],
  members: [{ user_id: 'demo-user', display_name: 'Integrante de demostración', handle: 'demo', membership_status: 'active' }],
  versions: [
    { id: 'research-version-demo', deliverable_id: 'research-task-demo', version_number: 1, content_markdown: '## Punto de partida\n\nLas historias de esta edición se investigan a partir de sus testimonios y de las versiones documentadas.\n\n### Preguntas de investigación\n\n- ¿Dónde aparece por primera vez la historia?\n- ¿Qué cambia entre las versiones?\n- ¿Qué fuentes podemos citar?\n\n### Fuentes\n\nLas referencias se añadirán durante la investigación.', change_summary: 'Estructura inicial de investigación', credits: 'Equipo de investigación de GIMG', created_at: '2026-10-08T18:00:00Z' },
    { id: 'version-demo', deliverable_id: 'cover-demo', version_number: 1, content_markdown: '## Propuesta de portada\n\nPrimera versión para revisión.\n\nLa composición parte del concepto de la edición y de las referencias del equipo.', change_summary: 'Propuesta inicial', credits: 'Ilustración del equipo', created_at: '2026-10-08T18:00:00Z' }
  ],
  events: [
    { id: 'research-date-demo', project_id: 'halloween-demo', deliverable_id: 'research-task-demo', title: 'Entrega de investigación', kind: 'deadline', starts_at: '2026-10-25T18:00:00Z' },
    { id: 'art-date-demo', project_id: 'halloween-demo', deliverable_id: 'cover-demo', title: 'Revisión de portada', kind: 'review', starts_at: '2026-10-30T18:00:00Z', revision: 1 },
    { id: 'muertos-date-demo', project_id: 'muertos-demo', deliverable_id: 'muertos-cover-demo', title: 'Referencias de Día de Muertos', kind: 'deadline', starts_at: '2026-11-01T18:00:00Z' }
  ],
  comments: [], audit: [], assignments: [], grants: [], delegations: []
};
