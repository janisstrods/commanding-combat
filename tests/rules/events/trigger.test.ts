// Events as an Event! trigger runs them (§1.9.1.1, §E42, R-04, R-07): every Event is registered; the Event follows the
// trigger of a roll; rolls inside never trigger; the deck running out inside an Event; the game ending inside one; and
// random play of every Event from busy positions (every random answer accepted, the state consistent).
import { describe, expect, it } from 'vitest';
import { deckOf } from '../../../src/engine/data';
import { roll } from '../../../src/engine/deck';
import { EVENT_HANDLERS } from '../../../src/engine/events/index';
import { NUM_HEXES } from '../../../src/engine/hex';
import { randomAnswer } from '../../../src/engine/random';
import { EVENTS } from '../../../src/engine/registry';
import type { EventName, GameState, Nation, Side } from '../../../src/engine/types';
import { H, build, card, cardsWhere, passive, run, type PieceSpec } from '../../support/build';
import { mulberry32 } from '../../support/rng';
import { G, RU, choices, eventSeq, eventTop, ofKind, trigger } from './kit';

describe('the Event! trigger', () => {
  it('all 35 Events have handlers', () => {
    expect(Object.keys(EVENT_HANDLERS).sort()).toEqual(Object.keys(EVENTS).sort());
    expect(Object.keys(EVENT_HANDLERS)).toHaveLength(35);
  });

  it('a roll\'s Event! reveals the next card and carries out its Event before the roll\'s result', () => {
    const ev = card(G, { trigger: 'Event' });
    const medic = cardsWhere(G, { event: 'Medic' }).find((c) => c !== ev)!;
    const s = build({ axis: { top: [ev, medic] }, pieces: [{ type: 'German/Rifle Squad', hex: 'E5', broken: true }] });
    const r = run(s, (ctx) => roll(s, ctx, 'axis', 'defense'), passive);
    const k = r.events.map((e) => e.kind);
    expect(k.slice(0, 5)).toEqual(['reveal', 'trigger', 'reveal', 'event', 'rally']);
    expect(s.pieces.p0.broken).toBe(false);
  });

  it('a roll inside an Event never triggers (§E42): Commissar\'s roll on a Time! card', () => {
    const time = card(RU, { trigger: 'Time' }); // 6-6
    const s = build({ allied: { nation: 'Russian', top: eventTop(RU, 'Commissar', [], [time]) }, pieces: [{ type: 'Russian/Rifle Squad', hex: 'E6', broken: true }] });
    const r = trigger(s, 'allied', passive);
    expect(s.time).toBe(0);
    expect(ofKind(r.events, 'trigger')).toEqual([]);
    expect(s.pieces.p0.where).toBe('casualty'); // 12 beats any Morale
  });

  it('the last card revealed inside an Event advances Time at once, then the Event goes on (R-07)', () => {
    const top = eventSeq(G, 'Shellholes', ['E5']);
    const s = build({ axis: { deck: top, discards: deckOf(G).filter((c) => !top.includes(c)) }, suddenDeath: 9 });
    const r = trigger(s, 'axis', passive);
    expect(s.time).toBe(1);
    expect(s.fort[H('E5')]).toBe('foxholes');
    const k = r.events.map((e) => e.kind);
    expect(k.indexOf('time')).toBeLessThan(k.lastIndexOf('place'));
  });

  it('a surrender inside an Event ends the game', () => {
    const s = build({
      allied: { surrender: 1 },
      axis: { top: eventTop(G, 'KIA') },
      pieces: [{ type: 'American/Line Squad', hex: 'E5', broken: true }, { type: 'American/Line Squad', hex: 'E7' }, { type: 'German/Rifle Squad', hex: 'E9' }],
    });
    trigger(s, 'axis', passive);
    expect([s.phase, s.winner, s.endReason]).toEqual(['over', 'axis', 'surrender']);
  });

  it('both sides surrendering at once inside an Event: the Initiative holder wins', () => {
    const s = build({
      initiative: 'allied',
      axis: { surrender: 1, top: eventTop(G, 'Air Support', ['E5']) },
      allied: { surrender: 1 },
      pieces: [
        { type: 'American/Line Squad', hex: 'E5', broken: true },
        { type: 'German/Rifle Squad', hex: 'E5', broken: true },
        { type: 'American/Line Squad', hex: 'A9' },
        { type: 'German/Rifle Squad', hex: 'O9' },
      ],
    });
    trigger(s, 'axis', choices({ airSupport: [0] }));
    expect([s.phase, s.winner]).toEqual(['over', 'allied']);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Random play of every Event

const ALL: EventName[] = Object.keys(EVENTS) as EventName[];

/** The receiver of `event`: the Axis (German deck) when the German deck has it, else the Allies with a deck that has it. */
function receiverOf(event: EventName): { side: Side; nation: Nation } | null {
  for (const nation of ['German', 'American', 'Russian'] as Nation[]) {
    if (cardsWhere(nation, { event }).length) return { side: nation === 'German' ? 'axis' : 'allied', nation };
  }
  return null;
}

function busy(event: EventName, seed: number): { s: GameState; side: Side } {
  const rnd = mulberry32(seed * 31 + event.length);
  const rec = receiverOf(event)!;
  const allied: Nation = rec.side === 'allied' ? rec.nation : seed % 2 ? 'American' : 'Russian';
  const hex = () => Math.floor(rnd() * NUM_HEXES);
  const pieces: PieceSpec[] = [];
  const unitTypes: Record<Side, string[]> = {
    axis: ['German/Rifle Squad', 'German/Line Team', 'German/Sgt Esser', 'German/Rifle Squad'],
    allied: [`${allied}/${allied === 'American' ? 'Line' : 'Rifle'} Squad`, `${allied}/Line Team`, `${allied}/Weapon Team`],
  };
  const mg: Record<Side, string> = { axis: 'German/LMG', allied: `${allied}/MMG` };
  for (const side of ['axis', 'allied'] as Side[]) {
    const n = 3 + Math.floor(rnd() * 6);
    for (let i = 0; i < n; i++) {
      const type = unitTypes[side][Math.floor(rnd() * unitTypes[side].length)];
      const where = rnd() < 0.15 ? 'casualty' : undefined;
      const spec: PieceSpec = { type, side, broken: rnd() < 0.35, suppressed: rnd() < 0.2, veteran: rnd() < 0.2 };
      if (where) spec.where = where;
      else spec.hex = hex();
      if (!where && rnd() < 0.3) spec.weapon = { type: mg[side], broken: rnd() < 0.3 };
      pieces.push(spec);
    }
  }
  const s = build({
    seed,
    year: 1943 + (seed % 3),
    axis: { posture: 'attack' },
    allied: { nation: allied, posture: 'defend' },
    pieces,
    control: [rnd() < 0.5 ? 'axis' : 'allied', null, 'allied', 'axis', null],
    smoke: { C3: 2, H6: 5 },
    fort: { D4: 'mines', F6: 'wire', J5: 'foxholes' },
    suddenDeath: 6 + (seed % 5),
    time: seed % 4,
  });
  // keep it legal: no impassable or mixed hexes at the start
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.where !== 'map') continue;
    const enemy = Object.values(s.pieces).some((q) => q.where === 'map' && q.hex === p.hex && q.side !== p.side && q.id < p.id);
    if (enemy) p.hex = (p.hex + 75) % NUM_HEXES;
  }
  if (seed % 3 === 0) s.blaze[H('L4')] = !Object.values(s.pieces).some((p) => p.where === 'map' && p.hex === H('L4'));
  for (const side of ['axis', 'allied'] as Side[]) {
    const pl = s.players[side];
    pl.hand = pl.deck.splice(0, 3 + (seed % 3));
    if (seed % 2) pl.secretChits = [s.chitCup.shift()!];
  }
  // the Event card on top of the receiver's pile
  const pl = s.players[rec.side];
  const ev = cardsWhere(rec.nation, { event }).find((c) => pl.deck.includes(c)) ?? cardsWhere(rec.nation, { event })[0];
  for (const list of [pl.hand, pl.deck, pl.discards]) {
    const i = list.indexOf(ev);
    if (i >= 0) list.splice(i, 1);
  }
  pl.deck.unshift(ev);
  if (seed % 4 === 3) {
    // a nearly empty pile: Time advances inside the Event
    pl.discards.push(...pl.deck.splice(3));
  }
  return { s, side: rec.side };
}

describe('random play of every Event', () => {
  it.each(ALL)('%s: random answers from busy positions are always accepted', (event) => {
    for (let seed = 0; seed < 12; seed++) {
      const { s, side } = busy(event, seed);
      const rnd = mulberry32(seed + 99);
      const r = trigger(s, side, (d, st) => randomAnswer(st, d, rnd));
      expect(ofKind(r.events, 'event')[0]?.event).toBe(event);
      expect(r.pending).toBe(null);
      for (const sd of ['axis', 'allied'] as Side[]) {
        const p = s.players[sd];
        expect(new Set([...p.hand, ...p.deck, ...p.discards]).size).toBe(72);
      }
      for (const id in s.pieces) {
        const p = s.pieces[id];
        if (p.where === 'carried') expect(s.pieces[p.carrier!].weapon).toBe(id);
        if (p.weapon) expect(s.pieces[p.weapon].carrier).toBe(id);
        if (p.where === 'map') expect(s.blaze[p.hex] || s.map.terrain[p.hex] === 'Water').toBe(false);
      }
      if (s.phase !== 'over') expect(ofKind(r.events, 'log').filter((e) => e.text.includes('not yet implemented'))).toEqual([]);
    }
  });
});
