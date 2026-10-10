# Workspace: licencias y accesos activados

El usuario autorizó la activación después de revisar el funcionamiento de GBA ID, membresías, permisos y licencias independientes. La web y API publicadas provienen del código probado 12732a68aca005331d84006ea84f01c84dc35903, despliegue dpl_5tq9GHQuEK7iZzX4wyZwu2kWQbhD.

El ensayo completo contra Supabase real terminó con ROLLBACK y restauró exactamente las credenciales originales, conservando 127 cuentas y dos Keynotes, sin esquema ni claves Vault residuales. Después se aplicaron únicamente las cuatro migraciones pendientes:

| Versión real | Migración |
|---|---|
| 20261010005048 | workspace_gimg |
| 20261010005053 | workspace_licenses |
| 20261010005130 | gba_id_secure_gateway |
| 20261010005309 | gimg_role_isolation |

La revisión posterior fijó también el search_path de la función de comparación de alcances, mediante 20261010010427_workspace_scope_search_path. Las demás advertencias nuevas corresponden a tablas protegidas con RLS, RPC autorizados y publicaciones públicas previstas. Los nombres locales coinciden con el historial real. La migración de aislamiento de identidad 20261009123356 ya estaba aplicada y no se repitió. No se utilizó db push.

El checkpoint cifrado conserva las credenciales anteriores dentro de workspace_private, con la clave en Vault. La conversión mantiene los verificadores de PIN y recuperación, elimina frases en texto plano y aleatoriza contraseñas internas de Auth. No se exportaron esos valores a clientes, instaladores, repositorio ni registros.

Pruebas con cuenta temporal y sesiones reales: registro, PIN válido e incorrecto, recuperación, rechazo del PIN anterior y de sesiones revocadas; denegación de emisión de licencias a usuarios ordinarios; incorporación a GIMG sin convertirse en propietario; licencia desde la primera activación, repetición sin reiniciar fechas, vencimiento, revocación y suspensión de membresía. Workspace web también abrió en el navegador con membresía y licencia de escritorio revocada.

@Santiago conserva Dueño en GBA y Dirección explícita de GIMG. El panel de licencias corresponde a la autoridad de plataforma; el panel de Equipo administra membresías, roles, funciones y delegaciones de GIMG. No se emitieron licencias permanentes para usuarios como parte de esta comprobación.

Los instaladores 12732a6 compilaron y arrancaron en macOS Apple Silicon, macOS Intel y Windows x64. Su distribución pública y aceptación instalada siguen pendientes: macOS tiene sello ad hoc sin notarización y Windows no tiene firma de distribución. El manifiesto público continúa vacío. Cloudflare sigue pendiente.

Para otra entrega, no repetir estas migraciones ni restaurar el checkpoint sobre cambios legítimos posteriores de usuarios. Preparar una migración nueva y comprobar su alcance.

La cuenta y licencia temporales se retiraron; permanecen 127 cuentas y dos Keynotes. No quedaron cuentas ni licencias de aceptación. Los archivos locales de sesión se eliminaron.
