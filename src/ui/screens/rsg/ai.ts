// The computer's RSG choices. One function, so Task 12's AI can replace the heuristic in one place.
import { rsgAuto, type RsgChoice, type RsgDraft } from '../../../engine/rsg';
import type { Side } from '../../../engine/types';
import { rsgView, stepRnd } from './view';

/**
 * The AI's choice at the draft's next step (which must be a choice for `side`). It sees only its own view of the draft
 * (rsgView: not the player's OB before both are chosen, not the player's secret chit, not the dice to come); the
 * heuristic is the engine's rsgAuto, seeded from the draft so a seed replays exactly.
 */
export function aiRsgChoice(d: RsgDraft, side: Side, rnd: () => number = stepRnd(d)): RsgChoice {
  return rsgAuto(rsgView(d, side), side, rnd);
}
