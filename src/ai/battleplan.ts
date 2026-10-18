// The AI's battle plan: an intent it keeps across Turns, where the planner (planner.ts) otherwise looks one Order ahead.
// Made at the AI's first own Turn from its own view (`redact(state, side)`: open chits, its own secret chits, the
// board), kept in its memory (worker side) and re-made only when the position changes sharply. It names
//  - the Objective the main effort goes for (to take it, or to hold it when it is ours and threatened);
//  - the main-effort units (they close on it) and a support group (it covers it from firing positions: hexes in range
//    with a clear line of sight to it);
//  - a rough timing: the Time by which the main effort should be on it, from the Sudden Death space.
// The evaluation (evaluate.ts `planTerm` weight) then scores the main effort's progress and the support group in
// position, so the search does not drift off the plan for small gains elsewhere. Every plan and re-plan is logged in
// the memory (the match scripts print the log).
import { distance, label } from '../engine/hex';
import { losCheck } from '../engine/los';
import { chitValue, objectiveValue } from '../engine/objectives';
import { isLeader, isUnit, typeOf } from '../engine/state';
import { type GameState, type HexId, type Piece, type PieceId, type Side, other } from '../engine/types';
import { projectedMargin } from './evaluate';
import { holdsFixedWeapon } from './moves';
import { pieceValue } from './values';

export interface BattlePlan {
  /** Turn and Time it was made at, and why (the first plan, or the re-plan trigger). */
  turn: number;
  time: number;
  reason: string;
  /** The Objective (index into map.objectives) the main effort is for. */
  target: number;
  /** 'take': it is not ours; 'hold': ours, and the enemy threatens it. */
  aim: 'take' | 'hold';
  /** Its worth to us when the plan was made (VP-like). */
  worth: number;
  main: PieceId[];
  support: PieceId[];
  /** Firing positions for the support group: hexes within 6 of the target with a clear line of sight to it. */
  posts: HexId[];
  /** The Time by which the main effort should be on the target. */
  by: number;
  /** The position it was made in: what the re-plan triggers compare against. */
  base: PlanBase;
}

export interface PlanBase {
  margin: number;
  /** Open chits and our own secret chits. */
  chits: string;
  /** Main-effort units in good order. */
  mainGood: number;
  /** Units of each side on the map, and off it waiting to enter (Time Track, staging): new ones are reinforcements. */
  mine: PieceId[];
  theirs: PieceId[];
  waiting: PieceId[];
  /** Made within two Time spaces of Sudden Death. */
  late: boolean;
}

/** A VP swing (projected margin) this large makes a new plan. */
export const SWING = 5;

function goodUnits(s: GameState, side: Side): Piece[] {
  const out: Piece[] = [];
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.side === side && p.where === 'map' && isUnit(p) && !p.broken) out.push(p);
  }
  return out;
}

function unitIds(s: GameState, side: Side): PieceId[] {
  const out: PieceId[] = [];
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.side === side && p.where === 'map' && isUnit(p)) out.push(id);
  }
  return out.sort();
}

function waitingIds(s: GameState): PieceId[] {
  const out: PieceId[] = [];
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if ((p.where === 'time' || p.where === 'staging') && isUnit(p)) out.push(id);
  }
  return out.sort();
}

function chitSig(s: GameState, me: Side): string {
  return `${[...s.openChits].sort().join('')}/${[...s.players[me].secretChits].sort().join('')}`;
}

/** What Objective i is worth to `me`: a base by posture, the open chits and our own secret chits on it. */
export function objectiveWorth(s: GameState, me: Side, i: number): number {
  const posture = s.players[me].posture;
  let v = (posture === 'attack' ? 1.2 : posture === 'recon' ? 0.9 : 0.7) + Math.max(0, objectiveValue(s, i + 1));
  for (const c of s.players[me].secretChits) v += chitValue(c, i + 1);
  return v;
}

/** The best range a unit can fire at (its own or its Weapon's). */
function reach(s: GameState, u: Piece): number {
  let r = typeOf(u).front.range;
  if (u.weapon && s.pieces[u.weapon]) r = Math.max(r, typeOf(s.pieces[u.weapon]).front.range);
  return r;
}

/** A unit's firepower as a support asset: its own FP, more with a Weapon (MGs above all). */
function fireValue(s: GameState, u: Piece): number {
  let v = typeOf(u).front.fp;
  if (u.weapon && s.pieces[u.weapon]) {
    const w = typeOf(s.pieces[u.weapon]);
    v += w.front.fp * (w.weaponClass === 'mg' ? 1.2 : 0.6);
  }
  return v + 0.15 * reach(s, u);
}

/** Enemy strength around `hex`: the worth of the enemy's good-order units, weighted by nearness (within 3 hexes). */
function enemyNear(s: GameState, me: Side, hex: HexId): number {
  let v = 0;
  for (const u of goodUnits(s, other(me))) {
    const d = distance(u.hex, hex);
    if (d <= 3) v += pieceValue(s, u) * (d === 0 ? 1 : d === 1 ? 0.8 : d === 2 ? 0.5 : 0.25);
  }
  return v;
}

/** The firing positions on `hex`: hexes within 6 of it (not it) with a clear line of sight to it. */
function postsOn(s: GameState, hex: HexId): HexId[] {
  const out: HexId[] = [];
  for (let h = 0; h < s.map.terrain.length; h++) {
    const d = distance(h, hex);
    if (d < 1 || d > 6) continue;
    if (losCheck(s, h, hex).clear) out.push(h);
  }
  return out;
}

/**
 * Choose a plan for `me` in view `s`. `prev` (a re-plan): its target is preferred a little (no flip-flopping between two
 * near-equal Objectives).
 */
export function makePlan(s: GameState, me: Side, reason: string, prev: BattlePlan | null = null): BattlePlan | null {
  const n = s.map.objectives.length;
  const mine = goodUnits(s, me).filter((u) => !holdsFixedWeapon(s, u));
  if (!n || !mine.length) return null;
  const posture = s.players[me].posture;
  // own Turns left before Sudden Death, roughly (a Time space lasts about four Turns of each player)
  const turnsLeft = Math.max(2, (s.suddenDeath - s.time) * 4);
  let best: { i: number; aim: 'take' | 'hold'; u: number; worth: number } | null = null;
  for (let i = 0; i < n; i++) {
    const hex = s.map.objectives[i];
    const worth = objectiveWorth(s, me, i);
    const near = mine.map((u) => distance(u.hex, hex)).sort((a, b) => a - b);
    const k = Math.min(4, near.length);
    const dist = near.slice(0, k).reduce((a, b) => a + b, 0) / k;
    const foes = enemyNear(s, me, hex);
    const ours = s.control[i] === me;
    let u: number;
    let aim: 'take' | 'hold';
    if (!ours) {
      // to take: worth, discounted by the Turns needed to get there (about three hexes a Turn) against the Turns left,
      // and by the enemy around it
      aim = 'take';
      const inTime = Math.max(0.1, Math.min(1, 1.2 - dist / 3 / turnsLeft));
      u = (worth * inTime * (posture === 'defend' ? 0.6 : 1)) / (1 + 0.12 * foes);
    } else {
      // to hold: worth, scaled by how strongly the enemy threatens it (none near: little to do)
      aim = 'hold';
      u = worth * Math.min(1, 0.15 + 0.12 * foes) * (posture === 'attack' ? 0.7 : 1);
    }
    if (prev && prev.target === i) u *= 1.25;
    if (!best || u > best.u) best = { i, aim, u, worth };
  }
  if (!best) return null;
  const hex = s.map.objectives[best.i];
  // garrisons stay where they are: a unit alone on another Objective we hold is not pulled away (unless it is all we have)
  const held = new Set(s.map.objectives.filter((o, i) => i !== best!.i && s.control[i] === me));
  const garrison = new Set<PieceId>();
  for (const h of held) {
    const here = mine.filter((u) => u.hex === h);
    if (here.length) garrison.add(here.sort((a, b) => pieceValue(s, a) - pieceValue(s, b))[0].id);
  }
  const free = mine.filter((u) => !garrison.has(u.id));
  const pool = free.length ? free : mine;
  // the main effort: the nearest good-order units (about half the force, at least two), with the nearest Leader
  const byDist = pool.slice().sort((a, b) => distance(a.hex, hex) - distance(b.hex, hex) || (a.id < b.id ? -1 : 1));
  const size = Math.max(Math.min(2, byDist.length), Math.ceil(byDist.length * (best.aim === 'take' ? 0.55 : 0.45)));
  const main = byDist.filter((u) => !isLeader(u)).slice(0, size);
  const leader = byDist.find((u) => isLeader(u));
  if (leader) main.push(leader);
  // the support group: of the rest, the best shooters that can reach a firing position (at most three)
  const posts = postsOn(s, hex);
  const inMain = new Set(main.map((u) => u.id));
  const support = pool
    .filter((u) => !inMain.has(u.id) && !isLeader(u) && distance(u.hex, hex) <= reach(s, u) + 6)
    .sort((a, b) => fireValue(s, b) - fireValue(s, a) || (a.id < b.id ? -1 : 1))
    .slice(0, 3);
  const mainIds = main.map((u) => u.id);
  return {
    turn: s.turn.number,
    time: s.time,
    reason,
    target: best.i,
    aim: best.aim,
    worth: Math.round(best.worth * 10) / 10,
    main: mainIds,
    support: support.map((u) => u.id),
    posts,
    by: Math.max(s.time + 1, s.suddenDeath - 2),
    base: {
      margin: projectedMargin(s, me),
      chits: chitSig(s, me),
      mainGood: mainIds.filter((id) => !s.pieces[id].broken).length,
      mine: unitIds(s, me),
      theirs: unitIds(s, other(me)),
      waiting: waitingIds(s),
      late: s.time >= s.suddenDeath - 2,
    },
  };
}

/** Why `plan` should be re-made in view `s` (the first trigger that fires), or null to keep it. */
export function replanReason(s: GameState, me: Side, plan: BattlePlan): string | null {
  const owner = s.control[plan.target];
  if (plan.aim === 'take' && owner === me) return 'target taken';
  if (plan.aim === 'hold' && owner !== me) return 'target lost';
  const good = plan.main.filter((id) => {
    const p = s.pieces[id];
    return p && p.where === 'map' && !p.broken;
  }).length;
  if (plan.base.mainGood > 0 && good <= Math.floor(plan.base.mainGood / 2)) return `main effort broken (${good} of ${plan.base.mainGood} in good order)`;
  const margin = projectedMargin(s, me);
  if (Math.abs(margin - plan.base.margin) >= SWING) return `VP swing (${fmt(plan.base.margin)} → ${fmt(margin)})`;
  if (chitSig(s, me) !== plan.base.chits) return 'Objective chit revealed or changed';
  if (!plan.base.late && s.time >= s.suddenDeath - 2) return 'Sudden Death near';
  // newcomers: units that were waiting off the map, or new counters other than Teams (a Deploy or Light Wounds makes
  // Teams of a Squad already there)
  const known = new Set([...plan.base.mine, ...plan.base.theirs]);
  const waiting = new Set(plan.base.waiting);
  const fresh = [...unitIds(s, me), ...unitIds(s, other(me))].filter(
    (id) => !known.has(id) && (waiting.has(id) || typeOf(s.pieces[id]).kind !== 'team'),
  );
  if (fresh.length) return `reinforcements arrived (${fresh.length})`;
  return null;
}

const fmt = (x: number) => (x > 0 ? `+${x}` : `${x}`);

/** Cached Set of a plan's firing positions (plans are kept as plain data). */
const postSets = new WeakMap<BattlePlan, Set<HexId>>();

/**
 * The plan's part of the evaluation for `me` in `s` (VP-like): each main-effort unit in good order by its nearness to
 * the target (more as the plan's Time comes near), each support unit in a firing position within its range.
 */
export function planTerm(s: GameState, me: Side, plan: BattlePlan): number {
  const hex = s.map.objectives[plan.target];
  if (hex === undefined) return 0;
  let posts = postSets.get(plan);
  if (!posts) postSets.set(plan, (posts = new Set(plan.posts)));
  const urgency = Math.max(0, Math.min(1, (s.time - (plan.by - 3)) / 3));
  let main = 0;
  for (const id of plan.main) {
    const u = s.pieces[id];
    if (!u || u.where !== 'map' || u.broken || u.side !== me) continue;
    const d = distance(u.hex, hex);
    main += d === 0 ? 1 : Math.max(0, 0.88 - 0.11 * d);
  }
  let sup = 0;
  for (const id of plan.support) {
    const u = s.pieces[id];
    if (!u || u.where !== 'map' || u.broken || u.side !== me) continue;
    if (posts.has(u.hex) && distance(u.hex, hex) <= reach(s, u)) sup += u.suppressed ? 0.5 : 1;
  }
  return main * (0.55 + 0.35 * urgency) + 0.35 * sup;
}

/** One log line for a new plan (`prev`: the plan it replaces). */
export function describePlan(s: GameState, me: Side, plan: BattlePlan, prev: BattlePlan | null): string {
  const hex = s.map.objectives[plan.target];
  const names = (ids: PieceId[]) => ids.map((id) => `${s.pieces[id] ? typeOf(s.pieces[id]).name : id} ${s.pieces[id] ? label(s.pieces[id].hex) : ''}`.trim());
  const change = prev ? (prev.target === plan.target && prev.aim === plan.aim ? ' (same target)' : ` (was ${prev.aim} Objective ${prev.target + 1})`) : '';
  return (
    `T${s.turn.number} ${me} ${prev ? 're-plan' : 'plan'} [${plan.reason}]: ${plan.aim} Objective ${plan.target + 1} (${label(hex)}, worth ${plan.worth})` +
    `${change} by Time ${plan.by} (now ${s.time}, Sudden Death ${s.suddenDeath}); main ${plan.main.length}: ${names(plan.main).join(', ')}; ` +
    `support ${plan.support.length}: ${names(plan.support).join(', ') || '—'}`
  );
}
