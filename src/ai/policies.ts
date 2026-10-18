// The AI's answers to every decision except its own Turn choice (planner.ts) and deployment (deploy.ts): activations,
// Fire Attacks, Move steps, Advances, reactions with Actions (Op Fire and the rest), Initiative re-rolls and the
// generic choices. They are quick expected-value rules; the same functions answer for the opponent's stand-in inside
// the planner's simulations (`cheap`), so plans are tested against sensible reactions.
import { activationError, commandRadius } from '../engine/activation';
import { answerError } from '../engine/decisions';
import { CARDS } from '../engine/data';
import { attackFp, fireOptions, inRange, shooter } from '../engine/fire';
import { distance, neighbours } from '../engine/hex';
import { losCheck } from '../engine/los';
import { nightPenalty } from '../engine/scenarioRules';
import { smokeOptions } from '../engine/orders/fire';
import { cover, currentStats, hexCover } from '../engine/stats';
import { isLeader, isUnit, radioOf, typeOf } from '../engine/state';
import {
  type ActionOption, type Answer, type CardId, type Decision, type FireSpec, type GameState, type HexId, type OrderName, type PieceId, type Side,
  other,
} from '../engine/types';
import { actionValue, cardCost, cardCtx, keepValue, weakestFirst, type CardCtx } from './cards';
import { chooseAnswer as chooseItems, itemScores, safety } from './choose';
import { deployAnswer, type DeployMemo } from './deploy';
import { SUM, contestOdds, pSumBelow } from './dice';
import { projectedMargin } from './evaluate';
import type { LevelCfg } from './levels';
import { holdsFixedWeapon, moveAnswer, planMoves } from './moves';
import type { Rng } from './rand';
import { safeAnswer } from './sim';
import { fireEV, fireOn, knownTotalOdds, meleeStrength, meleeWinChance, sideShooters, stackLoss, suppressCost, unitsAt, unitsOnMap } from './tactics';
import { breakCost, breakLoss, pieceValue, typeValue } from './values';

/** What the AI means to do with the Order it is giving (planner.ts makes it; the sub-decisions follow it). */
export interface Plan {
  /** Turn number and Orders given when it was made (it applies to that Order only). */
  turn: number;
  given: number;
  card: CardId;
  order: OrderName;
  /** The activation (first unit first), when the Order activates units. */
  units?: PieceId[];
  /** Recover / Rout: the player to activate. */
  player?: Side;
  /** Move: final hex and path per moving unit. */
  dest?: Record<PieceId, HexId>;
  paths?: Record<PieceId, HexId[]>;
  /** Advance: where each unit goes. */
  advance?: Record<PieceId, HexId | 'exit'>;
  label: string;
}

export interface PolicyCtx {
  me: Side;
  level: LevelCfg;
  rng: Rng;
  plan: Plan | null;
  /** The opponent's stand-in inside a simulation (quicker, no plan). */
  cheap: boolean;
  /** The Fire Attack the AI chose last (for its Initiative re-roll judgement). */
  lastFire: { pieces: PieceId[]; target: HexId; turn: number } | null;
  /** The hex the AI means to Op Fire at, after playing a Fire card to activate units for it. */
  opFireHex: HexId | null;
  deploy: DeployMemo | null;
  /** quickTurn also considers Move Orders (planMoves; too slow inside simulations, used by the 'greedy' baseline). */
  quickMoves?: boolean;
}

export function newPolicyCtx(me: Side, level: LevelCfg, rng: Rng, cheap = false): PolicyCtx {
  return { me, level, rng, plan: null, cheap, lastFire: null, opFireHex: null, deploy: null };
}

/** The AI's answer to `d` (any kind but its own 'turn', which planner.ts answers; a quick rule stands in for it here). */
export function policyAnswer(s: GameState, d: Decision, pc: PolicyCtx): Answer {
  switch (d.kind) {
    case 'turn':
      return quickTurn(s, d, pc);
    case 'activate':
      return activateAnswer(s, d, pc);
    case 'fire':
      return fireAnswer(s, d, pc);
    case 'move':
      return moveDecision(s, d, pc);
    case 'advance':
      return advanceAnswer(s, d, pc);
    case 'react':
      return reactAnswer(s, d, pc);
    case 'reroll':
      return { kind: 'reroll', yes: pc.level.reroll && !pc.cheap ? rerollWanted(s, d, pc) : false };
    case 'choose':
      return { kind: 'choose', items: chooseItems(s, d, pc.me) };
    case 'deploy':
      return deployAnswer(s, d, pc);
    default:
      return safeAnswer(s, d, () => pc.rng.next());
  }
}

const planFor = (s: GameState, pc: PolicyCtx, card?: CardId): Plan | null => {
  const p = pc.plan;
  if (!p || p.turn !== s.turn.number || s.active !== pc.me || s.turn.ordersGiven !== p.given + 1) return null;
  if (card !== undefined && p.card !== card) return null;
  return p;
};

// ---------------------------------------------------------------------------------------------------------------------
// The Turn, when no planner runs (the opponent inside a simulation, Elite's look-ahead)

/** A greedy Turn: the best Fire activation if it is worth its card, else end / pass discarding weak cards. */
export function quickTurn(s: GameState, d: Extract<Decision, { kind: 'turn' }>, pc: PolicyCtx): Answer {
  const me = d.side;
  const cc = cardCtx(s, me);
  const fire = d.orders.filter((o) => o.order === 'Fire');
  if (fire.length) {
    const best = bestFireActivation(s, me);
    const card = cheapest(fire.map((o) => o.card), cc);
    if (best && best.ev > cardCost(s, me, card, cc) + 0.25) {
      pc.plan = { turn: s.turn.number, given: s.turn.ordersGiven, card, order: 'Fire', units: best.units, label: 'quick fire' };
      return { kind: 'order', card, order: 'Fire' };
    }
  }
  const move = d.orders.filter((o) => o.order === 'Move');
  if (pc.quickMoves && move.length) {
    const best = planMoves(s, me, pc.level)[0];
    const card = cheapest(move.map((o) => o.card), cc);
    if (best && best.gain > cardCost(s, me, card, cc) + 0.2) {
      pc.plan = { turn: s.turn.number, given: s.turn.ordersGiven, card, order: 'Move', units: best.units, dest: best.dest, paths: best.paths, label: 'quick move' };
      return { kind: 'order', card, order: 'Move' };
    }
  }
  const recover = d.orders.find((o) => o.order === 'Recover');
  if (recover && unitsOnMap(s, me).filter((u) => u.broken).length >= 2) return { kind: 'order', card: recover.card, order: 'Recover' };
  if (!d.canPass) return { kind: 'endTurn' };
  // a pass discards at least one card: two players passing with full hands would stall the game for ever
  const order = weakestFirst(s, me, cc);
  const weak = order.filter((c) => keepValue(c, cc) < 0.6).slice(0, d.maxDiscard);
  if (!weak.length && d.maxDiscard > 0 && order.length) weak.push(order[0]);
  return { kind: 'pass', discard: weak };
}

/** Of `cards` (all able to give the same Order), the one whose other uses are worth least. */
export function cheapest(cards: CardId[], cc: CardCtx): CardId {
  let best = cards[0];
  let bv = Infinity;
  for (const c of cards) {
    const f = CARDS[c];
    const v = f ? actionWorth(c, cc) : 0;
    if (v < bv) {
      bv = v;
      best = c;
    }
  }
  return best;
}

/** Worth of a card's Action side alone (what is lost when it gives its Order). */
function actionWorth(c: CardId, cc: CardCtx): number {
  const f = CARDS[c];
  if (!f) return 0;
  let a = actionValue(f.action, cc, f.defenderOnly);
  if (f.fireIsAction) a = Math.max(a, actionValue('Fire', cc));
  return a;
}

// ---------------------------------------------------------------------------------------------------------------------
// Activation

/** The greedy worth of activating `units` for a Fire Order: attacks picked one by one by expected worth. */
export function fireActivationEV(s: GameState, side: Side, units: PieceId[]): number {
  const pool: PieceId[] = [];
  for (const id of units) {
    const p = s.pieces[id];
    if (!p || p.where !== 'map') continue;
    pool.push(id);
    if (p.weapon) pool.push(p.weapon);
  }
  let total = 0;
  let left = pool.slice();
  for (let i = 0; i < 4 && left.length; i++) {
    const b = bestSpec(s, side, left, 'order');
    if (!b || b.ev <= 0.02) break;
    total += b.ev * (i === 0 ? 1 : 0.9);
    left = left.filter((id) => !b.spec.pieces.includes(id));
  }
  return total;
}

/** Fire activations for `side`: each first unit that can be activated (Leaders with their radius units that can shoot). */
export function fireActivations(s: GameState, side: Side, firsts: PieceId[]): { units: PieceId[]; ev: number }[] {
  const out: { units: PieceId[]; ev: number }[] = [];
  for (const id of firsts) {
    const p = s.pieces[id];
    let units = [id];
    if (isLeader(p)) {
      const r = commandRadius(s, p).filter((u) => canShootAny(s, u));
      units = [id, ...r];
    }
    out.push({ units, ev: fireActivationEV(s, side, units) });
  }
  return out.sort((a, b) => b.ev - a.ev);
}

function canShootAny(s: GameState, unit: PieceId): boolean {
  const p = s.pieces[unit];
  const pieces = p.weapon ? [unit, p.weapon] : [unit];
  return fireOptions(s, pieces).size > 0;
}

export function bestFireActivation(s: GameState, side: Side): { units: PieceId[]; ev: number } | null {
  const firsts: PieceId[] = [];
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.side === side && p.where === 'map' && isUnit(p) && !s.turn.activated.includes(id)) firsts.push(id);
  }
  const acts = fireActivations(s, side, firsts).filter((a) => !activationError(s, { kind: 'activate', side, order: 'Fire', card: '', units: a.units }, a.units));
  return acts[0] ?? null;
}

function activateAnswer(s: GameState, d: Extract<Decision, { kind: 'activate' }>, pc: PolicyCtx): Answer {
  const ok = (units: PieceId[]) => !activationError(s, d, units);
  if (d.order === 'Op Fire') {
    const hex = pc.opFireHex;
    let best: PieceId[] | null = null;
    let bv = -1;
    for (const id of d.units) {
      const p = s.pieces[id];
      const units = isLeader(p) ? [id, ...commandRadius(s, p).filter((u) => canShootAny(s, u))] : [id];
      if (!ok(units)) continue;
      const pieces = units.flatMap((u) => (s.pieces[u].weapon ? [u, s.pieces[u].weapon!] : [u]));
      let v = 0;
      if (hex !== null) {
        for (const spec of [...fireOptions(s, pieces, 'opFire', hex).values()].flat()) v = Math.max(v, fireEV(s, d.side, spec, { mode: 'opFire', moving: true }));
      }
      v += 0.05 * units.length;
      if (v > bv) {
        bv = v;
        best = units;
      }
    }
    if (best) return { kind: 'activate', units: best };
  }
  if (d.players?.length) {
    const plan = planFor(s, pc, d.card);
    const want = plan?.player ?? (d.order === 'Rout' ? other(d.side) : d.side);
    if (!d.units.length || d.order === 'Recover' || d.order === 'Rout') {
      return { kind: 'activatePlayer', player: d.players.includes(want) ? want : d.players[0] };
    }
  }
  const plan = planFor(s, pc, d.card);
  if (plan?.units?.length && ok(plan.units)) return { kind: 'activate', units: plan.units };
  if (d.order === 'Fire') {
    const acts = fireActivations(s, d.side, d.units).filter((a) => ok(a.units));
    if (acts.length) return { kind: 'activate', units: acts[0].units };
  }
  if (d.order === 'Artillery Request') {
    const spotter = bestSpotter(s, d.side, d.units);
    if (spotter && ok([spotter])) return { kind: 'activate', units: [spotter] };
  }
  if (d.order === 'Advance') {
    // the unit (with its Leader's radius) next to the weakest enemy hex
    let best: PieceId[] | null = null;
    let bv = -Infinity;
    for (const id of d.units) {
      const p = s.pieces[id];
      const units = isLeader(p) ? [id, ...commandRadius(s, p)] : [id];
      if (!ok(units)) continue;
      const v = units.reduce((n, u) => n + (enemyAdjacent(s, u) ? 1 : 0), 0) + 0.01 * units.length;
      if (v > bv) {
        bv = v;
        best = units;
      }
    }
    if (best) return { kind: 'activate', units: best };
  }
  for (const id of d.units) {
    const p = s.pieces[id];
    const full = isLeader(p) ? [id, ...commandRadius(s, p)] : [id];
    if (ok(full)) return { kind: 'activate', units: full };
    if (ok([id])) return { kind: 'activate', units: [id] };
  }
  return { kind: 'activate', units: [d.units[0]] };
}

function enemyAdjacent(s: GameState, id: PieceId): boolean {
  const p = s.pieces[id];
  return neighbours(p.hex).some((h) => unitsAt(s, h, other(p.side)).length > 0);
}

/** The Spotter with the best target in his LOS (enemy worth around it, own units kept clear). */
export function bestSpotter(s: GameState, side: Side, candidates: PieceId[]): PieceId | null {
  let best: PieceId | null = null;
  let bv = -Infinity;
  for (const id of candidates) {
    const from = s.pieces[id]?.hex;
    if (from === undefined || from < 0) continue;
    let v = 0;
    for (const h of enemyStackHexes(s, side)) if (losCheck(s, from, h).clear) v = Math.max(v, srWorth(s, side, h));
    if (v > bv) {
      bv = v;
      best = id;
    }
  }
  return best;
}

function enemyStackHexes(s: GameState, side: Side): HexId[] {
  return [...new Set(unitsOnMap(s, other(side)).map((u) => u.hex))];
}

/** Worth of a Spotting Round aimed at `h` (enemy worth in the blast, own units nearby against it). */
export function srWorth(s: GameState, side: Side, h: HexId): number {
  const d: Extract<Decision, { kind: 'choose' }> = { kind: 'choose', side, reason: 'spotterSR', items: [{ hex: h }], min: 1, max: 1 };
  return itemScores(s, d, side)[0];
}

// ---------------------------------------------------------------------------------------------------------------------
// Fire

/** The best Fire Attack among `pool` by expected worth, less the worth of what the pieces could do elsewhere. */
export function bestSpec(
  s: GameState, side: Side, pool: PieceId[], mode: 'order' | 'opFire' | 'assault', target?: HexId,
): { spec: FireSpec; ev: number } | null {
  const opts = [...fireOptions(s, pool, mode, target).values()].flat();
  if (!opts.length) return null;
  const evs = opts.map((spec) => ({ spec, ev: fireEV(s, side, spec, { mode, moving: mode === 'opFire' }) }));
  // what each piece could do alone at another target
  const alone = new Map<PieceId, number>();
  for (const x of evs) {
    if (x.spec.pieces.length !== 1) continue;
    const id = x.spec.pieces[0];
    alone.set(id, Math.max(alone.get(id) ?? 0, x.ev));
  }
  let best: { spec: FireSpec; ev: number; score: number } | null = null;
  for (const x of evs) {
    let opp = 0;
    if (target === undefined && x.spec.pieces.length > 1) {
      for (const id of x.spec.pieces) {
        const other = evs.filter((y) => y.spec.pieces.length === 1 && y.spec.pieces[0] === id && y.spec.target !== x.spec.target);
        opp += 0.5 * Math.max(0, ...other.map((y) => y.ev));
      }
    }
    const score = x.ev - opp;
    if (!best || score > best.score) best = { ...x, score };
  }
  return best ? { spec: best.spec, ev: best.ev } : null;
}

/** Op Fire is worth its one attack per hex entry above this expected worth. */
const OP_FIRE_MIN = 0.06;

function fireAnswer(s: GameState, d: Extract<Decision, { kind: 'fire' }>, pc: PolicyCtx): Answer {
  const b = bestSpec(s, d.side, d.pieces, d.mode, d.target);
  // having chosen to Op Fire at this hex (reactAnswer), fire: answering 'done' would only reopen the window
  const committed = d.mode === 'opFire' && d.target !== undefined && pc.opFireHex === d.target;
  if (d.mode === 'opFire') pc.opFireHex = null;
  const threshold = d.mode === 'opFire' ? OP_FIRE_MIN : 0.03;
  if (b && (b.ev > threshold || d.mustFire || committed)) {
    pc.lastFire = { pieces: b.spec.pieces.slice(), target: b.spec.target, turn: s.turn.number };
    return { kind: 'fire', spec: b.spec };
  }
  if (d.mustFire || (!b && d.mode === 'order')) {
    const smoke = bestSmoke(s, d.side, d.pieces);
    if (smoke && (d.mustFire || smoke.v > 0.4)) return { kind: 'fire', spec: smoke.spec };
  }
  if (d.mustFire && b) return { kind: 'fire', spec: b.spec };
  return { kind: 'done' };
}

/** The best Smoke round: on the enemy hex that pours most fire on our units (Smoke hinders out of its hex too). */
function bestSmoke(s: GameState, side: Side, pool: PieceId[]): { spec: FireSpec; v: number } | null {
  const opts = smokeOptions(s, pool, 'order');
  if (!opts.length) return null;
  const enemy = sideShooters(s, other(side));
  const mine = unitsOnMap(s, side);
  const worth = new Map<HexId, number>();
  for (const sh of enemy) {
    let v = 0;
    for (const u of mine) if (inRange(sh, u.hex) && losCheck(s, sh.hex, u.hex).clear) v += 0.1 * sh.fp * pieceValue(s, u) / 10;
    worth.set(sh.hex, (worth.get(sh.hex) ?? 0) + v);
  }
  let best: { spec: FireSpec; v: number } | null = null;
  for (const spec of opts) {
    let v = worth.get(spec.target) ?? 0;
    // smoke next to our own exposed stacks screens them too
    for (const u of mine) if (u.hex === spec.target) v += 0.2 * pieceValue(s, u);
    if (!best || v > best.v) best = { spec, v };
  }
  return best;
}

// ---------------------------------------------------------------------------------------------------------------------
// Move (with the 'duringMove' Actions: Assault Fire, Smoke Grenades)

function moveDecision(s: GameState, d: Extract<Decision, { kind: 'move' }>, pc: PolicyCtx): Answer {
  const plan = planFor(s, pc);
  const a = moveAnswer(s, d, plan && plan.dest ? { dest: plan.dest, paths: plan.paths ?? {} } : null);
  if (d.actions?.length) {
    const act = duringMoveAction(s, d, a, pc);
    if (act) return act;
  }
  return a;
}

/** Play Assault Fire once the moving is done (or Smoke Grenades before a risky step) when worth its card. */
function duringMoveAction(s: GameState, d: Extract<Decision, { kind: 'move' }>, next: Answer, pc: PolicyCtx): Answer | null {
  const cc = cardCtx(s, d.side);
  let best: { a: Answer; v: number } | null = null;
  d.actions!.forEach((o, option) => {
    const cost = o.card ? cardCost(s, d.side, o.card, cc) : 0;
    if (o.action === 'Assault Fire' && next.kind === 'done') {
      const pool = s.turn.moving.flatMap((id) => (s.pieces[id]?.weapon ? [id, s.pieces[id].weapon!] : [id])).filter((id) => s.pieces[id]);
      const b = bestSpec(s, d.side, pool, 'assault');
      const v = (b?.ev ?? 0) - cost;
      const a: Answer = { kind: 'play', option };
      if (v > 0.15 && !answerError(s, d, a) && (!best || v > best.v)) best = { a, v };
    }
    if (o.action === 'Smoke Grenades' && next.kind === 'moveStep' && o.targets?.hexes?.length) {
      // screen the hex about to be entered, if the enemy can pour fire on it
      const to = next.to;
      const f = fireOn(s, sideShooters(s, other(d.side), true), to);
      if (f.fp <= 0) return;
      const units = next.units.map((id) => s.pieces[id]);
      const saved = units.map((u) => u.hex);
      units.forEach((u) => (u.hex = to));
      const loss = stackLoss(s, to, d.side, f, true, units);
      const less = stackLoss(s, to, d.side, { ...f, fp: Math.max(0, f.fp - 2) }, true, units);
      units.forEach((u, i) => (u.hex = saved[i]));
      const hex = o.targets.hexes.includes(to) ? to : o.targets.hexes[0];
      const v = 0.6 * (loss - less) - cost;
      const a: Answer = { kind: 'play', option, targets: { hexes: [hex] } };
      if (v > 0.1 && !answerError(s, d, a) && (!best || v > best.v)) best = { a, v };
    }
  });
  if (best && pc.level.sloppy && pc.rng.chance(pc.level.sloppy)) return null;
  return best ? (best as { a: Answer }).a : null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Advance

function advanceAnswer(s: GameState, d: Extract<Decision, { kind: 'advance' }>, pc: PolicyCtx): Answer {
  const plan = planFor(s, pc);
  const legal = (a: Answer) => !answerError(s, d, a);
  if (plan?.advance) {
    for (const id of d.units) {
      const to = plan.advance[id];
      if (to === undefined) continue;
      const a: Answer = to === 'exit' ? { kind: 'exit', units: [id] } : { kind: 'advanceTo', unit: id, to };
      if (legal(a)) return a;
    }
    if (!d.mustAdvance) return { kind: 'done' };
  }
  const best = bestAdvance(s, d.side, d.units, legal);
  if (best && (best.v > 0.1 || d.mustAdvance)) return best.a;
  return d.mustAdvance && best ? best.a : { kind: 'done' };
}

/**
 * The best single Advance among `units`: into an enemy hex when the melee odds (with the other activated units that
 * could join) favour us, else into a hex that is safer or nearer an Objective.
 */
export function bestAdvance(s: GameState, side: Side, units: PieceId[], legal: (a: Answer) => boolean): { a: Answer; v: number } | null {
  let best: { a: Answer; v: number } | null = null;
  const enemyShooters = sideShooters(s, other(side));
  for (const id of units) {
    const p = s.pieces[id];
    if (!p || p.where !== 'map' || holdsFixedWeapon(s, p)) continue;
    const here = safety(s, side, p.hex, enemyShooters);
    for (const to of neighbours(p.hex)) {
      const a: Answer = { kind: 'advanceTo', unit: id, to };
      if (!legal(a)) continue;
      const foes = unitsAt(s, to, other(side));
      let v: number;
      if (foes.length) {
        const mates = units.filter((u) => u !== id && s.pieces[u]?.where === 'map' && distance(s.pieces[u].hex, to) === 1).map((u) => s.pieces[u]);
        const ours = [p, ...mates];
        const win = meleeWinChance(s, ours, foes);
        const stakeThem = foes.reduce((n, f) => n + pieceValue(s, f) + 2, 0);
        const stakeUs = ours.reduce((n, f) => n + pieceValue(s, f) + 2, 0);
        v = win * stakeThem - (1 - win) * stakeUs * (mates.length ? 0.6 : 1);
      } else {
        v = 0.5 * (safety(s, side, to, enemyShooters) - here) + 0.3 * objectiveNear(s, side, to, p.hex);
      }
      if (!best || v > best.v) best = { a, v };
    }
  }
  return best;
}

function objectiveNear(s: GameState, side: Side, to: HexId, from: HexId): number {
  let v = 0;
  for (let i = 0; i < s.map.objectives.length; i++) {
    const o = s.map.objectives[i];
    if (s.control[i] === side) continue;
    v += Math.max(0, distance(from, o) - distance(to, o)) * (distance(to, o) === 0 ? 2 : 1);
  }
  return v;
}

/** Melee odds of all our units that could Advance into `hex` (for the planner). */
export function meleeOdds(s: GameState, ours: PieceId[], hex: HexId): number {
  const side = s.pieces[ours[0]].side;
  return contestOdds(meleeStrength(s, ours.map((id) => s.pieces[id])), meleeStrength(s, unitsAt(s, hex, other(side)))).win;
}

// ---------------------------------------------------------------------------------------------------------------------
// Reactions

/** Worth of each offered Action play (with its targets), less its card; the best one worth playing, else 'done'. */
function reactAnswer(s: GameState, d: Extract<Decision, { kind: 'react' }>, pc: PolicyCtx): Answer {
  const cc = cardCtx(s, d.side);
  let best: { a: Answer; v: number } | null = null;
  d.options.forEach((o, option) => {
    const r = playWorth(s, d, o, pc);
    if (!r) return;
    const cost = o.card ? cardCost(s, d.side, o.card, cc) : 0;
    const v = r.v - cost;
    const a: Answer = { kind: 'play', option, ...(r.targets ? { targets: r.targets } : {}) };
    if (v > 0 && !answerError(s, d, a) && (!best || v > best.v)) best = { a, v };
  });
  if (!best) return { kind: 'done' };
  if (pc.level.sloppy && pc.rng.chance(pc.level.sloppy)) return { kind: 'done' };
  const chosen = best as { a: Answer; v: number };
  const o = d.options[(chosen.a as Extract<Answer, { kind: 'play' }>).option];
  if (o.action === 'Fire') pc.opFireHex = d.info.hex ?? null;
  return chosen.a;
}

/** What playing option `o` in this window is worth to the player (before the card's cost), with its targets. */
function playWorth(
  s: GameState, d: Extract<Decision, { kind: 'react' }>, o: ActionOption, pc: PolicyCtx,
): { v: number; targets?: { pieces?: PieceId[]; hexes?: HexId[] } } | null {
  const me = d.side;
  const info = d.info;
  const attack = info.attack;
  switch (o.action) {
    case 'Fire': {
      const hex = info.hex;
      if (hex === undefined) return null;
      if (!o.card) {
        const pool = s.turn.opFire.flatMap((id) => (s.pieces[id]?.weapon ? [id, s.pieces[id].weapon!] : [id])).filter((id) => s.pieces[id]);
        const b = bestSpec(s, me, pool, 'opFire', hex);
        return b && b.ev > OP_FIRE_MIN ? { v: b.ev } : null;
      }
      // a Fire card activates units for Op Fire: worth the best shot at the hex now, plus some for later entries
      let v = 0;
      for (const sh of sideShooters(s, me, true)) {
        const unit = s.pieces[sh.id].where === 'carried' ? s.pieces[sh.id].carrier! : sh.id;
        if (s.turn.activated.includes(unit)) continue;
        const spec: FireSpec = { pieces: [sh.id], target: hex };
        if (!inRange(sh, hex) || !losCheck(s, sh.hex, hex).clear) continue;
        v = Math.max(v, fireEV(s, me, spec, { mode: 'opFire', moving: true }));
      }
      // a Leader's group shoots better than its best piece alone; the activated units may fire again this Move Order
      return { v: v * 1.35 };
    }
    case 'Bore Sighting':
    case 'Crossfire':
    case 'Hand Grenades':
    case 'Marksmanship':
    case 'Sustained Fire': {
      if (!attack || attack.side !== me || attack.total !== null) return null;
      const gain = attackWorth(s, me, attack.pieces, attack.targets, attack.bonus + 2, attack.mode) - attackWorth(s, me, attack.pieces, attack.targets, attack.bonus, attack.mode);
      let risk = 0;
      if (o.action === 'Sustained Fire') {
        for (const id of attack.pieces) {
          const k = typeOf(s.pieces[id]).weaponClass;
          if (k === 'mg' || k === 'mortar') risk = Math.max(risk, typeValue(typeOf(s.pieces[id])) / 6);
        }
      }
      return { v: gain - risk };
    }
    case 'Spray Fire': {
      if (!attack || attack.side !== me || attack.total !== null || !o.targets?.hexes?.length) return null;
      let bh = -1;
      let bv = 0;
      for (const h of o.targets.hexes) {
        const v = attackWorth(s, me, attack.pieces, [h], attack.bonus, attack.mode);
        if (v > bv) {
          bv = v;
          bh = h;
        }
      }
      return bh >= 0 ? { v: bv, targets: { hexes: [bh] } } : null;
    }
    case 'Concealment':
    case 'Hidden Entrenchments':
    case 'Hidden Pillbox': {
      if (!attack || attack.total === null) return null;
      const id = info.units?.[0];
      if (!id || !s.pieces[id]) return null;
      const hex = s.pieces[id].hex;
      const defenders = unitsAt(s, hex, me);
      const total = attack.total - attack.reduction;
      const firers = attack.pieces.map((x) => (s.pieces[x]?.where === 'carried' ? s.pieces[s.pieces[x].carrier!]?.hex ?? -1 : s.pieces[x]?.hex ?? -1)).filter((h) => h >= 0);
      let saved = 0;
      for (const u of defenders) {
        const base = currentStats(s, u.id).morale;
        const c = cover(s, u.id, { firers, mortarOrArtillery: attack.mortarOrArtillery, ignoresCover: attack.ignoresCover });
        const before = knownTotalOdds(total, base + c);
        let after: { brk: number; tie: number };
        if (o.action === 'Concealment') {
          const bonus = s.scenario.special.concealmentBonus?.[me] ?? 0;
          if (c + bonus <= 0) return null;
          after = knownTotalOdds(total - c - bonus, base + c);
        } else {
          if (attack.ignoresCover) return null;
          const fc = (o.action === 'Hidden Pillbox' ? 5 : 3) + (attack.mortarOrArtillery ? 1 : 0);
          after = knownTotalOdds(total, base + Math.max(c, fc));
        }
        const moving = s.turn.moving.includes(u.id);
        const cost = breakCost(s, u);
        saved += (before.brk - after.brk) * cost + (moving ? (before.tie - after.tie) * cost : 0);
      }
      const lasting = o.action === 'Concealment' ? 0 : o.action === 'Hidden Pillbox' ? 1 : 0.5;
      return { v: saved + lasting };
    }
    case 'Light Wounds': {
      const id = info.units?.[0];
      const p = id ? s.pieces[id] : undefined;
      if (!p) return null;
      const pl = s.players[me];
      const team = pl.quality === 'elite' ? 1.3 : pl.quality === 'green' ? 1.0 : 1.15;
      const squad = pieceValue(s, { ...p, weapon: null });
      if (p.broken) return { v: breakCost(s, p) - 1 - (squad - team * 0.4) };
      return { v: breakLoss(s, p) - 1 - Math.max(0, squad - team) + 0.2 };
    }
    case 'Ambush': {
      const hex = info.hex;
      if (hex === undefined) return null;
      const ours = unitsAt(s, hex, me);
      const theirs = unitsAt(s, hex, other(me));
      if (!theirs.length || !ours.length) return null;
      const before = meleeWinChance(s, ours, theirs);
      // they break the unit that costs them least: assume the weakest
      const weakest = theirs.slice().sort((a, b) => meleeStrength(s, [a]) - meleeStrength(s, [b]))[0];
      const after = meleeWinChance(s, ours, theirs.map((u) => (u === weakest ? { ...u, broken: true } : u)));
      const stake = [...ours, ...theirs].reduce((n, u) => n + pieceValue(s, u) + 2, 0);
      return { v: (after - before) * stake + 0.3 * breakLoss(s, weakest) };
    }
    case 'No Quarter':
      return { v: 2 };
    case 'Dig In': {
      const hexes = o.targets?.hexes ?? [];
      const dd: Extract<Decision, { kind: 'choose' }> = { kind: 'choose', side: me, reason: 'digInHex', items: hexes.map((hex) => ({ hex })), min: 1, max: 1 };
      const sc = itemScores(s, dd, me);
      let bi = -1;
      for (let i = 0; i < sc.length; i++) if (bi < 0 || sc[i] > sc[bi]) bi = i;
      return bi >= 0 ? { v: sc[bi], targets: { hexes: [hexes[bi]] } } : null;
    }
    case 'Demolitions': {
      const hexes = o.targets?.hexes ?? [];
      const dd: Extract<Decision, { kind: 'choose' }> = { kind: 'choose', side: me, reason: 'fortRemove', items: hexes.map((hex) => ({ hex })), min: 1, max: 1 };
      const sc = itemScores(s, dd, me).map((v, i) => (s.fort[hexes[i]] === 'wire' || s.fort[hexes[i]] === 'mines' ? v : -1));
      let bi = -1;
      for (let i = 0; i < sc.length; i++) if (bi < 0 || sc[i] > sc[bi]) bi = i;
      return bi >= 0 && sc[bi] > 0 ? { v: sc[bi] * 0.6, targets: { hexes: [hexes[bi]] } } : null;
    }
    case 'Hidden Unit':
      return { v: 2.5 };
    case 'Hidden Mines': {
      const hex = info.hex;
      if (hex === undefined) return null;
      const strength = s.players[me].minefield || 6;
      let v = 0;
      for (const id of info.units ?? []) {
        const p = s.pieces[id];
        if (!p || p.side === me) continue;
        const o2 = knownTotalOdds(strength + 7, currentStats(s, id).morale);
        v += o2.brk * breakCost(s, p);
      }
      return { v: v + 0.3 };
    }
    case 'Hidden Wire': {
      const hex = info.hex;
      if (hex === undefined) return null;
      const near = unitsOnMap(s, me).some((u) => distance(u.hex, hex) <= 3);
      const objective = s.map.objectives.some((o2) => distance(o2, hex) <= 2);
      const movers = (info.units ?? []).length;
      return { v: (near ? 0.5 : 0.1) + (objective ? 0.4 : 0) + 0.15 * movers };
    }
    default:
      return null;
  }
}

/** Expected worth of an attack by `pieces` on `targets` with `bonus` FP from Actions. */
function attackWorth(s: GameState, side: Side, pieces: PieceId[], targets: HexId[], bonus: number, mode: string): number {
  let v = 0;
  const m = mode === 'opFire' || mode === 'assault' || mode === 'order' ? mode : 'order';
  for (const t of targets) v += fireEV(s, side, { pieces, target: t }, { mode: m, bonus });
  return v;
}

// ---------------------------------------------------------------------------------------------------------------------
// The Initiative re-roll (§9.1)

/**
 * Re-roll only when the roll matters and the swing is large: our own bad Fire Attack / Defense / melee / Rally roll, the
 * enemy's very good one, or a Sudden Death roll that ends the game against us (or keeps it going while we lead). The
 * Initiative card itself is worth about a VP (ties, a later re-roll), so the expected gain must beat that. Fire Attack
 * and Defense rolls are judged on their totals (the decision's `stake`): the result now against a fresh roll's average.
 */
export function rerollWanted(s: GameState, d: Extract<Decision, { kind: 'reroll' }>, pc: PolicyCtx): boolean {
  const me = pc.me;
  const card = CARDS[d.roll.card];
  if (!card) return false;
  const sum = card.white + card.red;
  const own = d.roll.side === me;
  const COST = 1.1;
  const judged = rerollGain(s, d, sum);
  if (judged !== null) return (own ? judged : -judged) > COST + 0.2;
  switch (d.roll.purpose) {
    case 'suddenDeath': {
      const ends = sum < s.time;
      const margin = projectedMargin(s, me);
      const winningNow = margin > 0 || (margin === 0 && s.initiative === me);
      // after a re-roll the Initiative is the opponent's (ties go to him)
      const winningAfter = margin > 0;
      const pEnd = pSumBelow(s.time);
      if (ends && !winningNow) return winningAfter ? true : 1 - pEnd > 0.35;
      if (!ends && winningAfter && margin >= 2) return pEnd > 0.45;
      return false;
    }
    case 'fireAttack': {
      if (own) {
        const lf = pc.lastFire;
        if (!lf || lf.turn !== s.turn.number) return sum <= 3;
        const fp = fireEV(s, me, { pieces: lf.pieces, target: lf.target });
        // the attack total with this roll is far below the average roll: gain ≈ EV(avg) − EV(now)
        const now = attackAtRoll(s, me, lf, sum);
        return fp - now > COST + 0.4;
      }
      return sum >= 11 && unitsOnMap(s, me).length > 0 && enemyFireNearUs(s, me) > 0.5;
    }
    case 'defense':
      return own ? sum <= 3 : false;
    case 'melee':
      return own ? sum <= 4 : sum >= 10;
    case 'rally':
      return own ? sum >= 11 && unitsOnMap(s, me).filter((u) => u.broken).length >= 2 : false;
    case 'targeting':
    case 'accuracy':
      return own ? card.white * card.red <= 3 && radioOf(s, me) !== null && d.roll.purpose === 'accuracy' : false;
    default:
      return false;
  }
}

/**
 * What a re-roll of a Fire Attack or Defense roll is worth to the roller (its expected result over a fresh roll less the
 * result of this one, in evaluation points; negative when the roll went its way), from the decision's `stake`: the
 * attack's FP with its pieces and targets, or the defender's Morale + Cover and the total it must beat. Null when the
 * roll has no stake (another purpose, or an old decision without one).
 */
export function rerollGain(s: GameState, d: Extract<Decision, { kind: 'reroll' }>, sum: number): number | null {
  const st = d.stake;
  if (!st) return null;
  const roller = d.roll.side;
  if (d.roll.purpose === 'fireAttack' && st.pieces?.length && st.hexes?.length) {
    // worth of the attack to the firer at a known total (fire.ts: the Night penalty comes off after the roll)
    const firers = st.pieces.map((id) => hexOfPiece(s, id)).filter((h) => h >= 0);
    const night = nightPenalty(s, firers, st.hexes);
    const pieces = st.pieces.filter((id) => !!s.pieces[id]);
    if (!pieces.length) return null;
    const at = (k: number) => st.hexes!.reduce((n, h) => n + fireEV(s, roller, { pieces, target: h }, { total: st.base + k - night }), 0);
    let avg = 0;
    for (let k = 2; k <= 12; k++) avg += SUM[k] * at(k);
    return avg - at(sum);
  }
  if (d.roll.purpose === 'defense' && st.against !== undefined && st.unit && s.pieces[st.unit]) {
    // the defender's loss at this total: below the Attack Total it breaks, equal it is Suppressed (broken if moving)
    const u = s.pieces[st.unit];
    const brk = breakCost(s, u);
    const tie = s.turn.moving.includes(u.id) ? brk : suppressCost(s, u);
    const loss = (k: number) => (st.base + k < st.against! ? brk : st.base + k === st.against ? tie : 0);
    let avg = 0;
    for (let k = 2; k <= 12; k++) avg += SUM[k] * loss(k);
    return loss(sum) - avg;
  }
  return null;
}

function hexOfPiece(s: GameState, id: PieceId): HexId {
  const p = s.pieces[id];
  if (!p) return -1;
  if (p.where === 'carried' && p.carrier) return s.pieces[p.carrier]?.hex ?? -1;
  return p.where === 'map' ? p.hex : -1;
}

/** Worth of our last attack with an Attack Roll of `sum` (the total then known). */
function attackAtRoll(s: GameState, me: Side, lf: { pieces: PieceId[]; target: HexId }, sum: number): number {
  if (!lf.pieces.some((id) => shooter(s, id))) return 0;
  return fireEV(s, me, { pieces: lf.pieces, target: lf.target }, { total: attackFp(s, lf.pieces, [lf.target]).fp + sum });
}

function enemyFireNearUs(s: GameState, me: Side): number {
  const sh = sideShooters(s, other(me));
  let v = 0;
  for (const u of unitsOnMap(s, me)) {
    const f = fireOn(s, sh, u.hex);
    v = Math.max(v, f.fp / 6);
  }
  return v;
}

