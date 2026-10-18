// Uniform colours and kits of the three nations, and the figures that make up each counter: which men, in which pose,
// with which weapons. Squad kinds differ in kit (SS camouflage smocks, paratroopers' helmets and smocks, Volksgrenadier
// greatcoats, Russian padded jackets and steel breastplates, militia fur hats) and in weapons.
import type { CounterType, Nation } from '../../engine/types';
import { darken, lighten, mix } from '../palette';
import type { Arm } from './parts';
import type { Extra, FigureSpec, Kit, PoseName } from './rig';
import type { Layer } from './sketch';

export interface Colors {
  coat: string;
  legs: string;
  legwear: string;
  hat: string;
  hatMark: string;
  kit: string;
  kit2: string;
  pack: string;
  boot: string;
  skin: string;
  metal: string;
  wood: string;
  pattern: string;
  pattern2: string;
  accent: string;
}

const SKIN = '#c49a7a';
const METAL = '#24272a';
const WOOD = '#6a4527';
const RED = '#b0261c';

const DE: Colors = {
  coat: '#56604f',
  legs: '#535a4b',
  legwear: '#5c6052',
  hat: '#4a5247',
  hatMark: '#2f3a2c',
  kit: '#221f1b',
  kit2: '#686c5d',
  pack: '#5d6050',
  boot: '#1c1916',
  skin: SKIN,
  metal: METAL,
  wood: WOOD,
  pattern: '#3a3420',
  pattern2: '#8b8c4e',
  accent: RED,
};

const US: Colors = {
  coat: '#5c5636',
  legs: '#555032',
  legwear: '#a0946a',
  hat: '#4a482c',
  hatMark: '#2a2817',
  kit: '#9a8f63',
  kit2: '#7d7550',
  pack: '#948a5e',
  boot: '#3a291b',
  skin: SKIN,
  metal: METAL,
  wood: '#6e4a2a',
  pattern: '#3e3a22',
  pattern2: '#7b7550',
  accent: '#ece6d2',
};

const RU: Colors = {
  coat: '#5f5637',
  legs: '#565033',
  legwear: '#7a7058',
  hat: '#434d36',
  hatMark: '#2c3322',
  kit: '#38281a',
  kit2: '#6d6450',
  pack: '#625944',
  boot: '#1e1813',
  skin: SKIN,
  metal: METAL,
  wood: '#6e4526',
  pattern: '#3a3420',
  pattern2: '#7b7550',
  accent: RED,
};

export interface Dress {
  kit: Kit;
  colors: Colors;
}

const dress = (base: Colors, kit: Kit, over: Partial<Colors> = {}): Dress => ({ kit, colors: { ...base, ...over } });

// German
const deRifle = dress(DE, { hat: 'stahlhelm', coat: 'tunic', legwear: 'jackboots', gear: 'de' });
const deLate = dress(DE, { hat: 'stahlhelm', coat: 'tunic', legwear: 'gaiters', gear: 'de' });
const deCap = dress(DE, { hat: 'fieldCap', coat: 'tunic', legwear: 'gaiters', gear: 'de' }, { hat: '#525a4c' });
const deSS = dress(DE, { hat: 'stahlhelmCamo', coat: 'smock', legwear: 'jackboots', gear: 'de', camo: 'oak' }, { coat: '#686a3b', hat: '#686a3b', hatMark: '#3a3420' });
const deFJ = dress(
  DE,
  { hat: 'jumpHelmet', coat: 'smock', legwear: 'gaiters', gear: 'fj', camo: 'splinter' },
  { coat: '#79806b', hat: '#535b4d', legs: '#56605f', pattern: '#4d5a40', pattern2: '#6b5a3a', kit2: '#5e6450', legwear: '#4a4d45' },
);
const deVG = dress(DE, { hat: 'stahlhelm', coat: 'greatcoat', legwear: 'gaiters', gear: 'de' }, { coat: '#595e53' });
const deVGCap = dress(DE, { hat: 'fieldCap', coat: 'greatcoat', legwear: 'gaiters', gear: 'de' }, { coat: '#595e53', hat: '#525a4c' });
const deOfficer = dress(DE, { hat: 'peakedCap', coat: 'tunic', legwear: 'jackboots', gear: 'officer' }, { hat: '#5a6352', kit: '#3a2a1c' });
const deNco = dress(DE, { hat: 'stahlhelm', coat: 'tunic', legwear: 'jackboots', gear: 'de' });

// American
const usLine = dress(US, { hat: 'm1', coat: 'tunic', legwear: 'leggings', gear: 'us', pack: true });
const usLight = dress(US, { hat: 'm1', coat: 'tunic', legwear: 'leggings', gear: 'us' });
const usPara = dress(US, { hat: 'm1Net', coat: 'jump', legwear: 'jumpboots', gear: 'para' }, { coat: '#7c7652', legs: '#76704d', boot: '#4a311d' });
const usNco = dress(US, { hat: 'm1', coat: 'tunic', legwear: 'leggings', gear: 'us', stripe: 'h' });
const usOfficer = dress(US, { hat: 'm1', coat: 'tunic', legwear: 'leggings', gear: 'officer', stripe: 'v' }, { kit: '#4a3420' });

// Russian
const ruRifle = dress(RU, { hat: 'ssh40', coat: 'tunic', legwear: 'boots', gear: 'ru' });
const ruCap = dress(RU, { hat: 'pilotka', coat: 'tunic', legwear: 'boots', gear: 'ru' }, { hat: '#655c3c' });
const ruPadded = dress(RU, { hat: 'pilotka', coat: 'padded', legwear: 'boots', gear: 'light' }, { coat: '#4f4d3b', hat: '#655c3c' });
const ruPaddedHelmet = dress(RU, { hat: 'ssh40', coat: 'padded', legwear: 'boots', gear: 'light' }, { coat: '#4f4d3b' });
const ruUshanka = dress(RU, { hat: 'ushanka', coat: 'padded', legwear: 'boots', gear: 'light' }, { coat: '#4f4d3b', hat: '#6a5a46' });
const ruAssault = dress(RU, { hat: 'ssh40', coat: 'tunic', legwear: 'boots', gear: 'light', cuirass: true }, { kit2: '#7d8481' });
const ruMilitia = dress(RU, { hat: 'ushanka', coat: 'civil', legwear: 'puttees', gear: 'light' }, { coat: '#4d3e2f', legs: '#423e37', hat: '#6a5a46' });
const ruMilitia2 = dress(RU, { hat: 'pilotka', coat: 'civil', legwear: 'puttees', gear: 'light' }, { coat: '#585349', legs: '#3f3d38', hat: '#655c3c' });
const ruOfficer = dress(RU, { hat: 'furazhka', coat: 'tunic', legwear: 'boots', gear: 'officer' }, { hat: '#5f5637' });

/** The fill of each colour layer. */
export function layerFill(layer: Layer, c: Colors): string {
  switch (layer) {
    case 'backKit':
      return c.pack;
    case 'backMetal':
    case 'metal':
      return c.metal;
    case 'backWood':
    case 'wood':
      return c.wood;
    case 'farLeg':
      return darken(c.legs, 0.32);
    case 'farLegwear':
      return darken(c.legwear, 0.3);
    case 'farBoot':
    case 'boot':
      return c.boot;
    case 'farArm':
      return darken(c.coat, 0.32);
    case 'farHand':
      return darken(c.skin, 0.22);
    case 'legs':
      return c.legs;
    case 'legwear':
      return c.legwear;
    case 'coat':
      return c.coat;
    case 'pattern':
    case 'armPattern':
      return c.pattern;
    case 'pattern2':
      return c.pattern2;
    case 'kit':
      return c.kit;
    case 'kit2':
      return c.kit2;
    case 'brass':
      return '#b38a3c';
    case 'arm':
      return lighten(c.coat, 0.1);
    case 'skin':
      return c.skin;
    case 'skinShade':
      return darken(c.skin, 0.38);
    case 'hat':
      return c.hat;
    case 'hatMark':
      return c.hatMark;
    case 'accent':
      return c.accent;
    case 'gold':
      return '#d6ae48';
    case 'flame':
      return '#e8742a';
    case 'flameCore':
      return '#f8d35a';
    case 'light':
      return mix(c.hat, '#f4f0e0', 0.35);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Rosters

export interface Slot {
  x: number;
  y: number;
  s: number;
  fig: FigureSpec;
  dress: Dress;
  flip?: boolean;
}

const fig = (pose: PoseName, d: Dress, arm: Arm, extra?: Extra): { fig: FigureSpec; dress: Dress } => ({ fig: { pose, kit: d.kit, arm, extra }, dress: d });

type Man = ReturnType<typeof fig>;

/** Squad layout: one man behind in the middle, two in front. */
function squad(men: [Man, Man, Man]): Slot[] {
  return [
    { x: 1, y: -5.5, s: 1.04, ...men[0] },
    { x: -19, y: 0, s: 1.16, ...men[1] },
    { x: 19, y: 0, s: 1.16, ...men[2] },
  ];
}

function team(men: [Man, Man]): Slot[] {
  return [
    { x: -11, y: -3, s: 1.12, ...men[0] },
    { x: 11, y: 0, s: 1.18, ...men[1] },
  ];
}

function brokenSquad(d: Dress, d2: Dress, arm: Arm): Slot[] {
  return [
    { x: 0, y: -5.5, s: 1.04, flip: true, ...fig('fleeBare', d2, 'none') },
    { x: -18, y: 0, s: 1.16, flip: true, ...fig('flee', d, arm) },
    { x: 20, y: 0, s: 1.16, flip: true, ...fig('cower', d2, 'none') },
  ];
}

function brokenTeam(d: Dress, arm: Arm): Slot[] {
  return [
    { x: -10, y: -3, s: 1.12, flip: true, ...fig('flee', d, arm) },
    { x: 12, y: 0, s: 1.18, flip: true, ...fig('cower', d, 'none') },
  ];
}

/** A small stable hash of a name, to vary the leaders. */
function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

const NATION_ARMS: Record<Nation, { rifle: Arm; smg: Arm; lmg: Arm; plainRifle: Arm }> = {
  German: { rifle: 'k98', smg: 'mp40', lmg: 'mg42', plainRifle: 'k98' },
  American: { rifle: 'garand', smg: 'thompson', lmg: 'bar', plainRifle: 'garand' },
  Russian: { rifle: 'mosin', smg: 'ppsh', lmg: 'dp', plainRifle: 'mosinPlain' },
};

function squadKind(type: CounterType): string {
  return type.name.replace(/\s+(Squad|Team)$/i, '').toLowerCase();
}

function germanSquad(kind: string, broken: boolean): Slot[] {
  switch (kind) {
    case 'ss':
      return broken ? brokenSquad(deSS, deSS, 'stg44') : squad([fig('throw', deSS, 'stg44', 'stick'), fig('walk', deSS, 'stg44', 'panzerfaust'), fig('run', deSS, 'mp40')]);
    case 'fallschirmjager':
      return broken ? brokenSquad(deFJ, deFJ, 'fg42') : squad([fig('aim', deFJ, 'k98'), fig('run', deFJ, 'mp40'), fig('kneel', deFJ, 'fg42')]);
    case 'pionier':
      return broken ? brokenSquad(deRifle, deRifle, 'k98') : squad([fig('throw', deRifle, 'k98', 'bundle'), fig('run', deRifle, 'flameGun', 'flamer'), fig('kneel', deRifle, 'mp40')]);
    case 'elite rifle':
      return broken ? brokenSquad(deRifle, deRifle, 'mp40') : squad([fig('throw', deRifle, 'k98', 'stick'), fig('run', deRifle, 'mp40'), fig('kneel', deRifle, 'mg42')]);
    case 'volksgrenadier':
      return broken ? brokenSquad(deVG, deVGCap, 'stg44') : squad([fig('aim', deVG, 'stg44'), fig('walk', deVGCap, 'stg44'), fig('run', deVG, 'panzerfaust')]);
    case 'conscript':
      return broken ? brokenSquad(deCap, deLate, 'k98') : squad([fig('stand', deCap, 'k98'), fig('walk', deLate, 'k98'), fig('kneel', deCap, 'k98')]);
    default:
      // Rifle
      return broken ? brokenSquad(deRifle, deRifle, 'k98') : squad([fig('aim', deRifle, 'k98'), fig('walk', deRifle, 'k98'), fig('kneel', deRifle, 'mg42')]);
  }
}

function americanSquad(kind: string, broken: boolean): Slot[] {
  switch (kind) {
    case 'paratroop':
      return broken ? brokenSquad(usPara, usPara, 'thompson') : squad([fig('aim', usPara, 'garand'), fig('run', usPara, 'thompson'), fig('kneel', usPara, 'carbine')]);
    case 'engineer':
      return broken ? brokenSquad(usLight, usLine, 'garand') : squad([fig('aim', usLine, 'garand'), fig('sweep', usLight, 'garand'), fig('kneel', usLight, 'bazooka')]);
    case 'elite':
      return broken ? brokenSquad(usLight, usLine, 'thompson') : squad([fig('throw', usLight, 'garand', 'pineapple'), fig('run', usLine, 'thompson'), fig('kneel', usLight, 'bar')]);
    case 'green':
      return broken ? brokenSquad(usLine, usLight, 'garand') : squad([fig('stand', usLine, 'garand'), fig('walk', usLine, 'garand'), fig('kneel', usLight, 'carbine')]);
    default:
      // Line
      return broken ? brokenSquad(usLine, usLight, 'garand') : squad([fig('aim', usLine, 'garand'), fig('walk', usLine, 'garand'), fig('kneel', usLight, 'bar')]);
  }
}

function russianSquad(kind: string, broken: boolean): Slot[] {
  switch (kind) {
    case 'assault':
      return broken ? brokenSquad(ruAssault, ruAssault, 'ppsh') : squad([fig('throw', ruAssault, 'ppsh', 'pineapple'), fig('run', ruAssault, 'ppsh'), fig('kneel', ruAssault, 'ppsh')]);
    case 'guards smg':
      return broken
        ? brokenSquad(ruPaddedHelmet, ruPaddedHelmet, 'ppsh')
        : squad([fig('throw', ruPaddedHelmet, 'ppsh', 'pineapple'), fig('run', ruPaddedHelmet, 'ppsh'), fig('kneel', ruPaddedHelmet, 'ppsh')]);
    case 'guards rifle':
      return broken ? brokenSquad(ruRifle, ruRifle, 'mosin') : squad([fig('flag', ruRifle, 'mosin'), fig('run', ruRifle, 'mosin'), fig('kneel', ruRifle, 'dp')]);
    case 'smg':
      return broken ? brokenSquad(ruPadded, ruUshanka, 'ppsh') : squad([fig('aim', ruUshanka, 'ppsh'), fig('walk', ruPadded, 'ppsh'), fig('kneel', ruPadded, 'ppsh')]);
    case 'militia':
      return broken
        ? brokenSquad(ruMilitia, ruMilitia2, 'mosinPlain')
        : squad([fig('stand', ruMilitia, 'mosinPlain'), fig('walk', ruMilitia2, 'mosinPlain'), fig('kneel', ruMilitia, 'mosinPlain')]);
    default:
      // Rifle
      return broken ? brokenSquad(ruRifle, ruCap, 'mosin') : squad([fig('aim', ruRifle, 'mosin'), fig('walk', ruCap, 'mosin'), fig('kneel', ruRifle, 'dp')]);
  }
}

function teams(nation: Nation, kind: string, broken: boolean): Slot[] {
  const a = NATION_ARMS[nation];
  const line = nation === 'German' ? deRifle : nation === 'American' ? usLight : ruRifle;
  const green = nation === 'German' ? deCap : nation === 'American' ? usLine : ruCap;
  const elite = nation === 'German' ? deRifle : nation === 'American' ? usLight : ruPaddedHelmet;
  if (broken) return brokenTeam(kind === 'green' ? green : line, kind === 'elite' ? a.smg : a.rifle);
  switch (kind) {
    case 'weapon':
      return team([fig('carry', line, nation === 'German' ? 'mg42' : nation === 'American' ? 'bar' : 'dp', 'ammo'), fig('walk', line, a.rifle)]);
    case 'elite':
      return team([fig('run', elite, a.smg), fig('kneel', elite, a.lmg)]);
    case 'green':
      return team([fig('stand', green, a.plainRifle), fig('walk', green, a.plainRifle)]);
    default:
      return team([fig('walk', line, a.rifle), fig('kneel', line, nation === 'Russian' ? 'ppsh' : a.rifle)]);
  }
}

function leader(type: CounterType, broken: boolean): Slot[] {
  const nation = type.nation;
  const rank = (type.rank ?? '').toLowerCase();
  const officer = rank.startsWith('lt') || rank.startsWith('cpt') || rank.startsWith('capt') || rank.startsWith('maj');
  const h = hash(type.name);
  const d =
    nation === 'German' ? (officer ? deOfficer : deNco) : nation === 'American' ? (officer ? usOfficer : usNco) : officer ? ruOfficer : h % 2 ? ruCap : ruRifle;
  const smg: Arm = nation === 'German' ? 'mp40' : nation === 'American' ? (officer ? 'carbine' : 'thompson') : 'ppsh';
  if (broken) return [{ x: 4, y: 0, s: 1.2, flip: true, ...fig('flee', d, officer ? 'pistol' : smg) }];
  if (type.hero) {
    const hero = nation === 'German' ? deRifle : nation === 'American' ? usLight : ruPaddedHelmet;
    return [{ x: 2, y: 0, s: 1.16, ...fig('throw', hero, smg, nation === 'German' ? 'stick' : 'pineapple') }];
  }
  if (officer) {
    const poses: PoseName[] = nation === 'Russian' ? ['wave', 'binos'] : ['binos', 'point'];
    const pose = rank.startsWith('cpt') || rank.startsWith('capt') ? poses[1 - (nation === 'Russian' ? 1 : 0)] : poses[h % 2];
    return [{ x: 1, y: 0, s: 1.22, ...fig(pose, d, nation === 'American' ? 'carbine' : 'pistol') }];
  }
  const pose: PoseName = h % 3 === 0 ? 'wave' : 'point';
  return [{ x: 1, y: 0, s: 1.22, ...fig(pose, d, smg) }];
}

/** The figures of a unit counter, back rank first; feet at y = 0 of the figure area. */
export function rosterOf(type: CounterType, broken: boolean): Slot[] {
  const kind = squadKind(type);
  if (type.kind === 'squad') {
    if (type.nation === 'German') return germanSquad(kind, broken);
    if (type.nation === 'American') return americanSquad(kind, broken);
    return russianSquad(kind, broken);
  }
  if (type.kind === 'team') return teams(type.nation, kind, broken);
  return leader(type, broken);
}
