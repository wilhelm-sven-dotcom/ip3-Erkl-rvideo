"""Standbilder je Storyboard-Einstellung aus der finalen Bildsequenz (out/final) und Übersichtsbogen.

    python3 render/storyboard_stills.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'out', 'final')
DST = os.path.join(ROOT, 'docs', 'storyboard')
os.makedirs(DST, exist_ok=True)
FONT = os.path.join(ROOT, 'engine', 'assets', 'fonts', 'SpaceGrotesk-Medium.ttf')

SHOTS = [
    (2.0, 'Luftbild, Messwertkarte'), (3.8, 'Sonne da. Leistung weg.'), (6.8, 'Wer regelt Ihren Solarpark?'),
    (9.9, 'Sturzflug zum Modul'), (11.6, 'Makro, roter Datenpunkt'), (13.8, 'Datenstrom zur Station'),
    (15.0, 'Kontur-Morph zum Schaltschrank'), (18.3, 'Datenquellen im Schaltschrank'), (22.0, 'Dashboard Übersicht'),
    (27.2, 'Eingriff Direktvermarkter'), (30.8, 'Eingriff Netzbetreiber, Redispatch'), (33.5, 'Vorgabe und Leistung verknüpft'),
    (42.5, 'Einstrahlung vom Sensor'), (47.5, 'Mögliche Leistung (berechnet)'), (51.3, 'Entgangene Energie in MWh'),
    (58.6, 'Abrechnungsprüfung, Abweichung'), (62.8, 'Nachweis bereitstellen'), (68.5, 'Anlagenakte, Betriebsführung'),
    (73.5, 'Lageplan wird Luftbild'), (78.8, 'Speicher als Planungsszenario'), (84.3, 'Tageskurve am Himmel'),
    (88.5, 'Abbinder'),
]

thumbs = []
for i, (t, label) in enumerate(SHOTS, 1):
    f = os.path.join(SRC, f'f{round(t * 30):05d}.jpg')
    im = Image.open(f).convert('RGB')
    name = f'{i:02d}_{t:05.1f}s.jpg'.replace('.', ',', 1).replace(',jpg', '.jpg')
    im.resize((1280, 720), Image.LANCZOS).save(os.path.join(DST, name), quality=84, optimize=True)
    thumbs.append((im.resize((480, 270), Image.LANCZOS), t, label))

cols = 4
rows = (len(thumbs) + cols - 1) // cols
pad, cap = 16, 34
W = cols * 480 + (cols + 1) * pad
H = rows * (270 + cap) + (rows + 1) * pad
sheet = Image.new('RGB', (W, H), '#0C1A3D')
d = ImageDraw.Draw(sheet)
fnt = ImageFont.truetype(FONT, 17)
for k, (im, t, label) in enumerate(thumbs):
    x = pad + (k % cols) * (480 + pad)
    y = pad + (k // cols) * (270 + cap + pad)
    sheet.paste(im, (x, y))
    m, s = divmod(t, 60)
    d.text((x, y + 276), f'{int(m):02d}:{s:04.1f}'.replace('.', ',') + f'  {label}', font=fnt, fill='#E8E7EF')
sheet.save(os.path.join(DST, 'uebersicht.jpg'), quality=86, optimize=True)
print('ok', len(thumbs))
