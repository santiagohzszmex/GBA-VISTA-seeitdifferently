# Separación de GBA y GIMG aplicada

El 9 de octubre de 2026 se aplicó en Supabase la migración `20261009123356_gimg_identity_role_isolation.sql` al proyecto `wgihpztgwsovhykboyru`.

## Dirección autorizada

| GBA ID | Rango general GBA | Cargo explícito GIMG |
|---|---|---|
| @Santiago | Dueño | director, en gimg_recruitment_reviewers |

La cuenta se verificó por su identificador personal y rango antes de asignarla. La asignación quedó registrada en la auditoría de GIMG. Dirección depende de ese nombramiento explícito y de una sesión activa; Dueño/Admin ya no concede el cargo automáticamente.

## Correcciones instaladas

- Convocatoria: Dirección y evaluación requieren asignación explícita; se eliminó la herencia de administración general.
- Perfil personal: los cargos GIMG no se escriben como rangos generales de GBA.
- Studio: aceptar invitaciones o aprobar la creación de GIMG conserva el rango personal, incluido NULL; las editoriales externas mantienen su comportamiento anterior.
- Funciones de Dirección/evaluación: sin ejecución para anon; mantienen los controles de sesión.

## Verificación real

- @Santiago conserva Dueño y es la única Dirección explícita de GIMG.
- Con una sesión real activa, las funciones de Dirección y evaluación devuelven true para @Santiago.
- Para la misma cuenta sin sesión válida, ambas funciones devuelven false.
- Los rangos siguen en 1 Dueño, 8 Editor y 118 cuentas con NULL. Ninguna otra cuenta fue reclasificada.
- Las dos Keynotes permanecen en la base.
- La migración figura en el historial de Supabase; el registro de nombramiento figura en la auditoría.
- 97 comprobaciones del nuevo Workspace, 20 de autenticación y 9 del esquema actual pasaron localmente.

Los avisos del asesor de seguridad antes y después tienen las mismas categorías y cantidades. Permanecen avisos previos, incluidos search_path sin fijar en otras funciones y permisos sobre otros objetos; no se modificaron recursos ajenos a esta corrección. Referencia del [asesor de seguridad de Supabase](https://supabase.com/docs/guides/database/database-linter).

## Actualización de Workspace pendiente

La separación del servicio actual está aplicada. Los alcances y permisos operativos del nuevo Workspace se instalarán con su esquema, mediante `20261009050000_workspace_gimg.sql` y `20261009112023_gimg_role_isolation.sql`. El esquema inicial toma las Direcciones explícitas de convocatoria: incorporará la misma cuenta @Santiago como gimg_direction, sin convertir Dueño en un permiso editorial implícito.

El nuevo sistema de licencias y el gateway de identidad siguen pendientes de su despliegue coordinado. Esta aplicación no cambió contraseñas ni desplegó la web o instaladores. Cloudflare permanece pendiente conforme a la instrucción inicial.
