// design/data/scenarios.json (VASSAL setups) + scenario-rules.ts (Playbook facts) → src/data/scenarios/<n>.json
// in the ScenarioDef shape, with hex labels.
import { parseHex } from '../../src/engine/hex';
import type { FortKind, Nation, Posture, Quality, Side } from '../../src/engine/types';
import { SCENARIO_RULES, type SetupAreaJson, type SpecialJson } from './scenario-rules';

const POSTURE: Record<string, Posture> = { Attacker: 'attack', Recon: 'recon', Defender: 'defend' };
const HAND: Record<Posture, number> = { attack: 6, recon: 5, defend: 4 };
const DISCARD: Record<Nation, number> = { German: 6, American: 5, Russian: 3 };
const FORT: Record<string, FortKind> = {
  Wire: 'wire',
  Trench: 'trench',
  Foxholes: 'foxholes',
  Minefield: 'mines',
  Bunker: 'bunker',
  Pillbox: 'pillbox',
  // scenario 11: the module's marker for the Playbook's Bunker (SSR 2)
  'Immobilized Sherman': 'bunker',
};
const SIDES: Side[] = ['axis', 'allied'];

export interface SideJson {
  nation: Nation;
  posture: Posture;
  quality: Quality;
  orders: number;
  handSize: number;
  discard: number;
  surrender: number;
  edge: string;
  forces: Record<string, number>;
  fortifications: Partial<Record<FortKind, number>>;
  reinforcements: Record<string, Record<string, number>>;
  setupArea: SetupAreaJson;
  secretChits: string[];
  minefield?: number;
}

export interface ScenarioJson {
  _source: string;
  id: string;
  name: string;
  map: string;
  year: number;
  sides: Record<Side, SideJson>;
  initiative: Side;
  firstTurn: Side;
  setupFirst: Side;
  time: number;
  suddenDeath: number;
  vp: number;
  control: (Side | null)[];
  openChits: string[];
  prePlaced: { hex: string; fort: FortKind }[];
  special: SpecialJson;
}

const sideOfNation = (n: string): Side => (n === 'German' ? 'axis' : 'allied');

function add(into: Record<string, number>, id: string, n: number) {
  into[id] = (into[id] ?? 0) + n;
}

export function buildScenarios(src: any, counterIds: Set<string>, printedObjectives?: Map<string, string[]>) {
  const out: [number, ScenarioJson][] = [];
  for (const s of src.scenarios) {
    const rules = SCENARIO_RULES[s.number];
    if (!rules) throw new Error(`No rules for scenario ${s.number}`);

    const counter = (side: Side, nation: Nation, name: string): string | null => {
      const rep = rules.replace?.[side]?.[name];
      if (rep !== undefined) return rep;
      const id = `${rules.foreign?.[side]?.[name] ?? nation}/${name}`;
      if (!counterIds.has(id)) throw new Error(`Scenario ${s.number} ${side}: no counter ${id}`);
      return id;
    };

    const sides = {} as Record<Side, SideJson>;
    for (const side of SIDES) {
      const d = s[side];
      const nation = d.nation as Nation;
      const posture = POSTURE[d.posture];
      if (!posture) throw new Error(`Scenario ${s.number}: posture ${d.posture}`);
      const handSize = HAND[posture];
      if (d.hand_size !== handSize) throw new Error(`Scenario ${s.number} ${side}: hand size ${d.hand_size} vs posture ${posture}`);
      const forces: Record<string, number> = {};
      for (const [name, n] of Object.entries<number>(d.units_in_staging_area)) {
        const id = counter(side, nation, name);
        if (id) add(forces, id, n);
      }
      for (const [id, n] of Object.entries(rules.add?.[side]?.forces ?? {})) add(forces, id, n);
      const fortifications: Partial<Record<FortKind, number>> = {};
      for (const [name, n] of Object.entries<number>(d.fortifications_in_staging_area)) {
        const f = FORT[name];
        if (!f) throw new Error(`Scenario ${s.number}: fortification ${name}`);
        fortifications[f] = (fortifications[f] ?? 0) + n;
      }
      const reinforcements: Record<string, Record<string, number>> = {};
      const reinf: [string, Record<string, number>][] = Object.entries<Record<string, number>>(d.reinforcements_by_time_space);
      for (const [space, items] of Object.entries(rules.add?.[side]?.reinforcements ?? {})) reinf.push([space, items]);
      for (const [space, items] of reinf) {
        const into = (reinforcements[space] ??= {});
        for (const [name, n] of Object.entries(items)) {
          const id = name.includes('/') ? name : counter(side, nation, name);
          if (!id || !counterIds.has(id)) throw new Error(`Scenario ${s.number}: reinforcement ${name}`);
          add(into, id, n);
        }
      }
      for (const id of [...Object.keys(forces)]) if (!counterIds.has(id)) throw new Error(`Scenario ${s.number}: ${id}`);
      const reminders: string[] = s.objective_chits.random_objective_reminders;
      const fixed: string[] = s.objective_chits[`${side}_fixed`];
      const secretChits = [...reminders.filter((r) => r.toLowerCase() === side).map(() => 'random')];
      sides[side] = {
        nation,
        posture,
        quality: d.troop_quality.toLowerCase() as Quality,
        orders: d.orders,
        handSize,
        discard: rules.discard?.[side] ?? DISCARD[nation],
        surrender: d.surrender_level,
        edge: rules.edges[side],
        forces: sortKeys(forces),
        fortifications,
        reinforcements,
        setupArea: rules.setup[side],
        secretChits,
      };
      // A chit the module parks in a side's box but that has no secret side is an open chit (scenario 8, W).
      if (fixed.length) sides[side].secretChits.push(...fixed.filter((c) => !'RVWX'.includes(c)));
      const mf = rules.minefield?.[side];
      if (mf !== undefined) sides[side].minefield = mf;
    }

    const openChits: string[] = [...s.objective_chits.open_fixed];
    for (const side of SIDES) openChits.push(...s.objective_chits[`${side}_fixed`].filter((c: string) => 'RVWX'.includes(c)));
    for (const r of s.objective_chits.random_objective_reminders) if (r === 'Open') openChits.push('random');

    const excluded: string[] = s.objective_chits.set_aside;
    const ruleExcluded = rules.special.excludeChits ?? [];
    if ([...excluded].sort().join() !== [...ruleExcluded].sort().join()) {
      throw new Error(`Scenario ${s.number}: module sets aside ${excluded} but the Playbook excludes ${ruleExcluded}`);
    }

    const objectives = [...s.objectives_on_map].sort((a: any, b: any) => a.objective - b.objective);
    const control = objectives.map((o: any) => (o.initial_control ? sideOfNation(o.initial_control) : null));
    const printed = printedObjectives?.get(s.map);
    if (printed && printed.join() !== objectives.map((o: any) => o.hex).join()) {
      throw new Error(`Scenario ${s.number}: objectives ${objectives.map((o: any) => o.hex)} differ from map ${s.map}: ${printed}`);
    }

    const prePlaced = (s.pre_placed_on_map as any[])
      .filter((p) => p.hex) // the Minefield-strength markers have no hex
      .map((p) => {
        const fort = FORT[p.name];
        if (!fort) throw new Error(`Scenario ${s.number}: pre-placed ${p.name}`);
        parseHex(p.hex);
        return { hex: p.hex as string, fort };
      });

    for (const side of SIDES) {
      const a = rules.setup[side];
      if (a.kind === 'near' || a.kind === 'hexes') a.hexes.forEach((h) => parseHex(h));
    }

    const vp = s.vp_marker_start.side_ahead === 'Axis' ? s.vp_marker_start.vp : s.vp_marker_start.side_ahead === 'Allied' ? -s.vp_marker_start.vp : 0;
    out.push([
      s.number,
      {
        _source: `Generated by scripts/build-data.ts from design/data/scenarios.json (VASSAL "${s.module_file}") and scripts/data/scenario-rules.ts (design/scenarios-reference.md). Do not edit by hand.`,
        id: String(s.number),
        name: rules.name,
        map: s.map,
        year: s.year,
        sides,
        initiative: s.initiative_card_starts_with === 'Axis' ? 'axis' : 'allied',
        firstTurn: rules.firstTurn,
        setupFirst: rules.setupFirst,
        time: s.time_marker_start,
        suddenDeath: s.sudden_death_space,
        vp,
        control,
        openChits,
        prePlaced,
        special: rules.special,
      },
    ]);
  }
  return out;
}

function sortKeys(o: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}

/** The conversion notes of every scenario, for design/data-notes.md. */
export function scenarioConversionNotes(): string[] {
  const lines: string[] = [];
  for (const [n, r] of Object.entries(SCENARIO_RULES)) {
    for (const c of r.conversion ?? []) lines.push(`- Scenario ${n} (${r.name}): ${c}`);
  }
  return lines;
}
