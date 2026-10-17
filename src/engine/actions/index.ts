// The Action handlers by name (Task 9 owns this file): one import line and one entry per Action file in this folder.
// A missing entry stays a stub (registry.ts): its Action is never offered.
import type { ActionName } from '../types';
import type { ActionHandler } from '../registry';
import { commandConfusionAction } from '../orders/confusion';
import { opFireAction } from '../orders/fire';

export const ACTION_HANDLERS: Partial<Record<ActionName, ActionHandler>> = {
  'Command Confusion': commandConfusionAction,
  Fire: opFireAction,
};
