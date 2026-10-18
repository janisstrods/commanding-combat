// Probe the AI's own-Turn search on a fixed set of positions: for each player, the simulations, the time and why the
// search stopped (the clock, the world count, an early stop). Measures the real ms per decision of each level, and
// calibrates the effort mode (--calibrate: simulations per second per scenario, for scripts/ai-effort.ts).
//
//   npx vite-node scripts/ai-probe.ts -- --players v1-line,line --scenario 1,3,9 --turns 3,7,12
//   npx vite-node scripts/ai-probe.ts -- --calibrate --players line,elite,v1-line,v1-elite
//
// Positions come from v1-green vs v1-green games (fixed, whatever the current AI does): the first own-Turn decision of
// each listed Turn with at least two Orders to choose from. Options: --players (default line), --scenario (default
// 1,2,3,4,5,6,8,9,10,11,12), --turns (default 3,7,12), --seed (default 1), --scale / --budget / --effort as in
// ai-match.ts; --calibrate [--sims n] (default 240, Elite-like players 120) and --reps (default 2); --plans: the battle
// plan the side to move would make in each position (--turns 1,2: the first plans).
import { scenario } from '../src/engine/data';
import { GameDriver } from '../src/engine/driver';
import { newGame, redact, cloneState } from '../src/engine/state';
import type { Decision, GameState } from '../src/engine/types';
import { describePlan, makePlan } from '../src/ai/battleplan';
import { chooseAnswer, newMemory } from '../src/ai/index';
import * as v1 from './ai-v1/index';
import { budgetMsOf, makeBrain, parsePlayer, playerOk, type Budget, type Player } from './ai-players';

function args(): Record<string, string> {
  const out: Record<string, string> = {};
  const list = process.argv.slice(2).filter((a) => a !== '--');
  for (let i = 0; i < list.length; i++) {
    if (!list[i].startsWith('--')) continue;
    const k = list[i].slice(2);
    out[k] = list[i + 1] && !list[i + 1].startsWith('--') ? list[++i] : 'true';
  }
  return out;
}

interface Position {
  scenario: string;
  turn: number;
  state: GameState;
  d: Decision;
}

/** Positions of scenario `id`: v1-green plays both sides; the first own-Turn decision of each Turn in `turns`. */
export function positions(id: string, seed: number, turns: number[]): Position[] {
  const drv = new GameDriver(newGame(scenario(id), seed));
  const brains = { axis: makeBrain('v1-green', 'axis', seed), allied: makeBrain('v1-green', 'allied', seed) };
  const out: Position[] = [];
  const want = new Set(turns);
  for (let n = 0; n < 20000 && drv.pending && want.size; n++) {
    const d = drv.pending;
    const t = drv.state.turn.number;
    if (d.kind === 'turn' && want.has(t) && d.orders.length >= 2 && drv.state.turn.ordersGiven === 0) {
      out.push({ scenario: id, turn: t, state: cloneState(drv.state), d });
      want.delete(t);
    }
    if (!drv.answer(brains[d.side].decide(drv.state, d))) throw new Error(`refused: ${drv.lastError}`);
  }
  return out;
}

/** One search of `p` on `pos` with a fixed simulation count and no clock or early stop: [sims, ms]. */
function timed(p: Player, pos: Position, sims: number): [number, number] {
  const view = redact(pos.state, pos.d.side);
  if (p.startsWith('v1-')) {
    const mem = v1.newMemory(7);
    v1.chooseAnswer(view, pos.d, { side: pos.d.side, level: p.slice(3) as never, deterministic: true, simBudget: sims }, mem);
    return [mem.last?.sims ?? 0, mem.last?.ms ?? 0];
  }
  const x = parsePlayer(p)!;
  const mem = newMemory(7);
  chooseAnswer(view, pos.d, { side: pos.d.side, level: x.level, deterministic: true, simBudget: sims, patch: { ...x.patch, clear: 0 } }, mem);
  return [mem.last?.sims ?? 0, mem.last?.ms ?? 0];
}

function calibrate(players: Player[], all: Position[], a: Record<string, string>): void {
  const reps = Number(a.reps ?? 2);
  // positions outside, players inside: the players' runs on a position are close in time, so their ratios hold under load
  const per: Record<string, Record<string, number[]>> = {};
  for (const pos of all) {
    const row: string[] = [];
    for (const p of players) {
      const k = Number(a.sims ?? (p.includes('elite') ? 120 : 240));
      let best = Infinity;
      let n = 0;
      for (let r = 0; r < reps; r++) {
        const [sims, ms] = timed(p, pos, k);
        if (sims && ms / sims < best) {
          best = ms / sims;
          n = sims;
        }
      }
      if (!n) continue;
      ((per[p] ??= {})[pos.scenario] ??= []).push(1000 / best);
      row.push(`${p} ${best.toFixed(2)} ms/sim (${n})`);
    }
    console.log(`S${pos.scenario} T${pos.turn}: ${row.join(' | ')}`);
  }
  const med = (x: number[]) => x.slice().sort((p, q) => p - q)[Math.floor(x.length / 2)];
  const out: Record<string, Record<string, number>> = {};
  for (const [p, byId] of Object.entries(per)) {
    out[p] = {};
    for (const [id, rates] of Object.entries(byId)) out[p][id] = Math.round(med(rates));
  }
  console.log(`calibration (sims per second, median of the positions per scenario):\n${JSON.stringify(out, null, 2)}`);
  if (players.length > 1) {
    const ref = players[0];
    for (const p of players.slice(1)) {
      const ratios: number[] = [];
      for (const id of Object.keys(per[ref] ?? {})) {
        const x = per[ref][id];
        const y = per[p]?.[id];
        if (y) for (let i = 0; i < Math.min(x.length, y.length); i++) ratios.push(x[i] / y[i]);
      }
      console.log(`cost of a ${p} simulation relative to ${ref}: median ${med(ratios).toFixed(2)} (${ratios.length} positions)`);
    }
  }
}

function budgetOf(p: Player, b: Budget): number {
  return b.budget ?? budgetMsOf(p) * (b.scale ?? 1);
}

function main(): void {
  const a = args();
  const players = (a.players ?? 'line').split(',');
  for (const p of players) if (!playerOk(p)) throw new Error(`unknown player '${p}'`);
  const ids = (a.scenario ?? '1,2,3,4,5,6,8,9,10,11,12').split(',');
  const turns = (a.turns ?? '3,7,12').split(',').map(Number);
  const seed = Number(a.seed ?? 1);
  const b: Budget = { budget: a.budget ? Number(a.budget) : undefined, scale: a.scale ? Number(a.scale) : undefined, effort: a.effort ? Number(a.effort) : undefined };
  const all: Position[] = [];
  for (const id of ids) all.push(...positions(id, seed, turns));
  console.log(`${all.length} positions`);
  if (a.calibrate === 'true') return calibrate(players, all, a);
  if (a.plans === 'true') {
    // the battle plan each position's side would make now (first plans: --turns 1,2)
    for (const pos of all) {
      const v = redact(pos.state, pos.d.side);
      const plan = makePlan(v, pos.d.side, 'probe');
      console.log(`S${pos.scenario} ${plan ? describePlan(v, pos.d.side, plan, null) : 'no plan'}`);
    }
    return;
  }
  const stats: Record<string, { ms: number[]; sims: number[]; clock: number[] }> = {};
  for (const pos of all) {
    const row: string[] = [];
    for (const p of players) {
      const brain = makeBrain(p, pos.d.side, seed + 101, b, pos.scenario);
      brain.decide(pos.state, pos.d);
      const l = brain.last()!;
      const st = (stats[p] ??= { ms: [], sims: [], clock: [] });
      st.ms.push(l.ms);
      st.sims.push(l.sims ?? 0);
      if (!b.effort && l.ms >= 0.97 * budgetOf(p, b)) st.clock.push(l.sims ?? 0);
      row.push(`${p}: ${l.sims ?? 0} sims ${Math.round(l.ms)} ms ${l.stop ?? ''} "${l.label}"`);
    }
    console.log(`S${pos.scenario} T${pos.turn} ${pos.d.side} (${redact(pos.state, pos.d.side).turn.number}) | ${row.join(' | ')}`);
  }
  const med = (x: number[]) => (x.length ? x.slice().sort((p, q) => p - q)[Math.floor(x.length / 2)] : 0);
  const mean = (x: number[]) => (x.length ? x.reduce((p, q) => p + q, 0) / x.length : 0);
  for (const p of players) {
    const st = stats[p];
    if (!st) continue;
    console.log(
      `${p}: mean ${Math.round(mean(st.ms))} ms, max ${Math.round(Math.max(...st.ms))} ms; sims mean ${Math.round(mean(st.sims))}, median ${med(st.sims)}; ` +
        `clock-limited ${st.clock.length}/${st.ms.length}, their sims median ${med(st.clock)} mean ${Math.round(mean(st.clock))}`,
    );
  }
}

if (!process.env.VITEST) main();
