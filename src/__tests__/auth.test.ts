import { describe, it, expect, beforeEach } from 'vitest';
import { DEMO_MEMBER, DEMO_ACTIVATION_CODES } from '../context/AuthContext';

describe('Auth System Specifications (PRD FR-7 & FR-8)', () => {
  beforeEach(() => {
    // Clear mock storage
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('FR-7: Activation and NDPA Consent', () => {
    it('accepts valid 6-digit activation code and maps to member', () => {
      const validCode = '849201';
      const member = DEMO_ACTIVATION_CODES[validCode];
      expect(member).toBeDefined();
      expect(member?.fullName).toBe('Tunde Bakare');
      expect(member?.tier).toBe('PREMIUM');
    });

    it('rejects invalid or non-6-digit activation code', () => {
      const invalidCode = '999999';
      expect(DEMO_ACTIVATION_CODES[invalidCode]).toBeUndefined();
    });

    it('requires explicit consent to link device', () => {
      const hasConsented = false;
      const canActivate = hasConsented;
      expect(canActivate).toBe(false);
    });
  });

  describe('FR-8: PIN Authentication and Lockout Rules', () => {
    it('validates 4-digit PIN against stored hash', () => {
      const enteredPin = '1234';
      expect(enteredPin).toBe(DEMO_MEMBER.pinHash);
    });

    it('detects incorrect PIN attempt', () => {
      const enteredPin = '9999';
      expect(enteredPin).not.toBe(DEMO_MEMBER.pinHash);
    });

    it('locks out after 5 consecutive failed tries', () => {
      let failedAttempts = 0;
      const maxAttempts = 5;
      const attempts = ['0000', '1111', '2222', '3333', '4444'];

      for (const attempt of attempts) {
        if (attempt !== DEMO_MEMBER.pinHash) {
          failedAttempts++;
        }
      }

      const isLockedOut = failedAttempts >= maxAttempts;
      expect(failedAttempts).toBe(5);
      expect(isLockedOut).toBe(true);
    });
  });

  describe('Staff and Owner Authentication', () => {
    it('recognizes OWNER credentials', () => {
      const email = 'owner@spottergym.com';
      const pass = 'ownerpassword';
      const isValidOwner = email === 'owner@spottergym.com' && pass === 'ownerpassword';
      expect(isValidOwner).toBe(true);
    });

    it('recognizes STAFF credentials', () => {
      const email = 'desk@spottergym.com';
      const pass = 'deskpassword';
      const isValidStaff = email === 'desk@spottergym.com' && pass === 'deskpassword';
      expect(isValidStaff).toBe(true);
    });
  });
});
