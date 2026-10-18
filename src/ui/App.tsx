// The app shell: hash routes to screens. Dev galleries load lazily (the art gallery only once Task 5's file exists).
import { lazy, Suspense, type ComponentType } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import './kit';
import { navigate, useRoute, type Route } from './routes';
import { Credits } from './screens/Credits';
import { MainMenu } from './screens/MainMenu';
import { BattleRoute } from './game/BattleRoute';
import { NotFound } from './screens/Placeholders';
import { ScenarioPicker } from './screens/ScenarioPicker';

const RsgScreen = lazy(() => import('./screens/rsg/RsgScreen').then((m) => ({ default: m.RsgScreen })));
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

export function App() {
  const route = useRoute();
  return (
    <ErrorBoundary key={route.kind === 'play' || route.kind === 'continue' ? 'battle' : route.kind} onReset={() => navigate({ kind: 'menu' })}>
      <Suspense fallback={<div className="kit-desk app-loading">Loading…</div>}>{screenFor(route)}</Suspense>
    </ErrorBoundary>
  );
}
