import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';
import {
  createStaffToken,
  verifyStaffTokenEdge,
  STAFF_COOKIE_NAME,
  VerifiedStaff,
} from '../lib/staff-token';
import { authenticateStaffRequest } from '../lib/staff-auth';
import { POST as loginHandler } from '../app/api/auth/login/route';
import { POST as logoutHandler } from '../app/api/auth/logout/route';

describe('Server-Side HTTP Auth Guard & Middleware Pipeline', () => {
  const sampleStaff: VerifiedStaff = {
    id: 'staff_desk_01',
    fullName: 'Chioma Okeke',
    email: 'desk@spottergym.com',
    role: 'STAFF',
    whatsapp: '+234 803 333 4444',
  };

  describe('Edge-Compatible Web Crypto Token Verification', () => {
    it('verifies a valid cryptographically signed staff token using Web Crypto', async () => {
      const token = await createStaffToken(sampleStaff);
      const verified = await verifyStaffTokenEdge(token);

      expect(verified).not.toBeNull();
      expect(verified?.id).toBe('staff_desk_01');
      expect(verified?.email).toBe('desk@spottergym.com');
      expect(verified?.role).toBe('STAFF');
    });

    it('rejects tampered or forged tokens', async () => {
      const token = await createStaffToken(sampleStaff);
      const parts = token.split('.');
      const tampered = `${parts[0]}.invalid_signature`;

      const verified = await verifyStaffTokenEdge(tampered);
      expect(verified).toBeNull();
    });

    it('rejects tokens with invalid payload structure', async () => {
      const verified = await verifyStaffTokenEdge('not-a-valid-token');
      expect(verified).toBeNull();
    });
  });

  describe('Next.js Middleware HTTP Route Interceptor (/receptionist)', () => {
    it('intercepts unauthenticated GET /receptionist and redirects to /auth?mode=login', async () => {
      const req = new NextRequest('http://localhost:3000/receptionist');
      const res = await middleware(req);

      expect(res.status).toBe(307); // Next.js redirect
      const location = res.headers.get('location');
      expect(location).toContain('/auth');
      expect(location).toContain('mode=login');
      expect(location).toContain('redirect=%2Freceptionist');
      expect(location).toContain('error=staff_required');
    });

    it('intercepts request with invalid cookie token and redirects to /auth', async () => {
      const req = new NextRequest('http://localhost:3000/receptionist', {
        headers: {
          cookie: `${STAFF_COOKIE_NAME}=corrupt_or_expired_token`,
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/auth');
      expect(location).toContain('error=invalid_session');
    });

    it('allows GET /receptionist through when valid staff cookie is present and injects staff headers', async () => {
      const token = await createStaffToken(sampleStaff);
      const req = new NextRequest('http://localhost:3000/receptionist', {
        headers: {
          cookie: `${STAFF_COOKIE_NAME}=${token}`,
        },
      });

      const res = await middleware(req);
      // Status 200 or downstream NextResponse.next()
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });

    it('ignores non-receptionist public routes like / and /auth', async () => {
      const publicReq = new NextRequest('http://localhost:3000/');
      const res = await middleware(publicReq);
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });
  });

  describe('Cookie-Based Authentication in authenticateStaffRequest', () => {
    it('authenticates staff via spotter_staff_token cookie directly on API requests', async () => {
      const token = await createStaffToken(sampleStaff);
      const req = new NextRequest('http://localhost:3000/api/receptionist/recent-issuances', {
        headers: {
          cookie: `${STAFF_COOKIE_NAME}=${token}`,
        },
      });

      const result = await authenticateStaffRequest(req);
      expect(result.authorized).toBe(true);
      expect(result.staff?.id).toBe('staff_desk_01');
      expect(result.staff?.role).toBe('STAFF');
    });
  });

  describe('Login & Logout Cookie Lifecycle', () => {
    it('POST /api/auth/login sets httpOnly spotter_staff_token cookie on successful staff login', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'desk@spottergym.com',
          password: 'SpotterDesk#2026!',
        }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(200);

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).not.toBeNull();
      expect(setCookie).toContain(STAFF_COOKIE_NAME);
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('Path=/');
    });

    it('POST /api/auth/logout deletes spotter_staff_token cookie', async () => {
      const res = await logoutHandler();
      expect(res.status).toBe(200);

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).not.toBeNull();
      expect(setCookie).toContain(STAFF_COOKIE_NAME);
      // When deleted, Max-Age is 0 or expires in the past
      expect(setCookie).toMatch(/Max-Age=0|Expires=/i);
    });
  });
});
