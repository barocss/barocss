import { describe, it, expect } from 'vitest';
import { select } from '../../../src/converter/cssmaps/select';

describe('user-select utility', () => {
  it('handles standard classes', () => {
    expect(select({ value: 'auto' } as any)).toEqual({ userSelect: 'auto' });
    expect(select({ value: 'text' } as any)).toEqual({ userSelect: 'text' });
    expect(select({ value: 'all' } as any)).toEqual({ userSelect: 'all' });
    expect(select({ value: 'none' } as any)).toEqual({ userSelect: 'none' });
  });

  it('handles !important', () => {
    expect(select({ value: 'auto', important: true } as any)).toEqual({ userSelect: 'auto !important' });
    expect(select({ value: 'none', important: true } as any)).toEqual({ userSelect: 'none !important' });
    expect(select({ value: 'text', important: true } as any)).toEqual({ userSelect: 'text !important' });
    expect(select({ value: 'all', important: true } as any)).toEqual({ userSelect: 'all !important' });
  });

  it('returns undefined for unknown values', () => {
    expect(select({ value: 'unknown' } as any)).toBeUndefined();
    expect(select({ value: '[arbitrary]' } as any)).toBeUndefined();
    expect(select({ value: '', important: true } as any)).toBeUndefined();
  });
}); 