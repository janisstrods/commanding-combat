// Dig In (§A32): at the end of a Time advance (deck.ts opens the window for both players, inactive first): Foxholes in
// a hex with a friendly unit that is not Water, has no Blaze and no other Fortification.
import type { ActionHandler } from '../registry';
import { canHoldFort, hasUnitOf, isUnit, placeFort } from '../state';
import type { GameState, HexId, Side } from '../types';
import { cardsFor, plays } from './common';

function digHexes(s: GameState, side: Side): HexId[] {
  const set = new Set<HexId>();
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.side === side && p.where === 'map' && !set.has(p.hex) && isUnit(p) && canHoldFort(s, p.hex)) set.add(p.hex);
  }
  return [...set].sort((a, b) => a - b);
}

export const digInAction: ActionHandler = {
  windows: ['timeAdvanceEnd'],
  options(s, side) {
    const cards = cardsFor(s, side, 'Dig In');
    if (!cards.length) return [];
    const hexes = digHexes(s, side);
    return hexes.length ? plays(cards, 'Dig In', { hexes }) : [];
  },
  *run(s, ctx, side, _opt, a) {
    const hex = a.kind === 'play' ? a.targets?.hexes?.[0] : undefined;
    if (hex !== undefined && hasUnitOf(s, hex, side)) placeFort(s, ctx, hex, 'foxholes');
  },
};
