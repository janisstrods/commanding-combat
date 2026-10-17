// Dev-only preview of the counter, marker and card art (art-preview.html, served by `vite`; the build ignores it).
// Pages: #zoom (a few counters at 48 / 64 / 160 px), #counters, #cards (the gallery views), #markers.
import React, { type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/oswald/400.css';
import '@fontsource/oswald/600.css';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/400-italic.css';
import '@fontsource/source-sans-3/600.css';
import { COUNTERS, CARDS } from '../engine/data';
import { Counter } from '../art/Counter';
import { Marker, type MarkerKind } from '../art/Marker';
import { FateCardView, CardBack } from '../art/FateCardView';
import ArtGallery from './ArtGallery';
import { Soldier, type Pose } from '../art/silhouettes';
import { NATION, FONT } from '../art/palette';
import { textWidth } from '../art/text';
import { ACTION_TEXT, EVENT_TEXT, ORDER_TEXT } from '../data/card-texts';

const pick = (ids: string[]) => ids.map((id) => COUNTERS[id]).filter(Boolean);

const ZOOM = pick([
  'German/Rifle Squad',
  'American/Line Squad',
  'Russian/Guards SMG Squad',
  'German/Line Team',
  'American/Weapon Team',
  'German/Sgt Benzing',
  'Russian/Gretchko (Hero)',
  'German/LMG',
  'Russian/HMG',
  'American/Medium Mortar',
  'German/Radio:105mm',
  'American/Flamethrower',
]);

function Row({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
      {label ? <div style={{ width: 60, font: '12px sans-serif', color: '#ddd' }}>{label}</div> : null}
      {children}
    </div>
  );
}

function Zoom() {
  return (
    <div>
      {[48, 64].map((size) => (
        <Row key={size} label={`${size}px`}>
          {ZOOM.map((t) => (
            <Counter key={t.id} type={t} size={size} />
          ))}
          {ZOOM.map((t) => (
            <Counter key={t.id + 'b'} type={t} size={size} broken />
          ))}
        </Row>
      ))}
      <Row label="states">
        <Counter type={ZOOM[0]} size={64} suppressed />
        <Counter type={ZOOM[0]} size={64} veteran />
        <Counter type={ZOOM[0]} size={64} suppressed veteran selected />
        <Counter type={ZOOM[5]} size={64} dim />
      </Row>
      <Row label="160px">
        {ZOOM.slice(0, 7).map((t) => (
          <Counter key={t.id} type={t} size={160} />
        ))}
      </Row>
      <Row label="160px">
        {ZOOM.slice(0, 2).map((t) => (
          <Counter key={t.id} type={t} size={160} broken />
        ))}
        {ZOOM.slice(7).map((t) => (
          <Counter key={t.id} type={t} size={160} />
        ))}
        <Counter type={ZOOM[7]} size={160} broken />
        <Counter type={ZOOM[10]} size={160} broken />
      </Row>
    </div>
  );
}

const MARKERS: { kind: MarkerKind; value?: number; nation?: 'German' | 'American' | 'Russian' }[] = [
  { kind: 'foxholes' },
  { kind: 'trench' },
  { kind: 'pillbox' },
  { kind: 'bunker' },
  { kind: 'wire' },
  { kind: 'mines', value: 6 },
  { kind: 'mines', value: 8 },
  { kind: 'smoke', value: 3 },
  { kind: 'smoke', value: 10 },
  { kind: 'blaze' },
  { kind: 'suppressed' },
  { kind: 'veteran' },
  { kind: 'spottingRound' },
  { kind: 'objective', nation: 'German' },
  { kind: 'objective', nation: 'American' },
  { kind: 'objective', nation: 'Russian' },
  { kind: 'vp', value: 4 },
  { kind: 'time' },
  { kind: 'suddenDeath' },
  { kind: 'initiative' },
];

function Markers() {
  return (
    <div>
      {[48, 64, 120].map((size) => (
        <Row key={size} label={`${size}px`}>
          {MARKERS.map((m, i) => (
            <Marker key={i} kind={m.kind} value={m.value} nation={m.nation} size={size} />
          ))}
        </Row>
      ))}
    </div>
  );
}

function Cards() {
  const ids = ['G-01', 'G-21', 'G-40', 'A-22', 'A-50', 'R-13', 'R-60', 'G-70'];
  const cards = ids.map((id) => CARDS[id]).filter(Boolean);
  return (
    <div>
      <Row label="md">
        {cards.map((c) => (
          <FateCardView key={c.id} card={c} size="md" />
        ))}
        <CardBack nation="German" size="md" />
      </Row>
      <Row label="lg">
        {cards.slice(0, 4).map((c, i) => (
          <FateCardView key={c.id} card={c} size="lg" highlight={(['order', 'action', 'event', null] as const)[i]} />
        ))}
        <CardBack nation="Russian" size="lg" />
      </Row>
    </div>
  );
}

function Weapons() {
  const size = Number(new URLSearchParams(location.search).get('size') ?? 100);
  const kinds = location.hash === '#leaders' ? ['leader'] : ['weapon', 'radio'];
  const list = Object.values(COUNTERS).filter((c) => kinds.includes(c.kind));
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {list.map((t) => (
        <div key={t.id} style={{ display: 'flex', gap: 4 }}>
          <Counter type={t} size={size} />
          <Counter type={t} size={size} broken />
        </div>
      ))}
    </div>
  );
}

const POSES: Pose[] = ['advance', 'stride', 'aim', 'kneel', 'flee', 'leader', 'hero', 'carry'];

function Figures() {
  return (
    <div>
      {(['German', 'American', 'Russian'] as const).map((n) => (
        <svg key={n} width={1360} height={250} viewBox="0 -48 400 74" style={{ display: 'block', background: NATION[n].base, marginBottom: 6 }}>
          {POSES.map((pose, i) => (
            <Soldier key={pose} x={25 + i * 50} y={18} s={1.5} pose={pose} gun={pose === 'leader' ? 'pistol' : i % 2 ? 'smg' : 'rifle'} nation={n} ink={NATION[n].ink} halo={NATION[n].base} flip={pose === 'flee'} />
          ))}
        </svg>
      ))}
    </div>
  );
}

function Measure() {
  const [out, setOut] = React.useState('measuring');
  React.useEffect(() => {
    document.fonts.ready.then(async () => {
      await Promise.all([document.fonts.load(`600 20px Oswald`), document.fonts.load(`400 20px "Source Sans 3"`)]);
      const ctx = document.createElement('canvas').getContext('2d')!;
      const rows: string[] = [];
      const body = [...Object.values(ACTION_TEXT), ...Object.values(EVENT_TEXT), ...Object.values(ORDER_TEXT)];
      let worst = 0;
      let sum = 0;
      ctx.font = `400 100px ${FONT.body}`;
      for (const t of body) {
        const real = ctx.measureText(t).width;
        const est = textWidth(t, 100, 'body');
        worst = Math.max(worst, real / est);
        sum += real / est;
      }
      rows.push(`body real/est mean ${(sum / body.length).toFixed(3)} worst ${worst.toFixed(3)}`);
      ctx.font = `600 100px ${FONT.title}`;
      const titles = [...Object.keys(ACTION_TEXT), ...Object.keys(EVENT_TEXT), ...Object.keys(ORDER_TEXT)].map((x) => x.toUpperCase());
      titles.push('0123456789', 'FALLSCHIRM.', 'VON KARSTIES', 'GULIKEVICH', 'MED MORTAR', 'RADIO');
      worst = 0;
      sum = 0;
      for (const t of titles) {
        const real = ctx.measureText(t).width;
        const est = textWidth(t, 100, 'title');
        worst = Math.max(worst, real / est);
        sum += real / est;
      }
      rows.push(`title real/est mean ${(sum / titles.length).toFixed(3)} worst ${worst.toFixed(3)}`);
      setOut(rows.join('\n'));
    });
  }, []);
  return <pre id="measure">{out}</pre>;
}

function Page() {
  const h = location.hash.replace('#', '') || 'zoom';
  const body =
    h === 'zoom' ? <Zoom /> : h === 'measure' ? <Measure /> : h === 'figs' ? <Figures /> : h === 'weapons' || h === 'leaders' ? <Weapons /> : h === 'markers' ? <Markers /> : h === 'cards' ? <Cards /> : h === 'counters' ? <ArtGallery view="counters" /> : h === 'gallery-cards' ? <ArtGallery view="cards" /> : <Zoom />;
  return <div style={{ background: '#3b4a33', minHeight: '100vh', padding: 16, boxSizing: 'border-box' }}>{body}</div>;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>,
);
