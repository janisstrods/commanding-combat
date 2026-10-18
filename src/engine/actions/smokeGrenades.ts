// Smoke Grenades (§A39): while the active player's units are activated to Move (offered inside each 'move' decision,
// window 'duringMove'), for one of them with boxed Movement: draw a random Smoke marker and place it in or next to that
// unit's hex, not in Water or Blaze. Smoke into Smoke keeps the larger (state.ts `placeSmoke`, R-42).
import { neighbours } from '../hex';
import type { ActionHandler } from '../registry';
import { drawSmoke, isUnit, isWater, placeSmoke } from '../state';
import type { GameState, HexId, Side } from '../types';
import { boxed, cardsFor, plays } from './common';

/** The hexes Smoke Grenades may go to: in or next to a unit of `side` activated to Move with boxed Movement. */
export function smokeGrenadeHexes(s: GameState, side: Side): HexId[] {
  const set = new Set<HexId>();
  for (const id of s.turn.moving) {
    const p = s.pieces[id];
    if (!p || p.side !== side || p.where !== 'map' || !isUnit(p) || !boxed(s, id, 'move')) continue;
    for (const h of [p.hex, ...neighbours(p.hex)]) if (!isWater(s.map, h) && !s.blaze[h]) set.add(h);
  }
  return [...set].sort((a, b) => a - b);
}

export const smokeGrenadesAction: ActionHandler = {
  windows: ['duringMove'],
  options(s, side) {
    if (side !== s.active || !s.turn.move || !s.smokeCup.length) return [];
    const cards = cardsFor(s, side, 'Smoke Grenades');
    if (!cards.length) return [];
    const hexes = smokeGrenadeHexes(s, side);
    return hexes.length ? plays(cards, 'Smoke Grenades', { hexes }) : [];
  },
  *run(s, ctx, side, _opt, a) {
    const hex = a.kind === 'play' ? a.targets?.hexes?.[0] : undefined;
    if (hex === undefined) return;
    const v = drawSmoke(s);
    if (v === null) return;
    if (!placeSmoke(s, ctx, hex, v)) ctx.emit({ kind: 'log', text: `Smoke Grenades: the Smoke drawn (${v}) is no thicker than the Smoke there.`, side });
  },
};
