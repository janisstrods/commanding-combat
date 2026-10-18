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

/** P(white × red = k) for k = 0..36. */
export const PRODUCT_P: readonly number[] = (() => {
  const p = Array<number>(37).fill(0);
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) p[a * b] += 1 / 36;
  return p;
})();

/** The average of `f` over a roll distributed as `dist` (SUM_P or PRODUCT_P). */
export function expected(dist: readonly number[], f: (v: number) => number): number {
  let t = 0;
  for (let v = 0; v < dist.length; v++) if (dist[v]) t += dist[v] * f(v);
  return t;
}

/**
 * A Defense result (§O20.3.4) for the defender: Defense total above the attack total holds (1), equal is Suppressed
 * (½; a unit activated to Move breaks), lower breaks (0).
 */
export function held(total: number, attack: number, moving = false): number {
  return total > attack ? 1 : total === attack && !moving ? 0.5 : 0;
}

/** The defender's average result (see `held`) with Morale + Cover `base` against `attack`, over its Defense roll. */
export function holdChance(base: number, attack: number, moving = false): number {
  return expected(SUM_P, (x) => held(base + x, attack, moving));
}

/** The Defense roll a unit with Morale + Cover `base` must reach to hold against `attack` (a roll one lower ties). */
export function holdNeed(base: number, attack: number): number {
  return attack - base + 1;
}

/** "Needs 8+ to hold (7: Suppressed)", "Holds on any roll", "Breaks on any roll" (for the start of a line). */
export function needPhrase(base: number, attack: number, moving = false): string {
  const t = needText(base, attack, moving);
  return /^\d/.test(t) ? `Needs ${t}` : t.charAt(0).toUpperCase() + t.slice(1);
}

/** "8+ to hold (7: Suppressed)", "holds on any roll", "breaks on any roll". */
export function needText(base: number, attack: number, moving = false): string {
  const need = holdNeed(base, attack);
  const tie = moving ? 'breaks' : 'Suppressed';
  if (need <= 2) return 'holds on any roll';
  if (need <= 12) return `${need}+ to hold (${need - 1}: ${tie})`;
  if (need === 13 && !moving) return 'cannot hold (12: Suppressed)';
  return 'breaks on any roll';
}
