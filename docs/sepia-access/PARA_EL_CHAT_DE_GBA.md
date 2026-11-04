# Encargo para GBA · acceso nativo · revisión 2

**Corrección de Santiago: el inicio de sesión debe ocurrir dentro de Ultramar,
como en Workspace. No debe abrir el navegador ni una web incrustada para entrar.**
Este encargo y `SEPIA_ACCESO.md`, revisión 2, sustituyen el ZIP anterior
`GBA-servicio-acceso-20261102T232830Z.zip` y la propuesta de emparejamiento por navegador.
No implementar esa propuesta anterior. Licencia nueva de Sepia y siete días offline se conservan.

## Lee primero y trabaja en tu proyecto

Lee las reglas de tu repo de GBA y el contrato adjunto `docs/SEPIA_ACCESO.md`;
los tipos/muestras están en `docs/contratos/sepia-01/`. Inspecciona la integración
real de GBA ID y el mecanismo que permite a Workspace iniciar sesión desde su app.
Documenta lo que realmente existe; no supongas campos, endpoints o permisos.
Trabaja sólo en el entorno autorizado de GBA: no modificar los repos de Workspace
o Ultramar. El cliente nativo y la bienvenida de Ultramar se implementarán en su chat.

## 1. Entrega el contrato real de Auth nativo

Ultramar necesita implementar el mismo flujo de GBA ID que Workspace, con un formulario
dentro de la app. Devuelve un documento `AUTH_NATIVO.md` que precise:

- URL/origen, endpoints, métodos y campos de inicio de sesión. Aclara qué identificador
  acepta GBA ID; no asumir que es correo si usa otro. Indica el mecanismo oficial/SDK
  existente y cómo llamarlo desde un backend nativo de Tauri.
- Validación de credenciales, respuestas públicas y errores, límites de intentos y MFA
  o desafíos si aplican; no entregar tokens/sesión de app hasta completar el nivel requerido.
- Renovación de tokens, expiraciones, cómo comprobar una sesión vigente y cierre sólo
  de esa sesión. Suspensión, baja y revocación global deben cortar acceso en servidor.
- Qué claves/configuración son públicas para el cliente y qué permanece exclusivamente
  en servidor. Entregar nombres de configuración y valores públicos; nunca secretos.
- Casos de recuperación o métodos actuales que no puedan completarse dentro de la app.
  Si existe un impedimento real, documentarlo antes de inventar otro mecanismo o abrir
  un navegador. No crear otra identidad ni un flujo paralelo de contraseñas.

Las contraseñas se capturan sólo para autenticar y no se persisten ni registran. Tokens
de Auth/refresh, token de app y permiso offline se administrarán en el almacén seguro
del backend nativo de Ultramar; no localStorage ni exposición de tokens a React.
La API de licencia no debe recibir contraseñas ni refresh tokens.

## 2. Implementa el servicio de acceso y licencias

- `POST /api/sepia/v1`: operaciones `session.create`, `session.status`,
  `license.activate`, `session.logout`. Todas las peticiones y estados públicos usan
  `contrato: 'gba.sepia.acceso/1.0'` y **`revision: 2`**. Revisión 1 u omitida se rechaza.
- `session.create` valida el Bearer de Auth nativo y la sesión real, cuenta y MFA si aplica;
  deriva el usuario de Auth y crea un token opaco propio por app/dispositivo, guardando
  sólo su hash. Responde `SesionCreada`. No aceptar el token de app como token de Auth.
- Las otras operaciones usan exclusivamente el token opaco de app, con scopes
  `license.read`, `license.activate`, `session.revoke`. Cotejar cuenta y sesión vinculada;
  no conceder textos, asignaciones, roles, aprobación o publicación editorial.
- Una licencia **nueva de Sepia ’01** habilita Workspace y Ultramar. Las históricas y la
  excepción de dueño conservan sólo Workspace. No convertir ni ampliar licencias antiguas.
  Canje atómico e idempotente, con comprobación actual de vigencia/revocación en cada reintento.
- Emisión y revocación del nuevo producto desde la administración autorizada de GBA;
  permisos actuales de servidor. No inventar precios ni duración comercial de los códigos.
- Persistencia privada, RLS, privilegios mínimos, funciones acotadas y validación en ejecución;
  ni user_metadata ni datos de autoridad enviados por el cliente autorizan nada.
- Permiso offline JWS firmado `alg: Ed25519`, `kid` y vínculos del anexo.
  `exp = min(iat + 604800, licencia_exp)`: siete días desde comprobación válida, o vencimiento
  anterior de licencia. No renovar por error de red; denegación conocida invalida permiso previo.
- `GET /api/sepia/v1/offline-keys`: sólo claves públicas y rotación documentada. La privada
  queda en servidor. El permiso offline no es Bearer ni permite obtener otra sesión.
- Conservar la forma y derechos históricos de `workspace_license_status`, incluyendo la
  excepción de dueño sólo en Workspace; incorporar licencia nueva para Workspace sin cambiar
  su repo. El canje histórico no acepta códigos nuevos.

No hay `pairing.start`, `pairing.poll`, página de código/consentimiento ni sondeo para entrar
a Ultramar. La administración web de licencias puede seguir existiendo; es otra función.
El contrato principal prevalece sobre este resumen. Si se necesita cambiarlo, devuelve
una propuesta explícita de revisión, sin alterar perfiles ni algoritmos en silencio.

## 3. Prueba antes de habilitar

Pruebas primero, datos sintéticos y entorno aislado. Verifica HTTP → Auth → base → respuesta,
además de unidades. Probar credenciales inválidas, desafíos/MFA incompletos, refresh expirado,
sesiones revocadas, suspensión/baja, permiso de app equivocado y cierre de una sola app.
Probar canjes concurrentes, otro titular, revocación/vencimiento, límites, lectura/escritura
directa a tablas/RPC denegada y compatibilidad histórica. Probar firma, audiencia y límite
exacto de siete días o vencimiento anterior. La matriz completa está en el contrato.

Mantener el servicio apagado por defecto. No tocar producción ni habilitar rutas antes de
un resultado revisable y la autorización requerida por tu proyecto. No hacer push/publicar
por este encargo. Si falta la señal de revocación global, declararla NO VERIFICADA y pendiente;
no afirmar que está resuelta por comprobar sólo la existencia de una fila auth.sessions.

## 4. Devuelve a Ultramar un ZIP sin secretos

- `ACCESO_IMPLEMENTADO.md`: commit, entorno, URL exacta de API, revisión, estado de cada ruta
  (implementada/probada/desplegada), errores, límites y diferencias frente al contrato.
- `AUTH_NATIVO.md` con todos los detalles del punto 1, para construir el formulario y backend
  nativo sin deducir endpoints ni solicitar contraseñas/tokens al usuario de este chat.
- Tipos/esquemas finales, solicitudes/respuestas JSON sintéticas y casos de error para Auth,
  creación de sesión, activación, estado y cierre. Sin credenciales ni tokens utilizables.
- JWKS/claves **públicas**, `kid` y vectores públicos de verificación por entorno, separados de
  producción. No incluir llaves privadas ni dentro de fixtures. Indicar cómo generar pruebas
  efímeras en ejecución cuando sean necesarias.
- Código y migraciones para revisión, configuración necesaria **sin valores secretos**, y
  pasos de activar/desactivar/revertir sin destruir datos o derechos anteriores.
- Informe con comandos, resultados, fechas y lo **NO VERIFICADO**. Si no está desplegado,
  explicar la prueba local y marcar las URLs como propuestas.

No incluir .env, cookies, JWT vivos, licencias/códigos reales, contraseñas, datos reales o claves
privadas. Los secretos permanecen en su entorno: no transferir credenciales entre chats.
El ZIP volverá al chat de Ultramar para revisar el acuerdo e implementar su acceso nativo,
licencia y bienvenida compacta. El backend por sí solo no declara el producto listo para publicar.
