// Decisions are quick: at the default level (Line, 2.5 s budget) an own-Turn decision in a mid-game position of a big
// scenario stays within a few seconds, and the small decisions take milliseconds.
import { describe, expect, it } from 'vitest';
import { chooseAnswer, newMemory } from '../../src/ai/index';
import { scenario } from '../../src/engine/data';
import { GameDriver } from '../../src/engine/driver';
import { randomAnswer } from '../../src/engine/random';
import { newGame, redact } from '../../src/engine/state';
import { mulberry32 } from '../support/rng';

function midGame(id: string, seed: number): GameDriver {
  const rnd = mulberry32(seed);
  const d = new GameDriver(newGame(scenario(id), seed));
  let turns = 0;
  for (let n = 0; n < 5000 && d.pending; n++) {
    const p = d.pending;
    if (p.kind === 'turn' && p.orders.length > 2 && ++turns >= 6) return d;
    if (!d.answer(randomAnswer(d.state, p, rnd))) throw new Error(d.lastError ?? 'refused');
  }
  throw new Error('no mid-game turn decision');
}

describe('AI timing', () => {
  it('a Line Turn decision in a mid-game position takes at most ~3 s', () => {
    const d = midGame('9', 4);
    const p = d.pending!;
    const mem = newMemory(1);
    const t0 = performance.now();
    chooseAnswer(redact(d.state, p.side), p, { side: p.side, level: 'line' }, mem);
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(3200);
    expect(mem.last?.sims).toBeGreaterThan(0);
  });

  it('small decisions take milliseconds', () => {
    const rnd = mulberry32(3);
    const d = new GameDriver(newGame(scenario('4'), 3));
    const mem = { axis: newMemory(1), allied: newMemory(2) };
    let worst = 0;
    for (let n = 0; n < 1200 && d.pending; n++) {
      const p = d.pending;
      let a;
      if (p.kind !== 'turn' && p.kind !== 'deploy') {
        const t0 = performance.now();
        a = chooseAnswer(redact(d.state, p.side), p, { side: p.side, level: 'line' }, mem[p.side]).answer;
        worst = Math.max(worst, performance.now() - t0);
      } else a = randomAnswer(d.state, p, rnd);
      expect(d.answer(a)).toBe(true);
    }
    expect(worst).toBeLessThan(250);
  });
});
