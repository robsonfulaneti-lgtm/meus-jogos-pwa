# Gera os ícones do app a partir de uma imagem em tools/icone/ (a mais recente).
#   python tools/icon-from-image.py
# Imagens com cantos brancos (ícone arredondado pronto) têm os cantos pintados com a cor de fundo,
# pra o ícone ficar sem borda: o Android/iPhone arredondam sozinhos.
import os, sys, glob
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.join(ROOT, 'icone')
OUT = os.path.join(ROOT, '..', 'site', 'icons')

files = [f for f in glob.glob(os.path.join(SRC_DIR, '*')) if not os.path.basename(f).startswith('_')]
if not files:
    sys.exit('coloque uma imagem em tools/icone/')
src = max(files, key=os.path.getmtime)
im = Image.open(src).convert('RGBA')

# recorta quadrado no centro
w, h = im.size
s = min(w, h)
im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))

# cor de fundo: amostra perto da borda esquerda, no meio da altura (dentro do quadrado colorido)
bg = im.getpixel((int(s * 0.06), s // 2))[:3]
px = im.load()
# pinta de fundo a moldura e os cantos inteiros (o desenho fica no meio e não chega lá),
# o que some com o branco e com a borda suavizada do arredondado original
corner = int(s * 0.14)
edge = int(s * 0.035)
for y in range(s):
    for x in range(s):
        in_corner = (x < corner or x >= s - corner) and (y < corner or y >= s - corner)
        in_edge = x < edge or y < edge or x >= s - edge or y >= s - edge
        if in_corner or in_edge:
            px[x, y] = (*bg, 255)

# corta uma faixa fininha pra sumir com a emenda do arredondado original
inset = int(s * 0.015)
im = im.crop((inset, inset, s - inset, s - inset))
base = Image.new('RGBA', im.size, (*bg, 255))
base.alpha_composite(im)
base = base.convert('RGB')

def save(size, name, pad=0.0):
    canvas = Image.new('RGB', (size, size), bg)
    inner = int(size * (1 - pad * 2))
    canvas.paste(base.resize((inner, inner), Image.LANCZOS), ((size - inner) // 2, (size - inner) // 2))
    canvas.save(os.path.join(OUT, name), optimize=True)

os.makedirs(OUT, exist_ok=True)
save(512, 'icon-512.png')
save(192, 'icon-192.png')
save(512, 'icon-512-maskable.png', pad=0.08)   # Android recorta em círculo: um pouco de respiro
save(180, 'apple-touch-icon.png')
save(32, 'favicon-32.png')
print('ícones gerados a partir de', os.path.basename(src), '| fundo', '#%02x%02x%02x' % bg)
