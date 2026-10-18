// Hidden Entrenchments (§A35.1): scenario Defender only, just before he makes a Defense Roll in a hex that is not a
// Building or Water hex and has no Fortification: Foxholes are placed there (their Cover counts from that roll on).
import type { ActionHandler } from '../registry';
import { canHoldFort, placeFort } from '../state';
import type { GameState, HexId, Side, WindowInfo } from '../types';
import { cardsFor, plays } from './common';

/** The hex of the unit about to make a Defense Roll in `info`, if it is `side`'s, or -1. */
export function defendingHex(s: GameState, side: Side, info: WindowInfo): HexId {
  const id = info.units?.[0];
  const p = id ? s.pieces[id] : undefined;
  if (!info.attack || info.attack.side === side || !p || p.side !== side || p.where !== 'map') return -1;
  return p.hex;
}

export const hiddenEntrenchmentsAction: ActionHandler = {
  windows: ['beforeDefenseRoll'],
  options(s, side, _w, info) {
    const cards = cardsFor(s, side, 'Hidden Entrenchments');
    if (!cards.length) return [];
    const hex = defendingHex(s, side, info);
    if (hex < 0 || s.map.terrain[hex] === 'Building' || !canHoldFort(s, hex)) return [];
    return plays(cards, 'Hidden Entrenchments');
  },
  *run(s, ctx, side, _opt, _a, info) {
    const hex = defendingHex(s, side, info);
    if (hex >= 0 && s.map.terrain[hex] !== 'Building') placeFort(s, ctx, hex, 'foxholes');
  },
};
