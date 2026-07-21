import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")
os.makedirs(OUT, exist_ok=True)

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def rrect(d, box, r, **kw):
    d.rounded_rectangle(box, radius=r, **kw)

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

    pad = 1.0 if maskable else 0.0  # extra inset for maskable safe zone
    cx = S * 0.5

    # game case (tilted rounded rectangle), tucked to upper-left
    case_w, case_h = S * 0.30, S * 0.44
    case_cx, case_cy = S * (0.40 - pad*0.03), S * (0.40 - pad*0.03)
    case = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    cd = ImageDraw.Draw(case)
    rrect(cd, [case_cx - case_w/2, case_cy - case_h/2, case_cx + case_w/2, case_cy + case_h/2],
          r=S*0.045, fill=(232, 228, 240, 255))
    # spine shadow stripe
    rrect(cd, [case_cx - case_w/2, case_cy - case_h/2, case_cx - case_w/2 + S*0.07, case_cy + case_h/2],
          r=S*0.045, fill=(180, 174, 196, 255))
    case = case.rotate(-16, resample=Image.BICUBIC, center=(case_cx, case_cy))
    img.paste(case, (0, 0), case)
    d = ImageDraw.Draw(img)

    # controller body, lower-right, overlapping the case
    ctl_w, ctl_h = S * 0.50, S * 0.30
    ctl_cx, ctl_cy = S * (0.60 + pad*0.02), S * (0.63 + pad*0.02)
    amber = (245, 166, 35)
    rrect(d, [ctl_cx - ctl_w/2, ctl_cy - ctl_h/2, ctl_cx + ctl_w/2, ctl_cy + ctl_h/2],
          r=ctl_h*0.5, fill=amber)
    # grips
    grip_r = ctl_h * 0.46
    d.ellipse([ctl_cx - ctl_w/2 - grip_r*0.35, ctl_cy + ctl_h*0.05,
               ctl_cx - ctl_w/2 + grip_r*1.15, ctl_cy + ctl_h*0.05 + grip_r*1.5], fill=amber)
    d.ellipse([ctl_cx + ctl_w/2 - grip_r*1.15, ctl_cy + ctl_h*0.05,
               ctl_cx + ctl_w/2 + grip_r*0.35, ctl_cy + ctl_h*0.05 + grip_r*1.5], fill=amber)
    # face buttons
    br = S * 0.018
    for dx, dy in [(0.14, -0.02), (0.20, 0.05), (0.14, 0.12), (0.08, 0.05)]:
        d.ellipse([ctl_cx + ctl_w*dx - br, ctl_cy + ctl_h*dy - br,
                   ctl_cx + ctl_w*dx + br, ctl_cy + ctl_h*dy + br], fill=(15, 13, 22))
    # d-pad
    dpx, dpy = ctl_cx - ctl_w*0.30, ctl_cy
    dl = S * 0.028
    d.rectangle([dpx - dl, dpy - dl*0.35, dpx + dl, dpy + dl*0.35], fill=(15, 13, 22))
    d.rectangle([dpx - dl*0.35, dpy - dl, dpx + dl*0.35, dpy + dl], fill=(15, 13, 22))

    # small green check badge, top-right
    if not maskable:
        rad = S * 0.135
        bx, by = S * 0.80, S * 0.22
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
