// The Initiative re-roll setting: Always / When it matters (default) / Never. "When it matters" asks only after a roll
// that went against the human so that a re-roll would on average help him (by MATTERS or more); every other question
// is declined for him. One test per roll purpose.
import { afterEach, describe, expect, it } from 'vitest';
import { attackFp, fireAttack } from '../../../src/engine/fire';
import type { CardId, Decision, GameEvent, GameState, Reveal, Side } from '../../../src/engine/types';
import { holdChance } from '../../../src/ui/game/odds';
import {
  contextAfterAnswer, contextAfterEvent, loadRerollPolicy, offerReroll, rollAgainst, rollStakes, saveRerollPolicy, type RollContext,
} from '../../../src/ui/game/reroll';
import { build, cardsWhere, run } from '../../support/build';
import { dropStorage, stubStorage } from '../../support/storage';

afterEach(dropStorage);

const sum = (n: number): CardId => {
  const c = cardsWhere('German', { sum: n, trigger: null })[0];
  if (!c) throw new Error(`no German card rolls ${n} without a trigger`);
  return c;
};
const dice = (white: number, red: number): CardId => {
  // (doubles always carry a trigger: it does not change the judgement)
  const c = cardsWhere('German', { white, red })[0] ?? cardsWhere('German', { white: red, red: white })[0];
  if (!c) throw new Error(`no German card rolls ${white}, ${red}`);
  return c;
};
const rerollOf = (roll: Reveal): Extract<Decision, { kind: 'reroll' }> => ({ kind: 'reroll', side: 'axis', roll });
const id = (s: GameState, type: string) => Object.keys(s.pieces).find((k) => s.pieces[k].type === type)!;
const ids = (s: GameState, type: string) => Object.keys(s.pieces).filter((k) => s.pieces[k].type === type);

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
    expect(offerReroll('matters', s, d, 'axis')).toBe(false);
  });

  it('offerReroll follows rollAgainst', () => {
    const s = build({ time: 9, vp: -3 });
    expect(offerReroll('matters', s, rerollOf({ side: 'allied', card: sum(4), purpose: 'suddenDeath' }), 'axis')).toBe(true);
    expect(offerReroll('matters', s, rerollOf({ side: 'allied', card: sum(11), purpose: 'suddenDeath' }), 'axis')).toBe(false);
  });
});

describe('When it matters: one test per roll purpose', () => {
  const human: Side = 'axis';

  it('fireAttack: asks after the human\'s weak roll and the opponent\'s strong one, never after the opponent\'s low roll', () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'C5' }, { type: 'Russian/Rifle Squad', hex: 'C7' }] });
    const g = id(s, 'German/Rifle Squad');
    const r = id(s, 'Russian/Rifle Squad');
    const mine: RollContext = { spec: { side: 'axis', pieces: [g], target: s.pieces[r].hex, bonus: 0 } };
    expect(rollAgainst(s, { side: 'axis', card: sum(3), purpose: 'fireAttack' }, human, mine)).toBe(true);
    expect(rollAgainst(s, { side: 'axis', card: sum(11), purpose: 'fireAttack' }, human, mine)).toBe(false);
    const theirs: RollContext = { spec: { side: 'allied', pieces: [r], target: s.pieces[g].hex, bonus: 0 } };
    expect(rollAgainst(s, { side: 'allied', card: sum(11), purpose: 'fireAttack' }, human, theirs)).toBe(true);
    expect(rollAgainst(s, { side: 'allied', card: sum(3), purpose: 'fireAttack' }, human, theirs)).toBe(false);
    // without a context the dice alone decide
    expect(rollAgainst(s, { side: 'allied', card: sum(9), purpose: 'fireAttack' }, human)).toBe(true);
    expect(rollAgainst(s, { side: 'allied', card: sum(5), purpose: 'fireAttack' }, human)).toBe(false);
  });

  it('fireAttack (the reported case): a low enemy roll is not asked about although the strong attack still threatens the unit', () => {
    // a big Fire Group (FP 10) against a German Squad in the open: even the opponent's roll of 5 leaves it likely to break
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'C5' }] });
    const g = id(s, 'German/Rifle Squad');
    const ctx: RollContext = { power: { side: 'allied', pieces: [], targets: [s.pieces[g].hex], fp: 10, airburst: 0, defenders: [{ unit: g, morale: 7, cover: 0 }] } };
    expect(holdChance(7, 15)).toBeLessThan(0.5); // what the old judgement saw: a bad outcome for the human
    const st = rollStakes(s, { side: 'allied', card: sum(5), purpose: 'fireAttack' }, human, ctx)!;
    expect(st.reroll).toBeLessThan(st.now); // a re-roll would on average make it worse
    expect(rollAgainst(s, { side: 'allied', card: sum(5), purpose: 'fireAttack' }, human, ctx)).toBe(false);
    expect(rollAgainst(s, { side: 'allied', card: sum(10), purpose: 'fireAttack' }, human, ctx)).toBe(true);
    // the mirror image: the human's high roll of a weak attack on a strong defender is not asked about (a re-roll
    // would on average do worse), and neither is his low roll there (no re-roll would likely change the result)
    const t = build({ pieces: [{ type: 'Russian/Rifle Squad', hex: 'C7' }] });
    const r = id(t, 'Russian/Rifle Squad');
    const weak: RollContext = { power: { side: 'axis', pieces: [], targets: [t.pieces[r].hex], fp: 4, airburst: 0, defenders: [{ unit: r, morale: 7, cover: 4 }] } };
    expect(rollAgainst(t, { side: 'axis', card: sum(10), purpose: 'fireAttack' }, human, weak)).toBe(false);
    expect(rollAgainst(t, { side: 'axis', card: sum(4), purpose: 'fireAttack' }, human, weak)).toBe(false);
    const fair: RollContext = { power: { ...weak.power!, fp: 8, defenders: [{ unit: r, morale: 7, cover: 3 }] } };
    expect(rollAgainst(t, { side: 'axis', card: sum(9), purpose: 'fireAttack' }, human, fair)).toBe(false);
    expect(rollAgainst(t, { side: 'axis', card: sum(4), purpose: 'fireAttack' }, human, fair)).toBe(true);
  });

  it('targeting: asks when the human\'s Ordnance misses or the opponent\'s hits', () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'C5', weapon: 'German/Light Mortar' }, { type: 'Russian/Rifle Squad', hex: 'C9' }] });
    const mortar = id(s, 'German/Light Mortar');
    const target = s.pieces[id(s, 'Russian/Rifle Squad')].hex;
    const ctx: RollContext = { spec: { side: 'axis', pieces: [mortar], target, bonus: 0 } };
    expect(rollAgainst(s, { side: 'axis', card: dice(1, 2), purpose: 'targeting' }, human, ctx)).toBe(true); // 2: a miss
    expect(rollAgainst(s, { side: 'axis', card: dice(6, 5), purpose: 'targeting' }, human, ctx)).toBe(false); // 30: a hit
    expect(rollAgainst(s, { side: 'allied', card: dice(6, 5), purpose: 'targeting' }, human)).toBe(true);
    expect(rollAgainst(s, { side: 'allied', card: dice(1, 2), purpose: 'targeting' }, human)).toBe(false);
  });

  it('defense: asks when the human\'s defending unit breaks or a re-roll would likely lift a Suppressed result, not when it holds', () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'C5' }, { type: 'Russian/Rifle Squad', hex: 'C7' }] });
    const g = id(s, 'German/Rifle Squad');
    // a German Rifle Squad in Open Ground: Morale 7, no Cover
    const at = (attack: number): RollContext => ({ defending: { unit: g, morale: 7, cover: 0, attack, moving: false } });
    expect(rollAgainst(s, { side: 'axis', card: sum(5), purpose: 'defense' }, human, at(14))).toBe(true); // 12 < 14: breaks
    expect(rollAgainst(s, { side: 'axis', card: sum(9), purpose: 'defense' }, human, at(14))).toBe(false); // 16: holds
    expect(rollAgainst(s, { side: 'axis', card: sum(4), purpose: 'defense' }, human, at(11))).toBe(true); // 11 = 11: Suppressed, 5+ holds
    // Suppressed where a re-roll is as likely to break as to hold: not worth the Initiative
    expect(rollAgainst(s, { side: 'axis', card: sum(7), purpose: 'defense' }, human, at(14))).toBe(false);
    // no roll can save it: nothing to ask
    expect(rollAgainst(s, { side: 'axis', card: sum(5), purpose: 'defense' }, human, at(22))).toBe(false);
    // the opponent's unit: asks when it holds against the human's attack
    const r = id(s, 'Russian/Rifle Squad');
    const theirs: RollContext = { defending: { unit: r, morale: 7, cover: 0, attack: 13, moving: false } };
    expect(rollAgainst(s, { side: 'allied', card: sum(11), purpose: 'defense' }, human, theirs)).toBe(true);
    expect(rollAgainst(s, { side: 'allied', card: sum(3), purpose: 'defense' }, human, theirs)).toBe(false);
  });

  it('defense: only the unit rolling counts, not the others in its hex', () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'C5' }, { type: 'German/Rifle Squad', hex: 'C5', broken: true }] });
    const [strong, weak] = ids(s, 'German/Rifle Squad');
    const ctx: RollContext = {
      attack: { side: 'allied', total: 14, targets: [s.pieces[strong].hex], pieces: [] },
      defending: { unit: strong, morale: 7, cover: 0, attack: 14, moving: false },
    };
    // 7 + 9 = 16 holds; the broken Squad would not hold with a 9, but it is not the one rolling
    expect(rollAgainst(s, { side: 'axis', card: sum(9), purpose: 'defense' }, human, ctx)).toBe(false);
    expect(weak).toBeDefined();
  });

  it('melee: the human\'s low roll and the opponent\'s high roll ask', () => {
    const s = build({});
    expect(rollAgainst(s, { side: 'axis', card: sum(4), purpose: 'melee' }, human)).toBe(true);
    expect(rollAgainst(s, { side: 'axis', card: sum(10), purpose: 'melee' }, human)).toBe(false);
    expect(rollAgainst(s, { side: 'allied', card: sum(10), purpose: 'melee' }, human)).toBe(true);
    expect(rollAgainst(s, { side: 'allied', card: sum(4), purpose: 'melee' }, human)).toBe(false);
  });

  it("rally: asks when the human's broken unit fails to rally, or the opponent's rallies", () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'C5', broken: true }] });
    expect(rollAgainst(s, { side: 'axis', card: sum(11), purpose: 'rally' }, human)).toBe(true);
    expect(rollAgainst(s, { side: 'axis', card: sum(3), purpose: 'rally' }, human)).toBe(false);
    const t = build({ pieces: [{ type: 'Russian/Rifle Squad', hex: 'C5', broken: true }] });
    expect(rollAgainst(t, { side: 'allied', card: sum(3), purpose: 'rally' }, human)).toBe(true);
    expect(rollAgainst(t, { side: 'allied', card: sum(11), purpose: 'rally' }, human)).toBe(false);
  });

  it("rout: asks when the opponent routs the human's broken units away", () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'C5', broken: true }] });
    expect(rollAgainst(s, { side: 'allied', card: sum(11), purpose: 'rout' }, human, { routed: 'axis' })).toBe(true);
    expect(rollAgainst(s, { side: 'allied', card: sum(3), purpose: 'rout' }, human, { routed: 'axis' })).toBe(false);
  });

  it('mine: asks when the opponent\'s Mines roll high (or the human\'s roll low)', () => {
    const s = build({});
    expect(rollAgainst(s, { side: 'allied', card: sum(10), purpose: 'mine' }, human)).toBe(true);
    expect(rollAgainst(s, { side: 'allied', card: sum(4), purpose: 'mine' }, human)).toBe(false);
    expect(rollAgainst(s, { side: 'axis', card: sum(4), purpose: 'mine' }, human)).toBe(true);
    expect(rollAgainst(s, { side: 'axis', card: sum(10), purpose: 'mine' }, human)).toBe(false);
  });

  it('impact: asks when the human\'s Artillery Impact roll is low or the opponent\'s high', () => {
    const s = build({});
    expect(rollAgainst(s, { side: 'axis', card: sum(4), purpose: 'impact' }, human)).toBe(true);
    expect(rollAgainst(s, { side: 'axis', card: sum(10), purpose: 'impact' }, human)).toBe(false);
    expect(rollAgainst(s, { side: 'allied', card: sum(10), purpose: 'impact' }, human)).toBe(true);
    expect(rollAgainst(s, { side: 'allied', card: sum(4), purpose: 'impact' }, human)).toBe(false);
  });

  it('accuracy: an Artillery Accuracy roll is never asked about', () => {
    const s = build({});
    expect(rollAgainst(s, { side: 'axis', card: dice(1, 1), purpose: 'accuracy' }, human)).toBe(false);
    expect(rollAgainst(s, { side: 'allied', card: dice(6, 6), purpose: 'accuracy' }, human)).toBe(false);
  });

  it('suddenDeath: asks when the battle would end while the human is behind, or go on while he is ahead', () => {
    const behind = build({ time: 9, vp: -3 });
    expect(rollAgainst(behind, { side: 'allied', card: sum(4), purpose: 'suddenDeath' }, human)).toBe(true); // ends, Allies win
    expect(rollAgainst(behind, { side: 'allied', card: sum(11), purpose: 'suddenDeath' }, human)).toBe(false); // goes on
    const ahead = build({ time: 9, vp: 5 });
    expect(rollAgainst(ahead, { side: 'axis', card: sum(4), purpose: 'suddenDeath' }, human)).toBe(false); // ends, Axis win
    expect(rollAgainst(ahead, { side: 'axis', card: sum(11), purpose: 'suddenDeath' }, human)).toBe(true);
    // level on VP: the Initiative (the human's) wins if it ends now; after a re-roll it would be the opponent's
    const level = build({ time: 9, vp: 0, initiative: 'axis' });
    expect(rollAgainst(level, { side: 'axis', card: sum(4), purpose: 'suddenDeath' }, human)).toBe(false);
  });

  it('support: a Support Table roll is never asked about', () => {
    const s = build({});
    expect(rollAgainst(s, { side: 'axis', card: sum(3), purpose: 'support' }, human)).toBe(false);
    expect(rollAgainst(s, { side: 'allied', card: sum(11), purpose: 'support' }, human)).toBe(false);
  });

  it('eventRoll: a roll inside an Event is never asked about', () => {
    const s = build({});
    expect(rollAgainst(s, { side: 'axis', card: sum(3), purpose: 'eventRoll' }, human)).toBe(false);
    expect(rollAgainst(s, { side: 'allied', card: sum(11), purpose: 'eventRoll' }, human)).toBe(false);
  });
});

describe('the number to hold, from the engine\'s events', () => {
  it('a Fire Attack builds the context the judgement and the prompt use', () => {
    const s = build({
      pieces: [
        { type: 'Russian/Rifle Squad', hex: 'C5' },
        { type: 'German/Rifle Squad', hex: 'C7' },
      ],
      allied: { nation: 'Russian', top: [sum(5)] },
      axis: { top: [sum(4)] },
    });
    const r = id(s, 'Russian/Rifle Squad');
    const g = id(s, 'German/Rifle Squad');
    const fp = attackFp(s, [r], [s.pieces[g].hex]).fp;
    let ctx: RollContext = contextAfterAnswer({}, { kind: 'fire', side: 'allied', pieces: [r], mode: 'order', mustFire: false } as unknown as Decision, {
      kind: 'fire', spec: { pieces: [r], target: s.pieces[g].hex },
    });
    const seen: { kind: string; ctx: RollContext; d?: Decision }[] = [];
    const events: GameEvent[] = [];
    const res = run(
      s,
      (c) => fireAttack(s, { ...c, emit: (e) => { events.push(e); ctx = contextAfterEvent(ctx, e); c.emit(e); } }, 'allied', { pieces: [r], target: s.pieces[g].hex }, 'order'),
      (d) => {
        seen.push({ kind: d.kind, ctx, d });
        return d.kind === 'reroll' ? { kind: 'reroll', yes: false } : { kind: 'done' };
      },
    );
    expect(res.invalid).toEqual([]);
    const power = events.find((e) => e.kind === 'firePower');
    expect(power && power.kind === 'firePower' && power.parts.fp).toBe(fp);
    const atAttackRoll = seen.find((x) => x.d?.kind === 'reroll' && x.d.roll.purpose === 'fireAttack')!;
    expect(atAttackRoll.ctx.power?.fp).toBe(fp);
    expect(atAttackRoll.ctx.power?.defenders.map((d) => d.unit)).toEqual([g]);
    const st = rollStakes(s, (atAttackRoll.d as Extract<Decision, { kind: 'reroll' }>).roll, 'axis', atAttackRoll.ctx)!;
    // the German Squad's Morale + Cover, and the number it must roll to hold against the total
    const base = atAttackRoll.ctx.power!.defenders[0].morale + atAttackRoll.ctx.power!.defenders[0].cover;
    expect(st.lines.join(' ')).toContain(`Attack total ${fp + 5}`);
    expect(st.lines.join(' ')).toContain(`${fp + 5 - base + 1}+ to hold`);
    const atDefense = seen.find((x) => x.d?.kind === 'reroll' && x.d.roll.purpose === 'defense')!;
    expect(atDefense.ctx.defending).toMatchObject({ unit: g, attack: fp + 5, moving: false });
    const def = events.find((e) => e.kind === 'defense');
    const dfd = events.find((e) => e.kind === 'defending');
    expect(def && dfd && def.kind === 'defense' && dfd.kind === 'defending' && def.morale).toBe(dfd && dfd.kind === 'defending' ? dfd.morale + dfd.cover : -1);
  });
});
