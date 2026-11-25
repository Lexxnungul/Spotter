import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { authenticateMemberRequest } from '../../../lib/member-auth';
import { authenticateStaffRequest } from '../../../lib/staff-auth';
import {
  checkRateLimit,
  createRateLimitResponse,
  getClientIp,
} from '../../../lib/rate-limit';
import {
  DEFAULT_GEMINI_MODEL,
  generateGeminiText,
  hasConfiguredGeminiKey,
  isGeminiCapacityError,
  isGeminiRateLimitError,
} from '../../../lib/gemini';
import { getZodErrorMessage } from '../../../lib/validations/auth';
import { getLocalChatReply } from '../../../lib/chat-fallback';
import {
  CHAT_HISTORY_MAX_MESSAGES,
  chatRequestSchema,
} from '../../../lib/validations/chat';

export const dynamic = 'force-dynamic';

const CHAT_RATE_LIMIT = {
  limit: 20,
  windowSeconds: 60,
  actionName: 'chat',
};

const CHAT_SYSTEM_INSTRUCTION = [
  'You are Spotter, the AI assistant for Spotter Gym.',
  'Help members and front-desk staff with gym memberships, subscription plans, check-in, and payments.',
  'Be concise, friendly, and practical.',
  'If a request needs account-specific data you cannot access, ask the user to use the relevant dashboard screen.',
].join(' ');

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(getClientIp(req), 'chat', CHAT_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return createRateLimitResponse(
      rateLimit,
      `Too many chat messages. Please try again in ${rateLimit.retryAfterSeconds} seconds.`
    );
  }

  const member = authenticateMemberRequest(req);
  const staffResult = member ? null : await authenticateStaffRequest(req);
  const staff = staffResult?.authorized ? staffResult.staff : undefined;

  if (!member && !staff) {
    return NextResponse.json(
      { success: false, error: 'Please sign in to use the chat assistant.' },
      { status: 401 }
    );
  }

  if (!hasConfiguredGeminiKey()) {
    return NextResponse.json(
      { success: false, error: 'The chat assistant is not configured yet.' },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body.' },
      { status: 400 }
    );
  }

  const validation = chatRequestSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: getZodErrorMessage(validation.error) },
      { status: 400 }
    );
  }

  const { message, conversationId: requestedConversationId, history } =
    validation.data;
  const ownerFilter = member
    ? { memberId: member.id }
    : { staffId: staff!.id };

  try {
    const existingConversation = requestedConversationId
      ? await prisma.chatConversation.findFirst({
          where: { id: requestedConversationId, ...ownerFilter },
        })
      : null;

    const conversation =
      existingConversation ??
      (await prisma.chatConversation.create({
        data: {
          ...ownerFilter,
          title: message.slice(0, 80),
          model: DEFAULT_GEMINI_MODEL,
        },
      }));

    let priorMessages = history ?? [];
    if (existingConversation) {
      const storedMessages = await prisma.chatMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'desc' },
        take: CHAT_HISTORY_MAX_MESSAGES,
      });
      priorMessages = storedMessages.reverse().map((stored) => ({
        role: stored.role === 'model' ? ('model' as const) : ('user' as const),
        content: stored.content,
      }));
    }

    await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message,
      },
    });

    const reply = await generateGeminiText({
      prompt: message,
      history: priorMessages,
      systemInstruction: CHAT_SYSTEM_INSTRUCTION,
    });

    await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'model',
        content: reply,
      },
    });

    return NextResponse.json({
      success: true,
      reply,
      conversationId: conversation.id,
    });
  } catch (error) {
    console.error('[API Chat Error]:', error);
    if (isGeminiCapacityError(error) || isGeminiRateLimitError(error)) {
      const localReply = getLocalChatReply(message);
      return NextResponse.json({
        success: true,
        reply: localReply.answer,
        source: 'local',
        title: localReply.title,
        record: localReply.record,
      });
    }
    return NextResponse.json(
      {
        success: false,
        error: 'The assistant could not respond right now. Please try again.',
      },
      { status: 502 }
    );
  }
}
