// Scenario 4, Closed for Renovation (scenarios-reference §3): SSR 1 Hidden Gun, SSR 2 Rubble, SSR 3 reinforcements on
// Time space 3.
import { describe, expect, it } from 'vitest';
import { areaHexes } from '../../../src/engine/data';
import { advanceTime } from '../../../src/engine/deck';
import { neighbours, rowOf } from '../../../src/engine/hex';
import type { Decision, GameState, HexId } from '../../../src/engine/types';
import { passive, run } from '../../support/build';
import { ofType, setUp } from './kit';

type DeployD = Extract<Decision, { kind: 'deploy' }>;

const nearBuilding = (s: GameState, h: HexId) => [h, ...neighbours(h)].some((x) => s.map.terrain[x] === 'Building');

describe('scenario 4 Closed for Renovation', () => {
  it('SSR 1 Hidden Gun: one Weapon Team and the IG 18 are placed after the Allied set-up, in the Axis area', () => {
    const { s, r } = setUp('4', 2);
    const deploys = r.decisions.filter((d): d is DeployD => d.kind === 'deploy');
    const lastAllied = deploys.map((d) => d.side).lastIndexOf('allied');
    const late = deploys.slice(lastAllied + 1);
    const gun = ofType(s, 'German/IG 18 Gun')[0];
    expect(late.length).toBeGreaterThan(0);
    expect(late[0].side).toBe('axis');
    expect(late[0].pieces.map((id) => s.pieces[id].type).sort()).toEqual(['German/IG 18 Gun', 'German/Weapon Team']);
    // the early Axis deployment kept them back
    for (const d of deploys.slice(0, lastAllied)) expect(d.pieces).not.toContain(gun.id);
    const area = new Set(areaHexes(s.scenario.sides.axis.setupArea, s.scenario.sides.axis.edge));
    for (const h of late[0].hexes) expect(area.has(h)).toBe(true);
    expect(gun.where).toBe('carried');
    expect(area.has(s.pieces[gun.carrier!].hex)).toBe(true);
    expect(ofType(s, 'German/Weapon Team').every((p) => p.where === 'map')).toBe(true);
  });

  it('SSR 2 Rubble: the Axis Wire goes only in or next to Building hexes', () => {
    const { s, r } = setUp('4', 3);
    const placements = r.decisions.filter((d): d is Extract<Decision, { kind: 'choose' }> => d.kind === 'choose' && d.reason === 'placement');
    expect(placements).toHaveLength(5);
    for (const d of placements) for (const it of d.items) expect(nearBuilding(s, (it as { hex: HexId }).hex)).toBe(true);
    const wire = s.fort.map((f, h) => (f === 'wire' ? h : -1)).filter((h) => h >= 0);
    expect(wire).toHaveLength(5);
  });

  it('SSR 3: Sgt White, two Engineer Squads and two Flamethrowers enter along the Allied edge on Time space 3', () => {
    const { s } = setUp('4', 4);
    const onTime = (id: string | null) => !!id && s.pieces[id].where === 'time';
    const group = Object.values(s.pieces).filter((p) => p.where === 'time' || onTime(p.carrier));
    expect(group.map((p) => p.type).sort()).toEqual([
      'American/Engineer Squad', 'American/Engineer Squad', 'American/Flamethrower', 'American/Flamethrower', 'American/Sgt White',
    ]);
    expect(group.every((p) => (p.carrier ? s.pieces[p.carrier] : p).space === 3)).toBe(true);
    s.time = 2;
    run(s, (ctx) => advanceTime(s, { ...ctx, depth: 1 }, 'allied'), passive);
    for (const p of group) {
      if (p.type === 'American/Flamethrower') expect(s.pieces[p.carrier!].type).toBe('American/Engineer Squad');
      else expect(p.where === 'map' && rowOf(p.hex) === 1).toBe(true);
    }
  });
});
