// AI-vs-AI (or AI-vs-random) matches over chosen scenarios and seeds, printing each result and a summary. Every AI
// decision is made on `redact(state, side)`, exactly as in the browser (worker or not).
//
//   npx vite-node scripts/ai-match.ts -- --scenario 1 --games 2
//   npx vite-node scripts/ai-match.ts -- --scenario 1,3 --axis line --allied random --games 4 --seed 7 --budget 800
//
// Options: --scenario <ids|all> (default 1), --games <n per scenario> (default 2), --axis / --allied
// <green|line|elite|random> (default line), --seed <n> (default 1), --budget <ms per own-Turn decision> (default: the
// level's), --swap (also play every game with the sides' players swapped), --max <decisions per game> (default 20000),
// --verbose (one line per Order).
import { chooseAnswer, newMemory, type AiLevel, type AiMemory } from '../src/ai/index';
import { Rng } from '../src/ai/rand';
import { SCENARIOS, scenario } from '../src/engine/data';
import { GameDriver } from '../src/engine/driver';
import { randomAnswer } from '../src/engine/random';
import { newGame, redact } from '../src/engine/state';
import type { Side } from '../src/engine/types';

type Player = AiLevel | 'random';

function args(): Record<string, string> {
  const out: Record<string, string> = {};
  const list = process.argv.slice(2).filter((a) => a !== '--');
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const v = list[i + 1] && !list[i + 1].startsWith('--') ? list[++i] : 'true';
    out[k] = v;
  }
  return out;
}

export interface MatchResult {
  scenario: string;
  seed: number;
  players: Record<Side, Player>;
  winner: Side | null;
  reason: string | null;
  vp: number;
  turns: number;
  decisions: number;
  ms: number;
  slowest: number;
  fallbacks: number;
}

/** Play one game between `players` on scenario `id` with `seed`. */
export function playMatch(id: string, seed: number, players: Record<Side, Player>, opts: { budget?: number; max?: number; verbose?: boolean } = {}): MatchResult {
  const d = new GameDriver(newGame(scenario(id), seed));
  const mem: Record<Side, AiMemory> = { axis: newMemory(seed * 2 + 1), allied: newMemory(seed * 2 + 2) };
  const rnd = new Rng(seed * 7 + 3);
  const t0 = performance.now();
  let n = 0;
  let slowest = 0;
  const max = opts.max ?? 20000;
  while (d.pending && n < max) {
    const dec = d.pending;
    const who = players[dec.side];
    let a;
    if (who === 'random') a = randomAnswer(d.state, dec, () => rnd.next());
    else {
      const t = performance.now();
      a = chooseAnswer(redact(d.state, dec.side), dec, { side: dec.side, level: who, timeBudgetMs: opts.budget }, mem[dec.side]).answer;
      slowest = Math.max(slowest, performance.now() - t);
      if (opts.verbose && dec.kind === 'turn') {
        const m = mem[dec.side].last;
        console.log(`  T${d.state.turn.number} ${dec.side}: ${m?.label ?? a.kind} (${m?.sims ?? 0} sims, ${Math.round(m?.ms ?? 0)} ms) VP ${d.state.vp}`);
      }
    }
    if (!d.answer(a)) throw new Error(`${dec.side} (${who}) gave a refused answer to ${dec.kind}: ${d.lastError} ${JSON.stringify(a)}`);
    n++;
  }
  const s = d.state;
  return {
    scenario: id, seed, players, winner: s.winner, reason: s.endReason, vp: s.vp, turns: s.turn.number, decisions: n,
    ms: performance.now() - t0, slowest, fallbacks: mem.axis.fallbacks + mem.allied.fallbacks,
  };
}

function main(): void {
  const a = args();
  const ids = !a.scenario || a.scenario === 'all' ? (a.scenario === 'all' ? SCENARIOS.map((x) => x.id) : ['1']) : a.scenario.split(',');
  const games = Number(a.games ?? 2);
  const seed0 = Number(a.seed ?? 1);
  const base: Record<Side, Player> = { axis: (a.axis as Player) ?? 'line', allied: (a.allied as Player) ?? 'line' };
  const budget = a.budget ? Number(a.budget) : undefined;
  const tally: Record<string, number> = {};
  for (const id of ids) {
    for (let g = 0; g < games; g++) {
      const seed = seed0 + g;
      const variants: Record<Side, Player>[] = [base];
      if (a.swap === 'true') variants.push({ axis: base.allied, allied: base.axis });
      for (const players of variants) {
        const r = playMatch(id, seed, players, { budget, max: a.max ? Number(a.max) : undefined, verbose: a.verbose === 'true' });
        const w = r.winner ? `${r.winner} (${r.players[r.winner]})` : 'none';
        console.log(
          `scenario ${id} seed ${seed} axis=${players.axis} allied=${players.allied}: winner ${w} by ${r.reason} — VP ${r.vp}, ` +
            `${r.turns} turns, ${r.decisions} decisions, ${(r.ms / 1000).toFixed(1)} s (slowest ${Math.round(r.slowest)} ms)` +
            (r.fallbacks ? `, ${r.fallbacks} fallbacks` : ''),
        );
        if (r.winner) tally[r.players[r.winner]] = (tally[r.players[r.winner]] ?? 0) + 1;
      }
    }
  }
  console.log('wins by player:', JSON.stringify(tally));
}

main();
