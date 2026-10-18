// Card sense: what a Fate card in hand is worth to keep, for the side that holds it (hand management: which card to
// spend on an Order, which to discard, whether an Action is worth its card). Values are in the evaluation's VP-like
// points; a random draw is worth about AVG_DRAW.
import { activationCandidates } from '../engine/activation';
import { CARDS } from '../engine/data';
import { enemyHexes } from '../engine/fire';
import { distance } from '../engine/hex';
import { radioOf, typeOf } from '../engine/state';
import type { ActionName, CardId, GameState, OrderName, Side } from '../engine/types';
import { other } from '../engine/types';
import { unitsOnMap } from './tactics';

/** The worth of an average card drawn from the deck (a missing card in hand is counted at this). */
export const AVG_DRAW = 0.9;

/** Facts about the board that card values depend on, computed once per hand. */
export interface CardCtx {
  side: Side;
  posture: string;
  defender: boolean;
  canFire: boolean;
  canMove: boolean;
  adjacentEnemy: boolean;
  broken: number;
  suppressed: number;
  enemyBroken: number;
  radio: boolean;
  enemyRadio: boolean;
  mg: boolean;
  bigWeapon: boolean;
  boxedFp: boolean;
  boxedRange: boolean;
  boxedMove: boolean;
  russianFoe: boolean;
  nation: string;
  enemiesInRange: number;
  /** S5 Deep Freeze: Actions that would place a Fortification cannot be played. */
  noForts: boolean;
}

export function cardCtx(s: GameState, side: Side): CardCtx {
  const mine = unitsOnMap(s, side);
  const theirs = unitsOnMap(s, other(side));
  const enemyHex = enemyHexes(s, side);
  let adjacentEnemy = false;
  let mg = false;
  let bigWeapon = false;
  let boxedFp = false;
  let boxedRange = false;
  let boxedMove = false;
  let enemiesInRange = 0;
  for (const u of mine) {
    const t = typeOf(u);
    const v = u.broken ? t.broken : t.front;
    if (v.boxed.fp) boxedFp = true;
    if (v.boxed.range) boxedRange = true;
    if (v.boxed.move) boxedMove = true;
    if (u.weapon) {
      const w = typeOf(s.pieces[u.weapon]);
      if (w.weaponClass === 'mg' || w.weaponClass === 'mortar') mg = true;
      if (w.front.fp >= 5) bigWeapon = true;
      if (w.front.boxed.fp) boxedFp = true;
      if (w.front.boxed.range) boxedRange = true;
    }
    for (const h of enemyHex) {
      const d = distance(u.hex, h);
      if (d <= 1) adjacentEnemy = true;
      if (d <= 6) enemiesInRange++;
    }
  }
  const pl = s.players[side];
  return {
    side,
    posture: pl.posture,
    defender: pl.posture === 'defend',
    canFire: activationCandidates(s, side, 'Fire').length > 0,
    canMove: mine.some((u) => !u.broken),
    adjacentEnemy,
    broken: mine.filter((u) => u.broken).length,
    suppressed: mine.filter((u) => u.suppressed).length,
    enemyBroken: theirs.filter((u) => u.broken).length,
    radio: !!radioOf(s, side),
    enemyRadio: !!radioOf(s, other(side)),
    mg,
    bigWeapon,
    boxedFp,
    boxedRange,
    boxedMove,
    russianFoe: s.players[other(side)].nation === 'Russian',
    nation: pl.nation,
    enemiesInRange,
    noForts: !!s.scenario.special.noNewFortifications,
  };
}

/** Worth of the card's Order part. */
export function orderValue(order: OrderName, c: CardCtx): number {
  switch (order) {
    case 'Fire':
      return c.canFire ? 1.5 : 0.8;
    case 'Move':
      return c.posture === 'attack' ? 1.4 : c.posture === 'recon' ? 1.15 : 0.8;
    case 'Advance':
      return c.adjacentEnemy ? 1.3 : c.posture === 'attack' ? 0.6 : 0.4;
    case 'Recover':
      return c.broken ? 0.7 + 0.35 * Math.min(3, c.broken) : c.suppressed ? 0.5 : 0.15;
    case 'Rout':
      return c.enemyBroken ? 0.6 + 0.25 * Math.min(3, c.enemyBroken) : 0.1;
    case 'Artillery Request':
      return c.radio ? 1.6 : 0;
    case 'Artillery Denied':
      return c.enemyRadio ? 0.8 : 0;
    case 'Command Confusion':
      return 0;
    default:
      return 0.3;
  }
}

/** Worth of the card's Action part (the Fire Action counts when the card has "Order/Action Fire"). */
const FORT_ACTIONS: ReadonlySet<ActionName> = new Set(['Dig In', 'Hidden Entrenchments', 'Hidden Mines', 'Hidden Pillbox', 'Hidden Wire']);

export function actionValue(action: ActionName, c: CardCtx, defenderOnly = false): number {
  if (defenderOnly && !c.defender) return 0;
  if (c.noForts && FORT_ACTIONS.has(action)) return 0;
  switch (action) {
    case 'Fire':
      return c.defender ? 1.0 : c.posture === 'recon' ? 0.75 : 0.55;
    case 'Concealment':
      return 0.7;
    case 'Light Wounds':
      return 0.55;
    case 'Ambush':
      return c.adjacentEnemy ? 0.9 : c.posture === 'attack' ? 0.55 : 0.45;
    case 'Crossfire':
      return c.defender ? 0.65 : 0.45;
    case 'Hand Grenades':
      return c.adjacentEnemy ? 0.7 : 0.45;
    case 'Sustained Fire':
      return c.mg ? 0.6 : 0.05;
    case 'Spray Fire':
      return c.boxedRange ? 0.4 : 0.05;
    case 'Assault Fire':
      return c.boxedFp ? 0.5 : 0.05;
    case 'Smoke Grenades':
      return c.boxedMove ? (c.posture === 'attack' ? 0.6 : 0.4) : 0.05;
    case 'Dig In':
      return 0.45;
    case 'Bore Sighting':
      return c.bigWeapon ? 0.55 : 0.05;
    case 'Marksmanship':
      return c.nation === 'German' ? 0.55 : 0.05;
    case 'No Quarter':
      return c.nation === 'Russian' || (c.nation === 'German' && c.russianFoe) ? 0.5 : 0;
    case 'Demolitions':
      return 0.2;
    case 'Hidden Unit':
      return 1.2;
    case 'Hidden Entrenchments':
    case 'Hidden Pillbox':
      return 0.8;
    case 'Hidden Mines':
    case 'Hidden Wire':
      return 0.7;
    case 'Command Confusion':
      return 0;
    default:
      return 0.3;
  }
}

/** Worth of keeping `card` (one card on its own: the hand's duplicates are handled by `handValue`). */
export function keepValue(card: CardId, c: CardCtx): number {
  const f = CARDS[card];
  if (!f) return AVG_DRAW;
  const o = orderValue(f.order, c);
  let a = actionValue(f.action, c, f.defenderOnly);
  if (f.fireIsAction) a = Math.max(a, actionValue('Fire', c));
  return Math.max(o, a) + 0.3 * Math.min(o, a);
}

/** The worth of an average card still to come from `side`'s draw pile (the unseen pool in a view). */
export function avgDraw(s: GameState, side: Side, c: CardCtx): number {
  const pool = s.unseen?.cards[side] ?? s.players[side].deck;
  if (!pool.length) return AVG_DRAW;
  const step = Math.max(1, Math.floor(pool.length / 24));
  let t = 0;
  let n = 0;
  for (let i = 0; i < pool.length; i += step) {
    if (!CARDS[pool[i]]) continue;
    t += keepValue(pool[i], c);
    n++;
  }
  return n ? t / n : AVG_DRAW;
}

/**
 * Worth of a whole hand: each card's keep value, with duplicates of the same Order worth less (0.7 for the 2nd,
 * 0.5 for the 3rd ...), plus an average draw for each empty slot below the hand size (it will be refilled).
 */
export function handValue(s: GameState, side: Side, c: CardCtx = cardCtx(s, side)): number {
  const p = s.players[side];
  const seen: Record<string, number> = {};
  const vals = p.hand.map((id) => ({ id, v: keepValue(id, c), order: CARDS[id]?.order ?? '?' })).sort((a, b) => b.v - a.v);
  let total = 0;
  for (const x of vals) {
    const n = seen[x.order] ?? 0;
    seen[x.order] = n + 1;
    total += x.v * (n === 0 ? 1 : n === 1 ? 0.7 : n === 2 ? 0.5 : 0.35);
  }
  const missing = Math.max(0, p.handSize - p.hand.length);
  if (missing) total += missing * avgDraw(s, side, c);
  return total;
}

/** The evaluation's weight of hand worth (evaluate.ts BASE.hand): card costs are in the same points. */
export const HAND_WEIGHT = 0.45;
/** Spending any card brings Time nearer and leaves the slot empty until the refill. */
const TEMPO = 0.1;

/** What playing `card` now costs `side` in evaluation points (its worth above an average draw, plus tempo). */
export function cardCost(s: GameState, side: Side, card: CardId, c: CardCtx = cardCtx(s, side)): number {
  return HAND_WEIGHT * Math.max(0, keepValue(card, c) - avgDraw(s, side, c)) + TEMPO;
}

/** The cards of `side`'s hand, weakest to keep first. */
export function weakestFirst(s: GameState, side: Side, c: CardCtx = cardCtx(s, side)): CardId[] {
  return s.players[side].hand.slice().sort((a, b) => keepValue(a, c) - keepValue(b, c));
}
