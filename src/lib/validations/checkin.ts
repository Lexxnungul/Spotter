import { z } from 'zod';

export const checkInCodeSchema = z.object({
  code: z
    .string({ error: 'Check-in code must be exactly 6 digits.' })
    .transform((value) => value.trim())
    .refine((value) => /^\d{6}$/.test(value), {
      message: 'Check-in code must be exactly 6 digits.',
    }),
});
