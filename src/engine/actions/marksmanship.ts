// Marksmanship (§A37): just before a Fire Attack Roll that includes a firing Squad or Team of the nationality printed
// on the card (only the German deck has it): +2 FP.
import { typeOf } from '../state';
import { fpAction } from './common';

export const marksmanshipAction = fpAction('Marksmanship', (s, attack, card) =>
  attack.pieces.some((id) => {
    const t = typeOf(s.pieces[id]);
    return (t.kind === 'squad' || t.kind === 'team') && t.nation === card.nation;
  }),
);
