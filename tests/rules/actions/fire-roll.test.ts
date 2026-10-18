// The Actions played by the firing player just before a Fire Attack Roll (§A24 timing table): Bore Sighting (§A27),
// Crossfire (§A30), Hand Grenades (§A34), Marksmanship (§A37), Spray Fire (§A40, R-19), Sustained Fire (§A41).
import { describe, expect, it } from 'vitest';
import { fireAttack } from '../../../src/engine/fire';
import type { Answer, Decision, GameEvent, GameState, Side } from '../../../src/engine/types';
import { H, build, card, rolls, run, script, type BuildSpec } from '../../support/build';

const G = 'German';
const A = 'American';
type React = Extract<Decision, { kind: 'react' }>;
type FireEvent = Extract<GameEvent, { kind: 'fireAttack' }>;

function fire(s: GameState, pieces: string[], target: string, answers: Answer[] = [], side: Side = 'axis', mode: 'order' | 'opFire' = 'order') {
  const r = run(s, (ctx) => fireAttack(s, ctx, side, { pieces, target: H(target) }, mode), script(answers));
  const reacts = r.decisions.filter((d): d is React => d.kind === 'react' && d.window === 'beforeFireAttackRoll');
  const shot = r.events.find((e): e is FireEvent => e.kind === 'fireAttack');
  return { ...r, reacts, shot };
}

const play = (option = 0, targets?: { hexes?: number[] }): Answer => ({ kind: 'play', option, ...(targets ? { targets } : {}) });

describe('Bore Sighting (§A27)', () => {
  const BS = card(G, { action: 'Bore Sighting' });
  const spec = (posture: 'defend' | 'attack', weapon: string): BuildSpec => ({
    axis: { posture, hand: [BS], top: rolls(G, [7]) },
    allied: { top: rolls(A, [11]) },
    pieces: [{ type: 'German/Rifle Squad', hex: 'E5', weapon }, { type: 'American/Line Squad', hex: 'E2' }],
  });

  it('the scenario Defender adds 2 FP when a firing Weapon has printed FP 5 or more', () => {
    const s = build(spec('defend', 'German/HMG'));
    const r = fire(s, ['p1'], 'E2', [play()]);
    expect(r.reacts[0]).toMatchObject({ side: 'axis', options: [{ card: BS, action: 'Bore Sighting' }] });
    expect(r.shot).toMatchObject({ fp: 8 + 2, total: 8 + 2 + 7 });
  });

  it('never for an Attacker, nor with a smaller Weapon', () => {
    expect(fire(build(spec('attack', 'German/HMG')), ['p1'], 'E2').reacts).toEqual([]);
    expect(fire(build(spec('defend', 'German/LMG')), ['p0', 'p1'], 'E2').reacts).toEqual([]);
  });
});

describe('Crossfire (§A30)', () => {
  const CF = card(G, { action: 'Crossfire' });
  const spec: BuildSpec = {
    active: 'allied',
    axis: { hand: [CF], top: rolls(G, [7]) },
    allied: { top: rolls(A, [11]) },
    pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }, { type: 'American/Line Squad', hex: 'E2' }],
  };

  it('+2 FP against a hex holding a unit activated to Move', () => {
    const s = build(spec);
    s.turn.moving = ['p1'];
    const r = fire(s, ['p0'], 'E2', [play()], 'axis', 'opFire');
    expect(r.reacts[0].options).toEqual([{ card: CF, action: 'Crossfire' }]);
    expect(r.shot).toMatchObject({ fp: 5 + 2 });
  });

  it('not when nobody in the target hex is moving', () => {
    expect(fire(build(spec), ['p0'], 'E2').reacts).toEqual([]);
  });
});

describe('Hand Grenades (§A34)', () => {
  const HG = card(G, { action: 'Hand Grenades' });
  const spec = (hexes: string[]): BuildSpec => ({
    axis: { hand: [HG], top: rolls(G, [7]) },
    allied: { top: rolls(A, [11]) },
    pieces: [...hexes.map((hex) => ({ type: 'German/Rifle Squad', hex })), { type: 'American/Line Squad', hex: 'E2' }],
  });

  it('+2 FP when a firing piece is adjacent to the target (one hex of a Fire Group is enough)', () => {
    const r = fire(build(spec(['E3', 'E4'])), ['p0', 'p1'], 'E2', [play()]);
    expect(r.reacts[0].options).toEqual([{ card: HG, action: 'Hand Grenades' }]);
    expect(r.shot).toMatchObject({ fp: 5 + 1 + 2 });
  });

  it('not from two hexes away', () => {
    expect(fire(build(spec(['E4'])), ['p0'], 'E2').reacts).toEqual([]);
  });
});

describe('Marksmanship (§A37)', () => {
  const MK = card(G, { action: 'Marksmanship' });
  const spec: BuildSpec = {
    axis: { hand: [MK], top: rolls(G, [7]) },
    allied: { top: rolls(A, [11]) },
    pieces: [{ type: 'German/Rifle Squad', hex: 'E5', weapon: 'German/HMG' }, { type: 'American/Line Squad', hex: 'E2' }],
  };

  it('+2 FP when a German Squad or Team fires', () => {
    const r = fire(build(spec), ['p0', 'p1'], 'E2', [play()]);
    expect(r.reacts[0].options).toEqual([{ card: MK, action: 'Marksmanship' }]);
    expect(r.shot).toMatchObject({ fp: 8 + 1 + 2 });
  });

  it('not for a Weapon firing on its own', () => {
    expect(fire(build(spec), ['p1'], 'E2').reacts).toEqual([]);
  });
});

describe('Sustained Fire (§A41)', () => {
  const SF = card(G, { action: 'Sustained Fire' });
  const spec = (dice: [number, number]): BuildSpec => ({
    axis: { hand: [SF], top: rolls(G, [dice]) },
    allied: { top: rolls(A, [11]) },
    pieces: [{ type: 'German/Rifle Squad', hex: 'E5', weapon: 'German/LMG' }, { type: 'American/Line Squad', hex: 'E2' }],
  });

  it('+2 FP when an MG or Mortar fires; doubles then break the MG', () => {
    const s = build(spec([2, 2]));
    const r = fire(s, ['p0', 'p1'], 'E2', [play()]);
    expect(r.reacts[0].options).toEqual([{ card: SF, action: 'Sustained Fire' }]);
    expect(r.shot).toMatchObject({ fp: 5 + 1 + 2 });
    expect(s.pieces.p1.broken).toBe(true);
  });

  it('no doubles, no break; not offered when no MG or Mortar fires', () => {
    const s = build(spec([2, 4]));
    fire(s, ['p0', 'p1'], 'E2', [play()]);
    expect(s.pieces.p1.broken).toBe(false);
    expect(fire(build(spec([2, 4])), ['p0'], 'E2').reacts).toEqual([]);
  });

  it('several FP Actions add up on one attack', () => {
    const CF = card(G, { action: 'Crossfire' });
    const s = build({ ...spec([2, 4]), axis: { hand: [SF, CF], top: rolls(G, [[2, 4]]) } });
    s.turn.moving = ['p2'];
    const r = fire(s, ['p0', 'p1'], 'E2', [play(), play()]);
    expect(r.reacts.map((d) => d.options.length)).toEqual([2, 1]);
    expect(r.shot).toMatchObject({ fp: 5 + 1 + 4 });
  });
});

describe('Spray Fire (§A40, R-19)', () => {
  const SP = card(G, { action: 'Spray Fire' });
  const spec = (shooter: { type: string; hex: string; weapon?: string }): BuildSpec => ({
    axis: { hand: [SP], top: rolls(G, [7]) },
    allied: { top: rolls(A, [11, 11]) },
    pieces: [shooter, { type: 'American/Line Squad', hex: 'E2' }, { type: 'American/Line Squad', hex: 'E1' }],
  });

  it('a second adjacent enemy hex in Range and LOS of every boxed-Range piece; both hexes defend against one roll', () => {
    const s = build(spec({ type: 'German/Rifle Squad', hex: 'E6' })); // Range 5: E2 is 4 away, E1 5
    const ids = Object.keys(s.pieces);
    const firer = ids[0];
    const r = fire(s, [firer], 'E2', [play(0, { hexes: [H('E1')] })]);
    expect(r.reacts[0].options).toEqual([{ card: SP, action: 'Spray Fire', targets: { hexes: [H('E1')] } }]);
    expect(r.shot).toMatchObject({ fp: 5, total: 12, hexes: [H('E2'), H('E1')] });
    expect(r.events.filter((e) => e.kind === 'defense')).toHaveLength(2);
    expect(r.reacts).toHaveLength(1); // played once, never twice on one attack
  });

  it('not when a firing piece lacks boxed Range, nor when the second hex is out of a piece\'s Range', () => {
    const team = build(spec({ type: 'German/Weapon Team', hex: 'E4', weapon: 'German/LMG' }));
    expect(fire(team, ['p0', 'p1'], 'E2').reacts).toEqual([]);
    const far = build(spec({ type: 'German/Rifle Squad', hex: 'E7' })); // E2 5 away, E1 6
    expect(fire(far, ['p0'], 'E2').reacts).toEqual([]);
  });
});
