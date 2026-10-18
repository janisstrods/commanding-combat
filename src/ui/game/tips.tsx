// Hover information: a hex (terrain, Cover, Hindrance, height, markers, Objective) and everything stacked in it, with
// each unit's current values (Leader Command, Veteran, Suppressed, Wire and its Weapon already counted).
import { CounterG } from '../../art';
import { objectivesAt } from '../../engine/objectives';
import { currentStats, hexCover, weaponStats } from '../../engine/stats';
import { typeOf } from '../../engine/state';
import { TERRAIN, hasRoad } from '../../engine/terrain';
import type { GameState, HexId, Piece, Side } from '../../engine/types';
import { hexName, pieceName, sideName } from './names';
import { objectiveWorth } from './objectiveWorth';
import { piecesIn } from './preview';

function Val({ now, printed, label }: { now: number; printed: number; label: string }) {
  const cls = now > printed ? 'is-up' : now < printed ? 'is-down' : '';
  return (
    <span className={`tip-val ${cls}`} title={now !== printed ? `${label}: printed ${printed}` : label}>
      <b>{now}</b>
      <i>{label}</i>
    </span>
  );
}

function UnitLine({ s, p, human }: { s: GameState; p: Piece; human: Side }) {
  const t = typeOf(p);
  const side = p.broken ? t.broken : t.front;
  const flags: string[] = [];
  if (p.broken) flags.push(t.kind === 'weapon' ? 'broken' : 'broken');
  if (p.suppressed) flags.push('suppressed');
  if (p.veteran) flags.push('veteran');
  if (s.turn.activated.includes(p.id)) flags.push('activated');
  if (t.kind === 'weapon') {
    const w = weaponStats(s, p.id);
    return (
      <div className="tip-unit tip-unit--weapon">
        <svg viewBox="-0.5 -0.5 1 1" width={26} height={26} aria-hidden>
          <CounterG type={t} x={0} y={0} size={0.95} broken={p.broken} />
        </svg>
        <div className="tip-unit__body">
          <div className="tip-unit__name">
            {pieceName(s, p.id)} {flags.length ? <span className="tip-flags">{flags.join(', ')}</span> : null}
          </div>
          <div className="tip-vals">
            <Val now={w.fp} printed={t.front.fp} label="FP" />
            <Val now={w.range} printed={t.front.range} label="Range" />
            {t.front.move ? <span className="tip-val"><b>{t.front.move}</b><i>Move</i></span> : null}
            {t.ordnance ? <span className="tip-tag">Ordnance</span> : null}
            {t.smoke ? <span className="tip-tag">Smoke</span> : null}
            {t.minRange ? <span className="tip-tag">min range {t.minRange}</span> : null}
            {p.broken && t.fix ? <span className="tip-tag">fix {t.fix.join('–')}, elim {t.elim?.join('–')}</span> : null}
          </div>
        </div>
      </div>
    );
  }
  const st = currentStats(s, p.id);
  const cover = p.where === 'map' ? hexCover(s, p.hex) : 0;
  return (
    <div className="tip-unit">
      <svg viewBox="-0.5 -0.5 1 1" width={32} height={32} aria-hidden>
        <CounterG type={t} x={0} y={0} size={0.95} broken={p.broken} suppressed={p.suppressed} veteran={p.veteran} />
      </svg>
      <div className="tip-unit__body">
        <div className="tip-unit__name">
          <span className={`tip-side tip-side--${p.side}`}>{p.side === human ? 'yours' : sideName(s, p.side)}</span> {pieceName(s, p.id)}{' '}
          {flags.length ? <span className="tip-flags">{flags.join(', ')}</span> : null}
        </div>
        <div className="tip-vals">
          <Val now={st.fp} printed={side.fp} label="FP" />
          <Val now={st.range} printed={side.range} label="Range" />
          <Val now={st.move} printed={side.move} label="Move" />
          <Val now={st.morale} printed={side.morale} label="Morale" />
          {t.kind === 'leader' ? <Val now={st.command} printed={side.command} label="Command" /> : null}
          {cover ? <span className="tip-tag">+{cover} Cover → {st.morale + cover}</span> : null}
          {t.hero ? <span className="tip-tag">Hero</span> : null}
          {side.boxed.fp ? <span className="tip-tag" title="Assault Fire, +1 in melee">boxed FP</span> : null}
          {side.boxed.range ? <span className="tip-tag" title="Spray Fire">boxed Range</span> : null}
          {side.boxed.move ? <span className="tip-tag" title="Smoke Grenades">boxed Move</span> : null}
        </div>
      </div>
    </div>
  );
}

export function HexTip({ s, hex, human }: { s: GameState; hex: HexId; human: Side }) {
  const terr = TERRAIN[s.map.terrain[hex]];
  const road = hasRoad(s.map, hex);
  const cover = hexCover(s, hex);
  const level = s.map.elevation[hex];
  const fort = s.fort[hex];
  const objs = objectivesAt(s, hex);
  const pieces = piecesIn(s, hex).map((id) => s.pieces[id]);
  return (
    <div className="tip-hex">
      <div className="tip-hex__head">
        <b>{hexName(hex)}</b> {terr?.name ?? s.map.terrain[hex]}
        {road ? ', road' : ''}
        {level ? `, level ${level}${s.map.crest[hex] ? ' (crest)' : ''}` : ''}
      </div>
      <div className="tip-hex__terrain">
        Cover {terr?.cover === null ? '—' : cover}
        {terr?.move !== null && terr?.move !== undefined ? ` · Move ${terr.move}` : ' · impassable'}
        {terr?.obstacle ? ' · Obstacle' : terr?.hindrance ? ` · Hindrance ${terr.hindrance}` : ''}
      </div>
      {fort || s.smoke[hex] || s.blaze[hex] || s.spottingRound === hex ? (
        <div className="tip-hex__markers">
          {fort ? <span className="tip-tag">{fort}</span> : null}
          {s.smoke[hex] ? <span className="tip-tag">Smoke {s.smoke[hex]} (Hindrance)</span> : null}
          {s.blaze[hex] ? <span className="tip-tag tip-tag--bad">Blaze</span> : null}
          {s.spottingRound === hex ? <span className="tip-tag">Spotting Round</span> : null}
        </div>
      ) : null}
      {objs.map((n) => (
        <div key={n} className="tip-hex__obj">
          Objective {n}: {s.control[n - 1] ? `${sideName(s, s.control[n - 1]!)} control` : 'uncontrolled'}, worth {worthShort(s, human, n)}
        </div>
      ))}
      {pieces.length ? (
        <div className="tip-units">
          {pieces.map((p) => (
            <UnitLine key={p.id} s={s} p={p} human={human} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** "4 VP (3 from your secret chit K) +?" */
function worthShort(s: GameState, human: Side, n: number): string {
  const w = objectiveWorth(s, human, n);
  const mine = w.secret.filter((x) => x.mine);
  const note = mine.length ? ` (${mine.map((x) => `${x.vp} from your secret chit ${x.chit}`).join(', ')})` : '';
  return `${w.total} VP${note}${w.more ? ' +?' : ''}`;
}
