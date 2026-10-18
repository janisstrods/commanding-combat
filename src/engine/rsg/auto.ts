// The RSG's heuristic choices: rsgAuto, the AI's default (and "surprise me") until Task 12 refines it.
import { COUNTERS, RSG } from '../data';
import type { ObSize } from '../rsgTypes';
import type { CounterType, Nation, Posture, Side } from '../types';
import { PLAYER, fortError, holdings, nationOf, rsgLeaderIndex, supportError } from './tables';
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

/** What a side's force has, for judging what to buy. */
interface ForceMix {
  squads: number;
  leaders: number;
  mgs: number;
  /** Mortars and guns. */
  heavy: number;
  /** Flamethrowers and Satchel Charges. */
  assault: number;
}

function addToMix(m: ForceMix, pieces: Record<string, number>): void {
  for (const [t, n] of Object.entries(pieces)) {
    const c = COUNTERS[t];
    if (!c) continue;
    if (c.kind === 'squad') m.squads += n;
    else if (c.kind === 'leader') m.leaders += n;
    else if (c.weaponClass === 'mg') m.mgs += n;
    else if (c.weaponClass === 'mortar' || c.weaponClass === 'gun') m.heavy += n;
    else if (c.weaponClass === 'flamethrower' || c.weaponClass === 'satchel') m.assault += n;
  }
}

/** The posture `side` can expect after buying: as fixed, else Defender (he buys because he leads, and keeps a lead). */
function expectedPosture(d: RsgDraft, side: Side): Posture {
  const f = d.fixed.defender;
  if (f === undefined) return 'defend';
  return f === null ? 'recon' : f === side ? 'defend' : 'attack';
}

const BY_POSTURE = (p: Posture, defend: number, recon: number, attack: number) => (p === 'defend' ? defend : p === 'recon' ? recon : attack);

/** How well item `o` suits a force like `m` in posture `p` (1 = no preference). */
function fit(o: RsgSupportOption, m: ForceMix, p: Posture, nation: Nation): number {
  if (o.kind === 'leader' || o.kind === 'leaderEither') {
    // every OB comes at the Playbook ratio; a Leader is still worth more than his points until the force is over-led
    const per = m.leaders ? m.squads / m.leaders : Infinity;
    return per > SQUADS_PER_LEADER[nation] ? 1.6 : per === SQUADS_PER_LEADER[nation] ? 1.35 : 0.6;
  }
  if (o.weapon) {
    const cls = COUNTERS[o.weapon]?.weaponClass;
    if (cls === 'mg') return BY_POSTURE(p, 1.5, 1.25, 1.05) * (m.mgs * 3 < m.squads ? 1.15 : 0.75);
    if (cls === 'mortar' || cls === 'gun') return BY_POSTURE(p, 1.25, 1.1, 1) * (m.heavy < 2 ? 1 : 0.6);
    return BY_POSTURE(p, 0.85, 1.1, 1.35) * (m.assault < 2 ? 1 : 0.7);
  }
  const c = COUNTERS[Object.keys(o.pieces)[0]];
  if (!c) return 1;
  // a Defender wants reach, an Attacker assault troops (boxed FP or fast)
  return BY_POSTURE(p, c.front.range >= 5 ? 1.1 : 0.95, 1.05, c.front.boxed.fp || c.front.move >= 5 ? 1.15 : 1);
}

/** Value factor of the n-th copy of one item in a purchase (n = 0, 1, 2); no 4th copy. */
const COPY_FACTOR = [1, 0.7, 0.45];
const MAX_ITEMS = 6;
/** Below this adjusted value per VP a further purchase adds too little (a Line Squad is about 1). */
const STOP_BELOW = 0.72;

/**
 * Support purchases: the best item for its VP, judged by its design value (Playbook p. 34), how it suits the force and
 * the expected posture (Leaders when short of them; MG teams, mortars and guns to defend; assault troops and weapons to
 * attack), with fewer points for each further copy (at most 3) and for each further purchase. The first buy may take
 * up to half the lead; the rest come out of a budget of 40–65 % of it, and buying stops when the next item adds little.
 */
function autoSupport(d: RsgDraft, st: Extract<RsgChoiceStep, { what: 'supportBuy' }>, rnd: () => number): RsgChoice {
  if (!st.options.length) return { what: 'supportBuy', buy: [] };
  const nation = nationOf(d, st.side);
  const posture = expectedPosture(d, st.side);
  const mix: ForceMix = { squads: 0, leaders: 0, mgs: 0, heavy: 0, assault: 0 };
  addToMix(mix, holdings(d, st.side));
  const jitter = new Map(st.options.map((o) => [o.id, 0.9 + 0.2 * rnd()]));
  const budget = Math.floor(st.lead * (0.4 + 0.25 * rnd()));
  const buy: string[] = [];
  const legal = (o: RsgSupportOption) => supportError(st.options, st.lead, [...buy, o.id], st.room) === null;
  const score = (o: RsgSupportOption) => {
    const n = buy.filter((id) => id === o.id).length;
    if (n >= COPY_FACTOR.length) return 0;
    const value = piecesValue(o.pieces) / (o.vp * 100);
    return value * fit(o, mix, posture, nation) * COPY_FACTOR[n] * (1 - 0.05 * Math.max(0, buy.length - 1)) * jitter.get(o.id)!;
  };
  let spent = 0;
  for (let k = 0; k < MAX_ITEMS; k++) {
    const room = k === 0 ? Math.max(budget, Math.floor(st.lead / 2)) : budget - spent;
    let best: RsgSupportOption | null = null;
    let top = 0;
    for (const o of st.options) {
      if (o.vp > room || !legal(o)) continue;
      const s = score(o);
      if (s > top) [best, top] = [o, s];
    }
    if (!best || (k > 0 && top < STOP_BELOW)) break;
    buy.push(best.id);
    spent += best.vp;
    addToMix(mix, best.pieces);
  }
  if (!buy.length) {
    // he must buy one: the cheapest, the better one on a tie
    const o = [...st.options].sort((a, b) => a.vp - b.vp || score(b) - score(a))[0];
    buy.push(o.id);
  }
  return { what: 'supportBuy', buy };
}

function autoForts(st: Extract<RsgChoiceStep, { what: 'fortifications' }>, rnd: () => number): RsgChoice {
  const prefs = ['strongpoint', 'entrenchments', 'barbed_wire', 'trench_line', 'hasty_minefield', 'entrenchments', 'strongpoint'];
  const target = Math.floor(st.budget * (0.2 + 0.3 * rnd()));
  const buy: string[] = [];
  let spent = 0;
  for (const id of prefs) {
    const f = st.options.find((o) => o.id === id);
    if (f && spent + f.vp <= target && !fortError(st.budget, [...buy, id])) {
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
  if (st.kind !== 'choice' || st.side !== side) throw new Error(`The RSG does not wait for a choice by ${PLAYER[side]}.`);
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
