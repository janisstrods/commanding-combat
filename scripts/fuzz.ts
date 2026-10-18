// Fuzz the engine: random legal games over the twelve scenarios and RSG scenarios, with tiny-deck variants, checking
// every answer, the state's invariants and the replay (scripts/fuzzlib.ts). Prints each failure with its scenario and
// seed (and the command that replays it), then a summary. Exit code 1 if anything failed.
//
//   npx vite-node scripts/fuzz.ts -- --games 500                (scenarios 1-12 and RSG in turn, every 3rd game tiny)
//   npx vite-node scripts/fuzz.ts -- --games 50 --scenario 7    (one scenario; 'rsg' for random scenarios)
//   npx vite-node scripts/fuzz.ts -- --games 100 --tiny-decks   (all with decks of 10 cards; --tiny-decks 8 for 8)
//   npx vite-node scripts/fuzz.ts -- --seed 1000                (first seed; game i uses seed + i)
//   options: --max-answers N (default 20000), --tiny-every K (default 3, 0 = never), --fast (invariants at Turn starts
//   only), --no-replay, --quiet (failures and the summary only)
import { FUZZ_SCENARIOS, fuzzGame, reproduce, type FuzzResult } from './fuzzlib';

const argv = process.argv.slice(2).filter((a) => a !== '--');
function opt(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  return v === undefined || v.startsWith('--') ? '' : v;
}
const games = Number(opt('games') ?? 100);
const only = opt('scenario');
const tinyArg = opt('tiny-decks');
const tinyAll = tinyArg !== undefined ? Number(tinyArg || 10) : 0;
const tinyEvery = Number(opt('tiny-every') ?? 3);
const seed0 = Number(opt('seed') ?? 1);
const maxAnswers = Number(opt('max-answers') ?? 20000);
const fast = opt('fast') !== undefined;
const replay = opt('no-replay') === undefined;
const quiet = opt('quiet') !== undefined;

const scenarios = only ? [only] : FUZZ_SCENARIOS;
const results: FuzzResult[] = [];
const t0 = Date.now();
for (let i = 0; i < games; i++) {
  const scenario = scenarios[i % scenarios.length];
  const seed = seed0 + i;
  const tiny = tinyAll || (tinyEvery > 0 && i % tinyEvery === tinyEvery - 1 ? 10 : 0);
  process.stderr.write(`\r${i + 1}/${games} scenario ${scenario} seed ${seed}${tiny ? ` tiny ${tiny}` : ''}        `);
  const r = fuzzGame({ scenario, seed, tiny, maxAnswers, everyAnswer: !fast, replay });
  results.push(r);
  if (r.error) {
    process.stderr.write('\n');
    console.log(`FAIL scenario ${r.scenario} seed ${r.seed}${r.tiny ? ` tiny ${r.tiny}` : ''} after ${r.answers} answers${r.at ? ` at ${r.at}` : ''}: ${r.error}`);
    console.log(`  replay: ${reproduce(r)}`);
  } else if (!quiet) {
    console.log(`ok   scenario ${r.scenario} seed ${r.seed}${r.tiny ? ` tiny ${r.tiny}` : ''}: ${r.phase === 'over' ? `${r.winner} by ${r.endReason}` : 'capped'} after ${r.answers} answers (${r.ms} ms)`);
  }
}
process.stderr.write('\n');

const failed = results.filter((r) => r.error);
const capped = results.filter((r) => !r.error && r.phase !== 'over');
const tally = <K extends string>(f: (r: FuzzResult) => K) => {
  const m: Record<string, number> = {};
  for (const r of results) m[f(r)] = (m[f(r)] ?? 0) + 1;
  return m;
};
console.log('');
console.log(`games ${results.length}, failed ${failed.length}, capped ${capped.length}, tiny-deck ${results.filter((r) => r.tiny).length}`);
console.log(`answers ${results.reduce((n, r) => n + r.answers, 0)}, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`end reasons ${JSON.stringify(tally((r) => (r.error ? 'failed' : r.endReason ?? 'capped')))}`);
console.log(`failures by scenario ${JSON.stringify(Object.fromEntries(Object.entries(tally((r) => (r.error ? r.scenario : 'ok'))).filter(([k]) => k !== 'ok')))}`);
process.exit(failed.length ? 1 : 0);
