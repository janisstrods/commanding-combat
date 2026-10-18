// The Move Order (§O21) with Op Fire (§A33), exits (§7.2.1) and the restrictions (§O21.4, §O14.4, R-27, R-29).
import { describe, expect, it } from 'vitest';
import { answerError } from '../../src/engine/decisions';
import { turnFlow } from '../../src/engine/flow';
import { ACTIONS } from '../../src/engine/registry';
import type { Answer, Decision } from '../../src/engine/types';
import { H, build, card, rolls, start, type BuildSpec, type Responder, type Stepper } from '../support/build';

const G = 'German';
const A = 'American';
const MOVE = card(G, { order: 'Move' });
const FIRE_A = card(A, { order: 'Fire', fireIsAction: true });

type MoveD = Extract<Decision, { kind: 'move' }>;
const step = (units: string[], to: string): Answer => ({ kind: 'moveStep', units, to: H(to) });
const md = (f: Stepper) => f.pending as MoveD;

/** Give a Move Order activating `units` (the Axis has the Move card). */
function moving(spec: BuildSpec, units: string[], auto?: Responder): Stepper {
  const s = build({ ...spec, axis: { ...spec.axis, hand: [MOVE, ...(spec.axis?.hand ?? [])] } });
  const f = start(s, (ctx) => turnFlow(s, ctx), auto);
  f.answer({ kind: 'order', card: MOVE, order: 'Move' }).answer({ kind: 'activate', units });
  return f;
}

describe('Movement Points (§O21, §O21.1)', () => {
  it('come from current Movement; each hex costs its terrain; a unit needs the MP to enter', () => {
    const f = moving({ map: { terrain: { E4: 'Woods', E3: 'Woods' } }, pieces: [{ type: 'German/Rifle Squad', hex: 'E6' }] }, ['p0']);
    expect(md(f)).toMatchObject({ kind: 'move', units: ['p0'], current: null, mp: { p0: 4 }, mustMove: true });
    f.answer(step(['p0'], 'E5'));
    expect(md(f)).toMatchObject({ current: ['p0'], mp: { p0: 3 } });
    f.answer(step(['p0'], 'E4'));
    expect(md(f).mp.p0).toBe(1);
    expect(answerError(f.s, f.pending!, step(['p0'], 'E3'))).toMatch(/MP/);
    f.answer({ kind: 'done' });
    expect(f.s.pieces.p0.hex).toBe(H('E4'));
    expect(f.events.filter((e) => e.kind === 'move').map((e) => (e as { mp: number }).mp)).toEqual([1, 2]);
  });

  it('hexsides cost +1, entering a higher hex +1 (downhill is free)', () => {
    const f = moving({ map: { hexsides: [['E6', 'E5', 'Wall']], elevation: { E5: 1 } }, pieces: [{ type: 'German/Rifle Squad', hex: 'E6' }] }, ['p0']);
    f.answer(step(['p0'], 'E5'));
    expect(md(f).mp.p0).toBe(1);
    f.answer(step(['p0'], 'E4'));
    expect(f.pending?.kind).not.toBe('move'); // no MP left, nobody else to move: the Order is over
    expect(f.s.pieces.p0.hex).toBe(H('E4'));
  });

  it('Leader Command adds Movement only while the unit is in the Leader\'s hex', () => {
    const f = moving({ pieces: [{ type: 'German/Lt Von Karsties', hex: 'E6' }, { type: 'German/Rifle Squad', hex: 'E6' }] }, ['p0', 'p1']);
    expect(md(f).mp).toEqual({ p0: 6, p1: 6 });
    f.answer(step(['p1'], 'E5'));
    expect(md(f).mp).toEqual({ p1: 3 });
  });

  it('+1 Movement for the rest of the Order once a unit has entered a road hex', () => {
    const f = moving({ map: { pathHexes: { Road: ['E5', 'E4', 'E3'] }, paths: [['E5', 'E4', 'Road'], ['E4', 'E3', 'Road']] }, pieces: [{ type: 'German/Rifle Squad', hex: 'E6' }] }, ['p0']);
    f.answer(step(['p0'], 'E5'));
    expect(md(f).mp.p0).toBe(4);
  });

  it('a group from one hex moves together, as far as its weakest member can; it cannot split (R-27)', () => {
    const f = moving({
      pieces: [
        { type: 'German/Lt Von Karsties', hex: 'E7' }, // p0
        { type: 'German/Rifle Squad', hex: 'E6', weapon: 'German/HMG' }, // p1 (Movement 3), p2
        { type: 'German/Rifle Squad', hex: 'E6' }, // p3
      ],
    }, ['p0', 'p1', 'p3']);
    expect(answerError(f.s, f.pending!, step(['p1', 'p0'], 'E5'))).toMatch(/same hex/);
    f.answer(step(['p1', 'p3'], 'E5'));
    expect(answerError(f.s, f.pending!, step(['p3'], 'E4'))).toMatch(/together/);
    f.answer(step(['p1', 'p3'], 'E4')).answer(step(['p1', 'p3'], 'E3'));
    // the HMG squad has no MP left: the group stops; the Leader may still move
    expect(md(f)).toMatchObject({ units: ['p0'], current: null });
    expect(md(f).mustMove).toBeFalsy();
    expect(answerError(f.s, f.pending!, step(['p3'], 'E2'))).not.toBeNull();
  });

  it('a Weapon handed to a friendly unit in the hex costs 1 MP and is no hex entry (no Op Fire, R-29)', () => {
    const f = moving({
      pieces: [{ type: 'German/Rifle Squad', hex: 'E6', weapon: 'German/LMG' }, { type: 'German/Line Team', hex: 'E6' }, { type: 'American/Line Squad', hex: 'E3' }],
      allied: { hand: [FIRE_A] },
    }, ['p0'], (d) => (d.kind === 'reroll' ? { kind: 'reroll', yes: false } : undefined));
    f.answer({ kind: 'transfer', from: 'p0', to: 'p2' });
    expect(f.s.pieces.p2.weapon).toBe('p1');
    expect(f.s.pieces.p1.carrier).toBe('p2');
    expect(md(f).mp.p0).toBe(3);
    expect(f.decisions.some((d) => d.kind === 'react')).toBe(false);
  });
});

describe('restrictions (§O21.4, §O14.4)', () => {
  it('no enemy hex, no Water Barrier, no Cliff', () => {
    const f = moving({
      map: { terrain: { F5: 'Water' }, hexsides: [['E6', 'F6', 'Cliff']] },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E6' }, { type: 'American/Line Squad', hex: 'E5' }],
    }, ['p0']);
    expect(answerError(f.s, f.pending!, step(['p0'], 'E5'))).toMatch(/enemy/);
    expect(answerError(f.s, f.pending!, step(['p0'], 'F5'))).not.toBeNull();
    expect(answerError(f.s, f.pending!, step(['p0'], 'F6'))).not.toBeNull();
    expect(answerError(f.s, f.pending!, step(['p0'], 'E8'))).toMatch(/adjacent/);
    expect(answerError(f.s, f.pending!, step(['p0'], 'D6'))).toBeNull();
  });

  it('a Move Order must move a unit when one can', () => {
    const f = moving({ pieces: [{ type: 'German/Rifle Squad', hex: 'E6' }] }, ['p0']);
    expect(answerError(f.s, f.pending!, { kind: 'done' })).toMatch(/at least one/);
  });

  it('exit only off the enemy edge, for 1 MP: VP, then a Time Track space; no Op Fire', () => {
    const f = moving({
      pieces: [{ type: 'German/Lt Von Karsties', hex: 'E1' }, { type: 'German/Rifle Squad', hex: 'E1' }, { type: 'German/Rifle Squad', hex: 'A5' }, { type: 'American/Line Squad', hex: 'J1' }],
      allied: { hand: [FIRE_A] },
      time: 2,
    }, ['p0', 'p1']);
    const g = moving({ pieces: [{ type: 'German/Rifle Squad', hex: 'A5' }, { type: 'American/Line Squad', hex: 'J1' }] }, ['p0']);
    expect(answerError(g.s, g.pending!, { kind: 'exit', units: ['p0'] })).toMatch(/enemy edge/);
    f.answer({ kind: 'exit', units: ['p0', 'p1'] });
    expect(f.s.vp).toBe(2 + 3);
    expect(f.pending).toMatchObject({ kind: 'choose', reason: 'exitSpace' });
    f.answer({ kind: 'choose', items: [0] });
    expect(f.s.pieces.p1).toMatchObject({ where: 'time', space: 3 });
    expect(f.decisions.some((d) => d.kind === 'react')).toBe(false);
  });
});

describe('Op Fire (§A33)', () => {
  // the Allies answer reactions themselves in these tests
  const manual: Responder = (d) => (d.kind === 'reroll' ? { kind: 'reroll', yes: false } : undefined);
  const spec = (allied: string[], axisTop: string[] = [], alliedTop = rolls(A, [[1, 5], [1, 2]])): BuildSpec => ({
    pieces: [{ type: 'German/Rifle Squad', hex: 'E7' }, { type: 'American/Line Squad', hex: 'E1' }, { type: 'American/Line Squad', hex: 'L1' }],
    allied: { hand: allied, top: alliedTop },
    axis: { top: axisTop },
  });

  it('after each hex entry: a Fire card activates a unit, then one attack on the hex entered; a tie breaks a mover', () => {
    const f = moving(spec([FIRE_A], rolls(G, [[2, 3]])), ['p0'], manual);
    f.answer(step(['p0'], 'E6')); // E6 is 5 from E1: in the Line Squad's Range 6
    const react = f.pending as Extract<Decision, { kind: 'react' }>;
    expect(react).toMatchObject({ kind: 'react', side: 'allied', window: 'afterHexEntry', options: [{ card: FIRE_A, action: 'Fire' }] });
    f.answer({ kind: 'play', option: 0 });
    expect(f.pending).toMatchObject({ kind: 'activate', side: 'allied', order: 'Op Fire' });
    expect((f.pending as Extract<Decision, { kind: 'activate' }>).units).toEqual(['p1']); // p2 (L1) has no target
    f.answer({ kind: 'activate', units: ['p1'] });
    expect(f.pending).toMatchObject({ kind: 'react', side: 'allied', options: [{ card: '', action: 'Fire' }] });
    f.answer({ kind: 'play', option: 0 });
    expect(f.pending).toMatchObject({ kind: 'fire', side: 'allied', mode: 'opFire', target: H('E6') });
    expect(answerError(f.s, f.pending!, { kind: 'fire', spec: { pieces: ['p1'], target: H('E7') } })).toMatch(/hex just entered/);
    f.answer({ kind: 'fire', spec: { pieces: ['p1'], target: H('E6') } });
    // 6 FP + 6 = 12 against Morale 7 + 5 = 12: a tie breaks a unit activated to Move
    expect(f.events.find((e) => e.kind === 'defense')).toMatchObject({ unit: 'p0', total: 12, attack: 12, result: 'break' });
    expect(f.s.pieces.p0.broken).toBe(true);
    expect(f.s.turn.activated).toEqual(['p0', 'p1']);
  });

  it('activated Op Fire units may fire again at each later entry, once per entry', () => {
    const f = moving(spec([FIRE_A], rolls(G, [[6, 5], [6, 4]])), ['p0'], manual);
    f.answer(step(['p0'], 'E6')).answer({ kind: 'play', option: 0 }).answer({ kind: 'activate', units: ['p1'] });
    f.answer({ kind: 'play', option: 0 }).answer({ kind: 'fire', spec: { pieces: ['p1'], target: H('E6') } });
    expect(f.pending?.kind).toBe('move'); // the one attack of this entry is made: nothing more to offer
    f.answer(step(['p0'], 'E5'));
    expect(f.pending).toMatchObject({ kind: 'react', options: [{ card: '', action: 'Fire' }] });
  });

  it('nobody is asked when the inactive player has no Fire card and no Op Fire units', () => {
    const f = moving(spec([]), ['p0']);
    f.answer(step(['p0'], 'E6')).answer(step(['p0'], 'E5'));
    expect(f.decisions.some((d) => d.kind === 'react')).toBe(false);
  });
});

describe('a moving group split by an Event (Blaze) during its move', () => {
  const manual: Responder = (d) => (d.kind === 'reroll' ? { kind: 'reroll', yes: false } : undefined);

  it('members displaced out of the group\'s hex leave the group and end their move; the Order goes on', () => {
    // The group enters E5 and is Op Fired; the first German Defense roll is a 3-4 with Event!: Blaze in E5 (the
    // Random Hex). Both Squads must leave E5 and go to different hexes.
    const ev = card(G, { white: 3, red: 4, trigger: 'Event' });
    const blaze = card(G, { event: 'Blaze' }, [ev]);
    const e5 = card(G, { hex: 'E5' }, [ev, blaze]);
    const f = moving({
      pieces: [
        { type: 'German/Lt Von Karsties', hex: 'E7' }, // p0
        { type: 'German/Rifle Squad', hex: 'E6' }, // p1
        { type: 'German/Rifle Squad', hex: 'E6' }, // p2
        { type: 'American/Line Squad', hex: 'E1' }, // p3
      ],
      allied: { hand: [FIRE_A], top: rolls(A, [[1, 2]]) },
      axis: { top: [ev, blaze, e5] },
    }, ['p0', 'p1', 'p2'], manual);
    f.answer(step(['p1', 'p2'], 'E5'));
    f.answer({ kind: 'play', option: 0 }).answer({ kind: 'activate', units: ['p3'] }).answer({ kind: 'play', option: 0 });
    f.answer({ kind: 'fire', spec: { pieces: ['p3'], target: H('E5') } });
    expect(f.pending).toMatchObject({ kind: 'choose', reason: 'blazeDisplace', side: 'axis' });
    f.answer({ kind: 'choose', items: [0] });
    f.answer({ kind: 'choose', items: [1] });
    const [h1, h2] = [f.s.pieces.p1.hex, f.s.pieces.p2.hex];
    expect(h1).not.toBe(h2);
    expect(f.s.blaze[H('E5')]).toBe(true);
    // the group is over: only the Leader may still move
    expect(md(f)).toMatchObject({ kind: 'move', units: ['p0'], current: null });
    expect(f.s.turn.move!.done).toEqual(expect.arrayContaining(['p1', 'p2']));
  });

  it('when only some members are moved out, the others go on as the group', () => {
    // stand-in for an effect that moves one member away mid-move: an Allied reaction to the entry puts the Team in D6
    const saved = ACTIONS['Hidden Wire'];
    ACTIONS['Hidden Wire'] = {
      windows: ['afterHexEntry'],
      options: (st, side, _w, info) => (side === 'allied' && info.units?.includes('p2') && st.pieces.p2.hex === H('E6') ? [{ card: '', action: 'Hidden Wire' }] : []),
      *run(st) {
        st.pieces.p2.hex = H('D6');
      },
    };
    try {
      const f = moving({
        pieces: [
          { type: 'German/Lt Von Karsties', hex: 'E7' }, // p0
          { type: 'German/Rifle Squad', hex: 'E7' }, // p1
          { type: 'German/Line Team', hex: 'E7' }, // p2
        ],
      }, ['p0', 'p1', 'p2'], (d) => (d.kind === 'react' ? { kind: 'play', option: 0 } : d.kind === 'reroll' ? { kind: 'reroll', yes: false } : undefined));
      f.answer(step(['p0', 'p1', 'p2'], 'E6'));
      expect(md(f)).toMatchObject({ current: ['p0', 'p1'] });
      f.answer(step(['p0', 'p1'], 'E5'));
      expect(f.s.pieces.p2.hex).toBe(H('D6'));
      expect(f.s.turn.move!.done).toContain('p2');
      expect(md(f)).toMatchObject({ current: ['p0', 'p1'] });
    } finally {
      ACTIONS['Hidden Wire'] = saved;
    }
  });
});
