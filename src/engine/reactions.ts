// Reaction windows (§A24): at a moment when Actions may answer something, the inactive player plays all he wants first
// (one at a time, asked again after each), then the active player; one round only (R-12). A player is asked only when
// he has at least one playable option, so a window nobody can use costs no decision.
import { ask, type Gen } from './decisions';
import { actionMixError } from './mix';
import { ACTIONS } from './registry';
import { actionBlocked } from './scenarioRules';
import type { ActionName, ActionOption, Answer, FlowCtx, GameState, Side, WindowInfo, WindowKind } from './types';
import { other } from './types';

const NAMES = () => Object.keys(ACTIONS) as ActionName[];

/** Every Action play open to `side` in window `w` now (none whose counter the mix lacks, mix.ts `actionMixError`). */
export function optionsFor(s: GameState, side: Side, w: WindowKind, info: WindowInfo): ActionOption[] {
  const out: ActionOption[] = [];
  for (const name of NAMES()) {
    const h = ACTIONS[name];
    if (!h.windows.includes(w) || actionBlocked(s, name) || actionMixError(s, side, name)) continue;
    for (const o of h.options(s, side, w, info)) out.push(o);
  }
  return out;
}

/** A copy of `info` for a decision (later changes to the attack in progress do not alter a decision already asked). */
function snapshot(info: WindowInfo): WindowInfo {
  const out: WindowInfo = { ...info };
  if (info.units) out.units = info.units.slice();
  if (info.attack) out.attack = { ...info.attack, pieces: info.attack.pieces.slice(), targets: info.attack.targets.slice(), played: info.attack.played.slice() };
  return out;
}

/** Window `w`: the inactive player, then the active one, each playing Actions until he passes or has none left. */
export function* window(s: GameState, ctx: FlowCtx, w: WindowKind, info: WindowInfo): Gen {
  for (const side of [other(s.active), s.active]) yield* reactFor(s, ctx, side, w, info);
}

/** One player's turn in window `w` (the window's order is the caller's business, e.g. a single-player window). */
export function* reactFor(s: GameState, ctx: FlowCtx, side: Side, w: WindowKind, info: WindowInfo): Gen {
  if (ctx.windows) ctx.emit({ kind: 'window', window: w, side });
  for (;;) {
    const options = optionsFor(s, side, w, info);
    if (!options.length) return;
    const a = yield* ask(s, ctx, { kind: 'react', side, window: w, options, info: snapshot(info) });
    if (a.kind !== 'play') return;
    yield* playAction(s, ctx, side, options[a.option], a, info);
  }
}

/** Play `opt`: the card (if any) goes from hand to the discard pile, then its handler runs. */
export function* playAction(s: GameState, ctx: FlowCtx, side: Side, opt: ActionOption, a: Answer, info: WindowInfo): Gen {
  if (opt.card) {
    const p = s.players[side];
    const i = p.hand.indexOf(opt.card);
    if (i < 0) throw new Error(`${opt.card} is not in ${side}'s hand`);
    p.hand.splice(i, 1);
    p.discards.push(opt.card);
    ctx.emit({ kind: 'cardPlayed', side, card: opt.card, as: 'action', name: opt.action });
  }
  yield* ACTIONS[opt.action].run(s, ctx, side, opt, a, info);
}
