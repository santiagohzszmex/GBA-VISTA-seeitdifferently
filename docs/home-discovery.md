# Inicio y Videos

Inicio conserva este orden sin separaciones: campaña principal, GBA Partners,
Top 10 y GBA Keynotes. Los tres primeros espacios miden `100svh`; Keynotes
conserva su componente y sus medidas anteriores. La encuesta, radio y actividad
social aparecen después. El catálogo completo y su hero están en Videos. Ver campaña despliega un lector
dentro de la página, debajo de su hero, con altura medida por ResizeObserver y
archivos completos en cascada. Plegar campaña devuelve al hero.

## Publicar un Partner en Inicio

En Mothership → Network → GBA Partners, prepara o edita un acuerdo con espacio
Hero o Hero + directorio y marca **Incluir el hero pagado en Inicio**. Se muestra
cuando el servidor está aprobado, el acuerdo está activo, el pago está confirmado
y el periodo está vigente. Los acuerdos existentes no adquieren este espacio
automáticamente. Registrar un acuerdo no ejecuta ningún cobro.

La imagen se carga mediante el selector existente de Cloudinary. El video de
fondo opcional acepta un enlace HTTPS directo a un archivo reproducible por el
navegador, por ejemplo un MP4 de Cloudinary. La imagen funciona como portada
mientras carga el video. El contenido pagado se identifica como publicidad.

## Top 10

`vista_home_discovery` combina contenido aprobado y servidores aprobados por
**visitas históricas de GBA ID únicos**. Usa `vistas_usuario` para videos y
periódicos, y `network_server_events` con `profile_view` para servidores. Cada
persona cuenta una vez por elemento, aunque vuelva otro día. Se excluyen las
publicaciones programadas para el futuro y los elementos sin visitantes.

Las impresiones de heroes y directorio, los contadores antiguos de visitas, los
likes y los acuerdos pagados no aumentan el ranking. Los empates se ordenan por
fecha de creación descendente e identificador, para conservar un resultado
estable. Solo se entregan agregados; nunca los identificadores de visitantes.
Abrir la información de un video o reproducirlo deliberadamente registra su
primera visita. La reproducción automática de fondo no cuenta.

Inicio consulta de nuevo los agregados cada minuto mientras está visible y al
volver a la ventana si han pasado al menos 55 segundos. Un error permite
reintentar. Sin acuerdos o ranking se conserva un hero informativo, sin inventar
patrocinios ni posiciones. El RPC requiere una sesión autenticada.

Los videos de fondo fuera de pantalla se pausan y los reproductores YouTube se
desmontan. Con movimiento reducido se mantiene la portada estática.

## Validación

- `npm run test:home`: ranking mixto, visitas únicas, privacidad, autenticación,
  moderación, publicaciones futuras, límite de diez y vigencia de Partners.
- `npm run test:network`, `npm run test:studios`, `npm run test:publishing`.
- `npm run build` y revisión visual en escritorio y móvil.
