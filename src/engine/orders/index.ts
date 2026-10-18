// The Order handlers by name; a missing entry stays a stub (registry.ts). Entries are getters that read the handler
// when it is used: the engine's modules import each other, so a plain object built while this module loads could catch
// a handler module that has not finished loading (tests/engine/load-order.test.ts). Add one namespace import and one
// getter per Order.
import type { OrderName } from '../types';
import type { OrderHandler } from '../registry';
import * as advanceMod from './advance';
import * as artilleryMod from './artillery';
import * as confusionMod from './confusion';
import * as fireMod from './fire';
import * as moveMod from './move';
import * as recoverMod from './recover';
import * as routMod from './rout';

export const ORDER_HANDLERS: Partial<Record<OrderName, OrderHandler>> = {
  get Advance() {
    return advanceMod.advanceOrder;
  },
  get 'Artillery Denied'() {
    return artilleryMod.artilleryDeniedOrder;
  },
  get 'Artillery Request'() {
    return artilleryMod.artilleryRequestOrder;
  },
  get 'Command Confusion'() {
    return confusionMod.commandConfusionOrder;
  },
  get Fire() {
    return fireMod.fireOrder;
  },
  get Move() {
    return moveMod.moveOrder;
  },
  get Recover() {
    return recoverMod.recoverOrder;
  },
  get Rout() {
    return routMod.routOrder;
  },
};
