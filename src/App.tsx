import { CatalogPage } from '@ui/pages/CatalogPage';
import { ExperimentPage } from '@ui/pages/ExperimentPage';
import { lazy, Suspense } from 'react';

// Pages most students open later are loaded on demand, keeping the first load small.
const AboutPage = lazy(() => import('@ui/pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const CreatePage = lazy(() => import('@ui/pages/CreatePage').then((m) => ({ default: m.CreatePage })));
const SensorCheckPage = lazy(() => import('@ui/pages/SensorCheckPage').then((m) => ({ default: m.SensorCheckPage })));
import { ErrorBoundary } from '@ui/components/ErrorBoundary';
import { useExperiments } from '@ui/customStore';
import { href, useRoute } from '@ui/router';
import { startTour } from '@ui/tour/Tour';

export function App() {
  const route = useRoute();
  const experiments = useExperiments();
  const def = route.page === 'experiment' ? experiments.get(route.id) : undefined;
  const builtIn = experiments.list().filter((e) => !e.custom);

  return (
    <div className="shell">
      <header className="topbar no-print">
        <a className="brand" href={href({ page: 'catalog' })}>
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <rect x="8" y="2" width="16" height="28" rx="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M11 19 q2.5 -7 5 0 t5 0" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          PocketLab
        </a>
        <nav>
          <a href={href({ page: 'catalog' })}>Experiments</a>
          <a href={href({ page: 'sensors' })} data-tour="nav-sensors">
            Sensors
          </a>
          <button className="guide-btn" data-tour="nav-guide" onClick={() => startTour()}>
            ? Guide
          </button>
        </nav>
      </header>

      <main>
        {/* Keyed by route: navigating away clears a crashed page. */}
        <ErrorBoundary key={href(route)}>
          <Suspense fallback={<p className="hint">Loading…</p>}>
          {route.page === 'about' && <AboutPage />}
          {route.page === 'sensors' && <SensorCheckPage />}
          {route.page === 'catalog' && <CatalogPage builtIn={builtIn} custom={experiments.custom} />}
          {route.page === 'create' && <CreatePage key={route.id ?? 'new'} id={route.id} />}
          {route.page === 'experiment' &&
            (def ? (
              <ExperimentPage key={def.id} def={def} demo={route.page === 'experiment' && route.demo} />
            ) : (
              <p className="prose">
                Experiment not found. <a href={href({ page: 'catalog' })}>See all experiments</a>.
              </p>
            ))}
          </Suspense>
        </ErrorBoundary>
      </main>

      <footer className="footer no-print">
        <span>Measurements stay on your device.</span>
        <nav aria-label="Footer">
          <a href={href({ page: 'about' })}>About PocketLab</a>
          <a href="https://github.com/it-withend/eurekadev">Source code</a>
          <a href={href({ page: 'sensors' })}>Sensor check</a>
        </nav>
        <span>Made for EurekaDev 2026</span>
      </footer>
    </div>
  );
}
