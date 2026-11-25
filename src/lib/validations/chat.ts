import { z } from 'zod';

export const CHAT_MESSAGE_MAX_LENGTH = 4000;
export const CHAT_HISTORY_MAX_MESSAGES = 20;

const chatMessageContentSchema = z
  .string({ error: 'Message text is required.' })
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, {
    message: 'Message text is required.',
  })
  .refine((value) => value.length <= CHAT_MESSAGE_MAX_LENGTH, {
    message: `Message must be ${CHAT_MESSAGE_MAX_LENGTH} characters or fewer.`,
  });

export const chatHistoryMessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: chatMessageContentSchema,
});

export const chatRequestSchema = z.object({
  message: chatMessageContentSchema,
  conversationId: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0 && value.length <= 64, {
      message: 'Invalid conversation ID.',
    })
    .optional(),
  history: z
    .array(chatHistoryMessageSchema)
    .max(CHAT_HISTORY_MAX_MESSAGES, {
      message: `Conversation history cannot exceed ${CHAT_HISTORY_MAX_MESSAGES} messages.`,
    })
    .optional(),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
export type ChatHistoryMessageInput = z.infer<typeof chatHistoryMessageSchema>;
