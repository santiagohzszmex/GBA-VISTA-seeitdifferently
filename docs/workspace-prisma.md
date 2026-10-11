# Workspace 1.5.0 · Prisma

La biblioteca de cada edición reúne concepto, dirección creativa, moodboard e instrucciones de trabajo. Los documentos aceptados siguen siendo versiones inmutables; no se convierten en borradores de referencia.

## Autoridad editorial

- Dirección mantiene el concepto, la dirección creativa y los moodboards.
- Una Dirección de producto necesita mandato creativo explícito y vigente.
- Dirección y Producción pueden publicar instrucciones operativas. Coordinación necesita asignación al proyecto; los responsables de área sólo mantienen instrucciones de su área.
- Colaboradores consultan referencias de sus ediciones y las instrucciones de su alcance. QA y Consulta mantienen sus permisos de lectura; no reciben autoridad creativa.
- Ser Dueño o tener otro rango general de GBA no concede autoridad editorial de GIMG.

Las referencias se autorizan en el servidor, tienen revisión para evitar sobrescrituras desde otra ventana, historial y archivo reversible. El campo anterior de concepto está protegido con la misma autoridad creativa.

## Originales privados en Cloudflare R2

Bucket `workspace-originals`, Standard, acceso público deshabilitado. Un Worker autentica cada subida o lectura con el JWT de GBA ID y una clave de servidor específica de esta pasarela; no necesita claves de servicio de Supabase. La clave sólo existe en Cloudflare; en la base se guarda su hash.

La pasarela admite imágenes originales y PDF únicamente en moodboards. No comprime, redimensiona ni convierte los archivos. Verifica el formato real por su encabezado, el tamaño y SHA-256; el lector comprueba nuevamente los bytes recibidos. No admite SVG ni ejecutables disfrazados de imágenes.

- Máximo 25 MiB por archivo y 40 originales por referencia.
- Tope de 10.000.000.000 bytes globales, incluyendo reservas y archivos archivados.
- Reserva del espacio antes de escribir, con bloqueo transaccional: dos subidas simultáneas no pueden superar la capacidad.
- Límites internos de 200.000 escrituras y 2.000.000 lecturas por mes UTC, y 50.000 solicitudes autorizadas por día.
- Una reserva fallida sólo se libera después de comprobar que el objeto se eliminó. Una confirmación fallida mantiene el archivo en cuarentena y contando en la cuota.
- Archivar una referencia conserva sus originales y su consumo. No se borran archivos de usuarios para ganar espacio.
- Cada descarga requiere autorización y se audita. El bucket permanece privado; no hay enlaces públicos permanentes.

Los controles cubren el tráfico de Workspace a través de la pasarela. No se debe habilitar acceso público ni escribir al bucket por otros clientes. La franquicia de Cloudflare es compartida por la cuenta; no constituye un plan con un tope de facturación configurable.

## Trabajo y guardado

Investigación, Redacción y Arte pueden consultar una referencia al lado del borrador. Los responsables de área, Dirección de producto, Dirección y QA pueden comparar la entrega durante su revisión. El ancho se ajusta; en ventanas pequeñas los paneles se apilan. El editor permanece montado al abrir, cambiar o cerrar referencias.

Los formularios de nuevas asignaciones y permisos limpian sus campos sólo después de éxito. Los formularios de edición conservan los datos guardados. Los documentos no se vacían al guardar: se conserva el trabajo y se limpia su estado pendiente. El aviso de confirmación aparece abajo, puede cerrarse y permanece mientras se señala o enfoca.

La versión 1.6.0 queda reservada para notificaciones y observaciones de uso posteriores.

## Comprobaciones y publicación

La implementación local se valida con pruebas de permisos y llamadas directas a Postgres, pruebas de bytes de la pasarela y pruebas de interfaz. La publicación exige, además, aceptación en Supabase real, Worker desplegado con sus secretos, una subida/lectura real con integridad comprobada y los instaladores de las tres plataformas. No se publica una conexión de R2 que sólo funcione en simulación.

Fuentes: [R2](https://developers.cloudflare.com/r2/pricing/), [API de Workers](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/), `docs/workspace-rbac-source.md`.

## Publicación comprobada

La versión beta 1.5.0 tiene instaladores para Apple Silicon, Intel y Windows x64. Cada instalador se instaló y abrió en su corredor nativo, y sus bytes se comprobaron antes de promover el canal de actualizaciones. Código nativo: `8fa9af25a6089b68cb3a9e16ff84891abfc94988`.

- [Instalación y apertura en los tres sistemas](https://github.com/santiagohzszmex/GBA-VISTA-seeitdifferently/actions/runs/38100713139).
- [Paquetes públicos de Prisma](https://github.com/santiagohzszmex/GBA-VISTA-seeitdifferently/releases/tag/workspace-v1.5.0-beta.1).

La pasarela `workspace-originals.gba-vista.workers.dev` está desplegada con el bucket privado `workspace-originals`. La prueba real subió y descargó un PNG y un PDF: ambos conservaron todos sus bytes y SHA-256. Los permisos y la sesión de la cuenta temporal se revocaron, y la pasarela confirmó la denegación posterior. Los archivos de prueba quedan archivados y siguen contando como 5,773 bytes; no se descontó almacenamiento que todavía existe.

Se ejecutaron 50 comprobaciones con rollback en Supabase: 12 de borradores, 10 de identidad y 28 de referencias/originales. Los usuarios y Keynotes existentes se conservaron. La actualización interactiva de Windows todavía necesita validación en un equipo real, aparte de la instalación y apertura verificadas en CI.
