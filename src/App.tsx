import { registry } from '@experiments/index';
import { CatalogPage } from '@ui/pages/CatalogPage';
import { ExperimentPage } from '@ui/pages/ExperimentPage';
import { AboutPage } from '@ui/pages/AboutPage';
import { SensorCheckPage } from '@ui/pages/SensorCheckPage';
import { ErrorBoundary } from '@ui/components/ErrorBoundary';
import { href, useRoute } from '@ui/router';

export function App() {
  const route = useRoute();
  const def = route.page === 'experiment' ? registry.get(route.id) : undefined;

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
          <a href={href({ page: 'sensors' })}>Sensor check</a>
          <a href={href({ page: 'about' })}>About</a>
        </nav>
      </header>

      <main>
        {/* Keyed by route: navigating away clears a crashed page. */}
        <ErrorBoundary key={href(route)}>
          {route.page === 'about' && <AboutPage />}
          {route.page === 'sensors' && <SensorCheckPage />}
          {route.page === 'catalog' && <CatalogPage registry={registry} />}
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
        Runs entirely on your device · Open source · Built for EurekaDev 2026
      </footer>
    </div>
  );
}
