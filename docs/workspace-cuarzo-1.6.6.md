# Workspace 1.6.6 · Cuarzo — documentos y bandeja

Estado: publicación 1.6.6 Cuarzo autorizada; migración aplicada, instaladores y despliegue en preparación. Versión nativa 1.6.600. La base de descarga 1.5.0 no cambia. Trabajo en `codex/workspace-1-6-6-cuarzo`.

## Uso

Mi trabajo muestra siempre **Nuevo documento**, junto a Nueva entrega cuando corresponde. Tiene tres vistas: Entregas, Documentos y Bandeja de entrada. «No tienes entregas pendientes» se refiere sólo a las asignaciones; la misma pantalla permite comenzar un documento.

Un documento empieza privado, sin fecha, revisor ni encargo. Se puede escribir, guardar, recuperar una copia local y enviarlo a personas de GIMG. Investigación se suma a los tipos existentes. Compartir con área, vincular y convertir en entrega siguen siendo acciones separadas.

Enviar abre un selector con búsqueda y selección de integrantes activos de todas las ediciones de GIMG. La bandeja distingue recibidos y enviados, conserva leído/sin leer y muestra copias completas con formato, créditos e imágenes/PDF. No contiene conversación ni genera una solicitud de revisión. Hasta 50 destinatarios por envío; los documentos anteriores se consultan por páginas de 200.

La persona recibe la revisión enviada. Los cambios posteriores en el documento privado del autor no alteran esa copia. Una revisión nueva se puede enviar expresamente; reenviar la misma a la misma persona no duplica el documento ni el aviso.

## Permisos

- Se mantiene la matriz RBAC y la separación de roles GBA/GIMG. No se crean cargos ni asignaciones automáticas.
- Sólo el autor con permiso vigente de creación/edición puede enviar su documento.
- Destinatarios: integrantes de GIMG con lectura o función vigente en una edición autorizada, según permisos y asignaciones. Se excluyen personas sin acceso operativo, reserva, ajenas a la unidad, suspendidas o con acceso vencido.
- El envío es una compartición individual autorizada por el autor: da lectura a esa copia y sus originales capturados. No abre la edición de origen, tareas, otros documentos ni el documento privado vivo.
- La copia es de lectura. Nunca cambia las versiones enviadas, aceptadas o publicadas.
- Los originales posteriores y otros originales del contenedor no quedan compartidos. Se conserva el permiso de descarga del autor al enviar; un original de sólo consulta no adquiere descarga por el envío.
- Lectura, notificaciones y originales vuelven a comprobar acceso vigente. Una sesión revocada, suspensión o pérdida de asignación impide la lectura.

En documentos privados, @ ofrece posibles destinatarios de GIMG; **escribir @ no envía ni comparte**. El aviso llega al enviar explícitamente a la persona. En documentos compartidos/referencias se mantienen candidatos con acceso al contenido. Una mención no concede lectura por sí sola.

## Correcciones del editor

Escape usa editor.view. La lista toma coordenadas del cursor, espera una posición válida, elige arriba/abajo y sigue scroll, resize y visualViewport. Se oculta/cierra si el cursor deja la región visible; ResizeObserver adapta la colocación al tamaño de la lista. No se restaura el botón + retirado.

Los avisos de apoyo y de envío incluyen navegación al ancla de la mención. El filtro Menciones incluye envíos que contienen una mención al destinatario.

Documentos utiliza autoguardado tras 5 segundos y copia local a los 300 ms, aislada por cuenta/documento y con la misma caducidad de 24 horas de las entregas. Guarda con revisión esperada, conserva texto escrito durante una petición y evita recrear el editor al guardar. Una recuperación desde otra revisión espera guardado manual explícito. Las confirmaciones aparecen en el aviso lateral inferior existente. El formulario de creación se limpia tras éxito.

## Cambios de datos

Migración preparada por el CLI: `20261014013712_workspace_cuarzo_documents.sql`.

Añade tabla privada document_deliveries, snapshots, destinatarios, revisiones, originales permitidos, índices, notificaciones.delivery_id y el tipo research. RLS habilitada; sin lectura directa para anon/authenticated. Las RPC exigen sesión y permisos vigentes. No elimina documentos, columnas, categorías ni originales; no cambia JSON/Markdown/schemaVersion 2.

El conector conserva sus nombres de herramientas para compatibilidad y admite el tipo Investigación en sus importaciones. La migración ya se aplicó en producción con autorización expresa.

## Validación y publicación

Se comprueban en Postgres local aislado: creación independiente, Dirección/área/colaborador/QA/Consulta, candidatos entre ediciones, privados, copias inmutables, originales, permisos de descarga, exclusión de archivos posteriores, reenvíos, revisiones obsoletas, anclas, paginación, suspensión, expiración y sesiones revocadas. También cálculo de colocación en bordes y ventanas pequeñas, y recuperación aislada/caducada. El editor y la aplicación compilan con Vite.

Estas comprobaciones no sustituyen una prueba final en web y escritorio con la migración instalada. No se enviaron documentos ni avisos a colaboradores reales durante la implementación. No se anuncia como publicado.

Resultado final: **577 comprobaciones de Workspace aprobadas**, incluidas **60 de la bandeja de Cuarzo**; pruebas de colocación/recuperación aprobadas y compilación de Workspace correcta. Sin cambios en autenticación GBA ID, licencias, límites R2 o manifiestos de la base pública.

La publicación fue autorizada expresamente. El usuario rechazó crear registros de prueba en producción, incluso dentro de rollback. La aceptación usa sólo consultas de lectura: comparación exacta de 22 funciones, columnas, restricciones y 230 permisos RBAC con el esquema exportado por las 577 comprobaciones locales en CI; seis rechazos de acceso en una transacción READ ONLY y conservación del recuento de referencias. No se afirma haber realizado envíos positivos de prueba en producción. Los instaladores se instalan y abren en los tres corredores nativos; sus bytes y firmas se comprueban antes de promover el actualizador. La base pública 1.5.0 permanece intacta.

Reversión conservadora: volver al código anterior y revocar ejecución de las nuevas RPC; conservar document_deliveries y sus datos. Las filas antiguas y el esquema previo permanecen. No purgar originales ni usar DROP/CASCADE. Antes de revertir wrappers de notificaciones/originales, decidir si se conservan o retiran las comparticiones explícitas existentes; no restaurar funciones a ciegas con entregas ya creadas.

Fuera de esta entrega: papelera/restauración de 14 días y purga física, nuevo diseño completo del editor pendiente de Claude, e ilustración/maquetación de 1.7.0 Lapislázuli.
