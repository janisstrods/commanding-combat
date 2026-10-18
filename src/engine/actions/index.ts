// The Action handlers by name (Task 9 owns this file): one import line and one entry per Action file in this folder.
// A missing entry stays a stub (registry.ts): its Action is never offered.
import type { ActionName } from '../types';
import type { ActionHandler } from '../registry';
import { commandConfusionAction } from '../orders/confusion';
import { opFireAction } from '../orders/fire';
import { ambushAction } from './ambush';
import { assaultFireAction } from './assaultFire';
import { boreSightingAction } from './boreSighting';
import { concealmentAction } from './concealment';
import { crossfireAction } from './crossfire';
import { demolitionsAction } from './demolitions';
import { digInAction } from './digIn';
import { handGrenadesAction } from './handGrenades';
import { hiddenEntrenchmentsAction } from './hiddenEntrenchments';
import { hiddenMinesAction } from './hiddenMines';
import { hiddenPillboxAction } from './hiddenPillbox';
import { hiddenUnitAction } from './hiddenUnit';
import { hiddenWireAction } from './hiddenWire';
import { lightWoundsAction } from './lightWounds';
import { marksmanshipAction } from './marksmanship';
import { noQuarterAction } from './noQuarter';
import { smokeGrenadesAction } from './smokeGrenades';
import { sprayFireAction } from './sprayFire';
import { sustainedFireAction } from './sustainedFire';

export const ACTION_HANDLERS: Partial<Record<ActionName, ActionHandler>> = {
  Ambush: ambushAction,
  'Assault Fire': assaultFireAction,
  'Bore Sighting': boreSightingAction,
  'Command Confusion': commandConfusionAction,
  Concealment: concealmentAction,
  Crossfire: crossfireAction,
  Demolitions: demolitionsAction,
  'Dig In': digInAction,
  Fire: opFireAction,
  'Hand Grenades': handGrenadesAction,
  'Hidden Entrenchments': hiddenEntrenchmentsAction,
  'Hidden Mines': hiddenMinesAction,
  'Hidden Pillbox': hiddenPillboxAction,
  'Hidden Unit': hiddenUnitAction,
  'Hidden Wire': hiddenWireAction,
  'Light Wounds': lightWoundsAction,
  Marksmanship: marksmanshipAction,
  'No Quarter': noQuarterAction,
  'Smoke Grenades': smokeGrenadesAction,
  'Spray Fire': sprayFireAction,
  'Sustained Fire': sustainedFireAction,
};
