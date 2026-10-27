import { NextRequest, NextResponse } from 'next/server';

export interface RateLimitOptions {
  limit: number; // Max allowed requests within the time window
  windowSeconds: number; // Window duration in seconds
  actionName?: string; // Descriptive name (e.g. "login", "register")
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  retryAfterSeconds: number;
}

// In-memory sliding-window log store: key -> array of request timestamps (epoch ms)
const rateLimitStore = new Map<string, number[]>();

// Periodic automatic cleanup threshold (runs every 5 minutes)
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function cleanupExpiredEntries(now: number, maxWindowMs: number = 3600 * 1000) {
  rateLimitStore.forEach((timestamps: number[], key: string) => {
    const valid = timestamps.filter((t: number) => now - t < maxWindowMs);
    if (valid.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, valid);
    }
  });
  lastCleanup = now;
}

/**
 * Extracts client IP address from Next.js request headers
 */
export function getClientIp(req: NextRequest): string {
  // 1. x-forwarded-for (Standard header behind reverse proxy/load balancer/Vercel)
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }

  // 2. x-real-ip
  const realIp = req.headers.get('x-real-ip');
  if (realIp && realIp.trim()) {
    return realIp.trim();
  }

  // 3. Cloudflare cf-connecting-ip
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp && cfIp.trim()) {
    return cfIp.trim();
  }

  // 4. Default fallback for local development / testing
  return '127.0.0.1';
}

/**
 * Checks and records rate limit for a given IP and action using sliding window
 */
export function checkRateLimit(
  ip: string,
  action: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;
  const key = `${action}:${ip}`;

  // Periodic memory cleanup
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    cleanupExpiredEntries(now, windowMs);
  }

  const existingTimestamps = rateLimitStore.get(key) || [];
  // Prune timestamps older than window
  const activeTimestamps = existingTimestamps.filter((t: number) => now - t < windowMs);

  if (activeTimestamps.length >= options.limit) {
    const oldest = activeTimestamps[0];
    const expiry = oldest + windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((expiry - now) / 1000));

    return {
      allowed: false,
      limit: options.limit,
      remaining: 0,
      resetSeconds: retryAfterSeconds,
      retryAfterSeconds,
    };
  }

  // Record current request
  activeTimestamps.push(now);
  rateLimitStore.set(key, activeTimestamps);

  const oldest = activeTimestamps[0];
  const resetSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
  const remaining = Math.max(0, options.limit - activeTimestamps.length);

  return {
    allowed: true,
    limit: options.limit,
    remaining,
    resetSeconds,
    retryAfterSeconds: 0,
  };
}

/**
 * Creates standard HTTP 429 Too Many Requests response with rate-limit headers
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  customMessage?: string
): NextResponse {
  const message =
    customMessage ||
    `Too many requests. Please try again in ${result.retryAfterSeconds} second${
      result.retryAfterSeconds === 1 ? '' : 's'
    }.`;

  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSeconds),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.resetSeconds),
      },
    }
  );
}

/**
 * Helper to reset rate limit memory (useful for testing)
 */
export function resetRateLimitStore(): void {
  rateLimitStore.clear();
  lastCleanup = Date.now();
}
