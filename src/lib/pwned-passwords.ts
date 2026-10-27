import crypto from 'crypto';

export interface PwnedCheckResult {
  isBreached: boolean;
  count: number;
}

interface CacheEntry {
  text: string;
  expiresAt: number;
}

// In-memory cache for HIBP range queries to prevent redundant network lookups
const prefixCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour TTL
const MAX_CACHE_ENTRIES = 500;

export function clearPwnedCache(): void {
  prefixCache.clear();
}

/**
 * Checks if a password has been compromised in known data breaches
 * using the Have I Been Pwned (HIBP) k-Anonymity API.
 *
 * Adheres to NIST SP 800-63B standards:
 * 1. Hashes the password with SHA-1.
 * 2. Only sends the first 5 characters (prefix) of the hash to HIBP.
 * 3. Compares the remaining 35 characters (suffix) locally against the returned list.
 * 4. The plaintext password and full hash are NEVER transmitted.
 */
export async function checkPwnedPassword(
  password: string,
  options?: { timeoutMs?: number; fetchFn?: typeof fetch; skipCache?: boolean }
): Promise<PwnedCheckResult> {
  if (!password) {
    return { isBreached: false, count: 0 };
  }

  const timeoutMs = options?.timeoutMs ?? 3000;
  const customFetch = options?.fetchFn ?? fetch;
  const skipCache = options?.skipCache ?? Boolean(options?.fetchFn);

  try {
    const hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    let text: string | undefined;

    // Check in-memory prefix cache
    if (!skipCache) {
      const cached = prefixCache.get(prefix);
      if (cached && cached.expiresAt > Date.now()) {
        text = cached.text;
      }
    }

    if (!text) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await customFetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Spotter-Gym-App/1.0',
          'Add-Padding': 'true', // Randomized padding to prevent response-size analysis
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Graceful fallback if HIBP service responds with non-200
        return { isBreached: false, count: 0 };
      }

      text = await response.text();

      // Store in LRU-style cache
      if (!skipCache) {
        if (prefixCache.size >= MAX_CACHE_ENTRIES) {
          const oldestKey = prefixCache.keys().next().value;
          if (oldestKey) prefixCache.delete(oldestKey);
        }
        prefixCache.set(prefix, {
          text,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
      }
    }

    const lines = text.split(/\r?\n/);

    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(':');
      if (hashSuffix && hashSuffix.trim().toUpperCase() === suffix) {
        const count = parseInt(countStr?.trim() || '0', 10);
        return { isBreached: true, count };
      }
    }

    return { isBreached: false, count: 0 };
  } catch {
    // Graceful fallback if offline, network timeout, or DNS resolution failure
    return { isBreached: false, count: 0 };
  }
}
