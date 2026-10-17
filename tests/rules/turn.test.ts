// The Turn: Orders or a pass, Order and Discard Capability, the end of the Turn (§5, §O14, §O15, R-01).
import { afterEach, describe, expect, it } from 'vitest';
import { answerError } from '../../src/engine/decisions';
import { gameFlow, turnFlow } from '../../src/engine/flow';
import { ORDERS } from '../../src/engine/registry';
import type { Decision, OrderName } from '../../src/engine/types';
import { build, card, cardsWhere, passive, run, script } from '../support/build';

const G = 'German';

describe('passing (§5.3, R-01)', () => {
  it('may discard nothing', () => {
    const hand = cardsWhere(G, { order: 'Recover' }).slice(0, 6);
    const s = build({ axis: { posture: 'attack', hand } });
    run(s, (ctx) => turnFlow(s, ctx), script([{ kind: 'pass', discard: [] }]));
    expect(s.players.axis.hand).toEqual(hand);
    expect(s.turn.passDiscards).toBe(0);
  });

  it('discards up to the Discard Capability, then refills', () => {
    const hand = cardsWhere(G, { order: 'Recover' }).slice(0, 6);
    const s = build({ axis: { posture: 'attack', hand, discard: 2 } });
    const r = run(s, (ctx) => turnFlow(s, ctx), script([{ kind: 'pass', discard: hand.slice(0, 2) }]));
    const d = r.decisions[0] as Extract<Decision, { kind: 'turn' }>;
    expect(d).toMatchObject({ kind: 'turn', side: 'axis', canPass: true, maxDiscard: 2 });
    expect(answerError(s, d, { kind: 'pass', discard: hand.slice(0, 3) })).toMatch(/at most 2/);
    expect(s.players.axis.discards).toEqual(hand.slice(0, 2));
    expect(s.players.axis.hand).toHaveLength(6);
    expect(s.players.axis.hand.slice(0, 4)).toEqual(hand.slice(2));
  });

  it('the opponent moves next', () => {
    const s = build({
      axis: { hand: cardsWhere(G, { order: 'Recover' }).slice(0, 5) },
      allied: { hand: cardsWhere('American', { order: 'Recover' }).slice(0, 5) },
    });
    const r = run(s, (ctx) => gameFlow(s, ctx), script([{ kind: 'pass', discard: [] }]));
    expect(r.pending).toMatchObject({ kind: 'turn', side: 'allied' });
    expect(s.active).toBe('allied');
    expect(s.turn.number).toBe(2);
  });
});

describe('Orders (§O14)', () => {
  const saved: Partial<typeof ORDERS> = {};
  afterEach(() => Object.assign(ORDERS, saved));
  /** Make `name` a giveable Order that does nothing (the real ones are tested in their own files). */
  const dummy = (name: OrderName) => {
    saved[name] = ORDERS[name];
    const runs: string[] = [];
    ORDERS[name] = {
      canGive: () => true,
      *run(_s, _ctx, side, c) {
        runs.push(`${side}:${c.id}`);
      },
    };
    return runs;
  };

  it('plays Orders one at a time up to the Order Capability, then ends the Turn', () => {
    const runs = dummy('Recover');
    const hand = cardsWhere(G, { order: 'Recover' }).slice(0, 5);
    const s = build({ axis: { hand, orders: 2 } });
    const r = run(s, (ctx) => turnFlow(s, ctx), script([
      { kind: 'order', card: hand[0], order: 'Recover' },
      { kind: 'order', card: hand[1], order: 'Recover' },
    ]));
    expect(runs).toEqual([`axis:${hand[0]}`, `axis:${hand[1]}`]);
    expect(r.decisions.filter((d) => d.kind === 'turn')).toHaveLength(2); // no third: the capability is used up
    expect((r.decisions[1] as Extract<Decision, { kind: 'turn' }>).canPass).toBe(false);
    expect(s.players.axis.discards).toEqual(hand.slice(0, 2));
    expect(s.players.axis.hand).toHaveLength(5); // refilled
    expect(r.events.filter((e) => e.kind === 'cardPlayed')).toHaveLength(2);
  });

  it('after an Order the player may end the Turn, but not pass', () => {
    dummy('Recover');
    const hand = cardsWhere(G, { order: 'Recover' }).slice(0, 5);
    const s = build({ axis: { hand, orders: 3 } });
    const r = run(s, (ctx) => turnFlow(s, ctx), script([{ kind: 'order', card: hand[0], order: 'Recover' }, { kind: 'endTurn' }]));
    const d = r.decisions[1] as Extract<Decision, { kind: 'turn' }>;
    expect(answerError(s, d, { kind: 'pass', discard: [] })).toMatch(/only give another or end/);
    expect(r.pending).toBeNull();
    expect(s.turn.ordersGiven).toBe(1);
  });

  it('offers only cards whose Order can be given; Command Confusion never', () => {
    const cc = card(G, { order: 'Command Confusion' });
    const rec = card(G, { order: 'Recover' });
    dummy('Recover');
    const s = build({ axis: { hand: [cc, rec] } });
    const r = run(s, (ctx) => turnFlow(s, ctx), () => undefined);
    expect((r.pending as Extract<Decision, { kind: 'turn' }>).orders).toEqual([{ card: rec, order: 'Recover' }]);
    expect(answerError(s, r.pending!, { kind: 'order', card: cc, order: 'Command Confusion' })).not.toBeNull();
  });

  it('with no Order possible and a Discard Capability of 0 the pass needs no decision', () => {
    const s = build({ axis: { hand: [card(G, { order: 'Command Confusion' })], discard: 0 } });
    const r = run(s, (ctx) => turnFlow(s, ctx), passive);
    expect(r.decisions.filter((d) => d.kind === 'turn')).toHaveLength(0);
    expect(s.turn.passDiscards).toBe(0);
  });
});
