import { describe, it, expect } from 'vitest';
import { parseUtility } from '../../src/parser/parseUtility';
import { baseUtility } from './base';

describe('parseUtility (font)', () => {
  describe('font family', () => {
    it('should parse Tailwind v4 font family classes', () => {
      expect(parseUtility('font-sans')).toEqual(baseUtility({ prefix: 'font', value: 'sans', raw: 'font-sans' }));
      expect(parseUtility('font-serif')).toEqual(baseUtility({ prefix: 'font', value: 'serif', raw: 'font-serif' }));
      expect(parseUtility('font-mono')).toEqual(baseUtility({ prefix: 'font', value: 'mono', raw: 'font-mono' }));
      expect(parseUtility('font-[Inter]')).toEqual(baseUtility({ prefix: 'font', value: 'Inter', arbitrary: true, arbitraryValue: 'Inter', raw: 'font-[Inter]' }));
      expect(parseUtility('font-')).toEqual({ type: 'unknown', raw: 'font-' });
    });
  });

  describe('font size', () => {
    it('should parse Tailwind v4 font size classes', () => {
      expect(parseUtility('text-xs')).toEqual(baseUtility({ prefix: 'text', value: 'xs', raw: 'text-xs' }));
      expect(parseUtility('text-sm')).toEqual(baseUtility({ prefix: 'text', value: 'sm', raw: 'text-sm' }));
      expect(parseUtility('text-base')).toEqual(baseUtility({ prefix: 'text', value: 'base', raw: 'text-base' }));
      expect(parseUtility('text-lg')).toEqual(baseUtility({ prefix: 'text', value: 'lg', raw: 'text-lg' }));
      expect(parseUtility('text-2xl')).toEqual(baseUtility({ prefix: 'text', value: '2xl', raw: 'text-2xl' }));
      expect(parseUtility('text-[32px]')).toEqual(baseUtility({ prefix: 'text', value: '32px', arbitrary: true, arbitraryValue: '32px', raw: 'text-[32px]' }));
      expect(parseUtility('text-')).toEqual({ type: 'unknown', raw: 'text-' });
    });
  });

  describe('font smoothing', () => {
    it('should parse Tailwind v4 font smoothing classes', () => {
      expect(parseUtility('antialiased')).toEqual(baseUtility({ prefix: 'antialiased', raw: 'antialiased' }));
      expect(parseUtility('subpixel-antialiased')).toEqual(baseUtility({ prefix: 'subpixel-antialiased', raw: 'subpixel-antialiased' }));
      expect(parseUtility('antialiased!')).toEqual(baseUtility({ prefix: 'antialiased', raw: 'antialiased!', important: true }));
      expect(parseUtility('antialiased-')).toEqual({ type: 'unknown', raw: 'antialiased-' });
    });
  });

  describe('font style', () => {
    it('should parse Tailwind v4 font style classes', () => {
      expect(parseUtility('italic')).toEqual(baseUtility({ prefix: 'italic', raw: 'italic' }));
      expect(parseUtility('not-italic')).toEqual(baseUtility({ prefix: 'not-italic', raw: 'not-italic' }));
      expect(parseUtility('italic!')).toEqual(baseUtility({ prefix: 'italic', raw: 'italic!', important: true }));
      expect(parseUtility('italic-')).toEqual({ type: 'unknown', raw: 'italic-' });
    });
  });

  describe('font weight', () => {
    it('should parse Tailwind v4 font weight classes', () => {
      expect(parseUtility('font-thin')).toEqual(baseUtility({ prefix: 'font', value: 'thin', raw: 'font-thin' }));
      expect(parseUtility('font-extralight')).toEqual(baseUtility({ prefix: 'font', value: 'extralight', raw: 'font-extralight' }));
      expect(parseUtility('font-light')).toEqual(baseUtility({ prefix: 'font', value: 'light', raw: 'font-light' }));
      expect(parseUtility('font-normal')).toEqual(baseUtility({ prefix: 'font', value: 'normal', raw: 'font-normal' }));
      expect(parseUtility('font-medium')).toEqual(baseUtility({ prefix: 'font', value: 'medium', raw: 'font-medium' }));
      expect(parseUtility('font-semibold')).toEqual(baseUtility({ prefix: 'font', value: 'semibold', raw: 'font-semibold' }));
      expect(parseUtility('font-bold')).toEqual(baseUtility({ prefix: 'font', value: 'bold', raw: 'font-bold' }));
      expect(parseUtility('font-extrabold')).toEqual(baseUtility({ prefix: 'font', value: 'extrabold', raw: 'font-extrabold' }));
      expect(parseUtility('font-black')).toEqual(baseUtility({ prefix: 'font', value: 'black', raw: 'font-black' }));
      expect(parseUtility('font-')).toEqual({ type: 'unknown', raw: 'font-' });
    });
  });

  describe('font variant numeric', () => {
    it('should parse Tailwind v4 font variant numeric classes', () => {
      expect(parseUtility('normal-nums')).toEqual(baseUtility({ prefix: 'normal-nums', raw: 'normal-nums' }));
      expect(parseUtility('ordinal')).toEqual(baseUtility({ prefix: 'ordinal', raw: 'ordinal' }));
      expect(parseUtility('slashed-zero')).toEqual(baseUtility({ prefix: 'slashed-zero', raw: 'slashed-zero' }));
      expect(parseUtility('lining-nums')).toEqual(baseUtility({ prefix: 'lining-nums', raw: 'lining-nums' }));
      expect(parseUtility('oldstyle-nums')).toEqual(baseUtility({ prefix: 'oldstyle-nums', raw: 'oldstyle-nums' }));
      expect(parseUtility('proportional-nums')).toEqual(baseUtility({ prefix: 'proportional-nums', raw: 'proportional-nums' }));
      expect(parseUtility('tabular-nums')).toEqual(baseUtility({ prefix: 'tabular-nums', raw: 'tabular-nums' }));
      expect(parseUtility('diagonal-fractions')).toEqual(baseUtility({ prefix: 'diagonal-fractions', raw: 'diagonal-fractions' }));
      expect(parseUtility('stacked-fractions')).toEqual(baseUtility({ prefix: 'stacked-fractions', raw: 'stacked-fractions' }));
      expect(parseUtility('ordinal!')).toEqual(baseUtility({ prefix: 'ordinal', raw: 'ordinal!', important: true }));
      expect(parseUtility('ordinal-')).toEqual({ type: 'unknown', raw: 'ordinal-' });
    });
  });

  describe('leading (line-height)', () => {
    it('should parse Tailwind v4 leading classes', () => {
      expect(parseUtility('leading-none')).toEqual(baseUtility({ prefix: 'leading', value: 'none', raw: 'leading-none' }));
      expect(parseUtility('leading-tight')).toEqual(baseUtility({ prefix: 'leading', value: 'tight', raw: 'leading-tight' }));
      expect(parseUtility('leading-snug')).toEqual(baseUtility({ prefix: 'leading', value: 'snug', raw: 'leading-snug' }));
      expect(parseUtility('leading-normal')).toEqual(baseUtility({ prefix: 'leading', value: 'normal', raw: 'leading-normal' }));
      expect(parseUtility('leading-relaxed')).toEqual(baseUtility({ prefix: 'leading', value: 'relaxed', raw: 'leading-relaxed' }));
      expect(parseUtility('leading-loose')).toEqual(baseUtility({ prefix: 'leading', value: 'loose', raw: 'leading-loose' }));
      expect(parseUtility('leading-[3]')).toEqual(baseUtility({ prefix: 'leading', value: '3', raw: 'leading-[3]', arbitrary: true, arbitraryValue: '3', numeric: true }));
      expect(parseUtility('leading-')).toEqual({ type: 'unknown', raw: 'leading-' });
    });
  });

  describe('tracking (letter-spacing)', () => {
    it('should parse Tailwind v4 tracking classes', () => {
      expect(parseUtility('tracking-tighter')).toEqual(baseUtility({ prefix: 'tracking', value: 'tighter', raw: 'tracking-tighter' }));
      expect(parseUtility('tracking-tight')).toEqual(baseUtility({ prefix: 'tracking', value: 'tight', raw: 'tracking-tight' }));
      expect(parseUtility('tracking-normal')).toEqual(baseUtility({ prefix: 'tracking', value: 'normal', raw: 'tracking-normal' }));
      expect(parseUtility('tracking-wide')).toEqual(baseUtility({ prefix: 'tracking', value: 'wide', raw: 'tracking-wide' }));
      expect(parseUtility('tracking-wider')).toEqual(baseUtility({ prefix: 'tracking', value: 'wider', raw: 'tracking-wider' }));
      expect(parseUtility('tracking-widest')).toEqual(baseUtility({ prefix: 'tracking', value: 'widest', raw: 'tracking-widest' }));
      expect(parseUtility('tracking-[.25em]')).toEqual(baseUtility({ prefix: 'tracking', value: '.25em', arbitrary: true, arbitraryValue: '.25em', raw: 'tracking-[.25em]' }));
      expect(parseUtility('tracking-')).toEqual({ type: 'unknown', raw: 'tracking-' });
    });
  });
}); 