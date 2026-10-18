// AI-vs-AI (or AI-vs-random) matches over chosen scenarios and seeds, printing each result and a summary. Every AI
// decision is made on `redact(state, side)`, exactly as in the browser (worker or not).
//
//   npx vite-node scripts/ai-match.ts -- --scenario 1 --games 2
//   npx vite-node scripts/ai-match.ts -- --scenario 1,3 --axis line --allied random --games 4 --seed 7 --budget 800
//   npx vite-node scripts/ai-match.ts -- --scenario 3,11 --axis elite --allied v1-elite --games 4 --swap --effort 1
//
// Options: --scenario <ids|all> (default 1), --games <n per scenario> (default 2), --axis / --allied <player> (default
// line), --seed <n> (default 1), --swap (also play every game with the sides' players swapped), --max <decisions per
// game> (default 20000), --out <file> (one JSON line per game), --verbose (one line per own-Turn decision and the
// battle plans), --plans (the battle plans and re-plans only).
// Budgets: by default each level thinks for its own time (wall clock); --budget <ms> for every AI, --scale <x> times
// each level's own; --effort <x>: no clock — each own-Turn search gets x times the simulations the level reaches in its
// budget on a quiet machine (scripts/ai-effort.ts, per scenario), so results do not depend on the machine's load and
// repeat for a seed.
// Players: green, line, elite (the current AI), v1-green, v1-line, v1-elite (the frozen v1.0.0 AI, scripts/ai-v1),
// random, greedy (policies only, no simulations). A current level may carry config changes for experiments:
// line@lookahead=1@maxCands=20 (levels.ts LevelCfg fields).
import { writeFileSync, appendFileSync } from 'node:fs';
import { SCENARIOS, scenario } from '../src/engine/data';
import { GameDriver } from '../src/engine/driver';
import { newGame } from '../src/engine/state';
import type { Side } from '../src/engine/types';
import { makeBrain, playerOk, type Budget, type Player } from './ai-players';

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

export interface SideStats {
  player: Player;
  posture: string;
  /** Own-Turn decisions, their mean time and simulations, and the slowest. */
  turns: number;
  ms: number;
  sims: number;
  slowest: number;
  /** Why the searches stopped (counts). */
  stops: Record<string, number>;
  fallbacks: number;
  plans: number;
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
  sides: Record<Side, SideStats>;
}

/** Play one game between `players` on scenario `id` with `seed`. */
export function playMatch(
  id: string, seed: number, players: Record<Side, Player>, opts: Budget & { max?: number; verbose?: boolean; plans?: boolean } = {},
): MatchResult {
  const d = new GameDriver(newGame(scenario(id), seed));
  const brains = { axis: makeBrain(players.axis, 'axis', seed, opts, id), allied: makeBrain(players.allied, 'allied', seed, opts, id) };
  const stats = (side: Side): SideStats => ({
    player: players[side], posture: d.state.players[side].posture, turns: 0, ms: 0, sims: 0, slowest: 0, stops: {}, fallbacks: 0, plans: 0,
  });
  const st: Record<Side, SideStats> = { axis: stats('axis'), allied: stats('allied') };
  const t0 = performance.now();
  let n = 0;
  const max = opts.max ?? 20000;
  while (d.pending && n < max) {
    const dec = d.pending;
    const brain = brains[dec.side];
    const turnBefore = d.state.turn.number;
    const vpBefore = d.state.vp;
    const a = brain.decide(d.state, dec);
    if (dec.kind === 'turn') {
      const l = brain.last();
      if (l) {
        const x = st[dec.side];
        x.turns++;
        x.ms += l.ms;
        x.sims += l.sims ?? 0;
        x.slowest = Math.max(x.slowest, l.ms);
        if (l.stop) x.stops[l.stop] = (x.stops[l.stop] ?? 0) + 1;
        if (opts.verbose) console.log(`  T${turnBefore} ${dec.side}: ${l.label ?? a.kind} (${l.sims ?? 0} sims, ${Math.round(l.ms)} ms, ${l.stop ?? '-'}) VP ${vpBefore}`);
      }
    }
    for (const line of brain.drainLog()) {
      st[dec.side].plans++;
      if (opts.verbose || opts.plans) console.log(`  ${line}`);
    }
    if (!d.answer(a)) throw new Error(`${dec.side} (${players[dec.side]}) gave a refused answer to ${dec.kind}: ${d.lastError} ${JSON.stringify(a)}`);
    n++;
  }
  for (const side of ['axis', 'allied'] as Side[]) {
    st[side].fallbacks = brains[side].fallbacks();
    if (st[side].turns) {
      st[side].ms /= st[side].turns;
      st[side].sims /= st[side].turns;
    }
  }
  const s = d.state;
  return {
    scenario: id, seed, players, winner: s.winner, reason: s.endReason, vp: s.vp, turns: s.turn.number, decisions: n,
    ms: performance.now() - t0, sides: st,
  };
}

function main(): void {
  const a = args();
  const ids = !a.scenario || a.scenario === 'all' ? (a.scenario === 'all' ? SCENARIOS.map((x) => x.id) : ['1']) : a.scenario.split(',');
  const games = Number(a.games ?? 2);
  const seed0 = Number(a.seed ?? 1);
  const base: Record<Side, Player> = { axis: (a.axis as Player) ?? 'line', allied: (a.allied as Player) ?? 'line' };
  for (const p of [base.axis, base.allied]) if (!playerOk(p)) throw new Error(`unknown player '${p}'`);
  const budget: Budget = {
    budget: a.budget ? Number(a.budget) : undefined,
    scale: a.scale ? Number(a.scale) : undefined,
    effort: a.effort ? Number(a.effort) : undefined,
  };
  if (a.out) writeFileSync(a.out, '');
  const tally: Record<string, number> = {};
  for (const id of ids) {
    for (let g = 0; g < games; g++) {
      const seed = seed0 + g;
      const variants: Record<Side, Player>[] = [base];
      if (a.swap === 'true') variants.push({ axis: base.allied, allied: base.axis });
      for (const players of variants) {
        let r: MatchResult;
        try {
          r = playMatch(id, seed, players, { ...budget, max: a.max ? Number(a.max) : undefined, verbose: a.verbose === 'true', plans: a.plans === 'true' });
        } catch (e) {
          console.log(`scenario ${id} seed ${seed} axis=${players.axis} allied=${players.allied}: ERROR ${e instanceof Error ? e.message : String(e)}`);
          continue;
        }
        const w = r.winner ? `${r.winner} (${r.players[r.winner]})` : 'none';
        const side = (x: SideStats) => `${x.player} ${x.turns} Turns ${Math.round(x.ms)} ms ${Math.round(x.sims)} sims`;
        const fb = r.sides.axis.fallbacks + r.sides.allied.fallbacks;
        console.log(
          `scenario ${id} seed ${seed} axis=${players.axis} allied=${players.allied}: winner ${w} by ${r.reason} — VP ${r.vp}, ` +
            `${r.turns} turns, ${r.decisions} decisions, ${(r.ms / 1000).toFixed(1)} s [${side(r.sides.axis)} | ${side(r.sides.allied)}]` +
            (fb ? `, ${fb} fallbacks` : ''),
        );
        if (a.out) appendFileSync(a.out, JSON.stringify(r) + '\n');
        if (r.winner) tally[r.players[r.winner]] = (tally[r.players[r.winner]] ?? 0) + 1;
      }
    }
  }
  console.log('wins by player:', JSON.stringify(tally));
}

if (!process.env.VITEST) main();
