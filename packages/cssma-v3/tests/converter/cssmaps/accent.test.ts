import { describe, it, expect } from 'vitest';
import { accent } from '../../../src/converter/cssmaps/accent';
import { createContext } from '../../../src/config/context';
import type { CssmaContext } from '../../../src/theme-types';

const ctx: CssmaContext = createContext({
  theme: {
    colors: {
      red: {
        500: '#ff0000',
      },
      gray: {
        900: '#111111',
      },
      regal: {
        blue: '#243c5a',
      },
      black: '#000',
      white: '#fff',
    },
  }
});

describe('accent utility', () => {
  it('handles standard classes', () => {
    expect(accent({ value: 'inherit' } as any, ctx)).toEqual({ accentColor: 'inherit' });
    expect(accent({ value: 'current' } as any, ctx)).toEqual({ accentColor: 'currentColor' });
    expect(accent({ value: 'transparent' } as any, ctx)).toEqual({ accentColor: 'transparent' });
  });

  it('handles !important', () => {
    expect(accent({ value: 'inherit', important: true } as any, ctx)).toEqual({ accentColor: 'inherit !important' });
    expect(accent({ value: 'current', important: true } as any, ctx)).toEqual({ accentColor: 'currentColor !important' });
  });

  it('handles custom properties', () => {
    expect(accent({ customProperty: true, value: '--my-accent' } as any, ctx)).toEqual({ accentColor: 'var(--my-accent)' });
    expect(accent({ customProperty: true, value: '--my-accent', important: true } as any, ctx)).toEqual({ accentColor: 'var(--my-accent) !important' });
  });

  it('handles arbitrary values', () => {
    expect(accent({ arbitrary: true, arbitraryValue: '#123456' } as any, ctx)).toEqual({ accentColor: '#123456' });
    expect(accent({ arbitrary: true, arbitraryValue: 'var(--accent)', important: true } as any, ctx)).toEqual({ accentColor: 'var(--accent) !important' });
    expect(accent({ arbitrary: true, arbitraryValue: 'oklch(70% 0.2 200)', important: true } as any, ctx)).toEqual({ accentColor: 'oklch(70% 0.2 200) !important' });
  });

  it('handles theme color', () => {
    expect(accent({ value: 'red-500' } as any, ctx)).toEqual({ accentColor: '#ff0000' });
    expect(accent({ value: 'gray-900', important: true } as any, ctx)).toEqual({ accentColor: '#111111 !important' });
    expect(accent({ value: 'regal-blue' } as any, ctx)).toEqual({ accentColor: '#243c5a' });
    expect(accent({ value: 'black' } as any, ctx)).toEqual({ accentColor: '#000' });
    expect(accent({ value: 'white' } as any, ctx)).toEqual({ accentColor: '#fff' });
  });
}); 