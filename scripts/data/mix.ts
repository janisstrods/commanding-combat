// design/data/counter-mix.json (ruling R-56) + the built game data → src/data/mix.json: how many counters of each type
// and how many Fortification markers of each kind the counter mix holds. src/engine/mix.ts reads it; every counter-mix
// limit in the game (RSG purchases, Deploy, Light Wounds, Infiltration, Reinforcements, Hidden Unit, Heroes and named
// Leaders, Fortifications) comes from this one table.
import type { CounterType, FortKind, Nation } from '../../src/engine/types';
import type { RsgTables } from '../../src/engine/rsgTypes';

export interface MixPolicy {
  _rules: string[];
  teamsPerCard: { actions: Record<string, number>; events: Record<string, number> };
  fortPlacers: Record<FortKind, { fixed?: number; actions?: string[]; events?: string[] }>;
  pairings: [Nation, Nation][];
  notInMix: string[];
}

/** The parts of a built scenario (src/data/scenarios/<n>.json) the mix reads. */
interface ScenarioJson {
  id: number;
  sides: Record<string, {
    forces: Record<string, number>;
    reinforcements: Record<string, Record<string, number>>;
    fortifications: Partial<Record<FortKind, number>>;
  }>;
  prePlaced: { hex: string; fort: FortKind }[];
}

/** The parts of a built Fate card (src/data/cards.json) the mix reads. */
interface CardJson {
  nation: string;
  action: string;
  defenderOnly: boolean;
  event: string;
}

const FORT_KINDS: FortKind[] = ['foxholes', 'trench', 'bunker', 'pillbox', 'wire', 'mines'];

/** Where a count comes from, for the notes table. */
interface Why {
  scenario: number;
  ob: number;
  support: number;
  play: number;
}

export function buildMix(policy: MixPolicy, counters: CounterType[], scenarios: ScenarioJson[], rsg: RsgTables, cards: CardJson[]) {
  const why: Record<string, Why> = {};
  const at = (k: string) => (why[k] ??= { scenario: 0, ob: 0, support: 0, play: 0 });
  const atLeast = (k: string, part: keyof Why, n: number) => {
    at(k)[part] = Math.max(at(k)[part], n);
  };

  // the most one base scenario uses (both sides: scenario 7's Allies carry a captured German Light Mortar)
  for (const scn of scenarios) {
    const units: Record<string, number> = {};
    const forts: Record<string, number> = {};
    const add = (into: Record<string, number>, k: string, n: number) => {
      into[k] = (into[k] ?? 0) + n;
    };
    for (const side of Object.values(scn.sides)) {
      for (const [t, n] of Object.entries(side.forces)) add(units, t, n);
      for (const list of Object.values(side.reinforcements)) for (const [t, n] of Object.entries(list)) add(units, t, n);
      for (const [k, n] of Object.entries(side.fortifications)) add(forts, k, n ?? 0);
    }
    for (const p of scn.prePlaced) add(forts, p.fort, 1);
    for (const [t, n] of Object.entries(units)) atLeast(t, 'scenario', n);
    for (const [k, n] of Object.entries(forts)) atLeast(k, 'scenario', n);
  }

  // the most one RSG Order of Battle holds (year pieces included), 1 of anything a Support Table offers
  for (const obs of Object.values(rsg.obs)) {
    for (const ob of Object.values(obs)) {
      for (const s of Object.values(ob.sizes)) {
        const ids = new Set([...Object.keys(s.units), ...(s.unitsByYear ?? []).flatMap((u) => Object.keys(u.units))]);
        for (const id of ids) {
          const extra = Math.max(0, ...(s.unitsByYear ?? []).map((u) => u.units[id] ?? 0));
          atLeast(id, 'ob', (s.units[id] ?? 0) + extra);
        }
      }
    }
  }
  for (const table of Object.values(rsg.support)) {
    for (const item of Object.values(table.items)) for (const id of [...Object.keys(item.pieces), ...(item.oneOf ?? [])]) atLeast(id, 'support', 1);
  }
  for (const f of rsg.fortifications) for (const [k, n] of Object.entries(f.contents)) atLeast(k, 'ob', n ?? 0);

  // what play brings in from the mix: Teams (Light Wounds, Deploy) per nation, Fortifications per pairing of decks
  const deck = (nation: Nation) => cards.filter((c) => c.nation === nation);
  const teamSupply = (nation: Nation) =>
    deck(nation).reduce((n, c) => n + (policy.teamsPerCard.actions[c.action] ?? 0) + (policy.teamsPerCard.events[c.event] ?? 0), 0);
  const placedBy = (nation: Nation, kind: FortKind, defenderOnly: boolean) => {
    const p = policy.fortPlacers[kind];
    return deck(nation).reduce(
      (n, c) => n + (c.defenderOnly === defenderOnly && p.actions?.includes(c.action) ? 1 : 0) + (!defenderOnly && p.events?.includes(c.event) ? 1 : 0),
      0,
    );
  };
  for (const kind of FORT_KINDS) {
    for (const pair of policy.pairings) {
      const open = pair.reduce((n, nation) => n + placedBy(nation, kind, false), 0);
      const hidden = Math.max(...pair.map((nation) => placedBy(nation, kind, true)));
      atLeast(kind, 'play', open + hidden);
    }
  }

  const out: Record<string, number> = {};
  for (const c of counters) {
    if (c.kind === 'leader') {
      out[c.id] = 1;
      continue;
    }
    const w = at(c.id);
    if (c.kind === 'team' && c.quality) w.play = teamSupply(c.nation);
    out[c.id] = Math.max(w.scenario, w.ob, w.support) + w.play;
  }
  const fortifications = {} as Record<FortKind, number>;
  for (const kind of FORT_KINDS) {
    const w = at(kind);
    fortifications[kind] = policy.fortPlacers[kind].fixed ?? Math.max(w.scenario, w.ob) + w.play;
  }

  const mix = {
    _source: 'Generated by scripts/build-data.ts (mix) from design/data/counter-mix.json and src/data (ruling R-56).',
    _notes: [...policy._rules, ...policy.notInMix],
    counters: out,
    fortifications,
  };
  return { mix, notes: mixNotes(policy, counters, out, fortifications, why) };
}

function mixNotes(
  policy: MixPolicy, counters: CounterType[], out: Record<string, number>, forts: Record<FortKind, number>, why: Record<string, Why>,
): string[] {
  const w = (k: string) => why[k] ?? { scenario: 0, ob: 0, support: 0, play: 0 };
  const cell = (n: number) => (n ? String(n) : '–');
  const lines = [
    'The one counter-mix table (`src/data/mix.json`, read by `src/engine/mix.ts`), derived from',
    '`design/data/counter-mix.json` and the game data by ruling R-56 (design/rules-reference.md §20):',
    '',
    ...policy._rules.map((r) => `- ${r}`),
    '',
    'Not in the table:',
    '',
    ...policy.notInMix.map((r) => `- ${r}`),
    '',
    'Columns: the most one base scenario uses, the most one RSG OB (or Fortification OB) holds, 1 if a Support Table',
    'offers it, what one pass through the deck(s) brings in during play, and the count (Leaders: 1 each, not listed).',
    '',
    '### Fortification markers',
    '',
    '| Kind | Scenario | OB | Play | Count |',
    '|---|---|---|---|---|',
    ...(Object.keys(forts) as FortKind[]).map((k) => `| ${k} | ${cell(w(k).scenario)} | ${cell(w(k).ob)} | ${cell(w(k).play)} | ${forts[k]}${policy.fortPlacers[k].fixed ? ' (fixed)' : ''} |`),
  ];
  for (const nation of ['German', 'American', 'Russian'] as Nation[]) {
    lines.push('', `### ${nation} counters`, '', '| Counter | Scenario | OB | Support | Play | Count |', '|---|---|---|---|---|---|');
    for (const c of counters) {
      if (c.nation !== nation || c.kind === 'leader') continue;
      const x = w(c.id);
      lines.push(`| ${c.name} | ${cell(x.scenario)} | ${cell(x.ob)} | ${cell(x.support)} | ${cell(c.kind === 'team' && c.quality ? x.play : 0)} | ${out[c.id]} |`);
    }
  }
  return lines;
}
