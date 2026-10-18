// A random legal answer to any decision, for fuzzing and smoke tests (and as the AI's fallback). Every answer it gives
// passes answerError. Tasks that add decision kinds extend `randomAnswer` (or register in RANDOM_ANSWERS).
import { activationError, commandRadius } from './activation';
import { answerError } from './decisions';
import { fireOptions } from './fire';
import { randomAdvanceAnswer } from './orders/advance';
import { smokeOptions } from './orders/fire';
import { moveAnswers } from './orders/move';
import { isLeader } from './state';
import type { Answer, Decision, GameState } from './types';

export type Rand = () => number;

/** Extra random-answer makers by decision kind (for kinds other tasks add). */
export const RANDOM_ANSWERS: Partial<Record<Decision['kind'], (s: GameState, d: Decision, rnd: Rand) => Answer>> = {
  advance: (s, d, rnd) => randomAdvanceAnswer(s, d, rnd),
};

const pick = <T>(arr: readonly T[], rnd: Rand): T => arr[Math.floor(rnd() * arr.length)];

function subset<T>(arr: readonly T[], n: number, rnd: Rand): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

const between = (lo: number, hi: number, rnd: Rand) => lo + Math.floor(rnd() * (hi - lo + 1));

/** A random legal answer to `d` in `s`. */
export function randomAnswer(s: GameState, d: Decision, rnd: Rand): Answer {
  const extra = RANDOM_ANSWERS[d.kind];
  if (extra) return extra(s, d, rnd);
  const a = make(s, d, rnd);
  const err = answerError(s, d, a);
  if (err) throw new Error(`randomAnswer made an illegal answer to ${d.kind}: ${err} (${JSON.stringify(a)})`);
  return a;
}

function make(s: GameState, d: Decision, rnd: Rand): Answer {
  switch (d.kind) {
    case 'turn': {
      if (d.orders.length && (!d.canPass || rnd() < 0.85)) {
        if (!d.canPass && rnd() < 0.2) return { kind: 'endTurn' };
        const o = pick(d.orders, rnd);
        return { kind: 'order', card: o.card, order: o.order };
      }
      if (!d.canPass) return { kind: 'endTurn' };
      const hand = s.players[d.side].hand;
      return { kind: 'pass', discard: subset(hand, between(0, d.maxDiscard, rnd), rnd) };
    }
    case 'reroll':
      return { kind: 'reroll', yes: rnd() < 0.1 };
    case 'activate': {
      if (d.players?.length && (!d.units.length || rnd() < 0.5)) return { kind: 'activatePlayer', player: pick(d.players, rnd) };
      const first = pick(d.units, rnd);
      const p = s.pieces[first];
      if (!isLeader(p)) return { kind: 'activate', units: [first] };
      const radius = commandRadius(s, p);
      const some = [first, ...subset(radius, between(0, radius.length, rnd), rnd)];
      if (!activationError(s, d, some)) return { kind: 'activate', units: some };
      // the whole radius, or the Leader alone (a Fire For Effect activates only its Spotter)
      return activationError(s, d, [first, ...radius]) ? { kind: 'activate', units: [first] } : { kind: 'activate', units: [first, ...radius] };
    }
    case 'fire': {
      const opts = [...fireOptions(s, d.pieces, d.mode, d.target).values()].flat();
      const smoke = d.target === undefined ? smokeOptions(s, d.pieces, d.mode) : [];
      if ((!opts.length && !smoke.length) || (!d.mustFire && rnd() < 0.2)) return { kind: 'done' };
      // now and then a Smoke round (there are many more of them than attacks)
      if (smoke.length && (!opts.length || rnd() < 0.15)) return { kind: 'fire', spec: pick(smoke, rnd) };
      return { kind: 'fire', spec: pick(opts, rnd) };
    }
    case 'move': {
      const all = moveAnswers(s, d);
      const steps = all.filter((a) => a.kind === 'moveStep' || a.kind === 'exit');
      // mostly keep moving; sometimes transfer, play or stop
      if (steps.length && rnd() < 0.75) return pick(steps, rnd);
      return pick(all, rnd);
    }
    case 'react': {
      if (rnd() < 0.5) return { kind: 'done' };
      const option = Math.floor(rnd() * d.options.length);
      const t = d.options[option].targets;
      const targets: { pieces?: string[]; hexes?: number[] } = {};
      if (t?.pieces) targets.pieces = [pick(t.pieces, rnd)];
      if (t?.hexes) targets.hexes = [pick(t.hexes, rnd)];
      return { kind: 'play', option, targets: t ? targets : undefined };
    }
    case 'choose':
      return { kind: 'choose', items: subset(d.items.map((_, i) => i), between(d.min, d.max, rnd), rnd) };
    case 'deploy': {
      if (rnd() < 0.3) return { kind: 'done' };
      for (let tries = 0; tries < 20; tries++) {
        const a: Answer = { kind: 'deploy', piece: pick(d.pieces, rnd), hex: pick(d.hexes, rnd) };
        if (!answerError(s, d, a)) return a;
      }
      return { kind: 'done' };
    }
    default:
      throw new Error(`randomAnswer: no maker for '${d.kind}'`);
  }
}
