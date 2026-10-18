// Each side's Artillery Box on the battle screen: the Radio (never on the map), its calibre and FP, and what it allows
// now; open information, so the opponent's box reads the same from the human's redacted view.
import { describe, expect, it } from 'vitest';
import { redact } from '../../../src/engine/state';
import { artilleryBox } from '../../../src/ui/game/artillery';
import { build } from '../../support/build';

const LEADER = 'German/Lt Von Karsties';
const RADIO = 'German/Radio:105mm'; // 10 FP, Smoke

describe('artilleryBox', () => {
  it('says when a side has no Radio', () => {
    const s = build({ pieces: [{ type: LEADER, hex: 'H8' }] });
    expect(artilleryBox(s, 'axis')).toMatchObject({ radio: null, status: 'none', label: 'No Radio' });
  });

  it('shows a working Radio with its calibre and FP, ready while a Leader can spot', () => {
    const s = build({ pieces: [{ type: LEADER, hex: 'H8' }, { type: RADIO, where: 'artillery' }] });
    const b = artilleryBox(s, 'axis');
    expect(b).toMatchObject({ radio: 'p1', calibre: '105mm', fp: 10, smoke: true, broken: false, status: 'ready', label: 'Ready' });
    expect(b.tip).toMatch(/Fire for Effect/);
  });

  it('a working Radio with no Leader free to spot', () => {
    const s = build({ pieces: [{ type: LEADER, hex: 'H8', broken: true }, { type: RADIO, where: 'artillery' }] });
    expect(artilleryBox(s, 'axis')).toMatchObject({ status: 'noSpotter', label: 'No Spotter free' });
  });

  it('a broken Radio offers Battery Access', () => {
    const s = build({ pieces: [{ type: LEADER, hex: 'H8' }, { type: RADIO, where: 'artillery', broken: true }] });
    const b = artilleryBox(s, 'axis');
    expect(b).toMatchObject({ broken: true, status: 'broken', label: 'Broken' });
    expect(b.tip).toMatch(/Battery Access/);
  });

  it("is open information: the opponent's box reads the same from the human's view", () => {
    const s = build({ pieces: [{ type: LEADER, hex: 'H8' }, { type: RADIO, where: 'artillery' }] });
    expect(artilleryBox(redact(s, 'allied'), 'axis')).toEqual(artilleryBox(s, 'axis'));
  });
});
