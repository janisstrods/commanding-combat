// Fortifications on the move (§F103 Mines, §F105 Trench, §F106 Wire; R-23, R-52): Mine attacks on units entering and
// leaving by Move, Advance and Retreat, Wire stops, Trench-connected movement; plus the Wire penalties stats.ts and
// fire.ts carry.
import { describe, expect, it } from 'vitest';
import { shooter } from '../../src/engine/fire';
import { turnFlow } from '../../src/engine/flow';
import { mineStrength } from '../../src/engine/forts';
import { currentStats } from '../../src/engine/stats';
import { moveCost } from '../../src/engine/terrain';
import type { Answer, Decision, GameEvent } from '../../src/engine/types';
import { H, build, card, rolls, start, type BuildSpec, type Stepper } from '../support/build';

const G = 'German';
const A = 'American';
const MOVE = card(G, { order: 'Move' });
const ADVANCE = card(G, { order: 'Advance' });
const FIRE_A = card(A, { order: 'Fire', fireIsAction: true });

type DefenseEvent = Extract<GameEvent, { kind: 'defense' }>;
const step = (units: string[], to: string): Answer => ({ kind: 'moveStep', units, to: H(to) });
const defenses = (f: Stepper) => f.events.filter((e): e is DefenseEvent => e.kind === 'defense');

/** The Axis gives `order` with its card, activating `units`. */
function order(spec: BuildSpec, c: string, units: string[]): Stepper {
  const s = build({ ...spec, axis: { ...spec.axis, hand: [c, ...(spec.axis?.hand ?? [])] } });
  const name = c === MOVE ? 'Move' : 'Advance';
  return start(s, (ctx) => turnFlow(s, ctx)).answer({ kind: 'order', card: c, order: name }).answer({ kind: 'activate', units });
}

describe('Mines (§F103)', () => {
  it('attack units entering by Move: 6 FP rolled by the movers\' opponent, Cover 0, one roll for a group', () => {
    const f = order({
      map: { terrain: { E5: 'Orchard' } },
      fort: { E5: 'mines' },
      pieces: [
        { type: 'German/Lt Von Karsties', hex: 'E6', broken: true }, // Command 0 broken: no Defense order to choose
        { type: 'German/Rifle Squad', hex: 'E6' },
        { type: 'German/Rifle Squad', hex: 'E6' },
      ],
      allied: { top: rolls(A, [5]) },
      axis: { top: rolls(G, [3, 4, 6]) },
    }, MOVE, ['p0', 'p1', 'p2']);
    f.answer(step(['p0', 'p1', 'p2'], 'E5'));
    const reveals = f.events.filter((e): e is Extract<GameEvent, { kind: 'reveal' }> => e.kind === 'reveal');
    expect(reveals.map((e) => [e.side, e.purpose])).toEqual([['allied', 'mine'], ['axis', 'defense'], ['axis', 'defense'], ['axis', 'defense']]);
    expect(f.events.find((e) => e.kind === 'fireAttack')).toMatchObject({ side: 'allied', pieces: [], target: H('E5'), fp: 6, total: 11 });
    // Morale + Cover 0 (not the Orchard's 1) + roll; a tie breaks a unit activated to Move (R-23)
    expect(defenses(f).map((e) => [e.unit, e.morale, e.total, e.result])).toEqual([['p0', 10, 13, 'none'], ['p1', 7, 11, 'break'], ['p2', 7, 13, 'none']]);
    expect(f.s.pieces.p1.broken).toBe(true);
  });

  it('a 7- or 8-FP Minefield value of the scenario sets every Mines hex\'s strength', () => {
    expect(mineStrength(build({}))).toBe(6);
    expect(mineStrength(build({ allied: { minefield: 8 } }))).toBe(8);
  });

  it('attack units leaving; a unit broken while leaving still arrives in the hex it was entering', () => {
    const f = order({
      fort: { E6: 'mines' },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E6' }],
      allied: { top: rolls(A, [6]) },
      axis: { top: rolls(G, [3]) },
    }, MOVE, ['p0']);
    f.answer(step(['p0'], 'E5'));
    expect(defenses(f)).toMatchObject([{ unit: 'p0', total: 10, attack: 12, result: 'break' }]);
    expect(f.s.pieces.p0).toMatchObject({ hex: H('E5'), broken: true });
  });

  it('units already in the Mines hex are not attacked when others enter it', () => {
    const f = order({
      fort: { E5: 'mines' },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'E6' }],
      allied: { top: rolls(A, [3]) },
      axis: { top: rolls(G, [8]) },
    }, MOVE, ['p1']);
    f.answer(step(['p1'], 'E5'));
    expect(defenses(f).map((e) => e.unit)).toEqual(['p1']);
  });

  it('a tie Suppresses an Advancing unit instead of breaking it (R-23)', () => {
    const f = order({
      fort: { E5: 'mines' },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E6' }],
      allied: { top: rolls(A, [5]) },
      axis: { top: rolls(G, [4]) },
    }, ADVANCE, ['p0']);
    f.answer({ kind: 'advanceTo', unit: 'p0', to: H('E5') });
    expect(defenses(f)).toMatchObject([{ unit: 'p0', total: 11, attack: 11, result: 'suppress' }]);
    expect(f.s.pieces.p0).toMatchObject({ hex: H('E5'), broken: false, suppressed: true });
  });

  it('Jammed! on the Mine Attack Roll has no effect (Mines are not Weapons)', () => {
    const jam = card(A, { trigger: 'Jammed' });
    const f = order({
      fort: { E5: 'mines' },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E6', weapon: 'German/LMG' }],
      allied: { top: [jam] },
      axis: { top: rolls(G, [9]) },
    }, MOVE, ['p0']);
    f.answer(step(['p0'], 'E5'));
    expect(f.s.pieces.p1.broken).toBe(false);
    expect(f.events.some((e) => e.kind === 'break')).toBe(false);
  });
});

describe('Wire (§F106)', () => {
  it('a Moving unit stops in the Wire hex it enters', () => {
    const f = order({ fort: { E5: 'wire' }, pieces: [{ type: 'German/Rifle Squad', hex: 'E6' }] }, MOVE, ['p0']);
    f.answer(step(['p0'], 'E5'));
    expect(f.s.pieces.p0.hex).toBe(H('E5'));
    expect(f.pending?.kind).not.toBe('move');
  });

  it('starting in Wire it moves exactly one hex, Road bonus and Leader Command notwithstanding (R-52)', () => {
    const f = order({
      fort: { E6: 'wire' },
      map: { pathHexes: { Road: ['E6', 'E5', 'E4'] }, paths: [['E6', 'E5', 'Road'], ['E5', 'E4', 'Road']] },
      pieces: [{ type: 'German/Lt Von Karsties', hex: 'E6' }, { type: 'German/Rifle Squad', hex: 'E6' }],
    }, MOVE, ['p0', 'p1']);
    expect((f.pending as Extract<Decision, { kind: 'move' }>).mp).toEqual({ p0: 6, p1: 6 });
    f.answer(step(['p0', 'p1'], 'E5'));
    expect(f.pending?.kind).not.toBe('move');
    expect(f.s.pieces.p1.hex).toBe(H('E5'));
  });

  it('units in Wire have −1 FP, Range and Morale (Command unchanged); their Weapons cannot fire', () => {
    const s = build({
      fort: { E5: 'wire' },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E5', weapon: 'German/LMG' }, { type: 'German/Sgt Esser', hex: 'F5' }],
    });
    expect(currentStats(s, 'p0')).toMatchObject({ fp: 4, range: 4, morale: 6 });
    expect(shooter(s, 'p1')).toBeNull();
    s.pieces.p2.hex = H('E5');
    expect(currentStats(s, 'p2')).toMatchObject({ fp: 1, range: 0, morale: 7, command: 2 });
  });
});

describe('Trench (§F105)', () => {
  it('Trench-connected hexes cost exactly 1 MP whatever the terrain, hexside or hill; a Cliff still blocks', () => {
    const s = build({
      map: { terrain: { E5: 'Woods' }, elevation: { E5: 1 }, hexsides: [['E6', 'E5', 'Wall'], ['E6', 'F6', 'Cliff']] },
      fort: { E6: 'trench', E5: 'bunker', F6: 'trench' },
    });
    expect(moveCost(s.map, H('E6'), H('E5'), {}, s)).toBe(1);
    expect(moveCost(s.map, H('E6'), H('E5'), {})).toBe(4);
    expect(moveCost(s.map, H('E6'), H('F6'), {}, s)).toBeNull();
  });

  it('a unit moving Trench to Trench cannot be Op Fired in the hex it enters', () => {
    const f = order({
      fort: { E6: 'trench', E5: 'trench' },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E6' }, { type: 'American/Line Squad', hex: 'E2' }],
      allied: { hand: [FIRE_A] },
    }, MOVE, ['p0']);
    f.answer(step(['p0'], 'E5'));
    expect(f.decisions.some((d) => d.kind === 'react')).toBe(false);
    expect((f.pending as Extract<Decision, { kind: 'move' }>).mp.p0).toBe(3);
    f.answer(step(['p0'], 'E4')); // out of the Trench line: Op Fire again
    expect(f.decisions.some((d) => d.kind === 'react' && d.window === 'afterHexEntry')).toBe(true);
  });
});
