// The battle screen: the map with the stacks and the prompt's highlights, the prompt and the log on the right, the
// tracks (Time, Victory, Objectives) on the left, your hand and both decks along the bottom. Everything shown is the
// game as the human may see it (the controller's redacted display).
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react';
import { FateCardView } from '../../art';
import { label as hexLabel } from '../../engine/hex';
import { losCheck } from '../../engine/los';
import { cardOf } from '../../engine/state';
import type { Answer, CardId, Edge, HexId, PieceId } from '../../engine/types';
import { other } from '../../engine/types';
import { Button, Modal, Segmented, Toggle, Tooltip } from '../kit';
import { RulesDialog } from '../screens/RulesDialog';
import { ResultDialog } from '../screens/Result';
import { ScenarioDialog } from '../screens/ScenarioDialog';
import { isMuted, setMuted } from '../sound';
import { terrainImage } from '../board';
import { BattleBoard } from './BattleBoard';
import { SPEEDS, SPEED_LABEL, type GameController, type Speed } from './controller';
import { NATION_PLURAL, sideName } from './names';
import { DecksPanel, HandStrip, InitiativeBadge, LogPanel, ObjectivesPanel, TimePanel, VictoryPanel } from './panels';
import { PromptPanel } from './PromptPanel';
import { ThinkingIndicator } from './ThinkingIndicator';
import { NO_SEL, clickCard, clickHex, clickPiece, promptFor, type ClickResult, type PromptButton, type Sel } from './prompts';
import { REROLL_LABEL, REROLL_POLICIES, type RerollPolicy } from './reroll';
import { piecesIn } from './preview';
import { HexTip } from './tips';
import './game.css';

const turnFor = (edge: Edge) => edge === 'top' || edge === 'right';

function safeCard(id: CardId) {
  try {
    return cardOf(id);
  } catch {
    return null;
  }
}

function useWide(query = '(min-width: 1200px)'): boolean {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : true);
  const [v, setV] = useState(get);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setV(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return v;
}

export function GameScreen({
  controller, onMenu, onRematch,
}: {
  controller: GameController;
  onMenu: () => void;
  onRematch: (switchSides: boolean) => void;
}) {
  const view = useSyncExternalStore(controller.subscribe, controller.getView);
  const s = view.display;
  const human = view.humanSide;
  const opp = other(human);
  const d = view.pending;
  const wide = useWide();
  const [sel, setSel] = useState<Sel>(NO_SEL);
  const [hover, setHover] = useState<{ hex: HexId; x: number; y: number } | null>(null);
  const [expanded, setExpanded] = useState<HexId | null>(null);
  const [los, setLos] = useState<{ on: boolean; from: HexId | null; to: HexId | null }>({ on: false, from: null, to: null });
  const [rules, setRules] = useState(false);
  // the briefing opens by itself at the start of a new battle whose scenario has special rules
  const [briefing, setBriefing] = useState(
    () => controller.driver.answers.length === 0 && !controller.autoPlaying && (controller.driver.state.scenario.special.notes ?? []).length > 0,
  );
  const [settings, setSettings] = useState(false);
  const [confirmMenu, setConfirmMenu] = useState(false);
  const [resultOpen, setResultOpen] = useState(true);
  const [hoverPieces, setHoverPieces] = useState<PieceId[] | null>(null);
  const [sideTab, setSideTab] = useState<'log' | 'tracks'>('log');
  const shownAt = useRef(0);

  useEffect(() => {
    (window as unknown as { __cce?: GameController }).__cce = controller;
    // paint the map first (it takes a moment on the main thread), then start the battle: the opponent's first
    // decisions (its deployment) would otherwise keep the flat stand-in terrain on screen
    let started = false;
    const go = () => {
      if (started) return;
      started = true;
      controller.start();
    };
    terrainImage(controller.driver.state.map).then(go, go);
    const t = setTimeout(go, 2500);
    return () => clearTimeout(t);
  }, [controller]);

  // a new decision: fresh selection
  useEffect(() => {
    shownAt.current = performance.now();
    setSel(NO_SEL);
    setExpanded(null);
  }, [d]);

  const model = useMemo(() => (d ? promptFor(s, d, sel, human) : null), [s, d, sel, human]);

  const apply = useCallback(
    (r: ClickResult) => {
      if (r.notice) controller.notice(r.notice);
      if (r.answers?.length) controller.answer(r.answers[0], r.answers.slice(1));
      else if (r.answer) controller.answer(r.answer as Answer);
      if (r.sel) setSel(r.sel);
      return !!(r.answer || r.answers || r.sel);
    },
    [controller],
  );

  const onHexClick = (h: HexId, e: MouseEvent<SVGElement>) => {
    e.stopPropagation();
    if (view.animating) {
      controller.hurry();
      return;
    }
    if (los.on) {
      setLos((l) => (l.from === null || l.to !== null ? { on: true, from: h, to: null } : { on: true, from: l.from, to: h }));
      return;
    }
    if (d) {
      const used = apply(clickHex(s, d, sel, h));
      if (used) return;
    }
    const n = piecesIn(s, h).length + (s.fort[h] ? 1 : 0) + (s.smoke[h] ? 1 : 0);
    setExpanded((x) => (x === h || n < 2 ? null : h));
  };

  const onPiece = (id: PieceId) => {
    if (!d) return;
    apply(clickPiece(s, d, sel, id));
  };

  const onCard = (c: CardId) => {
    if (!d) return;
    apply(clickCard(s, d, sel, c));
  };

  const onButton = (b: PromptButton) => {
    if (b.disabled) return;
    if (b.special === 'passRest') {
      controller.passRest();
      return;
    }
    if (b.special === 'autoSetup') controller.autoSetup();
    if (b.answers?.length) controller.answer(b.answers[0], b.answers.slice(1));
    else if (b.answer) controller.answer(b.answer);
    else if (b.sel) setSel((x) => ({ ...x, ...b.sel }));
  };

  // dev: drive the screen from the console or a test harness (`__cceUi.hex(22)`, `__cceUi.button('fire')`)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __cceUi?: unknown }).__cceUi = {
      model,
      sel,
      hex: (h: HexId) => onHexClick(h, { stopPropagation() {} } as MouseEvent<SVGElement>),
      piece: onPiece,
      card: onCard,
      button: (key: string) => {
        const b = [...(model?.buttons ?? []), ...(model?.list ?? [])].find((x) => x.key === key);
        if (b) onButton(b);
        return !!b;
      },
      hover: (h: HexId | null) => setHover(h === null ? null : { hex: h, x: 600, y: 300 }),
      los: (from: HexId, to: HexId) => setLos({ on: true, from, to }),
      expand: setExpanded,
    };
  });

  // keyboard: Enter = the primary button, Escape = clear, Space = hurry, Z = undo, L = line of sight
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement) return;
      if (document.querySelector('.kit-modal')) return;
      if (e.key === 'Escape') {
        setSel(NO_SEL);
        setExpanded(null);
        setLos({ on: false, from: null, to: null });
      } else if (e.key === 'Enter') {
        if (performance.now() - shownAt.current < 350 || e.repeat || t instanceof HTMLButtonElement) return;
        const b = model?.buttons.find((x) => x.primary && !x.disabled);
        if (b) {
          e.preventDefault();
          onButton(b);
        }
      } else if (e.key === ' ') {
        if (view.animating) {
          e.preventDefault();
          controller.hurry();
        }
      } else if (e.key === 'z' || e.key === 'Z') {
        if (view.canUndo) controller.undo();
      } else if (e.key === 'l' || e.key === 'L') {
        setLos((l) => ({ on: !l.on, from: null, to: null }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const mine = s.scenario.sides[human];
  const theirs = s.scenario.sides[opp];
  const rotate = turnFor(mine.edge);
  const edgeLabels = { [mine.edge]: `${NATION_PLURAL[mine.nation]} (you)`, [theirs.edge]: NATION_PLURAL[theirs.nation] };

  const losTo = los.on && los.from !== null ? (los.to ?? hover?.hex ?? null) : null;
  const losRes = los.on && los.from !== null && losTo !== null && losTo !== los.from ? losCheck(s, los.from, losTo) : null;
  const losLine = losRes && los.from !== null && losTo !== null ? { from: los.from, to: losTo, clear: losRes.clear } : null;

  const t = s.turn;
  const pl = s.players[s.active];
  const turnText =
    s.phase === 'setup'
      ? 'Set-up'
      : `Turn ${t.number} · ${sideName(s, s.active)}${s.active === human ? ' (you)' : ''} · ${t.passDiscards !== null ? 'passed' : `Orders ${t.ordersGiven}/${pl.orders}`}`;

  const tracks = (
    <>
      <VictoryPanel s={s} human={human} />
      <TimePanel s={s} human={human} />
      <ObjectivesPanel s={s} human={human} />
    </>
  );

  const selected = useMemo(() => [...(model?.selected ?? []), ...(hoverPieces ?? [])], [model, hoverPieces]);

  return (
    <div className={`gs-root kit-desk ${wide ? 'is-wide' : 'is-narrow'}`}>
      <header className="gs-top">
        <Button variant="ghost" size="sm" onClick={() => (view.over ? onMenu() : setConfirmMenu(true))}>
          ← Menu
        </Button>
        <div className="gs-top__title">
          <b>{s.scenario.name}</b>
          <span>{turnText}</span>
        </div>
        <InitiativeBadge s={s} human={human} />
        <div className="gs-top__tools">
          <Button variant="ghost" size="sm" disabled={!view.canUndo} onClick={() => controller.undo()} title="Take back your last step (Z): only while nothing new was revealed">
            Undo
          </Button>
          <Button variant={los.on ? 'primary' : 'ghost'} size="sm" onClick={() => setLos((l) => ({ on: !l.on, from: null, to: null }))} title="Line of sight (L): click a hex, then another">
            Line of sight
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setBriefing(true)} title="The scenario's briefing and special rules">
            Scenario
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setRules(true)}>
            Rules
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSettings(true)}>
            Settings
          </Button>
        </div>
      </header>

      {wide ? <aside className="gs-left">{tracks}</aside> : null}

      <main className="gs-board" onClick={() => (view.animating ? controller.hurry() : undefined)}>
        <BattleBoard
          s={s}
          human={human}
          rotate180={rotate}
          selectable={los.on ? [] : (model?.selectable ?? [])}
          targets={los.on ? [] : (model?.targets ?? [])}
          marks={los.on ? [] : (model?.marks ?? [])}
          selected={selected}
          clickable={model?.pieces ?? []}
          slides={view.slides}
          flashes={view.flashes}
          flipping={view.flipping}
          attack={view.attack}
          losLine={losLine}
          expanded={expanded}
          onHexClick={onHexClick}
          onPieceClick={onPiece}
          onHexHover={(h, e) => setHover(h === null || !e ? null : { hex: h, x: e.clientX, y: e.clientY })}
          edgeLabels={edgeLabels}
        />
        {view.show ? (
          <div className="gs-show" key={view.show.id}>
            <div className="gs-show__card">{safeCard(view.show.card) ? <FateCardView card={safeCard(view.show.card)!} size="md" highlight={view.show.highlight ?? null} /> : null}</div>
            <div className={`gs-show__cap ${view.show.side === human ? 'is-you' : 'is-them'}`}>
              {view.show.caption}
              {view.show.value !== undefined ? <b className="gs-show__value">{view.show.value}</b> : null}
              {view.show.trigger ? <span className="gs-show__trigger">{view.show.trigger}!</span> : null}
            </div>
          </div>
        ) : null}
        {view.toast ? (
          <div className={`gs-toast gs-toast--${view.toast.kind}`} key={view.toast.id}>
            {view.toast.text}
          </div>
        ) : null}
        {los.on ? (
          <div className="gs-los kit-paper">
            {los.from === null
              ? 'Line of sight: click the first hex.'
              : losRes && losTo !== null
                ? `${hexLabel(los.from)} → ${hexLabel(losTo)}: ${losRes.clear ? (losRes.hindrance ? `clear, Hindrance ${losRes.hindrance}` : 'clear') : `blocked (${losRes.blockedBy ?? 'blocked'})`}`
                : `From ${hexLabel(los.from)}: point at another hex.`}
            <button type="button" className="gs-los__close" onClick={() => setLos({ on: false, from: null, to: null })} aria-label="Close the line-of-sight tool">
              ×
            </button>
          </div>
        ) : null}
        {hover && !los.on ? (
          <Tooltip x={hover.x} y={hover.y} offset={18}>
            <HexTip s={s} hex={hover.hex} human={human} />
          </Tooltip>
        ) : null}
      </main>

      <aside className="gs-right">
        <PromptPanel
          view={view}
          s={s}
          d={d}
          model={model}
          human={human}
          onButton={onButton}
          onPiece={onPiece}
          onCard={onCard}
          onHoverPieces={setHoverPieces}
        />
        <ThinkingIndicator view={view} controller={controller} />
        {wide ? (
          <LogPanel log={view.log} s={s} human={human} />
        ) : (
          <>
            <div className="gs-tabs">
              <button type="button" className={sideTab === 'log' ? 'is-on' : ''} onClick={() => setSideTab('log')}>
                Log
              </button>
              <button type="button" className={sideTab === 'tracks' ? 'is-on' : ''} onClick={() => setSideTab('tracks')}>
                Tracks
              </button>
            </div>
            {sideTab === 'log' ? <LogPanel log={view.log} s={s} human={human} /> : <div className="gs-tracks">{tracks}</div>}
          </>
        )}
      </aside>

      <footer className="gs-bottom">
        <HandStrip
          s={s}
          human={human}
          playable={model?.cards ?? []}
          tags={model?.cardTags ?? {}}
          picked={model?.pickedCards ?? []}
          onCard={onCard}
          small={!wide}
        />
        <DecksPanel s={s} human={human} compact={!wide} />
      </footer>

      <RulesDialog open={rules} onClose={() => setRules(false)} />
      <ScenarioDialog open={briefing} onClose={() => setBriefing(false)} s={s} human={human} />
      <Modal open={settings} title="Settings" onClose={() => setSettings(false)} width={520} footer={<Button onClick={() => setSettings(false)}>Done</Button>}>
        <div className="gs-settings">
          <div className="gs-settings__row">
            <span>Animation speed</span>
            <Segmented<Speed> label="Animation speed" value={view.speed} options={SPEEDS.map((x) => ({ value: x, label: SPEED_LABEL[x] }))} onChange={(v) => controller.setSpeed(v)} />
          </div>
          <div className="gs-settings__row">
            <span>Offer Initiative re-rolls</span>
            <Segmented<RerollPolicy>
              label="Offer Initiative re-rolls"
              value={view.reroll}
              options={REROLL_POLICIES.map((x) => ({ value: x, label: REROLL_LABEL[x] }))}
              onChange={(v) => controller.setRerollPolicy(v)}
            />
            <small>
              While you hold the Initiative you may cancel any roll. “When it matters” asks only after a Fire Attack, Defense, melee,
              rally, rout or Sudden Death roll that went against you.
            </small>
          </div>
          <SoundToggle />
        </div>
      </Modal>
      <Modal
        open={confirmMenu}
        title="Leave the battle?"
        onClose={() => setConfirmMenu(false)}
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmMenu(false)}>
              Stay
            </Button>
            <Button onClick={onMenu}>Main menu</Button>
          </>
        }
      >
        <p>The battle is saved after every step: choose Continue on the main menu to pick it up again.</p>
      </Modal>
      {view.over ? (
        <ResultDialog
          open={resultOpen}
          s={s}
          human={human}
          winner={view.over.winner}
          reason={view.over.reason}
          vp={view.vp}
          onRematch={() => onRematch(false)}
          onSwitch={() => onRematch(true)}
          onMenu={onMenu}
          onClose={() => setResultOpen(false)}
        />
      ) : null}
      {view.over && !resultOpen ? (
        <Button className="gs-result-btn" onClick={() => setResultOpen(true)}>
          Result
        </Button>
      ) : null}
    </div>
  );
}

function SoundToggle() {
  const [muted, setM] = useState(isMuted());
  return (
    <Toggle
      checked={!muted}
      onChange={(on) => {
        setMuted(!on);
        setM(!on);
      }}
    >
      Sound effects
    </Toggle>
  );
}
