// Plumbing for the Event tests (no tests here): stack a draw pile so that an Event! trigger reveals exactly the Event
// wanted (and then the Random Hexes and rolls it needs), run the Event the way deck.ts does, and answer its choices by
// reason.
import { deeper, eventTrigger } from '../../../src/engine/deck';
import { guard } from '../../../src/engine/flow';
import { CARDS } from '../../../src/engine/data';
import type { CardId, ChoiceItem, ChoiceReason, Decision, EventName, GameEvent, GameState, Nation, Side } from '../../../src/engine/types';
import { H, cardsWhere, passive, run, type Responder } from '../../support/build';

export const G: Nation = 'German';
export const US: Nation = 'American';
export const RU: Nation = 'Russian';

/**
 * The top of a draw pile for `event`: a card with that Event, then one card per Random Hex label in `hexes`, then
 * `then` (e.g. rolls). The Event card is one whose own Random Hex is not among `hexes`.
 */
export function eventTop(nation: Nation, event: EventName, hexes: string[] = [], then: CardId[] = []): CardId[] {
  const want = hexes.map(H);
  const ev = cardsWhere(nation, { event }).find((c) => !then.includes(c) && !want.includes(CARDS[c].hex));
  if (!ev) throw new Error(`No ${nation} ${event} card fits`);
  const out = [ev];
  for (const h of want) {
    const c = cardsWhere(nation, {}).find((x) => CARDS[x].hex === h && !out.includes(x) && !then.includes(x));
    if (!c) throw new Error(`No ${nation} card with Random Hex ${h}`);
    out.push(c);
  }
  return [...out, ...then];
}

/**
 * The top of a draw pile for `event` revealing, in order after the Event card, the `steps`: a Random Hex label ("E5")
 * picks a card with that hex, a card id ("G-12") is that card.
 */
export function eventSeq(nation: Nation, event: EventName, steps: string[]): CardId[] {
  const isCard = (x: string) => /^[GAR]-\d+$/.test(x);
  const fixed = steps.filter(isCard);
  const hexes = steps.filter((x) => !isCard(x)).map(H);
  const ev = cardsWhere(nation, { event }).find((c) => !fixed.includes(c) && !hexes.includes(CARDS[c].hex));
  if (!ev) throw new Error(`No ${nation} ${event} card fits`);
  const out = [ev];
  for (const x of steps) {
    if (isCard(x)) {
      out.push(x);
      continue;
    }
    const c = cardsWhere(nation, {}).find((y) => CARDS[y].hex === H(x) && !out.includes(y) && !fixed.includes(y));
    if (!c) throw new Error(`No ${nation} card with Random Hex ${x}`);
    out.push(c);
  }
  return out;
}

/** Run the Event! trigger of `side` (the top card of his pile is the Event) as deck.ts does, game end caught. */
export function trigger(s: GameState, side: Side, respond: Responder = passive) {
  return run(s, (ctx) => guard(s, ctx, eventTrigger(s, deeper(ctx), side)), respond);
}

/** What a choice item is, for matching: a hex label, a piece id, a card, a chit or a label. */
export type Match = { hex?: string; piece?: string; card?: string; chit?: string; label?: string };
export type Pick = number[] | Match | Match[] | ((d: Extract<Decision, { kind: 'choose' }>) => number[]);

function matches(item: ChoiceItem, m: Match): boolean {
  if (m.hex !== undefined) return 'hex' in item && item.hex === H(m.hex);
  if (m.piece !== undefined) return 'piece' in item && item.piece === m.piece;
  if (m.card !== undefined) return 'card' in item && item.card === m.card;
  if (m.chit !== undefined) return 'chit' in item && item.chit === m.chit;
  if (m.label !== undefined) return 'label' in item && item.label === m.label;
  return false;
}

/**
 * Answer 'choose' decisions by reason: indices, or the items matching (a matcher that matches nothing is an error);
 * every other decision passively (no re-roll, pass, the fewest choices).
 */
export function choices(picks: Partial<Record<ChoiceReason, Pick>>): Responder {
  return (d, s) => {
    if (d.kind === 'choose' && picks[d.reason] !== undefined) {
      const p = picks[d.reason]!;
      if (typeof p === 'function') return { kind: 'choose', items: p(d) };
      if (Array.isArray(p) && (p.length === 0 || typeof p[0] === 'number')) return { kind: 'choose', items: p as number[] };
      const list = (Array.isArray(p) ? p : [p]) as Match[];
      const items = list.map((m) => {
        const i = d.items.findIndex((it) => matches(it, m));
        if (i < 0) throw new Error(`${d.reason}: no item ${JSON.stringify(m)} among ${JSON.stringify(d.items)}`);
        return i;
      });
      return { kind: 'choose', items };
    }
    return passive(d, s);
  };
}

/** The 'choose' decisions asked, by reason. */
export function asked(decisions: Decision[], reason: ChoiceReason) {
  return decisions.filter((d): d is Extract<Decision, { kind: 'choose' }> => d.kind === 'choose' && d.reason === reason);
}

/** The events of a kind. */
export function ofKind<K extends GameEvent['kind']>(events: GameEvent[], kind: K) {
  return events.filter((e): e is Extract<GameEvent, { kind: K }> => e.kind === kind);
}
