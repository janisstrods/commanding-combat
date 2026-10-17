// Fate card faces and backs. Original layout: a nation-coloured frame; the Order bar on top (Fire cards marked
// "Order / Action"); the Action and the Event, each with its name and our short paraphrase (src/data/card-texts.ts);
// along the bottom the two dice (white and red), the trigger box when the card has one, and the Random Hex.
// Drawn in a 120 x 170 frame; 'md' is 1:1 (readable names, dice, trigger and hex), 'lg' doubles it for hover.
import { useId, type ReactNode } from 'react';
import type { FateCard, Nation, OrderName, Trigger } from '../engine/types';
import { label as hexLabel } from '../engine/hex';
import { ACTION_TEXT, EVENT_TEXT } from '../data/card-texts';
import { FONT, INK, NATION, darken, lighten, mix } from './palette';
import { fit, fitWrap } from './text';

export type CardSize = 'sm' | 'md' | 'lg';
export type CardPart = 'order' | 'action' | 'event';

export const CARD_SIZE: Record<CardSize, { w: number; h: number }> = {
  sm: { w: 84, h: 119 },
  md: { w: 120, h: 170 },
  lg: { w: 240, h: 340 },
};

const W = 120;
const H = 170;

export interface FateCardViewProps {
  card: FateCard;
  size?: CardSize;
  /** The part being used: it is outlined and the other parts are faded. */
  highlight?: CardPart | null;
  faceDown?: boolean;
  /** Print the Action / Event texts (default: true). */
  texts?: boolean;
}

export function FateCardView({ card, size = 'md', highlight = null, faceDown = false, texts = true }: FateCardViewProps) {
  if (faceDown) return <CardBack nation={card.nation} size={size} />;
  const { w, h } = CARD_SIZE[size];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={cardLabel(card)} style={{ display: 'block' }}>
      <CardFace card={card} highlight={highlight} texts={texts} />
    </svg>
  );
}

/** "G-21: Move / Crossfire / Blaze". */
export function cardLabel(card: FateCard): string {
  return `${card.id}: ${card.order} / ${card.action} / ${card.event}`;
}

// ---------------------------------------------------------------------------------------------------------------------

const TRIGGER_LOOK: Record<Trigger, { fill: string; text: string; label: string }> = {
  Jammed: { fill: '#7a1d14', text: '#fff3e6', label: 'JAMMED!' },
  Sniper: { fill: '#1d1d1b', text: '#fff', label: 'SNIPER!' },
  Event: { fill: '#c08a1e', text: '#1d1405', label: 'EVENT!' },
  Time: { fill: '#2f455e', text: '#fff', label: 'TIME!' },
};

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]],
};

/** A die face showing `v`, top-left at (x, y), `s` wide. */
export function Die({ x, y, s, v, fill, pip, edge }: { x: number; y: number; s: number; v: number; fill: string; pip: string; edge: string }) {
  return (
    <g>
      <rect x={x + 0.8} y={y + 1.2} width={s} height={s} rx={s * 0.2} fill="#000" opacity={0.22} />
      <rect x={x} y={y} width={s} height={s} rx={s * 0.2} fill={fill} stroke={edge} strokeWidth={0.9} />
      {(PIPS[v] ?? []).map(([px, py], i) => (
        <circle key={i} cx={x + px * s} cy={y + py * s} r={s * 0.095} fill={pip} />
      ))}
    </g>
  );
}

function hexPath(x: number, y: number, r: number): string {
  const pts: string[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    pts.push(`${(x + Math.cos(a) * r).toFixed(2)} ${(y + Math.sin(a) * r).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
}

/** Small white pictogram of each Order, centred on (0, 0), about 14 units. */
function OrderIcon({ order, ink }: { order: OrderName; ink: string }) {
  const st = { fill: 'none', stroke: ink, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (order) {
    case 'Fire':
      return (
        <g {...st}>
          <circle r={5.6} />
          <path d="M0 -8.5 L0 -3 M0 3 L0 8.5 M-8.5 0 L-3 0 M3 0 L8.5 0" />
        </g>
      );
    case 'Move':
      return <path d="M-7 0 L6 0 M1.5 -5 L6.5 0 L1.5 5" {...st} strokeWidth={2.2} />;
    case 'Advance':
      return <path d="M-7 -5.5 L-1.5 0 L-7 5.5 M0 -5.5 L5.5 0 L0 5.5" {...st} strokeWidth={2.2} />;
    case 'Recover':
      return <path d="M0 -6.5 L0 6.5 M-6.5 0 L6.5 0" {...st} strokeWidth={3} />;
    case 'Rout':
      return <path d="M6 -5 C1 -5 -4 -4 -4 3 M-7.5 0 L-4 4.5 L-0.5 0" {...st} strokeWidth={2.1} />;
    case 'Artillery Request':
      return <path d="M0 -8 C3 -5 3.2 -1 3.2 3 L3.2 6.5 L-3.2 6.5 L-3.2 3 C-3.2 -1 -3 -5 0 -8 Z" fill={ink} />;
    case 'Artillery Denied':
      return (
        <g>
          <path d="M0 -8 C3 -5 3.2 -1 3.2 3 L3.2 6.5 L-3.2 6.5 L-3.2 3 C-3.2 -1 -3 -5 0 -8 Z" fill={ink} opacity={0.75} />
          <path d="M-7 -7 L7 7" {...st} strokeWidth={2.2} />
        </g>
      );
    case 'Command Confusion':
      return (
        <text x={0} y={5.5} fontFamily={FONT.title} fontWeight={600} fontSize={16} fill={ink} textAnchor="middle">
          ?
        </text>
      );
  }
}

/** Breeze wind arrow: points to the card's compass direction (1 = map north, clockwise). */
function WindArrow({ x, y, dir, ink }: { x: number; y: number; dir: number; ink: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={7} fill="none" stroke={ink} strokeWidth={0.8} opacity={0.6} />
      <g transform={`rotate(${(dir - 1) * 60})`}>
        <path d="M0 5 L0 -3.5" stroke={ink} strokeWidth={1.6} strokeLinecap="round" />
        <path d="M-3 -2 L0 -6 L3 -2 Z" fill={ink} />
      </g>
    </g>
  );
}

const SECTION = {
  order: { x: 4, y: 4, w: 112, h: 27 },
  action: { x: 4, y: 32, w: 112, h: 57 },
  event: { x: 4, y: 90, w: 112, h: 47 },
};

/** Where the Action and Event texts go (card units) and the font sizes they may shrink through. */
export const TEXT_BOX = {
  action: { x: 9, y: 59.5, bottom: 86, width: 102 },
  event: { x: 9, y: 117.5, bottom: 135, width: 102 },
} as const;
const TEXT_SIZES = [6.2, 5.8, 5.4, 5.1, 4.8];
const LINE_HEIGHT = 1.2;

/** Font size and lines of an Action / Event text; `fits` is false when even the smallest size overflows its box. */
export function cardTextLayout(text: string, part: 'action' | 'event'): { size: number; lines: string[]; fits: boolean } {
  const b = TEXT_BOX[part];
  const maxLines = (s: number) => Math.floor((b.bottom - b.y + s) / (s * LINE_HEIGHT));
  const { size, lines } = fitWrap(text, b.width, TEXT_SIZES, maxLines);
  return { size, lines, fits: lines.length <= maxLines(size) };
}

function TextBlock({ text, part, ink }: { text: string; part: 'action' | 'event'; ink: string }) {
  const b = TEXT_BOX[part];
  const { size, lines } = cardTextLayout(text, part);
  return (
    <text x={b.x} y={b.y} fontFamily={FONT.body} fontSize={size} fill={ink}>
      {lines.map((l, i) => (
        <tspan key={i} x={b.x} dy={i === 0 ? 0 : size * LINE_HEIGHT}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

export function CardFace({ card, highlight = null, texts = true }: { card: FateCard; highlight?: CardPart | null; texts?: boolean }) {
  const pal = NATION[card.nation];
  const cc = card.order === 'Command Confusion';
  const barFill = cc ? '#6c6860' : pal.frameDark;
  const paper = INK.paper;
  const smallCaps = { fontFamily: FONT.title, fontWeight: 600, letterSpacing: 0.7 } as const;
  const orderName = card.order.toUpperCase();
  const actionCC = card.action === 'Command Confusion';
  const trig = card.trigger ? TRIGGER_LOOK[card.trigger] : null;
  const fade = (part: CardPart) => (highlight && highlight !== part ? <SectionFade part={part} /> : null);
  return (
    <g>
      {/* frame and paper */}
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={7} fill={pal.frame} stroke={darken(pal.frameDark, 0.3)} strokeWidth={1} />
      <rect x={2} y={2} width={W - 4} height={H - 4} rx={5.6} fill="none" stroke={pal.frameLight} strokeWidth={0.7} opacity={0.8} />
      <rect x={4} y={4} width={112} height={162} rx={4} fill={paper} />
      <path d="M4 60 Q60 40 116 70 L116 166 L4 166 Z" fill={INK.paperDark} opacity={0.18} />

      {/* Order */}
      <path d="M4 31 L4 8 Q4 4 8 4 L112 4 Q116 4 116 8 L116 31 Z" fill={barFill} />
      {cc ? <path d="M4 31 L4 8 Q4 4 8 4 L112 4 Q116 4 116 8 L116 31 Z" fill="none" stroke="#fff" strokeOpacity={0.08} strokeWidth={6} strokeDasharray="2 4" /> : null}
      <text x={9} y={12.6} {...smallCaps} fontSize={5.6} fill={lighten(barFill, 0.55)}>
        {card.fireIsAction ? 'ORDER / ACTION' : cc ? 'NO ORDER' : 'ORDER'}
      </text>
      <text x={9} y={26.6} fontFamily={FONT.title} fontWeight={600} fontSize={cc ? 11.5 : 14} fill={paper} letterSpacing={0.4} {...fit(orderName, cc ? 11.5 : 14, 86, 'title', 0.4)}>
        {orderName}
      </text>
      <g transform="translate(105 17.5)">
        <OrderIcon order={card.order} ink={paper} />
      </g>
      {fade('order')}

      {/* Action */}
      <text x={9} y={40} {...smallCaps} fontSize={5.6} fill={pal.frame}>
        ACTION
      </text>
      {card.defenderOnly ? (
        <g>
          <rect x={72} y={34.6} width={40} height={7.6} rx={2} fill={INK.broken} />
          <text x={92} y={40.3} {...smallCaps} letterSpacing={0.4} fontSize={5.2} fill="#fff" textAnchor="middle">
            DEFENDER ONLY
          </text>
        </g>
      ) : null}
      <text x={9} y={51.5} fontFamily={FONT.title} fontWeight={600} fontSize={11.5} fill={actionCC ? INK.paperSoft : INK.paperInk} {...fit(card.action.toUpperCase(), 11.5, 102)}>
        {card.action.toUpperCase()}
      </text>
      {texts ? <TextBlock text={ACTION_TEXT[card.action]} part="action" ink={INK.paperInk} /> : null}
      {fade('action')}
      <path d="M9 89.5 L111 89.5" stroke={pal.frameLight} strokeWidth={0.8} />

      {/* Event */}
      <text x={9} y={98} {...smallCaps} fontSize={5.6} fill={pal.frame}>
        EVENT
      </text>
      <text x={9} y={109.5} fontFamily={FONT.title} fontWeight={600} fontSize={11.5} fill={INK.paperInk} {...fit(card.event.toUpperCase(), 11.5, card.breeze ? 86 : 102)}>
        {card.event.toUpperCase()}
      </text>
      {card.breeze ? <WindArrow x={105} y={105} dir={card.breeze} ink={INK.paperInk} /> : null}
      {texts ? <TextBlock text={EVENT_TEXT[card.event]} part="event" ink={INK.paperInk} /> : null}
      {fade('event')}

      {/* dice, trigger, random hex */}
      <path d="M4 137.5 L116 137.5" stroke={pal.frameLight} strokeWidth={0.8} />
      <Die x={9} y={142} s={19} v={card.white} fill="#fbfaf5" pip="#1c1c1a" edge="#6b675c" />
      <Die x={31} y={142} s={19} v={card.red} fill="#c0281f" pip="#fff" edge="#6e130e" />
      {trig ? (
        <g>
          <rect x={54} y={143.5} width={33} height={16} rx={2.5} fill={trig.fill} />
          <text x={70.5} y={154.6} fontFamily={FONT.title} fontWeight={600} fontSize={8.6} fill={trig.text} textAnchor="middle" letterSpacing={0.3} {...fit(trig.label, 8.6, 29, 'title', 0.3)}>
            {trig.label}
          </text>
        </g>
      ) : null}
      <path d={hexPath(102, 151.5, 12)} fill={mix(paper, pal.frameLight, 0.35)} stroke={pal.frameDark} strokeWidth={1.2} />
      <text x={102} y={155.6} fontFamily={FONT.title} fontWeight={600} fontSize={11.5} fill={INK.paperInk} textAnchor="middle">
        {hexLabel(card.hex)}
      </text>
      <text x={60} y={168.6} fontFamily={FONT.body} fontSize={3.6} fill={lighten(pal.frame, 0.6)} textAnchor="middle">
        {card.id}
      </text>

      {highlight ? <SectionGlow part={highlight} /> : null}
    </g>
  );
}

function SectionFade({ part }: { part: CardPart }) {
  const r = SECTION[part];
  return <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={INK.paper} opacity={0.62} />;
}

function SectionGlow({ part }: { part: CardPart }) {
  const r = SECTION[part];
  return (
    <g>
      <rect x={r.x + 0.5} y={r.y + 0.5} width={r.w - 1} height={r.h - 1} rx={3} fill="none" stroke={INK.select} strokeWidth={4} opacity={0.4} />
      <rect x={r.x + 1} y={r.y + 1} width={r.w - 2} height={r.h - 2} rx={3} fill="none" stroke={darken(INK.select, 0.25)} strokeWidth={1.6} />
    </g>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Back

export function CardBack({ nation, size = 'md' }: { nation: Nation; size?: CardSize }) {
  const { w, h } = CARD_SIZE[size];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${nation} Fate card (face down)`} style={{ display: 'block' }}>
      <CardBackBody nation={nation} />
    </svg>
  );
}

export function CardBackBody({ nation }: { nation: Nation }) {
  const pal = NATION[nation];
  const clip = `cb${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const hexes: ReactNode[] = [];
  const r = 9;
  for (let col = -1; col < 10; col++) {
    for (let row = -1; row < 13; row++) {
      const x = 10 + col * r * 1.5;
      const y = 10 + row * r * Math.sqrt(3) + (col % 2 ? (r * Math.sqrt(3)) / 2 : 0);
      hexes.push(<path key={`${col}.${row}`} d={hexPath(x, y, r - 0.6)} />);
    }
  }
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <rect x={8} y={8} width={104} height={154} rx={3} />
        </clipPath>
      </defs>
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={7} fill={pal.frame} stroke={darken(pal.frameDark, 0.3)} strokeWidth={1} />
      <rect x={8} y={8} width={104} height={154} rx={3} fill={pal.frameDark} />
      <g clipPath={`url(#${clip})`} fill="none" stroke={pal.frameLight} strokeWidth={0.8} opacity={0.35}>
        {hexes}
      </g>
      <rect x={8} y={8} width={104} height={154} rx={3} fill="none" stroke={pal.frameLight} strokeWidth={1.2} />
      <rect x={4.5} y={4.5} width={111} height={161} rx={5} fill="none" stroke={pal.frameLight} strokeWidth={0.6} opacity={0.7} />
      <circle cx={60} cy={85} r={30} fill={pal.frame} stroke={pal.frameLight} strokeWidth={2} />
      <circle cx={60} cy={85} r={25.5} fill="none" stroke={pal.frameLight} strokeWidth={0.7} />
      {/* crossed rifles */}
      <g stroke={INK.paper} strokeLinecap="round">
        <path d="M44 101 L76 69" strokeWidth={2.4} />
        <path d="M76 101 L44 69" strokeWidth={2.4} />
        <path d="M44 101 L49.5 95.5" strokeWidth={4.6} />
        <path d="M76 101 L70.5 95.5" strokeWidth={4.6} />
      </g>
      <text x={60} y={38} fontFamily={FONT.title} fontWeight={600} fontSize={17} fill={INK.paper} textAnchor="middle" letterSpacing={5}>
        FATE
      </text>
      <text x={60} y={141} fontFamily={FONT.title} fontWeight={600} fontSize={9} fill={pal.frameLight} textAnchor="middle" letterSpacing={2.4}>
        {nation.toUpperCase()}
      </text>
    </g>
  );
}

