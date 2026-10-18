// What each Objective is worth as the human knows it (§7.3.3): the open chits (objectiveValue, what scores now), plus his
// own secret chits — they score for whoever controls the Objective once revealed —, and "+?" where a secret chit the
// enemy may hold could still add to it. Computed from the human's view (redact): the enemy's secret chits are unknowns
// there, and the chits they could be are the pool `unseen.chits` (the cup and the enemy's chits, which he cannot tell
// apart); only chits with a secret side can be held secretly.
import { OBJECTIVE_CHITS } from '../../engine/data';
import { chitValue, objectiveValue } from '../../engine/objectives';
import { ALL_CHITS } from '../../engine/state';
import type { ChitId, GameState, Side } from '../../engine/types';
import { UNKNOWN_CHIT, other } from '../../engine/types';

export interface ObjectiveWorth {
  /** VP from the open chits (scoring now). */
  open: number;
  /** The human's secret chits (and any enemy chit he knows by name) that add to it, with their VP. */
  secret: { chit: ChitId; vp: number; mine: boolean }[];
  /** open + every secret chit listed. */
  total: number;
  /** An enemy secret chit the human does not know could add to it. */
  more: boolean;
}

const known = (c: ChitId) => c !== UNKNOWN_CHIT && !!OBJECTIVE_CHITS[c];

/** The chits an unknown enemy secret chit may be: the view's unseen pool (else every chit not in sight). */
function unknownPool(s: GameState, human: Side): ChitId[] {
  if (s.unseen) return s.unseen.chits;
  const seen = new Set([...s.openChits, ...s.players[human].secretChits, ...s.players[other(human)].secretChits]);
  return ALL_CHITS.filter((c) => !seen.has(c));
}

/** Objective n's worth from `s`, the human's view of the game. */
export function objectiveWorth(s: GameState, human: Side, n: number): ObjectiveWorth {
  const open = objectiveValue(s, n);
  const secret: ObjectiveWorth['secret'] = [];
  const add = (c: ChitId, mine: boolean) => {
    const vp = chitValue(c, n);
    if (vp) secret.push({ chit: c, vp, mine });
  };
  for (const c of s.players[human].secretChits) add(c, true);
  const theirs = s.players[other(human)].secretChits;
  for (const c of theirs) if (known(c)) add(c, false);
  const more = theirs.some((c) => !known(c)) && unknownPool(s, human).some((c) => OBJECTIVE_CHITS[c]?.secret && chitValue(c, n) > 0);
  return { open, secret, total: open + secret.reduce((t, x) => t + x.vp, 0), more };
}

/** "Objective 3: 4 VP — open chits 1 (C +1); your secret chit K +3 (scores once revealed); …" (tooltips). */
export function worthText(s: GameState, human: Side, n: number): string {
  const w = objectiveWorth(s, human, n);
  const parts: string[] = [];
  const opens = s.openChits.filter((c) => chitValue(c, n) > 0);
  if (opens.length) parts.push(`open chits ${w.open} (${opens.map((c) => `${c} +${chitValue(c, n)}`).join(', ')})`);
  for (const x of w.secret) {
    parts.push(`${x.mine ? 'your' : 'the enemy’s'} secret chit ${x.chit} +${x.vp} (scores once revealed)`);
  }
  if (w.more) parts.push('an enemy secret chit could add more');
  return `Objective ${n}: ${w.total} VP — ${parts.length ? parts.join('; ') : 'no chit values it yet'}`;
}
