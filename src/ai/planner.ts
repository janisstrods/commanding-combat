// The own-Turn planner. At every 'turn' decision (before each Order: the AI re-plans after every one) it builds
// candidate plans from its hand — Fire activations with their best Fire Groups and targets, Move activations with a
// destination per group (toward Objectives, Cover and fire positions, minding Op Fire), Advances into melee when the odds
// favour it, Recover / Rout when worth it, Artillery when it has a Radio and a Spotter, ending the Turn, or a pass with
// discards of its weakest cards — and scores each by playing it through the real engine on several determinised copies
// of the game (the opponent's reactions answered by policies.ts as his stand-in), evaluating the outcome. Candidates
// share the same sampled worlds (common random numbers); the weaker part is dropped after each round (successive
// halving) until the choice is clear, or the time budget or the world count runs out. A battle plan (battleplan.ts),
// when the AI keeps one, adds its terms to the evaluation and to the Move destinations.
import { activationCandidates, commandRadius } from '../engine/activation';
import { distance, neighbours } from '../engine/hex';
import { enterBlock } from '../engine/terrain';
import { nextTurn, turnFlow } from '../engine/flow';
import { cloneState, isLeader, radioOf } from '../engine/state';
import { type Answer, type CardId, type Decision, type GameState, type OrderName, type Piece, type PieceId, type Side, other } from '../engine/types';
import type { BattlePlan } from './battleplan';
import { avgDraw, cardCtx, keepValue, weakestFirst } from './cards';
import { determinize } from './determinize';
import { evaluate, weightsFor, type Weights } from './evaluate';
import type { LevelCfg } from './levels';
import { holdsFixedWeapon, planMoves } from './moves';
import { bestSpotter, cheapest, fireActivations, meleeOdds, newPolicyCtx, policyAnswer, quickTurn, type Plan, type PolicyCtx } from './policies';
import { Rng } from './rand';
import { drive } from './sim';
import { fitsStack, sideShooters, unitsAt, unitsOnMap } from './tactics';
import { safety } from './choose';

type TurnD = Extract<Decision, { kind: 'turn' }>;

export interface Candidate {
  label: string;
  first: Answer;
  plan: Plan | null;
  /** A quick static estimate (for pruning before any simulation). */
  prior: number;
}

export interface PlanResult {
  answer: Answer;
  plan: Plan | null;
  label: string;
  sims: number;
  /** Candidates with their mean scores, best first (diagnostics). */
  scores: { label: string; score: number; n: number }[];
  /** Why the search stopped. */
  stop: StopReason;
}

const now = (): number => (globalThis.performance ? globalThis.performance.now() : Date.now());

/** The candidate plans for the Turn decision `d` in view `s`. */
export function candidates(
  s: GameState, d: TurnD, level: LevelCfg, mustDiscard = false, tune?: Partial<Weights>, battle: BattlePlan | null = null,
): Candidate[] {
  const me = d.side;
  const cc = cardCtx(s, me);
  const turn = s.turn.number;
  const given = s.turn.ordersGiven;
  const out: Candidate[] = [];
  const byOrder = new Map<OrderName, CardId[]>();
  for (const o of d.orders) byOrder.set(o.order, [...(byOrder.get(o.order) ?? []), o.card]);
  const mk = (card: CardId, order: OrderName, label: string, prior: number, extra: Partial<Plan> = {}): Candidate => ({
    label, first: { kind: 'order', card, order }, prior,
    plan: { turn, given, card, order, label, ...extra },
  });
  for (const [order, cards] of byOrder) {
    const card = cheapest(cards, cc);
    switch (order) {
      case 'Fire': {
        const acts = fireActivations(s, me, activationCandidates(s, me, 'Fire')).slice(0, level.fireActs);
        for (const a of acts) out.push(mk(card, 'Fire', `Fire with ${a.units.length} unit(s)`, a.ev, { units: a.units }));
        break;
      }
      case 'Move': {
        const plans = planMoves(s, me, level, tune, battle);
        for (const p of plans.slice(0, level.moveActs)) {
          out.push(mk(card, 'Move', `Move ${Object.keys(p.dest).length} unit(s)`, p.gain, { units: p.units, dest: p.dest, paths: p.paths }));
        }
        break;
      }
      case 'Advance':
        for (const c of advanceCandidates(s, me, card, turn, given)) out.push(c);
        break;
      case 'Recover': {
        const broken = unitsOnMap(s, me).filter((u) => u.broken).length;
        const supp = unitsOnMap(s, me).filter((u) => u.suppressed).length;
        out.push(mk(card, 'Recover', 'Recover', 0.6 * broken + 0.1 * supp, { player: me }));
        break;
      }
      case 'Rout': {
        const enemyBroken = unitsOnMap(s, other(me)).filter((u) => u.broken).length;
        if (enemyBroken) out.push(mk(card, 'Rout', 'Rout the enemy', 0.5 * enemyBroken, { player: other(me) }));
        break;
      }
      case 'Artillery Request': {
        const radio = radioOf(s, me);
        if (!radio) break;
        if (radio.broken) out.push(mk(card, order, 'Battery Access', 0.3));
        else {
          const spotters = spotterCandidates(s, me);
          const sp = bestSpotter(s, me, spotters);
          if (sp) out.push(mk(card, order, 'Fire For Effect', 1.5, { units: [sp] }));
        }
        break;
      }
      case 'Artillery Denied':
        out.push(mk(card, order, 'Artillery Denied', 0.5));
        break;
      default:
        out.push(mk(card, order, order, 0));
    }
  }
  // keep the best few of each Order, then cut to the level's width
  const kept: Candidate[] = [];
  const perOrder = new Map<string, Candidate[]>();
  for (const c of out) {
    const k = c.plan?.order ?? c.first.kind;
    perOrder.set(k, [...(perOrder.get(k) ?? []), c]);
  }
  for (const list of perOrder.values()) list.sort((a, b) => b.prior - a.prior);
  const room = Math.max(1, level.maxCands - 3);
  for (let i = 0; kept.length < room; i++) {
    let added = false;
    for (const list of perOrder.values()) {
      if (list[i] && kept.length < room) {
        kept.push(list[i]);
        added = true;
      }
    }
    if (!added) break;
  }
  if (d.canPass) {
    for (const c of passCandidates(s, me, d.maxDiscard, cc)) {
      if (mustDiscard && c.first.kind === 'pass' && !c.first.discard.length && d.maxDiscard > 0) continue;
      kept.push(c);
    }
  }
  else kept.push({ label: 'End the Turn', first: { kind: 'endTurn' }, plan: null, prior: 0 });
  return kept;
}

/** Spotters for Fire For Effect: unbroken Leaders not yet activated (artillery.ts `spotters`, without importing it). */
function spotterCandidates(s: GameState, me: Side): PieceId[] {
  const out: PieceId[] = [];
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.side === me && p.where === 'map' && isLeader(p) && !p.broken && !s.turn.activated.includes(id)) out.push(id);
  }
  return out;
}

/** Pass variants: no discard, the weakest card, every card worse than an average draw, and a deeper clear-out. */
function passCandidates(s: GameState, me: Side, maxDiscard: number, cc: ReturnType<typeof cardCtx>): Candidate[] {
  const weak = weakestFirst(s, me, cc);
  const avg = avgDraw(s, me, cc);
  const sets: CardId[][] = [[]];
  if (maxDiscard > 0 && weak.length) {
    sets.push(weak.slice(0, 1));
    const below = weak.filter((c) => keepValue(c, cc) < avg).slice(0, maxDiscard);
    if (below.length > 1) sets.push(below);
    const deep = weak.filter((c) => keepValue(c, cc) < avg + 0.35).slice(0, maxDiscard);
    if (deep.length > below.length) sets.push(deep);
  }
  return sets.map((discard) => ({
    label: discard.length ? `Pass, discarding ${discard.length}` : 'Pass',
    first: { kind: 'pass', discard },
    plan: null,
    prior: -0.1 * discard.length,
  }));
}

/** Advance plans: assaults where the melee odds favour us, else a step into better ground without Op Fire. */
function advanceCandidates(s: GameState, me: Side, card: CardId, turn: number, given: number): Candidate[] {
  const out: Candidate[] = [];
  for (const first of activationCandidates(s, me, 'Advance')) {
    const p = s.pieces[first];
    const pool = isLeader(p) ? [first, ...commandRadius(s, p)] : [first];
    // enemy hexes next to the pool, best odds first
    const targets = new Map<number, PieceId[]>();
    for (const id of pool) {
      const u = s.pieces[id];
      if (holdsFixedWeapon(s, u)) continue;
      for (const h of neighbours(u.hex)) if (unitsAt(s, h, other(me)).length) targets.set(h, [...(targets.get(h) ?? []), id]);
    }
    for (const [hex, ours] of targets) {
      const odds = meleeOdds(s, ours, hex);
      if (odds < 0.45) continue;
      const advance: Record<PieceId, number> = {};
      for (const id of ours) advance[id] = hex;
      const units = isLeader(p) ? [first, ...ours.filter((x) => x !== first)] : [first];
      if (!isLeader(p) && !ours.includes(first)) continue;
      const stake = unitsAt(s, hex, other(me)).length * 2.5;
      out.push({
        label: `Advance into melee (${Math.round(odds * 100)}%)`, first: { kind: 'order', card, order: 'Advance' }, prior: odds * stake,
        plan: { turn, given, card, order: 'Advance', units, advance, label: 'assault' },
      });
    }
  }
  out.sort((a, b) => b.prior - a.prior);
  const melee = out.slice(0, 3);
  // a step into better ground (an Advance draws no Op Fire and ignores terrain costs): toward cover and Objectives
  const steps: Candidate[] = [];
  const enemyShooters = sideShooters(s, other(me));
  for (const first of activationCandidates(s, me, 'Advance')) {
    const p = s.pieces[first];
    const pool = isLeader(p) ? [first, ...commandRadius(s, p)] : [first];
    const advance: Record<PieceId, number> = {};
    let gain = 0;
    const placed = new Map<number, Piece[]>();
    for (const id of pool) {
      const u = s.pieces[id];
      if (u.broken || holdsFixedWeapon(s, u)) continue;
      const here = safety(s, me, u.hex, enemyShooters);
      let best = -1;
      let bv = 0.4;
      for (const to of neighbours(u.hex)) {
        if (unitsAt(s, to, other(me)).length || enterBlock(s.map, u.hex, to, s)) continue;
        const group = [...(placed.get(to) ?? []), u];
        if (!fitsStack(s, to, group, me)) continue;
        const v = safety(s, me, to, enemyShooters) - here + 0.4 * objectiveGain(s, me, u.hex, to);
        if (v > bv) {
          bv = v;
          best = to;
        }
      }
      if (best >= 0) {
        advance[id] = best;
        placed.set(best, [...(placed.get(best) ?? []), u]);
        gain += bv;
      }
    }
    const movers = Object.keys(advance);
    if (!movers.length || (!isLeader(p) && advance[first] === undefined)) continue;
    const units = [first, ...movers.filter((x) => x !== first)];
    steps.push({
      label: `Advance ${movers.length} unit(s) to better ground`, first: { kind: 'order', card, order: 'Advance' }, prior: gain,
      plan: { turn, given, card, order: 'Advance', units, advance, label: 'advance' },
    });
  }
  steps.sort((a, b) => b.prior - a.prior);
  return [...melee, ...steps.slice(0, 2)];
}

/** Hexes closer to Objectives `me` does not hold (weighted by nearness). */
function objectiveGain(s: GameState, me: Side, from: number, to: number): number {
  let v = 0;
  s.map.objectives.forEach((o, i) => {
    if (s.control[i] === me) return;
    const a = distance(from, o);
    const b = distance(to, o);
    if (b < a) v += b === 0 ? 2 : 1 / (1 + b * 0.3);
  });
  return v;
}

// ---------------------------------------------------------------------------------------------------------------------
// Scoring by simulation

interface Scored {
  c: Candidate;
  sum: number;
  n: number;
  /** Score per world (the worlds are shared: index i is the same sampled game for every candidate). */
  scores: number[];
}

/** Play candidate `c` on world `w` (a determinised game) and score the result for `me`. */
function simulate(w: GameState, me: Side, c: Candidate, level: LevelCfg, seed: number, weights: Weights, battle: BattlePlan | null): number {
  const s = cloneState(w);
  const rng = new Rng(seed);
  const mine: PolicyCtx = newPolicyCtx(me, level, rng);
  mine.plan = c.plan;
  if (level.rolloutMoves) {
    mine.quickMoves = 'narrow';
    mine.battle = battle;
  }
  const theirs: PolicyCtx = newPolicyCtx(other(me), level, rng, true);
  let first = true;
  const policy = (st: GameState, d: Decision): Answer => {
    if (d.kind === 'turn' && d.side === me && first) {
      first = false;
      return c.first;
    }
    if (d.kind === 'turn' && d.side === me) {
      mine.plan = null;
      return quickTurn(st, d, mine);
    }
    return policyAnswer(st, d, d.side === me ? mine : theirs);
  };
  const stop = (d: Decision) => d.kind === 'turn' && !first && (d.side !== me || !level.lookahead);
  const r = drive(s, (ctx) => turnFlow(s, ctx), policy, rng, { stop, maxSteps: 600 });
  // the Turn is over: the opponent acts next (the evaluation weighs his fire first)
  if (r.done && s.phase === 'play') {
    nextTurn(s);
    if (level.reply) {
      // Elite: play the opponent's reply too (his greedy Turn: his best Fire, else a pass), then judge
      const opp = other(me);
      const his: PolicyCtx = newPolicyCtx(opp, level, rng);
      if (level.replyMoves) his.quickMoves = 'narrow';
      const reply = (st: GameState, d: Decision): Answer =>
        d.kind === 'turn' && d.side === opp ? quickTurn(st, d, his) : policyAnswer(st, d, d.side === me ? mine : his);
      mine.plan = null;
      const r2 = drive(s, (ctx) => turnFlow(s, ctx), reply, rng, { maxSteps: 500 });
      if (r2.done && s.phase === 'play') nextTurn(s);
    }
  }
  return evaluate(s, me, weights, { battle });
}

export interface PlanOpts {
  /** Thinking time, ms: the clock is read before every simulation. */
  budgetMs: number;
  /** Effort mode (match scripts): stop after this many simulations instead of by the clock. */
  simBudget?: number;
  /** Ignore the clock: the level's world counts (and the early stop) only — reproducible for a seed (tests). */
  deterministic?: boolean;
  /** Both players passed without discarding since the AI's last Turn: a pass must discard. */
  mustDiscard?: boolean;
  /** Tuning experiments: factors on the evaluation weights. */
  tune?: Partial<Weights>;
  /** The battle plan the evaluation follows (battleplan.ts). */
  battle?: BattlePlan | null;
}

/** Why a search stopped (diagnostics). */
export type StopReason = 'single' | 'clock' | 'sims' | 'worlds' | 'clear' | 'even';

/**
 * Spread (VP) assumed on top of the observed one when judging a difference: a few worlds may not yet show an outcome
 * that is rare but large (an Op Fire, a lost melee), so a small sample of near-equal results is not taken as proof.
 */
const PRIOR_SD = 1;

/**
 * The paired comparison of the two best candidates over the worlds both have played (common random numbers): the mean
 * score difference and its standard error (with the prior spread).
 */
export function paired(a: { scores: number[] }, b: { scores: number[] }): { diff: number; se: number; n: number } {
  const n = Math.min(a.scores.length, b.scores.length);
  if (n < 2) return { diff: 0, se: Infinity, n };
  let sum = 0;
  let sq = 0;
  for (let i = 0; i < n; i++) {
    const x = a.scores[i] - b.scores[i];
    sum += x;
    sq += x * x;
  }
  const diff = sum / n;
  const variance = Math.max(0, (sq - n * diff * diff) / (n - 1));
  return { diff, se: Math.sqrt((variance + PRIOR_SD * PRIOR_SD) / n), n };
}

/**
 * Choose the AI's answer to its Turn decision `d` in view `view`: candidates, then simulations within the budget.
 * Successive halving: every live candidate gets its next world before any gets another; after `minSims` worlds each,
 * every round drops the weaker part. The search ends early when the choice is clear — after 2 × `minSims` worlds, the
 * best candidate is ahead of the runner-up by `clear` standard errors of their paired difference — or does not matter
 * (after 4 × `minSims`, the two are even within `even`); else when the worlds, the simulation budget or the time run
 * out.
 */
export function planTurn(view: GameState, d: TurnD, level: LevelCfg, rng: Rng, o: PlanOpts): PlanResult {
  const t0 = now();
  const me = d.side;
  const battle = o.battle ?? null;
  const cands = candidates(view, d, level, o.mustDiscard, o.tune, battle);
  const weights = weightsFor(view, me, o.tune);
  if (cands.length === 1) return { answer: cands[0].first, plan: cands[0].plan, label: cands[0].label, sims: 0, scores: [], stop: 'single' };
  const worlds: GameState[] = [];
  const seeds: number[] = [];
  const world = (i: number) => {
    while (worlds.length <= i) {
      worlds.push(determinize(view, me, rng));
      seeds.push(rng.u32());
    }
    return worlds[i];
  };
  let live: Scored[] = cands.map((c) => ({ c, sum: 0, n: 0, scores: [] }));
  const all = live.slice();
  let sims = 0;
  let stop: StopReason = 'worlds';
  const over = (): StopReason | null => {
    if (o.simBudget) return sims >= o.simBudget ? 'sims' : null;
    return !o.deterministic && now() - t0 > o.budgetMs ? 'clock' : null;
  };
  let target = 1;
  outer: for (;;) {
    for (const x of live) {
      if (x.n >= Math.min(target, level.worlds)) continue;
      const why = sims > 0 ? over() : null;
      if (why) {
        stop = why;
        break outer;
      }
      const v = simulate(world(x.n), me, x.c, level, seeds[x.n], weights, battle);
      x.scores.push(v);
      x.sum += v;
      x.n++;
      sims++;
    }
    if (live.length === 1 || live.every((x) => x.n >= level.worlds)) break;
    if (target >= level.minSims) {
      live.sort((a, b) => b.sum / b.n - a.sum / a.n);
      if (level.clear > 0) {
        const p = paired(live[0], live[1]);
        if (p.n >= 2 * level.minSims && p.diff > level.clear * p.se) {
          stop = 'clear';
          break;
        }
        if (p.n >= 4 * level.minSims && Math.abs(p.diff) + 2 * p.se < level.even) {
          stop = 'even';
          break;
        }
      }
      live = live.slice(0, Math.max(2, Math.ceil(live.length * level.keep)));
      if (live.length === 2 && live.every((x) => x.n >= level.worlds)) break;
    }
    target++;
  }
  const mean = (x: Scored) => (x.n ? x.sum / x.n : -Infinity);
  const noise = (x: Scored) => (level.noise ? rng.normal() * level.noise : 0) + mean(x);
  const pool = live.filter((x) => x.n > 0);
  const ranked = (pool.length ? pool : all).map((x) => ({ x, v: noise(x) })).sort((a, b) => b.v - a.v);
  const best = ranked[0].x;
  return {
    answer: best.c.first,
    plan: best.c.plan,
    label: best.c.label,
    sims,
    scores: all.map((x) => ({ label: x.c.label, score: mean(x), n: x.n })).sort((a, b) => b.score - a.score),
    stop,
  };
}
