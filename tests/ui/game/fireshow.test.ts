// The Fire Attack shown step by step (fireShow.ts), driven by the engine's own events: who fires at whom, the FP built
// line by line, the roll and the total, each defender's Morale + Cover, the roll it needs and its result.
import { describe, expect, it } from 'vitest';
import { attackFp, fireAttack } from '../../../src/engine/fire';
import type { CardId, GameEvent, GameState } from '../../../src/engine/types';
import { defenderNeed, facing, fireStep, type FireShow } from '../../../src/ui/game/fireShow';
import { H, build, cardsWhere, run } from '../../support/build';

const roll = (n: number, nation: 'German' | 'Russian' = 'German'): CardId => cardsWhere(nation, { sum: n, trigger: null })[0];
const id = (s: GameState, type: string) => Object.keys(s.pieces).find((k) => s.pieces[k].type === type)!;

/** Run a Fire Attack and fold its events into the show, keeping every intermediate show. */
function play(s: GameState, side: 'axis' | 'allied', pieces: string[], target: string) {
  const shows: (FireShow | null)[] = [];
  let show: FireShow | null = null;
  const events: GameEvent[] = [];
  const res = run(
    s,
    (c) => fireAttack(s, { ...c, emit: (e) => { events.push(e); show = fireStep(show, e, s); shows.push(show); c.emit(e); } }, side, { pieces, target: H(target) }, 'order'),
    (d) => (d.kind === 'reroll' ? { kind: 'reroll', yes: false } : d.kind === 'choose' ? { kind: 'choose', items: [0] } : { kind: 'done' }),
  );
  expect(res.invalid).toEqual([]);
  return { shows, events, last: shows[shows.length - 1] };
}

describe('the Fire Attack shown step by step', () => {
  it('a Fire Group with a Leader and a Weapon: the FP lines, the roll, the total, each defender and its result', () => {
    const s = build({
      pieces: [
        { type: 'German/Rifle Squad', hex: 'C5', weapon: 'German/LMG' },
        { type: 'German/Lt Bolter', hex: 'C5' },
        { type: 'German/Rifle Squad', hex: 'D5' },
        { type: 'Russian/Rifle Squad', hex: 'C7' },
        { type: 'Russian/Rifle Squad', hex: 'C7' },
      ],
      allied: { nation: 'Russian', top: [roll(9, 'Russian'), roll(3, 'Russian')] },
      axis: { top: [roll(6)] },
    });
    const [sq1, sq2] = Object.keys(s.pieces).filter((k) => s.pieces[k].type === 'German/Rifle Squad');
    const pieces = [sq1, id(s, 'German/LMG'), id(s, 'German/Lt Bolter'), sq2];
    const fp = attackFp(s, pieces, [H('C7')]).fp;
    const { shows, last } = play(s, 'axis', pieces, 'C7');
    const stages = [...new Set(shows.map((x) => x?.stage))];
    expect(stages).toEqual(['aim', 'power', 'roll', 'total', 'defense', 'done']);
    const aim = shows.find((x) => x?.stage === 'aim')!;
    expect(aim.from.sort()).toEqual([H('C5'), H('D5')].sort());
    expect(aim.targets).toEqual([H('C7')]);
    const show = last!;
    // the best piece first (its FP includes the Leader's Command), +1 for each other piece, then the sum
    const labels = show.lines.map((l) => `${l.label} ${l.value}`);
    expect(show.lines[0].kind).toBe('base');
    expect(show.lines[0].note).toMatch(/Leader 1/);
    expect(show.lines.filter((l) => l.value === '+1')).toHaveLength(3);
    expect(labels[labels.length - 1]).toBe(`Firepower ${fp}`);
    expect(show.roll?.value).toBe(6);
    expect(show.total).toBe(fp + 6);
    expect(show.defenders).toHaveLength(2);
    for (const d of show.defenders) {
      expect(d.morale).not.toBeNull();
      expect(d.against).toBe(fp + 6);
      expect(d.result).not.toBeNull();
      expect(defenderNeed(show, d)).toBe(fp + 6 - (d.morale! + d.cover!) + 1);
    }
    // the first defender rolled 9, the second 3 (in the order the engine rolled them)
    expect(show.defenders.map((d) => d.roll?.value)).toEqual([9, 3]);
  });

  it('before the defenders roll, the roll they need is shown against the total if the roll is kept', () => {
    const s = build({
      pieces: [{ type: 'Russian/Rifle Squad', hex: 'C5' }, { type: 'German/Rifle Squad', hex: 'C7' }],
      allied: { nation: 'Russian', top: [roll(5, 'Russian')] },
      axis: { top: [roll(8)] },
    });
    const { shows } = play(s, 'allied', [id(s, 'Russian/Rifle Squad')], 'C7');
    const atRoll = shows.find((x) => x?.stage === 'roll')!;
    expect(atRoll.total).toBeNull();
    const d = atRoll.defenders[0];
    expect(facing(atRoll)).toBe(atRoll.fp! + 5);
    expect(defenderNeed(atRoll, d)).toBe(atRoll.fp! + 5 - (d.morale! + d.cover!) + 1);
  });

  it('the show closes when play moves on, and a new attack replaces it', () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'C5' }] });
    const start = fireStep(null, { kind: 'fireAt', side: 'axis', pieces: [id(s, 'German/Rifle Squad')], target: H('C7'), mode: 'opFire' }, s)!;
    expect(start.title).toBe('Op Fire');
    expect(fireStep(start, { kind: 'move', units: [], from: 1, to: 2, mp: 1 }, s)).toBeNull();
    expect(fireStep(start, { kind: 'cardPlayed', side: 'allied', card: 'R-01', as: 'order', name: 'Move' }, s)).toBeNull();
    expect(fireStep(start, { kind: 'log', text: 'anything' }, s)).toBe(start);
    const next = fireStep(start, { kind: 'fireAt', side: 'axis', pieces: [], target: H('C8'), mode: 'order' }, s)!;
    expect(next.id).not.toBe(start.id);
  });

  it('a Targeting miss ends the show', () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'C5' }] });
    const start = fireStep(null, { kind: 'fireAt', side: 'axis', pieces: [], target: H('C9'), mode: 'order' }, s)!;
    const miss = fireStep(start, { kind: 'targeting', side: 'axis', piece: 'p0', target: H('C9'), product: 2, need: 5, hit: false }, s)!;
    expect(miss.stage).toBe('done');
    expect(miss.note).toBe('Missed');
  });
});
