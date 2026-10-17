import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '../../src/engine/data';
import { SUMMARIES, summaryOf } from '../../src/scenarios/summaries';

describe('scenario summaries', () => {
  it('has one for each of the twelve scenarios, and no others', () => {
    expect(SCENARIOS).toHaveLength(12);
    for (const s of SCENARIOS) expect(summaryOf(s.id), `scenario ${s.id}`).not.toBeNull();
    expect(Object.keys(SUMMARIES).sort()).toEqual(SCENARIOS.map((s) => s.id).sort());
    expect(summaryOf('rsg')).toBeNull();
  });

  it('gives each a place and date, and one paragraph of a few sentences', () => {
    for (const [id, s] of Object.entries(SUMMARIES)) {
      expect(s.place.length, id).toBeGreaterThan(8);
      expect(s.place, id).toMatch(/19(39|4\d)/);
      expect(s.text.length, id).toBeGreaterThan(250);
      expect(s.text.length, id).toBeLessThan(900);
      expect(s.text, id).not.toMatch(/\n/);
      expect(s.text.split(/[.!?](\s|$)/).filter((x) => x.trim().length > 2).length, id).toBeGreaterThanOrEqual(3);
    }
  });

  it('is written in British spelling', () => {
    for (const [id, s] of Object.entries(SUMMARIES)) {
      expect(s.text, id).not.toMatch(/\b(armor|armored|color|defense|center|maneuver|organize|organized)\b/i);
    }
  });
});
