// Light Wounds (§A36, R-54): the instant a friendly Squad (broken or not) would break — never when it is eliminated
// outright (casualties.ts opens the window from `breakPiece` only). The player loses 1 VP; the Squad goes back to the
// counter mix and a Team of his OB troop quality takes its place, broken if it was, with its Weapon, Suppressed and
// Veteran markers and its activation status (casualties.ts `replaceUnit`).
import { addVp, replaceUnit } from '../casualties';
import { teamFor } from '../data';
import type { ActionHandler } from '../registry';
import { typeOf } from '../state';
import { type GameState, type PieceId, type Side, type WindowInfo, other } from '../types';
import { cardsFor, plays } from './common';

function squad(s: GameState, side: Side, info: WindowInfo): PieceId | null {
  const id = info.units?.[0];
  const p = id ? s.pieces[id] : undefined;
  return p && p.side === side && p.where === 'map' && typeOf(p).kind === 'squad' ? p.id : null;
}

export const lightWoundsAction: ActionHandler = {
  windows: ['squadWouldBreak'],
  options(s, side, _w, info) {
    const cards = cardsFor(s, side, 'Light Wounds');
    return cards.length && squad(s, side, info) ? plays(cards, 'Light Wounds') : [];
  },
  *run(s, ctx, side, _opt, _a, info) {
    const id = squad(s, side, info);
    if (!id) return;
    addVp(s, ctx, other(side), 1, 'Light Wounds');
    const pl = s.players[side];
    replaceUnit(s, ctx, id, [teamFor(pl.nation, pl.quality)]);
  },
};
