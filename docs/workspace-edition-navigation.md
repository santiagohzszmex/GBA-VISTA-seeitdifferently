# Workspace GIMG: flujo de trabajo por edición

La aplicación abre **Mi trabajo**, el espacio personal para preparar los documentos asignados. La navegación de una edición distingue Mi trabajo, Asignaciones, Revisión, Documentos y Calendario. Asignaciones y Revisión sólo aparecen cuando hay permisos aplicables. Licencias, integrantes, permisos y administración de ediciones permanecen en Configuración; las Keynotes mantienen su espacio y sus permisos de GBA.

## Recorrido real

1. **El responsable del área asigna trabajo.** En Asignaciones crea un encargo, elige área y persona e indica qué debe realizar y entregar. El servidor comprueba el permiso para esa área. Producción y las personas con delegación válida gestionan fechas según la matriz RBAC.
2. **La persona escribe en Mi trabajo.** Su lista contiene lo asignado a su GBA ID y las colaboraciones. Al abrir una asignación tiene el documento, las indicaciones y los controles de formato. Guardar borrador mantiene una copia privada; no crea una entrega ni la muestra al equipo.
3. **La persona envía una versión.** Enviar a revisión guarda el borrador, crea una versión inmutable y coloca el trabajo en revisión. El texto y su formato quedan vinculados a esa versión. Una entrega vacía se rechaza. El editor queda en consulta mientras se revisa.
4. **El área revisa la entrega.** En Revisión se lee la versión enviada, no el borrador privado. El responsable puede aceptar o devolver indicaciones. Las correcciones regresan a Mi trabajo; al reenviarlas se crea otra versión sin borrar las anteriores. Las rondas adicionales siguen requiriendo la autorización definida en la matriz.
5. **La versión aceptada aparece en Documentos.** La biblioteca reúne referencias de la edición y documentos aceptados por área, utilizables por sus participantes autorizados. El artista puede consultar la investigación aceptada sin acceder al borrador o a otras entregas privadas del investigador.
6. **QA y publicación continúan por separado.** Aceptar una investigación para uso del equipo no equivale a publicarla en VISTA. Se conservan las comprobaciones de QA, aprobación final, delegación y autoría del servidor existente.

## Documentos y borradores

- El concepto de la edición sigue en el brief existente. El editor de trabajo tiene títulos, negrita, cursiva, listas, tipografía, tamaño, color con muestra y código HEX, deshacer y rehacer.
- Las referencias se pueden consultar en un panel sin cerrar el editor. Cambiar de pantalla con modificaciones sin guardar requiere conservarlas o descartarlas explícitamente.
- Los borradores se identifican por trabajo y autor. Dirección puede gestionar el trabajo, pero no obtiene el borrador privado de otra persona. El guardado comprueba revisión y versión base para evitar sobrescrituras entre ventanas.
- Los documentos aceptados se registran como instantáneas de las versiones aprobadas. Reabrir un trabajo conserva la última referencia aceptada hasta que se acepta otra versión. Un bloqueo crítico de QA retira su consulta mientras permanezca activo.
- La lectura de referencias aprobadas utiliza el acceso autorizado a esa edición. La capacidad `reference.read` permite a colaboradores asignados consultar referencias aceptadas del proyecto; un permiso más reducido puede restringir un documento concreto. No modifica `content.read` para borradores o entregas ajenas, ni concede autoridad editorial desde los rangos generales de GBA.
- El documento enriquecido es la fuente del Markdown conservado para compatibilidad. El servidor lo genera; no permite mostrar al revisor un texto y guardar otro distinto como contenido para publicación.
- Los adjuntos externos mantienen el modelo previo de enlaces al repositorio controlado. La carga directa de archivos, imágenes y previsualizaciones privadas queda pendiente de la etapa de almacenamiento; Cloudflare continúa sin configurarse.

## Estado local y revisión

Rama `codex/workspace-edition-layout`, en el repositorio `work/workspace-updates`. Esta revisión sólo se guarda en commits locales. No modifica la copia original de GBA-VISTA, la aplicación instalada, los despliegues ni las descargas públicas.

La migración `20261010135012_workspace_personal_drafts_and_library.sql` está preparada y probada con PostgreSQL local en PGlite. **No se aplicó al proyecto de Supabase.** Antes de desplegar el frontend de trabajo deberá revisarse contra el esquema real y aplicarse coordinadamente.

La vista `http://127.0.0.1:5186/?workspace-preview=1` permite probar el recorrido con un investigador, un responsable de Investigación, un artista y una cuenta con Dirección. Los permisos de plataforma y Keynotes de esa última cuenta se especifican por separado. El selector sólo existe en la demostración de desarrollo; las cuentas y modificaciones son ficticias y se reinician al recargar.

## Validación

- Base local: 157 comprobaciones de Workspace, incluidas privacidad de borradores, permisos por área, rechazo de accesos directos, conflictos entre guardados, entrega vacía, texto canónico, revisión/correcciones, referencias aceptadas, reapertura y suspensión.
- Conservación del gateway de identidad: suite existente de 78 comprobaciones.
- Compatibilidad del editor con Safari 14: ocho comprobaciones ejecutadas retirando los métodos nativos nuevos que requieren las dependencias.
- Compilaciones de la web y del frontend de escritorio. El editor se carga bajo demanda; no se construyeron nuevos instaladores.
- Navegador: recorrido asignación → borrador → entrega → correcciones → nueva versión → aceptación → consulta por el artista; formato conservado y consulta de referencias sin perder texto.

La biblioteca de archivos todavía no sustituye al repositorio externo de originales. Esta fase corrige la separación entre preparación, revisión y consulta, y deja el almacenamiento privado listo para integrarse posteriormente.

## Entrada por función y operaciones de la edición

La entrada inicial se calcula a partir de los permisos devueltos por el servidor y las tareas disponibles; no depende del nombre de Santiago, del rango general de GBA ni de un rol elegido en el cliente.

| Función | Entrada y necesidad principal |
| --- | --- |
| Investigación, Redacción, Ilustración, Diseño y Fotografía | Mi trabajo: encargos propios, indicaciones, borrador privado, conversación, referencias y envío a revisión. |
| Responsable de área | Revisión si hay una entrega por atender; de lo contrario, Asignaciones de su alcance. No obtiene fechas sin delegación. |
| Producción y Coordinación | Asignaciones: búsqueda por título o persona, filtro por área, trabajos abiertos, sin responsable, bloqueados y retrasados; calendario y dependencias. |
| Dirección de producto | Opera únicamente dentro del proyecto y las facultades delegadas. La demostración incluye una delegación escrita simulada, no un permiso implícito. |
| Archivos y QA | Revisión: entregas en QA, créditos, incidencias, bloqueo crítico y verificación de la corrección. La aprobación final sigue separada de la ejecución de publicación. |
| Dirección de GIMG | Revisión: aprobación final, revisión editorial, rondas adicionales y reapertura con motivo. Miembros, permisos y licencias permanecen en Configuración. |
| Consulta | Documentos y calendario accesibles; se ocultan Mi trabajo, Asignaciones y Revisión cuando faltan sus permisos. |
| Administración técnica de GBA | No obtiene proyectos ni autoridad editorial por su rango técnico. |

Cada encargo muestra su siguiente paso con lenguaje adecuado a quien lo consulta. La lista personal pone las correcciones y bloqueos primero. La cola de revisión prioriza bloqueos de QA, aprobación final y entregas en QA; mantiene una vista de todas las entregas para consultar y reabrir versiones anteriores cuando esté autorizado.

Se recuperaron las operaciones existentes del servidor sin crear nuevas atribuciones: comentarios, incidencias, bloqueo operativo, bloqueo y liberación de QA, autorización de otra ronda, reapertura, archivo y dependencias. Permanecen plegadas junto al trabajo. Liberar un bloqueo de QA devuelve el encargo a preparación y exige otro recorrido de revisión. Los borradores con cambios pendientes deben guardarse antes de cambiar su estado. Los comentarios se guardan sin desmontar el editor ni perder el texto sin guardar.

El formulario genérico utiliza campos HTML con nombre y FormData al enviar para conservar los valores reales de fecha, selección y autocompletado. La fecha de un encargo alimenta su evento de entrega; los hitos editoriales pueden modificarse por quienes tienen permiso de calendario. El cliente no decide las autorizaciones: las funciones y RLS existentes siguen verificando alcance, sesión, membresía y delegación.

La matriz JSON de la demostración incorpora `review.queue_qa`, que ya existía en el servidor para Dirección, Producción, dirección delegada de producto y responsables de área. Es una sincronización del permiso existente, no una ampliación de acceso a producción.

Validación local: compilación web y frontend de escritorio, suite de permisos/flujo editorial y regresiones de entrada por función; recorrido en navegador de creación del encargo, fecha en calendario, escritura y comentario sin pérdida del borrador, entrega, aceptación y consulta por Arte. También se recorrió el bloqueo crítico y liberación de QA. Evidencia local en `outputs/workspace-roles` del directorio de esta conversación.

Continúa pendiente el despliegue coordinado de la migración local de borradores y biblioteca, junto con el cliente. No se modificó Supabase remoto, ni se publicó la web, ni se reemplazaron los instaladores. Los archivos externos se entregan mediante enlace HTTPS; la carga directa aún no forma parte de esta versión.
