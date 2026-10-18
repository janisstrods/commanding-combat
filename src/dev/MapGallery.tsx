// Dev page #/gallery/map/<id>: any map's board with layer toggles, the hex under the pointer, the terrain field
// overlay and (once src/engine/los.ts exists) a line-of-sight demo: click a hex, then another.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CounterG } from '../art/Counter';
import { COUNTERS, MAP_IDS, hasMap } from '../engine/data';
import { hexAt, hexsideKey, label, neighbour, parseHex, type HexId, type HexSide } from '../engine/hex';
import { MASK, type CounterType, type MapDef, type PathKind } from '../engine/types';
import { Board, StackView, type LosLine, type MaskOverlayMode } from '../ui/board';
import { terrainField, type TerrainField } from '../ui/board/paint/field';
import { simulateMask } from '../ui/board/paint/simulate';
import { Button, Segmented, Toggle } from '../ui/kit';
import { MapLoading, usePreparedMap } from '../ui/maps';
import { navigate } from '../ui/routes';
import './gallery.css';

type LosFn = (view: { map: MapDef; smoke: number[]; blaze: boolean[] }, from: HexId, to: HexId) => { clear: boolean; hindrance: number; blockedBy: string | null };
const LOS_MODULE = import.meta.glob('../engine/los.ts');

const CLASS_NAMES: Record<number, string> = Object.fromEntries(Object.entries(MASK).map(([k, v]) => [v, k]));

/** Share of each mask class among the field cells whose centre lies in hex `h`. */
function cellMix(f: TerrainField, h: HexId): string {
  const counts = new Map<number, number>();
  let n = 0;
  for (let j = 0; j < f.height; j++) {
    for (let i = 0; i < f.width; i++) {
      const x = f.x0 + (i + 0.5) / f.res;
      const y = f.y0 + (j + 0.5) / f.res;
      if (hexAt(x, y) !== h) continue;
      const k = f.cls[j * f.width + i];
      counts.set(k, (counts.get(k) ?? 0) + 1);
      n++;
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, c]) => `${CLASS_NAMES[k] ?? k} ${Math.round((100 * c) / n)}%`)
    .join(', ');
}

/** Flags after "?" in the hash, for screenshots: sim (simulated mask), turn, stacks, los=E5-J6, overlay=classes|levels. */
function hashFlags(): URLSearchParams {
  const h = window.location.hash;
  return new URLSearchParams(h.includes('?') ? h.slice(h.indexOf('?') + 1) : '');
}

/** A few counters to show the stack slot (map gallery only). */
function sampleStacks(): Record<number, CounterType[]> {
  const all = Object.values(COUNTERS);
  const pick = (nation: string, kind: string, n = 1) => all.filter((c) => c.nation === nation && c.kind === kind).slice(0, n);
  return {
    [parseHex('E5')]: [...pick('German', 'squad'), ...pick('German', 'leader'), ...pick('German', 'weapon')],
    [parseHex('F6')]: pick('German', 'squad'),
    [parseHex('J6')]: [...pick('American', 'squad', 2), ...pick('American', 'leader')],
    [parseHex('K8')]: [...pick('Russian', 'squad'), ...pick('Russian', 'weapon')],
    // a full hex (Squad, Team and Leader, each with a Weapon) and an overstacked melee hex
    [parseHex('C3')]: [...pick('German', 'squad'), ...pick('German', 'weapon'), ...pick('German', 'team'), ...pick('German', 'weapon'), ...pick('German', 'leader'), ...pick('German', 'weapon')],
    [parseHex('M3')]: [...pick('Russian', 'squad', 3), ...pick('Russian', 'weapon'), ...pick('Russian', 'leader', 2), ...pick('German', 'squad', 2), ...pick('German', 'weapon')],
  };
}

export function MapGallery({ mapId }: { mapId: string }) {
  const flags = useMemo(hashFlags, []);
  const [simulate, setSimulate] = useState(() => flags.has('sim'));
  const known = hasMap(mapId);
  // the board is shown once the map is loaded and painted (src/ui/maps.tsx)
  const { map: real, error } = usePreparedMap(known ? mapId : null);
  const map = useMemo(() => (real && simulate && !real.mask ? { ...real, mask: simulateMask(real) } : real), [real, simulate]);
  const field = useMemo(() => (map ? terrainField(map) : null), [map]);
  const [labels, setLabels] = useState(true);
  const [grid, setGrid] = useState(true);
  const [hexsides, setHexsides] = useState(true);
  const [objectives, setObjectives] = useState(true);
  const [turned, setTurned] = useState(() => flags.has('turn'));
  const [overlay, setOverlay] = useState<'off' | MaskOverlayMode>(() => (flags.get('overlay') === 'classes' || flags.get('overlay') === 'levels' ? (flags.get('overlay') as MaskOverlayMode) : 'off'));
  const [hover, setHover] = useState<HexId | null>(null);
  const [los, setLos] = useState<LosFn | null>(null);
  const losFlag = flags.get('los')?.split('-');
  const [losOn, setLosOn] = useState(() => !!losFlag);
  const [from, setFrom] = useState<HexId | null>(() => (losFlag ? parseHex(losFlag[0]) : null));
  const [to, setTo] = useState<HexId | null>(() => (losFlag?.[1] ? parseHex(losFlag[1]) : null));
  const [stacks, setStacks] = useState(() => flags.has('stacks'));
  const [open, setOpen] = useState<HexId | null>(null);
  const samples = useMemo(sampleStacks, []);
  const renderStack = useCallback(
    (h: HexId) => {
      const types = samples[h];
      if (!types?.length) return null;
      const size = 0.8;
      return (
        <StackView
          size={size}
          expanded={open === h}
          items={types.map((t, i) => ({ key: `${t.id}-${i}`, role: t.kind === 'weapon' || t.kind === 'radio' ? 'weapon' : 'unit', node: <CounterG type={t} x={0} y={0} size={size} /> }))}
        />
      );
    },
    [samples, open],
  );

  useEffect(() => {
    const load = LOS_MODULE['../engine/los.ts'];
    if (!load) return;
    load().then(
      (m) => {
        const fn = (m as { losCheck?: LosFn }).losCheck;
        if (fn) setLos(() => fn);
      },
      (e) => console.error('Could not load los.ts', e),
    );
  }, []);

  if (!known) {
    return (
      <div className="gallery-root kit-desk">
        <p>No map “{mapId}”.</p>
      </div>
    );
  }

  const target = to ?? (from !== null ? hover : null);
  let losLine: LosLine | null = null;
  let losText = 'Click a hex to look from, then another to look at.';
  if (map && losOn && los && from !== null && target !== null && target !== from) {
    try {
      const r = los({ map, smoke: Array(150).fill(0), blaze: Array(150).fill(false) }, from, target);
      losLine = { from, to: target, clear: r.clear };
      losText = `${label(from)} → ${label(target)}: ${r.clear ? `clear${r.hindrance ? `, hindrance ${r.hindrance}` : ''}` : `blocked${r.blockedBy ? ` by ${r.blockedBy}` : ''}`}`;
    } catch (e) {
      losText = `LOS error: ${(e as Error).message}`;
    }
  }

  const click = (h: HexId) => {
    if (!losOn) {
      setOpen((o) => (o === h || !samples[h] ? null : h));
      return;
    }
    if (from === null || to !== null) {
      setFrom(h);
      setTo(null);
    } else if (h !== from) setTo(h);
  };

  return (
    <div className="gallery-root kit-desk">
      <header className="gallery-bar kit-paper">
        <Button variant="ghost" size="sm" onClick={() => navigate({ kind: 'menu' })}>
          ← Menu
        </Button>
        <span className="gallery-title">Map</span>
        <div className="gallery-maps">
          {MAP_IDS.map((id) => (
            <button key={id} type="button" className={`gallery-map ${id === mapId ? 'is-on' : ''}`} onClick={() => navigate({ kind: 'galleryMap', map: id })}>
              {id}
            </button>
          ))}
        </div>
      </header>
      <div className="gallery-body">
        <aside className="gallery-side kit-paper">
          <h4>Layers</h4>
          <Toggle checked={labels} onChange={setLabels}>
            Hex labels
          </Toggle>
          <Toggle checked={grid} onChange={setGrid}>
            Hex grid
          </Toggle>
          <Toggle checked={hexsides} onChange={setHexsides}>
            Hexsides
          </Toggle>
          <Toggle checked={objectives} onChange={setObjectives}>
            Objectives
          </Toggle>
          <Toggle checked={turned} onChange={setTurned}>
            Turned 180°
          </Toggle>
          <Toggle checked={stacks} onChange={setStacks}>
            Sample stacks
          </Toggle>
          <h4>Terrain field {!real ? '' : real.mask ? '(mask)' : simulate ? '(simulated mask)' : '(per hex)'}</h4>
          {real && !real.mask ? (
            <Toggle checked={simulate} onChange={setSimulate}>
              Simulated mask (dev)
            </Toggle>
          ) : null}
          <Segmented<'off' | MaskOverlayMode>
            label="Mask overlay"
            value={overlay}
            onChange={setOverlay}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'classes', label: 'Classes' },
              { value: 'levels', label: 'Levels' },
            ]}
          />
          <h4>Line of sight</h4>
          <Toggle
            checked={losOn}
            disabled={!los}
            onChange={(v) => {
              setLosOn(v);
              setFrom(null);
              setTo(null);
            }}
          >
            {los ? 'LOS demo' : 'LOS demo (needs los.ts)'}
          </Toggle>
          {losOn ? <p className="gallery-los">{losText}</p> : null}
          <h4>Hex</h4>
          {hover !== null && map && field ? <HexInfo map={map} field={field} h={hover} /> : <p className="gallery-hint">Point at a hex.</p>}
        </aside>
        <main className="gallery-board">
          {map ? (
            <Board
              map={map}
              rotate180={turned}
              showLabels={labels}
              showGrid={grid}
              showHexsides={hexsides}
              showObjectives={objectives}
              maskOverlay={overlay === 'off' ? null : overlay}
              onHexHover={setHover}
              onHexClick={click}
              losLine={losLine}
              selectable={losOn && from !== null ? [from] : undefined}
              renderStack={stacks ? renderStack : undefined}
              topStack={open}
              edgeLabels={{ top: 'Top edge', bottom: 'Bottom edge', left: 'Left edge', right: 'Right edge' }}
              zoomKey="gallery"
              zoomKeys
            />
          ) : (
            <MapLoading id={mapId} error={error} />
          )}
        </main>
      </div>
    </div>
  );
}

function HexInfo({ map, field, h }: { map: MapDef; field: TerrainField; h: HexId }) {
  const paths = (Object.keys(map.pathHexes) as PathKind[]).filter((k) => map.pathHexes[k]?.[h]);
  const sides: string[] = [];
  for (let s = 1 as HexSide; s <= 6; s = (s + 1) as HexSide) {
    const f = map.hexsides[hexsideKey(h, s)];
    const n = neighbour(h, s);
    if (f) sides.push(`${s} ${f}${n !== null ? ` (${label(n)})` : ''}`);
  }
  const obj = map.objectives.indexOf(h);
  return (
    <dl className="gallery-hex">
      <dt>Hex</dt>
      <dd>
        <b>{label(h)}</b>
        {obj >= 0 ? ` · Objective ${obj + 1}` : ''}
      </dd>
      <dt>Terrain</dt>
      <dd>
        {map.terrain[h]}
        {map.building[h] >= 0 ? ` (building ${map.building[h]})` : ''}
      </dd>
      <dt>Level</dt>
      <dd>
        {map.elevation[h]}
        {map.crest[h] ? ' · crest' : ''}
      </dd>
      {paths.length ? (
        <>
          <dt>Paths</dt>
          <dd>{paths.join(', ')}</dd>
        </>
      ) : null}
      {sides.length ? (
        <>
          <dt>Hexsides</dt>
          <dd>{sides.join('; ')}</dd>
        </>
      ) : null}
      <dt>Field cells</dt>
      <dd>{cellMix(field, h)}</dd>
    </dl>
  );
}

