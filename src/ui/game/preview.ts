// Previews for the prompts: what a Fire Attack would do (FP after Hindrance and height, the Targeting chance of
// Ordnance, each defender's Morale + Cover and its chance to break), and where a moving group can get to.
import { attackFp, shooter } from '../../engine/fire';
import { distance, neighbours } from '../../engine/hex';
import { losCheck } from '../../engine/los';
import { exitHexes, mpLeft, stepCost } from '../../engine/orders/move';
import { cover, currentStats } from '../../engine/stats';
import { hasUnitOf, hexOf, isUnit, typeOf } from '../../engine/state';
import { hasRoad } from '../../engine/terrain';
import type { GameState, HexId, PieceId, Side } from '../../engine/types';
import { other } from '../../engine/types';
import { attackOdds, targetingChance } from './odds';
import { pieceName } from './names';

export interface DefenderPreview {
  id: PieceId;
  name: string;
  /** Current Morale + the Cover it uses against this attack. */
  morale: number;
  cover: number;
  breaks: number;
  ties: number;
  /** Activated to Move: a tie breaks it too. */
  moving: boolean;
}

export interface FirePreview {
  fp: number;
  hindrance: number;
  height: number;
  /** Ordnance: the chance of the Targeting roll hitting (then the attack rolls with the Weapon's FP). */
  targeting: number | null;
  range: number;
  defenders: DefenderPreview[];
}

/** The preview of `pieces` firing at `target` (assumed legal). */
export function firePreview(s: GameState, pieces: PieceId[], target: HexId): FirePreview {
  const a = attackFp(s, pieces, [target]);
  const shooters = pieces.map((id) => shooter(s, id)).filter((x): x is NonNullable<typeof x> => !!x);
  const ord = shooters.length === 1 && shooters[0].ordnance ? shooters[0] : null;
  const firers = shooters.map((x) => x.hex);
  const range = shooters.length ? Math.max(...shooters.map((x) => distance(x.hex, target))) : 0;
  const side: Side | undefined = s.pieces[pieces[0]]?.side;
  const mortar = !!ord && ord.type.weaponClass === 'mortar';
  const ignoresCover = shooters.some((x) => !!x.type.ignoresCover);
  const airburst = mortar && s.map.terrain[target] === 'Woods' ? 2 : 0;
  const defenders: DefenderPreview[] = [];
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.where !== 'map' || p.hex !== target || !side || p.side !== other(side) || !isUnit(p)) continue;
    const c = cover(s, id, { firers, mortarOrArtillery: mortar, ignoresCover });
    const morale = currentStats(s, id).morale + c;
    const o = attackOdds(a.fp + airburst, morale);
    const moving = s.turn.moving.includes(id);
    defenders.push({ id, name: pieceName(s, id), morale, cover: c, breaks: o.breaks + (moving ? o.ties : 0), ties: moving ? 0 : o.ties, moving });
  }
  return {
    fp: a.fp + airburst,
    hindrance: a.hindrance,
    height: a.height,
    targeting: ord ? targetingChance(distance(ord.hex, target), losCheck(s, ord.hex, target).hindrance) : null,
    range,
    defenders,
  };
}

/** "6 FP (−1 Hindrance, +1 height)". */
export function fpText(p: FirePreview): string {
  const mods: string[] = [];
  if (p.hindrance) mods.push(`−${p.hindrance} Hindrance`);
  if (p.height) mods.push(`${p.height > 0 ? '+' : '−'}${Math.abs(p.height)} height`);
  return `${p.fp} FP${mods.length ? ` (${mods.join(', ')})` : ''}`;
}

export interface Reach {
  /** MP left on arrival. */
  left: number;
  /** The hexes entered on the way, ending with this one. */
  path: HexId[];
}

/**
 * Where the group `units` (all in one hex) can get to this Move Order, by the cheapest path: each hex with the MP left
 * on arrival. Approximate (the engine checks every step): a group moves at its slowest member's pace; entering a road
 * hex gives +1 MP once; Wire takes all MP; enemy hexes cannot be entered.
 */
export function reachable(s: GameState, units: PieceId[]): Map<HexId, Reach> {
  const out = new Map<HexId, Reach>();
  if (!units.length) return out;
  const first = s.pieces[units[0]];
  if (!first || first.where !== 'map') return out;
  const side = first.side;
  const start = first.hex;
  const m = s.turn.move;
  const left = Math.min(...units.map((id) => mpLeft(s, id)));
  const hadRoad = units.every((id) => m?.road.includes(id));
  if (s.fort[start] === 'wire' && (m?.spent[units[0]] ?? 0) > 0) return out;
  type Node = { hex: HexId; left: number; road: boolean; path: HexId[] };
  const best = new Map<string, number>();
  const queue: Node[] = [{ hex: start, left, road: hadRoad, path: [] }];
  while (queue.length) {
    queue.sort((a, b) => b.left - a.left);
    const n = queue.shift()!;
    if (n.hex !== start) {
      const cur = out.get(n.hex);
      if (!cur || cur.left < n.left) out.set(n.hex, { left: n.left, path: n.path });
    }
    if (n.left <= 0) continue;
    if (n.hex !== start && s.fort[n.hex] === 'wire') continue;
    for (const to of neighbours(n.hex)) {
      if (hasUnitOf(s, to, other(side))) continue;
      const c = stepCost(s, n.hex, to);
      if (c === null || c > n.left) continue;
      let l = n.left - c;
      let road = n.road;
      if (!road && hasRoad(s.map, to)) {
        road = true;
        l += 1;
      }
      // Wire: entering it, or leaving the Wire hex the group stands in, ends the move
      if (s.fort[to] === 'wire' || (n.hex === start && s.fort[start] === 'wire')) l = 0;
      const key = `${to}:${road ? 1 : 0}`;
      if ((best.get(key) ?? -1) >= l) continue;
      best.set(key, l);
      queue.push({ hex: to, left: l, road, path: [...n.path, to] });
    }
  }
  return out;
}

/** Can the group exit off the enemy edge from where it stands now? */
export function canExitNow(s: GameState, units: PieceId[]): boolean {
  if (!units.length) return false;
  const p = s.pieces[units[0]];
  return p?.where === 'map' && exitHexes(s, p.side).includes(p.hex) && units.every((id) => mpLeft(s, id) >= 1);
}

/** The pieces in `hex` (units, then each unit's Weapon right after it). */
export function piecesIn(s: GameState, hex: HexId): PieceId[] {
  const out: PieceId[] = [];
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.where !== 'map' || p.hex !== hex || !isUnit(p)) continue;
    out.push(id);
    if (p.weapon && s.pieces[p.weapon]) out.push(p.weapon);
  }
  return out;
}

/** Weapons and units of `ids` in hex order; a piece's board hex (a carried Weapon: its carrier's). */
export function boardHex(s: GameState, id: PieceId): HexId {
  const p = s.pieces[id];
  return p ? hexOf(s, p) : -1;
}

export function isWeaponPiece(s: GameState, id: PieceId): boolean {
  const p = s.pieces[id];
  return !!p && typeOf(p).kind === 'weapon';
}
