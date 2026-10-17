// GameDriver: runs the flow generator, records answers (replay, undo, save) and queues events for the UI.
import type { Gen } from './decisions';
import { gameFlow } from './flow';
import { cloneState } from './state';
import type { Answer, Decision, FlowCtx, GameEvent, GameState, Side } from './types';

export interface QueuedEvent {
  e: GameEvent;
  /** State right after the event (only when snapshots are enabled). */
  state?: GameState;
}

export interface DriverOptions {
  snapshots?: boolean;
  /** Emit a 'window' event for every reaction window opened for a side (FlowCtx.windows; the UI's driver). */
  windows?: boolean;
}

/** Events that show somebody something new (a card, a chit, a deck order): no undo past them. */
const REVEALING = new Set<GameEvent['kind']>(['reveal', 'draw', 'reshuffle', 'chit', 'event', 'trigger']);

export class GameDriver {
  readonly initial: GameState;
  state: GameState;
  answers: Answer[] = [];
  pending: Decision | null = null;
  lastError: string | null = null;
  /** Information count (revealing events + RNG calls) before each recorded answer. */
  private infoBefore: number[] = [];
  /** Side that gave each recorded answer. */
  private sides: Side[] = [];
  private revealed = 0;
  private gen: Gen;
  private queue: QueuedEvent[] = [];
  private snapshots: boolean;
  private ctx: FlowCtx;

  constructor(initial: GameState, opts: DriverOptions = {}) {
    this.initial = cloneState(initial);
    this.state = cloneState(initial);
    this.snapshots = !!opts.snapshots;
    this.ctx = {
      emit: (e) => {
        if (REVEALING.has(e.kind)) this.revealed++;
        this.queue.push({ e, state: this.snapshots ? cloneState(this.state) : undefined });
      },
      invalid: (m) => {
        this.lastError = m;
      },
      ...(opts.windows ? { windows: true } : {}),
    };
    this.gen = gameFlow(this.state, this.ctx);
    const r = this.gen.next();
    this.pending = r.done ? null : r.value;
  }

  get over(): boolean {
    return this.state.phase === 'over' || this.pending === null;
  }

  private info(): number {
    return this.revealed + this.state.rngCalls;
  }

  /** Submit an answer to the pending decision. Returns false (and sets lastError) if it was refused. */
  answer(a: Answer): boolean {
    if (!this.pending) throw new Error('No decision is pending.');
    this.lastError = null;
    const before = this.info();
    const side = this.pending.side;
    const r = this.gen.next(a);
    this.pending = r.done ? null : r.value;
    if (this.lastError) return false;
    this.answers.push(a);
    this.infoBefore.push(before);
    this.sides.push(side);
    return true;
  }

  drainEvents(): QueuedEvent[] {
    const q = this.queue;
    this.queue = [];
    return q;
  }

  /**
   * Can the last answer be taken back? Only by the side deciding now, when it was his own answer and nothing new has
   * been shown to anyone since it was given (no card, chit or shuffle): replaying without it then reveals nothing.
   */
  canUndo(): boolean {
    const n = this.answers.length;
    if (!n || !this.pending) return false;
    return this.sides[n - 1] === this.pending.side && this.infoBefore[n - 1] === this.info();
  }

  /** Rebuild the game without the last answer (see `canUndo`). */
  undo(): GameDriver {
    return GameDriver.replay(this.initial, this.answers.slice(0, -1), { snapshots: this.snapshots });
  }

  static replay(initial: GameState, answers: Answer[], opts: DriverOptions = {}): GameDriver {
    const d = new GameDriver(initial, { snapshots: false, windows: opts.windows });
    for (const a of answers) {
      if (!d.pending) break;
      if (!d.answer(a)) throw new Error(`Replay failed: ${d.lastError}`);
    }
    d.drainEvents();
    d.snapshots = !!opts.snapshots;
    return d;
  }
}
