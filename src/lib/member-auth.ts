import crypto from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';

export const MEMBER_COOKIE_NAME = 'spotter_member_token';

const MEMBER_AUTH_SECRET =
  process.env.MEMBER_SESSION_SECRET ||
  process.env.SESSION_SECRET ||
  'spotter_member_secure_session_secret_2026';

const MEMBER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface MemberSessionPayload {
  id: string;
  fullName: string;
  email?: string | null;
  memberNumber?: string | null;
}

interface MemberTokenPayload extends MemberSessionPayload {
  iat: number;
  exp: number;
}

export function createMemberToken(member: MemberSessionPayload): string {
  const now = Date.now();
  const payload: MemberTokenPayload = {
    id: member.id,
    fullName: member.fullName,
    email: member.email || null,
    memberNumber: member.memberNumber || null,
    iat: now,
    exp: now + MEMBER_SESSION_MAX_AGE_SECONDS * 1000,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', MEMBER_AUTH_SECRET)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

export function verifyMemberToken(token: string): MemberSessionPayload | null {
  try {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;

    const expectedSignature = crypto
      .createHmac('sha256', MEMBER_AUTH_SECRET)
      .update(payloadB64)
      .digest('base64url');

    const supplied = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as MemberTokenPayload;

    if (!payload.id || !payload.fullName || typeof payload.exp !== 'number') {
      return null;
    }
    if (payload.exp <= Date.now()) {
      return null;
    }

    return {
      id: payload.id,
      fullName: payload.fullName,
      email: payload.email,
      memberNumber: payload.memberNumber,
    };
  } catch {
    return null;
  }
}

export function setMemberSessionCookie(
  response: NextResponse,
  member: MemberSessionPayload
): NextResponse {
  const token = createMemberToken(member);
  response.cookies.set(MEMBER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MEMBER_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export function clearMemberSessionCookie(response: NextResponse): NextResponse {
  response.cookies.delete(MEMBER_COOKIE_NAME);
  return response;
}

export function authenticateMemberRequest(req: NextRequest): MemberSessionPayload | null {
  const token = req.cookies.get(MEMBER_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyMemberToken(token);
}
