// Shared plumbing for the test suites (no tests here).

/**
 * mulberry32: a small seeded generator of floats in [0, 1), for random players and scripted bots in tests. Golden fixtures
 * and AI test outcomes depend on its exact sequence, so it must stay bit-identical. (`src/ai/rand.ts` Rng is not a
 * drop-in replacement: it maps seed 0 differently.)
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * lcg: the multiply-add generator of floats in [0, 1) that some rules tests drive random players with. Keep the
 * expression as it is: it is computed in doubles (x * 1103515245 loses low bits once x is large), and the tests' games
 * depend on that exact sequence.
 */
export function lcg(seed: number): () => number {
  let x = seed;
  return () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
}
