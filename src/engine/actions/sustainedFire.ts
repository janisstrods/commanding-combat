// Sustained Fire (§A41): just before a Fire Attack Roll to which a Mortar or a Machine Gun contributes: +2 FP. If the
// roll shows doubles, one firing Mortar / MG of the firer's choice breaks, once per Sustained Fire played, on top of
// Jammed! (fire.ts `fireAttack` does that from `attack.played`).
import { typeOf } from '../state';
import { fpAction } from './common';

export const sustainedFireAction = fpAction('Sustained Fire', (s, attack) =>
  attack.pieces.some((id) => {
    const k = typeOf(s.pieces[id]).weaponClass;
    return k === 'mg' || k === 'mortar';
  }),
);
