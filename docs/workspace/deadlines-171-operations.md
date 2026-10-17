# Workspace 1.7.1 Lapislázuli · entregas y fechas

Código nativo: `4e90fd8b30f9dd114b9971608f6d7f2b4319d27c`. CI: https://github.com/santiagohzszmex/GBA-VISTA-seeitdifferently/actions/runs/39056237948

La migración `workspace_deadline_receipts` está aplicada. Conserva las 43 asignaciones y 10 versiones existentes; se recuperó el límite histórico de los diez primeros envíos a partir de su auditoría. Los envíos nuevos capturan su límite en el servidor para documentos e imágenes. Si no hay evidencia histórica suficiente, la interfaz lo indica; no compara con una fecha modificada después.

Asignaciones tiene grupos Por entregar/Entregado, cuentas, progreso y filtros de persona/plazo. Mi trabajo usa los mismos grupos y muestra la próxima fecha futura; las vencidas aparecen en el contador y sus tarjetas. Cambios solicitados vuelve a Por entregar; bloqueos conservan su etapa de origen para agrupar. Los nombres de estados persistidos y la cadena área → QA → Dirección permanecen iguales. El historial proyecta los diez cambios más recientes, con anterior/nueva fecha, persona y momento, sin abrir la auditoría general ni cuerpos de documentos.

Fecha sin hora: 23:59 en America/Mexico_City; las horas explícitas existentes se conservan. Calendario y Equipo comparten la función de plazo de Asignaciones. Capturas sintéticas y auditoría están en el directorio local Workspace-Fechas-1.7.1 y Workspace-Lapislazuli-Fase4, fuera del repositorio.

Las imágenes están habilitadas en todas las ediciones no archivadas de GIMG y en las nuevas: `images_enabled=true`, `images_all_projects=true`, lista de piloto vacía, derivados apagados. No concede roles, membresías ni permiso de entrega por sí mismo. Los permisos existentes se siguen verificando en servidor. Límites provisionales: PNG 18 MiB, capas 250 MiB, 40 MP y capacidad de la aplicación de 10 GB. Workers Paid no elimina estos límites.

Worker sin cambios respecto a 1.7.0: `937db032-73c4-43e2-87d7-4d218618cddc`, ruta B, SHA-256 completo, CPU máxima 1000 ms. La base pública 1.5.0 y el canal compartido de Cuarzo se conservan. Desde 1.7.0 macOS recibe 1.7.1 por su canal manual; desde Cuarzo el primer salto requiere instalar el DMG. Windows no se publica antes de la confirmación interactiva de Santiago.

Web: `dpl_DtYAuQsKpjjgwgJcwp7jRYqTyDCD`, https://gba.software/workspace/web/ . Cliente de fechas, GBA ID y manifiesto base verificados públicamente. No se crearon cuentas ni envíos ficticios en producción. No se generó acceso de bypass temporal para Vercel en esta actualización.

## Pausa de imágenes

Un comando en el SQL Editor de Supabase `wgihpztgwsovhykboyru`:

```sql
update workspace_private.upload_policy set images_enabled=false,images_all_projects=false,derivatives_enabled=false,image_project_ids='{}',revision=revision+1 where singleton;
```

Equivalente: `docs/workspace/rollbacks/1.7.1-deadlines-and-images.sql`. Preserva lectura de originales/versiones y sus fechas. No volver al Worker Prisma: no tiene lectores para estas imágenes.

## Reversión web

Desde el checkout enlazado a Vercel:

```sh
/Users/santiagohernandez/.npm/_npx/cf16195db335a816/node_modules/.bin/vercel rollback gba-vista-seeitdifferently-d68hyde72.vercel.app --yes
```

Conserva la migración aditiva y los datos; el cliente anterior sigue siendo compatible. No eliminar columnas, historial ni versiones. Respaldo cifrado y restauración tipada verificados en `private-production-backup-171`, fuera del repositorio; clave separada y no publicada.

Pendientes humanos heredados de 1.7.0: recorrido real PNG → revisión y alerta de presupuesto de Cloudflare; comprobación interactiva Windows. No se declaran completados por el arranque de CI.

macOS 1.7.1 publicado: https://github.com/santiagohzszmex/GBA-VISTA-seeitdifferently/releases/tag/workspace-v1.7.1-beta.1 . Canal `latest-darwin.json` verificado con versión nativa `1.7.100`, ARM e Intel; paquetes firmados para el actualizador y bytes públicos comprobados por el publicador. Instaladores beta sin notarización de Apple. CI de Windows correcta, pero su publicación sigue retenida hasta la prueba interactiva.
