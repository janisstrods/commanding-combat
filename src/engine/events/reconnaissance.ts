// Reconnaissance (§E67, §7.3.3): the opponent must reveal one of his secret Objective chits, of his choice; it becomes
// open and scores at once for the current controllers.
import { choose } from '../decisions';
import { revealChit } from '../objectives';
import type { EventHandler } from '../registry';
import { other } from '../types';
import { note } from './helpers';

export const reconnaissanceEvent: EventHandler = function* (s, ctx, receiver) {
  const opp = other(receiver);
  const chits = s.players[opp].secretChits.slice();
  if (!chits.length) {
    note(ctx, receiver, 'Reconnaissance: the opponent has no secret Objective chit.');
    return;
  }
  const [i] = yield* choose(s, ctx, opp, 'reconnaissance', chits.map((chit) => ({ chit })), 1, 1);
  revealChit(s, ctx, opp, chits[i]);
};
