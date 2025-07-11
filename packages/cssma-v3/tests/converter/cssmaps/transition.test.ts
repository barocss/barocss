import { describe, it, expect } from 'vitest';
import { transition, duration, delay, ease } from '../../../src/converter/cssmaps/transition';
import { createContext } from '../../../src/config/context';
import type { CssmaContext } from '../../../src/theme-types';

const ctx: CssmaContext = createContext({
  theme: {
    transitionDuration: {
      75: '75ms',
      150: '150ms',
      300: '300ms',
    },
    transitionDelay: {
      75: '75ms',
      150: '150ms',
      300: '300ms',
    },
    ease: {
      linear: 'linear',
      in: 'cubic-bezier(0.4, 0, 1, 1)',
      out: 'cubic-bezier(0, 0, 0.2, 1)',
      'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  }
});

describe('transition utility', () => {
  it('handles standard classes', () => {
    expect(transition({} as any, ctx)).toEqual({ transitionProperty: 'color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter' });
    expect(transition({ value: 'none' } as any, ctx)).toEqual({ transitionProperty: 'none' });
    expect(transition({ value: 'all' } as any, ctx)).toEqual({ transitionProperty: 'all' });
    expect(transition({ value: 'colors' } as any, ctx)).toEqual({ transitionProperty: 'color, background-color, border-color, text-decoration-color, fill, stroke' });
    expect(transition({ value: 'opacity' } as any, ctx)).toEqual({ transitionProperty: 'opacity' });
    expect(transition({ value: 'shadow' } as any, ctx)).toEqual({ transitionProperty: 'box-shadow' });
    expect(transition({ value: 'transform' } as any, ctx)).toEqual({ transitionProperty: 'transform' });
  });

  it('handles !important', () => {
    expect(transition({ value: 'all', important: true } as any, ctx)).toEqual({ transitionProperty: 'all !important' });
    expect(transition({ important: true } as any, ctx)).toEqual({ transitionProperty: 'color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter !important' });
  });

  it('handles custom properties', () => {
    expect(transition({ customProperty: true, value: '--my-transition' } as any, ctx)).toEqual({ transitionProperty: 'var(--my-transition)' });
    expect(transition({ customProperty: true, value: '--my-transition', important: true } as any, ctx)).toEqual({ transitionProperty: 'var(--my-transition) !important' });
  });

  it('handles arbitrary values', () => {
    expect(transition({ arbitrary: true, arbitraryValue: 'height' } as any, ctx)).toEqual({ transitionProperty: 'height' });
    expect(transition({ arbitrary: true, arbitraryValue: 'width', important: true } as any, ctx)).toEqual({ transitionProperty: 'width !important' });
  });

  it('returns undefined for unknown values', () => {
    expect(transition({ value: 'not-a-transition' } as any, ctx)).toBeUndefined();
  });
});

describe('duration utility', () => {
  it('handles theme values', () => {
    expect(duration({ value: '75' } as any, ctx)).toEqual({ transitionDuration: '75ms' });
    expect(duration({ value: '150' } as any, ctx)).toEqual({ transitionDuration: '150ms' });
    expect(duration({ value: '300' } as any, ctx)).toEqual({ transitionDuration: '300ms' });
  });
  it('handles arbitrary values', () => {
    expect(duration({ arbitrary: true, arbitraryValue: '500ms' } as any, ctx)).toEqual({ transitionDuration: '500ms' });
    expect(duration({ arbitrary: true, arbitraryValue: '1s', important: true } as any, ctx)).toEqual({ transitionDuration: '1s !important' });
  });
  it('handles numeric fallback', () => {
    expect(duration({ value: '123' } as any, ctx)).toEqual({ transitionDuration: '123ms' });
  });
  it('handles !important', () => {
    expect(duration({ value: '75', important: true } as any, ctx)).toEqual({ transitionDuration: '75ms !important' });
  });
  it('returns undefined for missing value', () => {
    expect(duration({} as any, ctx)).toBeUndefined();
  });
});

describe('delay utility', () => {
  it('handles theme values', () => {
    expect(delay({ value: '75' } as any, ctx)).toEqual({ transitionDelay: '75ms' });
    expect(delay({ value: '150' } as any, ctx)).toEqual({ transitionDelay: '150ms' });
    expect(delay({ value: '300' } as any, ctx)).toEqual({ transitionDelay: '300ms' });
  });
  it('handles arbitrary values', () => {
    expect(delay({ arbitrary: true, arbitraryValue: '500ms' } as any, ctx)).toEqual({ transitionDelay: '500ms' });
    expect(delay({ arbitrary: true, arbitraryValue: '1s', important: true } as any, ctx)).toEqual({ transitionDelay: '1s !important' });
  });
  it('handles numeric fallback', () => {
    expect(delay({ value: '123' } as any, ctx)).toEqual({ transitionDelay: '123ms' });
  });
  it('handles !important', () => {
    expect(delay({ value: '75', important: true } as any, ctx)).toEqual({ transitionDelay: '75ms !important' });
  });
  it('returns undefined for missing value', () => {
    expect(delay({} as any, ctx)).toBeUndefined();
  });
});

describe('ease utility', () => {
  it('handles theme values', () => {
    expect(ease({ value: 'linear' } as any, ctx)).toEqual({ transitionTimingFunction: 'linear' });
    expect(ease({ value: 'in' } as any, ctx)).toEqual({ transitionTimingFunction: 'cubic-bezier(0.4, 0, 1, 1)' });
    expect(ease({ value: 'out' } as any, ctx)).toEqual({ transitionTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)' });
    expect(ease({ value: 'in-out' } as any, ctx)).toEqual({ transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' });
  });
  it('handles arbitrary values', () => {
    expect(ease({ arbitrary: true, arbitraryValue: 'steps(4)' } as any, ctx)).toEqual({ transitionTimingFunction: 'steps(4)' });
    expect(ease({ arbitrary: true, arbitraryValue: 'cubic-bezier(0.1,0.7,1,0.1)', important: true } as any, ctx)).toEqual({ transitionTimingFunction: 'cubic-bezier(0.1,0.7,1,0.1) !important' });
  });
  it('handles !important', () => {
    expect(ease({ value: 'linear', important: true } as any, ctx)).toEqual({ transitionTimingFunction: 'linear !important' });
  });
  it('returns undefined for missing value', () => {
    expect(ease({} as any, ctx)).toBeUndefined();
  });
}); 