// The Actions of the defending player just before a Defense Roll — Concealment (§A29, R-17), Hidden Entrenchments
// (§A35.1), Hidden Pillbox (§A35.3, R-18) — and Light Wounds the instant a Squad would break (§A36, R-54).
import { describe, expect, it } from 'vitest';
import { breakPiece } from '../../../src/engine/casualties';
import { fireAttack } from '../../../src/engine/fire';
import type { Answer, Decision, GameEvent, GameState } from '../../../src/engine/types';
import { H, build, card, passive, rolls, run, script, type BuildSpec, type PieceSpec, type SideSpec } from '../../support/build';

const G = 'German';
const A = 'American';
type React = Extract<Decision, { kind: 'react' }>;
type DefenseEvent = Extract<GameEvent, { kind: 'defense' }>;
const play: Answer = { kind: 'play', option: 0 };

function fire(s: GameState, target: string, answers: Answer[] = []) {
  const r = run(s, (ctx) => fireAttack(s, ctx, 'axis', { pieces: ['p0'], target: H(target) }, 'order'), script(answers));
  const reacts = r.decisions.filter((d): d is React => d.kind === 'react' && d.window === 'beforeDefenseRoll');
  const defense = r.events.filter((e): e is DefenseEvent => e.kind === 'defense');
  return { ...r, reacts, defense };
}

/** An Axis Rifle Squad in E5 (5 FP) fires at E2 with a roll of 8: Attack Total 13. The Allies roll 3s to defend. */
function spec(hand: string[], defenders: PieceSpec[], extra: { allied?: SideSpec } & Omit<BuildSpec, 'allied'> = {}): BuildSpec {
  const { allied, ...rest } = extra;
  return {
    axis: { top: rolls(G, [8]) },
    allied: { hand, top: rolls(A, [3, 3]), ...allied },
    pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }, ...defenders],
    ...rest,
  };
}

describe('Concealment (§A29, R-17)', () => {
  const CO = card(A, { action: 'Concealment' });

  it('takes the target hex\'s Cover off the Attack Total, for every remaining Defense roll of the attack', () => {
    const s = build(spec([CO], [{ type: 'American/Line Squad', hex: 'E2' }, { type: 'American/Line Squad', hex: 'E2' }], { map: { terrain: { E2: 'Woods' } } }));
    const r = fire(s, 'E2', [play]);
    expect(r.reacts[0]).toMatchObject({ side: 'allied', options: [{ card: CO, action: 'Concealment' }] });
    // 13 − Woods 2 = 11 against Morale 6 + Cover 2 + 3 = 11: a tie suppresses; the second unit also faces 11
    expect(r.defense.map((e) => [e.unit, e.attack, e.result])).toEqual([['p1', 11, 'suppress'], ['p2', 11, 'suppress']]);
    expect(r.reacts).toHaveLength(1);
  });

  it('the Cover the unit actually uses: a Wall across the shot counts, Road −1 applies, a negative Cover raises the total', () => {
    const unit = [{ type: 'American/Line Squad', hex: 'E2' }];
    const wall = build(spec([CO], unit, { map: { hexsides: [['E2', 'E3', 'Wall']], pathHexes: { Road: ['E2'] } } }));
    expect(fire(wall, 'E2', [play]).defense[0]).toMatchObject({ attack: 13 - (2 - 1) }); // Wall 2, Road −1
    const stream = build(spec([CO], unit, { map: { terrain: { E2: 'Stream' } } }));
    expect(fire(stream, 'E2', [play]).defense[0]).toMatchObject({ attack: 13 + 1 }); // Stream Cover −1
  });

  it('only for the defending player\'s own Defense rolls', () => {
    const s = build({ ...spec([], [{ type: 'American/Line Squad', hex: 'E2' }]), axis: { hand: [card(G, { action: 'Concealment' })], top: rolls(G, [8]) } });
    expect(fire(s, 'E2').reacts).toEqual([]);
  });
});

describe('Hidden Entrenchments (§A35.1)', () => {
  const HE = card(A, { action: 'Hidden Entrenchments' });
  const unit = (hex: string): PieceSpec => ({ type: 'American/Line Squad', hex });

  it('the Defender places Foxholes in the attacked hex; their Cover counts for that roll', () => {
    const s = build(spec([HE], [unit('E2')], { allied: { posture: 'defend' } }));
    const r = fire(s, 'E2', [play]);
    expect(r.reacts[0].options).toEqual([{ card: HE, action: 'Hidden Entrenchments' }]);
    expect(s.fort[H('E2')]).toBe('foxholes');
    expect(r.defense[0]).toMatchObject({ morale: 6 + 3 });
  });

  it('not for an Attacker or Recon player, not in a Building, not where a Fortification is', () => {
    expect(fire(build(spec([HE], [unit('E2')])), 'E2').reacts).toEqual([]);
    expect(fire(build(spec([HE], [unit('E2')], { allied: { posture: 'defend' }, map: { terrain: { E2: 'Building' } } })), 'E2').reacts).toEqual([]);
    expect(fire(build(spec([HE], [unit('E2')], { allied: { posture: 'defend' }, fort: { E2: 'wire' } })), 'E2').reacts).toEqual([]);
  });
});

describe('Hidden Pillbox (§A35.3, R-18)', () => {
  const HP = card(G, { action: 'Hidden Pillbox' }); // the American deck has none: a Russian or German Defender
  const defender = (hex: string): PieceSpec => ({ type: 'German/Rifle Squad', hex });
  /** The Allies (American) fire from E5 at the German Defender. */
  function shoot(build_: BuildSpec, hex: string, answers: Answer[] = []) {
    const s = build(build_);
    const r = run(s, (ctx) => fireAttack(s, ctx, 'allied', { pieces: ['p0'], target: H(hex) }, 'order'), script(answers));
    return { s, reacts: r.decisions.filter((d) => d.kind === 'react'), defense: r.events.filter((e): e is DefenseEvent => e.kind === 'defense') };
  }
  const base = (hex: string, extra: Partial<BuildSpec> = {}): BuildSpec => ({
    active: 'allied',
    allied: { top: rolls(A, [8]) },
    axis: { posture: 'defend', hand: [HP], top: rolls(G, [3]) },
    pieces: [{ type: 'American/Line Squad', hex: 'E5' }, defender(hex)],
    ...extra,
  });

  it('the Defender places the Pillbox in an attacked Objective hex', () => {
    const r = shoot(base('E1'), 'E1', [play]); // Objective 5 is E1 in the test maps
    expect(r.reacts).toHaveLength(1);
    expect(r.s.fort[H('E1')]).toBe('pillbox');
    expect(r.defense[0]).toMatchObject({ morale: 7 + 5 });
  });

  it('any hex of a building Objective counts', () => {
    const r = shoot(base('E2', { map: { terrain: { E1: 'Building', E2: 'Building' }, building: { E1: 1, E2: 1 } } }), 'E2', [play]);
    expect(r.s.fort[H('E2')]).toBe('pillbox');
  });

  it('not outside an Objective, nor when the Pillbox is already in play', () => {
    expect(shoot(base('E2'), 'E2').reacts).toEqual([]);
    expect(shoot(base('E1', { fort: { K5: 'pillbox' } }), 'E1').reacts).toEqual([]);
  });
});

describe('Light Wounds (§A36, R-54)', () => {
  const LW = card(G, { action: 'Light Wounds' });

  it('instead of breaking: −1 VP, and a Team of the OB quality takes the Squad\'s place with its Weapon and markers', () => {
    const s = build({
      axis: { hand: [LW], quality: 'elite' },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E5', veteran: true, suppressed: true, weapon: 'German/LMG' }, { type: 'German/Rifle Squad', hex: 'E7' }],
    });
    s.turn.activated.push('p0');
    const r = run(s, (ctx) => breakPiece(s, ctx, 'p0', 'sniper'), script([play]));
    expect(r.decisions[0]).toMatchObject({ kind: 'react', side: 'axis', window: 'squadWouldBreak', options: [{ card: LW, action: 'Light Wounds' }] });
    expect(s.vp).toBe(-1);
    expect(s.pieces.p0.where).toBe('mix');
    const team = Object.values(s.pieces).find((p) => p.type === 'German/Elite Team')!;
    expect(team).toMatchObject({ where: 'map', hex: H('E5'), broken: false, veteran: true, suppressed: true, weapon: 'p1' });
    expect(s.turn.activated).toEqual([team.id]);
  });

  it('a broken Squad that would be eliminated becomes a broken Team', () => {
    const s = build({ axis: { hand: [LW] }, pieces: [{ type: 'German/Rifle Squad', hex: 'E5', broken: true }, { type: 'German/Rifle Squad', hex: 'E7' }] });
    run(s, (ctx) => breakPiece(s, ctx, 'p0', 'fire'), script([play]));
    expect(Object.values(s.pieces).find((p) => p.type === 'German/Line Team')).toMatchObject({ broken: true, where: 'map' });
    expect(s.players.axis.casualties).toEqual([]);
  });

  it('not for a Team, nor for the opponent\'s Squad', () => {
    const s = build({
      axis: { hand: [LW] },
      pieces: [{ type: 'German/Line Team', hex: 'E5' }, { type: 'American/Line Squad', hex: 'E2' }],
    });
    expect(run(s, (ctx) => breakPiece(s, ctx, 'p0', 'fire'), passive).decisions).toEqual([]);
    expect(run(s, (ctx) => breakPiece(s, ctx, 'p1', 'fire'), passive).decisions).toEqual([]);
  });
});
