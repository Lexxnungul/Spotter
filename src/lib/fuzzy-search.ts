export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const current: number[] = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const insertion = current[j - 1] + 1;
      const deletion = previous[j] + 1;
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(insertion, deletion, substitution);
    }
    previous = current;
  }

  return previous[b.length];
}

function isSubsequence(query: string, target: string): boolean {
  let index = 0;
  for (let i = 0; i < target.length && index < query.length; i += 1) {
    if (target[i] === query[index]) index += 1;
  }
  return index === query.length;
}

export function fuzzyScore(query: string, target: string): number {
  const q = normalizeText(query);
  const t = normalizeText(target);
  if (!q || !t) return 0;
  if (t === q) return 1;
  if (t.includes(q)) return 0.9 + 0.1 * (q.length / t.length);

  const tokens = t.split(/[^a-z0-9]+/).filter(Boolean);
  let best = 0;

  for (const token of tokens) {
    if (token.startsWith(q)) {
      best = Math.max(best, 0.85);
      continue;
    }
    const distance = levenshteinDistance(q, token);
    const similarity = 1 - distance / Math.max(q.length, token.length);
    if (similarity >= 0.6) {
      best = Math.max(best, 0.75 * similarity);
    }
  }

  if (best === 0 && isSubsequence(q, t)) {
    best = 0.5;
  }

  return best;
}

export interface FuzzyMatchOptions {
  threshold?: number;
}

export function fuzzyMatch(
  query: string,
  fields: Array<string | null | undefined>,
  options: FuzzyMatchOptions = {}
): number {
  const threshold = options.threshold ?? 0.5;
  let best = 0;

  for (const field of fields) {
    if (!field) continue;
    best = Math.max(best, fuzzyScore(query, field));
    if (best >= 1) break;
  }

  return best >= threshold ? best : 0;
}
