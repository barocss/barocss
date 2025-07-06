import { describe, it, expect } from 'vitest';
import { parseUtility } from '../../src/parser/parseUtility';
import { baseUtility } from './base';

describe('parseUtility (effects)', () => {
  describe('shadow', () => {
    it('should parse Tailwind v4 shadow classes', () => {
      expect(parseUtility('shadow')).toEqual(baseUtility({ prefix: 'shadow', raw: 'shadow' }));
      expect(parseUtility('shadow-md')).toEqual(baseUtility({ prefix: 'shadow', value: 'md', raw: 'shadow-md' }));
      expect(parseUtility('shadow-lg')).toEqual(baseUtility({ prefix: 'shadow', value: 'lg', raw: 'shadow-lg' }));
      expect(parseUtility('shadow-none')).toEqual(baseUtility({ prefix: 'shadow', value: 'none', raw: 'shadow-none' }));
      expect(parseUtility('shadow-[0_2px_8px_#0003]')).toEqual(baseUtility({ prefix: 'shadow', value: '0 2px 8px #0003', arbitrary: true, arbitraryValue: '0 2px 8px #0003', raw: 'shadow-[0_2px_8px_#0003]' }));
      expect(parseUtility('shadow-lg!')).toEqual(baseUtility({ prefix: 'shadow', value: 'lg', raw: 'shadow-lg!', important: true }));
      expect(parseUtility('shadow-')).toEqual({ type: 'unknown', raw: 'shadow-' });
    });
  });

  describe('opacity', () => {
    it('should parse Tailwind v4 opacity classes', () => {
      expect(parseUtility('opacity-0')).toEqual(baseUtility({ prefix: 'opacity', value: '0', numeric: true, raw: 'opacity-0' }));
      expect(parseUtility('opacity-50')).toEqual(baseUtility({ prefix: 'opacity', value: '50', numeric: true, raw: 'opacity-50' }));
      expect(parseUtility('opacity-100')).toEqual(baseUtility({ prefix: 'opacity', value: '100', numeric: true, raw: 'opacity-100' }));
      expect(parseUtility('opacity-[.25]')).toEqual(baseUtility({ prefix: 'opacity', value: '.25', raw: 'opacity-[.25]', arbitrary: true, arbitraryValue: '.25', numeric: false }));
      expect(parseUtility('opacity-')).toEqual({ type: 'unknown', raw: 'opacity-' });
    });
  });

  describe('mix-blend', () => {
    it('should parse Tailwind v4 mix-blend classes', () => {
      expect(parseUtility('mix-blend-normal')).toEqual(baseUtility({ prefix: 'mix-blend', value: 'normal', raw: 'mix-blend-normal' }));
      expect(parseUtility('mix-blend-multiply')).toEqual(baseUtility({ prefix: 'mix-blend', value: 'multiply', raw: 'mix-blend-multiply' }));
      expect(parseUtility('mix-blend-color')).toEqual(baseUtility({ prefix: 'mix-blend', value: 'color', raw: 'mix-blend-color' }));
      expect(parseUtility('mix-blend-luminosity')).toEqual(baseUtility({ prefix: 'mix-blend', value: 'luminosity', raw: 'mix-blend-luminosity' }));
      expect(parseUtility('mix-blend-')).toEqual({ type: 'unknown', raw: 'mix-blend-' });
    });
  });

  describe('backdrop-blur', () => {
    it('should parse Tailwind v4 backdrop-blur classes', () => {
      expect(parseUtility('backdrop-blur')).toEqual(baseUtility({ prefix: 'backdrop-blur', raw: 'backdrop-blur' }));
      expect(parseUtility('backdrop-blur-sm')).toEqual(baseUtility({ prefix: 'backdrop-blur', value: 'sm', raw: 'backdrop-blur-sm' }));
      expect(parseUtility('backdrop-blur-lg')).toEqual(baseUtility({ prefix: 'backdrop-blur', value: 'lg', raw: 'backdrop-blur-lg' }));
      expect(parseUtility('backdrop-blur-none')).toEqual(baseUtility({ prefix: 'backdrop-blur', value: 'none', raw: 'backdrop-blur-none' }));
      expect(parseUtility('backdrop-blur-[2px]')).toEqual(baseUtility({ prefix: 'backdrop-blur', value: '2px', arbitrary: true, arbitraryValue: '2px', raw: 'backdrop-blur-[2px]' }));
      expect(parseUtility('backdrop-blur-')).toEqual({ type: 'unknown', raw: 'backdrop-blur-' });
    });
  });

  describe('backdrop-brightness', () => {
    it('should parse Tailwind v4 backdrop-brightness classes', () => {
      expect(parseUtility('backdrop-brightness-50')).toEqual(baseUtility({ prefix: 'backdrop-brightness', value: '50', raw: 'backdrop-brightness-50', numeric: true }));
      expect(parseUtility('backdrop-brightness-200')).toEqual(baseUtility({ prefix: 'backdrop-brightness', value: '200', numeric: true, raw: 'backdrop-brightness-200' }));
      expect(parseUtility('backdrop-brightness-[.25]')).toEqual(baseUtility({ prefix: 'backdrop-brightness', value: '.25', raw: 'backdrop-brightness-[.25]', arbitrary: true, arbitraryValue: '.25', numeric: false }));
      expect(parseUtility('backdrop-brightness-')).toEqual({ type: 'unknown', raw: 'backdrop-brightness-' });
    });
  });

  describe('backdrop-contrast', () => {
    it('should parse Tailwind v4 backdrop-contrast classes', () => {
      expect(parseUtility('backdrop-contrast')).toEqual(baseUtility({ prefix: 'backdrop-contrast', value: '', raw: 'backdrop-contrast', arbitrary: false }));
      expect(parseUtility('backdrop-contrast-0')).toEqual(baseUtility({ prefix: 'backdrop-contrast', value: '0', raw: 'backdrop-contrast-0', arbitrary: false, numeric: true }));
      expect(parseUtility('backdrop-contrast-200')).toEqual(baseUtility({ prefix: 'backdrop-contrast', value: '200', raw: 'backdrop-contrast-200', arbitrary: false, numeric: true }));
      expect(parseUtility('backdrop-contrast-[.25]')).toEqual(baseUtility({ prefix: 'backdrop-contrast', value: '.25', raw: 'backdrop-contrast-[.25]', arbitrary: true, arbitraryValue: '.25', numeric: false }));
      expect(parseUtility('backdrop-contrast-')).toEqual({ type: 'unknown', raw: 'backdrop-contrast-' });
    });
  });

  describe('backdrop-grayscale', () => {
    it('should parse Tailwind v4 backdrop-grayscale classes', () => {
      expect(parseUtility('backdrop-grayscale')).toEqual(baseUtility({ prefix: 'backdrop-grayscale', raw: 'backdrop-grayscale' }));
      expect(parseUtility('backdrop-grayscale-0')).toEqual(baseUtility({ prefix: 'backdrop-grayscale', value: '0', numeric: true, raw: 'backdrop-grayscale-0' }));
      expect(parseUtility('backdrop-grayscale-')).toEqual({ type: 'unknown', raw: 'backdrop-grayscale-' });
    });
  });

  describe('backdrop-hue-rotate', () => {
    it('should parse Tailwind v4 backdrop-hue-rotate classes', () => {
      expect(parseUtility('backdrop-hue-rotate-15')).toEqual(baseUtility({ prefix: 'backdrop-hue-rotate', value: '15', numeric: true, raw: 'backdrop-hue-rotate-15' }));
      expect(parseUtility('backdrop-hue-rotate-180')).toEqual(baseUtility({ prefix: 'backdrop-hue-rotate', value: '180', numeric: true, raw: 'backdrop-hue-rotate-180' }));
      expect(parseUtility('backdrop-hue-rotate-[270deg]')).toEqual(baseUtility({ prefix: 'backdrop-hue-rotate', value: '270deg', arbitrary: true, arbitraryValue: '270deg', raw: 'backdrop-hue-rotate-[270deg]' }));
      expect(parseUtility('backdrop-hue-rotate-')).toEqual({ type: 'unknown', raw: 'backdrop-hue-rotate-' });
    });
  });

  describe('backdrop-invert', () => {
    it('should parse Tailwind v4 backdrop-invert classes', () => {
      expect(parseUtility('backdrop-invert')).toEqual(baseUtility({ prefix: 'backdrop-invert', value: '', raw: 'backdrop-invert', arbitrary: false }));
      expect(parseUtility('backdrop-invert-0')).toEqual(baseUtility({ prefix: 'backdrop-invert', value: '0', raw: 'backdrop-invert-0', arbitrary: false, numeric: true }));
      expect(parseUtility('backdrop-invert-')).toEqual({ type: 'unknown', raw: 'backdrop-invert-' });
    });
  });

  describe('backdrop-opacity', () => {
    it('should parse Tailwind v4 backdrop-opacity classes', () => {
      expect(parseUtility('backdrop-opacity')).toEqual(baseUtility({ prefix: 'backdrop-opacity', value: '', raw: 'backdrop-opacity', arbitrary: false }));
      expect(parseUtility('backdrop-opacity-0')).toEqual(baseUtility({ prefix: 'backdrop-opacity', value: '0', raw: 'backdrop-opacity-0', arbitrary: false, numeric: true }));
      expect(parseUtility('backdrop-opacity-100')).toEqual(baseUtility({ prefix: 'backdrop-opacity', value: '100', raw: 'backdrop-opacity-100', arbitrary: false, numeric: true }));
      expect(parseUtility('backdrop-opacity-[.25]')).toEqual(baseUtility({ prefix: 'backdrop-opacity', value: '.25', raw: 'backdrop-opacity-[.25]', arbitrary: true, arbitraryValue: '.25', numeric: false }));
      expect(parseUtility('backdrop-opacity-')).toEqual({ type: 'unknown', raw: 'backdrop-opacity-' });
    });
  });

  describe('backdrop-saturate', () => {
    it('should parse Tailwind v4 backdrop-saturate classes', () => {
      expect(parseUtility('backdrop-saturate')).toEqual(baseUtility({ prefix: 'backdrop-saturate', value: '', raw: 'backdrop-saturate', arbitrary: false }));
      expect(parseUtility('backdrop-saturate-0')).toEqual(baseUtility({ prefix: 'backdrop-saturate', value: '0', raw: 'backdrop-saturate-0', arbitrary: false, numeric: true }));
      expect(parseUtility('backdrop-saturate-200')).toEqual(baseUtility({ prefix: 'backdrop-saturate', value: '200', raw: 'backdrop-saturate-200', arbitrary: false, numeric: true }));
      expect(parseUtility('backdrop-saturate-[.25]')).toEqual(baseUtility({ prefix: 'backdrop-saturate', value: '.25', raw: 'backdrop-saturate-[.25]', arbitrary: true, arbitraryValue: '.25', numeric: false }));
      expect(parseUtility('backdrop-saturate-')).toEqual({ type: 'unknown', raw: 'backdrop-saturate-' });
    });
  });

  describe('backdrop-sepia', () => {
    it('should parse Tailwind v4 backdrop-sepia classes', () => {
      expect(parseUtility('backdrop-sepia')).toEqual(baseUtility({ prefix: 'backdrop-sepia', value: '', raw: 'backdrop-sepia', arbitrary: false }));
      expect(parseUtility('backdrop-sepia-0')).toEqual(baseUtility({ prefix: 'backdrop-sepia', value: '0', raw: 'backdrop-sepia-0', arbitrary: false, numeric: true }));
      expect(parseUtility('backdrop-sepia-')).toEqual({ type: 'unknown', raw: 'backdrop-sepia-' });
    });
  });

  describe('backdrop-filter', () => {
    it('should parse Tailwind v4 backdrop-filter classes', () => {
      expect(parseUtility('backdrop-filter')).toEqual(baseUtility({ prefix: 'backdrop', value: 'filter', raw: 'backdrop-filter' }));
      expect(parseUtility('backdrop-filter-none')).toEqual(baseUtility({ prefix: 'backdrop', value: 'filter-none', raw: 'backdrop-filter-none' }));
      expect(parseUtility('backdrop-filter-')).toEqual(baseUtility({ prefix: 'backdrop', value: 'filter-', raw: 'backdrop-filter-' }));
    });
  });
}); 