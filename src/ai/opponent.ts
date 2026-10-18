// The entry the battle screen loads lazily (src/ui/game/makeOpponent.ts): `createOpponent({ side, level })` gives the
// AI as an Opponent (client.ts AiOpponent: a Web Worker with an in-thread fallback).
import type { Side } from '../engine/types';
import type { Opponent as ScreenOpponent } from '../ui/game/opponent';
import { AiOpponent } from './client';
import type { AiLevel } from './levels';

export function createOpponent(opts: { side: Side; level: AiLevel }): ScreenOpponent {
  return new AiOpponent(opts);
}
