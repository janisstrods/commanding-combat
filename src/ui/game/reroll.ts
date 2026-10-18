// The Initiative re-roll (§9.1): the engine asks the holder after every roll. The human's setting decides which of
// those questions he sees: Always, When it matters (default: only a roll that went against him in a Fire Attack,
// Defense, melee, rally / rout or Sudden Death), or Never; every other one is declined for him at once.
import { distance } from '../../engine/hex';
import { attackFp } from '../../engine/fire';
import { losCheck } from '../../engine/los';
import { cover, currentStats } from '../../engine/stats';
import { cardOf, isUnit } from '../../engine/state';
import type { Decision, GameState, HexId, PieceId, Reveal, Side } from '../../engine/types';
import { other } from '../../engine/types';
import { storage } from '../storage';

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
  /** The last Fire Attack chosen (a 'fire' answer), with the FP its Actions added since. */
  spec?: { side: Side; pieces: PieceId[]; target: HexId; bonus: number } | null;
  /** The last Fire Attack rolled ('fireAttack' event): what the Defense rolls are made against. */
  attack?: { side: Side; total: number; targets: HexId[]; pieces: PieceId[] } | null;
  /** The player activated by the last Rout Order. */
  routed?: Side | null;
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

/** Did `roll` go against `human` (judged from the state right after it, before its result is applied)? */
export function rollAgainst(s: GameState, roll: Reveal, human: Side, ctx: RollContext = {}): boolean {
  let card;
  try {
    card = cardOf(roll.card);
  } catch {
    return false;
  }
  const sum = card.white + card.red;
  const product = card.white * card.red;
  const mine = roll.side === human;
  // `good`: the roll went the roller's way
  const verdict = (good: boolean) => (mine ? !good : good);
  try {
    switch (roll.purpose) {
      case 'fireAttack':
      case 'mine':
      case 'impact': {
        const spec = ctx.spec;
        if (roll.purpose === 'fireAttack' && spec && spec.side === roll.side) {
          const fp = attackFp(s, spec.pieces, [spec.target]).fp + spec.bonus;
          const total = fp + sum;
          const firers = firerHexes(s, spec.pieces);
          const defenders = unitsIn(s, [spec.target], other(roll.side));
          if (defenders.length) return verdict(defenders.some((u) => total - defense(s, u, firers) >= 7));
        }
        return mine ? sum <= 6 : sum >= 8;
      }
      case 'targeting': {
        const spec = ctx.spec;
        if (spec && spec.side === roll.side && spec.pieces.length === 1) {
          const from = firerHexes(s, spec.pieces)[0];
          if (from !== undefined) {
            const hit = product - losCheck(s, from, spec.target).hindrance > distance(from, spec.target);
            return verdict(hit);
          }
        }
        return mine ? product < 12 : product >= 12;
      }
      case 'defense': {
        const a = ctx.attack;
        if (a && a.side !== roll.side) {
          const firers = firerHexes(s, a.pieces);
          const units = unitsIn(s, a.targets, roll.side);
          if (units.length) {
            const totals = units.map((u) => defense(s, u, firers) + sum);
            return mine ? totals.some((t) => t <= a.total) : totals.some((t) => t > a.total);
          }
        }
        return mine ? sum <= 6 : sum >= 8;
      }
      case 'melee':
        return mine ? sum <= 6 : sum >= 8;
      case 'rally': {
        const units = brokenOf(s, roll.side);
        if (!units.length) return false;
        return mine ? units.some((u) => sum >= defense(s, u)) : units.some((u) => sum < defense(s, u));
      }
      case 'rout': {
        const routed = ctx.routed ?? other(roll.side);
        const units = brokenOf(s, routed);
        if (!units.length) return false;
        const retreats = units.map((u) => sum > defense(s, u));
        // the roller wants the routed units to retreat unless they are his own
        const goodForRoller = routed === roll.side ? retreats.every((x) => !x) : retreats.some(Boolean);
        return verdict(goodForRoller);
      }
      case 'suddenDeath': {
        const ends = sum < s.time;
        const leader: Side = s.vp > 0 ? 'axis' : s.vp < 0 ? 'allied' : s.initiative;
        return ends ? leader !== human : leader === human;
      }
      default:
        return false;
    }
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
