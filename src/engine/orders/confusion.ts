// Command Confusion (§O19, §A28): the card can be given neither as an Order nor played as that Action.
import type { ActionHandler, OrderHandler } from '../registry';

export const commandConfusionOrder: OrderHandler = {
  canGive: () => false,
  *run() {
    /* never given */
  },
};

export const commandConfusionAction: ActionHandler = {
  windows: [],
  options: () => [],
  *run() {
    /* never played */
  },
};
