# Entorno aislado de Fase 4

## Montaje realizado

1. Consultar organización, proyectos y costo antes de crear. Se eligió GBA-SYSTEM, Free y costo mensual 0; no se usó branching de pago. Se creó `workspace-lapis-phase4-test` con referencia `ojlcttpqkyktqpqybbdy`.
2. Exportar **sólo catálogos DDL y ACL** de los esquemas public/workspace_private/gimg_recruitment_private de producción. No copiar filas de personas, Auth, Storage, Vault ni secretos. El export local de esta sesión está en `/private/tmp/workspace-lapis-phase4-schema.json`, fuera de Git.
3. Restaurar tablas, IDENTITY, defaults, funciones, restricciones, índices, disparadores, RLS y permisos en la copia. La primera exportación omitió IDENTITY y se corrigieron nueve tablas. No reutilizar ese exportador sin corregirlo. Para repetir de forma autónoma, preparar y revisar un dump **schema-only** con sus ACL y dependencias, o corregir primero el exportador; todavía no hay un comando único de clonación auditado en este repositorio.
4. Sembrar sólo la unidad GIMG y reglas estáticas. Crear seis usuarios ficticios confirmados con perfiles de rango general NULL, membresías activas y roles separados de GIMG. Iniciar sesión por GoTrue para generar JWT y auth.sessions reales. No restaurar usuarios de producción.
5. Aplicar las cinco migraciones de Fases 1–3 y la corrección de lectura retenida. Ver el orden completo en [DESPLIEGUE.md](DESPLIEGUE.md).
6. Crear R2 **privado** `workspace-lapis-phase4-test` y desplegar sólo con `cloudflare/workspace-originals/wrangler.phase4.jsonc`. El archivo apunta al proyecto y bucket aislados. Introducir secretos por archivo privado/entrada estándar; nunca por argumentos, mensajes ni Git.
7. Habilitar almacenamiento/imágenes **en la copia** y configurar su gateway/hash. Ejecutar `sign-in.mjs`, una vez `prepare-scenario.mjs` y después `acceptance.mjs`. Esos scripts exigen la referencia y el host de prueba; `prepare-scenario` no es idempotente.

Las credenciales temporales de esta sesión están en `/private/tmp/workspace-lapis-phase4-secrets.json` y archivos privados relacionados, modo 0600, fuera de Git. No se incluyen en el paquete Windows ni en capturas. No utilizar esos scripts con producción ni cambiar sus guardas para apuntarlos allí.

## Pruebas repetibles sin producción

- `npm run test:workspace`: suite local con PGlite y pruebas de cliente/formato.
- `npm run test:r2-runtime`: workerd + R2 local, descarga interrumpida, expiración, rango, SHA y limpieza multipart. Necesita permiso de escucha local.
- `node scripts/lapis-phase4/acceptance.mjs`: flujo remoto aislado. Usa cuentas/escenario previamente preparados; no es idempotente.
- `rollback-rehearsal.sql`: ensayo transaccional sólo en el proyecto aislado, con rollback final. No ejecutar sobre producción.
- `LAPIS_FIXTURE_DIR=<carpeta vacía de prueba> node scripts/lapis-synthetic-fixtures.mjs`: genera muestras sin datos reales. El PNG generado por CI pesa 8.826.004 bytes, distinto del PNG de 5.726.086 usado en esta Mac; no comparar tiempos sin registrar ambos tamaños.

## Retirada propuesta, no ejecutada

Verificar por nombre **y referencia** antes de cada acción. Primero revocar las sesiones ficticias y detener nuevas subidas en la copia. Mantener cron hasta vaciar sesiones multipart pendientes y reservas de limpieza. Exportar únicamente resultados sintéticos que se quieran conservar. Después eliminar exclusivamente el Worker de prueba, abortar multipart y vaciar/eliminar exclusivamente su bucket privado, y eliminar el proyecto Supabase `ojlcttpqkyktqpqybbdy`. Retirar archivos privados temporales y caché de `software.gba.workspace.lapisdev` / `software.gba.workspace.lapisphase4`, sin tocar `software.gba.workspace`.

No se borraron los recursos remotos al terminar esta verificación: la retirada destructiva queda identificada para su autorización y puede perder definitivamente los datos ficticios. No cancelar R2, la cuenta Cloudflare ni el proyecto operativo `wgihpztgwsovhykboyru`.
