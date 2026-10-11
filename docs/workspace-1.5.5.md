# Workspace 1.5.5 · Prisma

La descarga base de GBA permanece en **1.5.0**. La web de trabajo y el canal de actualizaciones manuales avanzan a **1.5.5** (versión nativa `1.5.500`). Los instaladores publicados por versión son inmutables. El publicador deja el manifiesto base intacto; cambiarlo requiere una decisión explícita sobre una nueva base.

## Notificaciones

Campana junto a la cuenta, con avisos sin leer, acceso al elemento y marcado individual o conjunto. La consulta se actualiza cada 45 segundos mientras Workspace está visible y al volver a la ventana. No solicita permisos del sistema ni envía correos. Los avisos aparecen a partir de nuevas acciones; los recordatorios se calculan al consultar el buzón.

| Función vigente | Avisos de trabajo |
| --- | --- |
| Investigación, Redacción y Arte | Asignaciones propias, cambios de fecha, correcciones, conversación, bloqueos y vencimientos |
| Responsable de área | Entregas para revisión dentro de su área y seguimiento que le permite la matriz |
| Producción y Coordinación | Asignaciones, fechas, bloqueos y seguimiento operativo según el permiso y alcance actuales |
| Dirección de producto | Solamente acciones cubiertas por su asignación y delegación vigente |
| Archivos y QA | Cola de QA, incidencias y autorización de salida si tiene asignación de publicación |
| Dirección | Revisiones y aprobación final; no recibe solicitudes de aprobar su propia autoría |
| Consulta | Referencias y documentos compartidos explícitamente |
| Administración técnica GBA | No recibe autoridad ni contenido editorial por su rango técnico |

El servidor decide destinatarios y vuelve a verificar sesión, membresía, rango, alcance, asignación y vigencia al consultar o abrir cada aviso. No hay acceso directo a la tabla privada ni se pueden marcar avisos de otro usuario. Cambiar un vencimiento invalida su recordatorio anterior. Retirar una edición oculta sus avisos.

## Concepto anterior

El concepto guardado como descripción breve muestra **Editar concepto** a Dirección o a un mandato creativo vigente. Guardar crea una referencia de texto con formato. La descripción anterior se conserva como versión cero del historial y no se altera el campo original. Las referencias posteriores conservan el botón de edición y sus versiones. Las entregas aceptadas del equipo siguen siendo versiones inmutables: para corregirlas se reabre el trabajo y se presenta otra versión.

## Eliminar y restaurar ediciones

En Configuración → Administrar ediciones, quien tenga `project.archive` puede eliminar de forma reversible. Dirección lo posee por unidad; Producción necesita delegación expresa. No concede ese permiso un rango general de GBA.

Se advierte que el equipo dejará de ver la edición, se exige su nombre exacto y un motivo, y se comprueba la revisión actual en el servidor. **Ediciones eliminadas** permite restaurar el estado anterior. Se conservan archivos, referencias, historial, originales, membresías y auditoría. Los originales siguen contando en el límite de R2. La eliminación no retira publicaciones de VISTA. Los permisos se reevalúan al restaurar; una delegación vencida no recupera vigencia.

## Nivel de uso

Adecuado para comenzar una edición real con un equipo supervisado: asignaciones, borradores, revisión, documentos aceptados, referencias y calendario. Las pruebas de permisos y flujos cubren esos escenarios; no existe una medición de capacidad que permita prometer un número máximo de personas o uso masivo.

Pendiente: observar el uso real para 1.5.6, probar la actualización interactiva en un Windows real, medir concurrencia y carga, y ensayar recuperación integral de datos y originales. La edición sin conexión y la escritura simultánea del mismo documento no están implementadas. macOS permanece sin notarización de Apple y Windows sin firma Authenticode; el actualizador sí verifica la firma de los paquetes.

## Verificación

Pruebas locales de permisos y API directa, aislamiento del buzón, etapas de revisión/QA/aprobación, recordatorios, importación con historial y eliminación/restauración. Aceptación transaccional en Supabase con rollback: borradores, identidad, referencias/originales y las nuevas funciones. Se comprueba la conservación de credenciales y Keynotes. Las comprobaciones de originales reutilizan la prueba real PNG/PDF de 1.5.0 porque la pasarela, sus límites y los bytes no cambian en 1.5.5.

La fuente de autoridad es [la matriz RBAC](workspace-rbac-source.md). La 1.5.6 queda fuera de esta publicación.
