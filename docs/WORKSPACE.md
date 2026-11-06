# Workspace ya no vive en este repositorio

Desde el 5 de noviembre de 2026 Workspace (escritorio, web, Tauri, pasarela R2, conector, pruebas y publicación) está en
[santiagohzszmex/gba-workspace](https://github.com/santiagohzszmex/gba-workspace). Su historial anterior se conservó allá.

Aquí se quedan, por ahora:

- `api/gba-id.js` (GBA ID, compartido por VISTA, Mothership, Sepia y Workspace) y su prueba `test:identity`.
- `api/workspace-push.js` y `api/workspace-connector-config.js`, que usan claves de producción de este proyecto Vercel; prueba `test:workspace-push`.
- La página de descargas `gba.software/workspace` (`public/gba/workspace`).
- `src/workspace/WorkspaceAuth.jsx` (acceso de Mothership) y `WorkspacePublications.jsx` (publicaciones de GIMG en VISTA), con `gimgModel.js` y sus estilos.
- Las migraciones de Supabase de toda la base compartida. Las `workspace_*` se editan en gba-workspace.

`gba.software/workspace/web` y el trabajador de avisos (`/workspace/notification-worker.js`) se enrutan al proyecto Vercel `gba-workspace` por su dominio `workspace.gba.software` (ver `vercel.json`).
