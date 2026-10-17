// The handler tables: what each Order, Action and Event does. Each handler lives in its own file and is imported here;
// an entry that is not written yet is a stub that logs "not yet implemented" and does nothing (its Order cannot be
// given, its Action is never offered).
//
// To register a handler: export it from your file (orders/<name>.ts, actions/<name>.ts, events/<name>.ts), add one
// import line below and replace the stub in the table. Handler files must not read these tables at module load time
// (only inside functions), because the modules import each other.
import { commandConfusionAction, commandConfusionOrder } from './orders/confusion';
import { fireOrder, opFireAction } from './orders/fire';
import { moveOrder } from './orders/move';
import type { Gen } from './decisions';
import type {
  ActionName, ActionOption, Answer, Decision, EventName, FateCard, FlowCtx, GameState, OrderName, PieceId, Side, WindowInfo, WindowKind,
} from './types';

export interface OrderHandler {
  /** Can `side` give this Order now (something to activate, a target, a Radio ...)? Only then is the card offered. */
  canGive(s: GameState, side: Side): boolean;
  /** Carry the Order out; the card is already on the discard pile and counted against the Order Capability. */
  run(s: GameState, ctx: FlowCtx, side: Side, card: FateCard): Gen;
  /**
   * For Orders that activate units with an 'activate' decision (`order` = this Order): why `units` is not a legal
   * activation beyond the shape rules (§O14.1, checked by activation.ts), e.g. "no enemy in LOS and Range" for Fire.
   */
  activationError?(s: GameState, side: Side, units: PieceId[]): string | null;
}

export interface ActionHandler {
  /** The windows in which the Action can be played (§A24 timing table). */
  windows: WindowKind[];
  /** The plays open to `side` in window `w` now (one per card and use); [] when none. Must be cheap. */
  options(s: GameState, side: Side, w: WindowKind, info: WindowInfo): ActionOption[];
  /** Carry out a play. The card has been discarded already (reactions.ts); `a` is the 'play' answer with its targets. */
  run(s: GameState, ctx: FlowCtx, side: Side, opt: ActionOption, a: Answer, info: WindowInfo): Gen;
  /** Why the 'play' answer `a` for `opt` is refused (default: exactly one of each target list, decisions.ts). */
  check?(s: GameState, side: Side, opt: ActionOption, a: Extract<Answer, { kind: 'play' }>, info: WindowInfo): string | null;
}

/** An Event (§E): `receiver` is the player whose Event! trigger revealed `card`; runs at a deeper trigger level. */
export type EventHandler = (s: GameState, ctx: FlowCtx, receiver: Side, card: FateCard) => Gen;

/** Answer checks for decision kinds that decisions.ts does not know itself (e.g. 'advance', Task 7). */
export type DecisionCheck = (s: GameState, d: Decision, a: Answer) => string | null;

function stubOrder(name: OrderName): OrderHandler {
  return {
    canGive: () => false,
    *run(_s, ctx, side) {
      ctx.emit({ kind: 'log', text: `${name}: not yet implemented`, side });
    },
  };
}

function stubAction(name: ActionName): ActionHandler {
  return {
    windows: [],
    options: () => [],
    *run(_s, ctx, side) {
      ctx.emit({ kind: 'log', text: `${name}: not yet implemented`, side });
    },
  };
}

function stubEvent(name: EventName): EventHandler {
  return function* (_s, ctx, receiver) {
    ctx.emit({ kind: 'log', text: `${name}: not yet implemented`, side: receiver });
  };
}

export const ORDERS: Record<OrderName, OrderHandler> = {
  Advance: stubOrder('Advance'),
  'Artillery Denied': stubOrder('Artillery Denied'),
  'Artillery Request': stubOrder('Artillery Request'),
  'Command Confusion': commandConfusionOrder,
  Fire: fireOrder,
  Move: moveOrder,
  Recover: stubOrder('Recover'),
  Rout: stubOrder('Rout'),
};

export const ACTIONS: Record<ActionName, ActionHandler> = {
  Ambush: stubAction('Ambush'),
  'Assault Fire': stubAction('Assault Fire'),
  'Bore Sighting': stubAction('Bore Sighting'),
  'Command Confusion': commandConfusionAction,
  Concealment: stubAction('Concealment'),
  Crossfire: stubAction('Crossfire'),
  Demolitions: stubAction('Demolitions'),
  'Dig In': stubAction('Dig In'),
  Fire: opFireAction,
  'Hand Grenades': stubAction('Hand Grenades'),
  'Hidden Entrenchments': stubAction('Hidden Entrenchments'),
  'Hidden Mines': stubAction('Hidden Mines'),
  'Hidden Pillbox': stubAction('Hidden Pillbox'),
  'Hidden Unit': stubAction('Hidden Unit'),
  'Hidden Wire': stubAction('Hidden Wire'),
  'Light Wounds': stubAction('Light Wounds'),
  Marksmanship: stubAction('Marksmanship'),
  'No Quarter': stubAction('No Quarter'),
  'Smoke Grenades': stubAction('Smoke Grenades'),
  'Spray Fire': stubAction('Spray Fire'),
  'Sustained Fire': stubAction('Sustained Fire'),
};

export const EVENTS: Record<EventName, EventHandler> = {
  'Air Support': stubEvent('Air Support'),
  'Battle Harden': stubEvent('Battle Harden'),
  'Battlefield Integrity': stubEvent('Battlefield Integrity'),
  Blaze: stubEvent('Blaze'),
  'Booby Trap': stubEvent('Booby Trap'),
  Breeze: stubEvent('Breeze'),
  'Command & Control': stubEvent('Command & Control'),
  Commissar: stubEvent('Commissar'),
  Cower: stubEvent('Cower'),
  Deploy: stubEvent('Deploy'),
  Dust: stubEvent('Dust'),
  Elan: stubEvent('Elan'),
  Entrench: stubEvent('Entrench'),
  'Field Promotion': stubEvent('Field Promotion'),
  'Fog of War': stubEvent('Fog of War'),
  Hero: stubEvent('Hero'),
  Infiltration: stubEvent('Infiltration'),
  Interdiction: stubEvent('Interdiction'),
  Interrogation: stubEvent('Interrogation'),
  KIA: stubEvent('KIA'),
  Malfunction: stubEvent('Malfunction'),
  Medic: stubEvent('Medic'),
  'Mission Objective': stubEvent('Mission Objective'),
  'Prisoners of War': stubEvent('Prisoners of War'),
  Reconnaissance: stubEvent('Reconnaissance'),
  Reinforcements: stubEvent('Reinforcements'),
  Rubble: stubEvent('Rubble'),
  Sappers: stubEvent('Sappers'),
  Scrounge: stubEvent('Scrounge'),
  'Shell Shock': stubEvent('Shell Shock'),
  Shellholes: stubEvent('Shellholes'),
  'Strategic Objective': stubEvent('Strategic Objective'),
  'Suppressing Fire': stubEvent('Suppressing Fire'),
  'Walking Wounded': stubEvent('Walking Wounded'),
  'White Phosphorus': stubEvent('White Phosphorus'),
};

/** Extra answer checks by decision kind, for kinds other tasks add. */
export const DECISION_CHECKS: Partial<Record<Decision['kind'], DecisionCheck>> = {};
