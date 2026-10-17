// The Event handlers by name (Task 10 owns this file): one import line and one entry per Event file in this folder.
// A missing entry stays a stub (registry.ts) that only logs.
import type { EventName } from '../types';
import type { EventHandler } from '../registry';

export const EVENT_HANDLERS: Partial<Record<EventName, EventHandler>> = {};
