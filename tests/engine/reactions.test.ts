// Reaction windows (§A24.2, R-02, R-12): asked only when a player has something to play; inactive player first and
// fully; one round.
import { afterEach, describe, expect, it } from 'vitest';
import { window } from '../../src/engine/reactions';
import { ACTIONS } from '../../src/engine/registry';
import type { ActionName, Decision } from '../../src/engine/types';
import { build, card, passive, run, script } from '../support/build';

const saved: Partial<typeof ACTIONS> = {};
afterEach(() => Object.assign(ACTIONS, saved));

/** A test Action in window 'beforeMelee' that every card named `action` in hand may play; records each play. */
function testAction(action: ActionName, log: string[]) {
  saved[action] = ACTIONS[action];
  ACTIONS[action] = {
    windows: ['beforeMelee'],
    options: (s, side) => s.players[side].hand.filter((c) => c.startsWith(`${side}:${action}:`)).map((c) => ({ card: c, action })),
    *run(_s, _ctx, side, opt) {
      log.push(`${side} ${opt.card}`);
    },
  };
}

describe('reaction windows', () => {
  it('with no playable option nobody is asked', () => {
    const s = build({ axis: { hand: [card('German', { action: 'Ambush' })] } });
    const r = run(s, (ctx) => window(s, ctx, 'afterMelee', { hex: 44 }), () => undefined);
    expect(r.decisions).toEqual([]);
    expect(r.pending).toBeNull();
  });

  it('the inactive player plays all he wants first, then the active player; one round only', () => {
    const log: string[] = [];
    testAction('Ambush', log);
    const s = build({
      active: 'axis',
      axis: { hand: ['axis:Ambush:1', 'axis:Ambush:2'] },
      allied: { hand: ['allied:Ambush:1', 'allied:Ambush:2'] },
    });
    const r = run(s, (ctx) => window(s, ctx, 'beforeMelee', { hex: 44 }), script([
      { kind: 'play', option: 0 }, // allied plays one
      { kind: 'play', option: 0 }, // allied plays the other
      { kind: 'play', option: 1 }, // axis plays his second
    ]));
    const asked = r.decisions.map((d) => (d as Extract<Decision, { kind: 'react' }>).side);
    // allied asked thrice (two plays, then he has none left: not asked), axis twice (one play, then passes)
    expect(asked).toEqual(['allied', 'allied', 'axis', 'axis']);
    expect(log).toEqual(['allied allied:Ambush:1', 'allied allied:Ambush:2', 'axis axis:Ambush:2']);
    expect(s.players.allied.discards).toEqual(['allied:Ambush:1', 'allied:Ambush:2']);
    expect(s.players.axis.hand).toEqual(['axis:Ambush:1']);
    expect(r.events.filter((e) => e.kind === 'cardPlayed')).toHaveLength(3);
  });

  it('a pass ends that player\'s part; the inactive player is not asked again after the active one plays (R-12)', () => {
    const log: string[] = [];
    testAction('Ambush', log);
    const s = build({ active: 'axis', axis: { hand: ['axis:Ambush:1'] }, allied: { hand: ['allied:Ambush:1'] } });
    const r = run(s, (ctx) => window(s, ctx, 'beforeMelee', {}), (d, st) => {
      if (d.kind === 'react' && d.side === 'axis') return { kind: 'play', option: 0 };
      return passive(d, st);
    });
    expect(r.decisions.map((d) => d.side)).toEqual(['allied', 'axis']);
    expect(log).toEqual(['axis axis:Ambush:1']);
  });
});
