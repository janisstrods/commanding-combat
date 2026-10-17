#!/usr/bin/env python3
"""Crop one hex (optionally with its neighbours) out of a Combat Commander:
Europe map image from the VASSAL module, enlarge it and optionally draw the
hex outline, hexside numbers and the label, so a transcriber can read terrain,
hexside features and elevation zoomed in.

Reads ONLY the image path given; writes ONLY the output path given.
Never point it at, or run it from inside, the extracted module directory as cwd.

    python3 -I crop_hex.py <MapN.png> <HEX> <out.png> [--ring 0|1|2] [--scale 2.0] [--no-overlay]
    python3 -I crop_hex.py <MapN.png> --sheet <out.png> [--cols A-E] [--scale 0.7]
        (sheet: every hex of the given columns with outline+label overlay)

Geometry (identical for all 15 boards of module 2.6.4, images 3300x2600 px):
  flat-topped hexes, column pitch DX=146.158 px, row pitch DY=168.8 px,
  hex circumradius R = DY/sqrt(3) = 97.46 px.
  Hex label = column letter A..O + row number 1..10.
  centre_x = 79 + (k+3)*DX                    (k = 0 for A ... 14 for O)
  centre_y = 28 + (n+1)*DY + DY/2   if k even (A,C,E,..,O; the "high" columns)
           = 28 + (n+2)*DY          if k odd  (B,D,..,N; half a hex lower)
  e.g. A1=(517.5,450.0)  B1=(663.6,534.4)  O10=(2563.7,1969.2)
Hexside numbering used in overlays (matches the 1..6 compass printed on the
map, also used by the Breeze event): 1=N, 2=NE, 3=SE, 4=S, 5=SW, 6=NW.
"""
import math
import sys
from PIL import Image, ImageDraw, ImageFont

DX, DY, X0, Y0 = 146.15829323957013, 168.8, 79.0, 28.0
R = DY / math.sqrt(3)
COLS = 'ABCDEFGHIJKLMNO'


def center(label):
    k = COLS.index(label[0].upper())
    n = int(label[1:])
    col = k + 3
    if k % 2 == 0:
        y = Y0 + (n + 1) * DY + DY / 2
    else:
        y = Y0 + (n + 2) * DY
    return X0 + col * DX, y


def neighbours(label):
    """Return {side: label} for sides 1..6 (N, NE, SE, S, SW, NW)."""
    k = COLS.index(label[0].upper())
    n = int(label[1:])
    if k % 2 == 0:
        d = {1: (0, -1), 2: (1, -1), 3: (1, 0), 4: (0, 1), 5: (-1, 0), 6: (-1, -1)}
    else:
        d = {1: (0, -1), 2: (1, 0), 3: (1, 1), 4: (0, 1), 5: (-1, 1), 6: (-1, 0)}
    out = {}
    for s, (dk, dn) in d.items():
        kk, nn = k + dk, n + dn
        if 0 <= kk < 15 and 1 <= nn <= 10:
            out[s] = '%s%d' % (COLS[kk], nn)
    return out


def corners(cx, cy):
    return [(cx + R * math.cos(math.radians(a)), cy + R * math.sin(math.radians(a)))
            for a in (0, 60, 120, 180, 240, 300)]


def draw_overlay(dr, label, ox, oy, scale, color=(255, 0, 255)):
    cx, cy = center(label)
    pts = [((x - ox) * scale, (y - oy) * scale) for x, y in corners(cx, cy)]
    dr.line(pts + [pts[0]], fill=color, width=max(1, int(2 * scale)))
    sx, sy = (cx - ox) * scale, (cy - oy) * scale
    dr.text((sx - 10 * scale, sy + 20 * scale), label, fill=color)
    # hexside numbers just inside each side midpoint (1=N ... 6=NW)
    for side, ang in zip(range(1, 7), (270, 330, 30, 90, 150, 210)):
        mx = cx + 0.72 * R * math.cos(math.radians(ang))
        my = cy + 0.72 * R * math.sin(math.radians(ang))
        dr.text(((mx - ox) * scale - 3, (my - oy) * scale - 5), str(side), fill=color)


def crop_hex(img, label, ring, scale, overlay):
    cx, cy = center(label)
    half_w = R + ring * DX + 10
    half_h = DY / 2 + ring * DY + 10
    box = (int(cx - half_w), int(cy - half_h), int(cx + half_w), int(cy + half_h))
    im = img.crop(box).convert('RGB')
    im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    if overlay:
        dr = ImageDraw.Draw(im)
        labels = {label}
        if ring >= 1:
            labels |= set(neighbours(label).values())
        if ring >= 2:
            for l in list(labels):
                labels |= set(neighbours(l).values())
        for l in labels:
            draw_overlay(dr, l, box[0], box[1], scale,
                         (255, 0, 255) if l == label else (0, 160, 255))
    return im


def sheet(img, cols, scale):
    k0, k1 = COLS.index(cols[0]), COLS.index(cols[-1])
    labels = ['%s%d' % (COLS[k], n) for k in range(k0, k1 + 1) for n in range(1, 11)]
    xs = [center(l)[0] for l in labels]
    ys = [center(l)[1] for l in labels]
    box = (int(min(xs) - R - 10), int(min(ys) - DY), int(max(xs) + R + 10), int(max(ys) + DY))
    im = img.crop(box).convert('RGB')
    im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    dr = ImageDraw.Draw(im)
    for l in labels:
        draw_overlay(dr, l, box[0], box[1], scale)
    return im


def main(a):
    if len(a) < 3:
        print(__doc__)
        return 1
    img = Image.open(a[0])
    scale = float(a[a.index('--scale') + 1]) if '--scale' in a else 2.0
    if a[1] == '--sheet':
        cols = a[a.index('--cols') + 1].split('-') if '--cols' in a else ['A', 'O']
        scale = float(a[a.index('--scale') + 1]) if '--scale' in a else 0.7
        sheet(img, cols, scale).save(a[2])
        return 0
    ring = int(a[a.index('--ring') + 1]) if '--ring' in a else 1
    crop_hex(img, a[1].upper(), ring, scale, '--no-overlay' not in a).save(a[2])
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
