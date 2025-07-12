import { describe, it, expect } from 'vitest';
import { breakInside } from '../../../src/converter/cssmaps/break-inside';
import type { ParsedClassToken } from '../../../src/parser/utils';

describe('breakInside (converter)', () => {
  const values = [
    'auto', 'avoid', 'avoid-page', 'avoid-column',
  ];
  for (const value of values) {
    it(`break-inside-${value} → breakInside: ${value}`, () => {
      const token = { prefix: 'break-inside', value } as ParsedClassToken;
      expect(breakInside(token)).toEqual({ breakInside: value });
    });
    it(`break-inside-${value}! → breakInside: ${value} !important`, () => {
      const token = { prefix: 'break-inside', value, important: true } as ParsedClassToken;
      expect(breakInside(token)).toEqual({ breakInside: `${value} !important` });
    });
  }

  it('break-inside-[page-region] → breakInside: page-region', () => {
    const token = { prefix: 'break-inside', arbitrary: true, arbitraryValue: 'page-region' } as ParsedClassToken;
    expect(breakInside(token)).toEqual({ breakInside: 'page-region' });
  });
  it('break-inside-(--my-break) → breakInside: var(--my-break)', () => {
    const token = { prefix: 'break-inside', customProperty: true, value: '--my-break' } as ParsedClassToken;
    expect(breakInside(token)).toEqual({ breakInside: 'var(--my-break)' });
  });
  it('break-inside-(--my-break)! → breakInside: var(--my-break) !important', () => {
    const token = { prefix: 'break-inside', customProperty: true, value: '--my-break', important: true } as ParsedClassToken;
    expect(breakInside(token)).toEqual({ breakInside: 'var(--my-break) !important' });
  });
  it('break-inside-[page-region]! → breakInside: page-region !important', () => {
    const token = { prefix: 'break-inside', arbitrary: true, arbitraryValue: 'page-region', important: true } as ParsedClassToken;
    expect(breakInside(token)).toEqual({ breakInside: 'page-region !important' });
  });
  it('break-inside-unknown → undefined', () => {
    const token = { prefix: 'break-inside', value: 'unknown' } as ParsedClassToken;
    expect(breakInside(token)).toBeUndefined();
  });
}); 