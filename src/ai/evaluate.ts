// The static evaluation of a position for one side, in VP-like points (positive = good for `me`). Simulations end in a
// position this scores; deployment and move destinations are scored with it too. Parts:
//  - the VP margin, with the secret chits the state holds scored for their current controllers (the AI's own are
//    known; in a determinised state the opponent's are a sample);
//  - surrender distance for both sides (steeply worse the nearer);
//  - time pressure: who benefits from the game ending soon (the VP leader, more as Sudden Death nears);
//  - unit and leader worth (good order vs broken vs suppressed, Weapons), Leader cohesion (units within Command);
//  - exposure (enemy fire with LOS and range on each friendly stack against its Morale and Cover) and threat (ours on
//    theirs), counted for as many stacks as the side to act can attack before the other replies;
//  - objective proximity by posture;
//  - hand quality (own hand; the opponent's only when known, i.e. in a simulation).
import { CARDS, OBJECTIVE_CHITS } from '../engine/data';
import { distance } from '../engine/hex';
import { chitValue, objectiveValue } from '../engine/objectives';
import { isLeader, isUnit, typeOf } from '../engine/state';
import { type GameState, type HexId, type Piece, type Posture, type Side, UNKNOWN_CARD, other } from '../engine/types';
import { HAND_WEIGHT, cardCtx, handValue } from './cards';
import { fireOn, sideShooters, stackLoss } from './tactics';
import { GAME_SCORE, materialOf, surrenderPressure } from './values';

export { surrenderPressure } from './values';

export interface Weights {
  vp: number;
  material: number;
  surrender: number;
  time: number;
  exposure: number;
  threat: number;
  objective: number;
  hand: number;
  cohesion: number;
  initiative: number;
}

const BASE: Weights = {
  vp: 1,
  material: 1,
  surrender: 1,
  time: 2,
  exposure: 0.4,
  threat: 0.25,
  objective: 1,
  hand: HAND_WEIGHT,
  cohesion: 0.12,
  initiative: 0.6,
};

/** Posture changes: attackers push for objectives, defenders guard against exposure. */
const POSTURE: Record<Posture, Partial<Weights>> = {
  attack: { objective: 1.4, exposure: 0.35, threat: 0.3 },
  recon: { objective: 1.1 },
  defend: { objective: 0.8, exposure: 0.45 },
};

export function weightsFor(s: GameState, me: Side, patch?: Partial<Weights>): Weights {
  return { ...BASE, ...POSTURE[s.players[me].posture], ...patch };
}


/** VP the side's secret chits will score at game end for the current control (chits not known score 0 here). */
function secretChitVp(s: GameState, side: Side): number {
  let v = 0;
  for (const c of s.players[side].secretChits) {
    if (!OBJECTIVE_CHITS[c]) continue;
    for (let n = 1; n <= 5; n++) if (s.control[n - 1] === side) v += chitValue(c, n);
  }
  return v;
}

/** The VP margin for `me` if the game ended now, secret chits included (as far as the state knows them). */
export function projectedMargin(s: GameState, me: Side): number {
  const raw = me === 'axis' ? s.vp : -s.vp;
  return raw + secretChitVp(s, me) - secretChitVp(s, other(me));
}

/** Breakdown of an evaluation (for diagnostics and tests). */
export interface EvalParts {
  total: number;
  margin: number;
  material: number;
  surrender: number;
  time: number;
  exposure: number;
  threat: number;
  objective: number;
  hand: number;
  cohesion: number;
  initiative: number;
}

export interface EvalOpts {
  /** Score the hands (default true). Positional searches leave them out: moving units does not change them. */
  hand?: boolean;
}

/** Score position `s` for `me`. */
export function evaluate(s: GameState, me: Side, w: Weights = weightsFor(s, me), opts: EvalOpts = {}): number {
  return evaluateParts(s, me, w, opts).total;
}

export function evaluateParts(s: GameState, me: Side, w: Weights = weightsFor(s, me), opts: EvalOpts = {}): EvalParts {
  const opp = other(me);
  if (s.phase === 'over') {
    const won = s.winner === me;
    const m = projectedMargin(s, me);
    const total = (won ? GAME_SCORE : -GAME_SCORE) + 0.5 * m;
    return { total, margin: m, material: 0, surrender: 0, time: 0, exposure: 0, threat: 0, objective: 0, hand: 0, cohesion: 0, initiative: 0 };
  }
  const margin = projectedMargin(s, me);
  const material = materialOf(s, me) - materialOf(s, opp);
  const left = (side: Side) => s.players[side].surrender - s.players[side].casualties.length - 0.35 * brokenOnMap(s, side);
  const surrender = surrenderPressure(left(opp)) - surrenderPressure(left(me));

  // time: the leader (projected) wants the game to end; urgency grows as Sudden Death nears and the decks run down
  const deckLeft = (side: Side) => s.players[side].deck.length / 72;
  const progress = s.time + 0.5 * (1 - deckLeft(me)) + 0.5 * (1 - deckLeft(opp));
  const urgency = Math.max(0, Math.min(1.5, (progress - (s.suddenDeath - 4)) / 4));
  const time = Math.tanh(margin / 3) * urgency;

  // exposure / threat: the side to act next attacks first
  const myTurnLeft = s.active === me && s.turn.passDiscards === null && s.turn.ordersGiven < s.players[me].orders;
  const ex = fireBalance(s, opp, me, s.players[opp].orders + 1);
  const th = fireBalance(s, me, opp, s.players[me].orders + 1);
  const exposure = -ex * (myTurnLeft ? 0.8 : 1.1);
  const threat = th * (myTurnLeft ? 1.25 : 0.8);

  const objective = objectiveTerm(s, me) - objectiveTerm(s, opp);
  const hand =
    opts.hand === false ? 0 : handValue(s, me, cardCtx(s, me)) - (knowsHand(s, opp) ? 0.5 * handValue(s, opp, cardCtx(s, opp)) : 0);
  const cohesion = cohesionOf(s, me) - cohesionOf(s, opp);
  const initiative = s.initiative === me ? 1 : -1;

  const total =
    w.vp * margin +
    w.material * material +
    w.surrender * surrender +
    w.time * time +
    w.exposure * exposure +
    w.threat * threat +
    w.objective * objective +
    w.hand * hand +
    w.cohesion * cohesion +
    w.initiative * initiative;
  return { total, margin, material, surrender, time, exposure, threat, objective, hand, cohesion, initiative };
}

function knowsHand(s: GameState, side: Side): boolean {
  const h = s.players[side].hand;
  return h.length > 0 && !h.includes(UNKNOWN_CARD) && h.every((c) => !!CARDS[c]);
}

function brokenOnMap(s: GameState, side: Side): number {
  let n = 0;
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.side === side && p.where === 'map' && p.broken && isUnit(p)) n++;
  }
  return n;
}

/**
 * Expected loss `target`'s stacks would suffer from `firer`'s fire, summed over the `k` most threatened stacks (a side
 * gives only so many Orders before the other replies).
 */
export function fireBalance(s: GameState, firer: Side, target: Side, k: number): number {
  const shooters = sideShooters(s, firer);
  if (!shooters.length) return 0;
  const hexes = new Map<HexId, Piece[]>();
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.side !== target || p.where !== 'map' || !isUnit(p)) continue;
    const list = hexes.get(p.hex);
    if (list) list.push(p);
    else hexes.set(p.hex, [p]);
  }
  const losses: number[] = [];
  for (const [hex, units] of hexes) {
    const f = fireOn(s, shooters, hex);
    const l = stackLoss(s, hex, target, f, false, units);
    if (l > 0) losses.push(l);
  }
  losses.sort((a, b) => b - a);
  let t = 0;
  for (let i = 0; i < losses.length && i < k; i++) t += losses[i] * (i === 0 ? 1 : 0.8);
  return t;
}

/**
 * Objectives for `side`: each objective's worth (open chits, the side's own secret chits, and a base for what nobody
 * knows yet) times how close its good-order units are — holding it in strength best, being near it next. Posture sets
 * the base: attackers value every objective more.
 */
export function objectiveTerm(s: GameState, side: Side): number {
  const posture = s.players[side].posture;
  const base = posture === 'attack' ? 1.2 : posture === 'recon' ? 0.9 : 0.7;
  const units: Piece[] = [];
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.side === side && p.where === 'map' && isUnit(p) && !p.broken) units.push(p);
  }
  if (!units.length) return 0;
  let t = 0;
  const n = s.map.objectives.length;
  for (let i = 0; i < n; i++) {
    const hex = s.map.objectives[i];
    let v = base + Math.max(0, objectiveValue(s, i + 1));
    for (const c of s.players[side].secretChits) v += chitValue(c, i + 1);
    // the nearest unit counts fully, the next one a third: holding it in strength, or closing in with more than one
    let c1 = 0;
    let c2 = 0;
    for (const u of units) {
      const d = distance(u.hex, hex);
      const c = d === 0 ? (typeOf(u).kind === 'leader' ? 0.9 : 1.15) : d === 1 ? 0.8 : Math.max(0, 0.8 - (d - 1) * 0.09);
      if (c > c1) {
        c2 = c1;
        c1 = c;
      } else if (c > c2) c2 = c;
    }
    t += v * (c1 + 0.35 * c2);
  }
  return t;
}

/** Non-Leader units within the Command radius of a friendly unbroken Leader (activated or not). */
export function cohesionOf(s: GameState, side: Side): number {
  const leaders: Piece[] = [];
  const others: Piece[] = [];
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.side !== side || p.where !== 'map' || !isUnit(p)) continue;
    if (isLeader(p)) {
      if (!p.broken) leaders.push(p);
    } else others.push(p);
  }
  if (!leaders.length) return 0;
  let n = 0;
  for (const u of others) if (leaders.some((l) => distance(l.hex, u.hex) <= typeOf(l).front.command)) n++;
  return n;
}
