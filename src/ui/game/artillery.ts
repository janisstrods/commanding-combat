// Each side's Artillery Box on the battle screen: its Radio (in the box, `where: 'artillery'`, never on the map), its
// calibre and FP, and what it allows now (§O17, §O18). Radios are open information: `redact` keeps them, so this reads
// the human's view like everything else on the screen.
import { spotters } from '../../engine/orders/artillery';
import { radioOf, typeOf } from '../../engine/state';
import type { CounterType, GameState, PieceId, Side } from '../../engine/types';
import { radioCalibre } from '../../art/Counter';

export type RadioStatus = 'none' | 'ready' | 'noSpotter' | 'broken';

export interface ArtilleryBoxView {
  side: Side;
  radio: PieceId | null;
  type: CounterType | null;
  /** "105mm". */
  calibre: string;
  fp: number | null;
  smoke: boolean;
  broken: boolean;
  status: RadioStatus;
  /** One line under the counter. */
  label: string;
  /** What it allows, for the tooltip. */
  tip: string;
}

export function artilleryBox(s: GameState, side: Side): ArtilleryBoxView {
  const r = radioOf(s, side);
  if (!r) {
    return {
      side, radio: null, type: null, calibre: '', fp: null, smoke: false, broken: false, status: 'none', label: 'No Radio',
      tip: 'No Radio: no Artillery Request. Reinforcements or a Support Table Event may still bring one.',
    };
  }
  const type = typeOf(r);
  const calibre = radioCalibre(type);
  const fp = (r.broken ? type.broken : type.front).fp;
  const smoke = !!type.smoke;
  const what = `${calibre ? `${calibre} ` : ''}Radio, FP ${fp}${smoke ? ', may fire Smoke' : ''}`;
  if (r.broken) {
    return {
      side, radio: r.id, type, calibre, fp, smoke, broken: true, status: 'broken', label: 'Broken',
      tip: `${what}. Broken: an Artillery Request now gives Battery Access, which repairs it; another Artillery Denied eliminates it.`,
    };
  }
  const free = spotters(s, side).length > 0;
  return {
    side, radio: r.id, type, calibre, fp, smoke, broken: false, status: free ? 'ready' : 'noSpotter', label: free ? 'Ready' : 'No Spotter free',
    tip: free
      ? `${what}. Artillery Request: Fire for Effect, with an unbroken Leader as the Spotter. The enemy's Artillery Denied breaks it.`
      : `${what}. Working, but no Leader can spot this Turn (the Spotter must be an unbroken Leader not yet activated).`,
  };
}
