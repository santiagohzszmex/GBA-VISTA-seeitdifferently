# Workspace 1.7.0 Lapislázuli · Fase 4

Fecha: 16 de octubre de 2026, America/Mexico_City. Trabajo en `codex/workspace-1-7-0-phase-4`, checkout temporal. Producción, las descargas y la base pública 1.5.0 permanecen sin cambios. **El piloto todavía no debe activarse.**

| Compuerta | Estado | Evidencia y límite |
|---|---|---|
| A · entorno real | Superada | Supabase separado, Auth real, Worker desplegado y R2 privado de prueba. Sin contratar planes. |
| B · migraciones y permisos | Superada para el alcance ejecutado | Cinco migraciones y una corrección adicional aplicadas en Postgres 17.11; 36 comprobaciones con JWT/PostgREST/R2 reales, más ensayo SQL de desactivación y cinco pasos de reversión. No equivale a ejecutar las 770 aserciones locales en Postgres remoto. |
| C · dispositivos | Pendiente de datos | macOS medido; Windows aún por compilar/ejecutar, memoria total de WebKit y equipo de 8 GB sin medición completa. |
| D · archivos | Pendiente de datos | Casos sintéticos y raster dañado comprobados; faltan archivos reales de ilustradores. Límites provisionales. |
| E · CPU | **No superada** | Finalización del PNG típico: **47 ms CPU**; cercano al límite: **184 ms CPU**. Plan actual Free: 10 ms por solicitud. |

## A. Entorno separado

Supabase `ojlcttpqkyktqpqybbdy` (`workspace-lapis-phase4-test`), organización GBA-SYSTEM, región us-east-2. Se verificó costo mensual 0 antes de crearlo. Se copiaron definiciones de 104 tablas, 274 funciones, índices, restricciones, RLS y permisos de los tres esquemas de aplicación, **sin usuarios, documentos ni contenido de producción**. Se sembraron únicamente la unidad GIMG, reglas estáticas y seis identidades ficticias. Los rangos GIMG siguen separados del rango general GBA; los perfiles ordinarios usan `rol = NULL`.

Worker y bucket: `workspace-lapis-phase4-test`. Versión desplegada `d4c8b68a-ae84-44c0-aa1d-1534b3a2f0de`. El nombre «Production» que usa Cloudflare para su entorno predeterminado corresponde a **este Worker de prueba**, no al Worker operativo de Workspace. [Montaje y retirada](ENTORNO.md).

## B. Base real y diferencias con PGlite

Las cinco migraciones de Fases 1–3 se aplicaron en orden: coordinación **2,554 s**, política **4,210 s**, datos **21,128 s**, pasarela **5,998 s**, interfaz **3,686 s**. Son tiempos del servicio MCP, incluyen transporte y no miden bloqueos SQL. La copia usa Postgres 17.11; producción reportaba 17.6.

El flujo real comprobó: asignación, acceso entre ediciones, borrador privado y silencioso, original idéntico, versiones inmutables, notas reservadas a revisión, menciones ancladas, corrección/v2, área → QA → Dirección, rechazo de aprobación final del colaborador, bloqueo crítico y liberación, descarga completa/rango y revocación de enlaces al suspender la membresía. [36 comprobaciones](real-stack-results.json).

El ensayo [SQL de reversión](rollback-rehearsal.sql) se ejecutó **sólo en la copia** dentro de una transacción terminada en rollback. Conservó cantidades de archivos/versiones, bloqueó escrituras, negó acceso directo a tablas privadas y conservó lectura autorizada. Al terminar se comprobó que permisos y banderas de la copia se restauraron.

Diferencias observadas:

- La tabla de usuarios simulada de PGlite aceptaba `Usuario`; la restricción real lo rechaza. Las cuentas comunes reales se crearon con rango general NULL, conservando los roles GIMG por separado.
- PGlite usa Auth y sesiones simuladas. La copia inició sesión por GoTrue y usó JWT/sesiones reales a través de PostgREST. Las identidades se sembraron en `auth.users`; no se ensayó aquí el registro público ni se clonaron los disparadores administrados de Auth.
- La exportación por catálogo omitió inicialmente nueve columnas IDENTITY; `project.create` falló por el id de auditoría. Se corrigió la copia con GENERATED ALWAYS. Fue un fallo del procedimiento de copia, no de la migración del producto.
- El adaptador local de R2 no sustituye workerd: ahora también pasó el runtime real local con enlace realmente vencido, interrupción tras cuatro bytes, renovación, `Range: bytes=4-`, 206 y SHA idéntico.
- La suite local terminó con **770 aserciones Workspace**, las pruebas de cliente y seis casos adicionales. Su cobertura completa sigue siendo local; no se presenta como 770 pruebas remotas.

Se detectó que apagar `images_enabled` ocultaba datos conservados. La migración adicional `20261017021526_workspace_lapis_retained_read.sql`, aplicada sólo en la copia, separa lectura y subida. La interfaz conserva visor, nota y descarga de capas del borrador, pero bloquea nuevos envíos.

El asesor de seguridad de Supabase se consultó sobre la copia. Señala tablas privadas con RLS sin políticas (denegación directa deliberada), RPC SECURITY DEFINER ejecutables y avisos heredados de funciones ajenas a Lapislázuli. Las funciones nuevas fijan search_path. Las dos RPC de máquina accesibles a anon exigen primero la credencial secreta de pasarela; se comprobó en SQL real que archivo y mantenimiento rechazan su ausencia. No se declara una auditoría completa del esquema heredado ni se alteró su configuración de Auth.

## C. macOS y Windows

Muestra sintética: PNG RGBA **4000 × 5000**, **5.726.086 bytes**, SHA `9cf329c273d4268f51d6ac573653129068bbaa86bb4ab37bc839fc1912ae48fb`. Mac de **16 GiB**, app de prueba independiente, WKWebView/debug y servidor local; no son mediciones de Internet ni de una versión optimizada de distribución.

| Medición | Resultado | Condición |
|---|---:|---|
| Bytes fríos → visible, visor corregido | 466 ms | Primer byte 20 ms; caché de archivos fría, comprobación del mismo SHA ya disponible en la sesión |
| Primera validación nueva del raster con bytes en caché | 724 ms | Incluye validación en Worker del navegador y lectura de caché |
| Apertura de v1 con mismo SHA en comparación | 4 ms | Reutiliza exactamente el original; no representa dos imágenes distintas |
| Red limitada a 64 KiB/100 ms, aprox. 5,24 Mbps | 9.188 ms | Primer byte 127 ms; anterior al último arreglo de detección de raster |
| Zoom comparando, última muestra de 60 cuadros | p95 18 ms, máximo 28 ms | 0 cuadros >33,4 ms; una pasada anterior tuvo máximo 154 ms y un tirón |

La caché nativa realmente existe bajo el identificador de prueba y su archivo coincidió por SHA con el original. Se corrigió la migración desde caché de navegador a disco. El origen localhost de la configuración de desarrollo no coincidía con 127.0.0.1: impedía el IPC y quedaba oculto por el fallback; se corrigió **en la configuración de prueba**.

Memoria observada del proceso anfitrión: **113.392 KiB RSS**, excluyendo procesos WebKit/GPU. WKWebView no expone `performance.memory`: **no hay cifra válida de memoria total ni de dos originales distintos**. El arrastre no produjo una muestra instrumentada concluyente. No se dispone de equipo de 8 GB.

El cierre nativo durante preparación/subida mostró «¿Cerrar la entrega?» y «Seguir trabajando / Pausar y cerrar». Se comprobó continuar; no se declara probado cerrar, relanzar y reanudar una sesión real de red en macOS. [Capturas](../screenshots/phase4/README.md). [Paquete e instrucciones Windows](WINDOWS.md): identidad aparte, sin conexión externa ni actualizador; la simulación de subida no cuenta como prueba R2. Compilación pendiente de completar la autorización de GitHub CLI.

## D. Archivos y fallos

Pasaron los casos: 1 × 1 aceptado estructuralmente; APNG con `acTL` aceptado por la cabecera (no certifica todos sus cuadros); >40 MP rechazado; PSD falso y ZIP renombrado KRA rechazados. PNG/capas/megapíxeles siguen provisionales: **18 MiB / 250 MiB / 40 MP**, no límites validados con trabajo real.

El PNG de 90 bytes con IHDR válida y zlib dañado pasó correctamente sólo la validación estructural del servidor. Se conservó idéntico, mostró advertencia de calidad y se devolvió por RPC con motivo. [Resultado real](damaged-raster-results.json).

En el navegador, `onload` llegó a aceptar ese raster y mostrar una imagen vacía. Se corrigió el visor con verificación estricta del flujo PNG en un Worker del navegador, memoria por filas y cancelación. Ahora muestra **«No se pudo mostrar la imagen; descarga el original para revisarlo»**, ofrece descarga y permite pedir cambios con motivo. Se comprobó también que el PNG válido sigue visible. La garantía del servidor sigue siendo **cabecera**, no raster certificado. Animación completa, archivos nativos reales y conservación de EXIF/GPS real siguen pendientes de las muestras de ilustradores.

La misma comprobación se aplica antes de marcar «Decodificación local» al seleccionar un PNG, para evitar un falso «Cumplido» de un decoder permisivo. Una prueba dirigida pasó: raster inválido, archivos sin SHA comprobados por separado, caché de SHA validado, cancelación y ausencia de la afirmación falsa de decodificación. Sigue permitiéndose conservar/subir el original con aviso para revisión; no se modifica su contenido.

Los ocho ajustes visuales solicitados quedaron aplicados: ayuda concreta, metadatos comprensibles, sin v0, explicación de capas, zona de archivo con vista local, interruptor claro, espaciado uniforme y nota breve con barra sólo al enfocarla. Las notas no ofrecen imagen ni tabla. Guardar la hidratación del editor ya no marca cambios falsos.

## E. CPU y decisión de infraestructura

[Eventos observados en Cloudflare](worker-cpu.json): PNG de 5.726.086 bytes **47 ms CPU / 1.184 ms de duración**; 18 MiB **184 ms CPU / 1.709 ms de duración**. Ambas solicitudes terminaron 200/ok; eso **no garantiza** que repeticiones entren en Free. Cloudflare permite cierta flexibilidad ocasional y puede terminar invocaciones que excedan de forma sostenida. [Límites oficiales](https://developers.cloudflare.com/workers/platform/limits/).

El perfil pprof sin tráfico quedó vacío y dos capturas concurrentes devolvieron 404. No existe un perfil de funciones utilizable; no se atribuye el costo a un hotspot sin evidencia. La API de métricas con OAuth devolvió 403; se leyó CPU por evento en el dashboard autenticado. Se confirmó allí **Free / Current plan**.

Alternativas, sin elegir ni contratar:

1. Mantener Free: perfilar y reducir el trabajo por solicitud o repartirlo conservando validación de integridad. Costo de suscripción adicional 0; requiere diseño y nuevas mediciones, sin garantía previa.
2. Workers Paid: base **USD 5/mes**, con uso incluido y sobreconsumo; no es un tope de factura. [Precios oficiales](https://developers.cloudflare.com/workers/platform/pricing/). No se activó.
3. Mantener imágenes apagadas y usar el flujo de documento existente mientras se resuelve la validación. No exige contratar otro plan.

Los [10 GB-mes gratuitos de R2](https://developers.cloudflare.com/r2/pricing/) no amplían la CPU del Worker y se comparten entre buckets de la cuenta; no son un límite automático de gasto. Se conservan cuotas de aplicación y derivados desactivados.

## Piloto y pendientes de Santiago

El piloto propuesto sigue limitado a **Día de Muertos**, una persona que entrega, quien revisa y Santiago, con asignaciones nuevas de tipo Imagen. Falta implementar y revisar la lista permitida por edición antes de una activación; no basta con encender la bandera global. El [plan de producción y reversión](DESPLIEGUE.md) es sólo una propuesta. Las entregas existentes no se convierten ni se borran.

Decisiones pendientes: ¿mantener Free y replantear la validación, o posponer el flujo de imagen? ¿Qué persona, revisor y asignación nuevos participarán? Para cerrar D faltan un PNG típico y sus fuentes reales de capas; para cerrar C faltan la ejecución en Windows y las mediciones de memoria indicadas.

`hash-wasm` **4.12.0** procede de npm, repositorio Daninet/hash-wasm, licencia MIT, copyright 2020 Dani Biró. No instala permisos nativos ni aporta acceso a archivos/red; consume los bytes seleccionados por la aplicación. Las capacidades Tauri existentes no se ampliaron; CSP ya contempla Wasm y Workers. Se incluye aviso de licencia en el paquete de prueba. El paquete principal **1.417,96 kB sin comprimir** sigue como deuda; no se optimizó en esta fase.
