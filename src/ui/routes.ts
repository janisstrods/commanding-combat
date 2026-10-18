// Hash routes (`#/...`): the site is static, so every screen is a hash. Parsing is pure (tested); `useRoute` follows
// the window's hash.
import { useEffect, useState } from 'react';
import type { Side } from '../engine/types';

export type AiLevel = 'green' | 'line' | 'elite';
export const AI_LEVELS: readonly AiLevel[] = ['green', 'line', 'elite'];
export const DEFAULT_AI_LEVEL: AiLevel = 'line';

export type Route =
  | { kind: 'menu' }
  | { kind: 'scenarios'; selected?: string }
  | { kind: 'credits' }
  /** The Random Scenario Generator (Task 13). */
  | { kind: 'random' }
  /** Resume the autosaved battle. */
  | { kind: 'continue' }
  | { kind: 'play'; scenario: string; side: Side; level: AiLevel; seed?: number }
  | { kind: 'galleryMap'; map: string }
  | { kind: 'galleryCounters' }
  | { kind: 'galleryCards' }
  | { kind: 'notFound'; hash: string };

/** Map ids with a board: "1".."12" and the winter map "5w". */
export const MAP_IDS: readonly string[] = ['1', '2', '3', '4', '5', '5w', '6', '7', '8', '9', '10', '11', '12'];

const SIDES: readonly Side[] = ['axis', 'allied'];

function segments(hash: string): string[] {
  let h = hash.trim();
  if (h.startsWith('#')) h = h.slice(1);
  const q = h.indexOf('?');
  if (q >= 0) h = h.slice(0, q);
  return h
    .split('/')
    .filter((s) => s.length > 0)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
}

/** The route a location hash names ('' and '#/' are the main menu). */
export function parseRoute(hash: string): Route {
  const seg = segments(hash);
  const notFound: Route = { kind: 'notFound', hash };
  if (seg.length === 0) return { kind: 'menu' };
  const [head, ...rest] = seg;
  switch (head) {
    case 'menu':
      return rest.length === 0 ? { kind: 'menu' } : notFound;
    case 'scenarios':
      if (rest.length === 0) return { kind: 'scenarios' };
      return rest.length === 1 ? { kind: 'scenarios', selected: rest[0] } : notFound;
    case 'credits':
      return rest.length === 0 ? { kind: 'credits' } : notFound;
    case 'continue':
      return rest.length === 0 ? { kind: 'continue' } : notFound;
    case 'random':
      return rest.length === 0 ? { kind: 'random' } : notFound;
    case 'play': {
      if (rest.length < 3 || rest.length > 4) return notFound;
      const [scenario, side, level, seedText] = rest;
      if (!SIDES.includes(side as Side)) return notFound;
      if (!AI_LEVELS.includes(level as AiLevel)) return notFound;
      const route: Route = { kind: 'play', scenario, side: side as Side, level: level as AiLevel };
      if (seedText !== undefined) {
        if (!/^\d+$/.test(seedText)) return notFound;
        route.seed = Number(seedText);
      }
      return route;
    }
    case 'gallery': {
      const [what, id] = rest;
      if (what === 'map') {
        if (rest.length === 1) return { kind: 'galleryMap', map: '1' };
        return rest.length === 2 && MAP_IDS.includes(id) ? { kind: 'galleryMap', map: id } : notFound;
      }
      if (what === 'counters' && rest.length === 1) return { kind: 'galleryCounters' };
      if (what === 'cards' && rest.length === 1) return { kind: 'galleryCards' };
      return notFound;
    }
    default:
      return notFound;
  }
}

/** The hash of a route (always starting "#/"); `parseRoute(routeHash(r))` gives `r` back. */
export function routeHash(r: Route): string {
  switch (r.kind) {
    case 'menu':
      return '#/';
    case 'scenarios':
      return r.selected ? `#/scenarios/${encodeURIComponent(r.selected)}` : '#/scenarios';
    case 'credits':
      return '#/credits';
    case 'continue':
      return '#/continue';
    case 'random':
      return '#/random';
    case 'play':
      return `#/play/${encodeURIComponent(r.scenario)}/${r.side}/${r.level}${r.seed === undefined ? '' : `/${r.seed}`}`;
    case 'galleryMap':
      return `#/gallery/map/${encodeURIComponent(r.map)}`;
    case 'galleryCounters':
      return '#/gallery/counters';
    case 'galleryCards':
      return '#/gallery/cards';
    case 'notFound':
      return r.hash.startsWith('#') ? r.hash : `#${r.hash}`;
  }
}

/** Go to a route (adds a history entry, so Back works). */
export function navigate(r: Route, opts?: { replace?: boolean }): void {
  const hash = routeHash(r);
  if (opts?.replace) {
    const url = `${window.location.pathname}${window.location.search}${hash}`;
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else if (window.location.hash !== hash) {
    window.location.hash = hash;
  }
}

/** The current route; re-renders on every hash change. */
export function useRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parseRoute(hash);
}
