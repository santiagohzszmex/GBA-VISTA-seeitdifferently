# Workspace 1.7.0 Lapislázuli · Fase 2

16 de octubre de 2026. Rama local `codex/workspace-1-7-0-phase-2`, sobre `9c226a9`; implementación en el commit `5c1e358`. **Pasarela implementada y probada en desarrollo; sin publicación, migración ni activación en producción. Fase 3 detenida.** Cuarzo 1.6.6.2, sus instaladores y la base pública 1.5.0 conservan sus versiones.

## Resultado

- Multipart de **8 MiB**, reserva única al abrir sesión, progreso por parte, cancelación, manifiesto persistible y reanudación durante 24 h. Reutilizar el original en una versión no vuelve a reservar sus bytes. El servidor lee los bytes de R2 y verifica SHA-256, tamaño y formato antes de marcar el activo validado; eso no equivale a aprobación editorial.
- Limpieza por lease y cron preparado cada 15 minutos. Aborta partes, elimina objetos y confirma ausencia antes de liberar cuota. Si R2 falla, se conserva la reserva para reintentar. Auditoría privada distingue la cancelación de una persona y la limpieza automática. No se limpian versiones enviadas ni se activa el borrado de borradores de 60/90 días.
- Enlaces firmados de **300 segundos** por archivo, operación, persona y sesión. Cada canje revalida membresía, permisos y sesión; aislamiento de ediciones y permisos de original/preview separados. Los archivos aún no enviados siguen privados de su autor. Sin claves de R2 en la respuesta pública ni originales publicados para procesarlos.
- Procesador reemplazable detrás de `generate({asset,policy,source})`. Miniatura y preview WebP con EXIF/XMP retirados, alfa conservado y control de proporción. Un fallo de binding o de escritura del derivado conserva el original validado: **«Vista previa no disponible; descarga el original»**. Animación PNG no se ejecuta ni se certifica: se valida su raster base y se usa ese mismo fallback.
- PNG: raster decodificado con CRC, límites, filtros, paleta, transparencia y Adam7; entrada fragmentada y filas acotadas. PSD/TIFF: cabecera, sin certificar capas. KRA: revisión limitada del directorio ZIP y `maindoc.xml`, con rechazo de manifiestos malformados, nombres inseguros, ZIP anidado reconocible por extensión y expansión desproporcionada. No se extraen ni ejecutan archivos interiores. PROCREATE/AFPHOTO/CLIP permanecen **adjuntos opacos sin verificar**, descargados como adjuntos.
- Cuota compartida de **10.000.000.000 bytes**, aviso a Dirección al 80 % por cruce de umbral y error **«No hay espacio disponible en Workspace; avisa a Dirección»**. Se aplican también los presupuestos conservadores existentes de operaciones; no constituyen una garantía de factura cero para toda la cuenta Cloudflare.

No hay pantalla nueva ni filtro de ediciones. La futura interfaz extenderá **Mi trabajo, Asignaciones y Revisión de la edición elegida**, conservará área → QA → aprobación final de Dirección y usará el estilo cálido de Cuarzo.

## Medido

Prueba del binding remoto de Images mediante Worker local aislado. Todos los PNG son **sintéticos**, 4000 × 5000, RGBA, EXIF/GPS 0,0, con padding auxiliar; el peso en bytes sí es exacto.

| Peso real | Resultado |
|---:|---|
| 19.000.000 bytes | Aceptado; WebP de 256.328 bytes |
| 20.000.000 bytes | Aceptado; WebP de 256.328 bytes |
| 20.000.001 bytes | Rechazado, `9402 file too large` |
| 20.971.520 bytes (20 MiB) | Rechazado, mismo error |
| 20.971.521 bytes | Rechazado, mismo error |

En estas muestras el corte fue **20.000.000 / 20.000.001 bytes**, no 20 MiB. Las solicitudes tardaron aproximadamente 6,4–9,9 s; no son un SLA. El original tenía EXIF y GPS; tanto el WebP directo del proveedor como el limpiado no los tenían. Ambos conservaron alfa variable. [Resultados exactos](../../spikes/lapis/results-phase2-2026-10-16.json).

Se mantienen **18 MiB / 250 MiB / 40 MP provisionales**. No se probó la ruta remota de 100 MB ni se eligió un servicio privado o procesamiento en dispositivo.

Una ejecución del validador incremental con el PNG sintético base de 5.726.086 bytes y 20 MP en **Node/macOS** midió 480 ms de pared, 554,789 ms de CPU de proceso y máximo RSS 73.984 KiB. **No son medidas del Worker desplegado.** [Medición](../../spikes/lapis/stream-validation-phase2-2026-10-16.json). Workers Free documenta 10 ms de CPU y 128 MB por isolate: el resultado local no permite afirmar que la validación completa funcione en ese presupuesto. **Antes de activar imágenes hay que resolver/perfilar ese paso**, además de recibir muestras reales. No se contrató ni activó ningún plan de pago. [Límites oficiales](https://developers.cloudflare.com/workers/platform/limits/).

## Pruebas y fallos

- `npm run test:workspace`: **731 aserciones SQL locales**, de ellas 93 de pasarela/SDK, más las suites de identidad (80), editor/Safari, referencias, documentos independientes, bandeja, menciones, comentarios y versiones Cuarzo. PNG: 17 comprobaciones; KRA/ZIP: 11, además de las 14 anteriores de formatos.
- `npm run test:r2-runtime`: **workerd y R2 locales reales**, multipart de 8 MiB más parte final, `crypto.DigestStream`, PNG, adjunto opaco, descarga byte por byte, cancelación y limpieza después de una finalización corrupta. No se ha simulado una carga real de 250 MiB en producción.
- `npm run r2:check`: compilación del Worker con `--dry-run`, sin despliegue. No hay cambios de UI ni instaladores que justifiquen reconstruirlos. Regresiones del editor y comandos existentes sí comprobadas.
- Se corrigieron durante el desarrollo un bloqueo del descompresor ante datos sobrantes, finalización prematura que impedía continuar partes, evaluación de permisos sin JWT al canjear enlaces y auditoría de cron sin actor. Las ejecuciones intermedias fallaron hasta corregirlos; los resultados anteriores corresponden al código final. Un reinicio del servidor local interrumpió un POST del spike, repetido tras estabilizarlo.

Las pruebas cubren permisos revocados después de firmar, edición ajena, manipulación/vencimiento del enlace, corrupción real, vista previa fallida, borrado fallido con cuota retenida, reanudación tras perder el acuse y exclusión por lease. **Sin cuentas ni documentos ficticios en producción.**

## Impacto, migración y reversión

[Informe de Coordinación](IMPACTO-COORDINACION-1.7.0.md): cero concesiones actuales o históricas del rol; nadie perdería visibilidad hoy al pasar U → P. Recomienda aplicar tal cual tras revisión, sin asignaciones preparatorias. Consulta de solo lectura.

Con el uso registrado de 86.297.569 bytes caben **37 archivos adicionales con capas de 250 MiB**, o **35 parejas de PNG de 18 MiB + capas de 250 MiB**, antes de derivados. No es un inventario físico independiente del bucket; cada versión conservada cuenta.

Nueva migración: [`20261016194802_workspace_lapis_multipart_gateway.sql`](../../supabase/migrations/20261016194802_workspace_lapis_multipart_gateway.sql), después de las tres migraciones de Fase 1. Añade sesiones, estado de procesamiento/reservas, auditoría, avisos y RPC protegidas; conserva la política desactivada. Las migraciones siguen **sin aplicar**.

[Reversión no destructiva](rollbacks/1.7.0-2-gateway.sql): desactiva imágenes, conserva lectura autorizada, datos y protección de versiones; mantiene la limpieza de pendientes. No retirar el Worker nuevo ni el cron mientras queden reservas/partes pendientes. [Contrato y herramientas de desarrollo](../../cloudflare/workspace-originals/images/README.md).

## Abierto y decisiones

No hace falta una decisión nueva para cerrar esta fase de desarrollo. Siguen pendientes las 3–4 muestras reales solicitadas, la validación del presupuesto CPU/RAM en el entorno definitivo y la revisión/autorización de las migraciones con imágenes desactivadas. No se amplían tamaños ni se elige una opción de pago mientras se esperan esas muestras. La pantalla de entrega/visor y su diseño pertenecen a **Fase 3**, que no se inicia aquí.
