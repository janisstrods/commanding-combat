// Every marker kind renders, with the values it prints.
import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FORT_COVER, MARKER_KINDS, Marker, MarkerG, markerLabel } from '../../src/art/Marker';
import type { Nation } from '../../src/engine/types';

const texts = (html: string) => [...html.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

describe('Marker', () => {
  it('every kind renders standalone and inside an SVG', () => {
    for (const kind of MARKER_KINDS) {
      expect(renderToStaticMarkup(h(Marker, { kind, size: 48 })), kind).toMatch(/^<svg/);
      expect(renderToStaticMarkup(h('svg', null, h(MarkerG, { kind, x: 10, y: 10, size: 40, selected: true, dim: true }))), kind).toContain('<g');
    }
  });

  it('fortifications print their Cover', () => {
    for (const [kind, cover] of Object.entries(FORT_COVER)) {
      expect(texts(renderToStaticMarkup(h(Marker, { kind: kind as never }))), kind).toContain(String(cover));
    }
  });

  it('Mines 6/7/8 and Smoke 1..10 print their value', () => {
    for (const v of [6, 7, 8]) expect(texts(renderToStaticMarkup(h(Marker, { kind: 'mines', value: v })))).toContain(String(v));
    for (let v = 1; v <= 10; v++) expect(texts(renderToStaticMarkup(h(Marker, { kind: 'smoke', value: v })))).toContain(String(v));
  });

  it('objective control markers differ per nation, and a side picks its base-game nation', () => {
    const of = (nation?: Nation, side?: 'axis' | 'allied') => renderToStaticMarkup(h(Marker, { kind: 'objective', nation, side }));
    const all = (['German', 'American', 'Russian'] as Nation[]).map((n) => of(n));
    expect(new Set(all).size).toBe(3);
    expect(of(undefined, 'axis')).toBe(of('German'));
    expect(markerLabel('objective', undefined, 'Russian')).toBe('Russian control');
  });
});
