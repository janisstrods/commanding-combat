// Every answer the AI gives is legal: in many positions reached by random play over several scenarios (and in games
// the AI plays itself), each answer passes the engine's validator on the real state, and the AI never needed its
// fallback (an answer it made was refused, or it threw).
import { describe, expect, it } from 'vitest';
import { chooseAnswer, newMemory, type AiMemory } from '../../src/ai/index';
import { scenario } from '../../src/engine/data';
import { answerError } from '../../src/engine/decisions';
import { GameDriver } from '../../src/engine/driver';
import { randomAnswer } from '../../src/engine/random';
import { newGame, redact } from '../../src/engine/state';
import type { Decision, Side } from '../../src/engine/types';
import { mulberry32 } from '../support/rng';

describe('the AI answers legally', () => {
  it('in random positions of several scenarios, for every decision kind it meets', () => {
    const rnd = mulberry32(77);
    const kinds = new Set<Decision['kind']>();
    let asked = 0;
    for (const id of ['1', '2', '4', '6', '9', '12']) {
      for (let g = 0; g < 2; g++) {
        const d = new GameDriver(newGame(scenario(id), 300 + g));
        const mem: Record<Side, AiMemory> = { axis: newMemory(1), allied: newMemory(2) };
        for (let n = 0; d.pending && n < 1500; n++) {
          const p = d.pending;
          // the AI answers about a third of the decisions (all of one side's at times), random play the rest
          const ai = n % 3 === 0 || (p.side === 'axis' && g === 0);
          const a = ai
            ? chooseAnswer(redact(d.state, p.side), p, { side: p.side, level: 'green', timeBudgetMs: 40, seed: n + 1 }, mem[p.side]).answer
            : randomAnswer(d.state, p, rnd);
          if (ai) {
            asked++;
            kinds.add(p.kind);
            const err = answerError(d.state, p, a);
            if (err) throw new Error(`scenario ${id}: the AI's answer to '${p.kind}' is refused: ${err} (${JSON.stringify(a)})`);
          }
          expect(d.answer(a)).toBe(true);
        }
        expect(mem.axis.fallbacks + mem.allied.fallbacks).toBe(0);
      }
    }
    expect(asked).toBeGreaterThan(500);
    for (const k of ['turn', 'activate', 'fire', 'move', 'react', 'reroll', 'choose', 'deploy'] as const) expect(kinds.has(k)).toBe(true);
  });

  it('at Elite (look-ahead and the opponent\'s reply in its simulations) and Green', () => {
    const d = new GameDriver(newGame(scenario('2'), 9));
    const mem: Record<Side, AiMemory> = { axis: newMemory(5), allied: newMemory(6) };
    const level = { axis: 'elite', allied: 'green' } as const;
    for (let n = 0; d.pending && n < 400; n++) {
      const p = d.pending;
      const a = chooseAnswer(redact(d.state, p.side), p, { side: p.side, level: level[p.side], timeBudgetMs: 80, seed: 3 }, mem[p.side]).answer;
      expect(answerError(d.state, p, a)).toBeNull();
      expect(d.answer(a)).toBe(true);
    }
    expect(mem.axis.fallbacks + mem.allied.fallbacks).toBe(0);
  });

  it('in a whole game it plays against itself (Line on both sides, short budget)', () => {
    const d = new GameDriver(newGame(scenario('1'), 5));
    const mem: Record<Side, AiMemory> = { axis: newMemory(3), allied: newMemory(4) };
    let n = 0;
    while (d.pending && n < 5000) {
      const p = d.pending;
      const a = chooseAnswer(redact(d.state, p.side), p, { side: p.side, level: 'line', timeBudgetMs: 60, seed: 8 }, mem[p.side]).answer;
      expect(answerError(d.state, p, a)).toBeNull();
      expect(d.answer(a)).toBe(true);
      n++;
    }
    expect(d.state.phase).toBe('over');
    expect(mem.axis.fallbacks + mem.allied.fallbacks).toBe(0);
  });
});
