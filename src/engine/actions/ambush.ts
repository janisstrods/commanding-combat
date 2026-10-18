// Ambush (§A25): before the dice of a melee are rolled (inactive player all his first, then the active one): the
// opponent chooses one of his units in that melee and breaks it (a broken one is eliminated; a Squad may answer with
// Light Wounds, R-54). Every Ambush is resolved before the melee FP are counted; Ambushes may wipe out either side, which
// ends the melee (melee.ts, Task 7).
import { breakPiece } from '../casualties';
import { choose } from '../decisions';
import type { ActionHandler } from '../registry';
import { unitsIn } from '../state';
import { other } from '../types';
import { cardsFor, plays } from './common';

export const ambushAction: ActionHandler = {
  windows: ['beforeMelee'],
  options(s, side, _w, info) {
    if (info.hex === undefined) return [];
    const cards = cardsFor(s, side, 'Ambush');
    if (!cards.length || !unitsIn(s, info.hex, side).length || !unitsIn(s, info.hex, other(side)).length) return [];
    return plays(cards, 'Ambush');
  },
  *run(s, ctx, side, _opt, _a, info) {
    if (info.hex === undefined) return;
    const victims = unitsIn(s, info.hex, other(side));
    const [i] = yield* choose(s, ctx, other(side), 'ambushVictim', victims.map((p) => ({ piece: p.id })), 1, 1, { hex: info.hex });
    if (i !== undefined) yield* breakPiece(s, ctx, victims[i].id, 'ambush');
  },
};
