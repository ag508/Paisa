import { describe, it, expect } from 'vitest';
import { parseRupeesToPaise, formatPaise, sumPaise } from './money';

describe('money', () => {
  it('parses rupee strings into integer paise', () => {
    expect(parseRupeesToPaise('1234')).toBe(123400);
    expect(parseRupeesToPaise('1234.5')).toBe(123450);
    expect(parseRupeesToPaise('1234.56')).toBe(123456);
    expect(parseRupeesToPaise('0.01')).toBe(1);
    expect(parseRupeesToPaise('₹1,234.56')).toBe(123456);
  });

  it('rejects malformed input', () => {
    expect(() => parseRupeesToPaise('abc')).toThrow();
    expect(() => parseRupeesToPaise('1.234')).toThrow(); // 3 decimal places
    expect(() => parseRupeesToPaise('')).toThrow();
  });

  it('formats paise with two decimals and grouping', () => {
    expect(formatPaise(1)).toBe('0.01');
    expect(formatPaise(100)).toBe('1.00');
    expect(formatPaise(123456)).toMatch(/1,234\.56/);
    expect(formatPaise(-50)).toBe('-0.50');
  });

  it('sumPaise avoids float drift', () => {
    // 0.1 + 0.2 in floats != 0.3; in paise it is exact.
    expect(sumPaise([10, 20])).toBe(30);
  });
});
