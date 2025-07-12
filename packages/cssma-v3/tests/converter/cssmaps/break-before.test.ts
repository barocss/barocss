import { describe, it, expect } from 'vitest';
import { breakBefore } from '../../../src/converter/cssmaps/break-before';
import type { ParsedClassToken } from '../../../src/parser/utils';

describe('breakBefore (converter)', () => {
  const values = [
    'auto', 'avoid', 'all', 'avoid-page', 'page', 'left', 'right', 'column',
  ];
  for (const value of values) {
    it(`break-before-${value} → breakBefore: ${value}`, () => {
      const token = { prefix: 'break-before', value } as ParsedClassToken;
      expect(breakBefore(token)).toEqual({ breakBefore: value });
    });
    it(`break-before-${value}! → breakBefore: ${value} !important`, () => {
      const token = { prefix: 'break-before', value, important: true } as ParsedClassToken;
      expect(breakBefore(token)).toEqual({ breakBefore: `${value} !important` });
    });
  }
  it('break-before-[page-region] → breakBefore: page-region', () => {
    const token = { prefix: 'break-before', arbitrary: true, arbitraryValue: 'page-region' } as ParsedClassToken;
    expect(breakBefore(token)).toEqual({ breakBefore: 'page-region' });
  });
  it('break-before-(--my-break) → breakBefore: var(--my-break)', () => {
    const token = { prefix: 'break-before', value: '--my-break', customProperty: true } as ParsedClassToken;
    expect(breakBefore(token)).toEqual({ breakBefore: 'var(--my-break)' });
  });
  it('break-before-(--my-break)! → breakBefore: var(--my-break) !important', () => {
    const token = { prefix: 'break-before', value: '--my-break', customProperty: true, important: true } as ParsedClassToken;
    expect(breakBefore(token)).toEqual({ breakBefore: 'var(--my-break) !important' });
  });
  it('break-before-unknown → undefined', () => {
    const token = { prefix: 'break-before', value: 'unknown' } as ParsedClassToken;
    expect(breakBefore(token)).toBeUndefined();
  });
}); 