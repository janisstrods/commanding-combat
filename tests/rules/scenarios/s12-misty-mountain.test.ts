// Scenario 12, Misty Mountain (scenarios-reference §3): SSR 1 the Time space 7 group may enter at road hex A9, SSR 2 Caves
// (the Axis Sniper reaches 2 hexes), SSR 3 Fog (Hindrance 3 everywhere, added to the others, thinned by each Breeze).
import { describe, expect, it } from 'vitest';
import { advanceTime, deeper, eventTrigger, sniper } from '../../../src/engine/deck';
import { attackFp, fireAttack } from '../../../src/engine/fire';
import { resolveMelees } from '../../../src/engine/flow';
import { neighbours, parseHex, rowOf } from '../../../src/engine/hex';
import { losCheck } from '../../../src/engine/los';
import { redact } from '../../../src/engine/state';
import type { Decision, GameEvent } from '../../../src/engine/types';
import { H, build, card, passive, rolls, run, type Responder } from '../../support/build';
import { setUp, special } from './kit';

const G = 'German';
const A = 'American';
type ChooseD = Extract<Decision, { kind: 'choose' }>;
type DeployD = Extract<Decision, { kind: 'deploy' }>;

describe('scenario 12 Misty Mountain', () => {
  it('SSR 1: the Time space 7 group may enter in or next to road hex A9 as well as along the Allied edge', () => {
    const { s } = setUp('12', 1);
    expect(s.time).toBe(4);
    const offered: DeployD[] = [];
    const watch: Responder = (d, st) => {
      if (d.kind === 'deploy') offered.push(d);
      return passive(d, st);
    };
    for (let t = 4; t < 7; t++) run(s, (ctx) => advanceTime(s, ctx, 'allied'), watch);
    expect(s.time).toBe(7);
    expect(offered.length).toBeGreaterThan(0);
    const a9 = parseHex('A9');
    for (const h of [a9, ...neighbours(a9)]) if (s.map.terrain[h] !== 'Water') expect(offered[0].hexes).toContain(h);
    const near = new Set([a9, ...neighbours(a9)]);
    expect(offered[0].hexes.some((h) => rowOf(h) === 10 && !near.has(h))).toBe(true); // the edge as usual
    const group = Object.values(s.pieces).filter((p) => p.side === 'allied' && (p.type === 'American/Green Squad' || p.type === 'American/Sgt Smith'));
    expect(group).toHaveLength(9);
    expect(group.every((p) => p.where === 'map')).toBe(true);
  });

  it('SSR 1: only that group: other Allied reinforcements still enter along the edge', () => {
    const s = build({ special: special('12'), pieces: [{ type: 'American/Line Squad', where: 'time', space: 5 }], time: 4 });
    const offered: DeployD[] = [];
    run(s, (ctx) => advanceTime(s, ctx, 'allied'), (d, st) => {
      if (d.kind === 'deploy') offered.push(d);
      return passive(d, st);
    });
    expect(offered[0].hexes).not.toContain(parseHex('A9'));
  });

  it('SSR 2 Caves: an Axis Sniper may break an enemy unit up to 2 hexes from the Random Hex', () => {
    const top = card(G, { hex: 'E5' });
    const s = build({
      special: special('12'),
      axis: { top: [top] },
      pieces: [
        { type: 'American/Line Squad', hex: 'E3' }, // p0: 2 hexes away
        { type: 'German/Rifle Squad', hex: 'E7' }, // p1: 2 hexes away, own unit
        { type: 'American/Line Squad', hex: 'E8' }, // p2: 3 hexes away
        { type: 'American/Line Squad', hex: 'E6' }, // p3: adjacent
      ],
    });
    const r = run(s, (ctx) => sniper(s, deeper(ctx), 'axis'), () => undefined);
    const d = r.pending as ChooseD;
    expect(d.reason).toBe('sniperTarget');
    expect(d.items.map((it) => (it as { piece: string }).piece).sort()).toEqual(['p0', 'p3']);
    // the Allied Sniper keeps the usual reach
    const t = build({ special: special('12'), allied: { top: [card(A, { hex: 'E6' })] }, pieces: [{ type: 'German/Rifle Squad', hex: 'E4' }, { type: 'German/Rifle Squad', hex: 'E7' }] });
    const q = run(t, (ctx) => sniper(t, deeper(ctx), 'allied'), () => undefined);
    expect((q.pending as ChooseD).items).toEqual([{ piece: 'p1' }]);
  });

  it('SSR 3 Fog: Hindrance 3 on every line of sight, adjacent ones too, added to the largest other Hindrance', () => {
    const s = build({ special: special('12'), map: { terrain: { E4: 'Orchard' } }, smoke: { H5: 2 } });
    expect(losCheck(s, H('E5'), H('E6')).hindrance).toBe(3);
    expect(losCheck(s, H('E5'), H('E3')).hindrance).toBe(3 + 2); // through the Orchard
    expect(losCheck(s, H('H5'), H('H7')).hindrance).toBe(3 + 2); // out of the Smoke
    expect(losCheck(build({ map: { terrain: { E4: 'Orchard' } } }), H('E5'), H('E3')).hindrance).toBe(2);
    // a Rifle Squad (5 FP) firing at the next hex: 5 − 3
    const f = build({ special: special('12'), pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }, { type: 'American/Line Squad', hex: 'E4' }] });
    expect(attackFp(f, ['p0'], [H('E4')]).fp).toBe(2);
    expect(losCheck(redact(f, 'allied'), H('E5'), H('E6')).hindrance).toBe(3); // the AI's view too
  });

  it('SSR 3 Fog: Ordnance needs it on its Targeting roll too', () => {
    const s = build({
      special: special('12'),
      allied: { top: [card(A, { white: 6, red: 6 })] },
      active: 'allied',
      pieces: [{ type: 'American/Line Squad', hex: 'E8', weapon: 'American/Medium Mortar' }, { type: 'German/Rifle Squad', hex: 'E4' }],
    });
    const r = run(s, (ctx) => fireAttack(s, ctx, 'allied', { pieces: ['p1'], target: H('E4') }, 'order'), passive);
    expect(r.events.find((e) => e.kind === 'targeting')).toMatchObject({ product: 36, need: 4 + 3 + 1, hit: true });
  });

  it('SSR 3 Fog: not in Melee', () => {
    const s = build({
      special: special('12'),
      allied: { top: rolls(A, [6]) },
      axis: { top: rolls(G, [7]) },
      pieces: [
        { type: 'German/Rifle Squad', hex: 'E5' },
        { type: 'American/Line Squad', hex: 'E5' },
        { type: 'German/Rifle Squad', hex: 'L9' },
        { type: 'American/Line Squad', hex: 'L1' },
      ],
    });
    const r = run(s, (ctx) => resolveMelees(s, ctx), passive);
    expect(r.events.find((e): e is Extract<GameEvent, { kind: 'melee' }> => e.kind === 'melee')!.totals).toEqual({ axis: 12, allied: 13 });
  });

  it('SSR 3 Fog: each Breeze Event lowers it by 1, to 2, 1 and then none', () => {
    const cards = [0, 1, 2, 3].reduce<string[]>((acc) => [...acc, card(G, { event: 'Breeze' }, acc)], []);
    const s = build({ special: special('12'), axis: { top: cards } });
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      run(s, (ctx) => eventTrigger(s, deeper(ctx), 'axis'), passive);
      seen.push(losCheck(s, H('E5'), H('E6')).hindrance);
    }
    expect(seen).toEqual([2, 1, 0, 0]);
  });
});
