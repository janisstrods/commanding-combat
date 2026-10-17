// Fate decks (src/data/cards.json via src/engine/data.ts) checked against the rules reference: §1.8, §1.9, §1.9.1 and
// the Order / Action / Event mix tables of Parts C, D and E.
import { describe, expect, it } from 'vitest';
import { CARDS, deckOf } from '../../src/engine/data';
import { rowOf } from '../../src/engine/hex';
import type { ActionName, EventName, FateCard, Nation, OrderName } from '../../src/engine/types';

const NATIONS: Nation[] = ['German', 'American', 'Russian'];
const PREFIX: Record<Nation, string> = { German: 'G', American: 'A', Russian: 'R' };
const deck = (n: Nation): FateCard[] => deckOf(n).map((id) => CARDS[id]);

function count<T extends string>(cards: FateCard[], key: (c: FateCard) => T | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of cards) {
    const k = key(c);
    if (k !== null) out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

// Rules reference Part C (order mix per deck).
const ORDERS: Record<OrderName, [number, number, number]> = {
  // [German, American, Russian]
  Fire: [18, 20, 18],
  Move: [12, 12, 13],
  Rout: [10, 9, 9],
  Recover: [9, 8, 9],
  'Command Confusion': [8, 7, 8],
  'Artillery Request': [8, 9, 6],
  Advance: [5, 4, 6],
  'Artillery Denied': [2, 3, 3],
};

// Rules reference Part D (action mix per deck, without Op Fire).
const ACTIONS: Partial<Record<ActionName, [number, number, number]>> = {
  Ambush: [6, 6, 6],
  'Assault Fire': [6, 6, 6],
  'Bore Sighting': [1, 1, 1],
  'Command Confusion': [1, 2, 0],
  Concealment: [5, 4, 7],
  Crossfire: [8, 8, 8],
  Demolitions: [1, 1, 1],
  'Dig In': [4, 4, 4],
  'Hand Grenades': [6, 6, 6],
  'Hidden Entrenchments': [2, 3, 2],
  'Hidden Mines': [1, 1, 1],
  'Hidden Pillbox': [1, 0, 1],
  'Hidden Unit': [1, 1, 1],
  'Hidden Wire': [2, 2, 2],
  'Light Wounds': [5, 6, 8],
  Marksmanship: [1, 0, 0],
  'No Quarter': [3, 0, 3],
  'Smoke Grenades': [6, 9, 3],
  'Spray Fire': [6, 6, 6],
  'Sustained Fire': [6, 6, 6],
};

// Rules reference Part E (event mix per deck).
const EVENTS: Record<EventName, [number, number, number]> = {
  'Air Support': [2, 3, 2],
  'Battle Harden': [5, 5, 3],
  'Battlefield Integrity': [2, 2, 2],
  Blaze: [6, 0, 0],
  'Booby Trap': [1, 1, 1],
  Breeze: [6, 6, 6],
  'Command & Control': [2, 2, 2],
  Commissar: [0, 0, 4],
  Cower: [2, 2, 4],
  Deploy: [3, 3, 0],
  Dust: [1, 1, 1],
  Elan: [2, 2, 2],
  Entrench: [0, 0, 4],
  'Field Promotion': [1, 1, 1],
  'Fog of War': [1, 2, 3],
  Hero: [5, 5, 2],
  Infiltration: [1, 0, 2],
  Interdiction: [6, 6, 6],
  Interrogation: [3, 3, 3],
  KIA: [1, 1, 1],
  Malfunction: [1, 1, 1],
  Medic: [1, 1, 1],
  'Mission Objective': [1, 1, 1],
  'Prisoners of War': [2, 2, 4],
  Reconnaissance: [2, 2, 2],
  Reinforcements: [2, 3, 1],
  Rubble: [1, 1, 1],
  Sappers: [2, 2, 2],
  Scrounge: [1, 2, 1],
  'Shell Shock': [1, 1, 1],
  Shellholes: [1, 1, 1],
  'Strategic Objective': [1, 1, 1],
  'Suppressing Fire': [3, 3, 3],
  'Walking Wounded': [3, 3, 3],
  'White Phosphorus': [0, 3, 0],
};

// §1.9.1: Event / Sniper / Jammed / Time per deck.
const TRIGGERS: Record<Nation, Record<string, number>> = {
  German: { Event: 10, Sniper: 7, Jammed: 2, Time: 2 },
  American: { Event: 12, Sniper: 6, Jammed: 2, Time: 2 },
  Russian: { Event: 8, Sniper: 8, Jammed: 4, Time: 2 },
};

const column = (table: Record<string, [number, number, number]>, i: number) =>
  Object.fromEntries(Object.entries(table).filter(([, v]) => v[i] > 0).map(([k, v]) => [k, v[i]]));

describe('Fate decks', () => {
  NATIONS.forEach((nation, i) => {
    describe(nation, () => {
      const cards = deck(nation);

      it('has 72 cards numbered 1..72 with ids <letter>-<nn>', () => {
        expect(cards).toHaveLength(72);
        cards.forEach((c, k) => {
          expect(c.number).toBe(k + 1);
          expect(c.id).toBe(`${PREFIX[nation]}-${String(k + 1).padStart(2, '0')}`);
          expect(c.nation).toBe(nation);
          expect(CARDS[c.id]).toBe(c);
        });
      });

      it('holds every ordered dice pair exactly twice (§1.9)', () => {
        const pairs = count(cards, (c) => `${c.white}-${c.red}`);
        for (let w = 1; w <= 6; w++) for (let r = 1; r <= 6; r++) expect(pairs[`${w}-${r}`], `${w}-${r}`).toBe(2);
      });

      it('has the trigger counts of §1.9.1, Time! on 6-6 and Jammed! on 1-1 (Russia also 1-2)', () => {
        expect(count(cards, (c) => c.trigger)).toEqual(TRIGGERS[nation]);
        expect(cards.filter((c) => c.trigger === 'Time').every((c) => c.white === 6 && c.red === 6)).toBe(true);
        const jammed = cards.filter((c) => c.trigger === 'Jammed').map((c) => `${c.white}-${c.red}`);
        expect(new Set(jammed)).toEqual(new Set(nation === 'Russian' ? ['1-1', '1-2'] : ['1-1']));
      });

      it('has the Order mix of Part C', () => {
        expect(count(cards, (c) => c.order)).toEqual(column(ORDERS, i));
      });

      it('has the Action mix of Part D, plus Op Fire on every Fire Order card', () => {
        expect(count(cards, (c) => c.action)).toEqual(column(ACTIONS as Record<string, [number, number, number]>, i));
        expect(cards.filter((c) => c.fireIsAction).length).toBe(ORDERS.Fire[i]);
        expect(cards.every((c) => c.fireIsAction === (c.order === 'Fire'))).toBe(true);
      });

      it('has the Event mix of Part E', () => {
        expect(count(cards, (c) => c.event)).toEqual(column(EVENTS, i));
      });

      it('marks exactly Bore Sighting and the Hidden actions as scenario-Defender only (§A27, §A35)', () => {
        for (const c of cards) {
          expect(c.defenderOnly, c.id).toBe(c.action === 'Bore Sighting' || c.action.startsWith('Hidden '));
        }
      });

      it('prints a unique Random Hex on every card, odd rows for Germany and even rows otherwise (§1.8)', () => {
        const hexes = cards.map((c) => c.hex);
        expect(new Set(hexes).size).toBe(72);
        for (const h of hexes) {
          expect(Number.isInteger(h) && h >= 0 && h < 150).toBe(true);
          expect(rowOf(h) % 2).toBe(nation === 'German' ? 1 : 0);
        }
      });

      it('prints a wind direction on each Breeze card, each of 1..6 once, and on no other card', () => {
        const breeze = cards.filter((c) => c.event === 'Breeze');
        expect(breeze.map((c) => c.breeze).sort()).toEqual([1, 2, 3, 4, 5, 6]);
        expect(cards.filter((c) => c.event !== 'Breeze').every((c) => c.breeze === null)).toBe(true);
      });
    });
  });

  it('uses the types.ts spellings for every name', () => {
    const all = Object.values(CARDS);
    expect(all).toHaveLength(216);
    const known = {
      orders: new Set(Object.keys(ORDERS)),
      actions: new Set(Object.keys(ACTIONS)),
      events: new Set(Object.keys(EVENTS)),
    };
    for (const c of all) {
      expect(known.orders.has(c.order), c.order).toBe(true);
      expect(known.actions.has(c.action), c.action).toBe(true);
      expect(known.events.has(c.event), c.event).toBe(true);
    }
  });

  it('keeps the scenario special-rule cards where the scenarios reference says (G-65, R-31, G-32)', () => {
    expect(CARDS['G-65']).toMatchObject({ order: 'Fire', action: 'Demolitions', event: 'Prisoners of War' });
    expect(CARDS['R-31']).toMatchObject({ order: 'Artillery Request', action: 'Hidden Unit', event: 'Interdiction' });
    expect(CARDS['G-32']).toMatchObject({ order: 'Artillery Denied', action: 'Hidden Mines', event: 'Interdiction' });
  });
});
