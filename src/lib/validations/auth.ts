import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z
    .string({ error: 'Full name must be at least 2 characters.' })
    .transform((val) => val.trim())
    .refine((val) => val.length >= 2, {
      message: 'Full name must be at least 2 characters.',
    })
    .refine((val) => val.split(/\s+/).filter(Boolean).length >= 2, {
      message: 'Please enter at least 2 words or names separated by a space.',
    }),
  email: z
    .string({ error: 'Please enter a valid email address.' })
    .transform((val) => val.trim().toLowerCase())
    .refine((val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'Please enter a valid email address.',
    }),
  memberNumber: z
    .string({ error: 'Member number must be exactly 6 digits.' })
    .transform((val) => val.trim())
    .refine((val) => /^\d{6}$/.test(val), {
      message: 'Member number must be exactly 6 digits.',
    }),
  password: z
    .string({ error: 'Password must be at least 8 characters long.' })
    .transform((val) => val.trim())
    .refine((val) => val.length >= 8, {
      message: 'Password must be at least 8 characters long.',
    }),
  hasConsented: z
    .boolean({ error: 'You must accept the check-in history and email storage notice to create an account.' })
    .refine((val) => val === true, {
      message: 'You must accept the check-in history and email storage notice to create an account.',
    }),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  identifier: z
    .string({ error: 'Email or member number and password are required.' })
    .transform((val) => val.trim().toLowerCase())
    .refine((val) => val.length > 0, {
      message: 'Email or member number and password are required.',
    }),
  password: z
    .string({ error: 'Email or member number and password are required.' })
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, {
      message: 'Email or member number and password are required.',
    }),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const verifyEmailSchema = z.object({
  email: z
    .string({ error: 'Please enter a valid email address.' })
    .transform((val) => val.trim().toLowerCase())
    .refine((val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'Please enter a valid email address.',
    }),
  code: z
    .string({ error: 'Verification code must be exactly 6 digits.' })
    .transform((val) => val.trim())
    .refine((val) => /^\d{6}$/.test(val), {
      message: 'Verification code must be exactly 6 digits.',
    }),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: z
    .string({ error: 'Please enter a valid email address.' })
    .transform((val) => val.trim().toLowerCase())
    .refine((val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'Please enter a valid email address.',
    }),
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

/**
 * Extracts the primary human-readable error message from a ZodError
 */
export function getZodErrorMessage(error: z.ZodError): string {
  if (error.issues && error.issues.length > 0) {
    return error.issues[0].message;
  }
  return 'Invalid form data submitted.';
}
