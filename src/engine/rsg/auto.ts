// The RSG's heuristic choices: rsgAuto, the AI's default (and "surprise me") until Task 12 refines it.
import { COUNTERS, RSG } from '../data';
import type { ObSize } from '../rsgTypes';
import type { CounterType, Nation, Side } from '../types';
import { SIDE_NAME, nationOf, obOf, rsgLeaderIndex, supportError } from './tables';
import { rsgStep } from './steps';
import type { RsgChoice, RsgChoiceStep, RsgDraft, RsgSupportOption } from './types';

// ---------------------------------------------------------------------------------------------------------------------
// Heuristic choices (the AI's default until Task 12 refines it)

function leaderClass(c: CounterType): string {
  if (c.hero) return 'Hero';
  if (c.private) return 'Private';
  if (c.rank === 'Cpt') return 'Captain';
  if (c.rank === 'Lt') return `Lieutenant Cmd ${c.front.command}`;
  if (c.rank === 'Sgt') return `Sergeant Cmd ${c.front.command}`;
  return `Corporal Morale ${c.front.morale}`;
}

/** A piece's design value in hundredths of a VP (Playbook p. 34 point values), 0 if unlisted. */
export function rsgPieceValue(type: string): number {
  const c = COUNTERS[type];
  if (!c) return 0;
  const t = RSG.pointValues[c.nation];
  return (c.kind === 'leader' ? t[leaderClass(c)] : t[type]) ?? 0;
}

const piecesValue = (pieces: Record<string, number>) => Object.entries(pieces).reduce((v, [t, n]) => v + n * rsgPieceValue(t), 0);
/** Squads per Leader the Playbook design hints aim for (p. 34). */
const SQUADS_PER_LEADER: Record<Nation, number> = { German: 3, American: 4, Russian: 5 };

function pickWeighted<T>(items: readonly [T, number][], rnd: () => number): T {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let x = rnd() * total;
  for (const [t, w] of items) if ((x -= w) < 0) return t;
  return items[items.length - 1][0];
}

function autoOb(st: Extract<RsgChoiceStep, { what: 'ob' }>, rnd: () => number): RsgChoice {
  const table = RSG.leaderTable[st.nation];
  let leader = 0;
  for (let w = 1; w <= 6; w++) leader += rsgPieceValue(table[rsgLeaderIndex(st.nation, st.year, st.quality, w)]) / 6;
  const size = pickWeighted<ObSize>([['company', 0.4], ['detachment', 0.35], ['platoon', 0.25]], rnd);
  const pool = st.options.filter((o) => o.size === size);
  let best = pool[0] ?? st.options[0];
  let score = -1;
  for (const o of pool.length ? pool : st.options) {
    const s = ((piecesValue(o.units) + o.leaders * leader) / (o.points * 100)) * (0.92 + 0.16 * rnd());
    if (s > score) [best, score] = [o, s];
  }
  return { what: 'ob', letter: best.letter, size: best.size };
}

function autoSupport(d: RsgDraft, st: Extract<RsgChoiceStep, { what: 'supportBuy' }>, rnd: () => number): RsgChoice {
  if (!st.options.length) return { what: 'supportBuy', buy: [] };
  const nation = nationOf(d, st.side);
  const { size } = obOf(d, st.side);
  const squads = Object.entries(size.units).reduce((n, [t, k]) => n + (COUNTERS[t]?.kind === 'squad' ? k : 0), 0);
  const wantLeader = d.leaders[st.side].length * SQUADS_PER_LEADER[nation] < squads;
  const bonus = (o: RsgSupportOption) => {
    if (o.kind === 'leader' || o.kind === 'leaderEither') return wantLeader ? 1.5 : 0.8;
    const cls = o.weapon ? COUNTERS[o.weapon]?.weaponClass : undefined;
    // the buyer leads on VP and so expects to defend: MGs first, then mortars and guns
    return cls === 'mg' ? 1.25 : cls === 'mortar' || cls === 'gun' ? 1.1 : 1;
  };
  const ranked = st.options
    .map((o) => ({ o, s: (piecesValue(o.pieces) / (o.vp * 100)) * bonus(o) * (0.9 + 0.2 * rnd()) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.o);
  const budget = Math.floor(st.lead * (0.3 + 0.4 * rnd()));
  const buy: string[] = [];
  let spent = 0;
  for (let n = 0; n < 20; n++) {
    const o = ranked.find((x) => spent + x.vp <= budget && supportError(st.options, st.lead, [...buy, x.id]) === null);
    if (!o) break;
    buy.push(o.id);
    spent += o.vp;
  }
  if (!buy.length) buy.push([...ranked].sort((a, b) => a.vp - b.vp)[0].id);
  return { what: 'supportBuy', buy };
}

function autoForts(st: Extract<RsgChoiceStep, { what: 'fortifications' }>, rnd: () => number): RsgChoice {
  const prefs = ['strongpoint', 'entrenchments', 'barbed_wire', 'trench_line', 'hasty_minefield', 'entrenchments', 'strongpoint'];
  const target = Math.floor(st.budget * (0.2 + 0.3 * rnd()));
  const buy: string[] = [];
  let spent = 0;
  for (const id of prefs) {
    const f = st.options.find((o) => o.id === id);
    if (f && spent + f.vp <= target) {
      buy.push(id);
      spent += f.vp;
    }
  }
  return { what: 'fortifications', buy };
}

/**
 * A reasonable choice for `side` at the current choice step (cheap heuristics, varied by `rnd`): a random map and edge
 * die; the OB with the best design value for its points in a randomly weighted size; Support items by value for VP
 * (Leaders when short of them, MG teams first), spending about half the lead; a few cheap Fortifications; a Radio
 * request unless the Defender is already far ahead. Throws if the next step is not a choice for `side`.
 */
export function rsgAuto(d: RsgDraft, side: Side, rnd: () => number): RsgChoice {
  const st = rsgStep(d);
  if (st.kind !== 'choice' || st.side !== side) throw new Error(`The RSG does not wait for a choice by the ${SIDE_NAME[side]}.`);
  switch (st.what) {
    case 'mapPick':
      return { what: 'mapPick', map: st.options[Math.floor(rnd() * st.options.length)].map };
    case 'mapEdgeDie':
      return { what: 'mapEdgeDie', die: rnd() < 0.5 ? 'white' : 'coloured' };
    case 'ob':
      return autoOb(st, rnd);
    case 'supportBuy':
      return autoSupport(d, st, rnd);
    case 'fortifications':
      return autoForts(st, rnd);
    case 'assetRequest':
      return { what: 'assetRequest', request: st.defenderLead <= 10 || rnd() < 0.35 };
  }
}
