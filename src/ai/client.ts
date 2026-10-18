// The AI as the battle screen's Opponent (src/ui/game/opponent.ts): decisions run in a module Web Worker, falling back
// to in-thread computation when the worker cannot start, errors, or does not answer in time — the game never stalls on
// the AI. Hidden information: `decide` redacts what it is given for the AI's side before anything else (a full state
// passed by mistake never reaches the worker or chooseAnswer), and the worker gets only that view and the decision.
// The AI itself is imported only for the fallback, when first needed: the main bundle leaves it to the worker's chunk.
import { redact } from '../engine/state';
import type { Answer, Decision, GameState, Side } from '../engine/types';
import type { AiMemory, AiOptions } from './index';
import type { AiLevel } from './levels';
import type { WorkerRequest, WorkerResponse } from './worker';

/** The battle screen's opponent interface (same shape as src/ui/game/opponent.ts `Opponent`). */
export interface Opponent {
  decide(view: GameState, d: Decision): Promise<{ answer: Answer; say?: string }>;
  dispose(): void;
}

export interface AiResult {
  answer: Answer;
  say?: string;
}

/** Worker answers slower than this are answered in-thread instead (the AI's own budget is at most ~4 s). */
const WORKER_TIMEOUT_MS = 20000;
/** A timer firing this much later than scheduled means the page was frozen (e.g. a backgrounded tab). */
const FREEZE_SLACK_MS = 2000;
/** After a freeze, give the worker this long to deliver an answer it probably already has. */
const FREEZE_GRACE_MS = 3000;
/** Consecutive worker timeouts before giving up on workers for this game. */
const MAX_TIMEOUTS = 2;

interface Pending {
  resolve: (r: AiResult) => void;
  reject: (e: unknown) => void;
  view: GameState;
  decision: Decision;
  timer: ReturnType<typeof setTimeout> | null;
  worker: Worker;
}

/** The view the AI may see of `state`: redacted for `side` unless it already is (a view keeps its `unseen` pools). */
export function viewOf(state: GameState, side: Side): GameState {
  return state.unseen ? state : redact(state, side);
}

export interface AiOpponentOptions {
  side: Side;
  level: AiLevel;
  timeBudgetMs?: number;
  seed?: number;
  /** false: never start a Web Worker (tests, scripts). Default: use one when the platform has Workers. */
  worker?: boolean;
}

export class AiOpponent implements Opponent {
  readonly opts: AiOptions;
  private readonly useWorker: boolean;
  private worker: Worker | null = null;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private readonly gameId: string;
  /** Memory for in-thread decisions (made with the first of them). */
  private mem: AiMemory | null = null;
  private disposed = false;
  private timeouts = 0;
  private workersFailed = false;
  /** Every message posted to the worker (tests read it: Review Focus 3). */
  readonly posted: WorkerRequest[] = [];
  private readonly keepPosted: boolean;

  constructor(o: AiOpponentOptions & { keepPosted?: boolean }) {
    this.opts = { side: o.side, level: o.level, timeBudgetMs: o.timeBudgetMs, seed: o.seed };
    this.useWorker = o.worker !== false;
    this.keepPosted = !!o.keepPosted;
    this.gameId = `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    if (this.useWorker) this.spawnWorker();
  }

  /** True while decisions run in a Web Worker (false after a fallback). */
  get usingWorker(): boolean {
    return !!this.worker;
  }

  /** The AI's memory for in-thread decisions (diagnostics; null before the first). */
  get memory(): AiMemory | null {
    return this.mem;
  }

  decide(state: GameState, decision: Decision): Promise<AiResult> {
    if (this.disposed) return Promise.reject(new Error('AiOpponent disposed'));
    const view = viewOf(state, this.opts.side);
    const worker = this.worker;
    if (!worker) return this.inline(view, decision);
    const id = this.nextId++;
    return new Promise<AiResult>((resolve, reject) => {
      const p: Pending = { resolve, reject, view, decision, timer: null, worker };
      this.pending.set(id, p);
      this.arm(id, p, WORKER_TIMEOUT_MS);
      const msg: WorkerRequest = { id, type: 'decide', gameId: this.gameId, view, decision, opts: this.opts };
      if (this.keepPosted) this.posted.push(msg);
      try {
        worker.postMessage(msg);
      } catch {
        this.settleInline(id);
        this.failWorker();
      }
    });
  }

  dispose(): void {
    this.disposed = true;
    if (this.worker) {
      try {
        this.worker.postMessage({ type: 'reset', gameId: this.gameId });
      } catch {
        // ignore
      }
      this.worker.terminate();
      this.worker = null;
    }
    for (const [, p] of this.pending) {
      if (p.timer) clearTimeout(p.timer);
      p.reject(new Error('AiOpponent disposed'));
    }
    this.pending.clear();
  }

  private spawnWorker(): void {
    if (this.workersFailed || this.disposed) return;
    try {
      if (typeof Worker === 'undefined') return;
      const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (ev: MessageEvent<WorkerResponse>) => this.onMessage(ev.data);
      w.onerror = (ev) => {
        ev.preventDefault?.();
        if (this.worker === w) this.failWorker();
      };
      w.onmessageerror = () => {
        if (this.worker === w) this.failWorker();
      };
      this.worker = w;
    } catch {
      this.worker = null;
    }
  }

  /** Time out a request; a timer that fires very late (frozen page) gets a short grace period instead. */
  private arm(id: number, p: Pending, ms: number): void {
    const due = Date.now() + ms;
    p.timer = setTimeout(() => {
      if (!this.pending.has(id)) return;
      if (Date.now() - due > FREEZE_SLACK_MS) {
        this.arm(id, p, FREEZE_GRACE_MS);
        return;
      }
      this.onTimeout(id, p);
    }, ms);
  }

  private onTimeout(id: number, p: Pending): void {
    // answer in-thread (the request is not re-posted); replace the stuck worker for later decisions
    this.settleInline(id);
    this.timeouts++;
    if (this.worker === p.worker) {
      const stuck = this.worker;
      this.worker = null;
      stuck.terminate();
      for (const [pid, q] of [...this.pending]) if (q.worker === stuck) this.settleInline(pid);
      if (this.timeouts >= MAX_TIMEOUTS) this.workersFailed = true;
      else this.spawnWorker();
    }
  }

  private onMessage(m: WorkerResponse): void {
    const p = this.pending.get(m.id);
    if (!p) return;
    this.pending.delete(m.id);
    if (p.timer) clearTimeout(p.timer);
    if (this.disposed) return;
    if ('error' in m) {
      this.inline(p.view, p.decision).then(p.resolve, p.reject);
      return;
    }
    this.timeouts = 0;
    p.resolve(m.say ? { answer: m.answer, say: m.say } : { answer: m.answer });
  }

  /** Answer a pending request in-thread instead of waiting for its worker. */
  private settleInline(id: number): void {
    const p = this.pending.get(id);
    if (!p) return;
    this.pending.delete(id);
    if (p.timer) clearTimeout(p.timer);
    if (this.disposed) return;
    this.inline(p.view, p.decision).then(p.resolve, p.reject);
  }

  private failWorker(): void {
    this.workersFailed = true;
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const id of [...this.pending.keys()]) this.settleInline(id);
  }

  private async inline(view: GameState, decision: Decision): Promise<AiResult> {
    const { chooseAnswer, newMemory } = await import('./index');
    await new Promise((r) => setTimeout(r, 0));
    if (this.disposed) throw new Error('AiOpponent disposed');
    this.mem ??= newMemory(this.opts.seed);
    return chooseAnswer(view, decision, this.opts, this.mem);
  }
}
