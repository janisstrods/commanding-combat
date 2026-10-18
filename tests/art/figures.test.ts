// The soldier rig and the weapon drawings: every shape is wound clockwise (so a colour layer can share one path without
// holes), every unit type gets its men in its nation's kit, squad kinds and nations differ, weapons differ per nation,
// and a counter stays within an SVG element budget.
import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { COUNTERS } from '../../src/engine/data';
import type { CounterType, Nation } from '../../src/engine/types';
import { Counter } from '../../src/art/Counter';
import { area2, capsule, circle, parse, reverse } from '../../src/art/figures/geom';
import { rosterOf } from '../../src/art/figures/dress';
import { POSE_NAMES, buildFigure, figureKey } from '../../src/art/figures/rig';
import { type WeaponArt, weaponFigure } from '../../src/art/figures/weapons';
import { weaponArt } from '../../src/art/silhouettes';

const ALL = Object.values(COUNTERS);
const UNITS = ALL.filter((c) => c.kind === 'squad' || c.kind === 'team' || c.kind === 'leader');
const NATIONS: Nation[] = ['German', 'American', 'Russian'];

/** Signed areas of every subpath of an SVG path (absolute M L C Z, as the art writes them). */
function subpathAreas(d: string): number[] {
  return d
    .split('Z')
    .filter((p) => p.trim())
    .map((p) => area2(parse(p + 'Z')[0] ?? []));
}

describe('geometry', () => {
  it('parse, capsule and circle give clockwise shapes; reverse flips the winding', () => {
    for (const sh of [...parse('M0 0 L0 10 L10 10 Z'), capsule([0, 0], [10, 3], 2, 1), circle(5, 5, 3)]) {
      expect(area2(sh)).toBeGreaterThan(0);
      expect(area2(reverse(sh))).toBeLessThan(0);
    }
  });
});

describe('soldiers', () => {
  it('every unit type has its men: three in a squad, two in a team, one leader; broken men face away', () => {
    for (const t of UNITS) {
      for (const broken of [false, true]) {
        const r = rosterOf(t, broken);
        expect(r.length, t.id).toBe(t.kind === 'squad' ? 3 : t.kind === 'team' ? 2 : 1);
        if (broken) expect(r.every((s) => s.flip && ['flee', 'fleeBare', 'cower'].includes(s.fig.pose)), t.id).toBe(true);
        else expect(r.some((s) => s.flip), t.id).toBe(false);
      }
    }
  });

  it('men wear their nation’s headgear', () => {
    const hats: Record<Nation, string[]> = {
      German: ['stahlhelm', 'stahlhelmCamo', 'jumpHelmet', 'fieldCap', 'peakedCap'],
      American: ['m1', 'm1Net'],
      Russian: ['ssh40', 'pilotka', 'ushanka', 'furazhka'],
    };
    for (const t of UNITS) for (const s of rosterOf(t, false)) expect(hats[t.nation], t.id).toContain(s.fig.kit.hat);
  });

  it('squad kinds of a nation look different from each other, and nations differ', () => {
    const sig = (t: CounterType) => rosterOf(t, false).map((s) => figureKey(s.fig)).join(' / ');
    for (const n of NATIONS) {
      const squads = ALL.filter((c) => c.nation === n && c.kind === 'squad');
      expect(new Set(squads.map(sig)).size, n).toBe(squads.length);
    }
    const line = ['German/Rifle Squad', 'American/Line Squad', 'Russian/Rifle Squad'].map((id) => sig(COUNTERS[id]));
    expect(new Set(line).size).toBe(3);
  });

  it('special kit shows: SS camouflage, paratrooper helmets, Russian breastplates and the Guards flag', () => {
    const kits = (id: string) => rosterOf(COUNTERS[id], false).map((s) => s.fig);
    expect(kits('German/SS Squad').every((f) => f.kit.camo === 'oak')).toBe(true);
    expect(kits('German/Fallschirmjager Squad').every((f) => f.kit.hat === 'jumpHelmet')).toBe(true);
    expect(kits('American/Paratroop Squad').every((f) => f.kit.hat === 'm1Net')).toBe(true);
    expect(kits('Russian/Assault Squad').every((f) => f.kit.cuirass)).toBe(true);
    expect(kits('Russian/Guards Rifle Squad').some((f) => f.pose === 'flag')).toBe(true);
    expect(kits('Russian/Militia Squad').every((f) => !['ssh40'].includes(f.kit.hat))).toBe(true);
  });

  it('every figure is built of clockwise shapes, in every pose, and is cached', () => {
    const seen = new Set<string>();
    for (const t of UNITS) {
      for (const broken of [false, true]) {
        for (const s of rosterOf(t, broken)) {
          const key = figureKey(s.fig);
          if (seen.has(key)) continue;
          seen.add(key);
          const g = buildFigure(s.fig);
          expect(buildFigure(s.fig)).toBe(g);
          for (const l of g.layers) for (const a of subpathAreas(l.d)) expect(a, `${key} ${l.layer}`).toBeGreaterThanOrEqual(0);
        }
      }
    }
    const kit = rosterOf(COUNTERS['German/Rifle Squad'], false)[0].fig.kit;
    for (const pose of POSE_NAMES) expect(buildFigure({ pose, kit, arm: 'k98' }).layers.length, pose).toBeGreaterThan(5);
  });
});

describe('weapons', () => {
  const arts = [...new Set(ALL.filter((c) => c.kind === 'weapon' || c.kind === 'radio').map((c) => weaponArt(c)))];

  it('every weapon and radio drawing is clockwise and not empty', () => {
    for (const t of ALL.filter((c) => c.kind === 'weapon' || c.kind === 'radio')) {
      const g = weaponFigure(weaponArt(t), t.nation);
      expect(g.layers.length, t.id).toBeGreaterThan(1);
      for (const l of g.layers) for (const a of subpathAreas(l.d)) expect(a, `${t.id} ${l.layer}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('each nation draws its own models', () => {
    const differ: WeaponArt[] = ['lmg', 'hmg', 'lightMortar', 'mediumMortar', 'gun', 'flamethrower', 'satchel', 'radio'];
    for (const art of differ) {
      expect(arts).toContain(art);
      const ds = NATIONS.map((n) => weaponFigure(art, n).union);
      expect(new Set(ds).size, art).toBe(3);
    }
  });
});

describe('counter budget', () => {
  it('a counter stays under a modest number of SVG elements', () => {
    for (const t of ALL) {
      for (const broken of [false, true]) {
        const html = renderToStaticMarkup(h(Counter, { type: t, broken, suppressed: true, veteran: true }));
        const n = (html.match(/<(path|rect|circle|ellipse|text|g)\b/g) ?? []).length;
        expect(n, t.id).toBeLessThan(110);
      }
    }
  });
});
