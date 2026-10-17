// Current values of units and Weapons (§3.3, §13, §O20.4, §F106), Cover (§T78.3, §T93, R-17, R-20) and stacking (§8.2).
import { isUnit, typeOf } from './state';
import type { GameState, HexId, Piece, PieceId, Side } from './types';

/** Figures per unit kind (§8.2): Squad 4, Team 2, Leader 1. */
export const FIGURES: Readonly<Record<string, number>> = { squad: 4, team: 2, leader: 1 };

export function unitFigures(p: Piece): number {
  return FIGURES[typeOf(p).kind] ?? 0;
}

/** Figures of `side`'s units in `hex`. */
export function figures(s: GameState, hex: HexId, side: Side): number {
  let n = 0;
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.where === 'map' && p.hex === hex && p.side === side && isUnit(p)) n += unitFigures(p);
  }
  return n;
}

/** The stacking limit of `hex` in figures: 7, or a scenario's lower limit. */
export function stackLimit(s: GameState, hex: HexId): number {
  return s.scenario.special.stackingLimits?.[hex] ?? 7;
}

export interface UnitStats {
  fp: number;
  range: number;
  move: number;
  morale: number;
  command: number;
}

/** The sum of the current Command of `side`'s Leaders in `hex` (Unit and Weapon Command, §3.3.1.2-3). */
export function leaderCommand(s: GameState, hex: HexId, side: Side): number {
  let c = 0;
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.where !== 'map' || p.hex !== hex || p.side !== side) continue;
    const t = typeOf(p);
    if (t.kind === 'leader') c += p.broken ? t.broken.command : t.front.command;
  }
  return c;
}

/**
 * A unit's current values (§O20.4): its side's printed values; Squads and Teams + the Command of every friendly Leader
 * in the hex (FP, Range, Movement, Morale); Veteran +1 and Suppressed −1 to all four; Wire −1 FP, Range and Morale; its
 * Weapon's Movement modifier. Command is the Leader's printed value on its current side. Cover is not included.
 */
export function currentStats(s: GameState, id: PieceId): UnitStats {
  const p = s.pieces[id];
  const t = typeOf(p);
  const v = p.broken ? t.broken : t.front;
  let fp = v.fp;
  let range = v.range;
  let move = v.move;
  let morale = v.morale;
  const onMap = p.where === 'map';
  if (onMap && (t.kind === 'squad' || t.kind === 'team')) {
    const c = leaderCommand(s, p.hex, p.side);
    fp += c;
    range += c;
    move += c;
    morale += c;
  }
  if (p.veteran) {
    fp++;
    range++;
    move++;
    morale++;
  }
  if (p.suppressed) {
    fp--;
    range--;
    move--;
    morale--;
  }
  if (onMap && s.fort[p.hex] === 'wire') {
    fp--;
    range--;
    morale--;
  }
  if (p.weapon) move += typeOf(s.pieces[p.weapon]).front.move;
  return { fp, range, move, morale, command: v.command };
}

export interface WeaponStats {
  fp: number;
  range: number;
  /** Mortar minimum range (0 for none). */
  minRange: number;
}

/**
 * A Weapon's current FP and Range (§3.3.1.3): printed values, + the Command of friendly Leaders in its carrier's hex
 * if it is not Ordnance and its carrier is a Squad or Team. Veteran, Suppressed and Wire on the carrier do not change
 * them (they decide whether it may fire at all: fire.ts).
 */
export function weaponStats(s: GameState, id: PieceId): WeaponStats {
  const w = s.pieces[id];
  const t = typeOf(w);
  let fp = t.front.fp;
  let range = t.front.range;
  const c = w.carrier ? s.pieces[w.carrier] : null;
  if (!t.ordnance && c && c.where === 'map') {
    const k = typeOf(c).kind;
    if (k === 'squad' || k === 'team') {
      const cmd = leaderCommand(s, c.hex, c.side);
      fp += cmd;
      range += cmd;
    }
  }
  return { fp, range, minRange: t.minRange ?? 0 };
}
