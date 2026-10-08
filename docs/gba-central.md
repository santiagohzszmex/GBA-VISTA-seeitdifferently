# Página central de GBA

Portada pública y bilingüe, sin autenticación ni consultas a Supabase. Vive en `public/gba` para aprovechar el despliegue existente de Vercel. VISTA conserva sus rutas y funcionamiento. No se utiliza la base antigua de `gba-web`: todavía ofrece préstamos y otros productos concluidos.

## Rutas

- `https://gba.software/`: español, cuando se retire la redirección de dominio en Vercel.
- `https://gba.software/en`: inglés.
- `https://gba.software/privacy`: privacidad de esta página central.
- Alternativas públicas: `https://vista.gba.software/gba/`, `/gba/en/` y `/gba/privacy/`.

Las reescrituras corporativas solo afectan a los hosts `gba.software` y `www.gba.software`. La configuración del dominio actualmente redirige a VISTA antes de resolver las rutas: es necesario desactivar esa redirección, manteniendo el dominio asignado al proyecto actual. No se deben modificar DNS de `vista`, MX ni correo.

## Información y procedencia

- Marca y unidades: modelo operativo de GBA de julio de 2026.
- Investigación: visión de ANIMA del 9 de septiembre y revisión de arquitectura conversacional del 4 de octubre de 2026, proporcionadas por Santiago.
- Contacto y México: confirmados por Santiago el 7 de octubre de 2026.
- La antigüedad se describe como proyecto joven; no se inventa una fecha de constitución, financiación ni registro empresarial.
- Los objetivos 2 MiB/8 MiB/un hilo/sin offload están identificados como objetivos experimentales, no logros acreditados.

Se publica una síntesis del propósito y estado, no los documentos originales, conversaciones, corpus, resultados internos ni rutas del laboratorio. La ilustración es conceptual, no una visualización de resultados.

## Validación

Revisar español e inglés, navegación móvil, acordeón de investigación, correo, enlaces a VISTA y página de privacidad. Verificar que las páginas pueden leerse sin JavaScript y sin cuenta. Compilar VISTA y comprobar que la encuesta conserva su reescritura.

## Privacidad

La portada no añade formularios, cookies, almacenamiento local, analítica ni llamadas a servicios de IA. CSS, SVG y JavaScript se sirven desde el propio dominio. El alojamiento sigue procesando registros técnicos normales; VISTA es un producto separado.
