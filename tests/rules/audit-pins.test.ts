// Rules the audits found implemented but not pinned by a test: chit V and W, the Time advance order, reinforcements,
// Heroes and activation, R-46, R-19 Spray Fire, Sustained Fire stacking, Concealment against Mortars, R-16, R-54, S8
// Night with Spray Fire, Bore Sighting on Ordnance, Blaze displacement into an enemy hex.
import { describe, expect, it } from 'vitest';
import { activationCandidates, markActivated } from '../../src/engine/activation';
import { concealmentValue } from '../../src/engine/actions/concealment';
import { exitUnits } from '../../src/engine/casualties';
import { advanceTime, roll } from '../../src/engine/deck';
import { attackFp, fireAttack } from '../../src/engine/fire';
import { guard, turnFlow } from '../../src/engine/flow';
import { mineAttack } from '../../src/engine/forts';
import { spotters } from '../../src/engine/orders/artillery';
import { window } from '../../src/engine/reactions';
import { ACTIONS } from '../../src/engine/registry';
import { nightPenalty } from '../../src/engine/scenarioRules';
import { mixedHexes } from '../../src/engine/state';
import type { Answer, AttackInfo, Decision, GameEvent, GameState } from '../../src/engine/types';
import { H, build, card, cardsWhere, makeCtx, passive, rolls, run, script, type BuildSpec, type Responder } from '../support/build';
import { choices, eventSeq, ofKind, trigger } from './events/kit';

const G = 'German';
const A = 'American';
type React = Extract<Decision, { kind: 'react' }>;
const play = (option = 0, targets?: { hexes?: number[]; pieces?: string[] }): Answer => ({ kind: 'play', option, ...(targets ? { targets } : {}) });

/** An attack in progress for the handlers' options (as fire.ts builds it). */
const attackOf = (side: 'axis' | 'allied', pieces: string[], targets: string[], x: Partial<AttackInfo> = {}): AttackInfo => ({
  side, mode: 'order', pieces, targets: targets.map(H), ordnance: false, mortarOrArtillery: false, ignoresCover: false,
  fp: 0, bonus: 0, total: null, reduction: 0, played: [], ...x,
});

describe('chits V and W (§7.3.2)', () => {
  it('V: a side holding all five Objectives wins right before the Sudden Death roll, which is then not made', () => {
    const s = build({ time: 4, suddenDeath: 5, openChits: ['V'], control: ['axis', 'axis', 'axis', 'axis', 'axis'], initiative: 'allied' });
    const r = run(s, (ctx) => guard(s, ctx, advanceTime(s, ctx, 'allied')), passive);
    expect(s).toMatchObject({ phase: 'over', winner: 'axis', endReason: 'objectivesV' });
    expect(ofKind(r.events, 'reveal').filter((e) => e.purpose === 'suddenDeath')).toEqual([]);
    expect(ofKind(r.events, 'suddenDeath')).toEqual([]);
  });

  it('V: not before the Sudden Death space, nor with one Objective short', () => {
    const early = build({ time: 2, suddenDeath: 5, openChits: ['V'], control: ['axis', 'axis', 'axis', 'axis', 'axis'] });
    run(early, (ctx) => guard(early, ctx, advanceTime(early, ctx, 'allied')), passive);
    expect(early.phase).toBe('play');
    const short = build({ time: 4, suddenDeath: 5, openChits: ['V'], control: ['axis', 'axis', 'axis', 'axis', null], seed: 7 });
    const r = run(short, (ctx) => guard(short, ctx, advanceTime(short, ctx, 'allied')), passive);
    expect(ofKind(r.events, 'suddenDeath')).toHaveLength(1);
    expect(short.endReason).not.toBe('objectivesV');
  });

  it('W doubles exit VP', () => {
    const s = build({ openChits: ['W'], pieces: [{ type: 'German/Rifle Squad', hex: 'E1' }, { type: 'German/Rifle Squad', hex: 'E8' }] });
    run(s, (ctx) => exitUnits(s, ctx, ['p0']), passive);
    expect(s.vp).toBe(4);
  });
});

describe('the Time advance (§6.1.2)', () => {
  it('step 3: no Defender VP when the Sudden Death roll has ended the game', () => {
    let ended = 0;
    for (let seed = 1; seed < 300 && ended < 2; seed++) {
      const s = build({ seed, time: 4, suddenDeath: 5, axis: { posture: 'attack' }, allied: { posture: 'defend' }, initiative: 'allied' });
      const r = run(s, (ctx) => guard(s, ctx, advanceTime(s, ctx, 'axis')), passive);
      if (s.phase !== 'over') continue;
      ended++;
      expect(s.endReason).toBe('suddenDeath');
      expect(ofKind(r.events, 'vp').filter((e) => e.why === 'time')).toEqual([]);
      expect(s.vp).toBe(0);
    }
    expect(ended).toBe(2);
  });

  it('reinforcements: the inactive player places first, and a hex that would be overstacked is not offered', () => {
    const s = build({
      active: 'axis',
      axis: { edge: 'bottom' },
      allied: { edge: 'top' },
      pieces: [
        { type: 'American/Line Squad', hex: 'C1' }, // p0: C1 holds 4 Allied figures
        { type: 'American/Line Squad', where: 'time', space: 1 }, // p1
        { type: 'German/Rifle Squad', where: 'time', space: 1 }, // p2
        { type: 'German/Rifle Squad', hex: 'J9' },
      ],
      suddenDeath: 9,
    });
    const r = run(s, (ctx) => advanceTime(s, ctx, 'axis'), (d) => (d.kind === 'deploy' ? { kind: 'deploy', piece: d.pieces[0], hex: d.hexes[0] } : passive(d, s)));
    const deploys = r.decisions.filter((d): d is Extract<Decision, { kind: 'deploy' }> => d.kind === 'deploy');
    expect(deploys.map((d) => d.side)).toEqual(['allied', 'axis']);
    expect(deploys[0].hexes).not.toContain(H('C1'));
    expect(deploys[0].hexes).toContain(H('A1'));
  });
});

describe('Heroes and the once-per-Turn activation (§3.4)', () => {
  it('a Hero may be activated for one Order after another', () => {
    const s = build({ pieces: [{ type: 'German/Dietel (Hero)', hex: 'E5' }, { type: 'American/Line Squad', hex: 'E2' }] });
    expect(activationCandidates(s, 'axis', 'Fire')).toEqual(['p0']);
    markActivated(s, makeCtx([]), 'axis', ['p0'], 'Fire');
    expect(s.turn.activated).toEqual([]);
    expect(activationCandidates(s, 'axis', 'Fire')).toEqual(['p0']);
  });

  it('and again for Op Fire in a later Move Order of the same Turn, unlike other units', () => {
    const s = build({
      active: 'allied',
      pieces: [{ type: 'German/Dietel (Hero)', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'F5' }, { type: 'American/Line Squad', hex: 'E2' }],
    });
    markActivated(s, makeCtx([]), 'axis', ['p0', 'p1'], 'Op Fire');
    expect(activationCandidates(s, 'axis', 'Op Fire')).toEqual(['p0']);
  });
});

describe('R-46: a Suppressed Leader may be the Spotter', () => {
  it('only broken ones may not', () => {
    const s = build({
      pieces: [{ type: 'German/Lt Von Karsties', hex: 'H8', suppressed: true }, { type: 'German/Sgt Pfeiffer', hex: 'G8', broken: true }, { type: 'German/Radio:105mm', where: 'artillery' }],
    });
    expect(spotters(s, 'axis')).toEqual(['p0']);
  });
});

describe('R-19: Spray Fire\'s modifiers over its two hexes', () => {
  it('height: −1 against the higher hex and +1 against the lower one, both at once', () => {
    const s = build({ map: { elevation: { E6: 1, E2: 2, E3: 0 } }, pieces: [{ type: 'German/Rifle Squad', hex: 'E6' }, { type: 'American/Line Squad', hex: 'E2' }, { type: 'American/Line Squad', hex: 'E3' }] });
    expect(attackFp(s, ['p0'], [H('E3')])).toMatchObject({ height: 1 });
    expect(attackFp(s, ['p0'], [H('E2')])).toMatchObject({ height: -1 });
    expect(attackFp(s, ['p0'], [H('E3'), H('E2')])).toMatchObject({ height: 0 });
  });

  it('the largest Hindrance on any of the lines to either hex', () => {
    // from E7: the line to E3 crosses the Orchard in E5; the line to E2 also crosses the Brush in E3 (the other target)
    const s = build({ map: { terrain: { E5: 'Orchard', E3: 'Brush' } }, pieces: [{ type: 'German/Rifle Squad', hex: 'E7' }] });
    expect(attackFp(s, ['p0'], [H('E3')])).toMatchObject({ hindrance: 2, fp: 3 });
    expect(attackFp(s, ['p0'], [H('E3'), H('E2')])).toMatchObject({ hindrance: 3, fp: 2 });
  });

  it('Hand Grenades and Crossfire through the second hex', () => {
    const HG = card(G, { action: 'Hand Grenades' });
    const CF = card(G, { action: 'Crossfire' });
    const s = build({ axis: { hand: [HG, CF] }, pieces: [{ type: 'German/Rifle Squad', hex: 'E4' }, { type: 'American/Line Squad', hex: 'E1' }, { type: 'American/Line Squad', hex: 'E3' }] });
    s.turn.moving = ['p2']; // the unit in the second hex is activated to Move
    const opts = (targets: string[]) => {
      const info = { attack: attackOf('axis', ['p0'], targets) };
      return [...ACTIONS['Hand Grenades'].options(s, 'axis', 'beforeFireAttackRoll', info), ...ACTIONS.Crossfire.options(s, 'axis', 'beforeFireAttackRoll', info)].map((o) => o.action);
    };
    expect(opts(['E1'])).toEqual([]);
    expect(opts(['E1', 'E3'])).toEqual(['Hand Grenades', 'Crossfire']);
  });

  it('Concealment takes the better Cover of the two hexes', () => {
    const s = build({ map: { terrain: { E3: 'Woods' } }, pieces: [{ type: 'German/Rifle Squad', hex: 'E7' }, { type: 'American/Line Squad', hex: 'E2' }, { type: 'American/Line Squad', hex: 'E3' }] });
    expect(concealmentValue(s, attackOf('axis', ['p0'], ['E2']), 'p1')).toBe(0);
    expect(concealmentValue(s, attackOf('axis', ['p0'], ['E2', 'E3']), 'p1')).toBe(2);
  });

  it('S8 Night: the closer of the two hexes sets the penalty', () => {
    const s = build({ special: { night: true } as BuildSpec['special'] });
    expect(nightPenalty(s, [H('E7')], [H('E3'), H('E2')])).toBe(4);
    expect(nightPenalty(s, [H('E7')], [H('E2')])).toBe(5);
  });
});

describe('Sustained Fire stacking (§A41)', () => {
  const [SF1, SF2] = cardsWhere(G, { action: 'Sustained Fire' });
  const shoot = (top: string[], hand: string[]) => {
    const s = build({
      axis: { hand, top },
      allied: { top: rolls(A, [11]) },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E5', weapon: 'German/LMG' }, { type: 'American/Line Squad', hex: 'E2' }],
    });
    const r = run(s, (ctx) => fireAttack(s, ctx, 'axis', { pieces: ['p0', 'p1'], target: H('E2') }, 'order'), (d, st) => {
      if (d.kind === 'react' && d.window === 'beforeFireAttackRoll') return play();
      return passive(d, st);
    });
    return { s, r };
  };

  it('two Sustained Fires on doubles break the MG twice: it is eliminated', () => {
    const { s, r } = shoot(rolls(G, [[2, 2]]), [SF1, SF2]);
    expect(r.decisions.filter((d) => d.kind === 'react').length).toBeGreaterThanOrEqual(2);
    expect(s.pieces.p1.where).toBe('weaponsBox');
  });

  it('with Jammed! (1-1 doubles) the MG breaks for the Jam and again for Sustained Fire', () => {
    const { s } = shoot([card(G, { trigger: 'Jammed' })], [SF1]);
    expect(s.pieces.p1.where).toBe('weaponsBox');
  });
});

describe('Concealment against Mortars (§A29, R-17)', () => {
  it('uses the Cover the unit has against that attack: a Fortification +1', () => {
    const s = build({ fort: { E2: 'foxholes' }, pieces: [{ type: 'German/Line Team', hex: 'E5', weapon: 'German/Light Mortar' }, { type: 'American/Line Squad', hex: 'E2' }] });
    expect(concealmentValue(s, attackOf('axis', ['p1'], ['E2'], { ordnance: true, mortarOrArtillery: true }), 'p2')).toBe(4);
    expect(concealmentValue(s, attackOf('axis', ['p0'], ['E2']), 'p2')).toBe(3);
  });
});

describe('R-16: the Hidden Unit Support Table roll is an ordinary roll and can trigger', () => {
  it('a Time! on it advances the Time marker', () => {
    const PASS = cardsWhere(G, { order: 'Recover', fireIsAction: false }).slice(0, 2);
    const HU = card(A, { action: 'Hidden Unit' });
    const s = build({
      year: 1944, suddenDeath: 9,
      map: { terrain: { C2: 'Woods', H3: 'Building' } },
      axis: { hand: PASS },
      allied: { posture: 'defend', hand: [HU], top: [card(A, { trigger: 'Time' })] },
      pieces: [{ type: 'American/Line Squad', hex: 'K2' }, { type: 'German/Rifle Squad', hex: 'J9' }],
    });
    const r = run(s, (ctx) => turnFlow(s, ctx), (d, st) => {
      if (d.kind === 'turn') return { kind: 'pass', discard: PASS.slice(0, 1) };
      if (d.kind === 'react') return play();
      return passive(d, st);
    });
    expect(r.events).toContainEqual(expect.objectContaining({ kind: 'trigger', trigger: 'Time' }));
    expect(s.time).toBe(1);
  });
});

describe('R-54: Light Wounds when a Squad breaks by Ambush, Sniper!, Air Support or a Mine Attack', () => {
  const replaced = (r: { events: GameEvent[] }, id: string) => r.events.some((e) => e.kind === 'replace' && e.piece === id);
  const lwFor = (side: 'axis' | 'allied'): Responder => (d, st) => (d.kind === 'react' && d.window === 'squadWouldBreak' && d.side === side ? play() : passive(d, st));

  it('Ambush', () => {
    const s = build({
      allied: { hand: [card(A, { action: 'Ambush' })] },
      axis: { hand: [card(G, { action: 'Light Wounds' })] },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }, { type: 'American/Line Squad', hex: 'E5' }],
    });
    const r = run(s, (ctx) => window(s, ctx, 'beforeMelee', { hex: H('E5'), units: ['p0', 'p1'] }), (d, st) =>
      d.kind === 'react' ? play() : passive(d, st));
    expect(replaced(r, 'p0')).toBe(true);
  });

  it('Sniper!', () => {
    const snip = card(G, { trigger: 'Sniper' });
    const hex = cardsWhere(G, { hex: 'E5' }).find((c) => c !== snip)!;
    const s = build({
      axis: { top: [snip, hex] },
      allied: { hand: [card(A, { action: 'Light Wounds' })] },
      pieces: [{ type: 'American/Line Squad', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'J9' }],
    });
    const r = run(s, (ctx) => roll(s, ctx, 'axis', 'defense'), (d, st) =>
      d.kind === 'choose' && d.reason === 'sniperTarget' ? { kind: 'choose', items: [0] } : lwFor('allied')(d, st));
    expect(replaced(r, 'p0')).toBe(true);
  });

  it('Air Support', () => {
    const s = build({
      axis: { top: eventSeq(G, 'Air Support', ['E5']) },
      allied: { hand: [card(A, { action: 'Light Wounds' })] },
      pieces: [{ type: 'American/Line Squad', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'J9' }],
    });
    const r = trigger(s, 'axis', (d, st) => (d.kind === 'choose' && d.reason === 'airSupport' ? { kind: 'choose', items: [0] } : lwFor('allied')(d, st)));
    expect(replaced(r, 'p0')).toBe(true);
  });

  it('a Mine Attack', () => {
    const s = build({
      fort: { E5: 'mines' },
      axis: { top: rolls(G, [[6, 5]]) }, // 6 + 11 = 17
      allied: { hand: [card(A, { action: 'Light Wounds' })], top: rolls(A, [[1, 2]]) }, // 6 + 0 + 3 = 9
      pieces: [{ type: 'American/Line Squad', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'J9' }],
    });
    const r = run(s, (ctx) => mineAttack(s, ctx, ['p0'], H('E5')), lwFor('allied'));
    expect(replaced(r, 'p0')).toBe(true);
  });
});

describe('Bore Sighting on an Ordnance Weapon (§A27)', () => {
  it('a hit by the Defender\'s Light Mortar (printed FP 6): +2 FP before its Fire Attack Roll', () => {
    const BS = card(G, { action: 'Bore Sighting' });
    const s = build({
      axis: { posture: 'defend', hand: [BS], top: rolls(G, [[2, 4], [1, 2]]) }, // product 8 hits range 3; then 3
      allied: { top: rolls(A, [11]) },
      pieces: [{ type: 'German/Line Team', hex: 'E5', weapon: 'German/Light Mortar' }, { type: 'American/Line Squad', hex: 'E2' }],
    });
    const r = run(s, (ctx) => fireAttack(s, ctx, 'axis', { pieces: ['p1'], target: H('E2') }, 'order'), script([play()]));
    const react = r.decisions.find((d): d is React => d.kind === 'react');
    expect(react?.options).toEqual([{ card: BS, action: 'Bore Sighting' }]);
    expect(ofKind(r.events, 'fireAttack')[0]).toMatchObject({ fp: 8, total: 11 });
  });
});

describe('Blaze displacement into an enemy hex (§E46, R-34, R-04)', () => {
  it('the melee is fought at the end of the Event, inside it: its rolls never trigger', () => {
    const s = build({
      axis: { top: eventSeq(G, 'Blaze', ['E5']) },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }, { type: 'American/Line Squad', hex: 'E4' }, { type: 'German/Rifle Squad', hex: 'J9' }, { type: 'American/Line Squad', hex: 'A1' }],
    });
    const r = trigger(s, 'axis', choices({ blazeDisplace: { hex: 'E4' } }));
    expect(s.blaze[H('E5')]).toBe(true);
    const k = r.events.map((e) => e.kind);
    expect(k).toContain('melee');
    expect(ofKind(r.events, 'trigger')).toHaveLength(0);
    expect(ofKind(r.events, 'reveal').filter((e) => e.purpose === 'melee')).toHaveLength(2);
    expect(mixedHexes(s)).toEqual([]);
  });
});

export type { GameState };
