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
  /** Breeze wind direction (map compass 1..6): printed only on the six Breeze cards of each deck, null on the rest. */
  breeze: HexSide | null;
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
  /** Set-up Fortifications are placed after both sides have deployed their units (RSG RS.12; also fits scenario 3's
   * Hidden Fortifications, whose Allies place only Wire). */
  fortificationsLast?: boolean;
  /** After all set-up, each Objective that one side alone occupies passes to that side, swinging its open chits' VP
   * (objectives.ts updateControl over all five). RSG RS.11.2 / RS.13; also fits scenario 7. */
  controlAfterSetup?: boolean;
  /** Pieces that start together: one unit of type `unit` carries one Weapon of type `weapon` from staging on (a unit
   * bought with its Weapon on a Support Table must set up with it, RS.7 / §11.2; also fits scenario 10's Pioniers). */
  carried?: Partial<Record<Side, { unit: string; weapon: string }[]>>;
  // --- Task 15 (src/engine/scenarioRules.ts reads these; hexes are labels such as "N5") ---------------------------------
  /** Units that set up in a named hex before the rest of their side (counter type → hex label; scenario 3 Command Post). */
  setupHex?: Partial<Record<Side, Record<string, string>>>;
  /** Per-side pieces placed after all other deployment, in their side's own set-up area (one per listed counter type;
   * scenario 4 Hidden Gun). */
  lateSetup?: Partial<Record<Side, string[]>>;
  /** Set-up Fortifications of a kind that must go in or adjacent to a hex of this terrain (scenario 4 Rubble: Wire near
   * Buildings). */
  fortNear?: Partial<Record<Side, Partial<Record<FortKind, TerrainType>>>>;
  /** Units (with the Weapons `carried` gives them) that set up together in one hex of the side's set-up area with this
   * terrain and elevation, with one of the side's set-up Fortifications `fort` (scenario 11 Immobilised Sherman). */
  setupTogether?: Partial<Record<Side, { units: string[]; fort: FortKind; terrain: TerrainType; elevation: number }>>;
  /** Sides whose units set up by Random Hexes from their own Fate deck: each revealed hex takes one unit (the owner's
   * pick) in or adjacent to it; then the Weapons are handed out and the deck is reshuffled (scenario 7). */
  randomHexSetup?: Side[];
  /** Sides whose units must set up as one chain: each new unit in a hex the side holds or next to one (scenario 7). */
  chainSetup?: Side[];
  /** Number of a side's Weapons, picked at random (pre-game: seeded RNG), that start broken (scenario 5 Deep Freeze). */
  brokenWeapons?: Partial<Record<Side, number>>;
  /** Fate cards a side starts with in hand: taken out of the deck, they count toward the opening hand (scenarios 3, 7). */
  startingCards?: Partial<Record<Side, CardId[]>>;
  /** Before the opening draw the side may lower its Minefield strength to `minefield` and take `card` into its opening
   * hand (scenario 9). */
  minesForCard?: Partial<Record<Side, { minefield: number; card: CardId }>>;
  /** After play starts no Fortification enters play: the Actions that would place one cannot be played (as Command
   * Confusion) and the Events that would place one do nothing (scenario 5 Deep Freeze). */
  noNewFortifications?: boolean;
  /** A Concealment Action of this side lowers the Fire Attack Total by this much more (scenario 5 Winter Camouflage). */
  concealmentBonus?: Partial<Record<Side, number>>;
  /** The side's Orders per Turn rise by 1 at every Time advance, up to this number (scenario 6). */
  ordersRiseTo?: Partial<Record<Side, number>>;
  /** Counter types (per side) that are eliminated instead of breaking (scenario 7 captured Light Mortar). */
  eliminateInsteadOfBreak?: Partial<Record<Side, string[]>>;
  /** Sides that earn no Exit VP: their units that exit are eliminated instead (scenarios 7 No Quarter, 8 Breakout). */
  noExit?: Side[];
  /** Sides whose units pay exactly 1 MP for every hex a Move enters (scenario 7 Partisans; impassable stays so). */
  flatMoveCost?: Side[];
  /** Night: every Fire Attack Total is reduced by the distance from the closest firing hex to the target (scenario 8). */
  night?: boolean;
  /** Added to every Melee total of the side (scenario 10 Commandos). */
  meleeBonus?: Partial<Record<Side, number>>;
  /** Stacking limit (figures) of a hex while it holds this Fortification (scenario 11: the Sherman's Bunker, 4). */
  fortStackingLimits?: Partial<Record<FortKind, number>>;
  /** Weapon types fixed in a hex with this Fortification: eliminated when their carrier leaves the hex or the
   * Fortification is gone (scenario 11 Pack Howitzer). */
  fixedWeapons?: Record<string, FortKind>;
  /** Weapon types that may only attack a hex whose Cover is at least this (scenario 11 captured Panzerfausts: 2). */
  minTargetCover?: Record<string, number>;
  /** The side's reinforcements of Time space `space` may also enter in or adjacent to hex `hex` (scenario 12: A9). */
  entryHex?: Partial<Record<Side, { space: number; hex: string }>>;
  /** The side's Sniper! may also break an enemy unit up to this many hexes from the Random Hex (scenario 12 Caves: 2). */
  sniperRange?: Partial<Record<Side, number>>;
  /** Fog: a Hindrance in every hex at start (scenario 12: 3), added to the largest other Hindrance of every LOS; each
   * Breeze Event lowers it by 1 (GameState.fog holds the current value). */
  fog?: number;
  /** The briefing players see: every special rule of the scenario in words (all implemented, src/engine/scenarioRules.ts). */
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
  /** Pieces (units and Weapons) that have fired in the Fire Order in progress (each fires once, §O20.3). */
  fired: PieceId[];
  /** The Move Order in progress, or null (kept in the state so a flow can resume from it). */
  move: MoveProgress | null;
}

/** Bookkeeping of the Move Order in progress (§O21). */
export interface MoveProgress {
  /** MP spent so far this Move Order, per unit. */
  spent: Record<PieceId, number>;
  /** Units that have entered a road hex this Move Order (+1 Movement for the rest of it, §T93). */
  road: PieceId[];
  /** Units whose move is over (they finished, exited or were stopped). */
  done: PieceId[];
  /** The unit or group moving now (it finishes before another starts, §O21.2), or null between them. */
  group: PieceId[] | null;
  /** Some activated unit has entered a hex (a Move Order must move someone, §O14.4). */
  entered: boolean;
  /** The hex the moving group is in (members put elsewhere, e.g. by a Blaze, leave the group and end their move). */
  groupHex?: HexId;
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
  /** The scenario's map; shared and never mutated, like `scenario` (a GameState is a los.ts LosView). */
  readonly map: MapDef;
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
  /**
   * Redacted views only (state.ts `redact`): the pools the viewer cannot see into, sorted. `cards[side]`: the cards of
   * that side's deck that are in its draw pile or (for the opponent) its hand; `chits`: the cup plus the opponent's
   * secret chits. The masked lists themselves hold UNKNOWN_CARD / UNKNOWN_CHIT.
   */
  unseen?: { cards: Record<Side, CardId[]>; chits: ChitId[] };
  /** The scenario Fog Hindrance now (SpecialRules.fog, lowered by Breeze); absent = the scenario's starting value. */
  fog?: number;
}

/** Placeholder for an Objective chit the viewer cannot know (cup, opponent's secret chits) in a redacted state. */
export const UNKNOWN_CHIT: ChitId = '??';

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
  | 'timeAdvanceEnd'
  /** Any time while the active player's units are activated to Move (Assault Fire, Smoke Grenades): offered inside every
   * `move` decision of the Move Order as `actions`, not as a separate `react` decision. */
  | 'duringMove';

/** A Fire Attack in progress (§O20.4), as the Action windows see it; Actions played on it change it. */
export interface AttackInfo {
  /** The firing player. */
  side: Side;
  mode: 'order' | 'opFire' | 'assault' | 'artillery' | 'mine';
  pieces: PieceId[];
  /** Target hexes: one, or two after Spray Fire (§A40). */
  targets: HexId[];
  ordnance: boolean;
  /** A Mortar (or Artillery) attack: Airburst, Fortification +1, no Wall/Hedge Cover. */
  mortarOrArtillery: boolean;
  /** Flamethrower / Mines: target Cover is 0. */
  ignoresCover: boolean;
  /** FP before Action bonuses (after group, Hindrance and height); fire.ts recomputes it after the window. */
  fp: number;
  /** FP added by Actions (+2 each for Bore Sighting, Crossfire, Hand Grenades, Marksmanship, Sustained Fire). */
  bonus: number;
  /** The Attack Total once rolled (before Concealment), else null. */
  total: number | null;
  /** Subtracted from the total for the remaining Defense rolls (Concealment). */
  reduction: number;
  /** Actions played on this attack, in order. */
  played: ActionName[];
}

/** What a reaction window is about. Handlers may write to it (e.g. `opFireDone`); fire.ts reads `attack` back. */
export interface WindowInfo {
  /** The hex entered, the target or defending hex, the melee hex. */
  hex?: HexId;
  /** The units concerned: the moving group, the defending unit, the Squad about to break, melee participants. */
  units?: PieceId[];
  /** The side whose units entered the hex (afterHexEntry / afterAdvanceEntry). */
  mover?: Side;
  attack?: AttackInfo;
  /** squadWouldBreak: what breaks it. */
  cause?: CasualtyCause;
  /** opponentPassed: how many cards he discarded. */
  discards?: number;
  /** afterHexEntry: the one Op Fire attack of this MP expenditure has been made (§A33.3). */
  opFireDone?: boolean;
}

/** Why a piece breaks or is eliminated (Light Wounds applies to breaking only, R-54). */
export type CasualtyCause =
  | 'fire'
  | 'opFire'
  | 'artillery'
  | 'mine'
  | 'melee'
  | 'ambush'
  | 'sniper'
  | 'event'
  | 'jammed'
  | 'overstack'
  | 'retreat'
  | 'rout'
  | 'other';

/**
 * One Action a player may play now: the card, which of its uses, and the choices it needs (if any). The Fire Action's
 * option with `card: ''` is the Op Fire attack with units already activated for Op Fire this Move Order (no card).
 * Targets: unless the Action's handler checks them itself, an answer picks exactly one from each list given.
 */
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
  /** Events: which of the two Deploy Teams keeps each marker; where an Infiltration item goes; who gets a Scrounged
   * Weapon; where a Walking Wounded unit goes. */
  | 'deployMarkers'
  | 'infiltrationPlace'
  | 'scroungeUnit'
  | 'walkingWoundedPlace'
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
  /** Rout: which broken unit the Order's player rolls for next. */
  | 'routOrder'
  | 'initiativeChoice'
  | 'placement'
  /** A scenario's pre-game option (SpecialRules.minesForCard): 'label' items, the first keeps things as they are. */
  | 'scenarioOption';

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
  | {
      kind: 'fire';
      side: Side;
      mode: 'order' | 'opFire' | 'assault';
      pieces: PieceId[];
      target?: HexId;
      /** 'done' is refused: the Order has made no attack yet and one is possible (§O14.4). */
      mustFire?: boolean;
    }
  /** Move: the next step of the Move Order. */
  | {
      kind: 'move';
      side: Side;
      /** Activated units that may still start (or, in `current`, continue) moving. */
      units: PieceId[];
      current: PieceId[] | null;
      /** MP left per unit of `units` / `current` (current Movement + Road bonus − MP spent). */
      mp: Record<PieceId, number>;
      /** 'done' with no group moving is refused: no unit has entered a hex yet and one can (§O14.4). */
      mustMove?: boolean;
      /** Actions the mover may play now (window 'duringMove': Assault Fire, Smoke Grenades); answered with 'play'. */
      actions?: ActionOption[];
    }
  /** Advance: where each activated unit goes (one answer per unit: 'advanceTo', or 'exit' off the enemy edge). */
  | {
      kind: 'advance';
      side: Side;
      units: PieceId[];
      /** 'done' is refused: no unit has advanced yet and one can (§O14.4). */
      mustAdvance?: boolean;
    }
  /** A reaction window: play one of these Actions, or pass. Asked again after each play until the player passes. */
  | { kind: 'react'; side: Side; window: WindowKind; options: ActionOption[]; info: WindowInfo }
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
  /** `carrier`: for a Weapon, the unit in `hex` that takes it (default: the first one there without a Weapon). */
  | { kind: 'deploy'; piece: PieceId; hex: HexId; carrier?: PieceId }
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
  /** A Veteran marker placed on a unit (Battle Harden, §E44). */
  | { kind: 'veteran'; piece: PieceId }
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
  | { kind: 'reshuffle'; side: Side }
  | { kind: 'transfer'; weapon: PieceId; from: PieceId; to: PieceId }
  | { kind: 'fix'; piece: PieceId }
  | { kind: 'initiative'; side: Side }
  /** A unit replaced by others in its hex (Light Wounds, Deploy); `piece` went back to the counter mix. */
  | { kind: 'replace'; piece: PieceId; by: PieceId[] }
  | { kind: 'gameOver'; winner: Side; reason: EndReason }
  /**
   * A reaction window opened for `side` (reactions.ts `reactFor`), whether or not he has an Action to play in it.
   * Emitted only when the flow's ctx has `windows` set (the UI's driver: it pauses the same for every window of the
   * computer, so the timing never shows whether it held a playable card).
   */
  | { kind: 'window'; window: WindowKind; side: Side };

// ---------------------------------------------------------------------------------------------------------------------
// Flow plumbing

export interface FlowCtx {
  emit: (e: GameEvent) => void;
  /** Report a refused answer (the flow asks again). */
  invalid: (message: string) => void;
  /**
   * Trigger depth: > 0 while resolving a trigger or an Event (including a Time advance and a melee inside an Event).
   * Rolls made at depth > 0 never trigger (§1.9.1). Pass `{ ...ctx, depth: (ctx.depth ?? 0) + 1 }` down.
   */
  depth?: number;
  /** Set by casualties.ts `simultaneously`: sides that lost (surrender / annihilation) during it, judged at its end. */
  losers?: Side[];
  /** Emit a 'window' event whenever a reaction window opens for a side (the UI's GameDriver sets it; off elsewhere). */
  windows?: boolean;
}
