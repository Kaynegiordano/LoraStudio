"""Icône de Lora Studio : carré arrondi violet (l'accent du Studio IA de KaneApp), un « L » et trois étincelles.
python build/make-icon.py  →  build/icon.ico (16 à 256 px) et app/icon.png (256 px)."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
S = 1024


def draw() -> Image.Image:
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # fond : dégradé vertical violet
    grad = Image.new("RGBA", (S, S))
    top, bot = (152, 128, 205), (96, 72, 150)
    for y in range(S):
        t = y / (S - 1)
        grad.paste(tuple(round(a + (b - a) * t) for a, b in zip(top, bot)) + (255,), (0, y, S, y + 1))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle((40, 40, S - 40, S - 40), radius=210, fill=255)
    im.paste(grad, (0, 0), mask)
    # « L »
    w = (255, 255, 255, 255)
    d.rounded_rectangle((300, 230, 430, 790), radius=40, fill=w)
    d.rounded_rectangle((300, 660, 720, 790), radius=40, fill=w)
    # étincelles (losanges à 4 branches)
    def spark(cx, cy, r):
        k = r * 0.28
        d.polygon([(cx, cy - r), (cx + k, cy - k), (cx + r, cy), (cx + k, cy + k), (cx, cy + r), (cx - k, cy + k), (cx - r, cy), (cx - k, cy - k)], fill=w)
    spark(690, 360, 120)
    spark(800, 540, 60)
    spark(560, 520, 45)
    return im


big = draw()
big.resize((256, 256), Image.LANCZOS).save(ROOT / "app" / "icon.png")
big.save(ROOT / "build" / "icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("ok")
