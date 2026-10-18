// A Fire Attack on screen, step by step, for both sides' attacks: who fires at whom ('fireAt'), how the FP is built
// ('firePower'), the Fate roll and the attack total ('reveal', 'fireAttack'), then for each defender its Morale and
// Cover, the roll it needs to hold, its roll and the result ('defending', 'reveal', 'defense', 'eliminate'). Mines and
// Artillery attacks start at their 'fireAttack' event. A pure reducer over the events the human may see (every one of
// these is public), so the controller only paces it and the panel and the board overlay only draw it.
import { cardOf, isUnit } from '../../engine/state';
import type { FireParts, GameEvent, GameState, HexId, PieceId, Side } from '../../engine/types';
import { pieceName } from './names';
import { holdNeed } from './odds';

/** One line of the attack total being built. */
export interface FireLine {
  key: string;
  label: string;
  /** "5", "+1", "−1". */
  value: string;
  kind: 'base' | 'plus' | 'minus' | 'sum' | 'roll' | 'total';
  note?: string;
}

export type DefenseResult = 'holds' | 'suppressed' | 'broken' | 'eliminated';

export interface DefenderShow {
  unit: PieceId;
  side: Side;
  name: string;
  morale: number | null;
  cover: number | null;
  /** The attack total it rolls against (less Concealment), once known. */
  against: number | null;
  moving: boolean;
  roll: { value: number; dice: string } | null;
  total: number | null;
  result: DefenseResult | null;
  /** Its Defense roll is the one being made now. */
  active: boolean;
}

export type FireStage = 'aim' | 'power' | 'roll' | 'total' | 'defense' | 'done';

export interface FireShow {
  id: number;
  /** The firing side. */
  side: Side;
  /** "Fire Attack", "Op Fire", "Assault Fire", "Mines", "Artillery". */
  title: string;
  /** The firing pieces (none for Mines). */
  pieces: PieceId[];
  /** Where they fire from, and at. */
  from: HexId[];
  targets: HexId[];
  stage: FireStage;
  targeting: { product: number; need: number; hit: boolean } | null;
  /** The FP being built ('firePower'), then the roll and the total. */
  lines: FireLine[];
  fp: number | null;
  airburst: number;
  roll: { value: number; dice: string; rerolled: boolean } | null;
  total: number | null;
  defenders: DefenderShow[];
  /** A word on how it ended early ("Missed", "Less than 1 FP: not made"). */
  note: string | null;
}

let nextId = 1;

/** FP Actions (+2 each just before the roll). */
const FP_ACTIONS = new Set(['Bore Sighting', 'Crossfire', 'Hand Grenades', 'Marksmanship', 'Sustained Fire']);

const TITLE: Record<'order' | 'opFire' | 'assault', string> = { order: 'Fire Attack', opFire: 'Op Fire', assault: 'Assault Fire' };

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

function hexOf(s: GameState, id: PieceId): HexId {
  const p = s.pieces[id];
  if (!p) return -1;
  if (p.where === 'map') return p.hex;
  if (p.where === 'carried' && p.carrier) {
    const c = s.pieces[p.carrier];
    return c?.where === 'map' ? c.hex : -1;
  }
  return -1;
}

function diceOf(card: string): string {
  try {
    const c = cardOf(card);
    return `${c.white}+${c.red}`;
  } catch {
    return '';
  }
}

/** The FP lines of `parts`: the best piece, +1 per other piece, Hindrance, height, each Action, the sum. */
export function powerLines(s: GameState, parts: FireParts): FireLine[] {
  const out: FireLine[] = [];
  parts.pieces.forEach((p, i) => {
    const name = pieceName(s, p.piece);
    if (i === 0) out.push({ key: `p-${p.piece}`, label: name, value: String(p.fp), kind: 'base', note: p.command ? `${p.fp - p.command} + Leader ${p.command}` : 'firepower' });
    else out.push({ key: `p-${p.piece}`, label: name, value: '+1', kind: 'plus', note: 'fire group' });
  });
  if (parts.hindrance) out.push({ key: 'hind', label: 'Hindrance', value: signed(-parts.hindrance), kind: 'minus', note: 'on the line of fire' });
  if (parts.height) out.push({ key: 'height', label: parts.height > 0 ? 'Firing down' : 'Firing up', value: signed(parts.height), kind: parts.height > 0 ? 'plus' : 'minus', note: 'height' });
  const fpActions = parts.played.filter((a) => FP_ACTIONS.has(a));
  if (parts.bonus && fpActions.length * 2 === parts.bonus) fpActions.forEach((a, i) => out.push({ key: `a-${i}`, label: a, value: '+2', kind: 'plus', note: 'Action' }));
  else if (parts.bonus) out.push({ key: 'actions', label: 'Actions', value: signed(parts.bonus), kind: 'plus' });
  out.push({ key: 'fp', label: 'Firepower', value: String(parts.fp), kind: 'sum' });
  return out;
}

/** The attack total the defenders face: the total once rolled, else (the re-roll question) the FP + the roll so far. */
export function facing(show: FireShow): number | null {
  if (show.total !== null) return show.total;
  if (show.fp !== null && show.roll) return show.fp + show.roll.value + show.airburst;
  return null;
}

/** The roll defender `d` needs to hold (a roll one lower ties), or null while its numbers are not known. */
export function defenderNeed(show: FireShow, d: DefenderShow): number | null {
  const against = d.against ?? facing(show);
  if (d.morale === null || d.cover === null || against === null) return null;
  return holdNeed(d.morale + d.cover, against);
}

function defender(s: GameState, unit: PieceId, morale: number | null, cover: number | null): DefenderShow {
  return { unit, side: s.pieces[unit]?.side ?? 'axis', name: pieceName(s, unit), morale, cover, against: null, moving: false, roll: null, total: null, result: null, active: false };
}

const withDefender = (show: FireShow, unit: PieceId, f: (d: DefenderShow) => DefenderShow): FireShow => ({
  ...show,
  defenders: show.defenders.map((d) => (d.unit === unit ? f(d) : d)),
});

/** Have all the defenders rolled (or left the target hexes without rolling)? */
function allDone(show: FireShow, s: GameState): boolean {
  return show.defenders.every((d) => d.result !== null || !s.pieces[d.unit] || s.pieces[d.unit].where !== 'map' || !show.targets.includes(s.pieces[d.unit].hex));
}

/** Events after which the attack shown is over and off the screen: play has moved on. */
const CLOSES = new Set<GameEvent['kind']>(['turnStart', 'activate', 'move', 'exit', 'melee', 'gameOver']);

/**
 * The Fire Attack shown after event `e` (the human's view of it; `s`: the game right after it, as the human sees it).
 * Returns `show` itself when the event does not concern it, a new show at the start of an attack, null when it is over.
 */
export function fireStep(show: FireShow | null, e: GameEvent, s: GameState): FireShow | null {
  if (CLOSES.has(e.kind)) return null;
  switch (e.kind) {
    case 'cardPlayed':
      return e.as === 'order' ? null : show;
    case 'fireAt':
      return {
        id: nextId++, side: e.side, title: TITLE[e.mode], pieces: e.pieces.slice(),
        from: [...new Set(e.pieces.map((id) => hexOf(s, id)).filter((h) => h >= 0))], targets: [e.target],
        stage: 'aim', targeting: null, lines: [], fp: null, airburst: 0, roll: null, total: null, defenders: [], note: null,
      };
    case 'targeting': {
      if (!show || show.side !== e.side) return show;
      const next: FireShow = { ...show, targeting: { product: e.product, need: e.need, hit: e.hit } };
      return e.hit ? next : { ...next, stage: 'done', note: 'Missed' };
    }
    case 'firePower': {
      if (!show || show.side !== e.side || show.stage === 'done') return show;
      return {
        ...show, stage: 'power', targets: e.targets.slice(), lines: powerLines(s, e.parts), fp: e.parts.fp, airburst: e.parts.airburst,
        defenders: e.parts.defenders.map((d) => defender(s, d.unit, d.morale, d.cover)),
      };
    }
    case 'log':
      return show && show.stage === 'aim' && /less than 1 FP/.test(e.text) ? { ...show, stage: 'done', note: 'Less than 1 FP: not made' } : show;
    case 'reroll':
      if (!show) return show;
      if (show.stage === 'roll' && show.roll) return { ...show, roll: { ...show.roll, rerolled: true } };
      if (show.stage === 'defense') return { ...show, defenders: show.defenders.map((d) => (d.active && d.roll ? { ...d, roll: null } : d)) };
      return show;
    case 'reveal': {
      if (!show) return show;
      if (e.purpose === 'fireAttack' && e.side === show.side && (show.stage === 'power' || show.stage === 'roll')) {
        return { ...show, stage: 'roll', roll: { value: e.value ?? 0, dice: diceOf(e.card), rerolled: show.stage === 'roll' && !!show.roll?.rerolled } };
      }
      if (e.purpose === 'defense' && show.stage === 'defense') {
        return { ...show, defenders: show.defenders.map((d) => (d.active ? { ...d, roll: { value: e.value ?? 0, dice: diceOf(e.card) } } : d)) };
      }
      return show;
    }
    case 'fireAttack': {
      const ours = show && show.side === e.side && (show.stage === 'power' || show.stage === 'roll');
      if (ours) {
        const roll = show.roll ? show.roll : { value: e.total - e.fp - show.airburst, dice: '', rerolled: false };
        return { ...show, stage: 'total', roll, total: e.total, targets: e.hexes?.length ? e.hexes.slice() : show.targets };
      }
      // Mines and Artillery: no 'fireAt' before them; every unit in the hex defends (Mines: the enemy's only)
      const radio = e.pieces.length === 1 && s.pieces[e.pieces[0]] && !isUnit(s.pieces[e.pieces[0]]);
      const targets = e.hexes?.length ? e.hexes.slice() : [e.target];
      const mines = e.pieces.length === 0;
      const defenders = Object.values(s.pieces)
        .filter((p) => p.where === 'map' && targets.includes(p.hex) && isUnit(p) && (!mines || p.side !== e.side))
        .map((p) => defender(s, p.id, null, null));
      return {
        id: nextId++, side: e.side, title: mines ? 'Mines' : radio ? 'Artillery' : 'Fire Attack', pieces: e.pieces.slice(),
        from: [...new Set(e.pieces.map((id) => hexOf(s, id)).filter((h) => h >= 0))], targets, stage: 'total', targeting: null,
        lines: [{ key: 'fp', label: 'Firepower', value: String(e.fp), kind: 'sum' }], fp: e.fp, airburst: 0,
        roll: { value: e.total - e.fp, dice: '', rerolled: false }, total: e.total, defenders, note: null,
      };
    }
    case 'defending': {
      if (!show || show.stage === 'done' && show.note) return show;
      const known = show.defenders.some((d) => d.unit === e.unit);
      const list = known ? show.defenders : [...show.defenders, defender(s, e.unit, e.morale, e.cover)];
      return {
        ...show,
        stage: 'defense',
        defenders: list.map((d) => (d.unit === e.unit ? { ...d, morale: e.morale, cover: e.cover, against: e.attack, moving: e.moving, active: true } : { ...d, active: false })),
      };
    }
    case 'defense': {
      if (!show || !show.defenders.some((d) => d.unit === e.unit)) return show;
      const result: DefenseResult = e.result === 'break' ? 'broken' : e.result === 'suppress' ? 'suppressed' : 'holds';
      const next = withDefender(show, e.unit, (d) => ({ ...d, total: e.total, against: e.attack, result, roll: d.roll ?? { value: e.total - e.morale, dice: '' } }));
      return allDone(next, s) ? { ...next, stage: 'done' } : next;
    }
    case 'eliminate':
      if (!show || !show.defenders.some((d) => d.unit === e.piece && d.result)) return show;
      return withDefender(show, e.piece, (d) => ({ ...d, result: 'eliminated' }));
    default:
      return show;
  }
}
