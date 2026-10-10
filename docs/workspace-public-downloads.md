# Descargas de Workspace

El propietario autorizó publicar una beta con avisos visibles, mientras las firmas oficiales siguen pendientes. La beta distingue Apple Silicon, Mac Intel y Windows x64 y enlaza a archivos públicos permanentes de GitHub Releases. macOS conserva su sello ad hoc sin notarización de Apple; Windows se distribuye sin Authenticode. Las advertencias se muestran antes de cada botón. No se modifica la seguridad del equipo.

El generador de releases conserva los siete requisitos de aceptación, el commit exacto y la verificación de bytes públicos. El canal stable sigue exigiendo notarización y Authenticode. El canal beta exige además betaDistributionAuthorized=true y admite únicamente los estados ad-hoc/unsigned previstos. Las pruebas cubren el rechazo de una beta sin autorización, de aceptación incompleta y de bytes distintos.

La CI instala cada paquete en un directorio temporal, compara el ejecutable instalado con el compilado y comprueba su arranque. Esta prueba no se presenta como una prueba interactiva completa de identidad en Windows. La app de Apple Silicon instalada en /Applications/GBA Workspace.app abrió localmente la sesión real de Santiago, con Dirección de GIMG y administración de licencias sin solicitar código.

Las cuentas Dueño con autoridad de plataforma vigente no necesitan código. Los demás usuarios conservan sus licencias configurables desde activación. La web utiliza membresía y los roles de GIMG permanecen separados de los rangos de GBA.

Publicación: https://github.com/santiagohzszmex/GBA-VISTA-seeitdifferently/releases/tag/workspace-v0.1.0-beta.1. Los tres instaladores provienen del commit 033686bfdd8e2bcd6223d8515fcad6d5b839eaf4, CI 38013985537 exitosa. Sus bytes públicos se descargaron y verificaron antes de generar releases.json. acceptance.json conserva las pruebas de cada instalador y las limitaciones de firma e identidad interactiva de Windows.
