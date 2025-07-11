import { describe, it, expect } from 'vitest';
import { borderCollapse } from '../../../src/converter/cssmaps/border';
import { createContext } from '../../../src/config/context';
import type { CssmaContext } from '../../../src/theme-types';

const ctx: CssmaContext = createContext({});

describe('borderCollapse utility', () => {
  it('handles standard classes', () => {
    expect(borderCollapse({ value: 'collapse', important: false } as any, ctx)).toEqual({ borderCollapse: 'collapse' });
    expect(borderCollapse({ value: 'separate', important: false } as any, ctx)).toEqual({ borderCollapse: 'separate' });
  });

  it('handles !important modifier', () => {
    expect(borderCollapse({ value: 'collapse', important: true } as any, ctx)).toEqual({ borderCollapse: 'collapse !important' });
    expect(borderCollapse({ value: 'separate', important: true } as any, ctx)).toEqual({ borderCollapse: 'separate !important' });
  });

  it('handles custom property', () => {
    expect(borderCollapse({ value: '--foo', customProperty: true, important: false } as any, ctx)).toEqual({ borderCollapse: '--foo' });
    expect(borderCollapse({ value: '--foo', customProperty: true, important: true } as any, ctx)).toEqual({ borderCollapse: '--foo !important' });
  });

  it('handles arbitrary value', () => {
    expect(borderCollapse({ value: '[inherit]', arbitrary: true, arbitraryValue: 'inherit', important: false } as any, ctx)).toEqual({ borderCollapse: 'inherit' });
    expect(borderCollapse({ value: '[initial]', arbitrary: true, arbitraryValue: 'initial', important: true } as any, ctx)).toEqual({ borderCollapse: 'initial !important' });
  });

  it('falls back to raw value if not found', () => {
    expect(borderCollapse({ value: 'unknown', important: false } as any, ctx)).toEqual({ borderCollapse: 'unknown' });
  });

  it('returns undefined for empty value', () => {
    expect(borderCollapse({ value: '', important: false } as any, ctx)).toBeUndefined();
  });
}); 