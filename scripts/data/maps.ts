// Map transcriptions (design/data/maps.json's Map 1 pilot and design/data/maps/map-<id>.json) → src/data/maps/<id>.json.
//
// Terrain type per hex (§T78.1: the highest-ranked type *depicted anywhere in the hex* wins, hierarchy §T-TEC):
//   1. the transcription's `terrain` (the terrain under the centre dot);
//   2. upgraded to any higher-ranked type its note names ("also: Building", ...), or that the module's terrain file gives
//      where the transcription records a disagreement (the art contains it), or that MAP_RULES names (lead rulings);
//   3. bridges per MAP_RULES (Major / Minor);
//   4. Task 4's masks audit (design/data/masks-audit.json, per map: typeUpgrades, levelFixes, crest, buildings) on
//      top, when that file exists: its type and level win, its crest list replaces the neighbour rule, and its
//      building groups are merged with MAP_RULES' groups.
// An upgrade to an impassable / water type (Water, Stream, Marsh) is refused when a road, trail or railway runs through
// the hex: the path shows the designer meant the hex to be crossed (recorded as "not upgraded").
// Crest hexes: the audit's list when present, else every hex with a lower neighbour (contours lie inside the higher
// hex: FAQ, every crest hex's centre dot is at the higher level; the hex at the top of a Cliff is a crest hex).
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
  levels: string[];
  buildings: string[];
  candidates: string[];
  crests: number;
  crestSource: 'masks audit' | 'neighbour rule';
  crestDiffs: string[];
  /** Audit type entries that only confirm the type the notes already gave. */
  auditConfirmed: number;
}

const PATH_KINDS: PathKind[] = ['Road', 'Trail', 'Railway'];
const HEXSIDE_FEATURES: HexsideFeature[] = ['Fence', 'Hedge', 'Wall', 'Cliff'];

/** One map's entry of design/data/masks-audit.json (Task 4). */
export interface MapAudit {
  typeUpgrades: Record<string, TerrainType>;
  levelFixes: Record<string, number>;
  /** Crest hexes, or null when the audit gives no list. */
  crest: string[] | null;
  buildings: string[][];
}

export function auditFor(audit: any, id: string): MapAudit | null {
  const a = audit?.[id];
  if (!a || typeof a !== 'object') return null;
  const labels = (xs: string[]) => xs.map((l) => (parseHex(l), l));
  return {
    typeUpgrades: Object.fromEntries(Object.entries<string>(a.typeUpgrades ?? {}).map(([h, t]) => [(parseHex(h), h), normaliseType(t)])),
    levelFixes: Object.fromEntries(Object.entries<number>(a.levelFixes ?? {}).map(([h, v]) => [(parseHex(h), h), v])),
    crest: Array.isArray(a.crest) ? labels(a.crest) : null,
    buildings: (a.buildings ?? []).map(labels),
  };
}

function adjacent(a: string, b: string, what: string): void {
  if (sideTo(parseHex(a), parseHex(b)) === null) throw new Error(`${what}: ${a} and ${b} are not adjacent`);
}

export function buildMap(id: string, src: any, printed: string[], audit: any): { map: MapOut; report: MapReport } {
  const rules = MAP_RULES[id] ?? {};
  const report: MapReport = {
    id,
    upgrades: [],
    refused: [],
    levels: [],
    buildings: [],
    candidates: [],
    crests: 0,
    crestSource: 'neighbour rule',
    crestDiffs: [],
    auditConfirmed: 0,
  };
  const disagreements: any[] = src.agreement_with_module_file?.disagreements ?? [];
  const moduleSays = new Map<string, TerrainType[]>(disagreements.map((d) => [d.where, moduleTypes(String(d.module))]));
  const fromAudit = auditFor(audit, id);

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
    const audited = fromAudit?.typeUpgrades[lbl];
    if (audited && audited !== terrain) {
      report.upgrades.push(`${lbl} ${terrain} → ${audited} (masks audit)`);
      terrain = audited;
    } else if (audited) report.auditConfirmed++;
    if (typeof t.elevation !== 'number') throw new Error(`Map ${id} ${lbl}: no elevation`);
    let elevation: number = t.elevation;
    const fix = fromAudit?.levelFixes[lbl];
    if (fix !== undefined && fix !== elevation) {
      report.levels.push(`${lbl} level ${elevation} → ${fix} (masks audit)`);
      elevation = fix;
    }
    const hex: MapHexOut = { terrain, elevation };
    if (paths.length) hex.paths = paths;
    hexes[lbl] = hex;
  }
  for (const lbl of Object.keys(rules.bridges ?? {})) {
    if (hexes[lbl].terrain !== rules.bridges![lbl]) throw new Error(`Map ${id} ${lbl}: bridge ruling not applied`);
  }

  // crest hexes: the audit's list, else the neighbour rule
  const lowerNeighbour = (h: number) => neighbours(h).some((n) => hexes[label(n)].elevation < hexes[label(h)].elevation);
  const auditCrest = fromAudit?.crest ? new Set(fromAudit.crest) : null;
  if (auditCrest) report.crestSource = 'masks audit';
  for (const h of ALL_HEXES) {
    const lbl = label(h);
    const byRule = lowerNeighbour(h);
    const crest = auditCrest ? auditCrest.has(lbl) : byRule;
    if (auditCrest && crest !== byRule) report.crestDiffs.push(`${lbl} ${crest ? 'crest (no lower neighbour)' : 'not crest (has a lower neighbour)'}`);
    if (crest) {
      hexes[lbl].crest = true;
      report.crests++;
    }
  }

  // buildings: the audit's groups merged with MAP_RULES' groups (groups sharing a hex become one building)
  const groupSources: { hexes: string[]; source: string }[] = [
    ...(fromAudit?.buildings ?? []).map((g) => ({ hexes: g, source: 'masks audit' })),
    ...(rules.buildings ?? []).map((g) => ({ hexes: g, source: 'transcription note' })),
  ];
  const merged: { hexes: Set<string>; sources: Set<string> }[] = [];
  for (const g of groupSources) {
    for (const lbl of g.hexes) if (hexes[lbl].terrain !== 'Building') throw new Error(`Map ${id}: building group hex ${lbl} is ${hexes[lbl].terrain}`);
    const hits = merged.filter((m) => g.hexes.some((x) => m.hexes.has(x)));
    const into = { hexes: new Set(g.hexes), sources: new Set([g.source]) };
    for (const m of hits) {
      m.hexes.forEach((x) => into.hexes.add(x));
      m.sources.forEach((x) => into.sources.add(x));
      merged.splice(merged.indexOf(m), 1);
    }
    merged.push(into);
  }
  let next = 0;
  for (const h of ALL_HEXES) {
    const lbl = label(h);
    if (hexes[lbl].terrain !== 'Building' || hexes[lbl].building !== undefined) continue;
    const g = merged.find((x) => x.hexes.has(lbl));
    const members = g ? [...g.hexes].sort((a, b) => parseHex(a) - parseHex(b)) : [lbl];
    for (const m of members) hexes[m].building = next;
    if (g) report.buildings.push(`building ${next}: ${members.join(', ')} (${[...g.sources].join(', ')})`);
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
    'where a road, trail or railway crosses the hex. Elevation is the transcription\'s unless the audit fixes it.',
    `Task 4's masks audit (design/data/masks-audit.json, per map; ${auditUsed ? 'present: applied' : 'not present yet'}) goes on`,
    'top: its typeUpgrades and levelFixes win, its crest list gives the crest flags (fallback: the hex has a lower',
    'neighbour), and its building groups are merged with the groups from the transcription notes into shared building',
    'ids; every other Building hex is a building of its own.',
    '',
  ];
  if (missing.length) lines.push(`Maps not transcribed yet: ${missing.join(', ')}.`, '');
  lines.push(
    '| Map | Type upgrades | Level fixes | Crest hexes (source) | Multi-hex buildings | Adjacent separate buildings |',
    '|---|---|---|---|---|---|',
  );
  for (const r of reports) {
    lines.push(
      `| ${r.id} | ${r.upgrades.length} | ${r.levels.length} | ${r.crests} (${r.crestSource}) | ${r.buildings.length} | ${r.candidates.length} |`,
    );
  }
  for (const r of reports) {
    if (!r.upgrades.length && !r.refused.length && !r.levels.length && !r.buildings.length && !r.candidates.length && !r.crestDiffs.length) continue;
    lines.push('', `### Map ${r.id}`, '');
    for (const u of r.upgrades) lines.push(`- Upgrade: ${u}`);
    if (r.auditConfirmed) lines.push(`- The masks audit confirms ${r.auditConfirmed} of these types.`);
    for (const u of r.refused) lines.push(`- Not upgraded: ${u}`);
    for (const l of r.levels) lines.push(`- Level: ${l}`);
    for (const c of r.crestDiffs) lines.push(`- Crest (masks audit differs from the neighbour rule): ${c}`);
    for (const b of r.buildings) lines.push(`- Multi-hex building: ${b}`);
    if (r.candidates.length) {
      lines.push(`- Adjacent Building hexes that are separate buildings (* = Objective hex): ${r.candidates.join(', ')}`);
    }
  }
  return lines;
}
