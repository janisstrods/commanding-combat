// Scenario 9, Rush to Contact (scenarios-reference §3): SSR 1–6 reinforcements by Time space, SSR 7 the Mines (8 FP, or
// 7 FP and card G-32 in the opening hand).
import { describe, expect, it } from 'vitest';
import { advanceTime } from '../../../src/engine/deck';
import { mineStrength } from '../../../src/engine/forts';
import { rowOf } from '../../../src/engine/hex';
import { radioOf } from '../../../src/engine/state';
import type { Decision } from '../../../src/engine/types';
import { passive, run, type Responder } from '../../support/build';
import { setUp } from './kit';

type ChooseD = Extract<Decision, { kind: 'choose' }>;
const option = (r: { decisions: Decision[] }) => r.decisions.find((d): d is ChooseD => d.kind === 'choose' && d.reason === 'scenarioOption');

describe('scenario 9 Rush to Contact', () => {
  it('SSR 7: before his opening draw the Axis is offered the Mines option; keeping it, his Mines are 8 FP', () => {
    let hands = -1;
    const watch: Responder = (d, s) => {
      if (d.kind === 'choose' && d.reason === 'scenarioOption') hands = s.players.axis.hand.length + s.players.allied.hand.length;
      return passive(d, s);
    };
    const { s, r } = setUp('9', 1, watch);
    const d = option(r)!;
    expect(d).toMatchObject({ side: 'axis', min: 1, max: 1 });
    expect(d.items).toHaveLength(2);
    // asked after the set-up and before any hand is dealt
    expect(r.decisions.indexOf(d)).toBeGreaterThan(r.decisions.map((x) => x.kind).lastIndexOf('deploy'));
    expect(hands).toBe(0);
    expect(s.players.axis.minefield).toBe(8);
    expect(mineStrength(s)).toBe(8);
    expect(s.players.axis.hand).toHaveLength(4);
  });

  it('SSR 7: taking it, his Mines become 7 FP and card G-32 starts in his 4-card hand', () => {
    const take: Responder = (d, s) => (d.kind === 'choose' && d.reason === 'scenarioOption' ? { kind: 'choose', items: [1] } : passive(d, s));
    for (const seed of [2, 3]) {
      const { s } = setUp('9', seed, take);
      expect(mineStrength(s)).toBe(7);
      expect(s.players.axis.hand).toContain('G-32');
      expect(s.players.axis.hand).toHaveLength(4);
      expect(s.players.axis.deck).not.toContain('G-32');
    }
  });

  it('SSR 1–6: the reinforcements arrive on their Time spaces (Axis edge on 3, the Allied Radio on 6)', () => {
    const { s } = setUp('9', 4);
    expect(s.time).toBe(2);
    const axis3 = Object.values(s.pieces).filter((p) => p.side === 'axis' && p.where === 'time' && p.space === 3);
    expect(axis3.map((p) => p.type).filter((t) => !t.includes('MG') && !t.includes('LMG')).sort()).toEqual([
      'German/Cpt Wehling', 'German/Sgt Biermann', 'German/Sgt Esser',
      ...Array(8).fill('German/Volksgrenadier Squad'), 'German/Weapon Team', 'German/Weapon Team',
    ].sort());
    run(s, (ctx) => advanceTime(s, ctx, 'axis'), passive);
    for (const p of axis3) {
      if (p.where === 'carried') continue;
      expect(p.where, p.type).toBe('map');
      expect(rowOf(p.hex)).toBe(10);
    }
    expect(radioOf(s, 'allied')).toBeNull();
    for (let t = s.time; t < 6; t++) run(s, (ctx) => advanceTime(s, ctx, 'allied'), passive);
    expect(radioOf(s, 'allied')?.type).toBe('American/Radio:105mm');
  });
});
