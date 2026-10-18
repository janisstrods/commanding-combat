// Where the pieces of one hex go, side by side so that none hides another (pure maths; StackView draws it).
//
// A stack is a list of roles in drawing order: 'unit' (a counter of its own), 'weapon' (sits beside the unit before it,
// smaller, bottom-aligned) and 'marker' (a hex marker: fortification, Smoke, Blaze, control). Units with their weapons
// are packed in rows inside the hex (flat-topped, radius 1, centred on (0, 0)); markers get a band along the top edge.
// When the hex is too small on screen for that to be readable, a crowded stack fans out instead: the same rows at a
// readable size on a tray centred on the hex (spilling over its neighbours). An expanded stack is a fan-out at a larger
// size still. Every size is in hex units; `side` is a counter's side (a unit's, a weapon's or a marker's).
import { APOTHEM, SQRT3 } from './geometry';

export type StackRole = 'unit' | 'weapon' | 'marker';

export interface Slot {
  x: number;
  y: number;
  side: number;
}

export interface StackLayout {
  /** One per role, in the input order: the centre and side of that piece. */
  slots: Slot[];
  mode: 'inside' | 'fan' | 'expanded';
  /** The tray drawn behind a fanned-out or expanded stack. */
  tray: { x: number; y: number; w: number; h: number } | null;
  /** The side of a unit counter in this layout. */
  unit: number;
}

export interface StackLayoutOptions {
  /** Screen pixels per hex unit at the current zoom (decides when a crowded stack fans out). */
  px?: number;
  expanded?: boolean;
}

/** A weapon's side, relative to the side of the unit carrying it. */
export const WEAPON_REL = 0.62;
/** A lone unit counter's side (the largest a counter gets inside a hex). */
export const MAX_UNIT = 1.12;
/** Below this many screen pixels a unit counter is too small to read: a crowded stack fans out. */
export const READABLE_PX = 22;
/** A fanned-out stack's unit counters are this many screen pixels... */
export const FAN_PX = 32;
/** ...unless that would make them larger than this (zoomed far out: the overview stays tidy instead). */
export const FAN_MAX = 0.95;
/** An expanded stack's unit counters: this many screen pixels, within EXPANDED_MIN..EXPANDED_MAX hex units. */
export const EXPANDED_PX = 60;
export const EXPANDED_MIN = 0.9;
const EXPANDED_MAX = 1.6;

/** Gaps between counters, relative to the unit side. */
const GAP = 0.07;
/** Hex markers: the band along the top edge. */
const MARKER_MAX = 0.42;
const MARKER_GAP = 0.04;
const MARKER_REL = 0.62;
/** A hex marker with no units in its hex. */
const LONE_MARKER = 0.8;
/** Room left free along the hex's edges, and how far counters may poke past its slanted sides. */
const PAD = 0.05;
const SLACK = 0.12;

interface Group {
  /** Indexes into the roles: the unit (or a lone weapon) first, then its weapons. */
  items: number[];
  /** Whether the group starts with a unit (a lone weapon is a group of weapons only). */
  unit: boolean;
  /** Width in unit sides (gaps included). */
  width: number;
}

function groupsOf(roles: readonly StackRole[]): { groups: Group[]; markers: number[] } {
  const groups: Group[] = [];
  const markers: number[] = [];
  roles.forEach((r, i) => {
    if (r === 'marker') {
      markers.push(i);
      return;
    }
    const last = groups[groups.length - 1];
    if (r === 'weapon' && last) {
      last.items.push(i);
      last.width += GAP + WEAPON_REL;
      return;
    }
    groups.push({ items: [i], unit: r === 'unit', width: r === 'unit' ? 1 : WEAPON_REL });
  });
  return { groups, markers };
}

/** Every split of n groups (in order) into `rows` non-empty rows: the row lengths. */
function compositions(n: number, rows: number): number[][] {
  if (rows === 1) return [[n]];
  const out: number[][] = [];
  for (let first = 1; first <= n - rows + 1; first++) for (const rest of compositions(n - first, rows - 1)) out.push([first, ...rest]);
  return out;
}

/** The width in unit sides of each row (gaps included). */
function rowWidths(groups: readonly Group[], lens: readonly number[]): number[] {
  const out: number[] = [];
  let i = 0;
  for (const len of lens) {
    let w = 0;
    for (let j = 0; j < len; j++) w += groups[i + j].width;
    out.push(w + GAP * (len - 1));
    i += len;
  }
  return out;
}

/** Whether rows of these widths fit inside the hex between yTop and yBot at unit side `c` (rows centred vertically). */
function fits(widths: readonly number[], c: number, yTop: number, yBot: number): boolean {
  const r = widths.length;
  const h = c * (r + GAP * (r - 1));
  if (h > yBot - yTop + 1e-9) return false;
  let y = (yTop + yBot) / 2 - h / 2;
  for (const w of widths) {
    const far = Math.max(Math.abs(y), Math.abs(y + c));
    const half = 1 - far / SQRT3 + SLACK;
    if ((c * w) / 2 > half + 1e-9) return false;
    y += c * (1 + GAP);
  }
  return true;
}

/** The largest unit side at which rows of these widths fit (bisection; 0 when none does). */
function bestSide(widths: readonly number[], yTop: number, yBot: number, cap: number): number {
  if (fits(widths, cap, yTop, yBot)) return cap;
  let lo = 0;
  let hi = cap;
  for (let it = 0; it < 28; it++) {
    const mid = (lo + hi) / 2;
    if (fits(widths, mid, yTop, yBot)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** The row split (and unit side) that gives the largest counters inside the hex. */
function bestRows(groups: readonly Group[], yTop: number, yBot: number): { lens: number[]; c: number } {
  const n = groups.length;
  let best = { lens: [n], c: 0, spread: Infinity };
  for (let rows = 1; rows <= Math.min(n, 5); rows++) {
    for (const lens of compositions(n, rows)) {
      const c = bestSide(rowWidths(groups, lens), yTop, yBot, MAX_UNIT);
      const spread = Math.max(...lens) - Math.min(...lens);
      // larger counters first; then fewer rows; then rows of even length
      if (c > best.c + 1e-6 || (Math.abs(c - best.c) <= 1e-6 && rows === best.lens.length && spread < best.spread)) best = { lens, c, spread };
    }
  }
  return { lens: best.lens, c: best.c };
}

/** Rows for a fan-out: about 1.5 times as wide as tall. */
function fanRows(groups: readonly Group[]): number[] {
  const n = groups.length;
  const total = groups.reduce((s, g) => s + g.width, 0) + GAP * (n - 1);
  const rows = Math.max(1, Math.min(n, Math.round(Math.sqrt(total / 1.5))));
  const lens: number[] = [];
  for (let r = 0; r < rows; r++) lens.push(Math.floor(n / rows) + (r < n % rows ? 1 : 0));
  return lens;
}

/** Place the groups in rows of the given lengths, centred on (0, yMid), at unit side c. */
function placeRows(groups: readonly Group[], lens: readonly number[], c: number, yMid: number, slots: Slot[]): { w: number; h: number } {
  const widths = rowWidths(groups, lens);
  const r = lens.length;
  const h = c * (r + GAP * (r - 1));
  let y = yMid - h / 2;
  let g = 0;
  for (let row = 0; row < r; row++) {
    let x = (-c * widths[row]) / 2;
    for (let j = 0; j < lens[row]; j++, g++) {
      const group = groups[g];
      group.items.forEach((idx, k) => {
        if (k === 0 && group.unit) {
          slots[idx] = { x: x + c / 2, y: y + c / 2, side: c };
          x += c;
        } else {
          const side = c * WEAPON_REL;
          if (k > 0) x += c * GAP;
          slots[idx] = { x: x + side / 2, y: y + c - side / 2, side };
          x += side;
        }
      });
      x += c * GAP;
    }
    y += c * (1 + GAP);
  }
  return { w: c * Math.max(0, ...widths), h };
}

/** Markers in one row of side m, centred on (0, y). */
function placeMarkers(markers: readonly number[], m: number, y: number, slots: Slot[]): number {
  const n = markers.length;
  const w = n * m + (n - 1) * MARKER_GAP;
  markers.forEach((idx, i) => {
    slots[idx] = { x: -w / 2 + m / 2 + i * (m + MARKER_GAP), y, side: m };
  });
  return w;
}

const cache = new Map<string, StackLayout>();

/** The layout of a stack with these roles (see the file header). Results are cached: treat them as read-only. */
export function layoutStack(roles: readonly StackRole[], opts: StackLayoutOptions = {}): StackLayout {
  const key = `${roles.join(',')}|${opts.px ?? 0}|${opts.expanded ? 1 : 0}`;
  let out = cache.get(key);
  if (!out) {
    if (cache.size > 500) cache.clear();
    out = computeLayout(roles, opts);
    cache.set(key, out);
  }
  return out;
}

function computeLayout(roles: readonly StackRole[], opts: StackLayoutOptions): StackLayout {
  const slots: Slot[] = new Array(roles.length);
  const { groups, markers } = groupsOf(roles);
  if (!roles.length) return { slots, mode: 'inside', tray: null, unit: MAX_UNIT };

  // inside the hex: markers along the top edge, the units below them
  const top = -APOTHEM + PAD;
  const bandWidth = 1 + (2 * PAD) / SQRT3; // the hex's width at the top of the band, give or take
  const m = markers.length ? Math.min(MARKER_MAX, (bandWidth - (markers.length - 1) * MARKER_GAP) / markers.length) : 0;
  const yTop = markers.length ? top + m + MARKER_GAP : top;
  const yBot = APOTHEM - PAD;
  const inside = groups.length ? bestRows(groups, yTop, yBot) : { lens: [], c: MAX_UNIT };

  const px = opts.px ?? 0;
  const fanSide = px > 0 ? FAN_PX / px : Infinity;
  const crowded = groups.length + (markers.length ? 1 : 0) >= 2;
  const fan = !opts.expanded && crowded && px > 0 && inside.c * px < READABLE_PX && fanSide <= FAN_MAX && fanSide > inside.c;
  if (!opts.expanded && !fan) {
    if (!groups.length) {
      // markers alone (Smoke on an empty hex, an empty Foxholes): larger, across the middle
      placeMarkers(markers, Math.min(LONE_MARKER, (1.6 - (markers.length - 1) * MARKER_GAP) / markers.length), 0, slots);
    } else {
      if (markers.length) placeMarkers(markers, m, top + m / 2, slots);
      placeRows(groups, inside.lens, inside.c, (yTop + yBot) / 2, slots);
    }
    return { slots, mode: 'inside', tray: null, unit: inside.c };
  }

  // fanned out or expanded: rows on a tray centred on the hex, markers in a row above them
  const c = opts.expanded ? Math.min(EXPANDED_MAX, Math.max(EXPANDED_MIN, px > 0 ? EXPANDED_PX / px : EXPANDED_MIN, inside.c)) : fanSide;
  const lens = groups.length ? fanRows(groups) : [];
  const mk = c * MARKER_REL;
  const unitsH = lens.length ? c * (lens.length + GAP * (lens.length - 1)) : 0;
  const markH = markers.length ? mk + (groups.length ? c * GAP * 2 : 0) : 0;
  const total = unitsH + markH;
  let w = 0;
  if (markers.length) w = Math.max(w, placeMarkers(markers, mk, -total / 2 + mk / 2, slots));
  if (groups.length) w = Math.max(w, placeRows(groups, lens, c, -total / 2 + markH + unitsH / 2, slots).w);
  const pad = c * 0.12;
  return {
    slots,
    mode: opts.expanded ? 'expanded' : 'fan',
    tray: { x: -w / 2 - pad, y: -total / 2 - pad, w: w + 2 * pad, h: total + 2 * pad },
    unit: c,
  };
}

/**
 * How far to shift a stack drawn at `at` so that its tray stays inside `bounds` (a fanned-out or expanded stack at the
 * map's edge would otherwise spill off the board). Zero for a stack without a tray.
 */
export function trayShift(lay: StackLayout, at: { x: number; y: number }, bounds: { x: number; y: number; w: number; h: number }): { x: number; y: number } {
  const t = lay.tray;
  if (!t) return { x: 0, y: 0 };
  const axis = (lo: number, len: number, blo: number, blen: number) => {
    if (len >= blen) return blo + blen / 2 - (lo + len / 2);
    if (lo < blo) return blo - lo;
    if (lo + len > blo + blen) return blo + blen - (lo + len);
    return 0;
  };
  return { x: axis(at.x + t.x, t.w, bounds.x, bounds.w), y: axis(at.y + t.y, t.h, bounds.y, bounds.h) };
}
