# Siniestro Tattoo Studio · demo de Elevate Negocios

Pieza spec privada: la página que se le propone al dueño y, después, el video
vertical que la presenta. **Fase 0: la página real** (mobile-first, 390 × 844).

## Estructura

| Carpeta | Qué hay |
|---|---|
| `assets/` | Originales recibidos. No se editan. |
| `site/` | La página: `index.html` + `img/` + `fonts/`. Es la fuente de verdad. |
| `dist/siniestro-tattoo-demo.html` | La misma página en un solo archivo (fuentes e imágenes incrustadas) para abrirla en un celular sin servidor. |
| `tools/` | `key_logo.py` (recorte del logo), `prep_photos.py` (fotos), `build_single.py` (archivo único), `shoot_review.js` y `shoot_phase0.js` (capturas con Playwright). |
| `review/` | Capturas de revisión y hoja de contacto. |

## Probar

```bash
cd site && python3 -m http.server 8123   # http://127.0.0.1:8123/
python3 tools/build_single.py            # regenera dist/
node tools/shoot_phase0.js               # capturas 2x + hoja de contacto
```

Parámetros de URL:

- `?lang=en` abre en inglés (también se recuerda la última elección).
- `?filter=color` abre la galería filtrada.
- `?wa=52XXXXXXXXXX` manda las cotizaciones a otro número (para probar sin escribirle al estudio).
- `?capture=1` no abre WhatsApp al enviar (para grabar el video).

## Datos

Verificados: nombre, dirección (Calle Rayón 262, Zona Centro, 20000 Aguascalientes, Ags.),
WhatsApp 449 209 3214, tatuando desde el 05/04/2003 (el número de años se calcula solo).

Marcadores honestos (pendientes del dueño): **Tus precios aquí**, **Tu horario aquí**,
**Tu trabajo aquí** (espacios de galería sin foto). No se usan calificaciones, reseñas,
precios, horario, ni el nombre o la cara del tatuador.

## Pendiente antes de publicar (si el dueño acepta)

- Foto original de *León y caballero*: la actual es provisional, recortada del grid de Instagram (baja resolución).
- Foto de referencia: hoy el cliente la adjunta a mano en el chat (WhatsApp no permite adjuntar desde un enlace).
  Para que viaje sola hace falta un endpoint que la guarde y devuelva un link (`CONFIG.uploadEndpoint`).
- Quitar `<meta name="robots" content="noindex">` y la línea de demo del pie.
- Dominio y hosting.

Fuentes: Big Shoulders Display y Barlow, SIL Open Font License 1.1 (`site/fonts/OFL-*.txt`).
