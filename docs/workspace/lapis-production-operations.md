# Lapislázuli 1.7.0 · operación del piloto

Publicado el 17 de octubre de 2026. Cliente nativo: commit `30afb0a91478bfb9f8cc90226f48f84142ca6668`, [CI 39052986294](https://github.com/santiagohzszmex/GBA-VISTA-seeitdifferently/actions/runs/39052986294). Ambos instaladores macOS se instalaron y abrieron en sus corredores; las firmas y los bytes publicados se comprobaron. Windows compiló, pero no se publicó por faltar la prueba interactiva de Santiago.

- Web: https://gba.software/workspace/web/
- Instaladores macOS: https://github.com/santiagohzszmex/GBA-VISTA-seeitdifferently/releases/tag/workspace-v1.7.0-beta.1
- Canal macOS nuevo: `workspace-updates/latest-darwin.json`. El canal compartido `latest.json` sigue en Cuarzo 1.6.6.2; primer salto a Lapislázuli manual. Base pública 1.5.0 conservada byte por byte.
- Worker normal B: `937db032-73c4-43e2-87d7-4d218618cddc`, SHA-256 completo, CPU `1000 ms` verificada en los metadatos de la versión, bucket privado y cron conservados.
- Siete migraciones aplicadas por separado, Postgres 17.6, imágenes inicialmente apagadas. Lectura de concepto existente y guardado de un documento privado comprobados por el conector con GBA ID; no se enviaron a revisión ni a otras personas.
- Piloto: `images_enabled=true`, `derivatives_enabled=false`, lista únicamente Día de Muertos `8cde6736-e742-4a11-8a53-cb320b36b055`.
- Límites provisionales: PNG 18 MiB, capas 250 MiB, 40 MP. Cuenta con Workers Paid; no se contrataron servicios adicionales.

Pendiente: Santiago entrega un PNG pequeño en una asignación **nueva** de tipo Imagen y un revisor lo abre y devuelve/aprueba. No convertir las entregas anteriores. La prueba de arranque de CI no sustituye ese recorrido real. Santiago configura la alerta de presupuesto en Cloudflare.

## Apagar el piloto en un comando SQL

Ejecutar en el SQL Editor del proyecto de producción `wgihpztgwsovhykboyru`:

```sql
update workspace_private.upload_policy set images_enabled=false,derivatives_enabled=false,image_project_ids='{}',revision=revision+1 where singleton;
```

Pausa nuevas escrituras y subidas; conserva originales, borradores, versiones, RPC de lectura y limpieza. Es la reversión operativa recomendada, también disponible en `docs/workspace/rollbacks/1.7.0-5-pilot-allowlist.sql`. No restaura la antigua ocultación de documentos ni amplía acceso de coordinación.

## Revertir la web en un comando

Desde este checkout enlazado a Vercel, después de apagar el piloto:

```sh
/Users/santiagohernandez/.npm/_npx/cf16195db335a816/node_modules/.bin/vercel rollback gba-vista-seeitdifferently-jfvmrf0bs.vercel.app --yes
```

Despliegue anterior: `dpl_B4h8kErkbSSCbZTW6s1mNLN6nve4`. La base de datos conserva las migraciones y las lecturas. No hacer DROP ni restaurar un respaldo encima de datos nuevos. No volver al Worker Prisma después de cargar imágenes: no contiene los handlers de sus lecturas; conservar el Worker Lapislázuli y usar la pausa SQL.

El respaldo cifrado y la evidencia de restauración están en el directorio privado local `Workspace-Lapislazuli-Fase4/private-production-backup-170`, fuera del repositorio. La clave de recuperación no se publica ni se copia a instaladores.
