// The twelve scenarios (src/data/scenarios/<n>.json via src/engine/data.ts) against design/scenarios-reference.md §3.
import { describe, expect, it } from 'vitest';
import { COUNTERS, OBJECTIVE_CHITS, SCENARIOS, areaHexes, hasMap, loadMap, scenario } from '../../src/engine/data';
import { NUM_HEXES } from '../../src/engine/hex';
import type { Nation, Posture, ScenarioDef, Side } from '../../src/engine/types';

const SIDES: Side[] = ['axis', 'allied'];
const HAND: Record<Posture, number> = { attack: 6, recon: 5, defend: 4 };
const DISCARD: Record<Nation, number> = { German: 6, American: 5, Russian: 3 };

// scenarios-reference §3 summary table (+ set-up order from each scenario's SET UP line).
const TABLE: [string, string, string, number, Nation, Side, number, number, number, Side, Side][] = [
  // id, name, map, year, allies, initiative, time, SD, VP (+ Axis), first turn, sets up first
  ['1', 'Fat Lipki', '1', 1941, 'Russian', 'axis', 2, 7, 0, 'allied', 'allied'],
  ['2', 'Hedgerows & Hand Grenades', '2', 1944, 'American', 'axis', 0, 8, 10, 'allied', 'allied'],
  ['3', 'Bonfire of the NKVD', '3', 1941, 'Russian', 'axis', 0, 7, -20, 'axis', 'allied'],
  ['4', 'Closed for Renovation', '4', 1944, 'American', 'axis', 1, 7, 20, 'allied', 'axis'],
  ['5', 'Cold Front', '5w', 1941, 'Russian', 'allied', 5, 13, 9, 'allied', 'allied'],
  ['6', 'Paralyzed from the West Down', '6', 1944, 'American', 'allied', 0, 6, 9, 'allied', 'axis'],
  ['7', 'Bessarabian Nights', '7', 1944, 'Russian', 'axis', 0, 5, 0, 'allied', 'allied'],
  ['8', 'Breakout Dance', '8', 1943, 'Russian', 'axis', 0, 5, -2, 'axis', 'allied'],
  ['9', 'Rush to Contact', '9', 1945, 'American', 'axis', 2, 12, 14, 'allied', 'allied'],
  ['10', 'Commando School', '10', 1943, 'Russian', 'axis', 0, 6, -9, 'axis', 'allied'],
  ['11', 'Hold the Line', '11', 1944, 'American', 'axis', 1, 6, -10, 'axis', 'allied'],
  ['12', 'Misty Mountain', '12', 1944, 'American', 'axis', 4, 12, 16, 'allied', 'allied'],
];

const piecesOf = (scn: ScenarioDef, side: Side) => {
  const s = scn.sides[side];
  const all: [string, number][] = Object.entries(s.forces);
  for (const r of Object.values(s.reinforcements)) all.push(...Object.entries(r));
  return all;
};

describe('scenarios', () => {
  it('are the twelve of the Playbook, in order', () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual(TABLE.map((t) => t[0]));
    expect(scenario('7')).toBe(SCENARIOS[6]);
    expect(() => scenario('13')).toThrow();
  });

  for (const [id, name, map, year, allies, init, time, sd, vp, first, setupFirst] of TABLE) {
    describe(`${id} ${name}`, () => {
      const scn = scenario(id);

      it('matches the summary table', () => {
        expect(scn).toMatchObject({ id, name, map, year, initiative: init, time, suddenDeath: sd, vp, firstTurn: first, setupFirst });
        expect(scn.sides.axis.nation).toBe('German');
        expect(scn.sides.allied.nation).toBe(allies);
      });

      it('names only existing counters, each Leader once', () => {
        for (const side of SIDES) {
          const seen = new Set<string>();
          for (const [type, n] of piecesOf(scn, side)) {
            const c = COUNTERS[type];
            expect(c, `${side}: ${type}`).toBeDefined();
            expect(n).toBeGreaterThan(0);
            if (c.kind === 'leader') {
              expect(n, type).toBe(1);
              expect(seen.has(type), `${type} twice`).toBe(false);
              seen.add(type);
            }
          }
          for (const t of scn.special.latePlacement?.[side] ?? []) expect(scn.sides[side].forces[t], t).toBe(1);
        }
      });

      it('has hand size and discard by posture and nation unless a special rule changes them', () => {
        for (const side of SIDES) {
          const s = scn.sides[side];
          expect(s.handSize).toBe(HAND[s.posture]);
          expect(s.discard).toBe(id === '8' && side === 'axis' ? 1 : DISCARD[s.nation]);
          expect(s.orders).toBeGreaterThanOrEqual(1);
          expect(s.orders).toBeLessThanOrEqual(6);
          expect(s.surrender).toBeGreaterThan(0);
        }
      });

      it('gives each side an edge facing the enemy and a set-up area on the map', () => {
        const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const;
        expect(scn.sides.allied.edge).toBe(opposite[scn.sides.axis.edge]);
        for (const side of SIDES) {
          const hexes = areaHexes(scn.sides[side].setupArea, scn.sides[side].edge);
          expect(hexes.length, side).toBeGreaterThan(0);
          for (const h of hexes) expect(h >= 0 && h < NUM_HEXES).toBe(true);
        }
      });

      it('has valid objective control, chits and pre-placed fortifications', () => {
        expect(scn.control).toHaveLength(5);
        const chit = (c: string) => c === 'random' || c in OBJECTIVE_CHITS;
        expect(scn.openChits.every(chit)).toBe(true);
        for (const side of SIDES) expect(scn.sides[side].secretChits.every(chit)).toBe(true);
        for (const c of scn.special.excludeChits ?? []) {
          expect(c in OBJECTIVE_CHITS).toBe(true);
          expect(scn.openChits).not.toContain(c);
        }
        for (const p of scn.prePlaced) expect(p.hex >= 0 && p.hex < NUM_HEXES).toBe(true);
      });

      it.skipIf(!hasMap(map))('has its five objectives and its set-up hexes on its map', () => {
        const m = loadMap(scn.map);
        expect(m.objectives).toHaveLength(5);
        expect(new Set(m.objectives).size).toBe(5);
        for (const side of SIDES) {
          const area = scn.sides[side].setupArea;
          if (area.kind === 'near' || area.kind === 'hexes') {
            for (const h of area.hexes) expect(m.terrain[h]).not.toBe('Water');
          }
        }
        for (const p of scn.prePlaced) expect(m.terrain[p.hex]).not.toBe('Water');
      });
    });
  }

  it('uses American counters for scenario 12 (base-game stand-ins for the Brazilians)', () => {
    const scn = scenario('12');
    expect(scn.sides.allied.nation).toBe('American');
    for (const [type] of piecesOf(scn, 'allied')) expect(type.startsWith('American/'), type).toBe(true);
    expect(scn.sides.allied.forces['American/Lt Blankenship']).toBe(1);
    expect(scn.sides.allied.reinforcements[7]).toEqual({ 'American/Green Squad': 8, 'American/Sgt Smith': 1 });
  });

  it('keeps the special rules the engine knows as data', () => {
    expect(scenario('1').special).toMatchObject({ simultaneousSetup: true, initiativeChoice: true });
    expect(scenario('1').sides.allied.setupArea).toEqual({ kind: 'near', hexes: [1, 140] }); // A2, O1
    expect(scenario('2').special).toMatchObject({ hedge: { cost: 2, cover: 2 }, latePlacement: { allied: ['American/Lt Blankenship'] } });
    expect(scenario('3').special.excludeChits).toEqual(['V', 'W', 'X']);
    expect(scenario('5').special.openCost).toBe(1.5);
    expect(scenario('9').sides.axis.minefield).toBe(8);
    expect(scenario('9').sides.allied.reinforcements[6]).toEqual({ 'American/Radio:105mm': 1 });
    expect(scenario('10').sides.axis.forces['German/Lt Schrader']).toBe(1);
    expect(scenario('11').prePlaced.filter((p) => p.fort === 'wire')).toHaveLength(14);
    expect(scenario('11').prePlaced.filter((p) => p.fort === 'mines')).toHaveLength(4);
    expect(scenario('11').sides.allied.fortifications).toEqual({ foxholes: 2, bunker: 1 });
    expect(scenario('11').sides.allied.forces['American/Satchel Charge']).toBe(2);
    expect(scenario('7').sides.allied.forces['German/Light Mortar']).toBe(1);
  });

  it('puts the depth areas on the right rows and columns', () => {
    // scenario 4: Axis (bottom edge) 9 deep = rows 2..10; Allies (top) 1 deep = row 1
    expect(areaHexes(scenario('4').sides.allied.setupArea, 'top')).toHaveLength(15);
    expect(areaHexes(scenario('4').sides.axis.setupArea, 'bottom')).toHaveLength(135);
    // scenario 10: Axis (right edge) 3 deep = columns M..O
    expect(areaHexes(scenario('10').sides.axis.setupArea, 'right')).toEqual([120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149]);
  });
});
