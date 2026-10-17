// Text measuring for SVG art without a DOM: approximate advance widths (in em) of the two fonts, used to fit labels
// (textLength squeeze) and to wrap card texts. Calibrated against the browser's own measurements of Oswald 600 and
// Source Sans 3 400; errs slightly wide so wrapped lines never overflow.

const TITLE_DEFAULT = 0.5;
// Oswald 600, upper case, digits and punctuation
const TITLE: Record<string, number> = {
  ' ': 0.22, '.': 0.24, ',': 0.24, ':': 0.24, '-': 0.32, '–': 0.5, '!': 0.27, '&': 0.6, '/': 0.36, "'": 0.2, '(': 0.29, ')': 0.29, '+': 0.48,
  '0': 0.5, '1': 0.36, '2': 0.48, '3': 0.48, '4': 0.5, '5': 0.48, '6': 0.5, '7': 0.42, '8': 0.5, '9': 0.5,
  A: 0.52, B: 0.53, C: 0.5, D: 0.54, E: 0.43, F: 0.42, G: 0.53, H: 0.56, I: 0.25, J: 0.32, K: 0.52, L: 0.41, M: 0.69,
  N: 0.56, O: 0.54, P: 0.51, Q: 0.54, R: 0.53, S: 0.48, T: 0.43, U: 0.55, V: 0.51, W: 0.74, X: 0.5, Y: 0.49, Z: 0.42,
  Ä: 0.52, Ö: 0.54, Ü: 0.55, É: 0.43,
};
const TITLE_LOWER = 0.43;

const BODY_DEFAULT = 0.5;
// Source Sans 3 regular
const BODY: Record<string, number> = {
  ' ': 0.2, '.': 0.25, ',': 0.25, ':': 0.25, ';': 0.25, '-': 0.31, '–': 0.5, '!': 0.29, '?': 0.43, "'": 0.22, '’': 0.22, '(': 0.3, ')': 0.3, '/': 0.34, '+': 0.5, '&': 0.62,
  '0': 0.5, '1': 0.5, '2': 0.5, '3': 0.5, '4': 0.5, '5': 0.5, '6': 0.5, '7': 0.5, '8': 0.5, '9': 0.5,
  a: 0.49, b: 0.54, c: 0.44, d: 0.54, e: 0.49, f: 0.3, g: 0.49, h: 0.53, i: 0.24, j: 0.24, k: 0.48, l: 0.25, m: 0.81,
  n: 0.53, o: 0.53, p: 0.54, q: 0.54, r: 0.34, s: 0.41, t: 0.33, u: 0.53, v: 0.46, w: 0.71, x: 0.44, y: 0.46, z: 0.42,
  A: 0.56, B: 0.59, C: 0.57, D: 0.62, E: 0.53, F: 0.5, G: 0.62, H: 0.65, I: 0.26, J: 0.47, K: 0.58, L: 0.48, M: 0.74,
  N: 0.65, O: 0.67, P: 0.58, Q: 0.67, R: 0.59, S: 0.54, T: 0.54, U: 0.65, V: 0.54, W: 0.8, X: 0.53, Y: 0.5, Z: 0.54,
};

export type Font = 'title' | 'body';

/** Calibration against Chrome's measureText of every card text and label: keeps estimates 0-3% wider than real. */
const SCALE: Record<Font, number> = { title: 1.08, body: 1.035 };

/** Approximate rendered width of `text` at `size` (user units), with optional letter spacing per character. */
export function textWidth(text: string, size: number, font: Font = 'title', spacing = 0): number {
  let w = 0;
  for (const ch of text) {
    if (font === 'title') w += TITLE[ch] ?? (ch >= 'a' && ch <= 'z' ? TITLE_LOWER : TITLE_DEFAULT);
    else w += BODY[ch] ?? BODY_DEFAULT;
  }
  return w * SCALE[font] * size + spacing * Math.max(0, [...text].length - 1);
}

/**
 * Props that squeeze a label into `max` units when it would be wider (SVG textLength), else nothing.
 * Squeezing more than ~25% looks wrong, so callers shorten very long labels first.
 */
export function fit(text: string, size: number, max: number, font: Font = 'title', spacing = 0): { textLength?: number; lengthAdjust?: 'spacingAndGlyphs' } {
  return textWidth(text, size, font, spacing) > max ? { textLength: max, lengthAdjust: 'spacingAndGlyphs' } : {};
}

/** Greedy word wrap of `text` into lines no wider than `width` at `size`. */
export function wrap(text: string, width: number, size: number, font: Font = 'body'): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && textWidth(next, size, font) > width) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * The largest font size from `sizes` (descending) at which `text` wraps into at most `maxLines` lines of `width`;
 * falls back to the smallest size (its lines may then exceed `maxLines`).
 */
export function fitWrap(text: string, width: number, sizes: number[], maxLines: (size: number) => number): { size: number; lines: string[] } {
  for (const size of sizes) {
    const lines = wrap(text, width, size);
    if (lines.length <= maxLines(size)) return { size, lines };
  }
  const size = sizes[sizes.length - 1];
  return { size, lines: wrap(text, width, size) };
}
