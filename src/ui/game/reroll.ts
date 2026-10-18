// The Initiative re-roll (§9.1): the engine asks the holder after every roll. The human's setting decides which of
// those questions he sees: Always, When it matters (default), or Never; every other one is declined for him at once.
//
// "When it matters" judges the roll, not the battle: it asks after a Fire Attack, Targeting, Defense, melee, rally,
// rout, Mine, Artillery Impact or Sudden Death roll only when a re-roll would on average raise the human's chance of a
// good result by MATTERS or more. A low enemy attack roll is never asked about, even when the attack is still likely to
// break his unit (a re-roll would on average make it worse), and neither is a roll no re-roll could change.
import { distance } from '../../engine/hex';
import { attackFp } from '../../engine/fire';
import { losCheck } from '../../engine/los';
import { cover, currentStats } from '../../engine/stats';
import { cardOf, isUnit } from '../../engine/state';
import type { Answer, Decision, GameEvent, GameState, HexId, PieceId, Reveal, Side } from '../../engine/types';
import { other } from '../../engine/types';
import { storage } from '../storage';
import { pieceName } from './names';
import { PRODUCT_P, SUM_P, expected, held, holdChance, needText, pct } from './odds';

export type RerollPolicy = 'always' | 'matters' | 'never';
export const REROLL_POLICIES: readonly RerollPolicy[] = ['always', 'matters', 'never'];
export const REROLL_LABEL: Record<RerollPolicy, string> = { always: 'Always', matters: 'When it matters', never: 'Never' };
const KEY = 'cce-reroll';

export function loadRerollPolicy(): RerollPolicy {
  const v = storage.get(KEY);
  return v === 'always' || v === 'never' || v === 'matters' ? v : 'matters';
}
export function saveRerollPolicy(p: RerollPolicy): void {
  storage.set(KEY, p);
}

/** What the battle screen knows about the attack in progress (from the answers and events it has seen). */
export interface RollContext {
  /** The last Fire Attack chosen or begun (a 'fire' answer, a 'fireAt' event), with the FP its Actions added since. */
  spec?: { side: Side; pieces: PieceId[]; target: HexId; bonus: number } | null;
  /** The Fire Attack about to be rolled ('firePower' event): its FP, Airburst and defenders with Morale and Cover. */
  power?: {
    side: Side;
    pieces: PieceId[];
    targets: HexId[];
    fp: number;
    airburst: number;
    defenders: { unit: PieceId; morale: number; cover: number }[];
  } | null;
  /** The last Fire Attack rolled ('fireAttack' event): what the Defense rolls are made against. */
  attack?: { side: Side; total: number; targets: HexId[]; pieces: PieceId[] } | null;
  /** The unit making the coming Defense roll and what it rolls against ('defending' event). */
  defending?: { unit: PieceId; morale: number; cover: number; attack: number; moving: boolean } | null;
  /** The player activated by the last Rout Order. */
  routed?: Side | null;
}

/** Actions that add FP just before a Fire Attack roll (+2 each). */
const FP_ACTIONS = new Set(['Bore Sighting', 'Crossfire', 'Hand Grenades', 'Marksmanship', 'Sustained Fire']);

/** The context after answer `a` to decision `d` was accepted (whichever side gave it). */
export function contextAfterAnswer(ctx: RollContext, d: Decision, a: Answer): RollContext {
  if (a.kind === 'fire') return { ...ctx, spec: { side: d.side, pieces: a.spec.pieces.slice(), target: a.spec.target, bonus: 0 } };
  if (a.kind === 'activatePlayer' && d.kind === 'activate' && d.order === 'Rout') return { ...ctx, routed: a.player };
  return ctx;
}

/** The context after event `e` (as the human may see it) has been played. */
export function contextAfterEvent(ctx: RollContext, e: GameEvent): RollContext {
  switch (e.kind) {
    case 'turnStart':
      return {};
    case 'cardPlayed':
      if (e.as === 'order') return {};
      return FP_ACTIONS.has(e.name) && ctx.spec ? { ...ctx, spec: { ...ctx.spec, bonus: ctx.spec.bonus + 2 } } : ctx;
    case 'fireAt':
      return { ...ctx, spec: { side: e.side, pieces: e.pieces.slice(), target: e.target, bonus: 0 }, power: null, attack: null, defending: null };
    case 'firePower': {
      const p = e.parts;
      return { ...ctx, power: { side: e.side, pieces: p.pieces.map((x) => x.piece), targets: e.targets.slice(), fp: p.fp, airburst: p.airburst, defenders: p.defenders.slice() } };
    }
    case 'fireAttack':
      return { ...ctx, attack: { side: e.side, total: e.total, targets: e.hexes?.length ? e.hexes : [e.target], pieces: e.pieces.slice() }, defending: null };
    case 'defending':
      return { ...ctx, defending: { unit: e.unit, morale: e.morale, cover: e.cover, attack: e.attack, moving: e.moving } };
    default:
      return ctx;
  }
}

/** "When it matters" offers a re-roll that would raise the human's chance of a good result by this much on average. */
export const MATTERS = 0.1;

/** What a roll decides for the human: his chance of a good result with it, and on average after a re-roll. */
export interface RollStakes {
  now: number;
  reroll: number;
  /** For the re-roll prompt: what the roll had to reach (empty when only the dice are judged). */
  lines: string[];
}

const unitsIn = (s: GameState, hexes: HexId[], side: Side): PieceId[] =>
  Object.values(s.pieces).filter((p) => p.where === 'map' && hexes.includes(p.hex) && p.side === side && isUnit(p)).map((p) => p.id);

const brokenOf = (s: GameState, side: Side): PieceId[] =>
  Object.values(s.pieces).filter((p) => p.where === 'map' && p.side === side && p.broken && isUnit(p)).map((p) => p.id);

function firerHexes(s: GameState, pieces: PieceId[]): HexId[] {
  const out: HexId[] = [];
  for (const id of pieces) {
    const p = s.pieces[id];
    if (!p) continue;
    if (p.where === 'map') out.push(p.hex);
    else if (p.carrier && s.pieces[p.carrier]?.where === 'map') out.push(s.pieces[p.carrier].hex);
  }
  return out;
}

/** Morale + Cover of unit `id` against an attack from `firers` (or its plain Cover). */
function defense(s: GameState, id: PieceId, firers: HexId[] = []): number {
  return currentStats(s, id).morale + cover(s, id, { firers });
}

const moving = (s: GameState, id: PieceId) => s.turn.moving.includes(id);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Stakes judged from `good(v)`, the human's chance of a good result if the roll were `v`. */
function stakes(dist: readonly number[], v: number, good: (v: number) => number, lines: string[] = [], rerolled = good): RollStakes {
  return { now: good(v), reroll: expected(dist, rerolled), lines };
}

function chancesLine(st: RollStakes): string {
  return `Your chances: ${pct(st.now)} with this roll, ${pct(st.reroll)} on average after a re-roll (a Suppressed result counts half).`;
}

const whose = (s: GameState, id: PieceId, human: Side) => `${s.pieces[id]?.side === human ? 'Your' : 'Their'} ${pieceName(s, id)}`;

/** A Fire Attack roll of `v` (the attack's FP from the 'firePower' event, else from the 'fire' answer). */
function fireAttackStakes(s: GameState, roll: Reveal, v: number, human: Side, ctx: RollContext): RollStakes | null {
  const p = ctx.power && ctx.power.side === roll.side ? ctx.power : null;
  const spec = ctx.spec && ctx.spec.side === roll.side ? ctx.spec : null;
  let fp: number;
  let airburst = 0;
  let defenders: { unit: PieceId; base: number; moving: boolean }[];
  if (p) {
    fp = p.fp;
    airburst = p.airburst;
    defenders = p.defenders.filter((d) => s.pieces[d.unit]).map((d) => ({ unit: d.unit, base: d.morale + d.cover, moving: moving(s, d.unit) }));
  } else if (spec) {
    fp = attackFp(s, spec.pieces, [spec.target]).fp + spec.bonus;
    const firers = firerHexes(s, spec.pieces);
    defenders = unitsIn(s, [spec.target], other(roll.side)).map((u) => ({ unit: u, base: defense(s, u, firers), moving: moving(s, u) }));
  } else return null;
  if (!defenders.length) return null;
  const own = roll.side === human;
  // the attacker's result: how far the defenders fail to hold, on average over them
  const good = (x: number) => {
    const hold = mean(defenders.map((d) => holdChance(d.base, fp + x + airburst, d.moving)));
    return own ? 1 - hold : hold;
  };
  const total = fp + v + airburst;
  const lines = [`Attack total ${total}: ${fp} FP + roll ${v}${airburst ? ' + 2 Airburst' : ''}.`];
  for (const d of defenders.slice(0, 4)) lines.push(`${whose(s, d.unit, human)} (Morale + Cover ${d.base}): ${needText(d.base, total, d.moving)}.`);
  if (defenders.length > 4) lines.push(`… and ${defenders.length - 4} more.`);
  const st = stakes(SUM_P, v, good, lines);
  st.lines.push(chancesLine(st));
  return st;
}

/** A Defense roll of `v` (the unit and its target number from the 'defending' event). */
function defenseStakes(s: GameState, roll: Reveal, v: number, human: Side, ctx: RollContext): RollStakes | null {
  const d = ctx.defending && s.pieces[ctx.defending.unit]?.side === roll.side ? ctx.defending : null;
  let units: { unit: PieceId; base: number; against: number; moving: boolean }[];
  if (d) units = [{ unit: d.unit, base: d.morale + d.cover, against: d.attack, moving: d.moving }];
  else {
    const a = ctx.attack;
    if (!a || a.side === roll.side) return null;
    const firers = firerHexes(s, a.pieces);
    units = unitsIn(s, a.targets, roll.side).map((u) => ({ unit: u, base: defense(s, u, firers), against: a.total, moving: moving(s, u) }));
    if (!units.length) return null;
  }
  const mine = roll.side === human;
  const good = (x: number) => {
    const hold = mean(units.map((u) => held(u.base + x, u.against, u.moving)));
    return mine ? hold : 1 - hold;
  };
  const lines: string[] = [];
  if (units.length === 1) {
    const u = units[0];
    const res = held(u.base + v, u.against, u.moving);
    lines.push(`${whose(s, u.unit, human)} (Morale + Cover ${u.base}) against ${u.against}: ${needText(u.base, u.against, u.moving)}.`);
    lines.push(`Rolled ${v}: Defense total ${u.base + v} — ${res === 1 ? 'it holds' : res === 0.5 ? 'Suppressed' : 'it breaks'}.`);
  }
  const st = stakes(SUM_P, v, good, lines);
  if (lines.length) st.lines.push(chancesLine(st));
  return st;
}

/** A Targeting roll (product `v`) of a single Ordnance piece. */
function targetingStakes(s: GameState, roll: Reveal, v: number, human: Side, ctx: RollContext): RollStakes | null {
  const spec = ctx.spec;
  if (!spec || spec.side !== roll.side || spec.pieces.length !== 1) return null;
  const from = firerHexes(s, spec.pieces)[0];
  if (from === undefined) return null;
  const range = distance(from, spec.target);
  const hind = losCheck(s, from, spec.target).hindrance;
  const own = roll.side === human;
  const good = (x: number) => ((x - hind > range) === own ? 1 : 0);
  const need = range + hind + 1;
  return stakes(PRODUCT_P, v, good, [`Targeting needs ${need} or more (range ${range}${hind ? ` + Hindrance ${hind}` : ''}): rolled ${v}, ${v >= need ? 'a hit' : 'a miss'}.`]);
}

/** Rally or Rout rolls for broken units of `owner` (the unit rolling is not known: their average). */
function brokenStakes(s: GameState, owner: Side, v: number, human: Side): RollStakes | null {
  const units = brokenOf(s, owner).map((u) => defense(s, u));
  if (!units.length) return null;
  // for the owner: a Rally roll below Morale + Cover rallies, a Rout roll below it holds; equal: Suppressed
  const forOwner = (x: number) => mean(units.map((m) => (x < m ? 1 : x === m ? 0.5 : 0)));
  return stakes(SUM_P, v, (x) => (owner === human ? forOwner(x) : 1 - forOwner(x)));
}

/** What `roll` decides for `human` (judged from the state right after it, before its result is applied), or null. */
export function rollStakes(s: GameState, roll: Reveal, human: Side, ctx: RollContext = {}): RollStakes | null {
  let card;
  try {
    card = cardOf(roll.card);
  } catch {
    return null;
  }
  const sum = card.white + card.red;
  const product = card.white * card.red;
  const mine = roll.side === human;
  // judged by the dice alone: the roller wants a high sum
  const dice = () => stakes(SUM_P, sum, (x) => (mine ? (x >= 7 ? 1 : 0) : x <= 7 ? 1 : 0));
  switch (roll.purpose) {
    case 'fireAttack':
      return fireAttackStakes(s, roll, sum, human, ctx) ?? dice();
    case 'mine':
    case 'impact':
    case 'melee':
      return dice();
    case 'targeting':
      return targetingStakes(s, roll, product, human, ctx) ?? stakes(PRODUCT_P, product, (x) => ((x >= 12) === mine ? 1 : 0));
    case 'defense':
      return defenseStakes(s, roll, sum, human, ctx) ?? dice();
    case 'rally':
      return brokenStakes(s, roll.side, sum, human);
    case 'rout':
      return brokenStakes(s, ctx.routed ?? other(roll.side), sum, human);
    case 'suddenDeath': {
      // the battle goes on (½), or ends and the side ahead wins (on a tie in VP: the Initiative holder, who is no
      // longer the human after his re-roll)
      const winner = (holder: Side): Side => (s.vp > 0 ? 'axis' : s.vp < 0 ? 'allied' : holder);
      const at = (holder: Side) => (x: number) => (x < s.time ? (winner(holder) === human ? 1 : 0) : 0.5);
      return stakes(SUM_P, sum, at(s.initiative), [], at(other(human)));
    }
    default:
      return null;
  }
}

/** Did `roll` go against `human` so that a re-roll would likely help him (the "When it matters" judgement)? */
export function rollAgainst(s: GameState, roll: Reveal, human: Side, ctx: RollContext = {}): boolean {
  try {
    const st = rollStakes(s, roll, human, ctx);
    return !!st && st.reroll - st.now >= MATTERS;
  } catch {
    return true;
  }
}

/** Should the human see this re-roll question? */
export function offerReroll(policy: RerollPolicy, s: GameState, d: Extract<Decision, { kind: 'reroll' }>, human: Side, ctx: RollContext = {}): boolean {
  if (policy === 'always') return true;
  if (policy === 'never') return false;
  return rollAgainst(s, d.roll, human, ctx);
}
