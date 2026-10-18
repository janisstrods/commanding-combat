// Hidden Wire (§A35.5, R-43): scenario Defender only, right after enemy units enter a hex by Move or Advance (not
// Retreat) that is not Water and has no Fortification: Wire is placed there. Units moving by a Move Order stop there at
// once (they lose their remaining MP, §F106.2): their group's move is over. Advancing units ignore that.
import type { ActionHandler } from '../registry';
import { placeFort } from '../state';
import { cardsFor, plays } from './common';
import { enteredByEnemy } from './hiddenMines';

export const hiddenWireAction: ActionHandler = {
  windows: ['afterHexEntry', 'afterAdvanceEntry'],
  options(s, side, _w, info) {
    const cards = cardsFor(s, side, 'Hidden Wire');
    return cards.length && enteredByEnemy(s, side, info).length ? plays(cards, 'Hidden Wire') : [];
  },
  *run(s, ctx, side, _opt, _a, info) {
    const units = enteredByEnemy(s, side, info);
    if (!units.length || !placeFort(s, ctx, info.hex!, 'wire')) return;
    const m = s.turn.move;
    if (!m) return;
    // the group moving now ends its move here (it stays together, R-27); others that entered stop too
    const stop = m.group && m.group.some((id) => units.includes(id)) ? m.group : units.filter((id) => s.turn.moving.includes(id));
    for (const id of stop) if (!m.done.includes(id)) m.done.push(id);
    if (m.group && stop === m.group) m.group = null;
  },
};
