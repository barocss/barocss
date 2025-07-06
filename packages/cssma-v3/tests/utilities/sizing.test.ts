import { describe, it, expect } from 'vitest';
import { parseUtility } from '../../src/parser/parseUtility';
import { baseUtility } from './base';

describe('parseUtility (sizing)', () => {
  describe('width', () => {
    it('should parse Tailwind v4 width classes', () => {
      expect(parseUtility('w-0')).toEqual(baseUtility({ prefix: 'w', value: '0', numeric: true, raw: 'w-0' }));
      expect(parseUtility('w-px')).toEqual(baseUtility({ prefix: 'w', value: 'px', raw: 'w-px' }));
      expect(parseUtility('w-1')).toEqual(baseUtility({ prefix: 'w', value: '1', numeric: true, raw: 'w-1' }));
      expect(parseUtility('w-1/2')).toEqual(baseUtility({ prefix: 'w', value: '1', numeric: true, slash: '2', raw: 'w-1/2' }));
      expect(parseUtility('w-full')).toEqual(baseUtility({ prefix: 'w', value: 'full', raw: 'w-full' }));
      expect(parseUtility('w-screen')).toEqual(baseUtility({ prefix: 'w', value: 'screen', raw: 'w-screen' }));
      expect(parseUtility('w-min')).toEqual(baseUtility({ prefix: 'w', value: 'min', raw: 'w-min' }));
      expect(parseUtility('w-max')).toEqual(baseUtility({ prefix: 'w', value: 'max', raw: 'w-max' }));
      expect(parseUtility('w-fit')).toEqual(baseUtility({ prefix: 'w', value: 'fit', raw: 'w-fit' }));
      expect(parseUtility('w-[32px]')).toEqual(baseUtility({ prefix: 'w', value: '32px', arbitrary: true, arbitraryValue: '32px', raw: 'w-[32px]' }));
      expect(parseUtility('w-')).toEqual({ type: 'unknown', raw: 'w-' });
    });
  });

  describe('min-width', () => {
    it('should parse Tailwind v4 min-width classes', () => {
      expect(parseUtility('min-w-0')).toEqual(baseUtility({ prefix: 'min-w', value: '0', numeric: true, raw: 'min-w-0' }));
      expect(parseUtility('min-w-full')).toEqual(baseUtility({ prefix: 'min-w', value: 'full', raw: 'min-w-full' }));
      expect(parseUtility('min-w-min')).toEqual(baseUtility({ prefix: 'min-w', value: 'min', raw: 'min-w-min' }));
      expect(parseUtility('min-w-max')).toEqual(baseUtility({ prefix: 'min-w', value: 'max', raw: 'min-w-max' }));
      expect(parseUtility('min-w-fit')).toEqual(baseUtility({ prefix: 'min-w', value: 'fit', raw: 'min-w-fit' }));
      expect(parseUtility('min-w-[10rem]')).toEqual(baseUtility({ prefix: 'min-w', value: '10rem', arbitrary: true, arbitraryValue: '10rem', raw: 'min-w-[10rem]' }));
      expect(parseUtility('min-w-')).toEqual({ type: 'unknown', raw: 'min-w-' });
    });
  });

  describe('max-width', () => {
    it('should parse Tailwind v4 max-width classes', () => {
      expect(parseUtility('max-w-0')).toEqual(baseUtility({ prefix: 'max-w', value: '0', numeric: true, raw: 'max-w-0' }));
      expect(parseUtility('max-w-full')).toEqual(baseUtility({ prefix: 'max-w', value: 'full', raw: 'max-w-full' }));
      expect(parseUtility('max-w-min')).toEqual(baseUtility({ prefix: 'max-w', value: 'min', raw: 'max-w-min' }));
      expect(parseUtility('max-w-max')).toEqual(baseUtility({ prefix: 'max-w', value: 'max', raw: 'max-w-max' }));
      expect(parseUtility('max-w-fit')).toEqual(baseUtility({ prefix: 'max-w', value: 'fit', raw: 'max-w-fit' }));
      expect(parseUtility('max-w-[20rem]')).toEqual(baseUtility({ prefix: 'max-w', value: '20rem', arbitrary: true, arbitraryValue: '20rem', raw: 'max-w-[20rem]' }));
      expect(parseUtility('max-w-')).toEqual({ type: 'unknown', raw: 'max-w-' });
    });
  });

  describe('height', () => {
    it('should parse Tailwind v4 height classes', () => {
      expect(parseUtility('h-0')).toEqual(baseUtility({ prefix: 'h', value: '0', numeric: true, raw: 'h-0' }));
      expect(parseUtility('h-px')).toEqual(baseUtility({ prefix: 'h', value: 'px', raw: 'h-px' }));
      expect(parseUtility('h-1')).toEqual(baseUtility({ prefix: 'h', value: '1', numeric: true, raw: 'h-1' }));
      expect(parseUtility('h-1/2')).toEqual(baseUtility({ prefix: 'h', value: '1', numeric: true, slash: '2', raw: 'h-1/2' }));
      expect(parseUtility('h-full')).toEqual(baseUtility({ prefix: 'h', value: 'full', raw: 'h-full' }));
      expect(parseUtility('h-screen')).toEqual(baseUtility({ prefix: 'h', value: 'screen', raw: 'h-screen' }));
      expect(parseUtility('h-min')).toEqual(baseUtility({ prefix: 'h', value: 'min', raw: 'h-min' }));
      expect(parseUtility('h-max')).toEqual(baseUtility({ prefix: 'h', value: 'max', raw: 'h-max' }));
      expect(parseUtility('h-fit')).toEqual(baseUtility({ prefix: 'h', value: 'fit', raw: 'h-fit' }));
      expect(parseUtility('h-[32px]')).toEqual(baseUtility({ prefix: 'h', value: '32px', arbitrary: true, arbitraryValue: '32px', raw: 'h-[32px]' }));
      expect(parseUtility('h-')).toEqual({ type: 'unknown', raw: 'h-' });
    });
  });

  describe('min-height', () => {
    it('should parse Tailwind v4 min-height classes', () => {
      expect(parseUtility('min-h-0')).toEqual(baseUtility({ prefix: 'min-h', value: '0', numeric: true, raw: 'min-h-0' }));
      expect(parseUtility('min-h-full')).toEqual(baseUtility({ prefix: 'min-h', value: 'full', raw: 'min-h-full' }));
      expect(parseUtility('min-h-screen')).toEqual(baseUtility({ prefix: 'min-h', value: 'screen', raw: 'min-h-screen' }));
      expect(parseUtility('min-h-[10rem]')).toEqual(baseUtility({ prefix: 'min-h', value: '10rem', arbitrary: true, arbitraryValue: '10rem', raw: 'min-h-[10rem]' }));
      expect(parseUtility('min-h-')).toEqual({ type: 'unknown', raw: 'min-h-' });
    });
  });

  describe('max-height', () => {
    it('should parse Tailwind v4 max-height classes', () => {
      expect(parseUtility('max-h-0')).toEqual(baseUtility({ prefix: 'max-h', value: '0', numeric: true,   raw: 'max-h-0' }));
      expect(parseUtility('max-h-full')).toEqual(baseUtility({ prefix: 'max-h', value: 'full', raw: 'max-h-full' }));
      expect(parseUtility('max-h-screen')).toEqual(baseUtility({ prefix: 'max-h', value: 'screen', raw: 'max-h-screen' }));
      expect(parseUtility('max-h-[20rem]')).toEqual(baseUtility({ prefix: 'max-h', value: '20rem', arbitrary: true, arbitraryValue: '20rem', raw: 'max-h-[20rem]' }));
      expect(parseUtility('max-h-')).toEqual({ type: 'unknown', raw: 'max-h-' });
    });
  });

  describe('aspect-ratio', () => {
    it('should parse Tailwind v4 aspect-ratio classes', () => {
      expect(parseUtility('aspect-auto')).toEqual(baseUtility({ prefix: 'aspect', value: 'auto', raw: 'aspect-auto' }));
      expect(parseUtility('aspect-square')).toEqual(baseUtility({ prefix: 'aspect', value: 'square', raw: 'aspect-square' }));
      expect(parseUtility('aspect-video')).toEqual(baseUtility({ prefix: 'aspect', value: 'video', raw: 'aspect-video' }));
      expect(parseUtility('aspect-[4/3]')).toEqual(baseUtility({ prefix: 'aspect', value: '4/3', arbitrary: true, arbitraryValue: '4/3', raw: 'aspect-[4/3]' }));
      expect(parseUtility('aspect-')).toEqual({ type: 'unknown', raw: 'aspect-' });
    });
  });
}); 