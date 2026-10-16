# Impacto previo a producción · Coordinación

Consulta de solo lectura en Supabase GBA Workspace, 16 de octubre de 2026. No se modificaron personas, roles, asignaciones ni documentos.

**Resultado:** no hay concesiones del rol técnico `gimg_workspace_coordinator`: cero registros totales y cero vigentes. Por tanto, no hay personas de este rango que pierdan visibilidad hoy ni asignaciones que sea necesario crear antes del ajuste.

| Edición activa | Coordinaciones vigentes | Pérdida prevista por el cambio U → P |
|---|---:|---|
| Día de Muertos | 0 | Ninguna persona actualmente |
| Halloween | 0 | Ninguna persona actualmente |

Se consultaron las concesiones con fechas de inicio/expiración y revocación; sus alcances se cruzaron con las ediciones y las asignaciones vigentes. La comprobación agregada confirmó que el resultado vacío no procedía únicamente de filtrar concesiones expiradas: no existe ninguna concesión de ese rango.

**Cambio visible para futuras altas:** Coordinación solo podrá abrir proyectos, tareas y contenido cuando tenga asignación vigente a esa edición, en vez de lectura de toda GIMG. Expirar esa asignación cerrará ese acceso. Directorio, funciones de otros rangos y autoridad editorial no se amplían. Una misma persona con otro permiso explícito y válido conserva el acceso que corresponda por ese permiso.

**Recomendación:** el ajuste 1a puede aplicarse tal cual tras la revisión de Santiago; no requiere asignaciones preparatorias para personas existentes. Para próximas altas de Coordinación, registrar la asignación al proyecto antes de que empiecen a trabajar.

Este informe **no aplica ni autoriza automáticamente la migración en producción**. Según la instrucción de Fase 2, todas las migraciones permanecen locales y `images_enabled` seguirá desactivado cuando se autorice aplicarlas.

## Capacidad actual

La contabilidad del almacenamiento registra 86.297.569 bytes asignados de un máximo de 10.000.000.000 bytes. No es una lectura independiente del bucket físico.

- Desde vacío caben **38 archivos con capas de 250 MiB**; con lo actualmente asignado, caben **37**, sin sumar PNG ni derivados.
- Contando por entrega un PNG de 18 MiB más capas de 250 MiB, caben **35 entregas** antes de derivados. Con el uso actual, quedarían 78.059.551 bytes tras esas 35 parejas para derivados y otros materiales.
- Cada versión enviada conserva sus archivos: esto cuenta versiones almacenadas, no solo personas o asignaciones.

La Fase 2 mantiene el tope, prepara aviso a Dirección al 80 % y un error claro al agotarse. No crea registros de prueba en producción.
