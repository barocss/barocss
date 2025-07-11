import { describe, it, expect } from 'vitest';
import { willChange } from '../../../src/converter/cssmaps/willChange';

describe('will-change utility', () => {
  it('handles standard classes', () => {
    expect(willChange({ value: 'auto' } as any)).toEqual({ willChange: 'auto' });
    expect(willChange({ value: 'scroll' } as any)).toEqual({ willChange: 'scroll' });
    expect(willChange({ value: 'contents' } as any)).toEqual({ willChange: 'contents' });
    expect(willChange({ value: 'transform' } as any)).toEqual({ willChange: 'transform' });
  });

  it('handles !important', () => {
    expect(willChange({ value: 'auto', important: true } as any)).toEqual({ willChange: 'auto !important' });
    expect(willChange({ value: 'transform', important: true } as any)).toEqual({ willChange: 'transform !important' });
  });

  it('handles custom properties', () => {
    expect(willChange({ customProperty: true, value: '--opacity' } as any)).toEqual({ willChange: 'var(--opacity)' });
    expect(willChange({ customProperty: true, value: '--left-top' } as any)).toEqual({ willChange: 'var(--left-top)' });
    expect(willChange({ customProperty: true, value: '--opacity', important: true } as any)).toEqual({ willChange: 'var(--opacity) !important' });
  });

  it('handles arbitrary values', () => {
    expect(willChange({ value: 'opacity', arbitrary: true, arbitraryValue: 'opacity' } as any)).toEqual({ willChange: 'opacity' });
    expect(willChange({ value: 'left, top', arbitrary: true, arbitraryValue: 'left, top' } as any)).toEqual({ willChange: 'left, top' });
    expect(willChange({ value: 'opacity', arbitrary: true, arbitraryValue: 'opacity', important: true } as any)).toEqual({ willChange: 'opacity !important' });
  });

  it('returns undefined for unknown values', () => {
    expect(willChange({ value: 'unknown' } as any)).toBeUndefined();
  });
}); 