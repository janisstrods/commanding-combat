// Casualties and VP: breaking (with the Light Wounds window for Squads, §A36), elimination to the Casualty Track with
// its VP (§7.1) and the surrender / annihilation checks (§6.3), suppression and rally (§13), voluntary exit (§7.2.1),
// replacing a Squad by Teams (Deploy §E52, Light Wounds §A36).
//
// Game end: a loss throws GameOver at once, except inside `simultaneously`, which collects the losers and judges them
// together at its end (both lose → the Initiative holder wins, §6.3, §9.2).
import { choose, type Gen } from './decisions';
import { finalScore, updateControl } from './objectives';
import { window } from './reactions';
import { GameOver, newPiece, typeOf, unitsOf } from './state';
import { teamFor } from './data';
import { breaksToElimination, exitEliminated } from './scenarioRules';
import { type CasualtyCause, type FlowCtx, type GameState, type Piece, type PieceId, type Side, other } from './types';

export { GameOver } from './state';

/** The first and last Time Track spaces an exited unit may be put on (R-30: only spaces ahead of the Time marker). */
export const TIME_TRACK_LAST = 13;

/** VP for eliminating (or exiting) unit `p` (§7.1): Squad 2, Team 1, Leader 1 + unbroken Command, Hero 0. */
export function unitVp(p: Piece): number {
  const t = typeOf(p);
  if (t.kind === 'squad') return 2;
  if (t.kind === 'team') return 1;
  if (t.kind === 'leader') return t.hero ? 0 : 1 + t.front.command;
  return 0;
}

/** Add `n` VP for `side` (the single track runs positive toward the Axis, §4.1). */
export function addVp(s: GameState, ctx: FlowCtx, side: Side, n: number, why: string): void {
  if (!n) return;
  const delta = side === 'axis' ? n : -n;
  s.vp += delta;
  ctx.emit({ kind: 'vp', delta, total: s.vp, why });
}

/**
 * Break a piece (§3.2): an unbroken one flips, a broken one is eliminated. A Squad's owner may first answer with Light
 * Wounds (window 'squadWouldBreak'); if the Squad is gone from the map afterwards (replaced by a Team), nothing else
 * happens. Outright eliminations (KIA, lost melee, overstack ...) call `eliminate` instead and get no such window.
 */
export function* breakPiece(s: GameState, ctx: FlowCtx, id: PieceId, cause: CasualtyCause): Gen {
  const p = s.pieces[id];
  if (!p || (p.where !== 'map' && p.where !== 'carried' && p.where !== 'artillery')) return;
  if (typeOf(p).kind === 'squad' && p.where === 'map') {
    yield* window(s, ctx, 'squadWouldBreak', { units: [id], hex: p.hex, cause });
    if (s.pieces[id].where !== 'map') return;
  }
  if (p.broken || breaksToElimination(s, p)) {
    yield* eliminate(s, ctx, id, cause);
    return;
  }
  p.broken = true;
  ctx.emit({ kind: 'break', piece: id });
}

/** Eliminate a piece (§7.1, §11.3, §12). Units: VP to the opponent, Casualty Track, surrender / annihilation checks. */
export function* eliminate(s: GameState, ctx: FlowCtx, id: PieceId, cause: CasualtyCause): Gen<void> {
  eliminateNow(s, ctx, id, cause);
}

/** Eliminate several units at once (one batch for the game-end check: both may lose together). */
export function* eliminateAll(s: GameState, ctx: FlowCtx, ids: PieceId[], cause: CasualtyCause): Gen<void> {
  yield* simultaneously(s, ctx, function* (c) {
    for (const id of ids) eliminateNow(s, c, id, cause);
  });
}

function toWeaponsBox(s: GameState, w: Piece): void {
  if (w.carrier && s.pieces[w.carrier]?.weapon === w.id) s.pieces[w.carrier].weapon = null;
  w.carrier = null;
  w.where = 'weaponsBox';
  w.hex = -1;
  w.broken = false;
}

function eliminateNow(s: GameState, ctx: FlowCtx, id: PieceId, cause: CasualtyCause): void {
  const p = s.pieces[id];
  if (!p || p.where === 'casualty' || p.where === 'weaponsBox' || p.where === 'mix') return;
  const t = typeOf(p);
  if (t.kind === 'weapon') {
    toWeaponsBox(s, p);
    ctx.emit({ kind: 'eliminate', piece: id, vp: 0 });
    return;
  }
  if (t.kind === 'radio') {
    p.where = 'mix';
    p.broken = false;
    ctx.emit({ kind: 'eliminate', piece: id, vp: 0 });
    return;
  }
  const hex = p.where === 'map' ? p.hex : -1;
  if (p.weapon) toWeaponsBox(s, s.pieces[p.weapon]);
  p.weapon = null;
  p.suppressed = false;
  p.veteran = false;
  p.hex = -1;
  p.space = -1;
  let vp = 0;
  if (t.hero) p.where = 'mix';
  else {
    p.where = 'casualty';
    s.players[p.side].casualties.push(id);
    vp = unitVp(p) * (s.openChits.includes('X') ? 2 : 1);
  }
  ctx.emit({ kind: 'eliminate', piece: id, vp });
  addVp(s, ctx, other(p.side), vp, cause === 'overstack' ? 'overstack' : 'elimination');
  if (hex >= 0) updateControl(s, ctx, hex);
  if (s.phase !== 'play') return;
  const pl = s.players[p.side];
  if (pl.casualties.length >= pl.surrender) lose(s, ctx, p.side, 'surrender');
  else if (!unitsOf(s, p.side).length) lose(s, ctx, p.side, 'annihilation');
}

function lose(s: GameState, ctx: FlowCtx, side: Side, reason: 'surrender' | 'annihilation'): void {
  if (ctx.losers) {
    if (!ctx.losers.includes(side)) ctx.losers.push(side);
    return;
  }
  throw new GameOver(other(side), reason);
}

/**
 * Run `g` with the game-end check deferred: losses (surrender, annihilation) during it are collected and judged at its
 * end. One loser loses; two → the Initiative holder wins (§6.3). For melee results, overstack removal, Events that
 * break or eliminate several units at once.
 */
export function* simultaneously<T>(s: GameState, ctx: FlowCtx, g: (ctx: FlowCtx) => Gen<T>): Gen<T> {
  const losers: Side[] = [];
  const r = yield* g({ ...ctx, losers });
  if (!losers.length) return r;
  const reason = (side: Side) => (s.players[side].casualties.length >= s.players[side].surrender ? 'surrender' : 'annihilation');
  if (losers.length === 2) throw new GameOver(s.initiative, reason(other(s.initiative)));
  throw new GameOver(other(losers[0]), reason(losers[0]));
}

/** Suppress a unit (§13): at most one marker. */
export function suppress(s: GameState, ctx: FlowCtx, id: PieceId): void {
  const p = s.pieces[id];
  if (!p || p.where !== 'map' || p.suppressed) return;
  p.suppressed = true;
  ctx.emit({ kind: 'suppress', piece: id });
}

/** Rally a broken unit (flip it unbroken). */
export function rally(s: GameState, ctx: FlowCtx, id: PieceId): void {
  const p = s.pieces[id];
  if (!p || !p.broken) return;
  p.broken = false;
  ctx.emit({ kind: 'rally', piece: id });
}

/**
 * Voluntary exit off the enemy edge (§7.2.1): the owner gains the units' VP (Hero 0; chit W doubles). If they were his
 * last units on the map the game ends (scored). Otherwise he puts them on a Time Track space ahead of the Time marker
 * (R-30): unbroken, with their Weapons (unbroken), without Veteran / Suppressed. They come back as reinforcements.
 */
export function* exitUnits(s: GameState, ctx: FlowCtx, ids: PieceId[]): Gen {
  if (!ids.length) return;
  const side = s.pieces[ids[0]].side;
  const from = s.pieces[ids[0]].hex;
  if (yield* exitEliminated(s, ctx, ids)) return;
  let vp = 0;
  for (const id of ids) {
    const p = s.pieces[id];
    vp += unitVp(p);
    // a Hero goes back to the counter mix, never onto the Time Track (§3.4); its Weapon leaves play with it
    p.where = typeOf(p).hero ? 'mix' : 'time';
    p.hex = -1;
    p.broken = false;
    p.suppressed = false;
    p.veteran = false;
    if (p.weapon) {
      const w = s.pieces[p.weapon];
      w.broken = false;
      if (p.where === 'mix') {
        w.where = 'mix';
        w.carrier = null;
        p.weapon = null;
      }
    }
  }
  ctx.emit({ kind: 'exit', units: ids.slice(), from });
  addVp(s, ctx, side, vp * (s.openChits.includes('W') ? 2 : 1), 'exit');
  updateControl(s, ctx, from);
  if (!unitsOf(s, side).length) throw new GameOver(finalScore(s, ctx), 'exit');
  const toTrack = ids.filter((id) => s.pieces[id].where === 'time');
  if (!toTrack.length) return;
  const spaces: number[] = [];
  for (let t = s.time + 1; t <= Math.max(TIME_TRACK_LAST, s.time + 1); t++) spaces.push(t);
  const [i] = yield* choose(s, ctx, side, 'exitSpace', spaces.map((space) => ({ space })), 1, 1, { units: toTrack });
  for (const id of toTrack) s.pieces[id].space = spaces[i];
}

/**
 * Replace unit `old` by new units of the given counter types in the same hex (Light Wounds: one Team; Deploy: two
 * Teams). The new units share its broken state and its activation status (§J.2); its Weapon, Suppressed and Veteran go
 * to the new unit `markersTo` names (default the first). `old` returns to the counter mix. Returns the new units.
 */
export function replaceUnit(
  s: GameState, ctx: FlowCtx, oldId: PieceId, types: string[],
  markersTo: { weapon?: number; suppressed?: number; veteran?: number } = {},
): Piece[] {
  const old = s.pieces[oldId];
  const made = types.map((t) => {
    const p = newPiece(s, t, old.side, 'map');
    p.hex = old.hex;
    p.broken = old.broken;
    return p;
  });
  const to = (i: number | undefined) => made[Math.min(i ?? 0, made.length - 1)];
  if (old.weapon) {
    const w = s.pieces[old.weapon];
    const u = to(markersTo.weapon);
    u.weapon = w.id;
    w.carrier = u.id;
    old.weapon = null;
  }
  if (old.suppressed) to(markersTo.suppressed).suppressed = true;
  if (old.veteran) to(markersTo.veteran).veteran = true;
  const ids = made.map((p) => p.id);
  const t = s.turn;
  const swap = (list: PieceId[]) => {
    const i = list.indexOf(oldId);
    if (i >= 0) list.splice(i, 1, ...ids);
  };
  swap(t.activated);
  swap(t.moving);
  swap(t.opFire);
  swap(t.fired);
  if (t.move) {
    swap(t.move.road);
    swap(t.move.done);
    if (t.move.group) swap(t.move.group);
    if (oldId in t.move.spent) {
      for (const id of ids) t.move.spent[id] = t.move.spent[oldId];
      delete t.move.spent[oldId];
    }
  }
  old.where = 'mix';
  old.hex = -1;
  old.suppressed = false;
  old.veteran = false;
  old.broken = false;
  ctx.emit({ kind: 'replace', piece: oldId, by: ids });
  return made;
}

/**
 * A ctx that notes which units replace others while it is in use (Deploy: two Teams, Light Wounds: one; the 'replace'
 * event): `by[old]` = the new ids. For results pending on a unit across a roll's trigger (R-53).
 */
export function watchReplacements(ctx: FlowCtx): { ctx: FlowCtx; by: Record<PieceId, PieceId[]> } {
  const by: Record<PieceId, PieceId[]> = {};
  return {
    by,
    ctx: {
      ...ctx,
      emit: (e) => {
        if (e.kind === 'replace') by[e.piece] = e.by;
        ctx.emit(e);
      },
    },
  };
}

/**
 * Who a result pending on unit `id` applies to after a trigger (R-53, §E52): the unit itself while on the map (wherever
 * it now is), else the two Teams a Deploy made of it that are on the map (not a Light Wounds Team: it replaced a break).
 */
export function pendingTargets(s: GameState, id: PieceId, by: Record<PieceId, PieceId[]>): PieceId[] {
  if (s.pieces[id]?.where === 'map') return [id];
  const teams = by[id];
  return teams && teams.length === 2 ? teams.filter((t) => s.pieces[t]?.where === 'map') : [];
}

/** Deploy (§E52): replace a Squad by two Teams of its owner's OB troop quality. Returns the Teams. */
export function deploySquad(s: GameState, ctx: FlowCtx, squadId: PieceId, markersTo?: Parameters<typeof replaceUnit>[4]): Piece[] {
  const sq = s.pieces[squadId];
  const pl = s.players[sq.side];
  const team = teamFor(pl.nation, pl.quality);
  return replaceUnit(s, ctx, squadId, [team, team], markersTo);
}

