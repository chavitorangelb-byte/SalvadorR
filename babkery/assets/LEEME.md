# Assets de Babkery

Recortados con `babkery/tools/crop_assets.py` desde capturas del catálogo de WhatsApp Business
(1320×2868, en `src/`). Las cajas de recorte quedan en `crops.json`.

- Resolución en píxeles ≈ 1050×1270 (verticales) y 1320×740–874 (horizontales); la efectiva es algo menor
  porque el visor de WhatsApp reescala. Sirven a pantalla casi completa con grano/desenfoque de bordes.
- `02_avatar_logo_crema.jpg`: sale de la pantalla "Business info" (1320×1320) pero su detalle real
  equivale a ~460 px: mostrarlo a ≤ 460 px de ancho en el cuadro de 1080.
- `06` y `01` tienen fondo azul marino y `03` un paño con rayas azules: son fotos, no diseño;
  06 y 01 solo recortados o enmascarados.
- `x12`–`x14` son extras del mismo catálogo (no están en el brief).
- No se usan: la foto del croissant almendrado (libro y taza con letras) ni la foto del letrero
  (es foto de un cliente en Google, con su nombre visible; no se guardó).
