// Fate decks (§1): reveals, rolls and their triggers, Random Hexes, the Initiative re-roll (§9.1), Time advances with the
// reshuffle, Sudden Death and reinforcements (§6), and the hand refill (§5.4). Every random number during play comes
// from here: the top card of a player's own draw pile.
//
// Deck exhaustion: whenever a reveal or a draw takes the last card of a draw pile, the Time advance happens at once
// (even inside a trigger or an Event, R-07), then play resumes exactly where it paused. Trigger depth: rolls made with
// `ctx.depth > 0` (inside a trigger, an Event or a Time advance) never trigger (§1.9.1).
import { addVp, breakPiece, eliminate } from './casualties';
import { ask, choose, type Gen } from './decisions';
import { resolveMelees } from './flow';
import { neighbours, rowOf } from './hex';
import { chitVWinner, finalScore, updateControl } from './objectives';
import { window } from './reactions';
import { EVENTS } from './registry';
import { shuffle } from './rng';
import { afterEvent, checkFixedWeapons, entryHexes, eventBlocked, onTimeAdvance, sniperExtraTargets } from './scenarioRules';
import { figures, stackLimit, unitFigures } from './stats';
import { GameOver, cardOf, isImpassableHex, isUnit, radioOf, removeSmoke, typeOf } from './state';
import { type FateCard, type FlowCtx, type GameState, type HexId, type Piece, type RevealPurpose, type Side, SIDES, type Edge, other } from './types';

export type { Gen } from './decisions';

export interface Roll {
  card: FateCard;
  white: number;
  red: number;
  sum: number;
  product: number;
  /** A Jammed! trigger that was allowed to trigger (only a Fire Attack Roll acts on it, §1.9.1.2). */
  jammed: boolean;
  doubles: boolean;
}

/** A ctx one trigger level deeper (rolls in it never trigger). */
export function deeper(ctx: FlowCtx): FlowCtx {
  return { ...ctx, depth: (ctx.depth ?? 0) + 1 };
}

/** Take the top card of `side`'s draw pile onto his discard pile. */
function takeTop(s: GameState, side: Side): FateCard {
  const p = s.players[side];
  const id = p.deck.shift();
  if (id === undefined) throw new Error(`${side}'s draw pile is empty`);
  p.discards.push(id);
  return cardOf(id);
}

/**
 * Reveal the top card of `side`'s draw pile (not a roll: no trigger, no re-roll), e.g. for an Event or a drift check.
 * Revealing the last card advances Time at once (R-07).
 */
export function* reveal(s: GameState, ctx: FlowCtx, side: Side, purpose: RevealPurpose): Gen<FateCard> {
  const card = takeTop(s, side);
  ctx.emit({ kind: 'reveal', side, card: card.id, purpose, trigger: card.trigger });
  if (!s.players[side].deck.length) yield* advanceTime(s, ctx, side);
  return card;
}

/**
 * A die roll by `side` (§1.9): reveal the top card and read its dice. In order: a last card advances Time at once (and
 * stands even if the roll is re-rolled, R-08); the Initiative holder may cancel the roll and have it rolled again (the
 * card then passes to the opponent, who may do the same); then the trigger resolves unless `ctx.depth > 0`. The caller
 * applies the roll's result after this returns (§1.9.1 rule 1). Jammed! is returned for the caller to act on.
 */
export function* roll(s: GameState, ctx: FlowCtx, side: Side, purpose: RevealPurpose): Gen<Roll> {
  for (;;) {
    const card = takeTop(s, side);
    const last = s.players[side].deck.length === 0;
    const sum = card.white + card.red;
    const product = card.white * card.red;
    ctx.emit({ kind: 'reveal', side, card: card.id, purpose, value: purpose === 'targeting' || purpose === 'accuracy' ? product : sum, trigger: card.trigger });
    if (last) yield* advanceTime(s, ctx, side);
    s.lastRoll = { side, card: card.id, purpose };
    const holder = s.initiative;
    const a = yield* ask(s, ctx, { kind: 'reroll', side: holder, roll: { side, card: card.id, purpose } });
    if (a.kind === 'reroll' && a.yes) {
      s.initiative = other(holder);
      ctx.emit({ kind: 'reroll', side, by: holder });
      ctx.emit({ kind: 'initiative', side: s.initiative });
      continue;
    }
    const trigger = (ctx.depth ?? 0) > 0 ? null : card.trigger;
    if (trigger) {
      ctx.emit({ kind: 'trigger', side, trigger, card: card.id });
      if (trigger === 'Time') {
        if (!last) yield* advanceTime(s, ctx, side); // a Time! on the last card advances once (§1.9.1 rule 3)
      } else if (trigger === 'Event') yield* eventTrigger(s, deeper(ctx), side);
      else if (trigger === 'Sniper') yield* sniper(s, deeper(ctx), side);
    }
    return { card, white: card.white, red: card.red, sum, product, jammed: trigger === 'Jammed', doubles: card.white === card.red };
  }
}

/** Event! (§1.9.1.1): reveal the next card and carry out its Event; a melee it causes is fought inside it (R-04). */
export function* eventTrigger(s: GameState, ctx: FlowCtx, side: Side): Gen {
  const card = yield* reveal(s, ctx, side, 'event');
  ctx.emit({ kind: 'event', side, card: card.id, event: card.event });
  if (!eventBlocked(s, ctx, side, card.event)) yield* EVENTS[card.event](s, ctx, side, card);
  afterEvent(s, ctx, card.event);
  yield* checkFixedWeapons(s, ctx);
  yield* resolveMelees(s, ctx);
}

/** Sniper! (§1.9.1.3, R-11): a Random Hex; the roller may break one unit of either side in it or adjacent to it. */
export function* sniper(s: GameState, ctx: FlowCtx, side: Side): Gen {
  const hex = yield* randomHex(s, ctx, side);
  const area = new Set([hex, ...neighbours(hex)]);
  const targets: Piece[] = [];
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.where === 'map' && area.has(p.hex) && isUnit(p)) targets.push(p);
  }
  targets.push(...sniperExtraTargets(s, side, hex));
  const pick = yield* choose(s, ctx, side, 'sniperTarget', targets.map((p) => ({ piece: p.id })), 0, 1, { hex });
  if (pick.length) yield* breakPiece(s, ctx, targets[pick[0]].id, 'sniper');
}

/**
 * A Random Hex (§1.8): reveal a card and read its hex. First every broken Weapon in play compares the hex number with
 * its Fix and Elim ranges (§11.4).
 */
export function* randomHex(s: GameState, ctx: FlowCtx, side: Side): Gen<HexId> {
  const card = yield* reveal(s, ctx, side, 'randomHex');
  const n = rowOf(card.hex);
  const broken: Piece[] = [];
  for (const id in s.pieces) {
    const w = s.pieces[id];
    if (w.broken && w.where === 'carried' && typeOf(w).kind === 'weapon') broken.push(w);
  }
  for (const w of broken) {
    const t = typeOf(w);
    if (t.fix && n >= t.fix[0] && n <= t.fix[1]) {
      w.broken = false;
      ctx.emit({ kind: 'fix', piece: w.id });
    } else if (t.elim && n >= t.elim[0] && n <= t.elim[1]) {
      yield* eliminate(s, ctx, w.id, 'other');
    }
  }
  return card.hex;
}

/**
 * A Time advance triggered by `side` (§6.1.2): the Time marker moves on; he reshuffles his draw and discard piles;
 * Sudden Death (chit V first); the Defender's VP; he removes a Smoke marker; reinforcements; Dig In. Everything inside
 * is at a deeper trigger level. A melee caused by reinforcements is fought at its end (R-33).
 */
export function* advanceTime(s: GameState, ctx: FlowCtx, side: Side): Gen {
  const tctx = deeper(ctx);
  s.time++;
  ctx.emit({ kind: 'time', time: s.time, side });
  onTimeAdvance(s, ctx);
  const p = s.players[side];
  p.deck = shuffle(s, [...p.deck, ...p.discards]);
  p.discards = [];
  ctx.emit({ kind: 'reshuffle', side });
  if (s.time >= s.suddenDeath) {
    const v = chitVWinner(s);
    if (v) throw new GameOver(v, 'objectivesV');
    const r = yield* roll(s, tctx, side, 'suddenDeath');
    const ends = r.sum < s.time;
    ctx.emit({ kind: 'suddenDeath', roll: r.sum, time: s.time, ends });
    if (ends) throw new GameOver(finalScore(s, ctx), 'suddenDeath');
  }
  for (const sd of SIDES) if (s.players[sd].posture === 'defend') addVp(s, ctx, sd, 1, 'time');
  const smoky: HexId[] = [];
  for (let h = 0; h < s.smoke.length; h++) if (s.smoke[h] > 0) smoky.push(h);
  if (smoky.length) {
    const [i] = yield* choose(s, tctx, side, 'smokeRemoval', smoky.map((hex) => ({ hex })), 1, 1);
    removeSmoke(s, ctx, smoky[i]);
  }
  yield* reinforcements(s, tctx);
  yield* window(s, tctx, 'timeAdvanceEnd', {});
  yield* resolveMelees(s, tctx);
}

/** The hexes along a map edge (the first row or column). */
export function edgeHexes(edge: Edge): HexId[] {
  const out: HexId[] = [];
  for (let h = 0; h < 150; h++) {
    const k = Math.floor(h / 10);
    const n = (h % 10) + 1;
    if ((edge === 'top' && n === 1) || (edge === 'bottom' && n === 10) || (edge === 'left' && k === 0) || (edge === 'right' && k === 14)) out.push(h);
  }
  return out;
}

/** Hexes along `side`'s own edge (and a scenario's entry hexes) where `unit` may be placed (stacking observed, not impassable). */
export function edgePlacements(s: GameState, side: Side, unit: Piece): HexId[] {
  const f = unitFigures(unit);
  return entryHexes(s, side, edgeHexes(s.players[side].edge)).filter((h) => !isImpassableHex(s, h) && figures(s, h, side) + f <= stackLimit(s, h));
}

/**
 * Reinforcements on the Time space just reached (§6.1.2 step 5): each owner (inactive player first) places his units,
 * with their Weapons, along his own edge; a Radio goes to an empty Artillery Box (else it is not placed, R-49).
 */
function* reinforcements(s: GameState, ctx: FlowCtx): Gen {
  for (const side of [other(s.active), s.active]) {
    const here = Object.values(s.pieces).filter((p) => p.side === side && p.where === 'time' && p.space === s.time);
    if (!here.length) continue;
    const placed: string[] = [];
    for (const r of here.filter((p) => typeOf(p).kind === 'radio')) {
      r.space = -1;
      r.where = radioOf(s, side) ? 'mix' : 'artillery';
      if (r.where === 'artillery') placed.push(r.id);
    }
    let units = here.filter((p) => isUnit(p));
    let auto = false;
    while (units.length) {
      const hexes = [...new Set(units.flatMap((u) => edgePlacements(s, side, u)))].sort((a, b) => a - b);
      if (!hexes.length) break;
      let unit: Piece;
      let hex: HexId;
      if (auto) {
        unit = units.find((u) => edgePlacements(s, side, u).length)!;
        if (!unit) break;
        hex = edgePlacements(s, side, unit)[0];
      } else {
        const a = yield* ask(s, ctx, { kind: 'deploy', side, pieces: units.map((u) => u.id), hexes });
        if (a.kind === 'done') {
          auto = true;
          continue;
        }
        if (a.kind !== 'deploy') continue;
        unit = s.pieces[a.piece];
        hex = a.hex;
      }
      unit.where = 'map';
      unit.hex = hex;
      unit.space = -1;
      placed.push(unit.id);
      units = units.filter((u) => u !== unit);
      ctx.emit({ kind: 'place', piece: unit.id, hex });
      updateControl(s, ctx, hex);
    }
    if (placed.length) ctx.emit({ kind: 'reinforce', pieces: placed });
    for (const u of units) ctx.emit({ kind: 'log', text: `No room on the edge for reinforcement ${u.type}.`, side });
  }
}

/**
 * The hand refill at the end of `side`'s Turn (§5.4): draw until the hand holds the hand size. Drawing the last card
 * advances Time mid-refill; the refill then finishes from the new pile.
 */
export function* refill(s: GameState, ctx: FlowCtx, side: Side): Gen {
  const p = s.players[side];
  let drawn: string[] = [];
  while (p.hand.length < p.handSize) {
    const id = p.deck.shift();
    if (id === undefined) throw new Error(`${side}'s draw pile is empty`);
    p.hand.push(id);
    drawn.push(id);
    if (!p.deck.length) {
      ctx.emit({ kind: 'draw', side, cards: drawn });
      drawn = [];
      yield* advanceTime(s, ctx, side);
    }
  }
  if (drawn.length) ctx.emit({ kind: 'draw', side, cards: drawn });
}

/** Draw `n` cards into `side`'s hand regardless of hand size (opening hands; Time is advanced on the last card). */
export function* drawCards(s: GameState, ctx: FlowCtx, side: Side, n: number): Gen {
  const p = s.players[side];
  let drawn: string[] = [];
  for (let i = 0; i < n; i++) {
    const id = p.deck.shift();
    if (id === undefined) throw new Error(`${side}'s draw pile is empty`);
    p.hand.push(id);
    drawn.push(id);
    if (!p.deck.length) {
      ctx.emit({ kind: 'draw', side, cards: drawn });
      drawn = [];
      yield* advanceTime(s, ctx, side);
    }
  }
  if (drawn.length) ctx.emit({ kind: 'draw', side, cards: drawn });
}
