#!/usr/bin/env python3
"""Sample the dominant colour around every hex centre of a CC:E map image from
the VASSAL module (median RGB of an annulus 12..38 px around the centre dot,
so the white dot itself is ignored). Useful to pre-classify hill levels
(hill shades are flat colours on these maps) and woods/field/water before a
human/agent verifies each hex with crop_hex.py.

Reads ONLY the image given; prints JSON to stdout.

    python3 -I hex_colors.py <MapN.png> [--palette]

--palette additionally clusters the samples (rounded to 16 levels) and prints
how many hexes share each rounded colour, to identify a map's hill shades.
"""
import json
import math
import sys
from collections import Counter
from PIL import Image

DX, DY, X0, Y0 = 146.15829323957013, 168.8, 79.0, 28.0
COLS = 'ABCDEFGHIJKLMNO'


def center(k, n):
    y = Y0 + (n + 1) * DY + DY / 2 if k % 2 == 0 else Y0 + (n + 2) * DY
    return X0 + (k + 3) * DX, y


def main(a):
    if not a:
        print(__doc__)
        return 1
    im = Image.open(a[0]).convert('RGB')
    px = im.load()
    out = {}
    for k in range(15):
        for n in range(1, 11):
            cx, cy = center(k, n)
            rs, gs, bs = [], [], []
            for r in range(12, 39, 4):
                for ang in range(0, 360, 15):
                    x = int(cx + r * math.cos(math.radians(ang)))
                    y = int(cy + r * math.sin(math.radians(ang)))
                    p = px[x, y]
                    rs.append(p[0]); gs.append(p[1]); bs.append(p[2])
            med = lambda v: sorted(v)[len(v) // 2]
            out['%s%d' % (COLS[k], n)] = [med(rs), med(gs), med(bs)]
    if '--palette' in a:
        c = Counter(tuple(v // 16 * 16 for v in rgb) for rgb in out.values())
        print(json.dumps({'samples': out, 'palette': [[list(k), v] for k, v in c.most_common()]}))
    else:
        print(json.dumps(out))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
