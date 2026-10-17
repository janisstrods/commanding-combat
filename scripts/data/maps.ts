// Map transcriptions (design/data/maps.json's Map 1 pilot and design/data/maps/map-<id>.json) → src/data/maps/<id>.json.
//
// Terrain type per hex (§T78.1: the highest-ranked type *depicted anywhere in the hex* wins, hierarchy §T-TEC):
//   1. the transcription's `terrain` (the terrain under the centre dot);
//   2. upgraded to any higher-ranked type its note names ("also: Building", ...), or that the module's terrain file gives
//      where the transcription records a disagreement (the art contains it), or that MAP_RULES names (lead rulings);
//   3. bridges per MAP_RULES (Major / Minor);
//   4. Task 4's masks audit (design/data/masks-audit.json `typeUpgrades`) on top, when that file exists.
// An upgrade to an impassable / water type (Water, Stream, Marsh) is refused when a road, trail or railway runs through
// the hex: the path shows the designer meant the hex to be crossed (recorded as "not upgraded").
// Crest hexes: every hex with a lower neighbour (contours lie inside the higher hex: FAQ, every crest hex's centre dot is
// at the higher level; the hex at the top of a Cliff is a crest hex). Task 4's masks compute crests from the art.
// Building ids: each Building hex is its own building unless MAP_RULES groups hexes of one drawn building.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_HEXES, label, neighbour, neighbours, parseHex, sideTo } from '../../src/engine/hex';
import type { HexSide, HexsideFeature, PathKind, TerrainType } from '../../src/engine/types';
import { readJson } from './json';
import { TERRAIN_RANK } from './names';

export const MAP_IDS = ['1', '2', '3', '4', '5', '5w', '6', '7', '8', '9', '10', '11', '12'];

/** Hand rulings per map (from the lead and the transcription notes). */
const MAP_RULES: Record<
  string,
  { upgrades?: Record<string, { to: TerrainType; why: string }>; bridges?: Record<string, TerrainType>; buildings?: string[][] }
> = {
  '1': {
    upgrades: { D3: { to: 'Woods', why: 'pilot note: woods artwork covers the NE third and the SW corner' } },
  },
  '4': {
    // "the stem of the T-shaped M3/N3 building covers the NE part of the hex" (M4 note)
    buildings: [['M3', 'N3', 'M4']],
  },
  '5': { bridges: { G6: 'MinorBridge' } },
  '5w': { bridges: { G6: 'MinorBridge' } },
  '10': {
    // stone road bridge across the lake (lead ruling: Major, entered only across its road hexsides)
    bridges: { F6: 'MajorBridge' },
    // "two small buildings plus the end of the F1 building" (G1 note)
    buildings: [['F1', 'G1']],
  },
};

const TYPE_WORDS: [RegExp, TerrainType][] = [
  [/^building/i, 'Building'],
  [/^woods?/i, 'Woods'],
  [/^brush/i, 'Brush'],
  [/^orchard/i, 'Orchard'],
  [/^field/i, 'Field'],
  [/^gully/i, 'Gully'],
  [/^water/i, 'Water'],
  [/^stream/i, 'Stream'],
  [/^marsh/i, 'Marsh'],
];

const rank = (t: TerrainType) => TERRAIN_RANK.indexOf(t);
const higher = (a: TerrainType, b: TerrainType) => rank(a) < rank(b);
const WATERY: TerrainType[] = ['Water', 'Stream', 'Marsh'];

function normaliseType(t: string): TerrainType {
  if (t === 'Water Barrier') return 'Water';
  if (!(TERRAIN_RANK as string[]).includes(t)) throw new Error(`Unknown terrain type ${t}`);
  return t as TerrainType;
}

/** Terrain types named after "also:" in a transcription note. */
function alsoTypes(note: string): TerrainType[] {
  const out: TerrainType[] = [];
  for (const m of note.matchAll(/also:\s*([^.;(]+)/gi)) {
    for (const word of m[1].split(/,|\band\b|\+/)) {
      const w = word.trim();
      const hit = TYPE_WORDS.find(([re]) => re.test(w));
      if (hit) out.push(hit[1]);
    }
  }
  return out;
}

/** Terrain types in the module file's value for a hex ("Hill Building", "Woods Railway track", "Road", ...). */
function moduleTypes(value: string): TerrainType[] {
  return value
    .split(/\s+/)
    .map((w) => TYPE_WORDS.find(([re]) => re.test(w))?.[1])
    .filter((t): t is TerrainType => !!t);
}

export interface MapHexOut {
  terrain: TerrainType;
  elevation: number;
  crest?: boolean;
  building?: number;
  paths?: PathKind[];
}

export interface MapOut {
  _source: string;
  id: string;
  objectives: string[];
  hexes: Record<string, MapHexOut>;
  hexsides: { between: [string, string]; feature: HexsideFeature }[];
  paths: ({ between: [string, string]; kind: PathKind } | { hex: string; side: HexSide; kind: PathKind })[];
}

export interface MapReport {
  id: string;
  upgrades: string[];
  refused: string[];
  buildings: string[];
  candidates: string[];
  crests: number;
}

const PATH_KINDS: PathKind[] = ['Road', 'Trail', 'Railway'];
const HEXSIDE_FEATURES: HexsideFeature[] = ['Fence', 'Hedge', 'Wall', 'Cliff'];

function auditUpgrades(audit: any, id: string): Record<string, TerrainType> {
  const t = audit?.typeUpgrades;
  if (!t) return {};
  const out: Record<string, TerrainType> = {};
  if (Array.isArray(t)) {
    for (const u of t) if (String(u.map) === id) out[u.hex] = normaliseType(u.to ?? u.type);
  } else if (t[id]) {
    for (const [hex, v] of Object.entries<any>(t[id])) out[hex] = normaliseType(typeof v === 'string' ? v : (v.to ?? v.type));
  }
  return out;
}

function adjacent(a: string, b: string, what: string): void {
  if (sideTo(parseHex(a), parseHex(b)) === null) throw new Error(`${what}: ${a} and ${b} are not adjacent`);
}

export function buildMap(id: string, src: any, printed: string[], audit: any): { map: MapOut; report: MapReport } {
  const rules = MAP_RULES[id] ?? {};
  const report: MapReport = { id, upgrades: [], refused: [], buildings: [], candidates: [], crests: 0 };
  const disagreements: any[] = src.agreement_with_module_file?.disagreements ?? [];
  const moduleSays = new Map<string, TerrainType[]>(disagreements.map((d) => [d.where, moduleTypes(String(d.module))]));
  const fromAudit = auditUpgrades(audit, id);

  const hexes: Record<string, MapHexOut> = {};
  for (const h of ALL_HEXES) {
    const lbl = label(h);
    const t = src.hexes[lbl];
    if (!t) throw new Error(`Map ${id}: no hex ${lbl}`);
    const base = normaliseType(t.terrain);
    const features: string[] = t.features ?? [];
    const paths = PATH_KINDS.filter((k) => features.includes(k));
    for (const f of features) if (!PATH_KINDS.includes(f as PathKind) && f !== 'Bridge') throw new Error(`Map ${id} ${lbl}: feature ${f}`);

    const cands: { to: TerrainType; why: string }[] = [];
    for (const to of alsoTypes(t.note ?? '')) cands.push({ to, why: `note "also: ${to}"` });
    for (const to of moduleSays.get(lbl) ?? []) cands.push({ to, why: `module file gives ${to}` });
    const manual = rules.upgrades?.[lbl];
    if (manual) cands.push(manual);
    const bridge = rules.bridges?.[lbl];
    if (bridge) cands.push({ to: bridge, why: 'bridge ruling' });

    const ok = cands.filter((c) => {
      if (!higher(c.to, base)) return false;
      if (WATERY.includes(c.to) && paths.length) {
        report.refused.push(`${lbl} ${base} not upgraded to ${c.to} (${c.why}): a ${paths.join('/')} crosses the hex`);
        return false;
      }
      return true;
    });
    let terrain = base;
    for (const c of ok) if (higher(c.to, terrain)) terrain = c.to;
    if (terrain !== base) {
      const whys = [...new Set(ok.filter((c) => c.to === terrain).map((c) => c.why))];
      report.upgrades.push(`${lbl} ${base} → ${terrain} (${whys.join('; ')})`);
    }
    const audited = fromAudit[lbl];
    if (audited && audited !== terrain) {
      report.upgrades.push(`${lbl} ${terrain} → ${audited} (masks audit)`);
      terrain = audited;
    }
    if (typeof t.elevation !== 'number') throw new Error(`Map ${id} ${lbl}: no elevation`);
    const hex: MapHexOut = { terrain, elevation: t.elevation };
    if (paths.length) hex.paths = paths;
    hexes[lbl] = hex;
  }
  for (const lbl of Object.keys(rules.bridges ?? {})) {
    if (hexes[lbl].terrain !== rules.bridges![lbl]) throw new Error(`Map ${id} ${lbl}: bridge ruling not applied`);
  }

  // crest hexes
  for (const h of ALL_HEXES) {
    const me = hexes[label(h)];
    if (neighbours(h).some((n) => hexes[label(n)].elevation < me.elevation)) {
      me.crest = true;
      report.crests++;
    }
  }

  // buildings
  let next = 0;
  const groups = rules.buildings ?? [];
  for (const g of groups) {
    for (const lbl of g) if (hexes[lbl].terrain !== 'Building') throw new Error(`Map ${id}: building group hex ${lbl} is ${hexes[lbl].terrain}`);
  }
  for (const h of ALL_HEXES) {
    const lbl = label(h);
    if (hexes[lbl].terrain !== 'Building' || hexes[lbl].building !== undefined) continue;
    const g = groups.find((x) => x.includes(lbl));
    for (const m of g ?? [lbl]) hexes[m].building = next;
    if (g) report.buildings.push(`building ${next}: ${g.join(', ')}`);
    next++;
  }
  // multi-hex candidates for Task 4: adjacent Building hexes in different buildings
  const seen = new Set<string>();
  for (const h of ALL_HEXES) {
    const a = hexes[label(h)];
    if (a.terrain !== 'Building') continue;
    for (const n of neighbours(h)) {
      const b = hexes[label(n)];
      if (n < h || b.terrain !== 'Building' || b.building === a.building) continue;
      const star = (x: number) => label(x) + (printed.includes(label(x)) ? '*' : '');
      const key = `${star(h)}-${star(n)}`;
      if (!seen.has(key)) {
        seen.add(key);
        report.candidates.push(key);
      }
    }
  }

  const hexsides: MapOut['hexsides'] = [];
  for (const s of src.hexsides ?? []) {
    if (!HEXSIDE_FEATURES.includes(s.feature)) throw new Error(`Map ${id}: hexside feature ${s.feature}`);
    adjacent(s.between[0], s.between[1], `Map ${id} hexside`);
    hexsides.push({ between: [s.between[0], s.between[1]], feature: s.feature });
  }
  const paths: MapOut['paths'] = [];
  for (const kind of PATH_KINDS) {
    const k = kind.toLowerCase();
    for (const c of src[`${k}_crossings`] ?? []) {
      adjacent(c.between[0], c.between[1], `Map ${id} ${kind}`);
      paths.push({ between: [c.between[0], c.between[1]], kind });
    }
    for (const e of src[`${k}_map_edge_exits`] ?? []) {
      if (neighbour(parseHex(e.hex), e.side) !== null) throw new Error(`Map ${id}: ${kind} exit ${e.hex} side ${e.side} is not on the edge`);
      paths.push({ hex: e.hex, side: e.side, kind });
    }
  }

  const objectives = printed;
  const own = src.objectives ? [1, 2, 3, 4, 5].map((n) => src.objectives[String(n)]) : null;
  if (own && own.join() !== printed.join()) throw new Error(`Map ${id}: objectives ${own} differ from maps.json ${printed}`);
  for (const [lbl, t] of Object.entries<any>(src.hexes)) {
    if (t.objective && printed[t.objective - 1] !== lbl) throw new Error(`Map ${id}: hex ${lbl} marked objective ${t.objective}`);
  }

  return {
    map: {
      _source: `Generated by scripts/build-data.ts from ${id === '1' ? 'design/data/maps.json (Map 1 pilot)' : `design/data/maps/map-${id}.json`}. Do not edit by hand; terrain upgrades are listed in design/data-notes.md.`,
      id,
      objectives,
      hexes,
      hexsides,
      paths,
    },
    report,
  };
}

export function buildMaps(designDir: string, audit: any) {
  const index = readJson(join(designDir, 'maps.json'));
  const maps: MapOut[] = [];
  const reports: MapReport[] = [];
  const missing: string[] = [];
  for (const id of MAP_IDS) {
    const entry = index.maps.find((m: any) => m.map === id);
    const printed: string[] = entry.printed_objectives.map((o: any) => o.hex);
    let src: any;
    if (id === '1') src = entry.terrain_pilot;
    else {
      const path = join(designDir, 'maps', `map-${id}.json`);
      if (!existsSync(path)) {
        missing.push(id);
        continue;
      }
      src = readJson(path);
    }
    const { map, report } = buildMap(id, src, printed, audit);
    maps.push(map);
    reports.push(report);
  }
  return { maps, reports, missing };
}

export function mapNotes(reports: MapReport[], missing: string[], auditUsed: boolean): string[] {
  const lines: string[] = [
    'Terrain type per hex = the highest-ranked type depicted in the hex (§T78.1, hierarchy §T-TEC): the transcription\'s',
    'centre-dot terrain, upgraded to any higher type its note names ("also: …"), that the module file gives where the',
    'transcription records a disagreement, or that a lead ruling names. Upgrades to Water / Stream / Marsh are refused',
    'where a road, trail or railway crosses the hex. Elevation is always the transcription\'s. Crest = the hex has a',
    'lower neighbour. Building ids: one per Building hex unless grouped below. Task 4\'s masks audit',
    `(design/data/masks-audit.json \`typeUpgrades\`) is applied on top when present (${auditUsed ? 'present: applied' : 'not present yet'}).`,
    '',
  ];
  if (missing.length) lines.push(`Maps not transcribed yet: ${missing.join(', ')}.`, '');
  lines.push('| Map | Upgrades | Crest hexes | Grouped buildings | Multi-hex candidates |', '|---|---|---|---|---|');
  for (const r of reports) {
    lines.push(`| ${r.id} | ${r.upgrades.length} | ${r.crests} | ${r.buildings.length} | ${r.candidates.length} |`);
  }
  for (const r of reports) {
    if (!r.upgrades.length && !r.refused.length && !r.buildings.length && !r.candidates.length) continue;
    lines.push('', `### Map ${r.id}`, '');
    for (const u of r.upgrades) lines.push(`- Upgrade: ${u}`);
    for (const u of r.refused) lines.push(`- Not upgraded: ${u}`);
    for (const b of r.buildings) lines.push(`- Grouped: ${b}`);
    if (r.candidates.length) lines.push(`- Adjacent Building hexes kept as separate buildings (Task 4: check the art; * = Objective hex): ${r.candidates.join(', ')}`);
  }
  return lines;
}
