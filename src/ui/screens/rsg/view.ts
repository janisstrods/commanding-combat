// What a side may see of an RSG draft, and the seeded generators of the screens' choices (shared by model.ts and ai.ts).
import type { RsgDraft } from '../../../engine/rsg';
import { random } from '../../../engine/rng';
import { type Side, other } from '../../../engine/types';

/** A seeded generator of floats in [0, 1) (the engine's mulberry32). */
export function seededRnd(seed: number): () => number {
  const s = { rng: seed >>> 0, rngCalls: 0 };
  return () => random(s);
}

/** A generator for one choice, fixed by the draft's seed and how far it has got (so a seed replays exactly). */
export function stepRnd(d: RsgDraft, salt = 0): () => number {
  return seededRnd((Math.imul(d.seed ^ 0x9e3779b9, 31) + Math.imul(d.log.length + 1, 0x85ebca6b) + salt) >>> 0);
}

// ---------------------------------------------------------------------------------------------------------------------
// Hidden information

export const bothObsChosen = (d: RsgDraft) => d.ob.axis !== null && d.ob.allied !== null;

/** A secret chit the viewer may not see: the view keeps the count, not the letter. */
export const HIDDEN_CHIT = '?';

/**
 * What `viewer` may know of the draft: the opponent's OB pick is hidden until both OBs are chosen (RS.5: secret picks,
 * revealed together), the opponent's secret Objective chits never (RS.4), nor the generator's state (the dice to come).
 * The screens draw the human's view; the AI chooses from its own view. Everything else (rolls, Leaders, purchases,
 * Fortifications, the VP marker) is public.
 */
export function rsgView(d: RsgDraft, viewer: Side): RsgDraft {
  const v = JSON.parse(JSON.stringify(d)) as RsgDraft;
  const opp = other(viewer);
  v.rng = 0;
  v.rngCalls = 0;
  v.secretChits[opp] = v.secretChits[opp].map(() => HIDDEN_CHIT);
  if (!bothObsChosen(d)) {
    v.ob[opp] = null;
    for (const e of v.log) if (e.step === 'ob' && e.side === opp) delete e.choice;
  }
  return v;
}

/**
 * A side's OB as `viewer` sees it: 'none' (not chosen yet), 'hidden' (chosen, not revealed) or the pick. Works on the
 * draft and on a view (where a hidden pick is null but its log entry is there).
 */
export function obAsSeen(d: RsgDraft, viewer: Side, side: Side): 'none' | 'hidden' | { letter: string; size: string } {
  const pick = d.ob[side];
  if (!pick) return d.log.some((e) => e.step === 'ob' && e.side === side) ? 'hidden' : 'none';
  if (side === viewer || bothObsChosen(d)) return { ...pick };
  return 'hidden';
}

