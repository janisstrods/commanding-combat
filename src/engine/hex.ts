// Hex grid of the Combat Commander maps: 15 columns A..O by 10 rows, flat-topped hexes in vertical columns.
// High columns (A, C, ..., O) sit half a hex above the low ones (B, D, ..., N). Hex ids are column-major:
// id = k * 10 + (n - 1) for column index k (A = 0) and row n (1..10). Sides follow the 1..6 compass printed on the maps
// (and used by the Breeze event): 1 = N, 2 = NE, 3 = SE, 4 = S, 5 = SW, 6 = NW.

export type HexId = number;
export type HexSide = 1 | 2 | 3 | 4 | 5 | 6;

export const COLS = 15;
export const ROWS = 10;
export const NUM_HEXES = COLS * ROWS;
export const COLUMN_LETTERS = 'ABCDEFGHIJKLMNO';
export const SIDES: readonly HexSide[] = [1, 2, 3, 4, 5, 6];

export function hexId(k: number, n: number): HexId {
  return k * ROWS + (n - 1);
}
export function colOf(h: HexId): number {
  return Math.floor(h / ROWS);
}
export function rowOf(h: HexId): number {
  return (h % ROWS) + 1;
}
export function onBoard(k: number, n: number): boolean {
  return k >= 0 && k < COLS && n >= 1 && n <= ROWS;
}

export function label(h: HexId): string {
  return `${COLUMN_LETTERS[colOf(h)]}${rowOf(h)}`;
}

export function parseHex(s: string): HexId {
  const m = /^([A-O])(10|[1-9])$/.exec(s.trim().toUpperCase());
  if (!m) throw new Error(`Not a hex label: ${s}`);
  return hexId(COLUMN_LETTERS.indexOf(m[1]), Number(m[2]));
}

export const ALL_HEXES: readonly HexId[] = Array.from({ length: NUM_HEXES }, (_, i) => i);

// [dk, dn] per side 1..6 for high (even k) and low (odd k) columns.
const HIGH: [number, number][] = [[0, -1], [1, -1], [1, 0], [0, 1], [-1, 0], [-1, -1]];
const LOW: [number, number][] = [[0, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];

const NEIGHBOUR: (HexId | null)[][] = ALL_HEXES.map((h) => {
  const k = colOf(h);
  const n = rowOf(h);
  return (k % 2 === 0 ? HIGH : LOW).map(([dk, dn]) => (onBoard(k + dk, n + dn) ? hexId(k + dk, n + dn) : null));
});
const NEIGHBOURS: HexId[][] = NEIGHBOUR.map((ns) => ns.filter((n): n is HexId => n !== null));

/** The hex across side `side` of `h`, or null at the map edge. */
export function neighbour(h: HexId, side: HexSide): HexId | null {
  return NEIGHBOUR[h][side - 1];
}

/** The on-map neighbours of `h`. */
export function neighbours(h: HexId): readonly HexId[] {
  return NEIGHBOURS[h];
}

export function areAdjacent(a: HexId, b: HexId): boolean {
  return NEIGHBOUR[a].includes(b);
}

/** The side of `from` that faces its neighbour `to`, or null if they are not adjacent. */
export function sideTo(from: HexId, to: HexId): HexSide | null {
  const i = NEIGHBOUR[from].indexOf(to);
  return i < 0 ? null : ((i + 1) as HexSide);
}

export function oppositeSide(side: HexSide): HexSide {
  return (((side + 2) % 6) + 1) as HexSide;
}

/** The sides of `h` that lie on the map edge. */
export function edgeHexsides(h: HexId): HexSide[] {
  return SIDES.filter((s) => NEIGHBOUR[h][s - 1] === null);
}

/** One number per hexside, the same from both hexes that share it (edge sides have a key of their own). */
export function hexsideKey(h: HexId, side: HexSide): number {
  const n = neighbour(h, side);
  const mine = h * 6 + (side - 1);
  return n === null ? mine : Math.min(mine, n * 6 + (oppositeSide(side) - 1));
}

/** The key of the hexside shared by adjacent hexes `a` and `b`, or null if they are not adjacent. */
export function hexsideBetween(a: HexId, b: HexId): number | null {
  const s = sideTo(a, b);
  return s === null ? null : hexsideKey(a, s);
}

// Cube coordinates (odd-q layout: odd columns shifted down).
function cube(h: HexId): [number, number, number] {
  const k = colOf(h);
  const r = rowOf(h) - 1;
  const x = k;
  const z = r - (k - (k & 1)) / 2;
  return [x, -x - z, z];
}

export function distance(a: HexId, b: HexId): number {
  const [ax, ay, az] = cube(a);
  const [bx, by, bz] = cube(b);
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz));
}

// Geometry in units of the hex circumradius: A1's centre is (0, 0); x grows to the right, y downwards.
const SQRT3 = Math.sqrt(3);
const APOTHEM = SQRT3 / 2;

export interface Point {
  x: number;
  y: number;
}

export function centre(h: HexId): Point {
  const k = colOf(h);
  return { x: 1.5 * k, y: SQRT3 * (rowOf(h) - 1 + (k & 1) / 2) };
}

/** The six corners of `h`, clockwise from the east corner (screen coordinates). */
export function corners(h: HexId): Point[] {
  const c = centre(h);
  return [0, 1, 2, 3, 4, 5].map((i) => ({ x: c.x + Math.cos((Math.PI / 3) * i), y: c.y + Math.sin((Math.PI / 3) * i) }));
}

/** The hex containing point (x, y), or null off the map. */
export function hexAt(x: number, y: number): HexId | null {
  const q = (2 / 3) * x;
  const r = -x / 3 + (SQRT3 / 3) * y;
  // cube round
  let rx = Math.round(q);
  let rz = Math.round(r);
  let ry = Math.round(-q - r);
  const dx = Math.abs(rx - q);
  const dz = Math.abs(rz - r);
  const dy = Math.abs(ry + q + r);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dz > dy) rz = -rx - ry;
  else ry = -rx - rz;
  const k = rx;
  const n = rz + (k - (k & 1)) / 2 + 1;
  return onBoard(k, n) ? hexId(k, n) : null;
}

// Outward unit normals of the six sides (in screen coordinates: 1 = N is up, i.e. y < 0).
const NORMALS: Point[] = SIDES.map((s) => {
  const angle = (Math.PI / 3) * (s - 1) - Math.PI / 2; // side 1 (N) points straight up
  return { x: Math.cos(angle), y: Math.sin(angle) };
});

/** Parameter interval [t0, t1] of segment a→b inside the closed hexagon `h`, or null. */
function clip(h: HexId, a: Point, b: Point): [number, number] | null {
  const c = centre(h);
  let t0 = 0;
  let t1 = 1;
  for (const nrm of NORMALS) {
    const p0 = (a.x - c.x) * nrm.x + (a.y - c.y) * nrm.y;
    const dp = (b.x - a.x) * nrm.x + (b.y - a.y) * nrm.y;
    // p0 + t * dp <= APOTHEM
    if (Math.abs(dp) < 1e-12) {
      if (p0 > APOTHEM + 1e-9) return null;
      continue;
    }
    const t = (APOTHEM - p0) / dp;
    if (dp > 0) t1 = Math.min(t1, t);
    else t0 = Math.max(t0, t);
    if (t0 > t1) return null;
  }
  return [t0, t1];
}

/** How far point p lies inside hexagon `h` (negative outside, about 0 on its boundary). */
function depth(h: HexId, p: Point): number {
  const c = centre(h);
  let d = Infinity;
  for (const nrm of NORMALS) d = Math.min(d, APOTHEM - ((p.x - c.x) * nrm.x + (p.y - c.y) * nrm.y));
  return d;
}

export interface LineStep {
  /** One hex whose interior the line crosses, or the hexes on both sides of a hexside the line runs along. */
  hexes: HexId[];
  /** True when the line runs exactly along a hexside (`hexes` holds the one or two on-map hexes sharing it). */
  alongHexside: boolean;
}

const EPS = 1e-7;

/**
 * The hexes a centre-to-centre line from `from` to `to` passes through, strictly between them, in order. A stretch where
 * the line runs exactly along a hexside is one step holding both hexes beside it; touching a corner counts for nothing.
 */
export function lineHexes(from: HexId, to: HexId): LineStep[] {
  if (from === to) return [];
  const a = centre(from);
  const b = centre(to);
  const inside: { t: number; h: HexId }[] = [];
  const along = new Map<string, { t: number; hexes: HexId[] }>();
  for (const h of ALL_HEXES) {
    if (h === from || h === to) continue;
    const iv = clip(h, a, b);
    if (!iv || iv[1] - iv[0] < EPS) continue;
    const tm = (iv[0] + iv[1]) / 2;
    const mid = { x: a.x + (b.x - a.x) * tm, y: a.y + (b.y - a.y) * tm };
    if (depth(h, mid) > EPS) {
      inside.push({ t: iv[0], h });
    } else {
      const key = `${iv[0].toFixed(6)}:${iv[1].toFixed(6)}`;
      const e = along.get(key);
      if (e) e.hexes.push(h);
      else along.set(key, { t: iv[0], hexes: [h] });
    }
  }
  const steps: { t: number; step: LineStep }[] = [
    ...inside.map(({ t, h }) => ({ t, step: { hexes: [h], alongHexside: false } })),
    ...[...along.values()].map(({ t, hexes }) => ({ t, step: { hexes: hexes.sort((x, y) => x - y), alongHexside: true } })),
  ];
  return steps.sort((x, y) => x.t - y.t).map((s) => s.step);
}
