// Fate decks: refill, deck exhaustion, rolls, triggers, the Initiative re-roll, Time advances and Sudden Death
// (rules-reference §1.3, §1.9.1, §5.4, §6.1.2, §6.2, §9.1, R-07, R-08).
import { afterEach, describe, expect, it } from 'vitest';
import { CARDS, deckOf } from '../../src/engine/data';
import { advanceTime, refill, roll } from '../../src/engine/deck';
import type { Gen } from '../../src/engine/decisions';
import { guard } from '../../src/engine/flow';
import { EVENTS } from '../../src/engine/registry';
import { GameOver, mixedHexes } from '../../src/engine/state';
import type { EventName, GameEvent } from '../../src/engine/types';
import { H, build, card, rolls, run, passive, script } from '../support/build';

const G = 'German';
const kinds = (es: GameEvent[]) => es.map((e) => e.kind);

describe('hand refill (§5.4)', () => {
  it('draws up to the hand size', () => {
    const hand = [card(G, { order: 'Fire' }), card(G, { order: 'Move' })];
    const s = build({ axis: { posture: 'attack', hand } });
    const before = s.players.axis.deck.slice(0, 4);
    const r = run(s, (ctx) => refill(s, ctx, 'axis'), passive);
    expect(s.players.axis.hand).toEqual([...hand, ...before]);
    expect(s.players.axis.deck).toHaveLength(72 - 6);
    expect(r.events).toEqual([{ kind: 'draw', side: 'axis', cards: before }]);
  });

  it('drawing the last card advances Time mid-refill, then finishes from the new pile', () => {
    const all = deckOf(G);
    const hand = all.slice(0, 3);
    const deck = all.slice(3, 5);
    const discards = all.slice(5);
    const s = build({ axis: { posture: 'attack', hand, deck, discards }, time: 2, suddenDeath: 9 });
    const r = run(s, (ctx) => refill(s, ctx, 'axis'), passive);
    expect(s.time).toBe(3);
    const p = s.players.axis;
    expect(p.hand).toHaveLength(6);
    expect(p.hand.slice(0, 5)).toEqual([...hand, ...deck]);
    expect(p.discards).toEqual([]);
    expect(p.deck).toHaveLength(72 - 6);
    expect(discards).toContain(p.hand[5]);
    expect(kinds(r.events)).toEqual(['draw', 'time', 'reshuffle', 'draw']);
  });
});

describe('rolls and triggers (§1.9)', () => {
  it('sums the dice, multiplies them for Targeting, and notes doubles', () => {
    const top = rolls(G, [[3, 5], [2, 2]]);
    const s = build({ axis: { top } });
    const r1 = run(s, (ctx) => roll(s, ctx, 'axis', 'defense'), passive).result!;
    expect([r1.white, r1.red, r1.sum, r1.product, r1.doubles]).toEqual([3, 5, 8, 15, false]);
    const r2 = run(s, (ctx) => roll(s, ctx, 'axis', 'targeting'), passive).result!;
    expect([r2.sum, r2.product, r2.doubles]).toEqual([4, 4, true]);
    expect(s.players.axis.discards).toEqual(top);
    expect(s.lastRoll).toEqual({ side: 'axis', card: top[1], purpose: 'targeting' });
  });

  it('a Time! trigger advances Time and reshuffles the roller\'s piles', () => {
    const time = card(G, { trigger: 'Time' });
    const s = build({ axis: { top: [time] }, time: 0, suddenDeath: 9 });
    const r = run(s, (ctx) => roll(s, ctx, 'axis', 'defense'), passive);
    expect(s.time).toBe(1);
    expect(s.players.axis.discards).toEqual([]);
    expect(s.players.axis.deck).toHaveLength(72);
    expect(kinds(r.events)).toEqual(['reveal', 'trigger', 'time', 'reshuffle']);
  });

  it('a Time! trigger on the last card advances Time only once', () => {
    const all = deckOf(G);
    const time = card(G, { trigger: 'Time' });
    const s = build({ axis: { deck: [time], discards: all.filter((c) => c !== time) }, time: 0, suddenDeath: 9 });
    run(s, (ctx) => roll(s, ctx, 'axis', 'defense'), passive);
    expect(s.time).toBe(1);
  });

  it('a non-Time trigger on the last card: Time advances first, then the trigger resolves', () => {
    const all = deckOf(G);
    const sniper = card(G, { trigger: 'Sniper' });
    const rest = all.filter((c) => c !== sniper);
    const s = build({ axis: { deck: [sniper], discards: rest }, time: 0, suddenDeath: 9 });
    const r = run(s, (ctx) => roll(s, ctx, 'axis', 'defense'), passive);
    expect(s.time).toBe(1);
    const k = kinds(r.events);
    expect(k.indexOf('time')).toBeLessThan(k.indexOf('trigger'));
    // the Sniper's Random Hex came from the new pile
    expect(k.slice(k.indexOf('trigger'))).toContain('reveal');
  });

  describe('inside an Event', () => {
    const saved: Partial<Record<EventName, (typeof EVENTS)[EventName]>> = {};
    afterEach(() => Object.assign(EVENTS, saved));

    it('an Event! trigger reveals the next card for its Event; rolls inside the Event never trigger', () => {
      const ev = card(G, { trigger: 'Event' });
      const eventCard = card(G, { trigger: null, event: 'Hero' });
      const time = card(G, { trigger: 'Time' });
      const s = build({ axis: { top: [ev, eventCard, time] }, time: 0, suddenDeath: 9 });
      saved.Hero = EVENTS.Hero;
      const inner: number[] = [];
      EVENTS.Hero = function* (st, ctx, receiver): Gen {
        const r = yield* roll(st, ctx, receiver, 'eventRoll');
        inner.push(r.sum, ctx.depth ?? 0);
      };
      const r = run(s, (ctx) => roll(s, ctx, 'axis', 'defense'), passive);
      expect(inner).toEqual([12, 1]);
      expect(s.time).toBe(0); // the 6-6 Time! inside the Event did not trigger
      expect(r.events.filter((e) => e.kind === 'event')).toEqual([{ kind: 'event', side: 'axis', card: eventCard, event: 'Hero' }]);
    });

    it('a roll at trigger depth > 0 never triggers', () => {
      const time = card(G, { trigger: 'Time' });
      const s = build({ axis: { top: [time] } });
      const r = run(s, (ctx) => roll(s, { ...ctx, depth: 1 }, 'axis', 'eventRoll'), passive);
      expect(s.time).toBe(0);
      expect(kinds(r.events)).toEqual(['reveal']);
    });

    it('running out of cards inside an Event still advances Time at once (R-07)', () => {
      const all = deckOf(G);
      const ev = card(G, { trigger: 'Event' });
      const eventCard = card(G, { trigger: null, event: 'Hero' });
      const s = build({ axis: { deck: [ev, eventCard], discards: all.filter((c) => c !== ev && c !== eventCard) }, time: 0, suddenDeath: 9 });
      saved.Hero = EVENTS.Hero;
      let timeInEvent = -1;
      EVENTS.Hero = function* (st): Gen {
        timeInEvent = st.time;
      };
      run(s, (ctx) => roll(s, ctx, 'axis', 'defense'), passive);
      expect(timeInEvent).toBe(1);
      expect(s.time).toBe(1);
    });
  });
});

describe('the Initiative re-roll (§9.1)', () => {
  it('cancels the roll, re-rolls from the same player\'s deck, then the card passes to the opponent', () => {
    const top = rolls(G, [[1, 2], [6, 5]]);
    const s = build({ axis: { top }, initiative: 'allied' });
    const r = run(s, (ctx) => roll(s, ctx, 'axis', 'defense'), script([{ kind: 'reroll', yes: true }]));
    const asked = r.decisions.filter((d) => d.kind === 'reroll').map((d) => d.side);
    expect(asked).toEqual(['allied', 'axis']); // the new holder may re-roll the re-roll
    expect(r.result!.sum).toBe(11);
    expect(s.initiative).toBe('axis');
    expect(s.players.axis.discards).toEqual(top);
    expect(r.events).toContainEqual({ kind: 'reroll', side: 'axis', by: 'allied' });
  });

  it('a cancelled roll\'s trigger never happens', () => {
    const time = card(G, { trigger: 'Time' });
    const plain = rolls(G, [7]);
    const s = build({ axis: { top: [time, ...plain] }, initiative: 'axis' });
    run(s, (ctx) => roll(s, ctx, 'axis', 'defense'), script([{ kind: 'reroll', yes: true }]));
    expect(s.time).toBe(0);
    expect(s.initiative).toBe('allied');
  });

  it('a Time advance caused by revealing the last card stands after a re-roll (R-08)', () => {
    const all = deckOf(G);
    const last = rolls(G, [4])[0];
    const s = build({ axis: { deck: [last], discards: all.filter((c) => c !== last) }, initiative: 'allied', suddenDeath: 9 });
    const r = run(s, (ctx) => roll(s, ctx, 'axis', 'defense'), script([{ kind: 'reroll', yes: true }]));
    expect(s.time).toBe(1);
    expect(r.result!.card.id).not.toBe(last);
  });
});

describe('Time advance (§6.1.2) and Sudden Death (§6.2)', () => {
  it('the Defender gains 1 VP per advance', () => {
    const s = build({ axis: { posture: 'attack' }, allied: { posture: 'defend' }, suddenDeath: 9 });
    run(s, (ctx) => advanceTime(s, ctx, 'axis'), passive);
    run(s, (ctx) => advanceTime(s, ctx, 'allied'), passive);
    expect(s.time).toBe(2);
    expect(s.vp).toBe(-2); // two toward the Allies
  });

  it('Recon against Recon: nobody gains VP', () => {
    const s = build({ axis: { posture: 'recon' }, allied: { posture: 'recon' }, suddenDeath: 9 });
    run(s, (ctx) => advanceTime(s, ctx, 'axis'), passive);
    expect(s.vp).toBe(0);
  });

  it('a Sudden Death roll below the Time space ends the game (VP decide, the Initiative breaks a tie)', () => {
    // the reshuffle randomises the pile: give the triggering player a deck whose every card rolls 2 (1-1)... instead
    // check both outcomes by searching seeds for a low and a high Sudden Death roll
    const outcome = (seed: number) => {
      const s = build({ time: 4, suddenDeath: 5, vp: 0, initiative: 'allied', seed });
      try {
        const r = run(s, (ctx) => advanceTime(s, ctx, 'axis'), passive);
        const sd = r.events.find((e) => e.kind === 'suddenDeath') as Extract<GameEvent, { kind: 'suddenDeath' }>;
        return { ended: false, roll: sd.roll, s };
      } catch (e) {
        expect(e).toBeInstanceOf(GameOver);
        return { ended: true, winner: (e as GameOver).winner, reason: (e as GameOver).reason, s };
      }
    };
    let low = null;
    let high = null;
    for (let seed = 1; seed < 200 && (!low || !high); seed++) {
      const o = outcome(seed);
      if (o.ended) low ??= o;
      else high ??= o;
    }
    expect(low).toMatchObject({ ended: true, winner: 'allied', reason: 'suddenDeath' });
    expect(high!.roll).toBeGreaterThanOrEqual(5);
    expect(high!.s.time).toBe(5);
  });

  it('no Sudden Death roll before the marker is reached', () => {
    const s = build({ time: 2, suddenDeath: 5 });
    const r = run(s, (ctx) => advanceTime(s, ctx, 'axis'), passive);
    expect(r.events.some((e) => e.kind === 'suddenDeath')).toBe(false);
    expect(r.decisions.some((d) => d.kind === 'reroll')).toBe(false);
  });

  it('the Sudden Death roll is a roll (it can be re-rolled) but never triggers', () => {
    const s = build({ time: 4, suddenDeath: 5, seed: 3 });
    const r = run(s, (ctx) => guard(s, ctx, advanceTime(s, ctx, 'axis')), (d, st) => {
      if (d.kind === 'reroll') return { kind: 'reroll', yes: false };
      return passive(d, st);
    });
    expect(r.decisions.filter((d) => d.kind === 'reroll')).toHaveLength(1);
    expect(r.events.some((e) => e.kind === 'trigger')).toBe(false);
  });

  it('removes one Smoke marker of the triggering player\'s choice', () => {
    const s = build({ smoke: { C3: 2, D4: 5 }, suddenDeath: 9 });
    const r = run(s, (ctx) => advanceTime(s, ctx, 'axis'), script([{ kind: 'choose', items: [1] }]));
    const d = r.decisions.find((x) => x.kind === 'choose')!;
    expect(d).toMatchObject({ side: 'axis', reason: 'smokeRemoval', min: 1, max: 1 });
    expect(s.smoke.filter((v) => v > 0)).toEqual([2]);
    expect(s.smokeCup).toHaveLength(51);
  });

  it('brings in the reinforcements of the new Time space along the owner\'s edge', () => {
    const s = build({
      allied: { edge: 'top' },
      pieces: [{ type: 'American/Line Squad', where: 'time', space: 1, weapon: 'American/MMG' }],
      suddenDeath: 9,
    });
    const r = run(s, (ctx) => advanceTime(s, ctx, 'axis'), script([{ kind: 'deploy', piece: 'p0', hex: 40 }]));
    const d = r.decisions.find((x) => x.kind === 'deploy')!;
    expect(d.side).toBe('allied');
    expect((d as Extract<typeof d, { kind: 'deploy' }>).hexes.every((h) => h % 10 === 0)).toBe(true); // row 1
    expect(s.pieces.p0).toMatchObject({ where: 'map', hex: 40, weapon: 'p1' });
    expect(r.events).toContainEqual({ kind: 'reinforce', pieces: ['p0'] });
  });

  it('cards everywhere stay unique', () => {
    const s = build({ suddenDeath: 9 });
    run(s, (ctx) => advanceTime(s, ctx, 'axis'), passive);
    const p = s.players.axis;
    expect(new Set([...p.hand, ...p.deck, ...p.discards]).size).toBe(72);
    expect([...p.hand, ...p.deck, ...p.discards].every((c) => CARDS[c].nation === 'German')).toBe(true);
  });
});

describe('reinforcements into an enemy-held hex (R-33, §F101, audit)', () => {
  const game = (seed: number, fort?: 'bunker') =>
    build({
      seed,
      allied: { edge: 'top' },
      fort: fort ? { E1: fort } : {},
      pieces: [
        { type: 'German/Rifle Squad', hex: 'E1' }, // p0: FP 5
        { type: 'German/Rifle Squad', hex: 'J9' },
        { type: 'American/Line Squad', where: 'time', space: 1 }, // p2: FP 6 + 1 boxed
        { type: 'American/Line Squad', hex: 'A9' },
      ],
      suddenDeath: 9,
      axis: { top: rolls(G, [[3, 6]]) }, // the Axis (not reshuffled) rolls 9: 14 against 7 + the Allied roll
    });
  const place = () => script([{ kind: 'deploy', piece: 'p2', hex: H('E1') }]);

  it('may enter it; the melee is fought at the end of the Time advance, its rolls never trigger', () => {
    const s = game(1);
    const r = run(s, (ctx) => advanceTime(s, ctx, 'allied'), place());
    expect(r.events.filter((e) => e.kind === 'melee')).toHaveLength(1);
    expect(r.events.filter((e) => e.kind === 'trigger')).toEqual([]);
    expect(mixedHexes(s)).toEqual([]);
  });

  it('a tie in a Bunker the enemy held: only the reinforcements die', () => {
    let tied = 0;
    for (let seed = 1; seed < 400 && tied < 2; seed++) {
      const s = game(seed, 'bunker');
      const r = run(s, (ctx) => advanceTime(s, ctx, 'allied'), place());
      const m = r.events.find((e) => e.kind === 'melee') as Extract<GameEvent, { kind: 'melee' }>;
      expect(m).toBeTruthy();
      if (m.totals.axis !== m.totals.allied) continue;
      tied++;
      expect(m.losers).toEqual(['allied']);
      expect(s.pieces.p0.where).toBe('map');
      expect(s.pieces.p2.where).toBe('casualty');
    }
    expect(tied).toBe(2);
  });
});
