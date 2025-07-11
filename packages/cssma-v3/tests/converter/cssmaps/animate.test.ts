import { describe, it, expect } from 'vitest';
import { animate } from '../../../src/converter/cssmaps/animate';
import { createContext } from '../../../src/config/context';
import type { CssmaContext } from '../../../src/theme-types';

const ctx: CssmaContext = createContext({
  theme: {
    animation: {
      spin: 'spin 1s linear infinite',
      ping: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
      pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      bounce: 'bounce 1s infinite',
      custom: 'myanim 2s ease-in',
    },
    keyframes: {
        'fadein': {
            '0%': { opacity: '0' },
            '100%': { opacity: '1' },
        },
        'fadeout': {
            '0%': { opacity: '1' },
            '100%': { opacity: '0' },
        },
    }
  },
});

describe('animate utility', () => {
  it('handles standard classes', () => {
    expect(animate({ value: 'none', customProperty: false, arbitrary: false, important: false } as any, ctx)).toEqual({ animation: 'none' });
  });

  it('handles theme classes', () => {
    expect(animate({ value: 'spin', customProperty: false, arbitrary: false, important: false } as any, ctx)).toEqual({ animation: 'spin 1s linear infinite' });
    expect(animate({ value: 'ping', customProperty: false, arbitrary: false, important: false } as any, ctx)).toEqual({ animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite' });
    expect(animate({ value: 'pulse', customProperty: false, arbitrary: false, important: false } as any, ctx)).toEqual({ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' });
    expect(animate({ value: 'bounce', customProperty: false, arbitrary: false, important: false } as any, ctx)).toEqual({ animation: 'bounce 1s infinite' });
    expect(animate({ value: 'custom', customProperty: false, arbitrary: false, important: false } as any, ctx)).toEqual({ animation: 'myanim 2s ease-in' });
  });

  it('handles custom property', () => {
    expect(animate({ value: '--my-animation', customProperty: true, arbitrary: false, important: false } as any, ctx)).toEqual({ animation: 'var(--my-animation)' });
  });

  it('handles arbitrary value', () => {
    expect(animate({ value: '[foo_1s_linear_infinite]', customProperty: false, arbitrary: true, arbitraryValue: 'foo 1s linear infinite', important: false } as any, ctx)).toEqual({ animation: 'foo 1s linear infinite' });
    expect(animate({ value: '[fadein_2s_ease-in]', customProperty: false, arbitrary: true, arbitraryValue: 'fadein 2s ease-in', important: false } as any, ctx)).toEqual({ animation: 'fadein 2s ease-in' });
  });

  it('handles !important modifier', () => {
    expect(animate({ value: 'spin', customProperty: false, arbitrary: false, important: true } as any, ctx)).toEqual({ animation: 'spin 1s linear infinite !important' });
    expect(animate({ value: '[foo_1s_linear_infinite]', customProperty: false, arbitrary: true, arbitraryValue: 'foo 1s linear infinite', important: true } as any, ctx)).toEqual({ animation: 'foo 1s linear infinite !important' });
    expect(animate({ value: '--my-animation', customProperty: true, arbitrary: false, important: true } as any, ctx)).toEqual({ animation: 'var(--my-animation) !important' });
  });

  it('falls back to raw value if not found', () => {
    expect(animate({ value: 'unknown', customProperty: false, arbitrary: false, important: false } as any, ctx)).toEqual({ animation: 'unknown' });
  });

  it('returns undefined for empty value', () => {
    expect(animate({ value: '', customProperty: false, arbitrary: false, important: false } as any, ctx)).toBeUndefined();
  });
}); 