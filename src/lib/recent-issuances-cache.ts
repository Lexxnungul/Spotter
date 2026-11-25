const RECENT_ISSUANCES_TTL_MS = 15 * 1000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

let cached: CacheEntry<unknown> | null = null;

export function getCachedRecentIssuances<T>(): T | null {
  if (!cached) return null;
  if (Date.now() >= cached.expiresAt) {
    cached = null;
    return null;
  }
  return cached.value as T;
}

export function setCachedRecentIssuances<T>(value: T): void {
  cached = { value, expiresAt: Date.now() + RECENT_ISSUANCES_TTL_MS };
}

export function invalidateRecentIssuances(): void {
  cached = null;
}
