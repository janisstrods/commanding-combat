// The RSG's helpers and table look-ups (scenarios-reference §4 tables via data.ts RSG): OB, Support, Fortification and
// Radio options, the purchase rules, the legal nation / year pairings (R0). Internal to src/engine/rsg*: rsg.ts
// re-exports only what the UI and the AI need.
import { COUNTERS, MAP_IDS, RSG } from '../data';
import { FORT_NAMES, fortMixCount, mixCount } from '../mix';
import { random } from '../rng';
import type { ObSize, RsgFortificationOb, RsgOb, RsgObSize } from '../rsgTypes';
import { type Edge, type FortKind, type Nation, type Quality, type Side, SIDES } from '../types';
import type { RsgDraft, RsgFixed, RsgLogEntry, RsgObOption, RsgRadioChance, RsgSupportOption } from './types';

// ---------------------------------------------------------------------------------------------------------------------
// Small helpers

/** Ruling: the RSG offers maps 1–12. Map 5w is map 5 dressed for scenario 5 (Snow), not a battlefield of its own. */
export const RSG_MAPS: readonly string[] = MAP_IDS.filter((m) => m !== '5w');

export const EDGES: readonly Edge[] = ['top', 'bottom', 'left', 'right'];
export const OPPOSITE: Record<Edge, Edge> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
export const SIDE_NAME: Record<Side, string> = { axis: 'Axis', allied: 'Allies' };
export const QUALITIES: readonly Quality[] = ['elite', 'line', 'green'];
export const ALLIED_YEARS: Partial<Record<Nation, [number, number]>> = { American: [1943, 1945], Russian: [1941, 1945] };
export const SIZES: readonly ObSize[] = ['company', 'detachment', 'platoon'];
export const OBJECTIVES = 5;

export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
export const die = (d: RsgDraft) => 1 + Math.floor(random(d) * 6);
export const twoDice = (d: RsgDraft): [number, number] => [die(d), die(d)];
export const coin = (d: RsgDraft): 'heads' | 'tails' => (random(d) < 0.5 ? 'heads' : 'tails');
export const nationOf = (d: RsgDraft, side: Side): Nation => (side === 'axis' ? 'German' : d.allied!);
/** `side`'s VP lead: positive while the VP marker sits on `side`'s half of the track. */
export const leadOf = (vp: number, side: Side) => (side === 'axis' ? vp : -vp);
/** Move the VP marker `n` toward `side`. */
export const give = (d: RsgDraft, side: Side, n: number) => {
  d.vp += side === 'axis' ? n : -n;
};
/** 'the Axis player' / 'the Allied player', for narration (`Cap` it at the start of a sentence). */
export const PLAYER: Record<Side, string> = { axis: 'the Axis player', allied: 'the Allied player' };
export const Cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
export const QUALITY_NAME: Record<Quality, string> = { elite: 'Elite', line: 'Line', green: 'Green' };
/** 'the VP marker is on 0' / 'the VP marker is 7 towards the Allies'. */
export const vpText = (vp: number) => `the VP marker is ${vp === 0 ? 'on 0' : `${Math.abs(vp)} towards the ${vp > 0 ? 'Axis' : 'Allies'}`}`;
/** A number for narration, with a true minus sign: '−4'. */
export const signed = (n: number) => (n < 0 ? `−${-n}` : `${n}`);
const SIZE_NOUN: Record<ObSize, string> = { company: 'Company', detachment: 'Detachment', platoon: 'Platoon' };
/** 'Fallschirmjaeger Company' (the tables' own labels mix 'Company' and 'Coy.'). */
export const obLabel = (ob: RsgOb, size: ObSize) => `${ob.name} ${SIZE_NOUN[size]}`;
const RANK: Record<string, string> = { Pvt: 'Private', Cpl: 'Corporal', Sgt: 'Sergeant', Lt: 'Lieutenant', Cpt: 'Captain' };
/** A Leader's name with his rank in full, as the Support Tables print it: 'German/Sgt Grein' → 'Sergeant Grein'. */
export const leaderName = (type: string) => name(type).replace(/^(Pvt|Cpl|Sgt|Lt|Cpt) /, (_, r: string) => `${RANK[r]} `);
/** A dice roll for narration: '3+5 = 8'. */
export const rollText = (r: [number, number]) => `${r[0]}+${r[1]} = ${r[0] + r[1]}`;
/** Items in order of first mention, copies grouped: 'Wpn Team w/ LMG, 2 × SMG Squad and Sgt Kaminsky'. */
export function listText(labels: string[]): string {
  const counts = new Map<string, number>();
  for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + 1);
  const parts = [...counts].map(([l, n]) => (n > 1 ? `${n} × ${l}` : l));
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : (parts[0] ?? 'nothing');
}
export const sum = (d: [number, number]) => d[0] + d[1];
export const name = (type: string) => COUNTERS[type]?.name ?? type;
export const defenderOf = (d: RsgDraft): Side | null => (d.postures ? (SIDES.find((s) => d.postures![s] === 'defend') ?? null) : null);
export const attackerOf = (d: RsgDraft): Side | null => (d.postures ? (SIDES.find((s) => d.postures![s] === 'attack') ?? null) : null);
export const log = (d: RsgDraft, e: RsgLogEntry) => d.log.push(e);

export function addAll<K extends string>(into: Partial<Record<K, number>>, from: Partial<Record<K, number>>): void {
  for (const [k, n] of Object.entries(from) as [K, number][]) into[k] = (into[k] ?? 0) + n;
}

// ---------------------------------------------------------------------------------------------------------------------
// Tables

/** The OBs `nation` fields in `year` with troop quality `quality`, every size (RS.5). */
export function rsgObOptions(nation: Nation, year: number, quality: Quality): RsgObOption[] {
  const out: RsgObOption[] = [];
  for (const ob of Object.values(RSG.obs[nation] ?? {})) {
    if (ob.quality !== quality || year < ob.years[0] || year > ob.years[1]) continue;
    for (const size of SIZES) {
      const s = ob.sizes[size];
      out.push({
        letter: ob.letter, size, chit: s.chit, label: obLabel(ob, size), name: ob.name, quality: ob.quality, points: s.points,
        initiative: s.initiative, orders: s.orders, surrender: s.surrender, leaders: s.leaders, units: obUnits(s, year),
      });
    }
  }
  return out;
}

export function obUnits(s: RsgObSize, year: number): Record<string, number> {
  const units: Record<string, number> = { ...s.units };
  for (const extra of s.unitsByYear ?? []) if (extra.years[0] <= year && year <= extra.years[1]) addAll(units, extra.units);
  return units;
}

export function obOf(d: RsgDraft, side: Side): { ob: RsgOb; size: RsgObSize } {
  const p = d.ob[side]!;
  const ob = RSG.obs[nationOf(d, side)][p.letter];
  return { ob, size: ob.sizes[p.size] };
}

/** The Leader Table row (0 = result ≤ 0 … 7 = result 7+) for a white die with the RS.6 modifiers. */
export function rsgLeaderIndex(nation: Nation, year: number, quality: Quality, white: number): number {
  const m = RSG.leaderModifiers.quality[quality] + (RSG.leaderModifiers.year[nation][year] ?? 0);
  return Math.max(0, Math.min(7, white + m));
}

/** What `side` holds before buying: its OB's pieces (year pieces included) and its Leaders. */
export function holdings(d: RsgDraft, side: Side): Record<string, number> {
  const have = obUnits(obOf(d, side).size, d.year!);
  for (const l of d.leaders[side]) addAll(have, { [l]: 1 });
  return have;
}

/** How many more counters of each piece type of `pieces` the counter mix has for `side` (mix.ts, R-56). */
export function supportRoom(d: RsgDraft, side: Side, types: Iterable<string>): Record<string, number> {
  const have = holdings(d, side);
  const room: Record<string, number> = {};
  for (const t of types) room[t] = Math.max(0, mixCount(t) - (have[t] ?? 0));
  return room;
}

/**
 * The non-Radio items of `side`'s Support Table column `roll` available in the year that the counter mix still has
 * (at least one of; Leaders he has not got), with how many he could take (RS.7).
 */
export function supportOptions(d: RsgDraft, side: Side, roll: number): RsgSupportOption[] {
  const table = RSG.support[nationOf(d, side)];
  const year = d.year!;
  const owned = new Set(d.leaders[side]);
  const all: RsgSupportOption[] = [];
  const seen = new Set<string>();
  for (const e of table.columns[roll] ?? []) {
    const item = table.items[e.item];
    if (!item || item.kind === 'radio' || year < e.years[0] || year > e.years[1] || seen.has(e.item)) continue;
    seen.add(e.item);
    if (item.kind === 'leaderEither') {
      for (const l of item.oneOf ?? []) {
        if (owned.has(l)) continue;
        all.push({ id: `${item.id}:${l}`, item: item.id, label: leaderName(l), kind: item.kind, vp: e.vp, pieces: { [l]: 1 }, left: 1, once: true, group: item.id });
      }
      continue;
    }
    const pieces = { ...item.pieces };
    const leader = item.kind === 'leader';
    if (leader && Object.keys(pieces).some((p) => owned.has(p))) continue;
    const o: RsgSupportOption = { id: item.id, item: item.id, label: item.label, kind: item.kind, vp: e.vp, pieces, left: 1, once: leader };
    if (item.kind === 'unitWithWeapon' && item.carrier) {
      o.carrier = item.carrier;
      o.weapon = Object.keys(pieces).find((p) => p !== item.carrier);
    }
    all.push(o);
  }
  const room = supportRoom(d, side, all.flatMap((o) => Object.keys(o.pieces)));
  for (const o of all) o.left = Math.min(...Object.entries(o.pieces).map(([t, n]) => Math.floor(room[t] / n)));
  return all.filter((o) => o.left >= 1);
}

/**
 * RS.7 purchase rules: at least one item if the column offers any; a Leader once; one Leader of an "A or B" row; no
 * more of a piece type than the counter mix has left (`room`, mix.ts / R-56; types shared by items add up).
 * Ruling: the 2025 text allows several purchases but sets no limit; here every purchase but the last must leave the VP
 * marker on the buyer's side (the last may carry it past 0, which hands the roll to the opponent).
 */
export function supportError(options: RsgSupportOption[], lead: number, buy: string[], room: Record<string, number>): string | null {
  if (!Array.isArray(buy)) return 'The purchase must be a list of options.';
  if (!buy.length) return options.length ? 'He must buy at least one item from the column (RS.7).' : null;
  const byId = new Map(options.map((o) => [o.id, o]));
  const ids = new Set<string>();
  const groups = new Set<string>();
  const used: Record<string, number> = {};
  const costs: number[] = [];
  for (const id of buy) {
    const o = byId.get(id);
    if (!o) return `"${id}" is not on this column for the year.`;
    if (o.once && ids.has(o.id)) return `${o.label} can be bought only once.`;
    if (o.group) {
      if (groups.has(o.group) && !ids.has(o.id)) return 'Only one Leader of that row per roll (FAQ RS.7).';
      groups.add(o.group);
    }
    for (const [t, n] of Object.entries(o.pieces)) {
      used[t] = (used[t] ?? 0) + n;
      const k = room[t] ?? 0;
      if (used[t] > k) return `The counter mix has only ${k} more ${name(t)} counter${k === 1 ? '' : 's'} (R-56).`;
    }
    ids.add(o.id);
    costs.push(o.vp);
  }
  const total = costs.reduce((a, b) => a + b, 0);
  if (total - Math.max(...costs) >= lead) {
    return 'Before the last purchase the VP marker must still be on the buyer\'s side of 0 (project ruling for RS.7).';
  }
  return null;
}

export const fortOb = (id: string): RsgFortificationOb | undefined => RSG.fortifications.find((f) => f.id === id);

/** RS.9: within the budget, Minefields of one strength, counter mix permitting (mix.ts, R-56: the OBs' markers add up). */
export function fortError(budget: number, buy: string[]): string | null {
  if (!Array.isArray(buy)) return 'The purchase must be a list of Fortification OBs.';
  let total = 0;
  const strengths = new Set<number>();
  const markers: Partial<Record<FortKind, number>> = {};
  for (const id of buy) {
    const f = fortOb(id);
    if (!f) return `"${id}" is not a Fortification OB.`;
    total += f.vp;
    if (f.minefield) strengths.add(f.minefield);
    addAll(markers, f.contents);
  }
  if (total > budget) return `That costs ${total} VP; the Defender has ${budget} VP to spend (RS.9).`;
  if (strengths.size > 1) return 'All Minefields bought must have the same strength (RS.9).';
  for (const [k, n] of Object.entries(markers) as [FortKind, number][]) {
    const k2 = fortMixCount(k);
    if (n > k2) return `The counter mix has only ${k2} ${FORT_NAMES[k]} markers (RS.9, R-56).`;
  }
  return null;
}

export const P2D6 = (r: number) => (6 - Math.abs(r - 7)) / 36;

export function radioChances(d: RsgDraft, side: Side): RsgRadioChance[] {
  const table = RSG.support[nationOf(d, side)];
  const by = new Map<string, RsgRadioChance>();
  for (let r = 2; r <= 12; r++) {
    const e = radioOn(d, side, r);
    if (!e) continue;
    const radio = Object.keys(table.items[e.item].pieces)[0];
    const c = by.get(e.item) ?? { radio, label: table.items[e.item].label, vp: e.vp, rolls: [], chance: 0 };
    c.rolls.push(r);
    c.chance += P2D6(r);
    by.set(e.item, c);
  }
  return [...by.values()];
}

/** The Radio entry of `side`'s Support Table column `roll` for the year, if any (RS.11.1). */
export function radioOn(d: RsgDraft, side: Side, roll: number) {
  const table = RSG.support[nationOf(d, side)];
  return (table.columns[roll] ?? []).find((e) => table.items[e.item]?.kind === 'radio' && e.years[0] <= d.year! && d.year! <= e.years[1]);
}

// R0: legal pairings are Germany–Russia 1941–45 and Germany–America 1943–45; fixed qualities must have an OB.
export const hasOb = (n: Nation, y: number, q: Quality) => rsgObOptions(n, y, q).length > 0;

export function nationOk(f: RsgFixed, n: Nation | null, y: number): boolean {
  const span = n ? ALLIED_YEARS[n] : undefined;
  if (!n || !span || y < span[0] || y > span[1]) return false;
  return !f.quality?.allied || hasOb(n, y, f.quality.allied);
}

export function yearOk(f: RsgFixed, y: number): boolean {
  if (y < 1941 || y > 1945) return false;
  if (f.quality?.axis && !hasOb('German', y, f.quality.axis)) return false;
  const nations: Nation[] = f.allied ? [f.allied] : ['American', 'Russian'];
  return nations.some((n) => nationOk(f, n, y) && (f.allied || Object.values(RSG.alliedNation).some((row) => row[y] === n)));
}

export function fixedError(f: RsgFixed): string | null {
  if (f.map !== undefined && !RSG_MAPS.includes(f.map)) return `No RSG map "${f.map}" (maps 1-12).`;
  if (f.axisEdge !== undefined && !EDGES.includes(f.axisEdge)) return `No edge "${f.axisEdge}".`;
  if (f.allied !== undefined && !ALLIED_YEARS[f.allied]) return `The Allies are American or Russian, not ${f.allied}.`;
  if (f.year !== undefined && !(Number.isInteger(f.year) && f.year >= 1941 && f.year <= 1945)) {
    return `Year ${f.year}: the base game has Allies only in 1941-1945 (R0).`;
  }
  for (const side of SIDES) {
    const q = f.quality?.[side];
    if (q !== undefined && !QUALITIES.includes(q)) return `No troop quality "${q}".`;
  }
  if (f.defender !== undefined && f.defender !== null && !SIDES.includes(f.defender)) return `No side "${f.defender}".`;
  const years = [1941, 1942, 1943, 1944, 1945].filter((y) => f.year === undefined || y === f.year);
  if (!years.some((y) => yearOk(f, y))) return 'No base-game scenario fits these fixed options (R0: Russia 1941-45, America 1943-45).';
  return null;
}

