// Scenario special rules during play (scenarios-reference §3). Each hook reads data in `ScenarioDef.special` (types.ts
// SpecialRules), never the scenario number; the engine modules call these at the points named below (one call each).
// The set-up hooks are in scenario/setup.ts.
//
//   los.ts losCheck             fogHindrance        Fog in every LOS (S12)
//   orders/move.ts stepCost     flatCost            Partisans pay 1 MP a hex (S7)
//   stats.ts stackLimit         fortStackLimit      the Sherman's Bunker hex holds 4 figures (S11)
//   fire.ts fireAttack          nightPenalty        Night Action (S8)
//   fire.ts fireSpecError /
//     canShootSomething         targetCoverError    captured Panzerfausts (S11)
//   melee.ts resolveMelee       meleeBonus          Commandos (S10)
//   actions/concealment.ts      concealmentBonus    Winter Camouflage (S5)
//   reactions.ts optionsFor     actionBlocked       Deep Freeze: no Fortification Actions (S5)
//   deck.ts eventTrigger        eventBlocked,       Deep Freeze: no Fortification Events (S5);
//                               afterEvent          Breeze thins the Fog (S12)
//   deck.ts advanceTime         onTimeAdvance       Axis Orders rise (S6)
//   deck.ts sniper              sniperExtraTargets  Caves (S12)
//   deck.ts edgePlacements      entryHexes          reinforcements at A9 (S12)
//   casualties.ts breakPiece    breaksToElimination the captured Mortar (S7)
//   casualties.ts exitUnits     exitEliminated      No Quarter, Breakout (S7, S8)
//   forts.ts onLeaveHex,
//   flow.ts giveOrder/endOfTurn,
//   deck.ts eventTrigger        fixedWeapons*       the Pack Howitzer stays in the Bunker hex (S11)
import { eliminate, eliminateAll } from './casualties';
import type { Gen } from './decisions';
import { distance, label, neighbours, parseHex } from './hex';
import { hexCover } from './stats';
import { isUnit, typeOf } from './state';
import type {
  ActionName, CounterType, EventName, FlowCtx, FortKind, GameState, HexId, Piece, PieceId, ScenarioDef, Side,
} from './types';

const log = (ctx: FlowCtx, text: string, side?: Side) => ctx.emit({ kind: 'log', text, ...(side ? { side } : {}) });

// ---------------------------------------------------------------------------------------------------------------------
// Fog (S12 SSR 3)

/** The Fog Hindrance now: GameState.fog once a Breeze has thinned it, else the scenario's starting value. */
export function fogLevel(s: { scenario?: ScenarioDef; fog?: number }): number {
  return s.fog ?? s.scenario?.special?.fog ?? 0;
}

/**
 * The Fog added to a clear LOS's Hindrance (los.ts): every hex has it at every elevation, the firer's and the target's
 * too, so it counts on adjacent shots; it adds to the largest other Hindrance (the one exception to "Hindrances do not
 * add up"). A LosView that is not a GameState (no scenario) has none. Melee, Mine Attacks and Artillery Impact take no
 * LOS, so the Fog never touches them (project ruling, scenarios-reference S12).
 */
export function fogHindrance(view: object): number {
  const s = view as { scenario?: ScenarioDef; fog?: number };
  return s.scenario ? fogLevel(s) : 0;
}

/** After an Event: a Breeze lowers the Fog by 1 (to 2, 1, then none). */
export function afterEvent(s: GameState, ctx: FlowCtx, event: EventName): void {
  if (event !== 'Breeze') return;
  const fog = fogLevel(s);
  if (fog <= 0) return;
  s.fog = fog - 1;
  log(ctx, s.fog ? `The Breeze thins the fog: Hindrance ${s.fog} in every hex.` : 'The Breeze lifts the fog.');
}

// ---------------------------------------------------------------------------------------------------------------------
// Movement and stacking

/**
 * The Move cost for `side` of a hex entry that costs `cost` by the terrain chart: exactly 1 for a side with
 * `flatMoveCost` (S7 Partisans: terrain, hexside and uphill costs are all terrain; project ruling). An entry the chart
 * forbids (null: Water Barrier, Blaze, Cliff, a Major Bridge's side) stays forbidden; Wire still ends the move
 * (forts.ts).
 */
export function flatCost(s: GameState, side: Side, cost: number | null): number | null {
  return cost !== null && s.scenario.special.flatMoveCost?.includes(side) ? 1 : cost;
}

/** The stacking limit of `hex` while it holds a Fortification with a limit (S11 Bunker: 4), else undefined. */
export function fortStackLimit(s: GameState, hex: HexId): number | undefined {
  const f = s.fort[hex];
  return f ? s.scenario.special.fortStackingLimits?.[f] : undefined;
}

// ---------------------------------------------------------------------------------------------------------------------
// Fire and melee

/**
 * Night Action (S8): what a Fire Attack Total loses, the distance from the closest firing hex to the target. With two
 * target hexes (Spray Fire) the closer one counts (one total for both; project ruling). Targeting rolls are no Fire
 * Attack Total and keep their usual need.
 */
export function nightPenalty(s: GameState, firers: HexId[], targets: HexId[], ctx?: FlowCtx): number {
  if (!s.scenario.special.night || !firers.length || !targets.length) return 0;
  let d = Infinity;
  for (const f of firers) for (const t of targets) d = Math.min(d, distance(f, t));
  if (ctx) log(ctx, `Night: the attack total is reduced by ${d}.`);
  return d;
}

/**
 * Why a Weapon of type `type` may not attack `target` (S11 captured Panzerfausts: only a hex whose Cover is 2 or more;
 * the hex's own Cover, terrain or Fortification with the Road −1, as Interdiction reads it; project ruling), or null.
 */
export function targetCoverError(s: GameState, type: CounterType, target: HexId): string | null {
  const min = s.scenario.special.minTargetCover?.[type.id];
  if (min === undefined || hexCover(s, target) >= min) return null;
  return `The ${type.name} may only attack a hex with Cover ${min} or more.`;
}

/** Added to `side`'s Melee total (S10 Commandos). */
export function meleeBonus(s: GameState, side: Side): number {
  return s.scenario.special.meleeBonus?.[side] ?? 0;
}

/** What a Concealment Action of `side` takes off the attack besides the Cover (S5 Winter Camouflage); logs it. */
export function concealmentBonus(s: GameState, ctx: FlowCtx, side: Side): number {
  const n = s.scenario.special.concealmentBonus?.[side] ?? 0;
  if (n) log(ctx, `Winter Camouflage: ${n} more off the attack total.`, side);
  return n;
}

// ---------------------------------------------------------------------------------------------------------------------
// No new Fortifications (S5 Deep Freeze)

/** The Actions and Events that place a Fortification during play. */
const FORT_ACTIONS: ReadonlySet<ActionName> = new Set(['Dig In', 'Hidden Entrenchments', 'Hidden Mines', 'Hidden Pillbox', 'Hidden Wire']);
const FORT_EVENTS: ReadonlySet<EventName> = new Set(['Booby Trap', 'Entrench', 'Rubble', 'Shellholes']);

/** Can Action `name` not be played at all here (Deep Freeze: a Fortification Action counts as Command Confusion)? */
export function actionBlocked(s: GameState, name: ActionName): boolean {
  return !!s.scenario.special.noNewFortifications && FORT_ACTIONS.has(name);
}

/** Does Event `event` do nothing here (Deep Freeze: no Random Hex, no Fortification)? Logs it. */
export function eventBlocked(s: GameState, ctx: FlowCtx, side: Side, event: EventName): boolean {
  if (!s.scenario.special.noNewFortifications || !FORT_EVENTS.has(event)) return false;
  log(ctx, `${event}: the ground is frozen, no Fortification can enter play.`, side);
  return true;
}

// ---------------------------------------------------------------------------------------------------------------------
// Time, Snipers, reinforcements

/** At every Time advance (S6): Orders per Turn rise by 1 up to `ordersRiseTo`. */
export function onTimeAdvance(s: GameState, ctx: FlowCtx): void {
  const rise = s.scenario.special.ordersRiseTo;
  if (!rise) return;
  for (const side of ['axis', 'allied'] as Side[]) {
    const max = rise[side];
    const p = s.players[side];
    if (max === undefined || p.orders >= max) continue;
    p.orders++;
    log(ctx, `Orders per Turn now ${p.orders}.`, side);
  }
}

/**
 * Units a Sniper! of `side` may break besides those in or next to the Random Hex `hex` (S12 Caves): enemy units up to
 * `sniperRange` hexes away (own units only at the usual reach; project ruling).
 */
export function sniperExtraTargets(s: GameState, side: Side, hex: HexId): Piece[] {
  const reach = s.scenario.special.sniperRange?.[side];
  if (!reach || reach <= 1) return [];
  const out: Piece[] = [];
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.where !== 'map' || p.side === side || !isUnit(p)) continue;
    const d = distance(p.hex, hex);
    if (d > 1 && d <= reach) out.push(p);
  }
  return out;
}

/**
 * Where `side`'s reinforcements arriving now (on Time space `s.time`) may enter: `edge` (its edge hexes), plus the hex
 * named by `entryHex` for that space and its neighbours (S12 A9). Stacking and impassable hexes are the caller's.
 */
export function entryHexes(s: GameState, side: Side, edge: HexId[]): HexId[] {
  const e = s.scenario.special.entryHex?.[side];
  if (!e || e.space !== s.time) return edge;
  const h = parseHex(e.hex);
  return [...new Set([...edge, h, ...neighbours(h)])];
}

// ---------------------------------------------------------------------------------------------------------------------
// Casualties and exits

/** Is piece `p` eliminated instead of breaking (S7 captured Light Mortar)? */
export function breaksToElimination(s: GameState, p: Piece): boolean {
  return !!s.scenario.special.eliminateInsteadOfBreak?.[p.side]?.includes(p.type);
}

/**
 * An exit by units of a side with `noExit` (S7 No Quarter, S8 Breakout): no Exit VP; the units are eliminated (VP to
 * the enemy, Casualty Track, surrender). Returns true when it took the exit over.
 */
export function* exitEliminated(s: GameState, ctx: FlowCtx, ids: PieceId[]): Gen<boolean> {
  const side = s.pieces[ids[0]]?.side;
  if (!side || !s.scenario.special.noExit?.includes(side)) return false;
  log(ctx, 'No Exit VP here: the units that leave the map are eliminated.', side);
  yield* eliminateAll(s, ctx, ids, 'other');
  return true;
}

// ---------------------------------------------------------------------------------------------------------------------
// Fixed Weapons (S11 Pack Howitzer)

/** The Fortification fixed Weapon `w` belongs with, or undefined. */
const fixedFort = (s: GameState, w: Piece): FortKind | undefined => s.scenario.special.fixedWeapons?.[w.type];

/**
 * Before `units` leave their hex (forts.ts onLeaveHex: Move, Advance, Retreat): a fixed Weapon one of them carries stays
 * behind and is eliminated (it cannot leave the Bunker hex; leaving it is abandoning it, project ruling).
 */
export function* leaveFixedWeapons(s: GameState, ctx: FlowCtx, units: PieceId[]): Gen {
  if (!s.scenario.special.fixedWeapons) return;
  for (const id of units) {
    const u = s.pieces[id];
    const w = u?.weapon ? s.pieces[u.weapon] : null;
    if (!w || !fixedFort(s, w)) continue;
    log(ctx, `The ${typeOf(w).name} cannot leave ${label(u.hex)}: it is lost.`, w.side);
    yield* eliminate(s, ctx, w.id, 'other');
  }
}

/**
 * Every fixed Weapon not carried in a hex holding its Fortification is eliminated (its Bunker is gone, or an Event moved
 * its carrier away). Called after each Order and Event and at the end of each Turn.
 */
export function* checkFixedWeapons(s: GameState, ctx: FlowCtx): Gen {
  if (!s.scenario.special.fixedWeapons) return;
  for (const id in s.pieces) {
    const w = s.pieces[id];
    const fort = fixedFort(s, w);
    if (!fort || w.where !== 'carried' || !w.carrier) continue;
    const c = s.pieces[w.carrier];
    if (c?.where === 'map' && s.fort[c.hex] === fort) continue;
    log(ctx, `The ${typeOf(w).name} is lost with its ${fort}.`, w.side);
    yield* eliminate(s, ctx, w.id, 'other');
  }
}
