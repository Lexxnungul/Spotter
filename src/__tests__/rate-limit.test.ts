import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
  resetRateLimitStore,
} from '../lib/rate-limit';
import { POST as registerHandler } from '../app/api/auth/register/route';
import { POST as loginHandler } from '../app/api/auth/login/route';

describe('Server-Side IP Rate Limiting Pipeline', () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  describe('getClientIp extraction', () => {
    it('extracts primary client IP from x-forwarded-for header (single or comma-separated)', () => {
      const reqSingle = new NextRequest('http://localhost:3000/api/auth/login', {
        headers: { 'x-forwarded-for': '198.51.100.1' },
      });
      expect(getClientIp(reqSingle)).toBe('198.51.100.1');

      const reqMulti = new NextRequest('http://localhost:3000/api/auth/login', {
        headers: { 'x-forwarded-for': '198.51.100.2, 10.0.0.1, 172.16.0.1' },
      });
      expect(getClientIp(reqMulti)).toBe('198.51.100.2');
    });

    it('extracts IP from x-real-ip when x-forwarded-for is missing', () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        headers: { 'x-real-ip': '203.0.113.195' },
      });
      expect(getClientIp(req)).toBe('203.0.113.195');
    });

    it('extracts IP from cf-connecting-ip (Cloudflare)', () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        headers: { 'cf-connecting-ip': '104.28.19.45' },
      });
      expect(getClientIp(req)).toBe('104.28.19.45');
    });

    it('falls back to 127.0.0.1 when no proxy IP headers are present', () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login');
      expect(getClientIp(req)).toBe('127.0.0.1');
    });
  });

  describe('checkRateLimit sliding window mechanism', () => {
    it('allows requests up to the defined limit and blocks on exceed', () => {
      const ip = '192.168.1.100';
      const action = 'test-action';
      const limit = 3;
      const windowSeconds = 60;

      // 1st request -> allowed
      const r1 = checkRateLimit(ip, action, { limit, windowSeconds });
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(2);

      // 2nd request -> allowed
      const r2 = checkRateLimit(ip, action, { limit, windowSeconds });
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(1);

      // 3rd request -> allowed (remaining reaches 0)
      const r3 = checkRateLimit(ip, action, { limit, windowSeconds });
      expect(r3.allowed).toBe(true);
      expect(r3.remaining).toBe(0);

      // 4th request -> BLOCKED (exceeds limit)
      const r4 = checkRateLimit(ip, action, { limit, windowSeconds });
      expect(r4.allowed).toBe(false);
      expect(r4.remaining).toBe(0);
      expect(r4.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('isolates rate limits by client IP address', () => {
      const ipA = '10.0.0.1';
      const ipB = '10.0.0.2';
      const action = 'login';
      const limit = 2;
      const windowSeconds = 60;

      // Consume limit for IP A
      checkRateLimit(ipA, action, { limit, windowSeconds });
      checkRateLimit(ipA, action, { limit, windowSeconds });
      const blockedA = checkRateLimit(ipA, action, { limit, windowSeconds });
      expect(blockedA.allowed).toBe(false);

      // IP B should still be allowed
      const allowedB = checkRateLimit(ipB, action, { limit, windowSeconds });
      expect(allowedB.allowed).toBe(true);
      expect(allowedB.remaining).toBe(1);
    });

    it('isolates rate limits by action type for the same IP', () => {
      const ip = '10.0.0.5';
      const limit = 1;
      const windowSeconds = 60;

      // Consume limit for 'login' action
      const l1 = checkRateLimit(ip, 'login', { limit, windowSeconds });
      expect(l1.allowed).toBe(true);
      const l2 = checkRateLimit(ip, 'login', { limit, windowSeconds });
      expect(l2.allowed).toBe(false);

      // 'register' action for same IP is still allowed
      const r1 = checkRateLimit(ip, 'register', { limit, windowSeconds });
      expect(r1.allowed).toBe(true);
    });
  });

  describe('createRateLimitResponse', () => {
    it('returns 429 status code with standard rate limit headers', async () => {
      const mockResult = {
        allowed: false,
        limit: 10,
        remaining: 0,
        resetSeconds: 45,
        retryAfterSeconds: 45,
      };

      const res = createRateLimitResponse(mockResult, 'Rate limit exceeded.');
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('45');
      expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(res.headers.get('X-RateLimit-Reset')).toBe('45');

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Rate limit exceeded.');
    });
  });

  describe('API Routes Integration Rate Limiting', () => {
    it('enforces 429 rate limit on POST /api/auth/login after 5 requests from the same IP', async () => {
      const testIp = '198.51.100.99';
      const makeReq = () =>
        new NextRequest('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': testIp,
          },
          body: JSON.stringify({ identifier: 'unknown@example.com', password: 'secretPassword123' }),
        });

      // Send 5 requests (all pass rate limiter and reach business logic)
      for (let i = 0; i < 5; i++) {
        const res = await loginHandler(makeReq());
        expect(res.status).not.toBe(429);
      }

      // 6th request MUST be blocked with 429 Too Many Requests
      const blockedRes = await loginHandler(makeReq());
      expect(blockedRes.status).toBe(429);

      const data = await blockedRes.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Too many login attempts');
      expect(blockedRes.headers.get('Retry-After')).toBeDefined();
    });

    it('enforces 429 rate limit on POST /api/auth/register after 5 requests from the same IP', async () => {
      const testIp = '198.51.100.100';
      const makeReq = () =>
        new NextRequest('http://localhost:3000/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': testIp,
          },
          body: JSON.stringify({
            fullName: 'Test User',
            email: 'test@example.com',
            memberNumber: '123456',
            password: 'password123',
            hasConsented: true,
          }),
        });

      // Send 5 requests
      for (let i = 0; i < 5; i++) {
        const res = await registerHandler(makeReq());
        expect(res.status).not.toBe(429);
      }

      // 6th request MUST be blocked with 429
      const blockedRes = await registerHandler(makeReq());
      expect(blockedRes.status).toBe(429);

      const data = await blockedRes.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Too many account creation attempts');
      expect(blockedRes.headers.get('Retry-After')).toBeDefined();
    }, 15000);
  });
});
