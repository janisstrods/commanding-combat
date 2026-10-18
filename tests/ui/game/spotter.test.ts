// Artillery Request (§O18.2): Fire For Effect activates the Spotter alone, so the activate prompt selects only the
// Leader clicked — no Command radius, no units brought along — and Activate is ready at once.
import { describe, expect, it } from 'vitest';
import { answerError } from '../../../src/engine/decisions';
import { turnFlow } from '../../../src/engine/flow';
import type { Decision } from '../../../src/engine/types';
import { NO_SEL, clickHex, clickPiece, promptFor } from '../../../src/ui/game/prompts';
import { H, build, card, start } from '../../support/build';

const REQ = card('German', { order: 'Artillery Request' });

describe('the Artillery Request activate prompt', () => {
  it('selects the Spotter alone and says so', () => {
    const s = build({
      pieces: [
        { type: 'German/Lt Von Karsties', hex: 'H8' }, // p0: Command 2
        { type: 'German/Radio:105mm', where: 'artillery' }, // p1
        { type: 'German/Rifle Squad', hex: 'H8' }, // p2: in his hex
        { type: 'German/Rifle Squad', hex: 'H7' }, // p3: in his radius
        { type: 'American/Line Squad', hex: 'B2' },
      ],
      axis: { hand: [REQ] },
    });
    const f = start(s, (ctx) => turnFlow(s, ctx)).answer({ kind: 'order', card: REQ, order: 'Artillery Request' });
    const d = f.pending as Extract<Decision, { kind: 'activate' }>;
    expect(d).toMatchObject({ kind: 'activate', order: 'Artillery Request', units: ['p0'], alone: 'Spotter' });
    expect(promptFor(s, d, NO_SEL, 'axis').text).toMatch(/Spotter: he is activated alone/);

    // clicking the Leader, or his hex, selects him alone
    for (const r of [clickPiece(s, d, NO_SEL, 'p0'), clickHex(s, d, NO_SEL, H('H8'))]) {
      expect(r.sel?.pieces).toEqual(['p0']);
      const m = promptFor(s, d, { ...NO_SEL, ...r.sel }, 'axis');
      expect(m.text).toBe('Lt Von Karsties is the Spotter, activated alone.');
      expect(m.marks.filter((x) => x.label === 'radius')).toEqual([]);
      const go = m.buttons.find((b) => b.key === 'go')!;
      expect(go.disabled).toBeFalsy();
      expect(answerError(s, d, go.answer!)).toBeNull();
    }
    // the squads cannot be added
    expect(clickPiece(s, d, { ...NO_SEL, pieces: ['p0'] }, 'p3').notice).toMatch(/Spotter/);
  });
});
