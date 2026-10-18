// The Advance Order (§O16, §O14.4, §7.2.1): one adjacent hex per activated unit whatever the terrain and MP, enemy hexes
// allowed, Cliffs only without a Weapon, no Water / Blaze, Major Bridges only along their road, exits off the enemy
// edge only, no Op Fire, the 'afterAdvanceEntry' window after each entry.
import { afterEach, describe, expect, it } from 'vitest';
import { answerError } from '../../src/engine/decisions';
import { orderOptions, turnFlow } from '../../src/engine/flow';
import { advanceAnswers } from '../../src/engine/orders/advance';
import { ACTIONS } from '../../src/engine/registry';
import type { Answer, Decision, Side, WindowInfo } from '../../src/engine/types';
import { H, build, card, rolls, start, type BuildSpec, type Responder, type Stepper } from '../support/build';

const G = 'German';
const A = 'American';
const ADVANCE = card(G, { order: 'Advance' });
const FIRE_A = card(A, { order: 'Fire', fireIsAction: true });

type AdvanceD = Extract<Decision, { kind: 'advance' }>;
const to = (unit: string, hex: string): Answer => ({ kind: 'advanceTo', unit, to: H(hex) });
const ad = (f: Stepper) => f.pending as AdvanceD;

function advancing(spec: BuildSpec, units: string[], auto?: Responder): Stepper {
  const s = build({ ...spec, axis: { ...spec.axis, hand: [ADVANCE, ...(spec.axis?.hand ?? [])] } });
  const f = start(s, (ctx) => turnFlow(s, ctx), auto);
  f.answer({ kind: 'order', card: ADVANCE, order: 'Advance' }).answer({ kind: 'activate', units });
  return f;
}

const saved: Partial<typeof ACTIONS> = {};
afterEach(() => Object.assign(ACTIONS, saved));

describe('Advance (§O16)', () => {
  it('each activated unit enters one adjacent hex whatever its cost or the unit\'s MP, and stops there', () => {
    const f = advancing({
      map: { terrain: { E5: 'Woods' }, elevation: { E5: 1 }, hexsides: [['E6', 'E5', 'Wall']] },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E6', broken: true }], // Movement 1
    }, ['p0']);
    expect(ad(f)).toEqual({ kind: 'advance', side: 'axis', units: ['p0'], mustAdvance: true });
    f.answer(to('p0', 'E5'));
    expect(f.s.pieces.p0.hex).toBe(H('E5'));
    expect(f.events.find((e) => e.kind === 'move')).toMatchObject({ units: ['p0'], from: H('E6'), to: H('E5'), mp: 0 });
    expect(f.pending).toBeNull(); // the Order is over (the unit stopped), and so is the Turn
  });

  it('units go one at a time, not necessarily to the same hex; at least one must advance (§O14.4)', () => {
    const f = advancing({
      pieces: [{ type: 'German/Lt Von Karsties', hex: 'E6' }, { type: 'German/Rifle Squad', hex: 'E6' }, { type: 'German/Rifle Squad', hex: 'E7' }],
    }, ['p0', 'p1', 'p2']);
    expect(ad(f).units).toEqual(['p0', 'p1', 'p2']);
    expect(answerError(f.s, f.pending!, { kind: 'done' })).toMatch(/at least one/);
    expect(answerError(f.s, f.pending!, to('p1', 'E4'))).toMatch(/adjacent/);
    f.answer(to('p1', 'E5'));
    expect(ad(f)).toEqual({ kind: 'advance', side: 'axis', units: ['p0', 'p2'] });
    expect(answerError(f.s, f.pending!, to('p1', 'E4'))).toMatch(/not advanced yet/);
    f.answer(to('p2', 'F7')).answer({ kind: 'done' });
    expect([f.s.pieces.p0.hex, f.s.pieces.p1.hex, f.s.pieces.p2.hex]).toEqual([H('E6'), H('E5'), H('F7')]);
    expect(f.pending).toBeNull();
  });

  it('enemy hexes may be entered: the melee follows at the end of the Order', () => {
    const f = advancing({
      pieces: [{ type: 'German/Rifle Squad', hex: 'E6' }, { type: 'American/Line Squad', hex: 'E5' }, { type: 'American/Line Squad', hex: 'L1' }],
      allied: { top: rolls(A, [3]) },
      axis: { top: rolls(G, [10]) },
    }, ['p0']);
    expect(answerError(f.s, f.pending!, to('p0', 'E5'))).toBeNull();
    f.answer(to('p0', 'E5'));
    expect(f.events.find((e) => e.kind === 'melee')).toMatchObject({ hex: H('E5'), losers: ['allied'] });
    expect(f.s.pieces.p1.where).toBe('casualty');
  });

  it('a Cliff may be crossed only by a unit without a Weapon', () => {
    const f = advancing({
      map: { hexsides: [['E6', 'E5', 'Cliff']], elevation: { E5: 1 } },
      pieces: [{ type: 'German/Lt Von Karsties', hex: 'E6' }, { type: 'German/Rifle Squad', hex: 'E6', weapon: 'German/LMG' }, { type: 'German/Rifle Squad', hex: 'E6' }],
    }, ['p0', 'p1', 'p3']);
    expect(answerError(f.s, f.pending!, to('p1', 'E5'))).toMatch(/Weapon/);
    expect(answerError(f.s, f.pending!, to('p3', 'E5'))).toBeNull();
    expect(answerError(f.s, f.pending!, to('p0', 'E5'))).toBeNull();
  });

  it('never into Water Barrier or Blaze; a Major Bridge only across its road hexsides', () => {
    const s0: BuildSpec = {
      map: {
        terrain: { F5: 'Water', E5: 'MajorBridge' },
        pathHexes: { Road: ['E4', 'E5', 'E6'] },
        paths: [['E4', 'E5', 'Road'], ['E5', 'E6', 'Road']],
      },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E6' }, { type: 'German/Rifle Squad', hex: 'D5' }, { type: 'German/Lt Von Karsties', hex: 'E6' }],
    };
    const f = advancing(s0, ['p2', 'p0', 'p1']);
    f.s.blaze[H('D6')] = true;
    expect(answerError(f.s, f.pending!, to('p0', 'F5'))).toMatch(/impassable/); // F5 is adjacent to E6
    expect(answerError(f.s, f.pending!, to('p0', 'D6'))).toMatch(/impassable/);
    expect(answerError(f.s, f.pending!, to('p0', 'E5'))).toBeNull(); // along the road
    expect(answerError(f.s, f.pending!, to('p1', 'E5'))).toMatch(/Major Bridge/); // D5 → E5 crosses no road
  });

  it('exits off the enemy edge (VP, a Time Track space), never off a flank or the own edge', () => {
    const f = advancing({
      pieces: [
        { type: 'German/Lt Von Karsties', hex: 'E2' }, // p0
        { type: 'German/Rifle Squad', hex: 'E1' }, // p1: the Allied (enemy) edge is the top row
        { type: 'German/Rifle Squad', hex: 'A5' }, // p2: a flank
        { type: 'German/Rifle Squad', hex: 'E10' }, // p3: Axis own edge
        { type: 'American/Line Squad', hex: 'L5' },
      ],
      time: 2,
    }, ['p1']);
    expect(answerError(f.s, f.pending!, { kind: 'exit', units: ['p1'] })).toBeNull();
    const g = advancing({ pieces: [{ type: 'German/Rifle Squad', hex: 'A5' }, { type: 'German/Rifle Squad', hex: 'E10' }, { type: 'American/Line Squad', hex: 'L5' }] }, ['p0']);
    expect(answerError(g.s, g.pending!, { kind: 'exit', units: ['p0'] })).toMatch(/enemy edge/);
    expect(advanceAnswers(g.s, ad(g)).some((a) => a.kind === 'exit')).toBe(false);
    f.answer({ kind: 'exit', units: ['p1'] });
    expect(f.s.vp).toBe(2);
    expect(f.pending).toMatchObject({ kind: 'choose', reason: 'exitSpace' });
    f.answer({ kind: 'choose', items: [0] });
    expect(f.s.pieces.p1).toMatchObject({ where: 'time', space: 3 });
  });

  it('no Op Fire against Advancing units; after each entry the \'afterAdvanceEntry\' window opens', () => {
    const seen: [Side, WindowInfo][] = [];
    saved['Hidden Wire'] = ACTIONS['Hidden Wire'];
    ACTIONS['Hidden Wire'] = {
      windows: ['afterAdvanceEntry'],
      options: (_s, side, _w, info) => {
        seen.push([side, structuredClone(info)]);
        return [];
      },
      *run() {},
    };
    const f = advancing({
      pieces: [{ type: 'German/Rifle Squad', hex: 'E7' }, { type: 'American/Line Squad', hex: 'E1' }],
      allied: { hand: [FIRE_A] },
    }, ['p0']);
    f.answer(to('p0', 'E6'));
    expect(f.decisions.some((d) => d.kind === 'react')).toBe(false);
    expect(seen.map(([side]) => side)).toEqual(['allied', 'axis']);
    expect(seen[0][1]).toEqual({ hex: H('E6'), units: ['p0'], mover: 'axis' });
  });

  it('cannot be given when no unit can advance anywhere', () => {
    const water = { D4: 'Water', D5: 'Water', E4: 'Water', E6: 'Water', F4: 'Water', F5: 'Water' } as const;
    const s = build({ map: { terrain: water }, pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }], axis: { hand: [ADVANCE] } });
    expect(orderOptions(s, 'axis')).toEqual([]);
  });
});
