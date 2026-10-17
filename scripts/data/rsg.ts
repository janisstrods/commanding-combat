// design/data/rsg.json → src/data/rsg.json in the RsgTables shape (src/engine/rsgTypes.ts): counter names become
// counter type ids, ranges of rolls are expanded, Mediterranean nations are dropped.
import type { CounterType, Edge, FortKind, Nation, Quality } from '../../src/engine/types';
import type { ObSize, RsgFortificationOb, RsgOb, RsgSupportItem, RsgSupportTable, RsgTables } from '../../src/engine/rsgTypes';
import { NATIONS } from './names';

const SIZES: Record<string, ObSize> = { Coy: 'company', Det: 'detachment', Plt: 'platoon' };
const KIND: Record<string, RsgSupportItem['kind']> = {
  leader: 'leader',
  leader_either: 'leaderEither',
  unit_with_weapon: 'unitWithWeapon',
  squad: 'squad',
  radio: 'radio',
};
const FORT: Record<string, FortKind> = { Foxholes: 'foxholes', Trench: 'trench', Bunker: 'bunker', Wire: 'wire', Minefield: 'mines', Pillbox: 'pillbox' };
const LEADER_CLASS: Record<string, string> = {
  Captain: 'Captain',
  'Lieutenant [2-Cd]': 'Lieutenant Cmd 2',
  'Lieutenant [1-Cd]': 'Lieutenant Cmd 1',
  'Sergeant [2-Cd]': 'Sergeant Cmd 2',
  'Sergeant [1-Cd]': 'Sergeant Cmd 1',
  'Corporal [7-Mr]': 'Corporal Morale 7',
  'Corporal [6-Mr]': 'Corporal Morale 6',
  Private: 'Private',
  Hero: 'Hero',
};

/** "2-4" → [2, 3, 4]; "1939-41" → [1939, 1940, 1941]; "5" → [5]. */
function expand(key: string): number[] {
  const m = /^(\d+)(?:-(\d+))?$/.exec(key);
  if (!m) throw new Error(`Bad range ${key}`);
  const a = Number(m[1]);
  let b = m[2] ? Number(m[2]) : a;
  if (b < a) b = Math.floor(a / 100) * 100 + b; // "1939-41"
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

export function buildRsg(src: any, counters: CounterType[]) {
  const counterIds = new Set(counters.map((c) => c.id));
  const id = (nation: Nation, name: string) => {
    const c = `${nation}/${name}`;
    if (!counterIds.has(c)) throw new Error(`RSG: no counter ${c}`);
    return c;
  };
  const pt = src.procedure_tables;

  const edgeByDie: Record<number, Edge> = {};
  for (const [die, edge] of Object.entries<string>(pt.rs1_battlefield.friendly_edge_by_die)) edgeByDie[Number(die)] = edge as Edge;

  const germanYear: Record<number, number> = {};
  for (const [roll, v] of Object.entries<any>(pt.rs2_1_year_roll)) germanYear[Number(roll)] = v.German;

  const alliedNation: Record<number, Record<number, Nation | null>> = {};
  for (const [roll, byYear] of Object.entries<any>(pt.rs2_2_allied_nationality_vs_german.rows)) {
    alliedNation[Number(roll)] = Object.fromEntries(
      Object.entries<string>(byYear).map(([y, n]) => [Number(y), (NATIONS as string[]).includes(n) ? (n as Nation) : null]),
    );
  }

  const troopQuality = {} as RsgTables['troopQuality'];
  for (const nation of NATIONS) {
    const out: Record<number, Record<number, Quality>> = {};
    for (const [rolls, byYears] of Object.entries<any>(pt.rs3_troop_quality[nation])) {
      for (const roll of expand(rolls)) {
        const row: Record<number, Quality> = (out[roll] ??= {});
        for (const [years, q] of Object.entries<string>(byYears)) for (const y of expand(years)) row[y] = q.toLowerCase() as Quality;
      }
    }
    troopQuality[nation] = out;
  }

  const obs = {} as RsgTables['obs'];
  for (const nation of NATIONS) {
    const table: Record<string, RsgOb> = {};
    for (const [letter, o] of Object.entries<any>(src.order_of_battle[nation].obs)) {
      const sizes = {} as RsgOb['sizes'];
      for (const [sz, s] of Object.entries<any>(o.sizes)) {
        const units: Record<string, number> = {};
        for (const group of ['squads', 'teams', 'weapons']) for (const [name, n] of Object.entries<number>(s[group] ?? {})) units[id(nation, name)] = n;
        const size: RsgOb['sizes'][ObSize] = {
          chit: s.chit,
          label: s.label,
          points: s.point_value,
          initiative: s.initiative,
          orders: s.orders,
          surrender: s.surrender_level,
          leaders: s.leaders,
          units,
        };
        if (s.weapons_by_year) {
          size.unitsByYear = s.weapons_by_year.map((w: any) => ({ years: w.years, units: { [id(nation, w.counter)]: w.count } }));
        }
        sizes[SIZES[sz]] = size;
      }
      table[letter] = { nation, letter, name: o.name, years: o.years, quality: o.quality.toLowerCase(), sizes };
    }
    obs[nation] = table;
  }

  const leaderTable = {} as RsgTables['leaderTable'];
  for (const nation of NATIONS) {
    const r = src.leader_table.results[nation];
    leaderTable[nation] = (src.leader_table.rows as string[]).map((row) => id(nation, r[row]));
  }
  const mods = src.leader_table.modifiers;
  const leaderModifiers: RsgTables['leaderModifiers'] = {
    quality: { elite: mods.quality.Elite, line: mods.quality.Line, green: mods.quality.Green },
    year: Object.fromEntries(
      NATIONS.map((n) => [n, Object.fromEntries(Object.entries<number | null>(mods.year[n]).map(([y, v]) => [Number(y), v]))]),
    ) as RsgTables['leaderModifiers']['year'],
  };

  const support = {} as RsgTables['support'];
  for (const nation of NATIONS) {
    const t = src.support_tables[nation];
    const items: Record<string, RsgSupportItem> = {};
    for (const [key, it] of Object.entries<any>(t.items)) {
      const kind = KIND[it.kind];
      if (!kind) throw new Error(`RSG: support kind ${it.kind}`);
      const item: RsgSupportItem = { id: key, label: it.chart_label, kind, pieces: {} };
      for (const u of it.units) {
        if (u.counter_one_of) item.oneOf = u.counter_one_of.map((c: string) => id(nation, c));
        else item.pieces[id(nation, u.counter)] = u.count;
      }
      if (it.weapon_carried_by) item.carrier = id(nation, it.weapon_carried_by);
      items[key] = item;
    }
    const columns: RsgSupportTable['columns'] = {};
    for (const [roll, entries] of Object.entries<any[]>(t.columns)) {
      columns[Number(roll)] = entries.map((e) => {
        if (!items[e.item]) throw new Error(`RSG: ${nation} support column ${roll}: no item ${e.item}`);
        return { item: e.item, vp: e.vp_cost, years: e.years };
      });
    }
    support[nation] = { items, columns };
  }

  const fortifications: RsgFortificationOb[] = src.fortification_obs.obs.map((o: any) => {
    const contents: Partial<Record<FortKind, number>> = {};
    for (const p of o.per_set) {
      const k = FORT[p.counter];
      if (!k) throw new Error(`RSG: fortification ${p.counter}`);
      contents[k] = (contents[k] ?? 0) + o.sets;
    }
    const f: RsgFortificationOb = { id: o.id, name: o.name, vp: o.vp_cost, contents };
    if (o.minefield_strength) f.minefield = o.minefield_strength;
    return f;
  });

  const d = pt.setup_depth_hexes;
  const pick = (x: any) => ({ wide: x.wide, narrow: x.narrow });
  const setupDepth: RsgTables['setupDepth'] = {
    defender: pick(d.rs10_defender),
    attacker: pick(d.rs11_2_attacker),
    fortifications: pick(d.rs12_fortifications),
    recon: pick(d.rs13_recon_each_side),
  };

  const pv = src.design_your_own_point_values.values;
  const pointValues = {} as RsgTables['pointValues'];
  const radioIdByFp = (nation: Nation, fp: number) =>
    counters.find((c) => c.nation === nation && c.kind === 'radio' && c.front.fp === fp)?.id;
  for (const nation of NATIONS) {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries<number | null>(pv[nation])) {
      if (v === null) continue;
      const radio = /^(\d+)-FP Radio$/.exec(k);
      if (LEADER_CLASS[k]) out[LEADER_CLASS[k]] = v;
      else if (radio) {
        const r = radioIdByFp(nation, Number(radio[1]));
        if (r) out[r] = v;
      } else if (counterIds.has(`${nation}/${k}`)) out[`${nation}/${k}`] = v;
      // else: a counter left out of the base game (Molotov Cocktail)
    }
    pointValues[nation] = out;
  }
  const fortPointValues: Record<string, number> = {};
  for (const [k, v] of Object.entries<number>(pv.fortifications_all_nations)) {
    const mines = /^Minefield (\d)-FP$/.exec(k);
    fortPointValues[mines ? `mines${mines[1]}` : FORT[k]] = v;
  }

  const tables: RsgTables = {
    edgeByDie,
    germanYear,
    alliedNation,
    troopQuality,
    obs,
    leaderTable,
    leaderModifiers,
    support,
    fortifications,
    setupDepth,
    pointValues,
    fortPointValues,
  };
  return {
    _source: 'Generated by scripts/build-data.ts from design/data/rsg.json (GMT 2006 / 2025 RSG charts in the VASSAL module, 2025 Playbook RS.1-RS.16). Do not edit by hand.',
    _notes: [
      'Base game only: Germany as the Axis; alliedNation null = France / Britain (re-roll, scenarios-reference R0).',
      'Counter references are counter type ids; leaderTable index 0 = result <=0, 7 = result 7+.',
    ],
    ...tables,
  };
}
