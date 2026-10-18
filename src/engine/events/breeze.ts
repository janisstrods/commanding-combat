// Breeze (§E48, R-35): all Smoke leaves the map; then every Blaze that was there when the Event began spreads one hex
// downwind, in the card's wind direction (map compass 1..6), into a hex that can take a Blaze. Units in the new Blaze
// hexes are displaced as for Blaze (§E46), Smoke and Fortifications there removed.
import { neighbour } from '../hex';
import type { EventHandler } from '../registry';
import { removeSmoke } from '../state';
import type { HexId } from '../types';
import { canBlaze, displace, note, startBlaze } from './helpers';

export const breezeEvent: EventHandler = function* (s, ctx, receiver, card) {
  for (let h = 0; h < s.smoke.length; h++) if (s.smoke[h] > 0) removeSmoke(s, ctx, h);
  const wind = card.breeze;
  if (!wind) return;
  const sources: HexId[] = [];
  for (let h = 0; h < s.blaze.length; h++) if (s.blaze[h]) sources.push(h);
  const fresh: HexId[] = [];
  for (const h of sources) {
    const to = neighbour(h, wind);
    if (to === null || !canBlaze(s, to)) continue;
    startBlaze(s, ctx, to);
    fresh.push(to);
  }
  if (sources.length && !fresh.length) note(ctx, receiver, 'Breeze: no Blaze can spread downwind.');
  yield* displace(s, ctx, fresh.sort((a, b) => a - b));
};
