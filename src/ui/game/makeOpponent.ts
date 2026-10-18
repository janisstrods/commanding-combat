// The computer opponent of a session: the AI (Task 12) when src/ai/opponent.ts exists and exports
// `createOpponent({ side, level })`, else the random stand-in. The AI module loads lazily on the first decision.
import type { Answer, Decision, GameState, Side } from '../../engine/types';
import type { AiLevel } from '../routes';
import { RandomOpponent, type Opponent } from './opponent';

type AiModule = { createOpponent?: (opts: { side: Side; level: AiLevel }) => Opponent | Promise<Opponent> };

const AI_MODULE = import.meta.glob('../../ai/opponent.ts');

/** An opponent created on first use (the AI and its worker load only when the battle needs them). */
class LazyOpponent implements Opponent {
  private inner: Promise<Opponent> | null = null;
  private disposed = false;
  constructor(private readonly make: () => Promise<Opponent>) {}
  private get(): Promise<Opponent> {
    this.inner ??= this.make().catch((e) => {
      console.error('The AI could not be loaded; the opponent plays at random.', e);
      return new RandomOpponent();
    });
    return this.inner;
  }
  async decide(view: GameState, d: Decision): Promise<{ answer: Answer; say?: string }> {
    const o = await this.get();
    if (this.disposed) throw new Error('disposed');
    return o.decide(view, d);
  }
  dispose(): void {
    this.disposed = true;
    if (this.inner) void this.inner.then((o) => o.dispose());
  }
}

export function makeOpponent(side: Side, level: AiLevel): Opponent {
  const load = AI_MODULE['../../ai/opponent.ts'];
  if (!load) return new RandomOpponent();
  return new LazyOpponent(async () => {
    const m = (await load()) as AiModule;
    if (!m.createOpponent) return new RandomOpponent();
    return m.createOpponent({ side, level });
  });
}
