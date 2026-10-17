// cloneState is a deep copy of everything that changes; redact hides what the viewer may not know (spec: hidden
// information; plan Review Focus 3).
import { describe, expect, it } from 'vitest';
import { gameFlow } from '../../src/engine/flow';
import { cloneState, newGame, redact } from '../../src/engine/state';
import { UNKNOWN_CARD, UNKNOWN_CHIT } from '../../src/engine/types';
import { build, card, cardsWhere, makeMap, passive, run, testScenario } from '../support/build';

describe('cloneState', () => {
  it('copies every mutable part and shares the scenario and the map', () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'E5', weapon: 'German/LMG' }], axis: { hand: [card('German', { order: 'Fire' })] } });
    s.turn.move = { spent: { p0: 1 }, road: [], done: [], group: ['p0'], entered: true };
    const c = cloneState(s);
    expect(c).toEqual(s);
    expect(c.scenario).toBe(s.scenario);
    expect(c.map).toBe(s.map);
    c.pieces.p0.hex = 1;
    c.players.axis.hand.pop();
    c.players.axis.deck.shift();
    c.turn.activated.push('p0');
    c.turn.move!.spent.p0 = 3;
    c.turn.move!.group!.push('x');
    c.fort[3] = 'wire';
    c.smoke[3] = 2;
    c.control[0] = 'axis';
    expect(s.pieces.p0.hex).toBe(44);
    expect(s.players.axis.hand).toHaveLength(1);
    expect(s.players.axis.deck).toHaveLength(71);
    expect(s.turn.activated).toEqual([]);
    expect(s.turn.move).toEqual({ spent: { p0: 1 }, road: [], done: [], group: ['p0'], entered: true });
    expect([s.fort[3], s.smoke[3], s.control[0]]).toEqual([null, 0, null]);
  });
});

describe('redact', () => {
  const s = build({
    axis: { hand: cardsWhere('German', { order: 'Fire' }).slice(0, 4), secretChits: ['A'] },
    allied: { hand: cardsWhere('American', { order: 'Move' }).slice(0, 3), secretChits: ['K'] },
  });

  it('hides the opponent\'s hand, both draw piles, the cup and the opponent\'s secret chits; keeps the counts', () => {
    const r = redact(s, 'axis');
    expect(r.players.axis.hand).toEqual(s.players.axis.hand);
    expect(r.players.allied.hand).toEqual([UNKNOWN_CARD, UNKNOWN_CARD, UNKNOWN_CARD]);
    expect(r.players.axis.deck.every((c) => c === UNKNOWN_CARD)).toBe(true);
    expect(r.players.allied.deck).toHaveLength(s.players.allied.deck.length);
    expect(r.players.allied.deck.every((c) => c === UNKNOWN_CARD)).toBe(true);
    expect(r.players.axis.secretChits).toEqual(['A']);
    expect(r.players.allied.secretChits).toEqual([UNKNOWN_CHIT]);
    expect(r.chitCup.every((c) => c === UNKNOWN_CHIT)).toBe(true);
    expect(r.chitCup).toHaveLength(s.chitCup.length);
    expect(r.rng).toBe(0);
  });

  it('lists the unseen pools sorted (their order tells nothing)', () => {
    const r = redact(s, 'axis');
    expect(r.unseen!.cards.axis).toEqual([...s.players.axis.deck].sort());
    expect(r.unseen!.cards.allied).toEqual([...s.players.allied.deck, ...s.players.allied.hand].sort());
    expect(r.unseen!.chits).toEqual([...s.chitCup, 'K'].sort());
    expect(r.smokeCup).toEqual([...s.smokeCup].sort((a, b) => a - b));
  });

  it('contains no card of the opponent\'s hand or any draw-pile order anywhere', () => {
    const r = redact(s, 'axis');
    const text = JSON.stringify({ ...r, unseen: undefined });
    for (const c of s.players.allied.hand) expect(text).not.toContain(`"${c}"`);
    for (const c of s.players.axis.deck) expect(text).not.toContain(`"${c}"`);
    expect(text).not.toContain('"K"');
  });

  it('a simultaneous hidden set-up hides the opponent\'s deployed pieces', () => {
    const scn = testScenario({ special: { simultaneousSetup: true } });
    scn.sides.axis.forces = { 'German/Rifle Squad': 2 };
    scn.sides.allied.forces = { 'American/Line Squad': 2 };
    scn.setupFirst = 'axis';
    const g = newGame(scn, 1, makeMap());
    const r = run(g, (ctx) => gameFlow(g, ctx), (d, st) => (d.kind === 'deploy' && d.side === 'allied' ? undefined : passive(d, st)));
    expect(r.pending).toMatchObject({ kind: 'deploy', side: 'allied' });
    const view = redact(g, 'allied');
    expect(Object.values(view.pieces).filter((p) => p.side === 'axis').every((p) => p.where === 'staging' && p.hex === -1)).toBe(true);
    expect(Object.values(redact(g, 'axis').pieces).filter((p) => p.side === 'axis').every((p) => p.where === 'map')).toBe(true);
  });
});
