# Página central de GBA

Portada pública y bilingüe, sin autenticación ni consultas a Supabase. Vive en `public/gba` para aprovechar el despliegue existente de Vercel. VISTA conserva sus rutas y funcionamiento. No se utiliza la base antigua de `gba-web`: todavía ofrece préstamos y otros productos concluidos.

## Rutas

- `https://gba.software/`: español.
- `https://gba.software/en`: inglés.
- `https://gba.software/privacy`: privacidad de esta página central.
- Alternativas públicas: `https://vista.gba.software/gba/`, `/gba/en/` y `/gba/privacy/`.

Los dominios `gba.software` y `www.gba.software` están conectados a producción desde el 7 de octubre de 2026. Se retiraron sus redirecciones hacia VISTA, manteniendo el proyecto existente y sin cambiar DNS ni correo.

Las rutas corporativas solo afectan a esos dos hosts y se resuelven antes del sistema de archivos para que el `index.html` de VISTA no tenga prioridad en `/`. Inglés y privacidad admiten URLs con y sin barra final. Tras las rutas explícitas, `handle: filesystem` sirve los archivos y API habituales; la encuesta conserva su destino `/index.html` después de esa fase.

## Información y procedencia

- Marca y unidades: modelo operativo de GBA de julio de 2026.
- Investigación: visión de ANIMA del 9 de septiembre y revisión de arquitectura conversacional del 4 de octubre de 2026, proporcionadas por Santiago.
- Contacto y México: confirmados por Santiago el 7 de octubre de 2026.
- La antigüedad se describe como proyecto joven; no se inventa una fecha de constitución, financiación ni registro empresarial.
- Actualización del 7 de octubre: la presentación pública omite temporalmente VISTA y Minecraft, incluidos enlaces y metadatos. La accesibilidad de ANIMA se explica como comprensión, interacción natural y autonomía personal; el perfil experimental de hardware permanece en la documentación de investigación.

Se publica una síntesis del propósito y estado, no los documentos originales, conversaciones, corpus, resultados internos ni rutas del laboratorio. La ilustración es conceptual, no una visualización de resultados.

## Validación

Revisar español e inglés, navegación móvil, acordeón de investigación, correo y página de privacidad. Verificar que las páginas pueden leerse sin JavaScript y sin cuenta. Compilar VISTA y comprobar que la encuesta conserva su reescritura.

## Privacidad

La portada no añade formularios, cookies, almacenamiento local, analítica ni llamadas a servicios de IA. CSS, SVG y JavaScript se sirven desde el propio dominio. El alojamiento sigue procesando registros técnicos normales; VISTA es un producto separado.
