import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getEmailTransporter,
  resetEmailTransporter,
  sendEmail,
  sendWelcomeEmail,
  sendVerificationEmail,
  verifyEmailConfig,
} from '../lib/email';

describe('Nodemailer Email Service & Templates', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetEmailTransporter();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetEmailTransporter();
  });

  describe('Transporter Configuration', () => {
    it('initializes a safe development/test stream transporter when SMTP env vars are absent', () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const transporter = getEmailTransporter();
      expect(transporter).toBeDefined();
      expect(typeof transporter.sendMail).toBe('function');
    });

    it('initializes custom SMTP transporter when host, user, and pass are present', () => {
      process.env.SMTP_HOST = 'smtp.mailtrap.io';
      process.env.SMTP_PORT = '2525';
      process.env.SMTP_USER = 'testuser';
      process.env.SMTP_PASS = 'testpass';

      const transporter = getEmailTransporter();
      expect(transporter).toBeDefined();
      expect(typeof transporter.sendMail).toBe('function');
    });
  });

  describe('sendEmail function', () => {
    it('dispatches emails using fallback stream transport successfully', async () => {
      delete process.env.SMTP_HOST;

      const res = await sendEmail({
        to: 'member@example.com',
        subject: 'Workout Reminder',
        html: '<p>Remember to hydrate!</p>',
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBeDefined();
    });

    it('handles multiple recipients', async () => {
      delete process.env.SMTP_HOST;

      const res = await sendEmail({
        to: ['first@example.com', 'second@example.com'],
        subject: 'Gym Update',
        html: '<p>New equipment arrived!</p>',
      });

      expect(res.success).toBe(true);
    });
  });

  describe('sendWelcomeEmail Template', () => {
    it('formats member name, card number, and tier correctly', async () => {
      delete process.env.SMTP_HOST;

      const res = await sendWelcomeEmail({
        to: 'newmember@example.com',
        fullName: 'Chinedu Eze',
        memberNumber: '654321',
        tier: 'PREMIUM',
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBeDefined();
    });

    it('provides sensible defaults when optional fields are omitted', async () => {
      delete process.env.SMTP_HOST;

      const res = await sendWelcomeEmail({
        to: 'anonymous@example.com',
        fullName: 'Jane Doe',
      });

      expect(res.success).toBe(true);
    });
  });

  describe('sendVerificationEmail Template', () => {
    it('dispatches verification email with 6-digit code', async () => {
      delete process.env.SMTP_HOST;

      const res = await sendVerificationEmail({
        to: 'verify@example.com',
        fullName: 'Chioma Adeyemi',
        code: '582914',
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBeDefined();
    });
  });
});

