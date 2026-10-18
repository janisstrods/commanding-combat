// Melee (§O16.4, §A25 / §A38 windows, §F101 / §F104 ties, R-04, R-05, R-24): when, strength, staggered rolls, results.
import { afterEach, describe, expect, it } from 'vitest';
import { eliminate } from '../../src/engine/casualties';
import { CARDS } from '../../src/engine/data';
import { deeper, eventTrigger } from '../../src/engine/deck';
import type { Gen } from '../../src/engine/decisions';
import { guard, resolveMelees, turnFlow } from '../../src/engine/flow';
import { meleeFp, resolveMelee, withHolders } from '../../src/engine/melee';
import { relocate } from '../../src/engine/objectives';
import { ACTIONS, EVENTS } from '../../src/engine/registry';
import type { EventName, GameEvent, GameState, Side, WindowInfo } from '../../src/engine/types';
import { H, build, card, cardsWhere, passive, rolls, run, start, type BuildSpec, type Responder } from '../support/build';

const G = 'German';
const A = 'American';
type MeleeEvent = Extract<GameEvent, { kind: 'melee' }>;
type RevealEvent = Extract<GameEvent, { kind: 'reveal' }>;

const savedA: Partial<typeof ACTIONS> = {};
const savedE: Partial<typeof EVENTS> = {};
afterEach(() => {
  Object.assign(ACTIONS, savedA);
  Object.assign(EVENTS, savedE);
});

const meleeReveals = (events: GameEvent[]) => events.filter((e): e is RevealEvent => e.kind === 'reveal' && e.purpose === 'melee').map((e) => e.side);
const meleeOf = (events: GameEvent[]) => events.find((e): e is MeleeEvent => e.kind === 'melee');

/** A German Rifle Squad (5 FP) and an American Line Squad (6 boxed: 7) in E5, plus one more unit each elsewhere. */
const pair = (spec: BuildSpec = {}): BuildSpec => ({
  ...spec,
  pieces: [
    { type: 'German/Rifle Squad', hex: 'E5' }, // p0
    { type: 'American/Line Squad', hex: 'E5' }, // p1
    { type: 'German/Rifle Squad', hex: 'L9' }, // p2
    { type: 'American/Line Squad', hex: 'L1' }, // p3
    ...(spec.pieces ?? []),
  ],
});

const melees = (s: GameState, respond: Responder = passive) => run(s, (ctx) => resolveMelees(s, ctx), respond);

describe('melee (§O16.4)', () => {
  it('the inactive player rolls first, then the active one; the lower total loses all its units', () => {
    const s = build(pair({ allied: { top: rolls(A, [4]) }, axis: { top: rolls(G, [10]) } }));
    const r = melees(s);
    expect(meleeReveals(r.events)).toEqual(['allied', 'axis']);
    expect(meleeOf(r.events)).toEqual({ kind: 'melee', hex: H('E5'), totals: { axis: 15, allied: 11 }, losers: ['allied'] });
    expect(s.pieces.p1.where).toBe('casualty');
    expect(s.pieces.p0).toMatchObject({ where: 'map', hex: H('E5'), broken: false });
    expect(s.vp).toBe(2);
  });

  it('Melee FP: each unit\'s current FP (Command, Veteran, Suppressed, Wire, broken side; no Weapons) + 1 per boxed FP', () => {
    const s = build({
      fort: { H5: 'wire' },
      pieces: [
        { type: 'German/Lt Von Karsties', hex: 'E5' }, // p0: 2
        { type: 'German/Rifle Squad', hex: 'E5', weapon: 'German/LMG' }, // p1: 5 + 2 Command, the LMG not counted
        { type: 'American/Line Squad', hex: 'E5', suppressed: true }, // p3: 6 − 1, boxed + 1
        { type: 'American/Line Squad', hex: 'E5', broken: true }, // p4: 3, its broken side shows no box
        { type: 'American/Line Team', hex: 'E5', veteran: true }, // p5: 3 + 1, boxed + 1
        { type: 'German/Rifle Squad', hex: 'H5' }, // p6: 5 − 1 in Wire
        { type: 'German/Cpl Guttman', hex: 'H5', broken: true, suppressed: true }, // p7: 0 − 1 counts as 0
      ],
    });
    expect(meleeFp(s, ['p0', 'p1'])).toBe(9);
    expect(meleeFp(s, ['p3', 'p4', 'p5'])).toBe(6 + 3 + 5);
    expect(meleeFp(s, ['p6', 'p7'])).toBe(4);
  });

  it('a tie eliminates both sides', () => {
    const s = build(pair({ allied: { top: rolls(A, [4]) }, axis: { top: rolls(G, [6]) } }));
    const r = melees(s);
    expect(meleeOf(r.events)).toMatchObject({ totals: { axis: 11, allied: 11 }, losers: ['axis', 'allied'] });
    expect([s.pieces.p0.where, s.pieces.p1.where]).toEqual(['casualty', 'casualty']);
  });

  it('a tie in a Bunker: only the side that came in is eliminated (§F101); Advance says who held the hex', () => {
    const s = build({
      fort: { E5: 'bunker' },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E6' }, { type: 'American/Line Squad', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'L9' }],
      axis: { hand: [card(G, { order: 'Advance' })], top: rolls(G, [6]) },
      allied: { top: rolls(A, [4]) },
    });
    const c = s.players.axis.hand[0];
    const f = start(s, (ctx) => turnFlow(s, ctx));
    f.answer({ kind: 'order', card: c, order: 'Advance' }).answer({ kind: 'activate', units: ['p0'] }).answer({ kind: 'advanceTo', unit: 'p0', to: H('E5') });
    expect(meleeOf(f.events)).toMatchObject({ totals: { axis: 11, allied: 11 }, losers: ['axis'] });
    expect([s.pieces.p0.where, s.pieces.p1.where]).toEqual(['casualty', 'map']);
  });

  it('a tie in a Pillbox likewise spares its holder (§F104)', () => {
    const s = build(pair({ fort: { E5: 'pillbox' }, allied: { top: rolls(A, [4]) }, axis: { top: rolls(G, [6]) } }));
    const r = run(s, (ctx) => resolveMelee(s, withHolders(ctx, { [H('E5')]: 'axis' }), H('E5')), passive);
    expect(meleeOf(r.events)).toMatchObject({ losers: ['allied'] });
    expect([s.pieces.p0.where, s.pieces.p1.where]).toEqual(['map', 'casualty']);
  });

  it('several melee hexes: the active player picks the order, one at a time', () => {
    const s = build(pair({ pieces: [{ type: 'German/Rifle Squad', hex: 'H5' }, { type: 'American/Line Squad', hex: 'H5' }] }));
    const r = melees(s, (d, st) => (d.kind === 'choose' && d.reason === 'meleeOrder' ? { kind: 'choose', items: [1] } : passive(d, st)));
    expect(r.decisions.find((d) => d.kind === 'choose')).toMatchObject({ side: 'axis', reason: 'meleeOrder', items: [{ hex: H('E5') }, { hex: H('H5') }] });
    expect(r.events.filter((e): e is MeleeEvent => e.kind === 'melee').map((e) => e.hex)).toEqual([H('H5'), H('E5')]);
  });

  it('Ambush first, inactive player then active (§A25); a side wiped out by Ambushes ends the melee with no rolls', () => {
    const asked: Side[] = [];
    const played = new Set<Side>();
    savedA.Ambush = ACTIONS.Ambush;
    ACTIONS.Ambush = {
      windows: ['beforeMelee'],
      options: (_s, side) => (played.has(side) ? [] : [{ card: '', action: 'Ambush' }]),
      *run(st, ctx, side, _o, _a, info): Gen {
        asked.push(side);
        played.add(side);
        if (side === 'allied') for (const p of Object.values(st.pieces)) if (p.side === 'axis' && p.where === 'map' && p.hex === info.hex) yield* eliminate(st, ctx, p.id, 'ambush');
      },
    };
    const s = build(pair());
    const r = melees(s, (d, st) => (d.kind === 'react' ? { kind: 'play', option: 0 } : passive(d, st)));
    expect(asked).toEqual(['allied', 'axis']);
    expect(meleeReveals(r.events)).toEqual([]);
    expect(meleeOf(r.events)).toBeUndefined();
    expect(s.pieces.p1.where).toBe('map');
  });

  it('Melee FP is fixed once computed: a trigger breaking a participant does not change it (R-24)', () => {
    const sniper = card(A, { trigger: 'Sniper', white: 4, red: 4 });
    const hexCard = cardsWhere(A, { trigger: null })[0];
    const hex = CARDS[hexCard].hex;
    const s = build({
      pieces: [{ type: 'German/Rifle Squad', hex }, { type: 'American/Line Squad', hex }, { type: 'German/Rifle Squad', hex: 'L9' }, { type: 'American/Line Squad', hex: 'L1' }],
      allied: { top: [sniper, hexCard] },
      axis: { top: rolls(G, [9]) },
    });
    const r = melees(s, (d, st) => (d.kind === 'choose' && d.reason === 'sniperTarget' ? { kind: 'choose', items: [d.items.findIndex((i) => 'piece' in i && i.piece === 'p0')] } : passive(d, st)));
    expect(r.events.some((e) => e.kind === 'break' && e.piece === 'p0')).toBe(true);
    // the German's 5 FP stays 5 although it broke during the Allied roll (its broken side has 2)
    expect(meleeOf(r.events)).toMatchObject({ totals: { axis: 5 + 9, allied: 7 + 8 }, losers: ['axis'] });
  });

  it('a trigger that leaves a side without units in the hex ends the melee with no result (R-05)', () => {
    const sniper = card(A, { trigger: 'Sniper', white: 4, red: 4 });
    const hexCard = cardsWhere(A, { trigger: null })[0];
    const hex = CARDS[hexCard].hex;
    const s = build({
      pieces: [{ type: 'German/Rifle Squad', hex, broken: true }, { type: 'American/Line Squad', hex }, { type: 'German/Rifle Squad', hex: 'L9' }, { type: 'American/Line Squad', hex: 'L1' }],
      allied: { top: [sniper, hexCard] },
    });
    const r = melees(s, (d, st) => (d.kind === 'choose' && d.reason === 'sniperTarget' ? { kind: 'choose', items: [d.items.findIndex((i) => 'piece' in i && i.piece === 'p0')] } : passive(d, st)));
    expect(s.pieces.p0.where).toBe('casualty');
    expect(meleeReveals(r.events)).toEqual(['allied']); // the Axis never rolls
    expect(meleeOf(r.events)).toBeUndefined();
    expect(s.pieces.p1.where).toBe('map');
  });

  it('a melee caused by an Event is fought at its end, inside it: its rolls never trigger (R-04)', () => {
    const top = card(G, { event: 'Hero' });
    const ev: EventName = CARDS[top].event;
    savedE[ev] = EVENTS[ev];
    EVENTS[ev] = function* (st, ctx): Gen {
      relocate(st, ctx, 'p2', H('E5')); // the Event puts a German unit into the American hex
    };
    const time = card(A, { white: 6, red: 6 }); // Time!
    const s = build({
      pieces: [
        { type: 'American/Line Squad', hex: 'E5' }, { type: 'American/Line Squad', hex: 'L1' }, { type: 'German/Rifle Squad', hex: 'E6' },
        { type: 'German/Rifle Squad', hex: 'L9' },
      ],
      axis: { top: [top, ...rolls(G, [3])] },
      allied: { top: [time] },
    });
    const r = run(s, (ctx) => eventTrigger(s, deeper(ctx), 'axis'), passive);
    expect(meleeReveals(r.events)).toEqual(['allied', 'axis']);
    expect(r.events.some((e) => e.kind === 'trigger')).toBe(false);
    expect(s.time).toBe(0);
    expect(meleeOf(r.events)).toMatchObject({ totals: { allied: 7 + 12, axis: 5 + 3 }, losers: ['axis'] });
  });

  it('a Time! trigger on a melee roll advances Time without starting the same melee again', () => {
    const s = build(pair({ allied: { top: [card(A, { white: 6, red: 6 })] }, axis: { top: rolls(G, [5]) } }));
    const r = melees(s);
    expect(s.time).toBe(1);
    expect(r.events.filter((e) => e.kind === 'melee')).toHaveLength(1);
    expect(meleeOf(r.events)).toMatchObject({ totals: { allied: 19, axis: 10 }, losers: ['axis'] });
  });

  it('the No Quarter window opens after a resolved melee, for both players, with the participants (§A38)', () => {
    const infos: WindowInfo[] = [];
    savedA['No Quarter'] = ACTIONS['No Quarter'];
    ACTIONS['No Quarter'] = {
      windows: ['afterMelee'],
      options: (_s, _side, _w, info) => {
        infos.push(structuredClone(info));
        return [];
      },
      *run() {},
    };
    const s = build(pair({ allied: { top: rolls(A, [4]) }, axis: { top: rolls(G, [10]) } }));
    melees(s);
    expect(infos).toHaveLength(2); // asked of both players
    expect(infos[0]).toEqual({ hex: H('E5'), units: ['p0', 'p1'] });
  });

  it('the eliminations are judged together: both sides surrendering at once → the Initiative holder wins', () => {
    const s = build(pair({ axis: { surrender: 1, top: rolls(G, [6]) }, allied: { surrender: 1, top: rolls(A, [4]) }, initiative: 'allied' }));
    run(s, (ctx) => guard(s, ctx, resolveMelees(s, ctx)), passive);
    expect(s).toMatchObject({ phase: 'over', winner: 'allied', endReason: 'surrender' });
  });
});
