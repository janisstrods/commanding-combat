// Paints a map's terrain onto a canvas, once per map (the board shows it as an <image>). A per-pixel pass paints the
// ground from the terrain field (smooth class boundaries, hill plateaus with shading, crops, stipple, water depth), then
// vector passes add contour lines, gullies and streams, vegetation, roads and railways, bridges and buildings.
// Browser only (canvas); the geometry it uses lives in the pure modules field.ts and features.ts.
import { MASK, type MapDef } from '../../../engine/types';
import { BOUNDS } from '../geometry';
import { areaClasses, blur, cellCentre, components, contourSegments, maxLevel, smoothLevels, terrainField, type TerrainField } from './field';
import { allLinearPieces, bridgeBlocks, buildingBlocks, type Block, type LinearPiece } from './features';
import { clamp, fbm, hash3, rng, strHash, vnoise } from './noise';
import { SUMMER, css, paletteFor, shadeRGB, type Palette } from './palette';
import type { Point } from '../../../engine/hex';

export interface PaintResult {
  canvas: HTMLCanvasElement;
  /** Milliseconds spent painting. */
  ms: number;
  /** The ground class painted at map point (x, y) (a MASK code; 255 off the canvas), for checks against the data. */
  classAt: (x: number, y: number) => number;
}

const N_CLASSES = 16;

/** The palette of the map being painted (painting is synchronous, one map at a time). */
let P: Palette = SUMMER;

/** Paint `map` at `ppu` pixels per hex-radius unit. */
export function paintTerrain(map: MapDef, ppu: number): PaintResult {
  const t0 = performance.now();
  const f = terrainField(map);
  const W = Math.ceil(BOUNDS.w * ppu);
  const H = Math.ceil(BOUNDS.h * ppu);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const seed = strHash(`map-${map.id}`) % 100000;
  P = paletteFor(map.id);

  const pixCls = paintGround(ctx, f, W, H, ppu, seed);
  const pieces = allLinearPieces(map, f);

  ctx.setTransform(ppu, 0, 0, ppu, -BOUNDS.x * ppu, -BOUNDS.y * ppu);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const clsAt = (x: number, y: number) => {
    const px = Math.floor((x - BOUNDS.x) * ppu);
    const py = Math.floor((y - BOUNDS.y) * ppu);
    if (px < 0 || py < 0 || px >= W || py >= H) return 255;
    return pixCls[py * W + px];
  };
  const clear = clearance(f, pieces);
  const levelAt = (x: number, y: number) => {
    const i = Math.floor((x - f.x0) * f.res);
    const j = Math.floor((y - f.y0) * f.res);
    if (i < 0 || j < 0 || i >= f.width || j >= f.height) return 0;
    return f.level[j * f.width + i];
  };

  paintGullies(ctx, pieces.filter((p) => p.kind === 'gully'));
  paintStreams(ctx, pieces.filter((p) => p.kind === 'stream'));
  paintShrubs(ctx, clsAt, clear, seed);
  paintMarshReeds(ctx, clsAt, seed);
  paintOrchards(ctx, f, clsAt, clear, seed);
  paintWoods(ctx, clsAt, clear, levelAt, seed);
  // crest lines over the vegetation: a hill's edge stays readable under woods
  paintContours(ctx, f);
  paintPaths(ctx, pieces);
  paintBridges(ctx, bridgeBlocks(map, f, pieces));
  paintBuildings(ctx, buildingBlocks(map, f, pieces));

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return { canvas, ms: performance.now() - t0, classAt: clsAt };
}

// ---------------------------------------------------------------------------------------------------------------------
// Ground (per pixel)

function paintGround(ctx: CanvasRenderingContext2D, f: TerrainField, W: number, H: number, ppu: number, seed: number): Uint8Array {
  const fw = f.width;
  const fh = f.height;
  const res = f.res;
  const area = areaClasses(f);
  const lv = smoothLevels(f);
  const gx = new Float32Array(fw * fh);
  const gy = new Float32Array(fw * fh);
  for (let j = 0; j < fh; j++) {
    for (let i = 0; i < fw; i++) {
      const l = lv[j * fw + Math.max(0, i - 1)];
      const r = lv[j * fw + Math.min(fw - 1, i + 1)];
      const u = lv[Math.max(0, j - 1) * fw + i];
      const d = lv[Math.min(fh - 1, j + 1) * fw + i];
      gx[j * fw + i] = ((r - l) * res) / 2;
      gy[j * fw + i] = ((d - u) * res) / 2;
    }
  }
  const ind = (k: number) => {
    const a = new Float32Array(fw * fh);
    for (let i = 0; i < a.length; i++) a[i] = area[i] === k ? 1 : 0;
    return blur(a, fw, fh, Math.max(1, Math.round(res / 6)), 2);
  };
  const waterFrac = ind(MASK.water);
  const woodsFrac = ind(MASK.woods);
  // large-scale mottling, sampled at the cells
  const mottle = new Float32Array(fw * fh);
  const mottle2 = new Float32Array(fw * fh);
  for (let j = 0; j < fh; j++) {
    for (let i = 0; i < fw; i++) {
      const p = cellCentre(f, i, j);
      mottle[j * fw + i] = fbm(p.x * 0.9, p.y * 0.9, seed, 3) - 0.5;
      mottle2[j * fw + i] = fbm(p.x * 0.45 + 11, p.y * 0.45 - 7, seed + 5, 2) - 0.5;
    }
  }
  // per field / orchard: crop colour, furrow direction
  const fieldComp = components(fw, fh, (i) => area[i] === MASK.field, true);
  const fieldParams = Array.from({ length: fieldComp.count }, (_, k) => {
    const r = hash3(k, seed, 3);
    const a = hash3(k, seed, 9) * Math.PI;
    return { color: P.fields[Math.floor(r * P.fields.length)], cos: Math.cos(a), sin: Math.sin(a), spacing: 0.07 + hash3(k, seed, 4) * 0.03 };
  });
  const orchardComp = components(fw, fh, (i) => area[i] === MASK.orchard, true);
  const orchardAngle = Array.from({ length: orchardComp.count }, (_, k) => (hash3(k, seed, 21) - 0.5) * 0.8);
  orchardAngles = { labels: orchardComp.labels, angles: orchardAngle };

  const jitterAmp = f.fromMask ? 0.16 : 0.3;
  // per-hex maps: each class's share smoothed over about half a hex, so hex-shaped areas get rounded, natural outlines
  // (a mask keeps its own shapes: blurring would erase its one-cell-wide features)
  const present = [...new Set(area)];
  const soft: (Float32Array | undefined)[] = [];
  let pure: Uint8Array | null = null;
  if (!f.fromMask) {
    for (const k of present) {
      const a = new Float32Array(fw * fh);
      for (let i = 0; i < a.length; i++) a[i] = area[i] === k ? 1 : 0;
      soft[k] = blur(a, fw, fh, 2, 2);
    }
    pure = new Uint8Array(fw * fh);
    for (let i = 0; i < pure.length; i++) pure[i] = soft[area[i]]![i] > 0.999 ? 1 : 0;
  }
  const img = ctx.createImageData(W, H);
  const data = img.data;
  const pixCls = new Uint8Array(W * H);
  const weights = new Float32Array(N_CLASSES);
  const lightX = 0.5;
  const lightY = 0.5;

  for (let py = 0; py < H; py++) {
    const y = BOUNDS.y + (py + 0.5) / ppu;
    let v = (y - f.y0) * res - 0.5;
    let j0 = Math.floor(v);
    if (j0 < 0) {
      j0 = 0;
      v = 0;
    } else if (j0 > fh - 2) {
      j0 = fh - 2;
      v = Math.min(v, fh - 1);
    }
    const fv = clamp(v - j0, 0, 1);
    for (let px = 0; px < W; px++) {
      const x = BOUNDS.x + (px + 0.5) / ppu;
      let u = (x - f.x0) * res - 0.5;
      let i0 = Math.floor(u);
      if (i0 < 0) {
        i0 = 0;
        u = 0;
      } else if (i0 > fw - 2) {
        i0 = fw - 2;
        u = Math.min(u, fw - 1);
      }
      const fu = clamp(u - i0, 0, 1);
      const ia = j0 * fw + i0;
      const ib = ia + 1;
      const ic = ia + fw;
      const id = ic + 1;
      const wa = (1 - fu) * (1 - fv);
      const wb = fu * (1 - fv);
      const wc = (1 - fu) * fv;
      const wd = fu * fv;
      const ca = area[ia];
      const cb = area[ib];
      const cc = area[ic];
      const cd = area[id];
      let k = ca;
      let second = ca;
      let margin = 1;
      if (pure && !(pure[ia] && pure[ib] && pure[ic] && pure[id] && ca === cb && ca === cc && ca === cd)) {
        let bestS = -1e9;
        let nextS = -1e9;
        for (const c of present) {
          const sf = soft[c]!;
          const wgt = sf[ia] * wa + sf[ib] * wb + sf[ic] * wc + sf[id] * wd;
          if (wgt < 0.02) continue;
          const jit = (vnoise(x * 2.6, y * 2.6, seed + c * 13) - 0.5 + (vnoise(x * 7.1, y * 7.1, seed + c * 29) - 0.5) * 0.5) * jitterAmp;
          const sc = wgt + jit;
          if (sc > bestS) {
            nextS = bestS;
            second = k;
            bestS = sc;
            k = c;
          } else if (sc > nextS) {
            nextS = sc;
            second = c;
          }
        }
        margin = nextS < -1e8 ? 1 : bestS - nextS;
      } else if (!pure && !(ca === cb && ca === cc && ca === cd)) {
        weights.fill(0);
        weights[ca] += wa;
        weights[cb] += wb;
        weights[cc] += wc;
        weights[cd] += wd;
        let bestS = -1e9;
        let nextS = -1e9;
        for (let q = 0; q < 4; q++) {
          const c = q === 0 ? ca : q === 1 ? cb : q === 2 ? cc : cd;
          const wgt = weights[c];
          if (wgt < 0) continue; // already scored
          weights[c] = -1;
          const jit = (vnoise(x * 3.1, y * 3.1, seed + c * 13) - 0.5 + (vnoise(x * 8.3, y * 8.3, seed + c * 29) - 0.5) * 0.5) * jitterAmp;
          const sc = wgt + jit;
          if (sc > bestS) {
            nextS = bestS;
            second = k;
            bestS = sc;
            k = c;
          } else if (sc > nextS) {
            nextS = sc;
            second = c;
          }
        }
        margin = bestS - nextS;
      }
      const p = py * W + px;
      pixCls[p] = k;

      const L = lv[ia] * wa + lv[ib] * wb + lv[ic] * wc + lv[id] * wd;
      const sx = gx[ia] * wa + gx[ib] * wb + gx[ic] * wc + gx[id] * wd;
      const sy = gy[ia] * wa + gy[ib] * wb + gy[ic] * wc + gy[id] * wd;
      const m1 = mottle[ia] * wa + mottle[ib] * wb + mottle[ic] * wc + mottle[id] * wd;
      const m2 = mottle2[ia] * wa + mottle2[ib] * wb + mottle2[ic] * wc + mottle2[id] * wd;
      const fine = vnoise(x * 7, y * 7, seed + 3) - 0.5;
      const grain = hash3(px, py, seed) - 0.5;

      let r: number;
      let g: number;
      let b: number;
      switch (k) {
        case MASK.field: {
          const comp = fieldComp.labels[nearestOf(fieldComp.labels, ia, ib, ic, id, wa, wb, wc, wd)];
          const fp = fieldParams[comp] ?? fieldParams[0];
          const c = fp ? fp.color : P.fields[0];
          const s = fp ? Math.sin(((x * fp.cos + y * fp.sin) * Math.PI * 2) / fp.spacing) : 0;
          // furrows, and a darker headland along the field's edge
          const edge = margin < 0.14 ? 0.86 + margin : 1;
          const furrow = (1 - P.furrow * (0.5 + 0.5 * s)) * edge;
          r = c[0] * furrow + m1 * 18;
          g = c[1] * furrow + m1 * 16;
          b = c[2] * furrow + m1 * 8;
          break;
        }
        case MASK.brush: {
          const c = P.ground.brush;
          const dot = hash3(px >> 1, py >> 1, seed + 7) > 0.83 ? 1 : 0;
          const patch = vnoise(x * 5, y * 5, seed + 11) > 0.62 ? 1 : 0;
          const d = dot ? 0.72 : patch ? 0.88 : 1;
          r = c[0] * d + m1 * 16;
          g = c[1] * d + m1 * 18;
          b = c[2] * d + m1 * 8;
          break;
        }
        case MASK.woods: {
          const c = P.ground.woods;
          const deep = woodsFrac[ia] * wa + woodsFrac[ib] * wb + woodsFrac[ic] * wc + woodsFrac[id] * wd;
          const d = 1 - 0.18 * clamp((deep - 0.5) * 2, 0, 1);
          r = c[0] * d + m1 * 14;
          g = c[1] * d + m1 * 16;
          b = c[2] * d + m1 * 6;
          break;
        }
        case MASK.orchard: {
          const c = P.ground.orchard;
          r = c[0] + m1 * 16;
          g = c[1] + m1 * 18;
          b = c[2] + m1 * 8;
          break;
        }
        case MASK.marsh: {
          const c = P.ground.marsh;
          const pool = clamp((vnoise(x * 4.6, y * 4.6, seed + 17) + (vnoise(x * 11, y * 11, seed + 19) - 0.5) * 0.4 - 0.55) * 6, 0, 1);
          const q = P.ground.marshPool;
          r = c[0] + (q[0] - c[0]) * pool + m1 * 10;
          g = c[1] + (q[1] - c[1]) * pool + m1 * 12;
          b = c[2] + (q[2] - c[2]) * pool + m1 * 8;
          break;
        }
        case MASK.water: {
          const depth = clamp(((waterFrac[ia] * wa + waterFrac[ib] * wb + waterFrac[ic] * wc + waterFrac[id] * wd) - 0.5) * 2.2, 0, 1);
          const a = P.ground.waterShallow;
          const d = P.ground.waterDeep;
          const ripple = Math.sin(y * 34 + vnoise(x * 3, y * 3, seed + 23) * 9) > 0.93 ? 10 : 0;
          r = a[0] + (d[0] - a[0]) * depth + ripple;
          g = a[1] + (d[1] - a[1]) * depth + ripple;
          b = a[2] + (d[2] - a[2]) * depth + ripple;
          if (margin < 0.22) {
            const e = (1 - margin / 0.22) * 0.55;
            const s = P.ground.bank;
            r += (s[0] * 0.8 - r) * e;
            g += (s[1] * 0.8 - g) * e;
            b += (s[2] * 0.8 - b) * e;
          }
          break;
        }
        default: {
          const c = P.ground.open;
          const h2 = P.ground.openHue;
          const t = clamp(0.5 + m2 * 1.6, 0, 1);
          const mo = P.mottle;
          r = c[0] + (h2[0] - c[0]) * t + (m1 * 22 + fine * 8) * mo;
          g = c[1] + (h2[1] - c[1]) * t + (m1 * 22 + fine * 9) * mo;
          b = c[2] + (h2[2] - c[2]) * t + (m1 * 12 + fine * 4) * mo;
        }
      }
      // the mask's road and railway corridors as beaten ground (the drawn roads lie on top; a corridor the hex data has
      // no road for still shows)
      if (f.fromMask) {
        const isRoad = (c: number) => c === MASK.road || c === MASK.bridge;
        const rw = (isRoad(f.cls[ia]) ? wa : 0) + (isRoad(f.cls[ib]) ? wb : 0) + (isRoad(f.cls[ic]) ? wc : 0) + (isRoad(f.cls[id]) ? wd : 0);
        const tw = (f.cls[ia] === MASK.railway ? wa : 0) + (f.cls[ib] === MASK.railway ? wb : 0) + (f.cls[ic] === MASK.railway ? wc : 0) + (f.cls[id] === MASK.railway ? wd : 0);
        const cw = Math.max(rw, tw);
        if (cw > 0.35) {
          const e = clamp((cw - 0.35) * 5, 0, 1) * 0.8;
          const rc = rw >= tw ? P.ground.track : P.ground.ballast;
          r += (rc[0] + fine * 10 - r) * e;
          g += (rc[1] + fine * 10 - g) * e;
          b += (rc[2] + fine * 8 - b) * e;
        }
      }
      // built-up ground on the mask's building cells (the roofs cover most of it)
      if (f.fromMask) {
        const bw = (f.cls[ia] === MASK.building ? wa : 0) + (f.cls[ib] === MASK.building ? wb : 0) + (f.cls[ic] === MASK.building ? wc : 0) + (f.cls[id] === MASK.building ? wd : 0);
        if (bw > 0.3) {
          const e = clamp((bw - 0.3) * 4, 0, 1) * 0.85;
          const yd = P.ground.yard;
          r += (yd[0] + fine * 10 - r) * e;
          g += (yd[1] + fine * 10 - g) * e;
          b += (yd[2] + fine * 8 - b) * e;
        }
      }
      // muddy bank on the land side of water
      if (k !== MASK.water && second === MASK.water && margin < 0.16) {
        const e = (1 - margin / 0.16) * 0.6;
        const s = P.ground.bank;
        r += (s[0] - r) * e;
        g += (s[1] - g) * e;
        b += (s[2] - b) * e;
      }
      // hills: tinted plateaus, lit from the north-west
      const lvl = Math.max(0, Math.min(P.hills.length - 1, Math.floor(L + 0.5)));
      if (lvl > 0) {
        const { color: hc, amount } = P.hills[lvl];
        const tAmt = amount * (k === MASK.water ? 0.2 : k === MASK.woods ? 0.6 : k === MASK.field ? 0.5 : k === MASK.brush || k === MASK.orchard ? 0.65 : 1);
        r += (hc[0] - r) * tAmt;
        g += (hc[1] - g) * tAmt;
        b += (hc[2] - b) * tAmt;
      }
      // directional light plus a darkening of every slope, so plateau edges read from any side
      const shade = clamp((sx * lightX + sy * lightY) * 0.17 - Math.hypot(sx, sy) * 0.035, -0.36, 0.24);
      const sh = 1 + shade;
      r = r * sh + grain * 7;
      g = g * sh + grain * 7;
      b = b * sh + grain * 6;
      const o = p * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return pixCls;
}

/** The cell among the four with a label (>= 0) and the largest weight. */
function nearestOf(labels: Int32Array, a: number, b: number, c: number, d: number, wa: number, wb: number, wc: number, wd: number): number {
  let best = a;
  let bw = labels[a] >= 0 ? wa : -1;
  if (labels[b] >= 0 && wb > bw) {
    best = b;
    bw = wb;
  }
  if (labels[c] >= 0 && wc > bw) {
    best = c;
    bw = wc;
  }
  if (labels[d] >= 0 && wd > bw) best = d;
  return best;
}

let orchardAngles: { labels: Int32Array; angles: number[] } = { labels: new Int32Array(0), angles: [] };

// ---------------------------------------------------------------------------------------------------------------------
// Where vegetation must not grow: along roads, railways, trails and streams (the corridors stay clear).

interface Clearance {
  res: number;
  w: number;
  h: number;
  grid: Uint8Array;
}

function clearance(f: TerrainField, pieces: LinearPiece[]): Clearance {
  const res = 24;
  const w = Math.ceil(BOUNDS.w * res);
  const h = Math.ceil(BOUNDS.h * res);
  const grid = new Uint8Array(w * h);
  const stamp = (p: Point, rad: number) => {
    const ci = (p.x - BOUNDS.x) * res;
    const cj = (p.y - BOUNDS.y) * res;
    const rr = rad * res;
    for (let j = Math.floor(cj - rr); j <= Math.ceil(cj + rr); j++) {
      for (let i = Math.floor(ci - rr); i <= Math.ceil(ci + rr); i++) {
        if (i < 0 || j < 0 || i >= w || j >= h) continue;
        if ((i - ci) ** 2 + (j - cj) ** 2 <= rr * rr) grid[j * w + i] = 1;
      }
    }
  };
  const RAD: Record<string, number> = { road: 0.17, trail: 0.1, railway: 0.18, stream: 0.13, gully: 0.12 };
  for (const piece of pieces) {
    for (const p of resample(piece.points, 0.03)) stamp(p, RAD[piece.kind]);
  }
  if (f.fromMask) {
    for (let j = 0; j < f.height; j++) {
      for (let i = 0; i < f.width; i++) {
        const k = f.cls[j * f.width + i];
        if (k === MASK.road || k === MASK.railway || k === MASK.bridge) stamp(cellCentre(f, i, j), 0.5 / f.res);
      }
    }
  }
  return { res, w, h, grid };
}

const isClear = (c: Clearance, x: number, y: number) => {
  const i = Math.floor((x - BOUNDS.x) * c.res);
  const j = Math.floor((y - BOUNDS.y) * c.res);
  return i >= 0 && j >= 0 && i < c.w && j < c.h && c.grid[j * c.w + i] === 1;
};

/** Points every `step` units along a polyline. */
export function resample(ps: Point[], step: number): Point[] {
  if (ps.length < 2) return ps.slice();
  const out: Point[] = [ps[0]];
  let carry = 0;
  for (let k = 1; k < ps.length; k++) {
    const a = ps[k - 1];
    const b = ps[k];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    let t = step - carry;
    while (t <= L) {
      out.push({ x: a.x + ((b.x - a.x) * t) / L, y: a.y + ((b.y - a.y) * t) / L });
      t += step;
    }
    carry = L - (t - step);
  }
  return out;
}

/** Unit normals of a polyline at its points. */
function normals(ps: Point[]): Point[] {
  return ps.map((p, k) => {
    const a = ps[Math.max(0, k - 1)];
    const b = ps[Math.min(ps.length - 1, k + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: -dy / l, y: dx / l };
  });
}

function strokePieces(ctx: CanvasRenderingContext2D, pieces: LinearPiece[], style: string, width: number, offset?: Point, dash?: number[]) {
  if (!pieces.length) return;
  ctx.save();
  if (offset) ctx.translate(offset.x, offset.y);
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  for (const piece of pieces) {
    piece.points.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  }
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------------
// Contours, gullies, streams

/** Crest lines at every level step; `alpha` < 1 redraws them faintly over the woods canopy. */
function paintContours(ctx: CanvasRenderingContext2D, f: TerrainField, alpha = 1) {
  const top = maxLevel(f);
  if (top === 0) return;
  const lv = smoothLevels(f);
  for (let L = 1; L <= top; L++) {
    const segs = contourSegments(f, lv, L - 0.5);
    const path = () => {
      ctx.beginPath();
      for (const [x1, y1, x2, y2] of segs) {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
    };
    ctx.save();
    ctx.globalAlpha = alpha;
    if (alpha >= 1) {
      ctx.save();
      ctx.translate(0.014, 0.02);
      ctx.strokeStyle = P.line.contourShadow;
      ctx.lineWidth = 0.055;
      path();
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = P.line.contour;
    ctx.lineWidth = alpha >= 1 ? 0.024 : 0.03;
    path();
    ctx.stroke();
    ctx.restore();
  }
}

function paintGullies(ctx: CanvasRenderingContext2D, pieces: LinearPiece[]) {
  if (!pieces.length) return;
  // a ravine: a soft shadow, earthen banks lit from the north-west, a dark grassy bed, scrub along the rims
  strokePieces(ctx, pieces, 'rgba(70, 58, 30, 0.28)', 0.5);
  strokePieces(ctx, pieces, P.line.gullyBand, 0.36);
  strokePieces(ctx, pieces, 'rgba(196, 176, 126, 0.55)', 0.1, { x: -0.07, y: -0.08 });
  strokePieces(ctx, pieces, 'rgba(72, 60, 36, 0.75)', 0.1, { x: 0.05, y: 0.06 });
  strokePieces(ctx, pieces, P.line.gullyBed, 0.13);
  strokePieces(ctx, pieces, P.line.gullyGrass, 0.06);
  const R = rng(4242);
  const dark = new Path2D();
  const light = new Path2D();
  for (const piece of pieces) {
    const ps = resample(piece.points, 0.07);
    const ns = normals(ps);
    ps.forEach((p, k) => {
      for (const side of [-1, 1]) {
        if (R() < 0.35) continue;
        const d = (0.18 + R() * 0.06) * side;
        const x = p.x + ns[k].x * d;
        const y = p.y + ns[k].y * d;
        const r = 0.022 + R() * 0.02;
        dark.moveTo(x + r, y);
        dark.arc(x, y, r, 0, Math.PI * 2);
        light.moveTo(x - r * 0.3 + r * 0.45, y - r * 0.3);
        light.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, Math.PI * 2);
      }
    });
  }
  ctx.fillStyle = css(P.shrub.dark);
  ctx.fill(dark);
  ctx.fillStyle = css(P.shrub.light, 0.8);
  ctx.fill(light);
}

function paintStreams(ctx: CanvasRenderingContext2D, pieces: LinearPiece[]) {
  if (!pieces.length) return;
  strokePieces(ctx, pieces, P.line.streamBank, 0.21);
  strokePieces(ctx, pieces, P.line.stream, 0.13);
  strokePieces(ctx, pieces, P.line.streamLight, 0.028, { x: -0.018, y: -0.02 });
}

// ---------------------------------------------------------------------------------------------------------------------
// Vegetation

type ClsAt = (x: number, y: number) => number;

/** Jittered grid points over the combat zone, `step` apart. */
function* jittered(step: number, seed: number): Generator<{ x: number; y: number; r: () => number }> {
  const R = rng(seed);
  for (let y = BOUNDS.y + step / 2; y < BOUNDS.y + BOUNDS.h; y += step) {
    for (let x = BOUNDS.x + step / 2; x < BOUNDS.x + BOUNDS.w; x += step) {
      yield { x: x + (R() - 0.5) * step * 0.9, y: y + (R() - 0.5) * step * 0.9, r: R };
    }
  }
}

function paintShrubs(ctx: CanvasRenderingContext2D, clsAt: ClsAt, clear: Clearance, seed: number) {
  const shrubs: { x: number; y: number; r: number }[] = [];
  for (const p of jittered(0.1, seed + 101)) {
    if (clsAt(p.x, p.y) !== MASK.brush || isClear(clear, p.x, p.y)) continue;
    if (p.r() < 0.42) continue;
    shrubs.push({ x: p.x, y: p.y, r: 0.024 + p.r() * 0.03 });
  }
  if (!shrubs.length) return;
  ctx.fillStyle = P.shrub.shadow;
  ctx.beginPath();
  for (const s of shrubs) {
    ctx.moveTo(s.x + 0.018 + s.r, s.y + 0.022);
    ctx.arc(s.x + 0.018, s.y + 0.022, s.r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.fillStyle = css(P.shrub.dark);
  ctx.beginPath();
  for (const s of shrubs) {
    ctx.moveTo(s.x + s.r, s.y);
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.fillStyle = css(P.shrub.light, 0.8);
  ctx.beginPath();
  for (const s of shrubs) {
    const r = s.r * 0.45;
    ctx.moveTo(s.x - s.r * 0.3 + r, s.y - s.r * 0.32);
    ctx.arc(s.x - s.r * 0.3, s.y - s.r * 0.32, r, 0, Math.PI * 2);
  }
  ctx.fill();
}

function paintMarshReeds(ctx: CanvasRenderingContext2D, clsAt: ClsAt, seed: number) {
  const tufts: Point[] = [];
  for (const p of jittered(0.12, seed + 202)) if (clsAt(p.x, p.y) === MASK.marsh && p.r() > 0.25) tufts.push(p);
  if (!tufts.length) return;
  const R = rng(seed + 203);
  const dark = new Path2D();
  const light = new Path2D();
  for (const t of tufts) {
    const blades = 4 + Math.floor(R() * 3);
    for (let m = 0; m < blades; m++) {
      const off = (m - (blades - 1) / 2) * 0.012;
      const lean = off * 1.4 + (R() - 0.5) * 0.02;
      const hgt = 0.05 + R() * 0.045;
      const path = m % 2 ? light : dark;
      path.moveTo(t.x + off, t.y);
      path.quadraticCurveTo(t.x + off + lean * 0.3, t.y - hgt * 0.5, t.x + off + lean, t.y - hgt);
    }
  }
  ctx.lineWidth = 0.009;
  ctx.strokeStyle = 'rgba(58, 74, 38, 0.95)';
  ctx.stroke(dark);
  ctx.strokeStyle = 'rgba(160, 166, 104, 0.95)';
  ctx.stroke(light);
}

function paintOrchards(ctx: CanvasRenderingContext2D, f: TerrainField, clsAt: ClsAt, clear: Clearance, seed: number) {
  const { labels, angles } = orchardAngles;
  if (!angles.length) return;
  // one grid per orchard, rotated by its angle, anchored at the orchard's first cell
  const anchor = new Map<number, Point>();
  for (let i = 0; i < labels.length; i++) {
    const l = labels[i];
    if (l >= 0 && !anchor.has(l)) anchor.set(l, cellCentre(f, i % f.width, Math.floor(i / f.width)));
  }
  const trees: { x: number; y: number; r: number }[] = [];
  const step = 0.21;
  for (const [l, a0] of anchor) {
    const a = angles[l];
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    // the orchard's extent in the rotated frame
    let u0 = Infinity;
    let u1 = -Infinity;
    let v0 = Infinity;
    let v1 = -Infinity;
    for (let i = 0; i < labels.length; i++) {
      if (labels[i] !== l) continue;
      const p = cellCentre(f, i % f.width, Math.floor(i / f.width));
      const dx = p.x - a0.x;
      const dy = p.y - a0.y;
      const u = dx * ca + dy * sa;
      const v = -dx * sa + dy * ca;
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
      v0 = Math.min(v0, v);
      v1 = Math.max(v1, v);
    }
    const R = rng(seed + l * 7 + 303);
    for (let v = Math.floor(v0 / step) * step; v <= v1 + step; v += step) {
      for (let u = Math.floor(u0 / step) * step; u <= u1 + step; u += step) {
        const x = a0.x + u * ca - v * sa + (R() - 0.5) * 0.02;
        const y = a0.y + u * sa + v * ca + (R() - 0.5) * 0.02;
        if (clsAt(x, y) !== MASK.orchard || isClear(clear, x, y)) continue;
        if (R() < 0.06) continue; // a missing tree here and there
        trees.push({ x, y, r: 0.056 + R() * 0.014 });
      }
    }
  }
  if (!trees.length) return;
  ctx.fillStyle = P.orchardTree.shadow;
  ctx.beginPath();
  for (const t of trees) {
    ctx.moveTo(t.x + 0.03 + t.r, t.y + 0.036);
    ctx.ellipse(t.x + 0.03, t.y + 0.036, t.r, t.r * 0.8, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.fillStyle = css(P.orchardTree.dark);
  ctx.beginPath();
  for (const t of trees) {
    ctx.moveTo(t.x + t.r, t.y);
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.fillStyle = css(P.orchardTree.light, 0.85);
  ctx.beginPath();
  for (const t of trees) {
    const r = t.r * 0.48;
    ctx.moveTo(t.x - t.r * 0.28 + r, t.y - t.r * 0.3);
    ctx.arc(t.x - t.r * 0.28, t.y - t.r * 0.3, r, 0, Math.PI * 2);
  }
  ctx.fill();
}

function paintWoods(ctx: CanvasRenderingContext2D, clsAt: ClsAt, clear: Clearance, levelAt: (x: number, y: number) => number, seed: number) {
  const crowns: { x: number; y: number; r: number; tone: number; lvl: number; s: number }[] = [];
  for (const p of jittered(0.125, seed + 404)) {
    if (clsAt(p.x, p.y) !== MASK.woods || isClear(clear, p.x, p.y)) continue;
    crowns.push({ x: p.x, y: p.y, r: 0.072 + p.r() * 0.05, tone: p.r(), lvl: levelAt(p.x, p.y), s: Math.floor(p.r() * 1e6) });
  }
  if (!crowns.length) return;
  crowns.sort((a, b) => a.y - b.y);
  ctx.fillStyle = P.tree.shadow;
  ctx.beginPath();
  for (const c of crowns) {
    ctx.moveTo(c.x + 0.035 + c.r, c.y + 0.045);
    ctx.ellipse(c.x + 0.035, c.y + 0.045, c.r * 1.05, c.r * 0.92, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  for (const c of crowns) {
    const lift = 1 + c.lvl * 0.06 + (c.tone - 0.5) * 0.16;
    const R = rng(c.s);
    ctx.fillStyle = css(shadeRGB(P.tree.dark, lift));
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + R() * 2;
      const d = c.r * 0.32;
      const rr = c.r * (0.62 + R() * 0.12);
      const x = c.x + Math.cos(a) * d;
      const y = c.y + Math.sin(a) * d;
      ctx.moveTo(x + rr, y);
      ctx.arc(x, y, rr, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = css(shadeRGB(P.tree.mid, lift));
    ctx.beginPath();
    ctx.arc(c.x - c.r * 0.16, c.y - c.r * 0.2, c.r * 0.58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(shadeRGB(P.tree.light, lift), 0.75);
    ctx.beginPath();
    ctx.arc(c.x - c.r * 0.34, c.y - c.r * 0.38, c.r * 0.26, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Roads, trails, railways

function offsetLine(ps: Point[], ns: Point[], d: number): Point[] {
  return ps.map((p, k) => ({ x: p.x + ns[k].x * d, y: p.y + ns[k].y * d }));
}

function paintPaths(ctx: CanvasRenderingContext2D, pieces: LinearPiece[]) {
  const roads = pieces.filter((p) => p.kind === 'road');
  const trails = pieces.filter((p) => p.kind === 'trail');
  const rails = pieces.filter((p) => p.kind === 'railway');
  // verges first: the corridor shows through woods and orchards
  strokePieces(ctx, rails, P.line.verge, 0.3);
  strokePieces(ctx, roads, P.line.verge, 0.26);
  strokePieces(ctx, trails, P.line.verge, 0.12);
  if (rails.length) {
    strokePieces(ctx, rails, P.line.ballast, 0.17);
    ctx.strokeStyle = P.line.tie;
    ctx.lineWidth = 0.022;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    for (const piece of rails) {
      const ps = resample(piece.points, 0.065);
      const ns = normals(ps);
      ps.forEach((p, k) => {
        ctx.moveTo(p.x + ns[k].x * 0.075, p.y + ns[k].y * 0.075);
        ctx.lineTo(p.x - ns[k].x * 0.075, p.y - ns[k].y * 0.075);
      });
    }
    ctx.stroke();
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      const lines = rails.map((piece) => {
        const ps = resample(piece.points, 0.03);
        return { ...piece, points: offsetLine(ps, normals(ps), side * 0.036) };
      });
      strokePieces(ctx, lines, P.line.rail, 0.014);
    }
  }
  strokePieces(ctx, roads, P.line.roadEdge, 0.165);
  strokePieces(ctx, roads, P.line.road, 0.125);
  for (const side of [-1, 1]) {
    const ruts = roads.map((piece) => {
      const ps = resample(piece.points, 0.03);
      return { ...piece, points: offsetLine(ps, normals(ps), side * 0.026) };
    });
    strokePieces(ctx, ruts, P.line.rut, 0.012);
  }
  strokePieces(ctx, trails, P.line.trail, 0.045, undefined, [0.075, 0.05]);
}

// ---------------------------------------------------------------------------------------------------------------------
// Bridges and buildings

function blockCorners(b: Block, l = b.len, w = b.wid): Point[] {
  const ca = Math.cos(b.angle);
  const sa = Math.sin(b.angle);
  return [
    [-l / 2, -w / 2],
    [l / 2, -w / 2],
    [l / 2, w / 2],
    [-l / 2, w / 2],
  ].map(([u, v]) => ({ x: b.x + u * ca - v * sa, y: b.y + u * sa + v * ca }));
}

function poly(ctx: CanvasRenderingContext2D, ps: Point[]) {
  ctx.beginPath();
  ps.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

function paintBridges(ctx: CanvasRenderingContext2D, blocks: Block[]) {
  for (const b of blocks) {
    const stone = b.len > 0.55;
    ctx.fillStyle = 'rgba(20, 24, 16, 0.35)';
    ctx.save();
    ctx.translate(0.03, 0.04);
    poly(ctx, blockCorners(b));
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = stone ? '#b3aa98' : '#9a7a52';
    poly(ctx, blockCorners(b));
    ctx.fill();
    // planks across a wooden deck
    if (!stone) {
      ctx.strokeStyle = 'rgba(60, 40, 20, 0.45)';
      ctx.lineWidth = 0.008;
      ctx.beginPath();
      const ca = Math.cos(b.angle);
      const sa = Math.sin(b.angle);
      for (let u = -b.len / 2 + 0.03; u < b.len / 2; u += 0.035) {
        ctx.moveTo(b.x + u * ca + (b.wid / 2) * sa, b.y + u * sa - (b.wid / 2) * ca);
        ctx.lineTo(b.x + u * ca - (b.wid / 2) * sa, b.y + u * sa + (b.wid / 2) * ca);
      }
      ctx.stroke();
    }
    // parapets
    const cs = blockCorners(b);
    ctx.strokeStyle = stone ? '#5f594e' : '#4a3520';
    ctx.lineWidth = 0.022;
    ctx.beginPath();
    ctx.moveTo(cs[0].x, cs[0].y);
    ctx.lineTo(cs[1].x, cs[1].y);
    ctx.moveTo(cs[3].x, cs[3].y);
    ctx.lineTo(cs[2].x, cs[2].y);
    ctx.stroke();
  }
}

const LIGHT = { x: -0.6, y: -0.8 };

function paintBuildings(ctx: CanvasRenderingContext2D, blocks: Block[]) {
  // shadows (cast to the south-east)
  ctx.fillStyle = 'rgba(24, 22, 12, 0.42)';
  for (const b of blocks) {
    ctx.save();
    ctx.translate(0.05, 0.065);
    poly(ctx, blockCorners(b));
    ctx.fill();
    ctx.restore();
  }
  for (const b of blocks) {
    const roof = P.roofs[b.seed % P.roofs.length];
    const ca = Math.cos(b.angle);
    const sa = Math.sin(b.angle);
    const at = (u: number, v: number): Point => ({ x: b.x + u * ca - v * sa, y: b.y + u * sa + v * ca });
    const L = b.len / 2;
    const Wd = b.wid / 2;
    const shade = (nx: number, ny: number) => {
      // facet normal in screen space
      const x = nx * ca - ny * sa;
      const y = nx * sa + ny * ca;
      return 1 + 0.2 * (x * LIGHT.x + y * LIGHT.y);
    };
    if (b.len < 0.2 || b.wid < 0.1) {
      ctx.fillStyle = css(shadeRGB(roof, 0.95));
      poly(ctx, blockCorners(b));
      ctx.fill();
    } else {
      const r = Math.max(0, L - Wd);
      const facets: [Point[], number, number][] = [
        [[at(-L, -Wd), at(L, -Wd), at(r, 0), at(-r, 0)], 0, -1],
        [[at(-L, Wd), at(L, Wd), at(r, 0), at(-r, 0)], 0, 1],
        [[at(-L, -Wd), at(-r, 0), at(-L, Wd)], -1, 0],
        [[at(L, -Wd), at(r, 0), at(L, Wd)], 1, 0],
      ];
      for (const [ps, nx, ny] of facets) {
        ctx.fillStyle = css(shadeRGB(roof, shade(nx, ny)));
        poly(ctx, ps);
        ctx.fill();
      }
      // tile courses parallel to the ridge
      ctx.strokeStyle = 'rgba(30, 20, 10, 0.16)';
      ctx.lineWidth = 0.006;
      ctx.beginPath();
      for (let v = 0.03; v < Wd - 0.01; v += 0.03) {
        const k = v / Wd;
        const u = L - (L - r) * k;
        for (const s of [-1, 1]) {
          const p = at(-u, s * Wd * (1 - k));
          const q = at(u, s * Wd * (1 - k));
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
        }
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(30, 20, 12, 0.6)';
      ctx.lineWidth = 0.012;
      ctx.beginPath();
      const p1 = at(-r, 0);
      const p2 = at(r, 0);
      ctx.moveTo(at(-L, -Wd).x, at(-L, -Wd).y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(at(-L, Wd).x, at(-L, Wd).y);
      ctx.moveTo(at(L, -Wd).x, at(L, -Wd).y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(at(L, Wd).x, at(L, Wd).y);
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(28, 22, 14, 0.85)';
    ctx.lineWidth = 0.016;
    poly(ctx, blockCorners(b));
    ctx.stroke();
  }
}
