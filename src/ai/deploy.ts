// Deployment ("deploy for me" for the human uses the same code): where each staged piece goes in the set-up area, by
// posture. Each hex is scored for Cover, fields of fire over the ground the enemy must cross (his set-up area or his
// units, and the Objectives), the Objectives by posture (defenders on and around them, attackers forward toward them),
// and known enemy fire; Squads spread over the best hexes (with a bonus for neighbours that can form Fire Groups and
// for covering several Objectives), Teams fill in, Leaders join the cluster their Command reaches best, MGs go to Squads
// stacked with Leaders (Leader Command adds to a Weapon's FP), Mortars to the rear with long sight lines.
import { areaHexes } from '../engine/data';
import { answerError } from '../engine/decisions';
import { distance } from '../engine/hex';
import { losCheck } from '../engine/los';
import { setupHexes } from '../engine/setup';
import { figures, hexCover, stackLimit, unitFigures } from '../engine/stats';
import { cloneState, isLeader, isUnit, isWeapon, typeOf } from '../engine/state';
import { isWaterHex } from '../engine/terrain';
import { type Answer, type Decision, type GameState, type HexId, type Piece, type PieceId, type Side, other } from '../engine/types';
import { chitValue } from '../engine/objectives';
import { fireOn, sideShooters, unitsAt } from './tactics';
import { typeValue } from './values';

export interface Placement {
  piece: PieceId;
  hex: HexId;
  /** For a Weapon: the unit in `hex` that takes it. */
  carrier?: PieceId;
}

/** The deployment plan the AI is carrying out (kept between its 'deploy' answers). */
export interface DeployMemo {
  key: string;
  plan: Placement[];
}

/** Where the enemy is, or will be: his units on the map, else his set-up area (else the middle of the map). */
function enemyGround(s: GameState, side: Side): HexId[] {
  const opp = other(side);
  const on = new Set<HexId>();
  for (const id in s.pieces) {
    const p = s.pieces[id];
    if (p.side === opp && p.where === 'map' && isUnit(p)) on.add(p.hex);
  }
  if (on.size) return [...on];
  const def = s.scenario.sides[opp];
  if (def.setupArea.kind !== 'anyFree') return areaHexes(def.setupArea, def.edge);
  return s.map.terrain.map((_, h) => h).filter((h) => (h % 10) >= 3 && (h % 10) <= 6);
}

/** 0..1: nearness of `h` to `edge`. */
function edgeNear(h: HexId, edge: string): number {
  const k = Math.floor(h / 10);
  const n = (h % 10) + 1;
  const d = edge === 'top' ? n - 1 : edge === 'bottom' ? 10 - n : edge === 'left' ? k : 14 - k;
  return 1 - d / (edge === 'left' || edge === 'right' ? 14 : 9);
}

interface HexInfo {
  hex: HexId;
  cover: number;
  fire: number;
  obj: number[];
  forward: number;
  exposure: number;
  water: boolean;
}

function hexInfo(s: GameState, side: Side, area: HexId[]): Map<HexId, HexInfo> {
  const ground = enemyGround(s, side);
  const targets = [...new Set([...ground, ...s.map.objectives])];
  const enemyEdge = s.players[other(side)].edge;
  const shooters = sideShooters(s, other(side));
  const out = new Map<HexId, HexInfo>();
  for (const h of area) {
    let fire = 0;
    for (const t of targets) {
      const d = distance(h, t);
      if (d === 0 || d > 7) continue;
      if (losCheck(s, h, t).clear) fire += 1 / (1 + 0.2 * d);
    }
    const obj = s.map.objectives.map((o) => distance(h, o));
    out.set(h, {
      hex: h, cover: hexCover(s, h), fire, obj, forward: edgeNear(h, enemyEdge),
      exposure: shooters.length ? fireOn(s, shooters, h).fp : 0, water: isWaterHex(s.map, h),
    });
  }
  return out;
}

function objectiveWorth(s: GameState, side: Side, n: number): number {
  let v = 1;
  for (const c of s.openChits) v += chitValue(c, n + 1);
  for (const c of s.players[side].secretChits) v += chitValue(c, n + 1);
  return v;
}

/** The score of hex `h` for a unit of `side`; `cover[n]`: how many units already watch objective n. */
function unitScore(s: GameState, side: Side, info: HexInfo, watch: number[], kind: string): number {
  const posture = s.players[side].posture;
  let sc = 0.55 * info.cover + 0.35 * Math.min(info.fire, 6) - 0.2 * info.exposure;
  info.obj.forEach((d, n) => {
    const v = objectiveWorth(s, side, n) / (1 + watch[n]);
    if (posture === 'defend') sc += v * (d === 0 ? 2.2 : d === 1 ? 1.2 : d === 2 ? 0.5 : 0);
    else sc += v * Math.max(0, 1 - d / 7) * (posture === 'attack' ? 0.9 : 0.7);
  });
  if (posture === 'attack') sc += 1.2 * info.forward;
  else if (posture === 'recon') sc += 0.6 * info.forward;
  if (info.water && kind !== 'leader') sc -= 0.8;
  return sc;
}

/**
 * A full deployment for `side`'s staged pieces (`pieces`: only these) in `hexes` (default: its set-up hexes), as a list
 * of placements in the order to make them. Works on a copy: `s` is not changed.
 */
export function planDeployment(s: GameState, side: Side, hexes?: HexId[], pieces?: PieceId[]): Placement[] {
  const work = cloneState(s);
  const area = (hexes ?? setupHexes(work, side)).slice();
  if (!area.length) return [];
  const staged = Object.values(work.pieces).filter((p) => p.side === side && (pieces ? pieces.includes(p.id) : p.where === 'staging'));
  const info = hexInfo(work, side, area);
  const watch = s.map.objectives.map(() => 0);
  const out: Placement[] = [];
  const fits = (h: HexId, p: Piece) => figures(work, h, side) + unitFigures(p) <= stackLimit(work, h);
  const put = (p: Piece, h: HexId) => {
    p.where = 'map';
    p.hex = h;
    out.push({ piece: p.id, hex: h });
    info.get(h)!.obj.forEach((d, n) => {
      if (d <= 1) watch[n]++;
    });
  };
  const byValue = (a: Piece, b: Piece) => typeValue(typeOf(b)) - typeValue(typeOf(a));
  const units = staged.filter((p) => isUnit(p));
  const squads = units.filter((p) => typeOf(p).kind === 'squad').sort(byValue);
  const teams = units.filter((p) => typeOf(p).kind === 'team').sort(byValue);
  const leaders = units.filter((p) => isLeader(p)).sort((a, b) => typeOf(b).front.command - typeOf(a).front.command);
  const weapons = staged.filter((p) => isWeapon(p)).sort((a, b) => typeValue(typeOf(b)) - typeValue(typeOf(a)));

  const placeUnit = (p: Piece) => {
    let best = -1;
    let bv = -Infinity;
    for (const h of area) {
      if (!fits(h, p)) continue;
      const i = info.get(h)!;
      let sc = unitScore(work, side, i, watch, typeOf(p).kind);
      // neighbours for Fire Groups, but not one big target
      let adj = 0;
      let same = 0;
      for (const q of Object.values(work.pieces)) {
        if (q.side !== side || q.where !== 'map' || !isUnit(q) || isLeader(q)) continue;
        const d = distance(q.hex, h);
        if (d === 1) adj++;
        if (d === 0) same++;
      }
      sc += 0.25 * Math.min(2, adj) - 0.6 * same;
      if (sc > bv) {
        bv = sc;
        best = h;
      }
    }
    if (best >= 0) put(p, best);
  };
  for (const p of squads) placeUnit(p);
  for (const p of teams) placeUnit(p);
  for (const l of leaders) {
    const cmd = Math.max(1, typeOf(l).front.command);
    let best = -1;
    let bv = -Infinity;
    for (const h of area) {
      if (!fits(h, l)) continue;
      let sc = 0.2 * info.get(h)!.cover;
      let here = 0;
      for (const q of Object.values(work.pieces)) {
        if (q.side !== side || q.where !== 'map' || !isUnit(q)) continue;
        const d = distance(q.hex, h);
        if (isLeader(q)) {
          if (d <= 1) sc -= 0.8; // spread the Leaders
          continue;
        }
        if (d <= cmd) sc += typeOf(q).kind === 'squad' ? 1 : 0.6;
        if (d === 0 && typeOf(q).kind === 'squad') here++;
      }
      if (here) sc += 1.2;
      if (sc > bv) {
        bv = sc;
        best = h;
      }
    }
    if (best >= 0) put(l, best);
  }
  // Weapons: MGs and others to Squads with Leaders (best fields of fire), then Squads, Teams, Leaders; Mortars rearward
  for (const w of weapons) {
    const t = typeOf(w);
    let best: Piece | null = null;
    let bv = -Infinity;
    for (const u of Object.values(work.pieces)) {
      if (u.side !== side || u.where !== 'map' || !isUnit(u) || u.weapon || !area.includes(u.hex)) continue;
      const i = info.get(u.hex);
      if (!i) continue;
      const k = typeOf(u).kind;
      let sc = k === 'squad' ? 2 : k === 'team' ? 1.5 : 0.3;
      if (t.weaponClass === 'mortar') sc += 1.5 * (1 - i.forward) + 0.1 * i.fire;
      else sc += 0.3 * Math.min(i.fire, 6) + (unitsAt(work, u.hex, side).some((x) => isLeader(x)) ? 1.5 : 0);
      if (i.water) sc -= 5;
      if (sc > bv) {
        bv = sc;
        best = u;
      }
    }
    if (best) {
      out.push({ piece: w.id, hex: best.hex, carrier: best.id });
      best.weapon = w.id;
      w.carrier = best.id;
      w.where = 'carried';
    }
  }
  return out;
}

/** The AI's answer to a 'deploy' decision, following (or making) a deployment plan. */
export function deployAnswer(s: GameState, d: Extract<Decision, { kind: 'deploy' }>, pc: { deploy: DeployMemo | null }): Answer {
  const key = `${d.side}:${s.phase}:${s.turn.number}:${s.time}`;
  const try1 = (plan: Placement[]): Answer | null => {
    for (const pl of plan) {
      if (!d.pieces.includes(pl.piece)) continue;
      const a: Answer = { kind: 'deploy', piece: pl.piece, hex: pl.hex, ...(pl.carrier ? { carrier: pl.carrier } : {}) };
      if (!answerError(s, d, a)) return a;
      const b: Answer = { kind: 'deploy', piece: pl.piece, hex: pl.hex };
      if (!answerError(s, d, b)) return b;
    }
    return null;
  };
  if (pc.deploy && pc.deploy.key === key) {
    const a = try1(pc.deploy.plan);
    if (a) return a;
  }
  const plan = planDeployment(s, d.side, d.hexes, d.pieces);
  pc.deploy = { key, plan };
  return try1(plan) ?? { kind: 'done' };
}
