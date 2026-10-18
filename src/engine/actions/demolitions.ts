// Demolitions (§A31, R-14): when the opponent passes and throws away at least one card: remove one Fortification from a
// hex holding a friendly unit.
import type { ActionHandler } from '../registry';
import { hasUnitOf, removeFort } from '../state';
import type { GameState, HexId, Side } from '../types';
import { cardsFor, plays } from './common';

function fortHexes(s: GameState, side: Side): HexId[] {
  const out: HexId[] = [];
  for (let h = 0; h < s.fort.length; h++) if (s.fort[h] && hasUnitOf(s, h, side)) out.push(h);
  return out;
}

export const demolitionsAction: ActionHandler = {
  windows: ['opponentPassed'],
  options(s, side, _w, info) {
    if (side === s.active || !(info.discards && info.discards > 0)) return [];
    const cards = cardsFor(s, side, 'Demolitions');
    if (!cards.length) return [];
    const hexes = fortHexes(s, side);
    return hexes.length ? plays(cards, 'Demolitions', { hexes }) : [];
  },
  *run(s, ctx, side, _opt, a) {
    const hex = a.kind === 'play' ? a.targets?.hexes?.[0] : undefined;
    if (hex !== undefined && s.fort[hex] && hasUnitOf(s, hex, side)) removeFort(s, ctx, hex);
  },
};
