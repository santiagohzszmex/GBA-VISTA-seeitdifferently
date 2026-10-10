# Acceso a Workspace

Workspace web y la entrada de escritorio usan WorkspaceAuth, una pantalla propia con el icono original, GBA ID y PIN de cuatro dígitos. El inicio de sesión es la acción principal; quien viene de la convocatoria utiliza la misma cuenta. El formulario admite nombres con espacios y acentos, además del prefijo @ de presentación. No crea cuentas ni concede permisos.

La recuperación acepta el código o frase existente, pide confirmar el nuevo PIN y utiliza el mismo gateway de GBA ID. Los datos se borran al cambiar de modo y no se envían hasta confirmar el formulario. Los controles se desactivan durante el envío y una referencia evita solicitudes simultáneas. La carga de sesión también se identifica como Workspace mediante una propiedad de presentación; la lógica de sesión y el servidor no cambian.

La web publica este cambio independientemente de los instaladores. Los paquetes 0.1.4 permanecen intactos; Workspace 0.1.4.1 incorpora este diseño al escritorio. La aceptación de identidad volvió a verificarse, incluida la comparación exacta de la lógica de sesión contra la base aceptada.

Validación: pruebas existentes de sesión (47), gateway (78) y configuración nativa; compilación web y escritorio con Safari 14 como objetivo. En el navegador se comprobaron la identidad Workspace, el icono original, los campos etiquetados, la validación del nombre, ocultar/mostrar el PIN, el borrado del PIN al cambiar de modo y el regreso desde recuperación. No se cambió el PIN de ninguna cuenta real.
