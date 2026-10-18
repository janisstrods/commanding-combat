// Scenario 1, Fat Lipki (scenarios-reference §3): SSR 1 hidden simultaneous set-up, SSR 2 the Axis choice of Initiative.
import { describe, expect, it } from 'vitest';
import { redact } from '../../../src/engine/state';
import type { Decision } from '../../../src/engine/types';
import { passive, type Responder } from '../../support/build';
import { mapUnits, setUp, special } from './kit';

describe('scenario 1 Fat Lipki', () => {
  it('SSR 1: set-up is hidden: while the Axis deploys he cannot see the Allied units already placed', () => {
    let checked = 0;
    const respond: Responder = (d, s) => {
      if (d.kind === 'deploy' && d.side === 'axis') {
        expect(mapUnits(s, 'allied').length).toBeGreaterThan(0); // the Allies set up first...
        expect(mapUnits(redact(s, 'axis'), 'allied')).toHaveLength(0); // ...unseen by the Axis
        checked++;
      }
      return passive(d, s);
    };
    const { s } = setUp('1', 3, respond);
    expect(special('1').simultaneousSetup).toBe(true);
    expect(checked).toBeGreaterThan(0);
    expect(s.phase).toBe('play');
    expect(mapUnits(redact(s, 'axis'), 'allied').length).toBe(mapUnits(s, 'allied').length); // revealed once play starts
  });

  it('SSR 2: the Axis keeps the Initiative card and the Allies move first...', () => {
    const { s, r } = setUp('1', 5);
    const d = r.decisions.find((x): x is Extract<Decision, { kind: 'choose' }> => x.kind === 'choose' && x.reason === 'initiativeChoice');
    expect(d?.side).toBe('axis');
    expect(s.players.axis.hand).toHaveLength(5);
    expect(s.players.allied.hand).toHaveLength(5);
    expect(s.initiative).toBe('axis');
    expect(s.active).toBe('allied');
  });

  it('...or gives it to the Allies and moves first himself', () => {
    const give: Responder = (d, s) =>
      d.kind === 'choose' && d.reason === 'initiativeChoice' ? { kind: 'choose', items: [1] } : passive(d, s);
    const { s } = setUp('1', 5, give);
    expect(s.initiative).toBe('allied');
    expect(s.active).toBe('axis');
  });
});
