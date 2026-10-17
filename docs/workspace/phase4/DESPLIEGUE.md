# Propuesta de producción · NO EJECUTADA

**Bloqueada por CPU Free y por las comprobaciones pendientes de dispositivos/muestras.** Este documento no autoriza aplicar DDL, desplegar ni activar imágenes. La base pública 1.5.0 y las actualizaciones operativas de Cuarzo no cambian.

## Condiciones previas

Resolver E, recibir muestras reales, ejecutar Windows y medir memoria total. La lista `upload_policy.image_project_ids` ya está implementada y probada en la rama; en producción debe quedar inicialmente vacía. La autorización de escritura debe exigir simultáneamente bandera global, edición permitida, asignación `kind=image`, membresía/sesión vigentes, permiso RBAC y estado editable. Aplicarlo a ficha/creación, RPC y subida/pasarela, nunca sólo al selector visual. Las lecturas retenidas deben permanecer independientes de esa lista.

Elegir UUID real de Día de Muertos, persona, revisor y **nueva** asignación. No cambiar el tipo de entregas que ya tienen versiones. La séptima migración incorpora el evaluador común, guardia de tipo, comandos, reanudación y confirmación; se probaron denegación de otras ediciones y retirada con subida abierta en la copia. Falta elegir el piloto real y autorizar el despliegue. No se convierte ninguna entrega ya existente.

## Respaldo y orden

Antes de la ventana, guardar commit y despliegue vigentes, inventario de migraciones/funciones/ACL, políticas, banderas, cantidades de documentos/versiones y objeto/huella de los originales. Generar un respaldo cifrado con una conexión de respaldo autorizada que incluya los esquemas privados y los datos necesarios; no asumir que el plan gratuito incluye recuperación automática. No imprimir URI, contraseñas ni el dump. Ensayar su restauración en un entorno aislado. Los archivos R2 no están contenidos en el dump SQL: inventariarlos y comprobar su conservación por separado.

Aplicar en este orden, con imágenes y derivados desactivados, transacción por migración y comprobación después de cada paso:

1. `20261016113804_workspace_lapis_coordination_scope.sql`
2. `20261016113805_workspace_lapis_upload_policy.sql`
3. `20261016113806_workspace_lapis_image_data.sql`
4. `20261016194802_workspace_lapis_multipart_gateway.sql`
5. `20261016203609_workspace_lapis_image_interface.sql`
6. `20261017021526_workspace_lapis_retained_read.sql`
7. `20261017130000_workspace_lapis_pilot_allowlist.sql` (lista vacía por defecto; NO habilitar automáticamente un UUID de producción).

La sexta ya forma parte del paquete y cuenta con reversión operativa `1.7.0-4-retained-read.sql`: conservar la RPC corregida y pausar nuevas escrituras; nunca restaurar la ocultación de datos. La séptima se detiene con `1.7.0-5-pilot-allowlist.sql`.

La copia ensayada usa Postgres **17.11**, producción reportaba **17.6**: riesgo menor, comprobar versión/extensiones y no asumir equivalencia exacta. Las 770 aserciones locales incluyen la sexta; ahora pasan 785 con la lista. Las 36 remotas históricas no probaban expresamente la pausa; diez SQL reales adicionales verificaron lectura conservada y lista en una transacción revertida de prueba.

Las primeras cinco tardaron aproximadamente **37,6 s sumadas por MCP** en la copia, con 21,1 s en datos. No son una promesa de duración ni bloqueo en producción. Reservar provisionalmente una ventana de 15 minutos para respaldo, DDL, comprobaciones y decisión, recalculándola con tamaño/carga reales; definir `lock_timeout` y `statement_timeout` tras revisar cada migración, sin cambiar silenciosamente su comportamiento. Ante error o bloqueo, detenerse: no continuar con una aplicación parcial desconocida.

Comprobar owner/search_path de SECURITY DEFINER, permisos anon/authenticated, RLS de tablas privadas, validación de sesión, cantidades previas y funcionamiento del flujo de documentos/Keynotes/licencias. No sembrar cuentas ni documentos ficticios en producción. Comprobar mediante lecturas y participantes del piloto autorizados.

Desplegar la pasarela con descargas, limpieza y cron completos, conservando el bucket privado y secretos en servidor. Publicar el cliente compatible sólo tras aprobación separada; no cambiar la descarga base 1.5.0. Mantener banderas apagadas hasta concluir comprobaciones y autorizar la activación de la única edición.

## Funcionamiento del piloto y observación

Activar exclusivamente Día de Muertos y las asignaciones nuevas seleccionadas. Una prueba con una persona que entrega, su revisor de área y Santiago. QA conserva su posición antes de Dirección; no se salta ni se añade una aprobación ajena a la matriz.

Registrar estado HTTP, código de error, fase de subida, bytes, CPU/duración e id de correlación técnico con acceso restringido. No registrar nombres/contenido de originales, EXIF/GPS, cuerpos de documentos, claves de objetos ni tokens firmados. Consultar cuota de cuenta y aplicación; alertas de cuota, fallos/reintentos y `exceededCpu` deben verse en el panel privado del operador. No se configuró un envío externo de mensajes ni nuevas notificaciones a colaboradores en esta fase. Santiago revisa una lista corta de entregas del piloto, su versión, etapa, avisos y bloqueos; la revisión conserva el flujo actual.

Si falla imagen, crear una **asignación paralela de documento** usando la vía anterior, enlazar los materiales conservados y mantener la entrega de imagen para consulta. No convertir un `kind=image` con versiones, sobrescribir originales ni vaciar una entrega aceptada. Detener el piloto ante pérdida de acceso, corrupción de integridad, bloqueos ajenos a la edición o CPU sostenida fuera del presupuesto.

## Desactivar y revertir

Primero quitar la edición de la lista permitida y apagar `images_enabled`/derivados si hace falta parar todo el flujo. Nuevas subidas/envíos se rechazan con mensaje; borradores, originales, capas y versiones se conservan y son legibles para quienes mantienen acceso. Suspensión de membresía y revocación de sesión siguen negando enlaces, aun con bytes en caché. Las sesiones incompletas permanecen reservadas hasta cancelación o expiración/limpieza confirmada; no liberar cuota por mera intención.

Usar los scripts no destructivos de `../rollbacks/`: lista permitida (`1.7.0-5`) → pausa conservando lectura (`1.7.0-4`) → interfaz → gateway → imágenes → política. No revertir la sexta al bundle defectuoso. Conservar las RPC de lectura corregidas, RLS, versiones, originales y el Worker con handlers de descarga/limpieza y cron. No ejecutar DROP ni restaurar una base antigua encima de documentos nuevos. El rollback de coordinación devuelve lectura amplia U: **amplía acceso**, requiere decisión explícita y se prefiere corregir asignaciones faltantes.

Ensayo realizado sólo en la copia: cinco pasos en una transacción, conteos conservados y lectura autorizada, seguido de rollback. En producción serían decisiones persistentes distintas, con respaldo y autorización propios. Para reactivar: comprobar versión/ACL, resolver causa, restituir permisos deliberadamente y habilitar sólo el piloto; nunca encender una bandera global sin lista.

## Resultado del experimento y decisiones previas

[Informe de continuación](../phase4-followup/INFORME.md). La finalización A con tamaño/cabecera por rangos dio 3–5 ms; B con lectura completa/SHA dio 34–136 ms. Sin embargo, las partes dieron 98–249 ms, por lo que **E sigue sin superarse para el flujo completo en Free**. El Worker de prueba volvió a su entrada normal con hash completo; `wrangler.cpu-ab.jsonc` nunca debe ser la configuración de producción.

No desplegar una garantía degradada por cambiar una variable. Si Santiago elige SHA declarado/verificado por clientes, se requiere primero resolver CPU de partes, distinguir esa garantía en datos/UI, comprobar cada asset antes de reutilizar caché y repetir el flujo aislado. Si elige Paid, obtener autorización explícita del cargo, establecer límites y mantener hash completo. Si aplaza imágenes, documentos continúan. No se eligió ni contrató ninguna opción.

En la copia se mantuvo sólo la edición sintética Día de Muertos en la lista. Para producción, el operador agregaría exclusivamente el UUID real de Día de Muertos **después** del respaldo, aprobación, selección de nueva asignación y comprobaciones; no habilitar Halloween ni usar pruebas de producción. Retirar ese UUID debe bloquear subida nueva/reanudación/finalización y conservar acceso autorizado a versiones/archivos.

Antes de decidir, Santiago aporta Windows (apertura, tiempo, diálogo, memoria sumada), PNG final típico y fuente real con capas/formato. La muestra real disponible sigue privada y su entrega no se convierte. Fijar quién entrega, quién revisa, nueva asignación y fecha de decisión. Si ese día falta una condición o autorización, Día de Muertos sigue por documentos y las imágenes se activan en una edición posterior.

El repositorio y la compilación Windows son públicos por decisión expresa de Santiago tras el aviso; no afirmar que son privados. El paquete actual es sintético, retención siete días; ningún archivo real ni credencial pertenece a Git/Actions.
