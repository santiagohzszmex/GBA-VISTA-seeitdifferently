# Workspace 0.1.4.1

Actualización menor de la base pública 0.1.4. Incorpora el acceso propio de Workspace/GIMG con el icono original, GBA ID y PIN, además de recuperación con el código o frase existente.

Al abrir la aplicación se muestra «Importante · Acceso actualizado». La búsqueda y descarga de actualizaciones funcionan antes de iniciar sesión. La app admite versiones mínimas obligatorias: cuando conoce una actualización requerida, impide entrar hasta descargar, verificar, instalar y reiniciar. Una obligación ya conocida permanece ante un error de conexión. La instalación exige una acción explícita.

Si la app encuentra otra actualización obligatoria mientras una persona está trabajando, conserva su trabajo y exige la nueva versión al siguiente arranque. No cierra documentos ni instala automáticamente. El aviso permite guardar antes de instalar.

Esta entrega está marcada como obligatoria en el canal de actualización. Límite de compatibilidad: las apps anteriores no saben aplicar ese bloqueo ni abrir el aviso al arrancar; muestran su icono y las notas. Deben instalar esta entrega una vez para incorporar esa capacidad. La beta 0.1.0 necesita descargar el instalador porque no incluye actualizador.

Numeración pública: 0.1.4.1, 0.1.4.2, etc. Numeración nativa compatible con SemVer: 0.1.401, 0.1.402; una siguiente base 0.1.5 usará 0.1.500. Los paquetes públicos, la web y la nueva app muestran 0.1.4.1. En actualizadores antiguos puede verse 0.1.401; corresponde a la misma entrega. El máximo de revisión menor es 99 y el parche nativo respeta el límite del instalador de Windows.

Las firmas oficiales de distribución siguen pendientes: macOS sin notarización de Apple y Windows sin Authenticode. Las actualizaciones llevan la firma de Workspace verificada antes de instalarse. La entrega no modifica cuentas, rangos, licencias, permisos ni Keynotes.

Aceptación: pruebas locales del actualizador, errores, concurrencia, requisito de versión, conservación del trabajo y numeración; pruebas de identidad y permisos existentes; 22 condiciones reales de identidad y documentos, todas dentro de una transacción revertida, con cero cuentas de prueba residuales y dos Keynotes conservadas. La excepción de aceptación de identidad se limita a las líneas de presentación de AuthContext y compara el resto del archivo con la base inmutable; cualquier cambio de servidor o sesión sigue requiriendo aceptación completa.

Publicación nativa verificada: https://github.com/santiagohzszmex/GBA-VISTA-seeitdifferently/releases/tag/workspace-v0.1.4.1-beta.1. Los tres instaladores provienen de ee1e4fa21558c6f2e32524d9e2891ae640342a9d, CI 38087523604 exitosa. Se verificaron las firmas con el binario del actualizador anterior y los bytes públicos de instaladores y paquetes. La app candidata de Apple Silicon mostró el aviso real antes de restaurar la sesión de Santiago y entrar a GIMG sin solicitar PIN ni licencia. La interacción completa de actualización en Windows sigue pendiente; su instalación y arranque sí pasaron.
