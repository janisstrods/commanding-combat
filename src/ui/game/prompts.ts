// The prompt model: for the human's pending decision and his selection so far, what the battle screen shows (title,
// instructions, lit hexes, clickable pieces and cards, buttons) and what a click does. Pure functions of the state the
// human sees (`redact(state, human)`), so they can be tested; the controller validates every answer again.
//
// Every decision kind has its own prompt; a 'choose' decision gets a generic one (pieces or hexes on the board, cards
// in a strip, the rest as a list) with wording from choiceText.ts; a decision kind this file does not know falls back
// to a list of the legal answers random play can find.
import { ACTION_TEXT, ORDER_TEXT } from '../../data/card-texts';
import { activationError, commandRadius } from '../../engine/activation';
import { answerError } from '../../engine/decisions';
import { enemyHexes, fireOptions, fireSpecError, shooter } from '../../engine/fire';
import { smokeOptions } from '../../engine/orders/fire';
import { neighbours } from '../../engine/hex';
import { mpLeft } from '../../engine/orders/move';
import { randomAnswer } from '../../engine/random';
import { cardOf, isLeader, isUnit, typeOf } from '../../engine/state';
import type { ActionOption, Answer, CardId, ChoiceItem, Decision, GameState, HexId, PieceId, Side } from '../../engine/types';
import { other } from '../../engine/types';
import { choiceWords, countText, itemHex, labelText } from './choiceText';
import { PURPOSE_TEXT, WINDOW_TEXT, chitText, counterName, hexName, pieceName, sideName } from './names';
import { firePreview, fpText, piecesIn, reachable } from './preview';
import { pct } from './odds';
import type { RollStakes } from './reroll';
import { chooseAnswer, fortPlacement } from '../../ai/choose';
import { deployForMe } from '../../ai/deploy';

/** The human's selection while he answers a decision (reset with every new decision). */
export interface Sel {
  pieces: PieceId[];
  cards: CardId[];
  /** 'turn': choosing the cards to discard for a pass. */
  passing: boolean;
  /** 'react' / 'move': the Action option whose target is being picked. */
  option: number | null;
  /** 'fire': the target hex being previewed. 'deploy': the hex whose carrier is being picked. 'choose': the hex clicked. */
  hex: HexId | null;
  /** 'choose': the items picked (several allowed). */
  items: number[];
  /** 'fire': aiming a Smoke round instead of a Fire Attack. */
  smoke: boolean;
}

export const NO_SEL: Sel = { pieces: [], cards: [], passing: false, option: null, hex: null, items: [], smoke: false };

export interface PromptButton {
  key: string;
  label: string;
  /** Answer the decision. */
  answer?: Answer;
  /** Answer, then keep answering the same way (a path of moves: the controller sends each while it stays legal). */
  answers?: Answer[];
  /** Change the selection instead. */
  sel?: Partial<Sel>;
  /**
   * A special request for the screen: 'passRest' passes the rest of this Move's reaction windows; 'autoSetup' lets the
   * computer settle the rest of the human's set-up (pieces and Fortifications) — with `answer(s)` given as well.
   */
  special?: 'passRest' | 'autoSetup';
  primary?: boolean;
  tone?: 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  hint?: string;
  /** Show this card with the button. */
  card?: CardId;
  /** A line of explanation under the label. */
  text?: string;
  /** Pieces the button is about (highlighted while it is hovered). */
  pieces?: PieceId[];
  /** Picked (toggle lists). */
  on?: boolean;
}

export interface HexMark {
  hex: HexId;
  label: string;
  tone: 'move' | 'fire' | 'info';
}

export interface PromptModel {
  kind: string;
  title: string;
  text: string;
  /** Extra lines under the text (MP left, the fire preview ...). */
  detail: string[];
  /** Hexes lit as clickable. */
  selectable: HexId[];
  /** Hexes outlined as targets (also clickable). */
  targets: HexId[];
  /** Small labels drawn in hexes (MP left, FP). */
  marks: HexMark[];
  /** Pieces that can be clicked (on the board and as chips). */
  pieces: PieceId[];
  selected: PieceId[];
  /** Cards in the human's hand that can be clicked, with a tag ("Fire", "discard"). */
  cards: CardId[];
  cardTags: Record<CardId, string>;
  pickedCards: CardId[];
  /** Cards shown in the prompt itself (the roll to re-roll, the opponent's hand under Interrogation). */
  showCards: CardId[];
  /** The main buttons. */
  buttons: PromptButton[];
  /** A list of choices (Actions to play, choice items, generic answers). */
  list: PromptButton[];
  /** Show `list` folded away under this label (the board is the main way to choose, e.g. hexes). */
  listFolded?: string;
}

export interface ClickResult {
  sel?: Sel;
  answer?: Answer;
  /** A sequence of answers (the first now, the rest while they stay legal). */
  answers?: Answer[];
  notice?: string;
}

const legal = (s: GameState, d: Decision, a: Answer): boolean => {
  try {
    return !answerError(s, d, a);
  } catch {
    return false;
  }
};

function blank(kind: string, title: string, text: string): PromptModel {
  return {
    kind, title, text, detail: [], selectable: [], targets: [], marks: [], pieces: [], selected: [], cards: [], cardTags: {}, pickedCards: [],
    showCards: [], buttons: [], list: [],
  };
}

const uniq = <T>(xs: T[]): T[] => [...new Set(xs)];

function hexOfPiece(s: GameState, id: PieceId): HexId {
  const p = s.pieces[id];
  if (!p) return -1;
  if (p.where === 'map') return p.hex;
  if (p.where === 'carried' && p.carrier) {
    const c = s.pieces[p.carrier];
    return c?.where === 'map' ? c.hex : -1;
  }
  return -1;
}

function list(s: GameState, ids: PieceId[]): string {
  const n = ids.map((id) => pieceName(s, id));
  return n.length <= 2 ? n.join(' and ') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
}

function cardOrder(c: CardId): string {
  try {
    return cardOf(c).order;
  } catch {
    return 'card';
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The model

/** `stakes`: for a re-roll question, what the roll decides for the human (reroll.ts `rollStakes`). */
export function promptFor(s: GameState, d: Decision, sel: Sel, human: Side, stakes?: RollStakes | null): PromptModel {
  try {
    switch (d.kind) {
      case 'turn':
        return turnPrompt(s, d, sel);
      case 'activate':
        return activatePrompt(s, d, sel);
      case 'fire':
        return firePrompt(s, d, sel);
      case 'move':
        return movePrompt(s, d, sel);
      case 'advance':
        return advancePrompt(s, d, sel);
      case 'react':
        return reactPrompt(s, d, sel, human);
      case 'reroll':
        return rerollPrompt(s, d, human, stakes ?? null);
      case 'choose':
        return choosePrompt(s, d, sel);
      case 'deploy':
        return deployPrompt(s, d, sel);
      default:
        return genericPrompt(s, d as Decision);
    }
  } catch (e) {
    console.error('prompt failed', e);
    return genericPrompt(s, d);
  }
}

// ----------------------------------------------------------------------------------------------------------- turn

type D<K extends Decision['kind']> = Extract<Decision, { kind: K }>;

function turnPrompt(s: GameState, d: D<'turn'>, sel: Sel): PromptModel {
  const pl = s.players[d.side];
  const hand = pl.hand;
  const orderOf = new Map(d.orders.map((o) => [o.card, o.order]));
  if (sel.passing) {
    const m = blank('turn', 'Pass', d.maxDiscard ? `Choose up to ${d.maxDiscard} card${d.maxDiscard === 1 ? '' : 's'} to discard (or none), then pass.` : 'Pass your Turn.');
    m.cards = hand.slice();
    m.pickedCards = sel.cards.slice();
    for (const c of sel.cards) m.cardTags[c] = 'Discard';
    const n = sel.cards.length;
    m.buttons.push({
      key: 'pass', label: n ? `Pass and discard ${n}` : 'Pass, discard nothing', answer: { kind: 'pass', discard: sel.cards.slice() }, primary: true,
      disabled: n > d.maxDiscard, hint: n > d.maxDiscard ? `At most ${d.maxDiscard}` : undefined,
    });
    m.buttons.push({ key: 'back', label: 'Back', sel: { passing: false, cards: [] }, tone: 'ghost' });
    m.detail.push('After a pass your hand is refilled to its full size.');
    return m;
  }
  const t = s.turn;
  const title = d.canPass ? 'Your Turn' : `Your Turn — ${t.ordersGiven} of ${pl.orders} Order${pl.orders === 1 ? '' : 's'} given`;
  const text = d.orders.length
    ? `Click a lit card to give its Order${d.canPass ? ', or pass' : ', or end your Turn'}. You may give ${pl.orders - t.ordersGiven} more Order${pl.orders - t.ordersGiven === 1 ? '' : 's'}.`
    : d.canPass ? 'No card in your hand can give an Order now: pass (you may discard).' : 'No card in your hand can give another Order now.';
  const m = blank('turn', title, text);
  m.cards = d.orders.map((o) => o.card);
  for (const o of d.orders) m.cardTags[o.card] = o.order;
  const chosen = sel.cards[0];
  const order = chosen ? orderOf.get(chosen) : undefined;
  if (chosen && order) {
    m.pickedCards = [chosen];
    m.detail.push(`${order}: ${ORDER_TEXT[order]}`);
    m.buttons.push({ key: 'order', label: `Give the ${order} Order`, answer: { kind: 'order', card: chosen, order }, primary: true });
  }
  if (d.canPass) {
    if (d.maxDiscard > 0) m.buttons.push({ key: 'pass', label: 'Pass…', sel: { passing: true, cards: [] }, tone: order ? 'secondary' : undefined, primary: !order && !d.orders.length });
    else m.buttons.push({ key: 'pass', label: 'Pass', answer: { kind: 'pass', discard: [] }, tone: 'secondary' });
  } else {
    m.buttons.push({ key: 'end', label: 'End Turn', answer: { kind: 'endTurn' }, tone: order ? 'secondary' : undefined, primary: !order });
  }
  const dead = hand.filter((c) => !orderOf.has(c));
  if (dead.length && d.orders.length) m.detail.push(`${dead.length} card${dead.length === 1 ? '' : 's'} in your hand cannot give an Order now (hold them for their Actions).`);
  return m;
}

// ------------------------------------------------------------------------------------------------------- activate

function activatePrompt(s: GameState, d: D<'activate'>, sel: Sel): PromptModel {
  const what = d.order === 'Op Fire' ? 'Op Fire' : `${d.order} Order`;
  const first = sel.pieces[0];
  const fp = first ? s.pieces[first] : undefined;
  // a unit activated alone (the Spotter) brings nobody, whatever his Command
  const leader = !d.alone && !!fp && isLeader(fp) && d.units.includes(first);
  const radius = leader ? commandRadius(s, fp!) : [];
  const m = blank('activate', `${what}: activate`, '');
  if (!d.units.length && d.players?.length) {
    m.text = d.order === 'Recover' ? 'Recover: remove your Suppressed markers and roll to rally each broken unit.' : 'Rout: choose the player whose broken units you roll for.';
  } else if (d.alone && !first) {
    m.text = `Click a Leader to make him the ${d.alone}: he is activated alone.`;
  } else if (d.alone) {
    m.text = `${pieceName(s, first)} is the ${d.alone}, activated alone.`;
  } else if (!first) {
    m.text = 'Click a unit to activate it. A Leader can bring the units within his Command radius.';
  } else if (leader) {
    const c = typeOf(fp!).front.command;
    m.text = `${pieceName(s, first)} brings the units within ${c} hex${c === 1 ? '' : 'es'}: click them to add or remove.`;
  } else {
    m.text = `${pieceName(s, first)} is activated alone.`;
  }
  m.pieces = uniq([...d.units, ...radius]);
  m.selected = sel.pieces.slice();
  m.selectable = uniq(m.pieces.map((id) => hexOfPiece(s, id)).filter((h) => h >= 0));
  if (leader) {
    for (const id of radius) {
      const h = hexOfPiece(s, id);
      if (h >= 0 && !m.marks.some((x) => x.hex === h)) m.marks.push({ hex: h, label: 'radius', tone: 'info' });
    }
  }
  if (sel.pieces.length) {
    const err = activationError(s, d, sel.pieces);
    m.buttons.push({
      key: 'go', label: `Activate ${sel.pieces.length === 1 ? pieceName(s, first) : `${sel.pieces.length} units`}`, primary: true,
      answer: { kind: 'activate', units: sel.pieces.slice() }, disabled: !!err, hint: err ?? undefined,
    });
    m.buttons.push({ key: 'clear', label: 'Clear', sel: { pieces: [] }, tone: 'ghost' });
  }
  for (const p of d.players ?? []) {
    const label = d.order === 'Recover' ? 'Recover' : p === d.side ? `Rout your own broken units` : `Rout the ${sideName(s, p)}`;
    m.buttons.push({ key: `player-${p}`, label, answer: { kind: 'activatePlayer', player: p }, primary: !d.units.length && (d.players?.length ?? 0) === 1 });
  }
  return m;
}

function activateClickPiece(s: GameState, d: D<'activate'>, sel: Sel, id: PieceId): ClickResult {
  const first = sel.pieces[0];
  const fp = first ? s.pieces[first] : undefined;
  if (d.alone) {
    if (!d.units.includes(id)) return { notice: `Only an unbroken Leader not yet activated can be the ${d.alone}.` };
    return { sel: { ...sel, pieces: first === id ? [] : [id] } };
  }
  if (fp && isLeader(fp) && commandRadius(s, fp).includes(id)) {
    const on = sel.pieces.includes(id);
    return { sel: { ...sel, pieces: on ? sel.pieces.filter((x) => x !== id) : [...sel.pieces, id] } };
  }
  if (d.units.includes(id)) {
    if (first === id) return { sel: { ...sel, pieces: [] } };
    const p = s.pieces[id];
    return { sel: { ...sel, pieces: isLeader(p) ? [id, ...commandRadius(s, p)] : [id] } };
  }
  return { notice: 'That unit cannot be activated now.' };
}

function activateClickHex(s: GameState, d: D<'activate'>, sel: Sel, hex: HexId): ClickResult {
  const here = piecesIn(s, hex).filter((id) => isUnit(s.pieces[id]));
  const first = sel.pieces[0];
  const fp = first ? s.pieces[first] : undefined;
  if (fp && isLeader(fp) && !d.alone) {
    const radius = commandRadius(s, fp).filter((id) => here.includes(id));
    if (radius.length) {
      const allOn = radius.every((id) => sel.pieces.includes(id));
      return { sel: { ...sel, pieces: allOn ? sel.pieces.filter((x) => !radius.includes(x)) : uniq([...sel.pieces, ...radius]) } };
    }
  }
  const cands = here.filter((id) => d.units.includes(id));
  if (!cands.length) return {};
  const lead = cands.find((id) => isLeader(s.pieces[id]));
  return activateClickPiece(s, d, { ...sel, pieces: [] }, lead ?? cands[0]);
}

// ----------------------------------------------------------------------------------------------------------- fire

function firePool(s: GameState, d: D<'fire'>): PieceId[] {
  return d.pieces.filter((id) => !!shooter(s, id, d.mode === 'opFire'));
}

function fireTargets(s: GameState, d: D<'fire'>, pieces: PieceId[]): HexId[] {
  if (!pieces.length) return [...fireOptions(s, d.pieces, d.mode, d.target).keys()];
  const cands = d.target !== undefined ? [d.target] : enemyHexes(s, d.side);
  return cands.filter((t) => !fireSpecError(s, d.side, { pieces, target: t }, d.pieces, d.mode, d.target));
}

/** The strongest legal Fire Attack on `hex` from the pool. */
function bestSpec(s: GameState, d: D<'fire'>, hex: HexId): PieceId[] | null {
  const specs = fireOptions(s, d.pieces, d.mode, d.target).get(hex) ?? [];
  let best: PieceId[] | null = null;
  let fp = -Infinity;
  for (const sp of specs) {
    const p = firePreview(s, sp.pieces, hex);
    const v = p.targeting !== null ? p.fp * p.targeting : p.fp;
    if (v > fp) {
      fp = v;
      best = sp.pieces;
    }
  }
  return best;
}

function smokePrompt(s: GameState, d: D<'fire'>, sel: Sel): PromptModel {
  const specs = smokeOptions(s, d.pieces, d.mode);
  const weapons = uniq(specs.map((x) => x.pieces[0]));
  const w = sel.pieces.find((id) => weapons.includes(id)) ?? (weapons.length === 1 ? weapons[0] : null);
  const m = blank('fire', 'Smoke round', '');
  m.pieces = weapons;
  m.selected = w ? [w] : [];
  if (!w) {
    m.text = 'Click the Weapon that fires Smoke.';
    m.selectable = uniq(weapons.map((id) => hexOfPiece(s, id)).filter((h) => h >= 0));
  } else {
    const targets = specs.filter((x) => x.pieces[0] === w).map((x) => x.target);
    m.selectable = targets;
    m.text = `${pieceName(s, w)}: click the hex for the Smoke (any hex in Range and line of sight). A Targeting roll must hit.`;
    if (sel.hex !== null && targets.includes(sel.hex)) {
      const p = firePreview(s, [w], sel.hex);
      m.targets = [sel.hex];
      m.detail.push(`Targeting roll at range ${p.range}: ${pct(p.targeting ?? 0)} to hit. A hit places a random Smoke marker.`);
      m.buttons.push({ key: 'fire', label: `Smoke on ${hexName(sel.hex)}`, primary: true, answer: { kind: 'fire', spec: { pieces: [w], target: sel.hex, smoke: true } } });
    }
  }
  m.buttons.push({ key: 'back', label: 'Back to firing', sel: { smoke: false, pieces: [], hex: null }, tone: 'ghost' });
  if (!d.mustFire) m.buttons.push({ key: 'done', label: 'Stop firing', answer: { kind: 'done' }, tone: 'secondary' });
  return m;
}

function firePrompt(s: GameState, d: D<'fire'>, sel: Sel): PromptModel {
  if (sel.smoke) return smokePrompt(s, d, sel);
  const title = d.mode === 'opFire' ? 'Op Fire' : d.mode === 'assault' ? 'Assault Fire' : 'Fire Order';
  const pool = firePool(s, d);
  const pieces = sel.pieces.filter((id) => pool.includes(id));
  const targets = fireTargets(s, d, pieces);
  const m = blank('fire', title, '');
  m.pieces = pool;
  m.selected = pieces;
  m.targets = targets;
  m.selectable = uniq(pool.map((id) => hexOfPiece(s, id)).filter((h) => h >= 0 && !targets.includes(h)));
  for (const t of targets) {
    const ps = pieces.length ? pieces : bestSpec(s, d, t);
    if (!ps) continue;
    const p = firePreview(s, ps, t);
    m.marks.push({ hex: t, label: p.targeting !== null ? `${pct(p.targeting)} hit` : `${p.fp} FP`, tone: 'fire' });
  }
  if (!pieces.length) {
    m.text = targets.length
      ? `Click a target (red) to aim your strongest attack at it, or click your units and Weapons to choose who fires.${d.target !== undefined ? ` Only ${hexName(d.target)} may be fired at.` : ''}`
      : smokeOptions(s, d.pieces, d.mode).length ? 'No enemy is in reach, but a Weapon can fire Smoke.' : 'None of your activated pieces can fire at anything now.';
  } else {
    m.text = `${list(s, pieces)}${pieces.length > 1 ? ' fire as a Fire Group' : ' fires'}. ${targets.length ? 'Click a red hex to aim.' : 'They cannot fire at anything together: change the group.'}`;
  }
  const target = sel.hex !== null && targets.includes(sel.hex) && pieces.length ? sel.hex : null;
  if (target !== null) {
    const p = firePreview(s, pieces, target);
    if (p.targeting !== null) m.detail.push(`Targeting roll: ${pct(p.targeting)} to hit at range ${p.range}; then a Fire Attack of ${p.fp} FP.`);
    else m.detail.push(`Attack: ${fpText(p)} + a roll.`);
    for (const x of p.defenders) {
      const odds = `${pct(x.breaks)} breaks${x.ties ? `, ${pct(x.ties)} suppressed` : ''}`;
      m.detail.push(`${x.name}: Morale ${x.morale - x.cover} + ${x.cover} Cover = ${x.morale} — ${odds}${x.moving ? ' (moving: a tie breaks it)' : ''}.`);
    }
    m.buttons.push({ key: 'fire', label: `Fire at ${hexName(target)}`, primary: true, answer: { kind: 'fire', spec: { pieces: pieces.slice(), target } } });
  }
  if (pieces.length) m.buttons.push({ key: 'clear', label: 'Clear', sel: { pieces: [], hex: null }, tone: 'ghost' });
  if (smokeOptions(s, d.pieces, d.mode).length) {
    m.buttons.push({ key: 'smoke', label: 'Fire Smoke…', sel: { smoke: true, pieces: [], hex: null }, tone: 'secondary', text: 'A Weapon marked Smoke may place Smoke instead of attacking.' });
  }
  if (!d.mustFire) {
    m.buttons.push({ key: 'done', label: d.mode === 'opFire' ? 'Hold fire' : 'Stop firing', answer: { kind: 'done' }, tone: 'secondary' });
  }
  const fired = s.turn.fired.length;
  if (fired && d.mode === 'order') m.detail.push(`${fired} piece${fired === 1 ? ' has' : 's have'} fired in this Order.`);
  return m;
}

function fireClickHex(s: GameState, d: D<'fire'>, sel: Sel, hex: HexId): ClickResult {
  if (sel.smoke) {
    const specs = smokeOptions(s, d.pieces, d.mode);
    const weapons = uniq(specs.map((x) => x.pieces[0]));
    const w = sel.pieces.find((id) => weapons.includes(id)) ?? (weapons.length === 1 ? weapons[0] : null);
    if (w && specs.some((x) => x.pieces[0] === w && x.target === hex)) {
      if (sel.hex === hex) return { answer: { kind: 'fire', spec: { pieces: [w], target: hex, smoke: true } } };
      return { sel: { ...sel, pieces: [w], hex } };
    }
    const here = weapons.filter((id) => hexOfPiece(s, id) === hex);
    return here.length ? { sel: { ...sel, pieces: [here[0]], hex: null } } : {};
  }
  const pool = firePool(s, d);
  const pieces = sel.pieces.filter((id) => pool.includes(id));
  const targets = fireTargets(s, d, pieces);
  if (targets.includes(hex)) {
    if (pieces.length) {
      if (sel.hex === hex) return { answer: { kind: 'fire', spec: { pieces, target: hex } } };
      return { sel: { ...sel, pieces, hex } };
    }
    const best = bestSpec(s, d, hex);
    if (best) return { sel: { ...sel, pieces: best, hex } };
    return {};
  }
  const mine = piecesIn(s, hex).filter((id) => pool.includes(id));
  if (mine.length) {
    const allOn = mine.every((id) => pieces.includes(id));
    const next = allOn ? pieces.filter((x) => !mine.includes(x)) : uniq([...pieces, ...mine]);
    return { sel: { ...sel, pieces: next, hex: null } };
  }
  return targets.length ? { notice: 'Click a red hex to fire at it.' } : {};
}

function fireClickPiece(s: GameState, d: D<'fire'>, sel: Sel, id: PieceId): ClickResult {
  if (sel.smoke) return { sel: { ...sel, pieces: [id], hex: null } };
  const pool = firePool(s, d);
  if (!pool.includes(id)) {
    const h = hexOfPiece(s, id);
    return h >= 0 ? fireClickHex(s, d, sel, h) : {};
  }
  const on = sel.pieces.includes(id);
  const pieces = on ? sel.pieces.filter((x) => x !== id) : [...sel.pieces, id];
  const keep = sel.hex !== null && fireTargets(s, d, pieces).includes(sel.hex) ? sel.hex : null;
  return { sel: { ...sel, pieces, hex: keep } };
}

// ----------------------------------------------------------------------------------------------------------- move

function moveGroup(s: GameState, d: D<'move'>, sel: Sel): PieceId[] {
  if (d.current) return d.current;
  const g = sel.pieces.filter((id) => d.units.includes(id));
  if (!g.length) return [];
  const h = s.pieces[g[0]].hex;
  return g.filter((id) => s.pieces[id].hex === h);
}

/** Action options grouped: one entry per Action (several cards of the same Action are the same choice). */
function groupOptions(opts: ActionOption[]): { index: number; count: number; opt: ActionOption }[] {
  const out: { index: number; count: number; opt: ActionOption; key: string }[] = [];
  opts.forEach((o, index) => {
    const key = `${o.action}|${o.card ? 'card' : 'free'}|${JSON.stringify(o.targets ?? null)}`;
    const g = out.find((x) => x.key === key);
    if (g) g.count++;
    else out.push({ index, count: 1, opt: o, key });
  });
  return out;
}

function optionTargetsPrompt(s: GameState, m: PromptModel, opt: ActionOption): void {
  const t = opt.targets ?? {};
  if (t.hexes?.length) {
    m.targets = t.hexes.slice();
    m.text = `${opt.action}: click the hex.`;
  }
  if (t.pieces?.length) {
    m.pieces = t.pieces.slice();
    m.selectable = uniq(t.pieces.map((id) => hexOfPiece(s, id)).filter((h) => h >= 0));
    m.text = `${opt.action}: click the unit.`;
    for (const id of t.pieces) m.list.push({ key: `t-${id}`, label: `${pieceName(s, id)} (${hexName(hexOfPiece(s, id))})`, pieces: [id] });
  }
}

function playAnswer(opt: ActionOption, index: number, pick?: { piece?: PieceId; hex?: HexId }): Answer | null {
  const t = opt.targets;
  if (!t) return { kind: 'play', option: index };
  const targets: { pieces?: PieceId[]; hexes?: HexId[] } = {};
  if (t.pieces?.length) {
    if (pick?.piece !== undefined && t.pieces.includes(pick.piece)) targets.pieces = [pick.piece];
    else if (t.pieces.length === 1) targets.pieces = [t.pieces[0]];
    else return null;
  }
  if (t.hexes?.length) {
    if (pick?.hex !== undefined && t.hexes.includes(pick.hex)) targets.hexes = [pick.hex];
    else if (t.hexes.length === 1) targets.hexes = [t.hexes[0]];
    else return null;
  }
  return { kind: 'play', option: index, targets };
}

function movePrompt(s: GameState, d: D<'move'>, sel: Sel): PromptModel {
  const m = blank('move', 'Move Order', '');
  const actions = d.actions ?? [];
  if (sel.option !== null && actions[sel.option]) {
    const opt = actions[sel.option];
    optionTargetsPrompt(s, m, opt);
    m.buttons.push({ key: 'cancel', label: 'Cancel', sel: { option: null }, tone: 'ghost' });
    return m;
  }
  const group = moveGroup(s, d, sel);
  m.pieces = d.current ? [] : d.units.slice();
  m.selected = group.slice();
  if (!d.current) m.selectable = uniq(d.units.map((id) => s.pieces[id].hex));
  if (group.length) {
    const reach = reachable(s, group);
    const from = s.pieces[group[0]].hex;
    const steps = neighbours(from).filter((to) => legal(s, d, { kind: 'moveStep', units: group, to }));
    const lit: HexId[] = [];
    for (const [h, r] of reach) {
      if (!steps.includes(r.path[0])) continue;
      lit.push(h);
      m.marks.push({ hex: h, label: `${r.left} MP`, tone: 'move' });
    }
    for (const h of steps) if (!lit.includes(h)) lit.push(h);
    m.selectable = uniq([...(d.current ? [] : m.selectable.filter((h) => h === from)), ...lit]);
    const mp = group.map((id) => `${pieceName(s, id)} ${d.mp[id] ?? mpLeft(s, id)}`).join(', ');
    m.text = d.current
      ? `${list(s, group)} ${group.length > 1 ? 'are' : 'is'} moving. Click a lit hex to go on (each hex entered may draw Op Fire), or stop.`
      : `Click a lit hex to move ${list(s, group)}${group.length > 1 ? ' together' : ''}.`;
    m.detail.push(`MP left: ${mp}.`);
    if (legal(s, d, { kind: 'exit', units: group })) {
      m.buttons.push({ key: 'exit', label: 'Exit the map (1 MP)', answer: { kind: 'exit', units: group.slice() }, tone: 'secondary', text: 'Exited units score VP and wait on the Time Track.' });
    }
    for (const id of group) {
      const g = s.pieces[id];
      if (!g.weapon) continue;
      for (const r of piecesIn(s, g.hex)) {
        const a: Answer = { kind: 'transfer', from: id, to: r };
        if (r !== id && isUnit(s.pieces[r]) && legal(s, d, a)) {
          m.buttons.push({ key: `tr-${id}-${r}`, label: `Hand the ${pieceName(s, g.weapon)} to ${pieceName(s, r)} (1 MP)`, answer: a, tone: 'ghost', pieces: [r] });
        }
      }
    }
  } else {
    m.text = d.units.length ? 'Click a unit (or a stack: its units move together) to move it.' : 'No activated unit can move any further.';
    if (d.mustMove) m.detail.push('A Move Order must move at least one unit into another hex.');
  }
  for (const g of groupOptions(actions)) {
    m.list.push({
      key: `act-${g.index}`, label: g.opt.action, card: g.opt.card || undefined, text: ACTION_TEXT[g.opt.action],
      ...(g.opt.targets && !playAnswer(g.opt, g.index) ? { sel: { option: g.index } } : { answer: playAnswer(g.opt, g.index)! }),
    });
  }
  if (d.current) m.buttons.push({ key: 'stop', label: 'Stop this group', answer: { kind: 'done' }, tone: 'secondary' });
  else {
    if (group.length) m.buttons.push({ key: 'clear', label: 'Clear', sel: { pieces: [] }, tone: 'ghost' });
    const ok = legal(s, d, { kind: 'done' });
    m.buttons.push({ key: 'end', label: 'End the Move', answer: { kind: 'done' }, tone: 'secondary', disabled: !ok, hint: ok ? undefined : 'Move at least one unit first' });
  }
  return m;
}

function moveClickHex(s: GameState, d: D<'move'>, sel: Sel, hex: HexId): ClickResult {
  const actions = d.actions ?? [];
  if (sel.option !== null && actions[sel.option]) {
    const a = playAnswer(actions[sel.option], sel.option, { hex });
    return a ? { answer: a } : {};
  }
  const group = moveGroup(s, d, sel);
  if (group.length) {
    const from = s.pieces[group[0]].hex;
    if (hex !== from) {
      const r = reachable(s, group).get(hex);
      if (r && legal(s, d, { kind: 'moveStep', units: group, to: r.path[0] })) {
        return { answers: r.path.map((to) => ({ kind: 'moveStep', units: group.slice(), to }) as Answer) };
      }
      const step: Answer = { kind: 'moveStep', units: group.slice(), to: hex };
      if (legal(s, d, step)) return { answer: step };
    }
  }
  if (d.current) return { notice: 'The group moving now finishes before another starts.' };
  const here = d.units.filter((id) => s.pieces[id].hex === hex);
  if (here.length) {
    const same = here.length === group.length && here.every((id) => group.includes(id));
    return { sel: { ...sel, pieces: same ? [] : here } };
  }
  return group.length ? { notice: 'They cannot get there.' } : {};
}

function moveClickPiece(s: GameState, d: D<'move'>, sel: Sel, id: PieceId): ClickResult {
  const actions = d.actions ?? [];
  if (sel.option !== null && actions[sel.option]) {
    const a = playAnswer(actions[sel.option], sel.option, { piece: id });
    return a ? { answer: a } : {};
  }
  if (d.current || !d.units.includes(id)) {
    const h = hexOfPiece(s, id);
    return h >= 0 ? moveClickHex(s, d, sel, h) : {};
  }
  const group = moveGroup(s, d, sel);
  if (group.length && s.pieces[group[0]].hex !== s.pieces[id].hex) return { sel: { ...sel, pieces: [id] } };
  const on = group.includes(id);
  return { sel: { ...sel, pieces: on ? group.filter((x) => x !== id) : [...group, id] } };
}

// -------------------------------------------------------------------------------------------------------- advance

function advanceUnit(d: D<'advance'>, sel: Sel): PieceId | null {
  const u = sel.pieces.find((id) => d.units.includes(id));
  return u ?? (d.units.length === 1 ? d.units[0] : null);
}

function advancePrompt(s: GameState, d: D<'advance'>, sel: Sel): PromptModel {
  const m = blank('advance', 'Advance', '');
  const unit = advanceUnit(d, sel);
  m.pieces = d.units.slice();
  m.selected = unit ? [unit] : [];
  if (!unit) {
    m.text = 'Click an activated unit, then the adjacent hex it advances into (an enemy hex starts a melee).';
    m.selectable = uniq(d.units.map((id) => hexOfPiece(s, id)));
  } else {
    const from = hexOfPiece(s, unit);
    const to = neighbours(from).filter((h) => legal(s, d, { kind: 'advanceTo', unit, to: h }));
    m.selectable = to;
    m.targets = to.filter((h) => Object.values(s.pieces).some((p) => p.where === 'map' && p.hex === h && p.side !== d.side && isUnit(p)));
    m.text = `${pieceName(s, unit)}: click the hex it advances into${m.targets.length ? ' (red: enemy — melee follows)' : ''}.`;
    if (legal(s, d, { kind: 'exit', units: [unit] })) m.buttons.push({ key: 'exit', label: 'Exit the map', answer: { kind: 'exit', units: [unit] }, tone: 'secondary' });
  }
  m.detail.push(`${d.units.length} unit${d.units.length === 1 ? '' : 's'} still to advance.`);
  const ok = legal(s, d, { kind: 'done' });
  m.buttons.push({ key: 'done', label: 'Finish the Advance', answer: { kind: 'done' }, tone: 'secondary', disabled: !ok, hint: ok ? undefined : 'Advance at least one unit first' });
  return m;
}

function advanceClick(s: GameState, d: D<'advance'>, sel: Sel, hex: HexId, piece?: PieceId): ClickResult {
  if (piece && d.units.includes(piece)) return { sel: { ...sel, pieces: [piece] } };
  const unit = advanceUnit(d, sel);
  if (unit) {
    const a: Answer = { kind: 'advanceTo', unit, to: hex };
    if (legal(s, d, a)) return { answer: a };
  }
  const here = d.units.filter((id) => hexOfPiece(s, id) === hex);
  if (here.length) return { sel: { ...sel, pieces: [here.find((x) => x !== unit) ?? here[0]] } };
  return unit ? { notice: 'It cannot advance there.' } : {};
}

// ---------------------------------------------------------------------------------------------------------- react

function reactPrompt(s: GameState, d: D<'react'>, sel: Sel, human: Side): PromptModel {
  const info = d.info;
  const m = blank('react', WINDOW_TEXT[d.window] ?? 'Play an Action?', '');
  const hex = info.hex !== undefined ? hexName(info.hex) : '';
  switch (d.window) {
    case 'afterHexEntry':
      m.title = 'Opportunity Fire?';
      m.text = `The ${sideName(s, info.mover ?? other(human))} entered ${hex}${info.units?.length ? ` with ${list(s, info.units)}` : ''}. You may answer with an Action, or let them carry on.`;
      break;
    case 'afterAdvanceEntry':
      m.text = `The ${sideName(s, info.mover ?? other(human))} advanced into ${hex}.`;
      break;
    case 'beforeFireAttackRoll':
      m.text = `Your Fire Attack on ${info.attack?.targets.map(hexName).join(' and ') ?? hex} is about to be rolled.`;
      break;
    case 'beforeDefenseRoll':
      m.text = `${info.units?.length ? pieceName(s, info.units[0]) : 'Your unit'} in ${hex} is about to roll for Defense.`;
      break;
    case 'squadWouldBreak':
      m.text = `${info.units?.length ? pieceName(s, info.units[0]) : 'Your Squad'} in ${hex} is about to break.`;
      break;
    case 'beforeMelee':
      m.text = `A melee is about to be fought in ${hex}.`;
      break;
    case 'afterMelee':
      m.text = `The melee in ${hex} is over.`;
      break;
    case 'opponentPassed':
      m.text = `The ${sideName(s, other(d.side))} passed and discarded ${info.discards ?? 0} card${info.discards === 1 ? '' : 's'}.`;
      break;
    case 'timeAdvanceEnd':
      m.text = 'Time has advanced. You may play an Action now.';
      break;
    default:
      m.text = 'You may play an Action.';
  }
  const at = info.attack;
  if (at) {
    m.detail.push(`Attack: ${at.fp}${at.bonus ? ` + ${at.bonus}` : ''} FP on ${at.targets.map(hexName).join(' and ')}${at.total !== null ? `, total ${at.total - at.reduction}` : ''}${at.played.length ? ` (played: ${at.played.join(', ')})` : ''}.`);
  }
  if (info.hex !== undefined) m.targets = [info.hex];
  if (sel.option !== null && d.options[sel.option]) {
    optionTargetsPrompt(s, m, d.options[sel.option]);
    m.buttons.push({ key: 'cancel', label: 'Cancel', sel: { option: null }, tone: 'ghost' });
    return m;
  }
  for (const g of groupOptions(d.options)) {
    const o = g.opt;
    let label: string = o.action;
    let text = ACTION_TEXT[o.action];
    if (o.action === 'Fire') {
      if (!o.card) {
        label = `Op Fire at ${hex}`;
        text = 'Fire at the hex just entered with your units already activated for Op Fire this Move.';
      } else {
        label = 'Op Fire: activate units';
        text = 'Play a Fire card to activate a unit (or a Leader and his radius) for Op Fire during this Move.';
      }
    }
    const a = playAnswer(o, g.index);
    m.list.push({
      key: `opt-${g.index}`, label: g.count > 1 ? `${label} (${g.count} cards)` : label, card: o.card || undefined, text,
      ...(a ? { answer: a } : { sel: { option: g.index } }),
    });
  }
  m.buttons.push({ key: 'pass', label: 'Pass', answer: { kind: 'done' }, tone: 'secondary' });
  if (d.window === 'afterHexEntry') m.buttons.push({ key: 'passRest', label: 'Pass for the rest of this Move', special: 'passRest', tone: 'ghost' });
  return m;
}

function reactClick(s: GameState, d: D<'react'>, sel: Sel, pick: { hex?: HexId; piece?: PieceId }): ClickResult {
  if (sel.option === null || !d.options[sel.option]) return {};
  const a = playAnswer(d.options[sel.option], sel.option, pick);
  return a ? { answer: a } : { notice: 'Choose one of the lit targets.' };
}

// --------------------------------------------------------------------------------------------------------- reroll

function rerollPrompt(s: GameState, d: D<'reroll'>, human: Side, stakes: RollStakes | null): PromptModel {
  const r = d.roll;
  let v = '?';
  let dice = '';
  try {
    const c = cardOf(r.card);
    const prod = r.purpose === 'targeting' || r.purpose === 'accuracy';
    v = String(prod ? c.white * c.red : c.white + c.red);
    dice = prod ? `${c.white}×${c.red}` : `${c.white}+${c.red}`;
  } catch {
    /* unknown card */
  }
  const who = r.side === human ? 'You' : `The ${sideName(s, r.side)}`;
  const m = blank('reroll', 'Initiative re-roll?', `${who} rolled ${v} (${dice}) for ${PURPOSE_TEXT[r.purpose] ?? r.purpose}. You hold the Initiative: you may cancel the roll and have it rolled again. The Initiative card then passes to the ${sideName(s, other(human))}.`);
  m.showCards = [r.card];
  m.buttons.push({ key: 'keep', label: 'Keep the roll', answer: { kind: 'reroll', yes: false }, primary: true });
  m.buttons.push({ key: 'reroll', label: 'Re-roll', answer: { kind: 'reroll', yes: true }, tone: 'danger' });
  // what the roll had to reach, and whether a re-roll would on average do better
  if (stakes) m.detail.push(...stakes.lines);
  m.detail.push('The Initiative also wins a tied battle: give it away only when the roll matters.');
  return m;
}

// --------------------------------------------------------------------------------------------------------- choose

function itemLabel(s: GameState, reason: string, it: ChoiceItem): string {
  if ('piece' in it) {
    const h = itemHex(s, it);
    return `${pieceName(s, it.piece)}${h !== null && h >= 0 ? ` (${hexName(h)})` : ''}`;
  }
  if ('hex' in it) return hexName(it.hex);
  if ('card' in it) return cardOrder(it.card);
  if ('chit' in it) return `Chit ${it.chit}: ${chitText(it.chit)}`;
  if ('type' in it) return counterName(it.type);
  if ('space' in it) return `Time space ${it.space}`;
  if ('label' in it) return labelText(reason, it.label);
  return '?';
}

function choosePrompt(s: GameState, d: D<'choose'>, sel: Sel): PromptModel {
  const w = choiceWords(d.reason, d.context);
  const single = d.max === 1;
  const m = blank('choose', w.title, `${w.text}${single ? '' : ` ${countText(d.min, d.max)}`}`);
  const picked = sel.items.filter((i) => i >= 0 && i < d.items.length);
  d.items.forEach((it, i) => {
    const h = itemHex(s, it);
    if (h !== null && h >= 0) {
      if ('hex' in it) m.selectable.push(h);
      else if (!m.selectable.includes(h)) m.selectable.push(h);
    }
    if ('piece' in it) m.pieces.push(it.piece);
    if ('card' in it) m.showCards.push(it.card);
    const on = picked.includes(i);
    m.list.push({
      key: `it-${i}`, label: itemLabel(s, d.reason, it), card: 'card' in it ? it.card : undefined, on,
      pieces: 'piece' in it ? [it.piece] : undefined,
      ...(single ? { answer: { kind: 'choose', items: [i] } } : { sel: { items: on ? picked.filter((x) => x !== i) : [...picked, i] } }),
    });
  });
  m.selected = picked.map((i) => d.items[i]).filter((it): it is { piece: string } => 'piece' in it).map((it) => it.piece);
  // a card the choice is about (a scenario option's card): shown with it
  const about = (d.context as { card?: unknown } | undefined)?.card;
  if (typeof about === 'string' && !m.showCards.includes(about)) m.showCards.push(about);
  if (sel.hex !== null) m.targets = [sel.hex];
  if (!single) {
    const n = picked.length;
    m.buttons.push({ key: 'ok', label: `Confirm (${n})`, primary: true, answer: { kind: 'choose', items: picked.slice() }, disabled: n < d.min || n > d.max, hint: countText(d.min, d.max) });
  }
  if (d.min === 0) m.buttons.push({ key: 'none', label: w.none ?? 'None', answer: { kind: 'choose', items: [] }, tone: 'secondary' });
  // hexes are chosen on the board: say so, and fold the list of hex labels away (a fallback)
  if (d.items.length > 4 && d.items.every((it) => 'hex' in it)) {
    m.text = `${m.text} Click a lit hex on the map.`;
    m.listFolded = `Or pick from a list of the ${d.items.length} hexes`;
  }
  // a set-up Fortification: the computer may place this one and the rest
  if (d.reason === 'placement' && s.phase === 'setup') {
    m.buttons.push({ key: 'autoFort', label: 'Place the rest for me', special: 'autoSetup', answer: { kind: 'choose', items: setupChoice(s, d) }, tone: 'secondary' });
  }
  return m;
}

function chooseIndex(s: GameState, d: D<'choose'>, sel: Sel, i: number): ClickResult {
  if (d.max === 1) return { answer: { kind: 'choose', items: [i] } };
  const on = sel.items.includes(i);
  if (!on && sel.items.length >= d.max) return { notice: `At most ${d.max}.` };
  return { sel: { ...sel, items: on ? sel.items.filter((x) => x !== i) : [...sel.items, i] } };
}

function chooseClickHex(s: GameState, d: D<'choose'>, sel: Sel, hex: HexId): ClickResult {
  const idx = d.items.map((it, i) => (itemHex(s, it) === hex ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return {};
  if (idx.length === 1) return chooseIndex(s, d, sel, idx[0]);
  const hexItem = idx.find((i) => 'hex' in d.items[i]);
  if (hexItem !== undefined) return chooseIndex(s, d, sel, hexItem);
  return { sel: { ...sel, hex }, notice: 'Several choices in that hex: pick one from the list.' };
}

/** The computer's pick for one of the human's set-up choices (a Fortification's hex): the AI's own judgement. */
export function setupChoice(s: GameState, d: D<'choose'>): number[] {
  try {
    // Foxholes, Trenches, a Pillbox or Bunker go with the human's own units (where they do him good from the start),
    // best by the AI's judgement of each hex (Objectives, poor terrain Cover); Wire and Mines by the AI's choice, in
    // front of his line toward the enemy
    const kind = String((d.context as { fort?: string } | undefined)?.fort ?? '');
    if (d.reason === 'placement' && kind && kind !== 'wire' && kind !== 'mines' && d.min === 1 && d.max === 1) {
      const manned = d.items
        .map((it, i) => ({ i, h: 'hex' in it ? it.hex : -1 }))
        .filter((x) => x.h >= 0 && Object.values(s.pieces).some((p) => p.where === 'map' && p.hex === x.h && p.side === d.side && isUnit(p)));
      if (manned.length) {
        let best = manned[0];
        let v = -Infinity;
        for (const x of manned) {
          const sc = fortPlacement(s, d.side, x.h, kind);
          if (sc > v) {
            v = sc;
            best = x;
          }
        }
        return [best.i];
      }
    }
    const pick = chooseAnswer(s, d, d.side);
    if (pick.length >= d.min && pick.length <= d.max) return pick;
  } catch (e) {
    console.error('set-up choice', e);
  }
  return d.items.slice(0, Math.max(d.min, Math.min(1, d.max))).map((_, i) => i);
}

// --------------------------------------------------------------------------------------------------------- deploy

function deployPiece(s: GameState, d: D<'deploy'>, sel: Sel): PieceId | null {
  const chosen = sel.pieces.find((id) => d.pieces.includes(id));
  if (chosen) return chosen;
  return d.pieces.find((id) => isUnit(s.pieces[id])) ?? d.pieces[0] ?? null;
}

function deployPrompt(s: GameState, d: D<'deploy'>, sel: Sel): PromptModel {
  const setup = s.phase === 'setup';
  const m = blank('deploy', setup ? 'Set up your forces' : 'Reinforcements', '');
  const piece = deployPiece(s, d, sel);
  m.pieces = d.pieces.slice();
  m.selected = piece ? [piece] : [];
  if (piece) {
    const hexes = d.hexes.filter((h) => legal(s, d, { kind: 'deploy', piece, hex: h }));
    m.selectable = hexes;
    const weapon = typeOf(s.pieces[piece]).kind === 'weapon';
    m.text = `Place the ${pieceName(s, piece)}: click a lit hex${weapon ? ' with a unit of yours that carries no Weapon' : ''}. ${d.pieces.length} piece${d.pieces.length === 1 ? '' : 's'} left to place.`;
    if (sel.hex !== null && weapon) {
      const carriers = piecesIn(s, sel.hex).filter((id) => {
        const u = s.pieces[id];
        return isUnit(u) && u.side === d.side && !u.weapon;
      });
      m.targets = [sel.hex];
      m.text = `Who carries the ${pieceName(s, piece)} in ${hexName(sel.hex)}?`;
      for (const c of carriers) m.list.push({ key: `c-${c}`, label: pieceName(s, c), answer: { kind: 'deploy', piece, hex: sel.hex, carrier: c }, pieces: [c] });
      m.buttons.push({ key: 'back', label: 'Back', sel: { hex: null }, tone: 'ghost' });
    }
  } else m.text = 'Everything is placed.';
  m.buttons.push({
    key: 'auto', label: setup ? 'Deploy the rest for me' : 'Place the rest for me', answer: { kind: 'done' }, answers: deployForMe(s, d), tone: 'secondary',
    ...(setup ? { special: 'autoSetup' as const, text: 'Your remaining pieces and Fortifications are placed for you.' } : {}),
  });
  return m;
}

function deployClickHex(s: GameState, d: D<'deploy'>, sel: Sel, hex: HexId): ClickResult {
  const piece = deployPiece(s, d, sel);
  if (!piece) return {};
  const a: Answer = { kind: 'deploy', piece, hex };
  if (!legal(s, d, a)) return { notice: 'It cannot be placed there.' };
  if (typeOf(s.pieces[piece]).kind === 'weapon') {
    const carriers = piecesIn(s, hex).filter((id) => isUnit(s.pieces[id]) && s.pieces[id].side === d.side && !s.pieces[id].weapon);
    if (carriers.length > 1) return { sel: { ...sel, pieces: [piece], hex } };
  }
  return { answer: a, sel: { ...NO_SEL } };
}

// -------------------------------------------------------------------------------------------------------- generic

/** Up to `n` distinct legal answers random play finds for `d` (for decision kinds without their own prompt). */
export function enumerateAnswers(s: GameState, d: Decision, n = 12): Answer[] {
  const out: Answer[] = [];
  const seen = new Set<string>();
  let seed = 12345;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x80000000;
  };
  for (let i = 0; i < 80 && out.length < n; i++) {
    try {
      const a = randomAnswer(s, d, rnd);
      const k = JSON.stringify(a);
      if (!seen.has(k) && legal(s, d, a)) {
        seen.add(k);
        out.push(a);
      }
    } catch {
      break;
    }
  }
  if (!out.length && legal(s, d, { kind: 'done' })) out.push({ kind: 'done' });
  return out;
}

/** An answer in words. */
export function describeAnswer(s: GameState, a: Answer): string {
  switch (a.kind) {
    case 'order':
      return `Give the ${a.order} Order`;
    case 'pass':
      return a.discard.length ? `Pass and discard ${a.discard.length}` : 'Pass';
    case 'endTurn':
      return 'End the Turn';
    case 'activate':
      return `Activate ${list(s, a.units)}`;
    case 'activatePlayer':
      return `Activate the ${sideName(s, a.player)}`;
    case 'fire':
      return `${list(s, a.spec.pieces)} fire${a.spec.pieces.length === 1 ? 's' : ''} at ${hexName(a.spec.target)}`;
    case 'moveStep':
      return `${list(s, a.units)} to ${hexName(a.to)}`;
    case 'exit':
      return `${list(s, a.units)} exit the map`;
    case 'transfer':
      return `Hand the Weapon of ${pieceName(s, a.from)} to ${pieceName(s, a.to)}`;
    case 'advanceTo':
      return `${pieceName(s, a.unit)} advances to ${hexName(a.to)}`;
    case 'play':
      return `Play Action option ${a.option + 1}`;
    case 'reroll':
      return a.yes ? 'Re-roll' : 'Keep the roll';
    case 'choose':
      return a.items.length ? `Choose ${a.items.map((i) => i + 1).join(', ')}` : 'Choose none';
    case 'deploy':
      return `Place ${pieceName(s, a.piece)} in ${hexName(a.hex)}`;
    case 'done':
      return 'Done';
  }
}

function genericPrompt(s: GameState, d: Decision): PromptModel {
  const m = blank(d.kind, 'Decide', 'Choose one of these:');
  for (const [i, a] of enumerateAnswers(s, d).entries()) m.list.push({ key: `g-${i}`, label: describeAnswer(s, a), answer: a });
  if (!m.list.length) m.text = 'This decision has no prompt yet.';
  return m;
}

// --------------------------------------------------------------------------------------------------------- clicks

/** A click on hex `hex` of the board. */
export function clickHex(s: GameState, d: Decision, sel: Sel, hex: HexId): ClickResult {
  try {
    switch (d.kind) {
      case 'activate':
        return activateClickHex(s, d, sel, hex);
      case 'fire':
        return fireClickHex(s, d, sel, hex);
      case 'move':
        return moveClickHex(s, d, sel, hex);
      case 'advance':
        return advanceClick(s, d, sel, hex);
      case 'react':
        return reactClick(s, d, sel, { hex });
      case 'choose':
        return chooseClickHex(s, d, sel, hex);
      case 'deploy':
        return deployClickHex(s, d, sel, hex);
      default:
        return {};
    }
  } catch (e) {
    console.error(e);
    return {};
  }
}

/** A click on a piece (a counter in an expanded stack, or a chip in the prompt). */
export function clickPiece(s: GameState, d: Decision, sel: Sel, id: PieceId): ClickResult {
  try {
    switch (d.kind) {
      case 'activate':
        return activateClickPiece(s, d, sel, id);
      case 'fire':
        return fireClickPiece(s, d, sel, id);
      case 'move':
        return moveClickPiece(s, d, sel, id);
      case 'advance':
        return advanceClick(s, d, sel, hexOfPiece(s, id), id);
      case 'react':
        return reactClick(s, d, sel, { piece: id });
      case 'choose': {
        const i = d.items.findIndex((it) => 'piece' in it && it.piece === id);
        return i >= 0 ? chooseIndex(s, d, sel, i) : {};
      }
      case 'deploy':
        return d.pieces.includes(id) ? { sel: { ...sel, pieces: [id], hex: null } } : deployClickHex(s, d, sel, hexOfPiece(s, id));
      default:
        return {};
    }
  } catch (e) {
    console.error(e);
    return {};
  }
}

/** A click on a card of the human's hand (or of the prompt's card strip). */
export function clickCard(s: GameState, d: Decision, sel: Sel, card: CardId): ClickResult {
  if (d.kind === 'turn') {
    if (sel.passing) {
      const on = sel.cards.includes(card);
      if (!on && sel.cards.length >= d.maxDiscard) return { notice: `You may discard at most ${d.maxDiscard}.` };
      return { sel: { ...sel, cards: on ? sel.cards.filter((c) => c !== card) : [...sel.cards, card] } };
    }
    const o = d.orders.find((x) => x.card === card);
    if (!o) return { notice: 'That card cannot give an Order now.' };
    if (sel.cards[0] === card) return { answer: { kind: 'order', card, order: o.order } };
    return { sel: { ...sel, cards: [card] } };
  }
  if (d.kind === 'choose') {
    const i = d.items.findIndex((it) => 'card' in it && it.card === card);
    return i >= 0 ? chooseIndex(s, d, sel, i) : {};
  }
  return {};
}
