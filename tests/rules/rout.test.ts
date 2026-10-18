// The Rout Order (§O23, §7.2.2, §1.9.1 rule 1, R-23): activating a player, the Rout rolls by the Order's player, the
// Retreat hex by hex toward the owner's edge, eliminations off the edge and when blocked, Mines, no Wire stop, no Op Fire.
import { afterEach, describe, expect, it } from 'vitest';
import { CARDS } from '../../src/engine/data';
import type { Gen } from '../../src/engine/decisions';
import { turnFlow } from '../../src/engine/flow';
import { edgeDistance, routTargets } from '../../src/engine/orders/rout';
import { EVENTS } from '../../src/engine/registry';
import type { EventName, GameEvent } from '../../src/engine/types';
import { H, build, card, cardsWhere, rolls, start, type BuildSpec, type Stepper } from '../support/build';

const G = 'German';
const A = 'American';
const ROUT = cardsWhere(G, { order: 'Rout' });
const FIRE_A = card(A, { order: 'Fire', fireIsAction: true });

type RevealEvent = Extract<GameEvent, { kind: 'reveal' }>;

const savedE: Partial<typeof EVENTS> = {};
afterEach(() => Object.assign(EVENTS, savedE));

/** The Axis gives a Rout. */
function routing(spec: BuildSpec): Stepper {
  const s = build({ ...spec, axis: { ...spec.axis, hand: [ROUT[0], ...(spec.axis?.hand ?? [])] } });
  return start(s, (ctx) => turnFlow(s, ctx)).answer({ kind: 'order', card: ROUT[0], order: 'Rout' });
}

describe('Rout (§O23)', () => {
  it('activates a player with a broken unit (chosen when both qualify), at most once per player per Turn', () => {
    const f = routing({
      pieces: [{ type: 'German/Rifle Squad', hex: 'E8', broken: true }, { type: 'American/Line Squad', hex: 'E5', broken: true }, { type: 'American/Line Squad', hex: 'L1' }],
      axis: { hand: [ROUT[1], ROUT[2]], top: rolls(G, [3, 3], ROUT) },
    });
    expect(f.pending).toMatchObject({ kind: 'activate', side: 'axis', order: 'Rout', units: [], players: ['axis', 'allied'] });
    f.answer({ kind: 'activatePlayer', player: 'allied' });
    expect(f.s.turn.playerActivations).toEqual(['axis>allied']);
    expect(routTargets(f.s, 'axis')).toEqual(['axis']);
    f.answer({ kind: 'order', card: ROUT[1], order: 'Rout' }); // only himself is left: no question
    expect(f.s.turn.playerActivations).toEqual(['axis>allied', 'axis>axis']);
    expect(routTargets(f.s, 'axis')).toEqual([]);
  });

  it('the Order\'s player rolls from his deck for each broken unit: < Morale nothing, = Suppressed, > Retreat the difference', () => {
    const f = routing({
      pieces: [
        { type: 'American/Line Squad', hex: 'E5', broken: true }, // p0: broken Morale 8
        { type: 'American/Line Squad', hex: 'H5', broken: true }, // p1
        { type: 'American/Line Squad', hex: 'K5', broken: true }, // p2
        { type: 'American/Line Squad', hex: 'K8' }, // p3: not broken, no roll
        { type: 'German/Rifle Squad', hex: 'E9' },
      ],
      axis: { top: rolls(G, [7, 8, 10], ROUT) },
    });
    expect(f.events.filter((e): e is RevealEvent => e.kind === 'reveal' && e.purpose === 'rout').map((e) => e.side)).toEqual(['axis', 'axis', 'axis']);
    expect([f.s.pieces.p0.suppressed, f.s.pieces.p1.suppressed]).toEqual([false, true]);
    // p2 retreats 2: its owner picks each hex, each one nearer his (top) edge
    expect(f.pending).toMatchObject({ kind: 'choose', side: 'allied', reason: 'retreatStep', items: [{ hex: H('K4') }, { hex: H('L4') }, { hex: H('J4') }] });
    f.answer({ kind: 'choose', items: [0] });
    expect(f.s.pieces.p2.hex).toBe(H('K4'));
    f.answer({ kind: 'choose', items: [0] });
    expect(f.s.pieces.p2.hex).toBe(H('K3'));
    expect(f.events.filter((e) => e.kind === 'retreat')).toHaveLength(2);
  });

  it('a unit in its edge row that must retreat further leaves the map and is eliminated (§7.2.2)', () => {
    const f = routing({
      pieces: [{ type: 'American/Line Squad', hex: 'E1', broken: true }, { type: 'American/Line Squad', hex: 'L1' }],
      axis: { top: rolls(G, [9], ROUT) },
    });
    expect(f.s.pieces.p0.where).toBe('casualty');
    expect(f.s.vp).toBe(2);
  });

  it('is eliminated when the only ways on are into an enemy hex, an impassable hex or across a Cliff (§O23.3.5)', () => {
    const f = routing({
      map: { terrain: { E4: 'Water' }, hexsides: [['E5', 'F4', 'Cliff']] },
      pieces: [{ type: 'American/Line Squad', hex: 'E5', broken: true }, { type: 'American/Line Squad', hex: 'L1' }, { type: 'German/Rifle Squad', hex: 'D4' }],
      axis: { top: rolls(G, [9], ROUT) },
    });
    expect(f.s.pieces.p0.where).toBe('casualty');
  });

  it('Mines attack a retreating unit entering (rolled by its opponent); a tie Suppresses it (R-23)', () => {
    const f = routing({
      map: { terrain: { D4: 'Water', F4: 'Water' } },
      fort: { E4: 'mines' },
      pieces: [{ type: 'American/Line Squad', hex: 'E5', broken: true }, { type: 'American/Line Squad', hex: 'L1' }],
      axis: { top: rolls(G, [9, 5], ROUT) },
      allied: { top: rolls(A, [3]) },
    });
    expect(f.events.find((e) => e.kind === 'fireAttack')).toMatchObject({ side: 'axis', target: H('E4'), total: 11 });
    expect(f.events.find((e) => e.kind === 'defense')).toMatchObject({ unit: 'p0', total: 11, result: 'suppress' });
    expect(f.s.pieces.p0).toMatchObject({ hex: H('E4'), broken: true, suppressed: true });
  });

  it('Wire does not stop a Retreat, and nobody may Op Fire at it', () => {
    const f = routing({
      fort: { E6: 'wire' },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E5', broken: true }, { type: 'American/Line Squad', hex: 'E1' }],
      axis: { top: rolls(G, [9], ROUT) }, // broken Morale 7: retreat 2 toward the bottom edge
      allied: { hand: [FIRE_A] },
    });
    expect(f.s.pieces.p0.hex).toBe(H('E7'));
    expect(f.decisions.some((d) => d.kind === 'react')).toBe(false);
  });

  it('the result is locked in before the roll\'s trigger: a unit the Event rallies still retreats (§1.9.1)', () => {
    const roll = card(G, { trigger: 'Event', white: 3, red: 4 }); // 7 against the Green Team's broken Morale 6
    const next = cardsWhere(G, { trigger: null }).find((c) => !ROUT.includes(c))!;
    const ev: EventName = CARDS[next].event;
    savedE[ev] = EVENTS[ev];
    EVENTS[ev] = function* (st): Gen {
      st.pieces.p0.broken = false; // the Event rallies it
    };
    const f = routing({
      map: { terrain: { D4: 'Water', F4: 'Water' } },
      pieces: [{ type: 'American/Green Team', hex: 'E5', broken: true }, { type: 'American/Line Squad', hex: 'L1' }],
      axis: { top: [roll, next] },
    });
    expect(f.s.pieces.p0).toMatchObject({ broken: false, hex: H('E4') });
  });

  it('edge distance counts the hexes between a hex and the edge', () => {
    expect([edgeDistance(H('E1'), 'top'), edgeDistance(H('E5'), 'top'), edgeDistance(H('E5'), 'bottom'), edgeDistance(H('C5'), 'left'), edgeDistance(H('C5'), 'right')]).toEqual([0, 4, 5, 2, 12]);
  });
});
