# Workspace 1.6.0 · Ópalo

Escribe y consulta los materiales del equipo sin perder tu lugar.

- Formato junto a la selección, herramientas que puedes fijar, índice, búsqueda y reemplazo.
- Títulos, listas, resaltado, tipografías, colores HEX y de la edición, interlineado, alineación, enlaces y tablas sencillas.
- Imágenes originales dentro del texto, con pie y crédito, conservando el archivo sin compresión y los límites de R2.
- Guardado automático de borradores privados, recuperación local y control de cambios simultáneos. Enviar a revisión continúa siendo una acción explícita.
- Menciones con @ en documentos, referencias, indicaciones y conversación. La bandeja Menciones abre la copia del documento en el momento del aviso.
- Materiales específicos para cada asignación: referencias de la edición, investigaciones aceptadas y PDF o imágenes privados del encargo. Cada material conserva su versión hasta que el responsable elija actualizarlo.

Los destinatarios y materiales respetan la matriz RBAC vigente. Una mención no concede permisos. Los borradores privados no envían notificaciones.

La descarga base publicada en GBA permanece en 1.5.0. Ópalo se distribuye por el canal de actualizaciones manuales. Continúa siendo beta: macOS sin notarización de Apple y Windows sin firma Authenticode.

## Persistencia y permisos

El editor escribe documentos estructurados de esquema 2 y conserva una representación Markdown para clientes de lectura anteriores. Los clientes anteriores no pueden editar ni reemplazar contenido del nuevo esquema. Las versiones enviadas y las copias de menciones son inmutables; los materiales vinculados usan una revisión congelada y validan el acceso de cada persona asignada. Las imágenes se autorizan por archivo compartido, sin abrir los archivos vecinos del borrador.

La migración no crea integrantes, concesiones editoriales, cuentas ni mensajes de prueba. Las pruebas de roles y ciclo editorial se ejecutan en Postgres local aislado.
