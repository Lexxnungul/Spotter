import crypto from 'crypto';
import {
  VerifiedStaff,
  STAFF_AUTH_SECRET,
  STAFF_COOKIE_NAME,
  verifyStaffTokenEdge,
} from './staff-token-edge';

export type { VerifiedStaff };
export { STAFF_AUTH_SECRET, STAFF_COOKIE_NAME, verifyStaffTokenEdge };

/**
 * Synchronous cryptographically signed staff session token generator for Node.js API routes.
 */
export function createStaffToken(staff: VerifiedStaff): string {
  const payload = {
    id: staff.id,
    fullName: staff.fullName,
    email: staff.email,
    role: staff.role,
    whatsapp: staff.whatsapp,
    iat: Date.now(),
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', STAFF_AUTH_SECRET)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Synchronous constant-time token verification for Node.js API routes.
 */
export function verifyStaffToken(token: string): VerifiedStaff | null {
  try {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;

    const expectedSignature = crypto
      .createHmac('sha256', STAFF_AUTH_SECRET)
      .update(payloadB64)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload.id || !payload.role || !['STAFF', 'OWNER'].includes(payload.role)) {
      return null;
    }

    return {
      id: payload.id,
      fullName: payload.fullName,
      email: payload.email,
      role: payload.role,
      whatsapp: payload.whatsapp || '+234 803 000 0000',
    };
  } catch {
    return null;
  }
}
