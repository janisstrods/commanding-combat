// Colours of the painted map (RGB triples for the per-pixel pass, CSS strings for vector passes): a summer palette, and
// a winter one for the snow map ("5w").
export type RGB = [number, number, number];

export interface Palette {
  ground: {
    open: RGB;
    openHue: RGB;
    brush: RGB;
    brushDot: RGB;
    woods: RGB;
    orchard: RGB;
    marsh: RGB;
    marshPool: RGB;
    waterShallow: RGB;
    waterDeep: RGB;
    bank: RGB;
    /** Built-up ground under and between buildings (yards, cobbles). */
    yard: RGB;
    /** Road and railway corridors of the mask, under the drawn roads and tracks. */
    track: RGB;
    ballast: RGB;
  };
  /** Crop colours of fields (one per field, chosen by hash), and how deep the furrows show. */
  fields: RGB[];
  furrow: number;
  /** Each hill level tints the ground toward its colour by its amount. */
  hills: { color: RGB; amount: number }[];
  tree: { shadow: string; dark: RGB; mid: RGB; light: RGB };
  orchardTree: { shadow: string; dark: RGB; light: RGB };
  shrub: { shadow: string; dark: RGB; light: RGB };
  line: {
    contourShadow: string;
    contour: string;
    verge: string;
    roadEdge: string;
    road: string;
    rut: string;
    trail: string;
    ballast: string;
    tie: string;
    rail: string;
    streamBank: string;
    stream: string;
    streamLight: string;
    gullyBand: string;
    gullyBed: string;
    gullyGrass: string;
  };
  /** Roof colours (tiles, slate, shingles, thatch; snow in winter). */
  roofs: RGB[];
  /** How much the ground mottles. */
  mottle: number;
}

export const SUMMER: Palette = {
  ground: {
    open: [164, 170, 106],
    openHue: [176, 168, 98],
    brush: [124, 138, 78],
    brushDot: [80, 96, 50],
    woods: [66, 84, 44],
    orchard: [150, 164, 96],
    marsh: [120, 132, 94],
    marshPool: [98, 124, 128],
    waterShallow: [108, 144, 158],
    waterDeep: [70, 106, 134],
    bank: [124, 120, 84],
    yard: [146, 138, 112],
    track: [196, 180, 136],
    ballast: [134, 126, 108],
  },
  fields: [
    [216, 190, 104],
    [200, 180, 100],
    [170, 140, 94],
    [150, 168, 78],
  ],
  furrow: 0.12,
  // plateaus step up from olive to pale sand
  hills: [
    { color: [0, 0, 0], amount: 0 },
    { color: [192, 180, 112], amount: 0.42 },
    { color: [216, 196, 136], amount: 0.6 },
    { color: [234, 216, 166], amount: 0.72 },
    { color: [242, 230, 192], amount: 0.8 },
    { color: [246, 238, 210], amount: 0.86 },
  ],
  tree: { shadow: 'rgba(16, 26, 8, 0.34)', dark: [46, 68, 34], mid: [70, 96, 48], light: [116, 140, 74] },
  orchardTree: { shadow: 'rgba(30, 40, 16, 0.32)', dark: [78, 106, 52], light: [138, 162, 88] },
  shrub: { shadow: 'rgba(30, 40, 16, 0.28)', dark: [80, 98, 50], light: [132, 148, 86] },
  line: {
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
    gullyGrass: 'rgba(84, 104, 58, 0.8)',
  },
  roofs: [
    [152, 78, 58],
    [138, 70, 54],
    [104, 106, 108],
    [122, 94, 66],
    [166, 138, 86],
  ],
  mottle: 1,
};

export const WINTER: Palette = {
  ground: {
    open: [228, 231, 233],
    openHue: [212, 220, 228],
    brush: [196, 202, 196],
    brushDot: [112, 116, 104],
    woods: [178, 186, 186],
    orchard: [216, 221, 220],
    marsh: [200, 208, 210],
    marshPool: [168, 194, 210],
    waterShallow: [190, 210, 222],
    waterDeep: [156, 186, 206],
    bank: [168, 170, 164],
    yard: [196, 196, 192],
    track: [196, 190, 178],
    ballast: [150, 146, 138],
  },
  fields: [
    [220, 220, 214],
    [214, 216, 214],
    [224, 222, 216],
  ],
  furrow: 0.045,
  // drifts: higher ground is a little brighter and colder
  hills: [
    { color: [0, 0, 0], amount: 0 },
    { color: [236, 240, 246], amount: 0.4 },
    { color: [244, 246, 250], amount: 0.6 },
    { color: [250, 251, 253], amount: 0.72 },
    { color: [252, 252, 254], amount: 0.8 },
    { color: [254, 254, 255], amount: 0.86 },
  ],
  tree: { shadow: 'rgba(54, 74, 104, 0.3)', dark: [38, 56, 44], mid: [56, 78, 62], light: [232, 238, 242] },
  orchardTree: { shadow: 'rgba(54, 74, 104, 0.26)', dark: [112, 102, 92], light: [226, 230, 232] },
  shrub: { shadow: 'rgba(54, 74, 104, 0.22)', dark: [104, 106, 96], light: [236, 240, 242] },
  line: {
    contourShadow: 'rgba(70, 84, 110, 0.3)',
    contour: 'rgba(96, 104, 118, 0.9)',
    verge: 'rgba(240, 242, 244, 0.9)',
    roadEdge: '#8a8478',
    road: '#c4bdb0',
    rut: 'rgba(120, 112, 100, 0.55)',
    trail: '#7d7468',
    ballast: '#8a877f',
    tie: '#4d4438',
    rail: '#3c3d40',
    streamBank: 'rgba(110, 120, 126, 0.75)',
    stream: '#9cbcd0',
    streamLight: 'rgba(236, 244, 250, 0.85)',
    gullyBand: 'rgba(170, 172, 168, 0.92)',
    gullyBed: 'rgba(132, 132, 126, 0.95)',
    gullyGrass: 'rgba(220, 226, 230, 0.85)',
  },
  roofs: [
    [228, 232, 236],
    [216, 222, 228],
    [234, 236, 238],
  ],
  mottle: 0.5,
};

/** The palette of a map: winter for the snow maps (ids ending in "w"). */
export function paletteFor(mapId: string): Palette {
  return /w$/.test(mapId) ? WINTER : SUMMER;
}

export const css = (c: RGB, a = 1) => (a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);

export const shadeRGB = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
