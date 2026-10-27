/**
 * Best-effort in-process cache for upstream audio APIs.
 *
 * Serverless instances are ephemeral, so this is a latency/rate-limit
 * optimisation rather than a source of truth. On a warm instance it makes
 * repeat searches (the common case — tapping a recent chip) instant and keeps
 * us well inside the iTunes/Deezer rate limits.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const MAX_ENTRIES = 240;
const store = new Map<string, Entry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;

  if (hit.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }

  // Refresh LRU position.
  store.delete(key);
  store.set(key, hit);
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Deduplicates concurrent identical upstream calls (stampede protection). */
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = loader()
    .then((value) => {
      cacheSet(key, value, ttlMs);
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}
