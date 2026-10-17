// The RSG as a step machine: the steps RS.1–RS.16 in order (each an automatic roll or a choice for one side), and the
// machine core the public API in src/engine/rsg.ts wraps. Steps mutate the draft they are given; rsg.ts clones first.
import { OBJECTIVE_CHITS, RSG } from '../data';
import { chitValue } from '../objectives';
import { random } from '../rng';
import { type Edge, type Posture, type Side, SIDES, other } from '../types';
import {
  OBJECTIVES, OPPOSITE, RSG_MAPS, SIDE_NAME, attackerOf, clone, coin, defenderOf, die, fixedError, fortError, fortOb, give,
  hasOb, leadOf, log, name, nationOf, nationOk, obOf, radioChances, radioOn, rsgLeaderIndex, rsgObOptions, sum,
  supportError, supportOptions, twoDice, vpText, yearOk,
} from './tables';
import type {
  RsgAutoWhat, RsgChoice, RsgChoiceStep, RsgChoiceWhat, RsgDraft, RsgFortOption, RsgOptions, RsgPurchase, RsgStep,
} from './types';

// ---------------------------------------------------------------------------------------------------------------------
// The steps, in order

interface AutoDef {
  kind: 'auto';
  id: string;
  what: RsgAutoWhat;
  when: (d: RsgDraft) => boolean;
  side: (d: RsgDraft) => Side | null;
  label: (d: RsgDraft) => string;
  run: (d: RsgDraft) => void;
}

interface ChoiceDef {
  kind: 'choice';
  id: string;
  what: RsgChoiceWhat;
  when: (d: RsgDraft) => boolean;
  step: (d: RsgDraft) => RsgChoiceStep;
  /** `c.what` already matches. */
  check: (d: RsgDraft, c: RsgChoice) => string | null;
  apply: (d: RsgDraft, c: RsgChoice) => void;
}

type StepDef = AutoDef | ChoiceDef;

const always = () => true;

function qualityStep(side: Side): AutoDef {
  return {
    kind: 'auto', id: `quality:${side}`, what: 'quality', side: () => side, when: (d) => d.quality[side] === null,
    label: (d) => `${nationOf(d, side)} troop quality roll (RS.3)`,
    run: (d) => {
      const nation = nationOf(d, side);
      for (let i = 0; ; i++) {
        const r = twoDice(d);
        const q = RSG.troopQuality[nation][sum(r)]?.[d.year!];
        const ok = !!q && hasOb(nation, d.year!, q);
        log(d, { step: 'quality', side, dice: r, text: `${SIDE_NAME[side]} roll ${r[0]}+${r[1]} for troop quality: ${q ?? '–'}${ok ? '.' : ', no OB: re-roll.'}` });
        if (ok) {
          d.quality[side] = q;
          return;
        }
        if (i > 100) throw new Error(`RSG: no troop quality for ${nation} ${d.year}`);
      }
    },
  };
}

function obStep(side: Side): ChoiceDef {
  return {
    kind: 'choice', id: `ob:${side}`, what: 'ob', when: (d) => d.ob[side] === null,
    step: (d) => ({
      kind: 'choice', id: `ob:${side}`, what: 'ob', side, nation: nationOf(d, side), year: d.year!, quality: d.quality[side]!,
      options: rsgObOptions(nationOf(d, side), d.year!, d.quality[side]!),
    }),
    check: (d, c) => {
      if (c.what !== 'ob') return 'Expected an OB.';
      const ok = rsgObOptions(nationOf(d, side), d.year!, d.quality[side]!).some((o) => o.letter === c.letter && o.size === c.size);
      return ok ? null : `${c.letter} ${c.size} is not an OB of this nation, year and troop quality (RS.5).`;
    },
    apply: (d, c) => {
      if (c.what !== 'ob') return;
      d.ob[side] = { letter: c.letter, size: c.size };
      log(d, { step: 'ob', side, choice: c, text: `${SIDE_NAME[side]} pick an Order of Battle.` });
    },
  };
}

function leaderStep(side: Side): AutoDef {
  return {
    kind: 'auto', id: `leaders:${side}`, what: 'leaders', side: () => side, when: always,
    label: () => `${SIDE_NAME[side]} roll for Leaders (RS.6)`,
    run: (d) => {
      const nation = nationOf(d, side);
      const { ob, size } = obOf(d, side);
      const table = RSG.leaderTable[nation];
      const mod = RSG.leaderModifiers.quality[ob.quality] + (RSG.leaderModifiers.year[nation][d.year!] ?? 0);
      const modText = mod ? ` ${mod > 0 ? '+' : '−'} ${Math.abs(mod)}` : '';
      const got: string[] = [];
      while (got.length < size.leaders) {
        let placed = false;
        for (let t = 0; t < 50 && !placed; t++) {
          const w = die(d);
          const id = table[rsgLeaderIndex(nation, d.year!, ob.quality, w)];
          const roll = `white ${w}${modText}`;
          if (got.includes(id)) {
            log(d, { step: 'leaders', side, dice: [w], text: `${SIDE_NAME[side]} Leader roll ${roll}: ${name(id)} again, re-roll.` });
            continue;
          }
          got.push(id);
          placed = true;
          log(d, { step: 'leaders', side, dice: [w], text: `${SIDE_NAME[side]} Leader roll ${roll}: ${name(id)}.` });
        }
        if (!placed) {
          // Ruling: cannot happen with the tables (at least 4 Leaders are reachable); take the first unused one.
          const id = table.find((x) => !got.includes(x))!;
          got.push(id);
          log(d, { step: 'leaders', side, text: `${SIDE_NAME[side]} take ${name(id)}.` });
        }
      }
      d.leaders[side] = got;
    },
  };
}

function supportRollStep(k: 1 | 2): AutoDef {
  const sideOf = (d: RsgDraft): Side => (k === 1 ? (d.vp > 0 ? 'axis' : 'allied') : other(d.support[0].side));
  return {
    kind: 'auto', id: `supportRoll:${k}`, what: 'supportRoll', side: sideOf,
    // RS.7: skip at 0; the second roll only if the first purchase carried the marker past 0 (one round only)
    when: (d) => (k === 1 ? d.vp !== 0 : d.support.length === 1 && leadOf(d.vp, d.support[0].side) < 0),
    label: (d) => `${SIDE_NAME[sideOf(d)]} roll on the Support Table (RS.7)`,
    run: (d) => {
      const side = sideOf(d);
      const roll = twoDice(d);
      const empty = supportOptions(d, side, sum(roll)).length === 0;
      d.support.push({ side, roll, bought: [], cost: 0, done: empty });
      // Ruling: a column with nothing legal for the year buys nothing
      const tail = empty ? ': nothing there for the year.' : '.';
      log(d, { step: 'supportRoll', side, dice: roll, text: `${SIDE_NAME[side]} roll ${roll[0]}+${roll[1]} on the Support Table${tail}` });
    },
  };
}

function supportBuyStep(k: 1 | 2): ChoiceDef {
  const round = (d: RsgDraft) => d.support[k - 1];
  return {
    kind: 'choice', id: `supportBuy:${k}`, what: 'supportBuy', when: (d) => !!round(d) && !round(d).done,
    step: (d) => {
      const r = round(d);
      const options = supportOptions(d, r.side, sum(r.roll));
      return { kind: 'choice', id: `supportBuy:${k}`, what: 'supportBuy', side: r.side, roll: [...r.roll], lead: leadOf(d.vp, r.side), min: options.length ? 1 : 0, options };
    },
    check: (d, c) => {
      if (c.what !== 'supportBuy') return 'Expected a purchase.';
      const r = round(d);
      return supportError(supportOptions(d, r.side, sum(r.roll)), leadOf(d.vp, r.side), c.buy);
    },
    apply: (d, c) => {
      if (c.what !== 'supportBuy') return;
      const r = round(d);
      const byId = new Map(supportOptions(d, r.side, sum(r.roll)).map((o) => [o.id, o]));
      for (const id of c.buy) {
        const o = byId.get(id)!;
        const p: RsgPurchase = { id: o.id, item: o.item, label: o.label, vp: o.vp, pieces: { ...o.pieces } };
        if (o.carrier && o.weapon) {
          p.carrier = o.carrier;
          p.weapon = o.weapon;
        }
        r.bought.push(p);
        r.cost += o.vp;
      }
      r.done = true;
      give(d, other(r.side), r.cost);
      const what = r.bought.length ? r.bought.map((b) => b.label).join(', ') : 'nothing';
      log(d, { step: 'supportBuy', side: r.side, choice: c, vp: d.vp, text: `${SIDE_NAME[r.side]} buy ${what} for ${r.cost} VP: VP ${vpText(d.vp)}.` });
    },
  };
}

const STEPS: StepDef[] = [
  {
    // RS.2.1 coin flip for sides. Ruling: made first, because RS.1 needs to know who rolls, picks and chooses.
    kind: 'auto', id: 'sides', what: 'sides', side: () => null, when: (d) => d.humanSide === null,
    label: () => 'Coin flip for sides (RS.2)',
    run: (d) => {
      const c = coin(d);
      d.humanSide = c === 'heads' ? 'axis' : 'allied';
      log(d, { step: 'sides', side: null, coin: c, text: `Coin flip: ${c}. Player one takes the ${SIDE_NAME[d.humanSide]}.` });
    },
  },
  {
    // RS.1. Ruling: the Axis player makes the roll; even: he picks the map, odd: the Allied player does.
    kind: 'auto', id: 'mapRoll', what: 'mapRoll', side: () => 'axis', when: (d) => d.map === null || d.edges === null,
    label: () => 'The Axis player rolls: even, he picks the map; odd, the Allied player does (RS.1)',
    run: (d) => {
      const r = twoDice(d);
      d.mapPicker = sum(r) % 2 === 0 ? 'axis' : 'allied';
      const tail = d.map === null ? 'pick the map' : 'would pick the map (it is fixed)';
      log(d, { step: 'mapRoll', side: 'axis', dice: r, text: `Axis roll ${r[0]}+${r[1]}: the ${SIDE_NAME[d.mapPicker]} ${tail}; the other side chooses its edge die.` });
    },
  },
  {
    kind: 'choice', id: 'mapPick', what: 'mapPick', when: (d) => d.map === null,
    step: (d) => ({ kind: 'choice', id: 'mapPick', what: 'mapPick', side: d.mapPicker!, options: RSG_MAPS.map((map) => ({ map })) }),
    check: (_, c) => (c.what === 'mapPick' && RSG_MAPS.includes(c.map) ? null : 'Pick one of maps 1-12.'),
    apply: (d, c) => {
      if (c.what !== 'mapPick') return;
      d.map = c.map;
      log(d, { step: 'mapPick', side: d.mapPicker, choice: c, text: `The ${SIDE_NAME[d.mapPicker!]} pick map ${c.map}.` });
    },
  },
  {
    kind: 'auto', id: 'edgeRoll', what: 'edgeRoll', side: (d) => other(d.mapPicker!), when: (d) => d.edges === null,
    label: (d) => `The ${SIDE_NAME[other(d.mapPicker!)]} roll for their friendly edge (RS.1)`,
    run: (d) => {
      const side = other(d.mapPicker!);
      d.edgeDice = twoDice(d);
      log(d, { step: 'edgeRoll', side, dice: [...d.edgeDice], text: `${SIDE_NAME[side]} roll white ${d.edgeDice[0]}, coloured ${d.edgeDice[1]}.` });
    },
  },
  {
    kind: 'choice', id: 'mapEdgeDie', what: 'mapEdgeDie', when: (d) => d.edges === null,
    step: (d) => ({
      kind: 'choice', id: 'mapEdgeDie', what: 'mapEdgeDie', side: other(d.mapPicker!),
      options: (['white', 'coloured'] as const).map((dieName, i) => {
        const value = d.edgeDice![i];
        const edge = RSG.edgeByDie[value];
        return { die: dieName, value, edge, orientation: edge === 'top' || edge === 'bottom' ? 'wide' : 'narrow' };
      }),
    }),
    check: (_, c) => (c.what === 'mapEdgeDie' && (c.die === 'white' || c.die === 'coloured') ? null : 'Choose the white or the coloured die.'),
    apply: (d, c) => {
      if (c.what !== 'mapEdgeDie') return;
      const side = other(d.mapPicker!);
      const value = d.edgeDice![c.die === 'white' ? 0 : 1];
      const edge = RSG.edgeByDie[value];
      d.edges = { [side]: edge, [other(side)]: OPPOSITE[edge] } as Record<Side, Edge>;
      const kind = edge === 'top' || edge === 'bottom' ? 'wide' : 'narrow';
      log(d, { step: 'mapEdgeDie', side, choice: c, text: `${SIDE_NAME[side]} use the ${c.die} die (${value}): their edge is the ${edge} (${kind}).` });
    },
  },
  {
    // RS.2.1 year (the Axis is always Germany, R0); 1939/1940, and years the fixed options cannot have, are re-rolled
    kind: 'auto', id: 'year', what: 'year', side: () => 'axis', when: (d) => d.year === null,
    label: () => 'The Axis roll for the year (RS.2)',
    run: (d) => {
      for (let i = 0; ; i++) {
        const r = twoDice(d);
        const y = RSG.germanYear[sum(r)];
        const ok = yearOk(d.fixed, y);
        log(d, { step: 'year', side: 'axis', dice: r, text: `Year roll ${r[0]}+${r[1]}: ${y}${ok ? '.' : ', no base-game Allies for it here: re-roll.'}` });
        if (ok) {
          d.year = y;
          return;
        }
        if (i > 200) throw new Error('RSG: no legal year');
      }
    },
  },
  {
    // RS.2.2 Allied nation; France / Britain (and a nation the year or fixed quality cannot have) are re-rolled
    kind: 'auto', id: 'allied', what: 'allied', side: () => 'allied', when: (d) => d.allied === null,
    label: () => 'Roll for the Allied nation (RS.2)',
    run: (d) => {
      for (let i = 0; ; i++) {
        const r = twoDice(d);
        const n = RSG.alliedNation[sum(r)][d.year!];
        const ok = nationOk(d.fixed, n, d.year!);
        log(d, { step: 'allied', side: 'allied', dice: r, text: `Allied nation roll ${r[0]}+${r[1]}: ${n ?? 'France or Britain'}${ok ? '.' : ', not in the base game: re-roll.'}` });
        if (ok) {
          d.allied = n;
          return;
        }
        if (i > 200) throw new Error('RSG: no legal Allied nation');
      }
    },
  },
  qualityStep('axis'),
  qualityStep('allied'),
  {
    // RS.4. Ruling (as HS.3.6 and objectives.ts drawChit): a secret draw of R, V, W or X goes open, with no redraw.
    kind: 'auto', id: 'chits', what: 'chits', side: () => null, when: always,
    label: () => 'Objective chits: one open, then one secret each (RS.4)',
    run: (d) => {
      const cup = Object.keys(OBJECTIVE_CHITS).sort();
      const draw = () => cup.splice(Math.floor(random(d) * cup.length), 1)[0];
      const open = draw();
      d.openChits.push(open);
      log(d, { step: 'chits', side: null, text: `Open Objective chit: ${open}.` });
      for (const side of SIDES) {
        const c = draw();
        if (OBJECTIVE_CHITS[c].secret) {
          d.secretChits[side].push(c);
          log(d, { step: 'chits', side, text: `${SIDE_NAME[side]} draw a secret Objective chit.` });
        } else {
          d.openChits.push(c);
          log(d, { step: 'chits', side, text: `${SIDE_NAME[side]} draw chit ${c}: it has no secret side and goes open.` });
        }
      }
    },
  },
  obStep('axis'),
  obStep('allied'),
  {
    kind: 'auto', id: 'obPoints', what: 'obPoints', side: () => null, when: always,
    label: () => 'The OB point values move the VP marker (RS.5)',
    run: (d) => {
      const a = obOf(d, 'axis').size;
      const b = obOf(d, 'allied').size;
      d.vp = b.points - a.points;
      log(d, {
        step: 'obPoints', side: null, vp: d.vp,
        text: `Axis ${a.label} (${a.points}) v ${d.allied} ${b.label} (${b.points}): VP ${vpText(d.vp)}.`,
      });
    },
  },
  leaderStep('axis'),
  leaderStep('allied'),
  supportRollStep(1),
  supportBuyStep(1),
  supportRollStep(2),
  supportBuyStep(2),
  {
    kind: 'auto', id: 'posture', what: 'posture', side: () => null, when: always,
    label: () => 'Postures from the VP marker (RS.8)',
    run: (d) => {
      const fixed = d.fixed.defender !== undefined;
      const def = fixed ? d.fixed.defender! : d.vp > 0 ? 'axis' : d.vp < 0 ? 'allied' : null;
      d.postures = def ? ({ [def]: 'defend', [other(def)]: 'attack' } as Record<Side, Posture>) : { axis: 'recon', allied: 'recon' };
      const text = def ? `the ${SIDE_NAME[def]} defend, the ${SIDE_NAME[other(def)]} attack` : 'Recon v Recon';
      log(d, { step: 'posture', side: def, vp: d.vp, text: `VP ${vpText(d.vp)}: ${text}${fixed ? ' (fixed)' : ''}.` });
    },
  },
  {
    kind: 'choice', id: 'fortifications', what: 'fortifications',
    when: (d) => {
      const def = defenderOf(d);
      return !!def && leadOf(d.vp, def) >= Math.min(...RSG.fortifications.map((f) => f.vp));
    },
    step: (d) => {
      const side = defenderOf(d)!;
      return {
        kind: 'choice', id: 'fortifications', what: 'fortifications', side, budget: leadOf(d.vp, side),
        options: RSG.fortifications.map((f) => {
          const o: RsgFortOption = { id: f.id, name: f.name, vp: f.vp, contents: { ...f.contents } };
          if (f.minefield) o.minefield = f.minefield;
          return o;
        }),
      };
    },
    check: (d, c) => (c.what === 'fortifications' ? fortError(leadOf(d.vp, defenderOf(d)!), c.buy) : 'Expected Fortifications.'),
    apply: (d, c) => {
      if (c.what !== 'fortifications') return;
      const side = defenderOf(d)!;
      const cost = c.buy.reduce((n, id) => n + fortOb(id)!.vp, 0);
      d.fortifications = [...c.buy];
      give(d, other(side), cost);
      const what = c.buy.length ? c.buy.map((id) => fortOb(id)!.name).join(', ') : 'no Fortifications';
      log(d, { step: 'fortifications', side, choice: c, vp: d.vp, text: `The ${SIDE_NAME[side]} buy ${what} for ${cost} VP: VP ${vpText(d.vp)}.` });
    },
  },
  {
    // RS.10: the Defender controls every Objective and scores the open chits for them. RS.13: Recon starts with none;
    // RS.11.2 / RS.13 occupation after set-up is the engine's (special.controlAfterSetup).
    kind: 'auto', id: 'control', what: 'control', side: (d) => defenderOf(d), when: always,
    label: () => 'Objective control and open chits (RS.10, RS.13)',
    run: (d) => {
      const def = defenderOf(d);
      d.control = Array<Side | null>(OBJECTIVES).fill(def);
      if (!def) {
        log(d, { step: 'control', side: null, vp: d.vp, text: 'Recon: Objectives start uncontrolled.' });
        return;
      }
      let v = 0;
      for (const c of d.openChits) for (let n = 1; n <= OBJECTIVES; n++) v += chitValue(c, n);
      give(d, def, v);
      log(d, { step: 'control', side: def, vp: d.vp, text: `The ${SIDE_NAME[def]} control every Objective; open chits give them ${v} VP: VP ${vpText(d.vp)}.` });
    },
  },
  {
    kind: 'choice', id: 'assetRequest', what: 'assetRequest', when: (d) => attackerOf(d) !== null,
    step: (d) => {
      const side = attackerOf(d)!;
      return {
        kind: 'choice', id: 'assetRequest', what: 'assetRequest', side, defenderLead: leadOf(d.vp, other(side)),
        radios: radioChances(d, side), options: [{ request: true }, { request: false }],
      };
    },
    check: (_, c) => (c.what === 'assetRequest' && typeof c.request === 'boolean' ? null : 'Request a Radio, or not.'),
    apply: (d, c) => {
      if (c.what !== 'assetRequest') return;
      const side = attackerOf(d)!;
      d.asset = { requested: c.request, roll: null, radio: null, cost: 0 };
      log(d, { step: 'assetRequest', side, choice: c, text: `The ${SIDE_NAME[side]} ${c.request ? 'make' : 'make no'} Asset Request.` });
    },
  },
  {
    // RS.11.1: Radios only, and only the column's Radio for the year (if any), paid toward the Defender
    kind: 'auto', id: 'assetRoll', what: 'assetRoll', side: (d) => attackerOf(d), when: (d) => !!d.asset?.requested && !d.asset.roll,
    label: () => 'Asset Request roll on the Support Table (RS.11.1)',
    run: (d) => {
      const side = attackerOf(d)!;
      const a = d.asset!;
      a.roll = twoDice(d);
      const e = radioOn(d, side, sum(a.roll));
      if (e) {
        const item = RSG.support[nationOf(d, side)].items[e.item];
        a.radio = Object.keys(item.pieces)[0];
        a.cost = e.vp;
        give(d, other(side), e.vp);
      }
      const what = e ? `${RSG.support[nationOf(d, side)].items[e.item].label} for ${e.vp} VP: VP ${vpText(d.vp)}` : 'no Radio on that column for the year';
      log(d, { step: 'assetRoll', side, dice: [...a.roll], vp: d.vp, text: `Asset Request roll ${a.roll[0]}+${a.roll[1]}: ${what}.` });
    },
  },
  {
    // RS.15 / RS.16: the higher OB Initiative number takes the card and the first Turn; a tie is a coin flip (R-50)
    kind: 'auto', id: 'initiative', what: 'initiative', side: () => null, when: always,
    label: () => 'Initiative from the OB Initiative numbers (RS.15)',
    run: (d) => {
      const a = obOf(d, 'axis').size.initiative;
      const b = obOf(d, 'allied').size.initiative;
      if (a !== b) {
        d.initiative = a > b ? 'axis' : 'allied';
        log(d, { step: 'initiative', side: d.initiative, text: `Initiative ${a} v ${b}: the ${SIDE_NAME[d.initiative]} take the Initiative card and the first Turn.` });
        return;
      }
      const c = coin(d);
      d.initiative = c === 'heads' ? 'axis' : 'allied';
      log(d, { step: 'initiative', side: d.initiative, coin: c, text: `Initiative ${a} v ${b}, a tie: coin flip ${c}, the ${SIDE_NAME[d.initiative]} take it.` });
    },
  },
];

export function nextIndex(d: RsgDraft): number {
  for (let i = d.at; i < STEPS.length; i++) if (STEPS[i].when(d)) return i;
  return -1;
}

// ---------------------------------------------------------------------------------------------------------------------
// The machine

/** A new RSG draft. Fixed options are taken as given (and logged); impossible ones throw. */
export function newRsgDraft(opts: RsgOptions): RsgDraft {
  const fixed = clone(opts.fixed ?? {});
  const err = fixedError(fixed);
  if (err) throw new Error(err);
  const d: RsgDraft = {
    v: 1, seed: opts.seed, rng: opts.seed >>> 0, rngCalls: 0, fixed, at: 0, humanSide: null, log: [], mapPicker: null,
    map: null, edgeDice: null, edges: null, year: null, allied: null, quality: { axis: null, allied: null }, openChits: [],
    secretChits: { axis: [], allied: [] }, ob: { axis: null, allied: null }, vp: 0, leaders: { axis: [], allied: [] },
    support: [], postures: null, fortifications: [], control: null, asset: null, initiative: null,
  };
  const note = (text: string) => log(d, { step: 'fixed', side: null, text });
  if (opts.humanSide) {
    if (!SIDES.includes(opts.humanSide)) throw new Error(`No side "${opts.humanSide}".`);
    d.humanSide = opts.humanSide;
    note(`Player one takes the ${SIDE_NAME[opts.humanSide]}.`);
  }
  if (fixed.map !== undefined) {
    d.map = fixed.map;
    note(`Map ${fixed.map}.`);
  }
  if (fixed.axisEdge) {
    d.edges = { axis: fixed.axisEdge, allied: OPPOSITE[fixed.axisEdge] };
    note(`Axis edge: ${fixed.axisEdge}.`);
  }
  if (fixed.year !== undefined) {
    d.year = fixed.year;
    note(`Year ${fixed.year}.`);
  }
  if (fixed.allied) {
    d.allied = fixed.allied;
    note(`Allies: ${fixed.allied}.`);
  }
  for (const side of SIDES) {
    const q = fixed.quality?.[side];
    if (q) {
      d.quality[side] = q;
      note(`${SIDE_NAME[side]} troop quality: ${q}.`);
    }
  }
  return d;
}

/** What happens next: an automatic step (`rsgAdvance`), a choice for a side (`rsgChoose`), or done (`rsgFinish`). */
export function rsgStep(d: RsgDraft): RsgStep {
  const i = nextIndex(d);
  if (i < 0) return { kind: 'done' };
  const def = STEPS[i];
  if (def.kind === 'choice') return def.step(d);
  return { kind: 'auto', id: def.id, what: def.what, side: def.side(d), label: def.label(d) };
}

/** Why `c` cannot be the next choice, or null if it can. */
export function rsgCheck(d: RsgDraft, c: RsgChoice): string | null {
  const i = nextIndex(d);
  if (i < 0) return 'The RSG is finished.';
  const def = STEPS[i];
  if (def.kind !== 'choice') return `The next step is automatic (${def.what}), not a choice.`;
  if (!c || c.what !== def.what) return `Expected a ${def.what} choice.`;
  return def.check(d, c);
}

export function chooseInPlace(d: RsgDraft, c: RsgChoice): void {
  const err = rsgCheck(d, c);
  if (err) throw new Error(err);
  const i = nextIndex(d);
  (STEPS[i] as ChoiceDef).apply(d, clone(c));
  d.at = i + 1;
}

export function advanceInPlace(d: RsgDraft): void {
  const i = nextIndex(d);
  if (i < 0) throw new Error('The RSG is finished.');
  const def = STEPS[i];
  if (def.kind !== 'auto') throw new Error(`The RSG waits for a choice (${def.what}).`);
  def.run(d);
  d.at = i + 1;
}
