// Colours of the painted map (RGB triples for the per-pixel pass, CSS strings for vector passes).
export type RGB = [number, number, number];

export const GROUND = {
  open: [164, 170, 106] as RGB,
  openHue: [176, 168, 98] as RGB,
  brush: [124, 138, 78] as RGB,
  brushDot: [80, 96, 50] as RGB,
  woods: [66, 84, 44] as RGB,
  orchard: [150, 164, 96] as RGB,
  marsh: [120, 132, 94] as RGB,
  marshPool: [98, 124, 128] as RGB,
  waterShallow: [108, 144, 158] as RGB,
  waterDeep: [70, 106, 134] as RGB,
  bank: [124, 120, 84] as RGB,
};

/** Crop colours of fields (one per field, chosen by hash). */
export const FIELDS: RGB[] = [
  [206, 186, 118],
  [190, 178, 106],
  [178, 156, 108],
  [168, 172, 98],
];

/** Each hill level tints the ground toward its colour by its amount: plateaus step up from olive to pale sand. */
export const HILL_LEVELS: { color: RGB; amount: number }[] = [
  { color: [0, 0, 0], amount: 0 },
  { color: [192, 180, 112], amount: 0.42 },
  { color: [216, 196, 136], amount: 0.6 },
  { color: [234, 216, 166], amount: 0.72 },
  { color: [242, 230, 192], amount: 0.8 },
  { color: [246, 238, 210], amount: 0.86 },
];

export const TREE = {
  shadow: 'rgba(16, 26, 8, 0.34)',
  dark: [46, 68, 34] as RGB,
  mid: [70, 96, 48] as RGB,
  light: [116, 140, 74] as RGB,
};

export const ORCHARD_TREE = {
  shadow: 'rgba(30, 40, 16, 0.32)',
  dark: [78, 106, 52] as RGB,
  light: [138, 162, 88] as RGB,
};

export const SHRUB = {
  shadow: 'rgba(30, 40, 16, 0.28)',
  dark: [80, 98, 50] as RGB,
  light: [132, 148, 86] as RGB,
};

export const LINE = {
  contourShadow: 'rgba(60, 44, 18, 0.35)',
  contour: 'rgba(88, 64, 32, 0.95)',
  verge: 'rgba(182, 178, 122, 0.9)',
  roadEdge: '#7f6c48',
  road: '#d6c296',
  rut: 'rgba(160, 136, 96, 0.55)',
  trail: '#7a6040',
  ballast: '#857b68',
  tie: '#4d3d2a',
  rail: '#3c3d40',
  streamBank: 'rgba(66, 78, 46, 0.75)',
  stream: '#57809a',
  streamLight: 'rgba(170, 204, 214, 0.75)',
  gullyBand: 'rgba(132, 110, 70, 0.92)',
  gullyBed: 'rgba(92, 76, 48, 0.95)',
};

/** Roof colours (tiles, slate, shingles, thatch). */
export const ROOFS: RGB[] = [
  [152, 78, 58],
  [138, 70, 54],
  [104, 106, 108],
  [122, 94, 66],
  [166, 138, 86],
];

export const css = (c: RGB, a = 1) => (a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);

export const shadeRGB = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
