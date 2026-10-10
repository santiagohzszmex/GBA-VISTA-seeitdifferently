# Actualizaciones manuales de Workspace

La app comprueba si hay una versión nueva al abrirse y cada seis horas mientras está visible. Una versión disponible muestra el icono de descarga. Abrir el aviso presenta la versión y sus notas. **Descargar actualización** descarga y verifica el paquete; **Instalar y reiniciar** inicia la instalación únicamente cuando el usuario lo pulsa. **Más tarde** conserva la decisión pendiente. Un fallo de red o de firma no instala nada.

El aviso está disponible también antes del inicio de sesión y en la pantalla de licencia. Actualizar no cambia cuentas, roles, membresías, fechas de licencia ni asignaciones de GIMG. La web continúa con su despliegue habitual.

## Publicar una nueva versión

1. Cambiar la versión en `src-tauri/tauri.conf.json` y `src-tauri/Cargo.toml`, guardar los cambios y subir la rama al repositorio autorizado.
2. Ejecutar **Workspace native candidates** desde GitHub Actions, seleccionando esa rama. Mantener desactivada la notarización mientras no exista membresía y certificado de Apple. El proceso compila Mac Apple Silicon, Mac Intel y Windows x64, instala cada candidato y comprueba su arranque.
3. En el Mac de publicación, tener el mismo commit que ejecutó CI, compilar una vez la app para disponer del verificador nativo, y preparar un archivo con las notas de la versión.
4. Preparar los archivos sin publicarlos:

   ```sh
   npm run desktop:publish -- --run ID_DE_EJECUCION --notes notas-de-version.md
   ```

5. Revisar `release-candidates/publish-ID_DE_EJECUCION/`. Para publicar los paquetes beta y activar el aviso en las apps:

   ```sh
   npm run desktop:publish -- --run ID_DE_EJECUCION --notes notas-de-version.md --publish
   ```

6. La herramienta prepara `public/gba/workspace/releases.json` después de verificar las descargas públicas. Revisar y subir ese cambio para actualizar también los enlaces de la página GBA.

La clave privada de firma permanece en `~/.tauri/workspace-updates.key`, protegida con permisos 0600 y fuera del repositorio. No se sube a GitHub Actions ni se incluye en instaladores. Conservar una copia privada de respaldo: las apps existentes confían en la clave pública correspondiente. La herramienta de publicación comprueba que la clave coincide, verifica los paquetes con la biblioteca Minisign del actualizador y rechaza versiones repetidas, matrices incompletas, archivos alterados y commits distintos del aprobado por CI.

Cada versión usa un GitHub Release propio con archivos inmutables. El Release `workspace-updates` contiene únicamente `latest.json`, que anuncia la última versión completa y sus firmas. Se promociona después de verificar los bytes públicos de los tres paquetes; una compilación o descarga fallida no anuncia una actualización parcial.

La firma de actualización de Workspace es independiente de la notarización de Apple y de Authenticode. Continúan los avisos de distribución beta de macOS y Windows. [Documentación oficial del actualizador Tauri](https://v2.tauri.app/plugin/updater/).

La beta 0.1.0 anterior no incluía este actualizador: sus usuarios deben instalar una vez la nueva beta. A partir de esa instalación, las siguientes versiones podrán descargarse e instalarse desde el aviso de Workspace.

## Icono y macOS

Se conserva exactamente el arte entregado en `GBA-Workspace-icon`, variante sin sombra y con alfa transparente, en PNG, ICNS e ICO. El nombre visible de la app es Workspace y su identificador sigue siendo `software.gba.workspace`.

Algunos macOS recientes añaden su propio recuadro al mostrar el icono de una app. En el Mac de Santiago se aplicó el PNG original como icono personalizado mediante Obtener información. Esta preferencia de Finder pertenece al equipo; no se incorpora como metadatos dentro de los paquetes firmados. [Procedimiento de Apple para personalizar iconos](https://support.apple.com/en-lamr/guide/mac-help/mchlp2313/27/mac/27).

La instalación y el arranque se verifican en los tres corredores nativos. La actualización interactiva completa de Windows debe seguir comprobándose en un Windows real; el arranque en CI no sustituye esa prueba.
