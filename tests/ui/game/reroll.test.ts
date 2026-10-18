// The Initiative re-roll setting: Always / When it matters (default) / Never. "When it matters" asks only after a roll
// that went against the human in a Fire Attack, Defense, melee, rally / rout or Sudden Death; every other question is
// declined for him.
import { afterEach, describe, expect, it } from 'vitest';
import type { CardId, Decision, GameState, Reveal, Side } from '../../../src/engine/types';
import { loadRerollPolicy, offerReroll, rollAgainst, saveRerollPolicy, type RollContext } from '../../../src/ui/game/reroll';
import { build, cardsWhere } from '../../support/build';
import { dropStorage, stubStorage } from '../../support/storage';

afterEach(dropStorage);

const sum = (n: number): CardId => {
  const c = cardsWhere('German', { sum: n, trigger: null })[0];
  if (!c) throw new Error(`no German card rolls ${n} without a trigger`);
  return c;
};
const rerollOf = (roll: Reveal): Extract<Decision, { kind: 'reroll' }> => ({ kind: 'reroll', side: 'axis', roll });
const id = (s: GameState, type: string) => Object.keys(s.pieces).find((k) => s.pieces[k].type === type)!;

describe('the setting', () => {
  it("defaults to 'When it matters' and is remembered", () => {
    stubStorage();
    expect(loadRerollPolicy()).toBe('matters');
    saveRerollPolicy('never');
    expect(loadRerollPolicy()).toBe('never');
  });

  it('Always asks, Never does not, whatever the roll', () => {
    const s = build({});
    const d = rerollOf({ side: 'axis', card: sum(11), purpose: 'support' });
    expect(offerReroll('always', s, d, 'axis')).toBe(true);
    expect(offerReroll('never', s, d, 'axis')).toBe(false);
    expect(offerReroll('matters', s, d, 'axis')).toBe(false); // a Support Table roll is not one that matters
  });
});

describe('When it matters', () => {
  const human: Side = 'axis';

  it('Defense: asks when the human\'s unit would break or be suppressed, not when it holds', () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'C5' }, { type: 'Russian/Rifle Squad', hex: 'C7' }] });
    const ctx: RollContext = { attack: { side: 'allied', total: 14, targets: [s.pieces[id(s, 'German/Rifle Squad')].hex], pieces: [id(s, 'Russian/Rifle Squad')] } };
    // a German Rifle Squad in Open Ground: Morale 7 (+0 Cover)
    expect(rollAgainst(s, { side: 'axis', card: sum(5), purpose: 'defense' }, human, ctx)).toBe(true); // 12 < 14: breaks
    expect(rollAgainst(s, { side: 'axis', card: sum(7), purpose: 'defense' }, human, ctx)).toBe(true); // 14 = 14: suppressed
    expect(rollAgainst(s, { side: 'axis', card: sum(9), purpose: 'defense' }, human, ctx)).toBe(false); // 16: holds
  });

  it("Defense of the opponent's unit: asks when it holds against the human's attack", () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'C5' }, { type: 'Russian/Rifle Squad', hex: 'C7' }] });
    const ctx: RollContext = { attack: { side: 'axis', total: 13, targets: [s.pieces[id(s, 'Russian/Rifle Squad')].hex], pieces: [id(s, 'German/Rifle Squad')] } };
    expect(rollAgainst(s, { side: 'allied', card: sum(11), purpose: 'defense' }, human, ctx)).toBe(true);
    expect(rollAgainst(s, { side: 'allied', card: sum(3), purpose: 'defense' }, human, ctx)).toBe(false);
  });

  it("Fire Attack: the human's weak roll asks, a strong one does not; the opponent's strong roll asks", () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'C5' }, { type: 'Russian/Rifle Squad', hex: 'C7' }] });
    const g = id(s, 'German/Rifle Squad');
    const r = id(s, 'Russian/Rifle Squad');
    const mine: RollContext = { spec: { side: 'axis', pieces: [g], target: s.pieces[r].hex, bonus: 0 } };
    expect(rollAgainst(s, { side: 'axis', card: sum(3), purpose: 'fireAttack' }, human, mine)).toBe(true);
    expect(rollAgainst(s, { side: 'axis', card: sum(11), purpose: 'fireAttack' }, human, mine)).toBe(false);
    const theirs: RollContext = { spec: { side: 'allied', pieces: [r], target: s.pieces[g].hex, bonus: 0 } };
    expect(rollAgainst(s, { side: 'allied', card: sum(11), purpose: 'fireAttack' }, human, theirs)).toBe(true);
    expect(rollAgainst(s, { side: 'allied', card: sum(3), purpose: 'fireAttack' }, human, theirs)).toBe(false);
  });

  it('Rally: asks when the human\'s broken unit fails to rally, or the opponent\'s rallies', () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'C5', broken: true }] });
    expect(rollAgainst(s, { side: 'axis', card: sum(11), purpose: 'rally' }, human)).toBe(true);
    expect(rollAgainst(s, { side: 'axis', card: sum(3), purpose: 'rally' }, human)).toBe(false);
    const t = build({ pieces: [{ type: 'Russian/Rifle Squad', hex: 'C5', broken: true }] });
    expect(rollAgainst(t, { side: 'allied', card: sum(3), purpose: 'rally' }, human)).toBe(true);
    expect(rollAgainst(t, { side: 'allied', card: sum(11), purpose: 'rally' }, human)).toBe(false);
  });

  it('Rout: asks when the opponent routs the human\'s broken units away', () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'C5', broken: true }] });
    expect(rollAgainst(s, { side: 'allied', card: sum(11), purpose: 'rout' }, human, { routed: 'axis' })).toBe(true);
    expect(rollAgainst(s, { side: 'allied', card: sum(3), purpose: 'rout' }, human, { routed: 'axis' })).toBe(false);
  });

  it('Sudden Death: asks when the battle would end while the human is behind, or go on while he is ahead', () => {
    const behind = build({ time: 9, vp: -3 });
    expect(rollAgainst(behind, { side: 'allied', card: sum(4), purpose: 'suddenDeath' }, human)).toBe(true); // ends, Allies win
    expect(rollAgainst(behind, { side: 'allied', card: sum(11), purpose: 'suddenDeath' }, human)).toBe(false); // goes on
    const ahead = build({ time: 9, vp: 5 });
    expect(rollAgainst(ahead, { side: 'axis', card: sum(4), purpose: 'suddenDeath' }, human)).toBe(false); // ends, Axis win
    expect(rollAgainst(ahead, { side: 'axis', card: sum(11), purpose: 'suddenDeath' }, human)).toBe(true);
  });

  it('Melee: the human\'s low roll and the opponent\'s high roll ask', () => {
    const s = build({});
    expect(rollAgainst(s, { side: 'axis', card: sum(4), purpose: 'melee' }, human)).toBe(true);
    expect(rollAgainst(s, { side: 'axis', card: sum(10), purpose: 'melee' }, human)).toBe(false);
    expect(rollAgainst(s, { side: 'allied', card: sum(10), purpose: 'melee' }, human)).toBe(true);
  });

  it('offerReroll follows rollAgainst', () => {
    const s = build({ time: 9, vp: -3 });
    expect(offerReroll('matters', s, rerollOf({ side: 'allied', card: sum(4), purpose: 'suddenDeath' }), human)).toBe(true);
    expect(offerReroll('matters', s, rerollOf({ side: 'allied', card: sum(11), purpose: 'suddenDeath' }), human)).toBe(false);
  });
});
