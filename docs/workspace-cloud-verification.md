# Workspace: verificación cloud y entrega coordinada

Base exacta: b71106f3748417a3e484a63da913ce43a8dfcbdf, rama codex/workspace-cloud-release-20261009.

## Cambios cloud

- CLI Tauri fijada a 2.8.4 en package-lock, sin descarga flotante con npx.
- Licencias largas reprograman el reloj sin vencer al alcanzar el límite de setTimeout.
- VISTA y tres orígenes Tauri cubiertos por preflight y autenticación del gateway.
- CI nativo para macOS Apple Silicon, macOS Intel y Windows x64. Genera DMG y NSIS EXE, comprueba arquitectura, integridad y firma cuando existe, calcula SHA-256 y registra arranque del proceso.
- Candidatos: artifacts por 90 días y GitHub Releases en borrador como destino durable. Un borrador no constituye descarga pública.
- Firma macOS opcional con certificados legítimos importados en keychain temporal, notarización y comprobación de stapler/Gatekeeper. Windows produce candidatos sin firma hasta disponer del certificado/servicio Authenticode autorizado. No se contratan servicios.
- El manifiesto público sólo se genera con aceptación, firma verificada y comparación de bytes descargados por HTTPS contra SHA-256. Continúa vacío hasta cumplir esas condiciones.

## Configuración de CI

Configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY como variables públicas de Actions; el script rechaza service_role y sb_secret. El endpoint aprobado es https://gba.software/api/gba-id.

Antes de usar firma: proteger el environment workspace-candidates para ejecutar únicamente código revisado. Secretos Apple: APPLE_CERTIFICATE (P12 base64), APPLE_CERTIFICATE_PASSWORD, APPLE_SIGNING_IDENTITY, APPLE_ID, APPLE_PASSWORD (app-specific), APPLE_TEAM_ID. No introducirlos en commits, artifacts o VITE_. No hay updater automático configurado ni clave de updater inventada.

## Staging y producción

1. Obtener conexión administrativa autorizada a Supabase y staging existente compatible; no crear un servicio de pago. Respaldar con acceso restringido Auth, public, schemas privados, migraciones, triggers y datos Keynotes; restaurar y comprobar el respaldo en staging. No subir backup a este repositorio público.
2. Confirmar que 20261009123356 ya está en el historial y @Santiago conserva Dueño + director explícito. No repetir la migración ni el nombramiento.
3. Preparar API/frontend del mismo commit en preview con variables de servidor y origen exacto de preview autorizado. La clave de servicio sólo llega al proceso servidor. Revisar todos los clientes anteriores que aún ingresan directamente con PIN.
4. En staging aplicar únicamente, en orden: 20261009050000, 20261009051000, 20261009052000, 20261009112023. No usar supabase db push a ciegas: hay una migración posterior ya aplicada en producción.
5. Probar con cuentas y sesiones reales: PIN anterior, registro, recuperación/frase anterior, rotación interna, limitador, JWT revocado, suspensión, membresía vencida, delegación vencida, rechazo REST/RPC de otro proyecto, ciclo editorial y Keynotes. Web funciona sin licencia. Licencia sin membresía no concede acceso. Activación repetida mantiene starts_at/expires_at; vencimiento/revocación y pérdida de red cierran acceso de escritorio.
6. Probar instaladores en cada arquitectura, incluyendo WebView/Tauri/CSP/preflight y recuperación de red. El arranque del proceso en CI no sustituye esta aceptación.
7. Con respaldo restaurable y staging aprobado, preparar ventana coordinada API/frontend/migraciones. Rotar contraseñas del gateway sólo cuando todos los clientes estén preparados. Promover la entrega verificada; rollback de frontend antiguo por sí solo no restaura PIN ni sesiones.
8. Publicar assets verificados de una Release pública y ejecutar scripts/workspace-release-manifest.mjs con evidencia del mismo commit. Después desplegar la página GBA y comprobar sus descargas, tamaño y SHA-256.

## Evidencia local cloud

Pasaron 97 comprobaciones SQL/RLS Workspace, 43 gateway (incluye orígenes), 47 sesiones, 108 convocatoria y pruebas de reloj/CSP/configuración de claves. Web y frontend desktop compilan; existe advertencia de chunks grandes. PostgreSQL embebido no prueba triggers/Auth reales de Supabase. No declarar instaladores, staging, firma o producción a partir de esta evidencia local.

## Continuación local verificada

El commit db07debf6279c982618d3804428051727db9b269 pasó la [ejecución nativa 37981457217](https://github.com/santiagohzszmex/GBA-VISTA-seeitdifferently/actions/runs/37981457217): las tres arquitecturas compilaron y pasaron verificación de paquetes y arranque del proceso. Los artefactos descargados coinciden con SHA-256 y tamaño registrados. macOS usa firma ad hoc, sin notarización; Windows está sin firma. Apple Silicon también abrió localmente la pantalla de GBA ID. La aceptación de acceso y licencias desde los instaladores sigue pendiente.

Workspace, licencias y aislamiento de roles pasaron un ensayo transaccional autorizado contra Supabase real con ROLLBACK completo. Se comprobaron Dirección explícita y propietario, rechazo de sesiones inexistentes, activación desde el primer uso, repetición con las mismas fechas y revocación. Las Keynotes y contraseñas conservaron sus huellas dentro de la transacción. Después del rollback permanecen 127 cuentas y dos Keynotes y no existe workspace_private. El ensayo excluyó la migración de identidad; no acredita todavía la emisión real de sesiones por la API.

El secreto del servidor está configurado en Production de Vercel. Los archivos .env, credenciales locales, compilaciones nativas y candidatos se excluyen explícitamente de la subida del CLI con .vercelignore. La entrega coordinada y el manifiesto público siguen pendientes.

El gateway acepta el origen exacto del despliegue suministrado por VERCEL_URL al ejecutarse en Vercel, además de los dominios GBA y orígenes Tauri previstos. No incorpora dominios desde Host ni otros encabezados de la petición. Pasaron 50 comprobaciones de gateway, incluyendo aceptación de su propio despliegue y rechazo de otros proyectos, dominios parecidos y valores de configuración no válidos. Referencia de [variables de sistema de Vercel](https://vercel.com/docs/environment-variables/system-environment-variables#vercel_url).

Antes de convertir credenciales, la migración prepara un checkpoint cifrado AES-256 de los hashes de contraseña, fechas y frases anteriores, protegido en workspace_private. La clave de cifrado se genera dentro de la transacción y se conserva en [Supabase Vault](https://supabase.com/docs/guides/database/vault); no se envía a clientes, logs o archivos locales. Se verifica el descifrado íntegro del checkpoint antes de modificar las credenciales. Las tablas se bloquean en el orden Auth → perfil, con límite de espera de cinco segundos, para mantener coherencia con registros y recuperaciones concurrentes. Este checkpoint sirve para revertir la conversión dentro del mismo proyecto; no constituye un respaldo independiente para recuperar un proyecto eliminado.

Pasaron 101 comprobaciones de Workspace, incluyendo restauración del checkpoint con datos ficticios y denegación de lectura a usuarios. Vault está simulado en esa prueba: se verificó que el proyecto real contiene las funciones necesarias, pero la migración de identidad permanece pendiente de su aprobación y aplicación coordinada.

## Ajustes de compatibilidad y comprobación del servidor

La recuperación admite las frases anteriores no vacías, incluyendo las que tienen menos de ocho caracteres; los registros nuevos exigen entre ocho y 256 caracteres. La administración asigna licencias mediante un GBA ID como @Santiago; sólo el propietario puede resolver ese destino y emitir códigos.

El cliente usa getRandomValues y AbortController con un temporizador cancelable, sin depender de randomUUID ni AbortSignal.timeout en versiones anteriores de WebKit. [MDN documenta la compatibilidad de AbortSignal.timeout](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static).

GET /api/gba-id-health comprueba la conexión administrativa desde el servidor y devuelve únicamente verified o unavailable. No entrega claves ni datos de cuentas. Sus pruebas verifican que no se reflejan errores privados del proveedor y que una consulta repetida usa el resultado durante 30 segundos. La respuesta de prueba local no acredita la clave guardada en Vercel; se requiere comprobar el despliegue preparado.

La revisión más reciente pasó 107 comprobaciones Workspace y 78 gateway/cliente, junto a las compilaciones web y desktop. Las últimas compilaciones nativas anteriores (commit e9ba11b106d7e379ec06d740f30ab726c915836d, ejecución 38006806534) pasaron en las tres arquitecturas, pero preceden estos ajustes del cliente. Deben regenerarse candidatos del código final antes de su aceptación y publicación.
