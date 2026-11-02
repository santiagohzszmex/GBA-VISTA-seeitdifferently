# Workspace 1.7.1.4 · Avisos y lectura

## Problema y corrección

Una consulta pendiente podía devolver el estado anterior después de marcar avisos. El cliente ahora invalida esas consultas y el servidor devuelve en la misma operación un nuevo inbox autorizado. Cada aviso tiene «Marcar como leída» sin abrir; «Marcar todas como leídas» conserva los avisos posteriores al corte consultado. Un error conserva el estado anterior y se muestra dentro del panel. La app también consulta minimizada, además de al recuperar el foco.

## Avisos con Workspace cerrado

Web Push estándar, activación voluntaria por navegador desde `https://gba.software/workspace/web/?device-notifications=1`. En la app, Campana → Avisos en el dispositivo → Configurar en el navegador. Después de iniciar sesión en la web: activar y permitir los avisos. En Safari/macOS Ventura o posterior, Safari tampoco necesita estar abierto. Otros navegadores pueden requerir actividad en segundo plano. Permisos del sistema y No molestar siguen aplicando. No se instala ningún proceso oculto.

El mensaje del sistema es genérico; no contiene títulos ni texto de documentos. Al pulsarlo abre una ventana nueva de Workspace web, exige la sesión y resuelve el acceso con el RPC existente. Nunca redirige un editor que pueda tener un borrador sin guardar. El dispositivo sólo recibe avisos creados después de activarlo, sin inundarlo con los anteriores. Probar encola un aviso propio, como máximo uno por minuto.

Las suscripciones son privadas, ligadas a usuario y sesión reales. Hasta ocho dispositivos; pueden retirarse desde cualquier sesión del dueño. El servicio revalida sesión, suspensión, membresía y visibilidad original antes de enviar. Se retiran endpoints caducados; no se transfieren entre cuentas. Una licencia vencida de escritorio y una membresía web son ámbitos distintos: el canal usa la sesión web y sus accesos vigentes, sin conceder licencias.

## Runtime

- `workspace_device_notifications`: tablas privadas con RLS sin acceso de clientes, preferencias propias, cola, cancelación de avisos leídos y respuesta de lectura confirmada.
- `workspace_push_runtime`: pg_cron y pg_net; una tarea por minuto prepara recordatorios por usuario activo y llama únicamente a `/api/workspace-push` cuando hay cola. Se omiten fechas de ediciones cerradas. La clave del drenaje se genera dentro de Vault y sólo se guarda su hash en la configuración privada.
- Vercel: claves VAPID pública/privada sólo para el servidor, nunca VITE. Se conserva la clave Supabase existente. El endpoint GET sólo expone la clave pública; POST exige el token privado del drenaje y RPCs exclusivos de service_role. Lotes de doce, concurrencia tres, lease de dos minutos, cinco intentos y reintentos acotados. HTTPS y proveedores de push permitidos se validan en SQL y otra vez en el servidor.
- Sin título/cuerpo/endpoint/credenciales en logs. Trabajos terminados y logs de esta tarea se conservan siete días; suscripciones revocadas treinta días. pg_net tiene su propia retención de respuestas.

## Verificación / límites

Pruebas de carrera y cancelación en el cliente; envío simulado, origen y privacidad del worker; aislamiento y sesiones en PGlite. Producción: comprobar definiciones, privilegios, tarea activa, configuración de secreto y estado de cola. No se crean usuarios, ediciones ni suscripciones de prueba en producción. La recepción real en un dispositivo requiere que su dueño permita y active los avisos y pulse Probar; no se presenta una simulación como recepción física verificada.

La entrega es de mejor esfuerzo: conexión, proveedor y ajustes del dispositivo pueden retrasarla. La bandeja dentro de Workspace sigue siendo la fuente de avisos. Esta versión no envía contenido privado en una pantalla bloqueada.

## Reversión

Desactivar primero `workspace-device-notifications` en cron. Retirar el endpoint de drenaje o sus claves VAPID impide nuevos envíos sin perder la bandeja ni documentos. Se puede volver a publicar la web anterior, que acepta la respuesta de lectura ampliada. No borrar tablas de usuarios ni restaurar la matriz RBAC. Al retirar definitivamente el canal, revocar suscripciones y secreto de Vault en una migración revisada; no imprimirlo.

## Fuentes técnicas

- [WebKit: Web Push y Safari cerrado](https://webkit.org/blog/12945/meet-web-push/).
- [Supabase pg_net](https://supabase.com/docs/guides/database/extensions/pg_net), [Cron](https://supabase.com/docs/guides/cron/quickstart).
- [Tauri opener y permisos por URL](https://v2.tauri.app/plugin/opener/).

## Evidencia local del 1 de noviembre de 2026

- `node tests/workspace.test.mjs`: 923 comprobaciones; 36 específicas de suscripciones, aislamiento, cuotas, expiración de sesión y runtime con transporte simulado.
- `node tests/notification-delivery.test.mjs`: carreras del marcado, nuevos avisos después del corte, descarte al salir, autorización y transporte push, origen seguro del worker.
- `npm run test:desktop`: aprobado. `npm run build`: aprobado.
- Vista local de demostración: marcado individual deja «Estás al día», desactiva marcado global y conserva el documento abierto. No hubo suscripciones ni mensajes reales en producción.
- Santiago autorizó expresamente guardar las claves VAPID en el proyecto de producción `gba-vista-seeitdifferently`, aplicar ambas migraciones y publicar web y macOS. Configuración Vercel realizada: pública como Config, privada como Sensitive, sólo producción.
- Ambas migraciones aplicadas en `wgihpztgwsovhykboyru`. Confirmado RLS de las tres tablas privadas, sin lectura de authenticated; funciones de drenaje sólo service_role y tarea privada. Hash de matriz antes/después: `48d27bf1ebdff19ede7fe1f56f58cfed`, sin cambios de rangos.
- Cron activo cada minuto; ejecuciones con estado `succeeded`. Drenaje real servidor a servidor con cola vacía: HTTP 200, cero procesados, enviados y fallidos. Sin cuentas, ediciones ni suscripciones ficticias en producción.
- Web de producción READY: `dpl_5v5vG53RqonTcZ3mN4P61AimgfhJ`, código `2494f0b4e7c1dff7d83bd1238cb40082c5c6bb88`. GET de configuración habilitado, POST sin credencial rechazado con 401, worker servido idéntico al fuente. La clave privada no se devuelve al navegador.
- Advisors: las tres tablas privadas sin políticas de lectura son intencionales y están revocadas a clientes; el RPC de preferencias SECURITY DEFINER es intencional y exige sesión y propiedad. No se abrió ninguna tabla ni se modificaron las advertencias heredadas ajenas a esta actualización.
- Recepción física en un dispositivo: NO VERIFICADA; requiere que su dueño active y permita las notificaciones y use Probar. El ensayo del servidor no se presenta como recepción física.

## Publicación de escritorio

- Código publicado: `2494f0b4e7c1dff7d83bd1238cb40082c5c6bb88`. [CI 41386362878](https://github.com/santiagohzszmex/GBA-VISTA-seeitdifferently/actions/runs/41386362878) completó validación y candidatos de Mac Apple Silicon, Mac Intel y Windows.
- [Workspace 1.7.1.4 para macOS](https://github.com/santiagohzszmex/GBA-VISTA-seeitdifferently/releases/tag/workspace-v1.7.1.4-beta.1) publicado con ambos instaladores y paquetes firmados para el actualizador. Firma del actualizador y firma/notarización de distribución son distintas; se conserva el estado ad hoc de los instaladores.
- Canal macOS: versión técnica `1.7.104`, visible `1.7.1.4`. Feed compartido y Windows permanecen `1.6.603`; Windows sólo tiene candidato compilado, sin publicación de Lapislázuli.
- La base pública sigue en `1.5.0`, idéntica al archivo fuente. No se instaló ni abrió la actualización en la Mac del usuario.
- Activación: campana → Avisos en el dispositivo → configurar en el navegador; en Mac, Safari para recibir también con el navegador cerrado. Cada persona debe permitir los avisos.
- La propuesta de 1.7.5 con Ultramar está en `1.7.5-ultramar-plan.md`; «Azurita» es un nombre propuesto. El adaptador real sigue pendiente y no se anuncia como disponible.
