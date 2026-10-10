# Workspace: documentos por edición y administración en Configuración

La pantalla de trabajo abre los documentos de la edición seleccionada. El menú superior contiene Ediciones y Keynotes; Configuración queda junto a la cuenta. Licencias, integrantes, permisos, administración de ediciones y auditoría ya no ocupan la navegación del trabajo cotidiano.

## Organización

- Las pestañas superiores representan los proyectos o microediciones que el servidor permite consultar. No se crean ediciones de producción a partir de los ejemplos locales.
- Cada edición tiene Documentos, Entregables, Calendario y Mi jornada. Los archivos, fechas y recuentos se filtran por el proyecto seleccionado.
- Documentos recupera la disposición de lista de archivos y documento abierto. El concepto corresponde al `brief` existente; los demás documentos muestran la última versión de los entregables de esa edición. «Abrir trabajo» lleva al entregable para escribir, entregar o revisar según los permisos existentes.
- Configuración muestra sus controles según las respuestas del servidor. Licencias exige `platform_owner`; el directorio utiliza los permisos del contexto de proyecto/área/entregable. El rango general de GBA sigue separado de la asignación en GIMG.
- Cambiar de edición limpia la selección anterior y desactiva acciones durante la carga. Las respuestas antiguas no reemplazan el contexto seleccionado.
- El contenido, los créditos, el enlace al activo y el resumen de una versión sin entregar generan un aviso al navegar. «Seguir escribiendo» conserva el texto; «Descartar y salir» permite continuar. Esto no es autoguardado ni cubre todavía los borradores de todos los formularios administrativos.
- Las pestañas admiten flechas, Home y End. El aviso tiene foco inicial, Escape, recorrido de foco y etiquetas accesibles. En ventanas estrechas la lista se coloca sobre el documento.

## Alcance de esta revisión

Se reutilizan las tablas y RPC existentes; no hay migraciones, nuevos permisos, cargas de archivos ni cambios de autenticación. Las Keynotes conservan su editor, historial y publicación propios. Los ejemplos de Halloween, Día de Muertos y Leyendas sólo aparecen en la demostración local de desarrollo.

Queda para la siguiente revisión el editor visual para investigaciones y dirección creativa: tipografía, tamaño, color del texto, paleta con muestras y códigos, documentos independientes e imágenes subidas con acceso por edición. Esta revisión permite evaluar primero la distribución del espacio y su navegación.

## Trabajo local

Rama: `codex/workspace-edition-layout`. Repositorio de trabajo: `work/workspace-updates`, dentro del espacio local de Codex. Se conserva la copia original de GBA-VISTA; este cambio no instala una nueva app ni publica una versión o despliegue.

```sh
npm run dev -- --host 127.0.0.1 --port 5186 --strictPort
```

Vista de demostración: `http://127.0.0.1:5186/?workspace-preview=1`. El acceso de demostración sólo se habilita con `import.meta.env.DEV`; las acciones de escritura están desactivadas.

## Validación

- `npm run build`: compilación de la web.
- `npm run workspace:build`: compilación del frontend de escritorio para Safari 14.
- `npm run test:workspace`: 117 comprobaciones de Workspace y 78 del gateway existentes, con base local de pruebas.
- `node tests/desktop-config.test.mjs`: CSP, capacidades mínimas y separación entre membresía web y licencia de escritorio.
- Navegador local: cambio de edición y aislamiento de documentos/fechas, búsqueda, navegación con teclado, Configuración, Keynotes, conservar/descartar texto y distribución a 1280 y 548 píxeles. Diez comprobaciones completadas; consola sin errores.

La navegación visual se comprobó con datos de demostración. No se hizo una entrega real contra producción ni se construyeron nuevos instaladores nativos. Las compilaciones conservan el aviso de Vite por tamaño de los paquetes JavaScript.
