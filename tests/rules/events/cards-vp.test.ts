// Events about hands, VP and Objective chits: Fog of War (§E57), Interrogation (§E61), Battlefield Integrity (§E45),
// Command & Control (§E49), Élan (§E54), Mission Objective (§E65), Reconnaissance (§E67), Strategic Objective (§E74).
import { describe, expect, it } from 'vitest';
import { build, cardsWhere, passive } from '../../support/build';
import { G, US, asked, choices, eventSeq, ofKind, trigger } from './kit';

const usHand = (n: number) => cardsWhere(US, { order: 'Move' }).slice(0, n);
const deHand = (n: number) => cardsWhere(G, { order: 'Move' }).slice(0, n);

describe('Fog of War (§E57)', () => {
  it('one random card of each hand goes to its owner\'s discard pile; replays pick the same', () => {
    const make = () => build({ seed: 7, axis: { hand: deHand(3), top: eventSeq(G, 'Fog of War', []) }, allied: { hand: usHand(2) } });
    const s = make();
    const r = trigger(s, 'axis', passive);
    expect(r.decisions).toEqual([]);
    expect(s.players.axis.hand).toHaveLength(2);
    expect(s.players.allied.hand).toHaveLength(1);
    const lost = ofKind(r.events, 'discard');
    expect(lost.map((e) => e.side)).toEqual(['axis', 'allied']);
    expect(s.players.axis.discards.slice(1)).toEqual(lost[0].cards);
    expect(s.players.allied.discards).toEqual(lost[1].cards);
    expect(deHand(3)).toContain(lost[0].cards[0]);
    const t = make();
    trigger(t, 'axis', passive);
    expect(t.players).toEqual(s.players);
  });

  it('an empty hand loses nothing', () => {
    const s = build({ axis: { hand: deHand(2), top: eventSeq(G, 'Fog of War', []) } });
    trigger(s, 'axis', passive);
    expect(s.players.axis.hand).toHaveLength(1);
    expect(s.players.allied.discards).toEqual([]);
  });
});

describe('Interrogation (§E61)', () => {
  it('the receiver sees the opponent\'s hand and may send one of its cards to the opponent\'s discards', () => {
    const hand = usHand(3);
    const s = build({ axis: { top: eventSeq(G, 'Interrogation', []) }, allied: { hand } });
    const r = trigger(s, 'axis', choices({ interrogation: { card: hand[1] } }));
    expect(asked(r.decisions, 'interrogation')[0]).toMatchObject({ side: 'axis', items: hand.map((card) => ({ card })), min: 0, max: 1 });
    expect(s.players.allied.hand).toEqual([hand[0], hand[2]]);
    expect(s.players.allied.discards).toEqual([hand[1]]);
  });

  it('he may keep his hands off; an empty hand: nothing is asked', () => {
    const s = build({ axis: { top: eventSeq(G, 'Interrogation', []) }, allied: { hand: usHand(2) } });
    trigger(s, 'axis', passive);
    expect(s.players.allied.hand).toHaveLength(2);
    const t = build({ axis: { top: eventSeq(G, 'Interrogation', []) } });
    expect(trigger(t, 'axis', passive).decisions).toEqual([]);
  });
});

describe('VP Events (§E45, §E49, §E54)', () => {
  it('Battlefield Integrity: 1 VP per enemy unit on the Casualty Track', () => {
    const s = build({
      axis: { top: eventSeq(G, 'Battlefield Integrity', []) },
      pieces: [{ type: 'American/Line Squad', where: 'casualty' }, { type: 'American/Sgt Smith', where: 'casualty' }, { type: 'German/Rifle Squad', where: 'casualty' }],
    });
    trigger(s, 'axis', passive);
    expect(s.vp).toBe(2);
  });

  it('Command & Control: 1 VP per Objective he controls', () => {
    const s = build({ control: ['allied', 'allied', 'axis', null, 'allied'], allied: { top: eventSeq(US, 'Command & Control', []) } });
    trigger(s, 'allied', passive);
    expect(s.vp).toBe(-3);
  });

  it('Élan: his Surrender marker moves one space higher', () => {
    const s = build({ axis: { surrender: 4, top: eventSeq(G, 'Elan', []) } });
    trigger(s, 'axis', passive);
    expect(s.players.axis.surrender).toBe(5);
    expect(s.players.allied.surrender).toBe(6);
  });
});

describe('Objective chit Events (§E65, §E67, §E74)', () => {
  it('Mission Objective: a random chit as an extra secret one; one without a secret side goes open and scores', () => {
    const s = build({ axis: { secretChits: ['C'], top: eventSeq(G, 'Mission Objective', []) } });
    s.chitCup = ['K', 'A'];
    trigger(s, 'axis', passive);
    expect(s.players.axis.secretChits).toEqual(['C', 'K']);
    expect(s.vp).toBe(0);
    const t = build({ control: [null, null, null, null, 'axis'], axis: { top: eventSeq(G, 'Mission Objective', []) } });
    t.chitCup = ['R'];
    trigger(t, 'axis', passive);
    expect(t.openChits).toEqual(['R']);
    expect(t.vp).toBe(10);
  });

  it('Strategic Objective: a random chit placed open, scored at once for the current controllers', () => {
    const s = build({ control: [null, 'allied', null, null, null], axis: { top: eventSeq(G, 'Strategic Objective', []) } });
    s.chitCup = ['F', 'A'];
    trigger(s, 'axis', passive);
    expect(s.openChits).toEqual(['F']);
    expect(s.vp).toBe(-2);
  });

  it('an empty cup: nothing', () => {
    for (const event of ['Mission Objective', 'Strategic Objective'] as const) {
      const s = build({ axis: { top: eventSeq(G, event, []) } });
      s.chitCup = [];
      trigger(s, 'axis', passive);
      expect([s.openChits, s.players.axis.secretChits]).toEqual([[], []]);
    }
  });

  it('Reconnaissance: the opponent reveals the secret chit of his choice; it scores for the controller', () => {
    const s = build({ control: [null, null, 'axis', null, null], allied: { secretChits: ['C', 'K'] }, axis: { top: eventSeq(G, 'Reconnaissance', []) } });
    const r = trigger(s, 'axis', choices({ reconnaissance: { chit: 'K' } }));
    expect(asked(r.decisions, 'reconnaissance')[0]).toMatchObject({ side: 'allied', min: 1, max: 1 });
    expect(s.players.allied.secretChits).toEqual(['C']);
    expect(s.openChits).toEqual(['K']);
    expect(s.vp).toBe(3); // the Allied chit pays the Axis, who holds Objective 3
  });

  it('Reconnaissance: no secret chit, nothing; one, no question', () => {
    const s = build({ axis: { top: eventSeq(G, 'Reconnaissance', []) } });
    expect(trigger(s, 'axis', passive).decisions).toEqual([]);
    const t = build({ allied: { secretChits: ['A'] }, axis: { top: eventSeq(G, 'Reconnaissance', []) } });
    expect(trigger(t, 'axis', passive).decisions).toEqual([]);
    expect(t.openChits).toEqual(['A']);
  });
});
