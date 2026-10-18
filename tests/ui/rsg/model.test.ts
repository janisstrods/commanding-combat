// The Random Battle screens' model (src/ui/screens/rsg/model.ts): who chooses each step, the hidden information of the
// RSG (the AI's OB pick until both are made, the AI's secret chit always), the start form and URL flags, and the
// hand-off to the battle screen.
import { describe, expect, it } from 'vitest';
import { newRsgDraft, rsgAdvance, rsgChoose, rsgFinish, rsgObOptions, rsgStep, type RsgDraft } from '../../../src/engine/rsg';
import { type Side, other } from '../../../src/engine/types';
import { parseRoute, routeHash } from '../../../src/ui/routes';
import { aiRsgChoice } from '../../../src/ui/screens/rsg/ai';
import {
  HIDDEN_CHIT, RSG_PENDING_KEY, autoSteps, bothObsChosen, chooserOf, defaultForm, formFixed, formOptions, formProblem, obAsSeen, parseFlags, queryOf,
  rsgHandoff, rsgView, runToHuman, stepOnce, storeHandoff, suggestFor, surpriseMe,
} from '../../../src/ui/screens/rsg/model';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Every draft from the start to the end, the player's choices by suggestFor and the AI's by aiRsgChoice. */
function walk(seed: number, humanSide?: Side): RsgDraft[] {
  let d = newRsgDraft({ seed, ...(humanSide ? { humanSide } : {}) });
  const all = [d];
  for (let i = 0; i < 200 && chooserOf(d) !== 'done'; i++) {
    d = autoSteps(d, 1);
    all.push(d);
  }
  expect(chooserOf(d)).toBe('done');
  return all;
}

/** Run to the first choice of `what`. */
function toStep(d: RsgDraft, what: string): RsgDraft {
  for (let i = 0; i < 200; i++) {
    const st = rsgStep(d);
    if (st.kind === 'done') throw new Error(`no ${what} step`);
    if (st.kind === 'choice' && st.what === what) return d;
    d = autoSteps(d, 1);
  }
  throw new Error('no end');
}

describe('who chooses each step', () => {
  it('automatic steps roll, choices go to the side the step names: the player when it is his side, else the AI', () => {
    for (const seed of SEEDS) {
      for (const side of ['axis', 'allied'] as const) {
        for (const d of walk(seed, side)) {
          const st = rsgStep(d);
          const who = chooserOf(d, st);
          if (st.kind === 'done') expect(who).toBe('done');
          else if (st.kind === 'auto') expect(who).toBe('auto');
          else expect(who).toBe(st.side === side ? 'human' : 'ai');
        }
      }
    }
  });

  it('"either" side: the coin flip comes first, then the choices follow the side it gave the player', () => {
    const d = newRsgDraft(formOptions({ ...defaultForm(77), side: 'either' }));
    expect(d.humanSide).toBeNull();
    expect(rsgStep(d)).toMatchObject({ kind: 'auto', what: 'sides' });
    expect(chooserOf(d)).toBe('auto');
    const e = rsgAdvance(d);
    expect(e.humanSide === 'axis' || e.humanSide === 'allied').toBe(true);
    const h = runToHuman(e);
    const st = rsgStep(h);
    if (st.kind === 'choice') expect(st.side).toBe(e.humanSide);
  });

  it('the player is asked only for his own choices: runToHuman stops at them and at the end, never at the AI', () => {
    for (const seed of SEEDS) {
      for (const side of ['axis', 'allied'] as const) {
        let d = newRsgDraft({ seed, humanSide: side });
        const asked: string[] = [];
        for (let i = 0; i < 50; i++) {
          d = runToHuman(d);
          const st = rsgStep(d);
          if (st.kind === 'done') break;
          expect(st.kind).toBe('choice');
          if (st.kind !== 'choice') break;
          expect(st.side).toBe(side);
          asked.push(st.what);
          d = rsgChoose(d, suggestFor(rsgView(d, side), side));
        }
        expect(rsgStep(d).kind).toBe('done');
        expect(asked).toContain('ob'); // every player picks his OB
      }
    }
  });

  it('stepOnce rolls or lets the AI choose, and refuses at the player\'s choice', () => {
    const d = toStep(newRsgDraft({ seed: 4, humanSide: 'allied' }), 'ob');
    expect(rsgStep(d)).toMatchObject({ what: 'ob', side: 'axis' });
    const e = stepOnce(d); // the AI (Axis) picks
    expect(e.ob.axis).not.toBeNull();
    expect(rsgStep(e)).toMatchObject({ what: 'ob', side: 'allied' });
    expect(() => stepOnce(e)).toThrow(/player/);
  });

  it('a seed replays exactly, the AI\'s choices included', () => {
    expect(walk(9, 'axis').at(-1)).toEqual(walk(9, 'axis').at(-1));
    expect(rsgFinish(autoSteps(newRsgDraft({ seed: 9, humanSide: 'axis' }), 'all'))).toEqual(rsgFinish(walk(9, 'axis').at(-1)!));
  });
});

describe('hidden information', () => {
  it("the AI's OB pick is hidden from the player until both OBs are chosen (AI first: player is Allied)", () => {
    for (const seed of SEEDS) {
      let d = toStep(newRsgDraft({ seed, humanSide: 'allied' }), 'ob');
      d = stepOnce(d); // the Axis AI picks first
      expect(d.ob.axis).not.toBeNull();
      expect(bothObsChosen(d)).toBe(false);
      const v = rsgView(d, 'allied');
      expect(v.ob.axis).toBeNull();
      expect(obAsSeen(d, 'allied', 'axis')).toBe('hidden');
      expect(obAsSeen(v, 'allied', 'axis')).toBe('hidden');
      for (const e of v.log) if (e.step === 'ob') expect(e.choice).toBeUndefined();
      expect(JSON.stringify(v.log)).not.toContain(`"letter":"${d.ob.axis!.letter}"`);
      // the player's pick reveals both
      const st = rsgStep(d);
      if (st.kind !== 'choice' || st.what !== 'ob') throw new Error('expected the Allied OB choice');
      const after = rsgChoose(d, { what: 'ob', letter: st.options[0].letter, size: st.options[0].size });
      const w = rsgView(after, 'allied');
      expect(w.ob.axis).toEqual(after.ob.axis);
      expect(obAsSeen(after, 'allied', 'axis')).toEqual(after.ob.axis);
    }
  });

  it("the AI chooses its OB without seeing the player's (player first: player is Axis)", () => {
    const d = toStep(newRsgDraft({ seed: 2, humanSide: 'axis' }), 'ob');
    const st = rsgStep(d);
    if (st.kind !== 'choice' || st.what !== 'ob') throw new Error('expected the Axis OB choice');
    const picks = st.options.map((o) => rsgChoose(d, { what: 'ob', letter: o.letter, size: o.size }));
    // the AI's view hides the player's pick, so every pick of the player gets the same answer
    for (const p of picks) {
      expect(rsgView(p, 'allied').ob.axis).toBeNull();
      expect(obAsSeen(p, 'allied', 'axis')).toBe('hidden');
    }
    const answers = picks.map((p) => JSON.stringify(aiRsgChoice(p, 'allied')));
    expect(new Set(answers).size).toBe(1);
  });

  it("the AI's secret chit is never in the player's view; the player's own is", () => {
    for (const seed of SEEDS) {
      for (const human of ['axis', 'allied'] as const) {
        const ai = other(human);
        for (const d of walk(seed, human)) {
          const v = rsgView(d, human);
          expect(v.secretChits[ai]).toHaveLength(d.secretChits[ai].length);
          expect(v.secretChits[ai].every((c) => c === HIDDEN_CHIT)).toBe(true);
          expect(v.secretChits[human]).toEqual(d.secretChits[human]);
          for (const c of d.secretChits[ai]) {
            for (const e of v.log) if (e.step === 'chits' && e.side === ai) expect(e.text).not.toMatch(new RegExp(`\\b${c}\\b`));
          }
          expect(v.rng).toBe(0); // nor the dice to come
        }
      }
    }
  });

  it('a view leaves the draft as it was and keeps public facts', () => {
    const d = walk(5, 'allied').at(-1)!;
    const copy = JSON.stringify(d);
    const v = rsgView(d, 'allied');
    expect(JSON.stringify(d)).toBe(copy);
    expect(v.vp).toBe(d.vp);
    expect(v.leaders).toEqual(d.leaders);
    expect(v.support).toEqual(d.support);
    expect(v.ob).toEqual(d.ob);
    expect(v.openChits).toEqual(d.openChits);
  });
});

describe('the start form and the URL flags', () => {
  it('turns the form into fixed options; "or surprise me" fixes nothing', () => {
    expect(formFixed(defaultForm(1))).toEqual({});
    const f = { ...defaultForm(1), map: '7', year: 1944, allied: 'American' as const, posture: 'recon' as const };
    expect(formFixed(f)).toEqual({ map: '7', year: 1944, allied: 'American', defender: null });
    expect(formFixed({ ...f, posture: 'axisDefend' }).defender).toBe('axis');
    expect(formOptions({ ...f, side: 'allied' })).toMatchObject({ seed: 1, humanSide: 'allied' });
    expect(formOptions({ ...f, side: 'either' }).humanSide).toBeUndefined();
  });

  it('refuses impossible fixed options (Americans before 1943)', () => {
    expect(formProblem(defaultForm(1))).toBeNull();
    expect(formProblem({ ...defaultForm(1), year: 1941, allied: 'American' })).toMatch(/1941|R0|America/);
    expect(formProblem({ ...defaultForm(1), year: 1941, allied: 'Russian' })).toBeNull();
  });

  it('reads screenshot flags from the hash', () => {
    const f = parseFlags(queryOf('#/random?seed=7&side=axis&level=elite&map=3&year=1944&allied=Russian&posture=alliedDefend&auto=8&hold=1'));
    expect(f).toEqual({ form: { seed: 7, side: 'axis', level: 'elite', map: '3', year: 1944, allied: 'Russian', posture: 'alliedDefend' }, auto: 8, hold: true });
    expect(parseFlags(queryOf('#/random?auto=all')).auto).toBe('all');
    expect(parseFlags(queryOf('#/random?side=german&map=13&auto=x'))).toEqual({ form: {} });
    expect(parseFlags(queryOf('#/random', '?seed=5')).form.seed).toBe(5);
  });

  it('#/random is a route of its own', () => {
    expect(parseRoute('#/random')).toEqual({ kind: 'random' });
    expect(parseRoute('#/random?auto=8')).toEqual({ kind: 'random' });
    expect(routeHash({ kind: 'random' })).toBe('#/random');
    expect(parseRoute('#/random/x').kind).toBe('notFound');
  });

  it('"Surprise me completely" runs the whole RSG for both sides, with the form\'s side and fixed options, the same for the same seed', () => {
    const f = { ...defaultForm(31), side: 'axis' as const, map: '6', year: 1944 };
    const d = surpriseMe(f);
    expect(rsgStep(d).kind).toBe('done');
    expect(d.humanSide).toBe('axis');
    expect(rsgFinish(d)).toMatchObject({ map: '6', year: 1944 });
    expect(surpriseMe(f)).toEqual(d);
    expect(rsgStep(surpriseMe({ ...defaultForm(32), side: 'either' })).kind).toBe('done');
  });

  it('autoSteps plays exactly n steps, "all" to the end', () => {
    const d = newRsgDraft({ seed: 3, humanSide: 'axis' });
    expect(autoSteps(d, 0)).toEqual(d);
    let e = d;
    for (let i = 0; i < 8; i++) e = autoSteps(e, 1);
    expect(autoSteps(d, 8)).toEqual(e);
    expect(rsgStep(autoSteps(d, 'all')).kind).toBe('done');
  });
});

describe('the hand-off to the battle screen', () => {
  it('stores exactly rsgFinish(draft) under cce-rsg-pending and goes to #/play/rsg/<side>/<level>/<seed>', () => {
    for (const [seed, side] of [[4, 'allied'], [11, 'axis']] as const) {
      const d = autoSteps(newRsgDraft({ seed, humanSide: side }), 'all');
      const h = rsgHandoff(d, 'elite');
      expect(h.key).toBe(RSG_PENDING_KEY);
      expect(RSG_PENDING_KEY).toBe('cce-rsg-pending');
      expect(JSON.parse(h.value)).toEqual(rsgFinish(d));
      expect(h.route).toEqual({ kind: 'play', scenario: 'rsg', side, level: 'elite', seed });
      expect(h.hash).toBe(`#/play/rsg/${side}/elite/${seed}`);
      expect(parseRoute(h.hash)).toEqual(h.route);
      const store = new Map<string, string>();
      expect(storeHandoff(h, { setItem: (k: string, v: string) => void store.set(k, v) })).toBe(true);
      expect(store.get('cce-rsg-pending')).toBe(h.value);
      expect(JSON.parse(store.get('cce-rsg-pending')!)).toEqual(rsgFinish(d));
    }
  });

  it('the side "either" hands over the side the coin gave the player', () => {
    const d = autoSteps(newRsgDraft(formOptions({ ...defaultForm(21), side: 'either' })), 'all');
    expect(rsgHandoff(d, 'line').route.side).toBe(d.humanSide);
  });

  it('refuses an unfinished draft and survives a storage that throws', () => {
    expect(() => rsgHandoff(newRsgDraft({ seed: 1, humanSide: 'axis' }), 'line')).toThrow();
    const d = autoSteps(newRsgDraft({ seed: 1, humanSide: 'axis' }), 'all');
    expect(storeHandoff(rsgHandoff(d, 'line'), { setItem: () => { throw new Error('quota'); } })).toBe(false);
    expect(storeHandoff(rsgHandoff(d, 'line'), null)).toBe(false);
  });
});

describe('the AI choice hook', () => {
  it('aiRsgChoice answers every AI step legally and is the engine heuristic on the AI\'s view', () => {
    for (const seed of SEEDS) {
      let d = newRsgDraft({ seed, humanSide: 'axis' });
      for (let i = 0; i < 200 && rsgStep(d).kind !== 'done'; i++) {
        const st = rsgStep(d);
        if (st.kind === 'choice' && st.side === 'allied') {
          const c = aiRsgChoice(d, 'allied');
          expect(() => rsgChoose(d, c)).not.toThrow();
        }
        d = autoSteps(d, 1);
      }
    }
    // an OB step's options are the table's
    const d = toStep(newRsgDraft({ seed: 4, humanSide: 'allied' }), 'ob');
    const c = aiRsgChoice(d, 'axis');
    if (c.what !== 'ob') throw new Error('expected an OB');
    expect(rsgObOptions('German', d.year!, d.quality.axis!).some((o) => o.letter === c.letter && o.size === c.size)).toBe(true);
  });
});
