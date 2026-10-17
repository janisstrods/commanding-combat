// The engine's contract: game data, game state, the decisions the flow asks and the answers it takes, and the events
// the UI animates. Everything in GameState is plain JSON data (no classes, Maps or Sets), so a state can be cloned,
// saved and sent to the AI worker. Section numbers (§) refer to design/rules-reference.md.
//
// Changing this file: unions may grow (a new decision kind, event kind or reason), existing fields keep their meaning.
// Say so in the commit message, because every part of the app reads these types.
import type { HexId, HexSide } from './hex';

export type { HexId, HexSide } from './hex';

// ---------------------------------------------------------------------------------------------------------------------
// Sides, nations and scenario basics

/** The two sides of a scenario. Axis is always German in the base game; Allied is American or Russian. */
export type Side = 'axis' | 'allied';
export const SIDES: readonly Side[] = ['axis', 'allied'];
export const other = (s: Side): Side => (s === 'axis' ? 'allied' : 'axis');

export type Nation = 'German' | 'American' | 'Russian';
export type Posture = 'attack' | 'recon' | 'defend';
export type Quality = 'elite' | 'line' | 'green';
/** A map edge. Rows run 1 (top, compass 1) to 10 (bottom, compass 4); columns A (left, 5/6) to O (right, 2/3). */
export type Edge = 'top' | 'bottom' | 'left' | 'right';

// ---------------------------------------------------------------------------------------------------------------------
// Fate cards (§1)

export type OrderName =
  | 'Advance'
  | 'Artillery Denied'
  | 'Artillery Request'
  | 'Command Confusion'
  | 'Fire'
  | 'Move'
  | 'Recover'
  | 'Rout';

/** 'Fire' as an Action is Opportunity Fire (§A33): every "Order/Action Fire" card may be played for it. */
export type ActionName =
  | 'Ambush'
  | 'Assault Fire'
  | 'Bore Sighting'
  | 'Command Confusion'
  | 'Concealment'
  | 'Crossfire'
  | 'Demolitions'
  | 'Dig In'
  | 'Fire'
  | 'Hand Grenades'
  | 'Hidden Entrenchments'
  | 'Hidden Mines'
  | 'Hidden Pillbox'
  | 'Hidden Unit'
  | 'Hidden Wire'
  | 'Light Wounds'
  | 'Marksmanship'
  | 'No Quarter'
  | 'Smoke Grenades'
  | 'Spray Fire'
  | 'Sustained Fire';

export type EventName =
  | 'Air Support'
  | 'Battle Harden'
  | 'Battlefield Integrity'
  | 'Blaze'
  | 'Booby Trap'
  | 'Breeze'
  | 'Command & Control'
  | 'Commissar'
  | 'Cower'
  | 'Deploy'
  | 'Dust'
  | 'Elan'
  | 'Entrench'
  | 'Field Promotion'
  | 'Fog of War'
  | 'Hero'
  | 'Infiltration'
  | 'Interdiction'
  | 'Interrogation'
  | 'KIA'
  | 'Malfunction'
  | 'Medic'
  | 'Mission Objective'
  | 'Prisoners of War'
  | 'Reconnaissance'
  | 'Reinforcements'
  | 'Rubble'
  | 'Sappers'
  | 'Scrounge'
  | 'Shell Shock'
  | 'Shellholes'
  | 'Strategic Objective'
  | 'Suppressing Fire'
  | 'Walking Wounded'
  | 'White Phosphorus';

export type Trigger = 'Event' | 'Jammed' | 'Sniper' | 'Time';

/** Card ids are `<G|A|R>-<nn>`, e.g. "G-01" (German card 1). */
export type CardId = string;
/** Placeholder for a card the viewer cannot know (opponent's hand, any draw pile) in a redacted state. */
export const UNKNOWN_CARD: CardId = '??';

export interface FateCard {
  id: CardId;
  nation: Nation;
  number: number;
  order: OrderName;
  /** "Order/Action Fire": may also be played as the Fire Action (Op Fire), besides `action`. */
  fireIsAction: boolean;
  action: ActionName;
  /** True for the Hidden actions and Bore Sighting printed as scenario-Defender only. */
  defenderOnly: boolean;
  event: EventName;
  white: number;
  red: number;
  trigger: Trigger | null;
  /** The Random Hex printed on the card. */
  hex: HexId;
  /** Breeze wind direction printed on the card (map compass 1..6). */
  breeze: HexSide;
}

// ---------------------------------------------------------------------------------------------------------------------
// Counters (§3, §11, §12)

export type PieceKind = 'squad' | 'team' | 'leader' | 'weapon' | 'radio';

/** One side of a counter. Units: fp, range, move, morale (+ command for leaders). Weapons: fp, range, move (penalty). */
export interface SideStats {
  fp: number;
  range: number;
  move: number;
  morale: number;
  command: number;
  /** Boxed values (§3.1.6): fp → Assault Fire / +1 melee, range → Spray Fire, move → Smoke Grenades. */
  boxed: { fp: boolean; range: boolean; move: boolean };
}

/** A counter type from the counter mix, e.g. "German/Rifle Squad" or "American/Lt Blankenship". */
export interface CounterType {
  id: string;
  nation: Nation;
  kind: PieceKind;
  name: string;
  /** Squads and Teams: Elite / Line / Green (for Light Wounds and Deploy replacements). */
  quality?: Quality;
  /** Leaders. */
  rank?: string;
  hero?: boolean;
  /** The Private brought in by Field Promotion. */
  private?: boolean;
  front: SideStats;
  /** Broken side (weapons: same values; the broken side shows only `fix` and `elim`). */
  broken: SideStats;
  // weapons
  ordnance?: boolean;
  /** Can fire Smoke instead (weapons with "Smoke", radios with "Smoke"). */
  smoke?: boolean;
  /** Mortar minimum range (e.g. 2 for "2-16"). */
  minRange?: number;
  /** Broken weapon: Random Hex numbers that fix it / eliminate it (inclusive ranges). */
  fix?: [number, number];
  elim?: [number, number];
  /** Weapon classes used by rules: 'mg' (Sustained Fire, Suppressing Fire), 'mortar' (Airburst, fortification +1). */
  weaponClass?: 'mg' | 'mortar' | 'flamethrower' | 'satchel' | 'gun' | 'other';
  /** Satchel Charge / Molotov: removed after making a Fire Attack Roll. */
  oneUse?: boolean;
  /** Flamethrower / Molotov: target Cover is 0. */
  ignoresCover?: boolean;
}

/** Piece ids are short strings unique within a game, e.g. "u12". */
export type PieceId = string;

/** Where a piece is. Weapons carried by a unit are 'carried' (see `carrier`). */
export type Where = 'map' | 'carried' | 'staging' | 'time' | 'casualty' | 'weaponsBox' | 'artillery' | 'mix';

export interface Piece {
  id: PieceId;
  /** CounterType id. */
  type: string;
  side: Side;
  where: Where;
  /** Hex when `where === 'map'`, else -1. */
  hex: HexId;
  /** Time Track space when `where === 'time'`, else -1. */
  space: number;
  broken: boolean;
  suppressed: boolean;
  veteran: boolean;
  /** Units: the weapon carried, or null. */
  weapon: PieceId | null;
  /** Weapons: the unit carrying it, or null. */
  carrier: PieceId | null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Maps (§2, Part F)

export type TerrainType =
  | 'Open'
  | 'Woods'
  | 'Brush'
  | 'Orchard'
  | 'Field'
  | 'Building'
  | 'MajorBridge'
  | 'MinorBridge'
  | 'Gully'
  | 'Water'
  | 'Stream'
  | 'Marsh';

export type HexsideFeature = 'Fence' | 'Hedge' | 'Wall' | 'Cliff';
export type PathKind = 'Road' | 'Trail' | 'Railway';

/**
 * Sub-hex terrain shapes for line of sight (§10.2: a LOS that touches the drawn obstacle is blocked). A raster over the
 * map in hex-radius units: cell (i, j) covers x in [x0 + i / res, x0 + (i + 1) / res), y likewise. Each cell holds a
 * MaskClass and its elevation.
 */
export interface TerrainMask {
  res: number;
  x0: number;
  y0: number;
  width: number;
  height: number;
  /** width * height MaskClass codes, row-major. */
  cls: Uint8Array | number[];
  /** width * height elevation levels, row-major. */
  level: Uint8Array | number[];
}

/** Codes stored in TerrainMask.cls. Road and railway cells are clear corridors through other terrain. */
export const MASK = {
  open: 0,
  woods: 1,
  building: 2,
  brush: 3,
  orchard: 4,
  field: 5,
  marsh: 6,
  stream: 7,
  water: 8,
  gully: 9,
  road: 10,
  railway: 11,
  bridge: 12,
} as const;
export type MaskClass = (typeof MASK)[keyof typeof MASK];

export interface MapDef {
  /** "1".."12", "5w". */
  id: string;
  terrain: TerrainType[];
  /** Hex level (the higher level of a crest hex). */
  elevation: number[];
  /** Crest hexes: hexes that contain two levels (§10.4). */
  crest: boolean[];
  /** Hexside features by hexsideKey. */
  hexsides: Record<number, HexsideFeature>;
  /** Path crossings (road / trail / railway) by hexsideKey, including map-edge exits. */
  paths: Record<number, PathKind>;
  /** Hexes with a road / trail / railway depiction. */
  pathHexes: Partial<Record<PathKind, boolean[]>>;
  /** The five printed objectives: hex of each (index 0 = Objective 1). */
  objectives: HexId[];
  /** Hexes of one multi-hex building (for building objectives, §7.3.1.1): building id per hex, -1 for none. */
  building: number[];
  mask?: TerrainMask;
}

// ---------------------------------------------------------------------------------------------------------------------
// Scenarios (design/scenarios-reference.md)

export interface SideSetup {
  nation: Nation;
  posture: Posture;
  quality: Quality;
  orders: number;
  /** Hand size: Attack 6, Recon 5, Defend 4 unless the scenario says otherwise. */
  handSize: number;
  /** Discard Capability (§5.3): Germany 6, America 5, Russia 3 unless the scenario says otherwise. */
  discard: number;
  surrender: number;
  edge: Edge;
  /** Forces: counter type id → count, deployed on the map at setup. */
  forces: Record<string, number>;
  /** Fortifications placed at setup: kind → count. */
  fortifications: Partial<Record<FortKind, number>>;
  /** Reinforcements parked on the Time Track: space → counter type id → count. */
  reinforcements: Record<number, Record<string, number>>;
  /** Where this side sets up. */
  setupArea: SetupArea;
  /** Objective chits this side draws as secret at start: 'random' draws, or named chits. */
  secretChits: ('random' | string)[];
  /** Minefield strength printed for this side when it has Mines (§F103): 6, 7 or 8. */
  minefield?: number;
}

export type SetupArea =
  /** Within the first `depth` rows/columns counted from the side's own edge. */
  | { kind: 'depth'; depth: number }
  /** In or adjacent to any of these hexes. */
  | { kind: 'near'; hexes: HexId[] }
  /** Exactly these hexes. */
  | { kind: 'hexes'; hexes: HexId[] }
  /** Any hex without an enemy unit (placed after the other side). */
  | { kind: 'anyFree' };

/** Scenario special rules the engine knows. Each is data the rules read; none goes by scenario number. */
export interface SpecialRules {
  /** Scenario 2 Bocage: hedges cost this much to cross and give this Cover. */
  hedge?: { cost: number; cover: number };
  /** Scenario 5 Snow: Open Ground costs 1.5 MP. */
  openCost?: number;
  /** Scenario 1: both sides deploy hidden, at once. */
  simultaneousSetup?: boolean;
  /** Scenario 1: once hands are dealt, the Initiative holder chooses to keep the card and move second, or give it away
   * and move first. */
  initiativeChoice?: boolean;
  /** Per-side pieces placed after all other deployment, anywhere without an enemy unit (scenario 2 forward observer). */
  latePlacement?: Partial<Record<Side, string[]>>;
  /** Hexes with a lower stacking limit (figures). */
  stackingLimits?: Record<number, number>;
  /** Chits removed from the cup before drawing. */
  excludeChits?: string[];
  /** Free text of the rules this list cannot express, shown in the briefing; each must also be implemented in code. */
  notes?: string[];
}

export interface ScenarioDef {
  /** "1".."12", or "rsg" for a random scenario. */
  id: string;
  name: string;
  map: string;
  year: number;
  sides: Record<Side, SideSetup>;
  initiative: Side;
  firstTurn: Side;
  /** Deployment order: the side that sets up first. */
  setupFirst: Side;
  time: number;
  suddenDeath: number;
  /** Starting VP, positive toward Axis. */
  vp: number;
  /** Initial control of Objectives 1..5. */
  control: (Side | null)[];
  /** Chits placed open at start: named chit letters, or 'random' draws. */
  openChits: ('random' | string)[];
  /** Pieces placed on the map at start regardless of side setup (e.g. wire, mines): hex → fortification. */
  prePlaced: { hex: HexId; fort: FortKind }[];
  special: SpecialRules;
}

// ---------------------------------------------------------------------------------------------------------------------
// Game state

export type FortKind = 'foxholes' | 'trench' | 'pillbox' | 'bunker' | 'wire' | 'mines';

/** Objective chits A..X (no I, O). */
export type ChitId = string;

export interface PlayerState {
  side: Side;
  nation: Nation;
  posture: Posture;
  quality: Quality;
  orders: number;
  handSize: number;
  discard: number;
  /** Casualties needed to surrender (Élan raises it, §E54). */
  surrender: number;
  edge: Edge;
  hand: CardId[];
  /** Draw pile, index 0 = top. */
  deck: CardId[];
  /** Discard pile, last = top. */
  discards: CardId[];
  /** Units on this player's row of the Casualty Track, in order (§4.2). */
  casualties: PieceId[];
  /** This player's unrevealed secret Objective chits. */
  secretChits: ChitId[];
  /** Minefield strength (§F103). */
  minefield: number;
}

/** What the current Turn has done so far (§J.2). */
export interface TurnState {
  number: number;
  ordersGiven: number;
  /** Units activated this Turn (Orders or Op Fire). Heroes are never added. */
  activated: PieceId[];
  /** Players activated this Turn by Recover / Rout (and who did it: `${by}>${target}`). */
  playerActivations: string[];
  /** Units activated for the Move Order in progress (moved, moving or yet to move): ties break them (§O20.3.4). */
  moving: PieceId[];
  /** The inactive player's units activated for Op Fire during the Move Order in progress. */
  opFire: PieceId[];
  /** The Turn ended with a pass: how many cards were discarded. */
  passDiscards: number | null;
}

/** One reveal from a Fate deck. Rolls (dice) can be re-rolled with the Initiative; reveals for hexes/events cannot. */
export interface Reveal {
  side: Side;
  card: CardId;
  purpose: RevealPurpose;
}

export type RevealPurpose =
  | 'fireAttack'
  | 'targeting'
  | 'defense'
  | 'melee'
  | 'rally'
  | 'rout'
  | 'mine'
  | 'impact'
  | 'accuracy'
  | 'suddenDeath'
  | 'support'
  | 'eventRoll'
  | 'randomHex'
  | 'event'
  | 'drift';

export interface GameState {
  /** Shared, never mutated during play (cloneState keeps the reference). */
  readonly scenario: ScenarioDef;
  /** RNG state (only shuffles and pre-game tables use it; every "roll" is a card reveal). */
  rng: number;
  rngCalls: number;
  players: Record<Side, PlayerState>;
  /** Every piece in the game by id: units, weapons and radios, wherever they are. */
  pieces: Record<PieceId, Piece>;
  /** Fortification per hex (one per hex, §8.1.3). */
  fort: (FortKind | null)[];
  /** Smoke hindrance per hex (0 = none). */
  smoke: number[];
  blaze: boolean[];
  /** Spotting Round hex, or -1. */
  spottingRound: HexId;
  /** Objectives 1..5: current control. */
  control: (Side | null)[];
  /** Open (face-up) Objective chits. */
  openChits: ChitId[];
  /** Chits still in the cup. */
  chitCup: ChitId[];
  /** Smoke chits still in the cup (their hindrance values). */
  smokeCup: number[];
  /** Victory points, positive toward Axis (§4.1). */
  vp: number;
  time: number;
  suddenDeath: number;
  year: number;
  initiative: Side;
  active: Side;
  turn: TurnState;
  /** The most recent roll, for the Initiative re-roll (§9.1). */
  lastRoll: Reveal | null;
  winner: Side | null;
  endReason: EndReason | null;
  /** Phase before play: 'setup' while deploying, then 'play'. */
  phase: 'setup' | 'play' | 'over';
}

export type EndReason = 'surrender' | 'annihilation' | 'exit' | 'suddenDeath' | 'objectivesV';

// ---------------------------------------------------------------------------------------------------------------------
// Decisions and answers

/** Moments when Actions may be played in answer to something (§A24 timing table). */
export type WindowKind =
  | 'beforeFireAttackRoll'
  | 'beforeDefenseRoll'
  | 'squadWouldBreak'
  | 'afterHexEntry'
  | 'afterAdvanceEntry'
  | 'beforeMelee'
  | 'afterMelee'
  | 'opponentPassed'
  | 'timeAdvanceEnd';

/** One Action a player may play now: the card, which of its uses, and the choices it needs (if any). */
export interface ActionOption {
  card: CardId;
  action: ActionName;
  /** Choices the action needs, as options the answer picks from (e.g. target pieces or hexes). */
  targets?: { pieces?: PieceId[]; hexes?: HexId[] };
}

/** A Fire Attack (or Smoke shot) chosen by the firing player. */
export interface FireSpec {
  pieces: PieceId[];
  target: HexId;
  smoke?: boolean;
}

/** Why a generic `choose` decision is asked (so UI and AI can word and judge it). */
export type ChoiceReason =
  | 'rallyOrder'
  | 'defenseOrder'
  | 'retreatStep'
  | 'sniperTarget'
  | 'airSupport'
  | 'battleHarden'
  | 'commissar'
  | 'deploy'
  | 'fieldPromotion'
  | 'heroPlace'
  | 'heroRally'
  | 'infiltration'
  | 'interdiction'
  | 'interrogation'
  | 'kia'
  | 'malfunctionTie'
  | 'medic'
  | 'pow'
  | 'reconnaissance'
  | 'reinforcementItem'
  | 'reinforcementPlace'
  | 'sappers'
  | 'scrounge'
  | 'shellShockTie'
  | 'suppressingFire'
  | 'walkingWounded'
  | 'whitePhosphorus'
  | 'whitePhosphorusLoss'
  | 'smokeRemoval'
  | 'blazeDisplace'
  | 'overstackDeploy'
  | 'overstackEliminate'
  | 'ambushVictim'
  | 'exitSpace'
  | 'supportItem'
  | 'hiddenUnitPlace'
  | 'sprayHex'
  | 'sustainedBreak'
  | 'fortRemove'
  | 'digInHex'
  | 'entrenchHex'
  | 'smokeGrenadeHex'
  | 'spotterSR'
  | 'artilleryKind'
  | 'impactOrder'
  | 'meleeOrder'
  | 'initiativeChoice'
  | 'placement';

export type ChoiceItem =
  | { piece: PieceId }
  | { hex: HexId }
  | { card: CardId }
  | { chit: ChitId }
  | { type: string }
  | { space: number }
  | { label: string };

export type Decision =
  /** The active player's Turn: give an Order (with a card from hand), or pass discarding cards. */
  | {
      kind: 'turn';
      side: Side;
      /** Cards that can be played as an Order right now, with the Order. */
      orders: { card: CardId; order: OrderName }[];
      /** True before the first Order: the player may pass. After an Order he may only give another or end. */
      canPass: boolean;
      maxDiscard: number;
    }
  /** Choose what an Order activates: one unit (a Leader may bring units in its Command radius), or a player. */
  | {
      kind: 'activate';
      side: Side;
      order: OrderName | 'Op Fire';
      card: CardId;
      /** Units that may be the first activated unit. */
      units: PieceId[];
      /** For Recover / Rout: players that may be activated. */
      players?: Side[];
    }
  /** Fire: the next Fire Attack among the activated pieces, or done. */
  | { kind: 'fire'; side: Side; mode: 'order' | 'opFire' | 'assault'; pieces: PieceId[]; target?: HexId }
  /** Move: the next step of the Move Order. */
  | { kind: 'move'; side: Side; units: PieceId[]; current: PieceId[] | null }
  /** Advance: where each activated unit goes (one answer per unit). */
  | { kind: 'advance'; side: Side; units: PieceId[] }
  /** A reaction window: play one of these Actions, or pass. Asked again after each play until the player passes. */
  | { kind: 'react'; side: Side; window: WindowKind; options: ActionOption[] }
  /** The Initiative holder may cancel the most recent roll (§9.1). */
  | { kind: 'reroll'; side: Side; roll: Reveal }
  /** A generic choice among items. */
  | { kind: 'choose'; side: Side; reason: ChoiceReason; items: ChoiceItem[]; min: number; max: number; context?: unknown }
  /** Deployment: place one piece from staging on a legal hex (or let the engine finish). */
  | { kind: 'deploy'; side: Side; pieces: PieceId[]; hexes: HexId[] };

export type Answer =
  | { kind: 'order'; card: CardId; order: OrderName }
  | { kind: 'pass'; discard: CardId[] }
  | { kind: 'endTurn' }
  | { kind: 'activate'; units: PieceId[] }
  | { kind: 'activatePlayer'; player: Side }
  | { kind: 'fire'; spec: FireSpec }
  | { kind: 'moveStep'; units: PieceId[]; to: HexId }
  | { kind: 'exit'; units: PieceId[] }
  | { kind: 'transfer'; from: PieceId; to: PieceId }
  | { kind: 'advanceTo'; unit: PieceId; to: HexId }
  | { kind: 'play'; option: number; targets?: { pieces?: PieceId[]; hexes?: HexId[] } }
  | { kind: 'reroll'; yes: boolean }
  | { kind: 'choose'; items: number[] }
  | { kind: 'deploy'; piece: PieceId; hex: HexId }
  | { kind: 'done' };

// ---------------------------------------------------------------------------------------------------------------------
// Events (what the UI animates and the log shows)

export type GameEvent =
  | { kind: 'turnStart'; side: Side; number: number }
  | { kind: 'cardPlayed'; side: Side; card: CardId; as: 'order' | 'action'; name: OrderName | ActionName }
  | { kind: 'discard'; side: Side; cards: CardId[] }
  | { kind: 'draw'; side: Side; cards: CardId[] }
  | { kind: 'reveal'; side: Side; card: CardId; purpose: RevealPurpose; value?: number; trigger?: Trigger | null }
  | { kind: 'reroll'; side: Side; by: Side }
  | { kind: 'trigger'; side: Side; trigger: Trigger; card: CardId }
  | { kind: 'event'; side: Side; card: CardId; event: EventName }
  | { kind: 'activate'; side: Side; units: PieceId[]; order: OrderName | 'Op Fire' }
  | { kind: 'move'; units: PieceId[]; from: HexId; to: HexId; mp: number }
  | { kind: 'exit'; units: PieceId[]; from: HexId }
  | { kind: 'retreat'; unit: PieceId; from: HexId; to: HexId }
  | { kind: 'fireAttack'; side: Side; pieces: PieceId[]; target: HexId; fp: number; total: number; hexes?: HexId[] }
  | { kind: 'targeting'; side: Side; piece: PieceId; target: HexId; product: number; need: number; hit: boolean }
  | { kind: 'defense'; unit: PieceId; morale: number; total: number; attack: number; result: 'none' | 'suppress' | 'break' }
  | { kind: 'break'; piece: PieceId }
  | { kind: 'rally'; piece: PieceId }
  | { kind: 'suppress'; piece: PieceId }
  | { kind: 'eliminate'; piece: PieceId; vp: number }
  | { kind: 'place'; piece?: PieceId; hex: HexId; marker?: FortKind | 'smoke' | 'blaze' | 'sr'; value?: number }
  | { kind: 'remove'; hex: HexId; marker: FortKind | 'smoke' | 'blaze' | 'sr' }
  | { kind: 'melee'; hex: HexId; totals: Record<Side, number>; losers: Side[] }
  | { kind: 'vp'; delta: number; total: number; why: string }
  | { kind: 'control'; objective: number; side: Side | null }
  | { kind: 'chit'; chit: ChitId; side: Side | null; open: boolean }
  | { kind: 'time'; time: number; side: Side }
  | { kind: 'suddenDeath'; roll: number; time: number; ends: boolean }
  | { kind: 'reinforce'; pieces: PieceId[] }
  | { kind: 'log'; text: string; side?: Side }
  | { kind: 'gameOver'; winner: Side; reason: EndReason };

// ---------------------------------------------------------------------------------------------------------------------
// Flow plumbing

export interface FlowCtx {
  emit: (e: GameEvent) => void;
  /** Report a refused answer (the flow asks again). */
  invalid: (message: string) => void;
}
