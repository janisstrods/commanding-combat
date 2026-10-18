// The computer opponent of Combat Commander: Europe.
//
// chooseAnswer() answers any engine Decision for the AI's side from `redact(state, side)` alone — the opponent's hand,
// both draw piles' order and the opponent's secret chits are unknowns there, so the AI cannot cheat. Its own Turn is
// planned by simulation (planner.ts: candidate Orders played through the real engine on determinised copies, re-planned
// before every Order); everything else is answered by quick expected-value policies (policies.ts, choose.ts, moves.ts,
// deploy.ts). Every answer is checked with the engine's own validator (`answerError`) before it is returned; a refused
// or failed one is replaced by a safe legal answer and counted in the memory (`fallbacks`, an AI bug when not 0).
import { answerError } from '../engine/decisions';
import { redact } from '../engine/state';
import type { Answer, Decision, GameState, HexId, PieceId, Side } from '../engine/types';
import type { DeployMemo } from './deploy';
import { isViewFor } from './determinize';
import { LEVELS, type AiLevel } from './levels';
import { planTurn } from './planner';
import { newPolicyCtx, policyAnswer, type Plan } from './policies';
import { Rng, entropySeed } from './rand';
import { safeAnswer } from './sim';

export type { AiLevel } from './levels';
export { AI_LEVELS, LEVELS } from './levels';
export { planDeployment, type Placement } from './deploy';

export interface AiOptions {
  side: Side;
  level: AiLevel;
  /** Thinking time for an own-Turn decision, ms (default: the level's — Green 0.6 s, Line 2.5 s, Elite 4 s). */
  timeBudgetMs?: number;
  /** Seed of the AI's private RNG (default: from Math.random on first use). */
  seed?: number;
  /** Limit the search by simulation counts only, not by the clock (reproducible decisions for a seed; tests). */
  deterministic?: boolean;
}

/** Per-game memory of one AI player: plain data (structured-clone safe), kept by the caller between decisions. */
export interface AiMemory {
  rngState: number;
  plan: Plan | null;
  lastFire: { pieces: PieceId[]; target: HexId; turn: number } | null;
  opFireHex: HexId | null;
  deploy: DeployMemo | null;
  /** Answers replaced by a safe one because the AI's was refused or it threw (an AI bug when not 0). */
  fallbacks: number;
  /** Diagnostics of the last decision. */
  last: { kind: Decision['kind']; ms: number; sims?: number; label?: string; alternatives?: { label: string; score: number; n: number }[] } | null;
  /** Turn number of the last line said (one flavour line per Turn at most). */
  saidTurn: number;
}

export function newMemory(seed?: number): AiMemory {
  return { rngState: seed ?? 0, plan: null, lastFire: null, opFireHex: null, deploy: null, fallbacks: 0, last: null, saidTurn: -1 };
}

export interface AiResult {
  answer: Answer;
  say?: string;
}

const now = (): number => (globalThis.performance ? globalThis.performance.now() : Date.now());

/** The view `side` may see: `view` itself when it is one, else its redaction (a full state given by mistake). */
export function viewFor(view: GameState, side: Side): GameState {
  if (isViewFor(view, side)) return view;
  if (view.unseen) throw new Error(`The AI (${side}) was given a view redacted for the other side.`);
  return redact(view, side);
}

/** The AI's answer to decision `d` (for `opts.side`), judged on `view` only. */
export function chooseAnswer(view: GameState, d: Decision, opts: AiOptions, mem: AiMemory): AiResult {
  const t0 = now();
  const me = opts.side;
  const v = viewFor(view, me);
  if (!mem.rngState) mem.rngState = (opts.seed ?? entropySeed()) >>> 0 || 1;
  const rng = new Rng(mem.rngState);
  const level = LEVELS[opts.level] ?? LEVELS.line;
  const pc = newPolicyCtx(me, level, rng);
  pc.plan = mem.plan;
  pc.lastFire = mem.lastFire;
  pc.opFireHex = mem.opFireHex;
  pc.deploy = mem.deploy;
  let answer: Answer | null = null;
  let say: string | undefined;
  let sims: number | undefined;
  let label: string | undefined;
  let alternatives: { label: string; score: number; n: number }[] | undefined;
  try {
    if (d.side !== me) throw new Error(`decision for ${d.side}, AI plays ${me}`);
    if (d.kind === 'turn') {
      const r = planTurn(v, d, level, rng, opts.timeBudgetMs ?? level.budgetMs, opts.deterministic);
      answer = r.answer;
      pc.plan = r.plan;
      sims = r.sims;
      label = r.label;
      alternatives = r.scores.slice(0, 6);
      say = speak(v, d, r.answer, mem, rng);
    } else {
      answer = policyAnswer(v, d, pc);
    }
  } catch (e) {
    console.warn(`AI (${me}) failed on '${d.kind}':`, e);
    answer = null;
  }
  if (!answer || answerError(v, d, answer)) {
    if (answer) console.warn(`AI (${me}) gave a refused answer to '${d.kind}': ${answerError(v, d, answer)} ${JSON.stringify(answer)}`);
    mem.fallbacks++;
    answer = safeAnswer(v, d, () => rng.next());
  }
  mem.plan = pc.plan;
  mem.lastFire = pc.lastFire;
  mem.opFireHex = pc.opFireHex;
  mem.deploy = pc.deploy;
  mem.rngState = rng.state;
  mem.last = { kind: d.kind, ms: now() - t0, sims, label, alternatives };
  return say ? { answer, say } : { answer };
}

/** An occasional one-line remark at the start of an Order (British spelling; at most one per Turn). */
function speak(s: GameState, d: Extract<Decision, { kind: 'turn' }>, a: Answer, mem: AiMemory, rng: Rng): string | undefined {
  if (mem.saidTurn === s.turn.number || !rng.chance(0.25)) return undefined;
  mem.saidTurn = s.turn.number;
  const lines: Record<string, string[]> = {
    Fire: ['Open fire!', 'Keep their heads down.', 'Pour it on, lads.'],
    Move: ['Forward, by bounds.', 'Move up — use the cover.', 'On me, keep low.'],
    Advance: ['Fix bayonets!', 'Close with them!'],
    Recover: ['Pull yourselves together!', 'Steady, steady…'],
    Rout: ['They are wavering — push them!'],
    'Artillery Request': ['Get me the guns.', 'Fire mission, on my mark.'],
    pass: ['We hold.', 'Wait for it…', 'Dig in and wait.'],
  };
  const key = a.kind === 'order' ? a.order : a.kind === 'pass' ? 'pass' : '';
  const list = lines[key];
  void d;
  return list ? rng.pick(list) : undefined;
}
