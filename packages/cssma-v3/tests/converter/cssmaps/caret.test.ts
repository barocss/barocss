import { CssmaContext } from './../../../src/theme-types';
import { describe, it, expect } from 'vitest';
import { caret } from '../../../src/converter/cssmaps/caret';
import { createContext } from '../../../src/config/context';

const ctx: CssmaContext = createContext({
    theme: {
        colors: {
            red: {
                500: '#ff0000',
            },
            gray: {
                900: '#000000',
            },
        },
    }
});


describe('caret utility', () => {
  it('handles standard classes', () => {
    expect(caret({ value: 'inherit' } as any, ctx)).toEqual({ caretColor: 'inherit' });
    expect(caret({ value: 'current' } as any, ctx)).toEqual({ caretColor: 'currentColor' });
    expect(caret({ value: 'transparent' } as any, ctx)).toEqual({ caretColor: 'transparent' });
  });

  it('handles !important', () => {
    expect(caret({ value: 'inherit', important: true } as any, ctx)).toEqual({ caretColor: 'inherit !important' });
    expect(caret({ value: 'current', important: true } as any, ctx)).toEqual({ caretColor: 'currentColor !important' });
  });

  it('handles custom properties', () => {
    expect(caret({ customProperty: true, value: '--my-caret' } as any, ctx)).toEqual({ caretColor: 'var(--my-caret)' });
    expect(caret({ customProperty: true, value: '--my-caret', important: true } as any, ctx)).toEqual({ caretColor: 'var(--my-caret) !important' });
  });

  it('handles arbitrary values', () => {
    expect(caret({ arbitrary: true, arbitraryValue: '#123456' } as any, ctx)).toEqual({ caretColor: '#123456' });
    expect(caret({ arbitrary: true, arbitraryValue: 'var(--caret)', important: true } as any, ctx)).toEqual({ caretColor: 'var(--caret) !important' });
  });

  it('handles theme color', () => {
    expect(caret({ value: 'red-500' } as any, ctx)).toEqual({ caretColor: '#ff0000' });
    expect(caret({ value: 'gray-900', important: true } as any, ctx)).toEqual({ caretColor: '#000000 !important' });
  });

  it('returns undefined for unknown values', () => {
    expect(caret({ value: '' } as any, ctx)).toBeUndefined();
    expect(caret({} as any, ctx)).toBeUndefined();
  });
}); 