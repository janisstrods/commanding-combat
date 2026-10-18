// The randomiser moment (backlog §3): when a Fate-card reveal picks a Random Hex (§1.8: a Sniper!, an Event, the S7
// Random Hex set-up), the player sees the pick happen. The revealed card pops up face down, a highlight hops over the
// hexes that deck can show (German cards print odd hex numbers only, the others even ones), slows down and closes in,
// and lands on the card's hex as the card turns face up; then the map marks what the hex reaches by the rules and the
// units hit react. Events and Snipers get a banner naming them, saying what they do and listing what they did.
//
// Pure: engine events (as the viewer may see them, see hidden.ts) → steps for the controller, and the timings at each
// speed. The hop path is decoration, but it never visits a hex the deck could not have shown, and it always lands on
// the card's own hex; what the hex then reaches is read with the engine's own rules helpers.
import { EVENT_TEXT } from '../../data/card-texts';
import { deckOf } from '../../engine/data';
import { canBlaze, mapUnits, nearest, occupiedHexes } from '../../engine/events/helpers';
import { distance, label, neighbours } from '../../engine/hex';
import { sniperExtraTargets } from '../../engine/scenarioRules';
import { canHoldFort, cardOf, hexOf, isWater, isWeapon } from '../../engine/state';
import type { CardId, EventName, GameEvent, GameState, HexId, Nation, PieceId, Side } from '../../engine/types';
import type { Speed } from './controller';

/** Why a Random Hex is picked: a Sniper!, the Event that asks for it, the S7 set-up, or anything else. */
export type HexReason = 'sniper' | 'setup' | 'other' | EventName;

/** An Event! or Sniper! being carried out (from its trigger to its `triggerDone`). */
export interface Moment {
  kind: 'sniper' | 'event';
  /** The receiving player: his trigger, his deck, his choices. */
  side: Side;
  event: EventName | null;
  /** The Event's card. */
  card: CardId | null;
  /** The Random Hex, once revealed. */
  target: HexId | null;
}

/** What a hit hex shows: a Sniper's crosshair, a blast (breaks, eliminations, a Blaze), a glow (rallies, repairs), a mark. */
export type ImpactLook = 'crosshair' | 'blast' | 'glow' | 'mark';

/** What a landed Random Hex reaches by the rules. */
export interface Landing {
  /** Hexes lit around the Random Hex (a Sniper's reach; where a placed unit may go). */
  area: HexId[];
  /** Where the effect goes instead of the Random Hex itself (the nearest units / Weapon / occupied hex). */
  redirect: HexId[];
  /** One line on what the hex means now. */
  note: string;
}

export type DramaStep =
  /** The banner comes up: the Event (or Sniper!) named, its text, a pause to read. */
  | { kind: 'open'; moment: Moment }
  /** The randomiser runs for the card's Random Hex. */
  | { kind: 'spin'; side: Side; card: CardId; target: HexId; reason: HexReason; brief: boolean }
  /** It has landed: the hex is marked with what it reaches. */
  | { kind: 'land'; target: HexId; reason: HexReason; landing: Landing }
  /** A unit, Weapon or marker the moment hit, with a link back to the Random Hex when it lies elsewhere. */
  | { kind: 'impact'; hex: HexId; from: HexId | null; look: ImpactLook }
  /** The moment is over: a last pause to read, then the banner goes. */
  | { kind: 'close' };

// ---------------------------------------------------------------------------------------------------------------------
// What the screen shows (the controller's view state)

/** The randomiser on the map, in board coordinates (DramaLayer.tsx). */
export interface HexPick {
  id: number;
  /** Whose deck. */
  side: Side;
  reason: HexReason;
  target: HexId;
  /** Lit one after the other from the moment it is shown (CSS-timed). */
  hops: Hop[];
  landAt: number;
  settle: number;
  /** It has landed: the target is marked with what it reaches. */
  landed: boolean;
  area: HexId[];
  redirect: HexId[];
  /** Reduced motion: no hops, nothing moves. */
  calm: boolean;
}

/** A hex an Event or Sniper! just hit: a short burst, with a link back to the Random Hex when it lies elsewhere. */
export interface Impact {
  id: number;
  hex: HexId;
  from: HexId | null;
  look: ImpactLook;
}

/** The banner of the Event or Sniper! being carried out (EventBanner.tsx). */
export interface Banner {
  id: number;
  kind: 'sniper' | 'event';
  side: Side;
  title: string;
  text: string;
  /** The Event's card. */
  card: CardId | null;
  /** The card revealed for the Random Hex: face down while the randomiser runs, face up once it has landed. */
  hexCard: CardId | null;
  hex: HexId | null;
  /** What the landed hex reaches (Landing.note). */
  note: string | null;
  /** What happened, in order (the log's own lines). */
  lines: string[];
  /** A reading pause is on: a click, a tap or Space goes on. */
  hold: boolean;
  /** Carried out to its end. */
  done: boolean;
  calm: boolean;
}

const NO_STEPS: DramaStep[] = [];

function pieceHex(s: GameState, id: PieceId): HexId {
  const p = s.pieces[id];
  return p ? hexOf(s, p) : -1;
}

/**
 * The steps event `e` adds to the moment `m` (null between moments), and the moment after it. `s`: the game right
 * after `e`; `before`: right before it (where an eliminated piece was). Both as the viewer sees them.
 */
export function dramaSteps(m: Moment | null, e: GameEvent, s: GameState, before: GameState): { moment: Moment | null; steps: DramaStep[] } {
  switch (e.kind) {
    case 'trigger': {
      if (e.trigger !== 'Sniper') return { moment: m, steps: NO_STEPS };
      const moment: Moment = { kind: 'sniper', side: e.side, event: null, card: null, target: null };
      return { moment, steps: [{ kind: 'open', moment }] };
    }
    case 'event': {
      const moment: Moment = { kind: 'event', side: e.side, event: e.event, card: e.card, target: null };
      return { moment, steps: [{ kind: 'open', moment }] };
    }
    case 'reveal': {
      if (e.purpose !== 'randomHex') return { moment: m, steps: NO_STEPS };
      const target = cardOf(e.card).hex;
      const reason: HexReason = m ? (m.kind === 'sniper' ? 'sniper' : (m.event ?? 'other')) : s.phase === 'setup' ? 'setup' : 'other';
      return {
        moment: m ? { ...m, target } : null,
        steps: [
          { kind: 'spin', side: e.side, card: e.card, target, reason, brief: !m },
          { kind: 'land', target, reason, landing: landing(reason, target, s, e.side) },
        ],
      };
    }
    case 'triggerDone':
    case 'gameOver':
    case 'turnStart':
      return { moment: null, steps: m ? [{ kind: 'close' }] : NO_STEPS };
    default:
      break;
  }
  if (!m) return { moment: m, steps: NO_STEPS };
  const hit = impactOf(m, e, s, before);
  if (!hit || hit.hex < 0) return { moment: m, steps: NO_STEPS };
  const from = m.target !== null && m.target !== hit.hex ? m.target : null;
  return { moment: m, steps: [{ kind: 'impact', hex: hit.hex, from, look: hit.look }] };
}

/** Where event `e` of a moment hits, and how it looks; null for events that hit nothing on the map. */
function impactOf(m: Moment, e: GameEvent, s: GameState, before: GameState): { hex: HexId; look: ImpactLook } | null {
  switch (e.kind) {
    case 'break':
      return { hex: pieceHex(s, e.piece), look: m.kind === 'sniper' ? 'crosshair' : 'blast' };
    case 'eliminate':
      return { hex: pieceHex(before, e.piece), look: 'blast' };
    case 'suppress':
      return { hex: pieceHex(s, e.piece), look: 'blast' };
    case 'rally':
    case 'veteran':
    case 'fix':
      return { hex: pieceHex(s, e.piece), look: 'glow' };
    case 'replace':
      return { hex: pieceHex(s, e.by[0] ?? e.piece), look: 'mark' };
    case 'place':
      if (e.piece) return { hex: e.hex, look: 'mark' };
      return e.marker ? { hex: e.hex, look: e.marker === 'blaze' ? 'blast' : 'mark' } : null;
    case 'remove':
      return { hex: e.hex, look: 'mark' };
    default:
      return null;
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const uniq = (hs: HexId[]) => [...new Set(hs)].sort((a, b) => a - b);
const names = (hs: HexId[]) => hs.map(label).join(' / ');

const FORT_OF: Partial<Record<EventName, string>> = { 'Booby Trap': 'Mines', Rubble: 'Wire', Shellholes: 'Foxholes' };

/** Why nothing can be placed in `hex` (Water, a Blaze, a Fortification). */
function blocked(s: GameState, hex: HexId): string {
  if (isWater(s.map, hex)) return `${s.map.terrain[hex]}`;
  if (s.blaze[hex]) return 'Ablaze';
  const f = s.fort[hex];
  return f ? `${f.charAt(0).toUpperCase()}${f.slice(1)} already there` : 'Blocked';
}

/**
 * What Random Hex `hex`, picked for `reason` by `side`, reaches (rules-reference §1.9.1.3, §E43–§E76), read on `s`
 * (the game right after the reveal) with the same helpers the Event handlers use.
 */
export function landing(reason: HexReason, hex: HexId, s: GameState, side: Side): Landing {
  const around = uniq([hex, ...neighbours(hex)]);
  switch (reason) {
    case 'sniper': {
      const near = mapUnits(s, undefined, (p) => around.includes(p.hex));
      const extra = sniperExtraTargets(s, side, hex);
      const n = near.length + extra.length;
      return {
        area: uniq([...around, ...extra.map((p) => p.hex)]),
        redirect: [],
        note: n ? `${plural(n, 'unit')} in reach: one may be broken.` : 'No unit in or next to it: the Sniper has no target.',
      };
    }
    case 'Air Support': {
      const occupied = occupiedHexes(s);
      if (!occupied.length) return { area: [hex], redirect: [], note: 'No units on the map: nothing to strike.' };
      if (occupied.includes(hex)) return { area: [hex], redirect: [], note: 'Units here: all of them may be broken.' };
      const near = nearest(occupied, (h) => distance(hex, h));
      return { area: [hex], redirect: near, note: `Empty: the nearest units, in ${names(near)}, may be broken.` };
    }
    case 'Shell Shock': {
      const close = nearest(mapUnits(s), (p) => distance(hex, p.hex));
      if (!close.length) return { area: [hex], redirect: [], note: 'No units on the map.' };
      const hs = uniq(close.map((p) => p.hex));
      const where = hs.length === 1 && hs[0] === hex ? 'here' : `in ${names(hs)}`;
      return { area: [hex], redirect: hs.filter((h) => h !== hex), note: close.length > 1 ? `One of the nearest units (${where}) breaks.` : `The nearest unit, ${where}, breaks.` };
    }
    case 'Malfunction': {
      const weapons = Object.values(s.pieces).filter((w) => isWeapon(w) && w.where === 'carried' && !w.broken && hexOf(s, w) >= 0);
      const close = nearest(weapons, (w) => distance(hex, hexOf(s, w)));
      if (!close.length) return { area: [hex], redirect: [], note: 'No unbroken Weapon on the map.' };
      const hs = uniq(close.map((w) => hexOf(s, w)));
      const where = hs.length === 1 && hs[0] === hex ? 'here' : `in ${names(hs)}`;
      return { area: [hex], redirect: hs.filter((h) => h !== hex), note: `The nearest unbroken Weapon, ${where}, breaks.` };
    }
    case 'Blaze':
      return { area: [hex], redirect: [], note: canBlaze(s, hex) ? 'A Blaze starts here; its units must move out.' : `${blocked(s, hex)}: no Blaze can start here.` };
    // a placement that the hex allows still needs a marker left (the Smoke cup, the counter mix): the engine's own line
    // tells whether it was placed, so only the hexes that rule it out get a note here
    case 'Dust':
      return { area: [hex], redirect: [], note: isWater(s.map, hex) || s.blaze[hex] ? `${blocked(s, hex)}: no Smoke can be placed here.` : '' };
    case 'Booby Trap':
    case 'Rubble':
    case 'Shellholes': {
      const what = FORT_OF[reason]!;
      return { area: [hex], redirect: [], note: canHoldFort(s, hex) ? '' : `${blocked(s, hex)}: no ${what} can go here.` };
    }
    case 'Infiltration':
    case 'Walking Wounded':
      return { area: around, redirect: [], note: 'The unit is placed in or next to it.' };
    case 'setup':
      return { area: around, redirect: [], note: 'A unit sets up in or next to it.' };
    default:
      return { area: [hex], redirect: [], note: '' };
  }
}

/** The banner's title and rules text for a moment (our own paraphrases, src/data/card-texts.ts). */
export function momentText(m: Moment): { title: string; text: string } {
  if (m.kind === 'sniper') return { title: 'Sniper!', text: 'A Random Hex: the roller may break one unit, of either side, in it or next to it.' };
  const ev = m.event!;
  return { title: ev, text: EVENT_TEXT[ev] ?? '' };
}

// ---------------------------------------------------------------------------------------------------------------------
// The hop path and the timings

/** Every hex a nation's Fate deck can show as its Random Hex (the whole deck, so nothing about the draw pile leaks). */
const DECK_HEXES = new Map<Nation, HexId[]>();
export function deckHexes(nation: Nation): HexId[] {
  let hs = DECK_HEXES.get(nation);
  if (!hs) {
    hs = uniq(deckOf(nation).map((id) => cardOf(id).hex));
    DECK_HEXES.set(nation, hs);
  }
  return hs;
}

/** One hex the randomiser lights on its way: from `at` ms after the start, for `ms`. */
export interface Hop {
  hex: HexId;
  at: number;
  ms: number;
}

export interface Spin {
  /** The hexes lit before the landing (never the target), each a little longer than the one before. */
  hops: Hop[];
  /** When it lands on the target (ms after the start). */
  landAt: number;
  /** How long the landed hex stays marked before play goes on (ms). */
  settle: number;
}

export interface SpinTiming {
  hops: number;
  /** The first and the last hop's length (ms): the run slows down in between. */
  first: number;
  last: number;
  settle: number;
}

/** The randomiser at each animation speed (Instant: none). */
export const SPIN_TIMING: Record<Exclude<Speed, 'instant'>, SpinTiming> = {
  slow: { hops: 16, first: 75, last: 360, settle: 1500 },
  normal: { hops: 12, first: 55, last: 270, settle: 1050 },
  fast: { hops: 6, first: 45, last: 150, settle: 450 },
};

/** A small seeded generator (mulberry32): the same reveal always runs the same path. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed from a card id and a counter. */
export function seedOf(card: CardId, n = 0): number {
  let h = 2166136261 ^ n;
  for (let i = 0; i < card.length; i++) h = Math.imul(h ^ card.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * The randomiser's run onto `target` over `pool` (the hexes the deck can show): null at Instant speed. It hops at
 * random, never twice within three hops, each hop a little longer than the last; the last four close in on the target
 * (within 5, 4, 3 and 2 hexes). `brief`: the short version (a set-up placement); `calm` (reduced motion): no hops, the
 * hex is simply marked and held a little longer.
 */
export function spinPlan(target: HexId, pool: readonly HexId[], opt: { speed: Speed; seed: number; brief?: boolean; calm?: boolean }): Spin | null {
  if (opt.speed === 'instant') return null;
  const t = SPIN_TIMING[opt.speed];
  const settle = Math.round(t.settle * (opt.brief ? 0.5 : 1));
  if (opt.calm) return { hops: [], landAt: 0, settle: settle + Math.round(t.settle * 0.5) };
  const n = opt.brief ? Math.max(3, Math.round(t.hops / 2)) : t.hops;
  const last = opt.brief ? Math.round(t.first + (t.last - t.first) * 0.6) : t.last;
  const rnd = seeded(opt.seed);
  const cands = pool.filter((h) => h !== target);
  const path: HexId[] = [];
  for (let i = 0; i < n; i++) {
    const left = n - i; // hops still to come, this one included
    const recent = path.slice(-3);
    const fresh = cands.filter((h) => !recent.includes(h));
    const close = left <= 4 ? fresh.filter((h) => distance(h, target) <= left + 1) : fresh;
    const from = close.length ? close : fresh.length ? fresh : cands;
    if (!from.length) break;
    path.push(from[Math.floor(rnd() * from.length)]);
  }
  const hops: Hop[] = [];
  let at = 0;
  path.forEach((hex, i) => {
    const k = path.length > 1 ? i / (path.length - 1) : 1;
    const ms = Math.round(t.first + (last - t.first) * k * k);
    hops.push({ hex, at, ms });
    at += ms;
  });
  return { hops, landAt: at, settle };
}

const READ_FACTOR: Record<Exclude<Speed, 'instant'>, number> = { slow: 0.7, normal: 1, fast: 1.8 };

/**
 * How long a banner holds for reading `chars` characters (ms; a click, a tap or Space ends it sooner): 0 at Instant.
 * About 30 ms a character at Normal, from 1.4 to 5.2 s; Slow gives more time, Fast less (never under 0.7 s).
 */
export function readMs(chars: number, speed: Speed): number {
  if (speed === 'instant') return 0;
  const base = Math.min(5200, Math.max(1400, 900 + chars * 30));
  return Math.max(700, Math.round(base / READ_FACTOR[speed]));
}

/**
 * The banner's first pause, before the moment plays on: the name and about half the text (the rest is read while the
 * randomiser runs and the hits come in; the banner stays up to the end). At least 1.2 s at Normal; 0 at Instant.
 */
export function introMs(title: string, text: string, speed: Speed): number {
  const ms = readMs(title.length + text.length, speed);
  return ms && Math.max(Math.min(ms, 1200), Math.round(ms * 0.6));
}
