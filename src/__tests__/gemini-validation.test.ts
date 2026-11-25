import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateContent, embedContent } = vi.hoisted(() => ({
  generateContent: vi.fn(),
  embedContent: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = {
      generateContent: generateContent.mockImplementation(async () => ({ text: 'OK' })),
      embedContent: embedContent.mockImplementation(async () => ({ embeddings: [] })),
    };
  },
}));

import {
  GeminiRateLimitError,
  generateGeminiEmbedding,
  generateGeminiText,
  resetGeminiClient,
} from '../lib/gemini';
import { resetRateLimitStore } from '../lib/rate-limit';
import {
  geminiEmbeddingRequestSchema,
  geminiGenerateRequestSchema,
} from '../lib/validations/gemini';

describe('Gemini input validation', () => {
  it('rejects an empty prompt and an invalid history role', () => {
    expect(
      geminiGenerateRequestSchema.safeParse({ prompt: '   ' }).success
    ).toBe(false);
    expect(
      geminiGenerateRequestSchema.safeParse({
        prompt: 'Hello',
        history: [{ role: 'assistant', content: 'Hi' }],
      }).success
    ).toBe(false);
  });

  it('rejects history longer than the allowed limit and invalid sampling values', () => {
    expect(
      geminiGenerateRequestSchema.safeParse({
        prompt: 'Hello',
        history: Array.from({ length: 21 }, () => ({ role: 'user', content: 'Hi' })),
      }).success
    ).toBe(false);
    expect(
      geminiGenerateRequestSchema.safeParse({
        prompt: 'Hello',
        temperature: 5,
      }).success
    ).toBe(false);
  });

  it('rejects empty embedding input', () => {
    expect(geminiEmbeddingRequestSchema.safeParse({ input: [] }).success).toBe(false);
  });

  it('blocks invalid input before any model request', async () => {
    resetRateLimitStore();
    await expect(generateGeminiText({ prompt: '' })).rejects.toThrow(
      'Prompt is required.'
    );
    expect(generateContent).not.toHaveBeenCalled();
  });
});

describe('global model request rate limit', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    resetGeminiClient();
    resetRateLimitStore();
    generateContent.mockClear();
    embedContent.mockClear();
  });

  it('allows the configured number of model requests then blocks the next one', async () => {
    for (let i = 0; i < 10; i += 1) {
      await expect(generateGeminiText({ prompt: 'Hello' })).resolves.toBe('OK');
    }

    await expect(generateGeminiText({ prompt: 'Hello' })).rejects.toBeInstanceOf(
      GeminiRateLimitError
    );
    expect(generateContent).toHaveBeenCalledTimes(10);
  });

  it('counts embedding calls against the same global cap', async () => {
    await generateGeminiEmbedding('Hello');
    expect(embedContent).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 9; i += 1) {
      await generateGeminiText({ prompt: 'Hello' });
    }

    await expect(generateGeminiEmbedding('Hello')).rejects.toBeInstanceOf(
      GeminiRateLimitError
    );
  });
});
