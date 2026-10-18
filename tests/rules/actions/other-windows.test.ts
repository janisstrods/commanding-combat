// Actions of the other windows: after the opponent passes with discards — Demolitions (§A31) and Hidden Unit (§A35.4,
// R-14, R-16); before and after a melee — Ambush (§A25) and No Quarter (§A38); at the end of a Time advance — Dig In
// (§A32); and Command Confusion, which is never an Action (§A28).
import { describe, expect, it } from 'vitest';
import { CARDS } from '../../../src/engine/data';
import { advanceTime } from '../../../src/engine/deck';
import { turnFlow } from '../../../src/engine/flow';
import { optionsFor, window } from '../../../src/engine/reactions';
import type { Answer, Decision, Nation, WindowKind } from '../../../src/engine/types';
import { H, build, card, cardsWhere, passive, rolls, run, script, type BuildSpec, type Responder } from '../../support/build';

const G = 'German';
const A = 'American';
const R = 'Russian';
type React = Extract<Decision, { kind: 'react' }>;
const play = (option = 0, targets?: { hexes?: number[] }): Answer => ({ kind: 'play', option, ...(targets ? { targets } : {}) });
const reacts = (ds: Decision[]) => ds.filter((d): d is React => d.kind === 'react');

/** Two plain German cards to pass with (no Fire, Move or Advance Order, no Fire Action). */
const PASS_CARDS = cardsWhere(G, { order: 'Recover', fireIsAction: false }).slice(0, 2);

/** The Axis passes his Turn discarding `n` cards. */
function passing(spec: BuildSpec, n: number, respond: Responder) {
  const s = build({ ...spec, axis: { ...spec.axis, hand: PASS_CARDS } });
  const r = run(s, (ctx) => turnFlow(s, ctx), (d, st) => (d.kind === 'turn' ? { kind: 'pass', discard: PASS_CARDS.slice(0, n) } : respond(d, st)));
  return { s, r };
}

describe('Demolitions (§A31, R-14)', () => {
  const DM = card(A, { action: 'Demolitions' });
  const spec: BuildSpec = {
    allied: { hand: [DM] },
    pieces: [{ type: 'American/Line Squad', hex: 'E2' }, { type: 'German/Rifle Squad', hex: 'H8' }],
    fort: { E2: 'wire', H8: 'foxholes', K5: 'mines' },
  };

  it('when the opponent passes and discards: remove a Fortification from a hex with a friendly unit', () => {
    const { s, r } = passing(spec, 1, script([play(0, { hexes: [H('E2')] })]));
    expect(reacts(r.decisions)[0]).toMatchObject({ side: 'allied', window: 'opponentPassed', options: [{ card: DM, action: 'Demolitions', targets: { hexes: [H('E2')] } }] });
    expect(s.fort[H('E2')]).toBeNull();
    expect(s.fort[H('H8')]).toBe('foxholes');
  });

  it('not after a pass that discards nothing', () => {
    const { r } = passing(spec, 0, passive);
    expect(reacts(r.decisions)).toEqual([]);
  });
});

describe('Hidden Unit (§A35.4, R-14, R-16)', () => {
  const HU = card(A, { action: 'Hidden Unit' });
  const spec = (posture: 'defend' | 'recon'): BuildSpec => ({
    year: 1944,
    map: { terrain: { C2: 'Woods', H3: 'Building', K2: 'Woods', F5: 'Woods' } },
    allied: { posture, hand: [HU], top: rolls(A, [4]) },
    pieces: [{ type: 'American/Line Squad', hex: 'K2' }],
  });

  it('a Support Table roll; a free non-Radio item of that column; placed in an empty set-up hex with Cover', () => {
    const answers: Answer[] = [play(), { kind: 'choose', items: [0] }, { kind: 'choose', items: [1] }];
    const { s, r } = passing(spec('defend'), 1, script(answers));
    const chooses = r.decisions.filter((d): d is Extract<Decision, { kind: 'choose' }> => d.kind === 'choose');
    // column 4 in 1944: Weapon Team with MMG, Green Squad (the 155mm Radio is left out)
    expect(chooses[0]).toMatchObject({ reason: 'supportItem', items: [{ label: 'Wpn Team w/ Medium MG' }, { label: 'Green Squad' }] });
    // the Allies set up in rows 1-3: C2 (Woods) and H3 (Building); K2 is occupied, F5 is outside
    expect(chooses[1]).toMatchObject({ reason: 'hiddenUnitPlace', items: [{ hex: H('C2') }, { hex: H('H3') }] });
    const team = Object.values(s.pieces).find((p) => p.type === 'American/Weapon Team')!;
    expect(team).toMatchObject({ where: 'map', hex: H('H3') });
    expect(s.pieces[team.weapon!].type).toBe('American/MMG');
  });

  it('only for the scenario Defender, and only after a pass that discards', () => {
    expect(reacts(passing(spec('recon'), 1, passive).r.decisions)).toEqual([]);
    expect(reacts(passing(spec('defend'), 0, passive).r.decisions)).toEqual([]);
  });
});

describe('Ambush (§A25)', () => {
  const AM = card(A, { action: 'Ambush' });
  const melee: BuildSpec = {
    allied: { hand: [AM] },
    pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }, { type: 'German/Line Team', hex: 'E5' }, { type: 'American/Line Squad', hex: 'E5' }],
  };

  it('before the melee dice: the opponent breaks one of his units in the melee, of his choice', () => {
    const s = build(melee);
    const r = run(s, (ctx) => window(s, ctx, 'beforeMelee', { hex: H('E5'), units: ['p0', 'p1', 'p2'] }), script([play(), { kind: 'choose', items: [1] }]));
    expect(reacts(r.decisions)[0]).toMatchObject({ side: 'allied', options: [{ card: AM, action: 'Ambush' }] });
    expect(r.decisions[1]).toMatchObject({ kind: 'choose', side: 'axis', reason: 'ambushVictim', items: [{ piece: 'p0' }, { piece: 'p1' }] });
    expect(s.pieces.p1.broken).toBe(true);
    expect(s.pieces.p0.broken).toBe(false);
  });

  it('not where no melee is', () => {
    const s = build({ ...melee, pieces: [{ type: 'American/Line Squad', hex: 'E5' }] });
    expect(run(s, (ctx) => window(s, ctx, 'beforeMelee', { hex: H('E5') }), passive).decisions).toEqual([]);
  });
});

describe('No Quarter (§A38)', () => {
  const after = (axis: Nation, allied: Nation, hand: { axis?: string[]; allied?: string[] }, survivor: 'axis' | 'allied') => {
    const s = build({
      axis: { nation: axis, hand: hand.axis ?? [] },
      allied: { nation: allied, hand: hand.allied ?? [] },
      pieces: [{ type: survivor === 'axis' ? 'German/Rifle Squad' : allied === 'Russian' ? 'Russian/Rifle Squad' : 'American/Line Squad', hex: 'E5' }],
    });
    const r = run(s, (ctx) => window(s, ctx, 'afterMelee', { hex: H('E5'), units: ['p0'] }), script([play()]));
    return { s, r };
  };
  const NQ_G = card(G, { action: 'No Quarter' });
  const NQ_R = card(R, { action: 'No Quarter' });

  it('+2 VP for a player with a unit still alive after the melee: German against Russians, Russian against anyone', () => {
    const g = after(G, R, { axis: [NQ_G] }, 'axis');
    expect(reacts(g.r.decisions)[0]).toMatchObject({ side: 'axis', options: [{ card: NQ_G, action: 'No Quarter' }] });
    expect(g.s.vp).toBe(2);
    const r = after(G, R, { allied: [NQ_R] }, 'allied');
    expect(r.s.vp).toBe(-2);
  });

  it('not for the German player against Americans, nor without a survivor', () => {
    expect(reacts(after(G, A, { axis: [NQ_G] }, 'axis').r.decisions)).toEqual([]);
    expect(reacts(after(G, R, { axis: [NQ_G] }, 'allied').r.decisions)).toEqual([]);
  });
});

describe('Dig In (§A32)', () => {
  const DI = card(G, { action: 'Dig In' });

  it('at the end of a Time advance: Foxholes in a hex with a friendly unit (not Water, not where a Fortification is)', () => {
    const s = build({
      axis: { hand: [DI] },
      map: { terrain: { E7: 'Marsh' } },
      fort: { E6: 'wire' },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'E6' }, { type: 'German/Rifle Squad', hex: 'E7' }, { type: 'American/Line Squad', hex: 'E2' }],
    });
    const r = run(s, (ctx) => advanceTime(s, ctx, 'axis'), script([play(0, { hexes: [H('E5')] })]));
    expect(reacts(r.decisions)).toEqual([expect.objectContaining({ side: 'axis', window: 'timeAdvanceEnd', options: [{ card: DI, action: 'Dig In', targets: { hexes: [H('E5')] } }] })]);
    expect(s.fort[H('E5')]).toBe('foxholes');
  });

  it('not when every friendly hex already has a Fortification', () => {
    const s = build({ axis: { hand: [DI] }, fort: { E5: 'foxholes' }, pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }] });
    expect(reacts(run(s, (ctx) => advanceTime(s, ctx, 'axis'), passive).decisions)).toEqual([]);
  });
});

describe('Command Confusion (§A28)', () => {
  it('is never offered as an Action, in any window', () => {
    const cc = Object.values(CARDS).filter((c) => c.action === 'Command Confusion').map((c) => c.id);
    const s = build({
      axis: { hand: cc.filter((c) => CARDS[c].nation === G) },
      allied: { hand: cc.filter((c) => CARDS[c].nation === A) },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }, { type: 'American/Line Squad', hex: 'E5' }],
    });
    const windows: WindowKind[] = ['beforeFireAttackRoll', 'beforeDefenseRoll', 'squadWouldBreak', 'afterHexEntry', 'afterAdvanceEntry', 'beforeMelee', 'afterMelee', 'opponentPassed', 'timeAdvanceEnd', 'duringMove'];
    for (const w of windows) for (const side of ['axis', 'allied'] as const) {
      expect(optionsFor(s, side, w, { hex: H('E5'), units: ['p0'], discards: 2 }).filter((o) => o.action === 'Command Confusion')).toEqual([]);
    }
  });
});
