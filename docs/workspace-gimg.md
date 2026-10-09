# GBA Workspace: base organizacional y licencias

Implementación local del alcance `04-siguiente-actualizacion-workspace-gimg.md`, con la matriz aprobada conservada en `workspace-rbac-source.md`. Fecha funcional: 8 de octubre de 2026.

## Qué está implementado

- GIMG como unidad, extensible a otras unidades, sin dar permisos editoriales a los administradores técnicos.
- Membresías, estados, vigencia, roles por alcance, funciones organizacionales y delegaciones escritas con vencimiento.
- Proyectos, áreas, entregables, colaboradores, prioridades, fechas, dependencias sin ciclos y control de concurrencia por revisión.
- Versiones inmutables de Markdown; registro de activos externos en repositorio controlado; comentarios y solicitudes consolidadas de cambios; verificación y autorización de rondas adicionales.
- Aprobación de especialidad, QA, bloqueo crítico, aprobación final sin autoaprobación y publicación de una copia aprobada en VISTA. Un bloqueo crítico de QA retira la copia del público y conserva el historial.
- Calendario vinculado a las fechas de entrega y registro de cambios con actor, objeto, versión y fecha.
- Panel de trabajo, carga y actividad. Las Keynotes conservan sus tablas, editor, historial y publicación anteriores.
- Códigos de escritorio de un solo uso: 192 bits aleatorios, hash SHA-256, duración configurable desde activación, vinculación a cuenta, vencimiento y revocación. La web sigue usando membresía y RBAC.
- Acceso con PIN mediante un endpoint de servidor. Las frases se migran a un verificador SHA-256 + bcrypt con sal; los PIN se comprueban en el servidor y las contraseñas internas de Auth se vuelven aleatorias. Se retiran los RPC públicos de recuperación anteriores.

## Despliegue coordinado pendiente

Estas migraciones **no se han aplicado a Supabase**. El endpoint y el frontend tampoco se han publicado. No incorporar colaboradores hasta comprobar el flujo real de autenticación, las políticas desplegadas y el acceso desde dos cuentas distintas.

1. Respaldar la base y comprobar en staging las funciones/triggers existentes de perfiles y Auth. La prueba local utiliza PostgreSQL embebido con pgcrypto real; no sustituye la validación de la configuración real de Supabase.
2. Preparar `/api/gba-id` junto con las variables de servidor `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. Nunca colocar la clave de servicio en variables `VITE_`, en el frontend o en los instaladores.
3. Configurar `GBA_ID_ALLOWED_ORIGINS`: orígenes reales de VISTA, GBA y desarrollo autorizado, más `tauri://localhost`, `http://tauri.localhost` y `https://tauri.localhost`. El origen por sí solo no sustituye autenticación. En Vercel, el limitador utiliza `x-vercel-forwarded-for`, nunca una IP enviada en el cuerpo.
4. Aplicar, después de las migraciones existentes, en este orden:
   - `20261009050000_workspace_gimg.sql`
   - `20261009051000_workspace_licenses.sql`
   - `20261009052000_gba_id_secure_gateway.sql`
   - `20261009112023_gimg_role_isolation.sql`
5. Publicar inmediatamente el endpoint y los nuevos clientes web como una misma entrega. La última migración rota las contraseñas internas de las cuentas `@gba.com`; los clientes antiguos que usen `signInWithPassword` con el PIN dejan de funcionar. No ejecutar esa migración aislada en producción.
6. Verificar registro, ingreso con PIN antiguo, recuperación con frase antigua y código de convocatoria, sesión revocada, suspensión y autorización mediante llamadas directas a RPC y REST. Comprobar que un colaborador no ve otro proyecto ni obtiene un enlace a originales con sólo permiso de lectura.

Los límites del gateway combinan cuenta, identificador de dispositivo e IP del servidor. Los intentos de una cuenta producen espera progresiva desde el quinto intento; dispositivo y origen tienen presupuestos compartidos de 80 y 180 solicitudes por hora. El identificador de dispositivo no se considera confiable por sí solo. La recuperación elimina las sesiones; Workspace comprueba la sesión en `auth.sessions` para rechazar inmediatamente un JWT revocado.

## Dirección inicial y permisos

Las cuentas `Dueño` reciben únicamente administración técnica. No reciben membresía ni Dirección de GIMG automáticamente. Las asignaciones explícitas de Dirección que ya existan en `gimg_recruitment_reviewers` se conservan como Dirección de la unidad. Si esa tabla no tiene Dirección, debe registrarse una asignación editorial explícita por el servicio administrativo antes de incorporar al equipo.

Los roles, asignaciones y delegaciones no se conceden por una licencia ni por estar en la lista de reserva. Los permisos se comprueban por acción en servidor. Un rol principal en un alcance más reducido prevalece sobre otro más amplio para el mismo objeto. Suspensión y vencimiento tienen prioridad sobre todos ellos.

## Licencias

El administrador técnico emite códigos en la pestaña Licencias de la web. Puede vincular un código a un UUID de GBA ID. La duración admite días entre 1 y 3650 desde la interfaz; el RPC admite segundos entre una hora y diez años. La misma cuenta puede repetir una activación para recuperar su estado, sin reiniciar la vigencia. Otra cuenta no puede reutilizar el código.

El código se muestra una sola vez. En la base se guarda su hash y metadatos; no aparece en listados o auditoría. La revocación de un código revoca también la licencia resultante. La licencia está vinculada a cuenta; no hay aún un límite de equipos simultáneos, porque no se ha definido esa política.

La aplicación de escritorio comprueba licencia al iniciar, cada 30 segundos, al volver a primer plano y al alcanzar el vencimiento. Si no puede verificarla, bloquea el acceso local. No se promete trabajo sin conexión. La versión web permite usar el mismo contenido con membresía válida y sin licencia de escritorio.

## Clientes y descargas

- `/workspace/`: página de descarga en GBA.
- `/workspace/web`: entrada directa a Workspace web.
- `/?workspace-preview=1`: demostración sólo en desarrollo.
- `/?gimg-publications=1`: copias aprobadas publicadas en VISTA.
- `src-tauri/`: configuración Tauri 2 para la interfaz compartida.
- `npm run workspace:build`: compila el frontend de escritorio.
- `npm run desktop:dev` y `npm run desktop:build`: requieren Rust/Cargo, herramientas de la plataforma y acceso a la CLI de Tauri.
- `.github/workflows/workspace-desktop.yml`: compilación manual de candidatos en macOS y Windows, sin publicación automática de releases.

**No se han producido ni probado instaladores nativos.** El equipo de trabajo no tiene Rust/Cargo. La compilación del frontend de escritorio sí se ha comprobado. Quedan compilación nativa, prueba en Windows real, firma, notarización, pruebas de actualización y distribución. La configuración no incluye permisos nativos de archivos, shell o ejecución de programas.

La página de descargas lee `public/gba/workspace/releases.json`. El manifiesto permanece vacío hasta tener paquetes verificados. Para cada descarga registrar `platform` (`macos` o `windows`), `architecture`, `version`, `url` HTTPS y `sha256`. No publicar URLs antes de verificar el archivo, su firma y su checksum. Añadir las arquitecturas de macOS que se hayan compilado y probado.

## Archivos y límites de esta fase

Cloudflare no se ha configurado, consultado ni conectado. Los archivos pesados siguen en un repositorio externo controlado. Sus enlaces se conservan en un esquema privado y sólo se entregan tras comprobar `asset.download_source` y registrar auditoría; el repositorio externo mantiene su propio control de acceso. Esto todavía no ofrece URLs temporales de descarga, escaneo, cuotas ni cargas privadas de originales. Esas capacidades pertenecen a la etapa posterior de almacenamiento.

La interfaz muestra las últimas 200 acciones autorizadas. La retención completa permanece en base; la exportación completa requiere su permiso específico y queda auditada. Las notificaciones externas pertenecen a una etapa posterior. La integración del acceso PIN con los triggers y las variables reales de Supabase sigue pendiente de prueba en staging.

## Validación local

- `npm run test:workspace`: PostgreSQL/RLS, ciclo editorial y gateway.
- `npm run test:session`: regresión de sesiones.
- `npm run test:recruitment`: regresión de convocatoria.
- `npm run build`: VISTA y convocatoria.
- `npm run workspace:build`: frontend de escritorio.

La demostración de la interfaz no se usa como evidencia de autorización. Las pruebas ejecutan consultas y mutaciones reales contra una base PostgreSQL local, cambiando de rol y sesión.

## Separación de rangos: revisión del 9 de octubre de 2026

`usuarios.rol` conserva los rangos generales de GBA. Los roles operativos de GIMG se asignan en `workspace_access_grants` con unidad, alcance y vigencia; los cargos viven en `workspace_assignments`. Dirección/evaluación de la convocatoria utiliza asignaciones explícitas en `gimg_recruitment_reviewers`. Ninguno de esos flujos modifica el rango general.

La migración `gimg_role_isolation` retira la herencia de Dirección de convocatoria desde `vista_is_platform_admin()`, prohíbe asignar roles de GIMG a otras unidades o al alcance de plataforma, y bloquea futuros rangos globales que contengan GIMG. Conserva los registros existentes sin reclasificar personas automáticamente. Los catálogos de roles de plataforma y GIMG se presentan por separado. Las Keynotes mantienen sus permisos históricos de GBA.

Antes de aplicar en producción, comprobar que exista al menos una Dirección de convocatoria explícita. Si sólo tenía acceso por Dueño/Admin, su asignación de GIMG debe registrarse expresamente. La revisión del repositorio no confirma qué personas o rangos están actualmente asignados en Supabase.

Aceptar una invitación de la editorial GIMG en VISTA Studio conserva el rango personal de GBA. Las invitaciones de otras editoriales mantienen su comportamiento anterior. No se reclasifican promociones históricas sin confirmar el rango anterior de la cuenta.

La revisión de Supabase del 9 de octubre confirmó 1 Dueño, 8 Editor y 118 rangos NULL; la restricción desplegada permite Dueño, Admin, Ciudadano y Editor. No hay Dirección explícita en gimg_recruitment_reviewers. La separación local cubre también vista_approve_editorial_request: crear GIMG conserva el rango personal, incluido NULL. Las editoriales externas mantienen su comportamiento previo. Ninguna consulta de esta revisión modificó producción.

La separación se divide en dos migraciones: 20261009123356_gimg_identity_role_isolation.sql cubre convocatoria, rango general e invitaciones/creación de GIMG en Studio y funciona sobre el esquema actual; 20261009112023_gimg_role_isolation.sql instala las restricciones de alcance del nuevo Workspace. La cuenta autorizada para Dirección explícita es @Santiago, conservando Dueño en GBA. La migración de Workspace inicial incorpora las Direcciones ya asignadas en convocatoria sin heredar rangos globales.

Aplicada en Supabase la migración gimg_identity_role_isolation (versión remota 20261009123356). @Santiago mantiene Dueño y tiene director explícito en gimg_recruitment_reviewers. Comprobados permisos con sesión real activa y rechazo sin sesión; no se cambiaron otros rangos ni Keynotes. Los alcances del nuevo Workspace siguen pendientes con su esquema.
