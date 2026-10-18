// The simulation harness: run a piece of the real engine flow on a determinised copy of the game, answering every
// decision with a policy, until the flow ends, a decision matches `stop`, or the step limit is reached. An answer the
// engine refuses (it asks the same decision again) is replaced by a safe one.
import type { Gen } from '../engine/decisions';
import { answerError } from '../engine/decisions';
import { guard } from '../engine/flow';
import { randomAnswer } from '../engine/random';
import type { Answer, Decision, FlowCtx, GameState } from '../engine/types';
import type { Rng } from './rand';

export type Policy = (s: GameState, d: Decision) => Answer;

export interface RunResult {
  /** The flow finished (or the game ended). */
  done: boolean;
  /** The decision the run stopped at (unanswered), or null. */
  at: Decision | null;
  steps: number;
  /** Answers the engine refused (a policy bug when > 0; replaced by safe answers). */
  refused: number;
}

/** A legal answer that does as little as possible (pass, stop, decline, the fewest items). */
export function safeAnswer(s: GameState, d: Decision, rnd: () => number): Answer {
  const tries: Answer[] = [];
  switch (d.kind) {
    case 'turn':
      tries.push(d.canPass ? { kind: 'pass', discard: [] } : { kind: 'endTurn' });
      break;
    case 'react':
    case 'deploy':
    case 'fire':
    case 'move':
    case 'advance':
      tries.push({ kind: 'done' });
      break;
    case 'reroll':
      tries.push({ kind: 'reroll', yes: false });
      break;
    case 'choose':
      tries.push({ kind: 'choose', items: Array.from({ length: d.min }, (_, i) => i) });
      break;
    default:
      break;
  }
  for (const a of tries) if (!answerError(s, d, a)) return a;
  for (let i = 0; i < 20; i++) {
    try {
      const a = randomAnswer(s, d, rnd);
      if (!answerError(s, d, a)) return a;
    } catch {
      // try again
    }
  }
  return tries[0] ?? { kind: 'done' };
}

/**
 * Drive generator `gen` (already created on `s` with `ctx` from `simCtx`) with `policy`. The flow is wrapped in the
 * engine's `guard`, so a game ending inside it just finishes the run with the state's phase 'over'.
 */
export function drive(
  s: GameState, make: (ctx: FlowCtx) => Gen, policy: Policy, rng: Rng, opts: { maxSteps?: number; stop?: (d: Decision) => boolean } = {},
): RunResult {
  let rejected = false;
  const ctx: FlowCtx = {
    emit() {},
    invalid() {
      rejected = true;
    },
  };
  const gen = guard(s, ctx, make(ctx));
  const maxSteps = opts.maxSteps ?? 800;
  const rnd = () => rng.next();
  let r = gen.next();
  let steps = 0;
  let fails = 0;
  let refused = 0;
  while (!r.done) {
    const d = r.value;
    if (opts.stop?.(d)) return { done: false, at: d, steps, refused };
    if (steps++ > maxSteps) return { done: false, at: d, steps, refused };
    let a: Answer;
    if (fails === 0) {
      try {
        a = policy(s, d);
      } catch {
        a = safeAnswer(s, d, rnd);
      }
    } else a = fails < 3 ? safeAnswer(s, d, rnd) : randomAnswer(s, d, rnd);
    rejected = false;
    r = gen.next(a);
    if (rejected) {
      refused++;
      if (++fails > 30) return { done: false, at: null, steps, refused };
    } else fails = 0;
  }
  return { done: true, at: null, steps, refused };
}
