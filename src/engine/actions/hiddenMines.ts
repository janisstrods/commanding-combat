// Hidden Mines (§A35.2, R-43): scenario Defender only, right after enemy units enter a hex by Move or Advance (not
// Retreat: no window then) that is not Water and has no Fortification: Mines are placed there and attack the units that
// just entered (one roll; units already in the hex are not attacked; forts.ts `mineAttack`).
import { mineAttack } from '../forts';
import type { ActionHandler } from '../registry';
import { canHoldFort, placeFort } from '../state';
import type { GameState, HexId, PieceId, Side, WindowInfo } from '../types';
import { cardsFor, plays } from './common';

/**
 * The enemy units of `side` that have just entered `info.hex` and are still there, when it may take a Hidden
 * Fortification (not Water, no Blaze, no Fortification); [] otherwise.
 */
export function enteredByEnemy(s: GameState, side: Side, info: WindowInfo): PieceId[] {
  const hex: HexId | undefined = info.hex;
  if (hex === undefined || !canHoldFort(s, hex)) return [];
  return (info.units ?? []).filter((id) => {
    const p = s.pieces[id];
    return p && p.side !== side && p.where === 'map' && p.hex === hex && (info.mover === undefined || info.mover === p.side);
  });
}

export const hiddenMinesAction: ActionHandler = {
  windows: ['afterHexEntry', 'afterAdvanceEntry'],
  options(s, side, _w, info) {
    const cards = cardsFor(s, side, 'Hidden Mines');
    return cards.length && enteredByEnemy(s, side, info).length ? plays(cards, 'Hidden Mines') : [];
  },
  *run(s, ctx, side, _opt, _a, info) {
    const units = enteredByEnemy(s, side, info);
    if (!units.length || !placeFort(s, ctx, info.hex!, 'mines')) return;
    yield* mineAttack(s, ctx, units, info.hex!);
  },
};
