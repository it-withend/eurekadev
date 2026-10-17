import { useEffect, useState } from 'react';

export type Route =
  | { page: 'catalog' }
  /** `demo`: open with the sample data already analysed — a one-click link for judges and teachers. */
  | { page: 'experiment'; id: string; demo?: boolean }
  | { page: 'about' }
  | { page: 'sensors' }
  /** Experiment builder; with an id it edits an existing student-made experiment. */
  | { page: 'create'; id?: string };

/** Hash routing: works on any static host with zero server config. */
export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'experiment' && parts[1]) {
    const id = decodeURIComponent(parts[1]);
    return parts[2] === 'demo' ? { page: 'experiment', id, demo: true } : { page: 'experiment', id };
  }
  if (parts[0] === 'about') return { page: 'about' };
  if (parts[0] === 'sensors') return { page: 'sensors' };
  if (parts[0] === 'create') return parts[1] ? { page: 'create', id: decodeURIComponent(parts[1]) } : { page: 'create' };
  return { page: 'catalog' };
}

export function href(route: Route): string {
  switch (route.page) {
    case 'experiment':
      return `#/experiment/${encodeURIComponent(route.id)}${route.demo ? '/demo' : ''}`;
    case 'about':
      return '#/about';
    case 'sensors':
      return '#/sensors';
    case 'create':
      return route.id ? `#/create/${encodeURIComponent(route.id)}` : '#/create';
    default:
      return '#/';
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
