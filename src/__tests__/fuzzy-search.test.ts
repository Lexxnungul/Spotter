import { describe, expect, it } from 'vitest';
import { fuzzyMatch, fuzzyScore, levenshteinDistance } from '../lib/fuzzy-search';

describe('fuzzy search utility', () => {
  it('computes Levenshtein distance', () => {
    expect(levenshteinDistance('fatima', 'fatma')).toBe(1);
    expect(levenshteinDistance('abc', 'abc')).toBe(0);
    expect(levenshteinDistance('', 'abc')).toBe(3);
  });

  it('scores exact and substring matches highest', () => {
    expect(fuzzyScore('fatima', 'Fatima Dangote')).toBeGreaterThan(0.9);
    expect(fuzzyScore('dangote', 'Fatima Dangote')).toBeGreaterThan(0.8);
  });

  it('tolerates typos in names', () => {
    expect(fuzzyMatch('fatma', ['Fatima Dangote'])).toBeGreaterThanOrEqual(0.5);
    expect(fuzzyMatch('dangot', ['Fatima Dangote'])).toBeGreaterThanOrEqual(0.5);
  });

  it('matches member numbers and phones on partial input', () => {
    expect(fuzzyMatch('2997', ['299770'])).toBeGreaterThan(0.8);
    expect(fuzzyMatch('234801', ['+2348012345678'])).toBeGreaterThan(0.8);
  });

  it('rejects unrelated queries', () => {
    expect(fuzzyMatch('zebra', ['Fatima Dangote', '299770'])).toBe(0);
  });

  it('returns the best score across multiple fields', () => {
    expect(
      fuzzyMatch('dangote', ['Kelechi Iheanacho', '299770', 'Fatima Dangote'])
    ).toBeGreaterThan(0.8);
  });
});
