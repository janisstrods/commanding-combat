// Scenario 6, Paralyzed from the West Down (scenarios-reference §3): SSR 1 Axis Orders rise from 1 to 3, SSR 2 chit W out.
import { describe, expect, it } from 'vitest';
import { advanceTime } from '../../../src/engine/deck';
import { build, passive, run } from '../../support/build';
import { setUp, special } from './kit';

describe('scenario 6 Paralyzed from the West Down', () => {
  it('SSR 1: the Axis starts with 1 Order per Turn, +1 at every Time advance (either player\'s), at most 3', () => {
    const { s } = setUp('6', 1);
    expect(s.players.axis.orders).toBe(1);
    expect(s.players.allied.orders).toBe(4);
    const t = build({ special: special('6'), axis: { orders: 1 }, allied: { orders: 4 }, suddenDeath: 12 });
    const seen: number[] = [];
    for (const side of ['allied', 'axis', 'allied', 'axis'] as const) {
      run(t, (ctx) => advanceTime(t, ctx, side), passive);
      seen.push(t.players.axis.orders);
    }
    expect(seen).toEqual([2, 3, 3, 3]);
    expect(t.players.allied.orders).toBe(4);
  });

  it('SSR 2: chit W is out of the cup', () => {
    const { s } = setUp('6', 2);
    expect([...s.chitCup, ...s.openChits]).not.toContain('W');
  });
});
