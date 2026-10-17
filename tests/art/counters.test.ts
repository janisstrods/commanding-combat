// Every counter type in the counter mix renders, front and broken, with its printed values; weapons get their own
// silhouettes; Leaders show their Command.
import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { COUNTERS } from '../../src/engine/data';
import { Counter, CounterG, WEAPON_SCALE, counterPixelSize, leaderName, unitLabel } from '../../src/art/Counter';
import { weaponArt } from '../../src/art/silhouettes';

const ALL = Object.values(COUNTERS);
const svg = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
/** The text content of a render. */
const texts = (html: string) => [...html.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

describe('Counter', () => {
  it('the counter mix is loaded', () => {
    expect(ALL.length).toBeGreaterThan(100);
  });

  it('every counter type renders front and broken, standalone and inside an SVG, without throwing', () => {
    for (const t of ALL) {
      for (const broken of [false, true]) {
        const a = svg(h(Counter, { type: t, broken, size: 64 }));
        expect(a, t.id).toMatch(/^<svg/);
        const b = svg(h('svg', null, h(CounterG, { type: t, broken, x: 100, y: 100, size: 64, suppressed: true, veteran: true, selected: true, dim: true })));
        expect(b, t.id).toContain('<g transform="translate(');
      }
    }
  });

  it('units print Morale and Firepower - Range - Movement of the side shown', () => {
    for (const t of ALL.filter((c) => c.kind !== 'weapon' && c.kind !== 'radio')) {
      for (const broken of [false, true]) {
        const st = broken ? t.broken : t.front;
        const tx = texts(svg(h(Counter, { type: t, broken })));
        for (const v of [st.morale, st.fp, st.range, st.move]) expect(tx, `${t.id} ${broken}`).toContain(String(v));
        if (t.kind === 'leader') expect(tx, t.id).toContain(String(st.command));
      }
    }
  });

  it('broken sides carry the red bar, front sides do not', () => {
    const t = COUNTERS['German/Rifle Squad'];
    expect(svg(h(Counter, { type: t, broken: true }))).toContain('#b3261e');
    expect(svg(h(Counter, { type: t }))).not.toContain('#b3261e');
  });

  it('weapons print FP, Range (min-max for mortars) and the movement penalty; broken ones Fix and Elim', () => {
    const mortar = COUNTERS['German/Light Mortar'];
    const tx = texts(svg(h(Counter, { type: mortar })));
    expect(tx).toEqual(expect.arrayContaining(['6', '2-13', '−2']));
    const lmg = COUNTERS['German/LMG'];
    const brokenTx = texts(svg(h(Counter, { type: lmg, broken: true })));
    expect(brokenTx).toEqual(expect.arrayContaining(['FIX', '5–6', 'ELIM', '7–8']));
    const radio = COUNTERS['American/Radio:105mm'];
    expect(texts(svg(h(Counter, { type: radio })))).toEqual(expect.arrayContaining(['105MM', '10']));
  });

  it('weapons and radios are smaller squares', () => {
    expect(counterPixelSize(COUNTERS['German/LMG'], 64)).toBe(Math.round(64 * WEAPON_SCALE));
    expect(counterPixelSize(COUNTERS['German/Rifle Squad'], 64)).toBe(64);
  });

  it('every weapon and radio gets a silhouette that matches its name', () => {
    const expected: [RegExp, string][] = [
      [/^Radio/, 'radio'],
      [/^\.50/, 'hmg50'],
      [/^HMG/, 'hmg'],
      [/^MMG/, 'mmg'],
      [/^LMG/, 'lmg'],
      [/^Light Mortar/, 'lightMortar'],
      [/^Medium Mortar/, 'mediumMortar'],
      [/^Flamethrower/, 'flamethrower'],
      [/^Satchel/, 'satchel'],
      [/^IG 33/, 'heavyGun'],
      [/^(IG 18|Infantry Gun|Pack Howitzer)/, 'gun'],
    ];
    for (const t of ALL.filter((c) => c.kind === 'weapon' || c.kind === 'radio')) {
      const hit = expected.find(([re]) => re.test(t.name));
      expect(hit, `no expectation for ${t.id}`).toBeDefined();
      expect(weaponArt(t), t.id).toBe(hit![1]);
    }
  });

  it('names: unit labels drop "Squad"/"Team", leader names drop rank and "(Hero)"', () => {
    expect(unitLabel(COUNTERS['German/Rifle Squad'])).toBe('Rifle');
    expect(unitLabel(COUNTERS['Russian/Guards SMG Squad'])).toBe('Gds SMG');
    expect(leaderName(COUNTERS['German/Sgt Benzing'])).toBe('Benzing');
    expect(leaderName(COUNTERS['German/Lt Von Karsties'])).toBe('Von Karsties');
    expect(leaderName(COUNTERS['German/Dietel (Hero)'])).toBe('Dietel');
  });
});
