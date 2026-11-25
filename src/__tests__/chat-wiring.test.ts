import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '../lib/prisma';
import { createMemberToken, MEMBER_COOKIE_NAME } from '../lib/member-auth';
import { resetRateLimitStore } from '../lib/rate-limit';
import { POST as chatHandler } from '../app/api/chat/route';

vi.mock('../lib/gemini', () => ({
  DEFAULT_GEMINI_MODEL: 'gemini-test-model',
  hasConfiguredGeminiKey: () => true,
  isGeminiCapacityError: () => false,
  isGeminiRateLimitError: () => false,
  generateGeminiText: vi.fn(async ({ prompt }: { prompt: string }) => `Echo: ${prompt}`),
}));

describe('chat field wiring', () => {
  const memberNumber = '998877';
  const email = 'chat.wiring.test@example.com';
  let memberId = '';
  let token = '';

  beforeAll(async () => {
    resetRateLimitStore();
    const existing = await prisma.member.findUnique({ where: { memberNumber } });
    if (existing) {
      await prisma.chatMessage.deleteMany({
        where: { conversation: { memberId: existing.id } },
      });
      await prisma.chatConversation.deleteMany({ where: { memberId: existing.id } });
      await prisma.member.delete({ where: { id: existing.id } });
    }
    const member = await prisma.member.create({
      data: {
        fullName: 'Chat Wiring Test',
        email,
        memberNumber,
        tier: 'BASIC',
        status: 'ACTIVE',
        expiryDate: new Date('2027-01-01T00:00:00Z'),
      },
    });
    memberId = member.id;
    token = createMemberToken({
      id: member.id,
      fullName: member.fullName,
      email: member.email,
      memberNumber: member.memberNumber,
    });
  });

  afterAll(async () => {
    await prisma.chatMessage.deleteMany({
      where: { conversation: { memberId } },
    });
    await prisma.chatConversation.deleteMany({ where: { memberId } });
    await prisma.member.delete({ where: { id: memberId } });
  });

  it('sends the typed prompt to Gemini and returns its reply', async () => {
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${MEMBER_COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify({ message: 'What are the gym hours?' }),
    });

    const res = await chatHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.reply).toBe('Echo: What are the gym hours?');
    expect(typeof data.conversationId).toBe('string');

    const conversation = await prisma.chatConversation.findUnique({
      where: { id: data.conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    expect(conversation?.memberId).toBe(memberId);
    expect(conversation?.messages.map((m) => m.role)).toEqual(['user', 'model']);
    expect(conversation?.messages[0].content).toBe('What are the gym hours?');
  });

  it('rejects empty prompts before calling Gemini', async () => {
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${MEMBER_COOKIE_NAME}=${token}`,
      },
      body: JSON.stringify({ message: '   ' }),
    });

    const res = await chatHandler(req);
    expect(res.status).toBe(400);
  });
});
