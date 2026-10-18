// A Recover, Rout or Commissar on screen as a small scene, for both sides: who rolls, for which unit, the number the
// roll must stay under ('rallying', before the Fate card is turned), the roll and the result on the counter, and for a
// retreat who moves the unit and its path hex by hex ('retreat'). Hero and Medic! rallies (no roll) show the unit they
// rally. A pure reducer over the events the human may see (all of these are public), like fireShow.ts: the controller
// paces it, RallyPanel and RallyOverlay draw it.
import { cardOf } from '../../engine/state';
import type { GameEvent, GameState, HexId, PieceId, Side } from '../../engine/types';
import { pieceName } from './names';

export type RallyKind = 'Recover' | 'Rout' | 'Commissar' | 'Hero' | 'Medic';
export type RallyResult = 'rallied' | 'suppressed' | 'still broken' | 'holds' | 'retreats' | 'eliminated';

export interface RallyUnitShow {
  unit: PieceId;
  /** Its owner. */
  side: Side;
  name: string;
  /** Where it stood when its roll was announced. */
  from: HexId;
  /** Current Morale (with `command` from a Leader) and the Cover of its hex; null for a Hero / Medic rally. */
  morale: number | null;
  command: number;
  cover: number | null;
  roll: { value: number; dice: string } | null;
  result: RallyResult | null;
  /** A retreat: the hexes it must go back, the path taken so far, and how an elimination ended it. */
  retreat: { hexes: number; path: HexId[]; end?: 'edge' | 'blocked' } | null;
  /** Its roll is the one being made now. */
  active: boolean;
}

export interface RallyShow {
  id: number;
  kind: RallyKind;
  /** Who rolls (Rout: the active player, maybe for the opponent's units); for Hero / Medic, who rallies. */
  roller: Side;
  units: RallyUnitShow[];
  done: boolean;
}

let nextId = 1;

const ROLL_PURPOSES = new Set(['rally', 'rout', 'eventRoll']);
const EVENT_KINDS = new Set<RallyKind>(['Commissar', 'Hero', 'Medic']);

function hexOf(s: GameState, id: PieceId): HexId {
  const p = s.pieces[id];
  return p?.where === 'map' ? p.hex : -1;
}

function diceOf(card: string): string {
  try {
    const c = cardOf(card);
    return `${c.white}+${c.red}`;
  } catch {
    return '';
  }
}

/** The number the roll is judged against: Morale + Cover (null for a Hero / Medic rally). */
export function rallyTarget(u: RallyUnitShow): number | null {
  return u.morale !== null && u.cover !== null ? u.morale + u.cover : null;
}

/** "Rallies on 7 or less · 8 Suppressed" — what each roll does, from the kind and the target. */
export function rallyNeed(kind: RallyKind, target: number): string {
  const under = target - 1;
  const low = under < 2 ? 'no roll' : `${under} or less`;
  switch (kind) {
    case 'Rout':
      return target > 12 ? 'Any roll holds' : `Holds on ${low} · ${target} Suppressed · ${target + 1}+ retreats`;
    case 'Commissar':
      return target >= 12 ? 'Any roll rallies' : `Rallies on ${target} or less · ${target + 1}+ eliminated`;
    default:
      return target > 12 ? 'Any roll rallies' : target <= 2 ? 'No roll can rally it' : `Rallies on ${low} · ${target} Suppressed`;
  }
}

const withUnit = (show: RallyShow, unit: PieceId, f: (u: RallyUnitShow) => RallyUnitShow): RallyShow => ({
  ...show,
  units: show.units.map((u) => (u.unit === unit ? f(u) : u)),
});

const activeUnit = (show: RallyShow | null) => show?.units.find((u) => u.active) ?? null;

function plainUnit(s: GameState, unit: PieceId, from: HexId): RallyUnitShow {
  return { unit, side: s.pieces[unit]?.side ?? 'axis', name: pieceName(s, unit), from, morale: null, command: 0, cover: null, roll: null, result: null, retreat: null, active: false };
}

/**
 * The rally / rout scene after event `e` (`s`: the game right after it, as the human sees it; `before`: just before it,
 * for where an eliminated unit stood). Returns `show` itself when the event does not concern it.
 */
export function rallyStep(show: RallyShow | null, e: GameEvent, s: GameState, before: GameState = s): RallyShow | null {
  switch (e.kind) {
    case 'turnStart':
    case 'gameOver':
      return null;
    case 'cardPlayed':
      if (e.as !== 'order') return show;
      return e.name === 'Recover' || e.name === 'Rout' ? { id: nextId++, kind: e.name, roller: e.side, units: [], done: false } : null;
    case 'event': {
      const kind = e.event as RallyKind;
      // an Event inside a Recover / Rout (a roll's trigger) adds its rally to that scene
      if (!EVENT_KINDS.has(kind) || (show && !show.done)) return show;
      return { id: nextId++, kind, roller: e.side, units: [], done: false };
    }
    case 'triggerDone':
      if (!show || !EVENT_KINDS.has(show.kind) || show.done) return show;
      return show.units.length ? { ...show, done: true } : null;
    case 'orderDone':
      if (!show || show.done || EVENT_KINDS.has(show.kind)) return show;
      return show.units.length ? { ...show, done: true } : null;
    case 'rallying': {
      if (!show || show.done) return show;
      const known = show.units.some((u) => u.unit === e.unit);
      const fresh = (u: RallyUnitShow): RallyUnitShow => ({ ...u, morale: e.morale, command: e.command, cover: e.cover, roll: null, result: null, active: true });
      const units = known ? show.units : [...show.units, plainUnit(s, e.unit, e.hex)];
      return { ...show, roller: show.kind === 'Commissar' ? e.side : show.roller, units: units.map((u) => (u.unit === e.unit ? fresh(u) : { ...u, active: false })) };
    }
    case 'reveal': {
      const a = activeUnit(show);
      if (!show || !a || a.roll || !ROLL_PURPOSES.has(e.purpose)) return show;
      return withUnit(show, a.unit, (u) => ({ ...u, roll: { value: e.value ?? 0, dice: diceOf(e.card) } }));
    }
    case 'reroll': {
      const a = activeUnit(show);
      return show && a && !a.result ? withUnit(show, a.unit, (u) => ({ ...u, roll: null })) : show;
    }
    case 'rally': {
      if (!show || show.done) return show;
      if (show.units.some((u) => u.unit === e.piece)) return withUnit(show, e.piece, (u) => ({ ...u, result: 'rallied' }));
      // a Hero / Medic! rally (no roll)
      if (!EVENT_KINDS.has(show.kind) || show.kind === 'Commissar') return show;
      return { ...show, units: [...show.units, { ...plainUnit(s, e.piece, hexOf(s, e.piece)), result: 'rallied' }] };
    }
    case 'suppress': {
      const a = activeUnit(show);
      return show && a && a.unit === e.piece && !a.result ? withUnit(show, a.unit, (u) => ({ ...u, result: 'suppressed' })) : show;
    }
    case 'log': {
      const a = activeUnit(show);
      if (!show || !a) return show;
      const end = / retreats off its own edge /.test(e.text) ? 'edge' : / has no way to retreat /.test(e.text) ? 'blocked' : null;
      if (end) {
        return withUnit(show, a.unit, (u) => {
          const target = rallyTarget(u);
          const hexes = u.retreat?.hexes ?? (target !== null && u.roll ? u.roll.value - target : 0);
          return { ...u, retreat: { hexes, path: u.retreat?.path ?? [], end } };
        });
      }
      if (a.result) return show;
      if (/ fails to rally /.test(e.text)) return withUnit(show, a.unit, (u) => ({ ...u, result: 'still broken' }));
      if (/ holds \(/.test(e.text)) return withUnit(show, a.unit, (u) => ({ ...u, result: 'holds' }));
      return show;
    }
    case 'retreat': {
      if (!show || !show.units.some((u) => u.unit === e.unit)) return show;
      return withUnit(show, e.unit, (u) => {
        const target = rallyTarget(u);
        const hexes = u.retreat?.hexes ?? (target !== null && u.roll ? u.roll.value - target : 0);
        return { ...u, result: 'retreats', retreat: { hexes, path: [...(u.retreat?.path ?? []), e.to] } };
      });
    }
    case 'eliminate': {
      if (!show || !show.units.some((u) => u.unit === e.piece)) return show;
      return withUnit(show, e.piece, (u) => {
        // a unit that must retreat off its edge or has nowhere to go: its path ends where it stood
        const target = rallyTarget(u);
        const retreat = u.retreat ?? (show.kind === 'Rout' && target !== null && u.roll && u.roll.value > target ? { hexes: u.roll.value - target, path: [] } : null);
        return { ...u, result: 'eliminated', retreat, from: u.from >= 0 ? u.from : hexOf(before, e.piece) };
      });
    }
    default:
      return show;
  }
}

/** The hexes the scene concerns (for placing its panel): where each unit stood and its retreat path. */
export function rallyHexes(show: RallyShow): HexId[] {
  return show.units.flatMap((u) => [u.from, ...(u.retreat?.path ?? [])]).filter((h) => h >= 0);
}
