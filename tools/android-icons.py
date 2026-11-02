# Ícones e tela de abertura do app Android a partir de site/icons/icon-512.png
#   python tools/android-icons.py
import os
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'app', 'android', 'app', 'src', 'main', 'res')
icon = Image.open(os.path.join(ROOT, 'site', 'icons', 'icon-512.png')).convert('RGBA')
BG = icon.getpixel((10, 256))[:3]
DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for d, k in DENS.items():
    folder = os.path.join(RES, f'mipmap-{d}')
    # ícone antigo (48dp) e redondo
    s = round(48 * k)
    sq = icon.resize((s, s), Image.LANCZOS)
    sq.save(os.path.join(folder, 'ic_launcher.png'))
    mask = Image.new('L', (s * 4, s * 4), 0); ImageDraw.Draw(mask).ellipse((0, 0, s * 4 - 1, s * 4 - 1), fill=255)
    rnd = Image.new('RGBA', (s, s), (0, 0, 0, 0)); rnd.paste(sq, (0, 0), mask.resize((s, s), Image.LANCZOS)); rnd.save(os.path.join(folder, 'ic_launcher_round.png'))
    # ícone adaptativo (108dp): o desenho ocupa a zona segura de 72dp; o resto é a cor de fundo
    f = round(108 * k); inner = round(72 * k)
    fg = Image.new('RGBA', (f, f), (0, 0, 0, 0))
    fg.paste(icon.resize((inner, inner), Image.LANCZOS), ((f - inner) // 2, (f - inner) // 2))
    fg.save(os.path.join(folder, 'ic_launcher_foreground.png'))
with open(os.path.join(RES, 'values', 'ic_launcher_background.xml'), 'w', encoding='utf-8') as fh:
    fh.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#%02X%02X%02X</color>\n</resources>\n' % BG)
# tela de abertura: fundo escuro do app com o ícone no meio
n = 0
for root, _, files in os.walk(RES):
    for fn in files:
        if fn != 'splash.png': continue
        p = os.path.join(root, fn); w, h = Image.open(p).size
        sp = Image.new('RGB', (w, h), (5, 6, 11)); s = round(min(w, h) * 0.28)
        ic = icon.resize((s, s), Image.LANCZOS)
        m = Image.new('L', (s, s), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, s - 1, s - 1), radius=s // 4.5, fill=255)
        sp.paste(ic, ((w - s) // 2, (h - s) // 2), m); sp.save(p); n += 1
print('ícones Android gerados | fundo #%02X%02X%02X | %d telas de abertura' % (BG + (n,)))
