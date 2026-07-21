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

    if not maskable:
        r = int(S * 0.22)
        mask = Image.new("L", (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=r, fill=255)
        bg = Image.new("RGB", (S, S), (0, 0, 0))
        bg.paste(img, (0, 0), mask)
        img = bg
        d = ImageDraw.Draw(img)

    cx = S * 0.44
    pad = 1.0 if maskable else 0.0

    # console silhouette: tall standing shape, flared top/bottom, pinched middle
    y0, yM, y1 = S * (0.16 + pad*0.03), S * 0.50, S * (0.80 - pad*0.03)
    wT, wM, wB = S * 0.135, S * 0.065, S * 0.165

    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    poly = [
        (cx - wT, y0), (cx - wM, yM), (cx - wB, y1),
        (cx + wB, y1), (cx + wM, yM), (cx + wT, y0),
    ]
    ld.polygon(poly, fill=(232, 228, 240, 255))
    # soften corners with a blur-free rounding: draw small circles at the joints
    for (px, py) in poly:
        rr = S * 0.02
        ld.ellipse([px - rr, py - rr, px + rr, py + rr], fill=(232, 228, 240, 255))

    layer = layer.rotate(-5, resample=Image.BICUBIC, center=(cx, (y0 + y1) / 2))
    img.paste(layer, (0, 0), layer)
    d = ImageDraw.Draw(img)

    # oval base
    base_w, base_h = S * 0.30, S * 0.045
    base_cy = y1 + S * 0.05
    d.ellipse([cx - base_w/2, base_cy - base_h/2, cx + base_w/2, base_cy + base_h/2],
              fill=(120, 114, 138))

    # amber accent stripe + two small dot details (evoke buttons/vents)
    d.line([(cx - S*0.01, y0 + S*0.05), (cx - S*0.01, y1 - S*0.05)],
           fill=(245, 166, 35), width=int(S * 0.018))
    for dy in (0.30, 0.38):
        rr = S * 0.012
        px, py = cx + wB*0.35, y1 - (y1 - yM) * (1 - dy)
        d.ellipse([px - rr, py - rr, px + rr, py + rr], fill=(20, 17, 28))

    # small green check badge, top-right
    if not maskable:
        rad = S * 0.115
        bx, by = S * 0.83, S * 0.185
        d.ellipse([bx - rad, by - rad, bx + rad, by + rad], fill=(46, 213, 115))
        lw = int(S * 0.03)
        p1 = (bx - rad*0.45, by + rad*0.02)
        p2 = (bx - rad*0.08, by + rad*0.42)
        p3 = (bx + rad*0.52, by - rad*0.42)
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
