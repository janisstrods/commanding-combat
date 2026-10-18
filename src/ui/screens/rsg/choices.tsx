// The player's RSG choices: the map, the edge die, the Order of Battle, Support purchases, Fortifications and the Asset
// Request. Each panel shows the options richly and answers with an RsgChoice; "for me" fills in the engine's suggestion.
import { useMemo, useState, type ReactNode } from 'react';
import { Counter } from '../../../art';
import { COUNTERS } from '../../../engine/data';
import { rsgCheck, type RsgChoice, type RsgChoiceStep, type RsgDraft, type RsgObOption, type RsgSupportOption } from '../../../engine/rsg';
import { type Side, other } from '../../../engine/types';
import { Button, SIDE_LABEL, Stamp } from '../../kit';
import { QUALITY_LABEL } from '../ScenarioPicker';
import { suggestFor } from './model';
import { Dice, DieFace, Forces, Forts, MapPreview, VpTrack, edgeBand, edgeName, nationLabel } from './parts';

type Step<W extends RsgChoiceStep['what']> = Extract<RsgChoiceStep, { what: W }>;

export interface ChoiceProps<W extends RsgChoiceStep['what']> {
  /** The player's view of the draft (rsgView). */
  view: RsgDraft;
  step: Step<W>;
  onChoose: (c: RsgChoice) => void;
}

/** The frame of a step on the stage. */
export function StagePanel(p: { kicker?: ReactNode; title: ReactNode; lead?: ReactNode; children?: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <section className={`rsg-stage kit-paper ${p.className ?? ''}`}>
      <header className="rsg-stage__head">
        {p.kicker ? <div className="rsg-stage__kicker">{p.kicker}</div> : null}
        <h2 className="rsg-stage__title">{p.title}</h2>
        {p.lead ? <p className="rsg-stage__lead">{p.lead}</p> : null}
      </header>
      <div className="rsg-stage__body">{p.children}</div>
      {p.footer ? <footer className="rsg-stage__foot">{p.footer}</footer> : null}
    </section>
  );
}

const yourSide = (side: Side) => `${SIDE_LABEL[side]}`;
const sum = (r: readonly number[]) => r.reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------------------------------------------------
// RS.1 map

export function MapPickChoice({ view, step, onChoose }: ChoiceProps<'mapPick'>) {
  const [sel, setSel] = useState<string | null>(null);
  const shown = sel ?? step.options[0].map;
  return (
    <StagePanel
      className="rsg-stage--map"
      kicker="RS.1 Battlefield"
      title="Pick the battlefield"
      lead={
        <>
          Your roll lets you pick any of the twelve maps. The {SIDE_LABEL[other(step.side)]} then roll two dice and choose which one sets their
          friendly edge; you take the opposite edge.
        </>
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => setSel((suggestFor(view, step.side) as { map: string }).map)}>
            Pick for me
          </Button>
          <Button size="lg" onClick={() => onChoose({ what: 'mapPick', map: shown })}>
            Fight on map {shown}
          </Button>
        </>
      }
    >
      <div className="rsg-maps">
        <div className="rsg-maps__grid" role="listbox" aria-label="Maps">
          {step.options.map((o) => (
            <button
              key={o.map}
              type="button"
              role="option"
              aria-selected={o.map === shown}
              className={`rsg-maps__thumb ${o.map === shown ? 'is-on' : ''}`}
              onClick={() => setSel(o.map)}
            >
              <MapPreview map={o.map} ppu={9} grid={false} objectives={false} />
              <span className="rsg-maps__num">Map {o.map}</span>
            </button>
          ))}
        </div>
        <figure className="rsg-maps__big">
          <MapPreview map={shown} ppu={30} />
          <figcaption>
            Map {shown} · the battlefield of scenario {shown}. Objectives 1–5 are circled.
          </figcaption>
        </figure>
      </div>
    </StagePanel>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// RS.1 edge die

export function EdgeDieChoice({ view, step, onChoose }: ChoiceProps<'mapEdgeDie'>) {
  const same = step.options[0].edge === step.options[1].edge;
  return (
    <StagePanel
      kicker="RS.1 Battlefield"
      title="Choose your edge die"
      lead={
        <>
          You rolled white {step.options[0].value} and coloured {step.options[1].value}. The die you choose names your friendly edge (1 top, 4 bottom,
          2–3 right, 5–6 left); the enemy takes the opposite one. Top or bottom makes a wide battle (10 hexes between the edges), a side a narrow one (15
          hexes).{same ? ' Both dice give the same edge.' : ''}
        </>
      }
    >
      <div className="rsg-edges">
        {step.options.map((o) => {
          const enemy = ({ top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const)[o.edge];
          return (
            <article key={o.die} className="rsg-edge-card">
              <header>
                <DieFace value={o.value} colour={o.die} size={48} />
                <div>
                  <b>{o.die === 'white' ? 'White' : 'Coloured'} die: {o.value}</b>
                  <span>
                    Your edge: {edgeName(o.edge)} · {o.orientation === 'wide' ? 'wide: 10 hexes to the enemy edge' : 'narrow: 15 hexes to the enemy edge'}
                  </span>
                </div>
              </header>
              {view.map ? (
                <div className="rsg-edge-card__map">
                  <MapPreview
                    map={view.map}
                    ppu={16}
                    marginScale={2.4}
                    edgeLabels={{ [o.edge]: `You (${yourSide(step.side)})`, [enemy]: 'Enemy' }}
                    tints={[{ hexes: edgeBand(o.edge, o.orientation === 'wide' ? 2 : 3), tone: 'mine' }, { hexes: edgeBand(enemy, o.orientation === 'wide' ? 2 : 3), tone: 'theirs' }]}
                  />
                </div>
              ) : null}
              <Button onClick={() => onChoose({ what: 'mapEdgeDie', die: o.die })}>Use the {o.die} die</Button>
            </article>
          );
        })}
      </div>
    </StagePanel>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// RS.5 Order of Battle

const SIZE_LABEL = { company: 'Company', detachment: 'Detachment', platoon: 'Platoon' } as const;


function ObCard({ o, on, onPick }: { o: RsgObOption; on: boolean; onPick: () => void }) {
  return (
    <button type="button" className={`rsg-ob ${on ? 'is-on' : ''}`} onClick={onPick} aria-pressed={on}>
      <header className="rsg-ob__head">
        <span className="rsg-ob__chit">{o.chit}</span>
        <span className="rsg-ob__size">{SIZE_LABEL[o.size]}</span>
        <span className="rsg-ob__points" title="Point value: the VP marker moves this far toward the enemy">
          {o.points}
          <small>VP</small>
        </span>
      </header>
      <div className="rsg-ob__label">{o.label}</div>
      <dl className="rsg-ob__stats">
        <div>
          <dt>Orders</dt>
          <dd>{o.orders}</dd>
        </div>
        <div>
          <dt>Initiative</dt>
          <dd>{o.initiative}</dd>
        </div>
        <div>
          <dt>Surrender</dt>
          <dd>{o.surrender}</dd>
        </div>
        <div>
          <dt>Leaders</dt>
          <dd>{o.leaders}</dd>
        </div>
      </dl>
      <Forces units={o.units} size={40} />
    </button>
  );
}

export function ObChoice({ view, step, onChoose }: ChoiceProps<'ob'>) {
  const [sel, setSel] = useState<{ letter: string; size: string } | null>(null);
  const opp = other(step.side);
  const theirs = view.ob[opp] ? 'chosen' : view.log.some((e) => e.step === 'ob' && e.side === opp) ? 'chosen' : 'waiting';
  const letters = [...new Set(step.options.map((o) => o.letter))];
  const chosen = sel && step.options.find((o) => o.letter === sel.letter && o.size === sel.size);
  return (
    <StagePanel
      className="rsg-stage--ob"
      kicker="RS.5 Order of Battle"
      title={`Choose the ${nationLabel(step.nation, step.side)}' Order of Battle`}
      lead={
        <>
          {QUALITY_LABEL[step.quality]} troops, {step.year}. Both sides choose in secret and reveal together. Each OB's points move the VP marker toward the
          enemy: the side that spends less leads on VP, buys Support with the lead, and defends if it is still ahead. Leaders are rolled for next (RS.6).
        </>
      }
      footer={
        <>
          <span className="rsg-stage__note">
            {theirs === 'chosen' ? (
              <>
                <Stamp tone="red">Sealed</Stamp> The {SIDE_LABEL[opp]} have chosen; their OB is revealed with yours.
              </>
            ) : (
              <>The {SIDE_LABEL[opp]} choose after you, without seeing your pick.</>
            )}
          </span>
          <Button
            variant="secondary"
            onClick={() => {
              const c = suggestFor(view, step.side);
              if (c.what === 'ob') setSel({ letter: c.letter, size: c.size });
            }}
          >
            Pick for me
          </Button>
          <Button size="lg" disabled={!chosen} onClick={() => chosen && onChoose({ what: 'ob', letter: chosen.letter, size: chosen.size })}>
            {chosen ? `Choose ${chosen.chit} ${chosen.label}` : 'Choose an OB'}
          </Button>
        </>
      }
    >
      <div className="rsg-obs">
        {letters.map((letter) => {
          const row = step.options.filter((o) => o.letter === letter);
          return (
            <div key={letter} className="rsg-obs__row">
              <div className="rsg-obs__name">
                <b>{letter}</b>
                <span>{row[0].name}</span>
                <small>{QUALITY_LABEL[row[0].quality]}</small>
              </div>
              <div className="rsg-obs__cards">
                {row.map((o) => (
                  <ObCard key={o.size} o={o} on={!!sel && sel.letter === o.letter && sel.size === o.size} onPick={() => setSel({ letter: o.letter, size: o.size })} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </StagePanel>
  );
}


// ---------------------------------------------------------------------------------------------------------------------
// Shops: RS.7 Support and RS.9 Fortifications

/** Cart counts → a purchase list (ids repeated). */
function cartList(cart: Record<string, number>): string[] {
  return Object.entries(cart).flatMap(([id, n]) => Array<string>(n).fill(id));
}

/** The VP marker after paying `cost` toward the opponent of `side`. */
const vpAfter = (vp: number, side: Side, cost: number) => (side === 'axis' ? vp - cost : vp + cost);

function Stepper({ n, onAdd, onRemove, canAdd, label }: { n: number; onAdd: () => void; onRemove: () => void; canAdd: boolean; label: string }) {
  return (
    <span className="rsg-stepper">
      <button type="button" onClick={onRemove} disabled={n === 0} aria-label={`Remove ${label}`}>
        −
      </button>
      <b>{n}</b>
      <button type="button" onClick={onAdd} disabled={!canAdd} aria-label={`Add ${label}`}>
        +
      </button>
    </span>
  );
}

const KIND_TAG: Record<RsgSupportOption['kind'], string> = {
  leader: 'Leader',
  leaderEither: 'Leader (one of two)',
  unitWithWeapon: 'Unit with its Weapon',
  squad: 'Unit',
  radio: 'Radio',
};

export function SupportChoice({ view, step, onChoose }: ChoiceProps<'supportBuy'>) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const list = cartList(cart);
  const check = (buy: string[]) => rsgCheck(view, { what: 'supportBuy', buy });
  const err = check(list);
  const cost = list.reduce((n, id) => n + (step.options.find((o) => o.id === id)?.vp ?? 0), 0);
  const add = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const remove = (id: string) => setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) - 1) }));
  const after = vpAfter(view.vp, step.side, cost);
  const crosses = Math.sign(after) !== Math.sign(view.vp) && after !== 0;
  return (
    <StagePanel
      className="rsg-stage--shop"
      kicker="RS.7 Support"
      title="Buy Support"
      lead={
        <>
          You lead by {step.lead} VP and rolled <Dice white={step.roll[0]} coloured={step.roll[1]} size={20} /> = {sum(step.roll)} on your Support Table. Buy at
          least one item from that column; every VP you spend moves the marker toward the enemy. Every purchase but the last must leave the marker on your
          side; if the last one carries it past 0, the enemy rolls and buys in turn (one round only).
        </>
      }
      footer={
        <>
          <span className={`rsg-stage__note ${err && list.length ? 'is-error' : ''}`}>
            {list.length ? (err ?? `${list.length} item${list.length > 1 ? 's' : ''} for ${cost} VP${crosses ? ': the marker crosses 0, the enemy rolls next' : ''}.`) : 'The cart is empty.'}
          </span>
          <Button variant="ghost" disabled={!list.length} onClick={() => setCart({})}>
            Clear
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const c = suggestFor(view, step.side);
              if (c.what !== 'supportBuy') return;
              const next: Record<string, number> = {};
              for (const id of c.buy) next[id] = (next[id] ?? 0) + 1;
              setCart(next);
            }}
          >
            Buy for me
          </Button>
          <Button size="lg" disabled={!!err} onClick={() => onChoose({ what: 'supportBuy', buy: list })}>
            Buy{list.length ? ` for ${cost} VP` : ''}
          </Button>
        </>
      }
    >
      <VpTrack vp={view.vp} preview={after} names={{ axis: 'Germans', allied: nationLabel(view.allied, 'allied') }} />
      <ul className="rsg-shop">
        {step.options.map((o) => {
          const n = cart[o.id] ?? 0;
          const canAdd = !check([...list, o.id]);
          return (
            <li key={o.id} className={`rsg-shop__item ${n ? 'is-in' : ''}`}>
              <span className="rsg-shop__art">
                {Object.keys(o.pieces).map((t) => (COUNTERS[t] ? <Counter key={t} type={COUNTERS[t]} size={42} /> : null))}
              </span>
              <span className="rsg-shop__text">
                <b>{o.label}</b>
                <small>
                  {KIND_TAG[o.kind]}
                  {o.once ? ' · once' : ''}
                  {o.weapon && o.carrier ? ` · the ${COUNTERS[o.weapon]?.name ?? 'Weapon'} stays with it at set-up` : ''}
                </small>
              </span>
              <span className="rsg-shop__cost">
                {o.vp}
                <small>VP</small>
              </span>
              <Stepper n={n} onAdd={() => add(o.id)} onRemove={() => remove(o.id)} canAdd={canAdd} label={o.label} />
            </li>
          );
        })}
      </ul>
    </StagePanel>
  );
}

export function FortChoice({ view, step, onChoose }: ChoiceProps<'fortifications'>) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const list = cartList(cart);
  const check = (buy: string[]) => rsgCheck(view, { what: 'fortifications', buy });
  const err = check(list);
  const cost = list.reduce((n, id) => n + (step.options.find((o) => o.id === id)?.vp ?? 0), 0);
  const after = vpAfter(view.vp, step.side, cost);
  return (
    <StagePanel
      className="rsg-stage--shop"
      kicker="RS.9 Fortifications"
      title="Fortify your position"
      lead={
        <>
          As the Defender you may spend up to your lead of {step.budget} VP on Fortifications; the cost moves the marker toward the Attacker. All Minefields
          must have one strength. You place them after both sides have set up.
        </>
      }
      footer={
        <>
          <span className={`rsg-stage__note ${err ? 'is-error' : ''}`}>
            {err ?? (list.length ? `${cost} of ${step.budget} VP spent.` : 'Nothing bought yet: you may also fight without Fortifications.')}
          </span>
          <Button variant="ghost" disabled={!list.length} onClick={() => setCart({})}>
            Clear
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const c = suggestFor(view, step.side);
              if (c.what !== 'fortifications') return;
              const next: Record<string, number> = {};
              for (const id of c.buy) next[id] = (next[id] ?? 0) + 1;
              setCart(next);
            }}
          >
            Buy for me
          </Button>
          <Button size="lg" disabled={!!err} onClick={() => onChoose({ what: 'fortifications', buy: list })}>
            {list.length ? `Buy for ${cost} VP` : 'Buy nothing'}
          </Button>
        </>
      }
    >
      <VpTrack vp={view.vp} preview={after} names={{ axis: 'Germans', allied: nationLabel(view.allied, 'allied') }} />
      <ul className="rsg-shop">
        {step.options.map((o) => {
          const n = cart[o.id] ?? 0;
          return (
            <li key={o.id} className={`rsg-shop__item ${n ? 'is-in' : ''}`}>
              <span className="rsg-shop__art">
                <Forts contents={o.contents} minefield={o.minefield} size={40} />
              </span>
              <span className="rsg-shop__text">
                <b>{o.name}</b>
                <small>{fortText(o.contents, o.minefield)}</small>
              </span>
              <span className="rsg-shop__cost">
                {o.vp}
                <small>VP</small>
              </span>
              <Stepper n={n} onAdd={() => setCart((c) => ({ ...c, [o.id]: n + 1 }))} onRemove={() => setCart((c) => ({ ...c, [o.id]: Math.max(0, n - 1) }))} canAdd={!check([...list, o.id])} label={o.name} />
            </li>
          );
        })}
      </ul>
    </StagePanel>
  );
}

const FORT_NAME: Record<string, [string, string]> = {
  foxholes: ['Foxholes', 'Foxholes'],
  trench: ['Trench', 'Trenches'],
  pillbox: ['Pillbox', 'Pillboxes'],
  bunker: ['Bunker', 'Bunkers'],
  wire: ['Wire', 'Wire'],
  mines: ['Mines', 'Mines'],
};

export function fortText(contents: Record<string, number | undefined>, minefield?: number): string {
  return Object.entries(contents)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([k, n]) => `${n} ${FORT_NAME[k]?.[n === 1 ? 0 : 1] ?? k}${k === 'mines' && minefield ? ` (${minefield} FP)` : ''}`)
    .join(', ');
}

// ---------------------------------------------------------------------------------------------------------------------
// RS.11.1 Asset Request

export function AssetChoice({ step, onChoose }: ChoiceProps<'assetRequest'>) {
  const any = useMemo(() => step.radios.reduce((p, r) => p + r.chance, 0), [step.radios]);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return (
    <StagePanel
      kicker="RS.11 Asset Request"
      title="Request artillery?"
      lead={
        <>
          As the Attacker you may roll once more on your Support Table, for a Radio only. If the column has one for the year you must take it and pay its
          cost: the marker moves toward the Defender, who leads by {step.defenderLead} VP now. A Radio waits in your Artillery Box.
        </>
      }
      footer={
        <>
          <span className="rsg-stage__note">Chance of a Radio: {pct(any)}.</span>
          <Button variant="secondary" onClick={() => onChoose({ what: 'assetRequest', request: false })}>
            No request
          </Button>
          <Button size="lg" onClick={() => onChoose({ what: 'assetRequest', request: true })}>
            Request a Radio
          </Button>
        </>
      }
    >
      {step.radios.length ? (
        <table className="rsg-radios">
          <thead>
            <tr>
              <th />
              <th>Radio</th>
              <th>On a roll of</th>
              <th>Chance</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {step.radios.map((r) => (
              <tr key={r.radio}>
                <td>{COUNTERS[r.radio] ? <Counter type={COUNTERS[r.radio]} size={44} /> : null}</td>
                <td>{r.label}</td>
                <td>{r.rolls.join(', ')}</td>
                <td>{pct(r.chance)}</td>
                <td>{r.vp} VP</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="rsg-empty">Your Support Table has no Radio for this year: a request cannot bring one.</p>
      )}
    </StagePanel>
  );
}

/** The choice panel for the player's step. */
export function HumanChoice(p: { view: RsgDraft; step: RsgChoiceStep; onChoose: (c: RsgChoice) => void }) {
  const { view, step, onChoose } = p;
  switch (step.what) {
    case 'mapPick':
      return <MapPickChoice view={view} step={step} onChoose={onChoose} />;
    case 'mapEdgeDie':
      return <EdgeDieChoice view={view} step={step} onChoose={onChoose} />;
    case 'ob':
      return <ObChoice key={step.id} view={view} step={step} onChoose={onChoose} />;
    case 'supportBuy':
      return <SupportChoice key={step.id} view={view} step={step} onChoose={onChoose} />;
    case 'fortifications':
      return <FortChoice view={view} step={step} onChoose={onChoose} />;
    case 'assetRequest':
      return <AssetChoice view={view} step={step} onChoose={onChoose} />;
  }
}

