// Determinisation: a redacted view (state.ts `redact`) turned into one complete, plausible game to simulate on. The
// unknowns are filled by sampling with the AI's own seeded RNG, only from what the view says is unseen:
//  - the opponent's hand is dealt from his unseen pool (his draw pile and hand together), the rest is his draw pile;
//  - the AI's own draw pile is its unseen pool, shuffled;
//  - the opponent's secret chits are drawn from the unseen chits that have a secret side, the rest is the cup;
//  - the Smoke cup is shuffled; the game's RNG gets a fresh seed (it only shuffles; the view blanks the real one).
// The view's pools are sorted, so the result depends only on the view and the seed, never on the hidden truth.
import { OBJECTIVE_CHITS } from '../../src/engine/data';
import { cloneState } from '../../src/engine/state';
import { type GameState, type Side, UNKNOWN_CARD, UNKNOWN_CHIT, other } from '../../src/engine/types';
import type { Rng } from './rand';

/** Is `s` a redacted view for `viewer` (unknowns in place of the opponent's hand, the decks and the hidden chits)? */
export function isViewFor(s: GameState, viewer: Side): boolean {
  if (!s.unseen) return false;
  const opp = other(viewer);
  const mine = s.players[viewer];
  const theirs = s.players[opp];
  return (
    theirs.hand.every((c) => c === UNKNOWN_CARD) &&
    theirs.deck.every((c) => c === UNKNOWN_CARD) &&
    mine.deck.every((c) => c === UNKNOWN_CARD) &&
    mine.hand.every((c) => c !== UNKNOWN_CARD) &&
    theirs.secretChits.every((c) => c === UNKNOWN_CHIT) &&
    s.chitCup.every((c) => c === UNKNOWN_CHIT)
  );
}

/** A complete game sampled from view `v` (for `me`); `v` is not changed. */
export function determinize(v: GameState, me: Side, rng: Rng): GameState {
  const s = cloneState(v);
  const opp = other(me);
  const unseen = v.unseen;
  if (!unseen) throw new Error('determinize needs a redacted view (state.ts redact)');
  const mine = s.players[me];
  const theirs = s.players[opp];

  // own draw pile: the unseen own cards in a random order
  const myPool = unseen.cards[me].slice();
  rng.shuffle(myPool);
  if (myPool.length !== mine.deck.length) throw new Error(`determinize: ${me}'s draw pile has ${mine.deck.length} cards, the pool ${myPool.length}`);
  mine.deck = myPool;

  // opponent: hand and draw pile from his pool
  const oppPool = unseen.cards[opp].slice();
  rng.shuffle(oppPool);
  const h = theirs.hand.length;
  if (oppPool.length !== h + theirs.deck.length) {
    throw new Error(`determinize: ${opp} holds ${h} + ${theirs.deck.length} unknown cards, the pool ${oppPool.length}`);
  }
  theirs.hand = oppPool.slice(0, h);
  theirs.deck = oppPool.slice(h);

  // chits: the opponent's secret ones are chits with a secret side; the rest go back in the cup (shuffled)
  const chits = unseen.chits.slice();
  rng.shuffle(chits);
  const n = theirs.secretChits.length;
  const secret: string[] = [];
  const rest: string[] = [];
  for (const c of chits) {
    if (secret.length < n && OBJECTIVE_CHITS[c]?.secret) secret.push(c);
    else rest.push(c);
  }
  while (secret.length < n && rest.length) secret.push(rest.shift()!);
  theirs.secretChits = secret;
  s.chitCup = rest;

  // the Smoke cup is kept shuffled by the engine (the view sorts it)
  rng.shuffle(s.smokeCup);
  s.rng = rng.u32();
  s.rngCalls = 0;
  delete s.unseen;
  return s;
}
