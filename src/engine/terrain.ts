// The Terrain Effects Chart as data (rules-reference §T-TEC, §T78) and the map queries built on it: Cover, whole-hex
// LOS Hindrance, impassable and water hexes, and the Move cost of entering one hex from an adjacent one (§O21.1,
// §T88.1, §T80, §T92, §T93, §T96, §F105). Line of sight itself is in los.ts.
import { areAdjacent, hexsideBetween, type HexId } from './hex';
import type { FortKind, HexsideFeature, MapDef, PathKind, SpecialRules, TerrainType } from './types';

export interface TerrainInfo {
  /** Name as the chart prints it, for the UI. */
  name: string;
  /**
   * MP to enter the hex, or null when it cannot be entered that way: Water Barrier always; a Major Bridge except along
   * its road/railway (moveCost handles that, at cost 1).
   */
  move: number | null;
  /** Cover for units in the hex, or null where no unit can ever be (Water Barrier). Road −1 is a separate feature. */
  cover: number | null;
  /** LOS Hindrance of the terrain (0 = none). */
  hindrance: number;
  /** Blocks LOS through it (§10.2). */
  obstacle: boolean;
  /** Water terrain: no Weapon may fire from it; no Blaze, Smoke or Fortification may be in it. */
  water: boolean;
  /** Creates one blind hex behind it for a higher observer (§T88.4.1). */
  blindHex: boolean;
}

const t = (
  name: string,
  move: number | null,
  cover: number | null,
  hindrance: number,
  obstacle = false,
  water = false,
): TerrainInfo => ({ name, move, cover, hindrance, obstacle, water, blindHex: obstacle });

/** The terrain types of the chart (§T-TEC). */
export const TERRAIN: Readonly<Record<TerrainType, Readonly<TerrainInfo>>> = {
  Building: t('Building', 2, 3, 0, true),
  Woods: t('Woods', 2, 2, 0, true),
  Brush: t('Brush', 2, 1, 3),
  Orchard: t('Orchard', 1, 1, 2),
  Field: t('Field', 1, 0, 1),
  MajorBridge: t('Major Bridge', null, 2, 1),
  // "1 across a road/railway hexside, else the cost of the other terrain in the hex". A Minor Bridge lies inside one hex
  // and spans a Stream, so the other terrain is the Stream (project ruling: MapDef keeps one terrain type per hex).
  MinorBridge: t('Minor Bridge', 3, 2, 1),
  Gully: t('Gully', 2, 1, 0),
  Water: t('Water Barrier', null, null, 0, false, true),
  Stream: t('Stream', 3, -1, 0, false, true),
  Marsh: t('Marsh', 3, 0, 1, false, true),
  Open: t('Open Ground', 1, 0, 0),
};

export interface HexsideInfo {
  name: string;
  /** Extra MP to cross it, or null when Move/Retreat cannot cross it (Cliff). */
  cost: number | null;
  /** Alternate Cover against a Fire Attack whose LOS crosses it into the target hex (not vs Mortars/Artillery). */
  cover: number;
  /** LOS Hindrance when it is not a side of the sighting or target hex. */
  hindrance: number;
  /** Blocks LOS when it is not a side of the sighting or target hex. */
  obstacle: boolean;
}

/** The hexside features of the chart (§T-TEC: T83 Cliff, T84 Fence, T87 Hedge, T97 Wall). */
export const HEXSIDE: Readonly<Record<HexsideFeature, Readonly<HexsideInfo>>> = {
  Fence: { name: 'Fence', cost: 1, cover: 0, hindrance: 1, obstacle: false },
  Hedge: { name: 'Hedge', cost: 1, cover: 1, hindrance: 0, obstacle: true },
  Wall: { name: 'Wall', cost: 1, cover: 2, hindrance: 0, obstacle: true },
  Cliff: { name: 'Cliff', cost: null, cover: 0, hindrance: 0, obstacle: false },
};

/** A hexside feature's values under the scenario's special rules (scenario 2 Bocage changes Hedge cost and Cover). */
export function hexsideInfo(feature: HexsideFeature, special?: SpecialRules): Readonly<HexsideInfo> {
  if (feature === 'Hedge' && special?.hedge) return { ...HEXSIDE.Hedge, cost: special.hedge.cost, cover: special.hedge.cover };
  return HEXSIDE[feature];
}

// ---------------------------------------------------------------------------------------------------------------------
// Hex queries

export function hasPath(map: MapDef, hex: HexId, kind: PathKind): boolean {
  return map.pathHexes[kind]?.[hex] === true;
}

/** The hex shows a Road (Cover −1, §T93; entering it gives the +1 Movement bonus for the rest of the Move Order). */
export function hasRoad(map: MapDef, hex: HexId): boolean {
  return hasPath(map, hex, 'Road');
}

/** The feature on the hexside shared by adjacent hexes a and b (null if none or not adjacent). */
export function hexsideFeature(map: MapDef, a: HexId, b: HexId): HexsideFeature | null {
  const key = hexsideBetween(a, b);
  return key === null ? null : (map.hexsides[key] ?? null);
}

/** The road / trail / railway crossing the hexside shared by adjacent hexes a and b (null if none or not adjacent). */
export function pathBetween(map: MapDef, a: HexId, b: HexId): PathKind | null {
  const key = hexsideBetween(a, b);
  return key === null ? null : (map.paths[key] ?? null);
}

/**
 * Terrain Cover of the hex: the chart's Cover (0 for Water Barrier, where no unit can be), −1 if the hex shows a Road
 * (§T93). Fortifications and Wall/Hedge Cover are alternate Covers chosen by the owner (stats.ts); the Road −1 applies
 * to those too (§T93, R-20).
 */
export function terrainCover(map: MapDef, hex: HexId): number {
  return (TERRAIN[map.terrain[hex]].cover ?? 0) - (hasRoad(map, hex) ? 1 : 0);
}

/**
 * The hex's LOS Hindrance as a whole: its terrain's, or 1 for a Railway (§T92). For LOS use los.ts, which also applies
 * elevation, the clear corridors along roads and railways, and the drawn terrain when the map has a mask.
 */
export function hindranceOf(map: MapDef, hex: HexId): number {
  const h = TERRAIN[map.terrain[hex]].hindrance;
  return hasPath(map, hex, 'Railway') ? Math.max(h, 1) : h;
}

/** The hex's terrain is an LOS Obstacle (Woods, Building). */
export function isObstacle(map: MapDef, hex: HexId): boolean {
  return TERRAIN[map.terrain[hex]].obstacle;
}

/** Water Barrier: no unit, Blaze, Smoke or Fortification may ever be there (Blaze markers are checked by the caller). */
export function isImpassable(map: MapDef, hex: HexId): boolean {
  return map.terrain[hex] === 'Water';
}

/** Stream, Marsh or Water Barrier: no Weapon fires from it; no Blaze, Smoke or Fortification goes into it. */
export function isWaterHex(map: MapDef, hex: HexId): boolean {
  return TERRAIN[map.terrain[hex]].water;
}

// ---------------------------------------------------------------------------------------------------------------------
// Movement

/** The game-state parts that change Move costs. A GameState satisfies it (`moveCost(map, a, b, special, s)`). */
export interface MoveState {
  fort?: readonly (FortKind | null)[];
  blaze?: readonly boolean[];
}

/** Why a hex cannot be entered from an adjacent one at all (Move, Advance or Retreat). */
export type EnterBlock = 'notAdjacent' | 'water' | 'blaze' | 'cliff' | 'bridge';

const TRENCH_LIKE: readonly (FortKind | null)[] = ['trench', 'bunker', 'pillbox'];

/**
 * §F105: moving between adjacent hexes that each hold a Trench, Bunker or Pillbox, at least one of them a Trench, costs
 * exactly 1 MP and the moving unit cannot be Op Fired in the hex it enters.
 */
export function isTrenchMove(from: FortKind | null, to: FortKind | null): boolean {
  return TRENCH_LIKE.includes(from) && TRENCH_LIKE.includes(to) && (from === 'trench' || to === 'trench');
}

/**
 * Why `to` cannot be entered from adjacent `from`, or null if it can. A Cliff stops Move and Retreat; an Advancing unit
 * without a Weapon may cross it (§O16), so Advance treats 'cliff' as allowed for such units.
 */
export function enterBlock(map: MapDef, from: HexId, to: HexId, state?: MoveState): EnterBlock | null {
  if (from === to || !areAdjacent(from, to)) return 'notAdjacent';
  if (isImpassable(map, to)) return 'water';
  if (state?.blaze?.[to]) return 'blaze';
  const key = hexsideBetween(from, to)!;
  if (map.hexsides[key] === 'Cliff') return 'cliff';
  // Major Bridges are entered and left only across their road / railway hexsides (§T80.1)
  const path = map.paths[key];
  const alongBridge = path === 'Road' || path === 'Railway';
  if ((map.terrain[to] === 'MajorBridge' || map.terrain[from] === 'MajorBridge') && !alongBridge) return 'bridge';
  return null;
}

/**
 * MP to enter `to` from adjacent `from` (§O21.1), or null if a Move cannot do it: the terrain cost of `to` (1 instead when
 * crossing a Road / Trail / Railway hexside into a hex with that path; Open Ground costs `special.openCost` if set), plus
 * the hexside's cost (Fence / Hedge / Wall +1; Bocage Hedges `special.hedge.cost`), plus 1 to enter a higher hex. With
 * `state`, Blaze is impassable and Trench-connected hexes cost exactly 1 (§F105). Unit-dependent rules (Wire, the Road
 * bonus, Leader/Weapon Movement) are the caller's.
 */
export function moveCost(
  map: MapDef,
  from: HexId,
  to: HexId,
  special: SpecialRules = {},
  state?: MoveState,
): number | null {
  const block = enterBlock(map, from, to, state);
  if (block) return null;
  if (state?.fort && isTrenchMove(state.fort[from] ?? null, state.fort[to] ?? null)) return 1;
  const key = hexsideBetween(from, to)!;
  const terrain = map.terrain[to];
  const path = map.paths[key];
  let cost: number | null;
  if (path !== undefined && hasPath(map, to, path)) cost = 1;
  else if (terrain === 'MajorBridge') cost = 1; // only reachable along its road/railway (enterBlock)
  else if (terrain === 'Open' && special.openCost !== undefined) cost = special.openCost;
  else cost = TERRAIN[terrain].move;
  if (cost === null) return null;
  const feature = map.hexsides[key];
  if (feature !== undefined) cost += hexsideInfo(feature, special).cost ?? 0;
  if (map.elevation[to] > map.elevation[from]) cost += 1;
  return cost;
}
