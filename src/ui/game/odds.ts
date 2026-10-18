// Chances for the fire preview. Every Fate deck holds each ordered pair of dice exactly twice, so a roll is distributed
// like two six-sided dice (sum) and a Targeting roll like their product.

/** P(sum = k) for k = 0..12. */
export const SUM_P: readonly number[] = (() => {
  const p = Array<number>(13).fill(0);
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) p[a + b] += 1 / 36;
  return p;
})();

/** P(sum ≥ k). */
export function pAtLeast(k: number): number {
  let t = 0;
  for (let v = Math.max(2, k); v <= 12; v++) t += SUM_P[v];
  return Math.min(1, t);
}

/**
 * A Fire Attack of `fp` against a unit of total Morale `morale` (Cover included): the chance it breaks (attack total
 * higher than the Defense total) and the chance of a tie (suppressed, or broken if it is moving).
 */
export function attackOdds(fp: number, morale: number): { breaks: number; ties: number } {
  let breaks = 0;
  let ties = 0;
  for (let a = 2; a <= 12; a++) {
    for (let d = 2; d <= 12; d++) {
      const p = SUM_P[a] * SUM_P[d];
      const atk = fp + a;
      const def = morale + d;
      if (atk > def) breaks += p;
      else if (atk === def) ties += p;
    }
  }
  return { breaks, ties };
}

/** The chance a Targeting roll hits: white × red − hindrance > range. */
export function targetingChance(range: number, hindrance: number): number {
  let n = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a * b - hindrance > range) n++;
  return n / 36;
}

export function pct(p: number): string {
  if (p <= 0) return '0%';
  if (p >= 1) return '100%';
  const v = Math.round(p * 100);
  return v === 0 ? '<1%' : v === 100 ? '>99%' : `${v}%`;
}
