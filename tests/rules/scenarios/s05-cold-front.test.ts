// Scenario 5, Cold Front (scenarios-reference §3): SSR 1 chits R, V, X out; SSR 2 Deep Freeze (a random German Weapon
// starts broken; no Fortification enters play); SSR 3 Snow; SSR 4 Winter Camouflage.
import { describe, expect, it } from 'vitest';
import { deeper, eventTrigger } from '../../../src/engine/deck';
import { fireAttack } from '../../../src/engine/fire';
import { loadMap } from '../../../src/engine/data';
import { neighbours, sideTo } from '../../../src/engine/hex';
import { stepCost } from '../../../src/engine/orders/move';
import { optionsFor } from '../../../src/engine/reactions';
import { isWeapon } from '../../../src/engine/state';
import { hexsideFeature, pathBetween } from '../../../src/engine/terrain';
import type { EventName, GameEvent, HexId } from '../../../src/engine/types';
import { H, build, card, passive, rolls, run, script, type BuildSpec } from '../../support/build';
import { setUp, special } from './kit';

const G = 'German';
const R = 'Russian';
type DefenseEvent = Extract<GameEvent, { kind: 'defense' }>;

describe('scenario 5 Cold Front', () => {
  it('SSR 1: chits R, V and X are out of the cup', () => {
    const { s } = setUp('5', 1);
    for (const c of ['R', 'V', 'X']) expect([...s.chitCup, ...s.openChits]).not.toContain(c);
  });

  it('SSR 2 Deep Freeze: exactly one of the four German Weapons starts broken, picked at random', () => {
    const picked = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { s } = setUp('5', seed);
      const weapons = Object.values(s.pieces).filter((p) => p.side === 'axis' && isWeapon(p));
      expect(weapons).toHaveLength(4);
      const broken = weapons.filter((w) => w.broken);
      expect(broken).toHaveLength(1);
      picked.add(broken[0].type);
      expect(Object.values(s.pieces).filter((p) => p.side === 'allied' && p.broken)).toHaveLength(0);
    }
    expect(picked.size).toBeGreaterThan(1);
  });

  it('SSR 2 Deep Freeze: the Actions that would place a Fortification cannot be played', () => {
    const DIG = card(R, { action: 'Dig In' });
    const spec: BuildSpec = { allied: { nation: R, hand: [DIG] }, pieces: [{ type: 'Russian/Guards SMG Squad', hex: 'E5' }] };
    expect(optionsFor(build(spec), 'allied', 'timeAdvanceEnd', {})).toHaveLength(1);
    expect(optionsFor(build({ ...spec, special: special('5') }), 'allied', 'timeAdvanceEnd', {})).toHaveLength(0);
  });

  it('SSR 2 Deep Freeze: the Events that would place a Fortification do nothing', () => {
    for (const event of ['Shellholes', 'Booby Trap', 'Rubble'] as EventName[]) {
      const s = build({ special: special('5'), allied: { nation: R }, axis: { top: [card(G, { event })] }, pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }] });
      const r = run(s, (ctx) => eventTrigger(s, deeper(ctx), 'axis'), passive);
      expect(s.fort.every((f) => f === null), event).toBe(true);
      expect(r.events.some((e) => e.kind === 'reveal' && e.purpose === 'randomHex'), event).toBe(false);
    }
    const s = build({ special: special('5'), allied: { nation: R, top: [card(R, { event: 'Entrench' })] }, pieces: [{ type: 'Russian/Guards SMG Squad', hex: 'E5' }] });
    run(s, (ctx) => eventTrigger(s, deeper(ctx), 'allied'), passive);
    expect(s.fort[H('E5')]).toBeNull();
  });

  it('SSR 3 Snow: Open Ground costs 1½ MP on the winter map', () => {
    const { s } = setUp('5', 2);
    const map = loadMap('5w');
    // a plain step from Open into Open on one level, without a hexside feature or a path
    let pair: [HexId, HexId] | null = null;
    for (let a = 0; a < 150 && !pair; a++) {
      for (const b of neighbours(a)) {
        if (map.terrain[a] === 'Open' && map.terrain[b] === 'Open' && map.elevation[a] === map.elevation[b] && sideTo(a, b)
          && !hexsideFeature(map, a, b) && !pathBetween(map, a, b)) {
          pair = [a, b];
          break;
        }
      }
    }
    expect(pair).not.toBeNull();
    expect(stepCost(s, pair![0], pair![1])).toBe(1.5);
  });

  it('SSR 4 Winter Camouflage: an Allied Concealment takes 2 more off the Axis Attack Total', () => {
    const CO = card(R, { action: 'Concealment' });
    const s = build({
      special: special('5'),
      map: { terrain: { E2: 'Woods' } },
      axis: { top: rolls(G, [8]) },
      allied: { nation: R, hand: [CO], top: rolls(R, [3]) },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }, { type: 'Russian/Guards SMG Squad', hex: 'E2' }],
    });
    const r = run(s, (ctx) => fireAttack(s, ctx, 'axis', { pieces: ['p0'], target: H('E2') }, 'order'), script([{ kind: 'play', option: 0 }]));
    const d = r.events.find((e): e is DefenseEvent => e.kind === 'defense')!;
    // 5 FP + 8 = 13, less Woods Cover 2 (Concealment) and 2 (Winter Camouflage)
    expect(d.attack).toBe(9);
  });
});
