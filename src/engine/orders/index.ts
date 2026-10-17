// The Order handlers by name. Tasks 7 (Advance, Recover, Rout) and 8 (Artillery Request, Artillery Denied) add one
// import line and one entry each; a missing entry stays a stub (registry.ts).
import type { OrderName } from '../types';
import type { OrderHandler } from '../registry';
import { commandConfusionOrder } from './confusion';
import { fireOrder } from './fire';
import { moveOrder } from './move';

export const ORDER_HANDLERS: Partial<Record<OrderName, OrderHandler>> = {
  'Command Confusion': commandConfusionOrder,
  Fire: fireOrder,
  Move: moveOrder,
};
