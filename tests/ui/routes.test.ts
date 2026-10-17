import { describe, expect, it } from 'vitest';
import { MAP_IDS as DATA_MAP_IDS } from '../../src/engine/data';
import { MAP_IDS, parseRoute, routeHash, type Route } from '../../src/ui/routes';

describe('parseRoute', () => {
  it('reads the main menu from an empty or root hash', () => {
    for (const h of ['', '#', '#/', '#/menu', '  #/  ']) expect(parseRoute(h)).toEqual({ kind: 'menu' });
  });

  it('reads the menus', () => {
    expect(parseRoute('#/scenarios')).toEqual({ kind: 'scenarios' });
    expect(parseRoute('#/scenarios/7')).toEqual({ kind: 'scenarios', selected: '7' });
    expect(parseRoute('#/credits')).toEqual({ kind: 'credits' });
    expect(parseRoute('#/continue')).toEqual({ kind: 'continue' });
  });

  it('reads a battle: scenario, side, AI level and an optional seed', () => {
    expect(parseRoute('#/play/4/axis/elite')).toEqual({ kind: 'play', scenario: '4', side: 'axis', level: 'elite' });
    expect(parseRoute('#/play/12/allied/green/12345')).toEqual({ kind: 'play', scenario: '12', side: 'allied', level: 'green', seed: 12345 });
  });

  it('refuses malformed battles', () => {
    for (const h of ['#/play', '#/play/4', '#/play/4/axis', '#/play/4/german/line', '#/play/4/axis/veteran', '#/play/4/axis/line/x1', '#/play/4/axis/line/1/2']) {
      expect(parseRoute(h).kind).toBe('notFound');
    }
  });

  it('reads the galleries', () => {
    expect(parseRoute('#/gallery/map/5w')).toEqual({ kind: 'galleryMap', map: '5w' });
    expect(parseRoute('#/gallery/map')).toEqual({ kind: 'galleryMap', map: '1' });
    expect(parseRoute('#/gallery/map/13').kind).toBe('notFound');
    expect(parseRoute('#/gallery/counters')).toEqual({ kind: 'galleryCounters' });
    expect(parseRoute('#/gallery/cards')).toEqual({ kind: 'galleryCards' });
    expect(parseRoute('#/gallery/kit').kind).toBe('notFound');
  });

  it('ignores a query string and keeps unknown hashes for the not-found page', () => {
    expect(parseRoute('#/credits?x=1')).toEqual({ kind: 'credits' });
    expect(parseRoute('#/nowhere')).toEqual({ kind: 'notFound', hash: '#/nowhere' });
  });

  it('knows every map the data has', () => {
    expect([...MAP_IDS].sort()).toEqual([...DATA_MAP_IDS].sort());
  });
});

describe('routeHash', () => {
  const routes: Route[] = [
    { kind: 'menu' },
    { kind: 'scenarios' },
    { kind: 'scenarios', selected: '11' },
    { kind: 'credits' },
    { kind: 'continue' },
    { kind: 'play', scenario: '3', side: 'axis', level: 'line' },
    { kind: 'play', scenario: '9', side: 'allied', level: 'elite', seed: 7 },
    { kind: 'galleryMap', map: '5w' },
    { kind: 'galleryCounters' },
    { kind: 'galleryCards' },
  ];

  it('round-trips through parseRoute', () => {
    for (const r of routes) {
      const h = routeHash(r);
      expect(h.startsWith('#/')).toBe(true);
      expect(parseRoute(h)).toEqual(r);
    }
  });

  it('writes the battle route the plan names', () => {
    expect(routeHash({ kind: 'play', scenario: '1', side: 'allied', level: 'green' })).toBe('#/play/1/allied/green');
    expect(routeHash({ kind: 'menu' })).toBe('#/');
  });
});
