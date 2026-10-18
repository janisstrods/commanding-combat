// The scenario picker: the twelve scenarios with their briefings, a side (by nation) and the AI level; Start goes to
// #/play/<id>/<side>/<level>.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SCENARIOS } from '../../engine/data';
import type { Edge, Nation, Posture, Quality, ScenarioDef, Side } from '../../engine/types';
import { summaryOf } from '../../scenarios/summaries';
import { Board } from '../board';
import { Button, NATION_COLORS, Segmented } from '../kit';
import { BATTLE_PPU, MapLoading, preloadMap, usePreparedMap } from '../maps';
import { AI_LEVELS, DEFAULT_AI_LEVEL, navigate, type AiLevel } from '../routes';
import { storage } from '../storage';
import './screens.css';
import { SpecialRulesList } from './ScenarioDialog';

const PICK_KEY = 'cce-picker-v1';
/** Painting resolution of the briefing's map. */
const PREVIEW_PPU = 44;

export const NATION_PLURAL: Record<Nation, string> = { German: 'Germans', American: 'Americans', Russian: 'Russians' };
export const POSTURE_LABEL: Record<Posture, string> = { attack: 'Attack', recon: 'Recon', defend: 'Defend' };
export const QUALITY_LABEL: Record<Quality, string> = { elite: 'Elite', line: 'Line', green: 'Green' };
export const AI_LEVEL_INFO: Record<AiLevel, { label: string; hint: string }> = {
  green: { label: 'Green', hint: 'Quick and sometimes careless' },
  line: { label: 'Line', hint: 'A steady opponent' },
  elite: { label: 'Elite', hint: 'Thinks hardest; slower turns' },
};

interface Pick {
  scenario: string;
  side: Side;
  level: AiLevel;
}

function loadPick(): Pick {
  const fallback: Pick = { scenario: SCENARIOS[0]?.id ?? '1', side: 'allied', level: DEFAULT_AI_LEVEL };
  try {
    const v = JSON.parse(storage.get(PICK_KEY) ?? 'null') as Partial<Pick> | null;
    if (!v) return fallback;
    return {
      scenario: SCENARIOS.some((s) => s.id === v.scenario) ? v.scenario! : fallback.scenario,
      side: v.side === 'axis' || v.side === 'allied' ? v.side : fallback.side,
      level: AI_LEVELS.includes(v.level as AiLevel) ? (v.level as AiLevel) : fallback.level,
    };
  } catch {
    return fallback;
  }
}

/** "20 to the Allies", "even". */
export function vpText(vp: number): string {
  if (vp === 0) return 'even';
  return `${Math.abs(vp)} to the ${vp > 0 ? 'Axis' : 'Allies'}`;
}

/** Turn the board so the player's edge is at the bottom (or on the left for a side edge). */
export function turnFor(edge: Edge): boolean {
  return edge === 'top' || edge === 'right';
}

export function ScenarioPicker(p: { selected?: string }) {
  const [pick, setPick] = useState<Pick>(() => {
    const base = loadPick();
    return p.selected && SCENARIOS.some((s) => s.id === p.selected) ? { ...base, scenario: p.selected } : base;
  });
  useEffect(() => {
    if (p.selected && p.selected !== pick.scenario && SCENARIOS.some((s) => s.id === p.selected)) setPick((x) => ({ ...x, scenario: p.selected! }));
    // follow the route only (a click already set the pick)
  }, [p.selected]);
  useEffect(() => {
    storage.set(PICK_KEY, JSON.stringify(pick));
  }, [pick]);
  const scn = SCENARIOS.find((s) => s.id === pick.scenario) ?? SCENARIOS[0];
  const choose = (id: string) => {
    setPick((x) => ({ ...x, scenario: id }));
    navigate({ kind: 'scenarios', selected: id }, { replace: true });
  };
  const start = () => navigate({ kind: 'play', scenario: scn.id, side: pick.side, level: pick.level });
  // the chosen scenario in view in the list (only the list scrolls; once, when the picker opens)
  const scrolled = useRef(false);
  const scrollIn = useCallback((el: HTMLButtonElement | null) => {
    if (!el || scrolled.current) return;
    scrolled.current = true;
    const list = el.closest('.picker-list');
    if (list) list.scrollTop = Math.max(0, el.offsetTop - (list as HTMLElement).offsetTop - 8);
  }, []);

  return (
    <div className="picker-root kit-desk">
      <header className="picker-head">
        <Button variant="ghost" size="sm" onClick={() => navigate({ kind: 'menu' })}>
          ← Menu
        </Button>
        <h2 className="picker-title">Choose a scenario</h2>
      </header>
      <div className="picker-body">
        <ol className="picker-list" aria-label="Scenarios">
          {SCENARIOS.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                ref={s.id === scn.id ? scrollIn : undefined}
                className={`picker-item ${s.id === scn.id ? 'is-active' : ''}`}
                onClick={() => choose(s.id)}
                onPointerEnter={() => preloadMap(s.map)}
                onFocus={() => preloadMap(s.map)}
                aria-current={s.id === scn.id}
              >
                <span className="picker-num">{s.id}</span>
                <span className="picker-name">{s.name}</span>
                <span className="picker-meta">
                  {s.year} · {NATION_PLURAL[s.sides.axis.nation]} v {NATION_PLURAL[s.sides.allied.nation]}
                </span>
              </button>
            </li>
          ))}
        </ol>
        {scn ? <Briefing scn={scn} pick={pick} setPick={setPick} onStart={start} /> : null}
      </div>
    </div>
  );
}

function Briefing({ scn, pick, setPick, onStart }: { scn: ScenarioDef; pick: Pick; setPick: (f: (p: Pick) => Pick) => void; onStart: () => void }) {
  const summary = summaryOf(scn.id);
  const { map, error } = usePreparedMap(scn.map, PREVIEW_PPU);
  const mine = scn.sides[pick.side];
  const edges = useMemo(() => {
    const out: Partial<Record<Edge, string>> = {};
    for (const side of ['axis', 'allied'] as Side[]) out[scn.sides[side].edge] = `${NATION_PLURAL[scn.sides[side].nation]}${side === pick.side ? ' (you)' : ''}`;
    return out;
  }, [scn, pick.side]);
  return (
    <section className="picker-detail">
      <article className="picker-brief kit-paper">
        <header className="brief-head">
          <div className="brief-number">Scenario {scn.id}</div>
          <h3 className="brief-title">{scn.name}</h3>
          {summary ? <div className="brief-place">{summary.place}</div> : null}
        </header>
        {summary ? <p className="brief-text">{summary.text}</p> : null}
        <dl className="brief-facts">
          <div>
            <dt>Map</dt>
            <dd>{scn.map}</dd>
          </div>
          <div>
            <dt>Year</dt>
            <dd>{scn.year}</dd>
          </div>
          <div>
            <dt>First turn</dt>
            <dd>{NATION_PLURAL[scn.sides[scn.firstTurn].nation]}</dd>
          </div>
          <div>
            <dt>Time / Sudden death</dt>
            <dd>
              {scn.time} / {scn.suddenDeath}
            </dd>
          </div>
          <div>
            <dt>Starting VP</dt>
            <dd>{vpText(scn.vp)}</dd>
          </div>
        </dl>
        <div className="brief-sides-wrap">
        <table className="brief-sides">
          <thead>
            <tr>
              <th />
              <th>Posture</th>
              <th>Troops</th>
              <th>Orders</th>
              <th>Hand</th>
              <th>Surrender</th>
            </tr>
          </thead>
          <tbody>
            {(['axis', 'allied'] as Side[]).map((side) => {
              const s = scn.sides[side];
              return (
                <tr key={side}>
                  <th>
                    <span className="nation-chip" style={{ background: NATION_COLORS[s.nation].main }} />
                    {NATION_PLURAL[s.nation]}
                    <small>{side === 'axis' ? 'Axis' : 'Allies'}</small>
                  </th>
                  <td>{POSTURE_LABEL[s.posture]}</td>
                  <td>{QUALITY_LABEL[s.quality]}</td>
                  <td>{s.orders}</td>
                  <td>{s.handSize}</td>
                  <td>{s.surrender}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        <SpecialRulesList scn={scn} />
      </article>
      <div className="picker-map">
        {map ? (
          <Board map={map} rotate180={turnFor(mine.edge)} showLabels={false} showCompass={false} edgeLabels={edges} marginScale={2} ppu={PREVIEW_PPU} title={`Map ${scn.map}`} />
        ) : (
          <MapLoading id={scn.map} error={error} />
        )}
      </div>
      <div className="picker-choose kit-paper">
        <div className="choose-group">
          <div className="choose-label">Your side</div>
          <Segmented<Side>
            label="Your side"
            value={pick.side}
            onChange={(side) => setPick((x) => ({ ...x, side }))}
            options={(['axis', 'allied'] as Side[]).map((side) => ({
              value: side,
              label: NATION_PLURAL[scn.sides[side].nation],
              hint: `${side === 'axis' ? 'Axis' : 'Allies'} · ${POSTURE_LABEL[scn.sides[side].posture]}`,
            }))}
          />
        </div>
        <div className="choose-group">
          <div className="choose-label">Opponent</div>
          <Segmented<AiLevel>
            label="Computer opponent"
            value={pick.level}
            onChange={(level) => setPick((x) => ({ ...x, level }))}
            options={AI_LEVELS.map((l) => ({ value: l, label: AI_LEVEL_INFO[l].label, hint: AI_LEVEL_INFO[l].hint }))}
          />
        </div>
        <Button
          size="lg"
          className="picker-start"
          onClick={onStart}
          // a head start for the battle board's terrain (the battle waits for it: src/ui/maps.tsx)
          onPointerEnter={() => preloadMap(scn.map, BATTLE_PPU)}
          onFocus={() => preloadMap(scn.map, BATTLE_PPU)}
        >
          Start
        </Button>
      </div>
    </section>
  );
}
