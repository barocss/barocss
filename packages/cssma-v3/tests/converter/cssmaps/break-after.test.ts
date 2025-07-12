import { describe, it, expect } from 'vitest';
import { breakAfter } from '../../../src/converter/cssmaps/break-after';
import type { ParsedClassToken } from '../../../src/parser/utils';

describe('breakAfter (converter)', () => {
  const values = [
    'auto', 'avoid', 'all', 'avoid-page', 'page', 'left', 'right', 'column',
  ];
  for (const value of values) {
    it(`break-after-${value} → breakAfter: ${value}`, () => {
      const token = { prefix: 'break-after', value } as ParsedClassToken;
      expect(breakAfter(token)).toEqual({ breakAfter: value });
    });
    it(`break-after-${value}! → breakAfter: ${value} !important`, () => {
      const token = { prefix: 'break-after', value, important: true } as ParsedClassToken;
      expect(breakAfter(token)).toEqual({ breakAfter: `${value} !important` });
    });
  }
  it('break-after-[page-region] → breakAfter: page-region', () => {
    const token = { prefix: 'break-after', arbitrary: true, arbitraryValue: 'page-region' } as ParsedClassToken;
    expect(breakAfter(token)).toEqual({ breakAfter: 'page-region' });
  });
  it('break-after-(--my-break) → breakAfter: var(--my-break)', () => {
    const token = { prefix: 'break-after', value: '--my-break', customProperty: true } as ParsedClassToken;
    expect(breakAfter(token)).toEqual({ breakAfter: 'var(--my-break)' });
  });
  it('break-after-(--my-break)! → breakAfter: var(--my-break) !important', () => {
    const token = { prefix: 'break-after', value: '--my-break', customProperty: true, important: true } as ParsedClassToken;
    expect(breakAfter(token)).toEqual({ breakAfter: 'var(--my-break) !important' });
  });
  it('break-after-unknown → undefined', () => {
    const token = { prefix: 'break-after', value: 'unknown' } as ParsedClassToken;
    expect(breakAfter(token)).toBeUndefined();
  });
}); 