// The Action handlers by name, one file per Action in this folder; a missing entry stays a stub (registry.ts): its
// Action is never offered. Entries are getters that read the handler when it is used, never while modules load (see
// orders/index.ts and tests/engine/load-order.test.ts). Add one namespace import and one getter per Action.
import type { ActionName } from '../types';
import type { ActionHandler } from '../registry';
import * as ambushMod from './ambush';
import * as assaultFireMod from './assaultFire';
import * as boreSightingMod from './boreSighting';
import * as concealmentMod from './concealment';
import * as crossfireMod from './crossfire';
import * as demolitionsMod from './demolitions';
import * as digInMod from './digIn';
import * as handGrenadesMod from './handGrenades';
import * as hiddenEntrenchmentsMod from './hiddenEntrenchments';
import * as hiddenMinesMod from './hiddenMines';
import * as hiddenPillboxMod from './hiddenPillbox';
import * as hiddenUnitMod from './hiddenUnit';
import * as hiddenWireMod from './hiddenWire';
import * as lightWoundsMod from './lightWounds';
import * as marksmanshipMod from './marksmanship';
import * as noQuarterMod from './noQuarter';
import * as orders_confusionMod from '../orders/confusion';
import * as orders_fireMod from '../orders/fire';
import * as smokeGrenadesMod from './smokeGrenades';
import * as sprayFireMod from './sprayFire';
import * as sustainedFireMod from './sustainedFire';

export const ACTION_HANDLERS: Partial<Record<ActionName, ActionHandler>> = {
  get Ambush() {
    return ambushMod.ambushAction;
  },
  get 'Assault Fire'() {
    return assaultFireMod.assaultFireAction;
  },
  get 'Bore Sighting'() {
    return boreSightingMod.boreSightingAction;
  },
  get 'Command Confusion'() {
    return orders_confusionMod.commandConfusionAction;
  },
  get Concealment() {
    return concealmentMod.concealmentAction;
  },
  get Crossfire() {
    return crossfireMod.crossfireAction;
  },
  get Demolitions() {
    return demolitionsMod.demolitionsAction;
  },
  get 'Dig In'() {
    return digInMod.digInAction;
  },
  get Fire() {
    return orders_fireMod.opFireAction;
  },
  get 'Hand Grenades'() {
    return handGrenadesMod.handGrenadesAction;
  },
  get 'Hidden Entrenchments'() {
    return hiddenEntrenchmentsMod.hiddenEntrenchmentsAction;
  },
  get 'Hidden Mines'() {
    return hiddenMinesMod.hiddenMinesAction;
  },
  get 'Hidden Pillbox'() {
    return hiddenPillboxMod.hiddenPillboxAction;
  },
  get 'Hidden Unit'() {
    return hiddenUnitMod.hiddenUnitAction;
  },
  get 'Hidden Wire'() {
    return hiddenWireMod.hiddenWireAction;
  },
  get 'Light Wounds'() {
    return lightWoundsMod.lightWoundsAction;
  },
  get Marksmanship() {
    return marksmanshipMod.marksmanshipAction;
  },
  get 'No Quarter'() {
    return noQuarterMod.noQuarterAction;
  },
  get 'Smoke Grenades'() {
    return smokeGrenadesMod.smokeGrenadesAction;
  },
  get 'Spray Fire'() {
    return sprayFireMod.sprayFireAction;
  },
  get 'Sustained Fire'() {
    return sustainedFireMod.sustainedFireAction;
  },
};
