# Convocatoria GIMG · octubre 2026

## Rutas y aislamiento

Página pública: https://gba.software/convocatoria/gimg/
Panel privado: https://gba.software/convocatoria/gimg/gestion/

Entrada Vite independiente: `convocatoria/index.html`. No importa App, sidebar ni autenticación visual de VISTA. Los metadatos, imágenes sociales, condiciones, recuperación y enlaces públicos pertenecen a GBA/GIMG. Las reglas de Vercel aplican únicamente a gba.software y www.gba.software. Mothership ofrece un acceso al panel; el panel no enlaza de vuelta a VISTA.

Convocatoria dirigida al Plantel Nezahualcóyotl de la Escuela Preparatoria de la UAEMéx. Apertura: 8 octubre 2026 00:00 Ciudad de México. Cierre exclusivo: 19 octubre 2026 00:00 (recibe hasta finalizar el 18). El servidor impone fechas, aunque el cliente tenga otro reloj.

## Identidad y datos

GBA ID usa Supabase Auth. Las cuentas nuevas tienen alias y contraseña de al menos 10 caracteres, con dirección técnica interna @id.gba.software, sin exigir correo de contacto para autenticarse. Su perfil empieza privado. La recuperación usa un secreto aleatorio de 192 bits: solo su SHA-256 se guarda en un esquema privado; el código se presenta una vez y puede descargarse. La recuperación verifica el secreto, limita intentos por alias/IP, actualiza únicamente esa cuenta y revoca sesiones previas. No hay un RPC capaz de elegir libremente una cuenta a recuperar.

Las cuentas anteriores conservan el acceso mediante su GBA ID y PIN. Esta interfaz solo recupera cuentas nuevas de la convocatoria. La configuración de producción se verificó: registro habilitado y mailer_autoconfirm=true. Se conserva la configuración global actual.

El correo sí se solicita dentro del cuestionario, por aclaración de Santiago: es un contacto privado para coordinar si la persona es seleccionada. Se almacena en una tabla separada; no aparece en CSV ni en respuestas públicas y los evaluadores solo lo consultan después de publicar la selección. Los resultados se consultan en GBA ID.

Borradores guardados automáticamente en Supabase, por cuenta, con revisiones para evitar sobrescribir otra pestaña. No se guardan respuestas ni contacto en localStorage. El SDK conserva la sesión de autenticación. Tras enviar, las respuestas quedan congeladas. Solo la persona y el equipo autorizado ven postulaciones. Las notas y puntuaciones son internas.

Muestras opcionales PDF/PNG/JPG/WEBP hasta 10 MB en bucket privado `gimg-recruitment`, ruta por UUID/ciclo. Lecturas con permisos y URL firmada de 60 segundos. No publicar el bucket.

## Revisión y resultados

Panel con conteos y distribución por área, filtros, CSV protegido frente a fórmulas, evaluación humana y notas internas. Actualiza por Realtime y cada 30 segundos. Dirección publica un resultado; guardar notas posteriores no cambia la copia que ve la persona hasta publicarla otra vez. Hasta 16 selecciones y 5 reservas publicadas; objetivo normal 15 colaboradores. Los permisos de Dirección/evaluador se gestionan por GBA ID sin cambiar roles globales. Dueño/Admin existentes tienen Dirección.

El botón de contacto prepara un borrador en el cliente de correo del coordinador usando el resultado publicado. El humano elige su cuenta @gba.software y lo envía. No se envían emails automáticos, no hay proveedor SMTP nuevo ni promesa de entrega integrada. La confirmación del puesto se registra para el futuro Workspace, sin conceder acceso prematuramente.

## Base de datos y comprobaciones

Migración creada mediante Supabase CLI y aplicada con la Management API autenticada de Supabase (versión devuelta por producción): `20261009015211_gimg_recruitment.sql`. Transacción única; tablas nuevas con RLS y permisos explícitos. Mutaciones mediante wrappers invoker y funciones privadas definer con search_path fijado. Autorización desde roles protegidos y sesiones vigentes, nunca desde user_metadata. El metadato gimg_candidate solo establece privacidad y presentación al registrar una cuenta.

`npm run test:recruitment` ejecuta pruebas de dominio y PostgreSQL con PGlite: aislamiento, escritura, fechas, revisiones, resultados, contacto y recuperación. El cifrado en fixtures es simulado. En Supabase se verificaron la configuración Auth, la existencia de pgcrypto, los permisos, el bucket privado, las fechas y la denegación HTTP a visitantes anónimos. La prueba de registro y recuperación real con dos cuentas ficticias queda pendiente de autorización específica; todavía no se ejecutó. `npm run build`, `npm run test:session` y `npm run test:survey` verifican compilación y regresiones relevantes.

La vista local `convocatoria/index.html?preview=1` existe solo en DEV: permite probar respuestas sin enviarlas ni crear cuentas. Nunca sustituye la comprobación real del backend.

Pendiente para etapas posteriores: Workspace profundo, apps Mac/Windows y entrega automática de correo. Esta convocatoria no promete vínculo institucional, empleo ni certificación.
