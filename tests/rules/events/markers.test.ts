// Events about markers: Breeze (§E48, R-35), Entrench (§E55), Sappers (§E70), White Phosphorus (§E77).
import { describe, expect, it } from 'vitest';
import { CARDS } from '../../../src/engine/data';
import type { HexSide } from '../../../src/engine/types';
import { H, build, cardsWhere, passive } from '../../support/build';
import { G, RU, US, asked, choices, eventTop, ofKind, trigger } from './kit';

const breezeCard = (wind: HexSide) => cardsWhere(G, { event: 'Breeze' }).find((c) => CARDS[c].breeze === wind)!;

describe('Breeze (§E48, R-35)', () => {
  it('removes all Smoke, then each Blaze spreads one hex downwind; the units there move out', () => {
    const s = build({
      axis: { top: [breezeCard(4)] }, // wind 4: down the map
      pieces: [{ type: 'American/Line Squad', hex: 'E6' }],
      smoke: { C3: 2, H7: 4 },
    });
    s.blaze[H('E5')] = true;
    const r = trigger(s, 'axis', choices({ blazeDisplace: { hex: 'F6' } }));
    expect(s.smoke.every((v) => v === 0)).toBe(true);
    expect(s.smokeCup).toHaveLength(52);
    expect(s.blaze[H('E6')]).toBe(true);
    expect(s.blaze[H('E7')]).toBe(false); // the new Blaze does not spread again (R-35)
    expect(s.pieces.p0.hex).toBe(H('F6'));
    expect(asked(r.decisions, 'blazeDisplace')[0].items).not.toContainEqual({ hex: H('E5') });
  });

  it('spreads from every Blaze there was when it began, in the card\'s direction only', () => {
    const s = build({ axis: { top: [breezeCard(2)] } }); // wind 2: up and right
    s.blaze[H('E5')] = true;
    s.blaze[H('H5')] = true;
    trigger(s, 'axis', passive);
    const ablaze = s.blaze.map((b, h) => (b ? h : -1)).filter((h) => h >= 0);
    expect(ablaze).toEqual([H('E5'), H('F4'), H('H5'), H('I5')].sort((a, b) => a - b));
  });

  it('not into Water; with no Blaze only the Smoke goes', () => {
    const s = build({ map: { terrain: { E6: 'Water' } }, axis: { top: [breezeCard(4)] } });
    s.blaze[H('E5')] = true;
    trigger(s, 'axis', passive);
    expect(s.blaze.filter(Boolean)).toHaveLength(1);
    const t = build({ axis: { top: [breezeCard(4)] }, smoke: { C3: 2 } });
    const r = trigger(t, 'axis', passive);
    expect(r.decisions).toEqual([]);
    expect(t.smoke[H('C3')]).toBe(0);
    expect(t.blaze.some(Boolean)).toBe(false);
  });
});

describe('Entrench (§E55, Russian deck only)', () => {
  const base = () =>
    build({
      allied: { nation: 'Russian', top: eventTop(RU, 'Entrench') },
      pieces: [
        { type: 'Russian/Rifle Squad', hex: 'E6' },
        { type: 'Russian/Rifle Squad', hex: 'F6' },
        { type: 'Russian/Rifle Squad', hex: 'G6' },
        { type: 'German/Rifle Squad', hex: 'J6' },
      ],
      map: { terrain: { G6: 'Stream' } },
      fort: { F6: 'wire' },
    });

  it('the receiver may place Foxholes in a hex he occupies that can take a Fortification', () => {
    const s = base();
    const r = trigger(s, 'allied', choices({ entrenchHex: { hex: 'E6' } }));
    expect(asked(r.decisions, 'entrenchHex')[0]).toMatchObject({ side: 'allied', items: [{ hex: H('E6') }], min: 0, max: 1 });
    expect(s.fort[H('E6')]).toBe('foxholes');
  });

  it('he may decline; with no such hex nothing is asked', () => {
    const s = base();
    trigger(s, 'allied', passive);
    expect(s.fort.filter(Boolean)).toEqual(['wire']);
    const t = build({ allied: { nation: 'Russian', top: eventTop(RU, 'Entrench') }, pieces: [{ type: 'Russian/Rifle Squad', hex: 'F6' }], fort: { F6: 'trench' } });
    expect(trigger(t, 'allied', passive).decisions).toEqual([]);
  });
});

describe('Sappers (§E70)', () => {
  it('the receiver may remove one Mines or Wire marker', () => {
    const s = build({ axis: { top: eventTop(G, 'Sappers') }, fort: { C3: 'mines', D4: 'wire', E5: 'foxholes' } });
    const r = trigger(s, 'axis', choices({ sappers: { hex: 'D4' } }));
    expect(asked(r.decisions, 'sappers')[0].items).toEqual([{ hex: H('C3') }, { hex: H('D4') }]);
    expect([s.fort[H('C3')], s.fort[H('D4')], s.fort[H('E5')]]).toEqual(['mines', null, 'foxholes']);
  });

  it('no Mines or Wire: nothing is asked', () => {
    const s = build({ axis: { top: eventTop(G, 'Sappers') }, fort: { E5: 'foxholes' } });
    expect(trigger(s, 'axis', passive).decisions).toEqual([]);
  });
});

describe('White Phosphorus (§E77, American deck only)', () => {
  const base = () =>
    build({
      allied: { top: eventTop(US, 'White Phosphorus') },
      map: { terrain: { D6: 'Water' } },
      pieces: [
        { type: 'American/Line Squad', hex: 'E6' },
        { type: 'American/Line Team', hex: 'F6' },
        { type: 'German/Rifle Squad', hex: 'E5' },
        { type: 'German/Sgt Esser', hex: 'E5' },
        { type: 'American/Line Squad', hex: 'J6', broken: true },
      ],
    });

  it('a random Smoke next to one of his unbroken Squads; each player there breaks one of his own units', () => {
    const s = base();
    const top = s.smokeCup[0];
    const r = trigger(s, 'allied', choices({ whitePhosphorus: { hex: 'E5' }, whitePhosphorusLoss: { piece: 'p3' } }));
    const d = asked(r.decisions, 'whitePhosphorus')[0];
    expect(d.items).not.toContainEqual({ hex: H('D6') }); // Water
    expect(d.items).not.toContainEqual({ hex: H('J5') }); // next to a broken Squad only
    expect(d.items).toHaveLength(5);
    expect(s.smoke[H('E5')]).toBe(top);
    const loss = asked(r.decisions, 'whitePhosphorusLoss');
    expect(loss.map((x) => x.side)).toEqual(['axis']);
    expect([s.pieces.p2.broken, s.pieces.p3.broken]).toEqual([false, true]);
  });

  it('his own units in that hex suffer too', () => {
    const s = base();
    trigger(s, 'allied', choices({ whitePhosphorus: { hex: 'F6' } }));
    expect(s.pieces.p1.broken).toBe(true);
  });

  it('he may decline; without an unbroken Squad nothing is asked', () => {
    const s = base();
    const r = trigger(s, 'allied', passive);
    expect(s.smoke.every((v) => v === 0)).toBe(true);
    expect(ofKind(r.events, 'break')).toEqual([]);
    const t = build({ allied: { top: eventTop(US, 'White Phosphorus') }, pieces: [{ type: 'American/Line Team', hex: 'E6' }] });
    expect(trigger(t, 'allied', passive).decisions).toEqual([]);
  });
});
