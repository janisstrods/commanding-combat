// The in-app rules reference: a topic list on the left, the chosen topic's text on the right (chips above the text on
// narrow screens). Written in our own words from design/rules-reference.md, the engine's authority. The card texts
// come from data/card-texts.ts and the terrain numbers from engine/terrain.ts, so they always match the engine.
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ACTION_TEXT, EVENT_TEXT, ORDER_TEXT } from '../../data/card-texts';
import { HEXSIDE, TERRAIN } from '../../engine/terrain';
import type { ActionName, EventName, HexsideFeature, OrderName, TerrainType } from '../../engine/types';
import { Button, Modal } from '../kit';
import './rules.css';

// ---------------------------------------------------------------------------------------------------------------------
// Topics

type TopicId =
  | 'basics'
  | 'fate-cards'
  | 'your-turn'
  | 'orders'
  | 'firing'
  | 'moving'
  | 'melee'
  | 'units'
  | 'weapons'
  | 'artillery'
  | 'actions'
  | 'events'
  | 'los'
  | 'terrain'
  | 'fortifications'
  | 'time'
  | 'victory'
  | 'initiative'
  | 'stacking'
  | 'this-edition';

interface Topic {
  id: TopicId;
  title: string;
  body: () => ReactNode;
}

const TOPICS: readonly Topic[] = [
  { id: 'basics', title: 'The game in brief', body: Basics },
  { id: 'fate-cards', title: 'Fate cards, rolls and triggers', body: FateCards },
  { id: 'your-turn', title: 'Your Turn', body: YourTurn },
  { id: 'orders', title: 'Orders', body: Orders },
  { id: 'firing', title: 'Firing', body: Firing },
  { id: 'moving', title: 'Moving', body: Moving },
  { id: 'melee', title: 'Melee', body: Melee },
  { id: 'units', title: 'Units and Leaders', body: Units },
  { id: 'weapons', title: 'Weapons and Radios', body: Weapons },
  { id: 'artillery', title: 'Artillery', body: Artillery },
  { id: 'actions', title: 'Actions', body: Actions },
  { id: 'events', title: 'Events', body: Events },
  { id: 'los', title: 'Line of sight', body: LineOfSight },
  { id: 'terrain', title: 'Terrain chart', body: TerrainChart },
  { id: 'fortifications', title: 'Fortifications', body: Fortifications },
  { id: 'time', title: 'Time and Sudden Death', body: TimeAndSuddenDeath },
  { id: 'victory', title: 'Victory', body: Victory },
  { id: 'initiative', title: 'Initiative', body: Initiative },
  { id: 'stacking', title: 'Stacking', body: Stacking },
  { id: 'this-edition', title: 'Playing this edition', body: ThisEdition },
];

/** The rules topics in order, for links from other screens (`<RulesDialog topic={id} … />`). */
export const RULES_TOPICS: { id: string; title: string }[] = TOPICS.map(({ id, title }) => ({ id, title }));

/** The topic shown last, so the dialog reopens where the player left it (per page load, not stored). */
let lastTopic: TopicId = TOPICS[0].id;

function topicFor(id: string | undefined): TopicId {
  const found = id === undefined ? undefined : TOPICS.find((t) => t.id === id);
  return found ? found.id : lastTopic;
}

// ---------------------------------------------------------------------------------------------------------------------
// The dialog

const GoTo = createContext<(id: TopicId) => void>(() => {});

export function RulesDialog({ open, onClose, topic }: { open: boolean; onClose: () => void; topic?: string }) {
  const [current, setCurrent] = useState<TopicId>(() => topicFor(topic));
  const textRef = useRef<HTMLElement>(null);

  // Opening (or being pointed at another topic while open) shows the asked-for topic, else the last one read.
  useLayoutEffect(() => {
    if (open) setCurrent(topicFor(topic));
  }, [open, topic]);

  useEffect(() => {
    lastTopic = current;
    if (textRef.current) textRef.current.scrollTop = 0;
  }, [current]);

  const index = Math.max(0, TOPICS.findIndex((t) => t.id === current));
  const shown = TOPICS[index];
  const prev = index > 0 ? TOPICS[index - 1] : null;
  const next = index < TOPICS.length - 1 ? TOPICS[index + 1] : null;
  const Body = shown.body;

  return (
    <Modal
      open={open}
      title="Rules Reference"
      onClose={onClose}
      width={920}
      footer={
        <div className="rules-foot">
          <Button variant="ghost" size="sm" disabled={!prev} onClick={() => prev && setCurrent(prev.id)} title={prev?.title}>
            ‹ <span className="rules-foot__name">{prev ? prev.title : 'Previous'}</span>
          </Button>
          <Button variant="ghost" size="sm" disabled={!next} onClick={() => next && setCurrent(next.id)} title={next?.title}>
            <span className="rules-foot__name">{next ? next.title : 'Next'}</span> ›
          </Button>
          <Button className="rules-foot__close" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <GoTo.Provider value={setCurrent}>
        <div className="rules-layout">
          <nav className="rules-nav" aria-label="Rules topics">
            {TOPICS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`rules-nav__btn ${t.id === current ? 'is-active' : ''}`}
                aria-current={t.id === current ? 'page' : undefined}
                onClick={() => setCurrent(t.id)}
              >
                {t.title}
              </button>
            ))}
          </nav>
          <article className="rules-text" ref={textRef} tabIndex={-1} aria-labelledby="rules-topic-title">
            <h3 className="rules-title" id="rules-topic-title">
              {shown.title}
            </h3>
            <Body />
          </article>
        </div>
      </GoTo.Provider>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Building blocks

function Sec({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rules-sec">
      <h4 className="rules-h">{title}</h4>
      {children}
    </section>
  );
}

/** A link to another topic. */
function Go({ to, children }: { to: TopicId; children: ReactNode }) {
  const go = useContext(GoTo);
  return (
    <button type="button" className="rules-go" onClick={() => go(to)}>
      {children}
    </button>
  );
}

/** A boxed aside: a tip, an example, or how this edition handles something. */
function Note({ kind = 'tip', children }: { kind?: 'tip' | 'example' | 'app'; children: ReactNode }) {
  const label = kind === 'tip' ? 'Tip' : kind === 'example' ? 'Example' : 'In this edition';
  return (
    <aside className={`rules-note rules-note--${kind}`}>
      <span className="rules-note__label">{label}</span>
      {children}
    </aside>
  );
}

function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="rules-table-wrap">
      <table className={`rules-table ${className ?? ''}`}>{children}</table>
    </div>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="rules-tag">{children}</span>;
}

/** A list of card entries: name, optional tags, the short card text and optional extra detail. */
function CardList({ items }: { items: { name: string; tags?: string[]; text: string; more?: ReactNode }[] }) {
  return (
    <dl className="rules-cards">
      {items.map((it) => (
        <div key={it.name} className="rules-cards__item">
          <dt>
            <span className="rules-cards__name">{it.name}</span>
            {it.tags?.map((t) => <Tag key={t}>{t}</Tag>)}
          </dt>
          <dd>
            {it.text}
            {it.more ? <span className="rules-cards__more"> {it.more}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Dice arithmetic (a Fate deck holds every ordered pair of dice exactly twice, so its odds are those of two dice)

const SUM_WAYS: readonly number[] = (() => {
  const w = new Array<number>(13).fill(0);
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) w[a + b]++;
  return w;
})();

const pct = (ways: number) => `${Math.round((ways / 36) * 100)}%`;

function waysAtLeast(n: number): number {
  let s = 0;
  for (let t = Math.max(2, n); t <= 12; t++) s += SUM_WAYS[t];
  return s;
}

function waysBelow(n: number): number {
  return 36 - waysAtLeast(n);
}

/** Ways (of 36) for a Targeting roll — the two dice multiplied — to be greater than r. */
function productAbove(r: number): number {
  let s = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a * b > r) s++;
  return s;
}

const SUMS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// ---------------------------------------------------------------------------------------------------------------------
// The game in brief

function Basics() {
  return (
    <>
      <p>
        <i>Combat Commander: Europe</i> is a game of infantry fighting in the Second World War. Each player commands the
        soldiers of one nation (<b>Germany</b>, <b>America</b> or <b>Russia</b>) on a map of 150 hexes: 15 lettered
        columns (A–O) by 10 numbered rows (1–10), so every hex has a name such as <b>C7</b>.
      </p>
      <Sec title="What makes it different">
        <ul>
          <li>
            <b>No dice.</b> Each nation has its own deck of 72 <b>Fate cards</b>. Cards are your Orders, your Actions,
            your Events, your dice and your Random Hexes all at once. See <Go to="fate-cards">Fate cards</Go>.
          </li>
          <li>
            <b>You command only what your hand allows.</b> To move you need a Move card; to shoot, a Fire card. You can
            give only a few Orders per Turn, and you may hold cards back to answer the enemy on his Turn.
          </li>
          <li>
            <b>Both players play all the time.</b> The inactive player answers with Actions: Op Fire at moving units,
            Concealment before a Defense Roll, Ambush before a melee, and so on.
          </li>
          <li>
            <b>The clock is unpredictable.</b> Time only moves when a <b>Time!</b> trigger turns up or a deck runs out.
            Once it reaches the <b>Sudden Death</b> space, every further advance may end the battle at once. See{' '}
            <Go to="time">Time and Sudden Death</Go>.
          </li>
        </ul>
      </Sec>
      <Sec title="Turns">
        <p>
          The players simply take turns: there are no phases or game rounds. On your <b>Turn</b> you either give one or
          more <b>Orders</b> (up to your nation&rsquo;s Orders per Turn), or you <b>pass</b> and may discard cards.
          Then you refill your hand and your opponent&rsquo;s Turn begins. See <Go to="your-turn">Your Turn</Go>.
        </p>
      </Sec>
      <Sec title="Winning">
        <ul>
          <li>
            <b>Victory points (VP)</b> come from eliminating enemy units, exiting your units off the enemy&rsquo;s map
            edge, controlling Objectives that Objective chits give a value, and a few Events and Actions.
          </li>
          <li>
            A player loses at once if his casualties reach his <b>Surrender</b> level, or if his last unit on the map is
            eliminated.
          </li>
          <li>
            Otherwise the game ends by Sudden Death (or when a side voluntarily takes its last unit off the map) and the
            side the VP favour wins. A tie goes to the holder of the <b>Initiative</b> card. See <Go to="victory">Victory</Go>.
          </li>
        </ul>
      </Sec>
      <Sec title="Posture">
        <p>
          Each side has a <b>posture</b> for the scenario: <b>Attack</b>, <b>Recon</b> or <b>Defend</b>. It sets your hand
          size (6, 5 or 4 cards). The side in Defend posture is the scenario <b>Defender</b>: it gains 1 VP every time
          Time advances, and it alone may play the &ldquo;Hidden&rdquo; Actions and Bore Sighting.
        </p>
      </Sec>
      <Sec title="Two principles">
        <ul>
          <li>
            <b>The card wins.</b> If a card says something that contradicts a rule, do what the card says.
          </li>
          <li>
            <b>Read it literally.</b> Apply only what a rule or card actually says. &ldquo;A unit&rdquo; means a unit of
            either side unless the text says friendly or enemy.
          </li>
        </ul>
      </Sec>
      <Sec title="The three nations">
        <Table>
          <thead>
            <tr>
              <th />
              <th>Germany</th>
              <th>America</th>
              <th>Russia</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Discard when passing</th>
              <td>up to 6</td>
              <td>up to 5</td>
              <td>up to 3</td>
            </tr>
            <tr>
              <th>Typical Leaders</th>
              <td>1 per 3 Squads</td>
              <td>1 per 4 Squads</td>
              <td>1 per 5 Squads</td>
            </tr>
            <tr>
              <th>Troops</th>
              <td>solid, many boxed stats, the best machine guns</td>
              <td>long Range and high Firepower, good broken Morale</td>
              <td>high Morale, short Range, large forces</td>
            </tr>
            <tr>
              <th>Deck specialities</th>
              <td>Blaze Events, Marksmanship, No Quarter (only against Russians)</td>
              <td>most Fire cards, many Smoke Grenades, White Phosphorus</td>
              <td>Commissar, Entrench, many Light Wounds and Concealment, No Quarter</td>
            </tr>
          </tbody>
        </Table>
      </Sec>
      <Sec title="Words used throughout">
        <dl className="rules-glossary">
          <dt>Active / inactive player</dt>
          <dd>The player whose Turn it is, and the other one.</dd>
          <dt>Activate</dt>
          <dd>Choosing units to carry out an Order or Op Fire. A unit is activated at most once per Turn (Heroes excepted).</dd>
          <dt>Adjacent</dt>
          <dd>Sharing a hexside.</dd>
          <dt>Unit</dt>
          <dd>A Squad (4 figures), a Team (2 figures) or a Leader (1 figure).</dd>
          <dt>Piece</dt>
          <dd>A unit, Weapon, Radio or Fortification. Everything else on the map is a marker.</dd>
          <dt>Broken</dt>
          <dd>A unit, Weapon or Radio flipped to its reverse side. Breaking again eliminates it.</dd>
          <dt>Friendly hex</dt>
          <dd>
            A hex with one of your units, or an Objective you control that holds no enemy unit. Fortifications belong to
            nobody.
          </dd>
          <dt>Random Hex</dt>
          <dd>A hex picked by revealing a card and reading the hex printed on it.</dd>
          <dt>Cover, Hindrance, Obstacle</dt>
          <dd>
            Terrain values: Cover protects the units in a hex; a Hindrance weakens fire through it; an Obstacle blocks
            line of sight. See the <Go to="terrain">Terrain chart</Go>.
          </dd>
        </dl>
      </Sec>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Fate cards

function FateCards() {
  return (
    <>
      <p>
        Every Fate card carries an <b>Order</b>, an <b>Action</b>, an <b>Event</b>, a <b>Random Hex</b> and a pair of
        dice (one white, one coloured). The dice may sit inside a red box: that is a <b>trigger</b>.
      </p>
      <Sec title="Hand, draw pile and discards">
        <ul>
          <li>
            Your <b>hand</b> is secret. Both <b>draw piles</b> are face down and nobody knows their order. Both{' '}
            <b>discard piles</b> are open and may be looked through at any time.
          </li>
          <li>
            A card in hand is played for <b>one</b> purpose only: its Order (on your own Turn) or its Action (on either
            Turn, when its condition is met). Then it goes to your discard pile.
          </li>
          <li>
            A card whose top reads <b>Order/Action Fire</b> can be a Fire Order, or a Fire Action (Op Fire), or the
            Action printed under its picture.
          </li>
          <li>
            The <b>Event</b> and everything below it are ignored while the card is in your hand. Events happen only when
            a card is revealed by an Event! trigger.
          </li>
          <li>
            Your deck is reshuffled only during a Time advance: the player who caused it shuffles his draw pile and
            discard pile together. His hand is not touched.
          </li>
        </ul>
      </Sec>
      <Sec title="Revealing and rolling">
        <p>
          To <b>reveal</b>, turn the top card of your own draw pile face up onto your discard pile. Every die roll,
          Random Hex, Event draw and artillery drift check is a reveal, always from the deck of the player doing it.
        </p>
        <ul>
          <li>
            A <b>roll</b> uses only the card&rsquo;s two dice, added together. The one exception is the{' '}
            <b>Targeting roll</b> of Ordnance and artillery, which multiplies them (see <Go to="firing">Firing</Go>).
          </li>
          <li>
            A <b>Random Hex</b> uses only the card&rsquo;s hex. Before anything else happens, its number is compared with
            every broken Weapon on the map, which may be fixed or eliminated (see <Go to="weapons">Weapons</Go>). German
            cards show odd hex numbers (1, 3, 5, 7, 9); American and Russian cards even ones.
          </li>
          <li>
            Each deck contains every combination of the two dice exactly twice, so a deck rolls with exactly the odds of
            two real dice — but a card once drawn stays out until the next reshuffle.
          </li>
        </ul>
        <Table className="rules-table--odds">
          <thead>
            <tr>
              <th>Roll</th>
              {SUMS.map((s) => (
                <th key={s}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Chance</th>
              {SUMS.map((s) => (
                <td key={s}>{pct(SUM_WAYS[s])}</td>
              ))}
            </tr>
            <tr>
              <th>This or more</th>
              {SUMS.map((s) => (
                <td key={s}>{pct(waysAtLeast(s))}</td>
              ))}
            </tr>
          </tbody>
        </Table>
      </Sec>
      <Sec title="Who rolls">
        <ul>
          <li><b>Fire Attack</b> and <b>Targeting</b>: the firing player.</li>
          <li><b>Defense Roll</b>: the owner of each defending unit.</li>
          <li><b>Rally</b> (Recover Order): the owner of the broken units.</li>
          <li><b>Rout</b>: the player who gave the Rout Order, whoever owns the units.</li>
          <li><b>Melee</b>: both sides, the inactive player first.</li>
          <li><b>Mine attack</b>: the opponent of the units entering or leaving the minefield.</li>
          <li><b>Sudden Death</b>: the player whose card advanced Time.</li>
        </ul>
      </Sec>
      <Sec title="Triggers">
        <p>A trigger on a revealed roll pauses play. It is dealt with before the roll takes effect.</p>
        <ul>
          <li>
            <b>Event!</b> — the roller reveals his next card and carries out its Event. He makes the Event&rsquo;s
            choices unless it says otherwise.
          </li>
          <li>
            <b>Jammed!</b> — counts only on a <b>Fire Attack roll</b>: every Weapon firing in that attack breaks (one
            already broken is eliminated). The attack still goes ahead at full strength. On any other roll Jammed! does
            nothing.
          </li>
          <li>
            <b>Sniper!</b> — the roller reveals his next card for a Random Hex (broken Weapons are checked first). He may
            then break one unit of either side in that hex or next to it. He may also decline.
          </li>
          <li>
            <b>Time!</b> — the Time marker advances (see <Go to="time">Time</Go>).
          </li>
        </ul>
        <p>How triggers fit in:</p>
        <ul>
          <li>
            The roll&rsquo;s number is fixed, but its <b>result waits</b> until the trigger is completely resolved.
          </li>
          <li>
            <b>Rolls made while resolving a trigger never trigger</b>: the Sudden Death roll, every roll inside an Event,
            and a melee fought inside an Event.
          </li>
          <li>
            If the triggering card was the last card of the deck, Time advances first and then the trigger is resolved.
            A Time! trigger on the last card advances Time only once.
          </li>
          <li>The Initiative re-roll is decided after a roll is seen and before its trigger or result is applied.</li>
        </ul>
        <Note kind="example">
          A Rout roll would make a broken Squad retreat 2 hexes, and the card shows Event!. The Event is resolved first
          — even if it rallies that Squad, the Squad still retreats afterwards.
        </Note>
        <Table>
          <thead>
            <tr>
              <th>Triggers per deck</th>
              <th>Event!</th>
              <th>Sniper!</th>
              <th>Jammed!</th>
              <th>Time!</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Germany</th>
              <td>10</td>
              <td>7</td>
              <td>2</td>
              <td>2</td>
            </tr>
            <tr>
              <th>America</th>
              <td>12</td>
              <td>6</td>
              <td>2</td>
              <td>2</td>
            </tr>
            <tr>
              <th>Russia</th>
              <td>8</td>
              <td>8</td>
              <td>4</td>
              <td>2</td>
            </tr>
          </tbody>
        </Table>
        <p className="rules-small">
          Time! always sits on a roll of 6 + 6 and Jammed! on 1 + 1 (Russia also has it on 1 + 2).
        </p>
      </Sec>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Your Turn

function YourTurn() {
  return (
    <>
      <p>
        On your Turn you do <b>one</b> of two things: give <b>Orders</b>, or <b>pass</b>. Throughout, both players may
        play Actions whenever their conditions are met.
      </p>
      <Sec title="Giving Orders">
        <ul>
          <li>
            Play one Order card at a time and carry it out completely, including every Action played in answer to it,
            before you decide on the next. Orders never overlap.
          </li>
          <li>
            You may give up to your side&rsquo;s <b>Orders per Turn</b> (1 to 6, set by the scenario), and you may stop
            early. You need a card naming the Order you want to give.
          </li>
          <li>
            Most Orders <b>activate</b> one unit that has not been activated yet this Turn. If it is a Leader, he may
            also activate any of your other non-Leader units within his <b>Command radius</b> that are also not yet
            activated. Name them all before carrying out the Order. Recover and Rout activate a <i>player</i> instead.
          </li>
          <li>
            At least one activated unit must actually carry the Order out. A Move Order needs at least one unit that
            really moves into another hex.
          </li>
        </ul>
      </Sec>
      <Sec title="Passing and discarding">
        <p>
          If you give no Order at all, you <b>pass</b>, and may discard any number of cards from <b>zero</b> up to your
          nation&rsquo;s limit. A player who gave even one Order cannot discard that Turn.
        </p>
        <Table>
          <thead>
            <tr>
              <th>Discard limit</th>
              <th>Germany</th>
              <th>America</th>
              <th>Russia</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Cards</th>
              <td>6</td>
              <td>5</td>
              <td>3</td>
            </tr>
          </tbody>
        </Table>
        <p className="rules-small">Some scenarios change these limits.</p>
        <p>
          A pass with at least one card discarded is what the enemy&rsquo;s <b>Demolitions</b> and <b>Hidden Unit</b>{' '}
          Actions wait for.
        </p>
      </Sec>
      <Sec title="End of the Turn">
        <ol>
          <li>
            <b>Stacking</b> is checked for both players: any hex with more than 7 figures of one side must be fixed (see{' '}
            <Go to="stacking">Stacking</Go>).
          </li>
          <li>
            <b>Hand refill</b>: the active player only draws until his hand is back to his hand size. If his deck runs out
            while drawing, Time advances, and he finishes drawing from the new deck.
          </li>
          <li>The other player&rsquo;s Turn begins.</li>
        </ol>
        <Table>
          <thead>
            <tr>
              <th>Hand size</th>
              <th>Attack</th>
              <th>Recon</th>
              <th>Defend</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Cards</th>
              <td>6</td>
              <td>5</td>
              <td>4</td>
            </tr>
          </tbody>
        </Table>
        <p className="rules-small">This is also the size of your opening hand.</p>
        <Note>
          You refill only at the end of your own Turn. Cards you spend on Actions during the enemy&rsquo;s Turn stay spent
          until then, so keep that in mind before you answer every enemy move.
        </Note>
      </Sec>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Orders

function Orders() {
  return (
    <>
      <p>
        An Order is given on your own Turn by playing a card with that Order. The short text on each card is shown in
        italics; the details follow.
      </p>
      <Sec title="Advance">
        <p className="rules-lead">{ORDER_TEXT.Advance}</p>
        <ul>
          <li>Each activated unit may step into one adjacent hex and stops there. Movement Points and terrain costs do not matter.</li>
          <li>
            Advancing into an <b>enemy hex</b> is allowed; a <Go to="melee">melee</Go> follows at the end of the Order.
          </li>
          <li>
            The enemy cannot Op Fire at Advancing units, but Mines still attack them, and the Defender may play Hidden
            Mines or Hidden Wire on them.
          </li>
          <li>An Advancing unit may cross a Cliff if it carries no Weapon, and may exit off the enemy&rsquo;s edge for VP.</li>
          <li>
            It may not enter an impassable hex (Water Barrier, Blaze), cross a Major Bridge except along its road or
            railway, or leave by a flank or its own edge.
          </li>
          <li>The activated units need not go to the same hex.</li>
        </ul>
      </Sec>
      <Sec title="Artillery Denied">
        <p className="rules-lead">{ORDER_TEXT['Artillery Denied']}</p>
        <ul>
          <li>Needs an enemy Radio in play. An eliminated Radio goes back to the counter mix.</li>
        </ul>
      </Sec>
      <Sec title="Artillery Request">
        <p className="rules-lead">{ORDER_TEXT['Artillery Request']}</p>
        <ul>
          <li>
            <b>Battery Access</b>: if your Radio is broken, flip it back. Nothing is activated, so a second Artillery
            Request in the same Turn can then fire.
          </li>
          <li>
            <b>Fire for Effect</b>: with a working Radio, activate an unbroken Leader who has not been activated this
            Turn as the <b>Spotter</b>. The full procedure is under <Go to="artillery">Artillery</Go>.
          </li>
        </ul>
      </Sec>
      <Sec title="Command Confusion">
        <p className="rules-lead">{ORDER_TEXT['Command Confusion']}</p>
        <ul>
          <li>It is a dead Order. Some of these cards have a usable Action; on others both halves are Command Confusion.</li>
        </ul>
      </Sec>
      <Sec title="Fire">
        <p className="rules-lead">{ORDER_TEXT.Fire}</p>
        <ul>
          <li>
            Legal only if at least one activated unit (or its Weapon) has an enemy unit within both its Range and line of
            sight. The others activated with it need not.
          </li>
          <li>Each activated unit and each activated Weapon fires once. A unit and its own Weapon may fire separately, even at different hexes.</li>
          <li>
            Everything about the shot — Fire Groups, Hindrance, Defense Rolls — is under <Go to="firing">Firing</Go>.
          </li>
        </ul>
      </Sec>
      <Sec title="Move">
        <p className="rules-lead">{ORDER_TEXT.Move}</p>
        <ul>
          <li>
            Movement Points, terrain costs, moving in groups, Weapon transfer and Op Fire are explained under{' '}
            <Go to="moving">Moving</Go>.
          </li>
        </ul>
      </Sec>
      <Sec title="Recover">
        <p className="rules-lead">{ORDER_TEXT.Recover}</p>
        <ul>
          <li>
            You may give it only while one or more of your units is broken or Suppressed, and only if no Recover or Rout
            has activated you yet this Turn.
          </li>
          <li>
            It activates <i>you</i>, not your units, so the units that recover can still be activated by another Order
            this Turn.
          </li>
          <li>First every Suppressed marker of yours is removed. Then you make a <b>Rally roll</b> for each unit that was broken when the Order was given, in the order you choose:</li>
        </ul>
        <Table>
          <thead>
            <tr>
              <th>Rally roll compared with the unit&rsquo;s Morale</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Less than Morale</td>
              <td>
                <b>Rallies</b>: flips back to its unbroken side
              </td>
            </tr>
            <tr>
              <td>Equal to Morale</td>
              <td>
                Becomes <b>Suppressed</b> (and stays broken)
              </td>
            </tr>
            <tr>
              <td>More than Morale</td>
              <td>Nothing happens</td>
            </tr>
          </tbody>
        </Table>
        <p className="rules-small">
          Morale here is the unit&rsquo;s current broken-side Morale with everything that changes it: Cover, Leader
          Command, Veteran, Suppressed, Wire. Units broken during the Order (by an Event, say) do not roll.
        </p>
      </Sec>
      <Sec title="Rout">
        <p className="rules-lead">{ORDER_TEXT.Rout}</p>
        <ul>
          <li>
            You may rout <b>either</b> player — usually the enemy — as long as he has a broken unit and no Recover or Rout
            has activated him yet this Turn. So at most two Routs per Turn (one per player), and a Recover excludes a Rout
            on yourself.
          </li>
          <li>The player who gives the Order rolls, from his own deck, for each of that player&rsquo;s units that were broken when it was given:</li>
        </ul>
        <Table>
          <thead>
            <tr>
              <th>Rout roll compared with the unit&rsquo;s Morale</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Less than Morale</td>
              <td>Nothing happens</td>
            </tr>
            <tr>
              <td>Equal to Morale</td>
              <td>
                Becomes <b>Suppressed</b> (if it is not already)
              </td>
            </tr>
            <tr>
              <td>More than Morale</td>
              <td>
                Must <b>retreat</b> as many hexes as the difference
              </td>
            </tr>
          </tbody>
        </Table>
        <ul>
          <li>
            The owner moves a retreating unit. Every hex it enters must be closer to his own friendly map edge than the
            hex it left. Terrain costs are ignored, Wire does not stop it, there is no Op Fire, but Mines attack it.
          </li>
          <li>
            A unit is <b>eliminated</b> if the only way on is off its own edge, into an enemy hex, into an impassable hex
            or across a Cliff.
          </li>
          <li>Retreating into an overstacked hex is allowed; it is fixed at the end of the Turn.</li>
        </ul>
      </Sec>
      <Sec title="How many of each">
        <Table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Germany</th>
              <th>America</th>
              <th>Russia</th>
            </tr>
          </thead>
          <tbody>
            {ORDER_MIX.map(([name, g, a, r]) => (
              <tr key={name}>
                <th>{name}</th>
                <td>{g}</td>
                <td>{a}</td>
                <td>{r}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Sec>
    </>
  );
}

const ORDER_MIX: readonly [OrderName, number, number, number][] = [
  ['Fire', 18, 20, 18],
  ['Move', 12, 12, 13],
  ['Rout', 10, 9, 9],
  ['Recover', 9, 8, 9],
  ['Command Confusion', 8, 7, 8],
  ['Artillery Request', 8, 9, 6],
  ['Advance', 5, 4, 6],
  ['Artillery Denied', 2, 3, 3],
];

// ---------------------------------------------------------------------------------------------------------------------
// Firing

const TARGET_RANGES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16];

function Firing() {
  return (
    <>
      <p>
        Units fire with a <b>Fire Order</b>, with <b>Op Fire</b> during an enemy Move, or with <b>Assault Fire</b> while
        moving. A shot goes through the same steps each time.
      </p>
      <Sec title="1. Choose a target">
        <ul>
          <li>
            The target is one hex within the firer&rsquo;s <b>Range</b> and <b>line of sight</b> that holds at least one
            enemy unit. Every enemy unit in that hex is attacked; units in hexes along the way are never hit.
          </li>
          <li>
            <b>Range</b> is counted from the firer to the target, counting the target hex but not the firer&rsquo;s own.
            An adjacent hex is range 1.
          </li>
          <li>
            A <b>broken</b> unit can still fire with its (weaker) broken-side Firepower, but cannot fire its Weapon. A{' '}
            <b>Suppressed</b> unit also cannot fire its Weapon.
          </li>
        </ul>
      </Sec>
      <Sec title="2. Fire Groups">
        <ul>
          <li>
            Two or more activated pieces may fire together as a <b>Fire Group</b>. Each needs Range and line of sight to the
            target. If they are in several hexes, those hexes must form a chain, each adjacent to another.
          </li>
          <li>
            Group Firepower = the <b>best single piece&rsquo;s FP + 1 for each other piece</b>.
          </li>
          <li>
            Ordnance never joins a Fire Group, and pieces in a Wire hex cannot group with pieces outside it. Pieces may
            always fire separately or in smaller groups instead.
          </li>
        </ul>
        <Note kind="example">
          Three Squads with FP 5, 4 and 4 fire together: 5 + 1 + 1 = <b>7</b>, not 13. Groups add certainty, not raw
          power.
        </Note>
      </Sec>
      <Sec title="3. Modify the Firepower">
        <ul>
          <li>
            <b>Hindrance</b>: subtract the single <b>largest</b> Hindrance on the line of sight of any firing piece.
            Hindrances are never added together.
          </li>
          <li>
            <b>Height</b>: −1 FP if the target hex is higher than any one of the firing pieces; +1 FP if it is lower than
            any one of them. In a mixed group both can apply.
          </li>
          <li>
            <b>Bonus Actions</b>, +2 FP each: Bore Sighting, Crossfire, Hand Grenades, Marksmanship and Sustained Fire.
            Spray Fire lets one shot hit two adjacent hexes. See <Go to="actions">Actions</Go>.
          </li>
          <li>
            If the final Firepower is <b>0 or less</b>, the shot cannot be made (the pieces may pick another target).
            Bonus Actions may be played to lift it to 1 or more.
          </li>
        </ul>
      </Sec>
      <Sec title="4. Fire Attack Roll">
        <ul>
          <li>
            <b>Attack Total = Firepower + roll.</b>
          </li>
          <li>
            A <b>Jammed!</b> trigger breaks every Weapon that fired in this attack — but the attack still happens.
          </li>
          <li>
            <b>Airburst</b>: a Mortar or Artillery attack on a Woods hex adds +2 to the Attack Total.
          </li>
        </ul>
      </Sec>
      <Sec title="5. Defense Rolls">
        <p>
          The defender rolls separately for <b>every unit</b> that was in the hex when the attack was rolled, in any order
          he likes. <b>Defense Total = the unit&rsquo;s current Morale + roll.</b> Current Morale includes Cover, Leader
          Command, Veteran, Suppressed and Wire.
        </p>
        <Table>
          <thead>
            <tr>
              <th>Defense Total compared with the Attack Total</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Lower</td>
              <td>
                The unit <b>breaks</b> (if already broken, it is <b>eliminated</b>)
              </td>
            </tr>
            <tr>
              <td>Equal</td>
              <td>
                The unit is <b>Suppressed</b> — but a unit activated to Move <b>breaks</b> instead
              </td>
            </tr>
            <tr>
              <td>Higher</td>
              <td>No effect</td>
            </tr>
          </tbody>
        </Table>
        <ul>
          <li>Every unit rolls even when it cannot lose, because the roll may still produce a trigger.</li>
          <li>All the Defense Rolls of one attack are made before the next attack is announced.</li>
        </ul>
        <Note>
          Roll for a Leader last. If he breaks first, his Command bonus to the other units in the hex drops before they
          roll.
        </Note>
      </Sec>
      <Sec title="Cover">
        <ul>
          <li>
            <b>Cover</b> is added to the Morale of every unit in the hex, for every purpose: Defense, Rally and Rout rolls
            alike.
          </li>
          <li>
            Cover is <b>never added up</b>. If a hex offers several (the terrain, a Fortification, a Wall or Hedge the shot
            crosses), the defender uses the single best one.
          </li>
          <li>
            A <b>Road</b> in the hex lowers whatever Cover is used by 1. Against a Flamethrower or Mines, Cover is always 0.
          </li>
          <li>
            The <b>Concealment</b> Action subtracts the target hex&rsquo;s Cover from the Attack Total a second time.
          </li>
        </ul>
      </Sec>
      <Sec title="Ordnance and Targeting">
        <p>
          Weapons whose numbers sit on a white band are <b>Ordnance</b> (mortars, guns, the Flamethrower, the Satchel
          Charge and the like). Ordnance must first <b>hit</b> the target hex:
        </p>
        <ul>
          <li>
            <b>Targeting roll</b>: <b>multiply</b> the two dice and subtract the largest Hindrance on the line of sight. It
            hits if the result is <b>greater than the range</b>.
          </li>
          <li>
            On a hit, make a normal Fire Attack Roll with the Weapon&rsquo;s Firepower. Hindrance is not subtracted again,
            and Leaders never add their Command to Ordnance.
          </li>
          <li>
            Ordnance never joins a Fire Group and never makes Op Fire. The unit carrying it can still fire its own
            Firepower.
          </li>
          <li>Event!, Sniper! and Time! work on a Targeting roll; Jammed! does not.</li>
          <li>
            A Weapon showing <b>Smoke</b> may fire smoke instead, at any hex in Range and line of sight, enemy or not. Say
            so before rolling; a hit places a random Smoke marker there and nothing is attacked.
          </li>
        </ul>
        <Table className="rules-table--odds">
          <thead>
            <tr>
              <th>Range + Hindrance</th>
              {TARGET_RANGES.map((r) => (
                <th key={r}>{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Chance to hit</th>
              {TARGET_RANGES.map((r) => (
                <td key={r}>{pct(productAbove(r))}</td>
              ))}
            </tr>
          </tbody>
        </Table>
        <p className="rules-small">
          1 × 1 always misses; 6 × 6 = 36 hits anything in Range. A 1 and a 6 make 6, which hits at range 5 or less.
        </p>
      </Sec>
      <Note kind="example">
        A Squad with FP 5 stacked with a Command-1 Leader fires at 6. A second Squad joins: 7. The line of sight crosses
        an Orchard (Hindrance 2): 5. Hand Grenades: 7. The roll is 8, so the Attack Total is 15. A defending Squad with
        Morale 8 in Woods (Cover 2) has 10 and rolls 6: 16 beats 15, no effect. A roll of 5 would tie: Suppressed.
      </Note>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Moving

function Moving() {
  return (
    <>
      <Sec title="Movement Points">
        <ul>
          <li>
            Each unit activated by a <b>Move Order</b> has Movement Points (MP) equal to its current Movement: printed
            value, plus Leader Command, Veteran and the Road bonus, minus Suppressed and any Weapon penalty (the red
            number on some Weapons).
          </li>
          <li>
            These values change as the unit moves. A Squad that walks out of its Leader&rsquo;s hex loses his bonus at
            once.
          </li>
          <li>
            <b>Road bonus</b>: once a unit has entered any hex with a Road, it has +1 Movement for the rest of that Move
            Order.
          </li>
        </ul>
      </Sec>
      <Sec title="What a hex costs">
        <ul>
          <li>
            The <b>Move cost</b> of the hex entered (see the <Go to="terrain">Terrain chart</Go>); only 1 if the unit
            crosses a Road, Trail or Railway hexside into a hex with that same road.
          </li>
          <li>
            <b>+1</b> to cross a Fence, Hedge or Wall hexside.
          </li>
          <li>
            <b>+1</b> to enter a hex higher than the one left (going downhill is free).
          </li>
          <li>
            A unit may enter a hex only if it has enough MP left to pay the whole cost. There is no &ldquo;always one
            hex&rdquo; rule: a unit that cannot afford any hex must wait for an Advance (or a Rout).
          </li>
          <li>
            <b>Wire</b>: a moving unit loses all its remaining MP right after it enters or leaves a Wire hex. <b>Trenches</b>:
            moving between connected Trench hexes costs exactly 1 MP. See <Go to="fortifications">Fortifications</Go>.
          </li>
        </ul>
      </Sec>
      <Sec title="One at a time, or together">
        <ul>
          <li>Normally one unit finishes its whole move before the next one starts.</li>
          <li>
            Units activated in the <b>same hex</b> may move as a <b>group</b>. They stay together for the whole Order, and
            the slowest member sets the pace. If a member breaks and cannot pay for the next hex, the group stops.
          </li>
        </ul>
      </Sec>
      <Sec title="Handing over a Weapon">
        <p>
          At any point, a moving unit may spend <b>1 MP</b> to hand its Weapon to a friendly unit in the same hex that has
          none. The receiver need not be activated. No hex is entered, so this never draws Op Fire.
        </p>
      </Sec>
      <Sec title="Where a unit may not go">
        <ul>
          <li>Into a hex with enemy units (that takes an Advance).</li>
          <li>Into an impassable hex: Water Barrier or Blaze.</li>
          <li>Across a Cliff hexside.</li>
          <li>Into or out of a Major Bridge hex except along its road or railway.</li>
          <li>Off the map by a flank or by its own edge.</li>
        </ul>
      </Sec>
      <Sec title="Opportunity Fire (Op Fire)">
        <p>
          Every time a moving unit or group spends MP to enter a new hex, play stops and the inactive player may{' '}
          <b>Op Fire</b> at <b>the hex just entered</b>:
        </p>
        <ol>
          <li>
            He may play <b>Fire</b> cards as Actions. Each one activates a unit, or a Leader and units in his Command
            radius, just like a Fire Order. Each such activation needs an enemy unit in Range and line of sight.
          </li>
          <li>
            Then he may make <b>one</b> Fire Attack at that hex, with any of the units he has activated for Op Fire so far
            during this Move Order (alone or as a Fire Group).
          </li>
        </ol>
        <ul>
          <li>
            Units activated for Op Fire stay activated: they may fire again at later hexes in the same Move Order, but they
            cannot be activated again this Turn. A later Move Order needs fresh units and fresh Fire cards.
          </li>
          <li>Ordnance cannot Op Fire; the unit carrying it can.</li>
          <li>
            A tied Defense Roll <b>breaks</b> a unit activated to Move instead of suppressing it, and <b>Crossfire</b> adds
            +2 FP against moving units. Moving in the open is dangerous.
          </li>
          <li>No Op Fire at Advancing or Retreating units, at units exiting the map, or into a hex entered from a connected Trench.</li>
        </ul>
        <p>
          After each hex entered, the <b>inactive player plays all his Actions first</b> (Op Fire, Hidden Mines, Hidden
          Wire), then the active player (Smoke Grenades, Assault Fire).
        </p>
      </Sec>
      <Sec title="Exiting the map">
        <p>
          A moving unit on the <b>enemy&rsquo;s</b> map edge may leave the map for 1 MP (no Op Fire, no hex is entered).
          It scores <Go to="victory">exit VP</Go> at once and waits on the Time Track to come back later as a
          reinforcement.
        </p>
      </Sec>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Melee

function Melee() {
  return (
    <>
      <Sec title="When">
        <ul>
          <li>
            A melee is fought at the end of any Order or trigger after which a hex holds units of <b>both sides</b> —
            usually after an Advance, sometimes after reinforcements arrive or units flee a Blaze.
          </li>
          <li>
            A melee caused inside an Event is fought at the end of that Event, still inside it, so its rolls cannot
            trigger.
          </li>
          <li>With several melee hexes, the active player picks the order, one hex at a time.</li>
        </ul>
      </Sec>
      <Sec title="Ambush">
        <p>
          Before any melee dice: the inactive player plays all the <b>Ambush</b> Actions he wants, then the active player.
          Each Ambush forces the opponent to break one of his units in that melee (a broken unit breaking again is
          eliminated). If one side has no units left, the melee is over.
        </p>
      </Sec>
      <Sec title="Strength">
        <ul>
          <li>
            Each side adds up the <b>current Firepower of its units</b> in the hex: <b>Weapons do not count</b>; Leader
            Command, Veteran, Suppressed, Wire and broken sides all do.
          </li>
          <li>
            Add <b>+1 for each unit with boxed Firepower</b>. This is the side&rsquo;s Melee Firepower, fixed from now on.
          </li>
        </ul>
      </Sec>
      <Sec title="Rolls and result">
        <ul>
          <li>The inactive player rolls and adds his Melee Firepower; then the active player does the same.</li>
          <li>
            The side with the <b>lower total loses every unit</b> it had in the melee.
          </li>
          <li>
            On a <b>tie, both sides are eliminated</b> — unless one side began the melee in a <b>Bunker or Pillbox</b> hex
            it held (it was the last to occupy the hex alone). Then only the other side is eliminated.
          </li>
          <li>If a trigger during the melee rolls leaves a side with no units in the hex, the melee simply ends.</li>
          <li>
            A survivor&rsquo;s player may play <b>No Quarter</b> afterwards for +2 VP (Germans only against Russians;
            Russians against anyone).
          </li>
        </ul>
        <Note>
          Melee is all or nothing: one roll decides the fate of every unit in the hex. Soften the defenders up with fire
          first, bring boxed-Firepower units, and keep an Ambush in hand.
        </Note>
      </Sec>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Units and Leaders

function Units() {
  return (
    <>
      <Sec title="Squads, Teams and Leaders">
        <Table>
          <thead>
            <tr>
              <th>Unit</th>
              <th>Figures</th>
              <th>VP to the enemy if eliminated</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Squad</th>
              <td>4</td>
              <td>2</td>
            </tr>
            <tr>
              <th>Team</th>
              <td>2</td>
              <td>1</td>
            </tr>
            <tr>
              <th>Leader</th>
              <td>1</td>
              <td>1 + his unbroken Command</td>
            </tr>
            <tr>
              <th>Hero</th>
              <td>1</td>
              <td>0</td>
            </tr>
          </tbody>
        </Table>
        <ul>
          <li>
            Along the bottom of a counter: <b>Firepower</b> (FP), <b>Range</b> and <b>Movement</b>. Top right:{' '}
            <b>Morale</b>, its defence strength and the number its Rally and Rout rolls are compared with. Leaders also show{' '}
            <b>Command</b> in a hexagon.
          </li>
          <li>
            A <b>box</b> around a stat gives a special ability: boxed <b>FP</b> gives +1 in melee and allows Assault Fire;
            boxed <b>Range</b> allows Spray Fire; boxed <b>Movement</b> allows Smoke Grenades.
          </li>
          <li>
            Each side&rsquo;s troops have a <b>quality</b> (Elite, Line or Green). Teams created by Deploy or Light Wounds
            are of that quality.
          </li>
        </ul>
      </Sec>
      <Sec title="Broken units">
        <ul>
          <li>
            A unit that <b>breaks</b> flips to its broken side (red bar), usually with lower values. A broken unit that
            breaks again is <b>eliminated</b>: it goes to the Casualty Track and the enemy scores VP.
          </li>
          <li>
            Broken units can still move and fire their own Firepower, but cannot fire a Weapon. Their markers (Weapon,
            Veteran, Suppressed) stay with them.
          </li>
          <li>
            They come back by <b>rallying</b> (Recover Order, Medic, Hero, Commissar) and are the target of the enemy&rsquo;s
            Rout Orders and of KIA.
          </li>
        </ul>
      </Sec>
      <Sec title="Leaders and Command">
        <p>A Leader always uses the Command of the side he is currently showing; a broken Leader usually has 0.</p>
        <ul>
          <li>
            <b>Command radius</b>: when a Leader is activated for an Order or Op Fire, he may also activate any, all or none
            of your non-Leader units within that many hexes (0 = his own hex, 1 = also the adjacent hexes, and so on).
            Terrain and enemy units do not matter for the distance. Leaders never activate other Leaders.
          </li>
          <li>
            <b>Command bonus</b>: every friendly Squad and Team in a Leader&rsquo;s hex gets his Command added to its FP,
            Range, Movement and Morale, whether the Leader is activated or not. Several Leaders add up. Leaders never
            boost themselves or each other.
          </li>
          <li>
            <b>Weapons</b> carried by Squads and Teams in his hex also gain his Command on FP and Range — except Ordnance,
            and except Weapons carried by Leaders.
          </li>
        </ul>
      </Sec>
      <Sec title="Suppressed and Veteran">
        <Table>
          <thead>
            <tr>
              <th>Marker</th>
              <th>Effect</th>
              <th>Gained from</th>
              <th>Removed by</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Suppressed</th>
              <td>−1 FP, Range, Movement and Morale; cannot fire its Weapon</td>
              <td>a tied Defense, Rally or Rout roll; Cower, Interdiction, Suppressing Fire</td>
              <td>the start of its owner&rsquo;s Recover Order, elimination or exit</td>
            </tr>
            <tr>
              <th>Veteran</th>
              <td>+1 FP, Range, Movement and Morale</td>
              <td>Battle Harden</td>
              <td>elimination or exit only</td>
            </tr>
          </tbody>
        </Table>
        <p className="rules-small">Neither changes Command. A unit can carry at most one of each.</p>
      </Sec>
      <Sec title="Heroes">
        <ul>
          <li>A <b>Hero</b> arrives with the Hero Event. He is a Leader in every way, with two exceptions:</li>
          <li>
            He is worth <b>no VP</b> to anyone, for being eliminated or for exiting; an eliminated or exited Hero simply
            returns to the counter mix.
          </li>
          <li>
            He is <b>not limited</b> to one activation per Turn: he may be activated for several Orders (and several Op
            Fires).
          </li>
          <li>
            The <b>Private</b> who appears with Field Promotion is an ordinary Leader placed with one of your broken
            units.
          </li>
        </ul>
      </Sec>
      <Sec title="Squads splitting">
        <ul>
          <li>
            <b>Deploy</b> (an Event, or a free one when fixing overstacking) replaces a Squad with two Teams. Its Weapon and
            markers go to one of the Teams; both Teams share the Squad&rsquo;s activation and anything still pending
            against it.
          </li>
          <li>
            <b>Light Wounds</b> (an Action) replaces a Squad that would break with one Team, for −1 VP.
          </li>
        </ul>
      </Sec>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Weapons and Radios

function Weapons() {
  return (
    <>
      <Sec title="Weapons">
        <ul>
          <li>
            A Weapon counter shows its own <b>Firepower</b> and <b>Range</b>, and some a red <b>Movement penalty</b> that is
            taken off the carrier&rsquo;s Movement.
          </li>
          <li>
            A Weapon is activated whenever its carrier is. Only an <b>unbroken, unsuppressed</b> carrier can fire it. It
            fires alone or in a Fire Group (unless it is Ordnance), at the carrier&rsquo;s target or a different one.
          </li>
          <li>A Weapon&rsquo;s state is its own: an unbroken Squad can carry a broken Weapon and the other way round.</li>
        </ul>
      </Sec>
      <Sec title="Carrying and passing on">
        <ul>
          <li>
            <b>One Weapon per unit</b>. Any unit, Leaders included, may carry any Weapon (a Leader&rsquo;s Weapon gets no
            Command bonus).
          </li>
          <li>During a Move a unit may hand its Weapon to a friendly unit in its hex without one, for 1 MP.</li>
          <li>You may throw away (eliminate) one of your Weapons at any time.</li>
          <li>
            A Weapon whose carrier is eliminated is put in the Weapons box of the Casualty Track; a carrier that exits the
            map takes its Weapon along. When a Squad splits, one of the Teams keeps it.
          </li>
        </ul>
      </Sec>
      <Sec title="Broken Weapons">
        <ul>
          <li>
            Weapons break from <b>Jammed!</b>, doubles on <b>Sustained Fire</b>, and the <b>Malfunction</b> Event.
            Breaking an already broken Weapon eliminates it. Broken Weapons cannot fire.
          </li>
          <li>
            The broken side shows a <b>Fix</b> range and an <b>Elim</b> range of hex numbers. Every time anyone determines a{' '}
            <b>Random Hex</b> — before the Sniper or Event that asked for it — its number is compared with every broken
            Weapon of both sides: in the Fix range it is repaired at once; in the Elim range it is eliminated; otherwise it
            stays broken.
          </li>
        </ul>
        <Note>
          German cards carry only odd hex numbers and American and Russian cards only even ones, so which deck reveals
          the Random Hex matters for your broken Weapons.
        </Note>
      </Sec>
      <Sec title="Special Weapons">
        <ul>
          <li>
            <b>Ordnance</b> (white band): must hit with a Targeting roll first; never in a Fire Group; never Op Fire; no
            Leader bonus. See <Go to="firing">Firing</Go>.
          </li>
          <li>
            <b>Mortars</b> have a <b>minimum range</b>, written as two numbers such as 2–13: they cannot fire at closer
            hexes. Their shots get the Woods Airburst +2, and Fortifications protect one point better against them.
          </li>
          <li>
            <b>Flamethrower</b>: the target&rsquo;s Cover becomes 0 and nothing can change that.
          </li>
          <li>
            <b>Satchel Charge</b>: single use. It is eliminated right after making its Fire Attack Roll; a missed
            Targeting roll does not use it up.
          </li>
          <li>
            <b>Machine guns</b> benefit from Sustained Fire and are needed for the Suppressing Fire Event.
          </li>
        </ul>
      </Sec>
      <Sec title="Where Weapons cannot fire">
        <p>
          No Weapon may fire from a <b>Stream</b> or <b>Marsh</b> hex, or from a hex with <b>Wire</b>. The units themselves
          may still fire their own Firepower.
        </p>
      </Sec>
      <Sec title="Radios">
        <ul>
          <li>
            A <b>Radio</b> is an off-map battery with Firepower 8 to 13, kept in its owner&rsquo;s Artillery Box (one per
            player). It is <b>not a Weapon</b>: Jammed! and Malfunction do not affect it.
          </li>
          <li>
            The enemy can break it with <b>Artillery Denied</b> (a broken Radio breaking again is eliminated, back to the
            counter mix). You repair it with an Artillery Request used for <b>Battery Access</b>.
          </li>
          <li>
            Some Radios show <b>Smoke</b> and can fire a smoke barrage. How a Radio fires is under{' '}
            <Go to="artillery">Artillery</Go>.
          </li>
        </ul>
      </Sec>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Artillery

const VULNERABILITY: readonly [number, number][] = [
  [8, 12],
  [9, 11],
  [10, 10],
  [11, 9],
  [12, 8],
  [13, 7],
];

function Artillery() {
  return (
    <>
      <p>
        <b>Fire for Effect</b> is one use of the Artillery Request Order. It needs an unbroken Radio and an unbroken
        Leader who has not been activated this Turn: he becomes the <b>Spotter</b>.
      </p>
      <Sec title="1. Spotting">
        <p>
          Place the <b>Spotting Round</b> in any hex the Spotter can see — no range limit, impassable hexes allowed. With a
          Smoke Radio, announce now if this is a <b>smoke barrage</b>.
        </p>
      </Sec>
      <Sec title="2. Accuracy">
        <ul>
          <li>
            Make a Targeting roll (dice <b>multiplied</b>) minus the largest Hindrance between Spotter and Spotting Round.
            It is accurate if the result is greater than the distance.
          </li>
          <li>
            <b>Accurate</b>: reveal a card; the round drifts one hex toward the map-compass direction shown by the
            white die, then one more hex toward the direction shown by the coloured die. It may end where it started.
          </li>
          <li>
            <b>Inaccurate</b>: reveal a card; the round drifts in the white die&rsquo;s direction as many hexes as the
            coloured die shows.
          </li>
          <li>These drift reveals are not rolls: they never trigger and cannot be re-rolled with the Initiative.</li>
          <li>If the round leaves the map at any moment, even briefly, the mission is cancelled.</li>
        </ul>
      </Sec>
      <Sec title="3. Impact">
        <p>
          The final hex and its six neighbours form the <b>blast area</b>.
        </p>
        <ul>
          <li>
            <b>Smoke barrage</b>: a random Smoke marker goes into each of the seven hexes that can hold one (not Water, not
            Blaze). Nothing is attacked.
          </li>
          <li>
            <b>Barrage</b>: each blast hex holding a unit (of <b>either side</b>) or a Fortification gets one{' '}
            <b>Artillery Impact Roll</b>: Radio FP + roll, resolved like a Fire Attack against every unit there, in the
            order the active player chooses.
          </li>
          <li>
            No Hindrance (it was used for Accuracy) and no height modifier. Woods Airburst +2 applies. Jammed! does
            nothing; other triggers work.
          </li>
          <li>
            Fortifications give <b>+1 Cover</b> against artillery; Wall and Hedge Cover does not apply.
          </li>
        </ul>
      </Sec>
      <Sec title="Fortification Vulnerability">
        <p>
          If the Impact <b>roll</b> (the dice alone, before adding FP) equals the number below for the Radio&rsquo;s
          Firepower, the Fortification in that hex is destroyed before the Defense Rolls.
        </p>
        <Table>
          <thead>
            <tr>
              <th>Radio FP</th>
              {VULNERABILITY.map(([fp]) => (
                <th key={fp}>{fp}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Roll needed</th>
              {VULNERABILITY.map(([fp, roll]) => (
                <td key={fp}>{roll}</td>
              ))}
            </tr>
          </tbody>
        </Table>
      </Sec>
      <Note>
        Drift can bring the shells down on your own troops: every unit in the blast area is attacked, friend or foe.
      </Note>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Actions

const ACTION_TAGS: Partial<Record<ActionName, string[]>> = {
  'Bore Sighting': ['Defender only'],
  'Hidden Entrenchments': ['Defender only'],
  'Hidden Mines': ['Defender only'],
  'Hidden Pillbox': ['Defender only', 'Not in the American deck'],
  'Hidden Unit': ['Defender only'],
  'Hidden Wire': ['Defender only'],
  Marksmanship: ['German deck only'],
  'No Quarter': ['German and Russian decks'],
  Fire: ['Every Order/Action Fire card'],
};

const ACTION_MORE: Partial<Record<ActionName, ReactNode>> = {
  Ambush: 'Both sides may play Ambushes in the same melee, the inactive player first. A broken unit that is broken again is eliminated.',
  'Assault Fire':
    'It may be played before, during or after the units actually move, and follows all the normal Fire rules. Boxed-Firepower Ordnance (Satchel Charge, Flamethrower) may use it, firing alone after its Targeting roll.',
  'Bore Sighting': '“Printed” means the number on the counter: a Leader’s bonus does not help reach 5.',
  Concealment:
    'It uses the Cover the defenders would really use against this shot (with Road −1, Fortification +1 against Mortars and Artillery, or a Wall or Hedge the shot crosses), and lasts for all the remaining Defense Rolls of that attack. Useless against a Flamethrower or Mines (Cover 0).',
  Crossfire: 'Any unit activated to Move counts, whether it has moved yet or not: the classic Op Fire card.',
  Demolitions: 'A pass with no discards does not open the window, nor do cards lost to Fog of War or Interrogation.',
  'Dig In': 'Not in Water, a Blaze or a hex that already has a Fortification. Both players may play it, the inactive player first.',
  Fire: 'The full procedure is under Moving: Op Fire. Ordnance cannot Op Fire, but its carrier can.',
  'Hand Grenades': 'In a Fire Group spread over several hexes, one firing hex next to the target is enough.',
  'Hidden Entrenchments': 'The Foxholes count from that Defense Roll on.',
  'Hidden Mines': 'Not after a Retreat; not in Water or a hex with a Fortification. Units already in the hex are not attacked.',
  'Hidden Pillbox': 'There is only one Pillbox. Any hex of a building Objective counts. Not in Water or a hex with a Fortification.',
  'Hidden Unit':
    'Discards forced by Events do not count. Pick any non-Radio item of the rolled column available in the scenario year and place it, with its Weapon, in a hex of your original setup area that holds no units and has Cover 1 or more. The roll is a normal roll and can trigger.',
  'Hidden Wire': 'Not after a Retreat; not in Water or a hex with a Fortification.',
  'Light Wounds':
    'It also saves an already broken Squad from elimination. The Team is broken if the Squad was, and keeps its Weapon, markers and activation. Not against outright eliminations: KIA, Prisoners of War, a lost melee, overstacking, retreating off the map.',
  'No Quarter': 'At least one of your units that fought in the melee must still be alive.',
  'Smoke Grenades': 'Not into Water or a Blaze. If the hex already has Smoke, the larger value stays.',
  'Spray Fire':
    'Both hexes must be adjacent to each other, and each must be within Range and line of sight of every firing piece and hold an enemy unit. Every unit in both hexes defends against the one total, each with its own Cover.',
  'Sustained Fire':
    'If the roll shows doubles, one firing Mortar or machine gun of your choice breaks — on top of any Jammed! or other Sustained Fire, so a Weapon can break twice and be eliminated.',
};

const ACTION_WINDOWS: readonly [string, string, string][] = [
  ['Just before a Fire Attack Roll', 'the firing player', 'Bore Sighting, Crossfire, Hand Grenades, Marksmanship, Spray Fire, Sustained Fire'],
  ['Just before a Defense Roll', 'the defending player', 'Concealment, Hidden Entrenchments, Hidden Pillbox'],
  ['The moment one of your Squads would break', 'its owner', 'Light Wounds'],
  ['After an enemy unit enters a hex during his Move', 'inactive, then active', 'Fire (Op Fire), Hidden Mines, Hidden Wire; then Smoke Grenades, Assault Fire'],
  ['After an enemy unit Advances into a hex', 'the Defender', 'Hidden Mines, Hidden Wire'],
  ['While your units are activated to Move', 'the active player', 'Assault Fire, Smoke Grenades'],
  ['Before the melee dice', 'inactive, then active', 'Ambush'],
  ['After a melee', 'a survivor’s player', 'No Quarter'],
  ['The opponent passes and discards a card or more', 'the other player', 'Demolitions, Hidden Unit'],
  ['End of a Time advance', 'both, inactive first', 'Dig In'],
];

function Actions() {
  const items = (Object.keys(ACTION_TEXT) as ActionName[]).map((name) => ({
    name: name === 'Fire' ? 'Fire (Op Fire)' : name,
    tags: ACTION_TAGS[name],
    text: ACTION_TEXT[name],
    more: ACTION_MORE[name],
  }));
  return (
    <>
      <Sec title="How Actions work">
        <ul>
          <li>
            An Action is played from your hand at any moment its condition is met — on <b>either</b> player&rsquo;s Turn.
            There is no limit except the cards you hold.
          </li>
          <li>
            Several Actions may answer the same moment and their effects add up (two Crossfires give +4 FP).
          </li>
          <li>
            <b>The inactive player goes first.</b> When both players want to act at the same moment, the inactive player
            plays all he wants, then the active player plays all he wants. That is one round; the next moment (the next
            roll, the next hex entered) opens a new one.
          </li>
          <li>
            Actions do <b>not activate</b> units — except Op Fire. Units that are already activated may be the subject of
            any number of Actions.
          </li>
          <li>
            &ldquo;<b>Defender only</b>&rdquo; means the side in Defend posture in this scenario; Attack and Recon sides
            can never play those cards as Actions.
          </li>
        </ul>
      </Sec>
      <Sec title="When each Action can be played">
        <Table>
          <thead>
            <tr>
              <th>Moment</th>
              <th>Who</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ACTION_WINDOWS.map(([when, who, what]) => (
              <tr key={when}>
                <td>{when}</td>
                <td>{who}</td>
                <td>{what}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Sec>
      <Sec title="All Actions">
        <CardList items={items} />
      </Sec>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Events

const EVENT_NAME: Partial<Record<EventName, string>> = { Elan: 'Élan' };

const EVENT_TAGS: Partial<Record<EventName, string[]>> = {
  Blaze: ['German deck only'],
  Commissar: ['Russian deck only'],
  Deploy: ['Not in the Russian deck'],
  Entrench: ['Russian deck only'],
  Infiltration: ['Not in the American deck'],
  'White Phosphorus': ['American deck only'],
};

const EVENT_MORE: Partial<Record<EventName, ReactNode>> = {
  'Air Support': 'All or nothing: if you use it, your own units there break too. If several hexes are equally near, you choose.',
  'Battle Harden': 'Mandatory if you have a unit without one.',
  Blaze:
    'Not in Water or a hex that already burns. Owners move their units out (inactive player first) with their Weapons, to any adjacent hex that is not impassable — even an enemy hex (melee) or one that becomes overstacked.',
  'Booby Trap': 'Units already in the hex are attacked only when they later leave it.',
  Breeze: 'Each Breeze card shows its own wind direction (1–6 on the map compass). Only Blazes that existed before the Event spread; units in a newly burning hex must leave as for Blaze.',
  Commissar: 'The roll is compared with the unit’s current Morale, including Cover. Rolls inside Events never trigger.',
  Cower: 'Broken or not. Teams and Leaders are not affected; each Leader’s current Command counts.',
  Deploy:
    'The two Teams count as the old Squad: same activation, and any result still pending against it applies to both. Each of its Weapon and markers goes to one of the Teams.',
  'Fog of War': 'This is not a “pass” discard: it does not allow Demolitions or Hidden Unit.',
  Hero: 'A unit whose break is still pending (for example from a tie while moving) is not yet broken and cannot be rallied by him.',
  Infiltration: 'Stacking limits apply; not into an impassable hex. The roll cannot trigger.',
  Interdiction:
    'Either side, broken or not, not already Suppressed. Uses the hex’s own best Cover (terrain with Road −1, or a Fortification), not a Wall or Hedge. Mandatory if such a unit exists.',
  KIA: 'Either side. Light Wounds cannot save it.',
  Malfunction: 'Either side’s Weapon. If several are equally near, you choose.',
  Medic: 'Either side’s unit — usually your own, of course.',
  'Mission Objective': 'A chit with no secret side (R, V, W, X) is placed face up instead.',
  'Prisoners of War': 'This one hurts the player who draws it.',
  Reconnaissance: 'He chooses which one. It pays whoever controls that Objective now.',
  Reinforcements: 'A Radio is lost if your Artillery Box already has one. Stacking limits apply.',
  Scrounge: 'The Weapon arrives unbroken.',
  'Shell Shock': 'If several units are equally near, you choose.',
  'Strategic Objective': 'It pays whoever controls that Objective now.',
  'Suppressing Fire': 'The machine gun must be unbroken and carried by an unbroken, unsuppressed unit of yours.',
  'Walking Wounded': 'VP already scored for it stay scored, and its space on the Casualty Track becomes free again.',
  'White Phosphorus': 'Not in Water or a Blaze. The breaks are each player’s own choice of his own unit.',
};

function Events() {
  const items = (Object.keys(EVENT_TEXT) as EventName[]).map((name) => ({
    name: EVENT_NAME[name] ?? name,
    tags: EVENT_TAGS[name],
    text: EVENT_TEXT[name],
    more: EVENT_MORE[name],
  }));
  return (
    <>
      <Sec title="How Events work">
        <ul>
          <li>
            Events are never played from your hand. They happen only through an <b>Event!</b> trigger: reveal the next card
            of your deck and carry out its Event.
          </li>
          <li>
            The <b>receiving player</b> is the one whose roll showed the trigger. He makes every choice unless the Event
            names someone else. &ldquo;You&rdquo; and &ldquo;your&rdquo; below mean him.
          </li>
          <li>
            Do what is possible and skip what is not. Events with several parts are done in the printed order.
          </li>
          <li>
            <b>No roll inside an Event can trigger</b> anything. A melee an Event causes is fought at the end of that
            Event.
          </li>
          <li>&ldquo;A unit&rdquo; means a unit of either side unless the Event says friendly or enemy.</li>
          <li>
            Pieces an Event brings in come from those not yet used; pieces on the Track Display count as used. If none is
            left, that part of the Event does nothing.
          </li>
        </ul>
      </Sec>
      <Sec title="All Events">
        <CardList items={items} />
      </Sec>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Line of sight

function LineOfSight() {
  return (
    <>
      <Sec title="The basic check">
        <ul>
          <li>
            Line of sight (LOS) is a straight line from the <b>centre dot</b> of one hex to the centre dot of the other.
            Either player may check any LOS at any time, and it works both ways.
          </li>
          <li>
            Only the <b>hexes in between</b> matter. Terrain in the firer&rsquo;s or the target&rsquo;s own hex, and on
            their own six hexsides, never blocks or hinders — except Smoke, which also hinders into and out of its own hex.
          </li>
          <li>
            A Wall, Hedge or Fence on any other hexside does count, even when the line runs exactly along that hexside.
          </li>
          <li>
            <b>Units never block or hinder</b> line of sight, friendly or enemy.
          </li>
        </ul>
      </Sec>
      <Sec title="Obstacles">
        <ul>
          <li>
            <b>Obstacles</b> — Buildings, Woods, Hedges, Walls, Blaze, and hills higher than both ends — block a line
            that <b>touches their drawing</b> in a hex in between. What counts is the picture, not the whole hex: a line
            can clip the corner of a woods hex where no trees are drawn and stay clear.
          </li>
          <li>A road running through woods leaves a clear lane: a line exactly along the road is open.</li>
          <li>A Blaze fills its entire hex, hexsides included, and blocks at every height.</li>
        </ul>
      </Sec>
      <Sec title="Hindrances">
        <ul>
          <li>
            A <b>Hindrance</b> does not block; its number is a penalty. Only the <b>single largest</b> Hindrance on the
            line counts — they are never added up.
          </li>
          <li>
            A normal Fire Attack loses that many FP. Ordnance and artillery subtract it from the Targeting roll instead,
            and not again from the attack.
          </li>
          <li>
            <b>Smoke</b> fills its whole hex, hexsides included, and hinders into, out of and through it at every height.
          </li>
        </ul>
      </Sec>
      <Sec title="Hills">
        <p>
          Hills have levels 0 (ground) to 4. A <b>crest hex</b> shows two levels and counts as the higher; the edge of
          the higher level drawn inside it is its <b>crest line</b>. The hex at the top of a Cliff is a crest hex too.
        </p>
        <ul>
          <li>
            <b>A hill higher than both ends</b> blocks the line, like any Obstacle.
          </li>
          <li>
            <b>Looking up</b>: from below you can see only the <b>edge</b> of a higher level — the first crest hex of that
            level along the line — not the ground behind it.
          </li>
          <li>
            <b>Looking down</b>: a unit on a hill sees lower hexes only if the line crosses a crest line inside its{' '}
            <b>own</b> hex before leaving it (it stands at the edge of the hill), and does not cross another crest line of
            its level or higher on the way.
          </li>
          <li>Hills at the same level as both ends do not block by themselves; what stands on them does.</li>
          <li>
            <b>Blind hex</b>: a Woods or Building on lower ground between a high and a low end blocks only if it is in the
            hex next to the lower end. So a high observer cannot see the one hex right behind a lower wood or building,
            but sees beyond it. An Obstacle lower than both ends never blocks.
          </li>
          <li>
            Hindrance terrain counts only if it is at least as high as the higher end. Orchards and brush in the valley
            do not hinder a shot between two hilltops. Smoke always counts.
          </li>
        </ul>
      </Sec>
      <Sec title="Gully">
        <p>
          A unit in a <b>Gully</b> can be seen only from an adjacent hex or from higher ground, and sees only those hexes
          itself.
        </p>
      </Sec>
      <Note kind="app">
        Use the line-of-sight tool on the battle screen to check any line before you commit: it draws the exact line,
        tells you whether it is clear, blocked or hindered, and by what.
      </Note>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Terrain chart

/** Terrain types in the chart's order: when a hex shows several, the highest on this list is the hex's type. */
const TERRAIN_ORDER: readonly TerrainType[] = [
  'Building',
  'Woods',
  'Brush',
  'Orchard',
  'Field',
  'MajorBridge',
  'MinorBridge',
  'Gully',
  'Water',
  'Stream',
  'Marsh',
  'Open',
];

const TERRAIN_NOTES: Partial<Record<TerrainType, string>> = {
  Building: 'Creates one blind hex (see Line of sight). A building Objective is the whole building. No Hidden Entrenchments.',
  Woods: 'Creates one blind hex. Airburst: Mortar and Artillery attacks on a Woods hex get +2.',
  MajorBridge: 'Fills its whole hex. Entered and left only across its two road or railway hexsides, Advance included. Its Road usually brings the Cover to 1.',
  MinorBridge: 'Lies inside one hex, over the Stream.',
  Gully: 'A unit in it sees and is seen only from adjacent hexes or higher ground.',
  Water: 'No unit, Smoke, Blaze or Fortification can ever be there.',
  Stream: 'Water: no Weapon fires from it; no Smoke, Blaze or Fortification.',
  Marsh: 'Water: no Weapon fires from it; no Smoke, Blaze or Fortification.',
  Open: 'A snow scenario may make it dearer.',
};

const minus = (n: number) => (n < 0 ? `−${-n}` : String(n));

function moveText(id: TerrainType): string {
  const m = TERRAIN[id].move;
  if (id === 'MajorBridge') return '1 along its road or railway; otherwise impassable';
  if (id === 'MinorBridge') return `1 across its road or railway hexside; otherwise ${m ?? '—'}`;
  return m === null ? 'Impassable' : String(m);
}

function losText(obstacle: boolean, hindrance: number): string {
  if (obstacle) return 'Obstacle';
  return hindrance > 0 ? `Hindrance ${hindrance}` : 'Clear';
}

const HEXSIDE_ORDER: readonly HexsideFeature[] = ['Fence', 'Hedge', 'Wall', 'Cliff'];

const HEXSIDE_NOTES: Record<HexsideFeature, string> = {
  Fence: 'Ignored for LOS when it is a side of the firer’s or target’s hex.',
  Hedge: 'Ignored for LOS when it is a side of the firer’s or target’s hex. In the bocage scenario it costs +2 and gives Cover 2.',
  Wall: 'Ignored for LOS when it is a side of the firer’s or target’s hex.',
  Cliff: 'Retreating across it eliminates the unit. An Advancing unit without a Weapon may cross. The hex on top is a crest hex.',
};

function hexsideCost(f: HexsideFeature): string {
  const c = HEXSIDE[f].cost;
  return c === null ? 'Cannot be crossed by Move or Retreat' : `+${c}`;
}

function hexsideCover(f: HexsideFeature): string {
  const c = HEXSIDE[f].cover;
  return c > 0 ? `${c} against a shot crossing it into the hex (not Mortars or Artillery)` : '—';
}

const FEATURES: readonly [string, string, string, string, string][] = [
  ['Road', '1 if entered across a road hexside', '−1 to whatever Cover the hex gives', 'Clear along the road; otherwise as the hex', '+1 Movement for the rest of the Move Order once a unit enters a road hex.'],
  ['Trail', '1 if entered across a trail hexside', 'As the hex', 'As the hex', 'No Movement bonus, no Cover change.'],
  ['Railway', '1 if entered across a railway hexside', 'As the hex', 'Hindrance 1; clear along the track', 'No Movement bonus.'],
  ['Hill', '+1 to enter a higher hex (however many levels)', 'As the hex', 'See Line of sight', 'Firing at a higher hex −1 FP; at a lower hex +1 FP.'],
  ['Smoke', 'As the hex', 'As the hex', 'Its printed Hindrance, into, out of and through, at every height', 'One per hex (the larger stays). Never in Water or a Blaze. One is removed per Time advance; Breeze clears all.'],
  ['Blaze', 'Impassable', '—', 'Obstacle at every height, whole hex', 'Nothing else may share its hex. Spreads downwind with Breeze.'],
];

function TerrainChart() {
  return (
    <>
      <p>
        Every hex has one terrain <b>type</b>. If a hex shows several, the type higher in the table below wins (a hex
        where a Major Bridge spans a Stream counts as a Bridge hex). <b>Features</b> — roads, hexsides, hills and markers
        — modify the type.
      </p>
      <ul>
        <li>
          <b>Move cost</b>: the MP to enter the hex. <b>Cover</b>: added to the Morale of units in the hex (only the best
          single Cover counts). <b>LOS</b>: Obstacle, Hindrance (with its penalty) or Clear.
        </li>
      </ul>
      <Sec title="Terrain types">
        <Table className="rules-table--chart">
          <thead>
            <tr>
              <th>Terrain</th>
              <th>Move cost</th>
              <th>Cover</th>
              <th>LOS</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {TERRAIN_ORDER.map((id) => {
              const t = TERRAIN[id];
              return (
                <tr key={id}>
                  <th>{t.name}</th>
                  <td>{moveText(id)}</td>
                  <td className="rules-num">{t.cover === null ? '—' : minus(t.cover)}</td>
                  <td>{losText(t.obstacle, t.hindrance)}</td>
                  <td>{TERRAIN_NOTES[id] ?? ''}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Sec>
      <Sec title="Hexside features">
        <Table className="rules-table--chart">
          <thead>
            <tr>
              <th>Hexside</th>
              <th>Move cost</th>
              <th>Cover</th>
              <th>LOS</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {HEXSIDE_ORDER.map((f) => (
              <tr key={f}>
                <th>{HEXSIDE[f].name}</th>
                <td>{hexsideCost(f)}</td>
                <td>{hexsideCover(f)}</td>
                <td>{losText(HEXSIDE[f].obstacle, HEXSIDE[f].hindrance)}</td>
                <td>{HEXSIDE_NOTES[f]}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Sec>
      <Sec title="Roads, hills and markers">
        <Table className="rules-table--chart">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Move cost</th>
              <th>Cover</th>
              <th>LOS</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {FEATURES.map(([name, move, cover, los, notes]) => (
              <tr key={name}>
                <th>{name}</th>
                <td>{move}</td>
                <td>{cover}</td>
                <td>{los}</td>
                <td>{notes}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="rules-small">
          Road −1 applies to every Cover used in a road hex: a Building with a Road gives 2, Foxholes on an open road 2.
          Fortifications have their own Cover values: see <Go to="fortifications">Fortifications</Go>.
        </p>
      </Sec>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Fortifications

const FORT_COVER: readonly [string, number][] = [
  ['Foxholes', 3],
  ['Trench', 4],
  ['Pillbox', 5],
  ['Bunker', 6],
];

function Fortifications() {
  return (
    <>
      <Sec title="General">
        <ul>
          <li>Six kinds: Foxholes, Trenches, Pillbox, Bunkers, Wire and Mines.</li>
          <li>
            <b>One per hex.</b> Never in Water (Stream, Marsh or Water Barrier without a bridge) and never with a Blaze.
          </li>
          <li>
            They <b>belong to nobody</b>: whoever is in the hex uses them.
          </li>
          <li>
            They arrive at setup or through Dig In, the Hidden Actions, Entrench, Shellholes, Booby Trap and Rubble. They
            are removed only by Blaze (and its spread), Sappers, Demolitions and artillery (Fortification Vulnerability).
          </li>
        </ul>
      </Sec>
      <Sec title="Cover">
        <p>
          A Fortification&rsquo;s Cover is an <b>alternative</b> to the terrain&rsquo;s, not an addition: the defender uses
          whichever is better. A Road in the hex lowers it by 1.
        </p>
        <Table>
          <thead>
            <tr>
              <th>Fortification</th>
              <th>Cover</th>
              <th>Against Mortars and Artillery</th>
            </tr>
          </thead>
          <tbody>
            {FORT_COVER.map(([name, cover]) => (
              <tr key={name}>
                <th>{name}</th>
                <td>{cover}</td>
                <td>{cover + 1}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Sec>
      <Sec title="Trenches">
        <p>
          Moving between adjacent hexes that both have a Trench, Bunker or Pillbox — at least one of them a Trench — costs
          exactly <b>1 MP</b> whatever the terrain, hexside or height (a Cliff still cannot be crossed), and the unit
          cannot be Op Fired in the hex it enters.
        </p>
      </Sec>
      <Sec title="Pillbox and Bunker">
        <p>
          On a <b>melee tie</b>, the side that held the hex (the last to occupy it alone) wins and only the attackers are
          eliminated.
        </p>
      </Sec>
      <Sec title="Wire">
        <ul>
          <li>Units in a Wire hex have −1 FP, −1 Range and −1 Morale (Command is unchanged).</li>
          <li>
            A <b>moving</b> unit loses all its remaining MP right after entering or leaving a Wire hex — so a unit that
            starts in Wire can move exactly one hex. Advance and Retreat ignore this.
          </li>
          <li>
            Weapons in a Wire hex cannot fire, and units in it cannot form a Fire Group with units outside it.
          </li>
        </ul>
      </Sec>
      <Sec title="Mines">
        <ul>
          <li>
            A Mines hex attacks every unit of <b>either side</b> that enters or leaves it by Move, Advance or Retreat.
            Units moving together are attacked with one roll. Units already sitting in the hex are not attacked when
            others come or go.
          </li>
          <li>
            The attack has <b>6 FP</b> (7 or 8 if the scenario says so) and the defenders&rsquo; Cover is <b>0</b>. The
            mover&rsquo;s opponent makes the attack roll; the mover makes the Defense Rolls.
          </li>
          <li>
            On a tie, units activated to Move break; Advancing or Retreating units are Suppressed. Jammed! has no effect
            (Mines are not Weapons).
          </li>
          <li>A unit broken while leaving a Mines hex still arrives where it was going.</li>
        </ul>
      </Sec>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Time and Sudden Death

const TIME_SPACES = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

function TimeAndSuddenDeath() {
  return (
    <>
      <Sec title="What advances Time">
        <ul>
          <li>
            A <b>Time!</b> trigger on any roll that is allowed to trigger.
          </li>
          <li>
            Revealing or drawing the <b>last card</b> of a player&rsquo;s draw pile — even in the middle of another trigger,
            an Event or a hand refill. It counts as a Time! trigger of that player.
          </li>
          <li>A Time! trigger on the last card advances Time only once.</li>
        </ul>
      </Sec>
      <Sec title="A Time advance, in order">
        <ol>
          <li>The Time marker moves forward one space.</li>
          <li>The player who caused it shuffles his draw pile and discard pile into a new draw pile (not his hand).</li>
          <li>
            If the Time marker is now on or past the <b>Sudden Death</b> space, that player makes the Sudden Death roll.
            (Just before it, a player controlling all five Objectives wins if Objective chit V is in play.)
          </li>
          <li>
            If the game goes on, the scenario <b>Defender</b> gains <b>1 VP</b> (with two Recon sides, nobody does).
          </li>
          <li>The player who caused it removes one Smoke marker of his choice from the map, if there is any.</li>
          <li>
            <b>Reinforcements</b> waiting on the space the Time marker just reached enter along their owner&rsquo;s
            friendly map edge (inactive player first), within stacking limits. A reinforcement Radio goes to its
            owner&rsquo;s Artillery Box if that is empty.
          </li>
          <li>
            Both players may play <b>Dig In</b>, the inactive player first.
          </li>
        </ol>
        <p>Then play carries on exactly where it stopped: a half-finished refill, or the result of the roll that triggered.</p>
      </Sec>
      <Sec title="The Sudden Death roll">
        <p>
          If the roll is <b>less than the number of the space the Time marker now occupies</b> (not the Sudden Death
          space), the game ends at once. Otherwise play goes on, and every later Time advance repeats the roll — with ever
          better odds of ending. The roll itself can never trigger.
        </p>
        <Table className="rules-table--odds">
          <thead>
            <tr>
              <th>Time space</th>
              {TIME_SPACES.map((n) => (
                <th key={n}>{n === 13 ? '13+' : n}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Game ends on</th>
              {TIME_SPACES.map((n) => (
                <td key={n}>{n === 3 ? '2' : n >= 13 ? 'any' : `2–${n - 1}`}</td>
              ))}
            </tr>
            <tr>
              <th>Chance</th>
              {TIME_SPACES.map((n) => (
                <td key={n}>{pct(waysBelow(n))}</td>
              ))}
            </tr>
          </tbody>
        </Table>
        <p className="rules-small">On space 2 or lower the game can never end this way, since no roll is below 2.</p>
        <Note>
          Each Time advance reshuffles only the deck of the player who caused it, and gives the Defender a point. An
          attacker who falls behind on the clock must take risks; a Defender can sometimes simply run his deck down by
          passing and discarding.
        </Note>
      </Sec>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Victory

interface ChitRow {
  id: string;
  /** Objective number, or 'all' for every Objective. */
  obj: number | 'all';
  vp: number;
}

const VALUE_CHITS: readonly ChitRow[] = [
  { id: 'A', obj: 1, vp: 1 },
  { id: 'B', obj: 2, vp: 1 },
  { id: 'C', obj: 3, vp: 1 },
  { id: 'D', obj: 4, vp: 1 },
  { id: 'E', obj: 5, vp: 1 },
  { id: 'F', obj: 2, vp: 2 },
  { id: 'G', obj: 3, vp: 2 },
  { id: 'H', obj: 4, vp: 2 },
  { id: 'J', obj: 5, vp: 2 },
  { id: 'K', obj: 3, vp: 3 },
  { id: 'L', obj: 4, vp: 3 },
  { id: 'M', obj: 5, vp: 3 },
  { id: 'N', obj: 4, vp: 4 },
  { id: 'P', obj: 5, vp: 4 },
  { id: 'Q', obj: 5, vp: 5 },
  { id: 'R', obj: 5, vp: 10 },
  { id: 'S', obj: 'all', vp: 1 },
  { id: 'T', obj: 'all', vp: 2 },
  { id: 'U', obj: 'all', vp: 3 },
];

const CHIT_VPS = [1, 2, 3, 4, 5, 10];
const CHIT_OBJS: readonly (number | 'all')[] = [1, 2, 3, 4, 5, 'all'];
/** Chits that have no secret side: always placed face up. */
const ALWAYS_OPEN = new Set(['R', 'V', 'W', 'X']);

function ChitTable() {
  return (
    <Table className="rules-table--chits">
      <thead>
        <tr>
          <th>Objective</th>
          {CHIT_VPS.map((vp) => (
            <th key={vp}>{vp} VP</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {CHIT_OBJS.map((obj) => (
          <tr key={String(obj)}>
            <th>{obj === 'all' ? 'Each of the five' : obj}</th>
            {CHIT_VPS.map((vp) => {
              const chit = VALUE_CHITS.find((c) => c.obj === obj && c.vp === vp);
              return (
                <td key={vp} className="rules-chit">
                  {chit ? (
                    <span className={ALWAYS_OPEN.has(chit.id) ? 'rules-chit--open' : undefined}>
                      {chit.id}
                      {ALWAYS_OPEN.has(chit.id) ? '*' : ''}
                    </span>
                  ) : (
                    ''
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function Victory() {
  return (
    <>
      <p>
        There is one <b>VP track</b> with a single total that leans towards one side or the other. Every VP one side gains
        moves it towards that side.
      </p>
      <Sec title="Eliminating enemy units">
        <p>
          Whenever a unit is eliminated, for whatever reason (overstacking too), its opponent gains: <b>Squad 2</b>,{' '}
          <b>Team 1</b>, <b>Leader 1 + his Command</b> (from his unbroken side), <b>Hero 0</b>. The unit goes to its
          owner&rsquo;s row of the Casualty Track and its Weapon to the Weapons box.
        </p>
      </Sec>
      <Sec title="Exiting the map">
        <ul>
          <li>
            A unit that Moves (1 MP) or Advances off the <b>enemy&rsquo;s</b> map edge scores its owner the same VP as above
            at once (Hero 0). The flanks can never be crossed, and a unit can never Move or Advance off its own edge.
          </li>
          <li>
            The exited unit is put on a later space of the Time Track, unbroken, still carrying its Weapon (repaired), but
            without Veteran or Suppressed markers. It comes back as a reinforcement when Time reaches that space.
          </li>
          <li>A unit forced to <b>retreat</b> off its own edge is eliminated instead.</li>
        </ul>
        <Note kind="app">The app offers only Time Track spaces ahead of the Time marker, since a unit placed behind it would never return.</Note>
      </Sec>
      <Sec title="Objectives">
        <ul>
          <li>Every map has five Objectives, numbered 1–5. They are worth nothing until an Objective chit gives them a value.</li>
          <li>
            <b>Control</b> belongs to the last side to occupy the Objective hex <b>alone</b>, with any unit, broken or not.
            It changes the moment a unit enters an Objective hex holding no enemy, even in the middle of a move, and stays
            when the unit moves on.
          </li>
          <li>
            An Objective in a building that spans several hexes is the <b>whole building</b>: to take it you need a unit
            inside and no enemy in any of its hexes.
          </li>
        </ul>
      </Sec>
      <Sec title="Open and secret chits">
        <ul>
          <li>
            <b>Open</b> chits are face up and score all the time: when a valued Objective changes hands, the old owner
            loses its value and the new one gains it (a 4-VP Objective swings the track by 8). An uncontrolled Objective
            scores for nobody.
          </li>
          <li>
            <b>Secret</b> chits are known only to the player who drew them and score only when revealed — by the
            Reconnaissance Event or at the end of the game. They then pay whoever controls that Objective at that moment,
            which may be the enemy.
          </li>
          <li>Values add up: chits C, G and K together make Objective 3 worth 6 VP.</li>
        </ul>
        <ChitTable />
        <ul className="rules-small">
          <li>
            <b>*</b> R, V, W and X have no secret side: they are always placed face up, even when drawn as a secret chit.
          </li>
          <li>
            <b>V</b> — just before each Sudden Death roll, a player who controls all five Objectives wins the game.
          </li>
          <li>
            <b>W</b> — exit VP are doubled for both sides. <b>X</b> — elimination VP are doubled for both sides.
          </li>
        </ul>
      </Sec>
      <Sec title="Other VP">
        <p>
          The Defender&rsquo;s +1 per Time advance; the Command &amp; Control and Battlefield Integrity Events; No Quarter
          (+2); Light Wounds (−1 for the player who uses it).
        </p>
      </Sec>
      <Sec title="Surrender">
        <p>
          Each player&rsquo;s <b>Surrender</b> marker sits on a space of his row of the Casualty Track set by the scenario.
          When one of his eliminated units has to be placed on that space — his casualties reach the Surrender number — he
          loses at once, whatever the VP. Élan moves the marker one space further; Walking Wounded can free a space.
        </p>
      </Sec>
      <Sec title="End of the game">
        <Table>
          <thead>
            <tr>
              <th>The game ends when…</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>a player&rsquo;s casualties reach his Surrender space</td>
              <td rowSpan={2}>That player loses at once, whatever the VP (even with reinforcements still to come).</td>
            </tr>
            <tr>
              <td>a player&rsquo;s last unit on the map is eliminated</td>
            </tr>
            <tr>
              <td>a player voluntarily Moves or Advances his last unit off the map</td>
              <td rowSpan={2}>
                All secret chits are revealed and scored; the side the VP total favours wins.
              </td>
            </tr>
            <tr>
              <td>a Sudden Death roll is below the Time space</td>
            </tr>
          </tbody>
        </Table>
        <p>
          <b>Ties</b> — a VP total of exactly 0, or both players losing at the same moment — are won by the player holding
          the <b>Initiative</b> card.
        </p>
      </Sec>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Initiative

function Initiative() {
  return (
    <>
      <p>
        One player starts with the <b>Initiative</b> card (the scenario says who). It is not part of his hand and is never
        &ldquo;a card&rdquo; for any rule.
      </p>
      <Sec title="The re-roll">
        <ul>
          <li>
            At any time, its holder may <b>cancel the most recent roll</b> — his own or his opponent&rsquo;s — together with
            its trigger, and have the same player roll again from his own deck.
          </li>
          <li>He decides after seeing the roll, before its trigger or result is applied.</li>
          <li>
            Then he <b>hands the card to his opponent</b>, who may use it the same way at once — even on the re-roll. The card
            may pass back and forth any number of times.
          </li>
          <li>
            Only <b>rolls</b> can be cancelled. Random Hex reveals, Event reveals and artillery drift are not rolls. A Time
            advance caused by revealing the last card of a deck is not undone.
          </li>
        </ul>
      </Sec>
      <Sec title="Ties">
        <p>
          Whoever holds the Initiative card when the game ends wins any tie: a VP total of exactly 0, or both players
          losing at the same moment.
        </p>
        <Note>
          Using the card costs you the tie-break. Spend it on a roll that really matters — a melee, a Sudden Death roll
          that would end a game you are losing, a Defense Roll that would eliminate your best Leader.
        </Note>
      </Sec>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Stacking

function Stacking() {
  return (
    <>
      <Sec title="Units">
        <ul>
          <li>
            Each side may have at most <b>7 figures</b> in a hex: a Squad is 4, a Team 2, a Leader 1. A Squad, a Team and a
            Leader just fit; two Squads (8) are overstacked.
          </li>
          <li>
            Overstacking is allowed <b>during</b> a Turn. At the <b>end of every Turn</b> it is checked for both players.
            In each overstacked hex the owner may first make one free <b>Deploy</b> (split a Squad into two Teams), then
            must eliminate units of his choice until the hex is legal.
          </li>
          <li>
            These are real eliminations: the enemy scores VP, the units go to the Casualty Track and may cause Surrender.
          </li>
          <li>
            Placing units — reinforcements, Infiltration, Reinforcements, Walking Wounded, setup — may never overstack a
            hex.
          </li>
          <li>Units of both sides in one hex do not stack against each other: they fight a melee.</li>
          <li>Some scenarios lower the limit in particular hexes.</li>
        </ul>
      </Sec>
      <Sec title="Markers">
        <ul>
          <li>Each unit carries at most one Weapon, one Suppressed and one Veteran marker.</li>
          <li>One Fortification per hex: a second one cannot be placed.</li>
          <li>One Smoke per hex: if another arrives, the one with the larger Hindrance stays.</li>
          <li>A Blaze shares its hex with nothing: no units, no Fortification, no Smoke.</li>
          <li>One Radio per Artillery Box: a second one is not placed.</li>
        </ul>
      </Sec>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Playing this edition

function ThisEdition() {
  return (
    <>
      <p>
        This is a fan-made, single-player edition: you play one side, the computer the other. The engine follows the
        rules above to the letter; the app only takes the bookkeeping off your hands.
      </p>
      <Sec title="The screen">
        <ul>
          <li>
            The <b>board</b> shows the map with its hex names, the five Objectives, every unit, Weapon, Fortification and
            marker. Click a stack to spread it out.
          </li>
          <li>
            <b>Your hand</b> lies face up; the opponent&rsquo;s cards are shown face down with their number. Around the
            board: the Time Track with the Sudden Death marker, the VP total, both Surrender levels and casualties, the
            Initiative card, deck and discard counts, and the open Objective chits (plus your own secret ones).
          </li>
          <li>
            The <b>battle log</b> records every card, roll, trigger and result. When the computer reacts on your Turn,
            what it played is shown clearly.
          </li>
        </ul>
      </Sec>
      <Sec title="Prompts only when you have a choice">
        <ul>
          <li>
            The game stops to ask you only when you have a legal choice. If none of your cards can answer a moment, it
            moves on by itself — no clicking &ldquo;pass&rdquo; again and again.
          </li>
          <li>
            The computer&rsquo;s reaction moments always take the same short pause, whether it holds a card or not, so a
            pause gives nothing away.
          </li>
        </ul>
      </Sec>
      <Sec title="Help while you play">
        <ul>
          <li>
            <b>Hover a counter</b> to see its current values (with every modifier) and abilities. <b>Hover a hex</b> for
            its terrain, Cover, Hindrance and height. Hover a card for its texts.
          </li>
          <li>
            The <b>line-of-sight tool</b> draws the exact line between two hexes and tells you whether it is clear, hindered
            or blocked, and by what. The rules let you check line of sight at any time.
          </li>
          <li>
            The <b>fire preview</b> shows the Firepower of a shot with all its modifiers, against each target&rsquo;s
            Morale, before you commit.
          </li>
          <li>The Rules button opens this reference at the topic you need.</li>
        </ul>
      </Sec>
      <Sec title="Undo, saving and settings">
        <ul>
          <li>
            <b>Undo</b> is offered for steps that revealed nothing new — no card drawn, no hidden marker shown, no
            opponent decision since. Once a card is turned, the step stands.
          </li>
          <li>
            The battle is <b>saved automatically</b> after every step. Choose <b>Continue</b> on the main menu to pick it up
            exactly where you left off.
          </li>
          <li>
            <b>Speed</b> sets how quickly the computer&rsquo;s moves, card flips and results play out.
          </li>
          <li>
            <b>Initiative re-roll</b>: <b>Always</b> asks you after every roll while you hold the card; <b>When it
            matters</b> asks only after rolls where a re-roll could make a real difference to you; <b>Never</b> never asks
            (you keep the card for the tie-break).
          </li>
        </ul>
      </Sec>
      <Sec title="A fair opponent">
        <p>
          The computer sees only what a human opponent across the table would see: the board, both discard piles, card
          counts and its own hand and secret chits. It never sees your hand, your secret Objective chits or the order of
          either deck. To think ahead, it imagines many possible hands and deck orders and plans against all of them.
        </p>
      </Sec>
    </>
  );
}
