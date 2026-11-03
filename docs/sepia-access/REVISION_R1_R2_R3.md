# Respuesta a revisión Ultramar R1/R2/R3

- R1: el verificador exige reloj numérico, finito, entero seguro y no negativo. Regresiones: undefined, NaN, infinitos, null/string, antes de nbf e instante exp.
- R2: AUTH_NATIVO.md detalla URL pública de configuración, GBA ID/PIN real, desafíos TOTP, refresh y cierre local. Políticas leídas directamente de Management API en ambos entornos: sin timebox adicional, sin inactividad adicional, sin sesión única, JWT de una hora.
- R3: verification/sepia-access se instala con npm ci y pasa npm test (125 comprobaciones HTTP/SDK/PostgreSQL local más protocolo). Incluye lock, dependencias fijadas, código y seis migraciones base necesarias, con licencias. El ensayo real con GoTrue/PostgREST/PostgreSQL pasó 62 comprobaciones, incluidos MFA, canje concurrente, recuperación y revocaciones.

Los intentos fallidos se conservan en los registros de la entrega. Se corrigió el adaptador HTTP local, se mantuvo SECURITY DEFINER en el disparador del upgrade aislado y se restablecieron sólo los contadores sintéticos tras demostrar el límite 429. No se redujeron límites del servicio.

El cliente nativo/almacén seguro/reloj y Windows corresponden a Ultramar; no se presentan como probados por este backend.
