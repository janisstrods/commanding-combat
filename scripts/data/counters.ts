// design/data/counters.json → src/data/counters.json (CounterType records, objective chits, smoke-marker mix).
import type { CounterType, Nation, Quality, SideStats } from '../../src/engine/types';
import { NATIONS } from './names';

/** Squad quality from the Playbook point-value table (S4 p. 34: Elite / Line / Green squads per nation). */
const SQUAD_QUALITY: Record<string, Quality> = {
  'German/Pionier Squad': 'elite',
  'German/SS Squad': 'elite',
  'German/Fallschirmjager Squad': 'elite',
  'German/Elite Rifle Squad': 'elite',
  'German/Rifle Squad': 'line',
  'German/Volksgrenadier Squad': 'line',
  'German/Conscript Squad': 'green',
  'American/Engineer Squad': 'elite',
  'American/Paratroop Squad': 'elite',
  'American/Elite Squad': 'elite',
  'American/Line Squad': 'line',
  'American/Green Squad': 'green',
  'Russian/Assault Squad': 'elite',
  'Russian/Guards SMG Squad': 'elite',
  'Russian/Guards Rifle Squad': 'elite',
  'Russian/SMG Squad': 'line',
  'Russian/Rifle Squad': 'line',
  'Russian/Militia Squad': 'green',
};

/** Not base-game counters (not on any 2006 CC:E chart, no base scenario or table uses them): left out. */
export const EXCLUDED_WEAPONS = ['Molotov Cocktail', 'Panzerfaust'];

const NO_BOX = { fp: false, range: false, move: false };

function stats(s: any, boxed?: any): SideStats {
  return {
    fp: s.firepower,
    range: s.range,
    move: s.movement,
    morale: s.morale,
    command: s.command ?? 0,
    boxed: boxed ? { fp: !!boxed.firepower, range: !!boxed.range, move: !!boxed.movement } : { ...NO_BOX },
  };
}

function numbers(s: string, what: string): [number, number] {
  const m = /^(\d+)-(\d+)$/.exec(s);
  if (!m) throw new Error(`Bad ${what} numbers: ${s}`);
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a > b) throw new Error(`Bad ${what} range: ${s}`);
  return [a, b];
}

function weaponClass(name: string): NonNullable<CounterType['weaponClass']> {
  if (/MG$/.test(name)) return 'mg';
  if (/Mortar$/.test(name)) return 'mortar';
  if (name === 'Flamethrower') return 'flamethrower';
  if (name === 'Satchel Charge') return 'satchel';
  if (/Gun$|Howitzer$/.test(name)) return 'gun';
  return 'other';
}

function leader(nation: Nation, l: any): CounterType {
  const hero = l.kind === 'hero';
  const c: CounterType = {
    id: `${nation}/${l.name}`,
    nation,
    kind: 'leader',
    name: l.name,
    front: stats(l.front),
    broken: stats(l.broken),
  };
  if (l.rank) c.rank = l.rank;
  if (hero) c.hero = true;
  if (l.rank === 'Pvt') c.private = true;
  return c;
}

function infantry(nation: Nation, u: any, kind: 'squad' | 'team'): CounterType {
  const id = `${nation}/${u.name}`;
  let quality: Quality | undefined;
  if (kind === 'squad') {
    quality = SQUAD_QUALITY[id];
    if (!quality) throw new Error(`No quality for squad ${id}`);
  } else {
    const m = /^(Elite|Line|Green) Team$/.exec(u.name);
    if (m) quality = m[1].toLowerCase() as Quality;
    else if (u.name !== 'Weapon Team') throw new Error(`Unknown team ${id}`);
  }
  const c: CounterType = {
    id,
    nation,
    kind,
    name: u.name,
    front: stats(u.front, u.boxed),
    // The module's box layers switch off on the broken side: broken sides have no boxed values.
    broken: stats(u.broken),
  };
  if (quality) c.quality = quality;
  return c;
}

function weapon(nation: Nation, w: any): CounterType {
  const id = `${nation}/${w.name}`;
  if (w.kind === 'radio') {
    const front: SideStats = { fp: w.artillery_firepower, range: 0, move: 0, morale: 0, command: 0, boxed: { ...NO_BOX } };
    const c: CounterType = { id, nation, kind: 'radio', name: w.name, front, broken: { ...front, boxed: { ...NO_BOX } } };
    if (w.smoke_capable) c.smoke = true;
    return c;
  }
  const range = typeof w.range === 'number' ? w.range : w.max_range;
  if (typeof range !== 'number') throw new Error(`No range for ${id}`);
  const front: SideStats = {
    fp: w.firepower,
    range,
    // the red Movement modifier printed on the counter: 0 or negative, added to the carrier's Movement
    move: w.portage_or_move_penalty ?? 0,
    morale: 0,
    command: 0,
    boxed: { fp: !!w.boxed.firepower, range: !!w.boxed.range, move: !!w.boxed.movement },
  };
  const cls = weaponClass(w.name);
  const c: CounterType = {
    id,
    nation,
    kind: 'weapon',
    name: w.name,
    front,
    broken: { ...front, boxed: { ...front.boxed } },
    fix: numbers(w.broken_side.repair_numbers, `${id} fix`),
    elim: numbers(w.broken_side.eliminate_numbers, `${id} elim`),
    weaponClass: cls,
  };
  if (w.kind === 'ordnance') c.ordnance = true;
  if (w.smoke_capable) c.smoke = true;
  if (typeof w.min_range === 'number') c.minRange = w.min_range;
  if (cls === 'satchel') c.oneUse = true;
  if (cls === 'flamethrower') c.ignoresCover = true;
  return c;
}

export interface ChitJson {
  /** 1..5, 'all' (each of the five Objectives) or null (no Objective value). */
  objective: number | 'all' | null;
  vp: number;
  /** False for chits without a secret side (R, V, W, X): they are always placed open. */
  secret: boolean;
  effect?: 'suddenDeathWin' | 'doubleExitVp' | 'doubleEliminationVp';
}

export function buildCounters(src: any) {
  const counters: CounterType[] = [];
  const excluded: string[] = [];
  for (const nation of NATIONS) {
    const n = src.nations[nation];
    for (const l of n.leaders) counters.push(leader(nation, l));
    for (const s of n.squads) counters.push(infantry(nation, s, 'squad'));
    for (const t of n.teams) counters.push(infantry(nation, t, 'team'));
    for (const w of n.weapons) {
      if (EXCLUDED_WEAPONS.includes(w.name)) excluded.push(`${nation}/${w.name}`);
      else counters.push(weapon(nation, w));
    }
  }
  const ids = new Set<string>();
  for (const c of counters) {
    if (ids.has(c.id)) throw new Error(`Duplicate counter ${c.id}`);
    ids.add(c.id);
  }

  const chits: Record<string, ChitJson> = {};
  for (const [k, v] of Object.entries<any>(src.objective_chits)) {
    if (typeof v.objective === 'number') chits[k] = { objective: v.objective, vp: v.vp, secret: k !== 'R' };
    else if (v.objective === 'each of 1-5') chits[k] = { objective: 'all', vp: v.vp, secret: true };
    else if (k === 'V') chits[k] = { objective: null, vp: 0, secret: false, effect: 'suddenDeathWin' };
    else if (k === 'W') chits[k] = { objective: null, vp: 0, secret: false, effect: 'doubleExitVp' };
    else if (k === 'X') chits[k] = { objective: null, vp: 0, secret: false, effect: 'doubleEliminationVp' };
    else throw new Error(`Unknown objective chit ${k}`);
  }
  const smoke = src.markers.other.find((m: any) => m.name === 'Smoke');
  const smokeMix: Record<string, number> = { ...smoke.hindrance_mix };

  return {
    _source: 'Generated by scripts/build-data.ts from design/data/counters.json (VASSAL module 2.6.4 Parts palette). Do not edit by hand.',
    _notes: [
      'id = "<Nation>/<name>", names as in design/data (and in the scenario forces).',
      'Broken sides are module-only data (see design/data-notes.md); unit broken sides carry no boxed values.',
      'Weapons: front.move is the printed Movement modifier (0 or negative) for the carrier; broken = front (a broken weapon only shows fix/elim).',
      'Radios: front.fp is the battery FP; range/move are 0.',
      `Left out (not base-game counters): ${excluded.join(', ')}.`,
      'quality: squads per the Playbook point-value table; Teams from their name; the Weapon Team has none.',
    ],
    counters,
    objectiveChits: chits,
    smokeMix,
  };
}
