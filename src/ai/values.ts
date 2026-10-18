// What pieces are worth to the AI, in VP-like points. Material is valued on top of the VP an elimination gives the
// enemy (the evaluation counts VP separately), so losing a Squad costs its material, 2 VP and a step toward surrender.
import { unitVp } from '../engine/casualties';
import { isUnit, typeOf } from '../engine/state';
import type { CounterType, GameState, Piece, Side } from '../engine/types';

/** Fraction of a unit's worth that is left while it is broken (it can rally, but is near useless and dies when hit). */
export const BROKEN_FACTOR = 0.4;
export const SUPPRESSED_FACTOR = 0.85;

/** The printed worth of a counter type (unbroken, fresh). */
export function typeValue(t: CounterType): number {
  switch (t.kind) {
    case 'squad':
      return 1.6 + 0.12 * t.front.fp + 0.05 * t.front.range + 0.1 * Math.max(0, t.front.morale - 6) + (t.quality === 'elite' ? 0.3 : 0);
    case 'team':
      return 0.8 + 0.08 * t.front.fp + 0.05 * Math.max(0, t.front.morale - 6);
    case 'leader':
      if (t.hero) return 1.6;
      return 0.9 + 0.75 * t.front.command + 0.08 * Math.max(0, t.front.morale - 7);
    case 'weapon': {
      const k = t.weaponClass;
      if (k === 'mg') return 0.5 + 0.12 * t.front.fp;
      if (k === 'mortar') return 0.6 + 0.08 * t.front.fp;
      if (k === 'flamethrower' || k === 'satchel') return 0.8;
      return 0.5 + 0.05 * t.front.fp;
    }
    case 'radio':
      return 2.5;
    default:
      return 0;
  }
}

/** A unit's current worth, with its Weapon: broken, suppressed and veteran units are worth less or more. */
export function pieceValue(s: GameState, p: Piece): number {
  const t = typeOf(p);
  let v = typeValue(t);
  if (isUnit(p)) {
    if (p.broken) v *= BROKEN_FACTOR;
    else if (p.suppressed) v *= SUPPRESSED_FACTOR;
    if (p.veteran) v += 0.25;
    if (p.weapon) {
      const w = s.pieces[p.weapon];
      if (w) v += weaponValue(s, w, p);
    }
  } else if (t.kind === 'weapon' && p.broken) v *= 0.5;
  return v;
}

/** A Weapon's worth in its carrier's hands (a broken carrier cannot fire it, a broken Weapon may be fixed). */
export function weaponValue(s: GameState, w: Piece, carrier: Piece | null): number {
  let v = typeValue(typeOf(w));
  if (w.broken) v *= 0.45;
  if (carrier?.broken) v *= 0.6;
  return v;
}

/** Worth lost when unit `p` breaks (unbroken → broken), or is eliminated (already broken), not counting VP. */
export function breakLoss(s: GameState, p: Piece): number {
  if (!p.broken) return pieceValue(s, p) * (1 - BROKEN_FACTOR) + 0.15;
  return pieceValue(s, p);
}

/** The evaluation's score for winning (or losing) the game. */
export const GAME_SCORE = 150;

/**
 * What being `left` casualties away from surrender costs (in evaluation points): the chance of losing by surrender
 * before the game ends, times the game. Fractional `left` counts broken units as part-casualties.
 */
export function surrenderPressure(left: number): number {
  if (left <= 0) return GAME_SCORE;
  return GAME_SCORE * Math.min(1, 0.3 * Math.pow(0.42, left - 1));
}

/** One more casualty for `side`: the rise in its surrender pressure. */
export function pressureStep(s: GameState, side: Side): number {
  const pl = s.players[side];
  const left = pl.surrender - pl.casualties.length;
  return surrenderPressure(left - 1) - surrenderPressure(left);
}

/**
 * The full cost to `p`'s side of one break result on it: lost worth, plus (if it dies) the VP the enemy gains and a
 * step toward its own surrender.
 */
export function breakCost(s: GameState, p: Piece): number {
  if (!p.broken) return breakLoss(s, p) + (isUnit(p) ? 0.15 * pressureStep(s, p.side) : 0);
  return pieceValue(s, p) + elimVp(s, p) + (isUnit(p) ? pressureStep(s, p.side) : 0);
}

/** VP the enemy gains for eliminating `p` (chit X doubles). */
export function elimVp(s: GameState, p: Piece): number {
  return unitVp(p) * (s.openChits.includes('X') ? 2 : 1);
}

/** Sum of the worth of `side`'s units on the map (Weapons included). */
export function materialOf(s: GameState, side: Side): number {
  let v = 0;
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.side !== side || !isUnit(p)) continue;
    if (p.where === 'map') v += pieceValue(s, p);
    else if (p.where === 'time' || p.where === 'staging') v += 0.6 * pieceValue(s, p);
  }
  return v;
}
