# Galería de verificación · Fase 4

Todas las personas, textos y archivos mostrados son de demostración. No son capturas de documentos reales ni prueba de aprobación de un trabajo real.

- [Entrega revisada](entregar.jpg), [macOS](macos-entregar.png): ayuda, zona de archivo, metadatos, capas y nota breve.
- [Original listo](subida-lista.jpg): tarjeta con vista local y progreso completo.
- [Pausa](error-paused.jpg): estado de error AbortError inyectado en la demo; no se presenta como una sesión R2 real pausada.
- [Cuota](error-quota.jpg), [sesión vencida](error-expired.jpg), [sin conexión](error-offline.jpg), [almacenamiento fallido](error-failed.jpg): fallos inyectados únicamente en la demostración.
- [Raster dañado](visor-png-danado.jpg): PNG real sintético con cabecera válida y zlib inválido; detección estricta local, mensaje y botón de descarga. La devolución con motivo también se ejerció por API en el entorno aislado.
- [PNG truncado](error-png.jpg), [formato ajeno](error-formato.jpg) y [límite excedido](error-limite.jpg): selección real de las muestras sintéticas, validación del cliente y mensaje visible.
- [Comparación real en macOS](macos-comparar-v1.png): WKWebView de la app separada; ambas versiones reutilizan el mismo original sintético.
- [Cierre durante subida](macos-cierre-subida.png): diálogo nativo de la app de prueba. Se comprobó «Seguir trabajando»; no acredita reanudación de una sesión real después de cerrar.

Las capturas anteriores de [Fase 3](../phase3/README.md) conservan la ficha de asignación, Mi trabajo y otros casos. No se afirma que esas capturas antiguas se hayan recapturado todas en Fase 4. La galería de Windows sigue pendiente de ejecutar la prueba de ese dispositivo.
