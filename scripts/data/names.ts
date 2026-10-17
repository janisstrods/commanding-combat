// The name lists of src/engine/types.ts as runtime values, so the build can refuse any name the engine doesn't know.
import type { ActionName, EventName, Nation, OrderName, TerrainType } from '../../src/engine/types';

export const ORDER_NAMES: OrderName[] = [
  'Advance',
  'Artillery Denied',
  'Artillery Request',
  'Command Confusion',
  'Fire',
  'Move',
  'Recover',
  'Rout',
];

export const ACTION_NAMES: ActionName[] = [
  'Ambush',
  'Assault Fire',
  'Bore Sighting',
  'Command Confusion',
  'Concealment',
  'Crossfire',
  'Demolitions',
  'Dig In',
  'Fire',
  'Hand Grenades',
  'Hidden Entrenchments',
  'Hidden Mines',
  'Hidden Pillbox',
  'Hidden Unit',
  'Hidden Wire',
  'Light Wounds',
  'Marksmanship',
  'No Quarter',
  'Smoke Grenades',
  'Spray Fire',
  'Sustained Fire',
];

export const EVENT_NAMES: EventName[] = [
  'Air Support',
  'Battle Harden',
  'Battlefield Integrity',
  'Blaze',
  'Booby Trap',
  'Breeze',
  'Command & Control',
  'Commissar',
  'Cower',
  'Deploy',
  'Dust',
  'Elan',
  'Entrench',
  'Field Promotion',
  'Fog of War',
  'Hero',
  'Infiltration',
  'Interdiction',
  'Interrogation',
  'KIA',
  'Malfunction',
  'Medic',
  'Mission Objective',
  'Prisoners of War',
  'Reconnaissance',
  'Reinforcements',
  'Rubble',
  'Sappers',
  'Scrounge',
  'Shell Shock',
  'Shellholes',
  'Strategic Objective',
  'Suppressing Fire',
  'Walking Wounded',
  'White Phosphorus',
];

/** Printed spellings in design/data → types.ts spellings. */
export const RENAME: Record<string, string> = {
  'White Phosphorous': 'White Phosphorus',
  'Medic!': 'Medic',
  Élan: 'Elan',
};

export const NATIONS: Nation[] = ['German', 'American', 'Russian'];

/** Terrain types, highest first (§T-TEC hierarchy, §T78.1: the highest type depicted in a hex is its type). */
export const TERRAIN_RANK: TerrainType[] = [
  'Building',
  'Woods',
  'Brush',
  'Orchard',
  'Field',
  'MajorBridge',
  'MinorBridge',
  'Gully',
  'Water',
  'Stream',
  'Marsh',
  'Open',
];

export function normalise<T extends string>(name: string, known: readonly T[], what: string): T {
  const n = RENAME[name] ?? name;
  if (!(known as readonly string[]).includes(n)) throw new Error(`Unknown ${what} name: ${name}`);
  return n as T;
}
