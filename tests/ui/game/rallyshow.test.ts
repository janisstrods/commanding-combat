// Recover, Rout and Commissar as small scenes (rallyShow.ts), from the engine's own events: who rolls for which unit,
// the number to stay under, the roll, the result, and a retreat's path hex by hex.
import { describe, expect, it } from 'vitest';
import { turnFlow } from '../../../src/engine/flow';
import type { GameEvent, GameState } from '../../../src/engine/types';
import { rallyNeed, rallyStep, rallyTarget, type RallyShow } from '../../../src/ui/game/rallyShow';
import { H, build, cardsWhere, card, rolls, start, type BuildSpec } from '../../support/build';

const G = 'German';
const RECOVER = cardsWhere(G, { order: 'Recover' });
const ROUT = cardsWhere(G, { order: 'Rout' });
const MOVE = card(G, { order: 'Move' });
const HANDS = [...RECOVER, ...ROUT, MOVE];

/** The scene after each event (the final state stands in for the state after each: names and sides only). */
function fold(events: GameEvent[], s: GameState): (RallyShow | null)[] {
  const out: (RallyShow | null)[] = [];
  let show: RallyShow | null = null;
  for (const e of events) {
    show = rallyStep(show, e, s);
    out.push(show);
  }
  return out;
}
const last = (shows: (RallyShow | null)[]) => shows.filter(Boolean).at(-1)!;

function order(name: 'Recover' | 'Rout', spec: BuildSpec) {
  const c = name === 'Recover' ? RECOVER[0] : ROUT[0];
  const s = build({ ...spec, axis: { ...spec.axis, hand: [c, ...(spec.axis?.hand ?? [])] } });
  return start(s, (ctx) => turnFlow(s, ctx)).answer({ kind: 'order', card: c, order: name });
}

describe('rallyStep', () => {
  it('a Recover: each broken unit with its Morale + Cover, roll and result, done when the Order is', () => {
    const f = order('Recover', {
      pieces: [
        { type: 'German/Rifle Squad', hex: 'E5', broken: true }, // broken Morale 7
        { type: 'German/Rifle Squad', hex: 'G5', broken: true },
        { type: 'German/Rifle Squad', hex: 'J5', broken: true },
        { type: 'American/Line Squad', hex: 'E1' },
      ],
      axis: { top: rolls(G, [6, 7, 8], HANDS), hand: [RECOVER[1], MOVE] },
    });
    const shows = fold(f.events, f.s);
    const show = last(shows);
    expect(show).toMatchObject({ kind: 'Recover', roller: 'axis', done: true });
    expect(show.units.map((u) => [u.from, rallyTarget(u), u.roll?.value, u.result])).toEqual([
      [H('E5'), 7, 6, 'rallied'],
      [H('G5'), 7, 7, 'suppressed'],
      [H('J5'), 7, 8, 'still broken'],
    ]);
    // the number to stay under is known before the card is turned
    const i = f.events.findIndex((e) => e.kind === 'rallying');
    expect(shows[i]!.units[0]).toMatchObject({ active: true, roll: null, morale: 7, cover: 0 });
  });

  it('a Rout: the Order’s player rolls for the other side’s units; a retreat keeps its path', () => {
    const f = order('Rout', {
      pieces: [
        { type: 'American/Line Squad', hex: 'E5', broken: true }, // broken Morale 8
        { type: 'American/Line Squad', hex: 'H5', broken: true },
        { type: 'American/Line Squad', hex: 'K5', broken: true },
        { type: 'German/Rifle Squad', hex: 'E9' },
      ],
      axis: { top: rolls(G, [7, 8, 10], ROUT) },
    });
    f.answer({ kind: 'choose', items: [0] }).answer({ kind: 'choose', items: [0] });
    const show = last(fold(f.events, f.s));
    expect(show).toMatchObject({ kind: 'Rout', roller: 'axis', done: true });
    expect(show.units.map((u) => [u.side, u.result, u.retreat])).toEqual([
      ['allied', 'holds', null],
      ['allied', 'suppressed', null],
      ['allied', 'retreats', { hexes: 2, path: [H('K4'), H('K3')] }],
    ]);
  });

  it('a unit routed off its own edge is eliminated, with the hexes it had to go', () => {
    const f = order('Rout', {
      pieces: [{ type: 'American/Line Squad', hex: 'E1', broken: true }, { type: 'American/Line Squad', hex: 'L1' }],
      axis: { top: rolls(G, [9], ROUT) },
    });
    const show = last(fold(f.events, f.s));
    expect(show.units[0]).toMatchObject({ from: H('E1'), result: 'eliminated', retreat: { hexes: 1, path: [], end: 'edge' } });
  });

  it('a Medic! rally shows the unit it rallies, with no roll', () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }, { type: 'American/Line Squad', hex: 'L1' }] });
    const events: GameEvent[] = [
      { kind: 'event', side: 'allied', card: 'A-01', event: 'Medic' },
      { kind: 'rally', piece: 'p0' },
      { kind: 'triggerDone', side: 'allied', trigger: 'Event' },
    ];
    const show = last(fold(events, s));
    expect(show).toMatchObject({ kind: 'Medic', roller: 'allied', done: true });
    expect(show.units).toMatchObject([{ unit: 'p0', from: H('E5'), result: 'rallied', morale: null }]);
    // a Hero placed with no unit to rally: nothing to show
    expect(fold([{ kind: 'event', side: 'axis', card: 'G-01', event: 'Hero' }, { kind: 'triggerDone', side: 'axis', trigger: 'Event' }], s).at(-1)).toBeNull();
  });

  it('closes when the next Order starts or the Turn changes', () => {
    const show: RallyShow = { id: 1, kind: 'Recover', roller: 'axis', units: [], done: true };
    const s = build({});
    expect(rallyStep(show, { kind: 'cardPlayed', side: 'axis', card: MOVE, as: 'order', name: 'Move' }, s)).toBeNull();
    expect(rallyStep(show, { kind: 'turnStart', side: 'allied', number: 2 }, s)).toBeNull();
  });
});

describe('rallyNeed', () => {
  it('says what each roll does', () => {
    expect(rallyNeed('Recover', 8)).toBe('Rallies on 7 or less · 8 Suppressed');
    expect(rallyNeed('Rout', 8)).toBe('Holds on 7 or less · 8 Suppressed · 9+ retreats');
    expect(rallyNeed('Commissar', 8)).toBe('Rallies on 8 or less · 9+ eliminated');
    expect(rallyNeed('Recover', 2)).toBe('No roll can rally it');
  });
});
