// Objective control and chits (§7.3, R-31).
import { describe, expect, it } from 'vitest';
import { eliminate } from '../../src/engine/casualties';
import { drawChit, finalScore, noteSquatters, objectiveHexes, objectiveValue, relocate, revealChit, updateControl } from '../../src/engine/objectives';
import { scenario } from '../../src/engine/data';
import { setupHexes } from '../../src/engine/setup';
import { newGame, typeOf } from '../../src/engine/state';
import { gameFlow, turnFlow } from '../../src/engine/flow';
import { H, build, card, makeCtx, passive, run, start } from '../support/build';

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

describe('leaving a building Objective (§7.3.1.1, found by the fuzzer)', () => {
  // Objective 3 is the building G7-G8-H7: an Axis unit in G8 and an Allied one in H7, Axis control
  const shared = () =>
    build({
      map,
      control: [null, null, 'axis', null, null],
      pieces: [{ type: 'German/Rifle Squad', hex: 'G8' }, { type: 'American/Line Squad', hex: 'H7' }],
      axis: { hand: [card('German', { order: 'Move' })] },
    });

  it('the side left alone in the building takes control when the other leaves it', () => {
    const s = shared();
    relocate(s, makeCtx([]), 'p0', H('F8'));
    expect(s.control[2]).toBe('allied');
  });

  it('also when the unit leaves by a Move', () => {
    const s = shared();
    const f = start(s, (ctx) => turnFlow(s, ctx));
    const c = s.players.axis.hand[0];
    f.answer({ kind: 'order', card: c, order: 'Move' }).answer({ kind: 'activate', units: ['p0'] });
    f.answer({ kind: 'moveStep', units: ['p0'], to: H('G9') });
    expect(s.control[2]).toBe('allied');
  });
});

describe('R-55: units set up in an Objective the other side controls (audit)', () => {
  // Objective 1 is E5, Axis control; an Allied Squad and Team set up in it (squatters)
  const squat = () => {
    const s = build({
      map: { objectives: ['E5', 'B1', 'C1', 'D1', 'E1'] },
      control: ['axis', null, null, null, null],
      openChits: ['A'],
      pieces: [{ type: 'American/Line Squad', hex: 'E5' }, { type: 'American/Line Team', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'J9' }, { type: 'American/Line Squad', hex: 'E7' }],
    });
    noteSquatters(s);
    return s;
  };

  it('one of them walking out does not hand the Objective to the others', () => {
    const s = squat();
    expect(s.squatters).toEqual(['allied', null, null, null, null]);
    relocate(s, makeCtx([]), 'p1', H('E6'));
    expect(s.control[0]).toBe('axis');
  });

  it('nor one of them being eliminated', () => {
    const s = squat();
    run(s, (ctx) => eliminate(s, ctx, 'p1', 'sniper'), passive);
    expect(s.control[0]).toBe('axis');
  });

  it('a unit of theirs entering takes it, and the record is cleared', () => {
    const s = squat();
    relocate(s, makeCtx([]), 'p3', H('E5'));
    expect(s.control[0]).toBe('allied');
    expect(s.vp).toBe(-2); // chit A: Objective 1 = 1 VP swings from the Axis to the Allies
    expect(s.squatters![0]).toBeNull();
  });

  it('set-up records them (scenario 3: German units in the building of Objective 3)', () => {
    const scn = scenario('3');
    const s = newGame(scn, 4);
    const obj3 = objectiveHexes(s, 3);
    const axisArea = new Set(setupHexes(s, 'axis'));
    const inside = obj3.find((h) => axisArea.has(h))!;
    expect(inside).toBeDefined();
    const staged = Object.values(s.pieces).filter((p) => p.side === 'axis' && p.where === 'staging');
    const ids = [staged.find((p) => typeOf(p).kind === 'squad')!.id, staged.find((p) => typeOf(p).kind === 'leader')!.id];
    const placed: string[] = [];
    run(s, (ctx) => gameFlow(s, ctx), (d, st) => {
      if (d.kind === 'deploy' && d.side === 'axis' && placed.length < 2) {
        const id = ids[placed.length];
        placed.push(id);
        return { kind: 'deploy', piece: id, hex: inside };
      }
      if (d.kind === 'turn') return undefined;
      return passive(d, st);
    });
    expect(s.control[2]).toBe('allied');
    expect(s.squatters![2]).toBe('axis');
    run(s, (ctx) => eliminate(s, ctx, ids[0], 'sniper'), passive);
    expect(s.control[2]).toBe('allied');
  });
});
