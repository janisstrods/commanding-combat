// What design/data/scenarios.json (the VASSAL setups) lacks, from design/scenarios-reference.md §3: names, edges, set-up
// areas and order, first Turn, special rules, and the places where the Playbook overrides the module's setup.
// Hex references stay labels; data.ts converts them.
import type { Edge, Side } from '../../src/engine/types';

export type SetupAreaJson =
  | { kind: 'depth'; depth: number }
  | { kind: 'near'; hexes: string[] }
  | { kind: 'hexes'; hexes: string[] }
  | { kind: 'anyFree' };

export interface SpecialJson {
  hedge?: { cost: number; cover: number };
  openCost?: number;
  simultaneousSetup?: boolean;
  initiativeChoice?: boolean;
  latePlacement?: Partial<Record<Side, string[]>>;
  stackingLimits?: Record<string, number>;
  excludeChits?: string[];
  notes?: string[];
}

export interface ScenarioRules {
  name: string;
  edges: Record<Side, Edge>;
  setupFirst: Side;
  firstTurn: Side;
  setup: Record<Side, SetupAreaJson>;
  special: SpecialJson;
  /** Discard Capability overrides (§5.3). */
  discard?: Partial<Record<Side, number>>;
  /** Minefield strength per side (§F103). */
  minefield?: Partial<Record<Side, number>>;
  /** Playbook corrections to the module's forces: counter name → replacement counter id (or null to drop). */
  replace?: Partial<Record<Side, Record<string, string | null>>>;
  /** Pieces the module lacks: counter id → count, on the map or on a Time Track space. */
  add?: Partial<Record<Side, { forces?: Record<string, number>; reinforcements?: Record<number, Record<string, number>> }>>;
  /** Counters of another nation in a side's forces: counter name → nation. */
  foreign?: Partial<Record<Side, Record<string, string>>>;
  /** Notes about this conversion (written to design/data-notes.md, not to the game data). */
  conversion?: string[];
}

export const SCENARIO_RULES: Record<number, ScenarioRules> = {
  1: {
    name: 'Fat Lipki',
    edges: { allied: 'top', axis: 'bottom' },
    // simultaneous: the order only says who is asked first
    setupFirst: 'allied',
    firstTurn: 'allied',
    setup: { allied: { kind: 'near', hexes: ['A2', 'O1'] }, axis: { kind: 'near', hexes: ['G10', 'N10'] } },
    special: { simultaneousSetup: true, initiativeChoice: true },
    conversion: [
      'Set-up is simultaneous and hidden (simultaneousSetup); setupFirst = allied only orders the prompts.',
      'firstTurn = allied: the default when the Axis keeps the Initiative card (initiativeChoice may swap it).',
    ],
  },
  2: {
    name: 'Hedgerows & Hand Grenades',
    edges: { allied: 'left', axis: 'right' },
    setupFirst: 'allied',
    firstTurn: 'allied',
    setup: { allied: { kind: 'depth', depth: 3 }, axis: { kind: 'depth', depth: 12 } },
    special: {
      latePlacement: { allied: ['American/Lt Blankenship'] },
      hedge: { cost: 2, cover: 2 },
    },
    conversion: [
      'Forward Observer: Lt Blankenship stays in the Allied forces and is listed in latePlacement (placed after the Axis set-up).',
      'Bocage: hedge.cost is the extra cost to cross a Hedge (+2 instead of +1), hedge.cover its Cover (2 instead of 1).',
    ],
  },
  3: {
    name: 'Bonfire of the NKVD',
    edges: { axis: 'left', allied: 'right' },
    setupFirst: 'allied',
    firstTurn: 'axis',
    setup: { allied: { kind: 'depth', depth: 12 }, axis: { kind: 'depth', depth: 3 } },
    special: {
      excludeChits: ['V', 'W', 'X'],
      notes: [
        'Command Post: Cpt Egorov sets up in N5.',
        'Hidden Fortifications: the Allies may place their Wire after the Axis set-up (in their own set-up area).',
        'Sappers: the Axis starts with card G-65 in hand (taken out of the deck before shuffling; it counts toward the opening hand).',
      ],
    },
  },
  4: {
    name: 'Closed for Renovation',
    edges: { allied: 'top', axis: 'bottom' },
    setupFirst: 'axis',
    firstTurn: 'allied',
    setup: { axis: { kind: 'depth', depth: 9 }, allied: { kind: 'depth', depth: 1 } },
    special: {
      notes: [
        'Hidden Gun: the Axis may set up one Weapon Team and the IG 18 Gun after the Allied set-up (in the Axis set-up area).',
        'Rubble: Axis Wire must be placed in or adjacent to Building hexes.',
      ],
    },
  },
  5: {
    name: 'Cold Front',
    edges: { allied: 'left', axis: 'right' },
    setupFirst: 'allied',
    firstTurn: 'allied',
    setup: { allied: { kind: 'depth', depth: 3 }, axis: { kind: 'depth', depth: 12 } },
    special: {
      openCost: 1.5,
      excludeChits: ['R', 'V', 'X'],
      notes: [
        'Deep Freeze: one of the four German Weapons, picked at random, starts broken. After play starts no Fortification can enter play by any means (an Action or Event that would place one does nothing, like Command Confusion).',
        'Winter Camouflage: an Allied Concealment Action lowers the Axis Fire Attack Total by a further 2.',
      ],
    },
    conversion: ['Played on the winter map 5w (the module setup uses Board 5W; the Playbook prints map 5 with Snow).'],
  },
  6: {
    name: 'Paralyzed from the West Down',
    edges: { allied: 'top', axis: 'bottom' },
    setupFirst: 'axis',
    firstTurn: 'allied',
    setup: { axis: { kind: 'depth', depth: 8 }, allied: { kind: 'depth', depth: 2 } },
    special: {
      excludeChits: ['W'],
      notes: ['Axis Orders per Turn start at 1 and rise by 1 at every Time advance, to at most 3.'],
    },
  },
  7: {
    name: 'Bessarabian Nights',
    edges: { allied: 'left', axis: 'right' },
    setupFirst: 'allied',
    firstTurn: 'allied',
    setup: { allied: { kind: 'depth', depth: 15 }, axis: { kind: 'anyFree' } },
    foreign: { allied: { 'Light Mortar': 'German' } },
    special: {
      excludeChits: ['R', 'W'],
      notes: [
        'Allied set-up: for each Russian unit reveal a Random Hex from the Russian Fate deck; the unit sets up in or adjacent to that hex. Then the Allies hand out their Weapons to Russian units, and the Russian deck is reshuffled.',
        'Axis set-up: all German units form one contiguous chain of Axis-occupied hexes, none in a hex with a Russian unit.',
        'Objective control starts with the side that alone occupies each Objective after set-up; the others start uncontrolled.',
        'The captured German Light Mortar is eliminated instead of breaking.',
        'No Quarter: nobody can earn Exit VP; a unit that leaves the map in any way is eliminated.',
        'Partisans: Allied units pay exactly 1 MP for every hex they enter (terrain, hexside and uphill costs are ignored); impassable terrain stays impassable and Wire still ends their movement.',
        'Hidden Forces: the Allies start with card R-31 in hand (taken out of the deck before shuffling; it counts toward the opening hand).',
      ],
    },
    conversion: [
      'Set-up areas: Allies depth 15 (anywhere, placed by the Random Hex rule in the notes); Axis anyFree (not in a hex with a Russian unit, after the Allies).',
      'The captured Light Mortar is the counter German/Light Mortar in the Allied forces.',
    ],
  },
  8: {
    name: 'Breakout Dance',
    edges: { allied: 'left', axis: 'right' },
    setupFirst: 'allied',
    firstTurn: 'axis',
    setup: { allied: { kind: 'depth', depth: 7 }, axis: { kind: 'depth', depth: 7 } },
    discard: { axis: 1 },
    special: {
      notes: [
        'Night Action: every Fire Attack Total is reduced by the distance in hexes between the target and the closest firing hex.',
        'Breakout: only the Axis can earn Exit VP; a Russian unit that leaves the map for any reason counts as eliminated.',
      ],
    },
    conversion: ['Chit W: the module parks it in the Axis box; it has no secret side, so it is an open chit (as the Playbook lists it).'],
  },
  9: {
    name: 'Rush to Contact',
    edges: { allied: 'top', axis: 'bottom' },
    setupFirst: 'allied',
    firstTurn: 'allied',
    setup: { allied: { kind: 'depth', depth: 1 }, axis: { kind: 'depth', depth: 9 } },
    minefield: { axis: 8 },
    add: { allied: { reinforcements: { 6: { 'American/Radio:105mm': 1 } } } },
    special: {
      notes: [
        'Mines option: before the opening draw the Axis may cut his Mines from 8 to 7 FP and in exchange start with card G-32 in hand (taken out of the deck before shuffling; it counts toward the opening hand).',
      ],
    },
    conversion: [
      'Allied Radio 105mm on Time space 6 (to the Artillery Box) added from the Playbook; the module setup lacks it.',
      'The module pre-places the 7 FP and 8 FP Minefield strength markers; the Playbook says 8 FP (minefield 8).',
    ],
  },
  10: {
    name: 'Commando School',
    edges: { allied: 'left', axis: 'right' },
    setupFirst: 'allied',
    firstTurn: 'axis',
    setup: { allied: { kind: 'depth', depth: 12 }, axis: { kind: 'depth', depth: 3 } },
    replace: { axis: { 'Lt Lauerbach': 'German/Lt Schrader' } },
    special: {
      notes: [
        'Combat Engineers: the two Pionier Squads start carrying the Flamethrower and the Satchel Charge (one each).',
        'Commandos: every Allied Melee roll gets +1.',
      ],
    },
    conversion: ['German leader: the Playbook lists Lt Schrader where the module setup has Lt Lauerbach (same values); the Playbook wins.'],
  },
  11: {
    name: 'Hold the Line',
    edges: { allied: 'left', axis: 'right' },
    setupFirst: 'allied',
    firstTurn: 'axis',
    setup: { allied: { kind: 'depth', depth: 10 }, axis: { kind: 'depth', depth: 1 } },
    replace: { allied: { Panzerfaust: 'American/Satchel Charge' } },
    special: {
      notes: [
        'Uncleared Fortifications: the pre-placed Wire and Mines belong to neither side; the Mines are 6 FP.',
        'Immobilised Sherman: the Bunker, Sgt Buehler with the .50 cal MG and the Weapon Team with the Pack Howitzer set up together in one non-Hill Open Ground hex. While the Bunker exists, that hex holds at most 4 figures of units. The Pack Howitzer cannot leave the Bunker hex and is eliminated if its carrier or the Bunker is.',
        'Captured Panzerfausts: the two American Satchel Charges cannot attack a hex whose Cover is below 2.',
      ],
    },
    conversion: [
      'The module stages two German Panzerfaust counters with the Americans; the Playbook lists two American Satchel Charges (SSR 4).',
      'The module\'s "Immobilized Sherman" fortification is the Playbook\'s Bunker.',
    ],
  },
  12: {
    name: 'Misty Mountain',
    edges: { axis: 'top', allied: 'bottom' },
    setupFirst: 'allied',
    firstTurn: 'allied',
    setup: { allied: { kind: 'depth', depth: 2 }, axis: { kind: 'depth', depth: 8 } },
    special: {
      notes: [
        'Reinforcements: when the Time space 7 group enters, any of it may be placed in or adjacent to road hex A9 instead of along the friendly edge.',
        'Caves: an Axis Sniper may break an enemy unit up to 2 hexes from the Random Hex.',
        'Fog: every hex has a Hindrance of 3 at every elevation, added to the largest other Hindrance (also for adjacent shots; not for Melee, Mine Attacks or Artillery Impact). Each Breeze Event lowers the fog by 1 (to 2, 1, then 0).',
      ],
    },
    conversion: [
      'Base-game stand-ins (as in the VASSAL setup): US Lt Blankenship, Cpl Hubbard and Cpl Jensen for the Brazilian Lt Oliveira, Cpl Pereira and Cpl Santos; Sgt Smith for Sgt Alves; US Line / Green Squads, Weapon Teams, MMGs and mortars (same printed values).',
    ],
  },
};
