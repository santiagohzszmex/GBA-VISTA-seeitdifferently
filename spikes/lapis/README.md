# Lapislázuli: spike de Fase 1

No contiene un servicio de producción ni implementa multipart. Los archivos generados son **sintéticos**; el PSD está aplanado y el KRA es un contenedor de prueba, no una exportación certificada de Krita. Las mediciones de cabecera no garantizan capas ni integridad de toda la obra.

Desde la raíz del repositorio, con las dependencias del lockfile instaladas:

```sh
node spikes/lapis/generate-synthetic.mjs /private/tmp/workspace-lapis-fixtures
python3 spikes/lapis/generate-layered.py
node spikes/lapis/run.mjs /private/tmp/workspace-lapis-fixtures /private/tmp/lapis-results.json
```

El generador de contenedores sintéticos requiere Pillow en Python; el procesamiento local usa `sharp`/libvips, fijado en el lockfile como dependencia del runtime de desarrollo. No se distribuye con Workspace.

Para **muestras reales**, usar otra carpeta y `--real`; no ejecutar el generador dentro de esa carpeta:

```sh
node spikes/lapis/run.mjs /ruta/a/muestras /private/tmp/lapis-real-results.json --real
```

Cada archivo se mide en un proceso separado. `peakProcessRssMiB` incluye el proceso y bibliotecas nativas, no equivale a memoria consumida en Cloudflare. Los bytes de PSD/TIFF/KRA se leen mediante `openAsBlob` y rangos acotados.

Para comprobar el binding real sin R2 ni identidades:

```sh
node node_modules/wrangler/bin/wrangler.js dev --config spikes/lapis/wrangler.jsonc --port 8797
LAPIS_BINDING_URL=http://127.0.0.1:8797 node spikes/lapis/run.mjs /private/tmp/workspace-lapis-fixtures /private/tmp/lapis-cloudflare-results.json
```

El binding tiene `remote: true`: esto sí llama a Cloudflare Images y requiere una sesión autorizada. El ensayo usa una sola variante 800×1000 WebP. No confundirlo con la prueba local de libvips, que genera preview 1600×2000 y miniatura 320×400. No habilitar el binding en producción con estos archivos de configuración.

`remote-worker.mjs` es exclusivamente para `wrangler dev --remote` y solo admite URLs de archivos **SYNTHETIC-*.png** en un túnel de prueba. El ensayo del 16/10 devolvió error 9504 por timeout del origen; no probó el límite remoto de 100 MB documentado por Cloudflare. No usar un túnel público para muestras reales privadas.

`validate-layered.mjs` reconoce cabeceras PSD/TIFF clásicos y un manifiesto ZIP KRA acotado (directorio 256 KiB, 2000 entradas, mimetype almacenado sin compresión). ZIP64/multidisco, cifrado y otras variantes no quedan validados por este prototipo. PROCREATE/AFPHOTO/CLIP devuelven explícitamente `unverified`; no se abren ni se representan.

Fecha de compatibilidad del spike: 2026-10-13, máxima admitida por el workerd instalado con Wrangler 4.149.0. No se actualizó el runtime de producción.

## Repetir el ensayo de Fase 2

No usar originales privados. Las muestras se crean fuera del repositorio y tienen píxeles sintéticos, GPS 0,0 y padding auxiliar para alcanzar exactamente cada peso. **No representan la complejidad de un exportado real.**

```sh
node spikes/lapis/generate-synthetic.mjs /private/tmp/workspace-lapis-fixtures
python3 spikes/lapis/phase2-fixtures.py
npx wrangler dev --config spikes/lapis/wrangler.jsonc --port 8797 --inspector-port 9297
```

Con el Worker listo, en otra terminal:

```sh
node spikes/lapis/run-phase2-binding.mjs /private/tmp/workspace-lapis-phase2-fixtures http://localhost:8797
```

No editar el procesador durante el ensayo: el recargador reinicia las solicitudes POST en curso. Se guardan `provider.webp` y `clean.webp` junto a las muestras; verificar con Pillow `getexif()` y `get_ifd(34853)` que el original sí tenga EXIF/GPS y ambos derivados no. `getchannel('A').getextrema()` permite comprobar que queda un canal alfa variable. Detener Wrangler al finalizar. El binding es remoto y usa transformaciones de desarrollo, sin bucket ni identidades de Workspace. Los datos medidos están en `results-phase2-2026-10-16.json`; el límite de 100 MB por URL remoto **no se probó ni se usa**.
