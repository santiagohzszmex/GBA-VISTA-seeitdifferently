# Auth nativo efectivo · revisión 2

## Entornos y configuración pública

- Producción: GBA `https://gba.software`; Auth `https://wgihpztgwsovhykboyru.supabase.co`.
- Ensayo aislado: Auth `https://ojlcttpqkyktqpqybbdy.supabase.co`; nunca usar sus identidades ni claves como producción.
- Distribución pública prevista: **GET `https://gba.software/api/sepia/v1/config`**. Devuelve revisión, origen fijo de API, URL Auth y clave publicable; rechaza exponer una clave privilegiada. El cliente fija esa URL HTTPS, valida contrato/revisión y los orígenes permitidos; no sigue redirecciones llevando Authorization. La entrega final incluye la configuración pública obtenida del despliegue, no un .env.

## Políticas verificadas

Se leyeron directamente mediante Management API, con la sesión existente de Supabase CLI, sin modificar nada. En ambos proyectos: JWT 3600 segundos; timebox 0 (sin límite adicional); inactividad 0 (sin límite adicional); sesión única false. TOTP habilitado para enrolar/verificar; teléfono deshabilitado. Evidencia saneada: `AUTH_POLICY_VERIFIED.json`.

El servicio vuelve a validar fila, `not_after`, cuenta/suspensión y MFA; aplica también esas políticas y las verifica por entorno antes de habilitar su interruptor. El valor cero procede de la configuración real. La conexión de Sepia tiene su propio límite de siete días de inactividad, independiente del JWT.

## GBA ID y PIN dentro de Ultramar

1. El comando nativo recibe `handle`, PIN **string** de cuatro dígitos y UUID aleatorio de instalación. No cambia GBA ID por correo ni añade otro proveedor. No persistir PIN ni devolver tokens a React.
2. Envía JSON a **POST `https://gba.software/api/gba-id`**: `{action:"login",handle,pin,device}`. Endpoint existente, incluido en el arnés para revisión. Producción permite el backend nativo sin Origin; no es un formulario web incrustado.
3. Éxito: 200 `{session:{access_token,refresh_token}}`. Los dos valores van directamente al almacén seguro del sistema. Error de datos: 400 `{error:"Datos inválidos"}`; PIN/ID incorrectos: 401 genérico; demasiados intentos: 429 y Retry-After; fallo de servicio: 503 genérico. No convertir ningún error en éxito ni registrar respuestas con secretos.
4. Consultar el usuario de Auth con el JWT y la clave publicable fijada: GET `{authUrl}/auth/v1/user`. Si hay factores verificados, completar TOTP antes de crear la conexión de aplicación. El backend rechaza AAL1 si la cuenta tiene un factor verificado.
5. Para un factor existente: POST `{authUrl}/auth/v1/factors/{factorId}/challenge`, luego POST `{authUrl}/auth/v1/factors/{factorId}/verify` con `challenge_id` y `code`, ambos con Bearer de Auth y `apikey` público. Conservar los tokens AAL2 resultantes sólo en nativo. No inventar un bypass si el desafío falla. Los ejemplos HTTP no contienen códigos vivos ni secretos TOTP.
6. POST `/api/sepia/v1`, revisión 2, `session.create`, con **Bearer Auth**; devuelve token opaco de aplicación y estado público. Se vincula con `session_id` real, aplicación e instalación. El cuerpo no decide el titular.
7. `session.status`, `license.activate`, `session.logout` usan **Bearer opaco** y encabezados `X-Sepia-Application`, `X-Sepia-Device`. El estado de licencia no otorga permisos editoriales.

## Renovación y cierre

Auth se renueva con POST `{authUrl}/auth/v1/token?grant_type=refresh_token`, `apikey` público y `{refresh_token}`. Sustituir de forma atómica el access/refresh token en el almacén seguro, respetando su rotación. La sesión de origen conserva su id en el flujo real comprobado. Un refresh rechazado o una sesión retirada requieren autenticación nueva; el permiso offline no es un refresh token.

Cerrar primero la conexión con `session.logout` y la sesión Auth correspondiente con POST `{authUrl}/auth/v1/logout?scope=local` (Bearer Auth y apikey). Resolver cambios abiertos y borrar los secretos nativos de esa app; no usar el ámbito global por defecto. La recuperación y la acción global explícita de GBA ID invalidan las conexiones. Guardar copia del documento abierto sigue siendo posible sin licencia.

## Evidencia y límites

GoTrue real: login/PIN por el gateway existente, getUser, refresh, TOTP y AAL1 rechazado/AAL2 aceptado; conexión nativa vinculada; canje concurrente e idempotencia; RPC antigua; revocación de licencia; recuperación GBA ID; revocación global y cierre Auth local. Resultado: `REAL_AUTH_RESULTS.json`, 62 comprobaciones.

No se han implementado ni certificado aquí la UI nativa de Ultramar, el llavero/reloj de macOS/Windows o la distribución de su instalador. Eso corresponde a su cliente. Las pruebas del servidor no acreditan esa parte.
