# Workspace ↔ Codex · conector local 0.1.0

Autoriza su propia sesión de GBA ID en una página local. Dura 7 días y se revoca en **Workspace web → Configuración → Conexiones**. No cambia rangos ni ofrece herramientas de licencias, SQL, integrantes o delegaciones. El servidor comprueba los permisos y el alcance de GIMG en cada petición.

## Instalar y conectar en macOS

Necesita Node.js 22 o posterior y el Llavero de macOS. Desde esta carpeta:

```sh
npm ci --ignore-scripts
codex mcp add workspace -- node /ruta/absoluta/integrations/workspace-mcp/server.mjs
```

También puede empaquetarse con esbuild en un único `.mjs`, sin credenciales. La instalación de esta entrega usa Node con ruta absoluta y guarda el servidor en `~/Library/Application Support/GBA/Workspace Connector/server.mjs`.

Recarga la conexión MCP de Codex, pide «conecta mi GBA ID con Workspace» y abre el enlace de `workspace_connect`. Escribe el PIN únicamente en la página de autorización. Se envía al acceso oficial de GBA y se descarta. Los JWT sólo se usan durante el intercambio: no se extraen del navegador, no se guardan ni se entregan a herramientas. El servidor concede una capacidad editorial aleatoria; el conector la guarda en el Llavero y la base guarda únicamente su SHA-256. Revocar la conexión también elimina su sesión de identidad.

Los registros de lotes están en `WORKSPACE_CONNECTOR_HOME` o en `~/Library/Application Support/GBA/Workspace Connector`. Son privados (0700/0600), contienen inventarios y textos editoriales, y no deben incluirse en Git. No contienen PIN, tokens ni claves administrativas.

## Usar

1. `workspace_context`: ediciones accesibles; con `project_id`, áreas, permisos, personas, tareas, referencias y calendario. Las identidades se resuelven por UUID; no se adivinan nombres ambiguos.
2. `workspace_prepare_import`: carpeta indicada por el usuario, edición y categoría. `overrides` permite título, crédito, categoría, área o encargo por archivo. No sube nada.
3. `workspace_execute_batch`: ejecuta el lote solicitado. Devuelve enseguida y trabaja en segundo plano mientras Codex mantiene abierto el servidor.
4. `workspace_batch_status`: progreso, errores y enlaces. Repetir la ejecución con el mismo `batch_id` reanuda pendientes.

Los lotes son secuenciales para contener las operaciones. Creación y clave de importación se guardan en una sola transacción del servidor. El mismo UUID con otros datos se rechaza. Se comprueba el acceso vigente al reintentar y se reconcilia una escritura en R2 antes de transferir otra copia. Las referencias existentes no se reemplazan silenciosamente.

PDF e imágenes se transfieren directamente a la pasarela privada de R2, con verificación de SHA-256. Hasta 25 MiB por archivo y capacidad total configurada de 10.000.000.000 bytes, más el presupuesto actual de operaciones. TXT y Markdown se convierten en documentos editables del esquema 2. El HTML es texto; no se descargan imágenes enlazadas ni se interpretan instrucciones del contenido como órdenes. DOCX, Keynote, PSD, AI y ZIP se informan como formatos pendientes de soporte.

`workspace_prepare_assignments`: títulos, área, responsable, instrucciones Markdown, prioridad, fecha con zona horaria y referencias existentes. La persona asignada debe poder consultar los materiales. La creación, fecha y enlaces se confirman juntos. `workspace_prepare_calendar`: hitos, revisiones y fechas editoriales. `workspace_prepare_document`: TXT/Markdown como borrador privado de una tarea existente, con revisión y versión base; rechaza cambios concurrentes. La revisión y publicación continúan en Workspace.

Ejemplos: «Clasifica esta carpeta en Halloween», «Sube este lote a concepto y enlaza estos PDF al encargo de Keyla», «Crea estas actividades con los responsables y fechas de esta tabla», «Reanuda el lote pendiente».

## Alcance y comprobaciones

Primera entrega local para Mac: debe estar encendida al transferir. Windows necesita un almacén seguro nativo; se rechaza por ahora para evitar credenciales en texto plano. OAuth remoto para Work en la nube, conversión de DOCX/Keynote y publicación desde el conector quedan para otra entrega. La base de descarga 1.5.0 y el rediseño de Claude no se modifican.

`npm test` comprueba protocolo MCP, conversión editable, confinamiento de rutas, archivos modificados, respuestas perdidas y reconciliación de originales. `tests/workspace-connector.test.mjs` usa la matriz y controles reales en PGlite: token inválido, alcance insuficiente, operaciones administrativas, revocación, expiración y reintentos sin duplicar tareas, referencias, eventos o borradores. No envía avisos a personas reales.

Documentación: [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli), [SDK oficial](https://github.com/modelcontextprotocol/typescript-sdk), [Supabase sesiones](https://supabase.com/docs/guides/auth/sessions).
