// The card texts: one for every Order, Action and Event name, short, our own sentences.
import { describe, expect, it } from 'vitest';
import { CARDS } from '../../src/engine/data';
import { ACTION_TEXT, EVENT_TEXT, ORDER_TEXT } from '../../src/data/card-texts';

const ALL = Object.values(CARDS);
const TABLES = { order: ORDER_TEXT, action: ACTION_TEXT, event: EVENT_TEXT } as Record<string, Record<string, string>>;

describe('card texts', () => {
  it('cover all 8 Orders, 21 Actions and 35 Events', () => {
    expect(Object.keys(ORDER_TEXT)).toHaveLength(8);
    expect(Object.keys(ACTION_TEXT)).toHaveLength(21);
    expect(Object.keys(EVENT_TEXT)).toHaveLength(35);
  });

  it('every name printed on a Fate card has a text (and Op Fire has one)', () => {
    for (const c of ALL) {
      expect(ORDER_TEXT[c.order], c.id).toBeTruthy();
      expect(ACTION_TEXT[c.action], c.id).toBeTruthy();
      expect(EVENT_TEXT[c.event], c.id).toBeTruthy();
    }
    expect(ACTION_TEXT.Fire).toMatch(/Op/);
  });

  it('are short, whole sentences', () => {
    for (const [kind, table] of Object.entries(TABLES)) {
      for (const [name, text] of Object.entries(table)) {
        expect(text.length, `${kind} ${name}`).toBeGreaterThan(15);
        expect(text.length, `${kind} ${name}`).toBeLessThanOrEqual(220);
        expect(text, `${kind} ${name}`).toMatch(/^[A-Z+]/);
        expect(text, `${kind} ${name}`).toMatch(/[.)]$/);
      }
    }
  });

  it('name the defender-only and nation-only limits', () => {
    for (const a of ['Bore Sighting', 'Hidden Entrenchments', 'Hidden Mines', 'Hidden Pillbox', 'Hidden Unit', 'Hidden Wire'] as const)
      expect(ACTION_TEXT[a], a).toMatch(/Defender only/);
    expect(ACTION_TEXT.Marksmanship).toMatch(/German/);
    expect(ACTION_TEXT['No Quarter']).toMatch(/Russian/);
    expect(EVENT_TEXT.Commissar).toMatch(/Russian only/);
    expect(EVENT_TEXT.Entrench).toMatch(/Russian only/);
    expect(EVENT_TEXT['White Phosphorus']).toMatch(/American only/);
  });
});
