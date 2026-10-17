// Deterministic RNG (mulberry32), state in GameState.rng so games replay exactly. During play it only shuffles (Fate
// decks at a Time advance, the chit and smoke cups); every "roll" is a Fate-card reveal (deck.ts). Pre-game tables (RSG,
// Leader Table) may use it directly (R-39).

/** Advance the generator stored in `s` and return a float in [0, 1). */
export function random(s: { rng: number; rngCalls: number }): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  s.rngCalls++;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A whole number in [0, n). */
export function randInt(s: { rng: number; rngCalls: number }, n: number): number {
  return Math.floor(random(s) * n);
}

/** Shuffle `arr` in place (Fisher-Yates) and return it. */
export function shuffle<T>(s: { rng: number; rngCalls: number }, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(s, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Make a fresh seed from Math.random (for new games and AI simulations, never inside the engine). */
export function freshSeed(): number {
  return (Math.random() * 4294967296) >>> 0;
}
