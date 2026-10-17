# Reparación del canal instalado · 1.6.6.3 Cuarzo

La publicación macOS 1.7.1 creó un canal separado sin conectar los clientes instalados que consultaban latest.json. Por eso Cuarzo 1.6.6.2 decía estar al día. No era un problema del plan de Cloudflare.

Se publica un puente desde el commit exacto de Cuarzo 1.6.6.2, sin cambios de interfaz, autenticación, permisos, base de datos, dependencias o almacenamiento. Sólo cambia la versión/aviso y el endpoint del actualizador a latest-{{target}}.json. Sus paquetes nuevos se compilan e instalan en CI, se firman y verifican con la identidad existente.

Ruta de los clientes antiguos: latest.json ofrece 1.6.6.3 (nativa 1.6.603) con tres binarios reales de esa versión. Después de instalarla manualmente, Mac consulta latest-darwin.json y ofrece Lapislázuli 1.7.1; Windows consulta latest-windows.json y conserva Cuarzo 1.6.6.3. No se etiqueta un binario antiguo como Lapislázuli, ni se publica Windows 1.7 antes de su prueba humana.

Los dos pasos requieren las acciones Descargar e Instalar y reiniciar de la persona. La reparación no instala nada por sí sola, no requiere iniciar sesión y conserva los datos/sesión. La base pública 1.5.0 no cambia.

Operación: publicar primero los paquetes inmutables del puente y comprobar sus bytes públicos; luego latest-windows.json; por último latest.json. Preservar latest-darwin.json byte por byte. Mantener latest.json como puente para clientes anteriores y mantener canales por plataforma para futuros lanzamientos. Nunca elevar la versión global del canal antiguo conservando un binario Windows de versión menor.

Reversión: volver a subir el latest.json previo conservado por el publicador; los paquetes publicados son inmutables y no se borran. No revertir latest-darwin.json ni datos de usuarios.

## Publicación comprobada

Publicado el 17 de octubre de 2026: https://github.com/santiagohzszmex/GBA-VISTA-seeitdifferently/releases/tag/workspace-v1.6.6.3-beta.1 . Fuente exacta de los tres binarios: 3e0b79c433b03c2b3cd8feb7ccb0aa8774e8dbcb; CI 39072360534 correcta (incluidas instalación y arranque). Este cierre posterior sólo corrige la deduplicación de rutas del publicador y documenta el resultado; no cambia los binarios ni la aplicación.

Santiago autorizó expresamente publicar el puente en macOS y Windows sin la prueba interactiva previa de Windows, exclusivamente para este puente. Lapislázuli Windows sigue retenido.

Los diez archivos del borrador se cotejaron con los candidatos y sus firmas; los binarios públicos con los hashes de CI. latest.json y latest-windows.json ofrecen 1.6.603; latest-darwin.json conserva 1.7.100 y la base pública permanece idéntica. Se comprobó en la app real instalada 1.6.6.2 que aparece Workspace 1.6.6.3 y el botón Descargar actualización. No se descargó ni instaló nada en esa app.

El primer alta del borrador encontró el mismo EXE NSIS listado dos veces (instalador y actualizador); se verificó el borrador completo antes de publicarlo y se deduplicó el publicador. Tras sobrescribir latest.json una lectura HTTP vio un redirect anterior en caché; la API de releases y el actualizador nativo confirmaron el contenido nuevo. No se repitió la subida ni se degradó ninguna firma.
