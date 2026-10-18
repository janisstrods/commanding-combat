// Dev gallery of the counter, marker and card art: #/gallery/counters (every counter of each nation, front and broken,
// and every marker) and #/gallery/cards (all 216 Fate cards; hover a card to see it large).
import { useState, type CSSProperties, type ReactNode } from 'react';
import type { CounterType, FateCard, Nation } from '../engine/types';
import { CARDS, COUNTERS, deckOf } from '../engine/data';
import { Counter, counterLabel } from '../art/Counter';
import { MARKER_KINDS, Marker, markerLabel, type MarkerKind } from '../art/Marker';
import { CardBack, FateCardView } from '../art/FateCardView';
import { FONT } from '../art/palette';

const NATIONS: Nation[] = ['German', 'American', 'Russian'];
const KIND_ORDER: Record<string, number> = { squad: 0, team: 1, leader: 2, weapon: 3, radio: 4 };

const page: CSSProperties = {
  minHeight: '100vh',
  boxSizing: 'border-box',
  padding: '20px 24px 40px',
  background: 'radial-gradient(120% 80% at 50% 0%, #4a5a3c 0%, #2f3a27 70%, #262f20 100%)',
  color: '#efe8d4',
  fontFamily: FONT.body,
};
const h2: CSSProperties = { fontFamily: FONT.title, fontWeight: 600, letterSpacing: 1, fontSize: 22, margin: '26px 0 10px' };
const h3: CSSProperties = { fontFamily: FONT.title, fontWeight: 400, letterSpacing: 0.6, fontSize: 15, margin: '14px 0 8px', color: '#d6cfb6' };
const grid: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' };
const caption: CSSProperties = { fontSize: 10.5, lineHeight: 1.15, color: '#cfc8ae', maxWidth: 140, textAlign: 'center' };

function Item({ children, label }: { children: ReactNode; label: string }) {
  return (
    <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>{children}</div>
      <figcaption style={caption}>{label}</figcaption>
    </figure>
  );
}

function countersOf(nation: Nation): CounterType[] {
  return Object.values(COUNTERS)
    .filter((c) => c.nation === nation)
    .sort((a, b) => (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9));
}

function NationCounters({ nation, size }: { nation: Nation; size: number }) {
  const all = countersOf(nation);
  const groups: [string, CounterType[]][] = [
    ['Squads', all.filter((c) => c.kind === 'squad')],
    ['Teams', all.filter((c) => c.kind === 'team')],
    ['Leaders and Hero', all.filter((c) => c.kind === 'leader')],
    ['Weapons and Radios', all.filter((c) => c.kind === 'weapon' || c.kind === 'radio')],
  ];
  return (
    <section>
      <h2 style={h2}>{nation}</h2>
      {groups.map(([title, list]) =>
        list.length ? (
          <div key={title}>
            <h3 style={h3}>{title} (front, broken)</h3>
            <div style={grid}>
              {list.map((t) => (
                <Item key={t.id} label={t.name}>
                  <Counter type={t} size={size} />
                  <Counter type={t} size={size} broken />
                </Item>
              ))}
            </div>
          </div>
        ) : null,
      )}
    </section>
  );
}

type Variant = { kind: MarkerKind; value?: number; nation?: Nation };
const MARKER_VARIANTS: Variant[] = MARKER_KINDS.flatMap((kind): Variant[] => {
  if (kind === 'mines') return [6, 7, 8].map((value) => ({ kind, value }));
  if (kind === 'smoke') return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => ({ kind, value }));
  if (kind === 'objective') return NATIONS.map((nation) => ({ kind, nation }));
  if (kind === 'vp') return [{ kind }, { kind, value: 3 }];
  return [{ kind }];
});

function Markers({ size }: { size: number }) {
  return (
    <section>
      <h2 style={h2}>Markers</h2>
      <div style={grid}>
        {MARKER_VARIANTS.map((m, i) => (
          <Item key={i} label={markerLabel(m.kind, m.value, m.nation)}>
            <Marker kind={m.kind} value={m.value} nation={m.nation} size={size} />
          </Item>
        ))}
      </div>
    </section>
  );
}

function States({ size }: { size: number }) {
  const squad = COUNTERS['German/Rifle Squad'] ?? Object.values(COUNTERS)[0];
  const leader = COUNTERS['American/Lt Wray'] ?? Object.values(COUNTERS).find((c) => c.kind === 'leader')!;
  const team = COUNTERS['Russian/Line Team'] ?? squad;
  const ussquad = COUNTERS['American/Paratroop Squad'] ?? squad;
  const states: { label: string; type: CounterType; broken?: boolean; suppressed?: boolean; veteran?: boolean; selected?: boolean; dim?: boolean }[] = [
    { label: 'suppressed', type: squad, suppressed: true },
    { label: 'veteran', type: squad, veteran: true },
    { label: 'suppressed and veteran', type: ussquad, suppressed: true, veteran: true },
    { label: 'broken, suppressed', type: squad, broken: true, suppressed: true },
    { label: 'broken, both', type: team, broken: true, suppressed: true, veteran: true },
    { label: 'leader, veteran', type: leader, veteran: true },
    { label: 'leader, broken, suppressed', type: leader, broken: true, suppressed: true },
    { label: 'selected', type: leader, selected: true },
    { label: 'dim', type: leader, dim: true },
  ];
  return (
    <section>
      <h2 style={h2}>States</h2>
      <div style={grid}>
        {states.map((st) => (
          <Item key={st.label} label={st.label}>
            <Counter type={st.type} size={size} broken={st.broken} suppressed={st.suppressed} veteran={st.veteran} selected={st.selected} dim={st.dim} />
          </Item>
        ))}
        <Item label={`${counterLabel(squad)} at 36 and 48 px`}>
          <Counter type={squad} size={36} />
          <Counter type={squad} size={36} broken suppressed />
          <Counter type={leader} size={36} veteran />
          <Counter type={squad} size={48} />
          <Counter type={leader} size={48} />
        </Item>
      </div>
    </section>
  );
}

function CountersView() {
  const [size, setSize] = useState(64);
  return (
    <>
      <Header title="Counters and markers">
        <label style={{ fontSize: 13 }}>
          size{' '}
          <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {[48, 64, 80, 120, 160, 240].map((s) => (
              <option key={s} value={s}>
                {s} px
              </option>
            ))}
          </select>
        </label>
      </Header>
      {NATIONS.map((n) => (
        <NationCounters key={n} nation={n} size={size} />
      ))}
      <Markers size={size} />
      <States size={size} />
    </>
  );
}

function CardsView() {
  const [hover, setHover] = useState<FateCard | null>(null);
  const [texts, setTexts] = useState(true);
  return (
    <>
      <Header title="Fate cards">
        <label style={{ fontSize: 13 }}>
          <input type="checkbox" checked={texts} onChange={(e) => setTexts(e.target.checked)} /> texts
        </label>
      </Header>
      {NATIONS.map((n) => (
        <section key={n}>
          <h2 style={h2}>
            {n} deck ({deckOf(n).length})
          </h2>
          <div style={{ ...grid, gap: 8 }}>
            <CardBack nation={n} size="md" />
            {deckOf(n).map((id) => (
              <div key={id} onMouseEnter={() => setHover(CARDS[id])} onMouseLeave={() => setHover(null)}>
                <FateCardView card={CARDS[id]} size="md" texts={texts} />
              </div>
            ))}
          </div>
        </section>
      ))}
      {hover ? (
        <div style={{ position: 'fixed', right: 18, top: 18, filter: 'drop-shadow(0 10px 18px rgba(0,0,0,.55))', pointerEvents: 'none' }}>
          <FateCardView card={hover} size="lg" />
        </div>
      ) : null}
    </>
  );
}

function Header({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header style={{ display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap' }}>
      <h1 style={{ fontFamily: FONT.title, fontWeight: 600, fontSize: 28, letterSpacing: 1, margin: 0 }}>{title}</h1>
      <nav style={{ display: 'flex', gap: 12, fontSize: 14 }}>
        <a href="#/gallery/counters" style={{ color: '#f0d27a' }}>
          counters
        </a>
        <a href="#/gallery/cards" style={{ color: '#f0d27a' }}>
          cards
        </a>
      </nav>
      {children}
    </header>
  );
}

export default function ArtGallery({ view }: { view: 'counters' | 'cards' }) {
  return <div style={page}>{view === 'cards' ? <CardsView /> : <CountersView />}</div>;
}
