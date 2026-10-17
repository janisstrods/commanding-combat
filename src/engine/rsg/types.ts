// Types of the Random Scenario Generator engine (src/engine/rsg.ts re-exports them). Every RsgDraft is plain JSON.
import type { ObSize, RsgSupportKind } from '../rsgTypes';
import type { ChitId, Edge, FortKind, Nation, Posture, Quality, Side } from '../types';

export type RsgOrientation = 'wide' | 'narrow';

/** Choices a side makes, named after the RS steps. */
export type RsgChoiceWhat = 'mapPick' | 'mapEdgeDie' | 'ob' | 'supportBuy' | 'fortifications' | 'assetRequest';
/** Automatic steps (rolls and bookkeeping), named after the RS steps. */
export type RsgAutoWhat =
  | 'sides'
  | 'mapRoll'
  | 'edgeRoll'
  | 'year'
  | 'allied'
  | 'quality'
  | 'chits'
  | 'obPoints'
  | 'leaders'
  | 'supportRoll'
  | 'posture'
  | 'control'
  | 'assetRoll'
  | 'initiative';

/** What the user fixed instead of rolling or choosing (R0.3, "or surprise me"). */
export interface RsgFixed {
  /** "1".."12" (RSG_MAPS). */
  map?: string;
  /** The Axis friendly edge; the Allies take the opposite one. */
  axisEdge?: Edge;
  /** 1941..1945 (1939 and 1940 have no base-game Allies, R0). */
  year?: number;
  /** 'American' (1943–45) or 'Russian' (1941–45). */
  allied?: Nation;
  quality?: Partial<Record<Side, Quality>>;
  /** The Defender, or null for Recon v Recon, instead of RS.8's VP rule. */
  defender?: Side | null;
}

export interface RsgOptions {
  seed: number;
  /** The side the human plays; without it RS.2's coin flip decides. */
  humanSide?: Side;
  fixed?: RsgFixed;
}

/** One line of the record, in order. `text` is for the log the UI shows (British spelling). */
export interface RsgLogEntry {
  step: RsgAutoWhat | RsgChoiceWhat | 'fixed';
  side: Side | null;
  dice?: number[];
  coin?: 'heads' | 'tails';
  /** The VP marker after this entry (positive toward the Axis), on entries that move or read it. */
  vp?: number;
  choice?: RsgChoice;
  text: string;
}

export interface RsgObPick {
  letter: string;
  size: ObSize;
}

/** One Support Table purchase, as bought. */
export interface RsgPurchase {
  /** The option id (see RsgSupportOption.id). */
  id: string;
  item: string;
  label: string;
  vp: number;
  pieces: Record<string, number>;
  /** unitWithWeapon: the unit type that carries `weapon` at set-up. */
  carrier?: string;
  weapon?: string;
}

/** One RS.7 Support roll and what was bought with it. */
export interface RsgSupportRound {
  side: Side;
  roll: [number, number];
  bought: RsgPurchase[];
  /** Total VP paid (moved toward the opponent). */
  cost: number;
  /** The purchase is made (or the column offered nothing). */
  done: boolean;
}

/** RS.11.1 Asset Request. */
export interface RsgAsset {
  requested: boolean;
  roll: [number, number] | null;
  /** Radio counter type id bought, or null. */
  radio: string | null;
  cost: number;
}

/** The RSG so far: plain JSON (save it, send it to the worker, compare it). */
export interface RsgDraft {
  v: 1;
  seed: number;
  /** mulberry32 state (rng.ts `random`): every roll of the generator comes from it. */
  rng: number;
  rngCalls: number;
  fixed: RsgFixed;
  /** Index of the next step to consider (internal). */
  at: number;
  humanSide: Side | null;
  log: RsgLogEntry[];
  /** RS.1: who picks the map; the other player chooses the edge die. */
  mapPicker: Side | null;
  map: string | null;
  /** RS.1 second roll: [white, coloured]. */
  edgeDice: [number, number] | null;
  edges: Record<Side, Edge> | null;
  year: number | null;
  allied: Nation | null;
  quality: Record<Side, Quality | null>;
  openChits: ChitId[];
  /** Each side's secret chit (none if the one drawn had no secret side). The UI shows only the viewer's own. */
  secretChits: Record<Side, ChitId[]>;
  /** RS.5 picks (simultaneous: the UI must not show the opponent's before both are made). */
  ob: Record<Side, RsgObPick | null>;
  /** The VP marker, positive toward the Axis (§4.1). */
  vp: number;
  /** RS.6: Leader counter type ids. */
  leaders: Record<Side, string[]>;
  support: RsgSupportRound[];
  postures: Record<Side, Posture> | null;
  /** RS.9: Fortification OB ids bought by the Defender (repeats allowed). */
  fortifications: string[];
  /** RS.10 / RS.13: Objective control at the start of set-up. */
  control: (Side | null)[] | null;
  asset: RsgAsset | null;
  initiative: Side | null;
}

export interface RsgMapOption {
  map: string;
}

export interface RsgEdgeOption {
  die: 'white' | 'coloured';
  value: number;
  /** The chooser's friendly edge. */
  edge: Edge;
  orientation: RsgOrientation;
}

export interface RsgObOption {
  letter: string;
  size: ObSize;
  /** The OB chit, e.g. "B Coy.". */
  chit: string;
  /** e.g. "SS Company". */
  label: string;
  name: string;
  quality: Quality;
  points: number;
  initiative: number;
  orders: number;
  surrender: number;
  /** Leader Table rolls (RS.6). */
  leaders: number;
  /** Squads, Teams and Weapons (year-dependent pieces included): counter type id → count. */
  units: Record<string, number>;
}

export interface RsgSupportOption {
  /** The item id, or `${item}:${leader}` for one Leader of an "A or B" row. */
  id: string;
  item: string;
  label: string;
  kind: RsgSupportKind;
  vp: number;
  pieces: Record<string, number>;
  carrier?: string;
  weapon?: string;
  /** At most once per roll: named Leaders (one counter each). */
  once: boolean;
  /** Options sharing a group exclude each other (the two Leaders of an "A or B" row, FAQ RS.7). */
  group?: string;
}

export interface RsgFortOption {
  id: string;
  name: string;
  vp: number;
  contents: Partial<Record<FortKind, number>>;
  minefield?: number;
}

/** A Radio the Asset Request roll can bring, for the Attacker's decision. */
export interface RsgRadioChance {
  radio: string;
  label: string;
  vp: number;
  rolls: number[];
  /** Probability of rolling one of `rolls`. */
  chance: number;
}

export type RsgChoiceStep =
  | { kind: 'choice'; id: string; what: 'mapPick'; side: Side; options: RsgMapOption[] }
  | { kind: 'choice'; id: string; what: 'mapEdgeDie'; side: Side; options: RsgEdgeOption[] }
  | { kind: 'choice'; id: string; what: 'ob'; side: Side; nation: Nation; year: number; quality: Quality; options: RsgObOption[] }
  | {
      kind: 'choice';
      id: string;
      what: 'supportBuy';
      side: Side;
      roll: [number, number];
      /** The buyer's VP lead before buying (> 0). Every purchase but the last must leave it above 0. */
      lead: number;
      /** 1 when the column offers anything (he must buy), else 0. */
      min: number;
      options: RsgSupportOption[];
    }
  | { kind: 'choice'; id: string; what: 'fortifications'; side: Side; budget: number; options: RsgFortOption[] }
  | {
      kind: 'choice';
      id: string;
      what: 'assetRequest';
      side: Side;
      /** The Defender's VP lead now (a Radio's cost adds to it). */
      defenderLead: number;
      radios: RsgRadioChance[];
      options: { request: boolean }[];
    };

export type RsgStep =
  | { kind: 'auto'; id: string; what: RsgAutoWhat; side: Side | null; label: string }
  | RsgChoiceStep
  | { kind: 'done' };

export type RsgChoice =
  | { what: 'mapPick'; map: string }
  | { what: 'mapEdgeDie'; die: 'white' | 'coloured' }
  | { what: 'ob'; letter: string; size: ObSize }
  /** Option ids from the step; a non-Leader item may repeat. */
  | { what: 'supportBuy'; buy: string[] }
  /** Fortification OB ids; repeats allowed. */
  | { what: 'fortifications'; buy: string[] }
  | { what: 'assetRequest'; request: boolean };

