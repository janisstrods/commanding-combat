// The special-rule data of the twelve scenarios refers to real things: counter types in the scenario's forces, cards of
// the side's own deck, hexes on the map, Objective chits; and the briefing names every rule.
import { describe, expect, it } from 'vitest';
import { CARDS, COUNTERS, OBJECTIVE_CHITS, SCENARIOS } from '../../../src/engine/data';
import { parseHex } from '../../../src/engine/hex';
import type { ScenarioDef, Side } from '../../../src/engine/types';

const SIDES: Side[] = ['axis', 'allied'];

/** Counter types of `side` in the scenario: forces and reinforcements. */
function types(scn: ScenarioDef, side: Side): Set<string> {
  const s = scn.sides[side];
  return new Set([...Object.keys(s.forces), ...Object.values(s.reinforcements).flatMap((r) => Object.keys(r))]);
}

describe('scenario special-rule data', () => {
  for (const scn of SCENARIOS) {
    it(`scenario ${scn.id}: names real pieces, cards, hexes and chits`, () => {
      const sp = scn.special;
      for (const side of SIDES) {
        const own = types(scn, side);
        const nation = scn.sides[side].nation;
        const named = [
          ...Object.keys(sp.setupHex?.[side] ?? {}),
          ...(sp.lateSetup?.[side] ?? []),
          ...(sp.latePlacement?.[side] ?? []),
          ...(sp.setupTogether?.[side]?.units ?? []),
          ...(sp.eliminateInsteadOfBreak?.[side] ?? []),
          ...(sp.carried?.[side] ?? []).flatMap((c) => [c.unit, c.weapon]),
        ];
        for (const t of named) expect(own.has(t), `${side} ${t}`).toBe(true);
        for (const c of [...(sp.startingCards?.[side] ?? []), ...(sp.minesForCard?.[side] ? [sp.minesForCard[side]!.card] : [])]) {
          expect(CARDS[c]?.nation, c).toBe(nation);
        }
        for (const h of Object.values(sp.setupHex?.[side] ?? {})) expect(() => parseHex(h)).not.toThrow();
        if (sp.entryHex?.[side]) {
          expect(() => parseHex(sp.entryHex![side]!.hex)).not.toThrow();
          expect(scn.sides[side].reinforcements[sp.entryHex[side]!.space]).toBeDefined();
        }
        const t = sp.setupTogether?.[side];
        if (t) expect(scn.sides[side].fortifications[t.fort]).toBeGreaterThan(0);
      }
      for (const t of [...Object.keys(sp.fixedWeapons ?? {}), ...Object.keys(sp.minTargetCover ?? {})]) {
        expect(COUNTERS[t]?.kind, t).toBe('weapon');
        expect(SIDES.some((side) => types(scn, side).has(t)), t).toBe(true);
      }
      for (const c of sp.excludeChits ?? []) expect(OBJECTIVE_CHITS[c]).toBeDefined();
      // every scenario has a briefing
      expect(sp.notes?.length ?? 0).toBeGreaterThan(0);
    });
  }
});
