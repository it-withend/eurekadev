/**
 * Per-device persistence (localStorage). Everything degrades gracefully:
 * private windows or full storage just mean nothing is remembered.
 */
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Saves `items`; on quota errors drops the oldest entries until it fits. */
export function saveList<T>(key: string, items: T[]): void {
  for (let start = 0; start <= items.length; start++) {
    try {
      localStorage.setItem(key, JSON.stringify(items.slice(start)));
      return;
    } catch {
      // try again with fewer items
    }
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore: storage is a convenience
  }
}
