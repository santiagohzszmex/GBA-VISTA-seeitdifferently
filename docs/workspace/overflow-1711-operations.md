# Workspace 1.7.1.1 Lapislázuli · corrección de desbordamientos

Fuente nativa: `6666cfa71b7af35cb22bafcb79cdba0640cfba05`. Versión nativa `1.7.101`.
CI correcta: https://github.com/santiagohzszmex/GBA-VISTA-seeitdifferently/actions/runs/39091337130 . Instalación y arranque verificados en ambos corredores macOS; el candidato Windows no se publica.

Las tarjetas de Asignaciones y Mi trabajo crecen con los títulos completos, fechas y estados largos. Los hijos de flex/grid caben en su columna, el plazo ocupa una fila disponible y el texto puede saltar de línea. Se ajustan también etiquetas, metadatos y paneles de fecha relacionados. No se oculta el problema recortando su contenido.

Comprobación de las vistas reales renderizadas con datos sintéticos: títulos largos, cadenas sin espacios y «Con menos de 1 día de retraso»; tarjetas de 248/316 px con scrollWidth igual al ancho y scrollHeight igual a la altura, más revisión visual a 720 px. Captura local de Mi trabajo y del aviso real del actualizador en Workspace-1.7.1.1 fuera del repositorio. No se crearon registros de prueba en producción.

Web publicada: `dpl_57P6RheuPj7ucgsEhV5qAEfSoAjn`, https://gba.software/workspace/web/ . Código exacto confirmado; CSS público, GBA ID y base 1.5.0 verificados. El CLI devolvió Not authorized; se usó el conector Vercel ya autorizado del mismo equipo/proyecto, sin ampliar permisos ni pedir nuevas credenciales.

macOS publicado: https://github.com/santiagohzszmex/GBA-VISTA-seeitdifferently/releases/tag/workspace-v1.7.1.1-beta.1 . Firmas e integridad de candidatos y bytes públicos verificadas. latest-darwin.json ofrece 1.7.101; latest.json (puente) y latest-windows.json se conservaron byte por byte. La app real instalada 1.7.1 mostró Workspace 1.7.1.1 y Descargar actualización. No se descargó ni instaló la actualización en el equipo del usuario.

No hay migraciones, cambios de servidor, roles, RLS, documentos ni almacenamiento. La aceptación de producción se hereda de 1.7.1 sólo tras verificar identidad de sus fuentes protegidas; no se simulan comprobaciones nuevas. Los límites de imágenes y pendientes humanos de Lapislázuli permanecen.

Base pública 1.5.0 intacta. Desde Cuarzo, actualizar primero al puente 1.6.6.3; después se ofrece directamente esta corrección. Apple Silicon e Intel se publicaron juntos; el usuario instala manualmente. Beta sin notarización de Apple.

Reversión web: promover el despliegue anterior `dpl_DtYAuQsKpjjgwgJcwp7jRYqTyDCD` en el mismo proyecto/equipo. No requiere revertir la base de datos. Si hubiera un problema con un binario ya instalado, sacar una corrección con versión mayor; no ofrecer degradaciones mediante el feed. Los manifiestos previos se conservaron en /private/tmp/workspace-1711-private/feed-before y en la copia local Workspace-1.7.1.1.
