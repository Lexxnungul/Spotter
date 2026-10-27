import { z } from 'zod';

/**
 * Normalizes a Nigerian phone number to international E.164 (+234...) format.
 */
export function normalizePhoneNumber(raw: string): string {
  const cleaned = raw.trim().replace(/[\s-()]/g, '');
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return `+234${cleaned.slice(1)}`;
  }
  if (cleaned.startsWith('234') && cleaned.length === 13) {
    return `+${cleaned}`;
  }
  if (!cleaned.startsWith('+') && cleaned.length === 10) {
    return `+234${cleaned}`;
  }
  return cleaned;
}

export const generateMemberNumberSchema = z.object({
  fullName: z
    .string({ error: 'Full name is required.' })
    .transform((val) => val.trim())
    .refine((val) => val.length >= 2, {
      message: 'Full name must be at least 2 characters.',
    })
    .refine((val) => val.split(/\s+/).filter(Boolean).length >= 2, {
      message: 'Please enter at least 2 words or names separated by a space.',
    }),
  phone: z
    .string({ error: 'Phone number is required.' })
    .transform((val) => normalizePhoneNumber(val))
    .refine((val) => /^\+234[789]\d{9}$/.test(val) || /^\+\d{10,15}$/.test(val) || /^0[789]\d{9}$/.test(val), {
      message: 'Please enter a valid Nigerian mobile phone number (e.g. 08012345678 or +2348012345678).',
    }),
  tier: z.enum(['BASIC', 'PREMIUM'], {
    message: 'Membership tier must be BASIC or PREMIUM.',
  }),
  email: z
    .string()
    .transform((val) => (val ? val.trim().toLowerCase() : ''))
    .optional()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'Please enter a valid email address.',
    }),
  initialPaymentKobo: z
    .number({ error: 'Initial payment must be a valid number.' })
    .int('Payment must be an integer in kobo.')
    .min(0, 'Initial payment cannot be negative.')
    .default(0),
  paymentMethod: z
    .enum(['CASH', 'TRANSFER', 'POS', 'PENDING'], {
      message: 'Payment method must be CASH, TRANSFER, POS, or PENDING.',
    })
    .default('PENDING'),
  notes: z
    .string()
    .max(500, 'Notes must not exceed 500 characters.')
    .optional()
    .transform((val) => (val ? val.trim() : '')),
});

export type GenerateMemberNumberInput = z.infer<typeof generateMemberNumberSchema>;

export const checkPhoneSchema = z.object({
  phone: z
    .string({ error: 'Phone number is required.' })
    .transform((val) => normalizePhoneNumber(val))
    .refine((val) => val.length >= 7, {
      message: 'Please enter a valid phone number to check.',
    }),
});

export type CheckPhoneInput = z.infer<typeof checkPhoneSchema>;
