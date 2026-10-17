// Converts the research data in design/data into the game data in src/data. Re-runnable; prints what changed.
//
//   npx vite-node scripts/build-data.ts            (everything)
//   npx vite-node scripts/build-data.ts maps       (only some parts: cards counters scenarios maps rsg)
//
// src/data keeps hex labels ("F6"); src/engine/data.ts converts them to HexIds when loading.
import { join } from 'node:path';
import { buildCards } from './data/cards';
import { buildCounters } from './data/counters';
import { readJson, writeJson } from './data/json';

const ROOT = join(__dirname, '..');
const DESIGN = join(ROOT, 'design', 'data');
const OUT = join(ROOT, 'src', 'data');

const parts = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const want = (p: string) => parts.length === 0 || parts.includes(p);

function write(rel: string, value: unknown, width?: number) {
  const changed = writeJson(join(OUT, rel), value, width);
  console.log(`${changed ? 'wrote    ' : 'unchanged'} src/data/${rel}`);
}

const counters = buildCounters(readJson(join(DESIGN, 'counters.json')));
if (want('cards')) write('cards.json', buildCards(readJson(join(DESIGN, 'fate-cards.json'))), 250);
if (want('counters')) write('counters.json', counters);
