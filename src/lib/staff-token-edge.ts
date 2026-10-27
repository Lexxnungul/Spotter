export interface VerifiedStaff {
  id: string;
  fullName: string;
  email: string;
  role: 'STAFF' | 'OWNER';
  whatsapp: string;
}

export const STAFF_AUTH_SECRET =
  process.env.STAFF_SESSION_SECRET ||
  process.env.SESSION_SECRET ||
  'spotter_staff_secure_session_secret_2026';

export const STAFF_COOKIE_NAME = 'spotter_staff_token';

function base64UrlDecode(base64url: string): string {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64);
}

/**
 * Edge-compatible Web Crypto verification for Next.js Middleware.
 * Standard Web Crypto API; 100% Edge-safe with zero Node.js modules.
 */
export async function verifyStaffTokenEdge(token: string): Promise<VerifiedStaff | null> {
  try {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(STAFF_AUTH_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const binary = base64UrlDecode(signature);
    const sigBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      sigBytes[i] = binary.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      enc.encode(payloadB64)
    );

    if (!isValid) return null;

    const payloadJson = base64UrlDecode(payloadB64);
    const payload = JSON.parse(payloadJson);
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
