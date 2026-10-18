// The AI's battle plan (src/ai/battleplan.ts): the Objective and the units it chooses, made from its own view only, the
// re-plan triggers, the evaluation term, and its life in the AI's memory.
import { describe, expect, it } from 'vitest';
import { describePlan, makePlan, planTerm, replanReason, type BattlePlan } from '../../src/ai/battleplan';
import { evaluateParts, weightsFor } from '../../src/ai/evaluate';
import { chooseAnswer, newMemory } from '../../src/ai/index';
import { turnFlow } from '../../src/engine/flow';
import { distance } from '../../src/engine/hex';
import { redact } from '../../src/engine/state';
import type { Decision, GameState } from '../../src/engine/types';
import { H, build, card, run, type BuildSpec } from '../support/build';

// Objectives 1–3 and 5 out of the way at the top edge; Objective 4 in the middle (H5)
const OBJ = ['A1', 'B1', 'C1', 'H5', 'O1'];

const attack = (extra: Partial<BuildSpec> = {}): GameState =>
  build({
    map: { objectives: OBJ },
    axis: { posture: 'attack', ...(extra.axis ?? {}) },
    allied: { posture: 'defend', ...(extra.allied ?? {}) },
    control: ['allied', 'allied', 'allied', 'allied', 'allied'],
    openChits: ['N'], // Objective 4: 4 VP
    pieces: [
      { type: 'German/Rifle Squad', hex: 'G9' }, // p0
      { type: 'German/Rifle Squad', hex: 'H9' }, // p1
      { type: 'German/Rifle Squad', hex: 'I9', weapon: 'German/LMG' }, // p2, p3
      { type: 'German/Rifle Squad', hex: 'J9' }, // p4
      { type: 'German/Lt Von Karsties', hex: 'H9' }, // p5
      { type: 'American/Line Squad', hex: 'H4' }, // p6
      { type: 'American/Line Squad', hex: 'B2' }, // p7
    ],
    ...extra,
  });

const plan = (s: GameState, side: 'axis' | 'allied' = 'axis', prev: BattlePlan | null = null) => makePlan(redact(s, side), side, 'first plan', prev)!;

describe('choosing the plan', () => {
  it('an attacker goes for the valuable Objective near its force, with about half its units and a Leader', () => {
    const p = plan(attack());
    expect(p.target).toBe(3);
    expect(p.aim).toBe('take');
    expect(p.main).toContain('p5');
    expect(p.main.length).toBeGreaterThanOrEqual(3);
    expect(p.main.length).toBeLessThan(5);
    expect(p.posts.length).toBeGreaterThan(0);
    expect(p.posts).not.toContain(H('H5'));
    expect(p.by).toBeGreaterThan(0);
  });

  it('its own secret chit can make another Objective the target', () => {
    // Q: Objective 5 is worth 5 more VP to the Germans (only they know)
    const s = attack({ axis: { posture: 'attack', secretChits: ['Q', 'P'] }, map: { objectives: ['A1', 'B1', 'C1', 'H5', 'K7'] } });
    expect(plan(s).target).toBe(4);
  });

  it('is made from its own view only: the enemy secret chits and hand change nothing', () => {
    const a = attack({ allied: { posture: 'defend', secretChits: ['Q'], hand: [card('American', { order: 'Fire' })] } });
    const b = attack({ allied: { posture: 'defend', secretChits: ['A'], hand: [card('American', { order: 'Move' })] } });
    expect(plan(a)).toEqual(plan(b));
  });

  it('a defender holds the Objective the enemy threatens', () => {
    const s = build({
      map: { objectives: OBJ },
      axis: { posture: 'defend' },
      allied: { posture: 'attack' },
      control: ['axis', 'axis', null, 'axis', null],
      openChits: ['N'],
      pieces: [
        { type: 'German/Rifle Squad', hex: 'H5' }, // p0
        { type: 'German/Rifle Squad', hex: 'H6' }, // p1
        { type: 'German/Rifle Squad', hex: 'B1' }, // p2: on Objective 2
        { type: 'American/Line Squad', hex: 'H3' }, // p3
        { type: 'American/Line Squad', hex: 'G3' }, // p4
        { type: 'American/Line Squad', hex: 'I3' }, // p5
      ],
    });
    const p = plan(s);
    expect(p).toMatchObject({ target: 3, aim: 'hold' });
    // the lone garrison of Objective 2 stays out of the main effort
    expect(p.main).not.toContain('p2');
    expect(p.main).toEqual(expect.arrayContaining(['p0', 'p1']));
  });

  it('a re-plan keeps the old target unless another is clearly better', () => {
    const s = attack({ map: { objectives: ['A1', 'B1', 'C1', 'H5', 'K5'] }, openChits: ['N', 'P'] });
    const first = plan(s);
    const other: BattlePlan = { ...first, target: first.target === 3 ? 4 : 3 };
    expect(plan(s, 'axis', other).target).toBe(other.target);
  });
});

describe('re-plan triggers', () => {
  const base = () => {
    const s = attack({
      pieces: [
        { type: 'German/Rifle Squad', hex: 'G9' },
        { type: 'German/Rifle Squad', hex: 'H9' },
        { type: 'German/Rifle Squad', hex: 'I9', weapon: 'German/LMG' },
        { type: 'German/Rifle Squad', hex: 'J9' },
        { type: 'German/Lt Von Karsties', hex: 'H9' },
        { type: 'American/Line Squad', hex: 'H4' },
        { type: 'American/Line Squad', hex: 'B2' },
        { type: 'American/Line Squad', where: 'time', space: 3 },
      ],
    });
    return { s, p: plan(s) };
  };
  const why = (s: GameState, p: BattlePlan) => replanReason(redact(s, 'axis'), 'axis', p);

  it('none while nothing has changed', () => {
    const { s, p } = base();
    expect(why(s, p)).toBeNull();
  });

  it('the target taken', () => {
    const { s, p } = base();
    s.control[p.target] = 'axis';
    expect(why(s, p)).toBe('target taken');
  });

  it('half the main effort broken', () => {
    const { s, p } = base();
    for (const id of p.main.slice(0, Math.ceil(p.main.length / 2))) s.pieces[id].broken = true;
    expect(why(s, p)).toMatch(/^main effort broken/);
  });

  it('a big VP swing', () => {
    const { s, p } = base();
    s.vp -= 6;
    expect(why(s, p)).toMatch(/^VP swing/);
  });

  it('an Objective chit revealed or changed', () => {
    const { s, p } = base();
    s.openChits.push('S');
    expect(why(s, p)).toBe('Objective chit revealed or changed');
  });

  it('Sudden Death near', () => {
    const { s, p } = base();
    s.time = s.suddenDeath - 2;
    expect(why(s, p)).toBe('Sudden Death near');
  });

  it('reinforcements arriving from the Time Track, but not Teams a Deploy makes', () => {
    const { s, p } = base();
    const r = Object.values(s.pieces).find((x) => x.where === 'time')!;
    r.where = 'map';
    r.hex = H('H1');
    r.space = -1;
    expect(why(s, p)).toBe('reinforcements arrived (1)');
    r.where = 'time';
    r.hex = -1;
    const team = { ...s.pieces.p0, id: 'p99', type: 'German/Line Team', hex: H('G9') };
    s.pieces.p99 = team;
    expect(why(s, p)).toBeNull();
  });
});

describe('the plan in the evaluation', () => {
  it('scores the main effort closing on the target and the support group in a firing position', () => {
    const s = attack();
    const p = plan(s);
    const before = planTerm(s, 'axis', p);
    const mover = p.main.find((id) => id !== 'p5')!;
    s.pieces[mover].hex = H('H6');
    const closer = planTerm(s, 'axis', p);
    expect(closer).toBeGreaterThan(before);
    expect(p.support.length).toBeGreaterThan(0);
    const sup = s.pieces[p.support[0]];
    sup.hex = H('O10'); // out of range: no credit
    const away = planTerm(s, 'axis', p);
    sup.hex = p.posts.find((h) => distance(h, H('H5')) === 3)!;
    expect(planTerm(s, 'axis', p)).toBeCloseTo(away + 0.35 * 0.5); // in the open: half
    const parts = evaluateParts(s, 'axis', weightsFor(s, 'axis'), { battle: p });
    expect(parts.plan).toBeCloseTo(planTerm(s, 'axis', p));
    expect(evaluateParts(s, 'axis', weightsFor(s, 'axis')).plan).toBe(0);
  });
});

describe('the assault zone (Line and Elite: zone 4)', () => {
  it('counts the main effort only within the zone, and the support group only once the main effort is there', () => {
    const s = attack();
    const p = makePlan(redact(s, 'axis'), 'axis', 'first plan', null, 4)!;
    expect(p.zone).toBe(4);
    // the main effort out of the zone (H10 is 5 hexes from H5), the support group in firing positions
    for (const id of p.main) s.pieces[id].hex = H('H10');
    for (const id of p.support) s.pieces[id].hex = p.posts.find((h) => distance(h, H('H5')) === 3)!;
    expect(planTerm(s, 'axis', p)).toBe(0);
    s.pieces[p.main[0]].hex = H('H7');
    const inside = planTerm(s, 'axis', p);
    expect(inside).toBeGreaterThan(0.35 * 0.5 * p.support.length - 1e-9);
    s.pieces[p.main[0]].hex = H('H6');
    expect(planTerm(s, 'axis', p)).toBeGreaterThan(inside);
  });
});

describe('closing in by bounds', () => {
  it('a main-effort unit counts more in Cover than in the open at the same distance', () => {
    const s = attack({ map: { objectives: OBJ, terrain: { H7: 'Woods' } } });
    const p = plan(s);
    const mover = s.pieces[p.main.find((id) => id !== 'p5')!];
    mover.hex = H('G7');
    const open = planTerm(s, 'axis', p);
    mover.hex = H('H7');
    expect(distance(H('G7'), H('H5'))).toBe(distance(H('H7'), H('H5')));
    expect(planTerm(s, 'axis', p)).toBeGreaterThan(open);
  });
});

describe('the plan in the AI memory', () => {
  const turnState = () => {
    const s = attack({ axis: { posture: 'attack', hand: [card('German', { order: 'Move' }), card('German', { order: 'Fire' })] } });
    const r = run(s, (ctx) => turnFlow(s, ctx), () => undefined);
    return { s, d: r.pending as Extract<Decision, { kind: 'turn' }> };
  };
  const opts = { side: 'axis' as const, level: 'line' as const, seed: 3, deterministic: true, patch: { worlds: 3, minSims: 2, maxCands: 4 } };

  it('is made at the first own Turn, logged, and kept while nothing changes', () => {
    const { s, d } = turnState();
    const mem = newMemory(3);
    chooseAnswer(redact(s, 'axis'), d, opts, mem);
    expect(mem.battle).not.toBeNull();
    expect(mem.log).toHaveLength(1);
    expect(mem.log[0]).toMatch(/^T1 axis plan \[first plan\]: take Objective 4/);
    const kept = mem.battle;
    chooseAnswer(redact(s, 'axis'), d, opts, mem);
    expect(mem.battle).toBe(kept);
    expect(mem.log).toHaveLength(1);
    s.vp -= 8;
    chooseAnswer(redact(s, 'axis'), d, opts, mem);
    expect(mem.log).toHaveLength(2);
    expect(mem.log[1]).toMatch(/re-plan \[VP swing/);
  });

  it('Green keeps no plan', () => {
    const { s, d } = turnState();
    const mem = newMemory(3);
    chooseAnswer(redact(s, 'axis'), d, { ...opts, level: 'green' }, mem);
    expect(mem.battle).toBeNull();
  });

  it('describes a plan in one line', () => {
    const s = attack();
    const p = plan(s);
    expect(describePlan(s, 'axis', p, null)).toMatch(/plan \[first plan\]: take Objective 4 \(H5, worth 5\.2\) by Time \d+/);
  });
});
