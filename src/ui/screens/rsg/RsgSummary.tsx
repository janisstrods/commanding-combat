// The briefing of a generated battle: the map with both set-up areas, the facts, both sides' forces (public once the
// OBs are revealed), your chits (the computer's secret chit stays hidden), then "To battle".
import { useMemo } from 'react';
import { areaHexes, COUNTERS } from '../../../engine/data';
import { rsgFinish, type RsgDraft } from '../../../engine/rsg';
import { type Edge, type Side, SIDES, other } from '../../../engine/types';
import { Button, NATION_COLORS, SIDE_LABEL } from '../../kit';
import type { AiLevel } from '../../routes';
import { AI_LEVEL_INFO, NATION_PLURAL, POSTURE_LABEL, QUALITY_LABEL, turnFor, vpText } from '../ScenarioPicker';
import { fortText } from './choices';
import { HIDDEN_CHIT } from './model';
import { ChitToken, Forces, Forts, MapPreview } from './parts';

export function RsgSummary(p: { draft: RsgDraft; level: AiLevel; onBattle: () => void; onAgain: () => void; onMenu: () => void; notice?: string | null }) {
  const scn = useMemo(() => rsgFinish(p.draft), [p.draft]);
  const me: Side = p.draft.humanSide ?? 'axis';
  const them = other(me);
  const mine = scn.sides[me];
  const theirs = scn.sides[them];
  const rotate = turnFor(mine.edge);
  const areas = useMemo(
    () => ({ mine: areaHexes(mine.setupArea, mine.edge), theirs: areaHexes(theirs.setupArea, theirs.edge) }),
    [mine.setupArea, mine.edge, theirs.setupArea, theirs.edge],
  );
  const depth = (s: Side) => (scn.sides[s].setupArea.kind === 'depth' ? (scn.sides[s].setupArea as { depth: number }).depth : 0);
  const edges: Partial<Record<Edge, string>> = {
    [mine.edge]: `${NATION_PLURAL[mine.nation]} (you) · ${POSTURE_LABEL[mine.posture]}`,
    [theirs.edge]: `${NATION_PLURAL[theirs.nation]} · ${POSTURE_LABEL[theirs.posture]}`,
  };
  const radio = (s: Side) => Object.keys(scn.sides[s].forces).find((t) => COUNTERS[t]?.kind === 'radio');
  const sideForces = (s: Side) => {
    const r = radio(s);
    const out = { ...scn.sides[s].forces };
    if (r) delete out[r];
    return { units: out, radio: r };
  };
  return (
    <div className="rsg-root rsg-summary kit-desk">
      <header className="rsg-head">
        <Button variant="ghost" size="sm" onClick={p.onMenu}>
          ← Menu
        </Button>
        <h1 className="rsg-head__title">Random Battle</h1>
        <span className="rsg-head__sub">
          Briefing · seed {p.draft.seed} · against {p.level === 'elite' ? 'an' : 'a'} {AI_LEVEL_INFO[p.level].label} computer
        </span>
      </header>
      <div className="rsg-summary__body">
        <section className="rsg-summary__map">
          <div className="rsg-summary__board">
            <MapPreview
              map={scn.map}
              rotate180={rotate}
              edgeLabels={edges}
              ppu={40}
              marginScale={1.7}
              tints={[
                { hexes: areas.mine, tone: 'mine' },
                { hexes: areas.theirs, tone: 'theirs' },
              ]}
            />
          </div>
          <div className="rsg-legend">
            <span>
              <i className="rsg-swatch rsg-swatch--mine" /> Your set-up area: {depth(me)} rows from your edge
            </span>
            <span>
              <i className="rsg-swatch rsg-swatch--theirs" /> Theirs: {depth(them)} rows
            </span>
            <span>The {SIDE_LABEL[scn.setupFirst]} set up first.</span>
          </div>
        </section>
        <article className="rsg-brief kit-paper">
          <header className="brief-head">
            <div className="brief-number">Random scenario · map {scn.map}</div>
            <h2 className="brief-title rsg-brief__title">{scn.name.replace(/^Random \d+: /, '')}</h2>
            <div className="brief-place">
              {scn.year} · {NATION_PLURAL[scn.sides.axis.nation]} v {NATION_PLURAL[scn.sides.allied.nation]}
            </div>
          </header>
          <dl className="brief-facts">
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
                {SIDES.map((s) => {
                  const x = scn.sides[s];
                  return (
                    <tr key={s} className={s === me ? 'is-me' : ''}>
                      <th>
                        <span className="nation-chip" style={{ background: NATION_COLORS[x.nation].main }} />
                        {NATION_PLURAL[x.nation]}
                        <small>{s === me ? 'you' : SIDE_LABEL[s]}</small>
                      </th>
                      <td>{POSTURE_LABEL[x.posture]}</td>
                      <td>{QUALITY_LABEL[x.quality]}</td>
                      <td>{x.orders}</td>
                      <td>{x.handSize}</td>
                      <td>{x.surrender}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <h3 className="rsg-brief__h">Objectives</h3>
          <div className="rsg-chits">
            {scn.openChits.map((c) => (
              <ChitToken key={c} id={c} />
            ))}
            {mine.secretChits.map((c) => (
              <ChitToken key={c} id={c} secret mine />
            ))}
            {theirs.secretChits.map((_, i) => (
              <ChitToken key={`h${i}`} id={HIDDEN_CHIT} secret />
            ))}
          </div>
          <p className="rsg-brief__note">
            {scn.control.every((c) => c === null)
              ? 'Recon: nobody holds the Objectives at the start; each side takes those it alone occupies after set-up.'
              : `The ${SIDE_LABEL[scn.control.find((c) => c !== null)!]} hold every Objective at the start; the Attacker takes those he occupies after set-up.`}
          </p>
          {[me, them].map((s) => {
            const f = sideForces(s);
            const x = scn.sides[s];
            const forts = Object.values(x.fortifications).some((n) => (n ?? 0) > 0);
            return (
              <div key={s} className={`rsg-brief__forces ${s === me ? 'is-me' : ''}`}>
                <h3 className="rsg-brief__h">
                  {s === me ? 'Your forces' : `The ${NATION_PLURAL[x.nation]}`}
                  <small>
                    {NATION_PLURAL[x.nation]} · {SIDE_LABEL[s]}
                  </small>
                </h3>
                <Forces units={f.units} size={40} />
                {f.radio ? (
                  <div className="rsg-brief__extra">
                    <Forces units={{ [f.radio]: 1 }} size={40} />
                    <span>in the Artillery Box</span>
                  </div>
                ) : null}
                {forts ? (
                  <div className="rsg-brief__extra">
                    <Forts contents={x.fortifications} minefield={x.minefield} size={36} />
                    <span>{fortText(x.fortifications, x.minefield)}, placed after set-up</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </article>
      </div>
      <footer className="rsg-summary__foot kit-paper">
        {p.notice ? <span className="rsg-stage__note is-error">{p.notice}</span> : <span className="rsg-stage__note">Your secret chit is yours alone; the computer's stays hidden.</span>}
        <Button variant="ghost" onClick={p.onMenu}>
          Menu
        </Button>
        <Button variant="secondary" onClick={p.onAgain}>
          Another random battle
        </Button>
        <Button size="lg" onClick={p.onBattle}>
          To battle
        </Button>
      </footer>
    </div>
  );
}
