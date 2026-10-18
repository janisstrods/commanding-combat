// Tactical estimates built on the engine's own rules (fire.ts shooter / attackFp, stats.ts currentStats / cover, los.ts
// losCheck, move costs): the expected effect of a Fire Attack, how much fire each side can bring on a hex, where a
// group can move, and melee odds. Approximations made for speed say so where they are made.
import { CARDS } from '../engine/data';
import { attackFp, enemyHexes, inRange, shooter, type Shooter } from '../engine/fire';
import { areAdjacent, distance, neighbours } from '../engine/hex';
import { losCheck } from '../engine/los';
import { mpLeft, stepCost } from '../engine/orders/move';
import { cover, currentStats, figures, stackLimit, unitFigures } from '../engine/stats';
import { hasUnitOf, isUnit, typeOf } from '../engine/state';
import { hasRoad } from '../engine/terrain';
import { type FireSpec, type GameState, type HexId, type Piece, type PieceId, type Side, UNKNOWN_CARD, other } from '../engine/types';
import { contestOdds, defenseOdds, pProductAbove } from './dice';
import { breakCost, pieceValue } from './values';

// ---------------------------------------------------------------------------------------------------------------------
// Units

/** `side`'s units on the map in `hex`. */
export function unitsAt(s: GameState, hex: HexId, side: Side): Piece[] {
  const out: Piece[] = [];
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.where === 'map' && p.hex === hex && p.side === side && isUnit(p)) out.push(p);
  }
  return out;
}

/** `side`'s units on the map. */
export function unitsOnMap(s: GameState, side: Side): Piece[] {
  const out: Piece[] = [];
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.where === 'map' && p.side === side && isUnit(p)) out.push(p);
  }
  return out;
}

/** Every piece of `side` that could fire now (units and carried Weapons), as engine Shooters. */
export function sideShooters(s: GameState, side: Side, opFire = false): Shooter[] {
  const out: Shooter[] = [];
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.side !== side) continue;
    if (p.where !== 'map' && p.where !== 'carried') continue;
    const sh = shooter(s, id, opFire);
    if (sh) out.push(sh);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// The effect of one Fire Attack

export interface FireMods {
  mode?: 'order' | 'opFire' | 'assault';
  /** FP added by Actions. */
  bonus?: number;
  /** Subtract from the Attack Total (Concealment). */
  reduction?: number;
  /** The rolled Attack Total, if known (then no dice for the attack). */
  total?: number;
  /** Treat the defenders as moving (ties break them). */
  moving?: boolean;
}

/** Height and hindrance of one shot as fire.ts computes them for a group (assumes a legal spec). */
function specParts(s: GameState, spec: FireSpec): { fp: number; ordnance: Shooter | null; mortar: boolean; ignoresCover: boolean } {
  const shooters = spec.pieces.map((id) => shooter(s, id)).filter((x): x is Shooter => !!x);
  const ordnance = shooters.length === 1 && shooters[0].ordnance ? shooters[0] : null;
  return {
    fp: attackFp(s, spec.pieces, [spec.target]).fp,
    ordnance,
    mortar: !!ordnance && ordnance.type.weaponClass === 'mortar',
    ignoresCover: shooters.some((x) => !!x.type.ignoresCover),
  };
}

/** P(an Ordnance shot from `sh` hits `target`) — Targeting: product − Hindrance > range (§O20.2). */
export function pTargetingHit(s: GameState, sh: Shooter, target: HexId): number {
  const hind = losCheck(s, sh.hex, target).hindrance;
  return pProductAbove(distance(sh.hex, target) + hind);
}

/**
 * The expected worth (to the firing side) of a Fire Attack `spec` by `side`: for every defender, P(break) × what its
 * side loses by it, P(tie) × suppression (or a break when moving). Linear in the defenders, so it is exact for the
 * shared Attack Roll too. Ordnance multiplies by its Targeting chance.
 */
export function fireEV(s: GameState, side: Side, spec: FireSpec, mods: FireMods = {}): number {
  const parts = specParts(s, spec);
  const fp = parts.fp + (mods.bonus ?? 0);
  if (fp < 1 && mods.total === undefined) return 0;
  const airburst = parts.mortar && s.map.terrain[spec.target] === 'Woods' ? 2 : 0;
  const firers = spec.pieces.map((id) => {
    const p = s.pieces[id];
    return p.where === 'carried' && p.carrier ? s.pieces[p.carrier].hex : p.hex;
  });
  const moving = mods.moving ?? false;
  let ev = 0;
  for (const d of unitsAt(s, spec.target, other(side))) {
    const m = currentStats(s, d.id).morale + cover(s, d.id, { firers, mortarOrArtillery: parts.mortar, ignoresCover: parts.ignoresCover });
    let brk: number;
    let tie: number;
    if (mods.total !== undefined) {
      // a known total: P(m + 2d6 < total') and P(= total')
      const t = mods.total - (mods.reduction ?? 0);
      ({ brk, tie } = knownTotalOdds(t, m));
    } else ({ brk, tie } = defenseOdds(fp + airburst - (mods.reduction ?? 0), m));
    const isMoving = moving || s.turn.moving.includes(d.id);
    const cost = breakCost(s, d);
    ev += brk * cost + tie * (isMoving ? cost : suppressCost(s, d));
  }
  if (parts.ordnance && mods.total === undefined) ev *= pTargetingHit(s, parts.ordnance, spec.target);
  return ev;
}

/** P(defense m + 2d6 < t) and P(= t). */
export function knownTotalOdds(t: number, m: number): { brk: number; tie: number } {
  let brk = 0;
  let tie = 0;
  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) {
      const d = m + a + b;
      if (d < t) brk += 1 / 36;
      else if (d === t) tie += 1 / 36;
    }
  }
  return { brk, tie };
}

/** Worth lost when unit `p` is Suppressed. */
export function suppressCost(s: GameState, p: Piece): number {
  if (p.suppressed) return 0;
  return pieceValue(s, p) * (p.broken ? 0.04 : 0.12);
}

// ---------------------------------------------------------------------------------------------------------------------
// How much fire a side can bring on a hex (exposure / threat)

export interface HexFire {
  /** Estimated FP of the best Fire Group (without Ordnance), or 0. */
  fp: number;
  /** Hex of its best shooter (for Wall / Hedge Cover), or -1. */
  from: HexId;
  /** Best Ordnance: FP and Targeting chance. */
  ordFp: number;
  ordHit: number;
  ordMortar: boolean;
}

const NO_FIRE: HexFire = { fp: 0, from: -1, ordFp: 0, ordHit: 0, ordMortar: false };

/**
 * The fire `shooters` can bring on `hex` — an approximation of attackFp for speed: the best single shot after
 * Hindrance and height, +1 for every other shooter that sees the hex from the same or an adjacent hex (a Fire Group
 * needs a chain of adjacent hexes; only the best shooter's neighbours are counted), capped at +3.
 */
export function fireOn(s: GameState, shooters: readonly Shooter[], hex: HexId): HexFire {
  let best = -99;
  let bestSh: Shooter | null = null;
  let ordFp = 0;
  let ordHit = 0;
  let ordMortar = false;
  const ok: Shooter[] = [];
  const el = s.map.elevation;
  for (const sh of shooters) {
    if (!inRange(sh, hex)) continue;
    const l = losCheck(s, sh.hex, hex);
    if (!l.clear) continue;
    if (sh.ordnance) {
      const hit = pProductAbove(distance(sh.hex, hex) + l.hindrance);
      if (sh.fp * hit > ordFp * ordHit) {
        ordFp = sh.fp;
        ordHit = hit;
        ordMortar = sh.type.weaponClass === 'mortar';
      }
      continue;
    }
    const h = el[hex] > el[sh.hex] ? -1 : el[hex] < el[sh.hex] ? 1 : 0;
    const eff = sh.fp - l.hindrance + h;
    ok.push(sh);
    if (eff > best) {
      best = eff;
      bestSh = sh;
    }
  }
  if (!bestSh && !ordFp) return NO_FIRE;
  let group = 0;
  if (bestSh) for (const sh of ok) if (sh !== bestSh && (sh.hex === bestSh.hex || areAdjacent(sh.hex, bestSh.hex))) group++;
  const from = bestSh ? bestSh.hex : -1;
  return { fp: from >= 0 ? Math.max(0, best + Math.min(3, group)) : 0, from, ordFp, ordHit, ordMortar };
}

/**
 * Expected loss of `side`'s units in `hex` (worth plus VP when they die) under the fire `f`; `moving` counts ties as
 * breaks. Uses the better of the group shot and the Ordnance shot.
 */
export function stackLoss(s: GameState, hex: HexId, side: Side, f: HexFire, moving = false, units?: Piece[]): number {
  if (!f.fp && !f.ordFp) return 0;
  let small = 0;
  let ord = 0;
  for (const u of units ?? unitsAt(s, hex, side)) {
    const base = currentStats(s, u.id).morale;
    const cost = breakCost(s, u);
    if (f.fp) {
      const m = base + cover(s, u.id, f.from >= 0 ? { firers: [f.from] } : {});
      const o = defenseOdds(f.fp, m);
      small += o.brk * cost + o.tie * (moving ? cost : suppressCost(s, u));
    }
    if (f.ordFp) {
      const m = base + cover(s, u.id, { mortarOrArtillery: f.ordMortar });
      const o = defenseOdds(f.ordFp + (f.ordMortar && s.map.terrain[hex] === 'Woods' ? 2 : 0), m);
      ord += f.ordHit * (o.brk * cost + o.tie * (moving ? cost : suppressCost(s, u)));
    }
  }
  return Math.max(small, ord);
}

// ---------------------------------------------------------------------------------------------------------------------
// Cards the AI may or may not know

/**
 * P(`side` holds at least one card matching `pred` now). In a redacted view of the opponent's hand this is computed from
 * the unseen pool (hypergeometric); otherwise (own hand, or a determinised state in a simulation) it is read off the hand.
 */
export function pHolds(s: GameState, side: Side, pred: (card: string) => boolean): number {
  const hand = s.players[side].hand;
  const known = hand.filter((c) => c !== UNKNOWN_CARD);
  if (known.some(pred)) return 1;
  const unknown = hand.length - known.length;
  if (!unknown) return 0;
  const pool = s.unseen?.cards[side] ?? [];
  const n = pool.length;
  if (!n) return 0;
  const k = pool.filter(pred).length;
  // P(none of `unknown` cards drawn from n match) = C(n-k, h) / C(n, h)
  let none = 1;
  for (let i = 0; i < unknown; i++) none *= Math.max(0, n - k - i) / (n - i);
  return 1 - none;
}

export const isFireAction = (c: string) => !!CARDS[c]?.fireIsAction;

// ---------------------------------------------------------------------------------------------------------------------
// Movement

export interface Reach {
  /** MP spent to get there (half-MP units for Snow, as numbers). */
  cost: number;
  /** Op Fire risk accumulated along the path (expected loss). */
  risk: number;
  /** The path from the start (excluded) to this hex (included). */
  path: HexId[];
}

/**
 * The hexes the group `ids` (all in one hex) can reach with its MP this Move Order (Road bonus included), avoiding enemy
 * hexes, each with the least-risk path that fits the MP: a small resource-constrained search over (hex, MP spent,
 * road). `risk(hex)` is the expected loss of entering `hex`. Wire, Mines and stacking along the way are ignored (a
 * planning approximation; the engine plays the real move).
 */
export function reachable(s: GameState, ids: PieceId[], risk: (hex: HexId) => number, fresh = true): Map<HexId, Reach> {
  const side = s.pieces[ids[0]].side;
  const start = s.pieces[ids[0]].hex;
  const m = fresh ? null : s.turn.move;
  const mp = Math.min(...ids.map((id) => mpLeft(s, id, m)));
  const roadStart = !!m && ids.every((id) => m.road.includes(id));
  const out = new Map<HexId, Reach>();
  out.set(start, { cost: 0, risk: 0, path: [] });
  if (mp <= 0) return out;
  // label per (hex, road): list of non-dominated (cost, risk) entries
  type Label = { hex: HexId; cost: number; risk: number; road: boolean; path: HexId[] };
  const best = new Map<string, Label[]>();
  const dominated = (l: Label) => {
    const list = best.get(`${l.hex}:${l.road ? 1 : 0}`);
    if (!list) return false;
    return list.some((x) => x.cost <= l.cost + 1e-9 && x.risk <= l.risk + 1e-9);
  };
  const add = (l: Label) => {
    const key = `${l.hex}:${l.road ? 1 : 0}`;
    const list = (best.get(key) ?? []).filter((x) => !(l.cost <= x.cost && l.risk <= x.risk));
    list.push(l);
    best.set(key, list);
  };
  const queue: Label[] = [{ hex: start, cost: 0, risk: 0, road: roadStart, path: [] }];
  add(queue[0]);
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const cur = queue.shift()!;
    const cap = mp + (cur.road && !roadStart ? 1 : 0);
    for (const to of neighbours(cur.hex)) {
      if (hasUnitOf(s, to, other(side))) continue;
      const c = stepCost(s, cur.hex, to);
      if (c === null) continue;
      const road = cur.road || hasRoad(s.map, to);
      const cost = cur.cost + c;
      const limit = mp + (road && !roadStart ? 1 : 0);
      if (cost > limit + 1e-9 || cost > cap + 1 + 1e-9) continue;
      const l: Label = { hex: to, cost, risk: cur.risk + risk(to), road, path: [...cur.path, to] };
      if (dominated(l)) continue;
      add(l);
      queue.push(l);
      const r = out.get(to);
      if (!r || l.risk < r.risk - 1e-9 || (Math.abs(l.risk - r.risk) < 1e-9 && l.cost < r.cost)) out.set(to, { cost: l.cost, risk: l.risk, path: l.path });
    }
  }
  return out;
}

/** May `units` (of one side) end their move in `hex` without overstacking it? */
export function fitsStack(s: GameState, hex: HexId, units: Piece[], side: Side): boolean {
  const here = figures(s, hex, side) - units.filter((u) => u.where === 'map' && u.hex === hex).reduce((n, u) => n + unitFigures(u), 0);
  return here + units.reduce((n, u) => n + unitFigures(u), 0) <= stackLimit(s, hex);
}

// ---------------------------------------------------------------------------------------------------------------------
// Melee

/** Melee FP of units (§O16.4.1): current FP, +1 per unit with boxed FP; Weapons excluded. */
export function meleeStrength(s: GameState, units: Piece[]): number {
  let n = 0;
  for (const u of units) {
    n += Math.max(0, currentStats(s, u.id).fp);
    const t = typeOf(u);
    if ((u.broken ? t.broken : t.front).boxed.fp) n += 1;
  }
  return n;
}

/** P(`a` wins a melee against `b`) with ties as half (both die). */
export function meleeWinChance(s: GameState, a: Piece[], b: Piece[]): number {
  const o = contestOdds(meleeStrength(s, a), meleeStrength(s, b));
  return o.win + 0.5 * o.tie;
}

/** Enemy unit hexes nearest to `hex` (distance), or 99. */
export function nearestEnemy(s: GameState, hex: HexId, side: Side): number {
  let d = 99;
  for (const h of enemyHexes(s, side)) d = Math.min(d, distance(hex, h));
  return d;
}
