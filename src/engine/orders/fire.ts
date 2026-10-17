// The Fire Order (§O20) and the Fire Action, Opportunity Fire (§A33). (Milestone 1c / 1d.)
import type { ActionHandler, OrderHandler } from '../registry';

export const fireOrder: OrderHandler = {
  canGive: () => false,
  *run() {},
};

export const opFireAction: ActionHandler = {
  windows: [],
  options: () => [],
  *run() {},
};
