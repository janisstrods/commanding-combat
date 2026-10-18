// The AI's three levels, named after the game's troop qualities: Green (shallow and noisy), Line (the default) and
// Elite (the widest search and most simulations).

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
}

export const LEVELS: Record<AiLevel, LevelCfg> = {
  green: {
    level: 'green', budgetMs: 600, worlds: 3, minSims: 1, maxCands: 6, fireActs: 2, moveActs: 3, moveVariants: 1,
    noise: 1.2, sloppy: 0.35, reroll: false, lookahead: false,
  },
  line: {
    level: 'line', budgetMs: 2500, worlds: 20, minSims: 3, maxCands: 12, fireActs: 4, moveActs: 6, moveVariants: 2,
    noise: 0, sloppy: 0, reroll: true, lookahead: false,
  },
  elite: {
    level: 'elite', budgetMs: 4000, worlds: 32, minSims: 4, maxCands: 18, fireActs: 6, moveActs: 9, moveVariants: 3,
    noise: 0, sloppy: 0, reroll: true, lookahead: true,
  },
};
