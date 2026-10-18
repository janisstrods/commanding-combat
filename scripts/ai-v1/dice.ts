// Dice odds. Every roll is a Fate card, and each deck holds every ordered pair of dice (white, red) exactly twice
// (data validation, Task 3), so a reveal from an unknown pile is two fair, independent d6 — the AI's odds are exact
// for that, and treat the attacker's and the defender's decks as independent.

/** P(2d6 = n), n = 0..12. */
export const SUM: readonly number[] = (() => {
  const p = Array<number>(13).fill(0);
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) p[a + b] += 1 / 36;
  return p;
})();

/** P(2d6 < n). */
export function pSumBelow(n: number): number {
  let t = 0;
  for (let i = 2; i <= 12 && i < n; i++) t += SUM[i];
  return t;
}

/** P(2d6 ≥ n). */
export function pSumAtLeast(n: number): number {
  return 1 - pSumBelow(n);
}

/** P(Y − X = d) for independent 2d6 X, Y, index d + 10 (d = −10..10). */
const DIFF: readonly number[] = (() => {
  const p = Array<number>(21).fill(0);
  for (let x = 2; x <= 12; x++) for (let y = 2; y <= 12; y++) p[y - x + 10] += SUM[x] * SUM[y];
  return p;
})();

/** Cumulative: P(Y − X < d), index d + 10 (d = −10..11). */
const DIFF_BELOW: readonly number[] = (() => {
  const c = Array<number>(22).fill(0);
  for (let i = 1; i < 22; i++) c[i] = c[i - 1] + DIFF[i - 1];
  return c;
})();

/**
 * A Fire Attack of `fp` (Attack Total fp + 2d6) against a unit defending with `morale` (Morale + Cover, Defense Total
 * morale + 2d6): P(it breaks) and P(a tie: Suppressed, or broken if it is moving), §O20.3.4.
 */
export function defenseOdds(fp: number, morale: number): { brk: number; tie: number } {
  const k = fp - morale; // break iff Y − X < k
  const below = k <= -10 ? 0 : k >= 11 ? 1 : DIFF_BELOW[k + 10];
  const tie = k < -10 || k > 10 ? 0 : DIFF[k + 10];
  return { brk: below, tie };
}

/** P(the higher of two totals a + 2d6 against b + 2d6 is a's), with ties counted half (melee odds, §O16.4). */
export function contestOdds(a: number, b: number): { win: number; tie: number; lose: number } {
  // a + X > b + Y  ⇔  Y − X < a − b
  const k = a - b;
  const win = k <= -10 ? 0 : k >= 11 ? 1 : DIFF_BELOW[k + 10];
  const tie = k < -10 || k > 10 ? 0 : DIFF[k + 10];
  return { win, tie, lose: Math.max(0, 1 - win - tie) };
}

/** P(white × red > n) for two d6 (Ordnance Targeting: product − Hindrance > range, §O20.2). */
export function pProductAbove(n: number): number {
  let t = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a * b > n) t += 1 / 36;
  return t;
}
