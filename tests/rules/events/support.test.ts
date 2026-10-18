// Events that bring pieces into play: Infiltration (§E59), Reinforcements (§E68, R-49), Scrounge (§E71, R-37), Walking
// Wounded (§E76, R-38, R-40); the counter-mix limits on named Leaders (§E42).
import { describe, expect, it } from 'vitest';
import type { Nation } from '../../../src/engine/types';
import { H, build, cardsWhere, passive, piecesOf, rolls } from '../../support/build';
import { G, asked, choices, eventSeq, ofKind, trigger } from './kit';

/** A roll of `sum` from `nation`'s deck that does not carry Random Hex `hex`. */
const rollNot = (nation: Nation, sum: number, hex: string) => rolls(nation, [sum], cardsWhere(nation, { hex }))[0];

describe('Infiltration (§E59)', () => {
  it('a Support Table roll, one item of that column (no Radio), placed in or next to a Random Hex, stacking observed', () => {
    const s = build({
      year: 1944,
      map: { terrain: { D4: 'Water' } },
      axis: { top: eventSeq(G, 'Infiltration', [rollNot(G, 7, 'E5'), 'E5']) },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E6' }, { type: 'German/Line Team', hex: 'E6' }, { type: 'American/Line Squad', hex: 'A9' }],
    });
    const r = trigger(s, 'axis', choices({ infiltration: { label: 'Wpn Team w/ Light MG' }, infiltrationPlace: { hex: 'F5' } }));
    expect(asked(r.decisions, 'infiltration')[0].items).toEqual([
      { label: 'Sergeant Pfeiffer' }, { label: 'Wpn Team w/ Light MG' }, { label: 'Wpn Team w/ Medium Mortar' }, { label: 'Rifle Squad' },
    ]);
    const place = asked(r.decisions, 'infiltrationPlace')[0];
    expect(place.items).toEqual(['D5', 'E4', 'E5', 'F4', 'F5'].map((h) => ({ hex: H(h) }))); // not D4 (Water), not E6 (full)
    const [team] = piecesOf(s, 'German/Weapon Team');
    const [lmg] = piecesOf(s, 'German/LMG');
    expect(team).toMatchObject({ where: 'map', hex: H('F5'), side: 'axis', weapon: lmg.id });
    expect(lmg).toMatchObject({ where: 'carried', carrier: team.id });
    expect(r.decisions.filter((d) => d.kind === 'reroll')).toHaveLength(1); // the Support Table roll is a roll
  });

  it('a named Leader in play is not offered; an "A or B" row offers each Leader', () => {
    const s = build({
      year: 1944,
      axis: { top: eventSeq(G, 'Infiltration', [rollNot(G, 8, 'E5'), 'E5']) },
      pieces: [{ type: 'German/Sgt Grein', hex: 'A9' }],
    });
    const r = trigger(s, 'axis', choices({ infiltration: { label: 'Sgt Benzing' } }));
    const labels = asked(r.decisions, 'infiltration')[0].items.map((i) => ('label' in i ? i.label : ''));
    expect(labels).toContain('Sgt Benzing');
    expect(labels).not.toContain('Sgt Grein');
    expect(labels.some((l) => l.startsWith('Radio'))).toBe(false);
    expect(piecesOf(s, 'German/Sgt Benzing').map((p) => p.where)).toEqual(['map']);
  });

  it('nothing available in the year: no item, no Random Hex', () => {
    const s = build({ year: 1938, axis: { top: eventSeq(G, 'Infiltration', [rollNot(G, 7, 'E5'), 'E5']) } });
    const r = trigger(s, 'axis', passive);
    expect(asked(r.decisions, 'infiltration')).toEqual([]);
    expect(s.players.axis.discards).toHaveLength(2); // the Event card and the roll
    expect(Object.keys(s.pieces)).toEqual([]);
  });

  it('no room around the Random Hex: nothing is placed', () => {
    const water = { E4: 'Water', F4: 'Water', F5: 'Water', E6: 'Water', D5: 'Water', D4: 'Water', E5: 'Water' } as const;
    const s = build({ year: 1944, map: { terrain: water }, axis: { top: eventSeq(G, 'Infiltration', [rollNot(G, 7, 'E5'), 'E5']) } });
    trigger(s, 'axis', choices({ infiltration: { label: 'Rifle Squad' } }));
    expect(piecesOf(s, 'German/Rifle Squad')).toEqual([]);
  });
});

describe('Reinforcements (§E68, R-49)', () => {
  const seq = () => eventSeq(G, 'Reinforcements', [rolls(G, [7])[0]]);

  it('a Radio goes to his empty Artillery Box', () => {
    const s = build({ year: 1944, axis: { top: seq() } });
    const r = trigger(s, 'axis', choices({ reinforcementItem: { label: 'Radio: 150mm' } }));
    const [radio] = piecesOf(s, 'German/Radio:150mm');
    expect(radio.where).toBe('artillery');
    expect(r.events).toContainEqual({ kind: 'reinforce', pieces: [radio.id] });
  });

  it('a Radio is not placed when the box already holds one', () => {
    const s = build({ year: 1944, axis: { top: seq() }, pieces: [{ type: 'German/Radio:105mm', where: 'artillery' }] });
    trigger(s, 'axis', choices({ reinforcementItem: { label: 'Radio: 150mm' } }));
    expect(piecesOf(s, 'German/Radio:150mm')).toEqual([]);
  });

  it('a unit enters along his own edge, stacking observed; an enemy-held edge hex means a melee in the Event', () => {
    const s = build({
      year: 1944,
      axis: { top: seq() }, // Axis edge: bottom (row 10)
      map: { terrain: { A10: 'Water' } },
      pieces: [{ type: 'German/Rifle Squad', hex: 'C10' }, { type: 'German/Rifle Squad', hex: 'C10' }, { type: 'American/Line Team', hex: 'E10' }],
    });
    const r = trigger(s, 'axis', choices({ reinforcementItem: { label: 'Rifle Squad' }, reinforcementPlace: { hex: 'E10' } }));
    const hexes = asked(r.decisions, 'reinforcementPlace')[0].items.map((i) => ('hex' in i ? i.hex : -1));
    expect(hexes).toHaveLength(13); // 15 along the edge, less Water A10 and the full C10
    expect(hexes.every((h) => h % 10 === 9)).toBe(true);
    const fresh = piecesOf(s, 'German/Rifle Squad').find((p) => p.id !== 'p0' && p.id !== 'p1')!;
    expect(r.events).toContainEqual({ kind: 'reinforce', pieces: [fresh.id] });
    expect(ofKind(r.events, 'melee').map((e) => e.hex)).toEqual([H('E10')]);
  });
});

describe('Scrounge (§E71, R-37)', () => {
  const base = () => {
    const s = build({
      axis: { top: eventSeq(G, 'Scrounge', []) },
      pieces: [
        { type: 'German/Rifle Squad', hex: 'E5' },
        { type: 'German/Line Team', hex: 'E6', weapon: 'German/LMG' },
        { type: 'American/Line Squad', hex: 'E9', weapon: 'American/MMG' },
      ],
    });
    s.pieces.p3.weapon = null;
    Object.assign(s.pieces.p4, { where: 'weaponsBox', carrier: null });
    return s;
  };

  it('takes an eliminated Weapon of either side, unbroken, for one of his units without one', () => {
    const s = base();
    const r = trigger(s, 'axis', choices({ scrounge: { piece: 'p4' } }));
    expect(asked(r.decisions, 'scroungeUnit')).toEqual([]); // p0 is his only unit without a Weapon
    expect(s.pieces.p4).toMatchObject({ side: 'axis', where: 'carried', carrier: 'p0', broken: false });
    expect(s.pieces.p0.weapon).toBe('p4');
  });

  it('he may decline; nothing to take or nobody to take it: nothing is asked', () => {
    const s = base();
    trigger(s, 'axis', passive);
    expect(s.pieces.p4.where).toBe('weaponsBox');
    const t = build({ axis: { top: eventSeq(G, 'Scrounge', []) }, pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }] });
    expect(trigger(t, 'axis', passive).decisions).toEqual([]);
    const u = base();
    u.pieces.p0.where = 'casualty';
    expect(trigger(u, 'axis', passive).decisions).toEqual([]);
  });
});

describe('Walking Wounded (§E76, R-38, R-40)', () => {
  it('an eliminated unit of either side comes back broken in or next to a Random Hex; its VP stay', () => {
    const s = build({
      vp: 2,
      axis: { top: eventSeq(G, 'Walking Wounded', ['E5']) },
      pieces: [
        { type: 'American/Line Squad', where: 'casualty' },
        { type: 'German/Line Team', where: 'casualty' },
        { type: 'American/Line Squad', hex: 'E6' },
        { type: 'American/Line Team', hex: 'E6' },
      ],
    });
    const r = trigger(s, 'axis', choices({ walkingWounded: { piece: 'p0' }, walkingWoundedPlace: { hex: 'F5' } }));
    expect(asked(r.decisions, 'walkingWounded')[0].items).toEqual([{ piece: 'p1' }, { piece: 'p0' }]);
    const place = asked(r.decisions, 'walkingWoundedPlace')[0].items;
    expect(place).not.toContainEqual({ hex: H('E6') }); // 6 American figures + 4 would overstack
    expect(place).toHaveLength(6);
    expect(s.pieces.p0).toMatchObject({ where: 'map', hex: H('F5'), broken: true });
    expect(s.players.allied.casualties).toEqual([]);
    expect(s.vp).toBe(2);
  });

  it('no unit on the Casualty Track: no Random Hex is drawn', () => {
    const s = build({ axis: { top: eventSeq(G, 'Walking Wounded', ['E5']) } });
    trigger(s, 'axis', passive);
    expect(s.players.axis.discards).toHaveLength(1);
  });
});
