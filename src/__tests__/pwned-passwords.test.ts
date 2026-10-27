import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { checkPwnedPassword } from '../lib/pwned-passwords';
import { POST as registerHandler } from '../app/api/auth/register/route';
import { NextRequest } from 'next/server';
import { resetRateLimitStore } from '../lib/rate-limit';

describe('Have I Been Pwned (HIBP) Breached Password Detection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetRateLimitStore();
  });

  describe('checkPwnedPassword k-Anonymity protocol', () => {
    it('returns isBreached=false immediately for empty or null password', async () => {
      const res = await checkPwnedPassword('');
      expect(res).toEqual({ isBreached: false, count: 0 });
    });

    it('sends only the 5-character SHA-1 prefix and matches suffix locally', async () => {
      const testPassword = 'TestPassword123!';
      const fullHash = crypto
        .createHash('sha1')
        .update(testPassword)
        .digest('hex')
        .toUpperCase();
      const prefix = fullHash.slice(0, 5);
      const suffix = fullHash.slice(5);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => `00000000000000000000000000000000000:1\n${suffix}:42\nFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:3`,
      });

      const result = await checkPwnedPassword(testPassword, { fetchFn: mockFetch as any });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = mockFetch.mock.calls[0][0];
      const calledInit = mockFetch.mock.calls[0][1];

      // Verify k-anonymity: only the 5-character prefix is sent in the URL
      expect(calledUrl).toBe(`https://api.pwnedpasswords.com/range/${prefix}`);
      expect(calledUrl).not.toContain(suffix);
      expect(calledUrl).not.toContain(testPassword);

      // Verify security headers
      expect(calledInit.headers['Add-Padding']).toBe('true');
      expect(calledInit.headers['User-Agent']).toBe('Spotter-Gym-App/1.0');

      // Verify detection result
      expect(result.isBreached).toBe(true);
      expect(result.count).toBe(42);
    });

    it('returns isBreached=false when the suffix is not in HIBP response', async () => {
      const testPassword = 'VeryUniqueAndSafePassword2026!';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '11111111111111111111111111111111111:5\n22222222222222222222222222222222222:12',
      });

      const result = await checkPwnedPassword(testPassword, { fetchFn: mockFetch as any });
      expect(result.isBreached).toBe(false);
      expect(result.count).toBe(0);
    });

    it('handles case-insensitivity in returned hash suffixes', async () => {
      const testPassword = 'CaseTestPassword123';
      const fullHash = crypto
        .createHash('sha1')
        .update(testPassword)
        .digest('hex')
        .toUpperCase();
      const suffixLower = fullHash.slice(5).toLowerCase();

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => `${suffixLower}:999`,
      });

      const result = await checkPwnedPassword(testPassword, { fetchFn: mockFetch as any });
      expect(result.isBreached).toBe(true);
      expect(result.count).toBe(999);
    });

    it('gracefully fails open when HIBP returns non-200 HTTP status', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });

      const result = await checkPwnedPassword('AnyPassword123', { fetchFn: mockFetch as any });
      expect(result.isBreached).toBe(false);
      expect(result.count).toBe(0);
    });

    it('gracefully fails open when network error or timeout occurs', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network connection timeout'));

      const result = await checkPwnedPassword('AnyPassword123', { fetchFn: mockFetch as any });
      expect(result.isBreached).toBe(false);
      expect(result.count).toBe(0);
    });
  });

  describe('Integration: POST /api/auth/register breached password enforcement', () => {
    const createReq = (body: any) =>
      new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

    it('rejects registration with HTTP 400 when password is found in HIBP breach dataset', async () => {
      const testPassword = 'knownBreachedPassword99!';
      const fullHash = crypto
        .createHash('sha1')
        .update(testPassword)
        .digest('hex')
        .toUpperCase();
      const suffix = fullHash.slice(5);

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        if (typeof url === 'string' && url.includes('api.pwnedpasswords.com')) {
          return {
            ok: true,
            text: async () => `${suffix}:512`,
          } as Response;
        }
        return { ok: false } as Response;
      });

      const req = createReq({
        fullName: 'Jane Doe',
        email: 'jane.doe@example.com',
        memberNumber: '112233',
        password: testPassword,
        hasConsented: true,
      });

      const res = await registerHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.isBreached).toBe(true);
      expect(data.error).toContain('This password has appeared in a known data breach');
    });

    it('allows registration when HIBP lookup confirms the password is not breached', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        if (typeof url === 'string' && url.includes('api.pwnedpasswords.com')) {
          return {
            ok: true,
            text: async () => 'DIFFERENT_SUFFIX_00000000000000000000:10',
          } as Response;
        }
        return { ok: false } as Response;
      });

      const req = createReq({
        fullName: 'Jane Doe',
        email: 'clean.password.user@example.com',
        memberNumber: '556677',
        password: 'superSecretCleanPassword2026!',
        hasConsented: true,
      });

      const res = await registerHandler(req);
      // Even if database is unreachable in local test runner without Postgres container,
      // it should NOT fail on 400 breached password check
      expect(res.status).not.toBe(400);
    });

    it('fails open and proceeds to database when HIBP service is unreachable', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        if (typeof url === 'string' && url.includes('api.pwnedpasswords.com')) {
          throw new Error('HIBP service unreachable');
        }
        return { ok: false } as Response;
      });

      const req = createReq({
        fullName: 'Jane Doe',
        email: 'failopen.user@example.com',
        memberNumber: '556688',
        password: 'somePassword2026!',
        hasConsented: true,
      });

      const res = await registerHandler(req);
      // Must not block user with 400 breached error when external service fails
      expect(res.status).not.toBe(400);
    });
  });
});
