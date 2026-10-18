// A unit leaving a Mines hex is attacked as it leaves (§F103); if that attack's Event! starts a Blaze in the hex it
// was entering, it cannot go in there (Blaze is impassable, §E46) — found by the fuzzer (scenario 2, seed 1274).
import { describe, expect, it } from 'vitest';
import { turnFlow } from '../../src/engine/flow';
import { retreat } from '../../src/engine/orders/rout';
import { H, build, card, passive, rolls, run, start, type BuildSpec } from '../support/build';

const G = 'German';
const A = 'American';

// The American Line Squad leaves the Mines in E4 for E3; the German Mine Attack roll is a 3-4 with Event!: Blaze, Random
// Hex E3. Its Defense roll (11) holds.
function spec(order?: 'Move' | 'Advance'): BuildSpec {
  const ev = card(G, { white: 3, red: 4, trigger: 'Event' });
  const blaze = card(G, { event: 'Blaze' }, [ev]);
  const e3 = card(G, { hex: 'E3' }, [ev, blaze]);
  return {
    pieces: [{ type: 'American/Line Squad', hex: 'E4' }, { type: 'German/Rifle Squad', hex: 'K9' }],
    fort: { E4: 'mines' },
    active: 'allied',
    axis: { top: [ev, blaze, e3, ...rolls(G, [[1, 2]], [ev, blaze, e3])] },
    allied: { top: rolls(A, [[5, 6], [6, 5]]), hand: order ? [card(A, { order })] : [], edge: 'top' },
  };
}

describe('the hex being entered catches fire while the unit leaves a Mines hex', () => {
  it('a Move stops in the hex it was leaving', () => {
    const s = build(spec('Move'));
    const f = start(s, (ctx) => turnFlow(s, ctx));
    f.answer({ kind: 'order', card: s.players.allied.hand[0], order: 'Move' }).answer({ kind: 'activate', units: ['p0'] });
    f.answer({ kind: 'moveStep', units: ['p0'], to: H('E3') });
    expect(s.blaze[H('E3')]).toBe(true);
    expect(s.pieces.p0.hex).toBe(H('E4'));
    expect(f.pending?.kind).not.toBe('move');
  });

  it('an Advance stays where it is', () => {
    const s = build(spec('Advance'));
    const f = start(s, (ctx) => turnFlow(s, ctx));
    f.answer({ kind: 'order', card: s.players.allied.hand[0], order: 'Advance' }).answer({ kind: 'activate', units: ['p0'] });
    f.answer({ kind: 'advanceTo', unit: 'p0', to: H('E3') });
    expect(s.blaze[H('E3')]).toBe(true);
    expect(s.pieces.p0.hex).toBe(H('E4'));
  });

  it('a Retreat takes another way toward its edge', () => {
    const s = build(spec());
    run(s, (ctx) => retreat(s, ctx, 'p0', 1), passive);
    expect(s.blaze[H('E3')]).toBe(true);
    expect(s.pieces.p0).toMatchObject({ where: 'map', hex: H('F3') });
  });
});
