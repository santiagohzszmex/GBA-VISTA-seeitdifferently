# Lapislázuli · prueba aislada de Windows

Este paquete es una demostración sintética, sin inicio de sesión, conexión a Supabase, R2 ni actualizador. No sustituye Workspace, no instala nada y usa `software.gba.workspace.lapisphase4` para sus datos locales. La subida de esta demostración se simula: **no comprueba la red ni el servidor real**. Esas pruebas se ejecutan por separado en el entorno aislado.

## Preparar el ejecutable

Workflow `.github/workflows/workspace-lapis-test.yml`, rama de Fase 4. Se ejecuta al subir este workflow a esa rama y permite repetición manual. Sólo produce un artefacto de Actions durante siete días; no crea releases ni toca las descargas públicas. Santiago autorizó subir la rama y compilarlo. No declarar listo el paquete hasta comprobar el resultado del job y su SHA-256.

**Paquete compilado el 17 de octubre de 2026:** [Actions, ejecución 39030323475](https://github.com/santiagohzszmex/GBA-VISTA-seeitdifferently/actions/runs/39030323475), commit `edc550d8aee337b519e0af9d85e09b5959ff7908`, resultado `success`. Ejecutable de 28.088.320 bytes, SHA-256 comprobado tras descargarlo: `6fdfebdfb3dd80506c16c13ff072f0bc8951476e55cf3d561ee7b45c9178f38c`. El artefacto de GitHub caduca el 24 de octubre; la copia local se conserva. La ejecución y las mediciones en Windows todavía no están hechas.

## Prueba de Santiago

1. Descarga y extrae `Workspace-Lapislazuli-Windows-TEST`. Comprueba `SHA256.txt` con `Get-FileHash .\Workspace-Lapis-Test.exe -Algorithm SHA256` en PowerShell.
2. Ejecuta `Workspace-Lapis-Test.exe`. Si Windows presenta una advertencia de seguridad, la decisión de permitirlo corresponde a Santiago. No desactives Defender. Debe abrir una barra que dice **PRUEBA AISLADA**. Requiere WebView2 de Microsoft ya instalado; si falta, no se probó este dispositivo todavía.
3. Anota versión de Windows, CPU, RAM y resolución. Con 8 GB, cierra aplicaciones pesadas y registra cuáles siguen abiertas. No compartir el listado completo de procesos.
4. En «Ver como», elige Dirección → Revisión → «La luz que permanece». Mide primera imagen y segundo abrir. Las métricas automáticas registran visible/zoom/pan; «Exportar métricas» descarga el JSON local. La red normal aquí es el paquete local, **no Internet**.
5. Prueba zoom y arrastre. Activa comparación con v1. Ambas versiones de esta demostración usan el mismo original; **esto no mide el máximo de memoria de dos imágenes distintas**. Anota tirones y compara memoria de los procesos de esta app y sus descendientes WebView2 en el Administrador de tareas (base, una imagen, comparación). No sumes procesos de otras apps.
6. Para prueba fría con «Red lenta», cambia primero de Dirección a Artista y de vuelta a Dirección: el cambio de identidad limpia su caché. Abre otra vez la revisión. El limitador entrega 64 KiB cada 100 ms, aproximadamente 5,24 Mbps; la primera lectura del paquete sigue siendo local.
7. Cambia a Artista → Mi trabajo → «Ilustración de apertura». Elige `original.png`; durante la subida simulada, cierra la ventana con X. Debe preguntar «¿Cerrar la entrega?». Primero usa «Seguir trabajando»; en otra pasada usa «Pausar y cerrar». La demo no conserva una sesión multipart real tras reiniciar: no cuenta como prueba de reanudación del servidor.
8. Reabre y elige PNG, activa capas y añade `SYNTHETIC.afphoto`. Prueba también `corrupt.png`, `corrupt-raster.png`, `unsupported.svg` y `too-large.png`. No uses archivos personales en este paquete de diagnóstico.

Envía solamente el JSON de métricas, los tres consumos de memoria, especificaciones generales del equipo y capturas de la app de prueba. No contraseñas, tokens ni contenido personal.

La textura generada en CI tiene el mismo tamaño de lienzo, pero puede tener diferente peso y SHA que el PNG de macOS. Registrar su peso real antes de comparar tiempos. Las muestras reales y la prueba de Windows siguen pendientes hasta ejecutarse.

Para retirar la prueba, cierra el ejecutable y borra la carpeta extraída. Su caché aislada se encuentra bajo el identificador `software.gba.workspace.lapisphase4`; no borrar la de `software.gba.workspace`.
