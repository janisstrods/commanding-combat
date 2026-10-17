// The terrain as a raster of mask classes and levels over the combat zone: the map's own TerrainMask when it has one,
// else one synthesized from the per-hex terrain (whole-hex woods, fields...; a building footprint in each building hex).
// Linear terrain (roads, streams, gullies) is not rasterized here in the synthesized case: features.ts draws it from the
// hex graph. Pure functions (no DOM), so they run in the node tests.
import { ALL_HEXES, centre, hexAt, type HexId, type Point } from '../../../engine/hex';
import { MASK, type MapDef, type TerrainType } from '../../../engine/types';
import { BOUNDS } from '../geometry';

export interface TerrainField {
  /** Cells per hex-radius unit. */
  res: number;
  /** Map coordinates of the top-left corner of cell (0, 0). */
  x0: number;
  y0: number;
  width: number;
  height: number;
  /** MASK class per cell, row-major. */
  cls: Uint8Array;
  /** Elevation level per cell, row-major. */
  level: Uint8Array;
  /** True when this is the map's TerrainMask (sub-hex shapes), false when synthesized per hex. */
  fromMask: boolean;
}

export const SYNTH_RES = 8;

const AREA_OF: Partial<Record<TerrainType, number>> = {
  Open: MASK.open,
  Building: MASK.open,
  Woods: MASK.woods,
  Brush: MASK.brush,
  Orchard: MASK.orchard,
  Field: MASK.field,
  Marsh: MASK.marsh,
  Water: MASK.water,
  // linear terrain and bridges: open ground here, drawn as features
  Stream: MASK.open,
  Gully: MASK.open,
  MajorBridge: MASK.open,
  MinorBridge: MASK.open,
};

/** Classes that are corridors through other terrain (painted as linear features, not areas). */
export const LINEAR_CLASSES: ReadonlySet<number> = new Set([MASK.road, MASK.railway, MASK.stream, MASK.gully, MASK.bridge]);

/** The hex whose centre is nearest to (x, y) (also for points off the hex grid, e.g. in the zig-zag edge slivers). */
export function nearestHex(x: number, y: number): HexId {
  const h = hexAt(x, y);
  if (h !== null) return h;
  let best = 0;
  let bd = Infinity;
  for (const k of ALL_HEXES) {
    const c = centre(k);
    const d = (c.x - x) ** 2 + (c.y - y) ** 2;
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  return best;
}

/** Centre of cell (i, j) in map coordinates. */
export function cellCentre(f: TerrainField, i: number, j: number): Point {
  return { x: f.x0 + (i + 0.5) / f.res, y: f.y0 + (j + 0.5) / f.res };
}

/** Index of the cell containing map point (x, y), or -1 outside the field. */
export function cellIndexAt(f: TerrainField, x: number, y: number): number {
  const i = Math.floor((x - f.x0) * f.res);
  const j = Math.floor((y - f.y0) * f.res);
  if (i < 0 || j < 0 || i >= f.width || j >= f.height) return -1;
  return j * f.width + i;
}

/** The field the board paints: the map's mask, or one synthesized from its hexes. */
export function terrainField(map: MapDef): TerrainField {
  const m = map.mask;
  if (m && m.width > 0 && m.height > 0) {
    return {
      res: m.res,
      x0: m.x0,
      y0: m.y0,
      width: m.width,
      height: m.height,
      cls: m.cls instanceof Uint8Array ? m.cls : Uint8Array.from(m.cls),
      level: m.level instanceof Uint8Array ? m.level : Uint8Array.from(m.level),
      fromMask: true,
    };
  }
  return synthField(map);
}

function synthField(map: MapDef): TerrainField {
  const res = SYNTH_RES;
  const width = Math.ceil(BOUNDS.w * res);
  const height = Math.ceil(BOUNDS.h * res);
  const cls = new Uint8Array(width * height);
  const level = new Uint8Array(width * height);
  const f: TerrainField = { res, x0: BOUNDS.x, y0: BOUNDS.y, width, height, cls, level, fromMask: false };
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const p = cellCentre(f, i, j);
      const h = nearestHex(p.x, p.y);
      // buildings stand on open ground; features.ts places them clear of the roads
      cls[j * width + i] = AREA_OF[map.terrain[h]] ?? MASK.open;
      level[j * width + i] = map.elevation[h] ?? 0;
    }
  }
  return f;
}

/**
 * Area class per cell for painting the ground: buildings stand on open ground, and every corridor cell (road, stream...)
 * takes the most common area class around it (filled outward from the corridor's edges).
 */
export function areaClasses(f: TerrainField): Uint8Array {
  const { width: w, height: h } = f;
  const out = new Uint8Array(f.cls);
  const UNKNOWN = 255;
  let todo = 0;
  for (let i = 0; i < out.length; i++) {
    if (out[i] === MASK.building) out[i] = MASK.open;
    else if (LINEAR_CLASSES.has(out[i])) {
      out[i] = UNKNOWN;
      todo++;
    }
  }
  const counts = new Uint16Array(16);
  for (let pass = 0; pass < 64 && todo > 0; pass++) {
    const next = new Uint8Array(out);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const idx = j * w + i;
        if (out[idx] !== UNKNOWN) continue;
        counts.fill(0);
        let best = -1;
        let bc = 0;
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            const ii = i + di;
            const jj = j + dj;
            if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue;
            const v = out[jj * w + ii];
            if (v === UNKNOWN) continue;
            const n = ++counts[v];
            if (n > bc) {
              bc = n;
              best = v;
            }
          }
        }
        if (best >= 0) {
          next[idx] = best;
          todo--;
        }
      }
    }
    out.set(next);
  }
  if (todo > 0) for (let i = 0; i < out.length; i++) if (out[i] === UNKNOWN) out[i] = MASK.open;
  return out;
}

/** Box-blur a float grid `passes` times with radius `r` (edges clamped). */
export function blur(src: Float32Array, w: number, h: number, r: number, passes: number): Float32Array {
  let a = new Float32Array(src);
  let b = new Float32Array(src.length);
  for (let p = 0; p < passes; p++) {
    // horizontal
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        let s = 0;
        for (let d = -r; d <= r; d++) s += a[j * w + Math.min(w - 1, Math.max(0, i + d))];
        b[j * w + i] = s / (2 * r + 1);
      }
    }
    // vertical
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        let s = 0;
        for (let d = -r; d <= r; d++) s += b[Math.min(h - 1, Math.max(0, j + d)) * w + i];
        a[j * w + i] = s / (2 * r + 1);
      }
    }
  }
  return a;
}

/** The levels, smoothed: plateau edges become slopes that contour lines and hill shading follow. */
export function smoothLevels(f: TerrainField): Float32Array {
  const src = new Float32Array(f.level.length);
  for (let i = 0; i < src.length; i++) src[i] = f.level[i];
  // per-hex plateaus get rounder corners than the mask's own shapes
  const r = Math.max(1, Math.round(f.res / (f.fromMask ? 8 : 4)));
  return blur(src, f.width, f.height, r, 2);
}

/** Connected components of cells where `pred(index)` holds (8-connected when `eight`). Returns labels (-1 = none) and count. */
export function components(w: number, h: number, pred: (i: number) => boolean, eight = true): { labels: Int32Array; count: number } {
  const labels = new Int32Array(w * h).fill(-1);
  let count = 0;
  const stack: number[] = [];
  for (let s = 0; s < w * h; s++) {
    if (labels[s] >= 0 || !pred(s)) continue;
    labels[s] = count;
    stack.push(s);
    while (stack.length) {
      const c = stack.pop()!;
      const ci = c % w;
      const cj = (c - ci) / w;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          if (!eight && di && dj) continue;
          const ii = ci + di;
          const jj = cj + dj;
          if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue;
          const n = jj * w + ii;
          if (labels[n] >= 0 || !pred(n)) continue;
          labels[n] = count;
          stack.push(n);
        }
      }
    }
    count++;
  }
  return { labels, count };
}

/**
 * Marching squares over a grid sampled at cell centres: the segments where the field crosses `t`, in map coordinates.
 */
export function contourSegments(f: TerrainField, values: Float32Array, t: number): [number, number, number, number][] {
  const { width: w, height: h, res } = f;
  const out: [number, number, number, number][] = [];
  const X = (i: number) => f.x0 + (i + 0.5) / res;
  const Y = (j: number) => f.y0 + (j + 0.5) / res;
  const lerp = (a: number, b: number) => (t - a) / (b - a);
  for (let j = 0; j < h - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const a = values[j * w + i];
      const b = values[j * w + i + 1];
      const c = values[(j + 1) * w + i + 1];
      const d = values[(j + 1) * w + i];
      const code = (a > t ? 8 : 0) | (b > t ? 4 : 0) | (c > t ? 2 : 0) | (d > t ? 1 : 0);
      if (code === 0 || code === 15) continue;
      // edge points: top (a-b), right (b-c), bottom (d-c), left (a-d)
      const top = (): [number, number] => [X(i + lerp(a, b)), Y(j)];
      const right = (): [number, number] => [X(i + 1), Y(j + lerp(b, c))];
      const bottom = (): [number, number] => [X(i + lerp(d, c)), Y(j + 1)];
      const left = (): [number, number] => [X(i), Y(j + lerp(a, d))];
      const seg = (p: [number, number], q: [number, number]) => out.push([p[0], p[1], q[0], q[1]]);
      switch (code) {
        case 1: case 14: seg(left(), bottom()); break;
        case 2: case 13: seg(bottom(), right()); break;
        case 3: case 12: seg(left(), right()); break;
        case 4: case 11: seg(top(), right()); break;
        case 6: case 9: seg(top(), bottom()); break;
        case 7: case 8: seg(left(), top()); break;
        case 5: seg(left(), top()); seg(bottom(), right()); break;
        case 10: seg(top(), right()); seg(left(), bottom()); break;
      }
    }
  }
  return out;
}

/** The highest level anywhere in the field. */
export function maxLevel(f: TerrainField): number {
  let m = 0;
  for (let i = 0; i < f.level.length; i++) if (f.level[i] > m) m = f.level[i];
  return m;
}
