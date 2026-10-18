// Assault Fire (§A26, R-15): while the active player's units are activated to Move (before, during or after their
// movement; offered inside each 'move' decision, window 'duringMove'): one Fire Attack by any of those units and their
// Weapons with boxed FP that can fire at an enemy unit in Range and LOS (a Fire Group, or boxed-FP Ordnance alone with
// its Targeting roll), following all the normal Fire rules. It activates nobody.
import { ask } from '../decisions';
import { fireAttack, fireOptions } from '../fire';
import type { ActionHandler } from '../registry';
import { isUnit } from '../state';
import type { GameState, PieceId, Side } from '../types';
import { boxed, cardsFor, plays } from './common';

/** The pieces that may take part in Assault Fire: units activated to Move with boxed FP, and their boxed-FP Weapons. */
export function assaultPool(s: GameState, side: Side): PieceId[] {
  const out: PieceId[] = [];
  for (const id of s.turn.moving) {
    const p = s.pieces[id];
    if (!p || p.side !== side || p.where !== 'map' || !isUnit(p)) continue;
    if (boxed(s, id, 'fp')) out.push(id);
    if (p.weapon && boxed(s, p.weapon, 'fp')) out.push(p.weapon);
  }
  return out;
}

export const assaultFireAction: ActionHandler = {
  windows: ['duringMove'],
  options(s, side) {
    if (side !== s.active || !s.turn.move) return [];
    const cards = cardsFor(s, side, 'Assault Fire');
    if (!cards.length) return [];
    const pool = assaultPool(s, side);
    return pool.length && fireOptions(s, pool, 'assault').size ? plays(cards, 'Assault Fire') : [];
  },
  *run(s, ctx, side) {
    const pool = assaultPool(s, side);
    if (!fireOptions(s, pool, 'assault').size) return;
    const a = yield* ask(s, ctx, { kind: 'fire', side, mode: 'assault', pieces: pool, mustFire: true });
    if (a.kind === 'fire') yield* fireAttack(s, ctx, side, a.spec, 'assault');
  },
};
