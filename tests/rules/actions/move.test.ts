// Actions during a Move Order: the mover's Assault Fire (§A26, R-15) and Smoke Grenades (§A39), offered inside each
// 'move' decision; the Defender's Hidden Mines (§A35.2) and Hidden Wire (§A35.5, R-43) after an enemy hex entry (also
// after an Advance); Op Fire (§A33.3: no Ordnance).
import { describe, expect, it } from 'vitest';
import { answerError } from '../../../src/engine/decisions';
import { turnFlow } from '../../../src/engine/flow';
import { window } from '../../../src/engine/reactions';
import type { Answer, Decision, GameEvent } from '../../../src/engine/types';
import { H, build, card, passive, rolls, run, start, type BuildSpec, type Responder, type Stepper } from '../../support/build';

const G = 'German';
const A = 'American';
const MOVE = card(G, { order: 'Move' });
type MoveD = Extract<Decision, { kind: 'move' }>;
type React = Extract<Decision, { kind: 'react' }>;
const step = (units: string[], to: string): Answer => ({ kind: 'moveStep', units, to: H(to) });
const manual: Responder = (d) => (d.kind === 'reroll' ? { kind: 'reroll', yes: false } : undefined);

/** The Axis gives a Move Order activating `units`. */
function moving(spec: BuildSpec, units: string[], auto: Responder = manual): Stepper {
  const s = build({ ...spec, axis: { ...spec.axis, hand: [MOVE, ...(spec.axis?.hand ?? [])] } });
  const f = start(s, (ctx) => turnFlow(s, ctx), auto);
  f.answer({ kind: 'order', card: MOVE, order: 'Move' }).answer({ kind: 'activate', units });
  return f;
}

/** Answer the pending react decision by playing the option for `action`. */
function playFor(f: Stepper, action: string, targets?: Extract<Answer, { kind: 'play' }>['targets']): Stepper {
  const d = f.pending as React;
  const option = d.options.findIndex((o) => o.action === action);
  expect(option).toBeGreaterThanOrEqual(0);
  return f.answer({ kind: 'play', option, ...(targets ? { targets } : {}) });
}

describe('Assault Fire (§A26, R-15)', () => {
  const AF = card(G, { action: 'Assault Fire' });

  it('one Fire Attack by moving pieces with boxed FP: here the LMG, not the Rifle Squad', () => {
    const f = moving({
      axis: { hand: [AF], top: rolls(G, [8]) },
      allied: { top: rolls(A, [11]) },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E7', weapon: 'German/LMG' }, { type: 'American/Line Squad', hex: 'E3' }],
    }, ['p0']);
    const d = f.pending as MoveD;
    expect(d.actions).toEqual([{ card: AF, action: 'Assault Fire' }]);
    f.answer({ kind: 'play', option: 0 });
    expect(f.pending).toMatchObject({ kind: 'fire', side: 'axis', mode: 'assault', pieces: ['p1'], mustFire: true });
    f.answer({ kind: 'fire', spec: { pieces: ['p1'], target: H('E3') } });
    expect(f.events.find((e) => e.kind === 'fireAttack')).toMatchObject({ pieces: ['p1'], fp: 4, total: 12 });
    expect(f.pending?.kind).toBe('move'); // the move goes on; nobody was activated by it
    expect(f.s.turn.activated).toEqual(['p0']);
  });

  it('boxed-FP Ordnance fires alone with its Targeting roll', () => {
    const f = moving({
      axis: { hand: [AF] },
      pieces: [{ type: 'German/Pionier Squad', hex: 'E4', weapon: 'German/Satchel Charge' }, { type: 'American/Line Squad', hex: 'E3' }],
    }, ['p0']);
    f.answer({ kind: 'play', option: 0 });
    const d = f.pending as Extract<Decision, { kind: 'fire' }>;
    expect(d.pieces).toEqual(['p0', 'p1']);
    expect(answerError(f.s, d, { kind: 'fire', spec: { pieces: ['p0', 'p1'], target: H('E3') } })).toMatch(/Ordnance fires alone/);
    expect(answerError(f.s, d, { kind: 'fire', spec: { pieces: ['p1'], target: H('E3') } })).toBeNull();
  });

  it('not without a boxed-FP piece, nor without an enemy in Range and LOS', () => {
    const plain = moving({ axis: { hand: [AF] }, pieces: [{ type: 'German/Rifle Squad', hex: 'E7' }, { type: 'American/Line Squad', hex: 'E3' }] }, ['p0']);
    expect((plain.pending as MoveD).actions).toBeUndefined();
    const far = moving({ axis: { hand: [AF] }, pieces: [{ type: 'German/Rifle Squad', hex: 'E10', weapon: 'German/LMG' }, { type: 'American/Line Squad', hex: 'E1' }] }, ['p0']);
    expect((far.pending as MoveD).actions).toBeUndefined();
  });
});

describe('Smoke Grenades (§A39)', () => {
  const SG = card(A, { action: 'Smoke Grenades' });
  const MOVE_A = card(A, { order: 'Move' }, [SG]);

  it('a random Smoke marker in or next to a moving unit with boxed Movement (not in Water)', () => {
    const s = build({
      active: 'allied',
      allied: { hand: [MOVE_A, SG] },
      map: { terrain: { E6: 'Stream' } },
      pieces: [{ type: 'American/Line Squad', hex: 'E7' }],
    });
    const f = start(s, (ctx) => turnFlow(s, ctx), manual);
    f.answer({ kind: 'order', card: MOVE_A, order: 'Move' }).answer({ kind: 'activate', units: ['p0'] });
    const d = f.pending as MoveD;
    const hexes = ['E7', 'F6', 'F7', 'E8', 'D7', 'D6'].map(H).sort((a, b) => a - b); // E7 and its neighbours but the Stream
    expect(d.actions).toEqual([{ card: SG, action: 'Smoke Grenades', targets: { hexes } }]);
    const value = s.smokeCup[0];
    f.answer({ kind: 'play', option: 0, targets: { hexes: [H('F6')] } });
    expect(s.smoke[H('F6')]).toBe(value);
    expect(f.events).toContainEqual({ kind: 'place', hex: H('F6'), marker: 'smoke', value });
    expect(f.pending?.kind).toBe('move');
  });

  it('not for a unit without boxed Movement', () => {
    const s = build({ active: 'allied', allied: { hand: [MOVE_A, SG] }, pieces: [{ type: 'American/Weapon Team', hex: 'E7' }] });
    const f = start(s, (ctx) => turnFlow(s, ctx), manual);
    f.answer({ kind: 'order', card: MOVE_A, order: 'Move' }).answer({ kind: 'activate', units: ['p0'] });
    expect((f.pending as MoveD).actions).toBeUndefined();
  });
});

describe('Hidden Mines (§A35.2, R-43)', () => {
  const HM = card(A, { action: 'Hidden Mines' });
  const spec = (posture: 'defend' | 'recon', extra: Partial<BuildSpec> = {}): BuildSpec => ({
    axis: { top: rolls(G, [4]) },
    allied: { posture, hand: [HM], top: rolls(A, [6]) },
    pieces: [{ type: 'German/Rifle Squad', hex: 'E7' }, { type: 'German/Rifle Squad', hex: 'E6' }, { type: 'American/Line Squad', hex: 'L1' }],
    ...extra,
  });

  it('the Defender mines the hex an enemy unit just entered; only the units that entered are attacked', () => {
    const f = moving(spec('defend'), ['p0']);
    f.answer(step(['p0'], 'E6'));
    expect(f.pending).toMatchObject({ kind: 'react', side: 'allied', window: 'afterHexEntry' });
    playFor(f, 'Hidden Mines');
    expect(f.s.fort[H('E6')]).toBe('mines');
    // 6 FP + 6 = 12 against Morale 7 + Cover 0 + 4 = 11: the mover breaks; p1, already there, is not attacked
    expect(f.events.filter((e) => e.kind === 'defense')).toEqual([{ kind: 'defense', unit: 'p0', morale: 7, total: 11, attack: 12, result: 'break' }]);
    expect(f.s.pieces.p0.broken).toBe(true);
    expect(f.s.pieces.p1.broken).toBe(false);
  });

  it('not for an Attacker or Recon player, nor into a hex with a Fortification, nor after the Defender\'s own moves', () => {
    const recon = moving(spec('recon'), ['p0']);
    recon.answer(step(['p0'], 'E6'));
    expect(recon.decisions.some((d) => d.kind === 'react')).toBe(false);
    const dug = moving(spec('defend', { fort: { E6: 'foxholes' } }), ['p0']);
    dug.answer(step(['p0'], 'E6'));
    expect(dug.decisions.some((d) => d.kind === 'react')).toBe(false);
    const s = build({ ...spec('defend'), active: 'allied' });
    const r = run(s, (ctx) => window(s, ctx, 'afterHexEntry', { hex: H('L1'), units: ['p2'], mover: 'allied' }), passive);
    expect(r.decisions).toEqual([]);
  });

  it('after an Advance too', () => {
    const s = build(spec('defend'));
    s.pieces.p0.hex = H('E5');
    const r = run(s, (ctx) => window(s, ctx, 'afterAdvanceEntry', { hex: H('E5'), units: ['p0'], mover: 'axis' }), (d) =>
      d.kind === 'react' ? { kind: 'play', option: 0 } : d.kind === 'reroll' ? { kind: 'reroll', yes: false } : undefined);
    expect(s.fort[H('E5')]).toBe('mines');
    expect(r.events.filter((e) => e.kind === 'defense')).toHaveLength(1);
  });
});

describe('Hidden Wire (§A35.5, R-43)', () => {
  const HW = card(A, { action: 'Hidden Wire' });
  const spec: BuildSpec = {
    allied: { posture: 'defend', hand: [HW] },
    pieces: [{ type: 'German/Rifle Squad', hex: 'E7' }, { type: 'American/Line Squad', hex: 'L1' }],
  };

  it('the Defender wires the hex an enemy unit just entered: the move stops there', () => {
    const f = moving(spec, ['p0']);
    f.answer(step(['p0'], 'E6'));
    playFor(f, 'Hidden Wire');
    expect(f.s.fort[H('E6')]).toBe('wire');
    expect(f.s.pieces.p0.hex).toBe(H('E6'));
    // 3 MP were left, but the Move Order is over: no further 'move' decision
    expect(f.decisions.filter((d) => d.kind === 'move')).toHaveLength(1);
    expect(f.events.filter((e: GameEvent) => e.kind === 'move')).toHaveLength(1);
  });

  it('after an Advance the Wire is placed (Advancing units ignore its MP effect)', () => {
    const s = build(spec);
    const r = run(s, (ctx) => window(s, ctx, 'afterAdvanceEntry', { hex: H('E7'), units: ['p0'], mover: 'axis' }), (d) =>
      d.kind === 'react' ? { kind: 'play', option: 0 } : undefined);
    expect(r.decisions).toHaveLength(1);
    expect(s.fort[H('E7')]).toBe('wire');
  });

  it('not for an Attacker or Recon player', () => {
    const f = moving({ ...spec, allied: { hand: [HW] } }, ['p0']);
    f.answer(step(['p0'], 'E6'));
    expect(f.decisions.some((d) => d.kind === 'react')).toBe(false);
  });
});

describe('Op Fire (§A33.3)', () => {
  it('Ordnance cannot Op Fire; its carrier can', () => {
    const FIRE_A = card(A, { order: 'Fire', fireIsAction: true });
    const f = moving({
      allied: { hand: [FIRE_A] },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E7' }, { type: 'American/Line Squad', hex: 'E2', weapon: 'American/Light Mortar' }],
    }, ['p0']);
    f.answer(step(['p0'], 'E6'));
    playFor(f, 'Fire').answer({ kind: 'activate', units: ['p1'] });
    playFor(f, 'Fire');
    const d = f.pending as Extract<Decision, { kind: 'fire' }>;
    expect(d).toMatchObject({ kind: 'fire', mode: 'opFire', target: H('E6') });
    expect(answerError(f.s, d, { kind: 'fire', spec: { pieces: ['p2'], target: H('E6') } })).toMatch(/Ordnance cannot Op Fire/);
    expect(answerError(f.s, d, { kind: 'fire', spec: { pieces: ['p1'], target: H('E6') } })).toBeNull();
  });
});
