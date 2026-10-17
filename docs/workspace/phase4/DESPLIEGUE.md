# Propuesta de producción · NO EJECUTADA

**Bloqueada por CPU Free y por las comprobaciones pendientes de dispositivos/muestras.** Este documento no autoriza aplicar DDL, desplegar ni activar imágenes. La base pública 1.5.0 y las actualizaciones operativas de Cuarzo no cambian.

## Condiciones previas

Resolver E, recibir muestras reales, ejecutar Windows y medir memoria total. Implementar y revisar una lista de ediciones permitidas en `upload_policy`, inicialmente vacía. La autorización de escritura debe exigir simultáneamente bandera global, edición permitida, asignación `kind=image`, membresía/sesión vigentes, permiso RBAC y estado editable. Aplicarlo a ficha/creación, RPC y subida/pasarela, nunca sólo al selector visual. Las lecturas retenidas deben permanecer independientes de esa lista.

Elegir UUID real de Día de Muertos, persona, revisor y **nueva** asignación. No cambiar el tipo de entregas que ya tienen versiones. Ese mecanismo agrega una lista pequeña y un evaluador común; **no está implementado ni activado en Fase 4**. Debe pasar denegación de otras ediciones, cambios de membresía y reanudaciones con política modificada antes de solicitar autorización final.

## Respaldo y orden

Antes de la ventana, guardar commit y despliegue vigentes, inventario de migraciones/funciones/ACL, políticas, banderas, cantidades de documentos/versiones y objeto/huella de los originales. Generar un respaldo cifrado con una conexión de respaldo autorizada que incluya los esquemas privados y los datos necesarios; no asumir que el plan gratuito incluye recuperación automática. No imprimir URI, contraseñas ni el dump. Ensayar su restauración en un entorno aislado. Los archivos R2 no están contenidos en el dump SQL: inventariarlos y comprobar su conservación por separado.

Aplicar en este orden, con imágenes y derivados desactivados, transacción por migración y comprobación después de cada paso:

1. `20261016113804_workspace_lapis_coordination_scope.sql`
2. `20261016113805_workspace_lapis_upload_policy.sql`
3. `20261016113806_workspace_lapis_image_data.sql`
4. `20261016194802_workspace_lapis_multipart_gateway.sql`
5. `20261016203609_workspace_lapis_image_interface.sql`
6. `20261017021526_workspace_lapis_retained_read.sql`
7. Migración futura de lista permitida, aún por desarrollar y revisar.

Las primeras cinco tardaron aproximadamente **37,6 s sumadas por MCP** en la copia, con 21,1 s en datos. No son una promesa de duración ni bloqueo en producción. Reservar provisionalmente una ventana de 15 minutos para respaldo, DDL, comprobaciones y decisión, recalculándola con tamaño/carga reales; definir `lock_timeout` y `statement_timeout` tras revisar cada migración, sin cambiar silenciosamente su comportamiento. Ante error o bloqueo, detenerse: no continuar con una aplicación parcial desconocida.

Comprobar owner/search_path de SECURITY DEFINER, permisos anon/authenticated, RLS de tablas privadas, validación de sesión, cantidades previas y funcionamiento del flujo de documentos/Keynotes/licencias. No sembrar cuentas ni documentos ficticios en producción. Comprobar mediante lecturas y participantes del piloto autorizados.

Desplegar la pasarela con descargas, limpieza y cron completos, conservando el bucket privado y secretos en servidor. Publicar el cliente compatible sólo tras aprobación separada; no cambiar la descarga base 1.5.0. Mantener banderas apagadas hasta concluir comprobaciones y autorizar la activación de la única edición.

## Funcionamiento del piloto y observación

Activar exclusivamente Día de Muertos y las asignaciones nuevas seleccionadas. Una prueba con una persona que entrega, su revisor de área y Santiago. QA conserva su posición antes de Dirección; no se salta ni se añade una aprobación ajena a la matriz.

Registrar estado HTTP, código de error, fase de subida, bytes, CPU/duración e id de correlación técnico con acceso restringido. No registrar nombres/contenido de originales, EXIF/GPS, cuerpos de documentos, claves de objetos ni tokens firmados. Consultar cuota de cuenta y aplicación; alertas de cuota, fallos/reintentos y `exceededCpu` deben verse en el panel privado del operador. No se configuró un envío externo de mensajes ni nuevas notificaciones a colaboradores en esta fase. Santiago revisa una lista corta de entregas del piloto, su versión, etapa, avisos y bloqueos; la revisión conserva el flujo actual.

Si falla imagen, crear una **asignación paralela de documento** usando la vía anterior, enlazar los materiales conservados y mantener la entrega de imagen para consulta. No convertir un `kind=image` con versiones, sobrescribir originales ni vaciar una entrega aceptada. Detener el piloto ante pérdida de acceso, corrupción de integridad, bloqueos ajenos a la edición o CPU sostenida fuera del presupuesto.

## Desactivar y revertir

Primero quitar la edición de la lista permitida y apagar `images_enabled`/derivados si hace falta parar todo el flujo. Nuevas subidas/envíos se rechazan con mensaje; borradores, originales, capas y versiones se conservan y son legibles para quienes mantienen acceso. Suspensión de membresía y revocación de sesión siguen negando enlaces, aun con bytes en caché. Las sesiones incompletas permanecen reservadas hasta cancelación o expiración/limpieza confirmada; no liberar cuota por mera intención.

Usar los scripts no destructivos de `../rollbacks/`: interfaz → gateway → imágenes → política. Conservar las RPC de lectura corregidas, RLS, versiones, originales y el Worker con handlers de descarga/limpieza y cron. No ejecutar DROP ni restaurar una base antigua encima de documentos nuevos. El rollback de coordinación devuelve lectura amplia U: **amplía acceso**, requiere decisión explícita y se prefiere corregir asignaciones faltantes.

Ensayo realizado sólo en la copia: cinco pasos en una transacción, conteos conservados y lectura autorizada, seguido de rollback. En producción serían decisiones persistentes distintas, con respaldo y autorización propios. Para reactivar: comprobar versión/ACL, resolver causa, restituir permisos deliberadamente y habilitar sólo el piloto; nunca encender una bandera global sin lista.
