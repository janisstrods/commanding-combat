// The battle log: one line per event worth telling, written for the human (events pass through `publicEvent` first, so
// nothing hidden is ever told). Pure: (event, state, viewer) → text.
import { cardOf } from '../../engine/state';
import type { GameEvent, GameState, Side } from '../../engine/types';
import { UNKNOWN_CARD, UNKNOWN_CHIT } from '../../engine/types';
import { END_REASON_TEXT, PURPOSE_TEXT, chitText, counterName, hexName, isRollPurpose, pieceName, sideName } from './names';

export type LogKind = 'turn' | 'card' | 'roll' | 'move' | 'fire' | 'result' | 'vp' | 'time' | 'info' | 'say' | 'end';

export interface LogEntry {
  text: string;
  side?: Side;
  kind: LogKind;
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
  const who = (side: Side) => sideName(s, side);
  switch (e.kind) {
    case 'turnStart':
      return { kind: 'turn', side: e.side, text: `Turn ${e.number}: ${who(e.side)}${you(e.side, viewer)}` };
    case 'cardPlayed':
      return {
        kind: 'card',
        side: e.side,
        text: `${who(e.side)} play ${e.name} ${e.as === 'order' ? 'as an Order' : 'as an Action'}.`,
      };
    case 'discard':
      return {
        kind: 'card',
        side: e.side,
        text: `${who(e.side)} pass and discard ${e.cards.length} card${e.cards.length === 1 ? '' : 's'}${e.cards.length ? `: ${e.cards.map((c) => cardOf(c).order).join(', ')}` : ''}.`,
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
      return { kind: 'roll', side: e.side, text: `${e.trigger}! (${who(e.side)})` };
    case 'event':
      return { kind: 'card', side: e.side, text: `Event: ${e.event} (${who(e.side)}).` };
    case 'activate':
      return { kind: 'info', side: e.side, text: `${e.order === 'Op Fire' ? 'Op Fire' : e.order}: ${names(s, e.units)} activated.` };
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
      const lost = e.losers.length === 2 ? 'both sides are eliminated' : e.losers.length === 1 ? `the ${who(e.losers[0])} are eliminated` : 'nobody loses';
      return { kind: 'fire', text: `Melee in ${hexName(e.hex)}: ${t} — ${lost}.` };
    }
    case 'vp': {
      const side: Side = e.delta > 0 ? 'axis' : 'allied';
      return { kind: 'vp', side, text: `${who(side)} +${Math.abs(e.delta)} VP (${vpWhy(e.why)}). VP: ${vpTotalText(e.total)}.` };
    }
    case 'control':
      return { kind: 'vp', side: e.side ?? undefined, text: e.side ? `${who(e.side)} take control of Objective ${e.objective}.` : `Objective ${e.objective} is no longer controlled.` };
    case 'chit': {
      if (e.open) return { kind: 'vp', side: e.side ?? undefined, text: `Objective chit ${e.chit} is open: ${chitText(e.chit)}.` };
      if (e.chit === UNKNOWN_CHIT || e.side !== viewer) return { kind: 'vp', side: e.side ?? undefined, text: `${who(e.side!)} draw a secret objective.` };
      return { kind: 'vp', side: e.side, text: `You draw secret objective ${e.chit}: ${chitText(e.chit)}.` };
    }
    case 'time':
      return { kind: 'time', side: e.side, text: `Time advances to ${e.time} (${who(e.side)}).` };
    case 'suddenDeath':
      return { kind: 'time', text: `Sudden Death roll ${e.roll} against Time ${e.time}: ${e.ends ? 'the battle ends' : 'the battle goes on'}.` };
    case 'reinforce':
      return { kind: 'info', text: `Reinforcements arrive: ${names(s, e.pieces)}.` };
    case 'log':
      return { kind: 'info', side: e.side, text: e.text };
    case 'reshuffle':
      return { kind: 'card', side: e.side, text: `${who(e.side)} reshuffle their Fate deck.` };
    case 'transfer':
      return { kind: 'move', text: `${pieceName(s, e.weapon)} passes from ${pieceName(s, e.from)} to ${pieceName(s, e.to)}.` };
    case 'fix':
      return { kind: 'result', text: `${pieceName(s, e.piece)} is repaired.` };
    case 'initiative':
      return { kind: 'info', side: e.side, text: `The ${who(e.side)} now hold the Initiative.` };
    case 'replace':
      return { kind: 'result', text: `${pieceName(s, e.piece)} is replaced by ${names(s, e.by)}.` };
    case 'gameOver':
      return { kind: 'end', side: e.winner, text: `The ${who(e.winner)} win by ${END_REASON_TEXT[e.reason] ?? e.reason}.` };
    case 'window':
      return null;
    default:
      return null;
  }
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
