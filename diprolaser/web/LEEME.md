# DIPROLASER · página web

Sitio estático (Vite). La carpeta `dist/` se sube tal cual a Netlify (arrastrar y soltar).

## Comandos

```bash
npm install
npm run dev            # para trabajar en local
npm run build          # build de producción (indexable)
npm run build:preview  # build de vista previa (agrega noindex)
npm run serve          # sirve dist/ en http://localhost:4173
```

## Cambiar textos

Todo el texto está en `index.html`, en orden de secciones (hero, cinta, configurador, placa, regalos,
técnicas, cómo trabajamos, videos, Aguascalientes, cierre). Los mensajes de WhatsApp están en
`src/lib/whatsapp.js` (número y plantillas).

## Redes sociales

En `index.html`, sección `cta`, hay un comentario `<!-- TODO: links reales de redes -->`.
Cuando estén confirmadas, cambia cada `<span class="icon-btn" role="img" ...>` por
`<a class="icon-btn" href="https://..." target="_blank" rel="noopener" aria-label="Instagram">`.

## Fotos

- Originales del cliente: `../kit/` (no se editan).
- Fotos web: `public/img/` (AVIF + WebP en dos anchos). Para regenerarlas: `node tools/export.mjs [grupo]`.
- Promocionales: se ampliaron ×4 con Real-ESRGAN (`tools/upscale.py`); las máscaras de recolor salen de `tools/masks.py`.

## La gorra del configurador (render fotorrealista)

La gorra se modela en código (`src/configurator/cap.js`), se exporta a glTF y se renderiza en Blender (Cycles)
con texturas de tela escaneadas y un HDRI de estudio de Poly Haven (CC0). Por cada modelo hay 24 ángulos más
vista superior e inferior en `public/img/cap3d/<modelo>/`. La página calcula colores y logo sobre esos renders.
La placa metálica y el parche de piel se renderizan como capas aparte (`_plate`, `_patch`) y el logo se graba encima.

```bash
node tools/blender/export_cap.mjs build/cap.gltf      # geometría de la gorra
node tools/blender/export_overlays.mjs                # geometría de placa y parche
./tools/blender/render_all.sh                         # ~2 h 20 min en 4 núcleos (requiere pip install bpy OpenEXR)
MODELS="trucker" ./tools/blender/render_all.sh        # solo un modelo; si se corta, se salta lo que ya está completo
```

Texturas y HDRI (CC0, Poly Haven): velour_velvet, denim_fabric_05, stretch_poplin, bi_stretch, brown_leather,
brown_photostudio_02. Se descargan en `build/ph/` (no se publican).

## Parámetros de prueba

- `?wa=52XXXXXXXXXX` manda los WhatsApp a otro número.
- `?qa` desactiva el giro en el hero (para capturas automáticas).

## Antes de publicar

- Confirmar si es pieza de cortesía (build:preview) o publicación oficial (build).
- Poner las URL absolutas en `og:url` y `og:image` cuando haya dominio.
- Links reales de redes.
