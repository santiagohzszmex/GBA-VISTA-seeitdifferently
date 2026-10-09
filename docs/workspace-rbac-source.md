# Matriz RBAC definitiva de GBA Workspace para GIMG

**Estado:** aprobada para implementación  
**Versión:** 1.0  
**Fecha:** 8 de octubre de 2026  
**Aplicación inicial:** unidad GIMG dentro de GBA Workspace

## 1. Objetivo

Definir qué personas pueden ver, crear, modificar, revisar, aprobar, publicar y administrar información dentro de GBA Workspace. Esta especificación convierte el organigrama de GIMG en reglas implementables mediante Supabase Row Level Security, funciones de servidor y controles de interfaz.

La política general es **denegar por defecto**. Toda acción requiere:

1. una cuenta activa;
2. membresía vigente en la unidad;
3. un rol técnico válido;
4. alcance sobre el objeto;
5. y, cuando corresponda, una asignación organizacional o delegación activa.

## 2. Separación obligatoria

Workspace no utilizará el cargo editorial como sustituto directo del permiso técnico.

### Rol técnico — `access_role`

Indica las operaciones que el sistema puede autorizar: administrar, coordinar, aprobar, editar, revisar o leer.

### Asignación organizacional — `assignment_role`

Indica la función real dentro de GIMG: Dirección, Producción, Investigación, Redacción, Maquetación, Ilustración, Fotografía o QA.

Una persona puede tener varias asignaciones organizacionales y un solo rol técnico principal por alcance. También puede recibir delegaciones adicionales, temporales y explícitas.

## 3. Alcances

| Alcance | Ejemplo | Efecto |
|---|---|---|
| `platform` | Todo GBA Workspace | Administración técnica del producto. |
| `unit` | GIMG | Todos los proyectos de GIMG. |
| `project` | Edición Halloween | Sólo un producto o microedición. |
| `area` | Ilustración de Halloween | Sólo entregables de un área dentro del proyecto. |
| `deliverable` | Portada de Halloween | Únicamente una tarea o entregable. |

El alcance más reducido prevalece. Tener acceso a un proyecto no concede acceso a otra edición. Las delegaciones deben contener `starts_at`, `expires_at`, `granted_by` y una lista explícita de permisos.

## 4. Roles técnicos

| ID | Nombre visible | Propósito |
|---|---|---|
| `gba_platform_owner` | Administración técnica de GBA | Mantener plataforma, seguridad, unidades y recuperación técnica. No otorga autoridad editorial. |
| `gimg_direction` | Dirección de GIMG | Autoridad general y creativa de la unidad; aprobación y publicación final. |
| `gimg_production_lead` | Responsable de Producción | Administrar proyectos, calendario, tareas, dependencias y carga del equipo. |
| `gimg_workspace_coordinator` | Coordinación de Producción y Workspace | Mantener registros, recordatorios, incorporación y orden operativo. |
| `gimg_project_director` | Dirección de producto delegada | Dirigir una microedición o producto dentro de una delegación escrita. |
| `gimg_area_lead` | Responsable de área | Coordinar y revisar entregables de un área y proyecto determinados. |
| `gimg_contributor` | Colaborador | Trabajar sobre tareas y entregables asignados. |
| `gimg_quality_manager` | Gestión de archivos y QA | Verificar integridad técnica, documental, permisos, créditos y exportaciones. |
| `gimg_viewer` | Consulta | Leer recursos expresamente compartidos sin modificarlos. |

## 5. Relación entre organigrama y rol técnico

| Cargo organizacional | Rol técnico predeterminado | Alcance predeterminado |
|---|---|---|
| Dirección general y creativa | `gimg_direction` | `unit` |
| Asistencia de Dirección | `gimg_contributor` más delegación explícita | `project`, `area` o `deliverable` |
| Responsable de Producción | `gimg_production_lead` | `unit` durante el ciclo activo |
| Coordinación de Producción y Workspace | `gimg_workspace_coordinator` | `unit` durante el ciclo activo |
| Dirección de microedición | `gimg_project_director` | `project`, con expiración |
| Responsable editorial | `gimg_area_lead` | Área editorial de proyectos asignados |
| Responsable de maquetación | `gimg_area_lead` | Diseño de proyectos asignados |
| Responsable de continuidad de ilustración | `gimg_area_lead` | Ilustración de proyectos asignados |
| Investigación, redacción, diseño, ilustración o fotografía | `gimg_contributor` | Proyectos, áreas y entregables asignados |
| Gestión de archivos y QA | `gimg_quality_manager` | Proyectos activos de GIMG |
| Reserva, aspirante o integrante inactivo | Sin rol operativo; opcional `gimg_viewer` para incorporación | Recursos expresamente compartidos |

Las responsabilidades de Fotografía y documentación pueden representarse como `gimg_area_lead` si la persona coordina esa área; de lo contrario utilizarán `gimg_contributor`.

## 6. Leyenda de la matriz

- **U:** permitido en toda la unidad GIMG.
- **P:** permitido sólo en proyectos asignados.
- **A:** permitido sólo en el área asignada.
- **E:** permitido sólo en entregables propios o expresamente asignados.
- **D:** permitido únicamente si existe una delegación explícita.
- **—:** no permitido.

## 7. Matriz de permisos

| Acción | Plataforma GBA | Dirección | Producción | Coord. Workspace | Dir. producto | Resp. área | Colaborador | QA | Consulta |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Ver unidad GIMG | U | U | U | U | P | A | E | U | D |
| Modificar configuración de plataforma | U | — | — | — | — | — | — | — | — |
| Modificar configuración editorial de GIMG | — | U | — | — | — | — | — | — | — |
| Ver directorio de miembros activos | U | U | U | U | P | A | P | U | — |
| Invitar o aceptar miembros en GIMG | — | U | — | D | — | — | — | — | — |
| Suspender o revocar acceso operativo | D | U | D | — | — | — | — | — | — |
| Otorgar rol técnico o delegación | D | U | — | — | — | — | — | — | — |
| Crear proyecto o microedición | — | U | U | — | — | — | — | — | — |
| Editar datos de proyecto | — | U | U | P | P | — | — | — | — |
| Archivar proyecto | — | U | D | — | — | — | — | — | — |
| Crear tareas y entregables | — | U | U | P | P | A | E | E | — |
| Asignar o reasignar tareas | — | U | U | P | P | A | — | — | — |
| Cambiar prioridad o fecha | — | U | U | P | P | D | — | — | — |
| Actualizar estado propio | — | U | U | P | P | A | E | E | — |
| Declarar o retirar un bloqueo | — | U | U | P | P | A | E | U | — |
| Crear documentos o archivos | — | U | U | P | P | A | E | E | — |
| Editar contenido propio/asignado | — | U | U | P | P | A | E | E | — |
| Editar contenido ajeno no asignado | — | U | D | — | P | A | — | — | — |
| Comentar | — | U | U | P | P | A | E | U | D |
| Solicitar revisión | — | U | U | P | P | A | E | E | — |
| Consolidar solicitud de cambios | — | U | U | P | P | A | — | U | — |
| Aprobar investigación para redacción | — | U | D | — | P | A | — | — | — |
| Aprobar texto para diseño | — | U | — | — | P | A | — | — | — |
| Aprobar boceto para arte final | — | U | — | — | P | A | — | — | — |
| Aprobar integración técnica de páginas | — | U | — | — | P | A | — | U | — |
| Autorizar una segunda ronda | — | U | — | — | D | — | — | — | — |
| Reabrir un entregable aprobado | — | U | — | — | D | — | — | D | — |
| Marcar incidencia de QA | — | U | P | P | P | A | E | U | — |
| Bloquear salida por error crítico | — | U | — | — | — | — | — | U | — |
| Aprobar QA | — | U | — | — | — | — | — | U | — |
| Aprobar publicación final | — | U | — | — | — | — | — | — | — |
| Publicar en VISTA | D | U | D | — | — | — | — | P | — |
| Descargar preview | U | U | U | P | P | A | E | U | D |
| Descargar archivo fuente | D | U | U | P | P | A | E | U | — |
| Subir nueva versión | — | U | U | P | P | A | E | E | — |
| Archivar activo | — | U | U | P | P | A | E | U | — |
| Borrar físicamente activo | D | — | — | — | — | — | — | — | — |
| Registrar créditos y permisos | — | U | P | P | P | A | E | U | — |
| Aprobar créditos y permisos | — | U | — | — | — | — | — | U | — |
| Ver auditoría operativa | U | U | U | P | P | A | E propia | U | — |
| Exportar auditoría completa | U | U | — | — | — | — | — | D | — |

## 8. Interpretación de permisos sensibles

### Administración técnica no equivale a Dirección

`gba_platform_owner` puede mantener tablas, seguridad y disponibilidad, pero no puede aprobar textos, conceptos o publicaciones salvo que también posea una asignación vigente de Dirección de GIMG.

### Producción organiza, no sustituye aprobaciones

Producción puede crear proyectos, tareas y calendarios. No puede aprobar contenido editorial, arte final o publicación final. Puede publicar técnicamente en VISTA sólo cuando Dirección haya registrado la aprobación final y exista permiso delegado para ejecutar la operación.

### Coordinación no concede cargos

La Coordinación de Workspace puede apoyar altas ya autorizadas, registrar tareas, fechas y acuerdos. No puede otorgar roles, aceptar unilateralmente aspirantes, cambiar el concepto ni aprobar entregables.

### Responsables de área

Un responsable de área puede devolver trabajos, consolidar cambios y aprobar el hito de su especialidad. La aprobación de área no equivale a aprobación final del producto.

### QA puede bloquear, no rediseñar

QA puede bloquear una publicación por corrupción, ausencia de originales, atribución, permiso, crédito, formato o defecto crítico. No puede modificar el concepto ni imponer preferencias creativas. Liberar el bloqueo exige que QA confirme la corrección; la publicación final sigue correspondiendo a Dirección.

## 9. Reglas obligatorias

1. Ninguna persona puede realizar la aprobación final de un entregable propio sin una segunda revisión autorizada.
2. Dirección es la única función con `approve_final_publication` para las ediciones principales.
3. Una Dirección de microedición sólo recibe permisos incluidos en su delegación escrita; la publicación final no se presume.
4. Una segunda ronda o reapertura requiere Dirección, excepto una corrección crítica iniciada por QA y registrada en auditoría.
5. Las versiones aprobadas son inmutables. Toda corrección crea una versión nueva.
6. Archivar es la operación normal; el borrado físico queda reservado al servicio administrativo y requiere motivo registrado.
7. La lista de reserva no recibe acceso a proyectos ni archivos internos.
8. Al expirar una asignación se conserva historial, autoría y créditos, pero se pierde el acceso operativo.
9. Suspensión, baja o membresía inactiva prevalecen sobre cualquier rol o delegación.
10. WhatsApp no concede permisos ni demuestra una aprobación hasta que la decisión se registre en Workspace.

## 10. Estados y transiciones autorizadas

| Transición | Quién puede ejecutarla |
|---|---|
| Pendiente → Asignado | Dirección, Producción, Dirección de producto; Responsable de área dentro de su área. |
| Asignado → En progreso | Persona asignada o coordinación operativa. |
| En progreso → En revisión | Persona asignada, Responsable de área o Producción. |
| En revisión → Cambios solicitados | Responsable de área, Dirección de producto, Dirección o QA por incidencia. |
| En revisión → Aprobado de área | Responsable de área, Dirección de producto delegada o Dirección. |
| Aprobado de área → En QA | Producción, Responsable de área, Dirección de producto o Dirección. |
| En QA → Cambios solicitados | QA. |
| En QA → QA aprobado | QA. |
| QA aprobado → Publicado | Dirección; ejecución técnica delegable a Producción o QA. |
| Cualquier estado → Bloqueado | Persona asignada, Producción, Responsable de área, Dirección de producto, Dirección o QA; siempre con motivo. |
| Aprobado/Publicado → Reabierto | Dirección; QA sólo inicia incidencia crítica y requiere registro. |
| Cerrado → Archivado | Dirección, Producción o QA conforme al cierre aprobado. |

## 11. Modelo mínimo para implementación

### `workspace_unit_memberships`

- `unit_id`
- `user_id`
- `membership_status`
- `joined_at`
- `expires_at`
- `suspended_at`

### `workspace_access_grants`

- `id`
- `user_id`
- `access_role`
- `scope_type`
- `scope_id`
- `starts_at`
- `expires_at`
- `granted_by`
- `revoked_at`
- `reason`

### `workspace_assignments`

- `id`
- `user_id`
- `assignment_role`
- `unit_id`
- `project_id`
- `area_id`
- `deliverable_id`
- `starts_at`
- `expires_at`
- `assigned_by`

### `workspace_delegations`

- `id`
- `delegate_user_id`
- `delegated_by`
- `scope_type`
- `scope_id`
- `permission_keys[]`
- `starts_at`
- `expires_at`
- `written_brief_id`
- `revoked_at`

Los permisos no deben almacenarse únicamente en el cliente. Supabase RLS o funciones `SECURITY DEFINER` revisadas deberán comprobar membresía, rol, alcance, asignación, estado y expiración en servidor.

## 12. Orden de comprobación en servidor

Para cada acción:

1. validar sesión de GBA ID;
2. comprobar que la cuenta no está suspendida;
3. comprobar membresía activa en GIMG;
4. resolver rol técnico y alcance;
5. comprobar asignación o delegación cuando sea necesaria;
6. comprobar estado del proyecto y entregable;
7. impedir autoaprobación final;
8. ejecutar la acción;
9. registrar actor, acción, objeto, versión, fecha y contexto en auditoría.

## 13. Permisos atómicos recomendados

```text
platform.manage
unit.settings.manage
unit.members.read
unit.members.invite
unit.members.suspend
unit.roles.grant
project.create
project.update
project.archive
task.create
task.assign
task.update_status
task.update_schedule
content.create
content.edit_assigned
content.edit_any_scoped
content.comment
content.request_review
review.request_changes
review.approve_area
review.authorize_extra_round
review.reopen
qa.raise_issue
qa.block_release
qa.approve
publication.approve_final
publication.execute
asset.upload
asset.download_preview
asset.download_source
asset.archive
asset.delete_physical
credits.edit
credits.approve
audit.read_scoped
audit.export_full
```

La interfaz puede ocultar acciones no autorizadas, pero la seguridad no debe depender de botones ocultos.

## 14. Criterios de aceptación técnica

- Un colaborador no puede leer ni editar otro proyecto sin asignación.
- Un responsable de área no puede aprobar publicación final.
- Producción puede reasignar una tarea, pero no aprobar el contenido de esa tarea.
- QA puede bloquear una salida, pero no publicarla sin aprobación registrada de Dirección.
- Un administrador técnico no obtiene autoridad editorial automáticamente.
- Una delegación expirada deja de funcionar sin borrar el historial.
- Una persona suspendida pierde acceso aunque conserve asignaciones anteriores.
- La descarga de originales usa autorización temporal y queda auditada.
- Todas las acciones sensibles se prueban tanto desde interfaz como mediante llamadas directas a la API.

