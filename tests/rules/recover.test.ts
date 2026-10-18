// The Recover Order (§O22, §T78.3): player activation, Suppressed markers off, Rally rolls for the units broken at the
// announcement (owner's order), roll < Morale rallies, a tie suppresses.
import { describe, expect, it } from 'vitest';
// flow first: importing activation.ts first leaves ORDERS.Move a stub (an import cycle; see the Task 7 report)
import { orderOptions, turnFlow } from '../../src/engine/flow';
import { activationCandidates } from '../../src/engine/activation';
import { CARDS } from '../../src/engine/data';
import { routTargets } from '../../src/engine/orders/rout';
import type { Decision, GameEvent } from '../../src/engine/types';
import { build, card, cardsWhere, rolls, start, type BuildSpec, type Stepper } from '../support/build';

const G = 'German';
const RECOVER = cardsWhere(G, { order: 'Recover' });
const ROUT = card(G, { order: 'Rout' });
const MOVE = card(G, { order: 'Move' });
const HANDS = [...RECOVER, ROUT, MOVE];

type RevealEvent = Extract<GameEvent, { kind: 'reveal' }>;
const rallyRolls = (f: Stepper) => f.events.filter((e): e is RevealEvent => e.kind === 'reveal' && e.purpose === 'rally');

function recovering(spec: BuildSpec): Stepper {
  const s = build({ ...spec, axis: { ...spec.axis, hand: [RECOVER[0], ...(spec.axis?.hand ?? [])] } });
  return start(s, (ctx) => turnFlow(s, ctx)).answer({ kind: 'order', card: RECOVER[0], order: 'Recover' });
}

describe('Recover (§O22)', () => {
  it('can be given only with a broken or Suppressed unit', () => {
    const none = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }], axis: { hand: [RECOVER[0]] } });
    expect(orderOptions(none, 'axis')).toEqual([]);
    const some = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'E5', suppressed: true }], axis: { hand: [RECOVER[0]] } });
    expect(orderOptions(some, 'axis')).toEqual([{ card: RECOVER[0], order: 'Recover' }]);
  });

  it('removes every Suppressed marker, then each broken unit rolls: < Morale rallies, = Suppressed, > nothing', () => {
    const f = recovering({
      pieces: [
        { type: 'German/Rifle Squad', hex: 'E5', broken: true }, // p0: broken Morale 7
        { type: 'German/Rifle Squad', hex: 'G5', broken: true, suppressed: true }, // p1
        { type: 'German/Rifle Squad', hex: 'J5', broken: true }, // p2
        { type: 'German/Rifle Squad', hex: 'L5', suppressed: true }, // p3
        { type: 'American/Line Squad', hex: 'E1' },
      ],
      axis: { top: rolls(G, [6, 7, 8], HANDS), hand: [RECOVER[1], MOVE] },
    });
    expect(rallyRolls(f).map((e) => e.side)).toEqual(['axis', 'axis', 'axis']);
    const st = (id: string) => [f.s.pieces[id].broken, f.s.pieces[id].suppressed];
    expect([st('p0'), st('p1'), st('p2'), st('p3')]).toEqual([[false, false], [true, true], [true, false], [false, false]]);
    // the player was activated, not his units: they may take another Order; a second Recover cannot be given
    expect(f.s.turn.playerActivations).toEqual(['axis>axis']);
    expect(activationCandidates(f.s, 'axis', 'Move')).toEqual(['p0', 'p2', 'p3']); // p1: broken and Suppressed, 0 MP
    expect((f.pending as Extract<Decision, { kind: 'turn' }>).orders.some((o) => o.order === 'Recover')).toBe(false);
  });

  it('Cover and Leader Command count toward the Morale', () => {
    const f = recovering({
      map: { terrain: { E5: 'Woods' } },
      pieces: [{ type: 'German/Lt Von Karsties', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'E5', broken: true }],
      axis: { top: rolls(G, [10], HANDS) },
    });
    expect(f.s.pieces.p1.broken).toBe(false); // 10 < 7 + Woods 2 + Command 2
  });

  it('units broken during the Order do not roll', () => {
    const sniper = card(G, { trigger: 'Sniper', white: 4, red: 4 }); // 8: no effect on Morale 7
    const hexCard = cardsWhere(G, { trigger: null }).find((c) => !HANDS.includes(c))!;
    const hex = CARDS[hexCard].hex;
    const s = build({
      pieces: [{ type: 'German/Rifle Squad', hex, broken: true }, { type: 'German/Rifle Squad', hex }, { type: 'American/Line Squad', hex: 'L1' }],
      axis: { hand: [RECOVER[0]], top: [sniper, hexCard] },
    });
    const f = start(s, (ctx) => turnFlow(s, ctx), (d, st) => {
      if (d.kind === 'reroll') return { kind: 'reroll', yes: false };
      if (d.kind === 'react') return { kind: 'done' };
      if (d.kind === 'choose' && d.reason === 'sniperTarget') return { kind: 'choose', items: [d.items.findIndex((i) => 'piece' in i && i.piece === 'p1')] };
      return undefined;
    }).answer({ kind: 'order', card: RECOVER[0], order: 'Recover' });
    expect(f.s.pieces.p1.broken).toBe(true);
    expect(rallyRolls(f)).toHaveLength(1);
  });

  it('the owner picks the order while a broken Leader could lend its Command to another', () => {
    const f = recovering({
      pieces: [{ type: 'German/Lt Von Karsties', hex: 'E5', broken: true }, { type: 'German/Rifle Squad', hex: 'E5', broken: true }],
      axis: { top: rolls(G, [5, 8], HANDS) },
    });
    expect(f.pending).toMatchObject({ kind: 'choose', side: 'axis', reason: 'rallyOrder', items: [{ piece: 'p0' }, { piece: 'p1' }] });
    f.answer({ kind: 'choose', items: [0] });
    // the Leader rallies (5 < 10), then the Squad has Morale 7 + 2: 8 rallies it
    expect([f.s.pieces.p0.broken, f.s.pieces.p1.broken]).toEqual([false, false]);
  });

  it('excludes a Rout on himself in the same Turn, and is excluded by one', () => {
    const f = recovering({
      pieces: [{ type: 'German/Rifle Squad', hex: 'E5', broken: true }, { type: 'American/Line Squad', hex: 'E1', broken: true }],
      axis: { top: rolls(G, [9], HANDS) },
    });
    expect(routTargets(f.s, 'axis')).toEqual(['allied']);
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'E5', broken: true }], axis: { hand: [ROUT, RECOVER[0]] } });
    s.turn.playerActivations.push('axis>axis');
    expect(orderOptions(s, 'axis')).toEqual([]);
  });
});
