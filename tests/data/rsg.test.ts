// RSG tables (src/data/rsg.json via data.ts RSG) against design/scenarios-reference.md §4.
import { describe, expect, it } from 'vitest';
import { COUNTERS, RSG } from '../../src/engine/data';
import type { Nation, Quality } from '../../src/engine/types';

const NATIONS: Nation[] = ['German', 'American', 'Russian'];
const YEARS: Record<Nation, number[]> = {
  German: [1939, 1940, 1941, 1942, 1943, 1944, 1945],
  American: [1943, 1944, 1945],
  Russian: [1939, 1940, 1941, 1942, 1943, 1944, 1945],
};
const ROLLS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

describe('RSG tables', () => {
  it('RS.1/RS.2: edges by die, German years, Allied nations (France/Britain = null)', () => {
    expect(RSG.edgeByDie).toEqual({ 1: 'top', 2: 'right', 3: 'right', 4: 'bottom', 5: 'left', 6: 'left' });
    expect(ROLLS.map((r) => RSG.germanYear[r])).toEqual([1939, 1943, 1940, 1945, 1941, 1942, 1943, 1944, 1944, 1944, 1944]);
    expect(RSG.alliedNation[3][1943]).toBe('American');
    expect(RSG.alliedNation[2][1942]).toBe('Russian');
    expect(RSG.alliedNation[10][1944]).toBeNull();
    for (const r of ROLLS) for (const y of [1939, 1940]) expect(RSG.alliedNation[r][y]).toBeNull();
  });

  it('RS.3: a troop quality for every roll and every year the nation fields OBs', () => {
    for (const n of NATIONS) for (const r of ROLLS) for (const y of YEARS[n]) expect(['elite', 'line', 'green']).toContain(RSG.troopQuality[n][r][y]);
    expect(RSG.troopQuality.German[12][1942]).toBe('green');
    expect(RSG.troopQuality.Russian[4][1941]).toBe('line');
    expect(RSG.troopQuality.American[9][1943]).toBe('green');
  });

  it('RS.5: nine OBs per nation with real counters, three sizes, Orders 4/3/2 and Leaders 3/2/1', () => {
    expect(Object.keys(RSG.obs.German).join('')).toBe('ABCDEFGHJ');
    expect(Object.keys(RSG.obs.American).join('')).toBe('RSTUVWXYZ');
    expect(Object.keys(RSG.obs.Russian).join('')).toBe('RSTUVWXYZ');
    for (const n of NATIONS) {
      for (const ob of Object.values(RSG.obs[n])) {
        expect(ob.nation).toBe(n);
        expect(ob.years[0]).toBeLessThanOrEqual(ob.years[1]);
        const { company, detachment, platoon } = ob.sizes;
        expect([company.orders, detachment.orders, platoon.orders]).toEqual([4, 3, 2]);
        expect([company.leaders, detachment.leaders, platoon.leaders]).toEqual([3, 2, 1]);
        expect(company.points > detachment.points && detachment.points > platoon.points).toBe(true);
        for (const size of [company, detachment, platoon]) {
          for (const id of Object.keys(size.units)) expect(COUNTERS[id]?.nation, id).toBe(n);
          for (const u of size.unitsByYear ?? []) for (const id of Object.keys(u.units)) expect(COUNTERS[id]).toBeDefined();
        }
      }
    }
    expect(RSG.obs.German.D.sizes.company.units['German/Fallschirmjager Squad']).toBe(9);
    expect(RSG.obs.German.F.sizes.company.unitsByYear).toHaveLength(2);
  });

  it('every reachable nation / year / quality has an OB', () => {
    for (const n of NATIONS) {
      for (const y of YEARS[n]) {
        const qs = new Set<Quality>(ROLLS.map((r) => RSG.troopQuality[n][r][y]));
        const reachable = n === 'German' || ROLLS.some((r) => RSG.alliedNation[r][y] === n);
        if (!reachable) continue;
        for (const q of qs) {
          const ok = Object.values(RSG.obs[n]).some((ob) => ob.quality === q && ob.years[0] <= y && y <= ob.years[1]);
          expect(ok, `${n} ${y} ${q}`).toBe(true);
        }
      }
    }
  });

  it('RS.6: eight Leader Table results per nation, all Leaders, and the modifiers', () => {
    for (const n of NATIONS) {
      expect(RSG.leaderTable[n]).toHaveLength(8);
      for (const id of RSG.leaderTable[n]) expect(COUNTERS[id]).toMatchObject({ nation: n, kind: 'leader' });
    }
    expect(RSG.leaderTable.German[7]).toBe('German/Lt Von Karsties');
    expect(RSG.leaderModifiers.quality).toEqual({ elite: 1, line: 0, green: -1 });
    expect(RSG.leaderModifiers.year.Russian[1939]).toBe(-2);
    expect(RSG.leaderModifiers.year.American[1942]).toBeNull();
  });

  it('RS.7: Support Tables with items for every roll, real counters and one-of leaders', () => {
    for (const n of NATIONS) {
      const t = RSG.support[n];
      for (const r of ROLLS) {
        expect(t.columns[r].length, `${n} ${r}`).toBeGreaterThan(0);
        for (const e of t.columns[r]) {
          expect(t.items[e.item]).toBeDefined();
          expect(e.vp).toBeGreaterThan(0);
        }
      }
      for (const item of Object.values(t.items)) {
        for (const id of [...Object.keys(item.pieces), ...(item.oneOf ?? [])]) expect(COUNTERS[id]?.nation, id).toBe(n);
        if (item.kind === 'unitWithWeapon') expect(item.pieces[item.carrier!]).toBe(1);
        if (item.kind === 'leaderEither') expect(item.oneOf).toHaveLength(2);
        if (item.kind === 'radio') expect(COUNTERS[Object.keys(item.pieces)[0]].kind).toBe('radio');
      }
    }
    expect(RSG.support.German.items.lt_huntziger_or_bolter.oneOf).toEqual(['German/Lt Huntziger', 'German/Lt Bolter']);
  });

  it('RS.9-RS.13: fortification OBs and set-up depths', () => {
    expect(RSG.fortifications.map((f) => f.id)).toEqual([
      'entrenchments',
      'trench_line',
      'barbed_wire',
      'strongpoint',
      'bunker_complex',
      'hasty_minefield',
      'prepared_minefield',
      'extensive_minefield',
    ]);
    expect(RSG.fortifications.find((f) => f.id === 'bunker_complex')).toMatchObject({
      vp: 10,
      minefield: 8,
      contents: { bunker: 3, trench: 3, wire: 3, mines: 3 },
    });
    expect(RSG.setupDepth).toEqual({
      defender: { wide: 8, narrow: 12 },
      attacker: { wide: 2, narrow: 3 },
      fortifications: { wide: 8, narrow: 12 },
      recon: { wide: 4, narrow: 6 },
    });
  });

  it('keeps the design-your-own point values', () => {
    expect(RSG.pointValues.German['German/SS Squad']).toBe(154);
    expect(RSG.pointValues.American['American/Radio:203mm']).toBe(700);
    expect(RSG.pointValues.Russian.Captain).toBe(344);
    expect(RSG.fortPointValues).toMatchObject({ foxholes: 31, mines8: 120, wire: 33 });
  });
});
