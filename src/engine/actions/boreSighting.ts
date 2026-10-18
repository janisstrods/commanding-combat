// Bore Sighting (§A27): scenario Defender only, just before a Fire Attack Roll in which a firing Weapon has a printed FP
// of 5 or more: +2 FP.
import { typeOf } from '../state';
import { fpAction } from './common';

export const boreSightingAction = fpAction('Bore Sighting', (s, attack) =>
  attack.pieces.some((id) => {
    const t = typeOf(s.pieces[id]);
    return t.kind === 'weapon' && t.front.fp >= 5;
  }),
);
