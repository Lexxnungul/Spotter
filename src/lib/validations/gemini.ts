import { z } from 'zod';

export const GEMINI_INPUT_MAX_LENGTH = 4000;
export const GEMINI_HISTORY_MAX_MESSAGES = 20;

export const geminiGenerateRequestSchema = z.object({
  prompt: z
    .string({ error: 'Prompt is required.' })
    .trim()
    .min(1, 'Prompt is required.')
    .max(GEMINI_INPUT_MAX_LENGTH, 'Prompt is too long.'),
  model: z.string().trim().min(1).max(80).optional(),
  systemInstruction: z
    .string()
    .trim()
    .max(GEMINI_INPUT_MAX_LENGTH, 'System instruction is too long.')
    .optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'model']),
        content: z
          .string({ error: 'History message text is required.' })
          .trim()
          .min(1, 'History message text is required.')
          .max(GEMINI_INPUT_MAX_LENGTH, 'History message is too long.'),
      })
    )
    .max(GEMINI_HISTORY_MAX_MESSAGES, 'Conversation history is too long.')
    .optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().int().min(1).max(100).optional(),
  maxOutputTokens: z.number().int().min(1).max(8192).optional(),
});

export const geminiEmbeddingRequestSchema = z.object({
  input: z
    .array(
      z
        .string({ error: 'Embedding input is required.' })
        .trim()
        .min(1, 'Embedding input is required.')
        .max(GEMINI_INPUT_MAX_LENGTH, 'Embedding input is too long.')
    )
    .min(1, 'At least one embedding input is required.')
    .max(100, 'Too many embedding inputs.'),
  model: z.string().trim().min(1).max(80).optional(),
  taskType: z.string().trim().min(1).max(80).optional(),
  outputDimensionality: z.number().int().min(1).max(3072).optional(),
});

export type GeminiGenerateRequest = z.infer<typeof geminiGenerateRequestSchema>;
export type GeminiEmbeddingRequest = z.infer<typeof geminiEmbeddingRequestSchema>;
