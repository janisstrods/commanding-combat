// The randomiser moment (randomiser.ts): engine events → the steps the battle screen stages (which hexes, in what
// order), what a landed Random Hex reaches by the rules (§1.9.1.3, §E43–§E76), the hop path (it lands on the card's
// hex and only ever visits hexes that deck can show) and the timings at each speed.
import { describe, expect, it } from 'vitest';
import { deeper, eventTrigger, roll } from '../../../src/engine/deck';
import { guard } from '../../../src/engine/flow';
import { distance, label, neighbours, rowOf } from '../../../src/engine/hex';
import { cloneState } from '../../../src/engine/state';
import type { FlowCtx, GameEvent, GameState, HexId, Side } from '../../../src/engine/types';
import type { Gen } from '../../../src/engine/decisions';
import { SPIN_TIMING, deckHexes, dramaSteps, introMs, landing, readMs, seedOf, spinPlan, type DramaStep, type Moment } from '../../../src/ui/game/randomiser';
import { H, build, card, passive, type Responder } from '../../support/build';
import { G, US, choices, eventTop } from '../../rules/events/kit';

const sorted = (hs: readonly HexId[]) => [...hs].sort((a, b) => a - b);

/** Run `make` on `s` as the battle screen sees it: every event folded through dramaSteps with the states around it. */
function story(s: GameState, make: (ctx: FlowCtx) => Gen<unknown>, respond: Responder = passive) {
  const steps: DramaStep[] = [];
  const events: GameEvent[] = [];
  let m: Moment | null = null;
  let before = cloneState(s);
  const ctx: FlowCtx = {
    emit: (e) => {
      const after = cloneState(s);
      const r = dramaSteps(m, e, after, before);
      m = r.moment;
      steps.push(...r.steps);
      events.push(e);
      before = after;
    },
    invalid: (msg) => {
      throw new Error(msg);
    },
  };
  const gen = make(ctx);
  let r = gen.next();
  while (!r.done) {
    const a = respond(r.value, s);
    if (!a) break;
    r = gen.next(a);
  }
  return { steps, events, moment: m as Moment | null };
}

/** An Axis roll that shows Sniper!, then the Random Hex `hex`. */
function sniperTop(hex: string) {
  const sn = card(G, { trigger: 'Sniper' }, []);
  return [sn, card(G, { hex }, [sn])];
}

const rollFor = (s: GameState, side: Side) => (ctx: FlowCtx) =>
  guard(s, ctx, (function* () {
    yield* roll(s, ctx, side, 'rally');
  })());
const eventFor = (s: GameState, side: Side) => (ctx: FlowCtx) => guard(s, ctx, eventTrigger(s, deeper(ctx), side));
const kinds = (steps: DramaStep[]) => steps.map((x) => x.kind);
function only<K extends DramaStep['kind']>(steps: DramaStep[], kind: K) {
  return steps.filter((x): x is Extract<DramaStep, { kind: K }> => x.kind === kind);
}

describe('a Sniper! (§1.9.1.3, R-11)', () => {
  it('opens its banner, runs the randomiser onto the card\'s hex, lights the hex and its neighbours, then the hit', () => {
    const s = build({
      axis: { top: sniperTop('E5') },
      pieces: [
        { type: 'American/Line Squad', hex: 'E6' },
        { type: 'German/Rifle Squad', hex: 'H8' },
      ],
    });
    const r = story(s, rollFor(s, 'axis'), choices({ sniperTarget: [0] }));
    expect(kinds(r.steps)).toEqual(['open', 'spin', 'land', 'impact', 'close']);
    const [open] = only(r.steps, 'open');
    expect(open.moment).toMatchObject({ kind: 'sniper', side: 'axis' });
    const [spin] = only(r.steps, 'spin');
    expect(spin).toMatchObject({ target: H('E5'), reason: 'sniper', side: 'axis', brief: false });
    const [land] = only(r.steps, 'land');
    expect(land.landing.area).toEqual(sorted([H('E5'), ...neighbours(H('E5'))]));
    expect(land.landing.note).toBe('1 unit in reach: one may be broken.');
    // the shot lands next to the Random Hex: a link back to it
    expect(only(r.steps, 'impact')).toEqual([{ kind: 'impact', hex: H('E6'), from: H('E5'), look: 'crosshair' }]);
    expect(s.pieces.p0.broken).toBe(true);
    expect(r.moment).toBeNull();
  });

  it('an empty Random Hex with nobody next to it: no target, and the banner simply closes', () => {
    const s = build({ axis: { top: sniperTop('E5') }, pieces: [{ type: 'American/Line Squad', hex: 'K2' }] });
    const r = story(s, rollFor(s, 'axis'));
    expect(kinds(r.steps)).toEqual(['open', 'spin', 'land', 'close']);
    expect(only(r.steps, 'land')[0].landing.note).toBe('No unit in or next to it: the Sniper has no target.');
  });

  it('the Random Hex number fixes a broken Weapon first (§1.8): it glows where its carrier stands', () => {
    const s = build({
      axis: { top: sniperTop('E5') },
      pieces: [{ type: 'German/Rifle Squad', hex: 'C3', weapon: { type: 'German/LMG', broken: true } }],
    });
    const r = story(s, rollFor(s, 'axis'));
    expect(kinds(r.steps)).toEqual(['open', 'spin', 'land', 'impact', 'close']);
    expect(only(r.steps, 'impact')[0]).toEqual({ kind: 'impact', hex: H('C3'), from: H('E5'), look: 'glow' });
  });

  it('S12 Caves: the Sniper\'s longer reach is lit too', () => {
    const s = build({
      axis: { top: sniperTop('E5') },
      special: { sniperRange: { axis: 2 } },
      pieces: [{ type: 'American/Line Squad', hex: 'E7' }],
    });
    const land = landing('sniper', H('E5'), s, 'axis');
    expect(land.area).toContain(H('E7'));
    expect(land.note).toBe('1 unit in reach: one may be broken.');
  });
});

describe('Events that pick a Random Hex', () => {
  it('Air Support on an empty hex: it lands, then points to the nearest occupied hexes; the strike hits the one picked', () => {
    const s = build({
      axis: { top: eventTop(G, 'Air Support', ['E5']) },
      pieces: [
        { type: 'American/Line Squad', hex: 'E3' },
        { type: 'American/Line Squad', hex: 'G5' },
        { type: 'American/Line Squad', hex: 'A9' },
      ],
    });
    const r = story(s, eventFor(s, 'axis'), choices({ airSupport: { hex: 'G5' } }));
    expect(kinds(r.steps)).toEqual(['open', 'spin', 'land', 'impact', 'close']);
    expect(only(r.steps, 'open')[0].moment).toMatchObject({ kind: 'event', event: 'Air Support', side: 'axis' });
    const [land] = only(r.steps, 'land');
    expect(land.target).toBe(H('E5'));
    expect(land.landing.redirect).toEqual([H('E3'), H('G5')]);
    expect(land.landing.note).toBe('Empty: the nearest units, in E3 / G5, may be broken.');
    expect(only(r.steps, 'impact')).toEqual([{ kind: 'impact', hex: H('G5'), from: H('E5'), look: 'blast' }]);
  });

  it('Shell Shock: the nearest unit, wherever it is, with a link from the Random Hex', () => {
    const s = build({
      axis: { top: eventTop(G, 'Shell Shock', ['E5']) },
      pieces: [
        { type: 'American/Line Squad', hex: 'H5' },
        { type: 'German/Rifle Squad', hex: 'A1' },
      ],
    });
    const r = story(s, eventFor(s, 'axis'));
    const [land] = only(r.steps, 'land');
    expect(land.landing).toMatchObject({ redirect: [H('H5')], note: 'The nearest unit, in H5, breaks.' });
    expect(only(r.steps, 'impact')).toEqual([{ kind: 'impact', hex: H('H5'), from: H('E5'), look: 'blast' }]);
    expect(s.pieces.p0.broken).toBe(true);
  });

  it('Blaze on a Stream: nothing can start there, and the map is not hit', () => {
    const s = build({ map: { terrain: { E5: 'Stream' } }, axis: { top: eventTop(G, 'Blaze', ['E5']) } });
    const r = story(s, eventFor(s, 'axis'));
    expect(kinds(r.steps)).toEqual(['open', 'spin', 'land', 'close']);
    expect(only(r.steps, 'land')[0].landing.note).toBe('Stream: no Blaze can start here.');
  });

  it('Blaze in the open: the hex goes up in flames (a blast where the Random Hex is, no link)', () => {
    const s = build({ axis: { top: eventTop(G, 'Blaze', ['E5']) } });
    const r = story(s, eventFor(s, 'axis'));
    expect(only(r.steps, 'land')[0].landing.note).toBe('A Blaze starts here; its units must move out.');
    expect(only(r.steps, 'impact')).toEqual([{ kind: 'impact', hex: H('E5'), from: null, look: 'blast' }]);
  });

  it('Booby Trap on a hex with a Fortification: no Mines', () => {
    const s = build({ fort: { E5: 'wire' }, axis: { top: eventTop(G, 'Booby Trap', ['E5']) } });
    expect(landing('Booby Trap', H('E5'), s, 'axis').note).toBe('Wire already there: no Mines can go here.');
    const t = build({ axis: { top: eventTop(G, 'Booby Trap', ['E5']) } });
    const r = story(t, eventFor(t, 'axis'));
    // whether a marker is left is the engine's to tell (its own line follows): no note for a hex that allows it
    expect(only(r.steps, 'land')[0].landing.note).toBe('');
    expect(only(r.steps, 'impact')).toEqual([{ kind: 'impact', hex: H('E5'), from: null, look: 'mark' }]);
  });

  it('American cards: the Random Hex has an even number, and the randomiser hops over even rows only', () => {
    const s = build({ allied: { nation: US, top: eventTop(US, 'Shell Shock', ['F6']) }, pieces: [{ type: 'German/Rifle Squad', hex: 'F6' }] });
    const r = story(s, eventFor(s, 'allied'));
    const [spin] = only(r.steps, 'spin');
    expect(spin.target).toBe(H('F6'));
    const plan = spinPlan(spin.target, deckHexes(US), { speed: 'normal', seed: seedOf(spin.card) })!;
    expect(plan.hops.every((h) => rowOf(h.hex) % 2 === 0)).toBe(true);
    expect(only(r.steps, 'land')[0].landing.note).toBe('The nearest unit, here, breaks.');
  });
});

describe('Events without a Random Hex, and the set-up', () => {
  it('Medic: the banner, a glow on the rallied unit (no randomiser, no link), the close', () => {
    const s = build({ axis: { top: eventTop(G, 'Medic') }, pieces: [{ type: 'German/Rifle Squad', hex: 'D4', broken: true }] });
    const r = story(s, eventFor(s, 'axis'), choices({ medic: [0] }));
    expect(kinds(r.steps)).toEqual(['open', 'impact', 'close']);
    expect(only(r.steps, 'impact')[0]).toEqual({ kind: 'impact', hex: H('D4'), from: null, look: 'glow' });
  });

  it('a Random Hex in the S7 set-up: a brief run, the hex and its neighbours lit, no banner', () => {
    const s = build({});
    s.phase = 'setup';
    const c = card(US, { hex: 'F6' });
    const r = dramaSteps(null, { kind: 'reveal', side: 'allied', card: c, purpose: 'randomHex', trigger: null }, s, s);
    expect(r.moment).toBeNull();
    expect(kinds(r.steps)).toEqual(['spin', 'land']);
    expect(only(r.steps, 'spin')[0]).toMatchObject({ reason: 'setup', brief: true, target: H('F6') });
    expect(only(r.steps, 'land')[0].landing.area).toEqual(sorted([H('F6'), ...neighbours(H('F6'))]));
  });

  it('hits outside a moment are left to the usual animations', () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'D4' }] });
    expect(dramaSteps(null, { kind: 'break', piece: 'p0' }, s, s).steps).toEqual([]);
  });
});

describe('the randomiser\'s hop path', () => {
  const pool = deckHexes(G);
  const speeds = ['slow', 'normal', 'fast'] as const;

  it('every deck shows each letter; German hexes have odd numbers, American and Russian even ones', () => {
    expect(pool.every((h) => rowOf(h) % 2 === 1)).toBe(true);
    expect(deckHexes(US).every((h) => rowOf(h) % 2 === 0)).toBe(true);
    expect(deckHexes('Russian').every((h) => rowOf(h) % 2 === 0)).toBe(true);
    for (const n of [G, US, 'Russian'] as const) expect(new Set(deckHexes(n).map((h) => label(h)[0])).size).toBe(15);
  });

  it('lands on the target after hopping over hexes the deck can show, never repeating within three hops', () => {
    for (const speed of speeds) {
      for (let seed = 1; seed <= 40; seed++) {
        const target = pool[(seed * 7) % pool.length];
        const plan = spinPlan(target, pool, { speed, seed })!;
        const hexes = plan.hops.map((h) => h.hex);
        expect(hexes).toHaveLength(SPIN_TIMING[speed].hops);
        expect(hexes).not.toContain(target);
        expect(hexes.every((h) => pool.includes(h))).toBe(true);
        hexes.forEach((h, i) => expect(hexes.slice(Math.max(0, i - 3), i)).not.toContain(h));
        // the last four close in on the target
        hexes.slice(-4).forEach((h, i) => expect(distance(h, target)).toBeLessThanOrEqual(5 - i));
      }
    }
  });

  it('slows down: each hop at least as long as the one before, back to back, landing when the last ends', () => {
    for (const speed of speeds) {
      const plan = spinPlan(pool[3], pool, { speed, seed: 9 })!;
      let at = 0;
      plan.hops.forEach((h, i) => {
        expect(h.at).toBe(at);
        if (i) expect(h.ms).toBeGreaterThanOrEqual(plan.hops[i - 1].ms);
        at += h.ms;
      });
      expect(plan.landAt).toBe(at);
      expect(plan.hops[plan.hops.length - 1].ms).toBeGreaterThan(plan.hops[0].ms * 2);
    }
  });

  it('the same reveal runs the same path; another seed another one', () => {
    const a = spinPlan(pool[10], pool, { speed: 'normal', seed: seedOf('G-12', 3) });
    expect(spinPlan(pool[10], pool, { speed: 'normal', seed: seedOf('G-12', 3) })).toEqual(a);
    expect(spinPlan(pool[10], pool, { speed: 'normal', seed: seedOf('G-12', 4) })!.hops.map((h) => h.hex)).not.toEqual(a!.hops.map((h) => h.hex));
  });
});

describe('timing at each speed', () => {
  const pool = deckHexes(G);
  const total = (speed: 'slow' | 'normal' | 'fast', o: { brief?: boolean; calm?: boolean } = {}) => {
    const p = spinPlan(pool[0], pool, { speed, seed: 5, ...o })!;
    return p.landAt + p.settle;
  };

  it('Normal runs about 1.5 s and holds the hex about a second; Slow longer, Fast shorter; Instant skips it', () => {
    const n = spinPlan(pool[0], pool, { speed: 'normal', seed: 5 })!;
    expect(n.landAt).toBeGreaterThanOrEqual(1200);
    expect(n.landAt).toBeLessThanOrEqual(1700);
    expect(n.settle).toBe(1050);
    expect(total('slow')).toBeGreaterThan(total('normal'));
    expect(total('normal')).toBeGreaterThan(total('fast'));
    expect(total('fast')).toBeLessThanOrEqual(1000);
    expect(spinPlan(pool[0], pool, { speed: 'instant', seed: 5 })).toBeNull();
  });

  it('the set-up\'s brief run is shorter; reduced motion has no hops and holds the hex a little longer instead', () => {
    for (const speed of ['slow', 'normal', 'fast'] as const) {
      expect(total(speed, { brief: true })).toBeLessThan(total(speed));
      const calm = spinPlan(pool[0], pool, { speed, seed: 5, calm: true })!;
      expect(calm.hops).toEqual([]);
      expect(calm.landAt).toBe(0);
      expect(calm.settle).toBeGreaterThan(SPIN_TIMING[speed].settle);
    }
  });

  it('a banner holds long enough to read, longer for longer texts, scaled by the speed, never at Instant', () => {
    expect(readMs(10, 'normal')).toBe(1400);
    expect(readMs(100, 'normal')).toBe(3900);
    expect(readMs(1000, 'normal')).toBe(5200);
    expect(readMs(100, 'slow')).toBeGreaterThan(readMs(100, 'normal'));
    expect(readMs(100, 'fast')).toBeLessThan(readMs(100, 'normal'));
    expect(readMs(0, 'fast')).toBeGreaterThanOrEqual(700);
    expect(readMs(100, 'instant')).toBe(0);
  });

  it('the banner\'s first pause gives the name and about half the text; the rest is read as the moment plays on', () => {
    const text = 'x'.repeat(100);
    expect(introMs('Air Support', text, 'normal')).toBe(Math.round(readMs(111, 'normal') * 0.6));
    expect(introMs('Hero', 'x', 'normal')).toBe(1200);
    expect(introMs('Hero', text, 'slow')).toBeGreaterThan(introMs('Hero', text, 'normal'));
    expect(introMs('Hero', text, 'fast')).toBeLessThan(introMs('Hero', text, 'normal'));
    expect(introMs('Hero', text, 'instant')).toBe(0);
  });
});
