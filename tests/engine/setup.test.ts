// A new game from a scenario and its set-up flow: chits, deployment, opening hands (scenarios-reference §2, Part H).
import { describe, expect, it } from 'vitest';
import { gameFlow } from '../../src/engine/flow';
import { HAND_SIZE, setupHexes } from '../../src/engine/setup';
import { newGame, unitsOf } from '../../src/engine/state';
import { OBJECTIVE_CHITS } from '../../src/engine/data';
import type { Decision, Posture, ScenarioDef } from '../../src/engine/types';
import { H, makeMap, passive, run, script, testScenario } from '../support/build';

function scenario(axis: Posture, allied: Posture): ScenarioDef {
  const scn = testScenario({ axis: { posture: axis }, allied: { posture: allied } });
  scn.sides.axis.forces = { 'German/Rifle Squad': 3, 'German/Lt Von Karsties': 1, 'German/LMG': 1 };
  scn.sides.allied.forces = { 'American/Line Squad': 2, 'American/Sgt Smith': 1, 'American/Radio:105mm': 1 };
  scn.sides.allied.reinforcements = { 3: { 'American/Line Squad': 1, 'American/MMG': 1 } };
  scn.openChits = ['random'];
  scn.sides.axis.secretChits = ['random'];
  scn.sides.allied.secretChits = ['random'];
  return scn;
}

describe('hand sizes by posture (§1.1)', () => {
  it('Attack 6, Recon 5, Defend 4', () => {
    expect(HAND_SIZE).toEqual({ attack: 6, recon: 5, defend: 4 });
  });

  for (const [axis, allied] of [['attack', 'defend'], ['recon', 'recon']] as [Posture, Posture][]) {
    it(`deals ${axis} / ${allied} opening hands after deployment`, () => {
      const s = newGame(scenario(axis, allied), 7, makeMap());
      const r = run(s, (ctx) => gameFlow(s, ctx), passive);
      expect(s.phase).toBe('play');
      expect(s.players.axis.hand).toHaveLength(HAND_SIZE[axis]);
      expect(s.players.allied.hand).toHaveLength(HAND_SIZE[allied]);
      expect(r.pending).toMatchObject({ kind: 'turn', side: s.scenario.firstTurn });
    });
  }
});

describe('set-up', () => {
  it('deploys each side in its area, the side setting up first first; Radios go to the Artillery Box', () => {
    const scn = scenario('attack', 'defend');
    const s = newGame(scn, 11, makeMap());
    const r = run(s, (ctx) => gameFlow(s, ctx), passive);
    const deploys = r.decisions.filter((d): d is Extract<Decision, { kind: 'deploy' }> => d.kind === 'deploy');
    expect(deploys[0].side).toBe(scn.setupFirst);
    for (const side of ['axis', 'allied'] as const) {
      const area = new Set(setupHexes(s, side));
      for (const u of unitsOf(s, side)) expect(area.has(u.hex)).toBe(true);
    }
    expect(unitsOf(s, 'axis')).toHaveLength(4);
    expect(unitsOf(s, 'allied')).toHaveLength(3);
    expect(Object.values(s.pieces).find((p) => p.type === 'American/Radio:105mm')!.where).toBe('artillery');
    const lmg = Object.values(s.pieces).find((p) => p.type === 'German/LMG')!;
    expect(lmg.where).toBe('carried');
    expect(s.pieces[lmg.carrier!].weapon).toBe(lmg.id);
    const rein = Object.values(s.pieces).filter((p) => p.where === 'time');
    expect(rein.map((p) => [p.type, p.space])).toEqual([['American/Line Squad', 3]]);
    expect(s.pieces[rein[0].weapon!].type).toBe('American/MMG');
  });

  it('places a chosen piece where asked, and a Weapon with a unit there', () => {
    const scn = scenario('attack', 'defend');
    const s = newGame(scn, 5, makeMap());
    const allied = scn.setupFirst === 'allied';
    expect(allied).toBe(true);
    const squad = Object.values(s.pieces).find((p) => p.type === 'American/Line Squad' && p.where === 'staging')!;
    const r = run(s, (ctx) => gameFlow(s, ctx), script([{ kind: 'deploy', piece: squad.id, hex: H('C2') }]));
    expect(s.pieces[squad.id]).toMatchObject({ where: 'map', hex: H('C2') });
    expect(r.invalid).toEqual([]);
  });

  it('draws the open and secret chits (no-secret-side chits go open)', () => {
    const s = newGame(scenario('recon', 'recon'), 3, makeMap());
    run(s, (ctx) => gameFlow(s, ctx), passive);
    const secret = [...s.players.axis.secretChits, ...s.players.allied.secretChits];
    expect(s.openChits.length + secret.length).toBe(3);
    expect(s.openChits.length).toBeGreaterThanOrEqual(1);
    for (const c of secret) expect(OBJECTIVE_CHITS[c].secret).toBe(true);
    expect(s.chitCup).toHaveLength(22 - 3);
  });
});
