# Adaptación a inicio nativo — revisión 2

Solicitud de Santiago, 2 de noviembre de 2026: GBA ID y PIN dentro de Ultramar, como Workspace, sin abrir navegador.

Implementado en esta rama local: `session.create` con Bearer de Auth verificado; conexión de aplicación ligada a la sesión de Auth de origen; revisión 2 obligatoria; eliminación de `pairing.*` y de la ruta de consentimiento.

La emisión/canje/revocación de licencias y la firma Ed25519 se conservan. El cliente nativo de Ultramar se implementa en su propio repositorio.

Se sustituyeron los permisos directos sobre Auth por dos funciones de lectura estrechas, propiedad del rol de migración, que sólo devuelven validez de cuenta y sesión. Ningún cliente puede invocarlas.

No se publicaron rutas ni se aplicó esta revisión en producción. El prototipo de Supabase aislado quedó apagado, sin permisos temporales de dueño ni sesiones de prueba. La revisión 2 se verificó localmente; el ensayo remoto anterior no acredita esta revisión.
