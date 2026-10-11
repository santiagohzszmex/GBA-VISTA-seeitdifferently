# Workspace 1.5.6 · Prisma

La web y el canal de actualizaciones manuales avanzan a **1.5.6** (`1.5.600` nativo). La descarga base publicada en GBA conserva **1.5.0**, sus enlaces y sus bytes. La actualización no exige iniciar sesión ni se instala automáticamente.

## Integrantes y permisos

Se porta a React el prototipo entregado para esta versión: lista con búsqueda y filtros, ficha por persona, ocho cargos, delegaciones con mandato, invitación por GBA ID, historial y matriz en lectura. Los estilos se limitan a esta sección. Los diálogos usan controles nativos, foco, Escape y adaptación a pantalla estrecha. El aviso de guardado aparece en la región de estado de Workspace.

El catálogo y la matriz reales proceden del servidor. Los datos del prototipo, su cuenta fija y su reloj de ejemplo no se publican. La demostración local usa cuentas genéricas y un adaptador separado, sin escribir en Supabase.

## Decisiones conforme a la matriz RBAC

- Cargo y función se guardan en una transacción, con `grant_id` explícito. Un cargo puede tener varias funciones organizacionales sin duplicar su rol principal ni reemplazarlo silenciosamente.
- Cambiar vigencia o quitar un cargo actualiza sus funciones vinculadas. Acortar la membresía limita cargos, funciones y delegaciones, también desde el endpoint anterior. Ampliarla no restaura fechas anteriores ni cargos revocados.
- La vigencia solicitada se recorta al límite de la membresía y se informa. Sólo las membresías operativas vigentes admiten cargos o delegaciones.
- Reserva corresponde al estado existente `accepted`, sin acceso operativo. Vencido es un estado calculado, no otro valor de base de datos.
- Consulta comparte expresamente una edición mediante lectura temporal. Quitar el cargo revoca esa lectura; cambiar su vigencia actualiza el permiso vinculado. No permite editar, aprobar ni descargar originales. Invitar en este modo requiere además autoridad para compartir permisos.
- Coordinación necesita su asignación de proyecto y una delegación vigente para invitar. Esa delegación no permite asignar cargos.
- Dirección de producto requiere vencimiento y mandato escrito para las operaciones delegadas. Nunca recibe aprobación final.
- No se delegan administración técnica, otorgamiento de roles/delegaciones, borrado físico ni aprobación final. Cada clave se verifica contra los permisos actuales del otorgante y el alcance real.
- Los mandatos son registros privados conservados al revocar, con mínimo 20 caracteres y sin marcadores pendientes.
- Fotografía dispone de un área real propia, separada de Ilustración. Investigación se incluye entre las funciones de área.
- Los cargos editoriales no cambian el rango general de GBA. Las credenciales, Keynotes y los accesos existentes se conservan.

## Comprobación

Pruebas locales de API y RLS, transacciones compuestas, vencimiento, revocación de Consulta, límites de membresía, mandatos y avisos sin duplicar. Recorrido de los ocho cargos y diálogos en navegador, invitación seguida de asignación, bloqueo de formulario incompleto, Escape, historial, matriz y vista de 390 px.

Aceptación real en Supabase: cinco suites dentro de `BEGIN / ROLLBACK`, con **105 comprobaciones**, incluidas 36 nuevas para integrantes. Se verifica que no queden cuentas desechables y que los rangos, membresías, credenciales y Keynotes reales se conserven.

Los mandatos privados tienen RLS y ningún acceso directo de `anon` o `authenticated`; su lectura ocurre únicamente mediante RPC con verificación de alcance. Las funciones públicas de administración son `SECURITY DEFINER` de forma intencional, requieren sesión y permisos específicos, y fijan `search_path`.

La pasarela R2 y sus límites no cambian en esta versión. Se conserva la comprobación de integridad de PNG/PDF de la publicación 1.5.0. Los paquetes continúan sin notarización Apple ni firma de distribución Windows; la firma del actualizador verifica los bytes de cada actualización.
