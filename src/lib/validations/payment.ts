import { z } from 'zod';

export const initializePaymentSchema = z.object({
  memberId: z
    .string({ error: 'Member ID is required.' })
    .min(1, 'Member ID is required.'),
  purpose: z.enum(['RENEWAL', 'BALANCE', 'NEW_SUBSCRIPTION']).default('RENEWAL'),
  tier: z.enum(['BASIC', 'PREMIUM', 'DIAMOND']).optional(),
  redirectUrl: z.string().url().optional(),
  paymentLogId: z.string().min(1).optional(),
});

export type InitializePaymentInput = z.infer<typeof initializePaymentSchema>;

export const verifyPaymentSchema = z.object({
  reference: z
    .string({ error: 'Transaction reference is required.' })
    .min(1, 'Transaction reference is required.'),
  gatewayStatus: z.string().optional(),
  transactionId: z.union([z.string(), z.number()]).optional(),
  poll: z.boolean().optional(),
});

export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

export const simulateWebhookSchema = z.object({
  reference: z
    .string({ error: 'Transaction reference is required.' })
    .min(1, 'Transaction reference is required.'),
  memberId: z
    .string({ error: 'Member ID is required.' })
    .min(1, 'Member ID is required.'),
  gatewayStatus: z.enum(['successful', 'failed', 'cancelled']).default('successful'),
});

export type SimulateWebhookInput = z.infer<typeof simulateWebhookSchema>;

export const paymentJourneySchema = z.object({
  action: z.enum([
    'MODAL_OPENED',
    'PLAN_SELECTED',
    'ABANDONED_MODAL',
    'GATEWAY_REDIRECT',
  ]),
  memberId: z
    .string({ error: 'Member ID is required.' })
    .min(1, 'Member ID is required.'),
  paymentLogId: z.string().min(1).optional(),
  purpose: z.enum(['RENEWAL', 'BALANCE', 'NEW_SUBSCRIPTION']).default('RENEWAL'),
  tier: z.enum(['BASIC', 'PREMIUM', 'DIAMOND']).optional(),
  reason: z.string().max(300).optional(),
  reference: z.string().min(1).optional(),
});

export type PaymentJourneyInput = z.infer<typeof paymentJourneySchema>;

