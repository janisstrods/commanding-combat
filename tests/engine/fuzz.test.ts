// The fuzzer's smoke run (scripts/fuzz.ts runs it at scale): 40 random legal games over the twelve scenarios and RSG
// scenarios, half of them with Fate decks cut to 10 cards, every answer and the state checked after each answer, and
// each game replayed from its answers into the same final state.
import { describe, expect, it } from 'vitest';
import { FUZZ_SCENARIOS, fuzzGame, reproduce } from '../../scripts/fuzzlib';

describe('fuzz smoke', () => {
  it('40 games (12 scenarios + RSG, whole and tiny decks) end cleanly and replay exactly', () => {
    const failures: string[] = [];
    let over = 0;
    for (let i = 0; i < 40; i++) {
      const g = { scenario: FUZZ_SCENARIOS[i % FUZZ_SCENARIOS.length], seed: 100 + i, tiny: i % 2 ? 10 : 0 };
      const r = fuzzGame(g);
      if (r.error) failures.push(`${reproduce(g)}\n  ${r.error}`);
      if (r.phase === 'over') over++;
    }
    expect(failures).toEqual([]);
    expect(over).toBe(40);
  });
});
