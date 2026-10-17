// Set-up rules the RSG (RS.7, RS.11.2, RS.12) and some scenarios ask for, and hiding an RSG's drawn secret chits.
import { describe, expect, it } from 'vitest';
import { gameFlow } from '../../src/engine/flow';
import { newGame, redact } from '../../src/engine/state';
import type { Decision, ScenarioDef } from '../../src/engine/types';
import { makeMap, passive, run, testScenario } from '../support/build';

function scenario(): ScenarioDef {
  const scn = testScenario({ axis: { posture: 'attack' }, allied: { posture: 'defend' } });
  scn.sides.axis.forces = { 'German/Rifle Squad': 2, 'German/Lt Von Karsties': 1, 'German/LMG': 1 };
  scn.sides.allied.forces = { 'American/Line Squad': 2, 'American/Sgt Smith': 1, 'American/MMG': 1 };
  return scn;
}

describe('special set-up rules', () => {
  it('carried: the named unit sets up holding the named Weapon (RS.7, §11.2)', () => {
    const scn = scenario();
    scn.special = { ...scn.special, carried: { allied: [{ unit: 'American/Sgt Smith', weapon: 'American/MMG' }] } };
    const s = newGame(scn, 3, makeMap());
    run(s, (ctx) => gameFlow(s, ctx), passive);
    const mmg = Object.values(s.pieces).find((p) => p.type === 'American/MMG')!;
    expect(mmg.where).toBe('carried');
    expect(s.pieces[mmg.carrier!].type).toBe('American/Sgt Smith');
  });

  it('fortificationsLast: both sides deploy their units before any Fortification is placed (RS.12)', () => {
    const scn = scenario();
    scn.sides.allied.fortifications = { foxholes: 2 };
    scn.special = { ...scn.special, fortificationsLast: true };
    const s = newGame(scn, 5, makeMap());
    const r = run(s, (ctx) => gameFlow(s, ctx), passive);
    const kinds = r.decisions.map((d: Decision) => (d.kind === 'choose' ? `choose:${d.reason}` : `${d.kind}:${d.side}`));
    const lastDeploy = Math.max(...kinds.map((k, i) => (k.startsWith('deploy:') ? i : -1)));
    const firstFort = kinds.indexOf('choose:placement');
    expect(firstFort).toBeGreaterThan(lastDeploy);
    expect(s.fort.filter((f) => f === 'foxholes')).toHaveLength(2);
  });

  it('controlAfterSetup: an Objective one side alone occupies after set-up is controlled by it (RS.11.2)', () => {
    const scn = scenario();
    const map = makeMap();
    const objHex = map.objectives[0];
    scn.sides.allied.setupArea = { kind: 'hexes', hexes: [objHex] };
    scn.sides.allied.forces = { 'American/Line Squad': 1 };
    scn.special = { ...scn.special, controlAfterSetup: true };
    const s = newGame(scn, 9, map);
    run(s, (ctx) => gameFlow(s, ctx), passive);
    expect(s.control[0]).toBe('allied');
  });
});

describe('redact and an RSG scenario', () => {
  it("hides the opponent's secret chit that the RSG wrote into the scenario by name", () => {
    const scn = scenario();
    scn.id = 'rsg';
    scn.sides.axis.secretChits = ['K'];
    scn.sides.allied.secretChits = ['T'];
    const s = newGame(scn, 13, makeMap());
    const view = redact(s, 'allied');
    expect(view.scenario.sides.axis.secretChits).toEqual(['random']);
    expect(view.scenario.sides.allied.secretChits).toEqual(['T']);
    expect(JSON.stringify(view.scenario)).not.toContain('"K"');
    // the real scenario is untouched
    expect(s.scenario.sides.axis.secretChits).toEqual(['K']);
  });

  it('leaves a historical scenario alone: its named chits are printed on the scenario card', () => {
    const scn = scenario();
    scn.sides.axis.secretChits = ['K'];
    const s = newGame(scn, 13, makeMap());
    expect(redact(s, 'allied').scenario.sides.axis.secretChits).toEqual(['K']);
  });
});
