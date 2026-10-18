// Original vector art for the counters: the support weapon silhouettes (drawn in src/art/figures/weapons.ts), the rank
// insignia of the Leaders and the star. The soldiers themselves are built by the rig in src/art/figures.
import type { ReactNode } from 'react';
import type { CounterType, Nation } from '../engine/types';
import { mix } from './palette';
import { type WLayer, type WeaponArt, WFLAT, weaponFigure } from './figures/weapons';

export type { WeaponArt } from './figures/weapons';

const r1 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------------------------------------------------
// Support weapons (centred on 0,0, about 64 long, facing right)

/** The silhouette a weapon or radio counter shows, from its name (and weapon class as a fallback). */
export function weaponArt(type: CounterType): WeaponArt {
  const n = type.name.toLowerCase();
  if (type.kind === 'radio' || /radio/.test(n)) return 'radio';
  if (/\.50|50 ?cal/.test(n)) return 'hmg50';
  if (/hmg|heavy machine/.test(n)) return 'hmg';
  if (/mmg|medium machine/.test(n)) return 'mmg';
  if (/lmg|light machine/.test(n)) return 'lmg';
  if (/medium mortar/.test(n)) return 'mediumMortar';
  if (/mortar/.test(n)) return 'lightMortar';
  if (/flame/.test(n)) return 'flamethrower';
  if (/satchel/.test(n)) return 'satchel';
  if (/panzerfaust|bazooka|faust/.test(n)) return 'panzerfaust';
  if (/molotov/.test(n)) return 'molotov';
  if (/ig ?33|150|heavy/.test(n)) return 'heavyGun';
  if (/gun|howitzer|ig ?18/.test(n)) return 'gun';
  switch (type.weaponClass) {
    case 'mg':
      return 'lmg';
    case 'mortar':
      return 'lightMortar';
    case 'flamethrower':
      return 'flamethrower';
    case 'satchel':
      return 'satchel';
    case 'gun':
      return 'gun';
    default:
      return 'lmg';
  }
}


const PAINT: Record<Nation, { paint: string; canvas: string }> = {
  German: { paint: '#4a5049', canvas: '#6b6a52' },
  American: { paint: '#4c4a2e', canvas: '#8a7e55' },
  Russian: { paint: '#3f4b33', canvas: '#b9a77a' },
};

function weaponFill(layer: WLayer, nation: Nation, ink: string, bg: string): string {
  const p = PAINT[nation];
  switch (layer) {
    case 'far':
      return mix('#26292b', bg, 0.3);
    case 'farPaint':
      return mix(p.paint, bg, 0.3);
    case 'canvas':
      return p.canvas;
    case 'paint':
      return p.paint;
    case 'metal':
    case 'hub':
      return '#26292b';
    case 'steel':
      return '#5b6265';
    case 'wood':
    case 'wheelWood':
      return '#6a4527';
    case 'brass':
      return '#b38a3c';
    case 'tyre':
      return ink;
    case 'wheel':
      return p.paint;
    case 'hole':
      return bg;
    case 'flame':
      return '#e8742a';
    case 'flameCore':
      return '#f8d35a';
    case 'accent':
      return '#b0261c';
    case 'light':
      return mix(bg, '#ffffff', 0.35);
  }
}

/** A support weapon silhouette centred on (x, y), scale s, outlined in `ink` on the counter colour `bg`. */
export function WeaponSilhouette({ art, nation, x, y, s = 1, ink, bg }: { art: WeaponArt; nation: Nation; x: number; y: number; s?: number; ink: string; bg: string }) {
  const g = weaponFigure(art, nation);
  return (
    <g transform={`translate(${r1(x)} ${r1(y)}) scale(${s})`}>
      {g.layers.map((l) =>
        WFLAT.has(l.layer) ? (
          <path key={l.layer} d={l.d} fill={weaponFill(l.layer, nation, ink, bg)} />
        ) : (
          <path key={l.layer} d={l.d} fill={weaponFill(l.layer, nation, ink, bg)} stroke={ink} strokeWidth={1.3} strokeLinejoin="round" paintOrder="stroke" />
        ),
      )}
      {g.ink ? <path d={g.ink} fill="none" stroke={ink} strokeWidth={0.5} strokeLinecap="round" opacity={0.9} /> : null}
      {g.hi ? <path d={g.hi} fill="none" stroke={mix(bg, '#ffffff', 0.2)} strokeWidth={0.5} strokeLinecap="round" opacity={0.75} /> : null}
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Rank insignia (centred on 0,0)

export function RankInsignia({ rank, ink, x, y, s = 1 }: { rank: string | undefined; ink: string; x: number; y: number; s?: number }) {
  const r = (rank ?? '').toLowerCase();
  const chevron = (dy: number) => <path key={dy} d={`M-5 ${dy + 2.6} L0 ${dy - 1} L5 ${dy + 2.6}`} fill="none" stroke={ink} strokeWidth={1.9} strokeLinejoin="miter" />;
  let body: ReactNode = null;
  if (r.startsWith('pv')) body = chevron(0);
  else if (r.startsWith('cp') && r !== 'cpt') body = [chevron(-2.2), chevron(2.2)];
  else if (r.startsWith('sg')) body = [chevron(-4.2), chevron(0), chevron(4.2)];
  else if (r.startsWith('lt')) body = <rect x={-1.6} y={-5} width={3.2} height={10} rx={0.6} fill={ink} />;
  else if (r.startsWith('cpt') || r.startsWith('capt'))
    body = (
      <>
        <rect x={-4} y={-5} width={3} height={10} rx={0.6} fill={ink} />
        <rect x={1} y={-5} width={3} height={10} rx={0.6} fill={ink} />
      </>
    );
  else if (r.startsWith('maj')) body = <path d="M0 -5.5 L4.5 0 L0 5.5 L-4.5 0 Z" fill={ink} />;
  if (!body) return null;
  return <g transform={`translate(${x} ${y}) scale(${s})`}>{body}</g>;
}

/** Five-pointed star centred on (x, y) with outer radius r. */
export function starPath(x: number, y: number, r: number, inner = 0.42): string {
  const pts: string[] = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 === 0 ? r : r * inner;
    pts.push(`${r1(x + Math.cos(a) * rr)} ${r1(y + Math.sin(a) * rr)}`);
  }
  return `M${pts.join(' L')} Z`;
}
