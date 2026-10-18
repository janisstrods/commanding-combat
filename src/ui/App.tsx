// The app shell: hash routes to screens. Dev galleries load lazily (the art gallery only once Task 5's file exists).
// The main menu needs none of the engine: the scenario picker, the battle and the Random Battle screens load lazily
// too, and are fetched in the background once the first screen is up, so the first click does not wait.
import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import './kit';
import { navigate, useRoute, type Route } from './routes';
import { Credits } from './screens/Credits';
import { MainMenu } from './screens/MainMenu';
import { NotFound } from './screens/Placeholders';

type LazyScreen<P> = ComponentType<P> & { prefetch(): void };

/** A lazily loaded screen; once its code is here (`prefetch`), it renders at once instead of the Suspense fallback. */
function lazyScreen<P extends object>(load: () => Promise<ComponentType<P>>): LazyScreen<P> {
  let loaded: ComponentType<P> | null = null;
  const get = () => load().then((c) => (loaded = c));
  // typed by `Screen`'s props (React's lazy types do not follow a generic P)
  const Lazy: ComponentType<any> = lazy(() => get().then((c) => ({ default: c as ComponentType<any> })));
  function Screen(p: P) {
    // fixed for the life of the screen, so it never remounts
    const [{ C }] = useState(() => ({ C: (loaded as ComponentType<any> | null) ?? Lazy }));
    return <C {...p} />;
  }
  return Object.assign(Screen, { prefetch: () => void get().catch(() => undefined) });
}

const ScenarioPicker = lazyScreen(() => import('./screens/ScenarioPicker').then((m) => m.ScenarioPicker));
const BattleRoute = lazyScreen(() => import('./game/BattleRoute').then((m) => m.BattleRoute));
const RsgScreen = lazyScreen(() => import('./screens/rsg/RsgScreen').then((m) => m.RsgScreen));
const MapGallery = lazy(() => import('../dev/MapGallery').then((m) => ({ default: m.MapGallery })));

type ArtView = 'counters' | 'cards';
const ART_GALLERY = import.meta.glob('../dev/ArtGallery.tsx');
const ArtGallery = lazy(async (): Promise<{ default: ComponentType<{ view: ArtView }> }> => {
  const load = ART_GALLERY['../dev/ArtGallery.tsx'];
  const missing = () => <NotFound title="Gallery" what="The counter and card art is not here yet." />;
  if (!load) return { default: missing };
  const m = (await load()) as { default?: ComponentType<{ view: ArtView }>; ArtGallery?: ComponentType<{ view: ArtView }> };
  return { default: m.default ?? m.ArtGallery ?? missing };
});

function screenFor(route: Route) {
  switch (route.kind) {
    case 'menu':
      return <MainMenu />;
    case 'scenarios':
      return <ScenarioPicker selected={route.selected} />;
    case 'credits':
      return <Credits />;
    case 'continue':
    case 'play':
      return <BattleRoute route={route} />;
    case 'random':
      return <RsgScreen />;
    case 'galleryMap':
      return <MapGallery mapId={route.map} />;
    case 'galleryCounters':
      return <ArtGallery view="counters" />;
    case 'galleryCards':
      return <ArtGallery view="cards" />;
    case 'notFound':
      return <NotFound />;
  }
}

/** Fetch the lazy screens' code while the browser is idle (a failure shows when that screen is opened). */
function usePrefetchScreens(): void {
  useEffect(() => {
    const fetchAll = () => {
      for (const screen of [ScenarioPicker, BattleRoute, RsgScreen]) screen.prefetch();
    };
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(fetchAll, { timeout: 2000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(fetchAll, 500);
    return () => clearTimeout(id);
  }, []);
}

export function App() {
  const route = useRoute();
  usePrefetchScreens();
  return (
    <ErrorBoundary key={route.kind === 'play' || route.kind === 'continue' ? 'battle' : route.kind} onReset={() => navigate({ kind: 'menu' })}>
      <Suspense fallback={<div className="kit-desk app-loading">Loading…</div>}>{screenFor(route)}</Suspense>
    </ErrorBoundary>
  );
}
