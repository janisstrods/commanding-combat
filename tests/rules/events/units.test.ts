// Events that act on units: Battle Harden (§E44), Commissar (§E50), Cower (§E51), Deploy (§E52, R-03), Field Promotion
// (§E56), Hero (§E58), Interdiction (§E60, R-36), KIA (§E62), Medic (§E64), Prisoners of War (§E66), Suppressing Fire
// (§E75). The receiver chooses; "a unit" is either side's; what is impossible is skipped (§E42).
import { describe, expect, it } from 'vitest';
import { currentStats } from '../../../src/engine/stats';
import { H, build, passive, piecesOf, rolls } from '../../support/build';
import { G, RU, asked, choices, eventTop, ofKind, trigger } from './kit';

describe('Battle Harden (§E44)', () => {
  it('a Veteran marker on one of the receiver\'s units without one', () => {
    const s = build({
      axis: { top: eventTop(G, 'Battle Harden') },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E5', veteran: true }, { type: 'German/Rifle Squad', hex: 'E6' }, { type: 'German/Line Team', hex: 'E7' }, { type: 'American/Line Squad', hex: 'E9' }],
    });
    const r = trigger(s, 'axis', choices({ battleHarden: { piece: 'p2' } }));
    expect(asked(r.decisions, 'battleHarden')[0]).toMatchObject({ items: [{ piece: 'p1' }, { piece: 'p2' }], min: 1, max: 1 });
    expect(s.pieces.p2.veteran).toBe(true);
    expect(r.events).toContainEqual({ kind: 'veteran', piece: 'p2' });
  });

  it('one candidate: no question; none: nothing', () => {
    const s = build({ axis: { top: eventTop(G, 'Battle Harden') }, pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }] });
    expect(trigger(s, 'axis', passive).decisions).toEqual([]);
    expect(s.pieces.p0.veteran).toBe(true);
    const t = build({ axis: { top: eventTop(G, 'Battle Harden') }, pieces: [{ type: 'American/Line Squad', hex: 'E5' }] });
    trigger(t, 'axis', passive);
    expect(t.pieces.p0.veteran).toBe(false);
  });
});

describe('Commissar (§E50, Russian deck only)', () => {
  const setup = (above: boolean) => {
    const probe = build({ allied: { nation: 'Russian' }, pieces: [{ type: 'Russian/Rifle Squad', hex: 'E6', broken: true }] });
    const morale = currentStats(probe, 'p0').morale;
    const roll = rolls(RU, [above ? morale + 1 : morale]);
    return build({
      allied: { nation: 'Russian', top: eventTop(RU, 'Commissar', [], roll) },
      pieces: [{ type: 'Russian/Rifle Squad', hex: 'E6', broken: true }, { type: 'Russian/Rifle Squad', hex: 'E7', broken: true }],
    });
  };

  it('a roll above the chosen broken unit\'s Morale eliminates it', () => {
    const s = setup(true);
    const r = trigger(s, 'allied', choices({ commissar: { piece: 'p0' } }));
    expect(asked(r.decisions, 'commissar')[0].side).toBe('allied');
    expect(r.decisions.some((d) => d.kind === 'reroll')).toBe(true); // a roll: the Initiative may cancel it
    expect(s.pieces.p0.where).toBe('casualty');
    expect(s.pieces.p1.broken).toBe(true);
  });

  it('a roll at or below its Morale rallies it; with no broken unit nothing happens', () => {
    const s = setup(false);
    trigger(s, 'allied', choices({ commissar: { piece: 'p0' } }));
    expect(s.pieces.p0).toMatchObject({ where: 'map', broken: false });
    const t = build({ allied: { nation: 'Russian', top: eventTop(RU, 'Commissar') }, pieces: [{ type: 'Russian/Rifle Squad', hex: 'E6' }] });
    const r = trigger(t, 'allied', passive);
    expect(r.decisions).toEqual([]);
    expect(t.players.allied.discards).toHaveLength(1); // only the Event card: no roll
  });

  it('the Morale it rolls against includes the Cover of its hex (§T78.3, audit)', () => {
    const probe = build({ allied: { nation: 'Russian' }, pieces: [{ type: 'Russian/Rifle Squad', hex: 'E6', broken: true }] });
    const morale = currentStats(probe, 'p0').morale;
    const s = build({
      map: { terrain: { E6: 'Woods' } },
      allied: { nation: 'Russian', top: eventTop(RU, 'Commissar', [], rolls(RU, [morale + 1])) },
      pieces: [{ type: 'Russian/Rifle Squad', hex: 'E6', broken: true }],
    });
    trigger(s, 'allied', choices({ commissar: { piece: 'p0' } }));
    expect(s.pieces.p0).toMatchObject({ where: 'map', broken: false }); // Morale + 2 (Woods) beats the roll
  });
});

describe('Cower (§E51)', () => {
  it('suppresses each of his Squads outside every friendly Leader\'s Command radius', () => {
    const s = build({
      axis: { top: eventTop(G, 'Cower') },
      pieces: [
        { type: 'German/Sgt Esser', hex: 'E5' }, // Command 2
        { type: 'German/Rifle Squad', hex: 'E7' }, // 2 away: inside
        { type: 'German/Rifle Squad', hex: 'I5' }, // 4 away: outside
        { type: 'German/Line Team', hex: 'I6' }, // a Team: never
        { type: 'German/Cpl Winkler', hex: 'L5', broken: true }, // broken: Command 0, own hex only
        { type: 'German/Rifle Squad', hex: 'L5' },
        { type: 'German/Rifle Squad', hex: 'L6', broken: true },
        { type: 'American/Line Squad', hex: 'A9' },
      ],
    });
    const r = trigger(s, 'axis', passive);
    expect(ofKind(r.events, 'suppress').map((e) => e.piece)).toEqual(['p2', 'p6']);
    expect(s.pieces.p7.suppressed).toBe(false);
  });
});

describe('Deploy (§E52, R-03)', () => {
  it('his Squad becomes two Teams of his troop quality; he splits its markers; activation carries over', () => {
    const s = build({
      axis: { quality: 'elite', top: eventTop(G, 'Deploy') },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E5', weapon: 'German/LMG', suppressed: true, veteran: true, broken: true }, { type: 'American/Line Squad', hex: 'E9' }],
    });
    s.turn.activated.push('p0');
    const r = trigger(s, 'axis', choices({ deploy: { piece: 'p0' }, deployMarkers: { label: 'Team 1: LMG · Team 2: Suppressed, Veteran' } }));
    expect(asked(r.decisions, 'deploy')[0].items).toEqual([{ piece: 'p0' }]); // his own Squads only
    expect(asked(r.decisions, 'deployMarkers')[0].items).toHaveLength(4);
    expect(s.pieces.p0.where).toBe('mix');
    const teams = piecesOf(s, 'German/Elite Team');
    expect(teams.map((t) => [t.hex, t.broken])).toEqual([[H('E5'), true], [H('E5'), true]]);
    expect(teams[0]).toMatchObject({ weapon: 'p1', suppressed: false, veteran: false });
    expect(teams[1]).toMatchObject({ weapon: null, suppressed: true, veteran: true });
    expect(s.turn.activated).toEqual(teams.map((t) => t.id));
  });

  it('one marker: no split question; he may decline; with no Squad nothing is asked', () => {
    const s = build({ axis: { top: eventTop(G, 'Deploy') }, pieces: [{ type: 'German/Rifle Squad', hex: 'E5', weapon: 'German/LMG' }] });
    const r = trigger(s, 'axis', choices({ deploy: [0] }));
    expect(asked(r.decisions, 'deployMarkers')).toEqual([]);
    expect(piecesOf(s, 'German/Line Team')).toHaveLength(2);
    const t = build({ axis: { top: eventTop(G, 'Deploy') }, pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }] });
    trigger(t, 'axis', passive);
    expect(t.pieces.p0.where).toBe('map');
    const u = build({ axis: { top: eventTop(G, 'Deploy') }, pieces: [{ type: 'German/Line Team', hex: 'E5' }, { type: 'American/Line Squad', hex: 'E6' }] });
    expect(trigger(u, 'axis', passive).decisions).toEqual([]);
  });
});

describe('Field Promotion (§E56)', () => {
  it('his Private may join one of his broken units', () => {
    const s = build({
      axis: { top: eventTop(G, 'Field Promotion') },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E5', broken: true }, { type: 'German/Rifle Squad', hex: 'E7' }, { type: 'American/Line Squad', hex: 'E9', broken: true }],
    });
    const r = trigger(s, 'axis', choices({ fieldPromotion: [0] }));
    expect(asked(r.decisions, 'fieldPromotion')[0]).toMatchObject({ items: [{ hex: H('E5') }], min: 0, max: 1 });
    expect(piecesOf(s, 'German/Pvt Herzog').map((p) => [p.where, p.hex])).toEqual([['map', H('E5')]]);
  });

  it('not while his Private is in play (on the map or on the Casualty Track); he may decline', () => {
    for (const where of ['map', 'casualty'] as const) {
      const s = build({
        axis: { top: eventTop(G, 'Field Promotion') },
        pieces: [{ type: 'German/Rifle Squad', hex: 'E5', broken: true }, where === 'map' ? { type: 'German/Pvt Herzog', hex: 'H5' } : { type: 'German/Pvt Herzog', where: 'casualty' }],
      });
      expect(trigger(s, 'axis', choices({ fieldPromotion: [0] })).decisions).toEqual([]);
      expect(piecesOf(s, 'German/Pvt Herzog')).toHaveLength(1);
    }
    const t = build({ axis: { top: eventTop(G, 'Field Promotion') }, pieces: [{ type: 'German/Rifle Squad', hex: 'E5', broken: true }] });
    trigger(t, 'axis', passive);
    expect(piecesOf(t, 'German/Pvt Herzog')).toEqual([]);
  });
});

describe('Hero (§E58)', () => {
  it('his Hero goes to a friendly hex (an Objective he controls counts) and may rally a broken unit there', () => {
    const s = build({
      map: { objectives: ['C3', 'D1', 'A1', 'B1', 'O1'] },
      control: ['axis', 'axis', null, null, null],
      axis: { top: eventTop(G, 'Hero') },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E5', broken: true }, { type: 'German/Rifle Squad', hex: 'E7' }, { type: 'American/Line Squad', hex: 'D1' }],
    });
    const r = trigger(s, 'axis', choices({ heroPlace: { hex: 'E5' }, heroRally: { piece: 'p0' } }));
    expect(asked(r.decisions, 'heroPlace')[0].items).toEqual([{ hex: H('C3') }, { hex: H('E5') }, { hex: H('E7') }]);
    const hero = piecesOf(s, 'German/Dietel (Hero)');
    expect(hero.map((p) => [p.where, p.hex])).toEqual([['map', H('E5')]]);
    expect(s.pieces.p0.broken).toBe(false);
  });

  it('an eliminated Hero (back in the counter mix) returns; one already in play does not', () => {
    const s = build({ axis: { top: eventTop(G, 'Hero') }, pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }, { type: 'German/Dietel (Hero)', hex: 'E5' }] });
    expect(trigger(s, 'axis', passive).decisions).toEqual([]);
    const t = build({ axis: { top: eventTop(G, 'Hero') }, pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }, { type: 'German/Dietel (Hero)', hex: 'E5' }] });
    Object.assign(t.pieces.p1, { where: 'mix', hex: -1, broken: true });
    const r = trigger(t, 'axis', passive);
    expect(r.decisions).toEqual([]); // one friendly hex, no broken unit: nothing to ask
    expect(t.pieces.p1).toMatchObject({ where: 'map', hex: H('E5'), broken: false });
    expect(piecesOf(t, 'German/Dietel (Hero)')).toHaveLength(1);
  });

  it('no friendly hex: nothing', () => {
    const s = build({ axis: { top: eventTop(G, 'Hero') }, pieces: [{ type: 'American/Line Squad', hex: 'E5' }] });
    trigger(s, 'axis', passive);
    expect(piecesOf(s, 'German/Dietel (Hero)')).toEqual([]);
  });
});

describe('Interdiction (§E60, R-36)', () => {
  it('must suppress one unsuppressed unit of either side in a hex with Cover below 1 (Road −1 counts, hexsides do not)', () => {
    const s = build({
      map: { terrain: { E6: 'Woods', H6: 'Brush', I6: 'Woods' }, pathHexes: { Road: ['H6', 'I6'] }, hexsides: [['E5', 'E4', 'Wall']] },
      axis: { top: eventTop(G, 'Interdiction') },
      pieces: [
        { type: 'American/Line Squad', hex: 'E5' }, // Open 0 (the Wall is hexside Cover: ignored)
        { type: 'German/Rifle Squad', hex: 'E6' }, // Woods 2
        { type: 'American/Line Squad', hex: 'F6' }, // Open + Foxholes 3
        { type: 'German/Rifle Squad', hex: 'H6' }, // Brush 1 − Road 1 = 0
        { type: 'American/Line Squad', hex: 'I6' }, // Woods 2 − Road 1 = 1
        { type: 'American/Line Squad', hex: 'J6', suppressed: true },
      ],
      fort: { F6: 'foxholes' },
    });
    const r = trigger(s, 'axis', choices({ interdiction: { piece: 'p3' } }));
    expect(asked(r.decisions, 'interdiction')[0]).toMatchObject({ items: [{ piece: 'p0' }, { piece: 'p3' }], min: 1, max: 1 });
    expect(s.pieces.p3.suppressed).toBe(true);
  });

  it('none: nothing', () => {
    const s = build({ map: { terrain: { E5: 'Woods' } }, axis: { top: eventTop(G, 'Interdiction') }, pieces: [{ type: 'American/Line Squad', hex: 'E5' }] });
    expect(trigger(s, 'axis', passive).decisions).toEqual([]);
    expect(s.pieces.p0.suppressed).toBe(false);
  });
});

describe('KIA (§E62), Medic (§E64)', () => {
  const units = () => [
    { type: 'American/Line Squad', hex: 'E5', broken: true },
    { type: 'German/Line Team', hex: 'E7', broken: true },
    { type: 'German/Rifle Squad', hex: 'E8' },
  ];

  it('KIA: must eliminate one broken unit of either side (no Light Wounds)', () => {
    const s = build({ axis: { top: eventTop(G, 'KIA') }, pieces: units() });
    const r = trigger(s, 'axis', choices({ kia: { piece: 'p1' } }));
    expect(asked(r.decisions, 'kia')[0].items).toEqual([{ piece: 'p0' }, { piece: 'p1' }]);
    expect(s.pieces.p1.where).toBe('casualty');
    expect(s.vp).toBe(-1);
    expect(r.decisions.some((d) => d.kind === 'react')).toBe(false);
  });

  it('Medic: must rally one broken unit of either side', () => {
    const s = build({ axis: { top: eventTop(G, 'Medic') }, pieces: units() });
    const r = trigger(s, 'axis', choices({ medic: { piece: 'p0' } }));
    expect(asked(r.decisions, 'medic')[0].items).toEqual([{ piece: 'p0' }, { piece: 'p1' }]);
    expect(s.pieces.p0.broken).toBe(false);
  });

  it('no broken unit: neither does anything', () => {
    for (const event of ['KIA', 'Medic'] as const) {
      const s = build({ axis: { top: eventTop(G, event) }, pieces: [{ type: 'German/Rifle Squad', hex: 'E8' }] });
      const r = trigger(s, 'axis', passive);
      expect(r.decisions).toEqual([]);
      expect(ofKind(r.events, 'eliminate').length + ofKind(r.events, 'rally').length).toBe(0);
    }
  });
});

describe('Prisoners of War (§E66)', () => {
  it('must eliminate one of his own broken units in or next to an enemy hex', () => {
    const s = build({
      axis: { top: eventTop(G, 'Prisoners of War') },
      pieces: [
        { type: 'German/Rifle Squad', hex: 'E5', broken: true },
        { type: 'German/Rifle Squad', hex: 'H5', broken: true }, // not next to the enemy
        { type: 'German/Rifle Squad', hex: 'E7' }, // next to the enemy, unbroken
        { type: 'American/Line Squad', hex: 'E6', broken: true }, // enemy: never his to give up
      ],
    });
    const r = trigger(s, 'axis', passive);
    expect(r.decisions.filter((d) => d.kind === 'choose')).toEqual([]); // one candidate
    expect(s.pieces.p0.where).toBe('casualty');
    expect(s.vp).toBe(-2);
    expect([s.pieces.p1.where, s.pieces.p3.where]).toEqual(['map', 'map']);
  });

  it('none: nothing', () => {
    const s = build({ axis: { top: eventTop(G, 'Prisoners of War') }, pieces: [{ type: 'German/Rifle Squad', hex: 'H5', broken: true }, { type: 'American/Line Squad', hex: 'E6' }] });
    trigger(s, 'axis', passive);
    expect(s.pieces.p0.where).toBe('map');
  });
});

describe('Suppressing Fire (§E75)', () => {
  const base = () =>
    build({
      map: { terrain: { E3: 'Woods' } },
      axis: { top: eventTop(G, 'Suppressing Fire') },
      pieces: [
        { type: 'German/Rifle Squad', hex: 'E5', weapon: 'German/LMG' }, // LMG Range 8
        { type: 'American/Line Squad', hex: 'E8' }, // 3 away, clear
        { type: 'American/Line Squad', hex: 'E9', suppressed: true },
        { type: 'American/Line Squad', hex: 'E2' }, // behind the woods at E3
        { type: 'American/Line Squad', hex: 'O5' }, // 10 away
      ],
    });

  it('may suppress an enemy unit in Range and LOS of one of his working machine guns', () => {
    const s = base();
    const r = trigger(s, 'axis', choices({ suppressingFire: [0] }));
    expect(asked(r.decisions, 'suppressingFire')[0]).toMatchObject({ items: [{ piece: 'p2' }], min: 0, max: 1 });
    expect(s.pieces.p2.suppressed).toBe(true);
  });

  it('not with a broken machine gun or a suppressed carrier', () => {
    const s = base();
    s.pieces.p1.broken = true;
    expect(trigger(s, 'axis', passive).decisions).toEqual([]);
    const t = base();
    t.pieces.p0.suppressed = true;
    expect(trigger(t, 'axis', passive).decisions).toEqual([]);
  });
});
