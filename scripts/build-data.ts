// Converts the research data in design/data into the game data in src/data. Re-runnable; prints what changed.
//
//   npx vite-node scripts/build-data.ts            (everything)
//   npx vite-node scripts/build-data.ts maps       (only some parts: cards counters scenarios maps rsg)
//
// src/data keeps hex labels ("F6"); src/engine/data.ts converts them to HexIds when loading.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildCards } from './data/cards';
import { buildCounters } from './data/counters';
import { readJson, writeJson } from './data/json';
import { buildMaps, mapNotes } from './data/maps';
import { updateNotesSection } from './data/notes';
import { buildScenarios, scenarioConversionNotes } from './data/scenarios';

const ROOT = join(__dirname, '..');
const DESIGN = join(ROOT, 'design', 'data');
const OUT = join(ROOT, 'src', 'data');
const NOTES = join(ROOT, 'design', 'data-notes.md');

function notes(name: string, title: string, lines: string[]) {
  const changed = updateNotesSection(NOTES, name, title, lines);
  console.log(`${changed ? 'wrote    ' : 'unchanged'} design/data-notes.md (${name})`);
}

const parts = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const want = (p: string) => parts.length === 0 || parts.includes(p);

function write(rel: string, value: unknown, width?: number) {
  const changed = writeJson(join(OUT, rel), value, width);
  console.log(`${changed ? 'wrote    ' : 'unchanged'} src/data/${rel}`);
}

const counters = buildCounters(readJson(join(DESIGN, 'counters.json')));
if (want('cards')) write('cards.json', buildCards(readJson(join(DESIGN, 'fate-cards.json'))), 250);
if (want('counters')) write('counters.json', counters);

if (want('scenarios')) {
  const ids = new Set(counters.counters.map((c) => c.id));
  const printed = new Map<string, string[]>(
    readJson(join(DESIGN, 'maps.json'))
      .maps.filter((m: any) => m.printed_objectives)
      .map((m: any) => [m.map, m.printed_objectives.map((o: any) => o.hex)]),
  );
  const built = buildScenarios(readJson(join(DESIGN, 'scenarios.json')), ids, printed);
  for (const [n, scn] of built) write(`scenarios/${n}.json`, scn);
  notes('scenarios', 'Scenarios (src/data/scenarios/<n>.json)', [
    'Built from design/data/scenarios.json (the VASSAL setups: forces, quality, orders, surrender, time, SD, VP, chits,',
    'initiative, reinforcements, pre-placed pieces) plus scripts/data/scenario-rules.ts (design/scenarios-reference.md:',
    'names, edges, set-up areas and order, first Turn, special rules). Hand size by posture and Discard Capability by',
    'nation unless a special rule says otherwise. Where the Playbook and the module differ, the Playbook wins.',
    '',
    '### Conversion calls',
    '',
    ...scenarioConversionNotes(),
    '',
    '### Special rules the SpecialRules fields cannot express (`special.notes`; each needs code in Task 1 / 7-10)',
    '',
    ...built.flatMap(([n, scn]) => (scn.special.notes ?? []).map((t) => `- Scenario ${n} (${scn.name}): ${t}`)),
  ]);
}

if (want('maps')) {
  const auditPath = join(DESIGN, 'masks-audit.json');
  const audit = existsSync(auditPath) ? readJson(auditPath) : null;
  const { maps, reports, missing } = buildMaps(DESIGN, audit);
  for (const m of maps) write(`maps/${m.id}.json`, m);
  notes('maps', 'Maps (src/data/maps/<id>.json)', mapNotes(reports, missing, audit !== null));
  if (missing.length) console.log(`maps not transcribed yet (skipped): ${missing.join(', ')}`);
}
