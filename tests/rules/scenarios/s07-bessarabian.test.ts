// Scenario 7, Bessarabian Nights (scenarios-reference §3): SSR 1 Random Hex set-up of the Russians, the German chain,
// control by set-up; SSR 2 the captured Mortar; SSR 3 No Quarter (no Exit VP; chits R, W out); SSR 4 Partisans; SSR 5
// Hidden Forces (card R-31 in the opening hand).
import { describe, expect, it } from 'vitest';
import { breakPiece, exitUnits } from '../../../src/engine/casualties';
import { CARDS } from '../../../src/engine/data';
import { distance } from '../../../src/engine/hex';
import { objectiveHexes } from '../../../src/engine/objectives';
import { stepCost } from '../../../src/engine/orders/move';
import { turnFlow } from '../../../src/engine/flow';
import { isUnit, isWeapon } from '../../../src/engine/state';
import type { Answer, Decision, GameEvent } from '../../../src/engine/types';
import { H, build, card, passive, run, start } from '../../support/build';
import { connected, mapUnits, setUp, special } from './kit';

const R = 'Russian';
type RevealEvent = Extract<GameEvent, { kind: 'reveal' }>;

describe('scenario 7 Bessarabian Nights: set-up', () => {
  it('SSR 1: each Russian unit sets up in or next to a Random Hex revealed from the Russian deck, which is then reshuffled', () => {
    for (const seed of [1, 2, 3]) {
      const { s, r } = setUp('7', seed);
      const reveals = r.events.filter((e): e is RevealEvent => e.kind === 'reveal' && e.purpose === 'randomHex');
      const units = mapUnits(s, 'allied');
      expect(units).toHaveLength(14);
      expect(reveals.length).toBeGreaterThanOrEqual(14);
      expect(reveals.every((e) => e.side === 'allied')).toBe(true);
      const hexes = reveals.map((e) => CARDS[e.card].hex);
      for (const u of units) expect(hexes.some((h) => distance(h, u.hex) <= 1), `${u.type} at ${u.hex}`).toBe(true);
      // every Weapon handed to a Russian unit; the deck reshuffled before the opening draw
      const weapons = Object.values(s.pieces).filter((p) => p.side === 'allied' && isWeapon(p));
      expect(weapons).toHaveLength(9);
      for (const w of weapons) expect(w.where === 'carried' && s.pieces[w.carrier!].where === 'map').toBe(true);
      const pl = s.players.allied;
      expect(pl.discards).toEqual([]);
      expect(pl.deck.length + pl.hand.length).toBe(72);
      expect(r.events.some((e) => e.kind === 'reshuffle' && e.side === 'allied')).toBe(true);
    }
  });

  it('SSR 1: each revealed hex takes one unit of the Allied player\'s choice, placed in or next to it', () => {
    const { r } = setUp('7', 4);
    const first = r.decisions.find((d): d is Extract<Decision, { kind: 'deploy' }> => d.kind === 'deploy' && d.side === 'allied')!;
    const reveal = r.events.find((e): e is RevealEvent => e.kind === 'reveal' && e.purpose === 'randomHex')!;
    expect(first.pieces).toHaveLength(14);
    for (const h of first.hexes) expect(distance(h, CARDS[reveal.card].hex)).toBeLessThanOrEqual(1);
  });

  it('SSR 1: the German units set up as one chain of adjacent hexes, none in a hex with a Russian unit', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { s } = setUp('7', seed);
      const german = mapUnits(s, 'axis');
      expect(german).toHaveLength(8);
      expect(connected(german.map((p) => p.hex)), `seed ${seed}`).toBe(true);
      const russian = new Set(mapUnits(s, 'allied').map((p) => p.hex));
      for (const p of german) expect(russian.has(p.hex)).toBe(false);
    }
  });

  it('SSR 1: each Objective goes to the side that alone occupies it after set-up; the others start uncontrolled', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { s } = setUp('7', seed);
      for (let n = 1; n <= 5; n++) {
        const area = new Set(objectiveHexes(s, n));
        const sides = new Set(Object.values(s.pieces).filter((p) => p.where === 'map' && isUnit(p) && area.has(p.hex)).map((p) => p.side));
        expect(s.control[n - 1], `seed ${seed} objective ${n}`).toBe(sides.size === 1 ? [...sides][0] : null);
      }
    }
  });

  it('SSR 3: chits R and W are out of the cup; SSR 5: the Allies hold card R-31 in a 4-card opening hand', () => {
    const { s } = setUp('7', 7);
    for (const c of ['R', 'W']) expect([...s.chitCup, ...s.openChits]).not.toContain(c);
    expect(s.players.allied.hand).toContain('R-31');
    expect(s.players.allied.hand).toHaveLength(4);
  });
});

describe('scenario 7 Bessarabian Nights: play', () => {
  it('SSR 2: the captured German Light Mortar is eliminated instead of breaking', () => {
    const s = build({
      special: special('7'),
      allied: { nation: R },
      pieces: [
        { type: 'Russian/Militia Squad', hex: 'E5', side: 'allied', weapon: 'German/Light Mortar' }, // p0, p1
        { type: 'Russian/SMG Squad', hex: 'F5', weapon: 'Russian/LMG' }, // p2, p3
      ],
    });
    run(s, (ctx) => breakPiece(s, ctx, 'p1', 'jammed'), passive);
    expect(s.pieces.p1.where).toBe('weaponsBox');
    expect(s.pieces.p0.weapon).toBeNull();
    run(s, (ctx) => breakPiece(s, ctx, 'p3', 'jammed'), passive);
    expect(s.pieces.p3).toMatchObject({ where: 'carried', broken: true });
  });

  it('SSR 3 No Quarter: a unit that exits is eliminated: no Exit VP, elimination VP to the enemy', () => {
    const s = build({
      special: special('7'),
      allied: { nation: R },
      pieces: [
        { type: 'German/Volksgrenadier Squad', hex: 'A5' }, // p0
        { type: 'German/Volksgrenadier Squad', hex: 'E5' }, // p1
        { type: 'Russian/SMG Squad', hex: 'O5' }, // p2
        { type: 'Russian/SMG Squad', hex: 'H5' }, // p3
      ],
    });
    run(s, (ctx) => exitUnits(s, ctx, ['p0']), passive);
    expect(s.pieces.p0.where).toBe('casualty');
    expect(s.players.axis.casualties).toEqual(['p0']);
    expect(s.vp).toBe(-2);
    run(s, (ctx) => exitUnits(s, ctx, ['p2']), passive);
    expect(s.pieces.p2.where).toBe('casualty');
    expect(s.vp).toBe(0);
  });

  it('SSR 4 Partisans: Allied units pay exactly 1 MP per hex; impassable stays impassable; the Germans pay as usual', () => {
    const s = build({
      special: special('7'),
      map: { terrain: { E4: 'Woods', E3: 'Building', F4: 'Water' }, elevation: { E2: 1 }, hexsides: [['E3', 'E2', 'Hedge']] },
      allied: { nation: R },
      active: 'allied',
    });
    expect(stepCost(s, H('E5'), H('E4'))).toBe(1);
    expect(stepCost(s, H('E4'), H('E3'))).toBe(1);
    expect(stepCost(s, H('E3'), H('E2'))).toBe(1); // Hedge and uphill
    expect(stepCost(s, H('E5'), H('F4'))).toBeNull();
    s.active = 'axis';
    expect(stepCost(s, H('E5'), H('E4'))).toBe(2);
    expect(stepCost(s, H('E3'), H('E2'))).toBe(3);
  });

  it('SSR 4 Partisans: a Militia Squad (Movement 3) moves through Woods and a Building in one Move; Wire still stops it', () => {
    const MOVE = card(R, { order: 'Move' });
    const s = build({
      special: special('7'),
      map: { terrain: { E4: 'Woods', E3: 'Building', E2: 'Woods' } },
      fort: { E2: 'wire' },
      allied: { nation: R, hand: [MOVE] },
      active: 'allied',
      pieces: [{ type: 'Russian/Militia Squad', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'L9' }],
    });
    const f = start(s, (ctx) => turnFlow(s, ctx));
    const step = (to: string): Answer => ({ kind: 'moveStep', units: ['p0'], to: H(to) });
    f.answer({ kind: 'order', card: MOVE, order: 'Move' }).answer({ kind: 'activate', units: ['p0'] });
    f.answer(step('E4')).answer(step('E3'));
    expect((f.pending as Extract<Decision, { kind: 'move' }>).mp.p0).toBe(1);
    f.answer(step('E2'));
    expect(s.pieces.p0.hex).toBe(H('E2'));
    expect(f.pending?.kind).not.toBe('move'); // Wire ended the move
  });
});
