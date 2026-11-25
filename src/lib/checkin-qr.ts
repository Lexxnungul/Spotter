const CHECK_IN_QR_PREFIX = 'SPOTTER_CHECKIN:';
const CHECK_IN_CODE_PATTERN = /^\d{6}$/;

function normalizeCheckInCode(value: string): string | null {
  const trimmed = value.trim();
  return CHECK_IN_CODE_PATTERN.test(trimmed) ? trimmed : null;
}

export function createCheckInQrPayload(code: string): string {
  return `${CHECK_IN_QR_PREFIX}${code}`;
}

export function parseCheckInQrPayload(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith(CHECK_IN_QR_PREFIX)) {
    return normalizeCheckInCode(trimmed.slice(CHECK_IN_QR_PREFIX.length));
  }

  const directCode = normalizeCheckInCode(trimmed);
  if (directCode) return directCode;

  try {
    const url = new URL(trimmed);
    const queryCode = url.searchParams.get('code');
    if (queryCode) return normalizeCheckInCode(queryCode);
  } catch {}

  return null;
}
