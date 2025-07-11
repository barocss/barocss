import { describe, it, expect } from 'vitest';
import { colorScheme } from '../../../src/converter/cssmaps/color-scheme';

describe('color-scheme utility', () => {
  it('handles standard classes', () => {
    expect(colorScheme({ value: 'normal' } as any)).toEqual({ colorScheme: 'normal' });
    expect(colorScheme({ value: 'light' } as any)).toEqual({ colorScheme: 'light' });
    expect(colorScheme({ value: 'dark' } as any)).toEqual({ colorScheme: 'dark' });
    expect(colorScheme({ value: 'light-dark' } as any)).toEqual({ colorScheme: 'light dark' });
    expect(colorScheme({ value: 'only-light' } as any)).toEqual({ colorScheme: 'only light' });
    expect(colorScheme({ value: 'only-dark' } as any)).toEqual({ colorScheme: 'only dark' });
  });

  it('handles !important', () => {
    expect(colorScheme({ value: 'normal', important: true } as any)).toEqual({ colorScheme: 'normal !important' });
    expect(colorScheme({ value: 'dark', important: true } as any)).toEqual({ colorScheme: 'dark !important' });
    expect(colorScheme({ value: 'light-dark', important: true } as any)).toEqual({ colorScheme: 'light dark !important' });
    expect(colorScheme({ value: 'only-light', important: true } as any)).toEqual({ colorScheme: 'only light !important' });
    expect(colorScheme({ value: 'only-dark', important: true } as any)).toEqual({ colorScheme: 'only dark !important' });
  });

}); 