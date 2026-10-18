// Vector features painted over the ground: roads, trails, railways, streams and gullies as smooth curves through the hex
// graph (positions from the mask's corridor cells when there is a mask, else hexside midpoints and hex centres), and
// building / bridge blocks. Pure functions (no DOM).
import { ALL_HEXES, centre, hexAt, hexsideKey, neighbour, neighbours as neighboursOf, type HexId, type HexSide, type Point } from '../../../engine/hex';
import { MASK, type MapDef, type PathKind } from '../../../engine/types';
import { hexsideSegment } from '../geometry';
import { cellCentre, components, type TerrainField } from './field';
import { hash3 } from './noise';

export type LinearKind = 'road' | 'trail' | 'railway' | 'stream' | 'gully';

export interface LinearPiece {
  kind: LinearKind;
  /** The hex this piece runs through. */
  hex: HexId;
  /** Sampled curve in map coordinates. */
  points: Point[];
  /** True when the piece ends inside the hex (dead end / spring). */
  deadEnd?: boolean;
}

const PATH_KIND: Record<PathKind, LinearKind> = { Road: 'road', Trail: 'trail', Railway: 'railway' };
const SIDES: HexSide[] = [1, 2, 3, 4, 5, 6];

/** Mask classes whose cells give the positions of each linear kind. */
const KIND_CELLS: Record<LinearKind, number[]> = {
  road: [MASK.road, MASK.bridge],
  trail: [MASK.road],
  railway: [MASK.railway],
  stream: [MASK.stream, MASK.bridge],
  gully: [MASK.gully],
};

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
const len = (a: Point) => Math.hypot(a.x, a.y);
const norm = (a: Point): Point => {
  const l = len(a);
  return l < 1e-9 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};

/** Points of the cubic Bézier p0..p3, `n` segments. */
export function cubic(p0: Point, p1: Point, p2: Point, p3: Point, n = 12): Point[] {
  const out: Point[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    out.push({ x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y });
  }
  return out;
}

/** Cells of the given classes, grouped by the hex their centre lies in. */
function cellsByHex(f: TerrainField, classes: number[]): Map<HexId, Point[]> {
  const out = new Map<HexId, Point[]>();
  const want = new Set(classes);
  for (let j = 0; j < f.height; j++) {
    for (let i = 0; i < f.width; i++) {
      if (!want.has(f.cls[j * f.width + i])) continue;
      const p = cellCentre(f, i, j);
      const h = hexAt(p.x, p.y);
      if (h === null) continue;
      let l = out.get(h);
      if (!l) out.set(h, (l = []));
      l.push(p);
    }
  }
  return out;
}

const centroid = (ps: Point[]): Point => mul(ps.reduce((s, p) => add(s, p), { x: 0, y: 0 }), 1 / ps.length);

/** Where corridor cells (of either hex) cross side `side` of `h`: the projection of their centroid, or null. */
function crossingFromCells(h: HexId, side: HexSide, cells: Map<HexId, Point[]>, tol: number): Point | null {
  const [a, b] = hexsideSegment(h, side);
  const ab = sub(b, a);
  const l2 = ab.x * ab.x + ab.y * ab.y;
  const near: { p: Point; t: number }[] = [];
  const n = neighbour(h, side);
  for (const hh of n === null ? [h] : [h, n]) {
    for (const p of cells.get(hh) ?? []) {
      const t = ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2;
      if (t < -0.05 || t > 1.05) continue;
      const q = add(a, mul(ab, Math.min(1, Math.max(0, t))));
      if (len(sub(p, q)) <= tol) near.push({ p, t });
    }
  }
  if (!near.length) return null;
  const t = Math.min(0.92, Math.max(0.08, near.reduce((s, x) => s + x.t, 0) / near.length));
  return add(a, mul(ab, t));
}

interface Graph {
  /** hexsideKey → crossing point. */
  crossings: Map<number, Point>;
  /** Hexes the kind runs through, with the point the curve aims at inside the hex. */
  hubs: Map<HexId, Point>;
  /** Curves pass through every hub (positions from mask cells), not only those of junctions and dead ends. */
  viaHub: boolean;
}

function midpoint(h: HexId, s: HexSide): Point {
  const [a, b] = hexsideSegment(h, s);
  return mul(add(a, b), 0.5);
}

/** The hex graph of one linear kind. */
function graphOf(map: MapDef, f: TerrainField | null, kind: LinearKind): Graph {
  const crossings = new Map<number, Point>();
  const hubs = new Map<HexId, Point>();
  const cells = f?.fromMask ? cellsByHex(f, KIND_CELLS[kind]) : null;
  const useCells = cells !== null && [...cells.values()].reduce((s, l) => s + l.length, 0) >= 4;
  const hubOf = (h: HexId): Point => {
    const cs = useCells ? cells!.get(h) : undefined;
    return cs && cs.length ? centroid(cs) : centre(h);
  };

  if (kind === 'road' || kind === 'trail' || kind === 'railway') {
    const pk = (Object.keys(PATH_KIND) as PathKind[]).find((k) => PATH_KIND[k] === kind)!;
    for (const [keyText, v] of Object.entries(map.paths)) {
      if (v !== pk) continue;
      const key = Number(keyText);
      const h = Math.floor(key / 6);
      const s = ((key % 6) + 1) as HexSide;
      const pos = (useCells ? crossingFromCells(h, s, cells!, 0.22) : null) ?? midpoint(h, s);
      crossings.set(key, pos);
      hubs.set(h, hubOf(h));
      const n = neighbour(h, s);
      if (n !== null) hubs.set(n, hubOf(n));
    }
    return { crossings, hubs, viaHub: useCells };
  }

  // streams and gullies
  if (useCells) {
    for (const h of ALL_HEXES) {
      if ((cells!.get(h)?.length ?? 0) === 0) continue;
      for (const s of SIDES) {
        const key = hexsideKey(h, s);
        if (crossings.has(key)) continue;
        const pos = crossingFromCells(h, s, cells!, 0.16);
        if (!pos) continue;
        crossings.set(key, pos);
      }
    }
    for (const key of crossings.keys()) {
      const h = Math.floor(key / 6);
      const n = neighbour(h, ((key % 6) + 1) as HexSide);
      for (const x of n === null ? [h] : [h, n]) if ((cells!.get(x)?.length ?? 0) > 0) hubs.set(x, hubOf(x));
    }
    for (const [h, l] of cells!) if (l.length >= 3 && !hubs.has(h)) hubs.set(h, hubOf(h));
    return { crossings, hubs, viaHub: true };
  }

  const isStream = (h: HexId) => map.terrain[h] === 'Stream';
  const isBridge = (h: HexId) => map.terrain[h] === 'MajorBridge' || map.terrain[h] === 'MinorBridge';
  const member = (h: HexId) =>
    kind === 'stream' ? isStream(h) || (isBridge(h) && neighboursOf(h).some(isStream)) : map.terrain[h] === 'Gully';
  const members = ALL_HEXES.filter(member);
  // Adjacent members are joined along a spanning tree: three mutually adjacent stream hexes make one bend, not a loop.
  // Kruskal with the cheapest edges first; an edge between two well-connected hexes is the likeliest shortcut.
  const deg = new Map(members.map((h) => [h, neighboursOf(h).filter(member).length]));
  const cand: [HexId, HexSide, HexId, number][] = [];
  for (const h of members) {
    for (const s of SIDES) {
      const n = neighbour(h, s);
      if (n !== null && n > h && member(n)) cand.push([h, s, n, deg.get(h)! + deg.get(n)!]);
    }
  }
  cand.sort((a, b) => a[3] - b[3] || a[0] - b[0] || a[2] - b[2]);
  const root = new Map(members.map((h) => [h, h]));
  const find = (h: HexId): HexId => {
    while (root.get(h) !== h) h = root.get(h)!;
    return h;
  };
  const sidesOf = new Map<HexId, HexSide[]>(members.map((h) => [h, []]));
  for (const [h, s, n] of cand) {
    const a = find(h);
    const b = find(n);
    if (a === b) continue;
    root.set(a, b);
    sidesOf.get(h)!.push(s);
    sidesOf.get(n)!.push(((s + 2) % 6 + 1) as HexSide);
  }
  for (const h of members) {
    hubs.set(h, centre(h));
    const inner = sidesOf.get(h)!;
    // a stream end that touches a pond or lake runs into it
    if (kind === 'stream' && inner.length <= 1) {
      const s = SIDES.find((x) => {
        const n = neighbour(h, x);
        return n !== null && map.terrain[n] === 'Water';
      });
      if (s) inner.push(s);
    }
    for (const s of inner) crossings.set(hexsideKey(h, s), midpoint(h, s));
    // a stream or gully that meets no other runs on to the map edge if it can (else it starts or ends in the hex)
    const edges = SIDES.filter((x) => neighbour(h, x) === null);
    if (inner.length === 1 && edges.length) {
      const opp = ((inner[0] + 2) % 6) + 1;
      const e = edges.slice().sort((x, y) => Math.abs(((x - opp + 9) % 6) - 3) - Math.abs(((y - opp + 9) % 6) - 3))[0];
      crossings.set(hexsideKey(h, e), midpoint(h, e));
    } else if (inner.length === 0) {
      const [s1, s2] = edges.length >= 2 ? [edges[0], edges[edges.length - 1]] : edges.length === 1 ? [edges[0], (((edges[0] + 2) % 6) + 1) as HexSide] : [2 as HexSide, 5 as HexSide];
      crossings.set(hexsideKey(h, s1), midpoint(h, s1));
      crossings.set(hexsideKey(h, s2), midpoint(h, s2));
    }
  }
  // streams and gullies wind through the centre of every hex they fill (they are hex terrain, unlike roads)
  return { crossings, hubs, viaHub: true };
}

/**
 * The curve pieces of one kind. The hex graph becomes a graph of points (hexside crossings, plus the hub of each junction
 * or dead end, and with a mask the corridor's centre in every hex), joined by cubic curves whose tangents follow
 * Catmull-Rom through each point with two neighbours: a road along a row of hexes stays straight instead of weaving
 * through their centres.
 */
export function linearPieces(map: MapDef, f: TerrainField | null, kind: LinearKind): LinearPiece[] {
  const { crossings, hubs, viaHub } = graphOf(map, f, kind);
  const pos = new Map<string, Point>();
  const adj = new Map<string, string[]>();
  const edges: { a: string; b: string; hex: HexId; deadEnd: boolean }[] = [];
  const node = (id: string, p: Point) => {
    pos.set(id, p);
    if (!adj.has(id)) adj.set(id, []);
  };
  const link = (a: string, b: string, hex: HexId, deadEnd: boolean) => {
    adj.get(a)!.push(b);
    adj.get(b)!.push(a);
    edges.push({ a, b, hex, deadEnd });
  };
  for (const [key, c] of crossings) node(`c${key}`, c);
  for (const [h, hub] of hubs) {
    const keys = [...new Set(SIDES.map((s) => hexsideKey(h, s)).filter((k) => crossings.has(k)))];
    if (keys.length === 0) continue;
    if (keys.length === 2 && !viaHub) {
      link(`c${keys[0]}`, `c${keys[1]}`, h, false);
      continue;
    }
    node(`h${h}`, hub);
    for (const k of keys) link(`c${k}`, `h${h}`, h, keys.length === 1);
  }
  /** Unit tangent at `u` when travelling toward its neighbour `v`. */
  const tangent = (u: string, v: string): Point => {
    const nb = adj.get(u)!;
    const pu = pos.get(u)!;
    const pv = pos.get(v)!;
    if (nb.length === 2) {
      const other = pos.get(nb[0] === v ? nb[1] : nb[0])!;
      const t = norm(sub(pv, other));
      if (len(t) > 0) return t;
    }
    return norm(sub(pv, pu));
  };
  return edges.map(({ a, b, hex, deadEnd }) => {
    const p0 = pos.get(a)!;
    const p3 = pos.get(b)!;
    const d = len(sub(p3, p0));
    const t0 = tangent(a, b);
    const t3 = mul(tangent(b, a), -1);
    const piece: LinearPiece = { kind, hex, points: cubic(p0, add(p0, mul(t0, d / 3)), sub(p3, mul(t3, d / 3)), p3, 10) };
    if (deadEnd) piece.deadEnd = true;
    return piece;
  });
}

/** All linear pieces of the map, bottom to top in painting order. */
export function allLinearPieces(map: MapDef, f: TerrainField | null): LinearPiece[] {
  return (['gully', 'stream', 'railway', 'road', 'trail'] as LinearKind[]).flatMap((k) => linearPieces(map, f, k));
}

// ---------------------------------------------------------------------------------------------------------------------
// Blocks: buildings and bridge decks

export interface Block {
  /** Centre in map coordinates. */
  x: number;
  y: number;
  /** Full length (along `angle`) and width. */
  len: number;
  wid: number;
  angle: number;
  /** Stable per-block random seed (roof colour, details). */
  seed: number;
}

/** Oriented bounding box (PCA) of points; `pad` is added to each extent. */
export function orientedBox(ps: Point[], pad: number): Block & { area: number } {
  const c = centroid(ps);
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of ps) {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  for (const p of ps) {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const u = dx * ca + dy * sa;
    const v = -dx * sa + dy * ca;
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
    v0 = Math.min(v0, v);
    v1 = Math.max(v1, v);
  }
  const uc = (u0 + u1) / 2;
  const vc = (v0 + v1) / 2;
  const L = u1 - u0 + pad;
  const W = v1 - v0 + pad;
  const box = { x: c.x + uc * ca - vc * sa, y: c.y + uc * sa + vc * ca, len: L, wid: W, angle, seed: 0, area: L * W };
  if (W > L) return { ...box, len: W, wid: L, angle: angle + Math.PI / 2 };
  return box;
}

/** Largest axis-aligned rectangle of set cells within a w×h grid (histogram method): [i0, j0, i1, j1] inclusive. */
function largestRect(grid: Uint8Array, w: number, h: number): [number, number, number, number] | null {
  const hist = new Int32Array(w);
  let best: [number, number, number, number] | null = null;
  let bestArea = 0;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) hist[i] = grid[j * w + i] ? hist[i] + 1 : 0;
    const stack: number[] = [];
    for (let i = 0; i <= w; i++) {
      const cur = i < w ? hist[i] : 0;
      while (stack.length && hist[stack[stack.length - 1]] >= cur) {
        const top = stack.pop()!;
        const height = hist[top];
        const left = stack.length ? stack[stack.length - 1] + 1 : 0;
        const area = height * (i - left);
        if (height > 0 && area > bestArea) {
          bestArea = area;
          best = [left, j - height + 1, i - 1, j];
        }
      }
      stack.push(i);
    }
  }
  return best;
}

const PATH_KINDS: ReadonlySet<LinearKind> = new Set(['road', 'trail', 'railway']);

/** Where to put the house of building hex `h` on a per-hex map: near the centre, parallel to and clear of its roads. */
export function buildingFootprint(map: MapDef, h: HexId, pieces: LinearPiece[]): Block[] {
  const c = centre(h);
  const seed = Math.floor(hash3(h, 7, 31) * 1e9);
  const pts: Point[] = [];
  for (const p of pieces) if (PATH_KINDS.has(p.kind)) for (const q of p.points) if (len(sub(q, c)) < 1.1) pts.push(q);
  const hl = 0.31;
  const hw = 0.21;
  if (!pts.length) {
    const angle = (hash3(h, 3, 9) - 0.5) * 0.6 + (hash3(h, 3, 5) < 0.3 ? Math.PI / 3 : 0);
    return [{ x: c.x, y: c.y, len: hl * 2.3, wid: hw * 2.3, angle, seed }];
  }
  const clearOf = (p: Point) => Math.min(...pts.map((q) => len(sub(p, q))));
  const need = hw + 0.13;
  let best = c;
  let bestScore = -Infinity;
  for (const r of [0, 0.26, 0.36, 0.44]) {
    for (let k = 0; k < (r ? 12 : 1); k++) {
      const a = (k / 12) * Math.PI * 2 + hash3(h, k, 1) * 0.2;
      const p = { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
      const d = clearOf(p);
      // the nearest spot that clears the road; failing that, the clearest
      const score = d >= need ? 10 - r : d - need;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
  }
  // parallel to the nearest stretch of road
  let qi = 0;
  pts.forEach((q, i) => {
    if (len(sub(q, best)) < len(sub(pts[qi], best))) qi = i;
  });
  const a = pts[Math.max(0, qi - 1)];
  const b = pts[Math.min(pts.length - 1, qi + 1)];
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  // as big as fits beside the road (a cramped hex gets a shed)
  for (let k = 1; k >= 0.3; k -= 0.1) {
    const house = { x: best.x, y: best.y, len: hl * 2 * Math.min(1, k + 0.2), wid: hw * 2 * k, angle, seed };
    if (!pts.some((q) => blockCovers(house, q, 0.07))) return [house];
  }
  return [{ x: best.x, y: best.y, len: hl * 0.7, wid: hw * 0.6, angle, seed }];
}

/** Distance from p to the segment a-b. */
function segDist(p: Point, a: Point, b: Point): number {
  const ab = sub(b, a);
  const l2 = ab.x * ab.x + ab.y * ab.y;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2)) : 0;
  return len(sub(p, add(a, mul(ab, t))));
}

/**
 * The houses of a per-hex map: one per building hex (clear of its roads); the hexes of one multi-hex building share a
 * roof and are joined by wings wherever no road runs between them.
 */
function perHexBuildings(map: MapDef, pieces: LinearPiece[]): Block[] {
  const roadPts = pieces.filter((p) => PATH_KINDS.has(p.kind)).flatMap((p) => p.points);
  const houses = new Map<HexId, Block>();
  const out: Block[] = [];
  for (const h of ALL_HEXES) {
    if (map.terrain[h] !== 'Building') continue;
    const id = groupOf(map, h);
    const [b] = buildingFootprint(map, h, pieces);
    const house = id >= 0 ? { ...b, seed: groupSeed(id) } : b;
    houses.set(h, house);
    out.push(house);
  }
  for (const [h, a] of houses) {
    const id = groupOf(map, h);
    if (id < 0) continue;
    for (const s of SIDES) {
      const n = neighbour(h, s);
      if (n === null || n < h || map.building[n] !== id) continue;
      const b = houses.get(n);
      if (!b) continue;
      const wid = Math.min(a.wid, b.wid) * 0.8;
      const pa = { x: a.x, y: a.y };
      const pb = { x: b.x, y: b.y };
      // a wing only where no road runs between the two houses
      if (roadPts.some((q) => segDist(q, pa, pb) < wid / 2 + 0.1)) continue;
      out.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, len: len(sub(pb, pa)), wid, angle: Math.atan2(b.y - a.y, b.x - a.x), seed: a.seed });
    }
  }
  return out;
}

/** Whether point p lies inside block b (grown by `pad` on every side). */
export function blockCovers(b: Block, p: Point, pad = 0): boolean {
  const dx = p.x - b.x;
  const dy = p.y - b.y;
  const ca = Math.cos(b.angle);
  const sa = Math.sin(b.angle);
  return Math.abs(dx * ca + dy * sa) <= b.len / 2 + pad && Math.abs(-dx * sa + dy * ca) <= b.wid / 2 + pad;
}

/** Building blocks: from the mask's building cells, else one house per building hex (clear of its roads). */
export function buildingBlocks(map: MapDef, f: TerrainField, pieces: LinearPiece[]): Block[] {
  if (!f.fromMask) return perHexBuildings(map, pieces);
  return blocksOfClass(f, MASK.building, 0.7).map((b) => {
    const id = groupOf(map, hexAt(b.x, b.y));
    return id >= 0 ? { ...b, seed: groupSeed(id) } : b;
  });
}

const COVER_ANGLES = [0, 15, 30, 45, 60, 75].map((d) => (d * Math.PI) / 180);

/**
 * Rotated rectangles covering a component of cells: one block when the component is compact, else the largest
 * rectangle at any of a few angles (the component's own axis, every 15 degrees), removed and repeated. Scraps under 4
 * cells, or a single cell wide, stay uncovered (the ground pass paints building cells as built-up ground anyway).
 */
function coverCells(f: TerrainField, cells: number[], compact: number, seed: number): Block[] {
  const { width: w, height: h, res } = f;
  const step = 1 / res;
  const remaining = new Set(cells);
  const out: Block[] = [];
  const cellAt = (x: number, y: number) => {
    const i = Math.floor((x - f.x0) * res);
    const j = Math.floor((y - f.y0) * res);
    return i < 0 || j < 0 || i >= w || j >= h ? -1 : j * w + i;
  };
  for (let n = 0; n < 40 && remaining.size >= 4; n++) {
    const pts = [...remaining].map((c) => cellCentre(f, c % w, Math.floor(c / w)));
    const box = orientedBox(pts, step);
    if (n === 0 && (remaining.size / (box.area * res * res) >= compact || remaining.size <= 6)) {
      out.push({ x: box.x, y: box.y, len: box.len, wid: box.wid, angle: box.angle, seed });
      break;
    }
    let best: { a: number; u0: number; u1: number; v0: number; v1: number; area: number } | null = null;
    for (const a of [box.angle, ...COVER_ANGLES]) {
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      let umin = Infinity;
      let umax = -Infinity;
      let vmin = Infinity;
      let vmax = -Infinity;
      for (const p of pts) {
        const u = p.x * ca + p.y * sa;
        const v = -p.x * sa + p.y * ca;
        umin = Math.min(umin, u);
        umax = Math.max(umax, u);
        vmin = Math.min(vmin, v);
        vmax = Math.max(vmax, v);
      }
      const gw = Math.round((umax - umin) / step) + 1;
      const gh = Math.round((vmax - vmin) / step) + 1;
      const grid = new Uint8Array(gw * gh);
      for (let gj = 0; gj < gh; gj++) {
        for (let gi = 0; gi < gw; gi++) {
          const u = umin + gi * step;
          const v = vmin + gj * step;
          grid[gj * gw + gi] = remaining.has(cellAt(u * ca - v * sa, u * sa + v * ca)) ? 1 : 0;
        }
      }
      const r = largestRect(grid, gw, gh);
      if (!r) continue;
      const [i0, j0, i1, j1] = r;
      if (i1 - i0 < 1 || j1 - j0 < 1) continue; // a single cell wide
      const area = (i1 - i0 + 1) * (j1 - j0 + 1);
      if (!best || area > best.area) {
        best = { a, area, u0: umin + (i0 - 0.5) * step, u1: umin + (i1 + 0.5) * step, v0: vmin + (j0 - 0.5) * step, v1: vmin + (j1 + 0.5) * step };
      }
    }
    if (!best || best.area < 4) break;
    const ca = Math.cos(best.a);
    const sa = Math.sin(best.a);
    const uc = (best.u0 + best.u1) / 2;
    const vc = (best.v0 + best.v1) / 2;
    const L = best.u1 - best.u0;
    const W = best.v1 - best.v0;
    const x = uc * ca - vc * sa;
    const y = uc * sa + vc * ca;
    // a small piece hugging a block already placed is the ragged edge of that building, not an outbuilding: its cells
    // stay built-up ground
    const fringe = best.area < 12 && out.some((b) => blockCovers(b, { x, y }, 0.22));
    if (!fringe) out.push(L >= W ? { x, y, len: L, wid: W, angle: best.a, seed } : { x, y, len: W, wid: L, angle: best.a + Math.PI / 2, seed });
    let removed = 0;
    for (const c of [...remaining]) {
      const p = cellCentre(f, c % w, Math.floor(c / w));
      const u = p.x * ca + p.y * sa;
      const v = -p.x * sa + p.y * ca;
      if (u >= best.u0 && u <= best.u1 && v >= best.v0 && v <= best.v1) {
        remaining.delete(c);
        removed++;
      }
    }
    if (!removed) break;
  }
  return out;
}

function blocksOfClass(f: TerrainField, k: number, compact: number): Block[] {
  const { width: w, height: h } = f;
  const { labels, count } = components(w, h, (i) => f.cls[i] === k, true);
  const members: number[][] = Array.from({ length: count }, () => []);
  for (let i = 0; i < labels.length; i++) if (labels[i] >= 0) members[labels[i]].push(i);
  return members.flatMap((cells, ci) => (cells.length < 2 ? [] : coverCells(f, cells, compact, Math.floor(hash3(ci, cells[0], 13) * 1e9))));
}

/** The building id shared by several hexes (a multi-hex building), or -1. */
function groupOf(map: MapDef, h: HexId | null): number {
  if (h === null) return -1;
  const id = map.building[h];
  if (id === undefined || id < 0) return -1;
  return map.building.some((b, x) => b === id && x !== h) ? id : -1;
}

/** One roof colour for all the blocks of one multi-hex building. */
function groupSeed(id: number): number {
  return Math.floor(hash3(id, 99, 7) * 1e9);
}

/**
 * Bridges from the mask's bridge cells: a deck along the road (or track) that crosses each patch of bridge cells, as long
 * as the patch is along the road and of a bridge's width; without a road, the patch's own box.
 */
function bridgeDecksFromCells(f: TerrainField, pieces: LinearPiece[]): Block[] {
  const { width: w, height: h, res } = f;
  const { labels, count } = components(w, h, (i) => f.cls[i] === MASK.bridge, true);
  const members: Point[][] = Array.from({ length: count }, () => []);
  for (let i = 0; i < labels.length; i++) if (labels[i] >= 0) members[labels[i]].push(cellCentre(f, i % w, Math.floor(i / w)));
  const roads = pieces.filter((p) => PATH_KINDS.has(p.kind));
  const out: Block[] = [];
  members.forEach((pts, k) => {
    if (pts.length < 2) return;
    const c = centroid(pts);
    let best: { p: Point; a: number; d: number } | null = null;
    for (const piece of roads) {
      piece.points.forEach((q, i) => {
        const d = len(sub(q, c));
        if (best && d >= best.d) return;
        const a0 = piece.points[Math.max(0, i - 1)];
        const a1 = piece.points[Math.min(piece.points.length - 1, i + 1)];
        best = { p: q, a: Math.atan2(a1.y - a0.y, a1.x - a0.x), d };
      });
    }
    const seed = Math.floor(hash3(k, 5, 55) * 1e9);
    const found = best as { p: Point; a: number; d: number } | null;
    if (!found || found.d > 0.45) {
      const box = orientedBox(pts, 1 / res);
      out.push({ x: box.x, y: box.y, len: box.len, wid: box.wid, angle: box.angle, seed });
      return;
    }
    const ca = Math.cos(found.a);
    const sa = Math.sin(found.a);
    let u0 = Infinity;
    let u1 = -Infinity;
    for (const p of pts) {
      const u = (p.x - found.p.x) * ca + (p.y - found.p.y) * sa;
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
    }
    const L = Math.min(0.85, Math.max(0.36, u1 - u0 + 1 / res));
    const um = (u0 + u1) / 2;
    out.push({ x: found.p.x + um * ca, y: found.p.y + um * sa, len: L, wid: L > 0.55 ? 0.26 : 0.2, angle: found.a, seed });
  });
  return out;
}

/** Bridge decks: from the mask's bridge cells, else one per bridge hex across its road (or its stream). */
export function bridgeBlocks(map: MapDef, f: TerrainField, pieces: LinearPiece[]): Block[] {
  if (f.fromMask) {
    const decks = bridgeDecksFromCells(f, pieces);
    if (decks.length) return decks;
  }
  const out: Block[] = [];
  for (const h of ALL_HEXES) {
    const t = map.terrain[h];
    if (t !== 'MajorBridge' && t !== 'MinorBridge') continue;
    const road = pieces.find((p) => p.hex === h && (p.kind === 'road' || p.kind === 'trail' || p.kind === 'railway'));
    const stream = pieces.find((p) => p.hex === h && p.kind === 'stream');
    let angle = 0;
    let at = centre(h);
    if (road) {
      const m = Math.floor(road.points.length / 2);
      const a = road.points[Math.max(0, m - 1)];
      const b = road.points[Math.min(road.points.length - 1, m + 1)];
      angle = Math.atan2(b.y - a.y, b.x - a.x);
      at = road.points[m];
    } else if (stream) {
      const m = Math.floor(stream.points.length / 2);
      const a = stream.points[Math.max(0, m - 1)];
      const b = stream.points[Math.min(stream.points.length - 1, m + 1)];
      angle = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
      at = stream.points[m];
    }
    const major = t === 'MajorBridge';
    out.push({ x: at.x, y: at.y, len: major ? 0.62 : 0.46, wid: major ? 0.24 : 0.17, angle, seed: h });
  }
  return out;
}
