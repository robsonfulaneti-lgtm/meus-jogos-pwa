import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")
os.makedirs(OUT, exist_ok=True)

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def make(size, maskable=False):
    S = size * 4  # supersample
    img = Image.new("RGB", (S, S), (15, 13, 22))
    d = ImageDraw.Draw(img)
    top, bot = (36, 22, 58), (14, 12, 20)
    for y in range(S):
        d.line([(0, y), (S, y)], fill=lerp(top, bot, y / S))

    # rounded corners (skip if maskable -> full bleed)
    if not maskable:
        r = int(S * 0.22)
        mask = Image.new("L", (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=r, fill=255)
        bg = Image.new("RGB", (S, S), (0, 0, 0))
        bg.paste(img, (0, 0), mask)
        img = bg
        d = ImageDraw.Draw(img)

    # checkmark in a soft circle
    cx, cy = S * 0.5, S * 0.52
    rad = S * (0.26 if maskable else 0.30)
    d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=(46, 213, 115))
    lw = int(S * 0.055)
    p1 = (cx - rad * 0.45, cy + rad * 0.02)
    p2 = (cx - rad * 0.08, cy + rad * 0.42)
    p3 = (cx + rad * 0.52, cy - rad * 0.42)
    d.line([p1, p2, p3], fill=(15, 13, 22), width=lw, joint="curve")
    for p in (p1, p2, p3):
        d.ellipse([p[0]-lw/2, p[1]-lw/2, p[0]+lw/2, p[1]+lw/2], fill=(15, 13, 22))

    return img.resize((size, size), Image.LANCZOS)

make(192).save(os.path.join(OUT, "icon-192.png"))
make(512).save(os.path.join(OUT, "icon-512.png"))
make(512, maskable=True).save(os.path.join(OUT, "icon-512-maskable.png"))
make(180).save(os.path.join(OUT, "apple-touch-icon.png"))
make(32).save(os.path.join(OUT, "favicon-32.png"))
print("icons gerados em", OUT)
