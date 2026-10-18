// The Event handlers by name; a missing entry stays a stub (registry.ts) that only logs. Entries are getters that read
// the handler when it is used: the engine's modules import each other, so a plain object built while this module loads
// could catch a handler module that has not finished loading (tests/engine/load-order.test.ts). Add one namespace
// import and one getter per Event file in this folder; shared plumbing is in helpers.ts.
import type { EventName } from '../types';
import type { EventHandler } from '../registry';
import * as airSupportMod from './airSupport';
import * as battleHardenMod from './battleHarden';
import * as battlefieldIntegrityMod from './battlefieldIntegrity';
import * as blazeMod from './blaze';
import * as boobyTrapMod from './boobyTrap';
import * as breezeMod from './breeze';
import * as commandAndControlMod from './commandAndControl';
import * as commissarMod from './commissar';
import * as cowerMod from './cower';
import * as deployMod from './deploy';
import * as dustMod from './dust';
import * as elanMod from './elan';
import * as entrenchMod from './entrench';
import * as fieldPromotionMod from './fieldPromotion';
import * as fogOfWarMod from './fogOfWar';
import * as heroMod from './hero';
import * as infiltrationMod from './infiltration';
import * as interdictionMod from './interdiction';
import * as interrogationMod from './interrogation';
import * as kiaMod from './kia';
import * as malfunctionMod from './malfunction';
import * as medicMod from './medic';
import * as missionObjectiveMod from './missionObjective';
import * as prisonersOfWarMod from './prisonersOfWar';
import * as reconnaissanceMod from './reconnaissance';
import * as reinforcementsMod from './reinforcements';
import * as rubbleMod from './rubble';
import * as sappersMod from './sappers';
import * as scroungeMod from './scrounge';
import * as shellShockMod from './shellShock';
import * as shellholesMod from './shellholes';
import * as strategicObjectiveMod from './strategicObjective';
import * as suppressingFireMod from './suppressingFire';
import * as walkingWoundedMod from './walkingWounded';
import * as whitePhosphorusMod from './whitePhosphorus';

export const EVENT_HANDLERS: Partial<Record<EventName, EventHandler>> = {
  get 'Air Support'() {
    return airSupportMod.airSupportEvent;
  },
  get 'Battle Harden'() {
    return battleHardenMod.battleHardenEvent;
  },
  get 'Battlefield Integrity'() {
    return battlefieldIntegrityMod.battlefieldIntegrityEvent;
  },
  get Blaze() {
    return blazeMod.blazeEvent;
  },
  get 'Booby Trap'() {
    return boobyTrapMod.boobyTrapEvent;
  },
  get Breeze() {
    return breezeMod.breezeEvent;
  },
  get 'Command & Control'() {
    return commandAndControlMod.commandAndControlEvent;
  },
  get Commissar() {
    return commissarMod.commissarEvent;
  },
  get Cower() {
    return cowerMod.cowerEvent;
  },
  get Deploy() {
    return deployMod.deployEvent;
  },
  get Dust() {
    return dustMod.dustEvent;
  },
  get Elan() {
    return elanMod.elanEvent;
  },
  get Entrench() {
    return entrenchMod.entrenchEvent;
  },
  get 'Field Promotion'() {
    return fieldPromotionMod.fieldPromotionEvent;
  },
  get 'Fog of War'() {
    return fogOfWarMod.fogOfWarEvent;
  },
  get Hero() {
    return heroMod.heroEvent;
  },
  get Infiltration() {
    return infiltrationMod.infiltrationEvent;
  },
  get Interdiction() {
    return interdictionMod.interdictionEvent;
  },
  get Interrogation() {
    return interrogationMod.interrogationEvent;
  },
  get KIA() {
    return kiaMod.kiaEvent;
  },
  get Malfunction() {
    return malfunctionMod.malfunctionEvent;
  },
  get Medic() {
    return medicMod.medicEvent;
  },
  get 'Mission Objective'() {
    return missionObjectiveMod.missionObjectiveEvent;
  },
  get 'Prisoners of War'() {
    return prisonersOfWarMod.prisonersOfWarEvent;
  },
  get Reconnaissance() {
    return reconnaissanceMod.reconnaissanceEvent;
  },
  get Reinforcements() {
    return reinforcementsMod.reinforcementsEvent;
  },
  get Rubble() {
    return rubbleMod.rubbleEvent;
  },
  get Sappers() {
    return sappersMod.sappersEvent;
  },
  get Scrounge() {
    return scroungeMod.scroungeEvent;
  },
  get 'Shell Shock'() {
    return shellShockMod.shellShockEvent;
  },
  get Shellholes() {
    return shellholesMod.shellholesEvent;
  },
  get 'Strategic Objective'() {
    return strategicObjectiveMod.strategicObjectiveEvent;
  },
  get 'Suppressing Fire'() {
    return suppressingFireMod.suppressingFireEvent;
  },
  get 'Walking Wounded'() {
    return walkingWoundedMod.walkingWoundedEvent;
  },
  get 'White Phosphorus'() {
    return whitePhosphorusMod.whitePhosphorusEvent;
  },
};
