const LAGOS_DATE_KEY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Lagos',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const LAGOS_DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Lagos',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const LAGOS_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Lagos',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

export function getLagosDateKey(date: Date = new Date()): string {
  return LAGOS_DATE_KEY_FORMATTER.format(date);
}

export function getLagosDayStart(date: Date = new Date()): Date {
  return new Date(`${getLagosDateKey(date)}T00:00:00+01:00`);
}

export function formatLagosDateTime(date: Date): { date: string; time: string } {
  return {
    date: LAGOS_DATE_FORMATTER.format(date),
    time: LAGOS_TIME_FORMATTER.format(date),
  };
}
