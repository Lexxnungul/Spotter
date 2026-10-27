import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  getZodErrorMessage,
} from '../lib/validations/auth';

describe('Server-Side Zod Validation Schemas', () => {
  describe('registerSchema', () => {
    const validData = {
      fullName: 'Chioma Adeyemi',
      email: 'Chioma@Example.com',
      memberNumber: '104200',
      password: 'password123',
      hasConsented: true,
    };

    it('successfully parses and normalizes valid registration data', () => {
      const res = registerSchema.safeParse(validData);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.fullName).toBe('Chioma Adeyemi');
        expect(res.data.email).toBe('chioma@example.com');
        expect(res.data.memberNumber).toBe('104200');
        expect(res.data.password).toBe('password123');
        expect(res.data.hasConsented).toBe(true);
      }
    });

    it('rejects empty or whitespace-only full name', () => {
      const res = registerSchema.safeParse({ ...validData, fullName: '   ' });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(getZodErrorMessage(res.error)).toContain('Full name must be at least 2 characters.');
      }
    });

    it('rejects single-word full name', () => {
      const res = registerSchema.safeParse({ ...validData, fullName: 'Chioma' });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(getZodErrorMessage(res.error)).toContain('Please enter at least 2 words or names separated by a space.');
      }
    });

    it('rejects invalid email formats', () => {
      const invalidEmails = ['invalid-email', 'chioma@', '@example.com', 'chioma @example.com'];
      for (const email of invalidEmails) {
        const res = registerSchema.safeParse({ ...validData, email });
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(getZodErrorMessage(res.error)).toContain('Please enter a valid email address.');
        }
      }
    });

    it('rejects non-6-digit member numbers', () => {
      const invalidNumbers = ['12345', '1234567', '12345a', 'abcdef', ''];
      for (const memberNumber of invalidNumbers) {
        const res = registerSchema.safeParse({ ...validData, memberNumber });
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(getZodErrorMessage(res.error)).toContain('Member number must be exactly 6 digits.');
        }
      }
    });

    it('rejects passwords shorter than 8 characters', () => {
      const res = registerSchema.safeParse({ ...validData, password: 'short' });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(getZodErrorMessage(res.error)).toContain('Password must be at least 8 characters long.');
      }
    });

    it('trims leading and trailing whitespace from passwords in registerSchema', () => {
      const res = registerSchema.safeParse({
        ...validData,
        password: '   password123   ',
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.password).toBe('password123');
      }

      // 8 spaces should be trimmed to empty and fail length >= 8
      const resWhitespaceOnly = registerSchema.safeParse({
        ...validData,
        password: '        ',
      });
      expect(resWhitespaceOnly.success).toBe(false);
      if (!resWhitespaceOnly.success) {
        expect(getZodErrorMessage(resWhitespaceOnly.error)).toContain('Password must be at least 8 characters long.');
      }
    });

    it('rejects missing or false consent', () => {
      const resFalse = registerSchema.safeParse({ ...validData, hasConsented: false });
      expect(resFalse.success).toBe(false);
      if (!resFalse.success) {
        expect(getZodErrorMessage(resFalse.error)).toContain('accept the check-in history');
      }

      const resMissing = registerSchema.safeParse({ ...validData, hasConsented: undefined });
      expect(resMissing.success).toBe(false);
      if (!resMissing.success) {
        expect(getZodErrorMessage(resMissing.error)).toContain('accept the check-in history');
      }
    });
  });

  describe('loginSchema', () => {
    it('successfully parses and normalizes valid credentials', () => {
      const res = loginSchema.safeParse({
        identifier: '  CHIOMA@example.com  ',
        password: '  secretPassword123  ',
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.identifier).toBe('chioma@example.com');
        expect(res.data.password).toBe('secretPassword123');
      }
    });

    it('rejects empty or missing identifier', () => {
      const resEmpty = loginSchema.safeParse({ identifier: '   ', password: 'secretPassword123' });
      expect(resEmpty.success).toBe(false);
      if (!resEmpty.success) {
        expect(getZodErrorMessage(resEmpty.error)).toBe('Email or member number and password are required.');
      }

      const resMissing = loginSchema.safeParse({ password: 'secretPassword123' });
      expect(resMissing.success).toBe(false);
      if (!resMissing.success) {
        expect(getZodErrorMessage(resMissing.error)).toBe('Email or member number and password are required.');
      }
    });

    it('rejects empty or missing password', () => {
      const resEmpty = loginSchema.safeParse({ identifier: 'chioma@example.com', password: '' });
      expect(resEmpty.success).toBe(false);
      if (!resEmpty.success) {
        expect(getZodErrorMessage(resEmpty.error)).toBe('Email or member number and password are required.');
      }

      const resWhitespaceOnly = loginSchema.safeParse({ identifier: 'chioma@example.com', password: '     ' });
      expect(resWhitespaceOnly.success).toBe(false);
      if (!resWhitespaceOnly.success) {
        expect(getZodErrorMessage(resWhitespaceOnly.error)).toBe('Email or member number and password are required.');
      }

      const resMissing = loginSchema.safeParse({ identifier: 'chioma@example.com' });
      expect(resMissing.success).toBe(false);
      if (!resMissing.success) {
        expect(getZodErrorMessage(resMissing.error)).toBe('Email or member number and password are required.');
      }
    });
  });
});
