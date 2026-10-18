// Counter-mix limits for RSG purchases. Ruling: the VASSAL module has no counter mix (its palettes are unlimited), so
// a side may hold at most rsgCounterCap(type) counters of a type: the larger of the most any base scenario needs
// (design/data/counters.json `max_needed_in_base_scenarios`, copied below and pinned by tests/rules/rsg.test.ts) and
// the most any one Order of Battle of its nation holds (year pieces included), and at least 1 of anything a Support
// Table offers. Leaders are unique (1). Fortifications have no mix data and stay unlimited.
import { COUNTERS, RSG } from '../data';

/** design/data/counters.json `max_needed_in_base_scenarios` (the non-zero ones). */
const SCENARIO_NEED: Readonly<Record<string, number>> = {
  'German/Pionier Squad': 2, 'German/SS Squad': 4, 'German/Fallschirmjager Squad': 3, 'German/Elite Rifle Squad': 6,
  'German/Rifle Squad': 6, 'German/Volksgrenadier Squad': 9, 'German/Conscript Squad': 5, 'German/Weapon Team': 3,
  'German/LMG': 5, 'German/HMG': 2, 'German/Light Mortar': 1, 'German/IG 18 Gun': 1, 'German/Flamethrower': 1,
  'German/Satchel Charge': 1, 'German/Radio:81mm': 1, 'Russian/Guards SMG Squad': 12, 'Russian/Guards Rifle Squad': 2,
  'Russian/SMG Squad': 4, 'Russian/Rifle Squad': 10, 'Russian/Militia Squad': 10, 'Russian/Elite Team': 2,
  'Russian/Green Team': 4, 'Russian/LMG': 4, 'Russian/MMG': 2, 'Russian/.50 cal MG': 1, 'Russian/Light Mortar': 1,
  'Russian/Satchel Charge': 4, 'American/Engineer Squad': 2, 'American/Paratroop Squad': 12, 'American/Elite Squad': 6,
  'American/Line Squad': 8, 'American/Green Squad': 8, 'American/Weapon Team': 5, 'American/Line Team': 2,
  'American/MMG': 2, 'American/.50 cal MG': 2, 'American/Light Mortar': 1, 'American/Medium Mortar': 2,
  'American/Pack Howitzer': 1, 'American/Flamethrower': 2, 'American/Satchel Charge': 3, 'American/Radio:75mm': 1,
  'American/Radio:105mm': 1,
};

function computeCaps(): Record<string, number> {
  const caps: Record<string, number> = { ...SCENARIO_NEED };
  const atLeast = (id: string, n: number) => {
    caps[id] = Math.max(caps[id] ?? 0, n);
  };
  for (const obs of Object.values(RSG.obs)) {
    for (const ob of Object.values(obs)) {
      for (const s of Object.values(ob.sizes)) {
        const ids = new Set([...Object.keys(s.units), ...(s.unitsByYear ?? []).flatMap((u) => Object.keys(u.units))]);
        for (const id of ids) {
          const extra = Math.max(0, ...(s.unitsByYear ?? []).map((u) => u.units[id] ?? 0));
          atLeast(id, (s.units[id] ?? 0) + extra);
        }
      }
    }
  }
  for (const table of Object.values(RSG.support)) {
    for (const item of Object.values(table.items)) for (const id of [...Object.keys(item.pieces), ...(item.oneOf ?? [])]) atLeast(id, 1);
  }
  return caps;
}

const CAPS = computeCaps();

/** How many counters of `type` a side may have in all (the ruling above); 1 for a Leader, 0 for an unknown type. */
export function rsgCounterCap(type: string): number {
  const c = COUNTERS[type];
  if (!c) return 0;
  if (c.kind === 'leader') return 1;
  return CAPS[type] ?? 0;
}
