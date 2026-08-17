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

    pad = 1.0 if maskable else 0.0
    cx, cy = S * 0.5, S * (0.52 + pad * 0.01)
    amber = (245, 166, 35)

    # gamepad body: wide rounded bar + two rounded grips hanging below the ends
    body_w, body_h = S * (0.72 - pad*0.06), S * 0.30
    d.rounded_rectangle(
        [cx - body_w/2, cy - body_h/2, cx + body_w/2, cy + body_h/2],
        radius=body_h*0.5, fill=amber
    )
    grip_r = body_h * 0.5
    for side in (-1, 1):
        gx = cx + side * body_w/2 * 0.86
        d.ellipse([gx - grip_r, cy + body_h*0.05, gx + grip_r, cy + body_h*0.05 + grip_r*1.7], fill=amber)

    # d-pad, left side
    dpx, dpy = cx - body_w*0.27, cy
    dl, dt = S * 0.075, S * 0.028
    d.rounded_rectangle([dpx - dl, dpy - dt, dpx + dl, dpy + dt], radius=dt*0.5, fill=(20, 17, 28))
    d.rounded_rectangle([dpx - dt, dpy - dl, dpx + dt, dpy + dl], radius=dt*0.5, fill=(20, 17, 28))

    # face buttons, right side
    br = S * 0.032
    bcx, bcy = cx + body_w*0.27, cy
    off = S * 0.075
    for dx, dy in [(0, -off), (off, 0), (0, off), (-off, 0)]:
        d.ellipse([bcx+dx-br, bcy+dy-br, bcx+dx+br, bcy+dy+br], fill=(20, 17, 28))

    # small green check badge, top-right
    if not maskable:
        rad = S * 0.135
        bx, by = S * 0.82, S * 0.20
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
