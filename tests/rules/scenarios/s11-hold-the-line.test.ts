// Scenario 11, Hold the Line (scenarios-reference §3): SSR 1 Uncleared Fortifications (neutral Wire and 6-FP Mines), SSR 2
// Immobilised Sherman (set-up, stacking 4, the fixed Pack Howitzer), SSR 3 reinforcements, SSR 4 captured Panzerfausts.
import { describe, expect, it } from 'vitest';
import { areaHexes } from '../../../src/engine/data';
import { advanceTime } from '../../../src/engine/deck';
import { fireOptions, fireSpecError } from '../../../src/engine/fire';
import { endOfTurn, turnFlow } from '../../../src/engine/flow';
import { mineAttack, mineStrength } from '../../../src/engine/forts';
import { colOf, parseHex } from '../../../src/engine/hex';
import { figures, stackLimit } from '../../../src/engine/stats';
import { removeFort } from '../../../src/engine/state';
import type { Answer, Decision, GameEvent, HexId } from '../../../src/engine/types';
import { H, build, card, makeCtx, passive, run, start, type BuildSpec } from '../../support/build';
import { ofType, setUp, special } from './kit';

const A = 'American';
type FireEvent = Extract<GameEvent, { kind: 'fireAttack' }>;

describe('scenario 11 Hold the Line: set-up', () => {
  it('SSR 1: the Wire and Mines are on the map from the start; the Mines are 6 FP', () => {
    const { s } = setUp('11', 1);
    for (const h of ['B2', 'B3', 'B5', 'B6', 'B8', 'B9', 'C8', 'D8', 'D5', 'E5', 'H5', 'G6', 'G8', 'G9']) expect(s.fort[parseHex(h)], h).toBe('wire');
    for (const h of ['C5', 'C6', 'D7', 'E8']) expect(s.fort[parseHex(h)], h).toBe('mines');
    expect(mineStrength(s)).toBe(6);
  });

  it('SSR 1: the Mines belong to neither side: they attack German and American units alike, at 6 FP', () => {
    for (const [type, roller] of [['German/SS Squad', 'allied'], ['American/Line Squad', 'axis']] as const) {
      const s = build({ special: special('11'), fort: { E5: 'mines' }, pieces: [{ type, hex: 'E5' }] });
      const r = run(s, (ctx) => mineAttack(s, ctx, ['p0'], H('E5')), passive);
      expect(r.events.find((e): e is FireEvent => e.kind === 'fireAttack')).toMatchObject({ side: roller, fp: 6 });
    }
  });

  it('SSR 2: one Open, non-Hill hex takes the Bunker together with its crew (Buehler, the .50 cal, the howitzer team)', () => {
    for (const seed of [1, 2, 3, 4]) {
      const { s, r } = setUp('11', seed);
      const bunkers = s.fort.map((f, h) => (f === 'bunker' ? h : -1)).filter((h) => h >= 0);
      expect(bunkers).toHaveLength(1);
      const hex = bunkers[0];
      expect(s.map.terrain[hex]).toBe('Open');
      expect(s.map.elevation[hex]).toBe(0);
      expect(areaHexes(s.scenario.sides.allied.setupArea, s.scenario.sides.allied.edge)).toContain(hex);
      const buehler = ofType(s, 'American/Sgt Buehler')[0];
      const team = ofType(s, 'American/Weapon Team')[0];
      expect([buehler.hex, team.hex]).toEqual([hex, hex]);
      expect(s.pieces[buehler.weapon!].type).toBe('American/.50 cal MG');
      expect(s.pieces[team.weapon!].type).toBe('American/Pack Howitzer');
      expect(s.fort.filter((f) => f === 'foxholes')).toHaveLength(2);
      // the hex was the player's pick among such hexes
      const d = r.decisions.find((x): x is Extract<Decision, { kind: 'choose' }> => x.kind === 'choose' && x.reason === 'placement')!;
      expect(d.side).toBe('allied');
      for (const it of d.items) {
        const h = (it as { hex: HexId }).hex;
        expect(s.map.terrain[h] === 'Open' && s.map.elevation[h] === 0).toBe(true);
      }
      expect(figures(s, hex, 'allied')).toBeLessThanOrEqual(4);
    }
  });

  it('SSR 3: one Line Squad arrives on each of Time spaces 2 to 5, along the Allied edge', () => {
    const { s } = setUp('11', 5);
    const due = Object.values(s.pieces).filter((p) => p.where === 'time');
    expect(due.map((p) => p.space).sort()).toEqual([2, 3, 4, 5]);
    run(s, (ctx) => advanceTime(s, ctx, 'axis'), passive);
    const sq = due.find((p) => p.space === -1 || p.where === 'map')!;
    expect(sq).toMatchObject({ type: 'American/Line Squad', where: 'map' });
    expect(colOf(sq.hex)).toBe(0);
  });
});

describe('scenario 11 Hold the Line: play', () => {
  const bunkerSpec = (extra: Partial<BuildSpec> = {}): BuildSpec => ({
    special: special('11'),
    fort: { E5: 'bunker' },
    active: 'allied',
    pieces: [
      { type: 'American/Weapon Team', hex: 'E5', weapon: 'American/Pack Howitzer' }, // p0, p1
      { type: 'American/Sgt Buehler', hex: 'E5', weapon: 'American/.50 cal MG' }, // p2, p3
      { type: 'German/SS Squad', hex: 'L5' }, // p4
    ],
    ...extra,
  });

  it('SSR 2: while the Bunker exists its hex holds at most 4 figures; then 7 again', () => {
    const s = build(bunkerSpec());
    expect(stackLimit(s, H('E5'))).toBe(4);
    expect(stackLimit(s, H('E6'))).toBe(7);
    removeFort(s, makeCtx([]), H('E5'));
    expect(stackLimit(s, H('E5'))).toBe(7);
  });

  it('stacking limits by hex (SpecialRules.stackingLimits): set-up and the end of the Turn observe them', () => {
    const s = build({
      special: { stackingLimits: { [H('E5')]: 4 } },
      pieces: [{ type: 'American/Line Squad', hex: 'E5' }, { type: 'American/Line Team', hex: 'E5' }, { type: 'German/SS Squad', hex: 'L5' }],
    });
    expect(stackLimit(s, H('E5'))).toBe(4);
    run(s, (ctx) => endOfTurn(s, ctx), passive);
    expect(figures(s, H('E5'), 'allied')).toBeLessThanOrEqual(4);
    expect(s.players.allied.casualties).toHaveLength(1);
  });

  it('SSR 2: the Pack Howitzer cannot leave the Bunker hex: a carrier moving out leaves it eliminated', () => {
    const MOVE = card(A, { order: 'Move' });
    const s = build(bunkerSpec({ allied: { hand: [MOVE] } }));
    const f = start(s, (ctx) => turnFlow(s, ctx));
    f.answer({ kind: 'order', card: MOVE, order: 'Move' }).answer({ kind: 'activate', units: ['p0'] });
    f.answer({ kind: 'moveStep', units: ['p0'], to: H('E4') } as Answer);
    expect(s.pieces.p0.hex).toBe(H('E4'));
    expect(s.pieces.p1.where).toBe('weaponsBox');
    expect(s.pieces.p0.weapon).toBeNull();
    expect(s.pieces.p3.where).toBe('carried'); // the .50 cal is not fixed
  });

  it('SSR 2: the Pack Howitzer is eliminated with the Bunker', () => {
    const s = build(bunkerSpec());
    removeFort(s, makeCtx([]), H('E5'));
    run(s, (ctx) => endOfTurn(s, ctx), passive);
    expect(s.pieces.p1.where).toBe('weaponsBox');
    expect(s.pieces.p3.where).toBe('carried');
  });

  it('SSR 4: the American Satchel Charges cannot attack a hex whose Cover is below 2', () => {
    const s = build({
      special: special('11'),
      map: { terrain: { E3: 'Building', D4: 'Woods', F4: 'Brush' } },
      active: 'allied',
      pieces: [
        { type: 'American/Line Team', hex: 'E5', weapon: 'American/Satchel Charge' }, // p0, p1
        { type: 'German/SS Squad', hex: 'E4' }, // p2: Open
      ],
    });
    expect(fireSpecError(s, 'allied', { pieces: ['p1'], target: H('E4') }, ['p0', 'p1'], 'order')).toMatch(/Cover/);
    expect([...fireOptions(s, ['p0', 'p1']).values()].flat().some((x) => x.pieces.includes('p1'))).toBe(false);
    for (const [hex, ok] of [['D4', true], ['F4', false]] as const) {
      s.pieces.p2.hex = H(hex);
      expect(fireSpecError(s, 'allied', { pieces: ['p1'], target: H(hex) }, ['p0', 'p1'], 'order') === null, hex).toBe(ok);
    }
    // the rule names the Satchel Charges only
    // without the rule a Satchel Charge attacks any hex
    const plain = build({ active: 'allied', pieces: [{ type: 'American/Line Team', hex: 'E5', weapon: 'American/Satchel Charge' }, { type: 'German/SS Squad', hex: 'E4' }] });
    expect(fireSpecError(plain, 'allied', { pieces: ['p1'], target: H('E4') }, ['p0', 'p1'], 'order')).toBeNull();
  });
});
