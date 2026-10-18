// The battle session: owns the GameDriver, asks the opponent for its decisions (it sees only `redact(state, side)`),
// shows the human his own, turns the engine's events into paced animations and log lines (hidden information
// filtered), autosaves after every answer, and offers undo where nothing new was revealed.
import { answerError } from '../../engine/decisions';
import { GameDriver, type QueuedEvent } from '../../engine/driver';
import { randomAnswer } from '../../engine/random';
import { redact } from '../../engine/state';
import type { Answer, Decision, EndReason, GameEvent, GameState, HexId, PieceId, Side, WindowKind } from '../../engine/types';
import { other } from '../../engine/types';
import { sfx } from '../sound';
import { storage } from '../storage';
import { publicEvent, viewOf } from './hidden';
import { fireStep, type FireShow } from './fireShow';
import { logEntry, vpBucket, type LogKind } from './log';
import { PURPOSE_TEXT, isRollPurpose, pieceName, sideName } from './names';
import { WINDOW_PAUSE_MS, type Opponent } from './opponent';
import {
  contextAfterAnswer, contextAfterEvent, loadRerollPolicy, offerReroll, rollStakes, saveRerollPolicy, type RerollPolicy, type RollContext, type RollStakes,
} from './reroll';
import { clearSave, makeSave, newDriver, writeSave, type SessionConfig } from './session';
import { setupChoice } from './prompts';
import { Drama } from './drama';
import type { Banner, HexPick, Impact } from './randomiser';
import { deployForMe } from '../../ai/deploy';

export type Speed = 'slow' | 'normal' | 'fast' | 'instant';
export const SPEEDS: readonly Speed[] = ['slow', 'normal', 'fast', 'instant'];
export const SPEED_LABEL: Record<Speed, string> = { slow: 'Slow', normal: 'Normal', fast: 'Fast', instant: 'Instant' };
const SPEED_FACTOR: Record<Speed, number> = { slow: 0.6, normal: 1, fast: 2.2, instant: Infinity };
const SPEED_KEY = 'cce-speed';

export interface LogLine {
  id: number;
  text: string;
  side?: Side;
  kind: LogKind;
}

/** A card shown big on the board: a roll, a reveal, a card played by the opponent, an Event. */
export interface CardShow {
  id: number;
  card: string;
  side: Side;
  caption: string;
  /** The roll's value, when it is a roll. */
  value?: number;
  trigger?: string | null;
  highlight?: 'order' | 'action' | 'event' | null;
}

export interface Flash {
  id: number;
  hex: HexId;
  text: string;
  tone: 'hit' | 'good' | 'info' | 'fire';
}

/** Units in flight from one hex to the next. */
export interface Slide {
  id: number;
  units: PieceId[];
  from: HexId;
  to: HexId;
  ms: number;
}

export interface AttackShow {
  id: number;
  from: HexId[];
  targets: HexId[];
}

export type VpBreakdown = Record<'Eliminations' | 'Exits' | 'Objectives' | 'Time' | 'Other', number>;

export interface ViewState {
  /** The game as the human sees it (redacted; everything once it is over). */
  display: GameState;
  /** The human's decision, once the animations before it have played. */
  pending: Decision | null;
  humanSide: Side;
  log: LogLine[];
  show: CardShow | null;
  flashes: Flash[];
  slides: Slide[];
  flipping: PieceId[];
  attack: AttackShow | null;
  /** The Fire Attack being shown step by step (fireShow.ts), until play moves on. */
  fire: FireShow | null;
  toast: { id: number; text: string; kind: 'turn' | 'notice' | 'big' } | null;
  /** The opponent is deciding. */
  thinking: boolean;
  /** One of the opponent's reaction windows is open (the uniform pause). */
  waiting: WindowKind | null;
  /** Animations are playing. */
  animating: boolean;
  error: string | null;
  over: { winner: Side; reason: EndReason } | null;
  canUndo: boolean;
  speed: Speed;
  reroll: RerollPolicy;
  /** Event / Sniper! / Random Hex moments (drama.ts): the randomiser on the map, the banner, the hexes hit. */
  hexPick: HexPick | null;
  banner: Banner | null;
  impacts: Impact[];
  /** VP gained per side by source (signed toward that side). */
  vp: Record<Side, VpBreakdown>;
  fatal: boolean;
  /** The human's decisions so far, by kind (dev: the prompt-flood check). */
  asked: Record<string, number>;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const emptyVp = (): VpBreakdown => ({ Eliminations: 0, Exits: 0, Objectives: 0, Time: 0, Other: 0 });

let seq = 1;

function loadSpeed(): Speed {
  const v = storage.get(SPEED_KEY);
  return SPEEDS.includes(v as Speed) ? (v as Speed) : 'normal';
}

export class GameController {
  readonly config: SessionConfig;
  driver: GameDriver;
  view: ViewState;
  private listeners = new Set<() => void>();
  private opponent: Opponent;
  private busy = false;
  private disposed = false;
  private skip = false;
  /** The rest of a path the human clicked (move steps sent one by one while they stay legal). */
  private plan: Answer[] = [];
  /** "Pass for the rest of this Move": this window kind is passed until the next Order. */
  private autoPass: { window: WindowKind; orders: number } | null = null;
  private orders = 0;
  /** Random answers still to give for the human (dev `?auto=N`). */
  private autoLeft = 0;
  /** "Deploy / Place the rest for me": the computer settles the rest of the human's set-up. */
  private setupAuto = false;
  private rollCtx: RollContext = {};
  /**
   * The longest time (ms, capped) the opponent has needed for a reaction decision. Every one of its reaction windows
   * pauses at least this long, so a window where it had a card to consider looks the same as one where it had none.
   */
  private reactMax = 0;
  /** For each human answer by its place among the answers: the first log id after it (undo drops the lines). */
  private logMarks = new Map<number, number>();
  /** Event / Sniper! / Random Hex moments. */
  private drama = new Drama({
    view: () => this.view,
    set: (p) => this.set(p),
    wait: (ms) => this.wait(ms),
    dur: (ms) => this.dur(ms),
    skipping: () => this.skip,
    showCard: (c, ms) => this.showCard(c, ms),
    human: () => this.human,
    nextId: () => seq++,
  });

  /**
   * `driver`: a game restored from the autosave; `history`: the events of its replay (for the log and the VP tally;
   * they are filtered for hidden information like live ones).
   */
  constructor(config: SessionConfig, opponent: Opponent, driver?: GameDriver, history?: GameEvent[]) {
    this.config = config;
    this.opponent = opponent;
    this.driver = driver ?? newDriver(config);
    const human = config.humanSide;
    this.view = {
      display: viewOf(driver ? this.driver.state : this.driver.initial, human),
      pending: null,
      humanSide: human,
      log: [],
      show: null,
      flashes: [],
      slides: [],
      flipping: [],
      attack: null,
      fire: null,
      hexPick: null,
      banner: null,
      impacts: [],
      toast: null,
      thinking: false,
      waiting: null,
      animating: false,
      error: null,
      over: null,
      canUndo: false,
      speed: loadSpeed(),
      reroll: loadRerollPolicy(),
      vp: { axis: emptyVp(), allied: emptyVp() },
      fatal: false,
      asked: {},
    };
    const s = this.driver.state;
    this.addLog({ kind: 'turn', text: `${s.scenario.name}: you command the ${sideName(s, human)}.` });
    if (driver) {
      this.driver.drainEvents();
      if (history) this.replayHistory(history);
      this.addLog({ kind: 'info', text: 'Battle resumed from the autosave.' });
    }
  }

  private started = false;

  /** Start the game loop (after the screen subscribed); once. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.run();
  }

  /** The log lines and VP tally of a resumed game's earlier events. */
  private replayHistory(events: GameEvent[]) {
    const s = this.view.display;
    const vp = { axis: emptyVp(), allied: emptyVp() };
    const lines: LogLine[] = [];
    for (const raw of events) {
      // the hidden set-up is long over by any resume worth logging: its placements are skipped like live ones
      if (raw.kind === 'place' && raw.piece) continue;
      const e = publicEvent(raw, this.human);
      if (!e) continue;
      if (e.kind === 'vp') vp[e.delta > 0 ? 'axis' : 'allied'][vpBucket(e.why)] += Math.abs(e.delta);
      try {
        const l = logEntry(e, s, this.human);
        if (l) lines.push({ ...l, id: seq++ });
      } catch {
        /* a line that cannot be written from the final state */
      }
    }
    this.set({ log: [...this.view.log, ...lines.slice(-500)], vp });
  }

  // ------------------------------------------------------------------------------------------------- subscription
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getView = () => this.view;

  private set(patch: Partial<ViewState>) {
    this.view = { ...this.view, ...patch };
    for (const l of this.listeners) l();
  }

  dispose(): void {
    this.disposed = true;
    this.drama.dispose();
    this.opponent.dispose();
    this.listeners.clear();
  }

  get human(): Side {
    return this.config.humanSide;
  }
  get ai(): Side {
    return other(this.config.humanSide);
  }

  // ----------------------------------------------------------------------------------------------------- settings
  setSpeed(speed: Speed): void {
    storage.set(SPEED_KEY, speed);
    this.set({ speed });
  }

  setRerollPolicy(p: RerollPolicy): void {
    saveRerollPolicy(p);
    this.set({ reroll: p });
  }

  /** What the human's pending re-roll question decides for him: the number the roll had to reach, his chances. */
  stakesOf(d: Decision | null): RollStakes | null {
    if (!d || d.kind !== 'reroll') return null;
    try {
      return rollStakes(viewOf(this.driver.state, this.human), d.roll, this.human, this.rollCtx);
    } catch {
      return null;
    }
  }

  /** Close the Fire Attack panel. */
  closeFire(): void {
    if (this.view.fire) this.set({ fire: null });
  }

  /** End a reading pause (an Event's banner, a landed Random Hex), or else skip the rest of the animations now playing. */
  hurry(): void {
    if (this.drama.hurry()) return;
    if (this.view.animating) this.skip = true;
  }

  private dur(ms: number): number {
    if (this.skip) return 0;
    const f = SPEED_FACTOR[this.view.speed];
    return f === Infinity ? 0 : ms / f;
  }

  private async wait(ms: number): Promise<void> {
    const t = this.dur(ms);
    if (t > 0) await sleep(t);
  }

  // ---------------------------------------------------------------------------------------------------------- log
  private addLog(l: Omit<LogLine, 'id'>) {
    const log = [...this.view.log, { ...l, id: seq++ }];
    if (log.length > 600) log.splice(0, log.length - 600);
    this.set({ log });
  }

  /** A short notice on the board (why a click did nothing). */
  notice(text: string): void {
    this.toast(text, 'notice', 1800);
  }

  private toast(text: string, kind: 'turn' | 'notice' | 'big', ms: number) {
    const t = { id: seq++, text, kind };
    this.set({ toast: t });
    setTimeout(() => {
      if (this.view.toast?.id === t.id) this.set({ toast: null });
    }, Math.max(400, kind === 'notice' ? ms : this.dur(ms) || 400));
  }

  private flash(hex: HexId, text: string, tone: Flash['tone'], ms = 1300) {
    if (hex < 0 || hex >= 150 || SPEED_FACTOR[this.view.speed] === Infinity) return;
    const f: Flash = { id: seq++, hex, text, tone };
    this.set({ flashes: [...this.view.flashes.filter((x) => x.hex !== hex || x.tone !== tone), f] });
    setTimeout(() => this.set({ flashes: this.view.flashes.filter((x) => x.id !== f.id) }), Math.max(300, this.dur(ms)));
  }

  // ---------------------------------------------------------------------------------------------------- answering
  private save() {
    if (this.disposed) return;
    if (this.driver.state.phase === 'over') clearSave();
    else writeSave(makeSave(this.config, this.driver));
  }

  /** Remember what the re-roll judgement needs from an accepted answer. */
  private noteAnswer(d: Decision, a: Answer) {
    this.rollCtx = contextAfterAnswer(this.rollCtx, d, a);
  }

  /** The human answers his pending decision (the screen's click). `rest`: more answers of a path to send after it. */
  answer(a: Answer, rest: Answer[] = []): void {
    const d = this.view.pending;
    if (!d || this.busy || this.view.fatal || this.disposed) return;
    if (!this.give(d, a)) return;
    this.plan = rest.slice();
    this.set({ pending: null, error: null, canUndo: false, ...(this.view.fire?.stage === 'done' ? { fire: null } : {}) });
    this.run();
  }

  /** Give answer `a` of the human's to the driver; false (with the error shown) when it is refused. */
  private give(d: Decision, a: Answer): boolean {
    const at = this.driver.answers.length;
    let ok: boolean;
    try {
      ok = this.driver.answer(a);
    } catch (e) {
      console.error('The answer could not be resolved', e);
      this.driver = GameDriver.replay(this.driver.initial, this.driver.answers, { snapshots: true, windows: true });
      this.set({ error: 'That could not be resolved — try something else.', pending: this.humanPending(), display: viewOf(this.driver.state, this.human) });
      return false;
    }
    if (!ok) {
      this.set({ error: this.driver.lastError });
      return false;
    }
    this.logMarks.set(at, seq);
    this.noteAnswer(d, a);
    this.save();
    return true;
  }

  private humanPending(): Decision | null {
    const p = this.driver.pending;
    return p && p.side === this.human && this.driver.state.phase !== 'over' ? p : null;
  }

  /** Dev: answer the human's pending decision with a random legal answer. */
  autoAnswer(): void {
    const d = this.view.pending;
    if (!d) return;
    this.answer(this.randomFor(d, this.human));
  }

  /** Dev: random answers are being given for the human (`?auto=N`). */
  get autoPlaying(): boolean {
    return this.autoLeft > 0;
  }

  /** Dev: answer the human's next `n` decisions at random (`?auto=N`). */
  autoPlay(n: number): void {
    this.autoLeft = n;
    if (this.view.pending) this.autoAnswer();
  }

  /**
   * "Deploy / Place the rest for me": from now until the battle starts, the human's set-up decisions (pieces still to
   * place, Fortification hexes) are answered with the computer's own choices. The pending one is answered by its button.
   */
  autoSetup(): void {
    if (this.driver.state.phase === 'setup') this.setupAuto = true;
  }

  /** "Pass for the rest of this Move": pass now and at every later window of this kind until the next Order. */
  passRest(): void {
    const d = this.view.pending;
    if (!d || d.kind !== 'react') return;
    this.autoPass = { window: d.window, orders: this.orders };
    this.answer({ kind: 'done' });
  }

  private randomFor(d: Decision, side: Side): Answer {
    try {
      return randomAnswer(redact(this.driver.state, side), d, Math.random);
    } catch {
      return randomAnswer(this.driver.state, d, Math.random);
    }
  }

  // --------------------------------------------------------------------------------------------------------- undo
  undo(): void {
    if (!this.view.canUndo || this.busy || !this.driver.canUndo()) return;
    this.driver = GameDriver.replay(this.driver.initial, this.driver.answers.slice(0, -1), { snapshots: true, windows: true });
    const from = this.driver.answers.length;
    const mark = this.logMarks.get(from);
    for (const k of [...this.logMarks.keys()]) if (k >= from) this.logMarks.delete(k);
    this.plan = [];
    this.set({
      log: mark !== undefined ? this.view.log.filter((l) => l.id < mark) : this.view.log,
      display: viewOf(this.driver.state, this.human),
      pending: this.humanPending(),
      canUndo: this.humanPending() ? this.driver.canUndo() : false,
      error: null,
      slides: [],
      attack: null,
      fire: null,
      hexPick: null,
      banner: null,
      impacts: [],
    });
    this.drama.reset();
    this.save();
    if (!this.humanPending()) this.run();
  }

  // ---------------------------------------------------------------------------------------------------- main loop
  private run(): void {
    this.pump().catch((e) => {
      console.error('The battle loop failed', e);
      this.busy = false;
      this.set({ fatal: true, error: `The battle could not continue: ${e instanceof Error ? e.message : String(e)}`, thinking: false, animating: false });
    });
  }

  private async pump(): Promise<void> {
    if (this.busy || this.disposed) return;
    this.busy = true;
    try {
      for (;;) {
        // give the page a turn between steps (painting, input), also when nothing animates (instant speed)
        await sleep(0);
        if (this.disposed) return;
        const asked = this.askAhead();
        await this.playEvents();
        if (this.disposed) return;
        const st = this.driver.state;
        const d = this.driver.pending;
        if (st.phase === 'over' || !d) {
          if (st.winner && st.endReason) {
            this.set({ over: { winner: st.winner, reason: st.endReason }, pending: null, display: viewOf(st, this.human), thinking: false });
            if (st.winner === this.human) sfx.victory();
            else sfx.defeat();
          }
          clearSave();
          return;
        }
        if (d.side === this.human) {
          if (this.autoAnswerHuman(d)) continue;
          const count = { ...this.view.asked, [d.kind]: (this.view.asked[d.kind] ?? 0) + 1 };
          this.set({ pending: d, display: viewOf(st, this.human), canUndo: this.driver.canUndo(), thinking: false, waiting: null, asked: count });
          return;
        }
        await this.opponentTurn(d, asked);
      }
    } finally {
      this.busy = false;
      this.skip = false;
      if (this.view.animating) this.set({ animating: false });
    }
  }

  /** Answers the human does not need to give himself: declined re-rolls, the rest of a path, passed windows, dev play. */
  private autoAnswerHuman(d: Decision): boolean {
    const s = this.driver.state;
    let a: Answer | null = null;
    if (this.autoLeft > 0) {
      this.autoLeft--;
      a = this.randomFor(d, this.human);
    } else if (d.kind === 'reroll' && !offerReroll(this.view.reroll, viewOf(s, this.human), d, this.human, this.rollCtx)) {
      a = { kind: 'reroll', yes: false };
    } else if (this.plan.length) {
      const next = this.plan[0];
      const same = d.kind === 'move' && next.kind === 'moveStep' && !!d.current && d.current.length === next.units.length && next.units.every((id) => d.current!.includes(id)) || (d.kind === 'deploy' && (next.kind === 'deploy' || next.kind === 'done'));
      if (same && !answerError(s, d, next)) {
        this.plan.shift();
        a = next;
      } else this.plan = [];
    } else if (d.kind === 'react' && this.autoPass && this.autoPass.window === d.window && this.autoPass.orders === this.orders) {
      a = { kind: 'done' };
    } else if (this.setupAuto && s.phase === 'setup' && (d.kind === 'deploy' || (d.kind === 'choose' && d.reason === 'placement'))) {
      const view = viewOf(s, this.human);
      if (d.kind === 'choose') a = { kind: 'choose', items: setupChoice(view, d) };
      else a = deployForMe(view, d)[0] ?? { kind: 'done' };
      if (answerError(s, d, a)) a = d.kind === 'deploy' ? { kind: 'done' } : this.randomFor(d, this.human);
    }
    if (s.phase !== 'setup') this.setupAuto = false;
    if (!a) return false;
    return this.give(d, a);
  }

  /**
   * The opponent's pending decision, asked before the events that lead to it are animated (the engine is already past
   * them), so it thinks while the board plays them. Nothing else can answer meanwhile (`busy`).
   */
  private askAhead(): { d: Decision; answer: Promise<{ answer: Answer; say?: string }>; took: () => number } | null {
    const d = this.driver.pending;
    if (!d || d.side === this.human || this.driver.state.phase === 'over') return null;
    const t0 = performance.now();
    let t1 = 0;
    const answer = this.opponent.decide(redact(this.driver.state, d.side), d);
    answer.then(
      () => (t1 = performance.now()),
      () => {},
    );
    return { d, answer, took: () => (t1 || performance.now()) - t0 };
  }

  private async opponentTurn(d: Decision, asked: ReturnType<GameController['askAhead']>): Promise<void> {
    // a reaction (or re-roll) decision shows only the window's own notice: "deciding…" would tell it had a card to weigh
    const quiet = d.kind === 'react' || d.kind === 'reroll';
    // the opponent answered something on the way (Op Fire, a re-roll ...): a planned path stops for a fresh look
    if (d.kind !== 'reroll') this.plan = [];
    const t0 = performance.now();
    this.set({ thinking: !quiet, waiting: d.kind === 'react' ? d.window : this.view.waiting, pending: null, canUndo: false });
    let res: { answer: Answer; say?: string };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      res = await Promise.race([
        asked && asked.d === d ? asked.answer : this.opponent.decide(redact(this.driver.state, d.side), d),
        new Promise<never>((_, rej) => {
          timer = setTimeout(() => rej(new Error('The AI took too long')), 60000);
        }),
      ]);
    } catch (e) {
      if (this.disposed) return;
      console.error('The opponent failed; answering at random', e);
      res = { answer: this.randomFor(d, d.side) };
    } finally {
      clearTimeout(timer);
    }
    if (this.disposed) return;
    // how long the opponent needed to weigh this reaction (its own computing time, not the animations meanwhile)
    if (d.kind === 'react') this.reactMax = Math.max(this.reactMax, Math.min(2000, asked && asked.d === d ? asked.took() : performance.now() - t0));
    this.set({ thinking: false, waiting: null });
    if (res.say) this.addLog({ kind: 'say', side: d.side, text: res.say });
    let ok = false;
    try {
      ok = this.driver.answer(res.answer);
    } catch (e) {
      console.error('The opponent’s answer broke the flow', e);
      this.driver = GameDriver.replay(this.driver.initial, this.driver.answers, { snapshots: true, windows: true });
    }
    if (ok) this.noteAnswer(d, res.answer);
    for (let i = 0; !ok && i < 40; i++) {
      const p = this.driver.pending;
      if (!p || p.side === this.human) break;
      const a = this.randomFor(p, p.side);
      ok = this.driver.answer(a);
      if (ok) this.noteAnswer(p, a);
    }
    if (!ok) throw new Error(`The opponent could not answer (${this.driver.lastError ?? 'no legal answer'})`);
    this.save();
  }

  // --------------------------------------------------------------------------------------------------- animation
  private async playEvents(): Promise<void> {
    const evs = this.driver.drainEvents();
    if (!evs.length) return;
    this.set({ animating: true });
    for (const q of evs) {
      if (this.disposed) return;
      await this.animate(q);
    }
    this.set({ animating: false, waiting: null });
    this.skip = false;
  }

  private hexOf(s: GameState, id: PieceId): HexId {
    const p = s.pieces[id];
    if (!p) return -1;
    if (p.where === 'map') return p.hex;
    if (p.where === 'carried' && p.carrier) return this.hexOf(s, p.carrier);
    return -1;
  }

  private async animate(q: QueuedEvent): Promise<void> {
    const human = this.human;
    const full = q.state ?? this.driver.state;
    const shown = publicEvent(q.e, human, full);
    const after = viewOf(full, human);
    if (!shown) {
      this.set({ display: after });
      return;
    }
    const e: GameEvent = shown;
    const before = this.view.display;
    // set-up placements are not logged one by one
    const entry = e.kind === 'place' && e.piece && full.phase === 'setup' ? null : logEntry(e, after, human);
    if (entry) this.addLog(entry);
    // an Event, a Sniper! or a Random Hex stages its own part first (drama.ts)
    await this.drama.play(e, entry?.text ?? null, after, before);
    const mine = (side: Side | undefined) => side === human;
    this.rollCtx = contextAfterEvent(this.rollCtx, e);
    this.stepFire(e, after);
    switch (e.kind) {
      case 'turnStart': {
        this.orders++;
        this.autoPass = null;
        this.set({ display: after, attack: null });
        if (mine(e.side)) {
          sfx.turn();
          this.toast('Your Turn', 'turn', 1100);
          await this.wait(500);
        } else {
          this.toast(`${sideName(after, e.side)}’ Turn`, 'turn', 900);
          await this.wait(450);
        }
        break;
      }
      case 'cardPlayed': {
        if (e.as === 'order') this.orders++;
        sfx.card();
        const caption = `${sideName(after, e.side)}${mine(e.side) ? ' (you)' : ''}: ${e.name}${e.as === 'order' ? ' Order' : ''}`;
        this.showCard({ card: e.card, side: e.side, caption, highlight: e.as === 'order' ? 'order' : 'action' }, mine(e.side) ? 900 : 1700);
        this.set({ display: after });
        await this.wait(mine(e.side) ? 250 : 1100);
        break;
      }
      case 'reveal': {
        if (e.purpose === 'randomHex' || e.purpose === 'event') {
          // the randomiser and the Event's banner show these cards (drama.ts)
          this.set({ display: after });
          break;
        }
        const roll = isRollPurpose(e.purpose);
        sfx.card();
        const caption = `${sideName(after, e.side)}${mine(e.side) ? ' (you)' : ''} — ${roll ? 'roll for ' : ''}${PURPOSE_TEXT[e.purpose] ?? e.purpose}`;
        this.showCard({ card: e.card, side: e.side, caption, value: roll ? e.value : undefined, trigger: e.trigger ?? null, highlight: null }, 1500);
        this.set({ display: after });
        await this.wait(roll ? 750 : 550);
        break;
      }
      case 'event':
        // its banner names it (drama.ts)
        this.set({ display: after });
        break;
      case 'trigger': {
        if (e.trigger === 'Time') sfx.whistle();
        this.set({ display: after });
        // a Sniper! has its banner instead (drama.ts)
        if (e.trigger === 'Sniper') break;
        this.toast(`${e.trigger}!`, 'big', 900);
        await this.wait(550);
        break;
      }
      case 'reroll':
        this.toast(`Re-roll! (${sideName(after, e.by)})`, 'big', 900);
        this.set({ display: after });
        await this.wait(500);
        break;
      case 'activate':
        this.set({ display: after });
        if (!mine(e.side)) await this.wait(450);
        break;
      case 'move':
      case 'retreat': {
        const units = e.kind === 'move' ? e.units : [e.unit];
        const ms = this.dur(e.kind === 'move' ? 300 : 260);
        sfx.step();
        if (ms > 0) {
          const slide: Slide = { id: seq++, units, from: e.from, to: e.to, ms };
          this.set({ display: after, slides: [...this.view.slides, slide] });
          await sleep(ms);
          this.set({ slides: this.view.slides.filter((x) => x.id !== slide.id) });
        } else this.set({ display: after });
        if (e.kind === 'move' && !mine(after.pieces[units[0]]?.side)) await this.wait(80);
        break;
      }
      case 'exit':
        this.flash(e.from, 'Exits', 'good');
        this.set({ display: after });
        await this.wait(500);
        break;
      // a Fire Attack in steps (the panel and the board overlay draw `fire`): who fires at whom, the FP built line by
      // line, the roll and the total, then each defender's number to hold, its roll and the result
      case 'fireAt':
        this.set({ display: after });
        await this.wait(mine(e.side) ? 350 : 700);
        break;
      case 'firePower':
        this.set({ display: after });
        await this.wait(250 + 130 * (this.view.fire?.lines.length ?? 2));
        break;
      case 'fireAttack': {
        const targets = e.hexes?.length ? e.hexes : [e.target];
        if (e.pieces.length > 2) sfx.burst(6);
        else sfx.shot();
        this.set({ display: after });
        // (the overlay labels the target with the total)
        if (!this.view.fire) for (const t of targets) this.flash(t, `Attack ${e.total}`, 'fire', 1800);
        await this.wait(800);
        break;
      }
      case 'defending':
        this.set({ display: after });
        await this.wait(500);
        break;
      case 'targeting':
        this.flash(e.target, `${e.product} vs ${e.need}: ${e.hit ? 'hit!' : 'miss'}`, e.hit ? 'fire' : 'info', 1500);
        this.set({ display: after });
        await this.wait(650);
        break;
      case 'defense': {
        const h = this.hexOf(after, e.unit);
        const res = e.result === 'break' ? 'breaks' : e.result === 'suppress' ? 'suppressed' : 'holds';
        this.flash(h, `${pieceName(after, e.unit)}: ${e.total} vs ${e.attack} — ${res}`, e.result === 'none' ? 'good' : 'hit', 1500);
        this.set({ display: after });
        await this.wait(700);
        break;
      }
      case 'break': {
        sfx.hit();
        this.set({ display: after, flipping: [...this.view.flipping, e.piece] });
        await this.wait(450);
        this.set({ flipping: this.view.flipping.filter((x) => x !== e.piece) });
        break;
      }
      case 'rally':
        this.flash(this.hexOf(after, e.piece), 'Rallied', 'good');
        this.set({ display: after, flipping: [...this.view.flipping, e.piece] });
        await this.wait(450);
        this.set({ flipping: this.view.flipping.filter((x) => x !== e.piece) });
        break;
      case 'suppress':
        this.flash(this.hexOf(after, e.piece), 'Suppressed', 'hit');
        this.set({ display: after });
        await this.wait(350);
        break;
      case 'eliminate': {
        const h = this.hexOf(before, e.piece);
        sfx.hit();
        this.flash(h, `${pieceName(after, e.piece)} eliminated`, 'hit', 1600);
        this.set({ display: after });
        await this.wait(550);
        break;
      }
      case 'melee': {
        this.flash(e.hex, `Melee: Axis ${e.totals.axis} — Allies ${e.totals.allied}`, 'fire', 2000);
        sfx.burst(4);
        this.set({ display: after });
        await this.wait(1000);
        break;
      }
      case 'place': {
        this.set({ display: after });
        if (e.piece) {
          if (!mine(after.pieces[e.piece]?.side) && after.phase !== 'setup') await this.wait(250);
        } else {
          if (e.marker === 'sr') this.flash(e.hex, 'Spotting Round', 'info');
          else if (e.marker === 'smoke') this.flash(e.hex, `Smoke ${e.value ?? ''}`.trim(), 'info');
          else if (e.marker) this.flash(e.hex, e.marker.charAt(0).toUpperCase() + e.marker.slice(1), 'info');
          if (e.marker === 'sr' || e.marker === 'blaze') sfx.boom();
          await this.wait(350);
        }
        break;
      }
      case 'vp': {
        const side: Side = e.delta > 0 ? 'axis' : 'allied';
        const b = vpBucket(e.why);
        const vp = { ...this.view.vp, [side]: { ...this.view.vp[side], [b]: this.view.vp[side][b] + Math.abs(e.delta) } };
        this.set({ display: after, vp });
        break;
      }
      case 'control':
        if (after.phase === 'play') this.flash(after.map.objectives[e.objective - 1] ?? -1, `Objective ${e.objective}`, 'good');
        this.set({ display: after });
        await this.wait(250);
        break;
      case 'chit':
        this.set({ display: after });
        if (e.open && after.phase === 'play') {
          this.toast(`Objective chit ${e.chit} is open`, 'notice', 1600);
          await this.wait(600);
        }
        break;
      case 'time':
        sfx.whistle();
        this.toast(`Time ${e.time}`, 'big', 1200);
        this.set({ display: after });
        await this.wait(800);
        break;
      case 'suddenDeath':
        this.toast(`Sudden Death: ${e.roll} vs ${e.time} — ${e.ends ? 'the battle ends!' : 'the battle goes on'}`, 'big', 1800);
        this.set({ display: after });
        await this.wait(1300);
        break;
      case 'window':
        if (e.side !== human) {
          // the same pause at every window of the opponent's, whether or not it can play anything there (and at least
          // as long as it has needed to weigh a reaction: its decision is asked before these animations, see askAhead)
          this.set({ waiting: e.window });
          // (the reaction time applies at every speed, also when hurried: only the cosmetic part of the pause is skipped)
          const ms = Math.max(this.dur(WINDOW_PAUSE_MS), this.reactMax);
          if (ms > 0) await sleep(ms);
          this.set({ waiting: null });
        }
        break;
      case 'gameOver':
        this.set({ display: viewOf(q.state ?? this.driver.state, human) });
        break;
      default:
        this.set({ display: after });
    }
  }

  /** The Fire Attack shown after event `e`; once every defender has rolled it closes by itself after a while. */
  private stepFire(e: GameEvent, after: GameState) {
    const prev = this.view.fire;
    const fire = fireStep(prev, e, after);
    if (fire === prev) return;
    this.set({ fire });
    if (fire && fire.stage === 'done' && prev?.stage !== 'done') {
      setTimeout(() => {
        if (this.view.fire?.id === fire.id && this.view.fire.stage === 'done') this.set({ fire: null });
      }, Math.max(3000, this.dur(7000)));
    }
  }

  private showCard(c: Omit<CardShow, 'id'>, ms: number) {
    if (SPEED_FACTOR[this.view.speed] === Infinity) return;
    const show: CardShow = { ...c, id: seq++ };
    this.set({ show });
    setTimeout(() => {
      if (this.view.show?.id === show.id) this.set({ show: null });
    }, Math.max(500, this.dur(ms)));
  }
}
