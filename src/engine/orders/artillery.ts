// Artillery (§12, §O17, §O18). Artillery Denied breaks the enemy Radio (a broken one is eliminated). Artillery Request
// is Battery Access (a broken Radio flips back, nothing is activated) or Fire For Effect: an unbroken Leader not yet
// activated this Turn, the Spotter, is activated alone; the Spotting Round goes in any hex in his LOS (any range,
// impassable hexes too); a Radio that shows Smoke may announce a Smoke barrage; the Accuracy roll (the product, less
// the largest Hindrance on the Spotter's LOS, against the range) decides the drift — a hit moves the SR one hex by the
// white die's compass direction and one by the coloured die's, a miss as many hexes as the coloured die by the white
// die's — and the Order ends with no effect if the SR leaves the map at any point; then the Impact on the SR hex and
// its six neighbours: a random Smoke marker in each that can hold one, or one Impact roll per hex with a unit or a
// Fortification in the order the requester picks, each resolved as a Fire Attack (Radio FP + roll, Airburst +2 in
// Woods, no Hindrance, no height, Fortifications +1 Cover, no Wall / Hedge Cover, Jammed! has no effect; the exact
// roll of the Fortification Vulnerability table destroys the Fortification first).
//
// The SR marker lives in `s.spottingRound` (-1 when off the map) only while a Fire For Effect is resolved; the events
// are `place` / `remove` with marker 'sr' (one `place` per hex it drifts into).
import { activatable, markActivated } from '../activation';
import { breakPiece } from '../casualties';
import { reveal, roll } from '../deck';
import { ask, choose, type Gen } from '../decisions';
import { defendHex } from '../fire';
import { ALL_HEXES, SIDES, distance, label, neighbour, type HexSide } from '../hex';
import { losCheck } from '../los';
import type { OrderHandler } from '../registry';
import { drawSmoke, isLeader, isWater, placeSmoke, radioOf, removeFort, typeOf, unitsIn } from '../state';
import { type Answer, type AttackInfo, type FateCard, type FlowCtx, type GameState, type HexId, type Piece, type PieceId, type Side, other } from '../types';

// ---------------------------------------------------------------------------------------------------------------------
// Smoke markers

/** Can a Smoke marker be placed in `hex`: not Water, Stream or Marsh, no Blaze (§8.1, T89, T95, R-26)? */
export function canHoldSmoke(s: GameState, hex: HexId): boolean {
  return !isWater(s.map, hex) && !s.blaze[hex];
}

/**
 * Draw a random Smoke marker from the cup and place it in `hex` (the larger of two stays, R-42; the other goes back to
 * the cup). Nothing is drawn for a hex that cannot hold Smoke, or when the cup is empty. Returns whether one was placed.
 */
export function placeRandomSmoke(s: GameState, ctx: FlowCtx, hex: HexId): boolean {
  if (!canHoldSmoke(s, hex)) return false;
  const v = drawSmoke(s);
  if (v === null) {
    ctx.emit({ kind: 'log', text: `No Smoke marker is left in the cup for ${label(hex)}.` });
    return false;
  }
  return placeSmoke(s, ctx, hex, v);
}

// ---------------------------------------------------------------------------------------------------------------------
// Artillery Denied (§O17)

export const artilleryDeniedOrder: OrderHandler = {
  canGive: (s, side) => radioOf(s, other(side)) !== null,
  *run(s, ctx, side) {
    const r = radioOf(s, other(side));
    if (r) yield* breakPiece(s, ctx, r.id, 'other');
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Artillery Request (§O18)

/** The Impact roll (dice sum) that destroys a Fortification for a Radio of `fp` FP (§O18.2.3.3): 8 → 12 … 13 → 7. */
export function vulnerableRoll(fp: number): number {
  return 20 - fp;
}

/** `side`'s Leaders that may be the Spotter: unbroken, on the map, not yet activated this Turn (Heroes always). */
export function spotters(s: GameState, side: Side): PieceId[] {
  const out: PieceId[] = [];
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.side === side && isLeader(p) && !p.broken && activatable(s, p)) out.push(id);
  }
  return out;
}

/** The hexes where the Spotter may place the Spotting Round: every hex in his LOS (any range, impassable ones too). */
export function spottingHexes(s: GameState, spotter: PieceId): HexId[] {
  const from = s.pieces[spotter].hex;
  return ALL_HEXES.filter((h) => losCheck(s, from, h).clear);
}

/** The blast area of an SR in `hex` (§O18.2.3): the hex, then its on-map neighbours by compass side 1..6. */
export function blastArea(hex: HexId): HexId[] {
  const out = [hex];
  for (const side of SIDES) {
    const n = neighbour(hex, side);
    if (n !== null) out.push(n);
  }
  return out;
}

/** Does `hex` get an Impact roll: a unit of either side or a Fortification in it (§O18.2.3)? */
function impactTarget(s: GameState, hex: HexId): boolean {
  return s.fort[hex] !== null || unitsIn(s, hex).length > 0;
}

function placeSr(s: GameState, ctx: FlowCtx, hex: HexId): void {
  s.spottingRound = hex;
  ctx.emit({ kind: 'place', hex, marker: 'sr' });
}

function removeSr(s: GameState, ctx: FlowCtx): void {
  if (s.spottingRound < 0) return;
  ctx.emit({ kind: 'remove', hex: s.spottingRound, marker: 'sr' });
  s.spottingRound = -1;
}

/**
 * Move the SR by the drift card (§O18.2.2): after a hit one hex by the white die's compass direction, then one by the
 * coloured die's; after a miss as many hexes as the coloured die by the white die's. Returns false (the SR removed) if
 * it leaves the map at any point.
 */
function drift(s: GameState, ctx: FlowCtx, side: Side, card: FateCard, hit: boolean): boolean {
  const steps = hit ? [card.white, card.red] : Array<number>(card.red).fill(card.white);
  const from = s.spottingRound;
  for (const dir of steps) {
    const next = neighbour(s.spottingRound, dir as HexSide);
    if (next === null) {
      ctx.emit({ kind: 'log', text: `The Spotting Round drifts off the map from ${label(s.spottingRound)}: the barrage has no effect.`, side });
      removeSr(s, ctx);
      return false;
    }
    placeSr(s, ctx, next);
  }
  const how = hit ? `${card.white} then ${card.red}` : `${card.red} × ${card.white}`;
  ctx.emit({ kind: 'log', text: `The Spotting Round drifts ${how}: from ${label(from)} to ${label(s.spottingRound)}.`, side });
  return true;
}

/**
 * One Artillery Impact roll on `hex` (§O18.2.3.1–3): Radio FP + roll (+2 Airburst in Woods) against every unit there
 * at the roll, either side. Jammed! has no effect (a Radio is not a Weapon, §12); the exact roll of the Fortification
 * Vulnerability table destroys the Fortification before any Defense roll.
 */
function* impact(s: GameState, ctx: FlowCtx, side: Side, radio: Piece, fp: number, hex: HexId): Gen {
  const ids = unitsIn(s, hex).map((p) => p.id);
  const attack: AttackInfo = {
    side, mode: 'artillery', pieces: [radio.id], targets: [hex], ordnance: false, mortarOrArtillery: true, ignoresCover: false,
    fp, bonus: 0, total: null, reduction: 0, played: [],
  };
  const r = yield* roll(s, ctx, side, 'impact');
  const airburst = s.map.terrain[hex] === 'Woods' ? 2 : 0;
  attack.total = fp + r.sum + airburst;
  ctx.emit({ kind: 'fireAttack', side, pieces: [radio.id], target: hex, fp, total: attack.total });
  if (s.fort[hex] !== null && r.sum === vulnerableRoll(fp)) {
    ctx.emit({ kind: 'log', text: `The Impact roll of ${r.sum} destroys the ${s.fort[hex]} in ${label(hex)}.`, side });
    removeFort(s, ctx, hex);
  }
  yield* defendHex(s, ctx, attack, hex, ids, []);
}

/** The barrage: each blast hex with a unit or a Fortification gets one Impact roll, the next one picked by `side`. */
function* barrage(s: GameState, ctx: FlowCtx, side: Side, radio: Piece, fp: number, blast: HexId[]): Gen {
  const done = new Set<HexId>();
  for (;;) {
    const left = blast.filter((h) => !done.has(h) && impactTarget(s, h)).sort((a, b) => a - b);
    if (!left.length) return;
    const [i] = yield* choose(s, ctx, side, 'impactOrder', left.map((hex) => ({ hex })), 1, 1, { sr: s.spottingRound });
    const hex = left[i];
    done.add(hex);
    yield* impact(s, ctx, side, radio, fp, hex);
  }
}

/** Fire For Effect (§O18.2) with `side`'s unbroken Radio. */
function* fireForEffect(s: GameState, ctx: FlowCtx, side: Side, card: FateCard, radio: Piece): Gen {
  const units = spotters(s, side);
  if (!units.length) return;
  const a = yield* ask(s, ctx, { kind: 'activate', side, order: 'Artillery Request', card: card.id, units, alone: 'Spotter' });
  const spotter = (a as Extract<Answer, { kind: 'activate' }>).units[0];
  markActivated(s, ctx, side, [spotter], 'Artillery Request');
  const from = s.pieces[spotter].hex;
  const hexes = spottingHexes(s, spotter);
  const [k] = yield* choose(s, ctx, side, 'spotterSR', hexes.map((hex) => ({ hex })), 1, 1, { spotter, radio: radio.id });
  placeSr(s, ctx, hexes[k]);
  try {
    const t = typeOf(radio);
    let smoke = false;
    if (t.smoke) {
      // items: 0 = the barrage (Impact rolls), 1 = a Smoke barrage; announced before Accuracy (§O18.2.1)
      const [c] = yield* choose(s, ctx, side, 'artilleryKind', [{ label: 'Barrage' }, { label: 'Smoke barrage' }], 1, 1, { hex: s.spottingRound, radio: radio.id });
      smoke = c === 1;
      if (smoke) ctx.emit({ kind: 'log', text: 'A Smoke barrage is announced.', side });
    }
    const fp = t.front.fp;
    const sr = s.spottingRound;
    const range = distance(from, sr);
    const hind = losCheck(s, from, sr).hindrance;
    const r = yield* roll(s, ctx, side, 'accuracy');
    const hit = r.product - hind > range;
    ctx.emit({ kind: 'targeting', side, piece: radio.id, target: sr, product: r.product, need: range + hind + 1, hit });
    const d = yield* reveal(s, ctx, side, 'drift');
    if (!drift(s, ctx, side, d, hit)) return;
    const blast = blastArea(s.spottingRound);
    if (smoke) for (const h of blast) placeRandomSmoke(s, ctx, h);
    else yield* barrage(s, ctx, side, radio, fp, blast);
  } finally {
    removeSr(s, ctx);
  }
}

export const artilleryRequestOrder: OrderHandler = {
  /** Battery Access with a broken Radio; Fire For Effect with an unbroken one and a possible Spotter. */
  canGive(s, side) {
    const r = radioOf(s, side);
    return !!r && (r.broken || spotters(s, side).length > 0);
  },
  /** Fire For Effect activates the Spotter alone (activationCandidates does not apply: use `spotters`). */
  activationError(s, side, units) {
    if (units.length !== 1) return 'Fire For Effect activates one Leader alone: the Spotter.';
    const p = s.pieces[units[0]];
    if (!p || !isLeader(p) || p.broken) return 'The Spotter must be an unbroken Leader.';
    const r = radioOf(s, side);
    return r && !r.broken ? null : 'Fire For Effect needs an unbroken Radio.';
  },
  *run(s, ctx, side, card) {
    const r = radioOf(s, side);
    if (!r) return;
    if (r.broken) {
      r.broken = false;
      ctx.emit({ kind: 'fix', piece: r.id });
      ctx.emit({ kind: 'log', text: 'Battery Access: the Radio is working again.', side });
      return;
    }
    yield* fireForEffect(s, ctx, side, card, r);
  },
};
