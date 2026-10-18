// Generic 'choose' decisions, judged per reason: every item gets a score (its worth to the AI's side), then the AI
// takes the best items it wants (score > 0) up to `max`, and at least `min` (the least bad ones). Unknown reasons fall
// back to a safe rule: hurt enemy pieces, spare own ones, place things where own units are safest.
import { distance, neighbours } from '../engine/hex';
import { losCheck } from '../engine/los';
import { chitValue } from '../engine/objectives';
import { currentStats, hexCover } from '../engine/stats';
import { counterType, isLeader, isUnit, typeOf } from '../engine/state';
import type { ChoiceItem, Decision, GameState, HexId, Piece, Side } from '../engine/types';
import { other } from '../engine/types';
import { cardCtx, keepValue } from './cards';
import { fireOn, sideShooters, stackLoss, suppressCost, unitsAt } from './tactics';
import { breakCost, breakLoss, elimVp, pieceValue, pressureStep, typeValue } from './values';

type ChooseD = Extract<Decision, { kind: 'choose' }>;

const ctxOf = (d: ChooseD) => (d.context ?? {}) as Record<string, unknown>;

/** Worth to `me` of breaking piece `p` (enemy: gain; own: loss, negative). */
function breakScore(s: GameState, me: Side, p: Piece): number {
  const v = breakCost(s, p);
  return p.side === me ? -v : v;
}

/** Worth to `me` of eliminating piece `p` outright. */
function elimScore(s: GameState, me: Side, p: Piece): number {
  const v = isUnit(p) ? pieceValue(s, p) + elimVp(s, p) + pressureStep(s, p.side) : pieceValue(s, p);
  return p.side === me ? -v : v;
}

/** Worth to `me` of rallying broken unit `p`. */
function rallyScore(s: GameState, me: Side, p: Piece): number {
  if (!p.broken) return 0;
  const v = breakLoss(s, { ...p, broken: false });
  return p.side === me ? v : -v;
}

/** How safe a hex is for `side`'s units (cover, little enemy fire, near friends), for placing or retreating. */
export function safety(s: GameState, side: Side, hex: HexId, enemyShooters = sideShooters(s, other(side))): number {
  const f = fireOn(s, enemyShooters, hex);
  let sc = 0.6 * hexCover(s, hex) - 0.25 * f.fp - 2 * f.ordHit;
  if (s.fort[hex] === 'mines') sc -= 3;
  if (s.fort[hex] === 'wire') sc -= 1;
  return sc;
}

/** Worth of an Objective-ish hex for `side` (how near it lies to Objectives that matter). */
function objectivePull(s: GameState, side: Side, hex: HexId): number {
  let v = 0;
  s.map.objectives.forEach((o, i) => {
    const d = distance(o, hex);
    let w = 1;
    for (const c of s.players[side].secretChits) w += chitValue(c, i + 1);
    v += w * Math.max(0, 1 - d / 6);
  });
  return v;
}

/** Worth of a counter-type list (a Support Table item): units and Weapons, a Radio. */
function itemWorth(types: unknown): number {
  if (!Array.isArray(types)) return 0;
  let v = 0;
  for (const t of types) {
    try {
      v += typeValue(counterType(String(t)));
    } catch {
      // unknown type: no worth
    }
  }
  return v;
}

const piece = (s: GameState, it: ChoiceItem): Piece | null => ('piece' in it ? s.pieces[it.piece] ?? null : null);
const hexOfItem = (it: ChoiceItem): HexId | null => ('hex' in it ? it.hex : null);

/** Scores for each item of `d`, from `me`'s point of view. */
export function itemScores(s: GameState, d: ChooseD, me: Side): number[] {
  const c = ctxOf(d);
  const opp = other(me);
  const items = d.items;
  const per = (f: (it: ChoiceItem, i: number) => number) => items.map((it, i) => f(it, i));
  const byPiece = (f: (p: Piece) => number, none = 0) => per((it) => {
    const p = piece(s, it);
    return p ? f(p) : none;
  });
  const byHex = (f: (h: HexId) => number) => per((it) => {
    const h = hexOfItem(it);
    return h === null ? 0 : f(h);
  });
  switch (d.reason) {
    // ---- orders of rolls
    case 'rallyOrder':
      // Leaders first (a rallied Leader lends its Command to the rest), then the most valuable
      return byPiece((p) => (isLeader(p) ? 10 : 0) + pieceValue(s, p));
    case 'routOrder':
      // our Rout on the enemy: Leaders first (one routed away takes its Command from the rest)
      return byPiece((p) => (isLeader(p) ? 10 : 0) + pieceValue(s, p));
    case 'defenseOrder':
      // Leaders last: their Command counts for the others' rolls while they stand
      return byPiece((p) => (isLeader(p) ? -10 : 0) + pieceValue(s, p));
    case 'impactOrder':
    case 'meleeOrder':
      return per((_, i) => -i);
    // ---- hurting a piece
    case 'sniperTarget':
    case 'shellShockTie':
      return byPiece((p) => breakScore(s, me, p));
    case 'kia':
    case 'pow':
    case 'overstackEliminate':
      return byPiece((p) => elimScore(s, me, p) + (d.reason === 'overstackEliminate' ? 0.4 * (typeOf(p).kind === 'leader' ? 1 : 0) : 0));
    case 'ambushVictim':
    case 'whitePhosphorusLoss':
      // own units only: break the one it hurts least (an unbroken one rather than kill a broken one)
      return byPiece((p) => breakScore(s, me, p));
    case 'interdiction':
      return byPiece((p) => (p.side === me ? -suppressCost(s, p) : suppressCost(s, p)) + (p.side !== me ? 0.01 : 0));
    case 'suppressingFire':
      return byPiece((p) => (p.side === me ? -suppressCost(s, p) : suppressCost(s, p) + 0.05));
    case 'malfunctionTie':
    case 'sustainedBreak':
      return byPiece((p) => (p.side === me ? -pieceValue(s, p) : pieceValue(s, p)));
    case 'airSupport':
      // break everything in the hex: worth it when the enemy loses more than we do
      return byHex((h) => [...unitsAt(s, h, me), ...unitsAt(s, h, opp)].reduce((n, p) => n + breakScore(s, me, p), 0));
    // ---- helping a piece
    case 'medic':
    case 'heroRally':
      return byPiece((p) => rallyScore(s, me, p));
    case 'commissar': {
      // the roll: > Morale → eliminated, ≤ → rallied: pick the unit with the best odds and worth
      return byPiece((p) => {
        const m = currentStats(s, p.id).morale;
        let pr = 0;
        for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b <= m) pr += 1 / 36;
        return pr * rallyScore(s, me, p) + (1 - pr) * elimScore(s, me, p);
      });
    }
    case 'battleHarden':
      return byPiece((p) => (p.side === me ? (p.broken ? 0.1 : 0.3) * pieceValue(s, p) + (typeOf(p).kind === 'squad' ? 0.3 : 0) : -0.3));
    case 'walkingWounded':
      return byPiece((p) => (p.side === me ? 0.4 * pieceValue(s, { ...p, broken: true }) + 1 : -0.4 * pieceValue(s, { ...p, broken: true })));
    case 'scrounge':
      return byPiece((p) => pieceValue(s, p));
    case 'scroungeUnit':
      return byPiece((p) => (p.side === me ? (p.broken ? 0 : 1) + (typeOf(p).kind === 'squad' ? 1 : 0) + (leaderWith(s, p) ? 0.5 : 0) : -5));
    case 'deploy':
      // two Teams for a Squad: only when it fixes overstacking or spreads a broken Squad's loss; usually no
      return byPiece(() => -0.5);
    case 'overstackDeploy': {
      // splitting a Squad lets one Team go instead of the whole Squad when the excess is 2 or less
      const hex = c.hex as HexId | undefined;
      return byPiece((p) => {
        if (hex === undefined) return -1;
        const here = unitsAt(s, hex, p.side);
        const figs = here.reduce((n, u) => n + (typeOf(u).kind === 'squad' ? 4 : typeOf(u).kind === 'team' ? 2 : 1), 0);
        const excess = figs - 7;
        const hasTeam = here.some((u) => typeOf(u).kind === 'team');
        return excess > 0 && excess <= 2 && !hasTeam ? 1 - 0.1 * pieceValue(s, p) : -1;
      });
    }
    case 'deployMarkers':
      return per((_, i) => -i);
    // ---- cards, chits, items, spaces
    case 'interrogation': {
      const cc = cardCtx(s, opp);
      return per((it) => ('card' in it ? keepValue(it.card, cc) : 0));
    }
    case 'reconnaissance':
      // we reveal one of our secret chits: the one worth least to keep hidden
      return per((it) => ('chit' in it ? -chitWorth(s, me, it.chit) : 0));
    case 'reinforcementItem':
    case 'infiltration': {
      const opts = (c.options as { types?: string[]; radio?: string }[] | undefined) ?? [];
      return per((_, i) => (opts[i]?.radio ? 2.5 : itemWorth(opts[i]?.types)) + 0.01);
    }
    case 'supportItem': {
      const list = (c.items as string[][] | undefined) ?? [];
      return per((_, i) => itemWorth(list[i]) + 0.01);
    }
    case 'exitSpace':
      return per((it) => ('space' in it ? -it.space : 0));
    case 'initiativeChoice':
      return per((it) => ('label' in it && it.label === 'keep' ? 1 : 0));
    case 'artilleryKind':
      return per((it) => ('label' in it && /smoke/i.test(it.label) ? -1 : 1));
    // ---- hexes
    case 'retreatStep':
    case 'blazeDisplace':
    case 'walkingWoundedPlace':
    case 'infiltrationPlace':
    case 'reinforcementPlace':
    case 'hiddenUnitPlace':
    case 'heroPlace':
    case 'fieldPromotion': {
      const sh = sideShooters(s, opp);
      return byHex((h) => {
        let v = safety(s, me, h, sh) + 0.4 * objectivePull(s, me, h);
        if (d.reason === 'heroPlace' || d.reason === 'fieldPromotion') {
          v += unitsAt(s, h, me).reduce((n, p) => n + (p.broken ? 1.5 : 0.3) * pieceValue(s, p), 0) * 0.3;
        }
        if (d.reason === 'retreatStep' && s.players[me].edge) v += 0;
        return v + 0.01;
      });
    }
    case 'smokeRemoval': {
      // remove the Smoke that helps the enemy most (screens his units, blocks our fire)
      return byHex((h) => smokeHelp(s, opp, h) - smokeHelp(s, me, h));
    }
    case 'whitePhosphorus':
      // each side with units there breaks one of its own: a hex with enemies only is a gift
      return byHex((h) => {
        const mine = unitsAt(s, h, me);
        const theirs = unitsAt(s, h, opp);
        const cheapest = (list: Piece[]) => (list.length ? Math.min(...list.map((p) => breakCost(s, p))) : 0);
        return cheapest(theirs) - cheapest(mine) - 0.05;
      });
    case 'sappers':
    case 'fortRemove':
      // remove a Mine / Wire marker that hinders us: in or next to our units, unless it guards our own positions
      return byHex((h) => {
        const ours = unitsAt(s, h, me).length;
        const near = neighbours(h).some((n) => unitsAt(s, n, me).length);
        const defender = s.players[me].posture === 'defend';
        return ours ? 1.2 : near && !defender ? 0.4 : -0.3;
      });
    case 'digInHex':
    case 'entrenchHex':
      return byHex((h) => foxholeGain(s, me, h));
    case 'smokeGrenadeHex':
      return byHex((h) => -safety(s, me, h));
    case 'spotterSR':
      // aim at enemy concentrations; a miss drifts, so enemies around the hex count too and our own units nearby count
      // against it
      return byHex((h) => {
        let v = targetWorth(s, me, h);
        for (const n of neighbours(h)) v += 0.3 * targetWorth(s, me, n) - 0.5 * unitsAt(s, n, me).reduce((x, p) => x + pieceValue(s, p), 0);
        v -= 1.5 * unitsAt(s, h, me).reduce((x, p) => x + pieceValue(s, p), 0);
        return v + 0.01;
      });
    case 'sprayHex':
      return byHex((h) => targetWorth(s, me, h));
    case 'placement':
      return byHex((h) => fortPlacement(s, me, h, String(c.fort ?? 'foxholes')));
    default:
      return per((it) => {
        const p = piece(s, it);
        if (p) return p.side === me ? -pieceValue(s, p) : pieceValue(s, p);
        const h = hexOfItem(it);
        if (h !== null) return safety(s, me, h) * 0.1;
        return 0;
      });
  }
}

function leaderWith(s: GameState, p: Piece): boolean {
  return unitsAt(s, p.hex, p.side).some((u) => isLeader(u) && !u.broken);
}

/** Worth of keeping secret chit `c` hidden (its VP for objectives the side holds or may take). */
function chitWorth(s: GameState, side: Side, c: string): number {
  let v = 0;
  for (let n = 1; n <= 5; n++) v += chitValue(c, n) * (s.control[n - 1] === side ? 1 : 0.5);
  return v;
}

/** How much a Smoke marker in `h` helps `side` (screens its units from enemy shooters). */
function smokeHelp(s: GameState, side: Side, h: HexId): number {
  let v = 0;
  for (const p of unitsAt(s, h, side)) v += pieceValue(s, p);
  for (const n of neighbours(h)) for (const p of unitsAt(s, n, side)) v += 0.3 * pieceValue(s, p);
  return v;
}

/** Enemy worth in hex `h` (a target). */
function targetWorth(s: GameState, me: Side, h: HexId): number {
  return unitsAt(s, h, other(me)).reduce((n, p) => n + pieceValue(s, p), 0);
}

/** Gain of Foxholes in `h` for `me`'s units there (Cover 3 instead of the hex's). */
function foxholeGain(s: GameState, me: Side, h: HexId): number {
  const units = unitsAt(s, h, me);
  if (!units.length) return -0.1;
  const now = hexCover(s, h);
  if (now >= 3) return -0.05;
  const f = fireOn(s, sideShooters(s, other(me)), h);
  const before = stackLoss(s, h, me, f, false, units);
  return 0.05 + (3 - now) * 0.08 * units.reduce((n, p) => n + pieceValue(s, p), 0) + before * 0.5;
}

/** Where a set-up Fortification of `kind` goes for `me`. */
export function fortPlacement(s: GameState, me: Side, h: HexId, kind: string): number {
  const units = unitsAt(s, h, me);
  const worth = units.reduce((n, p) => n + pieceValue(s, p), 0);
  const obj = objectivePull(s, me, h);
  if (kind === 'wire' || kind === 'mines') {
    // in front of our positions, on open approaches the enemy must cross, never on our own units
    if (units.length) return -2;
    let seen = 0;
    for (const id in s.pieces) {
      const p = s.pieces[id];
      if (p.side === me && p.where === 'map' && isUnit(p) && distance(p.hex, h) <= 4 && losCheck(s, p.hex, h).clear) seen++;
    }
    const open = hexCover(s, h) <= 0 ? 0.5 : 0;
    const enemyEdge = s.players[other(me)].edge;
    const toward = edgeCloseness(h, enemyEdge);
    return seen * 0.4 + open + obj * 0.3 + toward * 0.3;
  }
  const cov: Record<string, number> = { foxholes: 3, trench: 4, pillbox: 5, bunker: 6 };
  const gain = Math.max(0, (cov[kind] ?? 3) - hexCover(s, h));
  return gain * (0.3 + 0.25 * worth) + obj * 0.4;
}

/** 0..1: how near `h` is to `edge` (1 on it). */
function edgeCloseness(h: HexId, edge: string): number {
  const k = Math.floor(h / 10);
  const n = (h % 10) + 1;
  const d = edge === 'top' ? n - 1 : edge === 'bottom' ? 10 - n : edge === 'left' ? k : 14 - k;
  return 1 - d / 14;
}

/**
 * The 'choose' answer: items by score, best first; the ones worth taking (score > 0) up to `max`, padded to `min`
 * with the least bad.
 */
export function chooseAnswer(s: GameState, d: ChooseD, me: Side): number[] {
  const scores = itemScores(s, d, me);
  const order = scores.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v || a.i - b.i);
  const out: number[] = [];
  for (const x of order) {
    if (out.length >= d.max) break;
    if (out.length < d.min || x.v > 0) out.push(x.i);
  }
  return out;
}

