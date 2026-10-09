# Continuación de GBA Workspace en Work Cloud

Estado confirmado al 9 de octubre de 2026. Este documento resume la entrega para que el trabajo continúe sin acceso a la Mac. Léelo antes de usar notas anteriores que puedan describir estados ya superados.

## Fuentes y decisiones del usuario

- Alcance original: `docs/workspace-update-source.md`.
- Fuente de verdad de permisos: `docs/workspace-rbac-source.md`.
- Guía técnica: `docs/workspace-gimg.md`.
- Estado de roles aplicado: `docs/workspace-role-deployment.md`.
- El usuario permite reemplazar el Workspace anterior; conservar las Keynotes y sus datos/edición/publicación.
- Producto final: web, macOS y Windows. Descargas desde la página de GBA.
- Código de licencia de escritorio con duración configurable por código, contado desde la primera activación. Una reactivación no extiende la vigencia. Web exige membresía/RBAC y no licencia de escritorio.
- Rangos GBA y roles GIMG separados. @Santiago conserva Dueño en GBA y recibió Dirección explícita de GIMG.
- Cloudflare fue ofrecido como integración futura y el usuario indicó no configurarlo todavía. No tratar esta entrega como autorización específica para activar Cloudflare.

## Estado de Supabase

Proyecto: `wgihpztgwsovhykboyru`.

Ya aplicado y verificado en producción: `20261009123356_gimg_identity_role_isolation.sql`. @Santiago está en `gimg_recruitment_reviewers` con `role='director'`; no cambiarlo ni asignar Dirección automáticamente a otros Dueño/Admin. La función exige sesión activa. Se conservó el rango Dueño; la creación/invitación de GIMG en Studio no promueve rangos globales. No volver a aplicar esta migración ni insertar otra auditoría de nombramiento por repetir el handoff.

Pendientes de aplicar, revisar contra staging y desplegar coordinadamente:

1. `20261009050000_workspace_gimg.sql`.
2. `20261009051000_workspace_licenses.sql`.
3. `20261009052000_gba_id_secure_gateway.sql`.
4. `20261009112023_gimg_role_isolation.sql` (restricciones del nuevo Workspace).

La migración de Workspace incorpora la Dirección explícita ya nombrada en convocatoria. La migración del gateway rota contraseñas internas de cuentas @gba.com: no ejecutarla aislada antes de tener API y nuevos clientes preparados. Los clientes antiguos que ingresan con signInWithPassword(PIN) dejarían de funcionar.

La sesión OAuth MCP local y las credenciales del servidor no se transfieren al contenedor cloud. Verificar qué conectores están disponibles; obtener configuración mediante conexiones autorizadas o secretos CI existentes. No copiar claves de servicio a VITE_*, repositorio, conversación, manifests o instaladores. No asumir acceso de escritura a Supabase o Vercel por tener el código público.

## Trabajo implementado y verificado

- Dashboard GIMG, proyectos/áreas/entregables, equipos, calendario, auditoría, versiones/revisión/QA/publicaciones.
- RLS y funciones por acción, sesión, unidad, proyecto, área, entregable, asignaciones y delegaciones con vigencia.
- Keynotes aisladas en `src/workspace/KeynotesWorkspace.jsx`, conservando tablas históricas.
- Códigos de licencia de 192 bits, hash, un solo uso por cuenta, duración desde activación y revocación.
- API `api/gba-id.js` y `src/auth/identityGateway.js` para autenticación segura desde web y escritorio.
- Scaffold Tauri 2 en `src-tauri`, frontend nativo en `src/workspace/desktop.jsx` y `workspace/index.html`.
- Página de descargas en `public/gba/workspace/`, manifiesto vacío por no existir instaladores verificados.
- Workflow manual de candidatos nativos en `docs/ci/workspace-desktop.workflow.yml` (plantilla pendiente de instalar en .github/workflows).

Validación realizada: 97 comprobaciones Workspace + 20 gateway + 9 separación sobre esquema actual. Regresiones anteriores de sesiones (47) y convocatoria (108) pasaron. Web y frontend desktop compilaron. No se compilaron ni probaron instaladores nativos; el host local no tenía Rust/Cargo. No hay firma, notarización o updater ya resueltos.

## Objetivo de la sesión cloud

Continuar sobre esta entrega y terminar un flujo real y verificable: GBA ID → membresía GIMG → licencia sólo en escritorio → Workspace; y descarga efectiva para macOS y Windows desde GBA.

1. Revisar implementación y matriz contra las fuentes y resolver faltantes antes de declarar listo.
2. Probar migraciones sobre staging compatible con triggers/Auth reales. Preparar entrega coordinada API, frontend y base, preservando Keynotes y el nombramiento explícito.
3. Completar y ejecutar CI nativo en runners macOS y Windows, con arquitecturas documentadas. Linux cloud no sustituye esos runners. Revisar rutas, CORS/orígenes Tauri, CSP, acceso a Auth/API, licencias y manejo de vencimiento/red.
4. Obtener paquetes descargables reales (.dmg/app y .exe/msi según decisión verificada). Resolver firma/notarización y actualización usando secretos legítimos si están disponibles. Si falta una credencial o cuenta requerida, completar candidatos y señalar el bloqueo concreto; nunca inventar una firma o declarar listos paquetes sin prueba.
5. Verificar archivos/checksums, conservar artifacts/release durable y poblar `releases.json` con URL HTTPS real, versión, arquitectura y SHA-256 sólo después de verificar cada paquete. No publicar enlaces vacíos o falsos.
6. Probar página GBA de descarga, activación por código, expiración, revocación, web con membresía y rechazo de permisos mediante API directa. La licencia no concede membresía ni cargo.
7. Entregar PR revisable, enlaces de builds y descargas reales, estado de despliegue y lista concreta de cualquier bloqueo restante. No borrar datos de producción ni mezclar rangos.

No adquirir planes, certificados o servicios de pago ni aceptar contratos sin autorización específica. El usuario quiere avanzar de forma autónoma; pedir sólo datos/accesos realmente necesarios y completar mientras tanto el trabajo independiente.

La conexión GitHub local tiene repo pero carece de workflow scope. Se entregó la plantilla como documentación para publicar la rama sin ampliar permisos; el runner nativo no está habilitado. Instalar la plantilla en .github/workflows mediante una conexión autorizada con permiso workflow y activar los builds al resolver el acceso, sin declarar compilaciones realizadas previamente.
