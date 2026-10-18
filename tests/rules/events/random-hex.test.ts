// The Events that start with a Random Hex (rules-reference §1.8, §E43, §E46, §E47, §E53, §E63, §E69, §E72, §E73;
// R-34, R-47): what happens there, the nearest-thing rules with their ties, and the impossible cases.
import { describe, expect, it } from 'vitest';
import { meleeFp } from '../../../src/engine/melee';
import { H, build, cardsWhere, passive, rolls } from '../../support/build';
import { G, US, asked, choices, eventSeq, eventTop, ofKind, trigger } from './kit';

describe('Air Support (§E43, R-47)', () => {
  it('the receiver may break every unit in the Random Hex, of both sides; a broken one is eliminated', () => {
    const s = build({
      axis: { top: eventTop(G, 'Air Support', ['E5']) },
      pieces: [
        { type: 'American/Line Squad', hex: 'E5' },
        { type: 'American/Line Team', hex: 'E5', broken: true },
        { type: 'German/Rifle Squad', hex: 'E7' },
      ],
    });
    const r = trigger(s, 'axis', choices({ airSupport: [0] }));
    expect(asked(r.decisions, 'airSupport')[0]).toMatchObject({ side: 'axis', items: [{ hex: H('E5') }], min: 0, max: 1 });
    expect(s.pieces.p0.broken).toBe(true);
    expect(s.pieces.p1.where).toBe('casualty');
    expect(s.vp).toBe(1);
    expect(s.pieces.p2.broken).toBe(false);
  });

  it('breaks the receiver\'s own units too, all or nothing (R-47); he may decline', () => {
    const s = build({ axis: { top: eventTop(G, 'Air Support', ['E5']) }, pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }] });
    trigger(s, 'axis', choices({ airSupport: [0] }));
    expect(s.pieces.p0.broken).toBe(true);
    const t = build({ axis: { top: eventTop(G, 'Air Support', ['E5']) }, pieces: [{ type: 'American/Line Squad', hex: 'E5' }] });
    trigger(t, 'axis', choices({ airSupport: [] }));
    expect(t.pieces.p0.broken).toBe(false);
  });

  it('an empty Random Hex: the nearest hexes holding units, ties picked by the receiver', () => {
    const s = build({
      axis: { top: eventTop(G, 'Air Support', ['E5']) },
      pieces: [
        { type: 'American/Line Squad', hex: 'E3' },
        { type: 'American/Line Squad', hex: 'G5' },
        { type: 'American/Line Squad', hex: 'A9' },
      ],
    });
    const r = trigger(s, 'axis', choices({ airSupport: { hex: 'G5' } }));
    const d = asked(r.decisions, 'airSupport')[0];
    expect(d.items).toEqual([{ hex: H('E3') }, { hex: H('G5') }]);
    expect([s.pieces.p0.broken, s.pieces.p1.broken, s.pieces.p2.broken]).toEqual([false, true, false]);
  });

  it('no unit on the map: nothing happens', () => {
    const s = build({ axis: { top: eventTop(G, 'Air Support', ['E5']) } });
    const r = trigger(s, 'axis', passive);
    expect(r.decisions).toEqual([]);
    expect(ofKind(r.events, 'log').some((e) => e.text.startsWith('Air Support'))).toBe(true);
  });
});

describe('Blaze (§E46, R-34)', () => {
  it('starts a Blaze, clears Smoke and Fortification, and the units move out with their Weapons', () => {
    const s = build({
      map: { terrain: { E4: 'Water' } },
      axis: { top: eventTop(G, 'Blaze', ['E5']) },
      pieces: [{ type: 'American/Line Squad', hex: 'E5', weapon: 'American/MMG' }, { type: 'American/Sgt Smith', hex: 'E5' }],
      smoke: { E5: 3 },
      fort: { E5: 'foxholes' },
    });
    const r = trigger(s, 'axis', choices({ blazeDisplace: { hex: 'E6' } }));
    expect(s.blaze[H('E5')]).toBe(true);
    expect(s.smoke[H('E5')]).toBe(0);
    expect(s.fort[H('E5')]).toBe(null);
    expect(s.smokeCup).toHaveLength(51);
    const ds = asked(r.decisions, 'blazeDisplace');
    expect(ds.map((d) => d.side)).toEqual(['allied', 'allied']);
    expect(ds[0].items).not.toContainEqual({ hex: H('E4') }); // Water Barrier
    expect(ds[0].items).toHaveLength(5);
    expect([s.pieces.p0.hex, s.pieces.p2.hex]).toEqual([H('E6'), H('E6')]);
    expect(s.pieces.p1).toMatchObject({ where: 'carried', carrier: 'p0' });
  });

  it('a unit with no hex to go to is eliminated', () => {
    const s = build({
      map: { terrain: { E4: 'Water', F4: 'Water', F5: 'Water', E6: 'Water', D5: 'Water', D4: 'Water' } },
      axis: { top: eventTop(G, 'Blaze', ['E5']) },
      pieces: [{ type: 'American/Line Squad', hex: 'E5' }],
    });
    trigger(s, 'axis', passive);
    expect(s.pieces.p0.where).toBe('casualty');
    expect(s.vp).toBe(2);
  });

  it('a unit may move into an enemy hex; the melee is fought at the end of the Event (R-34, R-04)', () => {
    const s = build({
      axis: { top: eventTop(G, 'Blaze', ['E5']) },
      pieces: [{ type: 'American/Line Squad', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'E6' }],
    });
    const r = trigger(s, 'axis', choices({ blazeDisplace: { hex: 'E6' } }));
    const melee = ofKind(r.events, 'melee');
    expect(melee).toHaveLength(1);
    expect(melee[0].hex).toBe(H('E6'));
    expect(ofKind(r.events, 'trigger')).toEqual([]); // no roll inside the Event triggers
  });

  it('moving into an enemy-held Pillbox: the melee knows who held the hex, and its holder survives a tie (§F104)', () => {
    const probe = build({ pieces: [{ type: 'American/Line Squad', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'E6' }] });
    const [us, de] = [meleeFp(probe, ['p0']), meleeFp(probe, ['p1'])];
    const a = 7;
    const b = de + a - us; // the totals tie
    const axisRoll = rolls(G, [a], cardsWhere(G, { hex: 'E5' }))[0];
    const s = build({
      axis: { top: eventSeq(G, 'Blaze', ['E5', axisRoll]) },
      allied: { top: rolls(US, [b]) },
      pieces: [{ type: 'American/Line Squad', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'E6' }],
      fort: { E6: 'pillbox' },
    });
    const r = trigger(s, 'axis', choices({ blazeDisplace: { hex: 'E6' } }));
    expect(ofKind(r.events, 'melee')).toEqual([{ kind: 'melee', hex: H('E6'), totals: { axis: de + a, allied: us + b }, losers: ['allied'] }]);
    expect([s.pieces.p0.where, s.pieces.p1.where]).toEqual(['casualty', 'map']);
  });

  it('nothing in Water or in a hex already ablaze', () => {
    const s = build({ map: { terrain: { E5: 'Stream' } }, axis: { top: eventTop(G, 'Blaze', ['E5']) } });
    trigger(s, 'axis', passive);
    expect(s.blaze.some(Boolean)).toBe(false);
    const t = build({ axis: { top: eventTop(G, 'Blaze', ['E5']) }, pieces: [{ type: 'American/Line Squad', hex: 'E6' }] });
    t.blaze[H('E5')] = true;
    const r = trigger(t, 'axis', passive);
    expect(r.decisions).toEqual([]);
    expect(t.blaze.filter(Boolean)).toHaveLength(1);
  });
});

describe('Booby Trap, Rubble, Shellholes (§E47, §E69, §E73)', () => {
  it.each([
    ['Booby Trap', 'mines'],
    ['Rubble', 'wire'],
    ['Shellholes', 'foxholes'],
  ] as const)('%s places %s in the Random Hex, also under units there', (event, kind) => {
    const s = build({ axis: { top: eventTop(G, event, ['E5']) }, pieces: [{ type: 'American/Line Squad', hex: 'E5' }] });
    const r = trigger(s, 'axis', passive);
    expect(s.fort[H('E5')]).toBe(kind);
    expect(r.events).toContainEqual({ kind: 'place', hex: H('E5'), marker: kind });
    expect(s.pieces.p0.broken).toBe(false);
  });

  it.each(['Booby Trap', 'Rubble', 'Shellholes'] as const)('%s: nothing in Water, a Blaze or a Fortification hex', (event) => {
    const water = build({ map: { terrain: { E5: 'Marsh' } }, axis: { top: eventTop(G, event, ['E5']) } });
    trigger(water, 'axis', passive);
    expect(water.fort[H('E5')]).toBe(null);
    const fort = build({ axis: { top: eventTop(G, event, ['E5']) }, fort: { E5: 'trench' } });
    trigger(fort, 'axis', passive);
    expect(fort.fort[H('E5')]).toBe('trench');
    const blaze = build({ axis: { top: eventTop(G, event, ['E5']) } });
    blaze.blaze[H('E5')] = true;
    trigger(blaze, 'axis', passive);
    expect(blaze.fort[H('E5')]).toBe(null);
  });
});

describe('Dust (§E53)', () => {
  it('places a random Smoke from the cup in the Random Hex', () => {
    const s = build({ axis: { top: eventTop(G, 'Dust', ['E5']) } });
    const top = s.smokeCup[0];
    trigger(s, 'axis', passive);
    expect(s.smoke[H('E5')]).toBe(top);
    expect(s.smokeCup).toHaveLength(49);
  });

  it('a larger Smoke already there stays; nothing in Water', () => {
    const s = build({ axis: { top: eventTop(G, 'Dust', ['E5']) }, smoke: { E5: 10 } });
    trigger(s, 'axis', passive);
    expect(s.smoke[H('E5')]).toBe(10);
    expect(s.smokeCup).toHaveLength(50);
    const t = build({ map: { terrain: { E5: 'Water' } }, axis: { top: eventTop(G, 'Dust', ['E5']) } });
    trigger(t, 'axis', passive);
    expect(t.smoke[H('E5')]).toBe(0);
    expect(t.smokeCup).toHaveLength(50);
  });
});

describe('Malfunction (§E63)', () => {
  it('breaks the unbroken Weapon nearest to the Random Hex, of either side', () => {
    const s = build({
      axis: { top: eventTop(G, 'Malfunction', ['E5']) },
      pieces: [
        { type: 'German/Rifle Squad', hex: 'E6', weapon: 'German/LMG' },
        { type: 'American/Line Squad', hex: 'E9', weapon: 'American/MMG' },
        { type: 'American/Line Squad', hex: 'E5', weapon: { type: 'American/MMG', broken: true } }, // Fix 1-4, Elim 9-10
      ],
    });
    const r = trigger(s, 'axis', passive);
    expect(s.pieces.p1.broken).toBe(true);
    expect(s.pieces.p3.broken).toBe(false);
    expect(s.pieces.p5).toMatchObject({ where: 'carried', broken: true }); // a broken Weapon is no candidate
    expect(asked(r.decisions, 'malfunctionTie')).toEqual([]); // one nearest: no question
  });

  it('a broken Weapon the Random Hex fixes is fixed first (§1.8), and may then be the one that breaks', () => {
    const s = build({
      axis: { top: eventTop(G, 'Malfunction', ['E5']) },
      pieces: [
        { type: 'German/Rifle Squad', hex: 'E5', weapon: { type: 'German/LMG', broken: true } }, // Fix 5-6
        { type: 'American/Line Squad', hex: 'E9', weapon: 'American/MMG' },
      ],
    });
    const r = trigger(s, 'axis', passive);
    const k = r.events.filter((e) => (e.kind === 'fix' || e.kind === 'break') && e.piece === 'p1').map((e) => e.kind);
    expect(k).toEqual(['fix', 'break']);
    expect(s.pieces.p3.broken).toBe(false);
  });

  it('ties: the receiver picks; no Weapon on the map: nothing', () => {
    const s = build({
      axis: { top: eventTop(G, 'Malfunction', ['E5']) },
      pieces: [
        { type: 'German/Rifle Squad', hex: 'E6', weapon: 'German/LMG' },
        { type: 'American/Line Squad', hex: 'E4', weapon: 'American/MMG' },
      ],
    });
    const r = trigger(s, 'axis', choices({ malfunctionTie: { piece: 'p3' } }));
    expect(asked(r.decisions, 'malfunctionTie')[0].items).toEqual([{ piece: 'p1' }, { piece: 'p3' }]);
    expect([s.pieces.p1.broken, s.pieces.p3.broken]).toEqual([false, true]);
    const t = build({ axis: { top: eventTop(G, 'Malfunction', ['E5']) }, pieces: [{ type: 'German/Rifle Squad', hex: 'E6' }] });
    expect(trigger(t, 'axis', passive).decisions).toEqual([]);
  });
});

describe('Shell Shock (§E72)', () => {
  it('breaks the unit nearest to the Random Hex, of either side; a broken one is eliminated', () => {
    const s = build({
      axis: { top: eventTop(G, 'Shell Shock', ['E5']) },
      pieces: [{ type: 'American/Line Squad', hex: 'E6', broken: true }, { type: 'German/Rifle Squad', hex: 'E9' }],
    });
    trigger(s, 'axis', passive);
    expect(s.pieces.p0.where).toBe('casualty');
    expect(s.pieces.p1.broken).toBe(false);
  });

  it('ties: the receiver picks; no unit: nothing', () => {
    const s = build({
      axis: { top: eventTop(G, 'Shell Shock', ['E5']) },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }, { type: 'American/Line Squad', hex: 'E5' }],
    });
    // a mixed hex: both are at distance 0 (the melee follows the Event)
    const r = trigger(s, 'axis', choices({ shellShockTie: { piece: 'p1' } }));
    expect(asked(r.decisions, 'shellShockTie')[0].items).toHaveLength(2);
    expect(r.events).toContainEqual({ kind: 'break', piece: 'p1' });
    const t = build({ axis: { top: eventTop(G, 'Shell Shock', ['E5']) } });
    expect(trigger(t, 'axis', passive).decisions).toEqual([]);
  });
});
