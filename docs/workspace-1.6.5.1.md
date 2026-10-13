# Workspace 1.6.5.1 Ópalo

Corrección de Documentos: se elimina la categoría de filtros, formulario y etiquetas. La biblioteca se filtra por área y conserva búsqueda, referencias de la edición y documentos aceptados. El formulario de referencia empieza arriba de su panel; su ancho y el selector se mantienen dentro de la columna.

La integración con Codex incorpora `workspace_document` y `workspace_prepare_edit_document`. Puede preparar cambios en referencias autorizadas, documentos de apoyo propios y borradores privados; conserva revisión, autoría, créditos, paleta y originales no modificados. Las sustituciones de texto conservan el formato y las imágenes, y requieren el número esperado de coincidencias. Guardar se realiza mediante el lote solicitado y las funciones existentes del servidor; una revisión concurrente se rechaza. Las versiones aceptadas no se sobrescriben y no se envía a revisión desde estas herramientas.

No requiere migración ni cambios de rangos. Se conserva la base de descarga 1.5.0. Versión visible 1.6.5.1; versión nativa 1.6.501.

Comprobación: flujo visual de crear referencia en escritorio; pruebas de preservación de formato y originales, alcance de lectura/edición, conflictos, preparación sin escrituras, ejecución e idempotencia, y protocolo MCP.
