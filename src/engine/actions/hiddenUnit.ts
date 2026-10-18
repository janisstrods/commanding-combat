// Hidden Unit (§A35.4, R-14, R-16): scenario Defender only, when the opponent passes and throws away at least one card.
// (1) A roll for his own Support Table: an ordinary roll, so it can trigger. (2) He chooses one item that is not a
// Radio from that column, available in the scenario year (named Leaders only while in the counter mix), for free.
// (3) He places it, with its Weapon, in a hex of his original set-up area that holds no unit of either side and has
// Cover 1 or more. Nothing comes in if the column offers nothing or no hex qualifies.
import { roll } from '../deck';
import { choose } from '../decisions';
import { bringIn, supportOptions } from '../events/helpers';
import type { ActionHandler } from '../registry';
import { setupHexes } from '../setup';
import { hexCover } from '../stats';
import { isUnit } from '../state';
import type { GameState, HexId, Side } from '../types';
import { cardsFor, plays } from './common';

/** The hexes a Hidden Unit may be placed in (sorted). */
export function hiddenUnitHexes(s: GameState, side: Side): HexId[] {
  const taken = new Set<HexId>();
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.where === 'map' && isUnit(p)) taken.add(p.hex);
  }
  return setupHexes(s, side).filter((h) => !taken.has(h) && hexCover(s, h) >= 1);
}

export const hiddenUnitAction: ActionHandler = {
  windows: ['opponentPassed'],
  options(s, side, _w, info) {
    if (side === s.active || !(info.discards && info.discards > 0)) return [];
    return plays(cardsFor(s, side, 'Hidden Unit'), 'Hidden Unit');
  },
  *run(s, ctx, side) {
    const r = yield* roll(s, ctx, side, 'support');
    const items = supportOptions(s, side, r.sum, false);
    if (!items.length) {
      ctx.emit({ kind: 'log', text: `Hidden Unit: column ${r.sum} of the Support Table offers nothing.`, side });
      return;
    }
    const hexes = hiddenUnitHexes(s, side);
    if (!hexes.length) {
      ctx.emit({ kind: 'log', text: 'Hidden Unit: no empty hex with Cover in the set-up area.', side });
      return;
    }
    const [i] = yield* choose(s, ctx, side, 'supportItem', items.map((o) => ({ label: o.label })), 1, 1, { roll: r.sum, items: items.map((o) => o.types) });
    const [j] = yield* choose(s, ctx, side, 'hiddenUnitPlace', hexes.map((hex) => ({ hex })), 1, 1);
    bringIn(s, ctx, side, items[i], hexes[j]);
  },
};
