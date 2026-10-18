// The battle log: one line per event worth telling, written for the human (events pass through `publicEvent` first, so
// nothing hidden is ever told). Pure: (event, state, viewer) → text.
import { cardOf } from '../../engine/state';
import type { GameEvent, GameState, Side } from '../../engine/types';
import { UNKNOWN_CARD, UNKNOWN_CHIT } from '../../engine/types';
import { END_REASON_TEXT, PURPOSE_TEXT, chitText, counterName, hexName, isRollPurpose, pieceName, sideName } from './names';

/** 'order': an Order's (or a pass's) subheading; 'close': where that Order ends (never shown, it only groups). */
export type LogKind = 'turn' | 'order' | 'close' | 'card' | 'roll' | 'move' | 'fire' | 'result' | 'vp' | 'time' | 'info' | 'say' | 'end';

export interface LogEntry {
  text: string;
  side?: Side;
  kind: LogKind;
  /** A played Action or an Op Fire activation: a reaction when made by the side not giving the Order. */
  react?: boolean;
}

function cardName(id: string): string {
  if (id === UNKNOWN_CARD) return 'a card';
  try {
    const c = cardOf(id);
    return `${c.order} / ${c.action} / ${c.event}`;
  } catch {
    return id;
  }
}

const you = (side: Side, viewer: Side) => (side === viewer ? ' (you)' : '');

function names(s: GameState, ids: string[]): string {
  const list = ids.map((id) => pieceName(s, id));
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/** "3 to the Axis", "even". */
export function vpTotalText(vp: number): string {
  if (vp === 0) return 'even';
  return `${Math.abs(vp)} to the ${vp > 0 ? 'Axis' : 'Allies'}`;
}

/** The log line of an event (already filtered by `publicEvent`), or null for events the log does not tell. */
export function logEntry(e: GameEvent, s: GameState, viewer: Side): LogEntry | null {
  // "You" for the human, the nation for the computer (both take the same plural verbs)
  const who = (side: Side) => (side === viewer ? 'You' : sideName(s, side));
  const whom = (side: Side) => (side === viewer ? 'you' : `the ${sideName(s, side)}`);
  const their = (side: Side) => (side === viewer ? 'your' : 'their');
  switch (e.kind) {
    case 'turnStart':
      return { kind: 'turn', side: e.side, text: `Turn ${e.number}: ${sideName(s, e.side)}${you(e.side, viewer)}` };
    case 'cardPlayed':
      if (e.as === 'order') return { kind: 'order', side: e.side, text: `${sideName(s, e.side)} — ${e.name}` };
      return { kind: 'card', side: e.side, react: true, text: `${who(e.side)} play ${e.name} as an Action.` };
    case 'pass':
      return { kind: 'order', side: e.side, text: `${sideName(s, e.side)} — Pass` };
    case 'orderDone':
      return { kind: 'close', side: e.side, text: '' };
    case 'discard':
      return {
        kind: 'card',
        side: e.side,
        text: `${who(e.side)} discard ${e.cards.length} card${e.cards.length === 1 ? '' : 's'}${e.cards.length ? `: ${e.cards.map((c) => cardOf(c).order).join(', ')}` : ''}.`,
      };
    case 'draw': {
      const n = e.cards.length;
      if (e.side === viewer && e.cards.every((c) => c !== UNKNOWN_CARD)) {
        return { kind: 'card', side: e.side, text: `You draw ${e.cards.map((c) => cardOf(c).order).join(', ')}.` };
      }
      return { kind: 'card', side: e.side, text: `${who(e.side)} draw ${n} card${n === 1 ? '' : 's'}.` };
    }
    case 'reveal': {
      const p = PURPOSE_TEXT[e.purpose] ?? e.purpose;
      if (isRollPurpose(e.purpose)) {
        const c = cardOf(e.card);
        const dice = e.purpose === 'targeting' || e.purpose === 'accuracy' ? `${c.white}×${c.red} = ${c.white * c.red}` : `${c.white}+${c.red} = ${c.white + c.red}`;
        return { kind: 'roll', side: e.side, text: `${who(e.side)} roll for ${p}: ${dice}${e.trigger ? ` (${e.trigger}!)` : ''}.` };
      }
      if (e.purpose === 'randomHex') return { kind: 'roll', side: e.side, text: `${who(e.side)} reveal a Random Hex: ${hexName(cardOf(e.card).hex)}.` };
      if (e.purpose === 'event') return null; // the 'event' event tells it
      return { kind: 'roll', side: e.side, text: `${who(e.side)} reveal a card for ${p}: ${cardName(e.card)}.` };
    }
    case 'reroll':
      return { kind: 'roll', side: e.by, text: `${who(e.by)} use the Initiative to cancel the roll; it is rolled again.` };
    case 'trigger':
      return { kind: 'roll', side: e.side, text: `${e.trigger}! (${whom(e.side)})` };
    case 'event':
      return { kind: 'card', side: e.side, text: `Event: ${e.event} (${whom(e.side)}).` };
    case 'activate':
      return { kind: 'info', side: e.side, react: e.order === 'Op Fire' || undefined, text: `${e.order}: ${names(s, e.units)} activated.` };
    case 'move':
      // an Advance moves without spending MP
      if (!e.mp) return { kind: 'move', text: `${names(s, e.units)} advance${e.units.length === 1 ? 's' : ''} to ${hexName(e.to)}.` };
      return { kind: 'move', text: `${names(s, e.units)} move${e.units.length === 1 ? 's' : ''} to ${hexName(e.to)} (${e.mp} MP).` };
    case 'exit':
      return { kind: 'move', text: `${names(s, e.units)} exit${e.units.length === 1 ? 's' : ''} the map from ${hexName(e.from)}.` };
    case 'retreat':
      return { kind: 'move', text: `${pieceName(s, e.unit)} retreats to ${hexName(e.to)}.` };
    case 'fireAttack': {
      const hexes = e.hexes?.length ? e.hexes.map(hexName).join(' and ') : hexName(e.target);
      return { kind: 'fire', side: e.side, text: `${who(e.side)} fire at ${hexes}: ${e.fp} FP + roll ${e.total - e.fp} = ${e.total}.` };
    }
    case 'targeting':
      return {
        kind: 'fire',
        side: e.side,
        text: `${pieceName(s, e.piece)} targets ${hexName(e.target)}: ${e.product} needs ${e.need} or more — ${e.hit ? 'hit' : 'miss'}.`,
      };
    case 'defense': {
      const res = e.result === 'break' ? 'breaks' : e.result === 'suppress' ? 'is suppressed' : 'holds';
      return { kind: 'result', side: s.pieces[e.unit]?.side, text: `${pieceName(s, e.unit)} defends: ${e.total} vs ${e.attack} — ${res}.` };
    }
    case 'break':
      return { kind: 'result', side: s.pieces[e.piece]?.side, text: `${pieceName(s, e.piece)} breaks.` };
    case 'rally':
      return { kind: 'result', side: s.pieces[e.piece]?.side, text: `${pieceName(s, e.piece)} rallies.` };
    case 'suppress':
      return { kind: 'result', side: s.pieces[e.piece]?.side, text: `${pieceName(s, e.piece)} is suppressed.` };
    case 'eliminate':
      return { kind: 'result', side: s.pieces[e.piece]?.side, text: `${pieceName(s, e.piece)} is eliminated${e.vp ? ` (${e.vp} VP)` : ''}.` };
    case 'place': {
      if (e.marker === 'sr') return null; // the Spotting Round's steps: the artillery's own lines tell where it lands
      if (e.piece) return { kind: 'info', side: s.pieces[e.piece]?.side, text: `${pieceName(s, e.piece)} placed in ${hexName(e.hex)}.` };
      if (!e.marker) return null;
      const what = e.marker === 'smoke' ? `Smoke ${e.value ?? ''}`.trim() : e.marker === 'blaze' ? 'A Blaze' : cap(e.marker);
      return { kind: 'info', text: `${what} placed in ${hexName(e.hex)}.` };
    }
    case 'remove': {
      if (e.marker === 'sr') return null;
      const what = e.marker === 'smoke' ? 'Smoke' : e.marker === 'blaze' ? 'The Blaze' : cap(e.marker);
      return { kind: 'info', text: `${what} removed from ${hexName(e.hex)}.` };
    }
    case 'melee': {
      const t = `Axis ${e.totals.axis}, Allies ${e.totals.allied}`;
      const lost = e.losers.length === 2 ? 'both sides are eliminated' : e.losers.length === 1 ? `${whom(e.losers[0])} are wiped out` : 'nobody loses';
      return { kind: 'fire', text: `Melee in ${hexName(e.hex)}: ${t} — ${lost}.` };
    }
    case 'vp': {
      const side: Side = e.delta > 0 ? 'axis' : 'allied';
      return { kind: 'vp', side, text: `+${Math.abs(e.delta)} VP to ${whom(side)} (${vpWhy(e.why)}). VP: ${vpTotalText(e.total)}.` };
    }
    case 'control':
      return { kind: 'vp', side: e.side ?? undefined, text: e.side ? `${who(e.side)} take control of Objective ${e.objective}.` : `Objective ${e.objective} is no longer controlled.` };
    case 'chit': {
      if (e.open) return { kind: 'vp', side: e.side ?? undefined, text: `Objective chit ${e.chit} is open: ${chitText(e.chit)}.` };
      if (e.chit === UNKNOWN_CHIT || e.side !== viewer) return { kind: 'vp', side: e.side ?? undefined, text: `${sideName(s, e.side!)} draw a secret objective.` };
      return { kind: 'vp', side: e.side, text: `You draw secret objective ${e.chit}: ${chitText(e.chit)}.` };
    }
    case 'time':
      return { kind: 'time', side: e.side, text: `Time advances to ${e.time} (${whom(e.side)}).` };
    case 'suddenDeath':
      return { kind: 'time', text: `Sudden Death roll ${e.roll} against Time ${e.time}: ${e.ends ? 'the battle ends' : 'the battle goes on'}.` };
    case 'reinforce':
      return { kind: 'info', text: `Reinforcements arrive: ${names(s, e.pieces)}.` };
    case 'log':
      return { kind: 'info', side: e.side, text: engineText(e.text, e.side, s, viewer) };
    case 'reshuffle':
      return { kind: 'card', side: e.side, text: `${who(e.side)} reshuffle ${their(e.side)} Fate deck.` };
    case 'transfer':
      return { kind: 'move', text: `${pieceName(s, e.weapon)} passes from ${pieceName(s, e.from)} to ${pieceName(s, e.to)}.` };
    case 'fix':
      return { kind: 'result', text: `${pieceName(s, e.piece)} is repaired.` };
    case 'initiative':
      return { kind: 'info', side: e.side, text: `${e.side === viewer ? 'You' : `The ${sideName(s, e.side)}`} now hold the Initiative.` };
    case 'replace':
      return { kind: 'result', text: `${pieceName(s, e.piece)} is replaced by ${names(s, e.by)}.` };
    case 'gameOver':
      return { kind: 'end', side: e.winner, text: `${e.winner === viewer ? 'You win' : `The ${sideName(s, e.winner)} win`} by ${END_REASON_TEXT[e.reason] ?? e.reason}.` };
    case 'window':
      return null;
    default:
      return null;
  }
}

/** A log line as the panel shows it: its depth under the Turn and Order headings, and whether it is a reaction. */
export type LogRow<T extends LogEntry = LogEntry> = T & { depth: 0 | 1 | 2; reaction: boolean };

/**
 * The log grouped for showing (pure, from the lines alone, so Undo's trimming and a resumed game's replay group the
 * same): a Turn heading at depth 0; an Order or pass subheading under it (1) with its lines under that (2) until the
 * Order closes; the Turn's other lines (end-of-Turn draws) at 1. Actions and Op Fire by the side not giving the Order
 * are its reactions. The 'close' lines only group and are left out.
 */
export function logRows<T extends LogEntry>(lines: readonly T[]): LogRow<T>[] {
  const out: LogRow<T>[] = [];
  let inTurn = false;
  let order: Side | null = null;
  for (const l of lines) {
    if (l.kind === 'close') {
      order = null;
      continue;
    }
    if (l.kind === 'turn') {
      // the battle's title line is a 'turn' line too, without a side
      inTurn = !!l.side;
      order = null;
      out.push({ ...l, depth: 0, reaction: false });
      continue;
    }
    const base = inTurn ? 1 : 0;
    if (l.kind === 'order') {
      order = l.side ?? null;
      out.push({ ...l, depth: base as 0 | 1, reaction: false });
      continue;
    }
    const under = order !== null;
    out.push({ ...l, depth: (base + (under ? 1 : 0)) as 0 | 1 | 2, reaction: under && !!l.react && !!l.side && l.side !== order });
  }
  return out;
}

/**
 * The engine's own log text for the human: "the axis player" becomes "you" or "the Germans", a Recover / Rout
 * activation and the end of a Turn are told in plain words, counter type ids lose their nation prefix.
 */
export function engineText(text: string, side: Side | undefined, s: GameState, viewer: Side): string {
  const name = (x: string) => (x === viewer ? 'you' : `the ${sideName(s, x as Side)}`);
  const own = (x: string) => (x === viewer ? 'your' : 'their');
  const act = /^(Recover|Rout): the (axis|allied) player activates (himself|the (axis|allied) player)\.$/.exec(text);
  if (act) {
    const [, order, by, , target] = act;
    const By = name(by);
    if (order === 'Recover') return `Recover: ${By} rally ${own(by)} broken units.`;
    if (!target || target === by) return `Rout: ${By} rout ${own(by)} own broken units.`;
    return `Rout: ${By} rout ${target === viewer ? 'your' : `the ${sideName(s, target as Side)}’`} broken units.`;
  }
  let t = text;
  if (side && /the Turn (ends|passes)\.$/.test(t)) t = t.replace(/the Turn (ends|passes)\.$/, (_m, v) => `${side === viewer ? 'your' : `the ${sideName(s, side)}’`} Turn ${v}.`);
  t = t.replace(/\bthe (axis|allied) player\b/g, (_m, x) => name(x));
  t = t.replace(/\b(German|American|Russian)\/([A-Z][\w .:'()-]*)/g, (_m, _n, rest) => rest);
  return t;
}

function cap(x: string): string {
  return x.charAt(0).toUpperCase() + x.slice(1);
}

/** VP reasons in words. */
export function vpWhy(why: string): string {
  if (why === 'elimination') return 'elimination';
  if (why === 'overstack') return 'overstacking';
  if (why === 'exit') return 'units exited';
  if (why === 'time') return 'Defender, Time advance';
  if (/^objective \d$/.test(why)) return why.replace('objective', 'Objective');
  if (/^chit /.test(why)) return why.replace('chit', 'chit');
  return why;
}

/** The VP bucket a 'vp' event counts toward on the result screen. */
export function vpBucket(why: string): 'Eliminations' | 'Exits' | 'Objectives' | 'Time' | 'Other' {
  if (why === 'elimination' || why === 'overstack') return 'Eliminations';
  if (why === 'exit') return 'Exits';
  if (why.startsWith('objective') || why.startsWith('chit')) return 'Objectives';
  if (why === 'time') return 'Time';
  return 'Other';
}

export { counterName };
