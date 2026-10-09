# Convocatoria GIMG · octubre 2026

## Rutas y aislamiento

Página pública: https://gba.software/convocatoria/gimg/
Panel privado: https://gba.software/convocatoria/gimg/gestion/

Entrada Vite independiente: `convocatoria/index.html`. No importa App, sidebar ni autenticación visual de VISTA. Los metadatos, imágenes sociales, condiciones, recuperación y enlaces públicos pertenecen a GBA/GIMG. Las reglas de Vercel aplican únicamente a gba.software y www.gba.software. Mothership integra el mismo panel en su pestaña Convocatoria GIMG. El panel independiente sigue disponible y no enlaza de vuelta a VISTA. Los estilos compartidos están delimitados a rg-root/rg-review-host; los estilos globales exclusivos de la página pública se cargan solo en su entrada.

Convocatoria dirigida al Plantel Nezahualcóyotl de la Escuela Preparatoria de la UAEMéx. Apertura: 8 octubre 2026 00:00 Ciudad de México. Cierre exclusivo: 19 octubre 2026 00:00 (recibe hasta finalizar el 18). El servidor impone fechas, aunque el cliente tenga otro reloj.

## Identidad y datos

GBA ID usa Supabase Auth. Las cuentas nuevas usan su nombre y el PIN de 4 dígitos de GBA ID, con la misma representación técnica GBA-PIN-SecureVault y dirección interna @gba.com. El nombre se conserva legible y los acentos/espacios se normalizan solo para la dirección interna, sin exigir correo de contacto para autenticarse. Su perfil empieza privado. La recuperación usa un secreto aleatorio de 192 bits: solo su SHA-256 se guarda en un esquema privado; el código se presenta una vez y puede descargarse. La recuperación verifica el secreto, limita intentos por nombre/IP, actualiza únicamente esa cuenta y revoca sesiones previas. No hay un RPC capaz de elegir libremente una cuenta a recuperar.

Las cuentas anteriores conservan el acceso mediante su GBA ID y PIN. Esta interfaz solo recupera cuentas nuevas de la convocatoria. La configuración de producción se verificó: registro habilitado y mailer_autoconfirm=true. Se conserva la configuración global actual.

El cuestionario permite elegir correo o teléfono como contacto privado para coordinar si la persona es seleccionada. Se almacena en una tabla separada, con exactamente un medio por postulación. Para México se normalizan 10 dígitos a +52; otros países incluyen + y código de país. No aparece en CSV ni en respuestas públicas. Por instrucción de Santiago, el equipo autorizado puede verlo al recibir la postulación enviada, tanto en Mothership como en el panel independiente; no ve contactos de borradores ajenos. Los resultados se consultan en GBA ID.

Borradores guardados automáticamente en Supabase, por cuenta, con revisiones para evitar sobrescribir otra pestaña. No se guardan respuestas ni contacto en localStorage. El SDK conserva la sesión de autenticación. Tras enviar, las respuestas quedan congeladas. Solo la persona y el equipo autorizado ven postulaciones. Las notas y puntuaciones son internas.

Muestras opcionales PDF/PNG/JPG/WEBP hasta 10 MB en bucket privado `gimg-recruitment`, ruta por UUID/ciclo. Lecturas con permisos y URL firmada de 60 segundos. No publicar el bucket.

## Revisión y resultados

Panel con conteos y distribución por área, filtros, CSV protegido frente a fórmulas, evaluación humana y notas internas. Actualiza por Realtime y cada 30 segundos. Dirección publica un resultado; guardar notas posteriores no cambia la copia que ve la persona hasta publicarla otra vez. Hasta 16 selecciones y 5 reservas publicadas; objetivo normal 15 colaboradores. Los permisos de Dirección/evaluador se gestionan por GBA ID sin cambiar roles globales. Dirección y evaluación requieren una asignación explícita en GIMG. Dueño/Admin generales no heredan estos permisos. La corrección se aplica en la migración gimg_role_isolation.

El botón de contacto prepara un borrador en el cliente de correo del coordinador usando el resultado publicado. El humano elige su cuenta @gba.software y lo envía. No se envían emails automáticos, no hay proveedor SMTP nuevo ni promesa de entrega integrada. La confirmación del puesto se registra para el futuro Workspace, sin conceder acceso prematuramente.

## Base de datos y comprobaciones

Migración creada mediante Supabase CLI y aplicada con la Management API autenticada de Supabase (versión devuelta por producción): `20261009015211_gimg_recruitment.sql`. Transacción única; tablas nuevas con RLS y permisos explícitos. Mutaciones mediante wrappers invoker y funciones privadas definer con search_path fijado. Autorización desde roles protegidos y sesiones vigentes, nunca desde user_metadata. El metadato gimg_candidate solo establece privacidad y presentación al registrar una cuenta.

`npm run test:recruitment` ejecuta pruebas de dominio y PostgreSQL con PGlite: aislamiento, escritura, fechas, revisiones, resultados, contacto y recuperación. El cifrado en fixtures es simulado. En Supabase se verificaron la configuración Auth, la existencia de pgcrypto, los permisos, el bucket privado, las fechas y la denegación HTTP a visitantes anónimos. Con autorización específica de Santiago se ejecutaron 21 comprobaciones reales: registro con nombre y PIN, perfil privado, recuperación, borrador, envío, aislamiento entre cuentas y revocación de sesiones. Las dos cuentas QA y sus postulaciones se eliminaron al terminar. Las pruebas locales incluyen 92 comprobaciones y reproducen la cadena real de triggers. `npm run build`, `npm run test:session` y `npm run test:survey` verifican compilación y regresiones relevantes.

La vista local `convocatoria/index.html?preview=1` existe solo en DEV: permite probar respuestas sin enviarlas ni crear cuentas. Nunca sustituye la comprobación real del backend.

Pendiente para etapas posteriores: Workspace profundo, apps Mac/Windows y entrega automática de correo. Esta convocatoria no promete vínculo institucional, empleo ni certificación.

## Corrección del registro con PIN

Migración `20261009034327_gimg_pin_signup_fix.sql`: los logs mostraron `function es_staff() does not exist`. El UPDATE de privacidad heredaba un search_path que no incluía public, mientras los guards existentes llaman es_staff/auth_rol/usuarios sin calificar. Se añadió el esquema public de confianza únicamente al search_path de private_profile e init_identity. Se verificó que anon/authenticated no tienen CREATE en ese esquema. No se reemplazaron los guards globales, roles ni permisos existentes.

## Contacto y Mothership

Migración `20261009040818_gimg_contact_and_mothership.sql`: agrega teléfono opcional, restricción de un solo medio, validación del servidor y lectura del equipo de selección de contactos de solicitudes enviadas. El RPC anterior de correo sigue funcionando para pestañas abiertas; el formulario nuevo usa gimg_save_application_contact. 108 pruebas locales y 24 comprobaciones reales con dos cuentas QA autorizadas verificaron correo, teléfono, aislamiento y recuperación; ambas cuentas y sus datos se eliminaron. Los ejemplos de vista DEV de Mothership son ficticios y no guardan ni publican resultados.

La revisión de Supabase del 9 de octubre confirmó 1 Dueño, 8 Editor y 118 rangos NULL; la restricción desplegada permite Dueño, Admin, Ciudadano y Editor. No hay Dirección explícita en gimg_recruitment_reviewers. La separación local cubre también vista_approve_editorial_request: crear GIMG conserva el rango personal, incluido NULL. Las editoriales externas mantienen su comportamiento previo. Ninguna consulta de esta revisión modificó producción.

La separación se divide en dos migraciones: 20261009123356_gimg_identity_role_isolation.sql cubre convocatoria, rango general e invitaciones/creación de GIMG en Studio y funciona sobre el esquema actual; 20261009112023_gimg_role_isolation.sql instala las restricciones de alcance del nuevo Workspace. La cuenta autorizada para Dirección explícita es @Santiago, conservando Dueño en GBA. La migración de Workspace inicial incorpora las Direcciones ya asignadas en convocatoria sin heredar rangos globales.

Aplicada en Supabase la migración gimg_identity_role_isolation (versión remota 20261009123356). @Santiago mantiene Dueño y tiene director explícito en gimg_recruitment_reviewers. Comprobados permisos con sesión real activa y rechazo sin sesión; no se cambiaron otros rangos ni Keynotes. Los alcances del nuevo Workspace siguen pendientes con su esquema.
