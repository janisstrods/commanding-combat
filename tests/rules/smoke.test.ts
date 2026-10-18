// Smoke: rounds from Weapons that show Smoke (§O20.2.1) and the stacking of Smoke markers (§8.1, R-42).
import { describe, expect, it } from 'vitest';
import { answerError } from '../../src/engine/decisions';
import { turnFlow } from '../../src/engine/flow';
import { label } from '../../src/engine/hex';
import { smokeOptions } from '../../src/engine/orders/fire';
import { placeRandomSmoke } from '../../src/engine/orders/artillery';
import { placeSmoke } from '../../src/engine/state';
import type { Decision, GameEvent, GameState } from '../../src/engine/types';
import { H, build, card, makeCtx, rolls, start, type BuildSpec, type Stepper } from '../support/build';

const G = 'German';
const A = 'American';
const FIRE = card(G, { order: 'Fire' });
const MORTAR = 'German/Medium Mortar'; // 9 FP, Range 3-16, Smoke

type FireD = Extract<Decision, { kind: 'fire' }>;
const smokeAt = (target: string, pieces = ['p1']) => ({ kind: 'fire' as const, spec: { pieces, target: H(target), smoke: true } });

/** A Line Team with a Medium Mortar (p0, p1) in E8; an American Line Squad (p2) in `enemy` so a Fire Order can be given. */
function mortar(x: BuildSpec = {}, enemy = 'E2'): GameState {
  return build({
    ...x,
    pieces: [{ type: 'German/Line Team', hex: 'E8', weapon: MORTAR }, { type: 'American/Line Squad', hex: enemy }],
    axis: { hand: [FIRE], ...x.axis },
  });
}

/** Give the Fire Order and activate the Team. */
function fireOrder(s: GameState): Stepper {
  const f = start(s, (ctx) => turnFlow(s, ctx));
  return f.answer({ kind: 'order', card: FIRE, order: 'Fire' }).answer({ kind: 'activate', units: ['p0'] });
}

const placed = (f: Stepper) => f.events.filter((e): e is Extract<GameEvent, { kind: 'place' }> => e.kind === 'place' && e.marker === 'smoke');

describe('Smoke rounds (§O20.2.1)', () => {
  it('target any hex in Range and LOS, even without enemy units; a hit places a random Smoke marker, no Fire Attack', () => {
    const s = mortar({ axis: { top: rolls(G, [[2, 3]]) } });
    s.smokeCup = [6, 2, 9];
    const f = fireOrder(s);
    expect(f.pending).toMatchObject({ kind: 'fire', pieces: ['p0', 'p1'], mustFire: true });
    f.answer(smokeAt('E4')); // range 4: 6 hits
    expect(f.events.find((e) => e.kind === 'targeting')).toMatchObject({ piece: 'p1', target: H('E4'), product: 6, need: 5, hit: true });
    expect(s.smoke[H('E4')]).toBe(6);
    expect(placed(f)).toEqual([{ kind: 'place', hex: H('E4'), marker: 'smoke', value: 6 }]);
    expect(s.smokeCup).toEqual([2, 9]);
    expect(f.events.some((e) => e.kind === 'fireAttack')).toBe(false);
    expect(f.pending).toBeNull(); // the Team has nothing in Range: the Order is over
  });

  it('a miss places nothing; the Weapon has fired', () => {
    const s = mortar({ axis: { top: rolls(G, [[1, 4]]) } });
    const f = fireOrder(s);
    f.answer(smokeAt('E4'));
    expect(f.events.find((e) => e.kind === 'targeting')).toMatchObject({ product: 4, hit: false });
    expect(s.smoke[H('E4')]).toBe(0);
    expect(f.pending).toBeNull();
  });

  it('declared before rolling: a hit on a hex with enemy units only places Smoke', () => {
    const s = mortar({ axis: { top: rolls(G, [[2, 4]]) } });
    s.smokeCup = [5];
    const f = fireOrder(s);
    f.answer(smokeAt('E2')); // range 6: 8 hits
    expect(s.smoke[H('E2')]).toBe(5);
    expect(f.events.some((e) => e.kind === 'fireAttack' || e.kind === 'defense')).toBe(false);
  });

  it('the Targeting roll loses the largest Hindrance on the LOS', () => {
    const s = mortar({ map: { terrain: { E6: 'Brush' } }, axis: { top: rolls(G, [[2, 3]]) } });
    const f = fireOrder(s);
    f.answer(smokeAt('E4'));
    expect(f.events.find((e) => e.kind === 'targeting')).toMatchObject({ product: 6, need: 8, hit: false });
  });

  it('a hit in a hex that cannot hold Smoke draws nothing', () => {
    const s = mortar({ map: { terrain: { E4: 'Water' } }, axis: { top: rolls(G, [[2, 3]]) } });
    s.smokeCup = [6, 2];
    const f = fireOrder(s);
    f.answer(smokeAt('E4'));
    expect(f.events.find((e) => e.kind === 'targeting')).toMatchObject({ hit: true });
    expect(s.smoke[H('E4')]).toBe(0);
    expect(s.smokeCup).toEqual([6, 2]);
  });

  it('who may fire Smoke, and where', () => {
    const s = build({
      map: { terrain: { E5: 'Woods' } },
      pieces: [
        { type: 'German/Line Team', hex: 'E8', weapon: MORTAR }, // p0, p1
        { type: 'German/Rifle Squad', hex: 'E8', weapon: 'German/LMG' }, // p2, p3
        { type: 'American/Line Squad', hex: 'J2' }, // p4
      ],
    });
    const d: FireD = { kind: 'fire', side: 'axis', mode: 'order', pieces: ['p0', 'p1', 'p2', 'p3'] };
    expect(answerError(s, d, smokeAt('G6'))).toBeNull();
    expect(answerError(s, d, smokeAt('E6'))).toMatch(/minimum range/);
    expect(answerError(s, d, smokeAt('E3'))).toMatch(/line of sight/i);
    expect(answerError(s, d, smokeAt('G6', ['p0', 'p1']))).toMatch(/alone/);
    expect(answerError(s, d, smokeAt('G6', ['p3']))).toMatch(/cannot fire Smoke/);
    expect(answerError(s, d, smokeAt('G6', ['p0']))).toMatch(/cannot fire Smoke/);
    expect(answerError(s, d, { kind: 'fire', spec: { pieces: ['p1'], target: H('G6') } })).toMatch(/no enemy/);
    const op: FireD = { kind: 'fire', side: 'axis', mode: 'opFire', pieces: ['p0', 'p1'], target: H('G6') };
    expect(answerError(s, op, smokeAt('G6'))).toMatch(/Fire Order/);
    s.pieces.p0.suppressed = true;
    expect(answerError(s, d, smokeAt('G6'))).toMatch(/cannot fire/);
  });

  it('smokeOptions: every hex in Range and LOS that can hold Smoke, for the Fire Order only', () => {
    const s = build({
      map: { terrain: { E5: 'Woods', H3: 'Water' } },
      pieces: [{ type: 'German/Line Team', hex: 'E8', weapon: MORTAR }, { type: 'American/Line Squad', hex: 'J2' }],
    });
    const opts = smokeOptions(s, ['p0', 'p1']);
    const hexes = opts.map((o) => label(o.target));
    expect(opts.every((o) => o.smoke && o.pieces.length === 1 && o.pieces[0] === 'p1')).toBe(true);
    expect(hexes).toEqual(expect.arrayContaining(['J2', 'G6', 'A1', 'O10']));
    for (const h of ['E8', 'E7', 'E6', 'E3', 'F2', 'H3']) expect(hexes).not.toContain(h);
    expect(smokeOptions(s, ['p0', 'p1'], 'opFire')).toEqual([]);
  });

  it('the Fire Order goes on while a Weapon can still fire Smoke, though no enemy is in its Range', () => {
    const s = mortar({ axis: { top: rolls(G, [[1, 2], [2, 3]]) }, allied: { top: rolls(A, [11]) } }, 'E6');
    s.smokeCup = [8];
    const f = fireOrder(s); // the enemy in E6 is inside the Mortar's minimum range
    expect((f.pending as FireD).pieces).toEqual(['p0', 'p1']);
    f.answer({ kind: 'fire', spec: { pieces: ['p0'], target: H('E6') } });
    expect(f.pending).toMatchObject({ kind: 'fire', pieces: ['p1'] });
    expect((f.pending as FireD).mustFire).toBeUndefined();
    f.answer(smokeAt('E3'));
    expect(s.smoke[H('E3')]).toBe(8);
    expect(f.pending).toBeNull();
  });
});

describe('Smoke markers stack one per hex: the larger stays (§8.1, R-42)', () => {
  const s0 = () => {
    const s = build({ map: { terrain: { B1: 'Water', B2: 'Stream', B3: 'Marsh' } } });
    s.smokeCup = [];
    return s;
  };
  const ctx = () => makeCtx([]);

  it('a larger Smoke replaces the one there, which goes back to the cup', () => {
    const s = s0();
    s.smoke[H('E4')] = 3;
    expect(placeSmoke(s, ctx(), H('E4'), 5)).toBe(true);
    expect(s.smoke[H('E4')]).toBe(5);
    expect(s.smokeCup).toEqual([3]);
  });

  it('an equal or smaller one goes back to the cup (ties keep the one present)', () => {
    const s = s0();
    s.smoke[H('E4')] = 5;
    expect(placeSmoke(s, ctx(), H('E4'), 5)).toBe(false);
    expect(placeSmoke(s, ctx(), H('E4'), 2)).toBe(false);
    expect(s.smoke[H('E4')]).toBe(5);
    expect(s.smokeCup.slice().sort()).toEqual([2, 5]);
  });

  it('never in Water, Stream, Marsh or Blaze', () => {
    const s = s0();
    s.blaze[H('C3')] = true;
    for (const h of ['B1', 'B2', 'B3', 'C3']) expect(placeSmoke(s, ctx(), H(h), 4)).toBe(false);
    expect(s.smokeCup).toEqual([4, 4, 4, 4]);
  });

  it('placeRandomSmoke draws the top marker of the cup; nothing is drawn for a hex that cannot hold Smoke', () => {
    const s = s0();
    s.smokeCup = [7, 1];
    const events: GameEvent[] = [];
    expect(placeRandomSmoke(s, makeCtx(events), H('B1'))).toBe(false);
    expect(s.smokeCup).toEqual([7, 1]);
    expect(placeRandomSmoke(s, makeCtx(events), H('E4'))).toBe(true);
    expect(s.smoke[H('E4')]).toBe(7);
    expect(s.smokeCup).toEqual([1]);
    expect(events).toEqual([{ kind: 'place', hex: H('E4'), marker: 'smoke', value: 7 }]);
    s.smokeCup = [];
    expect(placeRandomSmoke(s, makeCtx(events), H('E5'))).toBe(false);
  });
});
