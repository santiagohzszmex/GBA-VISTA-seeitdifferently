# Operación y revisión

## Configuración requerida (nombres, sin valores)

- `SUPABASE_URL` y `SUPABASE_ANON_KEY` (admite los alias públicos existentes `VITE_SUPABASE_*`).
- `SUPABASE_SERVICE_ROLE_KEY`: sólo servidor, nunca instaladores ni frontend.
- `SEPIA_ACCESS_ENABLED`: desactivado por defecto.
- `SEPIA_AUTH_POLICY_VERIFIED`: sólo activar después de comprobar la política real del entorno.
- `SEPIA_AUTH_TIMEBOX_SECONDS`, `SEPIA_AUTH_INACTIVITY_SECONDS`, `SEPIA_AUTH_SINGLE_SESSION`: política actual verificada; no inferirla de una fila de sesión ni fijarla a cero sin evidencia.
- `SEPIA_OFFLINE_KID`, `SEPIA_OFFLINE_PRIVATE_JWK`, `SEPIA_OFFLINE_PUBLIC_JWKS`: clave Ed25519 privada exclusiva del servidor y lista pública coherente.

El esquema añade otro interruptor `sepia_private.runtime.enabled`, inicialmente false. Las rutas no se habilitan sólo por crear las tablas. La base pública Workspace 1.5.0 y feeds no cambian.

## Prueba local focalizada

Con las dependencias del proyecto GBA ya instaladas:

```
node tests/sepia-access/protocol.test.mjs
node tests/sepia-access/service.test.mjs
```

La segunda necesita permiso de escucha loopback. No usa producción. Para revisar la página administrativa apagada: `node scripts/sepia-access/dev-server.mjs`, después `/sepia/administrar/` en el puerto local indicado. No configura secretos ni habilita el servicio.

## Migración

`20261102233258_sepia_access_service.sql` es la **migración inicial de revisión 2** para un entorno sin Sepia. No volver a ejecutarla sobre el prototipo de revisión 1 que quedó en el proyecto aislado. El prototipo aislado se actualizó con 20261103044623_sepia_native_revision2_upgrade.sql; producción no recibió el prototipo.

Esquema privado con RLS forzada, propietario sin login, sin grants de tablas a anon/authenticated/service_role. Sólo service_role puede invocar el gateway. Dos lectores estrechos de Auth, propiedad de postgres y sin acceso de clientes, devuelven únicamente la validez de cuenta/sesión; evitan conceder acceso directo al esquema Auth al rol nuevo. Funciones con search_path fijo, sin SQL del cliente. Los permisos editoriales de personas no cambian.

## Activación de producción

El ensayo remoto de revisión 2 pasó 62 comprobaciones y la política real está documentada en AUTH_NATIVO.md. Generar la clave mediante `scripts/sepia-access/generate-signing-key.mjs`, que exige un archivo privado fuera del repo y no imprime claves. Publicar sólo su clave pública y `kid` al cliente; conservar la privada en el servidor. No ejecutar el generador durante build/startup ni generar otra clave al reiniciar.

Producción publicada tras el ensayo aislado: migración inicial aplicada, clave privada guardada sólo como secreto de Vercel, políticas verificadas y ambas puertas habilitadas. El fallo inicial del límite Hobby se resolvió consolidando las rutas en una función; no se contrató otro plan. La UI nativa requiere su propia implementación; compilar este backend no la sustituye.

## Desactivar y revertir

Desactivar `SEPIA_ACCESS_ENABLED` y `sepia_private.runtime.enabled` en el entorno autorizado. No borrar códigos, licencias o documentos. Para retirar la alternativa Sepia de clientes anteriores, restaurar la definición previa de `workspace_license_status` que se entrega en `workspace_license_status_pre_sepia.sql`. El canje/emisión histórica no se modificó.

Rotación: introducir una nueva clave activa y mantener las claves públicas anteriores al menos hasta vencer sus permisos (máximo siete días y nunca más que la licencia). Distribuir claves públicas por el origen fijo con TLS; no seguir URLs de un token. Eliminar una clave de la lista conocida invalida sus permisos al comprobarla, pero no se promete revocación instantánea de un equipo sin red. Los vectores sintéticos no son claves de ningún entorno desplegado.
