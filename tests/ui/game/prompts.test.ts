// The prompt model (pure): for every decision kind the human can be asked, what the screen offers and what a click
// answers. Every answer a prompt offers must be legal (answerError) — checked over whole random games for every human
// decision met — plus the specifics of each kind, the generic 'choose', and an unknown kind.
import { describe, expect, it } from 'vitest';
import { answerError } from '../../../src/engine/decisions';
import type { GameDriver } from '../../../src/engine/driver';
import { randomAnswer } from '../../../src/engine/random';
import type { Answer, Decision, GameState, Side } from '../../../src/engine/types';
import { viewOf } from '../../../src/ui/game/hidden';
import { NO_SEL, clickCard, clickHex, clickPiece, promptFor, type ClickResult, type PromptModel, type Sel } from '../../../src/ui/game/prompts';
import { newDriver, newSessionConfig } from '../../../src/ui/game/session';
import { build, cardsWhere } from '../../support/build';

function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 22695477) + 1) >>> 0;
    return x / 0x100000000;
  };
}

const legal = (s: GameState, d: Decision, a: Answer) => answerError(s, d, a) === null;

/** Every answer the model offers directly (buttons and list) is legal. */
function checkOffers(s: GameState, d: Decision, m: PromptModel) {
  for (const b of [...m.buttons, ...m.list]) {
    if (b.disabled) continue;
    if (b.answer) expect(answerError(s, d, b.answer), `${d.kind}: button "${b.label}"`).toBeNull();
    if (b.answers?.length) expect(answerError(s, d, b.answers[0]), `${d.kind}: button "${b.label}"`).toBeNull();
  }
}

/** A click's answer, if any, is legal. */
function checkClick(s: GameState, d: Decision, r: ClickResult, what: string) {
  if (r.answer) expect(answerError(s, d, r.answer), `${d.kind}: ${what}`).toBeNull();
  if (r.answers?.length) expect(answerError(s, d, r.answers[0]), `${d.kind}: ${what}`).toBeNull();
}

/** Click around the prompt of `d` (two levels of selection deep) and check every answer it gives. */
function explore(s: GameState, d: Decision, human: Side, sel: Sel = NO_SEL, depth = 0): Set<string> {
  const kinds = new Set<string>();
  const m = promptFor(s, d, sel, human);
  expect(m.title.length).toBeGreaterThan(0);
  checkOffers(s, d, m);
  const go = (r: ClickResult, what: string) => {
    checkClick(s, d, r, what);
    if (r.answer) kinds.add(r.answer.kind);
    if (r.answers?.length) kinds.add(r.answers[0].kind);
    if (r.sel && depth < 2) for (const k of explore(s, d, human, r.sel, depth + 1)) kinds.add(k);
  };
  for (const h of [...m.selectable, ...m.targets].slice(0, 12)) go(clickHex(s, d, sel, h), `hex ${h}`);
  for (const id of m.pieces.slice(0, 8)) go(clickPiece(s, d, sel, id), `piece ${id}`);
  for (const c of m.cards.slice(0, 6)) go(clickCard(s, d, sel, c), `card ${c}`);
  for (const b of [...m.buttons, ...m.list]) {
    if (b.disabled) continue;
    if (b.answer) kinds.add(b.answer.kind);
    if (b.sel && depth < 2) for (const k of explore(s, d, human, { ...sel, ...b.sel }, depth + 1)) kinds.add(k);
  }
  return kinds;
}

describe('the prompts over whole random games', () => {
  for (const [id, human, seed] of [['1', 'axis', 2], ['2', 'allied', 6], ['4', 'axis', 1], ['7', 'allied', 12], ['9', 'axis', 3]] as [string, Side, number][]) {
    it(`scenario ${id} (${human}): every human decision gets a prompt whose offers are all legal`, () => {
      const d: GameDriver = newDriver(newSessionConfig(id, human, 'line', seed));
      const rnd = rng(seed);
      const seen = new Set<string>();
      for (let i = 0; i < 900 && d.pending && d.state.phase !== 'over'; i++) {
        const p = d.pending;
        if (p.side === human && (i % 3 === 0 || !seen.has(p.kind))) {
          seen.add(p.kind);
          explore(viewOf(d.state, human), p, human);
        }
        expect(d.answer(randomAnswer(d.state, p, rnd))).toBe(true);
      }
      expect(seen.has('turn')).toBe(true);
    });
  }
});

describe('each decision kind', () => {
  it("'deploy': lights the set-up area and places the chosen piece where the human clicks", () => {
    const d = newDriver(newSessionConfig('3', 'axis', 'line', 4));
    while (d.pending && (d.pending.kind !== 'deploy' || d.pending.side !== 'axis')) d.answer(randomAnswer(d.state, d.pending, rng(1)));
    const dec = d.pending!;
    const s = viewOf(d.state, 'axis');
    const m = promptFor(s, dec, NO_SEL, 'axis');
    expect(m.kind).toBe('deploy');
    expect(m.selectable.length).toBeGreaterThan(0);
    expect(m.buttons.some((b) => b.answer?.kind === 'done')).toBe(true);
    const r = clickHex(s, dec, NO_SEL, m.selectable[0]);
    expect(r.answer?.kind).toBe('deploy');
    expect(legal(s, dec, r.answer!)).toBe(true);
  });

  it("'turn': lit Order cards, two clicks give the Order; Pass… lets him pick discards", () => {
    const d = newDriver(newSessionConfig('2', 'axis', 'line', 8));
    const rnd = rng(8);
    while (d.pending && !(d.pending.kind === 'turn' && d.pending.side === 'axis' && d.pending.canPass && d.pending.orders.length)) d.answer(randomAnswer(d.state, d.pending, rnd));
    const dec = d.pending as Extract<Decision, { kind: 'turn' }>;
    const s = viewOf(d.state, 'axis');
    const m = promptFor(s, dec, NO_SEL, 'axis');
    expect(m.cards).toEqual(dec.orders.map((o) => o.card));
    expect(m.cardTags[dec.orders[0].card]).toBe(dec.orders[0].order);
    const first = clickCard(s, dec, NO_SEL, dec.orders[0].card);
    expect(first.sel?.cards).toEqual([dec.orders[0].card]);
    const m2 = promptFor(s, dec, first.sel!, 'axis');
    expect(m2.buttons[0].answer).toEqual({ kind: 'order', card: dec.orders[0].card, order: dec.orders[0].order });
    expect(clickCard(s, dec, first.sel!, dec.orders[0].card).answer?.kind).toBe('order');
    // pass with discards
    const passing = { ...NO_SEL, ...m.buttons.find((b) => b.key === 'pass')!.sel };
    expect(passing.passing).toBe(true);
    const hand = s.players.axis.hand;
    const picked = clickCard(s, dec, passing, hand[0]).sel!;
    const pm = promptFor(s, dec, picked, 'axis');
    const pass = pm.buttons.find((b) => b.key === 'pass')!;
    expect(pass.answer).toEqual({ kind: 'pass', discard: [hand[0]] });
    expect(legal(s, dec, pass.answer!)).toBe(true);
  });

  it("'activate': a Leader brings his Command radius, the button activates the selection", () => {
    const s = build({
      map: {},
      axis: { nation: 'German', hand: cardsWhere('German', { order: 'Fire' }).slice(0, 2) },
      pieces: [
        { type: 'German/Sgt Biermann', hex: 'C5' },
        { type: 'German/Rifle Squad', hex: 'C5' },
        { type: 'German/Rifle Squad', hex: 'D5' },
        { type: 'Russian/Rifle Squad', hex: 'C8' },
      ],
    });
    const ids = Object.keys(s.pieces);
    const leader = ids.find((id) => s.pieces[id].type === 'German/Sgt Biermann')!;
    const dec: Decision = { kind: 'activate', side: 'axis', order: 'Fire', card: s.players.axis.hand[0], units: ids.filter((id) => s.pieces[id].side === 'axis') };
    const r = clickPiece(s, dec, NO_SEL, leader);
    expect(r.sel!.pieces[0]).toBe(leader);
    expect(r.sel!.pieces.length).toBeGreaterThan(1);
    const m = promptFor(s, dec, r.sel!, 'axis');
    const go = m.buttons.find((b) => b.key === 'go')!;
    expect(go.disabled).toBeFalsy();
    expect(legal(s, dec, go.answer!)).toBe(true);
    // a radius unit toggles off
    const off = clickPiece(s, dec, r.sel!, r.sel!.pieces[1]);
    expect(off.sel!.pieces).not.toContain(r.sel!.pieces[1]);
  });

  it("'fire': red targets with their FP; a click aims the strongest attack, the preview shows the odds, a second click fires", () => {
    const s = build({
      pieces: [
        { type: 'German/Rifle Squad', hex: 'C5', weapon: 'German/LMG' },
        { type: 'German/Rifle Squad', hex: 'C6' },
        { type: 'Russian/Rifle Squad', hex: 'C8' },
      ],
    });
    const mine = Object.keys(s.pieces).filter((id) => s.pieces[id].side === 'axis');
    const dec: Decision = { kind: 'fire', side: 'axis', mode: 'order', pieces: mine };
    const m = promptFor(s, dec, NO_SEL, 'axis');
    const target = m.targets[0];
    expect(m.targets.length).toBe(1);
    expect(m.marks.find((x) => x.hex === target)?.label).toMatch(/FP/);
    const r = clickHex(s, dec, NO_SEL, target);
    expect(r.sel!.pieces.length).toBe(3); // two squads and the LMG, as one Fire Group
    const m2 = promptFor(s, dec, r.sel!, 'axis');
    expect(m2.detail.join(' ')).toMatch(/Morale .* breaks/);
    const fire = m2.buttons.find((b) => b.key === 'fire')!;
    expect(legal(s, dec, fire.answer!)).toBe(true);
    expect(clickHex(s, dec, r.sel!, target).answer).toEqual(fire.answer);
    expect(m.buttons.some((b) => b.answer?.kind === 'done')).toBe(true);
  });

  it("'move': a stack moves together; reachable hexes show the MP left; a far hex is a path of steps", () => {
    const s = build({
      pieces: [
        { type: 'German/Sgt Biermann', hex: 'C5' },
        { type: 'German/Rifle Squad', hex: 'C5' },
      ],
    });
    const ids = Object.keys(s.pieces);
    s.turn.moving = ids.slice();
    s.turn.move = { spent: {}, road: [], done: [], group: null, entered: false };
    const mp = Object.fromEntries(ids.map((id) => [id, 4]));
    const dec: Decision = { kind: 'move', side: 'axis', units: ids, current: null, mp, mustMove: true };
    const r = clickHex(s, dec, NO_SEL, s.pieces[ids[0]].hex);
    expect(r.sel!.pieces.sort()).toEqual(ids.slice().sort());
    const m = promptFor(s, dec, r.sel!, 'axis');
    expect(m.selectable.length).toBeGreaterThan(6);
    expect(m.marks.some((x) => /MP/.test(x.label))).toBe(true);
    expect(m.buttons.find((b) => b.key === 'end')!.disabled).toBe(true);
    const far = m.marks.find((x) => x.label === '1 MP' || x.label === '0 MP')!;
    const path = clickHex(s, dec, r.sel!, far.hex);
    expect(path.answers!.length).toBeGreaterThan(1);
    expect(legal(s, dec, path.answers![0])).toBe(true);
  });

  it("'react': each Action once (several cards of it grouped), its text, and Pass", () => {
    const s = build({ axis: { hand: cardsWhere('German', { action: 'Concealment' }).slice(0, 2) }, pieces: [{ type: 'German/Rifle Squad', hex: 'C5' }] });
    const [c1, c2] = s.players.axis.hand;
    const dec: Decision = {
      kind: 'react', side: 'axis', window: 'beforeDefenseRoll',
      options: [{ card: c1, action: 'Concealment' }, { card: c2, action: 'Concealment' }],
      info: { hex: 22, units: [Object.keys(s.pieces)[0]] },
    };
    const m = promptFor(s, dec, NO_SEL, 'axis');
    expect(m.title).toBe('Before the Defense roll');
    expect(m.list).toHaveLength(1);
    expect(m.list[0].label).toBe('Concealment (2 cards)');
    expect(m.list[0].text).toMatch(/Cover/);
    expect(m.list[0].answer).toEqual({ kind: 'play', option: 0 });
    expect(m.buttons.find((b) => b.key === 'pass')!.answer).toEqual({ kind: 'done' });
  });

  it("'react' with a target: the option asks for it on the board", () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'C5' }] });
    const dec: Decision = {
      kind: 'react', side: 'axis', window: 'timeAdvanceEnd', options: [{ card: 'G-01', action: 'Dig In', targets: { hexes: [22, 23] } }], info: {},
    };
    const m = promptFor(s, dec, NO_SEL, 'axis');
    expect(m.list[0].sel).toEqual({ option: 0 });
    const m2 = promptFor(s, dec, { ...NO_SEL, option: 0 }, 'axis');
    expect(m2.targets).toEqual([22, 23]);
    expect(clickHex(s, dec, { ...NO_SEL, option: 0 }, 23).answer).toEqual({ kind: 'play', option: 0, targets: { hexes: [23] } });
  });

  it("'reroll': shows the roll and offers Keep (default) and Re-roll", () => {
    const s = build({});
    const card = cardsWhere('German', { sum: 4, trigger: null })[0];
    const dec: Decision = { kind: 'reroll', side: 'axis', roll: { side: 'allied', card, purpose: 'fireAttack' } };
    const m = promptFor(s, dec, NO_SEL, 'axis');
    expect(m.showCards).toEqual([card]);
    expect(m.buttons[0]).toMatchObject({ primary: true, answer: { kind: 'reroll', yes: false } });
    expect(m.buttons[1].answer).toEqual({ kind: 'reroll', yes: true });
    expect(m.text).toMatch(/rolled 4/);
  });

  it("'choose': pieces and hexes on the board, labels as buttons, several with a Confirm, none when allowed", () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'C5' }, { type: 'Russian/Rifle Squad', hex: 'D5', broken: true }] });
    const [a, b] = Object.keys(s.pieces);
    const one: Decision = { kind: 'choose', side: 'axis', reason: 'kia', items: [{ piece: a }, { piece: b }], min: 1, max: 1 };
    const m = promptFor(s, one, NO_SEL, 'axis');
    expect(m.title).toBe('KIA');
    expect(m.pieces).toEqual([a, b]);
    expect(m.selectable).toEqual([s.pieces[a].hex, s.pieces[b].hex]);
    expect(clickHex(s, one, NO_SEL, s.pieces[b].hex).answer).toEqual({ kind: 'choose', items: [1] });
    const opt: Decision = { kind: 'choose', side: 'axis', reason: 'sniperTarget', items: [{ piece: a }, { piece: b }], min: 0, max: 1 };
    expect(promptFor(s, opt, NO_SEL, 'axis').buttons.find((x) => x.key === 'none')).toMatchObject({ label: 'Break nobody', answer: { kind: 'choose', items: [] } });
    const many: Decision = { kind: 'choose', side: 'axis', reason: 'deployMarkers', items: [{ hex: 1 }, { hex: 2 }, { hex: 3 }], min: 2, max: 2 };
    const s1 = clickHex(s, many, NO_SEL, 2).sel!;
    const s2 = clickHex(s, many, s1, 3).sel!;
    const ok = promptFor(s, many, s2, 'axis').buttons.find((x) => x.key === 'ok')!;
    expect(ok.disabled).toBe(false);
    expect(ok.answer).toEqual({ kind: 'choose', items: [1, 2] });
    const labels: Decision = { kind: 'choose', side: 'axis', reason: 'initiativeChoice', items: [{ label: 'keep' }, { label: 'give' }], min: 1, max: 1 };
    expect(promptFor(s, labels, NO_SEL, 'axis').list.map((x) => x.label)).toEqual(['Keep the Initiative, move second', 'Give it away, move first']);
    const fresh = { kind: 'choose', side: 'axis', reason: 'someNewReason', items: [{ label: 'x' }], min: 1, max: 1 } as unknown as Decision;
    expect(promptFor(s, fresh, NO_SEL, 'axis').title).toBe('Choose');
  });

  it('an unknown decision kind falls back to a list of answers, never a crash', () => {
    const s = build({});
    const odd = { kind: 'parley', side: 'axis' } as unknown as Decision;
    const m = promptFor(s, odd, NO_SEL, 'axis');
    expect(m.kind).toBe('parley');
    expect(m.title).toBe('Decide');
    expect(clickHex(s, odd, NO_SEL, 3)).toEqual({});
  });
});

describe('choice wording', () => {
  it('every ChoiceReason of the engine has its own wording', async () => {
    const { readFileSync } = await import('node:fs');
    const types = readFileSync('src/engine/types.ts', 'utf8');
    const block = types.slice(types.indexOf('export type ChoiceReason ='), types.indexOf('export type ChoiceItem'));
    const reasons = [...block.matchAll(/\|\s*'([A-Za-z]+)'/g)].map((m) => m[1]);
    const { CHOICE_TEXT } = await import('../../../src/ui/game/choiceText');
    expect(reasons.length).toBeGreaterThan(40);
    expect(reasons.filter((r) => !CHOICE_TEXT[r])).toEqual([]);
  });

  it("'scenarioOption' explains the offer and shows the card", () => {
    const s = build({});
    const card = cardsWhere('German', { sum: 7, trigger: null })[0];
    const d: Decision = {
      kind: 'choose', side: 'axis', reason: 'scenarioOption', items: [{ label: 'Keep 8 FP Mines' }, { label: `7 FP Mines and card ${card} in hand` }],
      min: 1, max: 1, context: { minefield: 7, card },
    };
    const m = promptFor(s, d, NO_SEL, 'axis');
    expect(m.title).toBe('Scenario option');
    expect(m.text).toMatch(/Minefield to 7 FP/);
    expect(m.showCards).toEqual([card]);
    expect(m.list.map((b) => b.answer)).toEqual([{ kind: 'choose', items: [0] }, { kind: 'choose', items: [1] }]);
  });
});

describe('set-up placements', () => {
  /** Scenario 8 or 11 played to the human's first Fortification placement. */
  function toPlacement(id: string, human: Side) {
    const d = newDriver(newSessionConfig(id, human, 'line', 5));
    const rnd = rng(5);
    for (let i = 0; i < 400 && d.pending; i++) {
      const p = d.pending;
      if (p.side === human && p.kind === 'choose' && p.reason === 'placement') return d;
      d.answer(p.kind === 'deploy' ? { kind: 'done' } : randomAnswer(d.state, p, rnd));
    }
    throw new Error('no placement');
  }

  it('hexes are picked on the board; the list of hex labels is folded away', () => {
    const d = toPlacement('8', 'axis');
    const dec = d.pending as Extract<Decision, { kind: 'choose' }>;
    const s = viewOf(d.state, 'axis');
    const m = promptFor(s, dec, NO_SEL, 'axis');
    expect(m.selectable.length).toBe(dec.items.length);
    expect(m.listFolded).toMatch(/list of the \d+ hexes/);
    expect(m.text).toMatch(/Click a lit hex/);
    const r = clickHex(s, dec, NO_SEL, m.selectable[3]);
    expect(r.answer).toEqual({ kind: 'choose', items: [3] });
  });

  it("'Place the rest for me' is offered and places this one legally (Foxholes with the human's units)", () => {
    for (const [id, human] of [['8', 'axis'], ['11', 'allied']] as [string, Side][]) {
      const d = toPlacement(id, human);
      const dec = d.pending as Extract<Decision, { kind: 'choose' }>;
      const s = viewOf(d.state, human);
      const b = promptFor(s, dec, NO_SEL, human).buttons.find((x) => x.key === 'autoFort')!;
      expect(b.special).toBe('autoSetup');
      expect(answerError(s, dec, b.answer!)).toBeNull();
      // Foxholes go with the human's own units
      const hex = (dec.items[(b.answer as { items: number[] }).items[0]] as { hex: number }).hex;
      const kind = (dec.context as { fort: string }).fort;
      const placed = Object.values(s.pieces).some((p) => p.where === 'map' && p.side === human);
      if (kind !== 'wire' && kind !== 'mines' && placed) expect(Object.values(s.pieces).some((p) => p.where === 'map' && p.hex === hex && p.side === human)).toBe(true);
    }
  });
});
