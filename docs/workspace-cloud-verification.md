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
