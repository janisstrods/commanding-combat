// The AI beats a random player: a few short games of scenario 1 with the AI on either side (Line, short budget).
import { describe, expect, it } from 'vitest';
import { chooseAnswer, newMemory } from '../../src/ai/index';
import { scenario } from '../../src/engine/data';
import { GameDriver } from '../../src/engine/driver';
import { randomAnswer } from '../../src/engine/random';
import { newGame, redact } from '../../src/engine/state';
import type { Side } from '../../src/engine/types';
import { mulberry32 } from '../support/rng';

/** One game of scenario 1: the AI (Line, 150 ms a Turn decision) plays `ai`, random play the other side. */
function play(seed: number, ai: Side): { winner: Side | null; fallbacks: number } {
  const d = new GameDriver(newGame(scenario('1'), seed));
  const mem = newMemory(seed * 2 + 1);
  const rnd = mulberry32(seed * 7 + 3);
  for (let n = 0; n < 20000 && d.pending; n++) {
    const p = d.pending;
    const a = p.side === ai ? chooseAnswer(redact(d.state, ai), p, { side: ai, level: 'line', timeBudgetMs: 150 }, mem).answer : randomAnswer(d.state, p, rnd);
    expect(d.answer(a)).toBe(true);
  }
  return { winner: d.state.winner, fallbacks: mem.fallbacks };
}

describe('AI against random play', () => {
  it('wins most games of scenario 1, on either side', () => {
    let wins = 0;
    const games = [
      { seed: 1, ai: 'axis' as const },
      { seed: 2, ai: 'allied' as const },
      { seed: 3, ai: 'axis' as const },
      { seed: 4, ai: 'allied' as const },
    ];
    for (const g of games) {
      const r = play(g.seed, g.ai);
      expect(r.fallbacks).toBe(0);
      if (r.winner === g.ai) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(3);
  });
});
