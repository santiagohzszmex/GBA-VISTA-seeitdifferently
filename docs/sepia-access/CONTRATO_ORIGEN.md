# Acceso GBA ID y licencia compartida · contrato técnico

P1.1a · revisión 2 · 2026-11-02 · `gba.sepia.acceso/1.0`.

**Decisiones de producto confirmadas por Santiago; propuesta técnica para implementar.**
Este documento define el acuerdo entre Ultramar, GBA y el futuro cliente de Workspace.
No es una licencia legal, una publicación ni una certificación de marcas.
Servicio, rutas nuevas, migraciones, cliente y firma offline: **NO VERIFICADO**, todavía sin implementar aquí.
Los tipos y ejemplos son anexos comprobables, no un servidor ni un verificador criptográfico.
Esta revisión sustituye el borrador 1 y su entrega por ZIP: Santiago precisa acceso nativo dentro
de la app, como Workspace. La revisión 1 propuso navegador sin esa confirmación; queda superada.
No cambia la edición comercial ’01. Las peticiones y estados públicos ahora exigen `revision: 2`.

## 1. Decisiones y alcance

- Una **licencia nueva de Sepia ’01**, ligada a un GBA ID, habilita Workspace y Ultramar.
- Una licencia histórica de Workspace conserva su alcance y vencimiento; **no habilita Ultramar**.
  No convertir códigos ni licencias antiguas de forma automática. La excepción existente de dueño
  permanece exclusivamente en Workspace: tampoco concede Ultramar.
- Trabajo local sin conexión por **7 días desde la última comprobación válida**: 604800 segundos,
  o menos si la licencia vence antes. Cada aplicación comprueba su permiso por separado.
- Guardar una copia de los cambios ya abiertos sigue disponible cuando caduque o se revoque el acceso.
- El inicio de sesión nativo ocurre dentro de Ultramar, sin abrir un navegador ni sustituir el
  formulario por una web incrustada. Usar el mismo mecanismo real de GBA ID que Workspace.
- GBA ID identifica a la persona; la licencia habilita el producto. Ninguna de las dos cosas concede
  asignaciones, roles, acceso a textos, aprobación o publicación editorial.
- Dentro de Ultramar, el nombre de Sepia y la edición ’01 aparecen sólo en la bienvenida autenticada.
  Arranque compacto y diseño original; la captura aportada es una referencia funcional.

No se fijan aquí precio, compra, renovación comercial, duración de las licencias vendidas ni cupo de equipos.
No inventar un límite de dispositivos: varias conexiones por cuenta son posibles y revocables por app.
La licencia guarda un vencimiento explícito; no sumar duraciones ni modificarlo desde el cliente.

## 2. Base real observada, sólo lectura

Consulta de metadatos por conectores el 2026-11-02; base local anterior `f5ca99c`, rama `fase-1`.
La evidencia saneada vive en `fase-1/evidencia/P1.1/`; no contiene filas de usuarios, códigos,
licencias o sesiones, correos, claves, variables de entorno ni datos editoriales.

| Observación | Consecuencia para el contrato |
|---|---|
| Vercel asocia `gba.software`, `www.gba.software` y `vista.gba.software` con `gba-vista-seeitdifferently` | Se propone `https://gba.software` como origen. Esto no acredita ninguna ruta nueva. |
| `public.workspace_licenses`: `user_id`, `code_id` único, `starts_at`, `expires_at`, `revoked_at`; RLS activada | Conservar el producto histórico. No cambiar su significado para que ahora sea Sepia. |
| `workspace_private.license_codes`: hash único, duración, destinatario opcional, emisión, canje y revocación | Crear un espacio propio para nuevos códigos; impedir el canje cruzado entre productos. |
| `workspace_license_status()` devuelve `active`, `owner_access`, `expires_at` | Preservar esa forma para los clientes instalados. |
| `workspace_activate_license(text)` bloquea el código, limita intentos y usa hash | Mantener la exclusión de canjes; la nueva activación también debe comprobar revocación y vigencia al reintentar. |
| `workspace_private.session_active()` coteja identidad, fila de sesión y suspensión | Es una parte del control: no demuestra por sí sola firma, caducidad, inactividad y todas las políticas de Auth. |
| Política `license_read`: sesión vigente y licencia propia o permiso `platform.manage` | No convertir una lectura administrativa en autorización de Ultramar para el administrador. |

El catálogo marca RLS desactivada en los códigos históricos del esquema privado; no se evaluó
todo su perímetro de exposición/permisos y no se atribuye RLS a esa tabla. El diseño nuevo sí la exige.
Se inspeccionaron catálogos, definiciones de tres funciones y permisos de ejecución; no se ejecutó
ninguna función de emisión, activación ni revocación. No se inspeccionaron claves, configuración
privada del despliegue ni todo el perímetro de Auth; esto **no es una auditoría de producción**.

## 3. Tres autorizaciones independientes

| Nivel | Autoridad | Lo que permite |
|---|---|---|
| GBA ID | Auth nativo y estado actual de cuenta | Identificar al titular y crear su conexión de escritorio tras completar autenticación y MFA si aplica. |
| Sesión de app + licencia | Servicio de acceso | Estado y activación de licencia propia; uso local autorizado del producto. |
| Puente editorial 1.7.5 | Workspace, por asignación y operación | Lectura o entrega explícita según RBAC, revisión, cuota y origen. |

El puente `gba.workspace.ultramar/1.0`, revisión 1, sigue siendo otro contrato.
[FuenteWorkspace](FUENTE_WORKSPACE.md) conserva su simulador y sus límites: no reutilizar su
emparejamiento como si fuera un login general ya implementado. No usar una conexión de Codex como
credencial de la app. No guardar un JWT de Auth o una clave privilegiada en React.

El servidor decide sobre identidad y permisos actuales; nunca sobre `user_id`, roles, vencimiento,
`active` o `user_metadata` enviados por el cliente. Al crear la conexión debe validar el token
con Auth, firma/emisor/audiencia/caducidad, sesión y políticas temporales, y suspensión actual.
La existencia de `auth.sessions` sola es insuficiente para acreditar todo ese ciclo.
Referencia: [sesiones de Supabase](https://supabase.com/docs/guides/auth/sessions), consultada 2026-11-02.

## 4. Inicio de sesión nativo con GBA ID

El inicio de sesión nativo se presenta y completa dentro de Ultramar, igual que el flujo de
Workspace descrito por Santiago. No requiere navegador, código de emparejamiento o consentimiento web.
El mecanismo real de Workspace, sus campos y endpoints de Auth están **NO VERIFICADOS** en este
repo: el chat de GBA debe inspeccionar su integración y devolver el contrato nativo efectivo.
No suponer que el identificador es correo ni inventar un endpoint nuevo para contraseñas.

1. Ultramar muestra su formulario nativo dentro de la ventana compacta. El mecanismo de GBA ID
   recibe las credenciales por la integración nativa existente, mediante TLS y el origen de Auth
   autorizado. No enviarlas a la API de licencia ni a una URL recibida libremente del servidor.
2. La capa nativa gestiona autenticación, MFA/desafíos si la cuenta los exige, renovación y cierre.
   No crear otra cuenta, bajar el nivel de autenticación ni convertir un desafío pendiente en éxito.
   Si algún método actual exige redirección externa, GBA debe resolver su alternativa nativa y
   documentarla antes de habilitarlo; no abrir navegador ni una web incrustada como sustituto.
3. Credenciales introducidas sólo transitan de la entrada al backend nativo para autenticar;
   no persistir la contraseña ni registrarla. Tokens de Auth y refresh se conservan en el almacén
   seguro nativo; React recibe el estado público, nunca los tokens devueltos por Auth.
4. Tras autenticación completa y MFA, el nativo crea un `dispositivoId` aleatorio guardado en el
   almacén seguro (sin serie de hardware) y pide `session.create` con el access token de Auth
   en Authorization. Versión, app y dispositivo son datos de la petición, no autoridad de usuario.
5. GBA valida firma/emisor/audiencia/caducidad y sesión real de Auth, políticas temporales, cuenta
   actual y nivel de autenticación requerido. Identidad de la conexión deriva exclusivamente de Auth.
   Devuelve un `tokenAplicacion` opaco de 256 bits y el estado público; guarda sólo el hash del token,
   ligado a titular, app, dispositivo y sesión de Auth nativa de origen.
6. Con ese token, el nativo llama `session.status` y obtiene el permiso offline firmado si la licencia
   es válida. Si no tiene licencia, muestra activación dentro de la app. Sólo después va a bienvenida.

Cada app tiene su sesión de Auth, conexión, token y permiso propios: no copiar el token de Workspace
a Ultramar. Permisos del token de app: `license.read`, `license.activate`, `session.revoke`.
No se trata de la sesión/capacidad editorial de una asignación ni de una conexión de Codex.

La conexión vence por siete días de inactividad; una comprobación autenticada válida renueva
`venceEn` a `servidorUtc + 604800 s`, sin resucitar una conexión ya vencida. La renovación de Auth
se hace por su mecanismo nativo real; no intercambiar un permiso offline por tokens nuevos.
Al comprobar online, validar también la sesión de Auth vinculada y sus políticas actuales, no sólo
la vigencia del token de app. Suspensión, baja y revocación global de GBA ID invalidan conexiones.
Integrar y probar esa señal, la renovación y los ámbitos del cierre con GBA; no declararlos existentes
por haber definido este contrato. Cerrar una app no debe cerrar otras sesiones o equipos.

`dispositivoId` liga el permiso a una instalación, pero no prueba hardware ni evita por sí solo
el robo de un almacén seguro. No prometer resistencia a un cliente modificado.

## 5. Transporte propuesto y tipos

**Rutas propuestas, NO VERIFICADO en producción.** El origen está asociado en Vercel;
no se ha comprobado su enrutamiento ni desplegado código.

`POST https://gba.software/api/sepia/v1`, JSON UTF-8; `revision: 2` es obligatorio.
El nombre del contrato conserva 1.0 porque sigue siendo un borrador no implementado; el servidor
rechaza revisión 1 u omitida con `contract_unsupported`, sin activar el flujo anterior.

```json
{"contrato":"gba.sepia.acceso/1.0","revision":2,"op":"session.status","datos":{}}
```

| Operación | Credencial | Resultado |
|---|---|---|
| `session.create` | Bearer de Auth nativo ya autenticado, con MFA si aplica | 200 `SesionCreada`: token propio de app y estado público. |
| `session.status` | Bearer opaco de app | 200 `EstadoNativo`; renueva conexión y permiso sólo tras comprobaciones actuales. |
| `license.activate` | Bearer opaco de app; código en cuerpo | 200 `EstadoNativo` recalculado después de canjear. |
| `session.logout` | Bearer opaco de app | 204; revoca sólo esa conexión. Un token ya revocado obtiene 401. |

`GET /api/sepia/v1/offline-keys` entrega sólo claves públicas, nunca una clave privada.
Los endpoints de Auth nativo, su identificación de GBA ID, desafíos/MFA, refresh, errores y cierre
los documentará GBA a partir de su implementación real; no están fijados como rutas nuevas aquí.
En la revisión 2 no existen operaciones `pairing.*`, ruta de consentimiento ni URL de verificación.
La administración de licencias en la web puede mantenerse: no es el acceso del usuario a Ultramar.

Los [tipos](contratos/sepia-01/acceso.d.ts) separan perfiles, DTO público y secretos nativos;
las [muestras](contratos/sepia-01/ejemplos.ts) son sintéticas. El perfil histórico sólo admite
`aplicacion: 'workspace'`. `aud` debe corresponder con `aplicacion` también en el tipo del permiso.
Los tipos no validan JSON recibido: ambos servidores/clientes necesitarán validadores en ejecución.
El Bearer de Auth sólo se acepta en `session.create`; el opaco sólo en las otras operaciones.
Una credencial válida para un tipo de operación no sustituye a la otra.

Límite de cuerpo 16 KiB; esquema estricto, ids UUID, enteros para tiempos Unix, fechas ISO UTC,
`versionApp` hasta 64 caracteres y nombre de equipo hasta 80. No aceptar campos de autoridad ajenos.
Token de app: base64url de 32 bytes. No incluir tokens ni contraseñas en cuerpos de la API de licencia.
El código de licencia nuevo tiene 32 símbolos aleatorios base32 (160 bits), grupos de cuatro para mostrar;
se normaliza sólo quitando espacios/guiones y pasando a mayúsculas ASCII, luego valida longitud/alfabeto.
No aceptar el formato histórico como licencia nueva. Usar parámetros SQL, nunca concatenación de entradas.

Todo estado/respuesta de autenticación lleva `Cache-Control: no-store`. No seguir redirecciones
con Authorization ni enviarlo fuera de los orígenes fijos permitidos. Los registros contienen evento,
resultado, fecha UTC e id de correlación; sin cuerpos, códigos, tokens ni nombres de archivos.
Límites iniciales de ingeniería: 8 activaciones por cuenta/hora y 10 creaciones de sesión por
origen/minuto, además de los controles reales de Auth para intentos/desafíos. Medir y probar antes
de habilitar; son parámetros propuestos, no capacidad observada. Si aplica CORS, no autorizar
orígenes arbitrarios; las operaciones de licencia se llaman desde el backend nativo.

| HTTP / código | Semántica |
|---|---|
| 400 `invalid_request`, `contract_unsupported` | Petición inválida o revisión incompatible; no intentar otra revisión en silencio. |
| 401 `session_invalid` | Auth o conexión inválidos, vencidos o revocados; borrar autorización local conocida. |
| 403 `account_suspended`, `access_denied` | Rechazo actual o autenticación incompleta; no pasar a offline para eludirlo. |
| 422 `license_invalid_or_used` | Código inválido, vencido, revocado o de otra persona; respuesta genérica. |
| 429 `rate_limited` | Respetar `Retry-After`, sin renovar plazo offline. |
| 503 `service_unavailable` | Reintento acotado; sólo un permiso previo válido puede autorizar trabajo offline. |

`session.status` con cuenta válida sin licencia responde 200 `requiere_licencia`; no envía permiso offline.
Vencida o revocada borra el permiso previo, incluso si aún no terminaban sus siete días.
Errores usan `ErrorApi`; UI muestra texto propio, nunca HTML o instrucciones del servidor.
Una respuesta desconocida, cuerpo inválido o TLS inválido no constituye una comprobación válida.

## 6. Licencias y persistencia propuesta

Diseño lógico, **sin SQL aplicado ni migración creada**. No alterar las tablas históricas para este canje.
Crear un esquema no expuesto `sepia_private`; tablas con RLS como defensa adicional, sin permisos
para lectura/escritura directa de `anon` o `authenticated`. Acceso por funciones estrechas de servidor;
propietario técnico sin login y privilegios mínimos. No cambiar privilegios globales del esquema `public`.

| Registro | Datos e invariantes mínimos |
|---|---|
| `license_codes` | UUID PK, hash único, edición `01`, duración positiva, destinatario opcional ligado a Auth, emisión/canje/revocación con fecha UTC. |
| `licenses` | UUID PK, titular Auth, código único, edición `01`, inicio y vencimiento `timestamptz`, `expires_at > starts_at`, revocación nullable. |
| `desktop_connections` | Hash de token único, titular, app, dispositivo, vencimiento, última comprobación, sesión Auth nativa de origen, revocación y versión de revocación global. |
| Auditoría de emisión/canje/revocación | Actor validado, ids de objetos, tiempo y motivo; sin código, token ni contenido editorial. |

Índices de titular/vigencia para consulta y claves foráneas de propietario/código; unicidad para impedir
canjes paralelos. La activación bloquea el código y comprueba destinatario, revocación y plazos dentro
de una transacción corta, sin llamadas de red bajo el bloqueo. Un canje repetido por el mismo titular
es idempotente **pero vuelve a comprobar vigencia/revocación**; no resucita una licencia ni extiende su fecha.
Otro titular recibe el error genérico. La licencia se inicia al primer canje con tiempo del servidor.
Varias licencias vigentes no se suman; elegir la de vencimiento mayor y ligar el permiso a su id concreto.

Rutinas administrativas nuevas sólo desde la web autorizada de GBA. Verificar `platform.manage`
actual y cuenta activa; ningún scope de escritorio permite emitir/revocar licencias ajenas.
Funciones privilegiadas: nombres de objeto calificados, `search_path` fijo seguro, sin SQL dinámico
por entradas del cliente, revocar EXECUTE predeterminado de PUBLIC y conceder sólo al rol de servidor
necesario. Las rutas nunca confían en un `user_id` que mande la app.
Separar privilegios de lectura, canje y administración; probar acceso directo denegado.
Guía: [RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), consultada 2026-11-02.

La transición de Workspace debe conservar la forma y semántica histórica de `workspace_license_status`
(`active`, `owner_access`, `expires_at`) y añadir el nuevo producto como alternativa para **Workspace**.
`owner_access` sólo conserva su excepción anterior; la fecha centinela del dueño no es una nueva licencia
perpetua de Sepia. Si coinciden permisos históricos y nuevos, Workspace conserva el mayor acceso válido
que ya tenía; Ultramar evalúa exclusivamente la licencia nueva. No cambiar las RPC de canje/emisión
históricas para aceptar códigos nuevos. La compatibilidad debe probarse con un cliente antiguo aislado.

## 7. Permiso firmado para trabajo offline

Se emite sólo tras autorización actual: cuenta habilitada, conexión vigente, licencia nueva vigente y
no revocada. Sólo para el producto nuevo; no ampliar por este contrato el modo offline histórico de Workspace.

`iat = nbf = servidorUtc` en segundos enteros; `exp = min(iat + 604800, licencia_exp)`.
La conexión se renueva simultáneamente al menos hasta ese `exp`. Al llegar a `exp` deja de autorizar,
no hay día adicional de cortesía ni tolerancia que extienda el vencimiento de la licencia.
Los [ejemplos](contratos/sepia-01/ejemplos.ts) incluyen una semana completa y una licencia que vence al día siguiente.

Formato JWS compacto, encabezado protegido `{ alg: 'Ed25519', typ: 'gba-sepia-offline+jwt', kid }`.
Algoritmo fijo Ed25519, clave pública OKP/Ed25519; no negociar otro algoritmo por petición del token.
Referencia: [JWS RFC 7515](https://www.rfc-editor.org/rfc/rfc7515) y
[algoritmos específicos RFC 9864](https://www.rfc-editor.org/rfc/rfc9864), consultados 2026-11-02.
RFC 9864 actualiza el identificador polimórfico EdDSA de RFC 8037: probar el soporte explícito
`Ed25519` en las bibliotecas elegidas; no cambiar a otro perfil en silencio.
No se eligió ni instaló dependencia criptográfica en P1.1.

Payload: `iss`, `aud`, `sub`, `jti`, conexión, dispositivo, producto, edición, licencia, app,
`iat`, `nbf`, `exp`, `licencia_exp`, según `PermisoOffline`. Validar firma y **todos** esos vínculos,
`exp > iat`, `nbf == iat`, `exp <= iat + 604800`, `exp <= licencia_exp`, fechas enteras y reloj confiable.
No aceptar sólo `active: true`, JSON sin firma, `alg: none`, un `kid` desconocido o URLs `jku/x5u` del token.
Claves públicas iniciales fijadas en cliente, rotación desde el origen permitido con TLS válido;
un `kid` desconocido requiere conexión y validación de la lista. La clave privada vive sólo en servidor.
La rotación conserva claves anteriores al menos hasta caducar sus permisos; una retirada conocida
invalida el permiso, pero no puede notificarse instantáneamente a un equipo desconectado.

Nativo conserva token, permiso, instalación y anclas de tiempo en el almacén seguro del sistema.
No en localStorage, preferencias planas, caché, `.ultramar`, logs ni repositorio. React recibe sólo
el estado público y fecha límite, nunca el JWS, token o código de canje después de entregarlo al nativo.
macOS: llavero del sistema; Windows: mecanismo seguro equivalente a concretar/probar en su tarea.
Permisos de Tauri limitados a la ventana local y comandos específicos, sin un comando de lectura genérica
que permita recuperar secretos. Las dependencias futuras requieren revisar su LICENSE real.

Conservar tiempo del servidor, máximo tiempo local observado y reloj monotónico que incluya suspensión.
Al reiniciar, contrastar el reloj de pared con las anclas persistidas; si retrocede o no se puede
acreditar el plazo, exigir conexión. Adelantar el reloj puede acortar acceso; no alargarlo después.
Reinstalar/borrar almacén o restaurar una copia vieja no concede otro plazo: sin ancla confiable, reconectar.
Esto es una condición que debe probarse, **NO VERIFICADO** como defensa contra alteración del equipo.
No se promete acreditar tiempo absoluto frente a un sistema operativo o llavero deliberadamente
comprometido; las pruebas normales de reloj/reinicio no demostrarían esa resistencia.

Comprobar al iniciar, reanudar, recuperar foco y cada 60 segundos cuando hay red; reintentar errores
con espera creciente, máximo cinco minutos. Renovar sólo con respuesta válida de servidor.
Un error de red no amplía el plazo. Una denegación actual, cierre de sesión o retirada de clave conocida
invalida la autorización local de inmediato. Sin red, una revocación remota puede tardar hasta la
reconexión o el vencimiento en conocerse: es el límite aceptado de los siete días offline.
El permiso offline no sirve como Bearer ni permite activar licencias, consultar o enviar a Workspace.

## 8. Inicio, bienvenida y conservación de archivos

| Estado | Vista y acción |
|---|---|
| Comprobando / sin conexión válida | Ventana compacta inicial **560 × 440** puntos lógicos; logo Ultramar, acceso GBA ID y estado claro. No abrir el editor vacío enorme. |
| Autenticación nativa / desafío | Formulario GBA ID dentro de la app, MFA si aplica, progreso, error y cancelar; sin apertura del navegador. |
| Cuenta válida sin licencia | Activación con código y estado; no inventar compra o enlace comercial todavía inexistente. |
| Autorizado online u offline | Bienvenida propia aproximada **820 × 560**: logo original, **Sepia ’01**, Crear documento, Abrir… y recientes reales. Indicar el plazo offline si aplica. |
| Documento elegido/creado | Editor con tamaño normal actual, separado de la bienvenida; sólo identidad Ultramar. |
| Revalidación rechazada o vencida | Detener nuevas ediciones/aperturas/exportaciones; conservar documento, historial y originales abiertos; permitir ver y Guardar copia. |

La apertura inicial por archivo o reciente también pasa por autorización antes de cargarlo al editor.
Nunca borrar o cifrar documentos por licencia, revocar archivos locales o forzar un cierre con cambios.
Si se pierde acceso durante una edición, no desmontar el editor: ofrecer guardar copia primero y luego
volver al acceso. El guardado de recuperación no depende de un servicio de red ni de tener licencia vigente.
Salir, cerrar ventana, cerrar sesión y cancelar mantienen la protección contra pérdida de F1.14.

Recientes: sólo archivos realmente abiertos/guardados con autorización nativa; título y fecha derivados,
sin documentos ficticios ni archivos del equipo en el repo. Una entrada inexistente se puede quitar de
la lista sin borrar el archivo. Evitar entregar rutas arbitrarias a comandos de sistema; usar referencias
opacas del backend nativo como en el guardado actual. No enviar nombres o rutas al servicio de licencia.

Retirar Sepia del editor y Acerca al implementar P1.2; el logo será el original de Ultramar.
La edición comercial ’01, la versión técnica de Ultramar y Workspace 1.7.5 son valores distintos.
Acerca puede mostrar versión técnica de Ultramar, sin identidad de suite. Esto no exige cambiar avisos
legales de terceros ni el historial técnico de documentos. Diseño y nombres propios; no copiar recursos,
composición ni comandos particulares del producto mostrado como referencia.

Cerrar sesión requiere resolver cambios abiertos antes de borrar secretos; revoca la conexión
actual y su sesión de Auth nativa correspondiente, elimina su permiso local y no cierra otras apps.
El adaptador de Auth debe usar cierre local/de esa sesión, nunca un cierre global implícito.
Sin red, el cierre local elimina secretos
inmediatamente; la revocación remota queda pendiente, sin afirmar que ya ocurrió. Debe advertirse ese
estado y permitir revocar la conexión al recuperar acceso. No persistir el token fuera del
almacén seguro para reintentar. La revocación global es otra acción explícita.

## 9. Pruebas de aceptación para implementación

Los anexos comprueban coherencia documental, perfiles y tipos; **no** acreditan estos flujos.
Todos los siguientes permanecen **NO VERIFICADO** hasta implementar servicio y cliente con datos sintéticos:

| Caso | Resultado exigido |
|---|---|
| Sin licencia / histórica / nueva Sepia | Ultramar niega / niega / permite; Workspace conserva sus derechos históricos y acepta la nueva. |
| Dueño sin nueva licencia | Conserva Workspace; no salta la licencia en Ultramar. |
| Vencida, revocada, cuenta suspendida o borrada | Denegación actual y descarte del permiso anterior; guardar copia abierta siempre posible. |
| Canje simultáneo, reintento propio y otro titular | Una sola licencia; fecha estable; otro titular sin información adicional. |
| Canje revocado después del primer éxito | No resucita la licencia aunque el canje sea idempotente. |
| Inicio nativo con credenciales erróneas, desafíos o MFA pendiente | Sin sesión de app hasta completar Auth; límites y errores claros dentro de Ultramar. |
| App/origen o revisión desconocidos; token de tipo incorrecto | Rechazo; no aceptar el flujo del borrador 1 ni exponer secretos. |
| Token de otra app, otro titular o instalación | Rechazo, sin acceso editorial ni acceso directo a tablas privadas. |
| JWT vencido, refresh inválido, sesión Auth expirada o revocación global | No crear ni renovar conexión afectada; reautenticar dentro de la app. |
| Licencia menor a siete días; instante exacto `exp` | Corta al menor límite, conservando guardado abierto. |
| Red caída, 429/503, JSON inválido, TLS inválido | Sin renovación; sólo permiso previo válido dentro del plazo. |
| Reinicio, suspensión larga, reloj atrás/adelante, copia de almacén | Nunca extender los siete días; ante incertidumbre, pedir conexión conservando cambios. |
| JWS alterado, algoritmo/audiencia/app/clave incorrectos | Rechazo en nativo; ningún secreto visible en IPC de interfaz, logs o documento. |
| Revocación remota mientras está offline | Acceso hasta límite conocido; al reconectar no conserva una autorización rechazada. |
| Cerrar sesión sin red o con documento sucio | Guarda/permite cancelar, elimina permiso local; no declara revocación remota exitosa. |
| Cliente antiguo de Workspace | Forma anterior de status, canje antiguo y derechos anteriores sin regresión. |
| Bienvenida, activación y editor reales | Tamaños/usabilidad, identidad de suite sólo en bienvenida, recientes y protección de cambios. |

Windows será probado por separado con OpenCode/DeepSeek según Santiago, usando esta revisión y
los mismos casos, sin secretos ni datos reales. Registrar versión del sistema, almacén seguro, capturas
propias y resultados con fecha; no atribuir al Mac pruebas de Windows. Equipos de 8 GB siguen pendientes.

## 10. Secuencia de entrega

1. **P1.1/P1.1a:** contrato y corrección a inicio nativo, anexos y evidencia; revisión 2 vigente.
2. Servicio GBA en su entorno autorizado: migración revisada, prueba aislada de RLS/roles/canje,
   sesiones, firma, revocación y compatibilidad; rutas apagadas por defecto hasta pasar criterios.
3. **P1.2:** cliente de Auth nativo/UI de Ultramar, llavero, validación de JWS/reloj, inicio y archivos reales.
   Implementar contra el contrato y probar flujo completo; no introducir un login ficticio de producto.
4. Cambios en Workspace en su propio entorno y ensayo conjunto, después Windows y distribución.

No hay cambios de producción, credenciales, nuevas dependencias, publicación, push ni cambios a otro
repositorio en P1.1/P1.1a. Fase 1 conserva su cierre técnico; esto no declara el producto listo para distribuir.
El [plan](FASE_1_TAREAS.md) registra los siguientes trabajos y sus límites.
Antes del servicio, revisar la compatibilidad TLS de los clientes: el aviso de Supabase retira cifrados
CBC heredados desde 2026-11-10; no se cambia configuración aquí.
Fuente: [aviso oficial](https://supabase.com/changelog/cbc-tls-ciphers-deprecated), consultado 2026-11-02.
