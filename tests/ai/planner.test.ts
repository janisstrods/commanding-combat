// The own-Turn search (src/ai/planner.ts): it stops early when one plan is clearly best, and it keeps to a simulation
// budget (the match scripts' effort mode) instead of the clock.
import { describe, expect, it } from 'vitest';
import { chooseAnswer, newMemory } from '../../src/ai/index';
import { turnFlow } from '../../src/engine/flow';
import { redact } from '../../src/engine/state';
import type { Decision } from '../../src/engine/types';
import { build, card, run } from '../support/build';

/** The Germans' Turn: two broken American Squads in the open next to an MG team — firing is plainly best. */
function obvious() {
  const s = build({
    axis: { hand: [card('German', { order: 'Fire' }), card('German', { order: 'Recover' }), card('German', { order: 'Advance' })] },
    pieces: [
      { type: 'German/Rifle Squad', hex: 'E5', weapon: 'German/HMG' },
      { type: 'German/Rifle Squad', hex: 'F5' },
      { type: 'American/Line Squad', hex: 'E3', broken: true },
      { type: 'American/Line Squad', hex: 'E3', broken: true },
    ],
  });
  const r = run(s, (ctx) => turnFlow(s, ctx), () => undefined);
  return { s, d: r.pending as Extract<Decision, { kind: 'turn' }> };
}

describe('the own-Turn search', () => {
  it('stops early when one plan is clearly best', () => {
    const { s, d } = obvious();
    const mem = newMemory(5);
    chooseAnswer(redact(s, 'axis'), d, { side: 'axis', level: 'line', seed: 5, deterministic: true }, mem);
    expect(mem.last?.label).toMatch(/^Fire/);
    expect(mem.last?.stop).toBe('clear');
    const full = newMemory(5);
    chooseAnswer(redact(s, 'axis'), d, { side: 'axis', level: 'line', seed: 5, deterministic: true, patch: { clear: 0, even: 0, worlds: 40 } }, full);
    expect(full.last?.stop).toBe('worlds');
    expect(mem.last!.sims!).toBeLessThan(full.last!.sims!);
  });

  it('keeps to a simulation budget instead of the clock (effort mode)', () => {
    const { s, d } = obvious();
    const mem = newMemory(5);
    chooseAnswer(redact(s, 'axis'), d, { side: 'axis', level: 'elite', seed: 5, simBudget: 25, patch: { clear: 0 } }, mem);
    expect(mem.last?.stop).toBe('sims');
    expect(mem.last?.sims).toBe(25);
  });
});
