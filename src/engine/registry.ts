// The handler tables: what each Order, Action and Event does. Each handler lives in its own file and is imported here;
// an entry that is not written yet is a stub that logs "not yet implemented" and does nothing (its Order cannot be
// given, its Action is never offered).
//
// To register a handler: export it from your file (orders/<name>.ts, actions/<name>.ts, events/<name>.ts) and add it to
// that folder's index.ts. The tables below look each handler up when it is used (never while modules load), so the
// import order of the engine's modules, which import each other, does not matter. Handler files must not read these
// tables at module load time either (only inside functions).
import * as actionIndex from './actions/index';
import * as eventIndex from './events/index';
import * as orderIndex from './orders/index';
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

const ORDER_NAMES: readonly OrderName[] = [
  'Advance', 'Artillery Denied', 'Artillery Request', 'Command Confusion', 'Fire', 'Move', 'Recover', 'Rout',
];
const ACTION_NAMES: readonly ActionName[] = [
  'Ambush', 'Assault Fire', 'Bore Sighting', 'Command Confusion', 'Concealment', 'Crossfire', 'Demolitions', 'Dig In',
  'Fire', 'Hand Grenades', 'Hidden Entrenchments', 'Hidden Mines', 'Hidden Pillbox', 'Hidden Unit', 'Hidden Wire',
  'Light Wounds', 'Marksmanship', 'No Quarter', 'Smoke Grenades', 'Spray Fire', 'Sustained Fire',
];
const EVENT_NAMES: readonly EventName[] = [
  'Air Support', 'Battle Harden', 'Battlefield Integrity', 'Blaze', 'Booby Trap', 'Breeze', 'Command & Control',
  'Commissar', 'Cower', 'Deploy', 'Dust', 'Elan', 'Entrench', 'Field Promotion', 'Fog of War', 'Hero', 'Infiltration',
  'Interdiction', 'Interrogation', 'KIA', 'Malfunction', 'Medic', 'Mission Objective', 'Prisoners of War',
  'Reconnaissance', 'Reinforcements', 'Rubble', 'Sappers', 'Scrounge', 'Shell Shock', 'Shellholes',
  'Strategic Objective', 'Suppressing Fire', 'Walking Wounded', 'White Phosphorus',
];

/**
 * A table whose entries are looked up in `handlers()` when read, falling back to a stub. Assigning an entry overrides it
 * (tests swap handlers in and restore them with Object.assign).
 */
function lazyTable<K extends string, V>(names: readonly K[], handlers: () => Partial<Record<K, V>>, stub: (k: K) => V): Record<K, V> {
  const table = {} as Record<K, V>;
  const overrides: Partial<Record<K, V>> = {};
  for (const k of names) {
    const fallback = stub(k);
    Object.defineProperty(table, k, {
      enumerable: true,
      get: () => overrides[k] ?? handlers()[k] ?? fallback,
      set: (v: V) => {
        overrides[k] = v;
      },
    });
  }
  return table;
}

export const ORDERS: Record<OrderName, OrderHandler> = lazyTable(ORDER_NAMES, () => orderIndex.ORDER_HANDLERS, stubOrder);
export const ACTIONS: Record<ActionName, ActionHandler> = lazyTable(ACTION_NAMES, () => actionIndex.ACTION_HANDLERS, stubAction);
export const EVENTS: Record<EventName, EventHandler> = lazyTable(EVENT_NAMES, () => eventIndex.EVENT_HANDLERS, stubEvent);

/** Extra answer checks by decision kind, for kinds other tasks add. */
export const DECISION_CHECKS: Partial<Record<Decision['kind'], DecisionCheck>> = {};
