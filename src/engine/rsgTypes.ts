// Types of the Random Scenario Generator tables (src/data/rsg.json, exported as RSG by data.ts). The procedure that uses
// them is design/scenarios-reference.md §4 (RS.1–RS.16 with the base-game adaptation R0). Counter references are
// counter type ids ("German/Rifle Squad"); years are inclusive [first, last].
import type { Edge, FortKind, Nation, Quality } from './types';

export type RsgNation = Nation;
export type ObSize = 'company' | 'detachment' | 'platoon';
export type YearRange = [number, number];

export interface RsgObSize {
  /** The OB chit, e.g. "A Coy." */
  chit: string;
  label: string;
  /** VP the OB costs (RS.5). */
  points: number;
  /** OB Initiative number (RS.13, RS.15). */
  initiative: number;
  orders: number;
  surrender: number;
  /** Number of Leader Table rolls (RS.6). */
  leaders: number;
  /** Squads, Teams and Weapons: counter type id → count. */
  units: Record<string, number>;
  /** Extra pieces only in some years (German Rifle Company mortars). */
  unitsByYear?: { years: YearRange; units: Record<string, number> }[];
}

export interface RsgOb {
  nation: Nation;
  /** Chit letter: German A–J (no I), American / Russian R–Z. */
  letter: string;
  name: string;
  years: YearRange;
  quality: Quality;
  sizes: Record<ObSize, RsgObSize>;
}

export type RsgSupportKind = 'leader' | 'leaderEither' | 'unitWithWeapon' | 'squad' | 'radio';

export interface RsgSupportItem {
  id: string;
  label: string;
  /**
   * leader / squad / radio: one counter; leaderEither: one of `oneOf` per purchase (FAQ RS.7); unitWithWeapon: the unit
   * and its Weapon, which `carrier` must carry at set-up (RS.7, §11.2). Radios only via RS.11 Asset Request and the
   * Reinforcements Event (§E68).
   */
  kind: RsgSupportKind;
  /** Counter type id → count (for leaderEither: empty; see oneOf). */
  pieces: Record<string, number>;
  oneOf?: string[];
  carrier?: string;
}

export interface RsgSupportEntry {
  item: string;
  vp: number;
  years: YearRange;
}

export interface RsgSupportTable {
  items: Record<string, RsgSupportItem>;
  /** Roll 2..12 → the entries printed in that column, top to bottom. */
  columns: Record<number, RsgSupportEntry[]>;
}

export interface RsgFortificationOb {
  id: string;
  name: string;
  vp: number;
  contents: Partial<Record<FortKind, number>>;
  /** Mines strength of the OB; all Minefield purchases must share one strength (RS.9). */
  minefield?: number;
}

export interface RsgTables {
  /** RS.1: friendly edge by the chosen die (1..6). */
  edgeByDie: Record<number, Edge>;
  /** RS.2.1: German year by roll 2..12. */
  germanYear: Record<number, number>;
  /** RS.2.2: Allied nation vs Germany by roll 2..12 and year; null = France / Britain (not in the base game: re-roll). */
  alliedNation: Record<number, Record<number, Nation | null>>;
  /** RS.3: troop quality by nation, roll 2..12 and year (only years the nation fields OBs). */
  troopQuality: Record<Nation, Record<number, Record<number, Quality>>>;
  /** RS.5: Orders of Battle by nation and chit letter. */
  obs: Record<Nation, Record<string, RsgOb>>;
  /** RS.6: Leader Table by nation: index 0 = result ≤0, 1..6, 7 = result 7+. */
  leaderTable: Record<Nation, string[]>;
  /** RS.6 modifiers: by OB quality, and by nation and year (null = the nation has no OBs that year). */
  leaderModifiers: { quality: Record<Quality, number>; year: Record<Nation, Record<number, number | null>> };
  /** RS.7 / RS.11.1 / §E59 / §E68 / §A35.4: Support Tables. */
  support: Record<Nation, RsgSupportTable>;
  /** RS.9 Fortification OBs. */
  fortifications: RsgFortificationOb[];
  /** RS.10–RS.13 set-up depths (rows from the friendly edge) on a wide / narrow map. */
  setupDepth: Record<'defender' | 'attacker' | 'fortifications' | 'recon', { wide: number; narrow: number }>;
  /**
   * Playbook p. 34 design-your-own point values (hundredths of a VP) by nation, keyed by counter type id or by leader
   * class ("Captain", "Lieutenant Cmd 2", "Lieutenant Cmd 1", "Sergeant Cmd 2", "Sergeant Cmd 1", "Corporal Morale 7",
   * "Corporal Morale 6", "Private", "Hero"). Not an RSG step; a yardstick for unit values.
   */
  pointValues: Record<Nation, Record<string, number>>;
  /** The same for fortifications (all nations): foxholes, trench, bunker, wire, mines6, mines7, mines8. */
  fortPointValues: Record<string, number>;
}
