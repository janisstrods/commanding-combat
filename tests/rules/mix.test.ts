// The counter mix (§E42, FAQ "Counter Mix Limits", R-56): one table (src/data/mix.json) for every limit; what is in
// play (everything but the mix: map, Time Track, Casualty Track ...); each place that takes a counter from the mix —
// Light Wounds (§A36), Deploy (§E52) and the free Deploy against overstacking (§8.2), the Fortification Actions (§A32,
// §A35) and Events (§E47, §E55, §E69, §E73), Infiltration (§E59), Reinforcements (§E68), Hidden Unit (§A35.4), the RSG
// purchases (RS.7, RS.9) — and the counters that go back to it (a replaced Squad, an eliminated Radio or Hero, a
// Fortification taken off the map). What the mix lacks is not offered, and the one answer check refuses it.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildMix, type MixPolicy } from '../../scripts/data/mix';
import policyJson from '../../design/data/counter-mix.json';
import cardsJson from '../../src/data/cards.json';
import countersJson from '../../src/data/counters.json';
import mixJson from '../../src/data/mix.json';
import rsgJson from '../../src/data/rsg.json';
import { breakPiece, eliminate } from '../../src/engine/casualties';
import { CARDS, COUNTERS, RSG, SCENARIOS, deckOf, teamFor } from '../../src/engine/data';
import { advanceTime } from '../../src/engine/deck';
import { answerError } from '../../src/engine/decisions';
import { endOfTurn, turnFlow } from '../../src/engine/flow';
import { NUM_HEXES, label } from '../../src/engine/hex';
import { actionMixError, fortMixCount, fortsLeft, inPlayCount, mixCount, mixLeft, teamsLeft } from '../../src/engine/mix';
import { newRsgDraft, rsgAutoRun, rsgFinish } from '../../src/engine/rsg';
import { fortError } from '../../src/engine/rsg/tables';
import { placeFort, removeFort } from '../../src/engine/state';
import type { ActionName, Answer, CounterType, Decision, EventName, FortKind, Nation, ScenarioDef, Side } from '../../src/engine/types';
import type { RsgTables } from '../../src/engine/rsgTypes';
import { H, build, card, cardsWhere, makeCtx, passive, piecesOf, rolls, run, script, type BuildSpec, type PieceSpec } from '../support/build';
import { mulberry32 } from '../support/rng';
import { G, RU, asked, choices, eventSeq, eventTop, ofKind, trigger } from './events/kit';

const US: Nation = 'American';
const play: Answer = { kind: 'play', option: 0 };

/** `n` counters of `type` in play off the map (in staging), to use up the mix. */
const inStaging = (type: string, n: number): PieceSpec[] => Array.from({ length: n }, () => ({ type, where: 'staging' as const }));

/** `n` Fortifications of `kind` in hexes of the last map columns (away from the tests' hexes in A–H). */
function forts(kind: FortKind, n: number): Record<string, FortKind> {
  const out: Record<string, FortKind> = {};
  for (let h = NUM_HEXES - 1; Object.keys(out).length < n; h--) out[label(h)] = kind;
  return out;
}

/** A Fate deck's cards. */
const deckCards = (nation: Nation) => deckOf(nation).map((id) => CARDS[id]);

/** What places each kind of Fortification during play (rules reference §A32, §A35.1–3, §A35.5, §E47, §E55, §E69, §E73). */
const PLACERS: Record<FortKind, { actions: ActionName[]; events: EventName[] }> = {
  foxholes: { actions: ['Dig In', 'Hidden Entrenchments'], events: ['Shellholes', 'Entrench'] },
  trench: { actions: [], events: [] },
  bunker: { actions: [], events: [] },
  pillbox: { actions: ['Hidden Pillbox'], events: [] },
  wire: { actions: ['Hidden Wire'], events: ['Rubble'] },
  mines: { actions: ['Hidden Mines'], events: ['Booby Trap'] },
};
const KINDS = Object.keys(PLACERS) as FortKind[];

describe('the counter-mix table (R-56)', () => {
  it('is what scripts/build-data.ts derives from design/data/counter-mix.json and the game data', () => {
    const dir = new URL('../../src/data/scenarios/', import.meta.url);
    const scenarios = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
    const { mix } = buildMix(policyJson as unknown as MixPolicy, countersJson.counters as CounterType[], scenarios, rsgJson as unknown as RsgTables, cardsJson.cards);
    expect(mix).toEqual(mixJson);
  });

  it('the Fortification placers it counts are the rules\' ones', () => {
    for (const k of KINDS) {
      const p = (policyJson.fortPlacers as Record<FortKind, { actions?: string[]; events?: string[] }>)[k];
      expect(p.actions ?? [], k).toEqual(PLACERS[k].actions);
      expect(p.events ?? [], k).toEqual(PLACERS[k].events);
    }
  });

  it('named Leaders, Heroes and Privates are unique, and so is the Pillbox (§F, A35.3)', () => {
    for (const c of Object.values(COUNTERS)) if (c.kind === 'leader') expect(mixCount(c.id), c.id).toBe(1);
    expect(fortMixCount('pillbox')).toBe(1);
  });

  it('every type has at least what one base scenario or one RSG OB uses, and 1 of anything a Support Table offers', () => {
    for (const scn of SCENARIOS) {
      const need: Record<string, number> = {};
      for (const side of ['axis', 'allied'] as Side[]) {
        const def = scn.sides[side];
        for (const [t, n] of Object.entries(def.forces)) need[t] = (need[t] ?? 0) + n;
        for (const list of Object.values(def.reinforcements)) for (const [t, n] of Object.entries(list)) need[t] = (need[t] ?? 0) + n;
      }
      for (const [t, n] of Object.entries(need)) expect(mixCount(t), `scenario ${scn.id}: ${t}`).toBeGreaterThanOrEqual(n);
    }
    for (const obs of Object.values(RSG.obs)) {
      for (const ob of Object.values(obs)) {
        for (const size of Object.values(ob.sizes)) {
          for (const [t, n] of Object.entries(size.units)) {
            const extra = Math.max(0, ...(size.unitsByYear ?? []).map((u) => u.units[t] ?? 0));
            expect(mixCount(t), `${ob.name}: ${t}`).toBeGreaterThanOrEqual(n + extra);
          }
        }
      }
    }
    for (const table of Object.values(RSG.support)) {
      for (const item of Object.values(table.items)) for (const t of [...Object.keys(item.pieces), ...(item.oneOf ?? [])]) expect(mixCount(t), t).toBeGreaterThanOrEqual(1);
    }
  });

  it('every base scenario leaves Teams for every Light Wounds and Deploy card of one pass through each deck', () => {
    for (const scn of SCENARIOS) {
      for (const side of ['axis', 'allied'] as Side[]) {
        const def = scn.sides[side];
        const team = teamFor(def.nation, def.quality);
        const cards = deckCards(def.nation);
        const supply = cards.filter((c) => c.action === 'Light Wounds').length + 2 * cards.filter((c) => c.event === 'Deploy').length;
        const set = (def.forces[team] ?? 0) + Object.values(def.reinforcements).reduce((n, l) => n + (l[team] ?? 0), 0);
        expect(set + supply, `scenario ${scn.id} ${side}`).toBeLessThanOrEqual(mixCount(team));
      }
    }
    expect(mixCount('German/Line Team')).toBe(3 + 5 + 2 * 3); // an OB's 3, 5 Light Wounds, 3 Deploys
    expect(mixCount('Russian/Green Team')).toBe(4 + 8); // scenario 3's 4, 8 Light Wounds (no Deploy in the deck)
    expect(mixCount('German/Green Team')).toBe(5 + 6); // used by no scenario or OB
    expect(mixCount('American/Weapon Team')).toBe(5); // not made by Deploy or Light Wounds
  });

  it('every base scenario leaves markers for every Fortification card of both decks (a Hidden Action: one deck)', () => {
    const cards = (scn: ScenarioDef, kind: FortKind) => {
      const nations = [scn.sides.axis.nation, scn.sides.allied.nation];
      const count = (n: Nation, hidden: boolean) =>
        deckCards(n).filter((c) => (c.defenderOnly === hidden && PLACERS[kind].actions.includes(c.action)) || (!hidden && PLACERS[kind].events.includes(c.event))).length;
      return nations.reduce((n, x) => n + count(x, false), 0) + Math.max(...nations.map((x) => count(x, true)));
    };
    for (const scn of SCENARIOS) {
      for (const kind of KINDS) {
        const placed = (scn.sides.axis.fortifications[kind] ?? 0) + (scn.sides.allied.fortifications[kind] ?? 0) + scn.prePlaced.filter((p) => p.fort === kind).length;
        expect(placed + cards(scn, kind), `scenario ${scn.id} ${kind}`).toBeLessThanOrEqual(fortMixCount(kind));
      }
    }
    // scenario 11 pre-places 14 Wire: Hidden Wire and Rubble still find theirs
    expect(fortMixCount('wire')).toBe(14 + 2 + 2);
    expect(fortMixCount('foxholes')).toBe(3 + 16);
    expect(fortMixCount('mines')).toBe(10 + 3); // a Minefield OB's 10, two Booby Traps, one Hidden Mines
    expect([fortMixCount('trench'), fortMixCount('bunker')]).toEqual([6, 3]);
  });
});

describe('what is in play (FAQ "Counter Mix Limits")', () => {
  it('every counter but those in the mix: map, carried, staging, Time Track, Casualty Track, Weapons box, Artillery Box', () => {
    const s = build({
      pieces: [
        { type: 'German/Rifle Squad', hex: 'E5', weapon: 'German/LMG' }, { type: 'German/Rifle Squad', where: 'staging' },
        { type: 'German/Rifle Squad', where: 'time', space: 4 }, { type: 'German/Rifle Squad', where: 'casualty' },
        { type: 'German/Radio:81mm', where: 'artillery' },
      ],
    });
    s.pieces.p1.where = 'weaponsBox';
    s.pieces.p1.carrier = null;
    s.pieces.p0.weapon = null;
    expect(inPlayCount(s, 'German/Rifle Squad')).toBe(4);
    expect(mixLeft(s, 'German/Rifle Squad')).toBe(mixCount('German/Rifle Squad') - 4);
    expect(mixLeft(s, 'German/LMG')).toBe(mixCount('German/LMG') - 1);
    expect(mixLeft(s, 'German/Radio:81mm')).toBe(0);
    s.pieces.p2.where = 'mix';
    expect(inPlayCount(s, 'German/Rifle Squad')).toBe(3);
  });

  it('counters back in the mix: an eliminated Radio or Hero; an eliminated unit stays in play on the Casualty Track', () => {
    const s = build({
      pieces: [{ type: 'German/Radio:81mm', where: 'artillery' }, { type: 'German/Dietel (Hero)', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'E6' }, { type: 'German/Rifle Squad', hex: 'E7' }],
    });
    run(s, (ctx) => eliminate(s, ctx, 'p0', 'event'), passive);
    run(s, (ctx) => eliminate(s, ctx, 'p1', 'fire'), passive);
    run(s, (ctx) => eliminate(s, ctx, 'p2', 'fire'), passive);
    expect(mixLeft(s, 'German/Radio:81mm')).toBe(1);
    expect(mixLeft(s, 'German/Dietel (Hero)')).toBe(1);
    expect(s.pieces.p2.where).toBe('casualty');
    expect(inPlayCount(s, 'German/Rifle Squad')).toBe(2);
  });

  it('a Fortification on the map is in play; taken off it goes back (Sappers, Demolitions, Artillery, Blaze)', () => {
    const s = build({ fort: forts('mines', fortMixCount('mines')) });
    expect(fortsLeft(s, 'mines')).toBe(0);
    const ctx = makeCtx([]);
    expect(placeFort(s, ctx, H('E5'), 'mines')).toBe(false); // none left: not placed
    expect(s.fort[H('E5')]).toBeNull();
    removeFort(s, ctx, NUM_HEXES - 1);
    expect(fortsLeft(s, 'mines')).toBe(1);
    expect(placeFort(s, ctx, H('E5'), 'mines')).toBe(true);
  });
});

describe('Light Wounds (§A36): a Team of the OB troop quality from the mix', () => {
  const [LW, LW2] = cardsWhere(G, { action: 'Light Wounds' });
  const TEAM = 'German/Line Team';
  const lwSpec = (left: number, more: PieceSpec[] = []): BuildSpec => ({
    axis: { hand: [LW, LW2], quality: 'line' },
    pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'E6' }, ...more, ...inStaging(TEAM, mixCount(TEAM) - left)],
  });
  const reacts = (ds: Decision[]) => ds.filter((d) => d.kind === 'react');

  it('none left: it is not offered, the one answer check refuses it, and the Squad breaks', () => {
    const s = build(lwSpec(0));
    expect(teamsLeft(s, 'axis')).toBe(0);
    const r = run(s, (ctx) => breakPiece(s, ctx, 'p0', 'fire'), passive);
    expect(reacts(r.decisions)).toEqual([]);
    expect(s.pieces.p0).toMatchObject({ where: 'map', broken: true });
    const d: Decision = { kind: 'react', side: 'axis', window: 'squadWouldBreak', options: [{ card: LW, action: 'Light Wounds' }], info: { units: ['p1'], hex: H('E6') } };
    expect(answerError(s, d, play)).toMatch(/counter mix has no Line Team left/);
    expect(actionMixError(s, 'axis', 'Light Wounds')).not.toBeNull();
  });

  it('the last one: played, and the next Squad that breaks cannot have it', () => {
    const s = build(lwSpec(1));
    const r = run(s, (ctx) => breakPiece(s, ctx, 'p0', 'fire'), script([play]));
    expect(reacts(r.decisions)).toHaveLength(1);
    expect(s.pieces.p0.where).toBe('mix');
    expect(piecesOf(s, TEAM).filter((p) => p.where === 'map')).toHaveLength(1);
    expect(teamsLeft(s, 'axis')).toBe(0);
    const r2 = run(s, (ctx) => breakPiece(s, ctx, 'p1', 'fire'), script([play]));
    expect(reacts(r2.decisions)).toEqual([]);
    expect(s.pieces.p1.broken).toBe(true);
  });

  it('the Squad it replaces goes back to the mix', () => {
    const SQ = 'German/Rifle Squad';
    const s = build(lwSpec(1, inStaging(SQ, mixCount(SQ) - 2)));
    expect(mixLeft(s, SQ)).toBe(0);
    run(s, (ctx) => breakPiece(s, ctx, 'p0', 'fire'), script([play]));
    expect(mixLeft(s, SQ)).toBe(1);
  });
});

describe('Deploy (§E52) and the free Deploy against overstacking (§8.2): two Teams from the mix', () => {
  const TEAM = 'German/Line Team';

  it('fewer than two Teams left: no Squad can Deploy; two: it does, and the mix is empty', () => {
    const s = build({ axis: { top: eventTop(G, 'Deploy') }, pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }, ...inStaging(TEAM, mixCount(TEAM) - 1)] });
    const r = trigger(s, 'axis', choices({ deploy: [0] }));
    expect(asked(r.decisions, 'deploy')).toEqual([]);
    expect(ofKind(r.events, 'log').map((e) => e.text)).toContain('Deploy: the counter mix has no two Line Teams left.');
    expect(s.pieces.p0.where).toBe('map');
    const t = build({ axis: { top: eventTop(G, 'Deploy') }, pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }, ...inStaging(TEAM, mixCount(TEAM) - 2)] });
    trigger(t, 'axis', choices({ deploy: [0] }));
    expect(t.pieces.p0.where).toBe('mix');
    expect(teamsLeft(t, 'axis')).toBe(0);
  });

  it('overstacked with fewer than two Teams left: no free Deploy, straight to the eliminations', () => {
    const hex = Array.from({ length: 2 }, () => ({ type: 'German/Rifle Squad', hex: 'E5' }));
    const ask = (left: number) => {
      const s = build({ pieces: [...hex, ...inStaging(TEAM, mixCount(TEAM) - left)] });
      const r = run(s, (ctx) => endOfTurn(s, ctx), choices({ overstackDeploy: [0], overstackEliminate: [0] }));
      return { s, deploy: asked(r.decisions, 'overstackDeploy'), elim: asked(r.decisions, 'overstackEliminate') };
    };
    const one = ask(1);
    expect(one.deploy).toEqual([]);
    expect(one.elim).toHaveLength(1);
    expect(one.s.players.axis.casualties).toHaveLength(1);
    const two = ask(2);
    expect(two.deploy).toHaveLength(1);
    expect(two.elim).toHaveLength(1); // 4 + 2 + 2 = 8 figures: he eliminates the other Squad
    expect(piecesOf(two.s, TEAM).filter((p) => p.where === 'map')).toHaveLength(2);
  });
});

describe('Fortification Actions (§A32, §A35.1–3, §A35.5): not playable without a marker left', () => {
  it('Dig In is not offered, and the one answer check refuses it', () => {
    const DI = card(G, { action: 'Dig In' });
    const s = build({ axis: { hand: [DI] }, fort: forts('foxholes', fortMixCount('foxholes')), pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }] });
    const r = run(s, (ctx) => advanceTime(s, ctx, 'axis'), passive);
    expect(r.decisions.filter((d) => d.kind === 'react')).toEqual([]);
    const d: Decision = { kind: 'react', side: 'axis', window: 'timeAdvanceEnd', options: [{ card: DI, action: 'Dig In', targets: { hexes: [H('E5')] } }], info: {} };
    expect(answerError(s, d, { kind: 'play', option: 0, targets: { hexes: [H('E5')] } })).toMatch(/counter mix has no Foxholes left/);
    // one taken off the map: Dig In is back
    removeFort(s, makeCtx([]), NUM_HEXES - 1);
    const r2 = run(s, (ctx) => advanceTime(s, ctx, 'axis'), passive);
    expect(r2.decisions.filter((d2) => d2.kind === 'react')).toHaveLength(1);
  });

  it('each Fortification Action needs one marker of its kind', () => {
    for (const kind of KINDS) {
      for (const action of PLACERS[kind].actions) {
        const full = build({ fort: forts(kind, fortMixCount(kind)) });
        expect(actionMixError(full, 'axis', action), action).toMatch(/counter mix/);
        const room = build({ fort: forts(kind, fortMixCount(kind) - 1) });
        expect(actionMixError(room, 'axis', action), action).toBeNull();
      }
    }
  });
});

describe('Fortification Events (§E47 Booby Trap, §E69 Rubble, §E73 Shellholes, §E55 Entrench)', () => {
  it.each([
    ['Booby Trap', 'mines'],
    ['Rubble', 'wire'],
    ['Shellholes', 'foxholes'],
  ] as [EventName, FortKind][])('%s with no %s left does nothing: no Random Hex is drawn', (event, kind) => {
    const top = eventTop(G, event, ['E5']);
    const s = build({ axis: { top }, fort: forts(kind, fortMixCount(kind)) });
    const r = trigger(s, 'axis', passive);
    expect(s.fort[H('E5')]).toBeNull();
    expect(s.players.axis.discards).toEqual([top[0]]);
    expect(s.players.axis.deck[0]).toBe(top[1]);
    expect(ofKind(r.events, 'log').some((e) => /counter mix/.test(e.text))).toBe(true);
    const t = build({ axis: { top }, fort: forts(kind, fortMixCount(kind) - 1) });
    trigger(t, 'axis', passive);
    expect(t.fort[H('E5')]).toBe(kind);
  });

  it('Entrench with no Foxholes left: nothing is asked', () => {
    const s = build({
      allied: { nation: 'Russian', top: eventTop(RU, 'Entrench') },
      fort: forts('foxholes', fortMixCount('foxholes')),
      pieces: [{ type: 'Russian/Rifle Squad', hex: 'E5' }],
    });
    const r = trigger(s, 'allied', choices({ entrenchHex: [0] }));
    expect(asked(r.decisions, 'entrenchHex')).toEqual([]);
    expect(s.fort[H('E5')]).toBeNull();
  });
});

describe('Support Table items (§E59, §E68, §A35.4): only what the mix still has', () => {
  const rollNot = (nation: Nation, sum: number, hex: string) => rolls(nation, [sum], cardsWhere(nation, { hex }))[0];
  const labels = (d: Extract<Decision, { kind: 'choose' }>) => d.items.map((i) => ('label' in i ? i.label : ''));

  it('Infiltration: no item whose unit or Weapon is used up; a Leader on the Casualty Track is in play', () => {
    const s = build({
      year: 1944,
      axis: { top: eventSeq(G, 'Infiltration', [rollNot(G, 7, 'E5'), 'E5']) },
      pieces: [{ type: 'German/Sgt Pfeiffer', where: 'casualty' }, ...inStaging('German/LMG', mixCount('German/LMG'))],
    });
    const r = trigger(s, 'axis', choices({ infiltration: { label: 'Rifle Squad' }, infiltrationPlace: [0] }));
    // column 7 in 1944: Sgt Pfeiffer, Wpn Team w/ Light MG, Wpn Team w/ Medium Mortar, Rifle Squad
    expect(labels(asked(r.decisions, 'infiltration')[0])).toEqual(['Wpn Team w/ Medium Mortar', 'Rifle Squad']);
  });

  it('Reinforcements: a Radio in play is not offered; eliminated, it is back in the mix and can come again', () => {
    const seq = () => eventSeq(G, 'Reinforcements', [rolls(G, [7])[0]]);
    const s = build({ year: 1944, axis: { top: seq() }, pieces: [{ type: 'German/Radio:150mm', where: 'artillery' }] });
    const r = trigger(s, 'axis', choices({ reinforcementItem: [0], reinforcementPlace: [0] }));
    expect(labels(asked(r.decisions, 'reinforcementItem')[0])).not.toContain('Radio: 150mm');
    const t = build({ year: 1944, axis: { top: seq() }, pieces: [{ type: 'German/Radio:150mm', where: 'artillery' }] });
    run(t, (ctx) => eliminate(t, ctx, 'p0', 'event'), passive);
    trigger(t, 'axis', choices({ reinforcementItem: { label: 'Radio: 150mm' } }));
    expect(piecesOf(t, 'German/Radio:150mm').map((p) => p.where).sort()).toEqual(['artillery', 'mix']);
  });

  it('Reinforcements: a unit type the mix has run out of is not offered', () => {
    const s = build({ year: 1944, axis: { top: eventSeq(G, 'Reinforcements', [rolls(G, [7])[0]]) }, pieces: inStaging('German/Rifle Squad', mixCount('German/Rifle Squad')) });
    const r = trigger(s, 'axis', choices({ reinforcementItem: [0], reinforcementPlace: [0] }));
    expect(labels(asked(r.decisions, 'reinforcementItem')[0])).not.toContain('Rifle Squad');
  });

  it('Hidden Unit: the item whose Weapon is used up is not offered', () => {
    const PASS = cardsWhere(G, { order: 'Recover', fireIsAction: false }).slice(0, 1);
    const s = build({
      year: 1944,
      map: { terrain: { C2: 'Woods', H3: 'Building' } },
      axis: { hand: PASS },
      allied: { posture: 'defend', hand: [card(US, { action: 'Hidden Unit' })], top: rolls(US, [4]) },
      pieces: [{ type: 'American/Line Squad', hex: 'K2' }, ...inStaging('American/MMG', mixCount('American/MMG'))],
    });
    const r = run(s, (ctx) => turnFlow(s, ctx), (d, st) => (d.kind === 'turn' ? { kind: 'pass', discard: PASS } : d.kind === 'react' ? play : passive(d, st)));
    // column 4 in 1944 offers Wpn Team w/ Medium MG and Green Squad: only the Squad is left, so nothing is asked
    expect(asked(r.decisions, 'supportItem')).toEqual([]);
    expect(piecesOf(s, 'American/Green Squad').map((p) => p.where)).toEqual(['map']);
    expect(piecesOf(s, 'American/Weapon Team')).toEqual([]);
  });
});

describe('RSG purchases (RS.7, RS.9: "countermix permitting")', () => {
  it('Fortification OBs: all their markers together within the mix', () => {
    expect(fortError(99, ['barbed_wire', 'barbed_wire'])).toBeNull(); // 18 Wire
    expect(fortError(99, ['barbed_wire', 'barbed_wire', 'barbed_wire'])).toMatch(/counter mix has only 18 Wire/);
    expect(fortError(99, ['hasty_minefield', 'hasty_minefield'])).toMatch(/counter mix has only 13 Mines/);
    expect(fortError(99, ['extensive_minefield', 'bunker_complex'])).toBeNull(); // 13 Mines, all 8 FP
    expect(fortError(99, ['bunker_complex', 'strongpoint'])).toMatch(/counter mix has only 3 Bunker/);
  });

  it('no generated scenario holds more counters or Fortifications than the mix', () => {
    for (let seed = 0; seed < 200; seed++) {
      const scn = rsgFinish(rsgAutoRun(newRsgDraft({ seed }), mulberry32(seed ^ 0x3c3c)));
      const used: Record<string, number> = {};
      for (const side of ['axis', 'allied'] as Side[]) {
        for (const [t, n] of Object.entries(scn.sides[side].forces)) used[t] = (used[t] ?? 0) + n;
        for (const [k, n] of Object.entries(scn.sides[side].fortifications)) used[`fort:${k}`] = (used[`fort:${k}`] ?? 0) + (n ?? 0);
      }
      for (const [k, n] of Object.entries(used)) {
        const cap = k.startsWith('fort:') ? fortMixCount(k.slice(5) as FortKind) : mixCount(k);
        expect(n, `seed ${seed}: ${k}`).toBeLessThanOrEqual(cap);
      }
    }
  });
});
