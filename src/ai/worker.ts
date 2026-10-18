/// <reference lib="webworker" />
// Web Worker entry for the AI (module worker). It receives only what the client sends: the redacted view of the AI's
// side and the decision (client.ts makes sure of the redaction before posting).
// In:  { id, type: 'decide', gameId, view, decision, opts }  ->  Out: { id, answer, say } or { id, error }
// In:  { type: 'reset', gameId }                              (drops that game's memory)
import type { Answer, Decision, GameState } from '../engine/types';
import { chooseAnswer, newMemory, type AiMemory, type AiOptions } from './index';

export interface DecideRequest {
  id: number;
  type: 'decide';
  gameId: string;
  view: GameState;
  decision: Decision;
  opts: AiOptions;
}

export interface ResetRequest {
  type: 'reset';
  gameId: string;
}

export type WorkerRequest = DecideRequest | ResetRequest;

export type WorkerResponse = { id: number; answer: Answer; say?: string } | { id: number; error: string };

/** One memory per game and side (a page may run two AI players). */
const memories = new Map<string, AiMemory>();

/** Handle one message (exported for tests; the worker calls it for every message it gets). */
export function handle(m: WorkerRequest, post: (r: WorkerResponse) => void): void {
  if (!m || typeof m !== 'object') return;
  if (m.type === 'reset') {
    for (const key of [...memories.keys()]) if (key.startsWith(`${m.gameId}:`)) memories.delete(key);
    return;
  }
  if (m.type !== 'decide') return;
  const key = `${m.gameId}:${m.opts.side}`;
  let mem = memories.get(key);
  if (!mem) {
    mem = newMemory(m.opts.seed);
    memories.set(key, mem);
  }
  try {
    const r = chooseAnswer(m.view, m.decision, m.opts, mem);
    post({ id: m.id, answer: r.answer, ...(r.say ? { say: r.say } : {}) });
  } catch (e) {
    post({ id: m.id, error: e instanceof Error ? e.message : String(e) });
  }
}

declare const WorkerGlobalScope: { new (): unknown } | undefined;
const inWorker = typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof (WorkerGlobalScope as never);
if (inWorker) {
  const scope = self as unknown as DedicatedWorkerGlobalScope;
  scope.onmessage = (ev: MessageEvent<WorkerRequest>) => handle(ev.data, (r) => scope.postMessage(r));
}
