// Casualties, VP and the end of the game (§3.2, §6.3, §7.1, §7.2, §9.2, R-32, R-40, R-48, R-54).
import { afterEach, describe, expect, it } from 'vitest';
import {
  breakPiece, eliminate, eliminateAll, exitUnits, replaceUnit, simultaneously, unitVp,
} from '../../src/engine/casualties';
import { gameFlow, guard } from '../../src/engine/flow';
import { ACTIONS } from '../../src/engine/registry';
import { GameOver } from '../../src/engine/state';
import { teamFor } from '../../src/engine/data';
import type { Decision, GameState } from '../../src/engine/types';
import { build, passive, run, script, type BuildSpec } from '../support/build';

const over = (s: GameState, f: Parameters<typeof run>[1]) => {
  try {
    run(s, f, passive);
  } catch (e) {
    if (e instanceof GameOver) return { winner: e.winner, reason: e.reason };
    throw e;
  }
  return null;
};

describe('elimination VP (§7.1)', () => {
  it('Squad 2, Team 1, Leader 1 + its unbroken Command, Hero 0', () => {
    const s = build({
      pieces: [
        { type: 'German/Rifle Squad', hex: 'E5' },
        { type: 'German/Line Team', hex: 'E5' },
        { type: 'German/Lt Von Karsties', hex: 'E5', broken: true },
        { type: 'German/Dietel (Hero)', hex: 'E5' },
        { type: 'German/Rifle Squad', hex: 'E6' },
      ],
      allied: { surrender: 10 },
    });
    expect(['p0', 'p1', 'p2', 'p3'].map((id) => unitVp(s.pieces[id]))).toEqual([2, 1, 3, 0]);
    run(s, (ctx) => eliminate(s, ctx, 'p0', 'fire'), passive);
    expect(s.vp).toBe(-2);
    run(s, (ctx) => eliminate(s, ctx, 'p2', 'fire'), passive);
    expect(s.vp).toBe(-5);
    run(s, (ctx) => eliminate(s, ctx, 'p3', 'fire'), passive);
    expect(s.vp).toBe(-5);
    expect(s.players.axis.casualties).toEqual(['p0', 'p2']); // the Hero goes back to the counter mix
    expect(s.pieces.p3.where).toBe('mix');
  });

  it('chit X doubles it', () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'E6' }], openChits: ['X'] });
    run(s, (ctx) => eliminate(s, ctx, 'p0', 'fire'), passive);
    expect(s.vp).toBe(-4);
  });

  it('the Weapon goes to the Weapons box unbroken; markers are lost', () => {
    const s = build({
      pieces: [{ type: 'German/Rifle Squad', hex: 'E5', veteran: true, suppressed: true, weapon: { type: 'German/LMG', broken: true } }, { type: 'German/Rifle Squad', hex: 'E6' }],
    });
    run(s, (ctx) => eliminate(s, ctx, 'p0', 'fire'), passive);
    expect(s.pieces.p1).toMatchObject({ where: 'weaponsBox', broken: false, carrier: null });
    expect(s.pieces.p0).toMatchObject({ where: 'casualty', weapon: null, veteran: false, suppressed: false });
  });
});

describe('breaking (§3.2)', () => {
  it('an unbroken unit breaks; a broken one is eliminated', () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'E6' }] });
    const r1 = run(s, (ctx) => breakPiece(s, ctx, 'p0', 'fire'), passive);
    expect(s.pieces.p0.broken).toBe(true);
    expect(r1.events).toEqual([{ kind: 'break', piece: 'p0' }]);
    run(s, (ctx) => breakPiece(s, ctx, 'p0', 'fire'), passive);
    expect(s.pieces.p0.where).toBe('casualty');
  });

  describe('the Light Wounds window (§A36)', () => {
    const saved = ACTIONS['Light Wounds'];
    afterEach(() => {
      ACTIONS['Light Wounds'] = saved;
    });
    const lw = '??LW';
    const install = () => {
      ACTIONS['Light Wounds'] = {
        windows: ['squadWouldBreak'],
        options: (s, side, _w, info) =>
          info.units && s.pieces[info.units[0]].side === side ? [{ card: lw, action: 'Light Wounds' }] : [],
        *run(s, ctx, side, _o, _a, info) {
          const pl = s.players[side];
          replaceUnit(s, ctx, info.units![0], [teamFor(pl.nation, pl.quality)]);
        },
      };
    };

    it('is offered to the Squad\'s owner the instant it would break; the Team replaces it', () => {
      install();
      const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'E5', weapon: 'German/LMG' }], axis: { hand: [lw] } });
      s.turn.activated.push('p0');
      const r = run(s, (ctx) => breakPiece(s, ctx, 'p0', 'fire'), script([{ kind: 'play', option: 0 }]));
      const d = r.decisions[0] as Extract<Decision, { kind: 'react' }>;
      expect(d).toMatchObject({ kind: 'react', side: 'axis', window: 'squadWouldBreak' });
      expect(s.pieces.p0.where).toBe('mix');
      const team = s.pieces.p2;
      expect(team).toMatchObject({ type: 'German/Line Team', where: 'map', broken: false, weapon: 'p1' });
      expect(s.turn.activated).toEqual(['p2']);
    });

    it('not for Teams or Leaders, nor for eliminations', () => {
      install();
      const s = build({ pieces: [{ type: 'German/Line Team', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'E6' }], axis: { hand: [lw] } });
      const r = run(s, (ctx) => breakPiece(s, ctx, 'p0', 'fire'), passive);
      expect(r.decisions).toEqual([]);
      const r2 = run(s, (ctx) => eliminate(s, ctx, 'p1', 'event'), passive);
      expect(r2.decisions).toEqual([]);
    });
  });
});

describe('surrender and annihilation (§6.3, R-40, R-48)', () => {
  const two: BuildSpec = {
    pieces: [
      { type: 'German/Rifle Squad', hex: 'E5' },
      { type: 'German/Rifle Squad', hex: 'E6' },
      { type: 'German/Rifle Squad', hex: 'E7' },
      { type: 'American/Line Squad', hex: 'G5' },
      { type: 'American/Line Squad', hex: 'G6' },
      { type: 'American/Line Squad', hex: 'G7' },
    ],
    axis: { surrender: 2 },
    allied: { surrender: 2 },
    initiative: 'allied',
  };

  it('a player whose casualties reach his Surrender level loses at once, whatever the VP', () => {
    const s = build({ ...two, vp: 20 });
    run(s, (ctx) => eliminate(s, ctx, 'p0', 'fire'), passive);
    expect(over(s, (ctx) => eliminate(s, ctx, 'p1', 'fire'))).toEqual({ winner: 'allied', reason: 'surrender' });
  });

  it('losing the last unit on the map loses, even with reinforcements to come (R-32)', () => {
    const s = build({
      pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }, { type: 'German/Rifle Squad', where: 'time', space: 4 }, { type: 'American/Line Squad', hex: 'G5' }],
    });
    expect(over(s, (ctx) => eliminate(s, ctx, 'p0', 'fire'))).toEqual({ winner: 'allied', reason: 'annihilation' });
  });

  it('both sides surrendering at once: the Initiative holder wins', () => {
    const s = build(two);
    run(s, (ctx) => eliminate(s, ctx, 'p0', 'fire'), passive);
    run(s, (ctx) => eliminate(s, ctx, 'p3', 'fire'), passive);
    expect(over(s, (ctx) => eliminateAll(s, ctx, ['p1', 'p4'], 'melee'))).toEqual({ winner: 'allied', reason: 'surrender' });
  });

  it('inside `simultaneously` a single loser still loses (judged at the end)', () => {
    const s = build(two);
    run(s, (ctx) => eliminate(s, ctx, 'p0', 'fire'), passive);
    let after = false;
    const res = over(s, (ctx) =>
      simultaneously(s, ctx, function* (c) {
        yield* eliminate(s, c, 'p1', 'fire');
        after = true;
      }),
    );
    expect(after).toBe(true);
    expect(res).toEqual({ winner: 'allied', reason: 'surrender' });
  });

  it('gameFlow records the result and stops', () => {
    const s = build({ ...two, axis: { surrender: 1 } });
    const r = run(s, (ctx) => guard(s, ctx, eliminate(s, ctx, 'p0', 'fire')), passive);
    expect(s).toMatchObject({ winner: 'allied', endReason: 'surrender', phase: 'over' });
    expect(r.events.at(-1)).toEqual({ kind: 'gameOver', winner: 'allied', reason: 'surrender' });
    const r2 = run(s, (ctx) => gameFlow(s, ctx), passive);
    expect(r2.decisions).toEqual([]);
  });

  it('overstacking at the end of the Turn: a free Deploy, then eliminations of the owner\'s choice (they count)', () => {
    const s = build({
      pieces: [
        { type: 'German/Rifle Squad', hex: 'E5' },
        { type: 'German/Rifle Squad', hex: 'E5' },
        { type: 'German/Rifle Squad', hex: 'E6' },
        { type: 'American/Line Squad', hex: 'G5' },
      ],
      axis: { discard: 0 },
    });
    const r = run(s, (ctx) => gameFlow(s, ctx), script([
      { kind: 'choose', items: [0] }, // Deploy p0
      { kind: 'choose', items: [2] }, // eliminate one of the Teams
    ]));
    const reasons = r.decisions.filter((d) => d.kind === 'choose').map((d) => (d as Extract<Decision, { kind: 'choose' }>).reason);
    expect(reasons.slice(0, 2)).toEqual(['overstackDeploy', 'overstackEliminate']);
    const e5 = Object.values(s.pieces).filter((p) => p.where === 'map' && p.hex === 44);
    expect(e5.map((p) => p.type).sort()).toEqual(['German/Line Team', 'German/Rifle Squad']);
    expect(s.vp).toBe(-1);
  });
});

describe('the game ending mid-resolution (plan Review Focus 2)', () => {
  it('an overstack elimination can make the owner surrender: the flow stops, the winner is recorded', () => {
    const s = build({
      pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'E8' }, { type: 'American/Line Squad', hex: 'G5' }],
      axis: { discard: 0, surrender: 1 },
    });
    const r = run(s, (ctx) => gameFlow(s, ctx), script([{ kind: 'choose', items: [] }, { kind: 'choose', items: [0] }]));
    expect(r.pending).toBeNull();
    expect(s).toMatchObject({ phase: 'over', winner: 'allied', endReason: 'surrender' });
  });

  it('both players overstacked into surrender at the end of one Turn: the Initiative holder wins', () => {
    const s = build({
      pieces: [
        { type: 'German/Rifle Squad', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'E8' },
        { type: 'American/Line Squad', hex: 'G5' }, { type: 'American/Line Squad', hex: 'G5' }, { type: 'American/Line Squad', hex: 'G8' },
      ],
      axis: { discard: 0, surrender: 1 },
      allied: { surrender: 1 },
      initiative: 'axis',
    });
    const r = run(s, (ctx) => gameFlow(s, ctx), (d, st) => (d.kind === 'choose' && d.reason === 'overstackDeploy' ? { kind: 'choose', items: [] } : passive(d, st)));
    expect(r.decisions.filter((d) => d.kind === 'choose' && d.reason === 'overstackEliminate').map((d) => d.side)).toEqual(['allied', 'axis']);
    expect(s).toMatchObject({ phase: 'over', winner: 'axis', endReason: 'surrender' });
  });
});

describe('exit off the enemy edge (§7.2.1, R-30)', () => {
  it('scores the units\' VP for their owner and puts them on a Time Track space ahead of the marker', () => {
    const s = build({
      pieces: [{ type: 'German/Rifle Squad', hex: 'E1', weapon: { type: 'German/LMG', broken: true }, veteran: true }, { type: 'German/Rifle Squad', hex: 'E5' }],
      time: 3,
    });
    const r = run(s, (ctx) => exitUnits(s, ctx, ['p0']), script([{ kind: 'choose', items: [2] }]));
    const d = r.decisions[0] as Extract<Decision, { kind: 'choose' }>;
    expect(d.reason).toBe('exitSpace');
    expect(d.items[0]).toEqual({ space: 4 });
    expect(s.vp).toBe(2);
    expect(s.pieces.p0).toMatchObject({ where: 'time', space: 6, veteran: false, broken: false });
    expect(s.pieces.p1.broken).toBe(false);
  });

  it('the last unit exiting ends the game: scored, VP decide', () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'E1' }, { type: 'American/Line Squad', hex: 'G5' }], vp: -1, allied: { secretChits: ['A'] }, control: ['allied', null, null, null, null] });
    expect(over(s, (ctx) => exitUnits(s, ctx, ['p0']))).toEqual({ winner: 'axis', reason: 'exit' });
    // +2 for the exit, then the Allied secret chit A (Objective 1 = 1 VP, Allied control) is revealed: -1 + 2 - 1 = 0
    expect(s.vp).toBe(0);
  });
});
