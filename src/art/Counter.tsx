// Square cardboard counters for units (Squads, Teams, Leaders, Heroes), Weapons and Radios. Everything is drawn in a
// 100 x 100 unit frame; `Counter` wraps it in an <svg> of `size` px (shadow and selection glow fit inside), `CounterG`
// places it inside another SVG (the board) centred on (x, y). Weapons and Radios are smaller squares (WEAPON_SCALE).
//
// Unit layout (classic squad counter): name / troop quality top left, Morale top right, the men in the middle (three in
// a Squad, two in a Team, one Leader; drawn by the rig in ./figures in their nation's and squad kind's kit), Firepower -
// Range - Movement along the bottom (boxed values boxed). Leaders: Command in a hexagon top left, rank insignia below
// it, name at the top. Broken side: red bar across the top, thin red frame, white Morale, broken values, men fleeing
// and cowering. Suppressed (orange tab) and Veteran (gold-edged shield) badges sit on the right edge.
import type { ReactNode } from 'react';
import type { CounterType, SideStats } from '../engine/types';
import { FONT, INK, NATION, QUALITY, darken, lighten, mix, type NationPalette } from './palette';
import { RankInsignia, WeaponSilhouette, starPath, weaponArt } from './silhouettes';
import { Figure } from './figures/Figure';
import { rosterOf } from './figures/dress';
import { fit, textWidth } from './text';

/** Weapons and Radios are drawn this much smaller than unit counters. */
export const WEAPON_SCALE = 0.78;
/** Margin (in counter units) the <svg> of `Counter` keeps around the 100-unit body for the shadow and the glow. */
const PAD = 6;

export interface CounterProps {
  type: CounterType;
  broken?: boolean;
  suppressed?: boolean;
  veteran?: boolean;
  /** Side of a unit counter in px (weapons and radios come out WEAPON_SCALE of it). */
  size?: number;
  selected?: boolean;
  dim?: boolean;
}

export const isSupport = (type: CounterType) => type.kind === 'weapon' || type.kind === 'radio';

/** Side length in px of the counter `Counter` draws for this type at `size`. */
export function counterPixelSize(type: CounterType, size = 64): number {
  return isSupport(type) ? Math.round(size * WEAPON_SCALE) : size;
}

/** The counter as a standalone <svg>. */
export function Counter({ type, broken = false, suppressed, veteran, size = 64, selected, dim }: CounterProps) {
  const px = counterPixelSize(type, size);
  return (
    <svg
      width={px}
      height={px}
      viewBox={`${-PAD} ${-PAD} ${100 + 2 * PAD} ${100 + 2 * PAD}`}
      role="img"
      aria-label={counterLabel(type, broken)}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <CounterBody type={type} broken={broken} suppressed={suppressed} veteran={veteran} selected={selected} dim={dim} />
    </svg>
  );
}

/** The counter inside an SVG, centred on (x, y); `size` is a unit counter's side in the parent's units. */
export function CounterG({ x, y, size = 64, ...p }: CounterProps & { x: number; y: number }) {
  const side = isSupport(p.type) ? size * WEAPON_SCALE : size;
  const k = side / 100;
  return (
    <g transform={`translate(${r2(x - side / 2)} ${r2(y - side / 2)}) scale(${r2(k * 1000) / 1000})`}>
      <CounterBody broken={false} {...p} />
    </g>
  );
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** "German Rifle Squad", "American Lt Wray (broken)". */
export function counterLabel(type: CounterType, broken = false): string {
  return `${type.nation} ${type.name}${broken ? ' (broken)' : ''}`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Shared pieces

/** The cardboard square: shadow, face, bevel, outline, optional selection glow. */
export function Plate({ fill, light, dark, selected, children }: { fill: string; light: string; dark: string; selected?: boolean; children?: ReactNode }) {
  return (
    <>
      {selected ? (
        <>
          <rect x={-4.5} y={-4.5} width={109} height={109} rx={10} fill="none" stroke={INK.select} strokeWidth={6} opacity={0.45} />
          <rect x={-2.2} y={-2.2} width={104.4} height={104.4} rx={8.5} fill="none" stroke={INK.select} strokeWidth={2.6} />
        </>
      ) : null}
      <rect x={1.8} y={2.8} width={100} height={100} rx={7} fill="#000" opacity={0.34} />
      <rect x={0} y={0} width={100} height={100} rx={7} fill={fill} />
      {children}
      {/* bevel: lit top and left edge, shaded bottom and right edge */}
      <path d="M2.4 95 L2.4 9 Q2.4 2.4 9 2.4 L95 2.4" fill="none" stroke={light} strokeWidth={2.4} opacity={0.85} />
      <path d="M97.6 6 L97.6 91 Q97.6 97.6 91 97.6 L5 97.6" fill="none" stroke={dark} strokeWidth={2.4} opacity={0.75} />
      <rect x={0.5} y={0.5} width={99} height={99} rx={6.6} fill="none" stroke={darken(dark, 0.45)} strokeWidth={1.1} />
    </>
  );
}

/** A face colour with the faint printed-card mottling (a lighter upper-left wash). */
function Wash({ color }: { color: string }) {
  return <path d="M0 7 Q0 0 7 0 L70 0 Q40 22 0 58 Z" fill={lighten(color, 0.5)} opacity={0.16} />;
}

/** Red top bar of a broken side (or the white Ordnance band); `h` tall. */
function TopBar({ fill, h }: { fill: string; h: number }) {
  return <path d={`M0 ${h} L0 7 Q0 0 7 0 L93 0 Q100 0 100 7 L100 ${h} Z`} fill={fill} />;
}

function Num({ x, y, v, size, fill, anchor = 'middle', weight = 600 }: { x: number; y: number; v: string | number; size: number; fill: string; anchor?: 'start' | 'middle' | 'end'; weight?: number }) {
  return (
    <text x={x} y={y} fontFamily={FONT.title} fontWeight={weight} fontSize={size} fill={fill} textAnchor={anchor}>
      {v}
    </text>
  );
}

/** One value of the bottom row, boxed when the counter prints it boxed. */
function Stat({ x, v, boxed, fill, y = 94.5, size = 25 }: { x: number; v: string | number; boxed: boolean; fill: string; y?: number; size?: number }) {
  const s = String(v);
  const w = Math.max(19, s.length * size * 0.5 + 6);
  return (
    <g>
      {boxed ? <rect x={x - w / 2} y={y - size * 0.86} width={w} height={size * 0.98} rx={1.5} fill="none" stroke={fill} strokeWidth={2.1} /> : null}
      <Num x={x} y={y} v={s} size={size} fill={fill} />
    </g>
  );
}

/** Suppressed: an orange tab with pinned-down chevrons (−1 to everything). */
export function SuppressedBadge({ x, y }: { x: number; y: number }) {
  const c = INK.suppressed;
  return (
    <g>
      <rect x={x - 9} y={y - 9.5} width={18} height={19} rx={3.6} fill={c} stroke={darken(c, 0.55)} strokeWidth={1.3} />
      <rect x={x - 7.4} y={y - 7.9} width={14.8} height={3} rx={1.5} fill={lighten(c, 0.35)} opacity={0.7} />
      <path d={`M${x - 5.6} ${y - 4.4} L${x} ${y + 0.2} L${x + 5.6} ${y - 4.4} M${x - 5.6} ${y + 1.2} L${x} ${y + 5.8} L${x + 5.6} ${y + 1.2}`} fill="none" stroke="#fff" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
    </g>
  );
}

/** Veteran: a green shield edged in gold with a gold star (+1 to everything). */
export function VeteranBadge({ x, y }: { x: number; y: number }) {
  const d = `M${x - 8.6} ${y - 9.6} L${x + 8.6} ${y - 9.6} L${x + 8.6} ${y + 1.2} C${x + 8.6} ${y + 6.4} ${x + 4} ${y + 9.2} ${x} ${y + 11} C${x - 4} ${y + 9.2} ${x - 8.6} ${y + 6.4} ${x - 8.6} ${y + 1.2} Z`;
  return (
    <g>
      <path d={d} fill={INK.veteran} stroke={darken(INK.goldDark, 0.25)} strokeWidth={1.3} strokeLinejoin="round" />
      <path d={d} fill="none" stroke={INK.gold} strokeWidth={1.4} transform={`translate(${x} ${y}) scale(0.8) translate(${-x} ${-y})`} />
      <path d={starPath(x, y + 0.2, 6.4)} fill={INK.gold} stroke={darken(INK.goldDark, 0.2)} strokeWidth={0.6} />
    </g>
  );
}

/** Suppressed and Veteran badges along the right edge. */
function StateBadges({ suppressed, veteran }: { suppressed?: boolean; veteran?: boolean }) {
  return (
    <>
      {suppressed ? <SuppressedBadge x={88.6} y={39.5} /> : null}
      {veteran ? <VeteranBadge x={88.6} y={suppressed ? 60.5 : 40} /> : null}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Names

const SHORT: Record<string, string> = {
  Fallschirmjager: 'Fallschirm.',
  Volksgrenadier: 'Volksgren.',
  'Elite Rifle': 'Elite Rifle',
  'Guards Rifle': 'Gds Rifle',
  'Guards SMG': 'Gds SMG',
};

/** The label printed on a Squad / Team counter ("Rifle", "Fallschirm.", "Weapon"). */
export function unitLabel(type: CounterType): string {
  const base = type.name.replace(/\s+(Squad|Team)$/i, '');
  return SHORT[base] ?? base;
}

/** A Leader's surname without rank or "(Hero)". */
export function leaderName(type: CounterType): string {
  let n = type.name.replace(/\s*\(hero\)\s*/i, '').trim();
  if (type.rank && n.toLowerCase().startsWith(type.rank.toLowerCase() + ' ')) n = n.slice(type.rank.length + 1);
  return n;
}

/** The label of a Weapon / Radio counter ("LMG", "Lt Mortar", "Radio"). */
export function weaponLabel(type: CounterType): string {
  const n = type.name;
  if (type.kind === 'radio') return 'Radio';
  if (/^\.50/.test(n)) return '.50 Cal';
  return n
    .replace(/Light Mortar/i, 'Lt Mortar')
    .replace(/Medium Mortar/i, 'Med Mortar')
    .replace(/ Gun$/i, '')
    .replace(/Infantry/i, 'Inf Gun')
    .replace(/Pack Howitzer/i, 'Pack How.')
    .replace(/Flamethrower/i, 'Flamethr.')
    .replace(/Satchel Charge/i, 'Satchel')
    .replace(/Molotov Cocktail/i, 'Molotov');
}

/** "75mm" from "Radio:75mm". */
export function radioCalibre(type: CounterType): string {
  const m = /(\d+\s*mm)/i.exec(type.name);
  return m ? m[1].replace(/\s+/g, '') : '';
}

// ---------------------------------------------------------------------------------------------------------------------
// Bodies

/** The thin red frame inside the edge of a broken side. */
function BrokenFrame() {
  return <rect x={2.6} y={2.6} width={94.8} height={94.8} rx={5} fill="none" stroke={INK.broken} strokeWidth={2.2} />;
}

export function CounterBody({ type, broken = false, suppressed, veteran, selected, dim }: Omit<CounterProps, 'size'>) {
  const pal = NATION[type.nation];
  const body = isSupport(type) ? (
    <SupportFace type={type} broken={broken} pal={pal} />
  ) : type.kind === 'leader' ? (
    <LeaderFace type={type} broken={broken} pal={pal} />
  ) : (
    <UnitFace type={type} broken={broken} pal={pal} />
  );
  return (
    <g opacity={dim ? 0.42 : undefined}>
      <Plate fill={isSupport(type) ? pal.weapon : pal.base} light={pal.light} dark={pal.dark} selected={selected}>
        {body}
        {broken && !isSupport(type) ? <BrokenFrame /> : null}
      </Plate>
      <StateBadges suppressed={suppressed} veteran={veteran} />
    </g>
  );
}

function Figures({ type, broken, pal, cx, base }: { type: CounterType; broken: boolean; pal: NationPalette; cx: number; base: number }) {
  return (
    <g>
      {rosterOf(type, broken).map((f, i) => (
        <Figure key={i} spec={f.fig} colors={f.dress.colors} x={cx + f.x} y={base + f.y} s={f.s} flip={f.flip} ink={pal.ink} halo={pal.base} />
      ))}
    </g>
  );
}

function StatsRow({ st, fill }: { st: SideStats; fill: string }) {
  return (
    <>
      <Stat x={18} v={st.fp} boxed={st.boxed.fp} fill={fill} />
      <Stat x={50} v={st.range} boxed={st.boxed.range} fill={fill} />
      <Stat x={82} v={st.move} boxed={st.boxed.move} fill={fill} />
    </>
  );
}

function UnitFace({ type, broken, pal }: { type: CounterType; broken: boolean; pal: NationPalette }) {
  const st = broken ? type.broken : type.front;
  const label = unitLabel(type).toUpperCase();
  const q = type.quality ? QUALITY[type.quality] : null;
  const ls = 11;
  const lw = Math.min(58, label.length * ls * 0.5 + 9);
  return (
    <>
      <Wash color={pal.base} />
      {broken ? <TopBar fill={INK.broken} h={27} /> : null}
      <Figures type={type} broken={broken} pal={pal} cx={broken ? 50 : 48} base={broken ? 70 : 69} />
      {q ? (
        <rect x={5.5} y={5.5} width={lw} height={14.5} rx={3.5} fill={q.fill} stroke={broken ? '#fff' : q.edge} strokeWidth={1} />
      ) : null}
      <text
        x={q ? 5.5 + lw / 2 : 7}
        y={16.6}
        fontFamily={FONT.title}
        fontWeight={600}
        fontSize={ls}
        letterSpacing={0.2}
        textAnchor={q ? 'middle' : 'start'}
        fill={q ? (type.quality === 'green' ? '#fff' : INK.black) : broken ? '#fff' : pal.text}
        {...fit(label, ls, lw - 6, 'title', 0.2)}
      >
        {label}
      </text>
      <Num x={94} y={24.5} v={st.morale} size={27} fill={broken ? '#fff' : pal.text} anchor="end" />
      <StatsRow st={st} fill={pal.text} />
    </>
  );
}

/** Flat-topped hexagon of radius r centred on (x, y). */
function hexPath(x: number, y: number, r: number): string {
  const pts: string[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    pts.push(`${r2(x + Math.cos(a) * r)} ${r2(y + Math.sin(a) * r)}`);
  }
  return `M${pts.join(' L')} Z`;
}

function LeaderFace({ type, broken, pal }: { type: CounterType; broken: boolean; pal: NationPalette }) {
  const st = broken ? type.broken : type.front;
  const name = leaderName(type).replace(/^von /i, 'v. ').toUpperCase();
  const hero = !!type.hero;
  const ns = 11.5;
  // the name sits between the Command hexagon and the Morale (two-digit Morale leaves less room)
  const left = 30.5;
  const right = 94 - textWidth(String(st.morale), 27) - 2.5;
  const ink = broken ? '#fff' : pal.text;
  return (
    <>
      <Wash color={pal.base} />
      {broken ? <TopBar fill={INK.broken} h={27} /> : null}
      {hero ? <rect x={4} y={4} width={92} height={92} rx={4.5} fill="none" stroke={INK.gold} strokeWidth={2.6} /> : null}
      <Figures type={type} broken={broken} pal={pal} cx={56} base={broken ? 70 : 69} />
      {/* Command hexagon */}
      <path d={hexPath(17, 16.5, 12.5)} fill={hero ? INK.gold : INK.paper} stroke={darken(pal.dark, 0.4)} strokeWidth={1.5} />
      <Num x={17} y={23.2} v={st.command} size={18} fill={INK.black} />
      {hero ? (
        <>
          <path d={starPath(16, 42, 8.5)} fill={INK.gold} stroke={darken(INK.goldDark, 0.3)} strokeWidth={1} />
          <text x={16} y={59.5} fontFamily={FONT.title} fontWeight={600} fontSize={9} fill={pal.text} textAnchor="middle" letterSpacing={0.4}>
            HERO
          </text>
        </>
      ) : (
        <>
          <RankInsignia rank={type.rank} ink={pal.text} x={16} y={40.5} s={1.15} />
          <text x={16} y={59.5} fontFamily={FONT.title} fontWeight={600} fontSize={9} fill={pal.text} textAnchor="middle" letterSpacing={0.4}>
            {(type.rank ?? '').toUpperCase()}
          </text>
        </>
      )}
      <text x={(left + right) / 2} y={17.5} fontFamily={FONT.title} fontWeight={600} fontSize={ns} fill={ink} textAnchor="middle" {...fit(name, ns, right - left)}>
        {name}
      </text>
      <Num x={94} y={24.5} v={st.morale} size={27} fill={ink} anchor="end" />
      <StatsRow st={st} fill={pal.text} />
    </>
  );
}

const range = (r: [number, number] | undefined) => (r && r[0] <= r[1] ? (r[0] === r[1] ? `${r[0]}` : `${r[0]}–${r[1]}`) : '–');

/** A small cloud: the "Smoke" capability mark (top right of a weapon or radio counter). */
function SmokeMark({ x, y, ink }: { x: number; y: number; ink: string }) {
  return (
    <path
      d={`M${x - 9} ${y + 4.5} a4 4 0 0 1 1.5 -7.6 a5.2 5.2 0 0 1 9.6 -1.8 a4.2 4.2 0 0 1 6.6 3.4 a3.2 3.2 0 0 1 -0.6 6 Z`}
      fill="#f1efe9"
      stroke={ink}
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
  );
}

/** Weapon Movement penalty: white on a red tag, bottom right. */
function Penalty({ v }: { v: number }) {
  return (
    <g>
      <rect x={75} y={73.5} width={21.5} height={23} rx={3.5} fill={INK.penalty} />
      <Num x={85.75} y={92.4} v={`${v}`.replace('-', '−')} size={20} fill="#fff" />
    </g>
  );
}

function SupportFace({ type, broken, pal }: { type: CounterType; broken: boolean; pal: NationPalette }) {
  const radio = type.kind === 'radio';
  const st = type.front;
  const label = (radio ? radioCalibre(type) || 'Radio' : weaponLabel(type)).toUpperCase();
  const band = broken ? INK.broken : type.ordnance ? INK.ordnance : null;
  const ls = 15;
  const labelInk = broken ? '#fff' : pal.text;
  const art = weaponArt(type);
  return (
    <>
      <Wash color={pal.weapon} />
      {band ? <TopBar fill={band} h={23} /> : null}
      {type.ordnance && !broken ? <path d="M0 23 L100 23" stroke={mix(pal.dark, '#000', 0.2)} strokeWidth={0.8} opacity={0.6} /> : null}
      <text x={7} y={17.5} fontFamily={FONT.title} fontWeight={600} fontSize={ls} fill={labelInk} {...fit(label, ls, type.smoke ? 62 : 86)}>
        {label}
      </text>
      {type.smoke ? <SmokeMark x={87} y={10} ink={pal.text} /> : null}
      <g opacity={broken ? 0.45 : 1}>
        <WeaponSilhouette art={art} nation={type.nation} x={radio ? 46 : 50} y={radio ? 50 : 49} s={radio ? 1.22 : 1.27} ink={pal.ink} bg={pal.weapon} />
      </g>
      {broken ? (
        <BrokenRanges radio={radio} type={type} ink={pal.text} />
      ) : radio ? (
        <>
          <Stat x={18} v={st.fp} boxed={false} fill={pal.text} />
          <text x={64} y={92} fontFamily={FONT.title} fontWeight={600} fontSize={12} fill={pal.text} textAnchor="middle" letterSpacing={0.5}>
            RADIO
          </text>
        </>
      ) : (
        <>
          <Stat x={18} v={st.fp} boxed={st.boxed.fp} fill={pal.text} />
          <Stat x={type.minRange ? 48 : 50} v={type.minRange ? `${type.minRange}-${st.range}` : st.range} boxed={st.boxed.range} fill={pal.text} size={type.minRange ? 22 : 25} />
          {st.move ? <Penalty v={st.move} /> : null}
        </>
      )}
    </>
  );
}

function BrokenRanges({ radio, type, ink }: { radio: boolean; type: CounterType; ink: string }) {
  const rows: [string, string, string][] = radio
    ? [
        ['FIX', 'ART. REQUEST', '#2d6a2f'],
        ['ELIM', 'ART. DENIED', INK.broken],
      ]
    : [
        ['FIX', range(type.fix), '#2d6a2f'],
        ['ELIM', range(type.elim), INK.broken],
      ];
  const vs = radio ? 11 : 17;
  return (
    <>
      {rows.map(([k, v, c], i) => (
        <g key={k}>
          <text x={7} y={78 + i * 17} fontFamily={FONT.title} fontWeight={600} fontSize={11} fill={c} letterSpacing={0.5}>
            {k}
          </text>
          <text x={radio ? 36 : 40} y={79 + i * 17} fontFamily={FONT.title} fontWeight={600} fontSize={vs} fill={ink} {...fit(v, vs, 58)}>
            {v}
          </text>
        </g>
      ))}
    </>
  );
}
