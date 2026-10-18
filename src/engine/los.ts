// Line of sight (rules-reference §10.1–§10.4: rulebook 10, T86 Gully, T88.3–T88.5 Hills, R-21) and the hexside Cover a
// shot crosses into its target (T87, T97).
//
// A LOS is the segment between two hex centre dots. Only what lies in *intervening* hexes counts, and hexside features
// that are not one of the six sides of either end hex (also when the LOS runs exactly along them). Smoke also hinders
// into and out of its own hex; Blaze blocks every hex the LOS touches, including along its hexsides. Units never matter.
//
// Terrain comes from the map's mask when it has one (the drawn depiction: a LOS that touches an Obstacle's cells is
// blocked, roads and railways are clear corridors through other art, hill levels and crest lines come from the cells),
// else from whole hexes (MapDef.terrain/elevation: the no-mask fallback).
//
// The check is symmetric by construction: it is always computed from the lower hex id to the higher (the LOS is
// reciprocal, §10.1), so `blockedBy` names the first blocker counted from the lower id. The map-independent geometry of
// each hex pair is computed once and cached; nothing is cached per map, so maps may be edited (tests do).
import { loadMap } from './data';
import { NUM_HEXES, SIDES, areAdjacent, centre, hexAt, hexsideKey, label, lineHexes, neighbour, type HexId } from './hex';
import { fogHindrance } from './scenarioRules';
import { HEXSIDE, TERRAIN, hexsideInfo, hindranceOf } from './terrain';
import { MASK, type GameState, type HexsideFeature, type MapDef, type SpecialRules } from './types';

/** What a LOS check reads: the map and the Smoke and Blaze markers (a GameState's, via `losView`). */
export interface LosView {
  map: MapDef;
  /** Smoke Hindrance per hex (0 = none). */
  smoke: readonly number[];
  blaze: readonly boolean[];
}

export interface LosResult {
  clear: boolean;
  /** The single largest Hindrance on the LOS (§10.3.3), Smoke in either end hex included; 0 when blocked. */
  hindrance: number;
  /** Why the LOS is blocked, for the UI ("Woods at F5", "Hill level 2 at H6", "Wall F5|F6"); null when clear. */
  blockedBy: string | null;
}

/**
 * The LOS view of a game: its map plus its Smoke and Blaze. A GameState already is one (it carries `map`), so
 * `losCheck(s, a, b)` works directly; this builds a view with another MapDef (`map`), or with `loadMap(s.scenario.map)`
 * for a state built without its map.
 */
export function losView(s: GameState, map?: MapDef): LosView {
  return { map: map ?? s.map ?? loadMap(s.scenario.map), smoke: s.smoke, blaze: s.blaze };
}

// ---------------------------------------------------------------------------------------------------------------------
// Geometry (hex circumradius units, as hex.ts): per hex pair, the intervening hexes with the stretch of the LOS inside
// each, and the hexsides it crosses, runs along or passes through a corner of.

const APOTHEM = Math.sqrt(3) / 2;
/** Corner i of a hex at angle 60°·i from its centre (screen coordinates): 0 E, 1 SE, 2 SW, 3 W, 4 NW, 5 NE. */
const CORNER_X = [1, 0.5, -0.5, -1, -0.5, 0.5];
const CORNER_Y = [0, APOTHEM, APOTHEM, 0, -APOTHEM, -APOTHEM];
/** The two corners of side s (index s − 1). */
const SIDE_CORNERS: readonly [number, number][] = [[4, 5], [5, 0], [0, 1], [1, 2], [2, 3], [3, 4]];
/** Outward unit normal of side s (index s − 1); side 1 (N) points up. */
const NORMAL_X = SIDES.map((s) => Math.cos((Math.PI / 3) * (s - 1) - Math.PI / 2));
const NORMAL_Y = SIDES.map((s) => Math.sin((Math.PI / 3) * (s - 1) - Math.PI / 2));
const EPS = 1e-7;

interface Step {
  /** One hex, or the two hexes beside a hexside the LOS runs along. */
  hexes: HexId[];
  along: boolean;
  /** The stretch of the LOS (parameter t from the lower id's centre, 0, to the higher's, 1) in the hex / along the side. */
  t0: number;
  t1: number;
}

interface SideEvent {
  t: number;
  /** 'cross': through the hexside's interior; 'along': on it for a stretch; 'corner': through one end of it. */
  kind: 'cross' | 'along' | 'corner';
  /** The hexside (cross, along) or, for a corner, the hexsides there on one side of the LOS ... */
  keys: number[];
  /** ... and those on the other side. A corner counts as crossing a feature only if both sides have one. */
  others: number[];
}

interface Geom {
  ax: number;
  ay: number;
  dx: number;
  dy: number;
  /** Where the LOS leaves the lower id's hex and enters the higher id's hex. */
  tA: number;
  tB: number;
  steps: Step[];
  sides: SideEvent[];
  /** Sides of the lower id's hex the LOS crosses at tA (two at a corner) / of the higher id's hex at tB. */
  entryA: number[];
  entryB: number[];
}

/** Parameter interval of the segment inside the closed hexagon `h` (as hex.ts `clip`). */
function clip(h: HexId, ax: number, ay: number, dx: number, dy: number): [number, number] | null {
  const c = centre(h);
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 6; i++) {
    const p0 = (ax - c.x) * NORMAL_X[i] + (ay - c.y) * NORMAL_Y[i];
    const dp = dx * NORMAL_X[i] + dy * NORMAL_Y[i];
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

/** The sides (hexside keys) of `h` that the point (x, y) on its boundary lies on. */
function sidesAt(h: HexId, x: number, y: number): number[] {
  const c = centre(h);
  const keys: number[] = [];
  for (const s of SIDES) {
    if (Math.abs((x - c.x) * NORMAL_X[s - 1] + (y - c.y) * NORMAL_Y[s - 1] - APOTHEM) < 1e-6) keys.push(hexsideKey(h, s));
  }
  return keys;
}

function computeGeom(a: HexId, b: HexId): Geom {
  const pa = centre(a);
  const pb = centre(b);
  const ax = pa.x;
  const ay = pa.y;
  const dx = pb.x - ax;
  const dy = pb.y - ay;
  const dd = dx * dx + dy * dy;
  const len = Math.sqrt(dd);
  const tA = clip(a, ax, ay, dx, dy)![1];
  const tB = clip(b, ax, ay, dx, dy)![0];
  const steps: Step[] = lineHexes(a, b).map((s) => {
    const iv = clip(s.hexes[0], ax, ay, dx, dy) ?? [0, 0];
    return { hexes: s.hexes, along: s.alongHexside, t0: iv[0], t1: iv[1] };
  });

  const ends = new Set<number>();
  for (const s of SIDES) {
    ends.add(hexsideKey(a, s));
    ends.add(hexsideKey(b, s));
  }
  const seen = new Set<number>();
  const sides: SideEvent[] = [];
  const corners = new Map<number, SideEvent>();
  for (const step of steps) {
    for (const h of step.hexes) {
      const c = centre(h);
      for (const s of SIDES) {
        if (neighbour(h, s) === null) continue; // map edge: never a feature
        const key = hexsideKey(h, s);
        if (seen.has(key) || ends.has(key)) continue;
        seen.add(key);
        const [i0, i1] = SIDE_CORNERS[s - 1];
        const px = c.x + CORNER_X[i0];
        const py = c.y + CORNER_Y[i0];
        const ex = CORNER_X[i1] - CORNER_X[i0];
        const ey = CORNER_Y[i1] - CORNER_Y[i0];
        const wx = px - ax;
        const wy = py - ay;
        const denom = dx * ey - dy * ex;
        if (Math.abs(denom) < 1e-9 * len) {
          // parallel: along it if collinear for a stretch
          if (Math.abs(wx * dy - wy * dx) > 1e-9 * len) continue;
          const tp = (wx * dx + wy * dy) / dd;
          const tq = ((wx + ex) * dx + (wy + ey) * dy) / dd;
          const lo = Math.max(0, Math.min(tp, tq));
          const hi = Math.min(1, Math.max(tp, tq));
          if (hi - lo > EPS) sides.push({ t: (lo + hi) / 2, kind: 'along', keys: [key], others: [] });
          continue;
        }
        const t = (wx * ey - wy * ex) / denom;
        const u = (wx * dy - wy * dx) / denom;
        if (t <= EPS || t >= 1 - EPS) continue;
        if (u > EPS && u < 1 - EPS) {
          sides.push({ t, kind: 'cross', keys: [key], others: [] });
        } else if (Math.abs(u) <= EPS || Math.abs(u - 1) <= EPS) {
          // through a corner: which side of the LOS does the hexside lie on?
          const rx = u < 0.5 ? ex : -ex;
          const ry = u < 0.5 ? ey : -ey;
          const id = Math.round(t * 1e6);
          let ev = corners.get(id);
          if (!ev) corners.set(id, (ev = { t, kind: 'corner', keys: [], others: [] }));
          (dx * ry - dy * rx > 0 ? ev.keys : ev.others).push(key);
        }
      }
    }
  }
  for (const ev of corners.values()) if (ev.keys.length && ev.others.length) sides.push(ev);
  sides.sort((x, y) => x.t - y.t);
  return {
    ax,
    ay,
    dx,
    dy,
    tA,
    tB,
    steps,
    sides,
    entryA: sidesAt(a, ax + tA * dx, ay + tA * dy),
    entryB: sidesAt(b, ax + tB * dx, ay + tB * dy),
  };
}

const GEOM: (Geom | undefined)[] = new Array(NUM_HEXES * NUM_HEXES);

/** The cached geometry of the pair, a < b. */
function geom(a: HexId, b: HexId): Geom {
  const i = a * NUM_HEXES + b;
  return (GEOM[i] ??= computeGeom(a, b));
}

// ---------------------------------------------------------------------------------------------------------------------
// The check

/** Elevation context of one LOS (§10.4): the two end levels and which end is lower (-1 if level). */
interface Heights {
  hi: number;
  lo: number;
  level: boolean;
  low: HexId;
}

/** Step 1–3: a hill of level `lvl` between the ends blocks (above both, or the higher end's level when they differ). */
const hillBlocks = (z: Heights, lvl: number) => (z.level ? lvl > z.hi : lvl >= z.hi);

/**
 * Step 5 (T88.4): an Obstacle at elevation e blocks if it is at least as high as the higher end; between the two ends'
 * levels only in the intervening hex next to the lower end (the one blind hex, T88.4.1); below both ends never.
 */
const obstacleBlocks = (z: Heights, e: number, nearLow: boolean) => e >= z.hi || (e >= z.lo && nearLow);

const nearLow = (z: Heights, h: HexId) => z.low >= 0 && areAdjacent(h, z.low);

/** LOS strength of a hexside feature: 2 Obstacle, 1 Hindrance, 0 none. */
const strength = (f: HexsideFeature | undefined) => (f === undefined ? 0 : HEXSIDE[f].obstacle ? 2 : HEXSIDE[f].hindrance > 0 ? 1 : 0);

/** The two hexes of a hexside key (its own hex and the neighbour across it). */
function hexesOf(key: number): [HexId, HexId] {
  const h = Math.floor(key / 6);
  return [h, neighbour(h, ((key % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6) ?? h];
}

function sideLabel(key: number): string {
  const [p, q] = hexesOf(key);
  return `${label(Math.min(p, q))}|${label(Math.max(p, q))}`;
}

/** R-21: a hexside stands at the higher level of its two hexes. */
function sideLevel(map: MapDef, key: number): number {
  const [p, q] = hexesOf(key);
  return Math.max(map.elevation[p], map.elevation[q]);
}

/** Half-width of the clear corridor along a road/railway depiction in the no-mask fallback (hex radius units). */
const CORRIDOR = 0.15;

/**
 * No-mask fallback for "Clear along the road / railway depiction" (§T92, §T93, example F): the depiction is taken as
 * the arms from the hex centre to the midpoints of the sides its path crosses; the LOS is on it if its whole stretch in
 * the hex stays within CORRIDOR of an arm (in practice: straight through the centre along a straight road).
 */
function onCorridor(map: MapDef, h: HexId, g: Geom, step: Step): boolean {
  for (const kind of ['Road', 'Railway'] as const) {
    if (map.pathHexes[kind]?.[h] !== true) continue;
    const arms = SIDES.filter((s) => map.paths[hexsideKey(h, s)] === kind);
    if (arms.length === 0) continue;
    const c = centre(h);
    let ok = true;
    for (let k = 0; k <= 8 && ok; k++) {
      const t = step.t0 + ((step.t1 - step.t0) * k) / 8;
      const px = g.ax + t * g.dx - c.x;
      const py = g.ay + t * g.dy - c.y;
      let best = Infinity;
      for (const s of arms) {
        const mx = NORMAL_X[s - 1] * APOTHEM;
        const my = NORMAL_Y[s - 1] * APOTHEM;
        const u = Math.max(0, Math.min(1, (px * mx + py * my) / (APOTHEM * APOTHEM)));
        best = Math.min(best, Math.hypot(px - u * mx, py - u * my));
      }
      ok = best <= CORRIDOR;
    }
    if (ok) return true;
  }
  return false;
}

/** LOS Hindrance per mask class (railway cells are handled apart: clear along the track, 1 across it). */
const CELL_HINDRANCE: number[] = [];
CELL_HINDRANCE[MASK.brush] = TERRAIN.Brush.hindrance;
CELL_HINDRANCE[MASK.orchard] = TERRAIN.Orchard.hindrance;
CELL_HINDRANCE[MASK.field] = TERRAIN.Field.hindrance;
CELL_HINDRANCE[MASK.marsh] = TERRAIN.Marsh.hindrance;
CELL_HINDRANCE[MASK.bridge] = TERRAIN.MajorBridge.hindrance;
/**
 * A LOS runs "along the railway depiction" in a hex if at least this share of its stretch there is on railway cells
 * (project ruling: a raster track is a cell or two wide, so "entirely" would depend on how the raster fell).
 */
const RAIL_ALONG = 0.6;

// Scratch per check (single-threaded): the path's hex intervals, marked with a generation number, and railway lengths.
const markGen = new Int32Array(NUM_HEXES);
const markT0 = new Float64Array(NUM_HEXES);
const markT1 = new Float64Array(NUM_HEXES);
const railLen = new Float64Array(NUM_HEXES);
const allLen = new Float64Array(NUM_HEXES);
let gen = 0;

/**
 * Mask pass: walks the cells the LOS crosses between the end hexes (exact grid traversal). A cell belongs to the hex its
 * centre lies in; it counts only for an intervening hex, and only where the LOS is inside that hex.
 */
function maskPass(map: MapDef, g: Geom, z: Heights, blockT: number, onBlock: (t: number, why: string) => void): number {
  const m = map.mask!;
  if (++gen > 0x3fffffff) {
    markGen.fill(0);
    gen = 1;
  }
  for (const st of g.steps) {
    for (const h of st.hexes) {
      markGen[h] = gen;
      markT0[h] = st.t0;
      markT1[h] = st.t1;
      railLen[h] = 0;
      allLen[h] = 0;
    }
  }
  let hind = 0;
  const res = m.res;
  const gx0 = (g.ax + g.tA * g.dx - m.x0) * res;
  const gy0 = (g.ay + g.tA * g.dy - m.y0) * res;
  const gdx = g.dx * res;
  const gdy = g.dy * res;
  let i = Math.floor(gx0);
  let j = Math.floor(gy0);
  const stepI = gdx > 0 ? 1 : -1;
  const stepJ = gdy > 0 ? 1 : -1;
  const deltaX = gdx !== 0 ? 1 / Math.abs(gdx) : Infinity;
  const deltaY = gdy !== 0 ? 1 / Math.abs(gdy) : Infinity;
  let maxX = gdx > 0 ? g.tA + (i + 1 - gx0) / gdx : gdx < 0 ? g.tA + (i - gx0) / gdx : Infinity;
  let maxY = gdy > 0 ? g.tA + (j + 1 - gy0) / gdy : gdy < 0 ? g.tA + (j - gy0) / gdy : Infinity;
  let t = g.tA;
  const end = g.tB;
  for (;;) {
    const next = Math.min(maxX, maxY, end);
    if (t >= blockT) break; // nothing later can block earlier
    if (next - t > 1e-12) {
      const owner = hexAt(m.x0 + (i + 0.5) / res, m.y0 + (j + 0.5) / res);
      // only intervening hexes are marked: cells of the end hexes never count
      if (owner !== null && markGen[owner] === gen) {
        const o0 = Math.max(t, markT0[owner]);
        const o1 = Math.min(next, markT1[owner]);
        if (o1 - o0 > 1e-12) {
          const inside = i >= 0 && i < m.width && j >= 0 && j < m.height;
          const cls = inside ? m.cls[j * m.width + i] : MASK.open;
          const lvl = inside ? m.level[j * m.width + i] : map.elevation[owner];
          allLen[owner] += o1 - o0;
          if (hillBlocks(z, lvl)) {
            onBlock(o0, `Hill level ${lvl} at ${label(owner)}`);
            blockT = Math.min(blockT, o0);
          } else if (cls === MASK.woods || cls === MASK.building) {
            if (obstacleBlocks(z, lvl, nearLow(z, owner))) {
              onBlock(o0, `${cls === MASK.woods ? 'Woods' : 'Building'} at ${label(owner)}`);
              blockT = Math.min(blockT, o0);
            }
          } else if (lvl >= z.hi) {
            if (cls === MASK.railway) railLen[owner] += o1 - o0;
            else hind = Math.max(hind, CELL_HINDRANCE[cls] ?? 0);
          }
        }
      }
    }
    if (next >= end) break;
    if (maxX < maxY) {
      i += stepI;
      t = maxX;
      maxX += deltaX;
    } else {
      j += stepJ;
      t = maxY;
      maxY += deltaY;
    }
  }
  for (const st of g.steps) {
    for (const h of st.hexes) {
      if (railLen[h] > 0 && railLen[h] < RAIL_ALONG * allLen[h]) hind = Math.max(hind, 1);
    }
  }
  return hind;
}

/**
 * Line of sight between the centre dots of `from` and `to` (§10). Reciprocal: losCheck(v, a, b) equals
 * losCheck(v, b, a). The hindrance is the largest single Hindrance on the LOS (Smoke in either end hex included), plus
 * a scenario's Fog when the view is a game (scenarioRules `fogHindrance`).
 */
export function losCheck(view: LosView, from: HexId, to: HexId): LosResult {
  const r = terrainLos(view, from, to);
  const fog = fogHindrance(view);
  return fog > 0 && r.clear ? { ...r, hindrance: r.hindrance + fog } : r;
}

/** losCheck without the Fog. */
function terrainLos(view: LosView, from: HexId, to: HexId): LosResult {
  const { map, smoke, blaze } = view;
  if (from === to) return { clear: true, hindrance: smoke[from] ?? 0, blockedBy: null };
  const a = Math.min(from, to);
  const b = Math.max(from, to);
  let hind = Math.max(smoke[a] ?? 0, smoke[b] ?? 0);
  // Adjacent hexes: nothing intervenes, their shared hexside is a side of both (ruling: also on hills without a crest).
  if (areAdjacent(a, b)) return { clear: true, hindrance: hind, blockedBy: null };
  const la = map.elevation[a];
  const lb = map.elevation[b];
  // T86: a Gully sees and is seen only from adjacent or higher hexes
  if (map.terrain[a] === 'Gully' && !(lb > la)) return blockedBy(`Gully at ${label(a)}`);
  if (map.terrain[b] === 'Gully' && !(la > lb)) return blockedBy(`Gully at ${label(b)}`);

  const g = geom(a, b);
  const z: Heights = { hi: Math.max(la, lb), lo: Math.min(la, lb), level: la === lb, low: la < lb ? a : la > lb ? b : -1 };
  let blockT = Infinity;
  let why: string | null = null;
  const block = (t: number, reason: string) => {
    if (t < blockT) {
      blockT = t;
      why = reason;
    }
  };

  // Intervening hexes: Blaze and Smoke always; whole-hex terrain when there is no mask.
  for (const st of g.steps) {
    for (const h of st.hexes) {
      if (blaze[h]) block(st.t0, `Blaze at ${label(h)}`);
      if (smoke[h] > hind) hind = smoke[h];
    }
    if (map.mask) continue;
    if (!st.along) {
      const h = st.hexes[0];
      const lvl = map.elevation[h];
      const info = TERRAIN[map.terrain[h]];
      const hindrance = hindranceOf(map, h);
      if (hillBlocks(z, lvl)) block(st.t0, `Hill level ${lvl} at ${label(h)}`);
      else if ((info.obstacle || hindrance > 0) && onCorridor(map, h, g, st)) continue;
      else if (info.obstacle) {
        if (obstacleBlocks(z, lvl, nearLow(z, h))) block(st.t0, `${info.name} at ${label(h)}`);
      } else if (lvl >= z.hi) hind = Math.max(hind, hindrance);
    } else if (st.hexes.length === 2) {
      // Along a hexside (no-mask fallback, project ruling): blocked only if both hexes block; the smaller hindrance.
      const [p, q] = st.hexes;
      const lp = map.elevation[p];
      const lq = map.elevation[q];
      const where = `${label(p)}|${label(q)}`;
      const lvl = Math.min(lp, lq);
      if (hillBlocks(z, lvl)) {
        block(st.t0, `Hill level ${lvl} along ${where}`);
        continue;
      }
      const ip = TERRAIN[map.terrain[p]];
      const iq = TERRAIN[map.terrain[q]];
      if (ip.obstacle && iq.obstacle && obstacleBlocks(z, lp, nearLow(z, p)) && obstacleBlocks(z, lq, nearLow(z, q))) {
        block(st.t0, `${ip.name === iq.name ? ip.name : `${ip.name}/${iq.name}`} along ${where}`);
        continue;
      }
      const hp = lp >= z.hi ? hindranceOf(map, p) : 0;
      const hq = lq >= z.hi ? hindranceOf(map, q) : 0;
      hind = Math.max(hind, Math.min(hp, hq));
    }
  }

  // Hexside features: crossed, run along, or passed through a corner with features on both sides of the LOS.
  for (const ev of g.sides) {
    if (ev.t >= blockT) break;
    let key: number;
    let s: number;
    let keys: number[];
    if (ev.kind === 'corner') {
      const sp = Math.max(...ev.keys.map((k) => strength(map.hexsides[k])));
      const so = Math.max(...ev.others.map((k) => strength(map.hexsides[k])));
      s = Math.min(sp, so);
      if (s === 0) continue;
      keys = [...ev.keys, ...ev.others].filter((k) => strength(map.hexsides[k]) > 0);
      key = Math.min(...keys.filter((k) => strength(map.hexsides[k]) === s));
    } else {
      key = ev.keys[0];
      s = strength(map.hexsides[key]);
      if (s === 0) continue;
      keys = ev.keys;
    }
    const e = Math.max(...keys.map((k) => sideLevel(map, k)));
    if (s === 2) {
      const near = keys.some((k) => hexesOf(k).some((h) => nearLow(z, h)));
      if (obstacleBlocks(z, e, near)) block(ev.t, `${map.hexsides[key]} ${sideLabel(key)}`);
    } else if (e >= z.hi) {
      hind = Math.max(hind, HEXSIDE.Fence.hindrance);
    }
  }

  if (map.mask) hind = Math.max(hind, maskPass(map, g, z, blockT, block));

  // T88.3.2: a higher hex is seen only if it is a Crest hex (looking up: the first of its level; looking down: the LOS
  // leaves the hill inside the viewer's own hex; the levels in between are checked above).
  if (why === null && !z.level) {
    const high = la > lb ? a : b;
    if (!map.crest[high]) why = `${label(high)} is not a crest hex`;
  }
  return why === null ? { clear: true, hindrance: hind, blockedBy: null } : blockedBy(why);
}

function blockedBy(why: string): LosResult {
  return { clear: false, hindrance: 0, blockedBy: why };
}

/**
 * The alternate Cover a Wall or Hedge gives units in `to` against a Fire Attack from `from` whose LOS crosses it as it
 * enters `to` (T87, T97; Bocage via `special`), 0 if none. A LOS entering through a corner of `to` crosses a feature only
 * if both sides of `to` at that corner have one, and gets the smaller Cover (project ruling). The caller applies the
 * Road −1 (R-20) and ignores it against Mortars and Artillery.
 */
export function hexsideCoverAgainst(map: MapDef, from: HexId, to: HexId, special?: SpecialRules): number {
  if (from === to) return 0;
  const g = geom(Math.min(from, to), Math.max(from, to));
  const keys = to > from ? g.entryB : g.entryA;
  if (keys.length === 0) return 0;
  let cover = Infinity;
  for (const k of keys) {
    const f = map.hexsides[k];
    cover = Math.min(cover, f === undefined ? 0 : hexsideInfo(f, special).cover);
  }
  return cover;
}
