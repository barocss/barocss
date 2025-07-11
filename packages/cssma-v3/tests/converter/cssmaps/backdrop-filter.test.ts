import { describe, it, expect } from 'vitest';
import {
  backdropBlur,
  backdropBrightness,
  backdropContrast,
  backdropDropShadow,
  backdropGrayscale,
  backdropHueRotate,
  backdropInvert,
  backdropSaturate,
  backdropSepia,
  backdropFilter,
} from '../../../src/converter/cssmaps/backdrop-filter';
import { createContext } from '../../../src/config/context';

const context = createContext({
  theme: {
    blur: {
      xs: '2px',
      sm: '4px',
      md: '12px',
      lg: '16px',
      xl: '24px',
      '2xl': '40px',
      '3xl': '64px',
      custom: '99px',
    },
    dropShadow: {
      sm: '0 1px 1px rgb(0 0 0 / 0.025)',
      md: '0 4px 3px rgb(0 0 0 / 0.07), 0 2px 2px rgb(0 0 0 / 0.06)',
      lg: '0 10px 8px rgb(0 0 0 / 0.04), 0 4px 3px rgb(0 0 0 / 0.1)',
      custom: '0 0 10px #f00',
    },
  },
});

});

describe('backdrop filter utilities', () => {
  describe('backdropBlur', () => {
    it('parses standard blur classes', () => {
      expect(backdropBlur({ value: '' } as any, context)).toEqual({ backdropFilter: 'blur(8px)' });
      expect(backdropBlur({ value: 'xs' } as any, context)).toEqual({ backdropFilter: 'blur(2px)' });
      expect(backdropBlur({ value: 'sm' } as any, context)).toEqual({ backdropFilter: 'blur(4px)' });
      expect(backdropBlur({ value: 'md' } as any, context)).toEqual({ backdropFilter: 'blur(12px)' });
      expect(backdropBlur({ value: 'lg' } as any, context)).toEqual({ backdropFilter: 'blur(16px)' });
      expect(backdropBlur({ value: 'xl' } as any, context)).toEqual({ backdropFilter: 'blur(24px)' });
      expect(backdropBlur({ value: '2xl' } as any, context)).toEqual({ backdropFilter: 'blur(40px)' });
      expect(backdropBlur({ value: '3xl' } as any, context)).toEqual({ backdropFilter: 'blur(64px)' });
    });
    it('parses arbitrary values', () => {
      expect(backdropBlur({ value: '2.5px', arbitrary: true, arbitraryValue: '2.5px' } as any, context)).toEqual({ backdropFilter: 'blur(2.5px)' });
      expect(backdropBlur({ value: '0.1rem', arbitrary: true, arbitraryValue: '0.1rem' } as any, context)).toEqual({ backdropFilter: 'blur(0.1rem)' });
    });
    it('parses !important', () => {
      expect(backdropBlur({ value: '', important: true } as any, context)).toEqual({ backdropFilter: 'blur(8px) !important' });
    });
    it('uses context.theme for named blur', () => {
      expect(backdropBlur({ value: 'custom' } as any, context)).toEqual({ backdropFilter: 'blur(99px)' });
    });
    it('falls back to default if context.theme returns undefined', () => {
      const token = { value: 'notfound', important: false } as any;
      const ctx = { ...context, theme: () => undefined };
      expect(backdropBlur(token, ctx)).toEqual({ backdropFilter: 'blur(notfound)' });
    });
  });

  describe('backdropBrightness', () => {
    it('standard numeric values use %', () => {
      expect(backdropBrightness({ value: '50' } as any, context)).toEqual({ backdropFilter: 'brightness(50%)' });
      expect(backdropBrightness({ value: '100' } as any, context)).toEqual({ backdropFilter: 'brightness(100%)' });
      expect(backdropBrightness({ value: '125' } as any, context)).toEqual({ backdropFilter: 'brightness(125%)' });
      expect(backdropBrightness({ value: '200' } as any, context)).toEqual({ backdropFilter: 'brightness(200%)' });
    });
    it('arbitrary value', () => {
      expect(backdropBrightness({ value: '2.5', arbitrary: true, arbitraryValue: '2.5' } as any, context)).toEqual({ backdropFilter: 'brightness(2.5)' });
    });
    it('custom property', () => {
      expect(backdropBrightness({ value: '--my-brightness', customProperty: true } as any, context)).toEqual({ backdropFilter: 'brightness(var(--my-brightness))' });
    });
    it('parses !important', () => {
      expect(backdropBrightness({ value: '', important: true } as any, context)).toEqual({ backdropFilter: 'brightness(1) !important' });
    });
  });

  describe('backdropContrast', () => {
    it('standard numeric values use %', () => {
      expect(backdropContrast({ value: '50' } as any, context)).toEqual({ backdropFilter: 'contrast(50%)' });
      expect(backdropContrast({ value: '100' } as any, context)).toEqual({ backdropFilter: 'contrast(100%)' });
      expect(backdropContrast({ value: '125' } as any, context)).toEqual({ backdropFilter: 'contrast(125%)' });
      expect(backdropContrast({ value: '200' } as any, context)).toEqual({ backdropFilter: 'contrast(200%)' });
    });
    it('arbitrary value', () => {
      expect(backdropContrast({ value: '2.5', arbitrary: true, arbitraryValue: '2.5' } as any, context)).toEqual({ backdropFilter: 'contrast(2.5)' });
    });
    it('custom property', () => {
      expect(backdropContrast({ value: '--my-contrast', customProperty: true } as any, context)).toEqual({ backdropFilter: 'contrast(var(--my-contrast))' });
    });
    it('parses !important', () => {
      expect(backdropContrast({ value: '', important: true } as any, context)).toEqual({ backdropFilter: 'contrast(1) !important' });
    });
  });

  describe('backdropDropShadow', () => {
    it('parses standard drop-shadow classes', () => {
      expect(backdropDropShadow({ value: '' } as any, context)).toEqual({ backdropFilter: 'drop-shadow(var(--backdrop-drop-shadow))' });
      expect(backdropDropShadow({ value: 'sm' } as any, context)).toEqual({ backdropFilter: 'drop-shadow(var(--backdrop-drop-shadow-sm))' });
      expect(backdropDropShadow({ value: 'md' } as any, context)).toEqual({ backdropFilter: 'drop-shadow(var(--backdrop-drop-shadow-md))' });
      expect(backdropDropShadow({ value: 'lg' } as any, context)).toEqual({ backdropFilter: 'drop-shadow(var(--backdrop-drop-shadow-lg))' });
      expect(backdropDropShadow({ value: 'none' } as any, context)).toEqual({ backdropFilter: '' });
    });
    it('parses !important', () => {
      expect(backdropDropShadow({ value: 'lg', important: true } as any, context)).toEqual({ backdropFilter: 'drop-shadow(var(--backdrop-drop-shadow-lg)) !important' });
    });
    it('parses custom property', () => {
      expect(backdropDropShadow({ value: '--my-shadow', customProperty: true } as any, context)).toEqual({ backdropFilter: 'drop-shadow(var(--my-shadow))' });
    });
    it('parses arbitrary value', () => {
      expect(backdropDropShadow({ arbitrary: true, arbitraryValue: '0 0 10px #f00' } as any, context)).toEqual({ backdropFilter: 'drop-shadow(0 0 10px #f00)' });
    });
    it('parses color: custom property', () => {
      expect(backdropDropShadow({ value: 'color:--my-shadow-color', customProperty: true } as any, context)).toEqual({ '--tw-backdrop-drop-shadow-color': 'var(--my-shadow-color)' });
    });
    it('uses context.theme for named dropShadow', () => {
      expect(backdropDropShadow({ value: 'custom' } as any, context)).toEqual({ backdropFilter: 'drop-shadow(custom)' });
    });
    it('falls back to default if context.theme returns undefined', () => {
      const token = { value: 'notfound', important: false } as any;
      const ctx = { ...context, theme: () => undefined };
      expect(backdropDropShadow(token, ctx)).toEqual({ backdropFilter: 'drop-shadow(notfound)' });
    });
  });

  describe('backdropGrayscale', () => {
    it('parses grayscale and grayscale-0', () => {
      expect(backdropGrayscale({ value: '' } as any, context)).toEqual({ backdropFilter: 'grayscale(1)' });
      expect(backdropGrayscale({ value: '0' } as any, context)).toEqual({ backdropFilter: 'grayscale(0)' });
    });
    it('parses !important', () => {
      expect(backdropGrayscale({ value: '', important: true } as any, context)).toEqual({ backdropFilter: 'grayscale(1) !important' });
    });
  });

  describe('backdropHueRotate', () => {
    it('parses standard hue-rotate classes', () => {
      expect(backdropHueRotate({ value: '0' } as any, context)).toEqual({ backdropFilter: 'hue-rotate(0deg)' });
      expect(backdropHueRotate({ value: '15' } as any, context)).toEqual({ backdropFilter: 'hue-rotate(15deg)' });
      expect(backdropHueRotate({ value: '30' } as any, context)).toEqual({ backdropFilter: 'hue-rotate(30deg)' });
      expect(backdropHueRotate({ value: '60' } as any, context)).toEqual({ backdropFilter: 'hue-rotate(60deg)' });
      expect(backdropHueRotate({ value: '90' } as any, context)).toEqual({ backdropFilter: 'hue-rotate(90deg)' });
      expect(backdropHueRotate({ value: '180' } as any, context)).toEqual({ backdropFilter: 'hue-rotate(180deg)' });
    });
    it('parses arbitrary values', () => {
      expect(backdropHueRotate({ value: '270', arbitrary: true, arbitraryValue: '270deg' } as any, context)).toEqual({ backdropFilter: 'hue-rotate(270deg)' });
    });
    it('parses !important', () => {
      expect(backdropHueRotate({ value: '90', important: true } as any, context)).toEqual({ backdropFilter: 'hue-rotate(90deg) !important' });
    });
  });

  describe('backdropInvert', () => {
    it('parses invert and invert-0', () => {
      expect(backdropInvert({ value: '' } as any, context)).toEqual({ backdropFilter: 'invert(1)' });
      expect(backdropInvert({ value: '0' } as any, context)).toEqual({ backdropFilter: 'invert(0)' });
    });
    it('parses !important', () => {
      expect(backdropInvert({ value: '', important: true } as any, context)).toEqual({ backdropFilter: 'invert(1) !important' });
    });
  });

  describe('backdropSaturate', () => {
    it('parses standard numeric values use %', () => {
      expect(backdropSaturate({ value: '50' } as any, context)).toEqual({ backdropFilter: 'saturate(50%)' });
      expect(backdropSaturate({ value: '100' } as any, context)).toEqual({ backdropFilter: 'saturate(100%)' });
      expect(backdropSaturate({ value: '125' } as any, context)).toEqual({ backdropFilter: 'saturate(125%)' });
      expect(backdropSaturate({ value: '200' } as any, context)).toEqual({ backdropFilter: 'saturate(200%)' });
    });
    it('parses arbitrary value', () => {
      expect(backdropSaturate({ value: '1.75', arbitrary: true, arbitraryValue: '1.75' } as any, context)).toEqual({ backdropFilter: 'saturate(1.75)' });
    });
    it('parses custom property', () => {
      expect(backdropSaturate({ value: '--my-saturate', customProperty: true } as any, context)).toEqual({ backdropFilter: 'saturate(var(--my-saturate))' });
    });
    it('parses !important', () => {
      expect(backdropSaturate({ value: '100', important: true } as any, context)).toEqual({ backdropFilter: 'saturate(100%) !important' });
    });
  });

  describe('backdropSepia', () => {
    it('parses sepia and sepia-0', () => {
      expect(backdropSepia({ value: '' } as any, context)).toEqual({ backdropFilter: 'sepia(1)' });
      expect(backdropSepia({ value: '0' } as any, context)).toEqual({ backdropFilter: 'sepia(0)' });
    });
    it('parses !important', () => {
      expect(backdropSepia({ value: '', important: true } as any, context)).toEqual({ backdropFilter: 'sepia(1) !important' });
    });
  });

  describe('backdropFilter', () => {
    it('parses none', () => {
      expect(backdropFilter({ value: 'none' } as any, context)).toEqual({ backdropFilter: 'none' });
    });
    it('parses custom property', () => {
      expect(backdropFilter({ value: '--my-backdrop', customProperty: true } as any, context)).toEqual({ backdropFilter: 'var(--my-backdrop)' });
    });
    it('parses arbitrary value', () => {
      expect(backdropFilter({ value: '[url(\'filters.svg#filter-id\')]', arbitrary: true, arbitraryValue: "url('filters.svg#filter-id')" } as any, context)).toEqual({ backdropFilter: "url('filters.svg#filter-id')" });
    });
    it('parses !important', () => {
      expect(backdropFilter({ value: 'none', important: true } as any, context)).toEqual({ backdropFilter: 'none !important' });
      expect(backdropFilter({ value: '--my-backdrop', customProperty: true, important: true } as any, context)).toEqual({ backdropFilter: 'var(--my-backdrop) !important' });
      expect(backdropFilter({ value: '[url(\'filters.svg#filter-id\')]', arbitrary: true, arbitraryValue: "url('filters.svg#filter-id')", important: true } as any, context)).toEqual({ backdropFilter: "url('filters.svg#filter-id') !important" });
    });
    it('fallback: returns value as-is', () => {
      expect(backdropFilter({ value: 'blur(4px)' } as any, context)).toEqual({ backdropFilter: 'blur(4px)' });
    });
  });
}); 