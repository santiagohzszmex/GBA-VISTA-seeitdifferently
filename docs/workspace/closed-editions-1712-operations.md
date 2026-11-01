# Workspace 1.7.1.2 · Ediciones cerradas

## Comportamiento

Ediciones contiene sólo las planeadas y activas. Cerradas agrupa las cerradas y archivadas que cada GBA ID puede consultar. No añade accesos: conserva el RBAC y las restricciones existentes de documentos privados, versiones, originales y notas. Los borradores propios quedan disponibles para consulta. La bandeja permite consultar los envíos existentes.

Cerrar bloquea escrituras editoriales en su límite real de base de datos: entregas, borradores, versiones, comentarios, referencias, documentos, vínculos, notas de imágenes, calendario y nuevas reservas de originales. Las operaciones que ya tienen una lectura compartida de la edición terminan antes de que cierre; las posteriores se rechazan. No modifica los recibos de lectura, notificaciones, auditoría o limpieza de almacenamiento. El concepto breve heredado, título y fechas requieren reabrir antes de editarlos.

Configuración conserva los permisos actuales de administración: una persona con `project.update` puede reabrir; la edición vuelve a Ediciones. No se cierran ediciones por esta publicación, no se revocan integrantes o licencias y no se despublican contenidos de VISTA.

## Producción y pruebas

Web READY: `dpl_4u2f4NWDk5mWdhRdn5fa6zT4aJbo`, fuente `fadbb692b3bf21aa8378e8cbe19ef24932811500`. Bundle público con la nueva navegación confirmado. Las siguientes correcciones del mismo encargo sólo afectan la validación nativa y el bloqueo SQL adicional, sin cambios de interfaz.

Migraciones aplicadas en `wgihpztgwsovhykboyru`:

- `20261101183053_workspace_closed_editions.sql`.
- `20261101184906_workspace_closed_project_content.sql`.

Verificación de producción sin registros de prueba: 32 disparadores editoriales y un disparador del concepto; auxiliares privados sin ejecución para anon/authenticated; bloqueo de una edición ya cerrada confirmado sin escrituras. Dos ediciones cerradas antes y después. Ningún aviso de seguridad nuevo. Política de imágenes y pasarela R2 sin cambios; versión activa del Worker `937db032-73c4-43e2-87d7-4d218618cddc`.

Pruebas locales: 873 aserciones de Workspace, incluidas 70 de cierre (25 límites de escritura con datos disponibles, rechazo de cambios, retención de originales/versiones, exclusión de otra edición y reapertura autorizada). Prueba de interfaz con los componentes reales: separación de pestañas, permisos de lectura conservados y ausencia de controles de edición. Consulta visual del flujo local y compilaciones web/escritorio correctas. Las comprobaciones de escritorio, sesión y convocatoria pasaron; CI repite las exigidas por el workflow.

El normalizador de aceptación de identidad reconoce las dos expresiones de marca revisadas. Todo el código restante de sesión sigue comparándose byte por byte con su base; no se cambió la autenticación.

## Distribución y reversión

Fuente nativa: `05f46e1e59332a71b346e0e59d141901bdeafa5a`, versión nativa `1.7.102`. La aceptación distingue las comprobaciones históricas heredadas de 1.7.1.1 de la evidencia nueva del cierre. No se simularon pruebas con documentos de usuarios.

La base pública 1.5.0, el feed puente y el feed de Windows se conservan. macOS mantiene actualización manual, sin instalación automática; Windows espera su prueba interactiva de Lapislázuli.

Reversión SQL revisable en `rollbacks/1.7.1.2-closed-editions.sql`, a aplicar como migración nueva si se necesitara. No borra contenido ni cambia estados. Reversión de interfaz: promover el despliegue anterior `dpl_2dzHGJF7wr4y7fUrjsBnKeuJUCvA`. Para binarios ya instalados se emitiría una corrección mayor, sin ofrecer degradaciones.

El corredor Apple Silicon pasó de macOS 14 a macOS 15 por la retirada y las interrupciones programadas oficiales de GitHub: https://github.com/actions/runner-images/issues/13518 . No se cambió el mínimo de macOS soportado por la app ni se contrataron corredores.


## Publicación completada

CI correcta: https://github.com/santiagohzszmex/GBA-VISTA-seeitdifferently/actions/runs/41339032209 . Validación, compilaciones, instalación y arranque en Apple Silicon e Intel correctos. También compiló el candidato Windows, que no se publicó.

macOS publicado: https://github.com/santiagohzszmex/GBA-VISTA-seeitdifferently/releases/tag/workspace-v1.7.1.2-beta.1 . Los instaladores y archivos del actualizador se compararon con los bytes aceptados de CI; las firmas fueron comprobadas por el verificador del cliente. El feed `latest-darwin.json` ofrece `1.7.102` (visible como 1.7.1.2) para ambas arquitecturas. Los feeds puente y Windows se conservaron byte por byte; la base 1.5.0 no cambió. No se instaló nada en la Mac del usuario.
