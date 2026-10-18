// The Random Battle (`#/random`): the start sheet, the RSG step by step, the briefing, then the battle screen via
// sessionStorage `cce-rsg-pending` and `#/play/rsg/<side>/<level>/<seed>`. A draft in progress survives a reload
// (sessionStorage `cce-rsg-draft-v1`). Screenshot flags: `#/random?seed=7&side=axis&auto=8&hold=1` (see model.ts).
import { useEffect, useMemo, useState } from 'react';
import { RSG_MAPS, newRsgDraft, rsgStep, type RsgDraft } from '../../../engine/rsg';
import { freshSeed } from '../../../engine/rng';
import { AI_LEVELS, navigate, type AiLevel } from '../../routes';
import { storage } from '../../storage';
import { RsgStart } from './RsgStart';
import { RsgSummary } from './RsgSummary';
import { RsgWalk, type Beat } from './RsgWalk';
import { autoSteps, chooserOf, defaultForm, formOptions, newEntries, parseFlags, queryOf, rsgHandoff, storeHandoff, surpriseMe, type RsgForm } from './model';
import './rsg.css';

const FORM_KEY = 'cce-rsg-form-v1';
const DRAFT_KEY = 'cce-rsg-draft-v1';

type Phase = 'start' | 'walk' | 'summary';

interface Saved {
  form: RsgForm;
  draft: RsgDraft;
  phase: Phase;
}

function loadForm(): RsgForm {
  const base = defaultForm(freshSeed());
  try {
    const v = JSON.parse(storage.get(FORM_KEY) ?? 'null') as Partial<RsgForm> | null;
    if (!v) return base;
    return {
      ...base,
      side: v.side === 'axis' || v.side === 'allied' || v.side === 'either' ? v.side : base.side,
      level: AI_LEVELS.includes(v.level as AiLevel) ? (v.level as AiLevel) : base.level,
      map: typeof v.map === 'string' && (v.map === 'random' || RSG_MAPS.includes(v.map)) ? v.map : base.map,
      year: v.year === 'random' || (typeof v.year === 'number' && v.year >= 1941 && v.year <= 1945) ? v.year : base.year,
      allied: v.allied === 'American' || v.allied === 'Russian' ? v.allied : 'random',
      posture: v.posture === 'axisDefend' || v.posture === 'alliedDefend' || v.posture === 'recon' ? v.posture : 'vp',
    };
  } catch {
    return base;
  }
}

function session(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

function loadSaved(): Saved | null {
  try {
    const raw = session()?.getItem(DRAFT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Saved;
    if (!v || v.draft?.v !== 1 || !v.form) return null;
    rsgStep(v.draft); // throws on a stale draft
    return v;
  } catch {
    return null;
  }
}

interface Init {
  form: RsgForm;
  draft: RsgDraft | null;
  phase: Phase;
  beat: Beat;
  hold: boolean;
}

function initial(): Init {
  const flags = parseFlags(queryOf(window.location.hash, window.location.search));
  const idle: Beat = { kind: 'idle' };
  if (flags.auto !== undefined || Object.keys(flags.form).length) {
    const form: RsgForm = { ...loadForm(), ...flags.form };
    if (flags.auto === undefined) return { form, draft: null, phase: 'start', beat: idle, hold: !!flags.hold };
    const d0 = newRsgDraft(formOptions(form));
    if (flags.auto === 'all') return { form, draft: autoSteps(d0, 'all'), phase: 'summary', beat: idle, hold: !!flags.hold };
    const before = flags.auto > 0 ? autoSteps(d0, flags.auto - 1) : d0;
    const draft = flags.auto > 0 ? autoSteps(before, 1) : d0;
    const last = draft.log.at(-1);
    // the narration of the last step played, unless the player's choice is next
    const beat: Beat =
      flags.auto > 0 && last && last.step !== 'fixed' && chooserOf(draft) !== 'human'
        ? { kind: 'shown', what: last.step, side: newEntries(before, draft)[0]?.side ?? null, entries: newEntries(before, draft) }
        : idle;
    return { form, draft, phase: 'walk', beat, hold: !!flags.hold };
  }
  const saved = loadSaved();
  if (saved) return { form: saved.form, draft: saved.draft, phase: saved.phase, beat: idle, hold: false };
  return { form: loadForm(), draft: null, phase: 'start', beat: idle, hold: false };
}

export function RsgScreen() {
  const init = useMemo(initial, []);
  const [form, setForm] = useState<RsgForm>(init.form);
  const [draft, setDraft] = useState<RsgDraft | null>(init.draft);
  const [phase, setPhase] = useState<Phase>(init.phase);
  const [beat, setBeat] = useState<Beat>(init.beat);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const { seed: _seed, ...rest } = form;
    storage.set(FORM_KEY, JSON.stringify(rest));
  }, [form]);
  useEffect(() => {
    try {
      const s = session();
      if (!s) return;
      if (draft && phase !== 'start') s.setItem(DRAFT_KEY, JSON.stringify({ form, draft, phase } satisfies Saved));
      else s.removeItem(DRAFT_KEY);
    } catch {
      /* storage unavailable: no resume */
    }
  }, [draft, phase]);

  const clear = () => {
    try {
      session()?.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  };
  const toMenu = () => {
    clear();
    navigate({ kind: 'menu' });
  };
  const restart = () => {
    setDraft(null);
    setBeat({ kind: 'idle' });
    setPhase('start');
    setNotice(null);
    setForm((f) => ({ ...f, seed: freshSeed() }));
  };

  if (phase === 'start' || !draft) {
    return (
      <RsgStart
        form={form}
        setForm={setForm}
        onMenu={toMenu}
        onRoll={() => {
          setDraft(newRsgDraft(formOptions(form)));
          setBeat({ kind: 'idle' });
          setPhase('walk');
        }}
        onSurprise={() => {
          setDraft(surpriseMe(form));
          setPhase('summary');
        }}
      />
    );
  }
  if (phase === 'summary' && rsgStep(draft).kind === 'done') {
    return (
      <RsgSummary
        draft={draft}
        level={form.level}
        notice={notice}
        onMenu={toMenu}
        onAgain={restart}
        onBattle={() => {
          const h = rsgHandoff(draft, form.level);
          if (!storeHandoff(h)) {
            setNotice('This browser blocks session storage, so the battle cannot be handed over.');
            return;
          }
          clear();
          navigate(h.route);
        }}
      />
    );
  }
  return (
    <RsgWalk
      draft={draft}
      setDraft={setDraft}
      beat={beat}
      setBeat={setBeat}
      hold={init.hold}
      onDone={() => setPhase('summary')}
      onRestart={restart}
      onMenu={toMenu}
    />
  );
}
