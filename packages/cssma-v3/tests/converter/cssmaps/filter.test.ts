import { describe, it, expect } from 'vitest';
import { blur, brightness, contrast, dropShadow, grayscale, hueRotate, invert, saturate, sepia } from '../../../src/converter/cssmaps/filter';
import { createContext } from '../../../src/config/context';

/**
 * Test suite for TailwindCSS v4.1 filter utilities.
 * Each filter utility is tested for:
 * - Standard classes
 * - Theme lookups (if applicable)
 * - Arbitrary values
 * - Custom property usage
 * - !important modifier
 * - Edge cases and error handling
 *
 * Reference: https://tailwindcss.com/docs/filter
 */

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

describe('filter utilities', () => {
  describe('blur', () => {
    it('parses standard blur classes', () => {
      expect(blur({ value: '' } as any, context)).toEqual({ filter: 'blur(8px)' });
      expect(blur({ value: 'xs' } as any, context)).toEqual({ filter: 'blur(2px)' });
      expect(blur({ value: 'sm' } as any, context)).toEqual({ filter: 'blur(4px)' });
      expect(blur({ value: 'md' } as any, context)).toEqual({ filter: 'blur(12px)' });
      expect(blur({ value: 'lg' } as any, context)).toEqual({ filter: 'blur(16px)' });
      expect(blur({ value: 'xl' } as any, context)).toEqual({ filter: 'blur(24px)' });
      expect(blur({ value: '2xl' } as any, context)).toEqual({ filter: 'blur(40px)' });
      expect(blur({ value: '3xl' } as any, context)).toEqual({ filter: 'blur(64px)' });
    });
    it('parses arbitrary values', () => {
      expect(blur({ value: '2.5px', arbitrary: true, arbitraryValue: '2.5px' } as any, context)).toEqual({ filter: 'blur(2.5px)' });
      expect(blur({ value: '0.1rem', arbitrary: true, arbitraryValue: '0.1rem' } as any, context)).toEqual({ filter: 'blur(0.1rem)' });
    });
    it('parses !important', () => {
      expect(blur({ value: '', important: true } as any, context)).toEqual({ filter: 'blur(8px) !important' });
    });
  });

  describe('brightness', () => {
    it('brightness: standard numeric values use %', () => {
      expect(brightness({ value: '50' } as any, context)).toEqual({ filter: 'brightness(50%)' });
      expect(brightness({ value: '100' } as any, context)).toEqual({ filter: 'brightness(100%)' });
      expect(brightness({ value: '125' } as any, context)).toEqual({ filter: 'brightness(125%)' });
      expect(brightness({ value: '200' } as any, context)).toEqual({ filter: 'brightness(200%)' });
    });
    it('brightness: arbitrary value', () => {
      expect(brightness({ value: '2.5', arbitrary: true, arbitraryValue: '2.5' } as any, context)).toEqual({ filter: 'brightness(2.5)' });
    });
    it('brightness: custom property', () => {
      expect(brightness({ value: '--my-brightness', customProperty: true } as any, context)).toEqual({ filter: 'brightness(var(--my-brightness))' });
    });
    it('parses !important', () => {
      expect(brightness({ value: '', important: true } as any, context)).toEqual({ filter: 'brightness(1) !important' });
    });
  });

  describe('contrast', () => {
    it('contrast: standard numeric values use %', () => {
      expect(contrast({ value: '50' } as any, context)).toEqual({ filter: 'contrast(50%)' });
      expect(contrast({ value: '100' } as any, context)).toEqual({ filter: 'contrast(100%)' });
      expect(contrast({ value: '125' } as any, context)).toEqual({ filter: 'contrast(125%)' });
      expect(contrast({ value: '200' } as any, context)).toEqual({ filter: 'contrast(200%)' });
    });
    it('contrast: arbitrary value', () => {
      expect(contrast({ value: '2.5', arbitrary: true, arbitraryValue: '2.5' } as any, context)).toEqual({ filter: 'contrast(2.5)' });
    });
    it('contrast: custom property', () => {
      expect(contrast({ value: '--my-contrast', customProperty: true } as any, context)).toEqual({ filter: 'contrast(var(--my-contrast))' });
    });
    it('parses !important', () => {
      expect(contrast({ value: '', important: true } as any, context)).toEqual({ filter: 'contrast(1) !important' });
    });
  });

  describe('dropShadow', () => {
    it('parses standard drop-shadow classes', () => {
      expect(dropShadow({ value: '' } as any, context)).toEqual({ filter: 'drop-shadow(var(--drop-shadow))' });
      expect(dropShadow({ value: 'sm' } as any, context)).toEqual({ filter: 'drop-shadow(var(--drop-shadow-sm))' });
      expect(dropShadow({ value: 'md' } as any, context)).toEqual({ filter: 'drop-shadow(var(--drop-shadow-md))' });
      expect(dropShadow({ value: 'lg' } as any, context)).toEqual({ filter: 'drop-shadow(var(--drop-shadow-lg))' });
      expect(dropShadow({ value: 'xl' } as any, context)).toEqual({ filter: 'drop-shadow(var(--drop-shadow-xl))' });
      expect(dropShadow({ value: '2xl' } as any, context)).toEqual({ filter: 'drop-shadow(var(--drop-shadow-2xl))' });
      expect(dropShadow({ value: 'none' } as any, context)).toEqual({ filter: '' });
    });
    it('parses !important', () => {
      expect(dropShadow({ value: 'lg', important: true } as any, context)).toEqual({ filter: 'drop-shadow(var(--drop-shadow-lg)) !important' });
    });
    it('parses custom property', () => {
      expect(dropShadow({ value: '--my-shadow', customProperty: true } as any, context)).toEqual({ filter: 'drop-shadow(var(--my-shadow))' });
    });
    it('parses arbitrary value', () => {
      expect(dropShadow({ arbitrary: true, arbitraryValue: '0 0 10px #f00' } as any, context)).toEqual({ filter: 'drop-shadow(0 0 10px #f00)' });
    });
    it('parses color keyword', () => {
      expect(dropShadow({ value: 'black' } as any, context)).toEqual({ '--tw-drop-shadow-color': 'var(--color-black)' });
      expect(dropShadow({ value: 'white' } as any, context)).toEqual({ '--tw-drop-shadow-color': 'var(--color-white)' });
      expect(dropShadow({ value: 'red-500' } as any, context)).toEqual({ '--tw-drop-shadow-color': 'var(--color-red-500)' });
    });
    it('parses color: custom property', () => {
      expect(dropShadow({ value: 'color:--my-shadow-color', customProperty: true } as any, context)).toEqual({ '--tw-drop-shadow-color': 'var(--my-shadow-color)' });
    });
    it('parses inherit/current/transparent', () => {
      expect(dropShadow({ value: 'inherit' } as any, context)).toEqual({ filter: 'drop-shadow(inherit)' });
      expect(dropShadow({ value: 'current' } as any, context)).toEqual({ filter: 'drop-shadow(current)' });
      expect(dropShadow({ value: 'transparent' } as any, context)).toEqual({ filter: 'drop-shadow(transparent)' });
    });
    it('uses context.theme for named dropShadow', () => {
      const token = { value: 'custom', important: false } as any;
      expect(dropShadow(token, context)).toEqual({ filter: 'drop-shadow(custom)' });
    });
    it('falls back to default if context.theme returns undefined', () => {
      const token = { value: 'notfound', important: false } as any;
      const ctx = { ...context, theme: () => undefined };
      expect(dropShadow(token, ctx)).toEqual({ filter: 'drop-shadow(notfound)' });
    });
  });

  describe('grayscale', () => {
    it('parses grayscale and grayscale-0', () => {
      expect(grayscale({ value: '' } as any, context)).toEqual({ filter: 'grayscale(1)' });
      expect(grayscale({ value: '0' } as any, context)).toEqual({ filter: 'grayscale(0)' });
    });
    it('parses !important', () => {
      expect(grayscale({ value: '', important: true } as any, context)).toEqual({ filter: 'grayscale(1) !important' });
    });
  });

  describe('hueRotate', () => {
    it('parses standard hue-rotate classes', () => {
      expect(hueRotate({ value: '0' } as any, context)).toEqual({ filter: 'hue-rotate(0deg)' });
      expect(hueRotate({ value: '15' } as any, context)).toEqual({ filter: 'hue-rotate(15deg)' });
      expect(hueRotate({ value: '30' } as any, context)).toEqual({ filter: 'hue-rotate(30deg)' });
      expect(hueRotate({ value: '60' } as any, context)).toEqual({ filter: 'hue-rotate(60deg)' });
      expect(hueRotate({ value: '90' } as any, context)).toEqual({ filter: 'hue-rotate(90deg)' });
      expect(hueRotate({ value: '180' } as any, context)).toEqual({ filter: 'hue-rotate(180deg)' });
    });
    it('parses arbitrary values', () => {
      expect(hueRotate({ value: '270', arbitrary: true, arbitraryValue: '270deg' } as any, context)).toEqual({ filter: 'hue-rotate(270deg)' });
    });
    it('parses !important', () => {
      expect(hueRotate({ value: '90', important: true } as any, context)).toEqual({ filter: 'hue-rotate(90deg) !important' });
    });
  });

  describe('invert', () => {
    it('parses invert and invert-0', () => {
      expect(invert({ value: '' } as any, context)).toEqual({ filter: 'invert(1)' });
      expect(invert({ value: '0' } as any, context)).toEqual({ filter: 'invert(0)' });
    });
    it('parses !important', () => {
      expect(invert({ value: '', important: true } as any, context)).toEqual({ filter: 'invert(1) !important' });
    });
  });

  describe('saturate', () => {
    it('parses standard numeric values use %', () => {
      expect(saturate({ value: '50' } as any, context)).toEqual({ filter: 'saturate(50%)' });
      expect(saturate({ value: '100' } as any, context)).toEqual({ filter: 'saturate(100%)' });
      expect(saturate({ value: '125' } as any, context)).toEqual({ filter: 'saturate(125%)' });
      expect(saturate({ value: '200' } as any, context)).toEqual({ filter: 'saturate(200%)' });
    });
    it('parses arbitrary value', () => {
      expect(saturate({ value: '1.75', arbitrary: true, arbitraryValue: '1.75' } as any, context)).toEqual({ filter: 'saturate(1.75)' });
    });
    it('parses custom property', () => {
      expect(saturate({ value: '--my-saturate', customProperty: true } as any, context)).toEqual({ filter: 'saturate(var(--my-saturate))' });
    });
    it('parses !important', () => {
      expect(saturate({ value: '100', important: true } as any, context)).toEqual({ filter: 'saturate(100%) !important' });
    });
  });

  describe('sepia', () => {
    it('parses sepia and sepia-0', () => {
      expect(sepia({ value: '' } as any, context)).toEqual({ filter: 'sepia(1)' });
      expect(sepia({ value: '0' } as any, context)).toEqual({ filter: 'sepia(0)' });
    });
    it('parses !important', () => {
      expect(sepia({ value: '', important: true } as any, context)).toEqual({ filter: 'sepia(1) !important' });
    });
  });

  describe('blur (with context)', () => {
    it('uses context.theme for named blur', () => {
      const token = { value: 'custom', important: false } as any;
      expect(blur(token, context)).toEqual({ filter: 'blur(99px)' });
    });
    it('falls back to default if context.theme returns undefined', () => {
      const token = { value: 'notfound', important: false } as any;
      expect(blur(token, context)).toEqual({ filter: 'blur(notfound)' });
    });
  });
  describe('dropShadow (with context)', () => {
    it('uses context.theme for named dropShadow', () => {
      const token = { value: 'custom', important: false } as any;
      expect(dropShadow(token, context)).toEqual({ filter: 'drop-shadow(var(--drop-shadow-custom))' });
    });
    it('falls back to default if context.theme returns undefined', () => {
      const token = { value: 'notfound', important: false } as any;
      const ctx = { ...context, theme: () => undefined };
      expect(dropShadow(token, ctx)).toEqual({ filter: 'drop-shadow(var(--drop-shadow))' });
    });
  });
}); 