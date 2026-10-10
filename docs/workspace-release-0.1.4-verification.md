# Workspace 0.1.4: aceptación de la base pública

La versión base autorizada es 0.1.4. Conserva software.gba.workspace, el nombre Workspace y la identidad pública del actualizador de 0.1.1. Las instalaciones 0.1.0 requieren una descarga inicial; las que ya tienen el actualizador reciben esta versión mediante descarga e instalación manual.

## Base de datos

Proyecto Supabase wgihpztgwsovhykboyru. La migración workspace_personal_drafts_and_library se ensayó con ROLLBACK y se aplicó con versión real 20261010183926. El archivo local coincide con esa versión del historial. No se repitieron las migraciones de identidad, rangos o licencias.

La aceptación SQL contra el servidor real verifica doce condiciones: texto canónico, borrador fuera de la biblioteca, rechazo de revisión obsoleta, denegación de lectura de tablas privadas, Dirección sin acceso al borrador ajeno, entrega inmutable para revisión, ausencia de documentos sin aprobar en biblioteca, referencia aceptada con formato, denegación de versiones originales ajenas, rechazo de edición no asignada, referencia conservada al reabrir y rechazo de sesión inexistente. Las comprobaciones de datos comparan internamente las credenciales anteriores y el contenido de Keynotes sin exportarlos.

El ensayo terminó con ROLLBACK y la prueba posterior a la aplicación también. No quedan cuentas ni proyectos de aceptación. Se conservan dos Keynotes. No se entregaron licencias ni cargos permanentes como parte de las pruebas. El proyecto todavía no tiene ediciones reales: Dirección puede crearlas desde Configuración → Administrar ediciones.

Las tres tablas privadas nuevas tienen RLS y no otorgan lectura directa a authenticated. Los seis RPC nuevos admiten únicamente llamadas autenticadas con sus comprobaciones de sesión y alcance. Anon no puede guardar borradores. Los avisos del asesor que se añaden corresponden a esas tablas privadas sin políticas de acceso y a los RPC autenticados previstos; los avisos anteriores sobre funciones y objetos ajenos no cambiaron. Referencia: https://supabase.com/docs/guides/database/database-linter.

## Publicación

La publicación exige aceptación explícita del cambio de base de datos, con el commit y proyecto exactos, todas las condiciones verificadas, fecha de comprobación de menos de un día y SHA-256 del archivo de migración. Se conserva el rechazo de cualquier cambio de identidad sin una nueva aceptación completa. Las pruebas anteriores de gateway, licencias y recuperación se reutilizan porque su código no cambió.

Los instaladores deberán provenir del mismo commit revisado, pasar instalación y arranque en los tres corredores nativos y coincidir en tamaño y SHA-256. Los paquetes del actualizador se firman localmente y se verifican con la clave pública que ya tienen las aplicaciones. macOS mantiene sello ad hoc sin notarización de Apple; Windows permanece sin Authenticode. La prueba interactiva de actualización de Windows queda pendiente de un equipo real.
