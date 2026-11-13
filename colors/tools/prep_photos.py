"""Recortes de las fotos recibidas (capturas de Instagram) para la pagina y el video.
Solo recorta restos de interfaz (franjas blancas, contador 5/5, barra de scroll) y encuadra;
no recolorea ni rellena. Uso: python3 colors/tools/prep_photos.py"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC, OUT = ROOT / "assets", ROOT / "site/img"
# nombre de salida: (archivo, caja de recorte)
CROPS = {
    "logo": ("00_logo_colors_boutique_perfil.jpg", (70, 100, 910, 940)),      # cuadrado dentro del circulo de la marca
    "girasoles": ("01_girasoles_arreglo.jpg", (0, 0, 1300, 940)),
    "jarron-verde": ("02_arreglo_jarron_verde.jpg", (0, 0, 1300, 1310)),
    "orquideas": ("03_orquideas_maceta_blanca.jpg", (0, 44, 1320, 1320)),
    "bouquet-rosa": ("04_bouquet_rosa_papel_rosa.jpg", (0, 120, 1320, 1230)),
    "ramo-negro": ("05_ramo_papel_negro_liston_rojo.jpg", (0, 0, 1300, 920)),
    "caja-redonda": ("06_caja_redonda_flores_rosas.jpg", (0, 0, 1000, 1180)),
    "centro-mesa": ("07_centro_de_mesa_hacienda.jpg", (170, 470, 1320, 1140)),   # solo el centro de mesa
    "mesa-larga": ("08_mesa_larga_centros_de_mesa.jpg", (0, 0, 1320, 1380)),
    "centro-limones": ("09_centro_de_mesa_limones.jpg", (0, 140, 1320, 1320)),   # fuera el contador 5/5
    "tulipanes": ("10_florero_con_tulipanes.jpg", (6, 150, 1310, 1150)),         # fuera el contador 6/6
}
OUT.mkdir(parents=True, exist_ok=True)
for name, (f, box) in CROPS.items():
    im = Image.open(SRC / f).convert("RGB").crop(box)
    im.save(OUT / f"{name}.jpg", quality=90, optimize=True)
    print(name, im.size)
