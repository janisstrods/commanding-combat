// Move Orders: planning (which units to activate and where each group goes) and carrying a plan out step by step.
// Destinations are scored with the static evaluation on a working copy (cover, fields of fire, exposure, objectives),
// less the Op Fire risk along the least-risk path that fits the group's MP; the planner then plays the best plans
// through the real engine (Op Fire reactions and all) before choosing.
import { activationCandidates, commandRadius } from '../engine/activation';
import { distance, neighbours } from '../engine/hex';
import { moveAnswerError, moveAnswers } from '../engine/orders/move';
import { cloneState, isLeader, isUnit } from '../engine/state';
import type { Answer, Decision, GameState, HexId, Piece, PieceId, Side } from '../engine/types';
import { other } from '../engine/types';
import { evaluate, weightsFor, type Weights } from './evaluate';
import type { LevelCfg } from './levels';
import { fireOn, fitsStack, isFireAction, pHolds, reachable, sideShooters, stackLoss } from './tactics';
import { pieceValue } from './values';

export interface MovePlan {
  /** The activation: the first unit (a Leader brings the others), then the rest. */
  units: PieceId[];
  /** Final hex per unit that moves. */
  dest: Record<PieceId, HexId>;
  /** Path per moving unit (hexes entered, in order). */
  paths: Record<PieceId, HexId[]>;
  /** Static gain over not moving (evaluation points). */
  gain: number;
}

/**
 * The expected loss of `units` entering `hex` (all of them there) to Op Fire: the enemy's fire on the hex (no Ordnance,
 * only units not yet activated this Turn or already activated for Op Fire in this Move Order), times the chance he can
 * Op Fire at all (a Fire Action card in hand — from the unseen pool in a view — or units already activated for it).
 */
export function opFireRisk(s: GameState, me: Side): (work: GameState, units: Piece[], hex: HexId) => number {
  const opp = other(me);
  const t = s.turn;
  const ready = sideShooters(s, opp, true).filter((sh) => {
    const p = s.pieces[sh.id];
    const unit = p.where === 'carried' && p.carrier ? p.carrier : p.id;
    return !t.activated.includes(unit) || t.opFire.includes(unit);
  });
  const pCard = pHolds(s, opp, isFireAction);
  const activated = t.opFire.length > 0;
  const p = activated ? 1 : pCard;
  if (!ready.length || p <= 0) return () => 0;
  return (work, units, hex) => {
    const f = fireOn(work, ready, hex);
    if (!f.fp) return 0;
    const saved = units.map((u) => u.hex);
    for (const u of units) u.hex = hex;
    const loss = stackLoss(work, hex, me, f, true, units);
    units.forEach((u, i) => (u.hex = saved[i]));
    return p * loss;
  };
}

/** Units of `ids` grouped by hex (on the map only), larger groups first. */
function byHex(s: GameState, ids: PieceId[]): Piece[][] {
  const m = new Map<HexId, Piece[]>();
  for (const id of ids) {
    const p = s.pieces[id];
    if (!p || p.where !== 'map' || !isUnit(p)) continue;
    m.set(p.hex, [...(m.get(p.hex) ?? []), p]);
  }
  return [...m.values()].sort((a, b) => b.reduce((n, u) => n + pieceValue(s, u), 0) - a.reduce((n, u) => n + pieceValue(s, u), 0));
}

interface DestChoice {
  hex: HexId;
  path: HexId[];
  score: number;
  risk: number;
}

/** The best destinations for `group` (in `work`), each scored by evaluation − path risk; `stay` is the score now. */
function destinations(
  work: GameState, me: Side, group: Piece[], w: Weights, risk: ReturnType<typeof opFireRisk>, keep: number,
): { stay: number; best: DestChoice[] } {
  const ids = group.map((u) => u.id);
  const stay = evaluate(work, me, w, { hand: false });
  const reach = reachable(work, ids, (hex) => risk(work, group, hex));
  const start = group[0].hex;
  const out: DestChoice[] = [];
  for (const [hex, r] of reach) {
    if (hex === start || !fitsStack(work, hex, group, me)) continue;
    for (const u of group) u.hex = hex;
    const sc = evaluate(work, me, w, { hand: false }) - r.risk;
    for (const u of group) u.hex = start;
    out.push({ hex, path: r.path, score: sc, risk: r.risk });
  }
  out.sort((a, b) => b.score - a.score);
  return { stay, best: out.slice(0, keep) };
}

/**
 * Move plans for `me`: for the most promising first units (Leaders with the units in their Command radius, single
 * units), each hex group greedily gets its best destination (given the groups planned before it); variants swap the
 * main group's destination for its runners-up. Sorted by static gain.
 */
export function planMoves(s: GameState, me: Side, level: LevelCfg, patch?: Partial<Weights>): MovePlan[] {
  const firsts = activationCandidates(s, me, 'Move');
  if (!firsts.length) return [];
  const w = weightsFor(s, me, patch);
  const risk = opFireRisk(s, me);
  // order the first units: Leaders with many units in radius, then valuable units
  const prior = (id: PieceId) => {
    const p = s.pieces[id];
    return isLeader(p) ? 3 + commandRadius(s, p).length : pieceValue(s, p);
  };
  const tried = firsts.slice().sort((a, b) => prior(b) - prior(a)).slice(0, level.moveActs);
  const base = evaluate(s, me, w, { hand: false });
  const plans: MovePlan[] = [];
  for (const first of tried) {
    const p = s.pieces[first];
    const pool = isLeader(p) ? [first, ...commandRadius(s, p)] : [first];
    for (let variant = 0; variant < level.moveVariants; variant++) {
      const work = cloneState(s);
      const plan: MovePlan = { units: [first], dest: {}, paths: {}, gain: 0 };
      let totalRisk = 0;
      let moved = false;
      const groups = byHex(work, pool);
      groups.forEach((group, gi) => {
        const { stay, best } = destinations(work, me, group, w, risk, variant + 1);
        const pick = gi === 0 ? best[Math.min(variant, best.length - 1)] : best[0];
        if (!pick || pick.score <= stay + 0.05) return;
        for (const u of group) {
          u.hex = pick.hex;
          plan.dest[u.id] = pick.hex;
          plan.paths[u.id] = pick.path;
          if (u.id !== first) plan.units.push(u.id);
        }
        totalRisk += pick.risk;
        moved = true;
      });
      if (!moved) break;
      if (!isLeader(p) && plan.dest[first] === undefined) break;
      plan.gain = evaluate(work, me, w, { hand: false }) - base - totalRisk;
      const key = JSON.stringify(plan.dest);
      if (!plans.some((x) => JSON.stringify(x.dest) === key)) plans.push(plan);
    }
  }
  return plans.sort((a, b) => b.gain - a.gain);
}

/** The next hex for `ids` (in one hex) toward `dest`, following `path` when it can, or null. */
function nextStep(s: GameState, d: Extract<Decision, { kind: 'move' }>, ids: PieceId[], dest: HexId, path: HexId[] | undefined): HexId | null {
  const here = s.pieces[ids[0]].hex;
  if (here === dest) return null;
  const legal = (to: HexId) => !moveAnswerError(s, d, { kind: 'moveStep', units: ids, to });
  if (path?.length) {
    const i = path.indexOf(here);
    const next = i < 0 ? path[0] : path[i + 1];
    if (next !== undefined && distance(here, next) === 1 && legal(next)) return next;
  }
  // off the path: the legal neighbour nearest to the destination, if it gets nearer
  let best: HexId | null = null;
  let bd = distance(here, dest);
  for (const to of neighbours(here)) {
    const dd = distance(to, dest);
    if (dd < bd && legal(to)) {
      best = to;
      bd = dd;
    }
  }
  return best;
}

/**
 * Answer a 'move' decision from `plan` (dest/paths): the group moving now steps on toward its destination, else the next
 * planned group starts; 'done' when nothing planned is left. Without a plan (or when the plan cannot be carried out
 * and a move is required) a step toward the nearest Objective. Actions are judged by the caller first.
 */
export function moveAnswer(s: GameState, d: Extract<Decision, { kind: 'move' }>, plan: Pick<MovePlan, 'dest' | 'paths'> | null): Answer {
  const dest = plan?.dest ?? {};
  if (d.current) {
    const to = dest[d.current[0]];
    if (to !== undefined) {
      const step = nextStep(s, d, d.current, to, plan?.paths[d.current[0]]);
      if (step !== null) return { kind: 'moveStep', units: d.current, to: step };
    }
    return { kind: 'done' };
  }
  // the next group: startable units in one hex with the same destination
  const seen = new Set<PieceId>();
  for (const id of d.units) {
    if (seen.has(id)) continue;
    const to = dest[id];
    const p = s.pieces[id];
    if (to === undefined || to === p.hex) continue;
    const group = d.units.filter((x) => s.pieces[x].hex === p.hex && dest[x] === to);
    group.forEach((x) => seen.add(x));
    const step = nextStep(s, d, group, to, plan?.paths[id]);
    if (step !== null) return { kind: 'moveStep', units: group, to: step };
  }
  if (!d.mustMove) return { kind: 'done' };
  return fallbackStep(s, d);
}

/** A required step with no usable plan: the step that brings a unit nearest to an Objective (else any legal step). */
export function fallbackStep(s: GameState, d: Extract<Decision, { kind: 'move' }>): Answer {
  const all = moveAnswers(s, d).filter((a) => a.kind === 'moveStep');
  if (!all.length) return moveAnswers(s, d)[0] ?? { kind: 'done' };
  const objs = s.map.objectives;
  const near = (h: HexId) => Math.min(...objs.map((o) => distance(h, o)));
  let best = all[0];
  let bd = Infinity;
  for (const a of all) {
    if (a.kind !== 'moveStep') continue;
    const dd = near(a.to);
    if (dd < bd) {
      bd = dd;
      best = a;
    }
  }
  return best;
}
