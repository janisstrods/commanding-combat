// The AI beats a random player: a few short games of scenario 1 with the AI on either side (Line, short budget).
import { describe, expect, it } from 'vitest';
import { playMatch } from '../../scripts/ai-match';

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
      const players = g.ai === 'axis' ? ({ axis: 'line', allied: 'random' } as const) : ({ axis: 'random', allied: 'line' } as const);
      const r = playMatch('1', g.seed, players, { budget: 150 });
      expect(r.fallbacks).toBe(0);
      if (r.winner === g.ai) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(3);
  });
});
