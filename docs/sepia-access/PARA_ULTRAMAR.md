# Entrega final para conectar Ultramar

El backend nativo de revisión 2 ya está público y activo. Lee AUTH_NATIVO.md y PUBLICACION.json. Usa la configuración y claves **de producción** adjuntas, verificadas desde gba.software; nunca el vector sintético vencido como clave de producción.

- GET https://gba.software/api/sepia/v1/config
- POST https://gba.software/api/sepia/v1
- GET https://gba.software/api/sepia/v1/offline-keys
- Administración de licencias: https://gba.software/sepia/administrar/

R1 corregido (reloj inválido rechazado); R2 con políticas y configuración reales; R3 reproducible mediante verification/sepia-access (npm ci, npm test), más 62 comprobaciones GoTrue/PostgreSQL reales. Se conserva la evidencia de los intentos fallidos y sus correcciones.

Continúa el cliente nativo P1.2 en su propio repo: login GBA ID/PIN sin navegador, desafíos TOTP si corresponden, llavero seguro, validación offline/reloj y bienvenida. No presentar como terminada esa UI por estar activo el servidor. No se publicó ningún instalador de Ultramar desde este chat. Workspace, sus instaladores y su base pública no se alteraron.
