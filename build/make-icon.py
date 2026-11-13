"""Icône de Lora Studio : un « L » en facettes plates, de la même famille que le K de KaneApp.

Même fond bleu nuit, mêmes couleurs (relevées sur build/icon-source.png de KaneApp), même fût rouge corail incliné
que le K ; le pied du L est coupé en deux facettes, jaune puis cyan, comme les deux bras du K.
python build/make-icon.py  →  build/icon.ico (16 à 256 px) et app/icon.png (256 px).
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
S = 1024
SS = 4                        # dessin à 4096 px puis réduction : bords lisses (Pillow ne lisse pas les polygones)
BG = (18, 22, 31, 255)        # #12161f
CORAL = (251, 89, 72, 255)    # #fb5948
YELLOW = (252, 200, 1, 255)   # #fcc801
CYAN = (3, 220, 238, 255)     # #03dcee

# Formes dans un carré de 100 × 100 (fond : 5,7 à 94,3, coins de 17), comme l'icône de KaneApp
STEM = [(23, 22.6), (41, 17), (34.7, 77.8), (16.3, 83.6)]
FOOT_A = [(38.4, 66), (58, 64.3), (54, 83.6), (36.6, 83.6)]
FOOT_B = [(61.2, 64), (84, 62), (84, 83.6), (57.2, 83.6)]


def draw(size: int) -> Image.Image:
    big = size * SS
    k = big / 100
    im = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((5.7 * k, 5.7 * k, 94.3 * k, 94.3 * k), radius=17 * k, fill=BG)
    for shape, color in ((STEM, CORAL), (FOOT_A, YELLOW), (FOOT_B, CYAN)):
        d.polygon([(x * k, y * k) for x, y in shape], fill=color)
    return im.resize((size, size), Image.LANCZOS)


# Chaque taille de l'.ico est dessinée à sa taille (pas réduite depuis 1024) : le 16 px reste net.
sizes = [16, 24, 32, 48, 64, 128, 256]
frames = [draw(s) for s in sizes]
draw(256).save(ROOT / "app" / "icon.png")
draw(S).save(ROOT / "build" / "icon-source.png")
frames[-1].save(ROOT / "build" / "icon.ico", sizes=[(s, s) for s in sizes], append_images=frames[:-1])
print("ok")
