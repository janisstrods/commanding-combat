// Effort-mode calibration (ai-players.ts `effortSims`): simulations per second of each player's own-Turn search, per
// scenario, on a quiet machine. In effort mode a search gets budget × rate × effort simulations instead of its time
// budget, so match results do not depend on the machine's load and repeat for a seed.
//
// Measured 2026-10-18 with scripts/ai-probe.ts (v1-green, v1-line, v1-elite at their real budgets on the 31 fixed
// positions of scenarios 1–12 without 7; median of the positions per scenario; load average 4–6 on the 8-core M3, before
// the other sessions' jobs). The current levels' simulations are the same work as v1's — Line one Order, Elite the rest
// of the Turn and the reply (`ai-probe.ts --calibrate --players v1-line,line,v1-elite,elite` compares them side by side
// under any load) — so they share the rates. Re-measure after a change that makes a simulation cheaper or dearer.
const V1_GREEN: Record<string, number> = { 1: 417, 2: 200, 3: 571, 4: 208, 5: 194, 6: 118, 8: 176, 9: 167, 10: 1182, 11: 1000, 12: 75 };
const V1_LINE: Record<string, number> = { 1: 740, 2: 259, 3: 624, 4: 310, 5: 457, 6: 553, 8: 505, 9: 315, 10: 1038, 11: 992, 12: 85 };
const V1_ELITE: Record<string, number> = { 1: 410, 2: 204, 3: 426, 4: 160, 5: 152, 6: 212, 8: 411, 9: 160, 10: 460, 11: 320, 12: 39 };

export const SIMS_PER_SEC: Record<string, Record<string, number>> = {
  'v1-green': V1_GREEN,
  'v1-line': V1_LINE,
  'v1-elite': V1_ELITE,
  green: V1_GREEN,
  line: V1_LINE,
  elite: V1_ELITE,
};
