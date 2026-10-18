// The handler tables must hold the real handlers whichever engine module happens to load first (the engine's modules
// import each other, so an index file that read its handlers at load time could catch one half-loaded).
import { describe, expect, it } from 'vitest';
import '../../src/engine/activation';
import { ACTIONS, EVENTS, ORDERS } from '../../src/engine/registry';
import { moveOrder } from '../../src/engine/orders/move';
import { fireOrder, opFireAction } from '../../src/engine/orders/fire';
import { ambushAction } from '../../src/engine/actions/ambush';

describe('handler tables and module load order', () => {
  it('serves the real Order and Action handlers when activation.ts loads first', () => {
    expect(ORDERS.Move).toBe(moveOrder);
    expect(ORDERS.Fire).toBe(fireOrder);
    expect(ACTIONS.Fire).toBe(opFireAction);
    expect(ACTIONS.Ambush).toBe(ambushAction);
  });

  it('has an entry for every Event name', () => {
    expect(Object.keys(EVENTS)).toHaveLength(35);
  });
});
