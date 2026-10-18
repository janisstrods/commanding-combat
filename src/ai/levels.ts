// The AI's three levels, named after the game's troop qualities: Green (shallow and noisy), Line (the default) and
// Elite (the widest search and most simulations). Own-Turn thinking time at most: Green 0.6 s, Line 8 s, Elite 20 s
// (the searches stop earlier when the choice is clear, or when every candidate has played all its worlds).

export type AiLevel = 'green' | 'line' | 'elite';
export const AI_LEVELS: readonly AiLevel[] = ['green', 'line', 'elite'];

export interface LevelCfg {
  level: AiLevel;
  /** Thinking time for an own-Turn decision (the planner), ms. Small decisions take a few ms at any level. */
  budgetMs: number;
  /** Determinised worlds each candidate plan is played in at most (the planner stops earlier when time runs out). */
  worlds: number;
  /** Simulations every candidate gets before any is dropped. */
  minSims: number;
  /** Candidate plans per Turn decision at most. */
  maxCands: number;
  /** Fire activations / Move activations tried per Order. */
  fireActs: number;
  moveActs: number;
  /** Destination plans per Move activation (best, then variants). */
  moveVariants: number;
  /** Gaussian noise (VP points) on plan scores. */
  noise: number;
  /** Chance a reaction is judged carelessly (skipped when it would have been played). */
  sloppy: number;
  /** Initiative re-rolls: never, or judged. */
  reroll: boolean;
  /** Play the rest of the Turn (greedy) after the candidate Order in each simulation. */
  lookahead: boolean;
  /** Then play the opponent's reply Turn (greedy) before judging. */
  reply: boolean;
  /** Fraction of the live candidates kept after each round once every one has `minSims` worlds. */
  keep: number;
  /**
   * Early stop: the search ends when the best candidate leads the runner-up by this many standard errors of their
   * paired difference (0: never), or when the two are even within `even` points.
   */
  clear: number;
  even: number;
  /** Keep a battle plan across Turns (battleplan.ts). */
  battlePlan: boolean;
}

export const LEVELS: Record<AiLevel, LevelCfg> = {
  green: {
    level: 'green', budgetMs: 600, worlds: 1, minSims: 1, maxCands: 4, fireActs: 2, moveActs: 2, moveVariants: 1,
    noise: 4, sloppy: 0.6, reroll: false, lookahead: false, reply: false,
    keep: 0.6, clear: 0, even: 0, battlePlan: false,
  },
  line: {
    level: 'line', budgetMs: 8000, worlds: 128, minSims: 8, maxCands: 18, fireActs: 5, moveActs: 8, moveVariants: 3,
    noise: 0, sloppy: 0, reroll: true, lookahead: false, reply: false,
    keep: 0.6, clear: 3, even: 0.1, battlePlan: true,
  },
  elite: {
    level: 'elite', budgetMs: 20000, worlds: 256, minSims: 12, maxCands: 26, fireActs: 7, moveActs: 12, moveVariants: 4,
    noise: 0, sloppy: 0, reroll: true, lookahead: true, reply: true,
    keep: 0.6, clear: 3, even: 0.1, battlePlan: true,
  },
};
