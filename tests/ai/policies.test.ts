// The AI's judgement in small decisions: targets, reactions, re-rolls, generic choices, deployment.
import { describe, expect, it } from 'vitest';
import { planDeployment } from '../../src/ai/deploy';
import { chooseAnswer, newMemory } from '../../src/ai/index';
import { scenario } from '../../src/engine/data';
import { answerError } from '../../src/engine/decisions';
import { distance } from '../../src/engine/hex';
import { setupHexes } from '../../src/engine/setup';
import { figures } from '../../src/engine/stats';
import { isUnit, isWeapon, newGame, redact, typeOf } from '../../src/engine/state';
import type { Answer, Decision, GameState, Side } from '../../src/engine/types';
import { H, build, card, cardsWhere } from '../support/build';

const ask = (s: GameState, d: Decision, side: Side = d.side): Answer => {
  const a = chooseAnswer(redact(s, side), d, { side, level: 'line', seed: 1, deterministic: true }, newMemory(1)).answer;
  expect(answerError(s, d, a)).toBeNull();
  return a;
};

describe('fire', () => {
  it('shoots the squad in the open rather than the one in a building', () => {
    const s = build({
      map: { terrain: { G5: 'Building' } },
      pieces: [
        { type: 'German/Rifle Squad', hex: 'E5' },
        { type: 'American/Line Squad', hex: 'E7' },
        { type: 'American/Line Squad', hex: 'G5' },
      ],
    });
    const a = ask(s, { kind: 'fire', side: 'axis', mode: 'order', pieces: ['p0'], mustFire: true });
    expect(a).toMatchObject({ kind: 'fire', spec: { target: H('E7') } });
  });

  it('fires as a group when the pieces can only reach one target', () => {
    const s = build({
      pieces: [
        { type: 'German/Rifle Squad', hex: 'E5', weapon: 'German/LMG' },
        { type: 'German/Rifle Squad', hex: 'F5' },
        { type: 'American/Line Squad', hex: 'E8' },
      ],
    });
    const a = ask(s, { kind: 'fire', side: 'axis', mode: 'order', pieces: ['p0', 'p1', 'p2'], mustFire: true });
    expect(a.kind).toBe('fire');
    if (a.kind === 'fire') expect(a.spec.pieces.length).toBe(3);
  });
});

describe('reactions', () => {
  it('Op Fires with a Fire card at a squad entering open ground next to its MG', () => {
    const fire = cardsWhere('German', { fireIsAction: true })[0];
    const s = build({
      active: 'allied',
      axis: { hand: [fire] },
      pieces: [
        { type: 'German/Rifle Squad', hex: 'E5', weapon: 'German/LMG' },
        { type: 'American/Line Squad', hex: 'E6' },
      ],
    });
    s.turn.move = { spent: { p2: 1 }, road: [], done: [], group: ['p2'], entered: true };
    s.turn.moving = ['p2'];
    const a = ask(s, { kind: 'react', side: 'axis', window: 'afterHexEntry', options: [{ card: fire, action: 'Fire' }], info: { hex: H('E6'), units: ['p2'], mover: 'allied' } });
    expect(a).toEqual({ kind: 'play', option: 0 });
  });

  it('plays Light Wounds to save a broken Squad from elimination', () => {
    const lw = card('German', { action: 'Light Wounds' });
    const s = build({ axis: { hand: [lw] }, pieces: [{ type: 'German/Rifle Squad', hex: 'E5', broken: true }, { type: 'American/Line Squad', hex: 'E8' }] });
    const a = ask(s, { kind: 'react', side: 'axis', window: 'squadWouldBreak', options: [{ card: lw, action: 'Light Wounds' }], info: { units: ['p0'], hex: H('E5'), cause: 'fire' } });
    expect(a).toEqual({ kind: 'play', option: 0 });
  });

  const concealment = (total: number) => {
    const c = card('German', { action: 'Concealment' });
    const s = build({
      active: 'allied',
      map: { terrain: { E5: 'Woods' } },
      axis: { hand: [c] },
      pieces: [{ type: 'German/Rifle Squad', hex: 'E5', weapon: 'German/LMG' }, { type: 'American/Line Squad', hex: 'E8' }],
    });
    const attack = {
      side: 'allied' as const, mode: 'order' as const, pieces: ['p2'], targets: [H('E5')], ordnance: false, mortarOrArtillery: false,
      ignoresCover: false, fp: 6, bonus: 0, total, reduction: 0, played: [],
    };
    return ask(s, { kind: 'react', side: 'axis', window: 'beforeDefenseRoll', options: [{ card: c, action: 'Concealment' }], info: { hex: H('E5'), units: ['p0'], attack } });
  };

  it('plays Concealment when it saves a unit that would likely break', () => {
    expect(concealment(16)).toEqual({ kind: 'play', option: 0 });
  });

  it('keeps Concealment against a weak attack', () => {
    expect(concealment(8)).toEqual({ kind: 'done' });
  });
});

describe('the Initiative re-roll', () => {
  const sd = (vp: number) => {
    const end = card('German', { sum: 4, trigger: null });
    const s = build({ time: 8, suddenDeath: 7, vp, initiative: 'axis', axis: { discards: [end] } });
    return ask(s, { kind: 'reroll', side: 'axis', roll: { side: 'axis', card: end, purpose: 'suddenDeath' } });
  };
  it('re-rolls a Sudden Death roll that would end the game while it is losing', () => {
    expect(sd(-4)).toEqual({ kind: 'reroll', yes: true });
  });
  it('lets the game end while it is winning', () => {
    expect(sd(4)).toEqual({ kind: 'reroll', yes: false });
  });
});

describe('choices', () => {
  it('a Sniper picks the enemy unit it hurts most (a broken one dies), never its own', () => {
    const s = build({
      pieces: [
        { type: 'German/Rifle Squad', hex: 'E5' },
        { type: 'American/Line Squad', hex: 'E6' },
        { type: 'American/Line Squad', hex: 'F6', broken: true },
      ],
    });
    const a = ask(s, { kind: 'choose', side: 'axis', reason: 'sniperTarget', items: [{ piece: 'p0' }, { piece: 'p1' }, { piece: 'p2' }], min: 0, max: 1 });
    expect(a).toEqual({ kind: 'choose', items: [2] });
  });

  it('a Leader rolls its defence last (its Command counts for the others)', () => {
    const s = build({ pieces: [{ type: 'German/Lt Von Karsties', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'E5' }] });
    const a = ask(s, { kind: 'choose', side: 'axis', reason: 'defenseOrder', items: [{ piece: 'p0' }, { piece: 'p1' }], min: 1, max: 1 });
    expect(a).toEqual({ kind: 'choose', items: [1] });
  });

  it('overstacking: eliminates its least valuable unit', () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'E5', weapon: 'German/LMG' }, { type: 'German/Line Team', hex: 'E5' }, { type: 'German/Rifle Squad', hex: 'E5' }] });
    const a = ask(s, { kind: 'choose', side: 'axis', reason: 'overstackEliminate', items: [{ piece: 'p0' }, { piece: 'p2' }, { piece: 'p3' }], min: 1, max: 1 });
    expect(a).toEqual({ kind: 'choose', items: [1] });
  });

  it('an unknown reason gets a legal, harmless answer', () => {
    const s = build({ pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }, { type: 'American/Line Squad', hex: 'E8' }] });
    const d = { kind: 'choose', side: 'axis', reason: 'somethingNew', items: [{ piece: 'p0' }, { piece: 'p1' }], min: 1, max: 1 } as unknown as Decision;
    expect(ask(s, d)).toEqual({ kind: 'choose', items: [1] });
  });
});

describe('advance', () => {
  it('advances into melee when the odds favour it', () => {
    const s = build({
      pieces: [
        { type: 'German/Rifle Squad', hex: 'E5' },
        { type: 'German/Rifle Squad', hex: 'F5' },
        { type: 'American/Line Team', hex: 'E6', broken: true },
      ],
    });
    const a = ask(s, { kind: 'advance', side: 'axis', units: ['p0', 'p1'], mustAdvance: true });
    expect(a).toMatchObject({ kind: 'advanceTo', to: H('E6') });
  });
});

describe('deployment', () => {
  for (const id of ['2', '3', '10']) {
    it(`scenario ${id}: places every staged piece legally, Weapons with Squads, Leaders with or next to their men`, () => {
      const g = newGame(scenario(id), 3);
      const side = g.scenario.setupFirst;
      const plan = planDeployment(redact(g, side), side);
      const staged = Object.values(g.pieces).filter((p) => p.side === side && p.where === 'staging');
      expect(plan.map((p) => p.piece).sort()).toEqual(staged.map((p) => p.id).sort());
      const area = new Set(setupHexes(g, side));
      for (const pl of plan) expect(area.has(pl.hex)).toBe(true);
      // apply it and check stacking, carriers and Leaders
      for (const pl of plan) {
        const p = g.pieces[pl.piece];
        if (isWeapon(p)) {
          const u = g.pieces[pl.carrier!];
          expect(u.hex).toBe(pl.hex);
          expect(u.weapon).toBeNull();
          u.weapon = p.id;
          p.carrier = u.id;
          p.where = 'carried';
        } else {
          p.where = 'map';
          p.hex = pl.hex;
        }
      }
      for (const h of area) expect(figures(g, h, side)).toBeLessThanOrEqual(7);
      const units = Object.values(g.pieces).filter((p) => p.side === side && p.where === 'map' && isUnit(p));
      for (const l of units.filter((p) => typeOf(p).kind === 'leader')) {
        const near = units.some((u) => u !== l && typeOf(u).kind !== 'leader' && distance(u.hex, l.hex) <= 1);
        expect(near).toBe(true);
      }
    });
  }
});

describe('no stalls', () => {
  it('passes with a discard when nothing changed since its last Turn (both sides passed without discarding)', () => {
    const hand = cardsWhere('German', { order: 'Recover' }).slice(0, 4);
    const s = build({ axis: { hand, posture: 'defend' }, pieces: [{ type: 'German/Rifle Squad', hex: 'E5' }, { type: 'American/Line Squad', hex: 'E9' }] });
    const d: Decision = { kind: 'turn', side: 'axis', orders: [], canPass: true, maxDiscard: 4 };
    const mem = newMemory(2);
    const opts = { side: 'axis' as const, level: 'green' as const, seed: 2, deterministic: true };
    chooseAnswer(redact(s, 'axis'), d, opts, mem);
    const a = chooseAnswer(redact(s, 'axis'), d, opts, mem).answer;
    expect(a.kind).toBe('pass');
    if (a.kind === 'pass') expect(a.discard.length).toBeGreaterThan(0);
  });
});
