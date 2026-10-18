// The players of the AI match scripts (ai-match.ts, ai-probe.ts): the current AI's levels, the frozen v1.0.0 AI's
// levels (scripts/ai-v1, the head-to-head baseline), random play and 'greedy' (the current policies with a greedy Turn
// rule and no simulations). Every AI decision is made on `redact(state, side)`, as in the browser.
//
// A current level may carry changes to its configuration for experiments: `line@lookahead=1@maxCands=20`.
//
// Budgets: by default each level thinks for its own time budget (wall clock). `scale` multiplies that budget;
// `effort` replaces the clock by a simulation count per own-Turn search — what the player reaches in its budget on a
// quiet machine in that scenario (ai-effort.ts, measured by `ai-probe.ts --calibrate`) times `effort` — so results do
// not depend on the machine's load and repeat for a seed.
import { chooseAnswer, newMemory, type AiLevel, type AiMemory } from '../src/ai/index';
import { LEVELS, type LevelCfg } from '../src/ai/levels';
import { newPolicyCtx, policyAnswer } from '../src/ai/policies';
import { Rng } from '../src/ai/rand';
import { randomAnswer } from '../src/engine/random';
import { redact } from '../src/engine/state';
import type { Answer, Decision, GameState, Side } from '../src/engine/types';
import { SIMS_PER_SEC } from './ai-effort';
import * as v1 from './ai-v1/index';
import { LEVELS as V1_LEVELS } from './ai-v1/levels';

/** A player: a level of the current AI (with optional `@field=value` changes), `v1-<level>`, random or greedy. */
export type Player = string;
const BASE = ['green', 'line', 'elite', 'v1-green', 'v1-line', 'v1-elite', 'random', 'greedy'];

export interface Budget {
  /** ms per own-Turn decision for every AI player (overrides the levels'). */
  budget?: number;
  /** Each level's own budget times this. */
  scale?: number;
  /** Effort mode: simulations per own-Turn search = what the player reaches in its budget times this (no clock). */
  effort?: number;
}

/** What one player's last own-Turn decision did (diagnostics). */
export interface LastTurn {
  label?: string;
  sims?: number;
  ms: number;
  stop?: string;
}

export interface Brain {
  readonly player: Player;
  decide(state: GameState, d: Decision): Answer;
  /** The last decision's diagnostics. */
  last(): LastTurn | null;
  fallbacks(): number;
  /** Battle-plan log lines since the last call (current AI only). */
  drainLog(): string[];
}

/** The level and configuration changes of a current-AI player (`line@lookahead=1`), or null for other players. */
export function parsePlayer(p: Player): { level: AiLevel; patch: Partial<LevelCfg> } | null {
  const [name, ...mods] = p.split('@');
  if (!(name in LEVELS)) return null;
  const patch: Record<string, unknown> = {};
  for (const m of mods) {
    const [k, v] = m.split('=');
    if (!(k in LEVELS.line)) throw new Error(`unknown level field '${k}' in '${p}'`);
    patch[k] = v === 'true' ? true : v === 'false' ? false : typeof (LEVELS.line as unknown as Record<string, unknown>)[k] === 'boolean' ? v !== '0' : Number(v);
  }
  return { level: name as AiLevel, patch: patch as Partial<LevelCfg> };
}

export function playerOk(p: Player): boolean {
  return BASE.includes(p) || parsePlayer(p) !== null;
}

/** The own-Turn budget (ms) of player `p` (its level's, or the configuration change's). */
export function budgetMsOf(p: Player): number {
  if (p.startsWith('v1-')) return V1_LEVELS[p.slice(3) as AiLevel].budgetMs;
  const x = parsePlayer(p);
  return x ? { ...LEVELS[x.level], ...x.patch }.budgetMs : 0;
}

/** Simulations per own-Turn search in effort mode for player `p` in scenario `id`. */
export function effortSims(p: Player, id: string, effort: number): number {
  // a configuration change of a current level shares its level's rates (re-calibrate if it changes a simulation's work)
  const rates = SIMS_PER_SEC[p] ?? SIMS_PER_SEC[p.split('@')[0]];
  if (!rates) throw new Error(`no effort calibration for '${p}' (run scripts/ai-probe.ts --calibrate --players ${p})`);
  const rate = rates[id] ?? median(Object.values(rates));
  return Math.max(1, Math.round((budgetMsOf(p) / 1000) * rate * effort));
}

const median = (x: number[]) => x.slice().sort((a, b) => a - b)[Math.floor(x.length / 2)];

/** A player for `side` in scenario `id` (its private seed from the game's). */
export function makeBrain(player: Player, side: Side, seed: number, b: Budget = {}, id = '1'): Brain {
  const aiSeed = seed * 2 + (side === 'axis' ? 1 : 2);
  if (player === 'random') {
    const rnd = new Rng(seed * 7 + (side === 'axis' ? 3 : 5));
    return { player, decide: (s, d) => randomAnswer(s, d, () => rnd.next()), last: () => null, fallbacks: () => 0, drainLog: () => [] };
  }
  if (player === 'greedy') {
    const pc = { ...newPolicyCtx(side, LEVELS.line, new Rng(seed + 11)), quickMoves: true };
    return { player, decide: (s, d) => policyAnswer(redact(s, d.side), d, pc), last: () => null, fallbacks: () => 0, drainLog: () => [] };
  }
  const simBudget = b.effort ? effortSims(player, id, b.effort) : undefined;
  if (player.startsWith('v1-')) {
    const level = player.slice(3) as AiLevel;
    const mem = v1.newMemory(aiSeed);
    const opts: v1.AiOptions = {
      side, level, simBudget,
      timeBudgetMs: b.budget ?? (b.scale ? V1_LEVELS[level].budgetMs * b.scale : undefined),
    };
    return {
      player,
      decide: (s, d) => v1.chooseAnswer(redact(s, d.side), d, opts, mem).answer,
      last: () => (mem.last ? { label: mem.last.label, sims: mem.last.sims, ms: mem.last.ms } : null),
      fallbacks: () => mem.fallbacks,
      drainLog: () => [],
    };
  }
  const x = parsePlayer(player);
  if (!x) throw new Error(`unknown player '${player}'`);
  const mem: AiMemory = newMemory(aiSeed);
  const opts = {
    side, level: x.level, simBudget, patch: Object.keys(x.patch).length ? x.patch : undefined,
    timeBudgetMs: b.budget ?? (b.scale ? budgetMsOf(player) * b.scale : undefined),
  };
  return {
    player,
    decide: (s, d) => chooseAnswer(redact(s, d.side), d, opts, mem).answer,
    last: () => (mem.last ? { label: mem.last.label, sims: mem.last.sims, ms: mem.last.ms, stop: mem.last.stop } : null),
    fallbacks: () => mem.fallbacks,
    drainLog: () => mem.log.splice(0),
  };
}
