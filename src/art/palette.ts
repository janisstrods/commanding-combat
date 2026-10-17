// Colours of the counter, marker and card art. Nation colours are light, slightly dusty "printed cardboard" tones, so
// the dark silhouettes and the black values on them stay legible down to 48 px counters.
import type { Nation, Quality, Side } from '../engine/types';

export interface NationPalette {
  /** Counter face. */
  base: string;
  /** Lit edge of the bevel. */
  light: string;
  /** Shaded edge of the bevel and the outline. */
  dark: string;
  /** Silhouettes. */
  ink: string;
  /** Printed values. */
  text: string;
  /** Saturated nation colour for card frames, card backs and objective control markers. */
  frame: string;
  frameDark: string;
  frameLight: string;
  /** Weapon counters are a lighter shade of the same colour. */
  weapon: string;
  label: string;
}

export const NATION: Record<Nation, NationPalette> = {
  German: {
    base: '#a7b3b6',
    light: '#d3dcdd',
    dark: '#5d6b71',
    ink: '#1d2427',
    text: '#141819',
    frame: '#56666e',
    frameDark: '#323d43',
    frameLight: '#8d9ca2',
    weapon: '#bcc6c8',
    label: 'German',
  },
  American: {
    base: '#b0aa72',
    light: '#d8d3a0',
    dark: '#6a6738',
    ink: '#22220f',
    text: '#17170b',
    frame: '#5e6131',
    frameDark: '#373a19',
    frameLight: '#959660',
    weapon: '#c3be8b',
    label: 'American',
  },
  Russian: {
    base: '#bf9f72',
    light: '#e2c9a1',
    dark: '#7a5c38',
    ink: '#2a1c10',
    text: '#1d140b',
    frame: '#7a5634',
    frameDark: '#4a311b',
    frameLight: '#ad8a5f',
    weapon: '#cfb48c',
    label: 'Russian',
  },
};

/** Default nation of each side in the base game (Allied markers without a nation use the American colour). */
export const SIDE_NATION: Record<Side, Nation> = { axis: 'German', allied: 'American' };

/** Troop-quality corner tabs on Squads and Teams. */
export const QUALITY: Record<Quality, { fill: string; edge: string; label: string }> = {
  elite: { fill: '#e2b33c', edge: '#7c5a10', label: 'Elite' },
  line: { fill: '#f1ecdc', edge: '#7d7766', label: 'Line' },
  green: { fill: '#5fa448', edge: '#2c5a1f', label: 'Green' },
};

export const INK = {
  /** Broken-side bar. */
  broken: '#b3261e',
  brokenDark: '#6e130e',
  /** Weapon movement penalty. */
  penalty: '#b3261e',
  white: '#fbf8ee',
  black: '#141414',
  /** Ordnance band on weapons. */
  ordnance: '#f6f3e8',
  /** Hero frame and highlights. */
  gold: '#e6bd4f',
  goldDark: '#8a6a17',
  /** Selection glow. */
  select: '#ffd54a',
  /** Suppressed and Veteran badges. */
  suppressed: '#e8862a',
  veteran: '#2f6b3a',
  /** Card paper. */
  paper: '#f3ecd9',
  paperDark: '#ddd0ad',
  paperInk: '#2a241a',
  paperSoft: '#655a45',
};

/** Fonts (loaded by src/main.tsx through @fontsource). */
export const FONT = {
  title: "Oswald, 'Arial Narrow', 'Helvetica Neue', sans-serif",
  body: "'Source Sans 3', 'Source Sans Pro', 'Helvetica Neue', Arial, sans-serif",
};

const cache = new Map<string, string>();

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

const hx = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

/** Linear blend of two #rrggbb colours: t = 0 -> a, t = 1 -> b. */
export function mix(a: string, b: string, t: number): string {
  const key = `${a}|${b}|${t}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const out = `#${hx(r1 + (r2 - r1) * t)}${hx(g1 + (g2 - g1) * t)}${hx(b1 + (b2 - b1) * t)}`;
  cache.set(key, out);
  return out;
}

export const darken = (c: string, t: number) => mix(c, '#100c08', t);
export const lighten = (c: string, t: number) => mix(c, '#fffaf0', t);
