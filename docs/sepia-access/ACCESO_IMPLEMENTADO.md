# Acceso nativo Sepia — entrega al chat de Ultramar

2 de noviembre de 2026 · `gba.sepia.acceso/1.0` · revisión **2** · rama `codex/sepia-access-service`.

## Estado real

Backend implementado; ensayo aislado de Auth real completado. Publicación de producción autorizada y en preparación; ver el acta final de despliegue. No hay claves públicas de producción de Sepia ni un `kid` de producción asignado. No probar las rutas propuestas contra GBA suponiendo que ya existen.

| Ruta propuesta | Implementación | Validación | Producción |
|---|---|---|---|
| `POST https://gba.software/api/sepia/v1` | `session.create`, `session.status`, `license.activate`, `session.logout` | HTTP + SDK + PostgreSQL local | No desplegada |
| `GET https://gba.software/api/sepia/v1/offline-keys` | Sólo claves públicas del entorno | Local | No desplegada |
| `POST https://gba.software/api/sepia/v1/admin` | Emisión, consulta y revocación de Sepia | Local, requiere `platform.manage` actual | No desplegada |
| `GET/POST https://gba.software/api/sepia/v1/admin-session` | Sesión web administrativa, CSRF y gestión de conexiones | Local | No desplegada |
| `https://gba.software/sepia/administrar/` | Administración web; no es login de Ultramar | Código preparado | No desplegada |

No hay `pairing.*`, consentimiento web ni URL de verificación en el protocolo nativo. La petición incluye `revision: 2`; revisión 1 u omitida recibe `400 contract_unsupported`.

## Autenticación que debe usar Ultramar

El mecanismo existente observado en el servidor de GBA es `POST https://gba.software/api/gba-id`, JSON `{action:"login", handle:"nombre de GBA ID", pin:"cuatro dígitos", device:"UUID aleatorio"}`. Su implementación está en `api/gba-id.js`, sin cambios en esta entrega. `handle` no es un correo; conservar los ceros iniciales del PIN. El dispositivo es un UUID de instalación, no una serie de hardware. La petición sale del backend nativo mediante TLS, sin abrir navegador. La UI entrega el PIN al comando nativo y lo limpia; no persistirlo ni registrarlo.

Ese endpoint existente devuelve `{session:{access_token,refresh_token}}`; el nativo guarda ambos en el almacén seguro. **Nunca** devolver esos tokens, el token de aplicación o el JWS offline a React. La interfaz sólo recibe cuenta/estado público y fechas. No reutilizar la conexión de Codex.

Auth es el Supabase configurado en el servicio existente, no un proveedor nuevo. La configuración pública de URL y clave publicable debe fijarse en el cliente autorizado, separada de cualquier clave privilegiada. La renovación se hace por el mecanismo de Auth existente (`/auth/v1/token?grant_type=refresh_token`), conservando los tokens sólo en nativo. Para cerrar Auth, usar su cierre de ámbito **local**; no cerrar otras apps por defecto. Ver documentación oficial de Supabase Auth para desafíos/factores y renovación.

Si la cuenta exige MFA, el cliente debe completar el desafío de Auth antes de crear conexión. El backend rechaza un JWT AAL1 cuando hay factores verificados, y vuelve a comprobar el nivel de la sesión vinculada online. El PIN por sí solo no salta MFA. **NO VERIFICADO:** interfaz nativa, desafíos reales MFA y almacenes seguros de macOS/Windows; corresponden a la implementación de Ultramar.

## Sesión de aplicación

`session.create` acepta **sólo Bearer de Auth**. El servidor llama `getUser`, verifica emisor, audiencia, caducidad, titular y `session_id`; después comprueba en base cuenta, suspensión, límites temporales, sesión única configurada y MFA. La identidad no procede de `datos`, roles o `user_metadata`.

Petición:

```json
{"contrato":"gba.sepia.acceso/1.0","revision":2,"op":"session.create","datos":{"aplicacion":"ultramar","versionApp":"0.1.0","nombreDispositivo":"Mi Mac","dispositivoId":"00000000-0000-4000-8000-000000000001"}}
```

Devuelve `SesionCreada`: token opaco de 32 bytes base64url y `estadoPublico`. Sólo su hash se guarda en servidor, ligado a usuario, aplicación, instalación y sesión de Auth original. No devuelve permiso offline hasta `session.status`.

Para `session.status`, `license.activate` y `session.logout`: Bearer **opaco** de la app; además, encabezados `X-Sepia-Application: ultramar` y `X-Sepia-Device: UUID de instalación`. Se documentan como precisión del transporte, sin alterar los tipos del cuerpo. Esos valores se cotejan con el registro de conexión; no conceden autoridad por sí solos.

Cada comprobación válida renueva siete días de inactividad de conexión. No resucita conexiones vencidas. También se coteja la sesión Auth vinculada y su política actual: su vencimiento o retirada invalida la conexión, aunque el token opaco todavía tenga fecha futura. La app nativa renueva Auth mediante su mecanismo habitual. Una conexión no es un token editorial.

`session.logout` devuelve 204 y revoca sólo la conexión. El cliente completa el cierre local de su propia sesión Auth y elimina sus secretos tras resolver cambios abiertos. La revocación global y la recuperación de GBA ID existentes invalidan todas las conexiones mediante señales de base; la suspensión y baja se comprueban nuevamente.

## Licencias y offline

Producto Sepia separado: códigos de 32 símbolos base32, duración explícita por emisión, inicio en el primer canje, sin suma automática de duraciones. Canje atómico con bloqueo, idempotencia propia con nueva comprobación de revocación/vencimiento y error genérico para otro titular.

El acceso histórico y la excepción de dueño permanecen **sólo en Workspace**. La RPC antigua conserva `active`, `owner_access`, `expires_at`, incluido su centinela anterior, y admite la licencia nueva como alternativa. El canje histórico no acepta códigos nuevos.

Permiso offline: JWS compacto con `alg: Ed25519`, tipo y vínculos del contrato; `exp=min(iat+604800,licencia_exp)` con segundos UTC de servidor. Sólo se firma acceso Sepia vigente. Ausencia/revocación/vencimiento no entrega JWS; el cliente debe descartar cualquier permiso anterior ante una denegación actual. El guardado de recuperación de trabajo ya abierto sigue siendo responsabilidad del cliente y no debe bloquearse por licencia.

## Límites y errores

Cuerpo JSON máximo 16 KiB, esquema estricto, UUID, aplicación permitida y longitudes del contrato. Diez creaciones por origen/minuto; ocho activaciones por cuenta/hora. Los controles del GBA ID existente siguen aplicando al PIN. Sin códigos, PIN, claves, tokens o cuerpos en logs.

Errores: `400 invalid_request/contract_unsupported`; `401 session_invalid`; `403 access_denied/account_suspended`; `422 license_invalid_or_used/license_required`; `429 rate_limited`, con `Retry-After`; `503 service_unavailable`. Toda respuesta de acceso lleva `Cache-Control: no-store`. Un estado válido sin licencia es 200 `requiere_licencia`, sin JWS. No convertir un error de red o un error de servicio en autorización nueva.

## Verificado y pendiente

- Prueba del protocolo: revisión 2 obligatoria, rechazo del flujo anterior, normalización ASCII, firmas y límite exacto de siete días.
- **125 comprobaciones locales** con HTTP, SDK real de Supabase y PostgreSQL/PGlite: conexión nativa, tipos de token, licencia, cuenta, revocación, sesión de origen, MFA incompleto, compatibilidad y permisos directos denegados.
- El arnés local usa Auth firmado de fixture. Además se completaron **62 comprobaciones con GoTrue y PostgreSQL reales** en el proyecto aislado: MFA, canje concurrente, recuperación, refresh y revocación; ver REAL_AUTH_RESULTS.json.
- El prototipo previo de revisión 1 se ensayó en el Supabase aislado y se apagó; **no acredita esta revisión 2**. Se retiraron permisos temporales y sesiones de las tres identidades ficticias.
- Políticas actuales de ambos proyectos comprobadas directamente por Management API; ver AUTH_NATIVO.md y AUTH_POLICY_VERIFIED.json. **Pendientes del cliente:** UI, llavero, reloj nativo y Windows. El acta de publicación informa el estado real de Vercel.

El contrato original corregido y los anexos públicos están en esta carpeta. Los vectores adjuntos son sintéticos, con fecha pasada y clave pública de prueba; no autorizan ninguna cuenta real. El paquete no contiene claves privadas, sesiones ni códigos de licencia reales.
