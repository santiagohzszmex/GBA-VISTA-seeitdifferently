# Workspace 1.7.0 Lapislázuli · Fase 3

16 de octubre de 2026. Rama local `codex/workspace-1-7-0-phase-3`, sobre Fase 2 (`5c1e358`, con su informe `f38da5f`). Implementación: commit `90d2f10`. **Interfaz implementada localmente; validación pendiente en los puntos indicados abajo. No publicada, sin migraciones ni activación en producción.** La base pública 1.5.0, Cuarzo 1.6.6.2 y los instaladores conservan sus versiones.

## Resultado

- **Asignaciones:** Documento/Imagen en la ficha existente; requisitos de dimensiones, fondo, capas y formatos desde la política. El tipo se congela tras la primera versión. Editar la ficha durante la revisión modifica solo futuras entregas. «Ofrecer a documentos» queda guardado sin efecto editorial en esta fase.
- **Mi trabajo:** tarjetas sin miniaturas, con tipo, edición, estado, versión y entrada «Entregar imagen» o «Ver imagen y notas». No hay tablero ni filtro de edición nuevo.
- **Entrega:** PNG original, vista local temporal, comprobaciones orientativas, archivo con capas, crédito y nota con @. Progreso, pausa, cancelación, recuperación de sesión y reintento; guardar borrador es privado y silencioso. Enviar crea una versión inmutable. PNG y capas obligatorias bloquean el envío mientras faltan o suben; calidad solo avisa.
- **Revisión:** original con damero/claro/oscuro, zoom, desplazamiento, punto/recuadro y nota general accesible sin puntero. Lista y marcas se seleccionan juntas; respuestas, resolver, @ y verificación de notas anteriores. Comparación con v1 y registro de aprobación con avisos. Se conserva área → QA → Dirección, incidencia crítica y reapertura.
- **RBAC:** publica notas quien revisa; responde quien entrega o revisa; resuelve quien publicó o revisa. Verificar una nota en la siguiente versión requiere revisión. Las menciones enlazan la nota y versión, y revalidan el acceso al abrir. Las notas enviadas no se borran.

«Comparar con referencias» ya dividía el documento de trabajo y las referencias. Se conserva: referencias a un lado y el detalle de la imagen al otro, con los materiales específicos de la asignación. «Comparar con v1» compara originales de dos versiones dentro del visor.

## Originales, validación y caché

Derivados desactivados mediante `derivatives_enabled=false` y binding Images comentado. El procesador reemplazable, tablas, migraciones y pruebas anteriores se conservan; no se generan ni guardan previews/miniaturas. El límite provisional de PNG sigue en la política, sin depender del binding.

El Worker valida firma PNG, IHDR, IEND, dimensiones, tamaño y SHA-256 nativo; **no certifica la integridad del raster**. Decodificación, transparencia y declaración de perfil se comprueban en el cliente como avisos, vinculados al hash. Un fallo de decodificación local avisa; una cabecera inválida bloquea. PSD/TIFF reconocen cabecera y KRA su contenedor; las capas siguen siendo declaración del autor. PROCREATE/AFPHOTO/CLIP dicen «Sin verificar».

El visor comprueba SHA-256 y usa caché por cuenta/hash. **Un acierto exige primero un enlace autorizado**: los bytes almacenados no conceden acceso. Se recuperan descargas interrumpidas con rango y enlace nuevo, hasta tres intentos. Cerrar sesión cancela los trabajos antes de borrar la caché. Web usa Cache API; escritorio usa caché de disco con cuatro comandos IPC acotados a cuenta/hash y límite descartable de 512 MiB por cuenta, separado de la política de subida. Hash incremental en Worker web para no bloquear el editor con archivos grandes.

EXIF/GPS permanecen en el original. El visor no interpreta ni muestra esos campos; sí avisa que el archivo los conserva. Los originales no se publican: mantienen autorización y enlace firmado revalidado en cada canje.

## Pruebas realizadas y límites de la evidencia

| Comprobación | Resultado y alcance |
|---|---|
| `npm run test:workspace` | Aprobada: 764 aserciones SQL locales, incluidas 32 nuevas de Fase 3 y 94 de pasarela/SDK; suites adicionales de identidad, editor/Safari, referencias, bandeja, documentos, versiones, comentarios, menciones y recuperación aprobadas. |
| Cliente de imagen | 27 comprobaciones aprobadas: PNG estructural, calidad, capas requeridas, errores, renovación/rangos, caché, revocación, separación por cuenta y cierre de sesión durante descarga. |
| Permisos SQL (PGlite) | Borrador silencioso/privado, edición ajena, usuario suspendido, acceso anónimo denegado, menciones con nota/versión, notas inmutables, avisos de aprobación, snapshot técnico y cadena completa área → QA → Dirección/reabrir/incidencia. Todo aislado; ninguna cuenta ficticia en producción. |
| Interfaz real en navegador/macOS | Capturas de ficha, Mi trabajo, entrega, revisión, comparación y ocho errores/pausa. PNG sintético 4000 × 5000, 5.726.086 bytes. Se observó reutilización de caché, publicación de nota general y guardado privado con aviso claro. Errores de servicio/red inyectados **solo en la demo**. |
| `npm run workspace:build` | Aprobado. Advertencia de bundle principal grande (1,41 MB sin gzip), pendiente de optimización; no se afirma rendimiento medido. |
| Rust/escritorio | `cargo check` y compilación de desarrollo completados con toolchain temporal oficial. No se instaló ni sustituyó la app del usuario. No se logró inspeccionar la ventana de desarrollo con la herramienta nativa. |
| Worker `--dry-run` | Compiló (46,17 KiB, gzip 12,36 KiB), binding R2 sin Images; aviso del sandbox al escribir el log de Wrangler. Sin despliegue. |
| `test:r2-runtime` actualizado | **Pendiente de ejecutar con los nuevos rangos.** El sandbox no abrió el puerto; la revisión automática de la ejecución autorizada falló por cuota de uso. No se eludió. Las pruebas simuladas de gateway y cliente sí pasaron; no sustituyen esta prueba de workerd/R2 local. |
| Rendimiento 4000 × 5000 | **Sin cifras fiables** de tiempos, memoria o fluidez. La consulta de métricas del navegador se bloqueó. No hay Windows disponible. Compilar en macOS no equivale a medir el visor nativo. |
| Cierre con subida en curso | Guardas de navegación/beforeunload y confirmación nativa implementadas; **falta comprobar el diálogo nativo real**. Pausa/reanudación observadas en navegador. |

Las imágenes son sintéticas, no muestras de ilustradores. En la demo v1 y v2 comparten el mismo original para comprobar la caché; no prueban diferencias de dos ilustraciones reales. El cierre de las herramientas dejó el servidor de desarrollo sin proceso activo; la pestaña conservada puede mostrar datos en memoria o error de importación hasta reiniciarlo.

## Capturas y textos

[Galería de capturas reales de desarrollo](screenshots/phase3/README.md). [Lista de textos nuevos](TEXTOS-FASE-3-LAPISLAZULI.md).

Las capturas preceden dos ajustes finales: progreso listo/pausado y copia más precisa del PNG truncado; además, el recuadro de anotación ahora es transparente para evitar el fondo blanco heredado de los botones. No se han recapturado esos ajustes tras la interrupción del servidor. No son mockups ni pruebas de producción.

## Cambios, migración y reversión

Nueva migración **sin aplicar**: [`20261016203609_workspace_lapis_image_interface.sql`](../../supabase/migrations/20261016203609_workspace_lapis_image_interface.sql). Añade bundle filtrado, avisos de calidad y aprobación inmutables, notas generales, objetivos de notificación y política de derivados; permite verificación `header` y evita que la aprobación de imagen cree un documento vacío en la biblioteca (efecto de reutilización reservado a Fase 6). Las RPC y tablas mantienen controles de sesión, alcance y acceso privado.

Para detener el uso: mantener `images_enabled=false` y `derivatives_enabled=false`, conservar datos y limpieza multipart de Fase 2. **No restaurar la antigua restricción que exigía raster decodificado sobre activos aceptados como `header`**, ni borrar versiones/avisos. El código del procesador permanece intercambiable e inactivo. [Contrato actualizado](../../cloudflare/workspace-originals/images/README.md).

Componentes mínimos añadidos: ficha técnica, bloque de subida, visor y panel de notas; reutilizan contenedores, editor con menciones, recuperación, avisos y confirmación de salida Cuarzo. Se añadió `hash-wasm` fijado en 4.12.0 y caché nativa acotada; no hay acceso general a archivos o shell. El modo sintético requiere desarrollo y los parámetros `workspace-preview=1&lapis-preview=1`.

No se amplió el alcance del prompt ni se eligió un servicio de pago. La única desviación de entrega es la validación práctica pendiente detallada arriba, sin presentarla como aprobada. No hay una decisión de producto nueva que Santiago deba resolver ahora.

## Antes de avanzar o activar

Cerrar los pendientes de Fase 3: prueba workerd/rangos, diálogo de cierre real y rendimiento nativo macOS/Windows con red normal/lenta, memoria y zoom/desplazamiento. Para reabrir la demo: preparar los fixtures y ejecutar `WORKSPACE_LAPIS_DEMO=1 npm run workspace:dev -- --host 127.0.0.1`, luego abrir `http://127.0.0.1:1420/?workspace-preview=1&lapis-preview=1`.

Antes de producción, según el prompt: muestras reales; perfil CPU de la validación ligera en un Worker desplegado de prueba; pasada con R2 y Supabase reales de prueba; migraciones primero en una copia. **No ejecutado aquí.** Se detiene el trabajo en Fase 3.
