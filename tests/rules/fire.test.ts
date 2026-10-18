// Fire (§O20, §11.5, §T88.2, §T99): activation, Fire Groups, Hindrance, height, minimum FP, Jammed!, Targeting for
// Ordnance, mortar minimum range, Airburst, the Defense rolls and their results.
import { describe, expect, it } from 'vitest';
import { answerError } from '../../src/engine/decisions';
import { fireAttack, fireOptions, firePower } from '../../src/engine/fire';
import { turnFlow } from '../../src/engine/flow';
import type { Decision, GameEvent, GameState } from '../../src/engine/types';
import { H, build, card, passive, rolls, run, script, type BuildSpec } from '../support/build';

const G = 'German';
const A = 'American';
type FireEvent = Extract<GameEvent, { kind: 'fireAttack' }>;
type DefenseEvent = Extract<GameEvent, { kind: 'defense' }>;

const attack = (s: GameState, pieces: string[], target: string, mode: 'order' | 'opFire' = 'order') =>
  run(s, (ctx) => fireAttack(s, ctx, 'axis', { pieces, target: H(target) }, mode), passive);

describe('Fire Order activation (§O20.1, §3.3.1.1)', () => {
  const spec: BuildSpec = {
    pieces: [
      { type: 'German/Lt Von Karsties', hex: 'E5' }, // p0, Command 2
      { type: 'German/Rifle Squad', hex: 'E5' }, // p1
      { type: 'German/Rifle Squad', hex: 'E7' }, // p2: 2 hexes away
      { type: 'German/Rifle Squad', hex: 'E8' }, // p3: 3 hexes away
      { type: 'German/Rifle Squad', hex: 'L9' }, // p4: no enemy in Range
      { type: 'American/Line Squad', hex: 'E2' }, // p5
    ],
    axis: { hand: [card(G, { order: 'Fire' })] },
  };

  it('a Leader activates the non-Leader units within its Command radius; others only themselves', () => {
    const s = build(spec);
    const r = run(s, (ctx) => turnFlow(s, ctx), script([{ kind: 'order', card: spec.axis!.hand![0], order: 'Fire' }]));
    const d = r.pending as Extract<Decision, { kind: 'activate' }>;
    expect(d).toMatchObject({ kind: 'activate', order: 'Fire' });
    expect(d.units).not.toContain('p4');
    expect(answerError(s, d, { kind: 'activate', units: ['p0', 'p1', 'p2'] })).toBeNull();
    expect(answerError(s, d, { kind: 'activate', units: ['p0', 'p3'] })).toMatch(/Command radius/);
    expect(answerError(s, d, { kind: 'activate', units: ['p1', 'p2'] })).toMatch(/Only a Leader/);
    expect(answerError(s, d, { kind: 'activate', units: ['p4'] })).not.toBeNull();
  });

  it('cannot be given when no unit has an enemy in LOS and Range (Woods block the only line)', () => {
    const s = build({ ...spec, pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }, { type: 'American/Line Squad', hex: 'E2' }], map: { terrain: { E3: 'Woods' } } });
    const r = run(s, (ctx) => turnFlow(s, ctx), () => undefined);
    expect((r.pending as Extract<Decision, { kind: 'turn' }>).orders).toEqual([]);
  });

  it('each activated piece fires once; the first attack is required; the Order ends when nothing can fire', () => {
    const s = build({
      pieces: [
        { type: 'German/Rifle Squad', hex: 'E5', weapon: 'German/LMG' }, // p0, p1
        { type: 'American/Line Squad', hex: 'E2' }, // p2
      ],
      axis: { hand: [card(G, { order: 'Fire' })], top: rolls(G, [3, 3]) },
      allied: { top: rolls(A, [11, 11]) },
    });
    const c = s.players.axis.hand[0];
    const r = run(s, (ctx) => turnFlow(s, ctx), script([
      { kind: 'order', card: c, order: 'Fire' },
      { kind: 'activate', units: ['p0'] },
      { kind: 'fire', spec: { pieces: ['p0'], target: H('E2') } },
      { kind: 'fire', spec: { pieces: ['p1'], target: H('E2') } },
    ]));
    const fires = r.decisions.filter((d): d is Extract<Decision, { kind: 'fire' }> => d.kind === 'fire');
    expect(fires.map((d) => [d.pieces, !!d.mustFire])).toEqual([[['p0', 'p1'], true], [['p1'], false]]);
    expect(answerError(s, fires[0], { kind: 'done' })).toMatch(/at least one/);
    expect(r.events.filter((e) => e.kind === 'fireAttack')).toHaveLength(2);
    expect(r.pending).toBeNull(); // nothing left to fire, no card left: the Turn ended
    expect(s.turn.activated).toEqual(['p0']);
  });
});

describe('Fire Groups and FP (§O20.3.1, §O20.4)', () => {
  const s = build({
    map: { terrain: { E3: 'Brush', E4: 'Orchard' } },
    pieces: [
      { type: 'German/Rifle Squad', hex: 'F5' }, // p0
      { type: 'German/Rifle Squad', hex: 'F6' }, // p1
      { type: 'German/Rifle Squad', hex: 'F7' }, // p2
      { type: 'German/Line Team', hex: 'F7', weapon: 'German/Light Mortar' }, // p3, p4
      { type: 'American/Line Squad', hex: 'F2' }, // p5
      { type: 'German/Rifle Squad', hex: 'E5' }, // p6
      { type: 'American/Line Squad', hex: 'E2' }, // p7
    ],
  });

  it('X + 1 for each other piece, from hexes that form an adjacent chain', () => {
    expect(firePower(s, { pieces: ['p0'], target: H('F2') })).toBe(5);
    expect(firePower(s, { pieces: ['p0', 'p1', 'p2'], target: H('F2') })).toBe(7);
    const d: Decision = { kind: 'fire', side: 'axis', mode: 'order', pieces: ['p0', 'p1', 'p2', 'p3', 'p4'] };
    expect(answerError(s, d, { kind: 'fire', spec: { pieces: ['p0', 'p2'], target: H('F2') } })).toMatch(/adjacent/);
    expect(answerError(s, d, { kind: 'fire', spec: { pieces: ['p0', 'p1', 'p2'], target: H('F2') } })).toBeNull();
  });

  it('Ordnance never joins a Fire Group', () => {
    const d: Decision = { kind: 'fire', side: 'axis', mode: 'order', pieces: ['p2', 'p3', 'p4'] };
    expect(answerError(s, d, { kind: 'fire', spec: { pieces: ['p2', 'p4'], target: H('F2') } })).toMatch(/Ordnance/);
  });

  it('the largest Hindrance on the LOS is subtracted (not the sum)', () => {
    expect(firePower(s, { pieces: ['p6'], target: H('E2') })).toBe(2); // Brush 3 beats Orchard 2
  });

  it('a shot below 1 FP is refused', () => {
    const t = build({
      map: { terrain: { E3: 'Brush' } },
      pieces: [{ type: 'German/Line Team', hex: 'E5' }, { type: 'American/Line Squad', hex: 'E2' }],
    });
    expect(firePower(t, { pieces: ['p0'], target: H('E2') })).toBe(0);
    const d: Decision = { kind: 'fire', side: 'axis', mode: 'order', pieces: ['p0'] };
    expect(answerError(t, d, { kind: 'fire', spec: { pieces: ['p0'], target: H('E2') } })).toMatch(/FP/);
  });

  it('fireOptions lists single shots and the largest groups per target', () => {
    const o = fireOptions(s, ['p0', 'p1', 'p2', 'p3', 'p4']);
    const f2 = o.get(H('F2'))!.map((x) => x.pieces.join('+'));
    expect(f2).toContain('p0');
    expect(f2).toContain('p4');
    expect(f2).toContain('p0+p1+p2'); // the Team (Range 3) cannot reach F2
  });
});

describe('height (§T88.2, R-13)', () => {
  const s = build({
    map: { elevation: { E5: 2, F5: 1 }, crest: ['E5', 'F5'] },
    pieces: [
      { type: 'German/Rifle Squad', hex: 'E5' }, // p0, level 2
      { type: 'German/Rifle Squad', hex: 'E6' }, // p1, level 0
      { type: 'American/Line Squad', hex: 'F5' }, // p2, level 1
    ],
  });
  it('+1 against a lower target, −1 against a higher one; both in one group', () => {
    expect(firePower(s, { pieces: ['p0'], target: H('F5') })).toBe(6);
    expect(firePower(s, { pieces: ['p1'], target: H('F5') })).toBe(4);
    expect(firePower(s, { pieces: ['p0', 'p1'], target: H('F5') })).toBe(6);
  });
});

describe('the Fire Attack and Defense rolls (§O20.3.3, §O20.3.4)', () => {
  // Rifle Squad FP 5 + 7 (a 1-6) = 12 against Line Teams of Morale 6 in the open
  const spec = (defense: number[]): BuildSpec => ({
    pieces: [
      { type: 'German/Rifle Squad', hex: 'E5' }, // p0
      { type: 'American/Line Team', hex: 'E2' }, // p1
      { type: 'American/Line Team', hex: 'E2' }, // p2
      { type: 'American/Line Team', hex: 'E2' }, // p3
    ],
    axis: { top: rolls(G, [[1, 6]]) },
    allied: { top: rolls(A, defense) },
  });

  it('each unit in the hex rolls: below the total breaks, equal is Suppressed, above is unharmed', () => {
    const s = build(spec([5, 6, 8]));
    const r = attack(s, ['p0'], 'E2');
    const fa = r.events.find((e) => e.kind === 'fireAttack') as FireEvent;
    expect(fa).toMatchObject({ fp: 5, total: 12 });
    const def = r.events.filter((e): e is DefenseEvent => e.kind === 'defense');
    expect(def.map((e) => [e.unit, e.total, e.result])).toEqual([['p1', 11, 'break'], ['p2', 12, 'suppress'], ['p3', 14, 'none']]);
    expect([s.pieces.p1.broken, s.pieces.p2.suppressed, s.pieces.p3.broken, s.pieces.p3.suppressed]).toEqual([true, true, false, false]);
  });

  it('a tie breaks a unit that is activated to Move (R-28)', () => {
    const s = build(spec([6, 8, 8]));
    s.turn.moving = ['p1'];
    attack(s, ['p0'], 'E2');
    expect(s.pieces.p1).toMatchObject({ broken: true, suppressed: false });
  });

  it('a broken unit that breaks again is eliminated', () => {
    const s = build(spec([3, 11, 11]));
    s.pieces.p1.broken = true;
    attack(s, ['p0'], 'E2');
    expect(s.pieces.p1.where).toBe('casualty');
  });

  it('Jammed! breaks every firing Weapon; the attack still happens', () => {
    const s = build({
      pieces: [{ type: 'German/Rifle Squad', hex: 'E5', weapon: 'German/LMG' }, { type: 'American/Line Squad', hex: 'E2' }],
      axis: { top: [card(G, { trigger: 'Jammed' })] },
      allied: { top: rolls(A, [11]) },
    });
    const r = attack(s, ['p0', 'p1'], 'E2');
    expect(s.pieces.p1.broken).toBe(true);
    expect((r.events.find((e) => e.kind === 'fireAttack') as FireEvent).total).toBe(5 + 1 + 2);
    expect(r.events.some((e) => e.kind === 'defense')).toBe(true);
  });

  it('a Weapon cannot fire when its carrier is broken or Suppressed', () => {
    const s = build({
      pieces: [{ type: 'German/Rifle Squad', hex: 'E5', weapon: 'German/LMG', suppressed: true }, { type: 'American/Line Squad', hex: 'E2' }],
    });
    const d: Decision = { kind: 'fire', side: 'axis', mode: 'order', pieces: ['p0', 'p1'] };
    expect(answerError(s, d, { kind: 'fire', spec: { pieces: ['p1'], target: H('E2') } })).not.toBeNull();
    expect(answerError(s, d, { kind: 'fire', spec: { pieces: ['p0'], target: H('E2') } })).toBeNull();
  });
});

describe('Ordnance (§O20.2, §11.5)', () => {
  const mortar = (map: BuildSpec['map'], target: string, top: string[]): BuildSpec => ({
    map,
    pieces: [
      { type: 'German/Line Team', hex: 'E5', weapon: 'German/Light Mortar' }, // p0, p1 (6 FP, range 2-13)
      { type: 'American/Line Squad', hex: target }, // p2
    ],
    axis: { top },
    allied: { top: rolls(A, [11]) },
  });

  it('must hit with a Targeting roll: the product, less the Hindrance, above the range', () => {
    const hit = build(mortar({ terrain: { E3: 'Brush' } }, 'E2', rolls(G, [[2, 4], [1, 2]])));
    const r = attack(hit, ['p1'], 'E2');
    expect(r.events.find((e) => e.kind === 'targeting')).toMatchObject({ product: 8, hit: true });
    // a hit: the Weapon's FP, the Hindrance is not taken off again
    expect(r.events.find((e) => e.kind === 'fireAttack')).toMatchObject({ fp: 6, total: 9 });

    const miss = build(mortar({ terrain: { E3: 'Brush' } }, 'E2', rolls(G, [[2, 3]])));
    const r2 = attack(miss, ['p1'], 'E2');
    expect(r2.events.find((e) => e.kind === 'targeting')).toMatchObject({ product: 6, hit: false });
    expect(r2.events.some((e) => e.kind === 'fireAttack')).toBe(false);
  });

  it('a Mortar has a minimum range', () => {
    const s = build(mortar({}, 'E4', []));
    const d: Decision = { kind: 'fire', side: 'axis', mode: 'order', pieces: ['p0', 'p1'] };
    expect(answerError(s, d, { kind: 'fire', spec: { pieces: ['p1'], target: H('E4') } })).toMatch(/range/i);
    expect(answerError(s, d, { kind: 'fire', spec: { pieces: ['p0'], target: H('E4') } })).toBeNull();
  });

  it('Airburst: a Mortar attack on a Woods hex gets +2', () => {
    const s = build(mortar({ terrain: { E2: 'Woods' } }, 'E2', rolls(G, [[2, 4], [1, 2]])));
    const r = attack(s, ['p1'], 'E2');
    expect(r.events.find((e) => e.kind === 'fireAttack')).toMatchObject({ fp: 6, total: 11 });
  });

  it('Ordnance cannot Op Fire', () => {
    const s = build(mortar({}, 'E2', []));
    const d: Decision = { kind: 'fire', side: 'axis', mode: 'opFire', pieces: ['p0', 'p1'], target: H('E2') };
    expect(answerError(s, d, { kind: 'fire', spec: { pieces: ['p1'], target: H('E2') } })).not.toBeNull();
  });
});

describe('a Squad Deployed by an Event during its own Defense roll (R-53, §E52)', () => {
  // the Allied Line Squad (FP 6) fires at the German Rifle Squad (Morale 7, open); the German Defense roll is a 3-4 with
  // Event!, the Event is Deploy: the Squad becomes two Line Teams while its result (7 + 7 = 14) is pending
  const setup = (attackRoll: [number, number], moving = false) => {
    const ev = card(G, { white: 3, red: 4, trigger: 'Event' });
    const dep = card(G, { event: 'Deploy' }, [ev]);
    const s = build({
      pieces: [{ type: 'American/Line Squad', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'E2' }],
      allied: { top: rolls(A, [attackRoll]) },
      axis: { top: [ev, dep] },
      active: 'allied',
    });
    if (moving) s.turn.moving = ['p1'];
    const r = run(s, (ctx) => fireAttack(s, ctx, 'allied', { pieces: ['p0'], target: H('E2') }, 'order'), script([{ kind: 'choose', items: [0] }]));
    const teams = Object.values(s.pieces).filter((p) => p.type === 'German/Line Team');
    return { s, r, teams };
  };

  it('a pending break applies to both Teams', () => {
    const { s, r, teams } = setup([3, 6]); // 6 + 9 = 15
    expect(s.pieces.p1.where).toBe('mix');
    expect(teams).toHaveLength(2);
    expect(teams.every((t) => t.broken && t.where === 'map' && t.hex === H('E2'))).toBe(true);
    expect(r.events.find((e) => e.kind === 'defense')).toMatchObject({ unit: 'p1', total: 14, attack: 15, result: 'break' });
  });

  it('a pending tie suppresses both Teams, or breaks them when the Squad was activated to Move', () => {
    const tie = setup([2, 6]); // 6 + 8 = 14
    expect(tie.teams.map((t) => [t.broken, t.suppressed])).toEqual([[false, true], [false, true]]);
    const moving = setup([2, 6], true);
    expect(moving.teams.every((t) => t.broken)).toBe(true);
  });

  it('no effect stays no effect', () => {
    const { teams } = setup([1, 2]); // 6 + 3 = 9
    expect(teams.map((t) => [t.broken, t.suppressed])).toEqual([[false, false], [false, false]]);
  });
});
