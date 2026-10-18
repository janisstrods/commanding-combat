// No Quarter (§A38): after a melee, by a player with at least one of his units in it still alive: +2 VP. The German
// player may play it only against Russians; the Russian player against anyone (the American deck has none).
import { addVp } from '../casualties';
import type { ActionHandler } from '../registry';
import { unitsIn } from '../state';
import { type GameState, type Side, type WindowInfo, other } from '../types';
import { cardsFor, plays } from './common';

function survived(s: GameState, side: Side, info: WindowInfo): boolean {
  if (info.hex !== undefined && unitsIn(s, info.hex, side).length) return true;
  return (info.units ?? []).some((id) => s.pieces[id]?.side === side && s.pieces[id].where === 'map');
}

function nationAllows(s: GameState, side: Side): boolean {
  const me = s.players[side].nation;
  return me === 'Russian' || (me === 'German' && s.players[other(side)].nation === 'Russian');
}

export const noQuarterAction: ActionHandler = {
  windows: ['afterMelee'],
  options(s, side, _w, info) {
    const cards = cardsFor(s, side, 'No Quarter');
    return cards.length && nationAllows(s, side) && survived(s, side, info) ? plays(cards, 'No Quarter') : [];
  },
  *run(s, ctx, side) {
    addVp(s, ctx, side, 2, 'No Quarter');
  },
};
