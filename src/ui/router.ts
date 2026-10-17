import { useEffect, useState } from 'react';

export type Route = { page: 'catalog' } | { page: 'experiment'; id: string } | { page: 'about' };

/** Hash routing: works on any static host with zero server config. */
export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'experiment' && parts[1]) return { page: 'experiment', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'about') return { page: 'about' };
  return { page: 'catalog' };
}

export function href(route: Route): string {
  switch (route.page) {
    case 'experiment':
      return `#/experiment/${encodeURIComponent(route.id)}`;
    case 'about':
      return '#/about';
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
