// Objective control and chits (§7.3, R-31).
import { describe, expect, it } from 'vitest';
import { eliminate } from '../../src/engine/casualties';
import { drawChit, finalScore, objectiveHexes, objectiveValue, relocate, revealChit, updateControl } from '../../src/engine/objectives';
import { H, build, makeCtx, passive, run } from '../support/build';

const map = { objectives: ['C3', 'E5', 'G7', 'J3', 'L5'], building: { G7: 1, G8: 1, H7: 1 } };

describe('control (§7.3.1)', () => {
  it('flips the moment a unit enters an Objective without enemy units, and stays after it leaves (R-31)', () => {
    const s = build({ map, pieces: [{ type: 'German/Rifle Squad', hex: 'E6' }] });
    const events: never[] = [];
    const ctx = makeCtx(events);
    relocate(s, ctx, 'p0', H('E5'));
    expect(s.control[1]).toBe('axis');
    expect(events).toContainEqual({ kind: 'control', objective: 2, side: 'axis' });
    relocate(s, ctx, 'p0', H('E4'));
    expect(s.control[1]).toBe('axis');
  });

  it('does not flip while an enemy unit is there; does when the enemy is eliminated', () => {
    const s = build({ map, control: [null, 'allied', null, null, null], pieces: [{ type: 'American/Line Squad', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'E5' }, { type: 'American/Line Squad', hex: 'A9' }] });
    updateControl(s, makeCtx([]));
    expect(s.control[1]).toBe('allied');
    run(s, (ctx) => eliminate(s, ctx, 'p0', 'melee'), passive);
    expect(s.control[1]).toBe('axis');
  });

  it('a building Objective is the whole building: a unit anywhere in it, no enemy in any hex of it', () => {
    const s = build({ map, pieces: [{ type: 'German/Rifle Squad', hex: 'G6' }, { type: 'American/Line Squad', hex: 'H7' }] });
    expect(objectiveHexes(s, 3).sort()).toEqual([H('G7'), H('G8'), H('H7')].sort());
    const ctx = makeCtx([]);
    relocate(s, ctx, 'p0', H('G8'));
    expect(s.control[2]).toBeNull();
    relocate(s, ctx, 'p1', H('H8'));
    updateControl(s, ctx, H('G8'));
    expect(s.control[2]).toBe('axis');
  });
});

describe('Objective chits (§7.3.2, §7.3.3)', () => {
  it('open chits swing VP from the old controller to the new one', () => {
    const s = build({ map, openChits: ['F', 'S'], control: [null, 'allied', null, null, null], vp: -3, pieces: [{ type: 'German/Rifle Squad', hex: 'E6' }] });
    expect(objectiveValue(s, 2)).toBe(3); // F: Objective 2 = 2, S: each = 1
    relocate(s, makeCtx([]), 'p0', H('E5'));
    expect(s.vp).toBe(3); // -3 + 3 + 3
  });

  it('secret chits score only when revealed, for the current controller', () => {
    const s = build({ map, axis: { secretChits: ['A'] }, control: ['allied', null, null, null, null] });
    expect(objectiveValue(s, 1)).toBe(0);
    revealChit(s, makeCtx([]), 'axis', 'A');
    expect(s.vp).toBe(-1); // pays the Allies, who control Objective 1
    expect(s.openChits).toEqual(['A']);
    expect(s.players.axis.secretChits).toEqual([]);
  });

  it('a drawn chit without a secret side goes open and scores at once', () => {
    const s = build({ map, control: [null, null, null, null, 'axis'] });
    s.chitCup = ['R', 'B'];
    drawChit(s, makeCtx([]), 'allied', false);
    expect(s.openChits).toEqual(['R']);
    expect(s.vp).toBe(10);
    drawChit(s, makeCtx([]), 'allied', false);
    expect(s.players.allied.secretChits).toEqual(['B']);
  });

  it('the final score reveals every secret chit; 0 VP goes to the Initiative holder', () => {
    const s = build({ map, axis: { secretChits: ['B'] }, allied: { secretChits: ['C'] }, control: [null, 'axis', 'allied', null, null], initiative: 'allied' });
    expect(finalScore(s, makeCtx([]))).toBe('allied');
    expect(s.vp).toBe(0);
    s.vp = 1;
    expect(finalScore(s, makeCtx([]))).toBe('axis');
  });
});
