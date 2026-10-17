// Counter types (src/data/counters.json via src/engine/data.ts): ids, kinds, qualities, leaders, weapons and radios.
import { describe, expect, it } from 'vitest';
import { COUNTERS, OBJECTIVE_CHITS, SMOKE_MIX, counterByName, teamFor } from '../../src/engine/data';
import type { CounterType, Nation, Quality } from '../../src/engine/types';

const NATIONS: Nation[] = ['German', 'American', 'Russian'];
const all = Object.values(COUNTERS);
const of = (n: Nation, kind?: CounterType['kind']) => all.filter((c) => c.nation === n && (!kind || c.kind === kind));

describe('counter types', () => {
  it('are keyed by "<Nation>/<name>"', () => {
    expect(all.length).toBeGreaterThan(100);
    for (const [id, c] of Object.entries(COUNTERS)) {
      expect(id).toBe(`${c.nation}/${c.name}`);
      expect(c.id).toBe(id);
      expect(counterByName(c.nation, c.name)).toBe(c);
    }
  });

  it('counterByName throws on an unknown counter', () => {
    expect(() => counterByName('German', 'Tiger Tank')).toThrow(/Tiger Tank/);
  });

  it('gives every stat side whole numbers and boxed flags', () => {
    for (const c of all) {
      for (const side of [c.front, c.broken]) {
        for (const k of ['fp', 'range', 'move', 'morale', 'command'] as const) expect(Number.isInteger(side[k]), `${c.id} ${k}`).toBe(true);
        expect(typeof side.boxed.fp).toBe('boolean');
        expect(typeof side.boxed.range).toBe('boolean');
        expect(typeof side.boxed.move).toBe('boolean');
      }
    }
  });

  NATIONS.forEach((nation) => {
    describe(nation, () => {
      it('has leaders with ranks, exactly one Hero and one Private', () => {
        const leaders = of(nation, 'leader');
        expect(leaders.length).toBe(19);
        expect(leaders.filter((l) => l.hero)).toHaveLength(1);
        expect(leaders.filter((l) => l.private)).toHaveLength(1);
        for (const l of leaders) {
          if (!l.hero) expect(['Pvt', 'Cpl', 'Sgt', 'Lt', 'Cpt']).toContain(l.rank);
          expect(l.front.command).toBeGreaterThanOrEqual(0);
          expect(l.quality).toBeUndefined();
        }
        const pvt = leaders.find((l) => l.private)!;
        expect(pvt.rank).toBe('Pvt');
        expect(pvt.front.morale).toBe(6);
      });

      it('gives every squad and every Elite/Line/Green team a quality', () => {
        for (const c of [...of(nation, 'squad'), ...of(nation, 'team')]) {
          if (c.name === 'Weapon Team') expect(c.quality).toBeUndefined();
          else expect(['elite', 'line', 'green'], c.id).toContain(c.quality);
        }
        // one squad of each quality exists (Light Wounds / Deploy replace with Teams, but quality tints use squads too)
        for (const q of ['elite', 'line', 'green'] as Quality[]) expect(of(nation, 'squad').some((s) => s.quality === q)).toBe(true);
      });

      it('teamFor gives the Team of that quality (Light Wounds §A36, Deploy §E52)', () => {
        for (const q of ['elite', 'line', 'green'] as Quality[]) {
          const t = COUNTERS[teamFor(nation, q)];
          expect(t.kind).toBe('team');
          expect(t.nation).toBe(nation);
          expect(t.quality).toBe(q);
        }
      });

      it('has radios with artillery FP 8..13 and no fix/elim numbers', () => {
        const radios = of(nation, 'radio');
        expect(radios.length).toBeGreaterThanOrEqual(4);
        for (const r of radios) {
          expect(r.front.fp).toBeGreaterThanOrEqual(8);
          expect(r.front.fp).toBeLessThanOrEqual(13);
          expect(r.fix).toBeUndefined();
          expect(r.weaponClass).toBeUndefined();
        }
      });

      it('has weapons with classes, fix/elim ranges and a movement modifier <= 0', () => {
        for (const w of of(nation, 'weapon')) {
          expect(w.weaponClass, w.id).toBeDefined();
          expect(w.front.move).toBeLessThanOrEqual(0);
          expect(w.broken).toEqual(w.front);
          const [f0, f1] = w.fix!;
          const [e0, e1] = w.elim!;
          expect(f0 <= f1 && f1 < e0 && e0 <= e1 && e1 <= 10, w.id).toBe(true);
        }
      });
    });
  });

  it('classes weapons for the rules that need it', () => {
    for (const n of NATIONS) {
      for (const w of of(n, 'weapon')) {
        const name = w.name;
        if (/MG$/.test(name)) expect(w.weaponClass, name).toBe('mg');
        if (/Mortar/.test(name)) {
          expect(w.weaponClass).toBe('mortar');
          expect(w.ordnance).toBe(true);
          expect(w.minRange).toBeGreaterThanOrEqual(2);
        }
      }
    }
    expect(COUNTERS['German/LMG']).toMatchObject({ weaponClass: 'mg', front: { fp: 4, range: 8, boxed: { fp: true, range: true } } });
    expect(COUNTERS['American/.50 cal MG']).toMatchObject({ weaponClass: 'mg', front: { fp: 9, range: 16, move: -2 } });
    expect(COUNTERS['German/HMG']).toMatchObject({ fix: [1, 6], elim: [7, 8], front: { move: -1 } });
    expect(COUNTERS['Russian/Light Mortar']).toMatchObject({ minRange: 2, front: { range: 14, move: -1 }, ordnance: true });
    expect(COUNTERS['American/Medium Mortar']).toMatchObject({ minRange: 3, smoke: true, weaponClass: 'mortar' });
    expect(COUNTERS['German/Flamethrower']).toMatchObject({ weaponClass: 'flamethrower', ordnance: true, ignoresCover: true });
    expect(COUNTERS['German/Flamethrower'].oneUse).toBeFalsy();
    expect(COUNTERS['Russian/Satchel Charge']).toMatchObject({ weaponClass: 'satchel', ordnance: true, oneUse: true });
    expect(COUNTERS['Russian/Satchel Charge'].ignoresCover).toBeFalsy();
    expect(COUNTERS['American/Pack Howitzer']).toMatchObject({ weaponClass: 'gun', ordnance: true, smoke: true });
    expect(COUNTERS['German/LMG'].ordnance).toBeFalsy();
  });

  it('gives radios their FP and smoke from the counters', () => {
    expect(COUNTERS['American/Radio:203mm']).toMatchObject({ kind: 'radio', front: { fp: 13 } });
    expect(COUNTERS['American/Radio:203mm'].smoke).toBeFalsy();
    expect(COUNTERS['German/Radio:81mm']).toMatchObject({ kind: 'radio', smoke: true, front: { fp: 9 } });
    expect(COUNTERS['Russian/Radio:152mm'].smoke).toBeFalsy();
  });

  it('reads squads, leaders and boxes as printed', () => {
    expect(COUNTERS['German/Rifle Squad']).toMatchObject({
      kind: 'squad',
      quality: 'line',
      front: { fp: 5, range: 5, move: 4, morale: 7, command: 0, boxed: { fp: false, range: true, move: true } },
    });
    expect(COUNTERS['American/Paratroop Squad']).toMatchObject({ quality: 'elite', front: { boxed: { fp: true, range: true, move: true } } });
    expect(COUNTERS['Russian/Militia Squad']).toMatchObject({ quality: 'green', front: { fp: 5, range: 2, move: 3, morale: 7 } });
    expect(COUNTERS['German/Lt Von Karsties']).toMatchObject({ kind: 'leader', rank: 'Lt', front: { morale: 9, command: 2 } });
    expect(COUNTERS['Russian/Cpt Egorov']).toMatchObject({ rank: 'Cpt', front: { morale: 10, command: 2 } });
  });

  it('describes the 22 objective chits (§7.3.2) and the 50 smoke markers', () => {
    expect(Object.keys(OBJECTIVE_CHITS).join('')).toBe('ABCDEFGHJKLMNPQRSTUVWX');
    expect(OBJECTIVE_CHITS.K).toMatchObject({ objective: 3, vp: 3, secret: true });
    expect(OBJECTIVE_CHITS.T).toMatchObject({ objective: 'all', vp: 2, secret: true });
    expect(OBJECTIVE_CHITS.R).toMatchObject({ objective: 5, vp: 10, secret: false });
    for (const c of 'VWX') expect(OBJECTIVE_CHITS[c].secret).toBe(false);
    expect(OBJECTIVE_CHITS.V.effect).toBe('suddenDeathWin');
    expect(OBJECTIVE_CHITS.W.effect).toBe('doubleExitVp');
    expect(OBJECTIVE_CHITS.X.effect).toBe('doubleEliminationVp');
    expect(SMOKE_MIX).toHaveLength(50);
    expect(SMOKE_MIX.filter((v) => v === 1)).toHaveLength(6);
    expect(SMOKE_MIX.filter((v) => v === 10)).toHaveLength(4);
  });
});
