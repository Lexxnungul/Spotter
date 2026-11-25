import { GoogleGenAI } from '@google/genai';
import type {
  Chat,
  Content,
  EmbedContentConfig,
  GenerateContentConfig,
  Schema,
} from '@google/genai';
import { checkRateLimit } from './rate-limit';
import { getZodErrorMessage } from './validations/auth';
import {
  geminiEmbeddingRequestSchema,
  geminiGenerateRequestSchema,
} from './validations/gemini';

export const DEFAULT_GEMINI_MODEL =
  process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

const GEMINI_FALLBACK_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
];

export const DEFAULT_GEMINI_EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';

export interface GeminiChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface GeminiGenerateOptions {
  prompt: string;
  model?: string;
  systemInstruction?: string;
  history?: GeminiChatMessage[];
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
}

export interface GeminiJsonOptions extends GeminiGenerateOptions {
  responseSchema?: Schema;
}

export interface GeminiEmbeddingOptions {
  model?: string;
  taskType?: string;
  outputDimensionality?: number;
  abortSignal?: AbortSignal;
}

let cachedClient: GoogleGenAI | null = null;

const GEMINI_MAX_ATTEMPTS = 3;
const GEMINI_RETRY_BASE_MS = 500;
const GEMINI_REQUEST_TIMEOUT_MS = 30_000;

const MODEL_RATE_LIMIT_MINUTE = {
  limit: 10,
  windowSeconds: 60,
  actionName: 'gemini-model-minute',
};
const MODEL_RATE_LIMIT_DAY = {
  limit: 40,
  windowSeconds: 24 * 60 * 60,
  actionName: 'gemini-model-day',
};

export class GeminiRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(`Model request limit reached. Try again in ${retryAfterSeconds} seconds.`);
    this.name = 'GeminiRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isGeminiRateLimitError(error: unknown): boolean {
  return error instanceof GeminiRateLimitError;
}

function enforceModelRateLimit(): void {
  const minute = checkRateLimit('global', 'gemini-model-minute', MODEL_RATE_LIMIT_MINUTE);
  if (!minute.allowed) {
    throw new GeminiRateLimitError(minute.retryAfterSeconds);
  }

  const day = checkRateLimit('global', 'gemini-model-day', MODEL_RATE_LIMIT_DAY);
  if (!day.allowed) {
    throw new GeminiRateLimitError(day.retryAfterSeconds);
  }
}

export function isGeminiCapacityError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const status = (error as { status?: unknown }).status;
  if (status === 429 || status === 503) return true;

  const message = (error as { message?: unknown }).message;
  return (
    typeof message === 'string' &&
    /quota|rate limit|high demand|RESOURCE_EXHAUSTED|UNAVAILABLE/i.test(message)
  );
}

function isRetryableGeminiError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if (isGeminiCapacityError(error)) return false;

  const name = (error as { name?: unknown }).name;
  if (name === 'AbortError' || name === 'TimeoutError') return true;

  const status = (error as { status?: unknown }).status;
  if (typeof status === 'number') {
    return status === 408 || status >= 500;
  }

  const code = (error as { code?: unknown }).code;
  if (
    typeof code === 'string' &&
    /ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|UND_ERR/i.test(code)
  ) {
    return true;
  }

  const message = (error as { message?: unknown }).message;
  return (
    typeof message === 'string' &&
    /fetch failed|timeout|this operation was aborted|connection reset/i.test(
      message
    )
  );
}

async function withGeminiRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === GEMINI_MAX_ATTEMPTS || !isRetryableGeminiError(error)) {
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, GEMINI_RETRY_BASE_MS * 2 ** (attempt - 1))
      );
    }
  }

  throw lastError;
}

function withRequestTimeout<T extends { abortSignal?: AbortSignal }>(
  config: T
): T {
  if (config.abortSignal) return config;
  return {
    ...config,
    abortSignal: AbortSignal.timeout(GEMINI_REQUEST_TIMEOUT_MS),
  };
}

function getGeminiModelCandidates(requestedModel?: string): string[] {
  return Array.from(
    new Set([requestedModel || DEFAULT_GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS])
  );
}

async function generateTextWithFallback(
  requestedModel: string | undefined,
  contents: Content[],
  config: GenerateContentConfig,
  emptyResponseMessage: string
): Promise<string> {
  let lastError: unknown;

  for (const model of getGeminiModelCandidates(requestedModel)) {
    try {
      const response = await withGeminiRetry(() => {
        enforceModelRateLimit();
        return getGeminiClient().models.generateContent({
          model,
          contents,
          config: withRequestTimeout(config),
        });
      });

      const text = response.text?.trim();
      if (!text) {
        throw new Error(emptyResponseMessage);
      }
      return text;
    } catch (error) {
      lastError = error;
      if (!isGeminiCapacityError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

export function hasConfiguredGeminiKey(): boolean {
  const apiKey = process.env.GEMINI_API_KEY;
  return Boolean(apiKey && apiKey.trim().length > 0);
}

export function getGeminiClient(): GoogleGenAI {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Add it to your environment before calling Gemini.'
    );
  }

  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

export function resetGeminiClient(): void {
  cachedClient = null;
}

function toContents(
  prompt: string,
  history?: GeminiChatMessage[]
): Content[] {
  const contents: Content[] = (history ?? []).map((message) => ({
    role: message.role,
    parts: [{ text: message.content }],
  }));

  contents.push({ role: 'user', parts: [{ text: prompt }] });
  return contents;
}

function buildConfig(options: GeminiGenerateOptions): GenerateContentConfig {
  const config: GenerateContentConfig = {};

  if (options.systemInstruction) {
    config.systemInstruction = options.systemInstruction;
  }
  if (options.temperature !== undefined) {
    config.temperature = options.temperature;
  }
  if (options.topP !== undefined) {
    config.topP = options.topP;
  }
  if (options.topK !== undefined) {
    config.topK = options.topK;
  }
  if (options.maxOutputTokens !== undefined) {
    config.maxOutputTokens = options.maxOutputTokens;
  }
  if (options.abortSignal) {
    config.abortSignal = options.abortSignal;
  }

  return config;
}

export async function generateGeminiText(
  options: GeminiGenerateOptions
): Promise<string> {
  const parsed = geminiGenerateRequestSchema.safeParse(options);
  if (!parsed.success) {
    throw new Error(getZodErrorMessage(parsed.error));
  }

  const input = parsed.data;
  return generateTextWithFallback(
    input.model,
    toContents(input.prompt, input.history),
    buildConfig({ ...input, abortSignal: options.abortSignal }),
    'Gemini returned an empty response.'
  );
}

export async function generateGeminiJson<T>(
  options: GeminiJsonOptions
): Promise<T> {
  const parsed = geminiGenerateRequestSchema.safeParse(options);
  if (!parsed.success) {
    throw new Error(getZodErrorMessage(parsed.error));
  }

  const input = parsed.data;
  const config = buildConfig({ ...input, abortSignal: options.abortSignal });
  config.responseMimeType = 'application/json';
  if (options.responseSchema) {
    config.responseSchema = options.responseSchema;
  }

  const text = await generateTextWithFallback(
    input.model,
    toContents(input.prompt, input.history),
    config,
    'Gemini returned an empty JSON response.'
  );

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Gemini returned malformed JSON.');
  }
}

export async function generateGeminiEmbedding(
  input: string | string[],
  options: GeminiEmbeddingOptions = {}
): Promise<number[][]> {
  const inputs = Array.isArray(input) ? input : [input];
  if (inputs.length === 0) {
    return [];
  }

  const parsed = geminiEmbeddingRequestSchema.safeParse({
    input: inputs,
    model: options.model,
    taskType: options.taskType,
    outputDimensionality: options.outputDimensionality,
  });
  if (!parsed.success) {
    throw new Error(getZodErrorMessage(parsed.error));
  }

  const valid = parsed.data;
  const config: EmbedContentConfig = {};
  if (valid.taskType) {
    config.taskType = valid.taskType;
  }
  if (valid.outputDimensionality !== undefined) {
    config.outputDimensionality = valid.outputDimensionality;
  }
  if (options.abortSignal) {
    config.abortSignal = options.abortSignal;
  }

  const response = await withGeminiRetry(() => {
    enforceModelRateLimit();
    return getGeminiClient().models.embedContent({
      model: valid.model || DEFAULT_GEMINI_EMBEDDING_MODEL,
      contents: valid.input,
      config: withRequestTimeout(config),
    });
  });

  return (response.embeddings ?? []).map(
    (embedding) => embedding.values ?? []
  );
}

export function createGeminiChat(options: {
  model?: string;
  systemInstruction?: string;
  history?: GeminiChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
} = {}): Chat {
  const config: GenerateContentConfig = {};
  if (options.systemInstruction) {
    config.systemInstruction = options.systemInstruction;
  }
  if (options.temperature !== undefined) {
    config.temperature = options.temperature;
  }
  if (options.maxOutputTokens !== undefined) {
    config.maxOutputTokens = options.maxOutputTokens;
  }

  return getGeminiClient().chats.create({
    model: options.model || DEFAULT_GEMINI_MODEL,
    config,
    history: options.history?.map((message) => ({
      role: message.role,
      parts: [{ text: message.content }],
    })),
  });
}
