# Workspace 1.7.0 Lapislázuli · Fase 1

16 de octubre de 2026. Rama local `codex/workspace-1-7-0-phase-1`, basada en Cuarzo 1.6.6.2 (`53be339`). **Implementación local; no aplicada ni publicada en producción. Fase 2 detenida.** No se modificó la base pública 1.5.0, el checkout original de Documents ni la identidad de los instaladores.

## Qué se hizo

- **1a, commit `07fa85c`:** corrección RBAC separada. Coordinación pasa de `U` a `P` en `project.read`, `task.read`, `content.read`. Antes podía obtener lectura de toda la unidad; después requiere asignación vigente al proyecto. Directorio/membresía y autoridad de aprobación no se amplían. Pruebas de dos ediciones, expiración y suspensión.
- **1c, commit `5fd76fc`:** una fila privada `workspace_private.upload_policy` es la autoridad de tamaños. Cliente, pasarela y conector consultan sus valores; los comandos de base de datos los verifican nuevamente. Se sustituyeron las constantes activas de 25 MiB y los textos de la interfaz muestran el valor recibido. Las migraciones históricas se conservan intactas. Valores iniciales: referencias actuales 25 MiB, PNG 18 MiB, capas 250 MiB y 40 megapíxeles; `provisional=true`. Ninguno es un contrato definitivo para ilustradores.
- **1b:** tipo `document/image`, ficha por asignación, borrador privado, sesiones de subida, activos, archivos por versión, derivados, notas, respuestas y verificaciones. UUID estables; edición mediante el `project_id` existente. Geometría normalizada 0–1, claves y comprobaciones de pertenencia. Versiones, enlaces y originales enviados quedan inmutables. Se reserva espacio para activos/derivados en la misma contabilidad de 10 GB, sin reservar dos veces al enlazar otra versión.
- `workspace_image_command` cubre ficha, borrador, envío y notas. El cliente no puede escribir directamente ni marcar un archivo como validado. Las tablas de activos y sesiones no exponen claves de R2 a lectores. RLS limita contenido y borradores; los comandos antiguos no permiten saltarse el contrato de imagen enviando texto.
- **Desactivado por defecto:** `images_enabled=false`. No hay pantalla final ni endpoints multipart. Los archivos los producirá la pasarela de la Fase 2. Los 60/90 días quedan configurados y registrados; no se activó un borrado programado. Las versiones enviadas no tienen eliminación automática.

PSD/TIFF se identifican por cabecera; KRA por revisión acotada de ZIP. PROCREATE/AFPHOTO/CLIP están representados como adjuntos opacos `unverified`. «Tiene capas» es declaración del autor, no una certificación del validador. Las funciones del spike todavía no son la pasarela de producción.

## Pruebas y fallos

- **638 aserciones** en la base PostgreSQL local de pruebas, incluidas 13 de Coordinación y 48 específicas de Lapislázuli. Cubren aislamiento, borrador privado, PNG/capas requeridos, inmutabilidad, versiones nuevas, geometría inválida, cambio de proporción, verificación de notas sin duplicarlas, suspensión, sesión revocada, cuota compartida, límites dinámicos y permisos anónimos. Un PNG menor que el mínimo editorial de la ficha puede enviarse: la calidad no se convierte en bloqueo.
- Regresiones: editor, versiones, comentarios, menciones, referencias, documentos independientes y bandeja de Cuarzo; también 80 comprobaciones del gateway de identidad, compatibilidad Safari y colocación del editor. Compilación web correcta, con los avisos de tamaño de bundle ya presentes. No se evaluó el futuro visor de imágenes, que no se ha construido.
- 14 comprobaciones de cabeceras y contenedores. Prueba del Worker con R2 simulado: bytes y SHA-256 preservados, corrupción y lectura anónima rechazadas.
- Integración Codex: nueve pruebas correctas. La prueba restante, del Llavero de macOS, no pudo guardar su credencial desechable en este entorno. No se cambió el código de credenciales ni se pidió renovar tu sesión.
- Se encontraron y corrigieron problemas de fixtures y valores nulos durante la ejecución local. Los resultados anteriores son de las comprobaciones finales, no de esas ejecuciones fallidas.

No se crearon registros de prueba en Supabase de producción. Los Workers del ensayo no tenían R2 ni identidades de Workspace. Se cerraron las sesiones de desarrollo y el túnel sintético.

## Spike: mediciones

**Todas las muestras son sintéticas.** No llegaron archivos de ilustradores. Los PNG contienen ruido, gradientes y una rejilla transparente; los nombres 5/15/25/50 MB son nominales. Aquí se muestran tamaños reales. Cada medición local usa un proceso separado en esta Mac y sharp/libvips: preview de 1600×2000, miniatura de 320×400 y comprobación de transparencia de salida.

| PNG, todos 4000×5000 | Tamaño real | Tiempo local | RSS máximo del proceso | Binding real de Cloudflare |
|---|---:|---:|---:|---|
| Nominal 5 MB | 5.717.086 bytes | 655 ms | 265 MiB | Correcto, 1.048 ms |
| Nominal 15 MB | 16.307.088 bytes | 730 ms | 267 MiB | Correcto, 2.031 ms |
| Nominal 25 MB | 26.889.724 bytes | 805 ms | 265 MiB | Error 9402: archivo demasiado grande |
| Nominal 50 MB | 53.356.261 bytes | 986 ms | 265 MiB | Error 9402: archivo demasiado grande |

El binding remoto generó **otra variante**, WebP de 800×1000: sus tiempos no comparan el mismo trabajo local. Los previews locales conservaron píxeles transparentes (`isOpaque=false`). La salida carecía de EXIF/XMP/IPTC; las fuentes no contenían EXIF/GPS, por lo que este ensayo no prueba todavía la eliminación de metadatos presentes en un archivo real.

La documentación vigente fija 20 MB de entrada para el binding y 100 MB para transformaciones remotas. **Verificación experimental:** el binding aceptó 16,3 MB y rechazó 26,9/53,4 MB. No se determinó el umbral exacto en bytes. **No se verificó experimentalmente el límite remoto de 100 MB:** los cuatro intentos, incluso el pequeño, devolvieron `9504 / download timed out`; el propio origen temporal también agotó su tiempo de respuesta. No es evidencia de rechazo por tamaño. Fuente: [límites oficiales de Images](https://developers.cloudflare.com/images/get-started/limits/).

| Contenedor sintético | Tamaño total | Datos leídos | Tiempo | RSS máximo |
|---|---:|---:|---:|---:|
| PSD aplanado | 80.000.040 bytes | 26 bytes | 0,294 ms | 68 MiB |
| TIFF clásico | 80.000.154 bytes | 28 bytes | 0,339 ms | 68 MiB |
| KRA de prueba | 17.407.940 bytes | 65.870 bytes | 0,545 ms | 68 MiB |

El proceso comienza alrededor de 67 MiB. Esto mide identificación acotada, **no** apertura completa ni capas reales. El KRA incluye un manifiesto y carga inerte; no certifica compatibilidad con exportaciones de Krita. ZIP64, cifrado y variantes fuera de los límites del prototipo quedan pendientes de muestras. No se probó integridad interna de PROCREATE/AFPHOTO/CLIP.

Evidencia completa: [results-2026-10-16.json](../../spikes/lapis/results-2026-10-16.json). Instrucciones para repetir con muestras reales: [README del spike](../../spikes/lapis/README.md). No se midió todavía fluidez del visor web/macOS/Windows ni memoria de un Worker de procesamiento: la cifra local incluye bibliotecas nativas y no se puede trasladar a ese runtime.

## Límites, alternativas y costes

Recomiendo **mantener provisionales** 18 MiB / 250 MiB / 40 MP hasta recibir muestras, sin habilitar el producto de imagen todavía. El ensayo no justifica fijarlos definitivamente ni resolver el procesamiento de archivos mayores en silencio.

| Alternativa para PNG mayores | Coste y riesgo |
|---|---|
| Derivado en el dispositivo | Añade almacenamiento/operaciones y carga CPU/RAM del equipo. Un SHA-256 demuestra identidad de los bytes originales, **no demuestra** que el preview del cliente represente esos píxeles. Necesitaría un mecanismo de verificación adicional o aceptar explícitamente esa limitación. |
| Servicio privado con libvips | Permite validar/decodificar fuera del Worker de 128 MB. El ensayo local sugiere reservar más memoria; no demuestra rendimiento en la nube. Como referencia, Cloudflare Containers requiere Workers Paid desde 5 USD/mes, más consumo aplicable; no se activó ni contrató. |
| Transformación remota de Images | Límite documentado mayor, pero ensayo incompleto por el origen. Deben verificarse autorización, caché privada y tamaño antes de seleccionarla. No publicar originales privados para hacerla funcionar. |

Fuentes consultadas el 16/10: [Containers](https://developers.cloudflare.com/containers/platform/pricing/), [Images](https://developers.cloudflare.com/images/pricing/). Images Free incluye 5.000 transformaciones únicas mensuales; en Paid el excedente cuesta 0,50 USD/1.000. El ensayo utilizó una variante y no habilitó un plan de pago.

[R2 Standard](https://developers.cloudflare.com/r2/pricing/) incluye por cuenta 10 GB-mes, un millón de operaciones A y diez millones B; el almacenamiento adicional cuesta 0,015 USD/GB-mes, operaciones A 4,50 USD/millón y B 0,36 USD/millón; transferencia de salida sin cargo. La cuota compartida por cuenta y los servicios de procesamiento impiden prometer una factura cero solo por tener un límite de 10 GB en Workspace. Los derivados y las partes pendientes también deben contar. Como ejemplo, cien versiones de 5 MB de PNG + 50 MB de capas + 1 MB de derivados ocupan aproximadamente 5,6 GB, antes de otros archivos.

## Migraciones y reversión

| Migración nueva | Reversión conservando datos |
|---|---|
| `20261016113804_workspace_lapis_coordination_scope.sql` | [1a](rollbacks/1.7.0-1a-coordination.sql): restaura los tres modos U anteriores. Amplía lectura; no debe usarse para suplir una asignación faltante. |
| `20261016113805_workspace_lapis_upload_policy.sql` | [1c](rollbacks/1.7.0-1c-policy.sql): restaura definiciones originales guardadas y límite de referencias; conserva fila/RPC para clientes nuevos y archivos ya aceptados. |
| `20261016113806_workspace_lapis_image_data.sql` | [1b](rollbacks/1.7.0-1b-images.sql): desactiva imágenes y revoca su comando; mantiene datos, RLS y protecciones de versiones. |

Si se necesita revertir todo, orden: 1b → 1c → 1a. Son reversiones funcionales y no destructivas; no eliminan columnas, tablas ni objetos R2. La bandera desactivada y sus denegaciones se probaron localmente. No se ejecutaron estos scripts en producción. La limpieza física y liberación de cuota requieren confirmación de eliminación por la pasarela, pendiente de Fase 2; no se libera espacio por un simple cambio de estado.

## Punto de decisión

**¿Para los PNG que superen el binding prefieres evaluar un servicio privado con presupuesto desde 5 USD/mes, o mantener por ahora el límite inicial y repetir el spike cuando lleguen las muestras reales?** El derivado del cliente queda documentado como alternativa con una limitación de confianza, no elegido como solución.

Se conserva la decisión de integrar cuadrícula y filtro de edición en **Mi trabajo, Asignaciones y Revisiones**, sin un panel nuevo. Las etiquetas futuras serán «Aprobada por el área» y «Aprobar por el área». El catálogo de documentos usará aceptación de área sin bloqueo QA; responsables y delegaciones se mantienen según matriz. Todo eso se integra en las fases de producto siguientes.

La respuesta autorizada exige detenerse tras esta entrega. **No se inició Fase 2, no se implementó multipart y no se publicó Lapislázuli.**
