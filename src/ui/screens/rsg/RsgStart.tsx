// The Random Battle's first sheet: your side, the computer's level, and what to fix instead of rolling.
import type { ReactNode } from 'react';
import { RSG_MAPS } from '../../../engine/rsg';
import { freshSeed } from '../../../engine/rng';
import { Button, Segmented, Stamp } from '../../kit';
import { AI_LEVELS, type AiLevel } from '../../routes';
import { AI_LEVEL_INFO } from '../ScenarioPicker';
import { RSG_YEARS, alliedFits, formProblem, type AlliedChoice, type PostureChoice, type RsgForm, type SideChoice } from './model';

function Chips<T extends string | number>(p: { label: string; value: T; options: readonly { value: T; label: ReactNode; hint?: string; disabled?: boolean }[]; onChange: (v: T) => void }) {
  return (
    <div className="rsg-chips" role="radiogroup" aria-label={p.label}>
      {p.options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === p.value}
          className={`rsg-chips__chip ${o.value === p.value ? 'is-on' : ''}`}
          disabled={o.disabled}
          title={o.hint}
          onClick={() => p.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row(p: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="rsg-start__row">
      <div className="rsg-start__label">
        {p.label}
        {p.hint ? <small>{p.hint}</small> : null}
      </div>
      {p.children}
    </div>
  );
}

export function RsgStart(p: { form: RsgForm; setForm: (f: RsgForm) => void; onRoll: () => void; onSurprise: () => void; onMenu: () => void }) {
  const { form, setForm } = p;
  const set = (patch: Partial<RsgForm>) => setForm({ ...form, ...patch });
  const problem = formProblem(form);
  return (
    <div className="rsg-root rsg-start kit-desk">
      <header className="rsg-head">
        <Button variant="ghost" size="sm" onClick={p.onMenu}>
          ← Menu
        </Button>
        <h1 className="rsg-head__title">Random Battle</h1>
      </header>
      <main className="rsg-start__sheet kit-paper">
        <div className="rsg-start__stamp" aria-hidden>
          <Stamp tone="red">Orders to follow</Stamp>
        </div>
        <h2 className="rsg-start__title">Random Scenario Generator</h2>
        <p className="rsg-start__intro">
          The dice set the battlefield, the year, the nations and the quality of the troops. Then you and the computer each choose an Order of Battle in
          secret, roll for Leaders and buy Support with the points you saved. Whoever spends less defends.
        </p>
        <Row label="Your side">
          <Segmented<SideChoice>
            label="Your side"
            value={form.side}
            onChange={(side) => set({ side })}
            options={[
              { value: 'axis', label: 'Germans', hint: 'Axis' },
              { value: 'allied', label: 'Americans or Russians', hint: 'Allies: the dice decide which' },
              { value: 'either', label: 'Either', hint: 'Coin flip' },
            ]}
          />
        </Row>
        <Row label="Opponent">
          <Segmented<AiLevel>
            label="Computer opponent"
            value={form.level}
            onChange={(level) => set({ level })}
            options={AI_LEVELS.map((l) => ({ value: l, label: AI_LEVEL_INFO[l].label, hint: AI_LEVEL_INFO[l].hint }))}
          />
        </Row>
        <div className="rsg-start__fix">
          <div className="rsg-start__fixhead">
            Fix if you like <span>· or leave it to the dice</span>
          </div>
          <Row label="Map">
            <Chips<string>
              label="Map"
              value={form.map}
              onChange={(map) => set({ map })}
              options={[{ value: 'random', label: 'Dice' }, ...RSG_MAPS.map((m) => ({ value: m, label: m, hint: `Map ${m}` }))]}
            />
          </Row>
          <Row label="Year">
            <Chips<number | 'random'>
              label="Year"
              value={form.year}
              onChange={(year) => set({ year, allied: form.allied === 'American' && !alliedFits('American', year) ? 'random' : form.allied })}
              options={[{ value: 'random', label: 'Dice' }, ...RSG_YEARS.map((y) => ({ value: y, label: String(y) }))]}
            />
          </Row>
          <Row label="Allies" hint="Americans fight 1943–45">
            <Chips<AlliedChoice>
              label="Allied nation"
              value={form.allied}
              onChange={(allied) => set({ allied })}
              options={[
                { value: 'random', label: 'Dice' },
                { value: 'American', label: 'Americans', disabled: !alliedFits('American', form.year), hint: 'Only 1943–1945' },
                { value: 'Russian', label: 'Russians' },
              ]}
            />
          </Row>
          <Row label="Postures">
            <Chips<PostureChoice>
              label="Postures"
              value={form.posture}
              onChange={(posture) => set({ posture })}
              options={[
                { value: 'vp', label: 'From the VP', hint: 'RS.8: the side that spends less defends' },
                { value: 'axisDefend', label: 'Germans defend' },
                { value: 'alliedDefend', label: 'Allies defend' },
                { value: 'recon', label: 'Recon v Recon' },
              ]}
            />
          </Row>
          <Row label="Seed" hint="Same seed, same rolls">
            <span className="rsg-seed">
              <input
                type="text"
                inputMode="numeric"
                value={String(form.seed)}
                aria-label="Seed"
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                  set({ seed: v ? Number(v) >>> 0 : 0 });
                }}
              />
              <Button variant="ghost" size="sm" onClick={() => set({ seed: freshSeed() })}>
                New
              </Button>
            </span>
          </Row>
        </div>
        {problem ? <p className="rsg-start__problem">{problem}</p> : null}
        <footer className="rsg-start__foot">
          <Button variant="secondary" disabled={!!problem} onClick={p.onSurprise} title="Every roll and every choice made for both sides; straight to the briefing">
            Surprise me completely
          </Button>
          <Button size="lg" disabled={!!problem} onClick={p.onRoll}>
            Roll the battle
          </Button>
        </footer>
      </main>
    </div>
  );
}
