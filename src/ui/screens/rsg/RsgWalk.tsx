// The RSG step by step: automatic rolls animate with their narration, the computer's choices take a moment, the
// player's choices open their panels. Beside the stage: the battle so far (VP track, map, facts) and the record.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Marker } from '../../../art';
import { COUNTERS, RSG } from '../../../engine/data';
import { rsgChoose, rsgStep, type RsgChoice, type RsgDraft, type RsgLogEntry } from '../../../engine/rsg';
import { type Nation, type Side, SIDES, other } from '../../../engine/types';
import { Button, SIDE_LABEL, Segmented, Stamp } from '../../kit';
import { POSTURE_LABEL, QUALITY_LABEL, turnFor } from '../ScenarioPicker';
import { HumanChoice, StagePanel, fortText } from './choices';
import { STAGES, STEP_RS, STEP_TITLE, chooserOf, newEntries, obAsSeen, rsgView, runToHuman, stageOf, stepOnce, type StepWhat } from './model';
import { ChitToken, Coin, Dice, Forces, MapPreview, MiniDice, VpTrack, nationLabel } from './parts';

export type Beat =
  | { kind: 'idle' }
  | { kind: 'rolling'; what: StepWhat; side: Side | null; label: string }
  | { kind: 'thinking'; what: StepWhat; side: Side }
  | { kind: 'shown'; what: StepWhat | 'fixed'; side: Side | null; entries: RsgLogEntry[] };

export type Speed = 'normal' | 'fast';
const TIMES: Record<Speed, { roll: number; think: number; show: number }> = {
  normal: { roll: 650, think: 650, show: 1250 },
  fast: { roll: 260, think: 220, show: 520 },
};

const DICE_STEPS: readonly StepWhat[] = ['mapRoll', 'edgeRoll', 'year', 'allied', 'quality', 'supportRoll', 'assetRoll'];

export function RsgWalk(p: {
  draft: RsgDraft;
  setDraft: (d: RsgDraft) => void;
  beat: Beat;
  setBeat: (b: Beat) => void;
  hold?: boolean;
  onDone: () => void;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const { draft, setDraft, beat, setBeat, hold = false, onDone } = p;
  const [speed, setSpeed] = useState<Speed>(() => (prefersReducedMotion() ? 'fast' : 'normal'));
  const step = rsgStep(draft);
  const who = chooserOf(draft, step);
  const human = draft.humanSide;
  const view = human ? rsgView(draft, human) : draft;

  // the beat machine: idle → rolling/thinking → (apply) shown → idle …; the player's choice and the end stop it
  useEffect(() => {
    if (hold) return;
    const t = TIMES[speed];
    if (beat.kind === 'shown') {
      const id = setTimeout(() => setBeat({ kind: 'idle' }), t.show);
      return () => clearTimeout(id);
    }
    if (beat.kind === 'idle') {
      if (step.kind === 'auto') setBeat({ kind: 'rolling', what: step.what, side: step.side, label: step.label });
      else if (step.kind === 'choice' && who === 'ai') setBeat({ kind: 'thinking', what: step.what, side: step.side });
      else if (step.kind === 'done') onDone();
      return;
    }
    const id = setTimeout(
      () => {
        const next = stepOnce(draft);
        setDraft(next);
        setBeat({ kind: 'shown', what: beat.what, side: beat.side, entries: newEntries(draft, next) });
      },
      beat.kind === 'rolling' ? t.roll : t.think,
    );
    return () => clearTimeout(id);
  }, [beat, draft, hold, speed]);

  const choose = (c: RsgChoice) => {
    if (step.kind !== 'choice') return;
    const next = rsgChoose(draft, c);
    setDraft(next);
    setBeat({ kind: 'shown', what: step.what, side: step.side, entries: newEntries(draft, next) });
  };
  const skip = () => {
    const next = runToHuman(draft);
    setDraft(next);
    setBeat({ kind: 'idle' });
  };

  const stage = beat.kind === 'idle' && who === 'human' && step.kind === 'choice' ? 'choice' : 'beat';
  const current = beat.kind === 'idle' ? (step.kind === 'done' ? 'done' : step.what) : beat.what;
  return (
    <div className="rsg-root rsg-walk kit-desk">
      <header className="rsg-head">
        <Button variant="ghost" size="sm" onClick={p.onMenu}>
          ← Menu
        </Button>
        <h1 className="rsg-head__title">Random Battle</h1>
        <div className="rsg-head__tools">
          <Segmented<Speed>
            label="Speed"
            className="rsg-speed"
            value={speed}
            onChange={setSpeed}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'fast', label: 'Fast' },
            ]}
          />
          <Button variant="ghost" size="sm" disabled={who === 'human' || who === 'done'} onClick={skip} title="Roll everything up to your next choice at once">
            Skip ahead
          </Button>
          <Button variant="ghost" size="sm" onClick={p.onRestart}>
            Start over
          </Button>
        </div>
      </header>
      <Progress at={stageOf(current)} />
      <div className="rsg-walk__body">
        <main className="rsg-walk__main">
          {stage === 'choice' && step.kind === 'choice' ? (
            <HumanChoice key={step.id} view={view} step={step} onChoose={choose} />
          ) : (
            <BeatCard beat={beat} view={view} done={step.kind === 'done'} onSummary={onDone} />
          )}
        </main>
        <aside className="rsg-walk__side">
          <SoFar view={view} />
          <Record log={view.log} />
        </aside>
      </div>
    </div>
  );
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function Progress({ at }: { at: number }) {
  return (
    <ol className="rsg-progress" aria-label="Steps of the generator">
      {STAGES.map((s, i) => (
        <li key={s.id} className={i < at ? 'is-done' : i === at ? 'is-now' : ''} aria-current={i === at ? 'step' : undefined}>
          {s.label}
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// The stage between choices

function kicker(what: StepWhat | 'fixed', side: Side | null): string {
  const rs = what === 'fixed' ? '' : STEP_RS[what];
  return [rs, side ? SIDE_LABEL[side] : ''].filter(Boolean).join(' · ');
}

const THINKING: Partial<Record<StepWhat, string>> = {
  mapPick: 'pick the battlefield',
  mapEdgeDie: 'choose their edge die',
  ob: 'choose their Order of Battle in secret',
  supportBuy: 'go shopping for Support',
  fortifications: 'decide on Fortifications',
  assetRequest: 'consider an Asset Request',
};

function BeatCard({ beat, view, done, onSummary }: { beat: Beat; view: RsgDraft; done: boolean; onSummary: () => void }) {
  if (beat.kind === 'idle') {
    if (done) {
      return (
        <StagePanel kicker="RS.16 H-Hour" title="The battle is set" footer={<Button size="lg" onClick={onSummary}>See the briefing</Button>}>
          <p>Every roll is made. Read the briefing, then go to battle.</p>
        </StagePanel>
      );
    }
    return <StagePanel title="…" />;
  }
  if (beat.kind === 'thinking') {
    return (
      <StagePanel className="rsg-beat is-thinking" kicker={kicker(beat.what, beat.side)} title={STEP_TITLE[beat.what]}>
        <div className="rsg-beat__visual">
          <Stamp tone="olive">Computer</Stamp>
        </div>
        <p className="rsg-beat__line">
          The {SIDE_LABEL[beat.side]} {THINKING[beat.what] ?? 'choose'}
          <span className="rsg-dots" aria-hidden>
            <i>.</i>
            <i>.</i>
            <i>.</i>
          </span>
        </p>
      </StagePanel>
    );
  }
  const what = beat.what;
  const title = what === 'fixed' ? 'Fixed' : STEP_TITLE[what];
  const rolling = beat.kind === 'rolling';
  const entries = beat.kind === 'shown' ? beat.entries : [];
  return (
    <StagePanel className={`rsg-beat ${rolling ? 'is-rolling' : 'is-shown'}`} kicker={kicker(what, beat.side)} title={title} lead={rolling ? beat.label : undefined}>
      <div className="rsg-beat__visual">{what === 'fixed' ? null : <StepVisual what={what} rolling={rolling} entries={entries} view={view} side={beat.side} />}</div>
      {entries.length ? (
        <ul className="rsg-beat__lines">
          {entries.map((e, i) => (
            <li key={i}>
              {e.dice ? <MiniDice dice={e.dice} /> : null}
              {e.text}
            </li>
          ))}
        </ul>
      ) : null}
    </StagePanel>
  );
}

function lastDice(entries: RsgLogEntry[]): number[] | null {
  for (let i = entries.length - 1; i >= 0; i--) if (entries[i].dice) return entries[i].dice!;
  return null;
}

function StepVisual({ what, rolling, entries, view, side }: { what: StepWhat; rolling: boolean; entries: RsgLogEntry[]; view: RsgDraft; side: Side | null }) {
  const me = view.humanSide ?? 'axis';
  if (DICE_STEPS.includes(what)) {
    const d = lastDice(entries);
    return <Dice white={d?.[0] ?? null} coloured={d?.[1] ?? null} rolling={rolling} size={76} />;
  }
  if (what === 'leaders') {
    const d = lastDice(entries);
    if (rolling || !side) return <Dice white={d?.[0] ?? null} rolling={rolling} one size={76} />;
    return <Forces units={Object.fromEntries(view.leaders[side].map((l) => [l, 1]))} size={64} />;
  }
  if (what === 'sides' || (what === 'initiative' && entries.some((e) => e.coin))) {
    const c = entries.find((e) => e.coin)?.coin ?? null;
    return <Coin face={c} spinning={rolling} size={76} />;
  }
  if (rolling) return <Dice rolling size={76} />;
  switch (what) {
    case 'chits':
      return (
        <div className="rsg-chits">
          {view.openChits.map((c) => (
            <ChitToken key={c} id={c} />
          ))}
          {view.secretChits[me].map((c) => (
            <ChitToken key={c} id={c} secret mine />
          ))}
          {view.secretChits[other(me)].map((c, i) => (
            <ChitToken key={`h${i}`} id={c} secret />
          ))}
        </div>
      );
    case 'obPoints':
      return (
        <div className="rsg-beat__stack rsg-beat__stack--wide">
          <div className="rsg-reveal">
            {SIDES.map((s) => (
              <ObSummary key={s} view={view} side={s} size={46} />
            ))}
          </div>
          <VpTrack vp={view.vp} names={trackNames(view)} />
        </div>
      );
    case 'posture':
    case 'control':
    case 'fortifications':
      return <VpTrack vp={view.vp} names={trackNames(view)} />;
    case 'supportBuy': {
      const r = [...view.support].reverse().find((x) => x.side === side);
      const units: Record<string, number> = {};
      for (const b of r?.bought ?? []) for (const [t, n] of Object.entries(b.pieces)) units[t] = (units[t] ?? 0) + n;
      return (
        <div className="rsg-beat__stack">
          <Forces units={units} size={56} />
          <VpTrack vp={view.vp} names={trackNames(view)} />
        </div>
      );
    }
    case 'ob':
      return side && obAsSeen(view, me, side) === 'hidden' ? <Stamp tone="red">Sealed until you choose</Stamp> : <ObSummary view={view} side={side ?? me} size={46} />;
    case 'mapPick':
      return view.map ? <div className="rsg-beat__map">{<MapPreview map={view.map} ppu={22} />}</div> : null;
    case 'mapEdgeDie':
      return view.map && view.edges ? (
        <div className="rsg-beat__map">
          <MapPreview map={view.map} ppu={22} rotate180={turnFor(view.edges[me])} edgeLabels={edgeLabelsOf(view)} />
        </div>
      ) : null;
    case 'assetRequest':
      return null;
    case 'initiative':
      return <Marker kind="initiative" size={76} />;
    default:
      return null;
  }
}

function edgeLabelsOf(view: RsgDraft) {
  if (!view.edges) return undefined;
  const me = view.humanSide ?? 'axis';
  return {
    [view.edges[me]]: `${nationLabel(nationOf(view, me), me)} (you)`,
    [view.edges[other(me)]]: nationLabel(nationOf(view, other(me)), other(me)),
  };
}

export function trackNames(view: RsgDraft): Record<Side, string> {
  return { axis: nationLabel('German', 'axis'), allied: nationLabel(view.allied, 'allied') };
}

export function nationOf(view: RsgDraft, side: Side): Nation | null {
  return side === 'axis' ? 'German' : view.allied;
}

/** One side's OB as the viewer sees it (chit, label, points), with its pieces once revealed. */
function ObSummary({ view, side, size: px = 34 }: { view: RsgDraft; side: Side; size?: number }) {
  const me = view.humanSide ?? 'axis';
  const seen = obAsSeen(view, me, side);
  const nation = nationOf(view, side);
  if (seen === 'none' || seen === 'hidden' || !nation) {
    return (
      <div className="rsg-obsum">
        <b>{SIDE_LABEL[side]}</b> {seen === 'hidden' ? <Stamp tone="red">Sealed</Stamp> : '—'}
      </div>
    );
  }
  const size = RSG.obs[nation][seen.letter].sizes[seen.size as 'company'];
  return (
    <div className="rsg-obsum">
      <div className="rsg-obsum__head">
        <b>{nationLabel(nation, side)}</b>
        <span className="rsg-ob__chit">{size.chit}</span>
        <span>{size.label}</span>
        <span className="rsg-obsum__pts">{size.points} VP</span>
      </div>
      <Forces units={unitsOf(size, view.year!)} size={px} />
    </div>
  );
}

function unitsOf(size: { units: Record<string, number>; unitsByYear?: { years: [number, number]; units: Record<string, number> }[] }, year: number): Record<string, number> {
  const u = { ...size.units };
  for (const x of size.unitsByYear ?? []) if (x.years[0] <= year && year <= x.years[1]) for (const [t, n] of Object.entries(x.units)) u[t] = (u[t] ?? 0) + n;
  return u;
}

// ---------------------------------------------------------------------------------------------------------------------
// The battle so far and the record

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rsg-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function SoFar({ view }: { view: RsgDraft }) {
  const me = view.humanSide;
  const them = me ? other(me) : null;
  const perSide = (f: (s: Side) => ReactNode) => (
    <span className="rsg-pair">
      {SIDES.map((s) => (
        <span key={s} className={s === me ? 'is-me' : ''}>
          <i>{SIDE_LABEL[s]}</i> {f(s)}
        </span>
      ))}
    </span>
  );
  const obText = (s: Side) => {
    if (!me) return '—';
    const seen = obAsSeen(view, me, s);
    if (seen === 'none') return '—';
    if (seen === 'hidden') return <Stamp tone="red">Sealed</Stamp>;
    const n = nationOf(view, s)!;
    const size = RSG.obs[n][seen.letter].sizes[seen.size as 'company'];
    return `${size.chit} ${size.label} (${size.points})`;
  };
  const bought = (s: Side) => {
    const items = view.support.filter((r) => r.side === s).flatMap((r) => r.bought.map((b) => b.label));
    if (view.asset?.radio && view.postures?.[s] === 'attack') items.push(COUNTERS[view.asset.radio]?.name ?? 'Radio');
    const counts = new Map<string, number>();
    for (const x of items) counts.set(x, (counts.get(x) ?? 0) + 1);
    return items.length ? [...counts].map(([x, n]) => (n > 1 ? `${n} × ${x}` : x)).join(', ') : '—';
  };
  return (
    <section className="rsg-sofar kit-paper">
      <h3 className="rsg-side__title">The battle so far</h3>
      <VpTrack vp={view.vp} names={trackNames(view)} />
      {view.map ? (
        <div className="rsg-sofar__map">
          <MapPreview map={view.map} ppu={12} rotate180={me && view.edges ? turnFor(view.edges[me]) : false} edgeLabels={edgeLabelsOf(view)} marginScale={2.6} />
        </div>
      ) : null}
      <dl className="rsg-facts">
        <Fact label="You">{me ? `${SIDE_LABEL[me]} · ${nationOf(view, me) ? nationLabel(nationOf(view, me), me) : 'nation to be rolled'}` : 'coin flip to come'}</Fact>
        <Fact label="Map">{view.map ? `Map ${view.map}${view.edges ? ` · ${view.edges.axis === 'top' || view.edges.axis === 'bottom' ? 'wide' : 'narrow'}` : ''}` : '—'}</Fact>
        <Fact label="Year">{view.year ?? '—'}</Fact>
        <Fact label="Troops">{perSide((s) => (view.quality[s] ? QUALITY_LABEL[view.quality[s]!] : '—'))}</Fact>
        <Fact label="OB">{perSide(obText)}</Fact>
        {view.leaders.axis.length || view.leaders.allied.length ? (
          <Fact label="Leaders">{perSide((s) => view.leaders[s].map((l) => COUNTERS[l]?.name ?? l).join(', ') || '—')}</Fact>
        ) : null}
        {view.support.length || view.asset?.radio ? <Fact label="Support">{perSide(bought)}</Fact> : null}
        {view.postures ? <Fact label="Posture">{perSide((s) => POSTURE_LABEL[view.postures![s]])}</Fact> : null}
        {view.fortifications.length ? <Fact label="Fortified">{fortText(fortTotals(view.fortifications))}</Fact> : null}
        {view.initiative ? <Fact label="Initiative">{SIDE_LABEL[view.initiative]}</Fact> : null}
      </dl>
      {view.openChits.length || (me && view.secretChits[me].length) ? (
        <div className="rsg-chits rsg-chits--small">
          {view.openChits.map((c) => (
            <ChitToken key={c} id={c} />
          ))}
          {me ? view.secretChits[me].map((c) => <ChitToken key={c} id={c} secret mine />) : null}
          {them ? view.secretChits[them].map((c, i) => <ChitToken key={`h${i}`} id={c} secret />) : null}
        </div>
      ) : null}
    </section>
  );
}

function fortTotals(ids: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of ids) {
    const f = RSG.fortifications.find((x) => x.id === id);
    for (const [k, n] of Object.entries(f?.contents ?? {})) out[k] = (out[k] ?? 0) + (n ?? 0);
  }
  return out;
}

function Record({ log }: { log: RsgLogEntry[] }) {
  const ref = useRef<HTMLOListElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);
  return (
    <section className="rsg-record kit-paper">
      <h3 className="rsg-side__title">The record</h3>
      <ol ref={ref} className="rsg-record__list">
        {log.map((e, i) => (
          <li key={i} className={`rsg-record__line side-${e.side ?? 'none'}`}>
            {e.dice ? <MiniDice dice={e.dice} /> : e.coin ? <Coin face={e.coin} size={17} /> : null}
            <span>{e.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

