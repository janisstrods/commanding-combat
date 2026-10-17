// Objectives (§7.3): control (the last side to have solely occupied the Objective, a whole building for a building
// Objective; it flips the moment a unit enters, even mid-move, R-31), Objective chits (open ones score continuously,
// secret ones when revealed), the final score, chit V. Also `relocate`, the one way rules code moves a unit.
import { addVp } from './casualties';
import { OBJECTIVE_CHITS } from './data';
import { isUnit } from './state';
import { type ChitId, type FlowCtx, type GameState, type HexId, type PieceId, type Side, SIDES, UNKNOWN_CHIT } from './types';

/** The hexes of Objective n (1..5): its hex, or every hex of its building (§7.3.1.1). */
export function objectiveHexes(s: GameState, n: number): HexId[] {
  const hex = s.map.objectives[n - 1];
  const b = s.map.building[hex];
  if (b === undefined || b < 0) return [hex];
  const out: HexId[] = [];
  for (let h = 0; h < s.map.building.length; h++) if (s.map.building[h] === b) out.push(h);
  return out;
}

/** The Objective numbers whose area includes `hex`. */
export function objectivesAt(s: GameState, hex: HexId): number[] {
  const out: number[] = [];
  const b = s.map.building[hex];
  for (let i = 0; i < s.map.objectives.length; i++) {
    const o = s.map.objectives[i];
    if (o === hex || (b >= 0 && s.map.building[o] === b)) out.push(i + 1);
  }
  return out;
}

/** VP chit `c` gives Objective n. */
export function chitValue(c: ChitId, n: number): number {
  const d = OBJECTIVE_CHITS[c];
  if (!d) return 0;
  return d.objective === 'all' || d.objective === n ? d.vp : 0;
}

/** VP Objective n is worth by the open chits (§7.3.3). */
export function objectiveValue(s: GameState, n: number): number {
  let v = 0;
  for (const c of s.openChits) v += chitValue(c, n);
  return v;
}

/** Who solely occupies the area of Objective n now (null: nobody, or both sides). */
function soleOccupant(s: GameState, n: number): Side | null {
  const area = new Set(objectiveHexes(s, n));
  let seen = 0;
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.where === 'map' && area.has(p.hex) && isUnit(p)) seen |= p.side === 'axis' ? 1 : 2;
  }
  return seen === 1 ? 'axis' : seen === 2 ? 'allied' : null;
}

/**
 * Update control of the Objectives around `hex` (all of them if omitted): a side that solely occupies one takes it,
 * swinging the open chits' VP from the old controller to the new one.
 */
export function updateControl(s: GameState, ctx: FlowCtx, hex?: HexId): void {
  const list = hex === undefined ? [1, 2, 3, 4, 5].slice(0, s.map.objectives.length) : objectivesAt(s, hex);
  for (const n of list) {
    const occ = soleOccupant(s, n);
    const old = s.control[n - 1];
    if (!occ || occ === old) continue;
    const v = objectiveValue(s, n);
    if (old) addVp(s, ctx, old, -v, `objective ${n}`);
    addVp(s, ctx, occ, v, `objective ${n}`);
    s.control[n - 1] = occ;
    ctx.emit({ kind: 'control', objective: n, side: occ });
  }
}

/** Score chit `c` for the current controllers (when it is revealed or placed open). */
function scoreChit(s: GameState, ctx: FlowCtx, c: ChitId): void {
  for (let n = 1; n <= 5; n++) {
    const who = s.control[n - 1];
    const v = chitValue(c, n);
    if (who && v) addVp(s, ctx, who, v, `chit ${c}`);
  }
}

/** Place chit `c` open and score it at once for the current controllers. */
export function openChit(s: GameState, ctx: FlowCtx, c: ChitId): void {
  s.openChits.push(c);
  ctx.emit({ kind: 'chit', chit: c, side: null, open: true });
  scoreChit(s, ctx, c);
}

/** Reveal one of `side`'s secret chits (Reconnaissance, game end): it becomes open and scores at once (§7.3.3). */
export function revealChit(s: GameState, ctx: FlowCtx, side: Side, c: ChitId): void {
  const list = s.players[side].secretChits;
  const i = list.indexOf(c);
  if (i < 0) return;
  list.splice(i, 1);
  s.openChits.push(c);
  ctx.emit({ kind: 'chit', chit: c, side, open: true });
  scoreChit(s, ctx, c);
}

/**
 * Draw a random chit from the cup (kept shuffled: the top one) for `side`: open (scored at once), or secret — unless
 * it has no secret side (R, V, W, X), then it goes open. Returns the chit, or null if the cup is empty.
 */
export function drawChit(s: GameState, ctx: FlowCtx, side: Side, open: boolean): ChitId | null {
  const c = s.chitCup.shift();
  if (c === undefined) return null;
  if (c === UNKNOWN_CHIT) return null; // a redacted view the AI did not fill in
  if (open || !OBJECTIVE_CHITS[c]?.secret) openChit(s, ctx, c);
  else {
    s.players[side].secretChits.push(c);
    ctx.emit({ kind: 'chit', chit: c, side, open: false });
  }
  return c;
}

/** Chit V (§7.3.2): the side that controls all five Objectives, if V is open. */
export function chitVWinner(s: GameState): Side | null {
  if (!s.openChits.includes('V')) return null;
  for (const side of SIDES) if (s.control.length >= 5 && s.control.slice(0, 5).every((c) => c === side)) return side;
  return null;
}

/**
 * The final score (§6.3 cases 3 and 4): reveal and score every secret chit, then the side with the VP on its side
 * wins; exactly 0 → the Initiative holder.
 */
export function finalScore(s: GameState, ctx: FlowCtx): Side {
  for (const side of SIDES) for (const c of s.players[side].secretChits.slice()) revealChit(s, ctx, side, c);
  return s.vp > 0 ? 'axis' : s.vp < 0 ? 'allied' : s.initiative;
}

/** Move unit `id` (its Weapon goes with it) to `hex`, updating control there. No rules checks: callers decide. */
export function relocate(s: GameState, ctx: FlowCtx, id: PieceId, hex: HexId): void {
  const p = s.pieces[id];
  p.where = 'map';
  p.hex = hex;
  p.space = -1;
  updateControl(s, ctx, hex);
}

