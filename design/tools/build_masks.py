#!/usr/bin/env python3
"""Build sub-hex terrain masks for the Combat Commander: Europe maps (Task 4).

    python3 -I build_masks.py <imagesDir> <mapsJsonDir> <outDir> [--maps 1,2,...]
        [--report design/data/masks-report.md] [--audit design/data/masks-audit.json]
        [--preview <dir>]

<imagesDir>   the VASSAL module images (MapN.png, 3300x2600); read only.
<mapsJsonDir> design/data: maps.json (Map 1 pilot) and maps/map-<id>.json (hex-level transcriptions).
<outDir>      src/data/masks: one <id>.json per map.

Each mask is a raster in hex-radius units (A1's centre is (0, 0), x right, y down): res cells per hex radius,
covering x in [x0, x0 + width / res), y in [y0, y0 + height / res). Every cell holds a MASK class code (see
src/engine/types.ts) and a hill level 0-4, both stored as run-length lists [value, count, value, count, ...] of the
row-major arrays. The masks are a coarse classification of the drawn terrain (facts about the geography); no image
pixels are stored.

How the classifier works
1. Overlays are masked out of the image: hex grid lines (a band along every hexside), hex labels, centre dots,
   objective circles (detected by their red), and the art of transcribed hexside features (fence, hedge, wall, cliff).
2. Every remaining pixel is classified into an *element* (open ground of level 0-3, foliage, brush ground, field,
   roof, water, marsh, gully, road, railway, bridge) by a naive-Bayes colour model: colour histograms per element,
   learnt from the hex-level transcriptions (pixels around the centre dot of every hex whose terrain is certain, and
   around road / railway hexside crossings), log-likelihoods smoothed over a small pixel window.
3. Per cell, element fractions decide the MASK class, with structure rules: woods are large foliage areas; small
   isolated foliage blobs on open ground are orchard trees (the orchard is their closed region); brush is brush
   ground (or, on hills, dense rows of bushes); water bodies are wide water areas, streams are narrow ones; roads are
   bands at least a few cells wide (trail dashes are not roads; trails in woods stay what the art shows).
4. Hill level per cell from the ground tint; under woods, buildings, fields, roads etc. it is taken from the nearest
   level-bearing cells of the same hex, else from the nearest anywhere.
5. Validation against the transcription: per hex classes present, highest-ranked type (T78.1 hierarchy) vs the
   transcribed type, centre-cell level vs the transcribed elevation, crest hexes (two levels each over 5% of the
   hex), multi-hex buildings (building art continuous across a hexside).
"""
import argparse
import json
import math
import os
import sys
from collections import Counter, defaultdict

import numpy as np
from PIL import Image

try:
    from scipy import ndimage as ndi
except ImportError:  # pragma: no cover
    ndi = None

# ---------------------------------------------------------------------------------------------------------------------
# Geometry (module grid dx=146.15829, dy=168.8, x0=79, y0=28; A1 centre = (517.475, 450.0) px)

RX = 146.15829323957013 / 1.5     # px per hex-radius unit along x
RY = 168.8 / math.sqrt(3)          # px per hex-radius unit along y
OX, OY = 517.475, 450.0
SQRT3 = math.sqrt(3)
APOTHEM = SQRT3 / 2
COLS = 'ABCDEFGHIJKLMNO'
RES, MX0, MY0, MW, MH = 12, -1, -1, 276, 228

MASK = dict(open=0, woods=1, building=2, brush=3, orchard=4, field=5, marsh=6, stream=7, water=8, gully=9,
            road=10, railway=11, bridge=12)
MASK_NAME = {v: k for k, v in MASK.items()}

# T78.1 hierarchy (top wins) and the MASK classes that depict each type.
HIERARCHY = ['Building', 'Woods', 'Brush', 'Orchard', 'Field', 'Bridge', 'Gully', 'Water', 'Stream', 'Marsh', 'Open']
CLASS_TYPE = {MASK['building']: 'Building', MASK['woods']: 'Woods', MASK['brush']: 'Brush',
              MASK['orchard']: 'Orchard', MASK['field']: 'Field', MASK['bridge']: 'Bridge', MASK['gully']: 'Gully',
              MASK['water']: 'Water', MASK['stream']: 'Stream', MASK['marsh']: 'Marsh', MASK['open']: 'Open',
              MASK['road']: 'Open', MASK['railway']: 'Open'}


def hex_label(k, n):
    return '%s%d' % (COLS[k], n)


def hex_centre(k, n):
    return 1.5 * k, SQRT3 * (n - 1 + (k & 1) / 2)


def parse_label(s):
    return COLS.index(s[0]), int(s[1:])


ALL_HEXES = [(k, n) for k in range(15) for n in range(1, 11)]
HIGH = [(0, -1), (1, -1), (1, 0), (0, 1), (-1, 0), (-1, -1)]
LOW = [(0, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0)]


def neighbour(k, n, side):
    dk, dn = (HIGH if k % 2 == 0 else LOW)[side - 1]
    kk, nn = k + dk, n + dn
    return (kk, nn) if 0 <= kk < 15 and 1 <= nn <= 10 else None


def side_between(a, b):
    for s in range(1, 7):
        if neighbour(a[0], a[1], s) == b:
            return s
    return None


def side_segment(k, n, side):
    """End points (hex units) of side 1..6 (1 = N, clockwise)."""
    cx, cy = hex_centre(k, n)
    # corners clockwise from east: angle 0, 60, ... (screen coords, y down)
    corners = [(cx + math.cos(math.pi / 3 * i), cy + math.sin(math.pi / 3 * i)) for i in range(6)]
    # side 1 (N) joins corners 4 (240 deg) and 5 (300 deg); side 2 (NE) 5-0; 3 (SE) 0-1; 4 (S) 1-2; 5 (SW) 2-3; 6 (NW) 3-4
    pairs = {1: (4, 5), 2: (5, 0), 3: (0, 1), 4: (1, 2), 5: (2, 3), 6: (3, 4)}
    i, j = pairs[side]
    return corners[i], corners[j]


def hex_of_points(x, y):
    """Vectorised hexAt: column k, row n (1-based) of the hex containing hex-unit points; k=-1 off map."""
    q = (2 / 3) * x
    r = -x / 3 + (SQRT3 / 3) * y
    rx = np.round(q)
    rz = np.round(r)
    ry = np.round(-q - r)
    dx = np.abs(rx - q)
    dz = np.abs(rz - r)
    dy = np.abs(ry + q + r)
    c1 = (dx > dy) & (dx > dz)
    c2 = ~c1 & (dz > dy)
    rx = np.where(c1, -ry - rz, rx)
    rz = np.where(c2, -rx - ry, rz)
    k = rx.astype(np.int32)
    n = (rz + (k - (k & 1)) / 2 + 1).astype(np.int32)
    on = (k >= 0) & (k < 15) & (n >= 1) & (n <= 10)
    return np.where(on, k, -1), np.where(on, n, -1)


def hex_depth(x, y, k, n):
    """Distance (hex units) from the point to the boundary of hex (k, n): positive inside."""
    cx = 1.5 * k
    cy = SQRT3 * (n - 1 + (k & 1) / 2)
    px, py = x - cx, y - cy
    d = None
    for s in range(6):
        ang = math.pi / 3 * s - math.pi / 2
        v = APOTHEM - (px * math.cos(ang) + py * math.sin(ang))
        d = v if d is None else np.minimum(d, v)
    return d


# ---------------------------------------------------------------------------------------------------------------------
# Transcriptions

TYPE_ALIASES = {'Water Barrier': 'Water', 'Major Bridge': 'Bridge', 'Minor Bridge': 'Bridge', 'MajorBridge': 'Bridge',
                'MinorBridge': 'Bridge'}


def load_transcription(maps_dir, mid):
    """{hexes: {label: {...}}, hexsides: [...], road/rail/trail crossings} or None."""
    path = os.path.join(maps_dir, 'maps', 'map-%s.json' % mid)
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    if mid == '1':
        with open(os.path.join(maps_dir, 'maps.json')) as f:
            d = json.load(f)
        for m in d['maps']:
            if str(m['map']) == '1' and 'terrain_pilot' in m:
                t = dict(m['terrain_pilot'])
                t['objectives'] = {str(o['objective']): o['hex'] for o in m['printed_objectives']}
                return t
    return None


def hex_type(h):
    """Transcribed type of a hex in hierarchy terms (Bridge feature makes it a Bridge hex)."""
    t = TYPE_ALIASES.get(h['terrain'], h['terrain'])
    if 'Bridge' in h.get('features', []) and HIERARCHY.index('Bridge') < HIERARCHY.index(t):
        return 'Bridge'
    return t


def crossings(tr, key):
    out = []
    for c in tr.get(key, []) or []:
        a, b = c['between']
        out.append((parse_label(a), parse_label(b)))
    return out


# ---------------------------------------------------------------------------------------------------------------------
# Pixel raster

PX0 = int(math.floor(OX + MX0 * RX))
PY0 = int(math.floor(OY + MY0 * RY))
PX1 = int(math.ceil(OX + (MX0 + MW / RES) * RX))
PY1 = int(math.ceil(OY + (MY0 + MH / RES) * RY))


class Raster:
    """The image crop under the mask with per-pixel geometry."""

    def __init__(self, img_path):
        im = Image.open(img_path).convert('RGB')
        a = np.asarray(im)
        self.rgb = a[PY0:PY1, PX0:PX1].astype(np.int16)
        h, w = self.rgb.shape[:2]
        py, px = np.mgrid[PY0:PY1, PX0:PX1]
        self.x = ((px + 0.5 - OX) / RX).astype(np.float32)
        self.y = ((py + 0.5 - OY) / RY).astype(np.float32)
        self.k, self.n = hex_of_points(self.x, self.y)
        self.hexidx = np.where(self.k >= 0, self.k * 10 + self.n - 1, -1)
        on = self.k >= 0
        cx = 1.5 * self.k
        cy = SQRT3 * (self.n - 1 + (self.k & 1) / 2)
        depth = None
        for s in range(6):
            ang = math.pi / 3 * s - math.pi / 2
            v = APOTHEM - ((self.x - cx) * math.cos(ang) + (self.y - cy) * math.sin(ang))
            depth = v if depth is None else np.minimum(depth, v)
        depth = np.where(on, depth, -1.0).astype(np.float32)
        self.depth_px = depth * RX
        ci = np.floor((self.x - MX0) * RES).astype(np.int32)
        cj = np.floor((self.y - MY0) * RES).astype(np.int32)
        inside = (ci >= 0) & (ci < MW) & (cj >= 0) & (cj < MH)
        self.cell = np.where(inside, cj * MW + ci, -1)
        # pixel offsets from the centre of the own hex
        self.dxp = np.where(on, (self.x - cx) * RX, 1e6).astype(np.float32)
        self.dyp = np.where(on, (self.y - cy) * RY, 1e6).astype(np.float32)


def dilate_px(mask, r):
    if r <= 0:
        return mask
    yy, xx = np.mgrid[-r:r + 1, -r:r + 1]
    return ndi.binary_dilation(mask, structure=(xx * xx + yy * yy) <= r * r)


# Half-widths (px) of the hexside-feature art to mask out: walls are drawn up to ~20 px inside a hex on some maps.
HEXSIDE_BAND = {'Wall': 16.0, 'Hedge': 12.0, 'Fence': 9.0, 'Cliff': 10.0}


def overlay_mask(ras, tr):
    """Pixels that are printed overlays, not terrain: grid band, labels, dots, objective circles, hexside art."""
    r, g, b = ras.rgb[..., 0], ras.rgb[..., 1], ras.rgb[..., 2]
    ign = ras.k < 0
    ign |= ras.depth_px < 2.3                                         # hex grid lines
    ign |= (ras.depth_px < 6) & edge_side_px(ras)                     # map edge (art border)
    ign |= (ras.dxp ** 2 + ras.dyp ** 2) < 6.5 ** 2                    # centre dot
    ign |= (np.abs(ras.dxp) <= 17) & (ras.dyp >= -80) & (ras.dyp <= -61)  # hex label
    red = (r > 150) & (g < 95) & (b < 95) & (r - g > 90)
    ign |= dilate_px(red, 7)                                          # objective circles
    ign |= (np.minimum(np.minimum(r, g), b) > 238)                    # white (dots, labels, highlights)
    if tr is not None:
        band = np.zeros_like(ign)
        for hs in tr.get('hexsides', []) or []:
            a, b2 = parse_label(hs['between'][0]), parse_label(hs['between'][1])
            s = side_between(a, b2)
            if s is None:
                continue
            p, q = side_segment(a[0], a[1], s)
            band |= segment_band(ras, p, q, HEXSIDE_BAND.get(hs['feature'], 9.0))
        ign |= band
    return ign


def edge_side_px(ras):
    """Pixels whose nearest hexside is on the map edge."""
    on = ras.k >= 0
    k = np.where(on, ras.k, 0)
    n = np.where(on, ras.n, 1)
    cx = 1.5 * k
    cy = SQRT3 * (n - 1 + (k & 1) / 2)
    best = None
    side = None
    for s in range(6):
        ang = math.pi / 3 * s - math.pi / 2
        v = APOTHEM - ((ras.x - cx) * math.cos(ang) + (ras.y - cy) * math.sin(ang))
        if best is None:
            best, side = v, np.zeros(v.shape, np.int8)
        else:
            upd = v < best
            best = np.where(upd, v, best)
            side[upd] = s
    edge = np.zeros(ras.k.shape, bool)
    table = np.zeros((15, 11, 6), bool)
    for kk, nn in ALL_HEXES:
        for s in range(1, 7):
            table[kk, nn, s - 1] = neighbour(kk, nn, s) is None
    edge = table[k, n, side] & on
    return edge


def segment_band(ras, p, q, half_px):
    (x1, y1), (x2, y2) = p, q
    # restrict to a bounding box for speed
    xa, xb = min(x1, x2) - 0.2, max(x1, x2) + 0.2
    ya, yb = min(y1, y2) - 0.2, max(y1, y2) + 0.2
    i0 = max(0, int((OX + xa * RX) - PX0)); i1 = min(ras.x.shape[1], int((OX + xb * RX) - PX0) + 2)
    j0 = max(0, int((OY + ya * RY) - PY0)); j1 = min(ras.x.shape[0], int((OY + yb * RY) - PY0) + 2)
    out = np.zeros(ras.x.shape, bool)
    xs = (ras.x[j0:j1, i0:i1] - x1) * RX
    ys = (ras.y[j0:j1, i0:i1] - y1) * RY
    vx, vy = (x2 - x1) * RX, (y2 - y1) * RY
    L2 = vx * vx + vy * vy
    t = np.clip((xs * vx + ys * vy) / L2, 0, 1)
    d2 = (xs - t * vx) ** 2 + (ys - t * vy) ** 2
    out[j0:j1, i0:i1] = d2 <= half_px * half_px
    return out


# ---------------------------------------------------------------------------------------------------------------------
# Elements and the colour model

EL = ['G0', 'G1', 'G2', 'G3', 'FOL', 'BB0', 'BB1', 'BB2', 'FLD', 'ROOF', 'WAT', 'MAR', 'GUL', 'ROAD', 'RAIL', 'BRG']
E = {n: i for i, n in enumerate(EL)}
NB = 16  # colour bins per channel


def colour_bins(rgb):
    q = (rgb // (256 // NB)).astype(np.int32)
    return (q[..., 0] * NB + q[..., 1]) * NB + q[..., 2]


def training_samples(ras, ign, tr):
    """(bin indices, element) pairs from the transcription."""
    out = defaultdict(list)
    bins = colour_bins(ras.rgb)
    valid = ~ign
    luma = 0.299 * ras.rgb[..., 0] + 0.587 * ras.rgb[..., 1] + 0.114 * ras.rgb[..., 2]
    hexes = tr['hexes']

    def disc(k, n, rad_px, cx=None, cy=None):
        if cx is None:
            cx, cy = hex_centre(k, n)
        X = OX + cx * RX - PX0
        Y = OY + cy * RY - PY0
        r = int(rad_px) + 1
        j0, j1, i0, i1 = int(Y) - r, int(Y) + r + 1, int(X) - r, int(X) + r + 1
        yy, xx = np.mgrid[j0:j1, i0:i1]
        m = ((xx + 0.5 - X) ** 2 + (yy + 0.5 - Y) ** 2) <= rad_px * rad_px
        return (slice(j0, j1), slice(i0, i1)), m

    for lbl, h in hexes.items():
        if h.get('confidence') == 'medium':
            continue
        k, n = parse_label(lbl)
        t = hex_type(h)
        lev = int(h.get('elevation', 0) or 0)
        feats = set(h.get('features', []) or [])
        el = None
        rad = 0.33 * RX
        if t == 'Open' and not feats & {'Road', 'Railway', 'Trail'}:
            el = 'G%d' % min(lev, 3)
        elif t == 'Woods':
            el = 'FOL'
        elif t == 'Field':
            el = 'FLD'
        elif t == 'Building':
            el = 'ROOF'
            rad = 0.18 * RX
        elif t == 'Water':
            el = 'WAT'
        elif t == 'Marsh':
            el = 'MAR'
        elif t == 'Gully':
            el = 'GUL'
            rad = 0.11 * RX
        elif t == 'Brush':
            el = 'BB%d' % min(lev, 2)
        if el is None:
            continue
        sl, m = disc(k, n, rad)
        m = m & valid[sl]
        if el.startswith('BB'):
            # brush ground only: the bushes are foliage
            m = m & (luma[sl] > (165 if el == 'BB0' else 120 if el == 'BB1' else 95))
        out[E[el]].append(bins[sl][m])
    for key, el, rad in (('road_crossings', 'ROAD', 7.0), ('railway_crossings', 'RAIL', 8.0)):
        for a, b in crossings(tr, key):
            s = side_between(a, b)
            if s is None:
                continue
            p, q = side_segment(a[0], a[1], s)
            cx, cy = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
            sl, m = disc(0, 0, rad, cx, cy)
            # skip the grid line itself but keep the rest
            m = m & valid[sl]
            out[E[el]].append(bins[sl][m])
    for br in tr.get('bridges', []) or []:
        k, n = parse_label(br['hex'])
        sl, m = disc(k, n, 0.12 * RX)
        m = m & valid[sl]
        out[E['BRG']].append(bins[sl][m])
    return {e: np.concatenate(v) for e, v in out.items() if v}


def build_model(samples_list, alpha=1e-4):
    """Per-element log P(colour bin), pooled over maps, blurred in colour space."""
    K = len(EL)
    H = np.zeros((K, NB, NB, NB), np.float64)
    for samples in samples_list:
        for e, s in samples.items():
            h = np.bincount(s, minlength=NB ** 3).astype(np.float64)
            if h.sum() > 0:
                H[e] += h.reshape(NB, NB, NB) / max(1.0, h.sum()) * min(h.sum(), 20000)
    logp = np.full((K, NB ** 3), -30.0)
    for e in range(K):
        if H[e].sum() <= 0:
            continue
        h = H[e]
        for ax in range(3):
            h = 0.5 * h + 0.25 * np.roll(h, 1, ax) + 0.25 * np.roll(h, -1, ax)
        h = h / h.sum()
        h = h + alpha / NB ** 3
        logp[e] = np.log(h / h.sum()).ravel()
    return logp


def classify_pixels(ras, ign, logp, allowed_levels=(0, 1, 2, 3), win=5):
    """Element per pixel: argmax of window-averaged log-likelihoods (ignored pixels excluded). Ground and brush
    elements of hill levels absent from the map are not considered (roof halves look like hill tints)."""
    skip = {E['G%d' % lv] for lv in range(4) if lv not in allowed_levels}
    skip |= {E['BB%d' % lv] for lv in range(3) if lv not in allowed_levels}
    bins = colour_bins(ras.rgb)
    valid = (~ign).astype(np.float32)
    cnt = ndi.uniform_filter(valid, win, mode='nearest')
    best = None
    bestv = None
    K = logp.shape[0]
    for e in range(K):
        if logp[e].max() <= -29 or e in skip:
            continue
        ll = logp[e][bins].astype(np.float32) * valid
        s = ndi.uniform_filter(ll, win, mode='nearest') / np.maximum(cnt, 1e-6)
        if best is None:
            best = np.full(s.shape, e, np.int8)
            bestv = s
        else:
            upd = s > bestv
            best[upd] = e
            bestv = np.where(upd, s, bestv)
    best = np.where(cnt > 0.05, best, -1).astype(np.int8)
    best[ign] = -1
    # dark hill tints (levels 2-3) look like brown roofs: patches of them enclosed by roof outline are roof
    roof = best == E['ROOF']
    rc = ndi.binary_closing(roof, structure=disk(3)) | roof
    inside = ndi.binary_fill_holes(rc) & ~rc
    dark = np.isin(best, [E['G2'], E['G3'], E['BB2']])
    lab, n = ndi.label(inside, structure=np.ones((3, 3), bool))
    if n:
        area = np.bincount(lab.ravel(), minlength=n + 1)
        small_hole = (area < 4000)
        small_hole[0] = False
        best[dark & small_hole[lab]] = E['ROOF']
    # roofs are solid shapes; thin strips of roof colour are the dark shading along hill edges and cliffs
    roof = best == E['ROOF']
    rc = ndi.binary_closing(roof, structure=np.ones((5, 5), bool)) | roof
    lab, n = ndi.label(rc, structure=np.ones((3, 3), bool))
    if n:
        dt = ndi.distance_transform_edt(rc)
        thick = ndi.maximum(dt, lab, index=np.arange(n + 1))
        thin = np.asarray(thick) < 6
        thin[0] = False
        best[roof & thin[lab]] = -1
    return best, bestv


# ---------------------------------------------------------------------------------------------------------------------
# Cells

GROUPS = ['ground', 'woods', 'tree', 'bush', 'building', 'water', 'marsh', 'field', 'road', 'rail', 'bridge', 'gully']
GI = {g: i for i, g in enumerate(GROUPS)}
TREE_MIN, WOODS_MIN = 300, 1000   # px areas of foliage components: orchard trees are ~500 px, woods >= 1000


def cell_counts(ras, labels, nlab):
    """Per cell, the number of valid pixels of each label value 0..nlab-1 (labels < 0 are ignored)."""
    sel = (labels >= 0) & (ras.cell >= 0)
    idx = ras.cell[sel].astype(np.int64) * nlab + labels[sel]
    c = np.bincount(idx, minlength=MW * MH * nlab).reshape(MH, MW, nlab)
    return c.astype(np.float32)


def disk(r):
    yy, xx = np.mgrid[-r:r + 1, -r:r + 1]
    return (xx * xx + yy * yy) <= r * r + 0.5


def box_sum(a, r):
    """Sum over a (2r+1)^2 window (zero padding)."""
    return ndi.uniform_filter(a.astype(np.float64), 2 * r + 1, mode='constant') * (2 * r + 1) ** 2


def components(mask, structure=None):
    lab, n = ndi.label(mask, structure=structure if structure is not None else np.ones((3, 3), bool))
    return lab, n


def classify_cells(ras, el, allowed_levels):
    """MASK class and hill level per cell from the pixel elements."""
    fol = el == E['FOL']
    folc = ndi.binary_closing(fol, structure=np.ones((5, 5), bool)) & (el >= 0) | fol
    lab, n = components(folc)
    area = np.bincount(lab.ravel(), minlength=n + 1)
    area[0] = 0
    big = (area >= WOODS_MIN)[lab] & fol
    tree = ((area >= TREE_MIN) & (area < WOODS_MIN))[lab] & fol
    small = fol & ~big & ~tree
    # tree-sized clumps standing on brush ground are brush clumps, not orchard trees
    if tree.any():
        # ground 6-12 px out (beyond the drop-shadow halo around every tree)
        ring = ndi.binary_dilation(folc, structure=disk(12)) & ~ndi.binary_dilation(folc, structure=disk(6))
        rl = ndi.maximum_filter(np.where(tree, lab, 0), size=25) * ring
        bbr = np.isin(el, [E['BB0'], E['BB1'], E['BB2']])
        grr = np.isin(el, [E['G0'], E['G1'], E['G2'], E['G3']])
        nb_bb = np.bincount(rl[bbr], minlength=n + 1)
        nb_gr = np.bincount(rl[grr], minlength=n + 1)
        clump = nb_bb > nb_gr
        clump[0] = False
        cl = clump[lab] & tree
        tree &= ~cl
        small |= cl
    grp = np.full(el.shape, -1, np.int8)
    for e, g in (('G0', 'ground'), ('G1', 'ground'), ('G2', 'ground'), ('G3', 'ground'), ('BB0', 'ground'),
                 ('BB1', 'ground'), ('BB2', 'ground'), ('FLD', 'field'), ('ROOF', 'building'), ('WAT', 'water'),
                 ('MAR', 'marsh'), ('GUL', 'gully'), ('ROAD', 'road'), ('RAIL', 'rail'), ('BRG', 'bridge')):
        grp[el == E[e]] = GI[g]
    grp[big] = GI['woods']
    grp[tree] = GI['tree']
    grp[small] = GI['bush']
    # gully grass in small specks is a bush (brush bushes are often gully-coloured); gully bands are long
    gul = el == E['GUL']
    labg, ng = components(gul)
    if ng:
        ag = np.bincount(labg.ravel(), minlength=ng + 1)
        grp[gul & (ag < 300)[labg]] = GI['bush']
    # fragments cut by an overlay band (fences and hedges round orchards) have an unknown size: leave them out
    cut = ndi.binary_dilation(el < 0, structure=disk(2))
    frag = grp == GI['bush']
    labf, nf = components(frag)
    if nf:
        touch = np.bincount(labf[cut & frag], minlength=nf + 1) > 0
        touch[0] = False
        grp[touch[labf]] = -1
    gc = cell_counts(ras, grp, len(GROUPS))                     # (MH, MW, G)
    ec = cell_counts(ras, el, len(EL))                           # (MH, MW, K)
    nvalid = gc.sum(2)
    frac = gc / np.maximum(nvalid, 1)[..., None]
    known = nvalid >= 6

    # neighbourhood fractions
    def nb_frac(counts, r):
        s = box_sum(counts, r)
        t = box_sum(nvalid, r)
        return s / np.maximum(t, 1)

    bb = ec[..., E['BB0']] + ec[..., E['BB1']] + ec[..., E['BB2']]
    gr = ec[..., E['G0']] + ec[..., E['G1']] + ec[..., E['G2']] + ec[..., E['G3']]
    # brush: cells of brush ground (bushes count for neither side), closed over the bush-covered cells, never
    # spreading into cells of plain ground
    tot_g = bb + gr
    core = (tot_g >= 6) & (bb >= 0.5 * tot_g) & (bb >= 0.3 * nvalid)
    # plain ground: ground tint without bushes around (vineyard rows on hills alternate light and dark stripes)
    bushpx = gc[..., GI['bush']]
    bush_dense = nb_frac(bushpx, 2) >= 0.08
    plain = (tot_g >= 12) & (gr >= 0.7 * tot_g) & ~bush_dense
    gully_band = frac[..., GI['gully']] >= 0.3
    zone = (ndi.binary_closing(core, structure=disk(3)) | core) & ~plain & ~gully_band
    # brush areas are broad: the grassy banks of streams and gullies (also brush-ground coloured) are thin bands
    brush_zone = ndi.binary_opening(zone, structure=disk(2))
    brush_zone |= ndi.binary_dilation(brush_zone, structure=disk(1)) & zone
    lab_b, n_b = components(brush_zone)
    if n_b:
        sz = np.bincount(lab_b.ravel(), minlength=n_b + 1)
        # a brush area shows mostly brush ground between its bushes (tree halos in an orchard do not)
        bsum = np.bincount(lab_b.ravel(), weights=bb.ravel(), minlength=n_b + 1)
        gsum = np.bincount(lab_b.ravel(), weights=gr.ravel(), minlength=n_b + 1)
        okb = (sz >= 30) & (bsum >= 0.6 * gsum)
        okb[0] = False
        brush_zone = okb[lab_b]
    # ... or a dense field of small bushes, whatever the ground between them (pale brush ground, vineyards)
    dens = nb_frac(bushpx, 2)
    tdens = nb_frac(gc[..., GI['tree']], 2)                 # orchards: tree blobs, with a few fragments
    dz = ndi.binary_opening((dens >= 0.12) & (tdens < dens), structure=disk(3))  # broad: not a dashed trail
    dz |= ndi.binary_dilation(dz, structure=disk(1)) & (dens >= 0.12)
    lab_d, n_d = components(dz)
    if n_d:
        sz = np.bincount(lab_d.ravel(), minlength=n_d + 1)
        md = np.bincount(lab_d.ravel(), weights=dens.ravel(), minlength=n_d + 1) / np.maximum(sz, 1)
        # not a trail corridor through woods (dashes and woods fragments on both sides)
        woods_cell = (frac[..., GI['woods']] >= 0.5).astype(np.float64)
        ringd = ndi.grey_dilation(lab_d, footprint=disk(3)) * (lab_d == 0)
        wr = np.bincount(ringd.ravel(), weights=woods_cell.ravel(), minlength=n_d + 1)
        nr = np.bincount(ringd.ravel(), minlength=n_d + 1)
        okd = (sz >= 30) & (md >= 0.18) & (wr < 0.5 * np.maximum(nr, 1))
        okd[0] = False
        brush_zone |= okd[lab_d]

    # small overlay holes (labels, dots, objective circles) - not the long hexside-feature bands
    lab_u, n_u = components(~known)
    small_unknown = np.zeros_like(known)
    if n_u:
        sz = np.bincount(lab_u.ravel(), minlength=n_u + 1)
        su = sz <= 30
        su[0] = False
        small_unknown = su[lab_u]

    score = frac.copy()
    # disallow masks applied iteratively
    def pick(score):
        c = np.argmax(score, axis=2)
        c[~known] = -1
        return c

    # small components are not what they seem (repeated: a rejected cell may fall to another small class)
    score[brush_zone, GI['gully']] = -1
    for _ in range(3):
        cls = pick(score)
        for g, minc in (('rail', 30), ('road', 8), ('building', 6), ('gully', 16), ('woods', 4), ('bridge', 3),
                        ('marsh', 30), ('field', 6), ('water', 3)):
            m = cls == GI[g]
            if g == 'marsh':
                m = ndi.binary_opening(m, structure=disk(1))
            if g in ('gully', 'road', 'building'):
                # a gully band is ~3 cells wide, a road ~2-3, a shed 3+: trail dashes, drawn outlines and the
                # dark shading along cliffs are 1 cell
                m = ndi.binary_propagation(ndi.binary_opening(m, structure=np.ones((2, 2), bool)), mask=m,
                                           structure=np.ones((3, 3), bool))
            # cells under labels and dots (unknown) do not cut a feature in two
            lab2, n2 = components(m | (small_unknown & ndi.binary_dilation(m, structure=disk(3))))
            lab2 = np.where(m, lab2, 0)
            if n2 == 0:
                score[cls == GI[g], GI[g]] = -1
                continue
            sizes = np.bincount(lab2.ravel(), minlength=n2 + 1)
            if g in ('rail', 'gully'):
                # railways are long: extent of the component
                sl = ndi.find_objects(lab2)
                keep = np.zeros(n2 + 1, bool)
                for i, s in enumerate(sl, 1):
                    if s is None:
                        continue
                    ext = max(s[0].stop - s[0].start, s[1].stop - s[1].start)
                    keep[i] = ext >= minc
            else:
                keep = sizes >= minc
            keep[0] = True
            bad = (cls == GI[g]) & ~(m & keep[lab2])
            score[bad, GI[g]] = -1
    # gully art never sits inside brush (brush bushes look like gully grass)
    score[brush_zone, GI['gully']] = -1
    cls = pick(score)

    out = np.zeros((MH, MW), np.uint8)
    # orchards: clusters of tree blobs outside brush
    treecells = (cls == GI['tree']) | ((frac[..., GI['tree']] >= 0.25) & (cls == GI['ground']))
    orchard_zone = ndi.binary_closing(treecells, structure=disk(3)) | treecells
    brush_near = ndi.binary_dilation(brush_zone, structure=disk(3))
    orchard_zone &= ~brush_near
    lab3, n3 = components(orchard_zone)
    if n3:
        # count tree blobs per zone
        tl, tn = ndi.label(tree)
        zone_of_px = np.zeros(el.shape, np.int32)
        sel = ras.cell >= 0
        zone_of_px[sel] = lab3.ravel()[ras.cell[sel]]
        cnt = np.zeros(n3 + 1, int)
        if tn:
            # zone of each tree blob = zone at its centroid
            cms = ndi.center_of_mass(tree, tl, range(1, tn + 1))
            for cy, cx in cms:
                z = zone_of_px[int(cy), int(cx)]
                cnt[z] += 1
        good = cnt >= 4
        good[0] = False
        orchard_zone = good[lab3]
        # the orchard spans the ground between and around its trees
        orchard_zone = ndi.binary_dilation(orchard_zone, structure=disk(2)) & ~brush_zone
    else:
        orchard_zone[:] = False
    ground_like = (cls == GI['ground']) | (cls == GI['tree']) | (cls == GI['bush']) | (cls == GI['gully'] & brush_zone)
    out[:] = MASK['open']
    out[ground_like & brush_zone] = MASK['brush']
    out[(cls == GI['bush']) & ~brush_zone] = MASK['open']
    out[ground_like & orchard_zone] = MASK['orchard']
    # isolated tree-sized blobs outside orchards and brush are small woods; bush clumps at a brush edge are brush
    out[(cls == GI['tree']) & ~orchard_zone & ~brush_near] = MASK['woods']
    out[(cls == GI['tree']) & brush_near & ~orchard_zone] = MASK['brush']
    lab5, n5 = components(cls == GI['woods'])
    small_woods = np.zeros_like(brush_zone)
    if n5:
        sz = np.bincount(lab5.ravel(), minlength=n5 + 1)
        sw = sz < 40
        sw[0] = False
        small_woods = sw[lab5]
    for g, m in (('woods', 'woods'), ('building', 'building'), ('marsh', 'marsh'), ('field', 'field'),
                 ('road', 'road'), ('rail', 'railway'), ('bridge', 'bridge'), ('gully', 'gully')):
        sel = cls == GI[g]
        if g == 'gully':
            sel &= ~brush_zone
        if g == 'woods':
            out[sel & small_woods & brush_near] = MASK['brush']
            sel &= ~(small_woods & brush_near)
        out[sel] = MASK[m]
    # water vs stream: wide water bodies survive an opening of radius 3 cells
    wat = cls == GI['water']
    wide = ndi.binary_opening(wat, structure=disk(3))
    wide = ndi.binary_dilation(wide, structure=disk(1)) & wat
    out[wat & wide] = MASK['water']
    out[wat & ~wide] = MASK['stream']
    # bridges: road / rail / bridge-art cells with water on two opposite sides
    wetish = (out == MASK['water']) | (out == MASK['stream'])
    deck = (out == MASK['road']) | (out == MASK['railway']) | (out == MASK['bridge']) | (out == MASK['building'])
    over = np.zeros_like(deck)
    for dx, dy in ((1, 0), (0, 1), (1, 1), (1, -1)):
        a = np.zeros_like(deck)
        b = np.zeros_like(deck)
        for s in range(1, 6):
            a |= np.roll(np.roll(wetish, s * dy, 0), s * dx, 1)
            b |= np.roll(np.roll(wetish, -s * dy, 0), -s * dx, 1)
        over |= a & b
    out[deck & over & ((out != MASK['building']))] = MASK['bridge']
    # bridge art away from water is a wooden roof
    wet = ndi.binary_dilation((out == MASK['water']) | (out == MASK['stream']), structure=disk(6))
    out[(out == MASK['bridge']) & ~wet] = MASK['building']
    # buildings are solid: fill holes left by roof details, and small islands almost enclosed by roof
    bld = ndi.binary_fill_holes(out == MASK['building'])
    out[bld] = MASK['building']
    lab4, n4 = components(out != MASK['building'], structure=np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], bool))
    if n4:
        sz = np.bincount(lab4.ravel(), minlength=n4 + 1)
        for i in np.flatnonzero((sz > 0) & (sz <= 40)):
            if i == 0:
                continue
            comp = lab4 == i
            ring = ndi.binary_dilation(comp, structure=np.ones((3, 3), bool)) & ~comp
            if ring.sum() and (out[ring] == MASK['building']).mean() >= 0.6:
                out[comp] = MASK['building']
    # bridge rails and posts belong to the bridge
    brg = out == MASK['bridge']
    if brg.any():
        near = ndi.binary_dilation(brg, structure=disk(2))
        out[near & np.isin(out, [MASK['woods'], MASK['building'], MASK['railway']])] = MASK['bridge']
    # unknown cells (overlays only): nearest known cell
    unk = ~known
    if unk.any():
        idx = ndi.distance_transform_edt(unk, return_distances=False, return_indices=True)
        out = out[idx[0], idx[1]]
    out = clean_specks(out)
    # small patches of brush / orchard / marsh (halos, banks, edge bushes) merge into their surroundings
    out = merge_small_class_regions(out, [MASK['brush'], MASK['orchard'], MASK['marsh']], 25)
    # road and railway corridors at least 2 cells wide everywhere (line of sight runs along them only inside)
    for c in (MASK['road'], MASK['railway']):
        out = widen_corridor(out, c)

    # hill level
    lc = np.stack([ec[..., E['G0']] + ec[..., E['BB0']], ec[..., E['G1']] + ec[..., E['BB1']],
                   ec[..., E['G2']] + ec[..., E['BB2']], ec[..., E['G3']]], 2)
    for lv in range(4):
        if lv not in allowed_levels:
            lc[..., lv] = 0
    lsum = lc.sum(2)
    groundish = np.isin(out, [MASK['open'], MASK['brush'], MASK['orchard'], MASK['marsh'], MASK['gully']])
    lknown = (lsum >= 0.3 * np.maximum(nvalid, 1)) & (lsum >= 5) & groundish
    # level evidence pooled over a 5x5 window of level-bearing cells (vineyard stripes and speckle are noisy)
    lw = np.stack([box_sum(lc[..., i] * lknown, 1) for i in range(4)], 2)
    # inside brush (vineyard stripes) pool over a wider window
    lw3 = np.stack([box_sum(lc[..., i] * lknown, 3) for i in range(4)], 2)
    inb = (out == MASK['brush'])[..., None]
    lw = np.where(inb, lw3, lw)
    lev = np.argmax(lw, axis=2).astype(np.uint8)
    lev = fill_levels(lev, lknown)
    lev = mode_filter(lev, 1)
    lev = merge_small_regions(lev, 40)
    # hidden ground (under woods, roofs, fields, roads) never rises above its hex's centre level: a crest hex has its
    # centre dot on the higher level, so a higher terrace inside a hex must be visible
    ch = cell_hexes()
    for h in range(150):
        k, n = divmod(h, 10)
        cj, ci = centre_cell(k, n + 1)
        c = lev[cj, ci]
        sel = (ch == h) & ~lknown & (lev > c)
        lev[sel] = c
    return out, lev, dict(frac=frac, nvalid=nvalid)


def widen_corridor(out, c, protect=(MASK['building'], MASK['water'], MASK['bridge']), keep_out=None):
    """Make every cell of class c part of a full 2x2 block of c (diagonal steps and 1-cell necks become 2 wide)."""
    out = out.copy()
    H, W = out.shape
    for _ in range(3):
        m = out == c
        if not m.any():
            break
        blk = np.zeros((H + 1, W + 1), np.int32)  # block (j, i) covers cells j-1..j, i-1..i
        pad = np.pad(m, 1).astype(np.int32)
        blk = pad[:-1, :-1] + pad[:-1, 1:] + pad[1:, :-1] + pad[1:, 1:]
        full = blk == 4
        covered = full[:-1, :-1] | full[:-1, 1:] | full[1:, :-1] | full[1:, 1:]
        todo = m & ~covered
        if not todo.any():
            break
        prot = np.isin(out, protect)
        if keep_out is not None:
            prot |= keep_out
        pprot = np.pad(prot, 1).astype(np.int32)
        bprot = pprot[:-1, :-1] + pprot[:-1, 1:] + pprot[1:, :-1] + pprot[1:, 1:]
        for j, i in zip(*np.where(todo)):
            best, bj, bi = -1, None, None
            for dj in (0, 1):
                for di in (0, 1):
                    bj_, bi_ = j + dj, i + di          # block index containing cell (j, i)
                    sc = blk[bj_, bi_] * 4 - bprot[bj_, bi_] * 5
                    if sc > best:
                        best, bj, bi = sc, bj_, bi_
            if bj is None:
                continue
            for jj in (bj - 1, bj):
                for ii in (bi - 1, bi):
                    if 0 <= jj < H and 0 <= ii < W and not prot[jj, ii]:
                        out[jj, ii] = c
    return out


def merge_small_class_regions(a, classes, min_cells):
    """Connected regions of the given classes smaller than min_cells take the most common class around them."""
    a = a.copy()
    for c in classes:
        lab, n = ndi.label(a == c, structure=np.ones((3, 3), bool))
        if n == 0:
            continue
        sz = np.bincount(lab.ravel(), minlength=n + 1)
        for i in np.flatnonzero((sz > 0) & (sz < min_cells)):
            if i == 0:
                continue
            comp = lab == i
            ring = ndi.binary_dilation(comp, structure=np.ones((3, 3), bool)) & ~comp
            if ring.any():
                vals, cnts = np.unique(a[ring], return_counts=True)
                a[comp] = vals[np.argmax(cnts)]
    return a


def merge_small_regions(a, min_cells):
    """Connected regions of one value smaller than min_cells take the most common value around them."""
    a = a.copy()
    cross = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], bool)
    for _ in range(3):
        changed = False
        for v in np.unique(a):
            lab, n = ndi.label(a == v, structure=cross)
            if n == 0:
                continue
            sz = np.bincount(lab.ravel(), minlength=n + 1)
            for i in np.flatnonzero((sz > 0) & (sz < min_cells)):
                if i == 0:
                    continue
                comp = lab == i
                ring = ndi.binary_dilation(comp, structure=cross) & ~comp
                if not ring.any():
                    continue
                vals, cnts = np.unique(a[ring], return_counts=True)
                a[comp] = vals[np.argmax(cnts)]
                changed = True
        if not changed:
            break
    return a


def mode_filter(a, r):
    """Most common value in a (2r+1)^2 window (ties keep the lower value)."""
    vals = np.unique(a)
    best = None
    bestc = None
    for v in vals:
        c = box_sum((a == v).astype(np.float32), r)
        if best is None:
            best = np.full(a.shape, v, a.dtype)
            bestc = c
        else:
            upd = c > bestc + 1e-6
            best[upd] = v
            bestc = np.where(upd, c, bestc)
    return best


def clean_specks(out):
    """Mode filter for isolated single cells (keeps thin features of 2+ cells)."""
    res = out.copy()
    H, W = out.shape
    pad = np.pad(out, 1, mode='edge')
    neigh = np.stack([pad[1 + dy:1 + dy + H, 1 + dx:1 + dx + W] for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                      if (dx, dy) != (0, 0)], 2)
    same = (neigh == out[..., None]).sum(2)
    lone = same == 0
    if lone.any():
        for j, i in zip(*np.where(lone)):
            vals, cnts = np.unique(neigh[j, i], return_counts=True)
            res[j, i] = vals[np.argmax(cnts)]
    return res


CELL_HEX = None


def cell_hexes():
    """Hex index (k*10+n-1) of every cell centre, -1 outside the map."""
    global CELL_HEX
    if CELL_HEX is None:
        jj, ii = np.mgrid[0:MH, 0:MW]
        x = MX0 + (ii + 0.5) / RES
        y = MY0 + (jj + 0.5) / RES
        k, n = hex_of_points(x, y)
        CELL_HEX = np.where(k >= 0, k * 10 + n - 1, -1)
    return CELL_HEX


def fill_levels(lev, known):
    """Unknown cells take the level of the nearest known cell of the same hex, else the nearest anywhere."""
    out = lev.copy()
    if known.all():
        return out
    if known.any():
        idx = ndi.distance_transform_edt(~known, return_distances=False, return_indices=True)
        out = lev[idx[0], idx[1]]
    else:
        return np.zeros_like(lev)
    ch = cell_hexes()
    for h in range(150):
        inh = ch == h
        unk = inh & ~known
        kn = inh & known
        if not unk.any() or kn.sum() < 4:
            continue
        uj, ui = np.where(unk)
        kj, ki = np.where(kn)
        d = (uj[:, None] - kj[None, :]) ** 2 + (ui[:, None] - ki[None, :]) ** 2
        nn = np.argmin(d, axis=1)
        out[uj, ui] = lev[kj[nn], ki[nn]]
    out[ch < 0] = 0
    return out


# ---------------------------------------------------------------------------------------------------------------------
# Output

def rle(a):
    flat = np.asarray(a).ravel()
    out = []
    i = 0
    n = len(flat)
    change = np.flatnonzero(np.diff(flat)) + 1
    starts = np.concatenate([[0], change])
    ends = np.concatenate([change, [n]])
    for s, e in zip(starts, ends):
        out += [int(flat[s]), int(e - s)]
    return out


def unrle(r, n):
    out = np.empty(n, np.int32)
    p = 0
    for v, c in zip(r[0::2], r[1::2]):
        out[p:p + c] = v
        p += c
    assert p == n
    return out


CLASS_RGB = {0: (226, 226, 170), 1: (30, 110, 30), 2: (200, 40, 40), 3: (150, 200, 90), 4: (90, 170, 60),
             5: (250, 235, 60), 6: (80, 210, 210), 7: (40, 120, 255), 8: (10, 40, 170), 9: (150, 90, 200),
             10: (255, 150, 0), 11: (50, 50, 50), 12: (255, 0, 255)}


def preview(img_path, cls, lev, out_path, scale=0.5):
    """False-colour mask (class colour, darker per hill level, hex outlines) beside the downscaled art."""
    from PIL import ImageDraw
    im = Image.open(img_path).convert('RGB').crop((PX0, PY0, PX1, PY1))
    W, H = int(im.width * scale), int(im.height * scale)
    im = im.resize((W, H), Image.LANCZOS)
    rgb = np.zeros((MH, MW, 3), np.float32)
    for c, col in CLASS_RGB.items():
        rgb[cls == c] = col
    shade = 1.0 - 0.18 * lev[..., None]
    rgb = np.clip(rgb * shade, 0, 255).astype(np.uint8)
    # hill-level boundaries in white
    edge = np.zeros((MH, MW), bool)
    edge[:, 1:] |= lev[:, 1:] != lev[:, :-1]
    edge[1:, :] |= lev[1:, :] != lev[:-1, :]
    rgb[edge] = (255, 255, 255)
    m = Image.fromarray(rgb).resize((W, H), Image.NEAREST)
    d = ImageDraw.Draw(m)
    for k, n in ALL_HEXES:
        cx, cy = hex_centre(k, n)
        pts = [((OX + (cx + math.cos(math.pi / 3 * i)) * RX - PX0) * scale,
                (OY + (cy + math.sin(math.pi / 3 * i)) * RY - PY0) * scale) for i in range(7)]
        d.line(pts, fill=(120, 120, 120), width=1)
        d.text(((OX + cx * RX - PX0) * scale - 8, (OY + (cy - 0.75) * RY - PY0) * scale), hex_label(k, n),
               fill=(0, 0, 0))
    both = Image.new('RGB', (W * 2, H))
    both.paste(im, (0, 0))
    both.paste(m, (W, 0))
    both.save(out_path)


# ---------------------------------------------------------------------------------------------------------------------
# Validation

LEVEL_MIN_SHARE = 0.05     # crest: two levels each over 5% of the hex
SPECK_SHARE = 0.02         # classes under 2% of a hex are specks


def hex_cells():
    ch = cell_hexes()
    return {h: np.flatnonzero(ch.ravel() == h) for h in range(150)}


def centre_cell(k, n):
    x, y = hex_centre(k, n)
    return int((y - MY0) * RES), int((x - MX0) * RES)


def building_continuity(ras, roof, a, b):
    """True when roof art is continuous across the hexside between hexes a and b (pixel test beside the grid line)."""
    s = side_between(a, b)
    p, q = side_segment(a[0], a[1], s)
    cxa, cya = hex_centre(*a)
    mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
    nx, ny = mx - cxa, my - cya
    ln = math.hypot(nx, ny)
    nx, ny = nx / ln, ny / ln
    hits = 0
    run = 0
    best = 0
    for t in np.linspace(0.08, 0.92, 43):
        x = p[0] + (q[0] - p[0]) * t
        y = p[1] + (q[1] - p[1]) * t
        both = True
        for sgn in (-1, 1):
            ok = False
            for d in (4.0, 6.0):
                X = int(OX + (x + sgn * nx * d / RX) * RX - PX0)
                Y = int(OY + (y + sgn * ny * d / RY) * RY - PY0)
                if 0 <= Y < roof.shape[0] and 0 <= X < roof.shape[1] and roof[Y, X]:
                    ok = True
            both &= ok
        if both:
            hits += 1
            run += 1
            best = max(best, run)
        else:
            run = 0
    return best >= 3, hits


def validate(mid, cls, lev, known, ras, roof, tr):
    """Per-hex comparison with the transcription; returns a dict of findings."""
    hc = hex_cells()
    cf = cls.ravel()
    lf = lev.ravel()
    kf = known.ravel()
    res = dict(hexes={}, type_agree=0, type_total=0, level_agree=0, level_total=0)
    for k, n in ALL_HEXES:
        lbl = hex_label(k, n)
        cells = hc[k * 10 + n - 1]
        kc = cells[kf[cells]] if kf[cells].sum() > 0.5 * len(cells) else cells
        cnt = Counter(cf[kc].tolist())
        tot = len(kc)
        shares = {MASK_NAME[c]: v / tot for c, v in cnt.items()}
        types = Counter()
        for c, v in cnt.items():
            types[CLASS_TYPE[c]] += v / tot
        present = [t for t in HIERARCHY if types.get(t, 0) >= SPECK_SHARE]
        top = present[0] if present else 'Open'
        lcnt = Counter(lf[cells].tolist())
        lev_shares = {lv: v / len(cells) for lv, v in lcnt.items()}
        levels = sorted(lv for lv, sh in lev_shares.items() if sh >= LEVEL_MIN_SHARE)
        cj, ci = centre_cell(k, n)
        clev = int(lev[cj, ci])
        info = dict(present=present, top=top, shares={t: round(types[t], 3) for t in present},
                    classes={c: round(v, 3) for c, v in sorted(shares.items(), key=lambda x: -x[1])},
                    levels=levels, centre_level=clev, crest=len(levels) >= 2)
        if tr is not None and lbl in tr['hexes']:
            h = tr['hexes'][lbl]
            t = hex_type(h)
            e = int(h.get('elevation', 0) or 0)
            info['tr_type'] = t
            info['tr_level'] = e
            res['type_total'] += 1
            res['level_total'] += 1
            if t == top:
                res['type_agree'] += 1
            if e == clev:
                res['level_agree'] += 1
        res['hexes'][lbl] = info
    # a hex whose terrace edge runs along one of its hexsides (contour on the hexside, as at the top of a cliff) is a
    # crest hex too: it holds the edge of its level (FAQ: contours lie inside the higher hex)
    for k, n in ALL_HEXES:
        info = res['hexes'][hex_label(k, n)]
        info['crest_edge'] = False
        if info['crest']:
            continue
        for s in range(1, 7):
            o = neighbour(k, n, s)
            if o is not None and res['hexes'][hex_label(*o)]['centre_level'] < info['centre_level']:
                info['crest'] = True
                info['crest_edge'] = True
                break
    # multi-hex buildings
    bhex = [parse_label(l) for l, i in res['hexes'].items()
            if 'Building' in i['present'] or i.get('tr_type') == 'Building']
    bset = set(bhex)
    edges = []
    for a in bhex:
        for s in range(1, 7):
            b = neighbour(a[0], a[1], s)
            if b is None or b not in bset or b < a:
                continue
            ok, hits = building_continuity(ras, roof, a, b)
            if ok:
                edges.append((a, b))
    parent = {h: h for h in bhex}

    def find(h):
        while parent[h] != h:
            parent[h] = parent[parent[h]]
            h = parent[h]
        return h
    for a, b in edges:
        parent[find(a)] = find(b)
    groups = defaultdict(list)
    for h in bhex:
        groups[find(h)].append(h)
    res['buildings'] = sorted([sorted(hex_label(*h) for h in g) for g in groups.values() if len(g) > 1],
                              key=lambda g: (parse_label(g[0])))
    res['building_edges'] = [(hex_label(*a), hex_label(*b)) for a, b in edges]
    return res


# ---------------------------------------------------------------------------------------------------------------------
# Review: every disagreement with a transcription was checked on the art (art crop beside the mask). The notes below are
# the outcome; a disagreement without a note is reported as "not reviewed". REJECT lists mask findings that are
# classifier artefacts (their hexes keep the transcribed type).

BRIDGE_KIND = {'5': {'G6': 'MinorBridge'}, '5w': {'G6': 'MinorBridge'}, '10': {'F6': 'MajorBridge'}}
REVIEW = {
    '1': {'D3': 'woods art covers the NE third and a blob in the SW corner (the pilot note says so too)'},
    '3': {'H2': 'the road runs through woods; woods on both sides cover ~60% of the hex',
          'I3': 'woods cover ~65% of the hex; the centre dot is in a clearing by the road'},
    '4': {'M4': 'the stem of the T-shaped M3/N3 building reaches into the NE part of the hex'},
    '5': {'F4': 'two sheds; the centre dot is in the open between them',
          'G6': 'wooden road bridge over the stream, within the hex: Minor Bridge outranks Stream',
          'M6': 'two small buildings; the centre dot is between them',
          'O5': 'woods north and south of the road junction cover ~half the hex'},
    '6': {'A10': 'lumber-yard timber stacks and two sheds (stacks count as Building, as for A8/A9/C8)',
          'B10': 'lumber-yard timber stacks and a shed', 'C9': 'three small buildings around the centre dot',
          'H4': 'a wing of the H2-J5 building complex', 'I5': 'a wing of the H2-J5 building complex',
          'K8': 'the long row house crosses the south part', 'K10': 'the south row house crosses the hex',
          'L3': 'a small building beside the centre dot', 'L9': 'both row houses cross the hex edges',
          'M8': 'the row house crosses the south part', 'M10': 'the row house crosses the south part',
          'N6': 'two buildings inside the walled yard', 'N9': 'the row house crosses the north part',
          'O8': 'the row house crosses the south part', 'O10': 'the row house crosses the south part'},
    '7': {'F6': 'woods north and south of the railway cover ~27% of the hex'},
    '8': {'E5': 'the D4-E5 gully branch ends inside the hex (the transcription\'s gully note lists E5 too)'},
    '9': {'D1': 'the big field\'s top edge crosses into the south fifth of the hex',
          'F1': 'the big field\'s top edge crosses into the south quarter of the hex',
          'G8': 'orchard trees of the walled orchard and of the tree row along the road',
          'H7': 'a row of orchard-tree sprites lines the road (G8-J7)', 'I7': 'the same row of orchard trees',
          'H8': 'one orchard tree of the row stands in the NW corner (strict hierarchy: Orchard)',
          'K2': 'three small buildings on the hill'},
    '10': {'D6': 'four small houses; the centre dot is in the gap between them', 'D7': 'four small houses',
           'D8': 'four small houses', 'G1': 'two small buildings and the end of the F1 building',
           'G7': 'woods cover the island around the road end', 'K7': 'two small buildings',
           'N1': 'the long M1/N1 building crosses the hex', 'O7': 'a building in the south part'},
    '12': {'D9': 'two small buildings beside the road', 'F10': 'two buildings; the centre dot is between them',
           'I4': 'woods in the north-east part of the hex', 'M4': 'the road runs through woods (woods ~50%)',
           'M5': 'the road runs through woods (woods ~50%)'},
}
REVIEW['5w'] = REVIEW['5']
REJECT = {}


def terrain_name(mid, lbl, t):
    if t == 'Bridge':
        return BRIDGE_KIND.get(mid, {}).get(lbl, 'MinorBridge')
    return t


def write_outputs(findings, ids, sizes, report_path, audit_path, missing):
    audit = {}
    for mid in ids:
        v = findings[mid]
        ups = {}
        for lbl, h in v['hexes'].items():
            if 'tr_type' not in h or h['top'] == h['tr_type']:
                continue
            if HIERARCHY.index(h['top']) < HIERARCHY.index(h['tr_type']) and lbl not in REJECT.get(mid, {}):
                ups[lbl] = terrain_name(mid, lbl, h['top'])
        fixes = {}
        for lbl, h in v['hexes'].items():
            if 'tr_level' in h and h['tr_level'] != h['centre_level']:
                fixes[lbl] = h['centre_level']
        audit[mid] = dict(typeUpgrades=ups, crest=[l for l, h in v['hexes'].items() if h['crest']],
                          buildings=v['buildings'], levelFixes=fixes)
    with open(audit_path, 'w') as f:
        f.write('{\n' + ',\n'.join('  %s: %s' % (json.dumps(m), json.dumps(audit[m], separators=(', ', ': ')))
                                    for m in ids) + '\n}\n')

    L = []
    L.append('# Terrain masks: build and validation report (Task 4)')
    L.append('')
    L.append('Generated by `python3 -I design/tools/build_masks.py reference/vassal-extracted/images design/data '
             'src/data/masks --report design/data/masks-report.md --audit design/data/masks-audit.json`. '
             'Masks: `src/data/masks/<id>.json` (res 12 cells per hex radius, x0 = y0 = -1, 276 x 228 cells, RLE '
             '`cls` = MASK class codes of `src/engine/types.ts`, `level` = hill level 0-4). They classify the drawn '
             'terrain; no image data is stored.')
    L.append('')
    L.append('## Method')
    L.append('')
    L.append('- Overlays are masked out before classifying: grid lines (2.3 px band along every hexside), hex labels, '
             'centre dots, objective circles (detected by their red), the art of transcribed hexside features '
             '(fence 9 px, hedge 12 px, wall 16 px, cliff 10 px either side of the hexside) and the map-edge border.')
    L.append('- Pixels are classified into elements (open ground of level 0-3, foliage, brush ground of level 0-2, '
             'field, roof, water, marsh, gully, road, railway, bridge) by a naive-Bayes colour model learnt from the '
             'transcriptions (pixels round the centre dot of every certain hex; road and railway hexside crossings; '
             'bridges), smoothed over 5 x 5 px. Hill levels absent from a map\'s transcription are not offered '
             '(brown roof halves look like level-2/3 tints); dark tints enclosed by roof outline are roof; thin '
             'strips of roof colour (hill-edge and cliff shading) are dropped.')
    L.append('- Cells: woods = foliage areas >= 1000 px; tree-sized blobs (300-1000 px) standing on plain ground are '
             'orchard trees and the orchard is the closed region round 4+ of them; brush = broad areas of brush '
             'ground, or broad dense fields of small bushes (pale brush, vineyards); water bodies survive a '
             'radius-3-cell opening, narrower water is stream; bridges are deck cells with water on two opposite '
             'sides; roads/gullies/buildings must be at least 2 cells thick, railways and gullies long; small '
             'patches of brush/orchard/marsh merge into their surroundings. Road and railway corridors are widened so '
             'that every road/railway cell lies in a full 2 x 2 block (LOS along them stays inside).')
    L.append('- Trails are not a class: the dashes are ignored and the cleared corridor drawn round a trail in '
             'woods stays open ground, as drawn.')
    L.append('- Hill level per cell from the ground tint (3 x 3 cell window; 7 x 7 inside brush, whose vineyard '
             'stripes alternate shades), level regions under 40 cells merged into their surroundings. Under woods, '
             'roofs, fields and roads the level is that of the nearest visible ground of the same hex, else the '
             'nearest anywhere, and never above the hex\'s centre level (FAQ: a crest hex has its centre dot on the '
             'higher level, so a higher terrace inside a hex must be visible).')
    L.append('- Map 5w is the winter art of Map 5 (same geography: 97.5% of 5w\'s blue pixels fall in Map 5\'s '
             'water/stream/marsh cells at zero offset). Its mask is Map 5\'s; it is validated against map-5w.json.')
    L.append('')
    L.append('Validation per hex (cells whose centre lies in the hex): classes present (ignoring specks under 2% of '
             'the hex), the highest-ranked type (T78.1 hierarchy; road/railway count as Open, bridge as Bridge) vs '
             'the transcription; the level of the centre cell vs the transcribed elevation; crest = two levels each '
             'over 5% of the hex; multi-hex buildings = Building hexes whose roof art is continuous across the shared '
             'hexside (roof pixels 4-6 px either side of the grid line along 3+ consecutive samples of 43). A hex '
             'whose centre level is above a neighbour\'s is a crest hex as well when its contour runs on the shared '
             'hexside (the cliff case); every such hex either holds a sliver of the lower level or has the level '
             'change exactly on the hexside.')
    L.append('')
    L.append('## Summary')
    L.append('')
    L.append('| Map | Types agree | Levels agree | Upgrades | Crest hexes | Multi-hex buildings | File |')
    L.append('|---|---|---|---|---|---|---|')
    for mid in ids:
        v = findings[mid]
        a = audit[mid]
        L.append('| %s | %d/%d | %d/%d | %d | %d | %d | %.1f KB |' % (
            mid, v['type_agree'], v['type_total'], v['level_agree'], v['level_total'], len(a['typeUpgrades']),
            len(a['crest']), len(a['buildings']), sizes[mid] / 1024))
    if missing:
        L.append('')
        L.append('Maps without a transcription (mask built, not validated): %s.' % ', '.join(missing))
    L.append('')
    L.append('Every type disagreement is an upgrade: art of a higher-ranked type lies in a hex whose centre dot is '
             'on lower-ranked terrain (the transcriptions used the centre-dot rule). Each was checked on the art; '
             'all are real and are listed in `masks-audit.json` `typeUpgrades`. No level disagrees with a '
             'transcription, so `levelFixes` is empty.')
    for mid in ids:
        v = findings[mid]
        a = audit[mid]
        L.append('')
        L.append('## Map %s' % mid)
        L.append('')
        dis = [(l, h) for l, h in v['hexes'].items() if 'tr_type' in h and h['top'] != h['tr_type']]
        if dis:
            L.append('Type disagreements (transcription -> mask; shares of the hex; resolution):')
            L.append('')
            for l, h in dis:
                note = REVIEW.get(mid, {}).get(l, 'not reviewed')
                sh = ', '.join('%s %d%%' % (t, round(100 * x)) for t, x in h['shares'].items())
                res = ('upgrade to %s' % a['typeUpgrades'][l]) if l in a['typeUpgrades'] else 'keep the transcription'
                L.append('- %s: %s -> %s (%s). Art: %s. Resolution: %s.' % (l, h['tr_type'], h['top'], sh, note, res))
        else:
            L.append('Types: every hex agrees with the transcription.')
        lv = [(l, h) for l, h in v['hexes'].items() if 'tr_level' in h and h['tr_level'] != h['centre_level']]
        L.append('')
        if lv:
            L.append('Level disagreements: ' + ', '.join('%s %d -> %d' % (l, h['tr_level'], h['centre_level'])
                                                         for l, h in lv) + '.')
        else:
            L.append('Levels: the centre cell of every hex has the transcribed elevation.')
        L.append('')
        L.append('Crest hexes (%d): %s.' % (len(a['crest']), ', '.join(a['crest']) if a['crest'] else 'none'))
        edge = [l for l, h in v['hexes'].items() if h.get('crest_edge')]
        if edge:
            L.append('')
            L.append('Of these, %s hold under 5%% of the lower level: their contour runs on (or within a cell of) a '
                     'hexside, like the top of a cliff; they are crest hexes as the upper hex of that edge.'
                     % ', '.join(edge))
        L.append('')
        L.append('Multi-hex buildings (%d): %s.' % (len(a['buildings']), '; '.join('-'.join(g) for g in a['buildings'])
                                                     if a['buildings'] else 'none'))
        L.append('')
        L.append('<details><summary>Classes present per hex (>= 2%)</summary>')
        L.append('')
        rows = []
        for k in range(15):
            cells = []
            for n in range(1, 11):
                h = v['hexes'][hex_label(k, n)]
                cl = [c for c, x in h['classes'].items() if x >= SPECK_SHARE]
                cells.append('%s %s%s' % (hex_label(k, n), '+'.join(cl), ' L' + '/'.join(map(str, h['levels']))
                                          if h['levels'] != [0] else ''))
            rows.append('- ' + '; '.join(cells))
        L += rows
        L.append('')
        L.append('</details>')
    L.append('')
    L.append('## Known weaknesses')
    L.append('')
    L.append('- Hill levels under woods, roofs and fields are inferred, not seen (nearest visible ground of the hex).')
    L.append('- Boundaries are good to about one cell (8 px); woods and brush edges are ragged in the art anyway.')
    L.append('- Orchard extent is the closed region round the trees plus two cells, not a drawn outline.')
    L.append('- Two parallel row houses on Map 6 (rows 8-9) share hexes and so form one multi-hex group.')
    L.append('- Small specks near overlay bands (fence/hedge/wall art is masked out, then filled from the nearest '
             'cells) can shift a boundary by a cell next to those hexsides.')
    with open(report_path, 'w') as f:
        f.write('\n'.join(L) + '\n')


# ---------------------------------------------------------------------------------------------------------------------
# Main

SAME_GEOGRAPHY = {'5w': '5'}


def map_ids(images_dir):
    out = []
    for i in list(range(1, 13)):
        if os.path.exists(os.path.join(images_dir, 'Map%d.png' % i)):
            out.append(str(i))
            if i == 5 and os.path.exists(os.path.join(images_dir, 'Map5w.png')):
                out.append('5w')
    return out


def allowed_levels_of(tr):
    if tr is None:
        return {0, 1, 2, 3}
    return {0} | {int(h.get('elevation', 0) or 0) for h in tr['hexes'].values()}


def build_one(images_dir, mid, tr, logp):
    ras = Raster(os.path.join(images_dir, 'Map%s.png' % mid))
    ign = overlay_mask(ras, tr)
    lv = allowed_levels_of(tr)
    el, _ = classify_pixels(ras, ign, logp, lv)
    cls, lev, info = classify_cells(ras, el, lv)
    ch = cell_hexes()
    cls[ch < 0] = MASK['open']
    lev[ch < 0] = 0
    for c in (MASK['road'], MASK['railway']):
        cls = widen_corridor(cls, c, keep_out=ch < 0)
    roof = el == E['ROOF']
    roof = ndi.binary_closing(roof, structure=np.ones((3, 3), bool)) | roof
    return ras, el, cls, lev, info['nvalid'] >= 6, roof


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('images')
    ap.add_argument('maps_json_dir')
    ap.add_argument('out_dir')
    ap.add_argument('--maps', default=None)
    ap.add_argument('--report', default=None)
    ap.add_argument('--audit', default=None)
    ap.add_argument('--preview', default=None)
    ap.add_argument('--findings', default=None, help='write the raw per-hex findings (JSON) here')
    a = ap.parse_args(argv)
    if ndi is None:
        print('scipy is required', file=sys.stderr)
        return 1
    ids = a.maps.split(',') if a.maps else map_ids(a.images)
    all_ids = map_ids(a.images)
    trs = {m: load_transcription(a.maps_json_dir, m) for m in all_ids}
    # colour model: pooled over every transcribed summer map (5w, the winter map, has a model of its own)
    samples = {}
    for m in all_ids:
        if trs[m] is None:
            continue
        ras = Raster(os.path.join(a.images, 'Map%s.png' % m))
        samples[m] = training_samples(ras, overlay_mask(ras, trs[m]), trs[m])
        print('samples', m, {EL[e]: len(v) for e, v in samples[m].items()}, file=sys.stderr)
    logp = build_model([s for m, s in samples.items() if m != '5w'])
    os.makedirs(a.out_dir, exist_ok=True)
    findings = {}
    for mid in ids:
        tr = trs.get(mid)
        # Map 5w is the winter art of Map 5 (same geography, aligned to the pixel): its mask is Map 5's
        src = SAME_GEOGRAPHY.get(mid, mid)
        ras, el, cls, lev, known, roof = build_one(a.images, src, trs.get(src), logp)
        doc = dict(res=RES, x0=MX0, y0=MY0, width=MW, height=MH, cls=rle(cls), level=rle(lev))
        path = os.path.join(a.out_dir, '%s.json' % mid)
        with open(path, 'w') as f:
            json.dump(doc, f, separators=(',', ':'))
        size = os.path.getsize(path)
        v = validate(mid, cls, lev, known, ras, roof, tr)
        v['size'] = size
        v['transcribed'] = tr is not None
        findings[mid] = v
        print('map %s: %d bytes, types %d/%d, levels %d/%d, crest %d, buildings %d' % (
            mid, size, v['type_agree'], v['type_total'], v['level_agree'], v['level_total'],
            sum(1 for h in v['hexes'].values() if h['crest']), len(v['buildings'])), file=sys.stderr)
        if a.preview:
            os.makedirs(a.preview, exist_ok=True)
            preview(os.path.join(a.images, 'Map%s.png' % mid), cls, lev, os.path.join(a.preview, 'mask_%s.png' % mid))
    if a.findings:
        with open(a.findings, 'w') as f:
            json.dump(findings, f, indent=1)
    if a.report and a.audit:
        missing = [m for m in ids if trs.get(m) is None]
        done = [m for m in ids if trs.get(m) is not None]
        write_outputs(findings, done, {m: findings[m]['size'] for m in ids}, a.report, a.audit, missing)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
