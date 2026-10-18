// The Random Scenario Generator as a step-by-step engine (src/engine/rsg.ts) against design/scenarios-reference.md §4
// (RS.1–RS.16 with the base-game adaptation R0) and rules-reference R-39 / R-50.
import { describe, expect, it } from 'vitest';
import { COUNTERS, OBJECTIVE_CHITS, RSG, areaHexes, loadMap } from '../../src/engine/data';
import { gameFlow } from '../../src/engine/flow';
import { NUM_HEXES } from '../../src/engine/hex';
import designCounters from '../../design/data/counters.json';
import {
  RSG_MAPS, newRsgDraft, rsgAdvance, rsgAuto, rsgAutoRun, rsgCheck, rsgChoose, rsgCounterCap, rsgFinish, rsgLeaderIndex,
  rsgObOptions, rsgStep, type RsgChoice, type RsgChoiceStep, type RsgDraft, type RsgFixed, type RsgSupportOption,
} from '../../src/engine/rsg';
import { newGame, unitsOf } from '../../src/engine/state';
import type { Nation, Posture, Quality, ScenarioDef, Side } from '../../src/engine/types';
import { passive, run } from '../support/build';
import { mulberry32 } from '../support/rng';

const SIDES: Side[] = ['axis', 'allied'];
const HAND: Record<Posture, number> = { attack: 6, recon: 5, defend: 4 };
const DISCARD: Record<Nation, number> = { German: 6, American: 5, Russian: 3 };
const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const;
const lead = (vp: number, side: Side) => (side === 'axis' ? vp : -vp);

/** A finished draft: every choice made by rsgAuto (rnd from the seed) unless `pick` answers it. */
function generate(seed: number, opts: { humanSide?: Side; fixed?: RsgFixed } = {}, pick?: (st: RsgChoiceStep, d: RsgDraft) => RsgChoice | undefined): RsgDraft {
  const rnd = mulberry32(seed ^ 0x5eed);
  let d = newRsgDraft({ seed, ...opts });
  for (let i = 0; i < 200; i++) {
    const st = rsgStep(d);
    if (st.kind === 'done') return d;
    if (st.kind === 'auto') d = rsgAdvance(d);
    else d = rsgChoose(d, pick?.(st, d) ?? rsgAuto(d, st.side, rnd));
  }
  throw new Error('generate: no end');
}

/** Run until the next choice step (or the end). */
function toChoice(d: RsgDraft): RsgDraft {
  while (rsgStep(d).kind === 'auto') d = rsgAdvance(d);
  return d;
}

/** The checks tests/data/scenarios.test.ts applies to the historical scenarios. */
function checkScenario(scn: ScenarioDef): void {
  expect(scn.id).toBe('rsg');
  expect(RSG_MAPS).toContain(scn.map);
  expect(scn.sides.axis.nation).toBe('German');
  const pair = `${scn.sides.allied.nation} ${scn.year}`;
  expect(scn.sides.allied.nation === 'Russian' ? scn.year >= 1941 && scn.year <= 1945 : scn.year >= 1943 && scn.year <= 1945, pair).toBe(true);
  expect(scn.sides.allied.edge).toBe(OPPOSITE[scn.sides.axis.edge]);
  const m = loadMap(scn.map);
  for (const side of SIDES) {
    const s = scn.sides[side];
    const seen = new Set<string>();
    for (const [type, n] of Object.entries(s.forces)) {
      const c = COUNTERS[type];
      expect(c, `${side}: ${type}`).toBeDefined();
      expect(c.nation).toBe(s.nation);
      expect(n).toBeGreaterThan(0);
      if (c.kind === 'leader') {
        expect(n, type).toBe(1);
        expect(seen.has(type)).toBe(false);
        seen.add(type);
      }
    }
    expect(Object.keys(s.reinforcements)).toHaveLength(0);
    expect(s.handSize).toBe(HAND[s.posture]);
    expect(s.discard).toBe(DISCARD[s.nation]);
    expect(s.orders).toBeGreaterThanOrEqual(2);
    expect(s.orders).toBeLessThanOrEqual(4);
    expect(s.surrender).toBeGreaterThanOrEqual(1);
    const hexes = areaHexes(s.setupArea, s.edge);
    expect(hexes.length, side).toBeGreaterThan(0);
    for (const h of hexes) expect(h >= 0 && h < NUM_HEXES).toBe(true);
    expect(s.secretChits.length).toBeLessThanOrEqual(1);
    for (const c of s.secretChits) expect(OBJECTIVE_CHITS[c].secret).toBe(true);
    if (s.fortifications.mines) expect([6, 7, 8]).toContain(s.minefield);
  }
  // the two set-up areas never overlap (8 + 2, 12 + 3, 4 + 4, 6 + 6 rows of 10 / 15)
  const a = new Set(areaHexes(scn.sides.axis.setupArea, scn.sides.axis.edge));
  expect(areaHexes(scn.sides.allied.setupArea, scn.sides.allied.edge).some((h) => a.has(h))).toBe(false);
  const postures = [scn.sides.axis.posture, scn.sides.allied.posture].sort().join('/');
  expect(['attack/defend', 'recon/recon']).toContain(postures);
  expect(scn.control).toHaveLength(5);
  expect(m.objectives).toHaveLength(5);
  const chits = [...scn.openChits, ...scn.sides.axis.secretChits, ...scn.sides.allied.secretChits];
  for (const c of chits) expect(c in OBJECTIVE_CHITS, c).toBe(true);
  expect(new Set(chits).size).toBe(chits.length);
  expect(scn.time).toBe(0);
  expect(scn.suddenDeath).toBe(scn.sides.axis.orders + scn.sides.allied.orders);
  expect(scn.firstTurn).toBe(scn.initiative);
  expect(scn.prePlaced).toEqual([]);
  expect(JSON.parse(JSON.stringify(scn))).toEqual(scn);
}

describe('RSG draft', () => {
  it('starts with the coin flip for sides, or with RS.1 when the human side is given', () => {
    const d = newRsgDraft({ seed: 1 });
    expect(rsgStep(d)).toMatchObject({ kind: 'auto', what: 'sides' });
    const e = newRsgDraft({ seed: 1, humanSide: 'allied' });
    expect(e.humanSide).toBe('allied');
    expect(rsgStep(e)).toMatchObject({ kind: 'auto', what: 'mapRoll' });
    expect(JSON.parse(JSON.stringify(e))).toEqual(e);
  });

  it('is pure: advancing and choosing return new drafts and leave the old one as it was', () => {
    const d = newRsgDraft({ seed: 2, humanSide: 'axis' });
    const copy = JSON.stringify(d);
    const e = rsgAdvance(d);
    expect(JSON.stringify(d)).toBe(copy);
    expect(e).not.toBe(d);
    expect(e.log.length).toBeGreaterThan(d.log.length);
    expect(() => rsgChoose(d, { what: 'mapPick', map: '1' })).toThrow();
  });

  it('a fixed seed reproduces the same draft and scenario; other seeds differ', () => {
    const a = generate(1234);
    const b = generate(1234);
    expect(b).toEqual(a);
    expect(rsgFinish(b)).toEqual(rsgFinish(a));
    const others = [1, 2, 3, 4, 5].map((s) => JSON.stringify(rsgFinish(generate(s))));
    expect(new Set(others).size).toBeGreaterThan(1);
  });

  it('refuses to finish before the last step', () => {
    expect(() => rsgFinish(newRsgDraft({ seed: 3 }))).toThrow();
  });
});

describe('RS.1 battlefield', () => {
  it('an even roll lets the roller (Axis) pick the map, odd the other player; the other one picks his edge die', () => {
    for (let seed = 0; seed < 40; seed++) {
      let d = rsgAdvance(newRsgDraft({ seed, humanSide: 'axis' }));
      const dice = d.log.at(-1)!.dice!;
      expect(dice).toHaveLength(2);
      const picker: Side = (dice[0] + dice[1]) % 2 === 0 ? 'axis' : 'allied';
      expect(d.mapPicker).toBe(picker);
      const st = rsgStep(d) as RsgChoiceStep;
      expect(st).toMatchObject({ kind: 'choice', what: 'mapPick', side: picker });
      if (st.what !== 'mapPick') throw new Error();
      expect(st.options.map((o) => o.map)).toEqual(RSG_MAPS);
      d = toChoice(rsgChoose(d, { what: 'mapPick', map: '7' }));
      expect(d.map).toBe('7');
      const e = rsgStep(d) as RsgChoiceStep;
      expect(e).toMatchObject({ what: 'mapEdgeDie', side: picker === 'axis' ? 'allied' : 'axis' });
      if (e.what !== 'mapEdgeDie') throw new Error();
      expect(e.options.map((o) => o.value)).toEqual(d.edgeDice);
      const o = e.options[1];
      expect(o.edge).toBe(RSG.edgeByDie[o.value]);
      expect(o.orientation).toBe(o.edge === 'top' || o.edge === 'bottom' ? 'wide' : 'narrow');
      d = rsgChoose(d, { what: 'mapEdgeDie', die: 'coloured' });
      expect(d.edges![e.side]).toBe(o.edge);
      expect(d.edges![picker]).toBe(OPPOSITE[o.edge]);
    }
  });

  it('offers maps 1-12 (5w is map 5 dressed for scenario 5)', () => {
    expect(RSG_MAPS).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
  });
});

describe('RS.2 sides, year and Allied nation (R0)', () => {
  it('pairs Germany with Russia 1941-45 or America 1943-45 only, over 1,000 seeds', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 1000; seed++) {
      const d = generate(seed);
      const scn = rsgFinish(d);
      const n = scn.sides.allied.nation;
      expect(['Russian', 'American']).toContain(n);
      expect(scn.year).toBeGreaterThanOrEqual(n === 'American' ? 1943 : 1941);
      expect(scn.year).toBeLessThanOrEqual(1945);
      seen.add(`${n} ${scn.year}`);
      checkScenario(scn);
    }
    // every legal pairing comes up
    expect(seen.size).toBe(8);
  });

  it('re-rolls 1939/1940 and France/Britain', () => {
    let rerolledYear = false;
    let rerolledNation = false;
    for (let seed = 0; seed < 300 && !(rerolledYear && rerolledNation); seed++) {
      const d = generate(seed);
      rerolledYear ||= d.log.filter((l) => l.step === 'year').length > 1;
      rerolledNation ||= d.log.filter((l) => l.step === 'allied').length > 1;
    }
    expect(rerolledYear).toBe(true);
    expect(rerolledNation).toBe(true);
  });
});

describe('fixed options', () => {
  it('are respected (map, Axis edge, year, Allied nation, qualities, postures)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const fixed: RsgFixed = { map: '9', axisEdge: 'left', year: 1944, allied: 'American', quality: { axis: 'green', allied: 'elite' } };
      const d = generate(seed, { humanSide: 'allied', fixed });
      const scn = rsgFinish(d);
      expect(scn).toMatchObject({ map: '9', year: 1944 });
      expect(scn.sides.axis.edge).toBe('left');
      expect(scn.sides.allied.edge).toBe('right');
      expect(scn.sides.allied.nation).toBe('American');
      expect(scn.sides.axis.quality).toBe('green');
      expect(scn.sides.allied.quality).toBe('elite');
      expect(d.log.some((l) => l.step === 'mapPick' || l.step === 'mapEdgeDie' || l.step === 'year' || l.step === 'allied')).toBe(false);
      checkScenario(scn);
    }
    for (const defender of ['axis', 'allied', null] as const) {
      const scn = rsgFinish(generate(7, { fixed: { defender } }));
      if (defender === null) expect([scn.sides.axis.posture, scn.sides.allied.posture]).toEqual(['recon', 'recon']);
      else expect(scn.sides[defender].posture).toBe('defend');
    }
  });

  it('a fixed Allied nation or quality re-rolls years it cannot have', () => {
    for (let seed = 0; seed < 100; seed++) {
      expect(rsgFinish(generate(seed, { fixed: { allied: 'American' } })).year).toBeGreaterThanOrEqual(1943);
      expect(rsgFinish(generate(seed, { fixed: { allied: 'Russian', quality: { allied: 'green' } } })).year).toBeLessThanOrEqual(1944);
    }
  });

  it('refuses impossible fixes', () => {
    expect(() => newRsgDraft({ seed: 1, fixed: { year: 1940 } })).toThrow();
    expect(() => newRsgDraft({ seed: 1, fixed: { year: 1942, allied: 'American' } })).toThrow();
    expect(() => newRsgDraft({ seed: 1, fixed: { allied: 'German' } })).toThrow();
    expect(() => newRsgDraft({ seed: 1, fixed: { map: '13' } })).toThrow();
    expect(() => newRsgDraft({ seed: 1, fixed: { year: 1945, allied: 'Russian', quality: { allied: 'green' } } })).toThrow();
  });
});

describe('RS.3 troop quality and RS.4 Objectives', () => {
  it('rolls quality on the nation table for the year', () => {
    for (let seed = 0; seed < 50; seed++) {
      const d = generate(seed);
      for (const side of SIDES) {
        const l = d.log.find((x) => x.step === 'quality' && x.side === side)!;
        const nation = side === 'axis' ? 'German' : d.allied!;
        expect(d.quality[side]).toBe(RSG.troopQuality[nation][l.dice![0] + l.dice![1]][d.year!]);
      }
    }
  });

  it('draws one open chit and one secret chit per side; R, V, W and X go open', () => {
    let wentOpen = 0;
    for (let seed = 0; seed < 400; seed++) {
      const scn = rsgFinish(generate(seed));
      const secret = SIDES.map((s) => scn.sides[s].secretChits.length);
      expect(scn.openChits.length + secret[0] + secret[1]).toBe(3);
      expect(OBJECTIVE_CHITS[scn.openChits[0]]).toBeDefined();
      for (const c of scn.openChits.slice(1)) expect(OBJECTIVE_CHITS[c].secret).toBe(false);
      if (scn.openChits.length > 1) wentOpen++;
    }
    expect(wentOpen).toBeGreaterThan(0);
  });
});

describe('RS.5 Order of Battle', () => {
  it('offers the OBs of the nation, year and quality, every size, with what the UI shows', () => {
    let e = newRsgDraft({ seed: 11, humanSide: 'axis', fixed: { map: '3', axisEdge: 'top', year: 1943, allied: 'Russian', quality: { axis: 'elite', allied: 'line' } } });
    e = toChoice(e);
    const st = rsgStep(e) as RsgChoiceStep;
    expect(st).toMatchObject({ what: 'ob', side: 'axis' });
    if (st.what !== 'ob') throw new Error();
    // German elite 1943: Pionier, SS, Elite Rifle, Fallschirmjager, Sturm
    expect([...new Set(st.options.map((o) => o.letter))].sort()).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(st.options).toHaveLength(15);
    const c = st.options.find((o) => o.letter === 'B' && o.size === 'company')!;
    expect(c).toMatchObject({ points: 40, orders: 4, surrender: 12, initiative: 11, leaders: 3, quality: 'elite' });
    expect(c.units['German/SS Squad']).toBe(9);
    expect(rsgCheck(e, { what: 'ob', letter: 'F', size: 'company' })).toMatch(/OB/);
    expect(rsgCheck(e, { what: 'ob', letter: 'B', size: 'company' })).toBeNull();
    expect(() => rsgChoose(e, { what: 'mapPick', map: '1' })).toThrow();
  });

  it('adds the year-dependent pieces (German Rifle Company mortars)', () => {
    for (const [year, mortar] of [[1942, 'German/Light Mortar'], [1945, 'German/Medium Mortar']] as const) {
      const scn = rsgFinish(generate(5, { fixed: { year, quality: { axis: 'line' } } }, (st) => (st.what === 'ob' && st.side === 'axis' ? { what: 'ob', letter: 'F', size: 'company' } : undefined)));
      expect(scn.sides.axis.forces[mortar]).toBe(year === 1942 ? 3 : 2);
      expect(scn.sides.axis.forces['German/Rifle Squad']).toBeGreaterThanOrEqual(9);
    }
  });

  it('starts the VP marker at the OB point difference, then moves it by every purchase', () => {
    for (let seed = 0; seed < 200; seed++) {
      const d = generate(seed);
      const pts = (s: Side) => {
        const nation = s === 'axis' ? 'German' : d.allied!;
        const p = d.ob[s]!;
        return RSG.obs[nation][p.letter].sizes[p.size].points;
      };
      const l = d.log.find((x) => x.step === 'obPoints')!;
      expect(l.vp).toBe(pts('allied') - pts('axis'));
      let vp = pts('allied') - pts('axis');
      for (const r of d.support) vp -= (r.side === 'axis' ? 1 : -1) * r.cost;
      expect(d.log.find((x) => x.step === 'posture')!.vp).toBe(vp);
      const def = SIDES.find((s) => d.postures![s] === 'defend');
      if (def) {
        const forts = d.fortifications.reduce((n, id) => n + RSG.fortifications.find((f) => f.id === id)!.vp, 0);
        vp -= (def === 'axis' ? 1 : -1) * forts;
        let chits = 0;
        for (const c of d.openChits) for (let n = 1; n <= 5; n++) chits += OBJECTIVE_CHITS[c].objective === 'all' || OBJECTIVE_CHITS[c].objective === n ? OBJECTIVE_CHITS[c].vp : 0;
        vp += (def === 'axis' ? 1 : -1) * chits;
        if (d.asset?.radio) vp += (def === 'axis' ? 1 : -1) * d.asset.cost;
      }
      expect(rsgFinish(d).vp).toBe(vp);
      expect(d.vp).toBe(vp);
    }
  });
});

describe('RS.6 Leaders', () => {
  it('reads the white die with the quality and nation/year modifiers', () => {
    expect(rsgLeaderIndex('German', 1945, 'green', 1)).toBe(0); // 1 - 1 - 1
    expect(rsgLeaderIndex('German', 1943, 'elite', 6)).toBe(7); // 6 + 1 + 1
    expect(rsgLeaderIndex('Russian', 1941, 'green', 3)).toBe(1); // 3 - 1 - 1
    expect(rsgLeaderIndex('American', 1944, 'line', 4)).toBe(4);
    expect(rsgLeaderIndex('American', 1943, 'line', 1)).toBe(0);
  });

  it('gives each OB its number of unique Leaders from its Leader Table', () => {
    for (let seed = 0; seed < 200; seed++) {
      const d = generate(seed);
      for (const side of SIDES) {
        const nation = side === 'axis' ? 'German' : d.allied!;
        const p = d.ob[side]!;
        const n = RSG.obs[nation][p.letter].sizes[p.size].leaders;
        expect(d.leaders[side]).toHaveLength(n);
        expect(new Set(d.leaders[side]).size).toBe(n);
        for (const l of d.leaders[side]) expect(RSG.leaderTable[nation]).toContain(l);
      }
    }
  });
});

describe('RS.7 Support', () => {
  it('the cheaper OB rolls and buys (no Radios, in the year); the other side only if the marker crossed 0', () => {
    let second = 0;
    for (let seed = 0; seed < 300; seed++) {
      const d = generate(seed);
      const first = d.log.find((x) => x.step === 'obPoints')!.vp!;
      if (first === 0) {
        expect(d.support).toHaveLength(0);
        continue;
      }
      expect(d.support[0].side).toBe(first > 0 ? 'axis' : 'allied');
      for (const r of d.support) {
        const nation = r.side === 'axis' ? 'German' : d.allied!;
        const col = RSG.support[nation].columns[r.roll[0] + r.roll[1]];
        for (const b of r.bought) {
          const item = RSG.support[nation].items[b.item];
          expect(item.kind).not.toBe('radio');
          expect(col.some((e) => e.item === b.item && e.years[0] <= d.year! && d.year! <= e.years[1])).toBe(true);
        }
      }
      const afterFirst = first - (d.support[0].side === 'axis' ? 1 : -1) * d.support[0].cost;
      const crossed = lead(afterFirst, d.support[0].side) < 0;
      expect(d.support.length).toBe(crossed ? 2 : 1);
      if (crossed) {
        second++;
        expect(d.support[1].side).not.toBe(d.support[0].side);
      }
    }
    expect(second).toBeGreaterThan(0);
  });

  it('must buy at least one item, may go on only while the marker stays on his side, Leaders once', () => {
    let tested = false;
    for (let seed = 0; seed < 200 && !tested; seed++) {
      let e = newRsgDraft({ seed, humanSide: 'axis' });
      // play to the first supportBuy with rsgAuto for everything else
      const rnd = mulberry32(seed);
      for (;;) {
        const st = rsgStep(e);
        if (st.kind === 'done') break;
        if (st.kind === 'auto') {
          e = rsgAdvance(e);
          continue;
        }
        if (st.what !== 'supportBuy') {
          e = rsgChoose(e, rsgAuto(e, st.side, rnd));
          continue;
        }
        if (st.options.length < 2 || st.lead < 2) break;
        expect(rsgCheck(e, { what: 'supportBuy', buy: [] })).not.toBeNull();
        const cheap = [...st.options].filter((o) => !o.once).sort((a, b) => a.vp - b.vp)[0];
        if (!cheap) break;
        expect(rsgCheck(e, { what: 'supportBuy', buy: [cheap.id] })).toBeNull();
        // the marker must still be on his side before every purchase but the last
        const many = Array(st.lead + 1).fill(cheap.id);
        expect(rsgCheck(e, { what: 'supportBuy', buy: many })).toMatch(/side/);
        const leader = st.options.find((o) => o.once);
        if (leader) expect(rsgCheck(e, { what: 'supportBuy', buy: [leader.id, leader.id] })).toMatch(/once/);
        expect(rsgCheck(e, { what: 'supportBuy', buy: ['nonsense'] })).not.toBeNull();
        expect(st.min).toBe(1);
        tested = true;
        break;
      }
    }
    expect(tested).toBe(true);
  });

  it('a Weapon bought with a unit starts with it (special.carried)', () => {
    let found = false;
    for (let seed = 0; seed < 300 && !found; seed++) {
      const d = generate(seed);
      const pairs = d.support.flatMap((r) => r.bought.filter((b) => b.carrier).map((b) => ({ side: r.side, unit: b.carrier!, weapon: b.weapon! })));
      if (!pairs.length) continue;
      found = true;
      const scn = rsgFinish(d);
      for (const p of pairs) {
        expect(scn.special.carried?.[p.side]).toContainEqual({ unit: p.unit, weapon: p.weapon });
        expect(COUNTERS[p.weapon].kind).toBe('weapon');
      }
    }
    expect(found).toBe(true);
  });
});

describe('RS.8 posture, RS.9 fortifications, RS.11.1 asset request', () => {
  it('the side with the VP marker on his side defends; 0 is Recon v Recon', () => {
    for (let seed = 0; seed < 200; seed++) {
      const d = generate(seed);
      const vp = d.log.find((x) => x.step === 'posture')!.vp!;
      const scn = rsgFinish(d);
      if (vp === 0) expect([scn.sides.axis.posture, scn.sides.allied.posture]).toEqual(['recon', 'recon']);
      else {
        const def: Side = vp > 0 ? 'axis' : 'allied';
        expect(scn.sides[def].posture).toBe('defend');
        expect(scn.sides[def === 'axis' ? 'allied' : 'axis'].posture).toBe('attack');
      }
    }
  });

  it('equal OB points make Recon v Recon: no support, no fortifications, set-up by Initiative', () => {
    const pick = (st: RsgChoiceStep): RsgChoice | undefined => {
      if (st.what === 'ob') return st.side === 'axis' ? { what: 'ob', letter: 'F', size: 'platoon' } : { what: 'ob', letter: 'W', size: 'platoon' };
      return undefined;
    };
    const d = generate(3, { fixed: { year: 1944, allied: 'American', quality: { axis: 'line', allied: 'line' }, map: '2', axisEdge: 'top' } }, pick);
    const scn = rsgFinish(d);
    expect(d.support).toHaveLength(0);
    expect([scn.sides.axis.posture, scn.sides.allied.posture]).toEqual(['recon', 'recon']);
    expect(scn.sides.axis.setupArea).toEqual({ kind: 'depth', depth: 4 });
    expect(scn.sides.allied.setupArea).toEqual({ kind: 'depth', depth: 4 });
    expect(scn.control).toEqual([null, null, null, null, null]);
    expect(scn.sides.axis.fortifications).toEqual({});
    // F Plt Initiative 9, W Plt 4
    expect(scn.initiative).toBe('axis');
    expect(scn.setupFirst).toBe('axis');
    expect(scn.special.controlAfterSetup).toBe(true);
  });

  it('the Defender spends up to his VP on Fortification OBs, one Minefield strength only', () => {
    let tested = false;
    for (let seed = 0; seed < 300 && !tested; seed++) {
      let d = newRsgDraft({ seed, humanSide: 'axis' });
      const rnd = mulberry32(seed ^ 0x5eed); // as generate(), so it can replay the same path below
      for (;;) {
        const st = rsgStep(d);
        if (st.kind === 'done') break;
        if (st.kind === 'auto') {
          d = rsgAdvance(d);
          continue;
        }
        if (st.what !== 'fortifications') {
          d = rsgChoose(d, rsgAuto(d, st.side, rnd));
          continue;
        }
        expect(st.side).toBe(SIDES.find((s) => d.postures![s] === 'defend'));
        expect(st.budget).toBe(lead(d.vp, st.side));
        if (st.budget < 13) break;
        expect(st.options.map((o) => o.id)).toEqual(RSG.fortifications.map((f) => f.id));
        expect(rsgCheck(d, { what: 'fortifications', buy: [] })).toBeNull();
        expect(rsgCheck(d, { what: 'fortifications', buy: ['hasty_minefield', 'prepared_minefield'] })).toMatch(/strength/);
        expect(rsgCheck(d, { what: 'fortifications', buy: ['bunker_complex', 'hasty_minefield'] })).toMatch(/strength/);
        expect(rsgCheck(d, { what: 'fortifications', buy: Array(st.budget + 1).fill('entrenchments') })).toMatch(/VP/);
        const vp = d.vp;
        d = rsgChoose(d, { what: 'fortifications', buy: ['extensive_minefield', 'entrenchments'] });
        expect(lead(d.vp, st.side)).toBe(lead(vp, st.side) - 13);
        d = generate(seed, { humanSide: 'axis' }, (s) => (s.what === 'fortifications' ? { what: 'fortifications', buy: ['extensive_minefield', 'entrenchments'] } : undefined));
        const scn = rsgFinish(d);
        expect(scn.sides[st.side].fortifications).toEqual({ mines: 10, foxholes: 3 });
        expect(scn.sides[st.side].minefield).toBe(8);
        expect(scn.special.fortificationsLast).toBe(true);
        tested = true;
        break;
      }
    }
    expect(tested).toBe(true);
  });

  it('the Attacker may request a Radio: bought only if the column has one for the year, paid toward the Defender', () => {
    let bought = 0;
    let none = 0;
    for (let seed = 0; seed < 200; seed++) {
      const d = generate(seed, {}, (st) => (st.what === 'assetRequest' ? { what: 'assetRequest', request: true } : undefined));
      const att = SIDES.find((s) => d.postures![s] === 'attack');
      if (!att) {
        expect(d.asset).toBeNull();
        continue;
      }
      const a = d.asset!;
      expect(a.requested).toBe(true);
      const nation = att === 'axis' ? 'German' : d.allied!;
      const col = RSG.support[nation].columns[a.roll![0] + a.roll![1]];
      const radio = col.find((e) => RSG.support[nation].items[e.item].kind === 'radio' && e.years[0] <= d.year! && d.year! <= e.years[1]);
      const scn = rsgFinish(d);
      if (radio) {
        bought++;
        const id = Object.keys(RSG.support[nation].items[radio.item].pieces)[0];
        expect(a.radio).toBe(id);
        expect(a.cost).toBe(radio.vp);
        expect(scn.sides[att].forces[id]).toBe(1);
        expect(COUNTERS[id].kind).toBe('radio');
      } else {
        none++;
        expect(a.radio).toBeNull();
      }
    }
    expect(bought).toBeGreaterThan(0);
    expect(none).toBeGreaterThan(0);
  });
});

describe('RS.10-RS.16 set-up, markers, cards, H-Hour', () => {
  it('sets areas by posture and orientation, the Defender first, control and chits for the Defender', () => {
    for (let seed = 0; seed < 200; seed++) {
      const d = generate(seed);
      const scn = rsgFinish(d);
      const wide = scn.sides.axis.edge === 'top' || scn.sides.axis.edge === 'bottom';
      const role = { defend: 'defender', attack: 'attacker', recon: 'recon' } as const;
      for (const side of SIDES) {
        const s = scn.sides[side];
        expect(s.setupArea).toEqual({ kind: 'depth', depth: RSG.setupDepth[role[s.posture]][wide ? 'wide' : 'narrow'] });
      }
      const def = SIDES.find((s) => scn.sides[s].posture === 'defend');
      if (def) {
        expect(scn.setupFirst).toBe(def);
        expect(scn.control).toEqual([def, def, def, def, def]);
      } else expect(scn.setupFirst).toBe(scn.initiative);
    }
  });

  it('gives the Initiative and the first Turn to the higher OB Initiative number', () => {
    for (let seed = 0; seed < 300; seed++) {
      const d = generate(seed);
      const ini = (s: Side) => {
        const nation = s === 'axis' ? 'German' : d.allied!;
        return RSG.obs[nation][d.ob[s]!.letter].sizes[d.ob[s]!.size].initiative;
      };
      const scn = rsgFinish(d);
      expect(scn.initiative).toBe(ini('axis') > ini('allied') ? 'axis' : 'allied');
      expect(scn.firstTurn).toBe(scn.initiative);
    }
  });

  it('never ties: German OB Initiative numbers are odd, American and Russian even (so R-50 never comes up)', () => {
    const parity = (n: Nation) => Object.values(RSG.obs[n]).flatMap((ob) => Object.values(ob.sizes).map((s) => Math.abs(s.initiative) % 2));
    expect(new Set(parity('German'))).toEqual(new Set([1]));
    expect(new Set([...parity('American'), ...parity('Russian')])).toEqual(new Set([0]));
  });

  it('sets Orders, Surrender, Sudden Death and hand sizes from the OBs and postures', () => {
    for (let seed = 0; seed < 100; seed++) {
      const d = generate(seed);
      const scn = rsgFinish(d);
      for (const side of SIDES) {
        const nation = side === 'axis' ? 'German' : d.allied!;
        const size = RSG.obs[nation][d.ob[side]!.letter].sizes[d.ob[side]!.size];
        expect(scn.sides[side]).toMatchObject({ orders: size.orders, surrender: size.surrender, quality: d.quality[side] });
      }
      expect(scn.suddenDeath).toBe(scn.sides.axis.orders + scn.sides.allied.orders);
    }
  });
});

describe('rsgAuto', () => {
  it('makes a legal choice at every step for either side', () => {
    for (let seed = 0; seed < 100; seed++) {
      let d = newRsgDraft({ seed });
      const rnd = mulberry32(seed);
      for (;;) {
        const st = rsgStep(d);
        if (st.kind === 'done') break;
        if (st.kind === 'auto') {
          d = rsgAdvance(d);
          continue;
        }
        const c = rsgAuto(d, st.side, rnd);
        expect(c.what).toBe(st.what);
        expect(rsgCheck(d, c)).toBeNull();
        d = rsgChoose(d, c);
      }
    }
  });

  it('rsgAutoRun stops at a choice for a side it does not play', () => {
    const d = rsgAutoRun(newRsgDraft({ seed: 4, humanSide: 'allied' }), mulberry32(4), ['axis']);
    const st = rsgStep(d);
    expect(st.kind).toBe('choice');
    if (st.kind === 'choice') expect(st.side).toBe('allied');
    const done = rsgAutoRun(d, mulberry32(4));
    expect(rsgStep(done).kind).toBe('done');
    expect(() => rsgAuto(done, 'axis', mulberry32(1))).toThrow();
  });

  it('a full auto run takes under 50 ms', () => {
    rsgFinish(rsgAutoRun(newRsgDraft({ seed: 0 }), mulberry32(0)));
    let worst = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const t = performance.now();
      rsgFinish(rsgAutoRun(newRsgDraft({ seed }), mulberry32(seed)));
      worst = Math.max(worst, performance.now() - t);
    }
    expect(worst).toBeLessThan(50);
  });
});

describe('the engine takes an RSG scenario', () => {
  it('sets up every generated scenario to the first Turn', () => {
    for (let seed = 0; seed < 25; seed++) {
      const scn = rsgFinish(generate(seed));
      const s = newGame(scn, seed);
      const r = run(s, (ctx) => gameFlow(s, ctx), passive);
      expect(s.phase, `seed ${seed}`).toBe('play');
      expect(r.pending).toMatchObject({ kind: 'turn', side: scn.firstTurn });
      for (const side of SIDES) {
        const units = Object.entries(scn.sides[side].forces)
          .filter(([t]) => ['squad', 'team', 'leader'].includes(COUNTERS[t].kind))
          .reduce((n, [, k]) => n + k, 0);
        expect(unitsOf(s, side)).toHaveLength(units);
        expect(s.players[side].hand).toHaveLength(scn.sides[side].handSize);
      }
      const q: Quality[] = ['elite', 'line', 'green'];
      expect(q).toContain(s.players.axis.quality);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Support purchases: counter-mix limits (project ruling) and rsgAuto's buying

type BuyStep = Extract<RsgChoiceStep, { what: 'supportBuy' }>;

/** Every supportBuy step met while rsgAuto plays both sides from `seed` (as generate does), with rsgAuto's purchase. */
function supportSteps(seed: number, humanSide?: Side): { d: RsgDraft; st: BuyStep; buy: string[] }[] {
  const rnd = mulberry32(seed ^ 0x5eed);
  let d = newRsgDraft({ seed, ...(humanSide ? { humanSide } : {}) });
  const out: { d: RsgDraft; st: BuyStep; buy: string[] }[] = [];
  for (let i = 0; i < 200; i++) {
    const st = rsgStep(d);
    if (st.kind === 'done') return out;
    if (st.kind === 'auto') {
      d = rsgAdvance(d);
      continue;
    }
    const c = rsgAuto(d, st.side, rnd);
    if (st.what === 'supportBuy' && c.what === 'supportBuy') out.push({ d, st, buy: c.buy });
    d = rsgChoose(d, c);
  }
  throw new Error('no end');
}

const ALL_SUPPORT = Array.from({ length: 400 }, (_, seed) => supportSteps(seed, seed % 2 ? 'axis' : 'allied')).flat();
const copies = (buy: string[]) => buy.reduce<Record<string, number>>((m, id) => ({ ...m, [id]: (m[id] ?? 0) + 1 }), {});

/** What `side` has before buying: its OB's pieces and its Leaders. */
function owned(d: RsgDraft, side: Side): Record<string, number> {
  const nation = side === 'axis' ? 'German' : d.allied!;
  const o = rsgObOptions(nation, d.year!, d.quality[side]!).find((x) => x.letter === d.ob[side]!.letter && x.size === d.ob[side]!.size)!;
  const m: Record<string, number> = { ...o.units };
  for (const l of d.leaders[side]) m[l] = 1;
  return m;
}

const leftOf = (o: RsgSupportOption, have: Record<string, number>) =>
  Math.min(...Object.entries(o.pieces).map(([t, n]) => Math.floor((rsgCounterCap(t) - (have[t] ?? 0)) / n)));

describe('counter-mix limits (project ruling)', () => {
  it("caps each type at the larger of the base scenarios' need (design/data/counters.json) and the largest OB; 1 for a Support-only piece", () => {
    const largestOb = (id: string) => {
      let m = 0;
      for (const ob of Object.values(RSG.obs[COUNTERS[id].nation])) {
        for (const s of Object.values(ob.sizes)) {
          const extra = Math.max(0, ...(s.unitsByYear ?? []).map((u) => u.units[id] ?? 0));
          m = Math.max(m, (s.units[id] ?? 0) + extra);
        }
      }
      return m;
    };
    const onSupport = (id: string) =>
      Object.values(RSG.support[COUNTERS[id].nation].items).some((it) => id in it.pieces || (it.oneOf ?? []).includes(id));
    let checked = 0;
    for (const [nation, groups] of Object.entries(designCounters.nations)) {
      for (const group of ['squads', 'teams', 'weapons'] as const) {
        for (const c of (groups as Record<string, { name: string; max_needed_in_base_scenarios?: number | null }[]>)[group]) {
          const id = `${nation}/${c.name}`;
          if (!COUNTERS[id]) continue; // Molotov Cocktail, Panzerfaust: not in src/data
          expect(rsgCounterCap(id), id).toBe(Math.max(c.max_needed_in_base_scenarios ?? 0, largestOb(id), onSupport(id) ? 1 : 0));
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(60);
    expect(rsgCounterCap('Russian/SMG Squad')).toBe(15);
    expect(rsgCounterCap('German/Volksgrenadier Squad')).toBe(9); // a scenario needs more than any OB has
    expect(rsgCounterCap('German/Weapon Team')).toBe(3);
    expect(rsgCounterCap('German/IG 33 Gun')).toBe(1);
    expect(rsgCounterCap('German/Lt Borbe')).toBe(1);
  });

  it('offers only what the mix still has, counting the OB, and refuses one more', () => {
    let refused = 0;
    let hidden = 0;
    for (const { d, st } of ALL_SUPPORT) {
      const have = owned(d, st.side);
      for (const o of st.options) {
        expect(o.left, o.id).toBe(o.once ? 1 : leftOf(o, have));
        expect(o.left).toBeGreaterThanOrEqual(1);
        if (!o.once && o.left < 8) {
          expect(rsgCheck(d, { what: 'supportBuy', buy: Array(o.left + 1).fill(o.id) })).toMatch(/counter mix/);
          refused++;
        }
      }
      // items of the column the mix has run out of are not offered
      const nation = st.side === 'axis' ? 'German' : d.allied!;
      for (const e of RSG.support[nation].columns[st.roll[0] + st.roll[1]]) {
        const item = RSG.support[nation].items[e.item];
        if (item.kind === 'radio' || item.kind.startsWith('leader') || e.years[0] > d.year! || d.year! > e.years[1]) continue;
        const left = Math.min(...Object.entries(item.pieces).map(([t, n]) => Math.floor((rsgCounterCap(t) - (have[t] ?? 0)) / n)));
        expect(st.options.some((o) => o.item === e.item), e.item).toBe(left >= 1);
        if (left < 1) hidden++;
      }
    }
    expect(refused).toBeGreaterThan(20);
    expect(hidden).toBeGreaterThan(0);
  });

  it('a Russian SMG Company already has all 15 SMG Squads', () => {
    let tested = false;
    for (let seed = 0; seed < 400 && !tested; seed++) {
      let d = newRsgDraft({ seed, humanSide: 'allied', fixed: { year: 1943, allied: 'Russian', quality: { axis: 'line', allied: 'line' } } });
      const rnd = mulberry32(seed);
      for (;;) {
        const st = rsgStep(d);
        if (st.kind === 'done') break;
        if (st.kind === 'auto') {
          d = rsgAdvance(d);
          continue;
        }
        if (st.what === 'ob') {
          d = rsgChoose(d, st.side === 'axis' ? { what: 'ob', letter: 'F', size: 'company' } : { what: 'ob', letter: 'V', size: 'company' });
          continue;
        }
        if (st.what !== 'supportBuy' || st.side !== 'allied') {
          d = rsgChoose(d, rsgAuto(d, st.side, rnd));
          continue;
        }
        const roll = st.roll[0] + st.roll[1];
        if (roll === 4 || roll === 5) {
          // SMG Squad is on columns 4 (1943-45) and 5 (1942-44)
          expect(st.options.some((o) => o.item === 'smg_squad')).toBe(false);
          expect(rsgCheck(d, { what: 'supportBuy', buy: ['smg_squad'] })).not.toBeNull();
          tested = true;
        }
        break;
      }
    }
    expect(tested).toBe(true);
  });

  it('no finished scenario has more of a type than the mix', () => {
    for (let seed = 0; seed < 300; seed++) {
      const scn = rsgFinish(generate(seed));
      for (const side of SIDES) for (const [t, n] of Object.entries(scn.sides[side].forces)) expect(n, t).toBeLessThanOrEqual(rsgCounterCap(t));
    }
  });
});

describe('rsgAuto Support purchases', () => {
  it('buys at most 3 of any item and at most 6 items, and keeps the lead unless its one purchase must cross', () => {
    for (const { st, buy } of ALL_SUPPORT) {
      for (const n of Object.values(copies(buy))) expect(n).toBeLessThanOrEqual(3);
      expect(buy.length).toBeGreaterThanOrEqual(st.options.length ? 1 : 0);
      expect(buy.length).toBeLessThanOrEqual(6);
      const cost = buy.reduce((n, id) => n + st.options.find((o) => o.id === id)!.vp, 0);
      if (buy.length > 1) expect(cost).toBeLessThan(st.lead);
    }
  });

  it('the reported case: seed 4 no longer buys 15 SMG Squads', () => {
    for (const humanSide of SIDES) {
      const d = rsgAutoRun(newRsgDraft({ seed: 4, humanSide }), mulberry32(4));
      for (const r of d.support) for (const n of Object.values(copies(r.bought.map((b) => b.id)))) expect(n).toBeLessThanOrEqual(3);
    }
  });

  it('builds a varied force: several purchases are of more than one kind', () => {
    const several = ALL_SUPPORT.filter(({ st, buy }) => buy.length >= 3 && new Set(st.options.map((o) => o.item)).size >= 3);
    expect(several.length).toBeGreaterThan(20);
    const varied = several.filter(({ buy }) => new Set(buy).size >= 2);
    expect(varied.length / several.length).toBeGreaterThan(0.9);
  });

  it('stops when the next purchase adds little: a handful of items, not the whole lead', () => {
    const rounds = ALL_SUPPORT.filter(({ st }) => st.options.length);
    const items = rounds.reduce((n, r) => n + r.buy.length, 0) / rounds.length;
    expect(items).toBeGreaterThan(1.3);
    expect(items).toBeLessThan(2.5);
    const spent = rounds.map(({ st, buy }) => buy.reduce((n, id) => n + st.options.find((o) => o.id === id)!.vp, 0) / st.lead);
    expect(spent.filter((f) => f <= 0.75).length / spent.length).toBeGreaterThan(0.8);
  });

  it('prefers Leaders unless already over-led, and MG teams as the likely Defender', () => {
    const PER: Record<Nation, number> = { German: 3, American: 4, Russian: 5 };
    let leaderCases = 0;
    let leaderBought = 0;
    let mgCases = 0;
    let mgBought = 0;
    for (const { d, st, buy } of ALL_SUPPORT) {
      const nation = st.side === 'axis' ? 'German' : d.allied!;
      const have = owned(d, st.side);
      const squads = Object.entries(have).reduce((n, [t, k]) => n + (COUNTERS[t].kind === 'squad' ? k : 0), 0);
      const mgs = Object.entries(have).reduce((n, [t, k]) => n + (COUNTERS[t].weaponClass === 'mg' ? k : 0), 0);
      const bought = (pred: (o: RsgSupportOption) => boolean) => buy.some((id) => pred(st.options.find((o) => o.id === id)!));
      const isLeader = (o: RsgSupportOption) => o.kind === 'leader' || o.kind === 'leaderEither';
      const isMg = (o: RsgSupportOption) => !!o.weapon && COUNTERS[o.weapon].weaponClass === 'mg';
      const affordable = (pred: (o: RsgSupportOption) => boolean) => st.options.some((o) => pred(o) && o.vp * 2 <= st.lead);
      if (d.fixed.defender === undefined && affordable(isLeader) && d.leaders[st.side].length * PER[nation] <= squads) {
        leaderCases++;
        if (bought(isLeader)) leaderBought++;
      }
      if (d.fixed.defender === undefined && affordable(isMg) && mgs * 3 < squads) {
        mgCases++;
        if (bought(isMg)) mgBought++;
      }
    }
    expect(leaderCases).toBeGreaterThan(20);
    expect(mgCases).toBeGreaterThan(10);
    expect(leaderBought / leaderCases).toBeGreaterThan(0.6);
    expect(mgBought / mgCases).toBeGreaterThan(0.5);
  });
});

describe('narration', () => {
  const logs = Array.from({ length: 150 }, (_, seed) => generate(seed, {}, (st) => (st.what === 'assetRequest' ? { what: 'assetRequest', request: seed % 2 === 0 } : undefined)).log).flat();

  it('groups copies ("2 × SMG Squad") and never lists one item twice', () => {
    let grouped = 0;
    for (let seed = 0; seed < 150; seed++) {
      const d = generate(seed);
      for (const r of d.support) {
        const text = d.log.find((l) => l.step === 'supportBuy' && l.side === r.side)!.text;
        for (const [id, n] of Object.entries(copies(r.bought.map((b) => b.id)))) {
          const label = r.bought.find((b) => b.id === id)!.label;
          if (n > 1) {
            expect(text).toContain(`${n} × ${label}`);
            grouped++;
          } else expect(text.split(label).length - 1).toBe(1);
        }
      }
    }
    expect(grouped).toBeGreaterThan(0);
  });

  it('reads well: Asset Requests, capitalised troop quality, British spelling, whole sentences', () => {
    const asset = logs.filter((l) => l.step === 'assetRequest').map((l) => l.text);
    expect(asset.some((t) => / makes an Asset Request\.$/.test(t))).toBe(true);
    expect(asset.some((t) => / makes no Asset Request\.$/.test(t))).toBe(true);
    for (const l of logs.filter((x) => x.step === 'quality')) expect(l.text).toMatch(/: (Elite|Line|Green)\.$/);
    for (const l of logs) {
      expect(l.text, l.text).toMatch(/^[A-Z].*[.]$/);
      expect(l.text).not.toMatch(/ {2}|\btoward\b|\bcolor|\b(Axis|Allies) (roll|pick|draw|buy|use|take|control)s?\b|undefined|null|NaN/);
    }
  });
});
