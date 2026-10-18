// Artillery (§12, §O17, §O18): Artillery Denied; Artillery Request by Battery Access or Fire For Effect (the Spotter,
// the Spotting Round in his LOS, the Smoke barrage announced before Accuracy, the Accuracy roll, the drift by compass,
// off-map cancel, the Impact on the SR hex and its six neighbours, Fortification Vulnerability); random play on the
// scenarios that have Radios.
import { describe, expect, it } from 'vitest';
import { answerError } from '../../src/engine/decisions';
import { GameDriver } from '../../src/engine/driver';
import { scenario } from '../../src/engine/data';
import { turnFlow } from '../../src/engine/flow';
import { label } from '../../src/engine/hex';
import { artilleryRequestOrder, vulnerableRoll } from '../../src/engine/orders/artillery';
import { randomAnswer } from '../../src/engine/random';
import { cardOf, newGame } from '../../src/engine/state';
import type { Answer, Decision, GameEvent, GameState } from '../../src/engine/types';
import { H, build, card, rolls, run, start, type BuildSpec, type Stepper } from '../support/build';
import { mulberry32 } from '../support/rng';

const G = 'German';
const A = 'American';
const REQ = card(G, { order: 'Artillery Request' });
const REQ2 = card(G, { order: 'Artillery Request' }, [REQ]);
const DENIED = card(A, { order: 'Artillery Denied' });
const RADIO = 'German/Radio:105mm'; // 10 FP, Smoke
const BIG = 'German/Radio:150mm'; // 12 FP

type ChooseD = Extract<Decision, { kind: 'choose' }>;
type ActivateD = Extract<Decision, { kind: 'activate' }>;
type FireEvent = Extract<GameEvent, { kind: 'fireAttack' }>;
type DefenseEvent = Extract<GameEvent, { kind: 'defense' }>;

/** The index of `hex` among the items of the pending choose decision. */
function hexIndex(f: Stepper, hex: string): number {
  const d = f.pending as ChooseD;
  const i = d.items.findIndex((x) => 'hex' in x && x.hex === H(hex));
  if (i < 0) throw new Error(`${hex} is not offered (${d.reason})`);
  return i;
}
const pickHex = (f: Stepper, hex: string) => f.answer({ kind: 'choose', items: [hexIndex(f, hex)] });

/** The Spotter Lt Von Karsties (p0) in H8, the Radio (p1); then `pieces`. The Axis holds the Artillery Request card. */
function spec(x: BuildSpec & { radio?: string; spotter?: string } = {}): BuildSpec {
  return {
    ...x,
    pieces: [{ type: 'German/Lt Von Karsties', hex: x.spotter ?? 'H8' }, { type: x.radio ?? RADIO, where: 'artillery' }, ...(x.pieces ?? [])],
    axis: { hand: [REQ], ...x.axis },
  };
}

/** Give the Artillery Request, activate the Spotter, place the SR in `sr`, and (Smoke-capable Radio) choose the kind. */
function request(s: GameState, sr: string, smoke?: boolean): Stepper {
  const f = start(s, (ctx) => turnFlow(s, ctx));
  f.answer({ kind: 'order', card: REQ, order: 'Artillery Request' }).answer({ kind: 'activate', units: ['p0'] });
  pickHex(f, sr);
  if (smoke !== undefined) {
    expect(f.pending).toMatchObject({ kind: 'choose', reason: 'artilleryKind' });
    f.answer({ kind: 'choose', items: [smoke ? 1 : 0] });
  }
  return f;
}

const fires = (f: Stepper) => f.events.filter((e): e is FireEvent => e.kind === 'fireAttack');
const defenses = (f: Stepper) => f.events.filter((e): e is DefenseEvent => e.kind === 'defense');
type MarkerEvent = Extract<GameEvent, { kind: 'place' | 'remove' }>;
const srTrail = (f: Stepper) =>
  f.events.filter((e): e is MarkerEvent => (e.kind === 'place' || e.kind === 'remove') && e.marker === 'sr').map((e) => `${e.kind} ${label(e.hex)}`);

describe('Artillery Denied (§O17)', () => {
  const denied = (broken: boolean) =>
    build({
      active: 'allied',
      pieces: [{ type: RADIO, where: 'artillery', broken }, { type: 'American/Line Squad', hex: 'E2' }],
      allied: { hand: [DENIED] },
    });

  it('needs an enemy Radio in play', () => {
    const s = build({ active: 'allied', pieces: [{ type: 'American/Line Squad', hex: 'E2' }], allied: { hand: [DENIED] } });
    const r = run(s, (ctx) => turnFlow(s, ctx), () => undefined);
    expect((r.pending as Extract<Decision, { kind: 'turn' }>).orders).toEqual([]);
  });

  it('breaks the enemy Radio; nothing is activated', () => {
    const s = denied(false);
    const f = start(s, (ctx) => turnFlow(s, ctx));
    expect(f.pending).toMatchObject({ kind: 'turn', orders: [{ card: DENIED, order: 'Artillery Denied' }] });
    f.answer({ kind: 'order', card: DENIED, order: 'Artillery Denied' });
    expect(s.pieces.p0).toMatchObject({ where: 'artillery', broken: true });
    expect(f.events).toContainEqual({ kind: 'break', piece: 'p0' });
    expect(s.turn.activated).toEqual([]);
  });

  it('eliminates a broken Radio: it goes back to the counter mix', () => {
    const s = denied(true);
    start(s, (ctx) => turnFlow(s, ctx)).answer({ kind: 'order', card: DENIED, order: 'Artillery Denied' });
    expect(s.pieces.p0.where).toBe('mix');
    expect(s.players.axis.casualties).toEqual([]);
  });
});

describe('Battery Access (§O18.1)', () => {
  it('flips a broken Radio; nothing is activated, so a second Request may Fire For Effect', () => {
    const s = build(spec({ pieces: [], axis: { hand: [REQ, REQ2] } }));
    s.pieces.p1.broken = true;
    s.pieces.p0.broken = true; // no Spotter: Battery Access is still possible
    const f = start(s, (ctx) => turnFlow(s, ctx));
    expect((f.pending as Extract<Decision, { kind: 'turn' }>).orders.map((o) => o.order)).toEqual(['Artillery Request', 'Artillery Request']);
    f.answer({ kind: 'order', card: REQ, order: 'Artillery Request' });
    expect(s.pieces.p1.broken).toBe(false);
    expect(f.events).toContainEqual({ kind: 'fix', piece: 'p1' });
    expect(s.turn.activated).toEqual([]);
    // the Radio works now, but there is no unbroken Leader to spot
    expect(f.pending).toBeNull();
  });

  it('then Fire For Effect in the same Turn', () => {
    const s = build(spec({ pieces: [], axis: { hand: [REQ, REQ2] } }));
    s.pieces.p1.broken = true;
    const f = start(s, (ctx) => turnFlow(s, ctx));
    f.answer({ kind: 'order', card: REQ, order: 'Artillery Request' });
    expect(f.pending).toMatchObject({ kind: 'turn', orders: [{ card: REQ2, order: 'Artillery Request' }], canPass: false });
    f.answer({ kind: 'order', card: REQ2, order: 'Artillery Request' });
    expect(f.pending).toMatchObject({ kind: 'activate', order: 'Artillery Request', units: ['p0'] });
  });
});

describe('Fire For Effect: the Spotter (§O18.2)', () => {
  const s0 = () =>
    build(spec({
      pieces: [
        { type: 'German/Sgt Pfeiffer', hex: 'G8', broken: true }, // p2: a broken Leader cannot spot
        { type: 'German/Rifle Squad', hex: 'H8' }, // p3: in Von Karsties' radius
        { type: 'German/Sgt Pfeiffer', hex: 'G8' }, // p4 (a second counter, for the test)
        { type: 'American/Line Squad', hex: 'H3' }, // p5
      ],
    }));

  it('needs an unbroken Radio and an unbroken Leader not yet activated', () => {
    const s = s0();
    expect(artilleryRequestOrder.canGive(s, 'axis')).toBe(true);
    s.turn.activated = ['p0', 'p4'];
    expect(artilleryRequestOrder.canGive(s, 'axis')).toBe(false);
    s.turn.activated = [];
    s.pieces.p0.broken = true;
    s.pieces.p4.broken = true;
    expect(artilleryRequestOrder.canGive(s, 'axis')).toBe(false);
    expect(artilleryRequestOrder.canGive(s, 'allied')).toBe(false); // no Radio
  });

  it('activates the Spotter alone', () => {
    const s = s0();
    const f = start(s, (ctx) => turnFlow(s, ctx)).answer({ kind: 'order', card: REQ, order: 'Artillery Request' });
    const d = f.pending as ActivateD;
    expect(d).toMatchObject({ kind: 'activate', order: 'Artillery Request' });
    expect(d.units.sort()).toEqual(['p0', 'p4']);
    expect(answerError(s, d, { kind: 'activate', units: ['p0', 'p3'] })).toMatch(/Spotter/);
    expect(answerError(s, d, { kind: 'activate', units: ['p3'] })).not.toBeNull();
    f.answer({ kind: 'activate', units: ['p0'] });
    expect(s.turn.activated).toEqual(['p0']);
    expect(f.pending).toMatchObject({ kind: 'choose', reason: 'spotterSR' });
  });

  it('places the Spotting Round in any hex in his LOS: any range, impassable hexes too, not past an Obstacle', () => {
    const s = build(spec({ map: { terrain: { H7: 'Woods', K8: 'Water' } } }));
    const f = start(s, (ctx) => turnFlow(s, ctx));
    f.answer({ kind: 'order', card: REQ, order: 'Artillery Request' }).answer({ kind: 'activate', units: ['p0'] });
    const hexes = (f.pending as ChooseD).items.map((x) => label((x as { hex: number }).hex));
    expect(hexes).toEqual(expect.arrayContaining(['H8', 'H7', 'K8', 'A1', 'O10']));
    expect(hexes).not.toContain('H6');
    expect(hexes).not.toContain('H1');
    pickHex(f, 'K8');
    expect(s.spottingRound).toBe(H('K8'));
    expect(f.events).toContainEqual({ kind: 'place', hex: H('K8'), marker: 'sr' });
  });
});

describe('Fire For Effect: Accuracy and drift (§O18.2.2)', () => {
  // Spotter H8 → SR H5: range 3
  it('a hit (product above the range) drifts one hex by the white die, then one by the coloured die', () => {
    const s = build(spec({ axis: { top: [...rolls(G, [[2, 4]]), card(G, { white: 1, red: 2 })] } }));
    const f = request(s, 'H5', false);
    expect(f.events.find((e) => e.kind === 'targeting')).toMatchObject({ piece: 'p1', target: H('H5'), product: 8, need: 4, hit: true });
    expect(f.events.find((e) => e.kind === 'reveal' && e.purpose === 'drift')).toBeTruthy();
    expect(srTrail(f)).toEqual(['place H5', 'place H4', 'place I4', 'remove I4']);
    expect(s.spottingRound).toBe(-1);
  });

  it('a hit may drift back to where it was placed', () => {
    const s = build(spec({ axis: { top: [...rolls(G, [[2, 4]]), card(G, { white: 2, red: 5 }, [REQ])] } }));
    const f = request(s, 'H5', false);
    expect(srTrail(f)).toEqual(['place H5', 'place I5', 'place H5', 'remove H5']);
  });

  it('a miss drifts by the white die as many hexes as the coloured die shows', () => {
    const s = build(spec({ axis: { top: [...rolls(G, [[1, 3]]), card(G, { white: 4, red: 2 })] } }));
    const f = request(s, 'H3', false); // range 5: 3 misses
    expect(f.events.find((e) => e.kind === 'targeting')).toMatchObject({ product: 3, hit: false });
    expect(srTrail(f)).toEqual(['place H3', 'place H4', 'place H5', 'remove H5']);
  });

  it('the largest Hindrance on the Spotter\'s LOS is taken off the product', () => {
    const s = build(spec({ map: { terrain: { H7: 'Brush' } }, axis: { top: [...rolls(G, [[2, 3]]), card(G, { white: 4, red: 1 })] } }));
    const f = request(s, 'H5', false);
    expect(f.events.find((e) => e.kind === 'targeting')).toMatchObject({ product: 6, need: 7, hit: false });
    expect(srTrail(f)).toEqual(['place H5', 'place H6', 'remove H6']);
  });

  it('the Accuracy roll triggers (Event!, Sniper!, Time!) and may be re-rolled; the drift card is a reveal, not a roll', () => {
    const t = card(G, { trigger: 'Time' });
    const s = build(spec({ axis: { top: [t, card(G, { white: 3, red: 3 }, [t])] } }));
    const f = start(s, (ctx) => turnFlow(s, ctx));
    f.answer({ kind: 'order', card: REQ, order: 'Artillery Request' }).answer({ kind: 'activate', units: ['p0'] });
    pickHex(f, 'H5');
    f.answer({ kind: 'choose', items: [0] });
    const rerolls = f.decisions.filter((d) => d.kind === 'reroll').map((d) => (d as Extract<Decision, { kind: 'reroll' }>).roll.purpose);
    expect(rerolls[0]).toBe('accuracy');
    expect(rerolls).not.toContain('drift');
    expect(f.events.some((e) => e.kind === 'reveal' && e.purpose === 'drift')).toBe(true);
    expect(f.events).toContainEqual(expect.objectContaining({ kind: 'trigger', trigger: 'Time' }));
    expect(s.time).toBe(1);
  });

  it('off the map at any point, even for a moment: the SR is removed and the Order ends with no effect', () => {
    const s = build(spec({
      pieces: [{ type: 'American/Line Squad', hex: 'H1' }, { type: 'American/Line Squad', hex: 'H2' }],
      axis: { top: [...rolls(G, [[2, 4]]), card(G, { white: 1, red: 4 })] }, // N off the map, then S would come back
    }));
    const f = request(s, 'H1', false); // range 7: 8 hits
    expect(srTrail(f)).toEqual(['place H1', 'remove H1']);
    expect(fires(f)).toEqual([]);
    expect(s.spottingRound).toBe(-1);
    expect(f.pending).toBeNull();
  });

  it('a miss that runs off the map is cancelled too', () => {
    const s = build(spec({ pieces: [{ type: 'American/Line Squad', hex: 'H1' }], axis: { top: [...rolls(G, [[1, 2]]), card(G, { white: 1, red: 4 }, [REQ])] } }));
    const f = request(s, 'H3', false);
    expect(srTrail(f)).toEqual(['place H3', 'place H2', 'place H1', 'remove H1']);
    expect(fires(f)).toEqual([]);
  });
});

describe('Fire For Effect: Impact (§O18.2.3)', () => {
  // SR H5, hit, drift 2 then 5 → back to H5. Blast: H5 and H4 I5 I6 H6 G6 G5.
  const hitH5 = () => [...rolls(G, [[2, 4]]), card(G, { white: 2, red: 5 }, [REQ])];

  it('one Impact roll per blast hex with a unit (either side) or a Fortification, in the order the requester picks', () => {
    const top = [...hitH5(), ...rolls(G, [[1, 2], [3, 1], [4, 1], [6, 2]])];
    const s = build(spec({
      pieces: [
        { type: 'American/Line Squad', hex: 'H5' }, // p2
        { type: 'German/Rifle Squad', hex: 'G6' }, // p3: friendly units are hit too
        { type: 'American/Line Squad', hex: 'H3' }, // p4: outside the blast
      ],
      fort: { I6: 'foxholes' },
      axis: { top },
      allied: { top: rolls(A, [8]) },
    }));
    const f = request(s, 'H5', false);
    let d = f.pending as ChooseD;
    expect(d).toMatchObject({ kind: 'choose', reason: 'impactOrder', side: 'axis', min: 1, max: 1 });
    expect(d.items.map((x) => label((x as { hex: number }).hex))).toEqual(['G6', 'H5', 'I6']);
    pickHex(f, 'I6');
    d = f.pending as ChooseD;
    expect(d.items.map((x) => label((x as { hex: number }).hex))).toEqual(['G6', 'H5']);
    pickHex(f, 'H5');
    expect(f.pending).toBeNull(); // G6 is the last one: no question
    expect(fires(f).map((e) => [label(e.target), e.fp, e.total])).toEqual([['I6', 10, 13], ['H5', 10, 14], ['G6', 10, 15]]);
    expect(defenses(f).map((e) => [e.unit, e.morale, e.total, e.result])).toEqual([['p2', 6, 14, 'suppress'], ['p3', 7, 15, 'suppress']]);
    expect(s.pieces.p4.suppressed).toBe(false);
    expect(srTrail(f)).toEqual(['place H5', 'place I5', 'place H5', 'remove H5']);
  });

  it('Airburst +2 in Woods; Fortifications +1 Cover; no Wall or Hedge Cover; no height modifiers', () => {
    const top = [...hitH5(), ...rolls(G, [[1, 2], [1, 3], [2, 1]])];
    const s = build(spec({
      map: {
        terrain: { G5: 'Woods' }, elevation: { H8: 1 }, crest: ['H8'],
        hexsides: [['H5', 'H6', 'Wall'], ['H5', 'H4', 'Wall'], ['H5', 'I5', 'Wall'], ['H5', 'G5', 'Hedge'], ['H5', 'G6', 'Wall'], ['H5', 'I6', 'Wall']],
      },
      pieces: [
        { type: 'American/Line Squad', hex: 'G5' }, // p2: Woods, Cover 2
        { type: 'American/Line Squad', hex: 'H5' }, // p3: Wall all around, lower than the Spotter (no +1)
        { type: 'American/Line Squad', hex: 'I5' }, // p4: Foxholes
      ],
      fort: { I5: 'foxholes' },
      axis: { top },
      allied: { top: rolls(A, [11, 11, 11]) },
    }));
    const f = request(s, 'H5', false);
    pickHex(f, 'G5');
    pickHex(f, 'H5');
    expect(fires(f).map((e) => [label(e.target), e.total])).toEqual([['G5', 10 + 3 + 2], ['H5', 14], ['I5', 13]]);
    expect(defenses(f).map((e) => [e.unit, e.morale])).toEqual([['p2', 6 + 2], ['p3', 6], ['p4', 6 + 3 + 1]]);
  });

  it('Jammed! on an Impact roll has no effect; the hit units are attacked by Radio FP + the roll', () => {
    const jam = card(G, { trigger: 'Jammed' });
    const c = cardOf(jam);
    const s = build(spec({ pieces: [{ type: 'American/Line Squad', hex: 'H5' }], axis: { top: [...hitH5(), jam] }, allied: { top: rolls(A, [11]) } }));
    const f = request(s, 'H5', false);
    expect(s.pieces.p1.broken).toBe(false);
    expect(fires(f).map((e) => e.total)).toEqual([10 + c.white + c.red]);
    expect(defenses(f)).toHaveLength(1);
  });

  it('Fortification Vulnerability: the exact roll for the Radio\'s FP destroys the Fortification before any Defense roll', () => {
    expect([8, 9, 10, 11, 12, 13].map(vulnerableRoll)).toEqual([12, 11, 10, 9, 8, 7]);
    const s = build(spec({ pieces: [{ type: 'American/Line Squad', hex: 'H5' }], fort: { H5: 'pillbox', G5: 'wire' }, axis: { top: [...hitH5(), ...rolls(G, [[4, 6], [6, 4]])] }, allied: { top: rolls(A, [11]) } }));
    const f = request(s, 'H5', false);
    pickHex(f, 'H5');
    expect(s.fort[H('H5')]).toBeNull();
    expect(s.fort[H('G5')]).toBeNull();
    expect(f.events).toContainEqual({ kind: 'remove', hex: H('H5'), marker: 'pillbox' });
    expect(defenses(f)[0].morale).toBe(6); // the Pillbox was gone before the roll
  });

  it('another roll leaves it; the result uses the Fortification\'s Cover +1', () => {
    const s = build(spec({ pieces: [{ type: 'American/Line Squad', hex: 'H5' }], fort: { H5: 'pillbox' }, axis: { top: [...hitH5(), ...rolls(G, [[5, 6]])] }, allied: { top: rolls(A, [3]) } }));
    const f = request(s, 'H5', false);
    expect(s.fort[H('H5')]).toBe('pillbox');
    expect(defenses(f)[0]).toMatchObject({ morale: 6 + 6, total: 15, attack: 21, result: 'break' });
    expect(f.events).toContainEqual({ kind: 'break', piece: 'p2' });
  });

  it('a 12-FP Radio needs an 8', () => {
    const s = build(spec({ radio: BIG, fort: { H5: 'trench' }, axis: { top: [...hitH5(), ...rolls(G, [[2, 6]])] } }));
    request(s, 'H5', false);
    expect(s.fort[H('H5')]).toBeNull();
  });
});

describe('Fire For Effect: Smoke barrage (§O18.2.3, R-26, R-42)', () => {
  it('is announced before Accuracy, only with a Radio that shows Smoke', () => {
    const s = build(spec({ axis: { top: rolls(G, [[2, 4]]) } }));
    const f = start(s, (ctx) => turnFlow(s, ctx));
    f.answer({ kind: 'order', card: REQ, order: 'Artillery Request' }).answer({ kind: 'activate', units: ['p0'] });
    pickHex(f, 'H5');
    expect(f.pending).toMatchObject({ kind: 'choose', reason: 'artilleryKind', items: [{ label: 'Barrage' }, { label: 'Smoke barrage' }], min: 1, max: 1 });
    expect(f.events.some((e) => e.kind === 'reveal')).toBe(false);

    const t = build(spec({ pieces: [], radio: 'American/Radio:203mm', axis: { top: rolls(G, [[2, 4]]) } }));
    t.pieces.p1.side = 'axis';
    const g = start(t, (ctx) => turnFlow(t, ctx));
    g.answer({ kind: 'order', card: REQ, order: 'Artillery Request' }).answer({ kind: 'activate', units: ['p0'] });
    pickHex(g, 'H5');
    expect(g.pending?.kind === 'choose' && g.pending.reason === 'artilleryKind').toBe(false);
  });

  it('puts a random Smoke in each of the seven hexes (not Water or Blaze; the larger stays); no Impact rolls', () => {
    const s = build(spec({
      map: { terrain: { I6: 'Water' } },
      pieces: [{ type: 'American/Line Squad', hex: 'H5' }],
      smoke: { H4: 4, G5: 9 },
      axis: { top: [...rolls(G, [[2, 4]]), card(G, { white: 2, red: 5 }, [REQ])] },
    }));
    s.blaze[H('G6')] = true;
    // H5 draws 3; H4 draws 7, beating the 4 there (which goes back: the cup holds only 4s then); I5 and H6 draw 4s; I6
    // (Water) and G6 (Blaze) draw nothing; G5 draws a 4, which loses to the 9 there and goes back
    s.smokeCup = [3, 7, 4, 4, 4, 4];
    const f = request(s, 'H5', true);
    const at = (h: string) => s.smoke[H(h)];
    expect(['H5', 'H4', 'I5', 'I6', 'H6', 'G6', 'G5'].map(at)).toEqual([3, 7, 4, 0, 4, 0, 9]);
    expect(s.smokeCup).toEqual([4, 4, 4]);
    expect(fires(f)).toEqual([]);
    expect(defenses(f)).toEqual([]);
    expect(srTrail(f)).toEqual(['place H5', 'place I5', 'place H5', 'remove H5']);
    expect(s.spottingRound).toBe(-1);
  });
});

describe('random play on the scenarios with Radios (2, 4, 9) and with Weapons that fire Smoke (11, 12)', () => {
  /** Play one whole random game; count Artillery Orders, Spotting Rounds, impacts and Smoke rounds in `seen`. */
  function play(id: string, seed: number, rnd: () => number, seen: Record<string, number>): void {
    const d = new GameDriver(newGame(scenario(id), seed));
    let n = 0;
    while (d.pending && n < 40000) {
      const a: Answer = randomAnswer(d.state, d.pending, rnd);
      if (!d.answer(a)) throw new Error(`scenario ${id} seed ${seed}: refused ${JSON.stringify(a)}: ${d.lastError}`);
      n++;
      for (const { e } of d.drainEvents()) {
        if (e.kind === 'cardPlayed' && e.as === 'order' && e.name.startsWith('Artillery')) seen[e.name] = (seen[e.name] ?? 0) + 1;
        if (e.kind === 'place' && e.marker === 'sr') seen.sr = (seen.sr ?? 0) + 1;
        if (e.kind === 'fireAttack' && d.state.pieces[e.pieces[0]]?.where === 'artillery') seen.impact = (seen.impact ?? 0) + 1;
        if (e.kind === 'log' && e.text.includes('a Smoke round')) seen.smokeRound = (seen.smokeRound ?? 0) + 1;
      }
    }
    expect(d.state.phase, `scenario ${id} seed ${seed}`).toBe('over');
    expect(d.state.spottingRound).toBe(-1);
  }

  it('plays whole games with every random answer accepted; Artillery Orders are given, Smoke rounds fired', () => {
    const rnd = mulberry32(88);
    const seen: Record<string, number> = {};
    for (const id of ['2', '4', '9', '11', '12']) for (let i = 0; i < 4; i++) play(id, i * 101 + 3, rnd, seen);
    // Smoke rounds are rarer (a random player seldom picks them, and scenario 12's Fog thins its targets): play further
    // games of the Smoke scenarios until one is fired, so this checks they are reachable without hanging on one seed.
    for (let i = 4; !seen.smokeRound && i < 20; i++) play(i % 2 ? '11' : '12', i * 101 + 3, rnd, seen);
    expect(seen['Artillery Request']).toBeGreaterThan(0);
    expect(seen.sr).toBeGreaterThan(0);
    expect(seen.impact).toBeGreaterThan(0);
    expect(seen.smokeRound).toBeGreaterThan(0);
  }, 180_000);
});
