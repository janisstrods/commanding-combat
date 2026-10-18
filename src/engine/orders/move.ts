// The Move Order (§O21): activated units get MP equal to their current Movement (Leader Command, Veteran, Suppressed,
// Weapon modifier, recomputed continuously) + 1 once they have entered a road hex this Order; each pays the cost of
// every hex it enters (terrain.ts moveCost: terrain, hexside, uphill, path, Trench). One unit, or a group activated in
// the same hex, moves at a time and finishes before another starts; a group stays together and stops when one member
// cannot pay (R-27). After every hex entry the 'afterHexEntry' window (Op Fire, Hidden Mines / Wire; inactive player
// first). Weapon transfer (1 MP) and exit off the enemy edge (1 MP) enter no hex, so no Op Fire (R-29). The mover's
// 'duringMove' Actions (Assault Fire, Smoke Grenades) are offered inside every 'move' decision. The progress lives in
// `turn.move`, so `continueMove` can resume a Move Order from a state.
import { activationCandidates, markActivated } from '../activation';
import { exitUnits } from '../casualties';
import { edgeHexes } from '../deck';
import { ask, targetsError, type Gen } from '../decisions';
import { onEnterHex, onLeaveHex } from '../forts';
import { areAdjacent, neighbours } from '../hex';
import { updateControl } from '../objectives';
import { optionsFor, playAction, window } from '../reactions';
import { ACTIONS, type OrderHandler } from '../registry';
import { currentStats } from '../stats';
import { hasUnitOf, isUnit } from '../state';
import { hasRoad, moveCost } from '../terrain';
import { type Answer, type Decision, type FlowCtx, type GameState, type HexId, type MoveProgress, type PieceId, type Side, other } from '../types';

/** MP left for unit `id` in the Move Order in progress (or a fresh one). */
export function mpLeft(s: GameState, id: PieceId, m: MoveProgress | null = s.turn.move): number {
  const bonus = m?.road.includes(id) ? 1 : 0;
  return currentStats(s, id).move + bonus - (m?.spent[id] ?? 0);
}

/** MP to enter adjacent `to` from `from` by a Move, or null when it cannot (terrain, Cliff, Blaze, bridge sides). */
export function stepCost(s: GameState, from: HexId, to: HexId): number | null {
  return moveCost(s.map, from, to, s.scenario.special, s);
}

/** Hexes off which `side`'s units may exit: the opponent's edge row (§7.2.1). */
export function exitHexes(s: GameState, side: Side): HexId[] {
  return edgeHexes(s.players[other(side)].edge);
}

/** Can units with `mp` MP each step from `from` into some hex, or exit? */
function canGo(s: GameState, side: Side, from: HexId, mp: number): boolean {
  if (mp <= 0) return false;
  if (mp >= 1 && exitHexes(s, side).includes(from)) return true;
  for (const to of neighbours(from)) {
    if (hasUnitOf(s, to, other(side))) continue;
    const c = stepCost(s, from, to);
    if (c !== null && c <= mp) return true;
  }
  return false;
}

/** Can the group `ids` (all in one hex) take another step or exit? */
function groupCanGo(s: GameState, ids: PieceId[]): boolean {
  if (!ids.length) return false;
  const side = s.pieces[ids[0]].side;
  const mp = Math.min(...ids.map((id) => mpLeft(s, id)));
  return canGo(s, side, s.pieces[ids[0]].hex, mp);
}

const onMap = (s: GameState, id: PieceId) => s.pieces[id]?.where === 'map' && isUnit(s.pieces[id]);

/** The activated units that may start moving now (not moving, not finished, able to go somewhere). */
function startable(s: GameState): PieceId[] {
  const m = s.turn.move!;
  return s.turn.moving.filter((id) => onMap(s, id) && !m.done.includes(id) && !(m.group ?? []).includes(id) && groupCanGo(s, [id]));
}

export const moveOrder: OrderHandler = {
  canGive: (s, side) => activationCandidates(s, side, 'Move').length > 0,
  activationError: (s, side, units) =>
    units.some((id) => onMap(s, id) && canGo(s, side, s.pieces[id].hex, mpLeft(s, id, null))) ? null : 'None of them can enter a hex.',
  *run(s, ctx, side, card) {
    const units = activationCandidates(s, side, 'Move');
    if (!units.length) return;
    const a = yield* ask(s, ctx, { kind: 'activate', side, order: 'Move', card: card.id, units });
    const ids = (a as Extract<Answer, { kind: 'activate' }>).units;
    markActivated(s, ctx, side, ids, 'Move');
    s.turn.moving = ids.slice();
    s.turn.opFire = [];
    s.turn.move = { spent: {}, road: [], done: [], group: null, entered: false };
    yield* continueMove(s, ctx, side);
  },
};

/** The 'move' decision for the state of the Move Order in progress, or null when it is over. */
export function moveDecision(s: GameState, side: Side): Extract<Decision, { kind: 'move' }> | null {
  const m = s.turn.move!;
  const units = m.group ? m.group : startable(s);
  const actions = optionsFor(s, side, 'duringMove', { units: s.turn.moving.slice(), mover: side });
  if (!units.length && !actions.length) return null;
  const mp: Record<PieceId, number> = {};
  for (const id of units) mp[id] = mpLeft(s, id);
  const d: Extract<Decision, { kind: 'move' }> = { kind: 'move', side, units: units.slice(), current: m.group ? m.group.slice() : null, mp };
  if (!m.entered && !m.group && units.length) d.mustMove = true;
  if (actions.length) d.actions = actions;
  return d;
}

/** Carry on the Move Order in progress (`turn.move`) until it is over. */
export function* continueMove(s: GameState, ctx: FlowCtx, side: Side): Gen {
  for (;;) {
    const m = s.turn.move!;
    if (m.group) {
      // members gone from the map, or put out of the group's hex (a Blaze ...), leave the group and end their move
      const hex = m.groupHex ?? s.pieces[m.group[0]].hex;
      const out = m.group.filter((id) => !onMap(s, id) || s.pieces[id].hex !== hex);
      for (const id of out) if (!m.done.includes(id)) m.done.push(id);
      m.group = m.group.filter((id) => !out.includes(id));
      if (!m.group.length || !groupCanGo(s, m.group)) {
        finishGroup(m);
        continue;
      }
    }
    const d = moveDecision(s, side);
    if (!d) return;
    const a = yield* ask(s, ctx, d);
    switch (a.kind) {
      case 'done':
        if (m.group) finishGroup(m);
        else return;
        break;
      case 'play':
        yield* playAction(s, ctx, side, d.actions![a.option], a, { units: s.turn.moving.slice(), mover: side });
        break;
      case 'transfer':
        transfer(s, ctx, a.from, a.to);
        break;
      case 'moveStep':
        yield* moveStep(s, ctx, side, a.units, a.to);
        break;
      case 'exit':
        m.entered = true;
        for (const id of a.units) m.spent[id] = (m.spent[id] ?? 0) + 1;
        m.done.push(...a.units);
        m.group = null;
        delete m.groupHex;
        yield* exitUnits(s, ctx, a.units);
        break;
      default:
        break;
    }
  }
}

function finishGroup(m: MoveProgress): void {
  if (m.group) for (const id of m.group) if (!m.done.includes(id)) m.done.push(id);
  m.group = null;
  delete m.groupHex;
}

/** Hand a Weapon to a friendly unit in the same hex (§O21.1.1): 1 MP of the giver. */
function transfer(s: GameState, ctx: FlowCtx, from: PieceId, to: PieceId): void {
  const m = s.turn.move!;
  const g = s.pieces[from];
  const r = s.pieces[to];
  const w = s.pieces[g.weapon!];
  m.spent[from] = (m.spent[from] ?? 0) + 1;
  g.weapon = null;
  r.weapon = w.id;
  w.carrier = r.id;
  ctx.emit({ kind: 'transfer', weapon: w.id, from, to });
}

/** One hex entry by the group `units` (§O21.1, §O21.3). */
function* moveStep(s: GameState, ctx: FlowCtx, side: Side, units: PieceId[], to: HexId): Gen {
  const m = s.turn.move!;
  const from = s.pieces[units[0]].hex;
  if (!m.group) {
    m.group = units.slice();
    m.groupHex = from;
  }
  const cost = stepCost(s, from, to)!;
  const leave = yield* onLeaveHex(s, ctx, units, from, to, 'move');
  const movers = units.filter((id) => onMap(s, id) && s.pieces[id].hex === from);
  for (const id of movers) {
    m.spent[id] = (m.spent[id] ?? 0) + cost;
    s.pieces[id].hex = to;
    if (hasRoad(s.map, to) && !m.road.includes(id)) m.road.push(id);
  }
  if (!movers.length) return;
  m.groupHex = to;
  m.entered = true;
  ctx.emit({ kind: 'move', units: movers, from, to, mp: cost });
  updateControl(s, ctx, to);
  const enter = yield* onEnterHex(s, ctx, movers, from, to, 'move');
  const here = movers.filter((id) => onMap(s, id) && s.pieces[id].hex === to);
  if (here.length && !enter.noOpFire) yield* window(s, ctx, 'afterHexEntry', { hex: to, units: here, mover: side });
  if (leave.stop || enter.stop) finishGroup(m);
}

/** The units of a moveStep / exit answer: the group moving now, or a new group of startable units in one hex. */
function groupError(s: GameState, d: Extract<Decision, { kind: 'move' }>, units: PieceId[]): string | null {
  if (!Array.isArray(units) || !units.length || new Set(units).size !== units.length) return 'Choose the units that move.';
  if (d.current) {
    const same = units.length === d.current.length && units.every((id) => d.current!.includes(id));
    return same ? null : 'The group moving now moves together and finishes before another starts.';
  }
  if (!units.every((id) => d.units.includes(id))) return 'Only activated units that have not moved yet may start moving.';
  const hex = s.pieces[units[0]].hex;
  return units.every((id) => s.pieces[id].hex === hex) ? null : 'Only units in the same hex move as a group.';
}

/** The check of a 'move' answer. */
export function moveAnswerError(s: GameState, d: Extract<Decision, { kind: 'move' }>, a: Answer): string | null {
  switch (a.kind) {
    case 'done':
      return !d.current && d.mustMove ? 'A Move Order must move at least one unit into another hex.' : null;
    case 'play': {
      const opts = d.actions ?? [];
      if (!Number.isInteger(a.option) || a.option < 0 || a.option >= opts.length) return 'Play one of the Actions offered.';
      const opt = opts[a.option];
      const h = ACTIONS[opt.action];
      return h.check ? h.check(s, d.side, opt, a, { units: s.turn.moving.slice(), mover: d.side }) : targetsError(opt.targets, a.targets);
    }
    case 'moveStep': {
      const e = groupError(s, d, a.units);
      if (e) return e;
      const from = s.pieces[a.units[0]].hex;
      if (!Number.isInteger(a.to) || !areAdjacent(from, a.to)) return 'Move into an adjacent hex.';
      if (hasUnitOf(s, a.to, other(d.side))) return 'Units cannot enter a hex with enemy units by a Move.';
      const cost = stepCost(s, from, a.to);
      if (cost === null) return 'That hex cannot be entered from here.';
      return a.units.every((id) => mpLeft(s, id) >= cost) ? null : `Entering costs ${cost} MP: not enough MP left.`;
    }
    case 'exit': {
      const e = groupError(s, d, a.units);
      if (e) return e;
      if (!exitHexes(s, d.side).includes(s.pieces[a.units[0]].hex)) return 'Units exit only off the enemy edge, from a hex along it.';
      return a.units.every((id) => mpLeft(s, id) >= 1) ? null : 'Exiting costs 1 MP.';
    }
    case 'transfer': {
      const movers = d.current ?? d.units;
      if (!movers.includes(a.from)) return 'Only a unit moving (or about to move) may hand over its Weapon.';
      const g = s.pieces[a.from];
      const r = s.pieces[a.to];
      if (!g.weapon) return 'That unit carries no Weapon.';
      if (!r || r.id === g.id || r.side !== g.side || !onMap(s, r.id) || r.hex !== g.hex || r.weapon) {
        return 'The Weapon goes to a friendly unit in the same hex that has none.';
      }
      return mpLeft(s, a.from) >= 1 ? null : 'A transfer costs 1 MP.';
    }
    default:
      return 'Move a unit, transfer a Weapon, exit, play an Action or stop.';
  }
}

/**
 * The legal answers to a 'move' decision (for random play and the AI): steps and exits of the moving group, or of
 * each startable unit alone and of all startable units of a hex together; Weapon transfers; each Action with the first
 * of its targets; 'done' when allowed. Other groups are legal too.
 */
export function moveAnswers(s: GameState, d: Extract<Decision, { kind: 'move' }>): Answer[] {
  const out: Answer[] = [];
  const groups: PieceId[][] = [];
  if (d.current) groups.push(d.current);
  else {
    const byHex = new Map<HexId, PieceId[]>();
    for (const id of d.units) {
      groups.push([id]);
      const h = s.pieces[id].hex;
      byHex.set(h, [...(byHex.get(h) ?? []), id]);
    }
    for (const g of byHex.values()) if (g.length > 1) groups.push(g);
  }
  const ok = (a: Answer) => !moveAnswerError(s, d, a);
  for (const g of groups) {
    for (const to of neighbours(s.pieces[g[0]].hex)) {
      const a: Answer = { kind: 'moveStep', units: g, to };
      if (ok(a)) out.push(a);
    }
    const x: Answer = { kind: 'exit', units: g };
    if (ok(x)) out.push(x);
  }
  for (const from of d.current ?? d.units) {
    const g = s.pieces[from];
    if (!g.weapon) continue;
    for (const id in s.pieces) {
      const a: Answer = { kind: 'transfer', from, to: id };
      if (s.pieces[id].hex === g.hex && ok(a)) out.push(a);
    }
  }
  (d.actions ?? []).forEach((o, option) => {
    const t = o.targets;
    const a: Answer = { kind: 'play', option, ...(t ? { targets: { ...(t.pieces ? { pieces: t.pieces.slice(0, 1) } : {}), ...(t.hexes ? { hexes: t.hexes.slice(0, 1) } : {}) } } : {}) };
    if (ok(a)) out.push(a);
  });
  if (ok({ kind: 'done' })) out.push({ kind: 'done' });
  return out;
}
