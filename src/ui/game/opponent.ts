// The computer opponent as the battle screen sees it. It only ever gets the game as its side may see it
// (`redact(state, side)`) and the decision it must answer; Task 12's AI implements this interface (src/ai).
import { randomAnswer } from '../../engine/random';
import type { Answer, Decision, GameState } from '../../engine/types';

export interface Opponent {
  decide(view: GameState, d: Decision): Promise<{ answer: Answer; say?: string }>;
  dispose(): void;
}

/** The stand-in opponent until the AI lands: a random legal answer, judged on its own view only. */
export class RandomOpponent implements Opponent {
  constructor(private readonly rnd: () => number = Math.random) {}
  async decide(view: GameState, d: Decision): Promise<{ answer: Answer }> {
    return { answer: randomAnswer(view, d, this.rnd) };
  }
  dispose(): void {}
}

/**
 * The pause (ms at normal speed) the battle screen takes at every reaction window that opens for the computer, whether
 * it holds a playable card or not: the same for all of them, so the timing gives nothing away.
 */
export const WINDOW_PAUSE_MS = 260;
