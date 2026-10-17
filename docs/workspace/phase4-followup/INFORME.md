# Lapislázuli · continuación de Fase 4 · 17 octubre 2026

Rama `codex/workspace-lapis-free-experiment`, basada en `3b53fd5` de Fase 4. Sólo Sol. No se cambió producción, la base pública 1.5.0 ni el checkout anterior. Repositorio y Actions públicos, aceptado por Santiago después del aviso. Los archivos reales permanecen privados en su Mac.

## Compuertas

| Compuerta | Estado | Evidencia y límite |
|---|---|---|
| A · aislamiento | Superada | Misma copia Supabase y Worker/bucket privados de prueba; sólo identidades y archivos sintéticos en pruebas remotas. |
| B · flujo y permisos | Superada para lo ejecutado | 770 aserciones anteriores repetidas + 15 nuevas locales = **785**. Las **36 remotas anteriores** siguen siendo evidencia histórica; se añadieron **10 comprobaciones SQL reales**, no 770 ni 785 remotas. |
| C · escritorio | Parcial | Memoria de los tres procesos y red real medidas en esta Mac de 16 GiB. Windows, equipo de 8 GiB y cierre/reanudación real pendientes. |
| D · muestras | Parcial | Hay un PNG real validado localmente, sin alterar su entrega. Faltan PNG final típico confirmado por Santiago, fuente real con capas y sus formatos; no se publicaron originales reales. |
| E · Free | **No superada para el flujo completo** | Finalización A cabe en los eventos medidos; partes de subida aún consumen **98–249 ms** frente a 10 ms. |

## A/B de CPU desplegado

Worker `workspace-lapis-phase4-test`, versión medida `82b333c9-bd96-49a8-ad47-20abb2976121`. A y B comparten código, autenticación, RBAC, tamaño, cuotas, multipartes, política y comprobación estructural PNG por rangos. Sólo cambia la finalización: A no lee/hashea todo el objeto; B conserva esa lectura y SHA-256 completo. **A es un experimento, no una garantía aprobada para producción**. Los derivados estuvieron apagados.

Tres subidas por tamaño/variante, intercaladas. CPU tomada de **View invocation → CPU Time** del dashboard autenticado, no del reloj del cliente.

| Finalización | PNG 5.726.086 bytes | PNG 18 MiB |
|---|---|---|
| A · cabecera + tamaño | 5, 3, 3 ms; mediana **3 ms** | 3, 3 ms; mediana **3 ms**; falta un evento |
| B · lectura + SHA completo + cabecera | 90, 34, 47 ms; mediana **47 ms** | 136, 114, 128 ms; mediana **128 ms** |

Las doce finalizaciones exitosas devolvieron 200. No apareció el evento de finalización A/límite/1 en la consulta del panel: **no se inventó su CPU**. Antes hubo un intento B/límite/1 denegado al aplicar la lista de prueba durante la subida; se excluyó y se realizó después la repetición exitosa. Los primeros eventos preceden a la instalación de la lista; la ruta del Worker medida fue la misma.

Tres partes del PNG de 18 MiB, sin cambiar su implementación entre A y B: **249 ms (8 MiB), 247 ms (8 MiB), 98 ms (2 MiB)**. Por tanto, resolver la finalización no resuelve toda la subida en Free. Esta comparación atribuye el ahorro a quitar **la ruta de lectura completa + hash**, sin aislar el costo de la primitiva SHA del costo de procesar el stream. Tampoco atribuye toda la CPU de las partes al hash sin un perfil utilizable. [Eventos y resumen](cpu-ab.json).

El callback ligero vive exclusivamente en `worker.cpu-ab.mjs`, configuración `wrangler.cpu-ab.jsonc`, con guardia de proyecto de prueba. El Worker normal conserva hash completo por defecto. Al terminar se restituyó la entrada normal en el Worker de prueba; no se dejó la variante A como configuración normal. [Comprobación de aislamiento](../../../tests/lapis-cpu-ab.test.mjs).

## Garantía alternativa propuesta · no activada

Como A cabe en las finalizaciones observadas, la alternativa solicitada es viable para **esa etapa**, pero requiere resolver primero la CPU de las partes. El cliente que entrega calcula y declara SHA-256 con `hash-wasm`; el cliente revisor descarga, vuelve a calcularlo y sólo muestra el archivo si coincide. Ante discrepancia: **«Archivo dañado o distinto de lo entregado. Pide una nueva entrega»**, sin guardar bytes fallidos en la caché ni permitir que se presenten como comprobados.

El servidor conservaría GBA ID, sesión/membresía vigente, RBAC, lista por edición, límites/cuotas, tamaño, orden de partes, firma PNG/IHDR/IEND, originales inmutables y enlaces privados. **Dejaría de certificar que los bytes completos guardados coinciden con el SHA declarado**; cabecera tampoco certifica un raster válido ni todos los cuadros animados. Corrupción o una declaración falsa se descubrirían al descargar, no al finalizar la subida. Una persona autorizada puede usar un cliente modificado: el hash declarado no prueba autoría ni convierte un archivo en seguro.

Hay un cambio necesario en caché: la caché actual por SHA es válida bajo verificación completa del servidor. Con una huella sólo declarada, **no debe reutilizarse entre dos assets diferentes antes de comprobar cada objeto**: un autor podría declarar el SHA de un original anterior y provocar que se muestre la copia anterior en lugar del nuevo objeto. Propuesta: primera descarga/verificación obligatoria por `asset_id + versión inmutable + SHA + tamaño`; después permitir reutilización de ese vínculo ya comprobado, siempre revalidando acceso. Marcar explícitamente `client_declared` frente a `server_verified` en asset/snapshot, sin presentar el experimento A como verificación de servidor. Esto es diseño pendiente de decisión; no se implementó una rebaja silenciosa de la garantía.

## Lista permitida y sexta migración

La sexta migración `20261017021526_workspace_lapis_retained_read.sql` **ya estaba versionada**; se añadió su reversión operativa segura, que pausa escrituras y **conserva** la corrección de lectura. Restaurar el bug que ocultaba archivos no es una reversión aceptable.

La nueva séptima migración agrega `upload_policy.image_project_ids`, inicialmente vacía. Se probó con una sola edición sintética equivalente a Día de Muertos; no se copiaron ni habilitaron sus datos reales. Protección en conversión/creación de tareas, comando de imagen, apertura, reanudación y confirmación de subida; no depende del selector. Una retirada concurrente se comprueba otra vez antes de confirmar. Estado/descarga/cancelación y limpieza siguen disponibles. Las funciones anteriores quedan privadas, sin permiso de ejecución directa para evitar saltarse el wrapper. `uploads_enabled` es específico de la edición; datos retenidos siguen legibles.

Las 770 aserciones anteriores cargan la sexta migración y comprueban lectura después de apagar imágenes. Las 36 remotas anteriores **no contenían una prueba expresa de esa pausa**: no se afirma lo contrario. Las diez adicionales ejecutadas ahora en Postgres real cubren edición ajena denegada, permitida aceptada, subida permitida, retirada que deniega apertura/reanudación/finalización/borrador, bundle conservado, original legible y pausa global con lectura. Transacción terminada en **ROLLBACK** en el proyecto aislado. [Resultados](remote-sql.json), [SQL revisable](../../../tests/lapis-pilot-real.sql).

La copia usa **Postgres 17.11**, producción se identificó como **17.6**. Riesgo menor de diferencia de versión, no equivalencia exacta: comprobar versión y funciones/extensiones antes de desplegar; conservar respaldo y no usar estos resultados como prueba de producción.

## macOS: memoria física y red

Herramienta `footprint`, suma de anfitrión + WebContent + GPU. Los procesos se identificaron por diferencia entre app cerrada y recién lanzada; los tres procesos previos desaparecieron al cerrar **sólo la app aislada**. Cifras puntuales en MiB, no picos ni una prueba de fugas.

| Estado | Anfitrión | WebContent | GPU | Suma solicitada |
|---|---:|---:|---:|---:|
| App cerrada | 0 atribuible | 0 atribuible | 0 atribuible | **0** |
| App abierta sin imágenes | 44,89 | 37,95 | 14,47 | **97,32** |
| PNG 4000 × 5000 visible | 51,14 | 125,66 | 42,61 | **219,41** |
| Dos PNG distintos 4000 × 5000 | 60,59 | 167,99 | 54,02 | **282,60** |

`footprint` también calcula un total deduplicado: 97,07 / 219,16 / 282,35 MiB. La diferencia de 0,25 MiB es memoria compartida. Son componentes reales `ImageViewer`, verificación y caché nativa dentro de una app debug de medición; **no** una certificación de memoria de toda la interfaz Workspace ni de una Mac de 8 GiB. Segundo PNG generado sintéticamente, diferente contenido/SHA, 11.156.699 bytes; el primero pesa 5.726.086. [Datos](macos-memory.json).

Se obtuvieron enlaces del Worker de prueba desplegado y WKWebView descargó **directamente de ese Worker/R2**, sin servir los bytes de la imagen desde localhost. La pasarela de enlaces en localhost conserva el JWT de prueba en servidor; no lo entrega al navegador ni al repositorio.

| Apertura | Hasta visible | Primer byte | Condición |
|---|---:|---:|---|
| Original típico, frío | **1.795 ms** | 664 ms | Nueva sesión WKWebView, SHA y raster comprobados |
| Segundo original distinto, frío | **1.953 ms** | 578 ms | Comparación de dos originales distintos |
| Original típico, caché | **595 ms** | — | Se mantiene la autorización remota y la comprobación de caché |
| Original típico, lectura limitada | **10.129 ms** | 808 ms | 64 KiB cada 100 ms, bytes fríos; validación del raster de ese SHA ya disponible en sesión |

El último ensayo usa el **visor corregido**, frente a los 9.188 ms antiguos. Se limita el stream de respuesta real en el cliente de prueba; no es un limitador del sistema operativo ni una red físicamente distinta. Transferir 5,7 MB a 5,24 Mbps requiere aproximadamente **8,7 s (~9 s)** sólo por bytes. El total incluye enlace autorizado, transferencia, hash/caché y presentación: no se atribuye toda la diferencia al visor. [Datos](network-viewer.json), [captura](comparacion-r2.png).

## Windows, APNG y comprobaciones

El repositorio y [la ejecución que produjo Windows](https://github.com/santiagohzszmex/GBA-VISTA-seeitdifferently/actions/runs/39030323475) son **públicos**. Santiago aceptó continuar así. Retención: **7 días**, vencimiento 24 octubre 2026 11:55:51 UTC. Se revisaron diez archivos del paquete, SHA del EXE y configuración de compilación; no se detectaron patrones de credenciales ni la URL literal del Worker operativo. No equivale a ingeniería inversa exhaustiva del ejecutable. La app de prueba bloquea conexiones externas, no tiene updater y usa aliases que impiden Auth/Supabase real. [Alcance](windows-security.json).

No se recompiló Windows ni se atribuyeron al EXE antiguo los cambios de esta rama. Santiago sigue ejecutando [WINDOWS.md](../phase4/WINDOWS.md) con `edc550d`: apertura, tiempo de imagen, diálogo al cerrar con subida y suma de app + msedgewebview2 en Administrador de tareas.

Cuando la verificación local detecta `acTL`, visor y selección muestran **«PNG animado: solo se verá el primer cuadro»**. Se genera una representación estática del primer cuadro para mostrar, **sin cambiar el original que se sube o descarga**. Es aviso, no bloqueo por animación; no certifica cuadros posteriores. La prueba dirigida confirma propagación y conservación de ese metadato en caché. No se recibió aún un APNG real de un ilustrador.

Comprobaciones ejecutadas: suite Workspace una vez (**785 SQL/locales** más suites de cliente/formato), **10 SQL reales** nuevas, pruebas dirigidas de metadato animado y aislamiento A/B, build del cliente y `workerd` con R2 local. Build conserva el aviso conocido de tamaño del paquete. No se añadieron pruebas en producción.

## Costos y decisiones pendientes

| Alternativa | Costo y riesgo |
|---|---|
| Seguir Free, hash del cliente | Finalización cabe en las muestras; **faltaría rediseñar y medir partes**, adaptar caché y distinguir la garantía declarada. No autoriza activar imágenes ahora. |
| Workers Paid, mantener hash del servidor | Base **USD 5/mes por cuenta**, 30 millones CPU-ms y 10 millones solicitudes incluidos; extras USD 0,02/millón CPU-ms y USD 0,30/millón solicitudes. Retiene la comprobación completa; requiere aprobación de Santiago. |
| Aplazar imágenes | Continuar con documentos de la edición, sin cambiar el plan. Conserva originales y trabajo existentes. |

Como orden de magnitud, las tres partes medidas suman 594 ms; más la mediana de finalización B de 128 ms dan ~722 ms por original de 18 MiB, **antes de apertura, descargas y cron**. Mil subidas similares serían ~722.000 CPU-ms, ~2,4 % de 30 millones; es una estimación por muestras, no factura ni techo garantizado. El cálculo de 0,6 % referido sólo a finalización no cubría toda la subida. [Precios Workers](https://developers.cloudflare.com/workers/platform/pricing/).

R2 Standard conserva su franquicia de **10 GB-mes, 1 millón A y 10 millones B**, compartida por la cuenta. Fuera de franquicia: USD 0,015/GB-mes, USD 4,50/millón A y USD 0,36/millón B; salida sin cargo. Cuotas de aplicación no son un tope global de factura; mil originales de 18 MiB retenidos simultáneamente superarían 10 GB y la capacidad de la app debe rechazarlos antes. Derivados continúan apagados. No se adquirió plan ni servicio de imágenes. [Precios R2](https://developers.cloudflare.com/r2/pricing/), [SHA-256 compuesto, no objeto completo multipart](https://developers.cloudflare.com/r2/api/s3/api/#checksum-types).

Santiago debe decidir: **¿otro experimento Free para las partes y la garantía declarada, aprobar Paid, o aplazar imágenes?** También faltan persona que entrega, revisor, asignación nueva y fecha de decisión del piloto. Si en esa fecha faltan Windows, fuentes reales, lista y autorización final, Día de Muertos continúa por documentos. [Plan actualizado, no ejecutado](../phase4/DESPLIEGUE.md).
