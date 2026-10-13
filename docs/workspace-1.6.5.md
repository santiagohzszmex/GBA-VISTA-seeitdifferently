# Workspace 1.6.5 Ópalo · Mi trabajo y equipo

Estado: implementación y candidatos locales; migración de producción pendiente de autorización. La revisión automática rechazó aplicar `workspace_support_and_team` por su alcance sobre tablas, funciones y permisos. No se modifica el feed de actualización hasta aplicarla y comprobarla. La base pública de descarga 1.5.0 se conserva.

## Uso

- **Mi trabajo → Entregas:** encargos asignados, borradores y revisión existentes.
- **Mi trabajo → Documentos de apoyo:** entrevistas, notas, fuentes, transcripciones y documentos de preparación. Crear y guardar no genera una entrega ni avisa a revisores.
- **Equipo:** integrantes activos dentro del alcance autorizado, documentos expresamente compartidos, referencias y asignaciones que ya permite el servidor. Los borradores ajenos permanecen privados.
- **Documentos:** categorías y filtros por área. Las categorías son metadatos y no conceden permisos. Fotografía se detecta por asignaciones vigentes, aunque comparta un área técnica con Investigación.

Un documento de apoyo comienza privado y sólo su autor puede editarlo. Compartir con el área habilita lectura para integrantes con alcance vigente. Retirar ese acceso oculta el documento vivo y sus avisos. Vincularlo a una asignación crea una copia congelada de contenido y originales: futuras ediciones o retirada de acceso del original no alteran esa copia. Convertir en entrega conserva el documento de apoyo, crea un encargo propio con borrador y copia de sus materiales; la revisión sólo comienza al enviar expresamente.

El historial de preparación queda reservado al autor. Se conserva la autoría, y las versiones aceptadas siguen siendo inmutables. Suspensión, revocación y expiración se comprueban en servidor. Dirección técnica de GBA y autoridad editorial de GIMG siguen separadas según la matriz aprobada.

PDF e imágenes mantienen sus originales en R2, sin compresión, con límite de 25 MB por archivo, 40 originales por documento y cuota global de 10 GB. Texto, paletas, tipografías y menciones utilizan el editor existente. Las menciones privadas no avisan; las de documentos compartidos sólo alcanzan destinatarios autorizados. Pantalla dividida permite consultar referencias durante la preparación.

## Codex

El MCP añade `workspace_support_documents`, `workspace_team` y `workspace_prepare_support_documents`: prepara TXT/Markdown de una carpeta indicada como documentos privados. La ejecución de un lote requiere la petición del usuario, respeta el GBA ID conectado y no envía a revisión. La credencial existente y su expiración se conservan.

## Validación

Pruebas locales de permisos, compartir/retirar, versiones congeladas, conversión, originales y categorías; flujo de navegador para crear una entrevista vacía y guardarla en privado; compilación web y candidato nativo. Los resultados locales no sustituyen las comprobaciones pendientes en Supabase y R2 de producción.

La versión visible es 1.6.5 y la versión nativa compatible con el actualizador es 1.6.500. No se publican paquetes ni se actualiza el feed antes de completar la aceptación de servidor.
