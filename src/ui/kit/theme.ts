import type { Nation, Side } from '../../engine/types';

/** Design tokens. The same values are exposed as CSS custom properties in theme.css (`--kit-*`). */
export const theme = {
  font: {
    title: "'Oswald', 'Arial Narrow', 'Helvetica Neue', sans-serif",
    body: "'Source Sans 3', 'Source Sans Pro', 'Helvetica Neue', Arial, sans-serif",
  },
  color: {
    paper: '#ece3c8',
    paperLight: '#f6f0de',
    paperDark: '#d8cba4',
    khaki: '#c2b182',
    khakiDark: '#8f7f55',
    olive: '#56662f',
    oliveLight: '#7c8c4f',
    oliveDark: '#36421b',
    ink: '#23241c',
    inkSoft: '#55533f',
    inkFaint: '#7f7a62',
    red: '#962d22',
    redDark: '#63190f',
    brass: '#b38f3f',
    brassLight: '#e0c77f',
    steel: '#5d6669',
    good: '#3f6b2a',
    bad: '#a3291c',
  },
  radius: { sm: 3, md: 6, lg: 10 },
} as const;

export type Theme = typeof theme;

/** The colour each nation is shown in (labels, chips, edge names). */
export const NATION_COLORS: Record<Nation, { main: string; light: string; dark: string }> = {
  German: { main: '#5f6a6a', light: '#9aa3a0', dark: '#353c3d' },
  American: { main: '#6b6a3a', light: '#a3a067', dark: '#3b3a1c' },
  Russian: { main: '#7a5a3a', light: '#b08d66', dark: '#45301b' },
};

export const SIDE_LABEL: Record<Side, string> = { axis: 'Axis', allied: 'Allies' };
