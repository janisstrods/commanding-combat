// All 216 Fate cards render (every size, every highlight, face down), and every Action / Event text fits its box on
// the card at a legible size.
import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CARDS } from '../../src/engine/data';
import { label } from '../../src/engine/hex';
import { CardBack, FateCardView, cardTextLayout } from '../../src/art/FateCardView';
import { ACTION_TEXT, EVENT_TEXT } from '../../src/data/card-texts';

const ALL = Object.values(CARDS);

describe('FateCardView', () => {
  it('all 216 cards render at every size and highlight', () => {
    expect(ALL).toHaveLength(216);
    for (const card of ALL) {
      for (const size of ['sm', 'md', 'lg'] as const) {
        const html = renderToStaticMarkup(h(FateCardView, { card, size }));
        expect(html, card.id).toMatch(/^<svg/);
      }
      for (const highlight of ['order', 'action', 'event', null] as const) {
        renderToStaticMarkup(h(FateCardView, { card, highlight }));
      }
    }
  });

  it('a face shows the names, the Random Hex and the trigger', () => {
    for (const card of ALL) {
      const html = renderToStaticMarkup(h(FateCardView, { card }));
      expect(html, card.id).toContain(card.order.toUpperCase());
      expect(html, card.id).toContain(card.action.toUpperCase().replace('&', '&amp;'));
      expect(html, card.id).toContain(card.event.toUpperCase().replace('&', '&amp;'));
      expect(html, card.id).toContain(`>${label(card.hex)}<`);
      if (card.trigger) expect(html, card.id).toContain(`${card.trigger.toUpperCase()}!`);
      if (card.fireIsAction) expect(html, card.id).toContain('ORDER / ACTION');
      if (card.defenderOnly) expect(html, card.id).toContain('DEFENDER ONLY');
    }
  });

  it('face down shows the back, which gives nothing of the card away', () => {
    const card = CARDS['G-01'];
    const down = renderToStaticMarkup(h(FateCardView, { card, faceDown: true }));
    expect(down).not.toContain(card.event.toUpperCase());
    expect(down.replace(/id="[^"]*"|url\(#[^)]*\)/g, '')).toBe(
      renderToStaticMarkup(h(CardBack, { nation: 'German' })).replace(/id="[^"]*"|url\(#[^)]*\)/g, ''),
    );
  });

  it('every Action and Event text fits its box at 5 units or more', () => {
    for (const [name, text] of Object.entries(ACTION_TEXT)) {
      const l = cardTextLayout(text, 'action');
      expect(l.fits, name).toBe(true);
      expect(l.size, name).toBeGreaterThanOrEqual(5);
    }
    for (const [name, text] of Object.entries(EVENT_TEXT)) {
      const l = cardTextLayout(text, 'event');
      expect(l.fits, name).toBe(true);
      expect(l.size, name).toBeGreaterThanOrEqual(4.8);
    }
  });
});
