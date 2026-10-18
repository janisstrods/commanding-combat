// The Random Scenario Generator (design/scenarios-reference.md §4: RS.1–RS.16 with the base-game adaptation R0) as a
// pure step machine that the UI and the AI drive. A plain-JSON draft records every roll and choice made so far;
// `rsgStep` says what happens next (an automatic roll, or a choice for one side), `rsgAdvance` / `rsgChoose` return the
// next draft (the old one is untouched), `rsgAuto` makes a cheap heuristic choice for a side, and `rsgFinish` turns a
// finished draft into a ScenarioDef with id 'rsg'.
//
// Every roll is plain dice from the draft's own seeded RNG (rng.ts mulberry32, state kept in the draft): no Fate cards,
// no triggers, no Initiative re-rolls (rules-reference R-39). "Roll" = two dice, white and coloured, unless stated.
// Where the reference leaves a gap, the choice made here is marked "Ruling:".
//
// Files: rsg/types.ts (the draft, steps and choices), rsg/tables.ts (table look-ups, purchase rules, R0 pairings),
// rsg/steps.ts (RS.1–RS.16 in order), rsg/auto.ts (rsgAuto), rsg/finish.ts (rsgFinish), rsg/mix.ts (counter-mix limits).
import { type Side, SIDES } from './types';
import { rsgAuto } from './rsg/auto';
import { advanceInPlace, chooseInPlace, rsgStep } from './rsg/steps';
import { clone } from './rsg/tables';
import type { RsgChoice, RsgDraft } from './rsg/types';

export type * from './rsg/types';
export { rsgAuto, rsgPieceValue } from './rsg/auto';
export { rsgFinish } from './rsg/finish';
export { rsgCounterCap } from './rsg/mix';
export { newRsgDraft, rsgCheck, rsgStep } from './rsg/steps';
export { RSG_MAPS, rsgLeaderIndex, rsgObOptions } from './rsg/tables';

/** The draft after choice `c` (pure; throws if `c` is not a legal answer to the current choice step). */
export function rsgChoose(d: RsgDraft, c: RsgChoice): RsgDraft {
  const e = clone(d);
  chooseInPlace(e, c);
  return e;
}

/** The draft after the next automatic step (pure; throws if the next step is a choice or the RSG is finished). */
export function rsgAdvance(d: RsgDraft): RsgDraft {
  const e = clone(d);
  advanceInPlace(e);
  return e;
}

/**
 * Runs automatic steps and lets `rsgAuto` choose for `sides` until a choice for another side, or the end (pure).
 * "Surprise me" is `rsgAutoRun(newRsgDraft({ seed }), rnd)`.
 */
export function rsgAutoRun(d: RsgDraft, rnd: () => number, sides: readonly Side[] = SIDES): RsgDraft {
  const e = clone(d);
  for (let n = 0; n < 500; n++) {
    const st = rsgStep(e);
    if (st.kind === 'done') return e;
    if (st.kind === 'auto') advanceInPlace(e);
    else if (sides.includes(st.side)) chooseInPlace(e, rsgAuto(e, st.side, rnd));
    else return e;
  }
  throw new Error('rsgAutoRun: the RSG does not end');
}
