import { CatalogPage } from '@ui/pages/CatalogPage';
import { ExperimentPage } from '@ui/pages/ExperimentPage';
import { AboutPage } from '@ui/pages/AboutPage';
import { CreatePage } from '@ui/pages/CreatePage';
import { SensorCheckPage } from '@ui/pages/SensorCheckPage';
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
          {route.page === 'about' && <AboutPage />}
          {route.page === 'sensors' && <SensorCheckPage />}
          {route.page === 'catalog' && <CatalogPage builtIn={builtIn} custom={experiments.custom} />}
          {route.page === 'create' && <CreatePage key={route.id ?? 'new'} id={route.id} />}
          {route.page === 'experiment' &&
            (def ? (
              <ExperimentPage key={def.id} def={def} />
            ) : (
              <p className="prose">
                Experiment not found. <a href={href({ page: 'catalog' })}>See all experiments</a>.
              </p>
            ))}
        </ErrorBoundary>
      </main>

      <footer className="footer no-print">
        Runs entirely on your device · <a href={href({ page: 'about' })}>About PocketLab</a> · Open source · Built for
        EurekaDev 2026
      </footer>
    </div>
  );
}
