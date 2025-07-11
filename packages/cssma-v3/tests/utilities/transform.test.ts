import { describe, it, expect } from 'vitest';
import { parseUtility } from '../../src/parser/parseUtility';
import { baseUtility } from './base';

describe('parseUtility (transform)', () => {
  describe('transform', () => {
    it('should parse Tailwind v4 transform classes', () => {
      expect(parseUtility('transform')).toEqual(baseUtility({ prefix: 'transform', raw: 'transform' }));
      expect(parseUtility('transform-gpu')).toEqual(baseUtility({ prefix: 'transform', value: 'gpu', raw: 'transform-gpu' }));
      expect(parseUtility('transform-none')).toEqual(baseUtility({ prefix: 'transform', value: 'none', raw: 'transform-none' }));
      expect(parseUtility('transform!')).toEqual(baseUtility({ prefix: 'transform', value: '', important: true, raw: 'transform!' }));
      expect(parseUtility('transform-')).toEqual({ type: 'unknown', raw: 'transform-' });
    });
  });

  describe('scale', () => {
    it('should parse Tailwind v4 scale classes', () => {
      expect(parseUtility('scale-0')).toEqual(baseUtility({ prefix: 'scale', value: '0', numeric: true, raw: 'scale-0' }));
      expect(parseUtility('scale-50')).toEqual(baseUtility({ prefix: 'scale', value: '50', numeric: true, raw: 'scale-50' }));
      expect(parseUtility('scale-100')).toEqual(baseUtility({ prefix: 'scale', value: '100', numeric: true, raw: 'scale-100' }));
      expect(parseUtility('scale-x-75')).toEqual(baseUtility({ prefix: 'scale-x', value: '75', numeric: true, raw: 'scale-x-75' }));
      expect(parseUtility('scale-y-125')).toEqual(baseUtility({ prefix: 'scale-y', value: '125', numeric: true, raw: 'scale-y-125' }));
      expect(parseUtility('scale-[1.2]')).toEqual(baseUtility({ prefix: 'scale', value: '1.2', numeric: true, arbitrary: true, arbitraryValue: '1.2', raw: 'scale-[1.2]' }));
      expect(parseUtility('scale-')).toEqual({ type: 'unknown', raw: 'scale-' });
    });
  });

  describe('rotate', () => {
    it('should parse Tailwind v4 rotate classes', () => {
      expect(parseUtility('rotate-0')).toEqual(baseUtility({ prefix: 'rotate', value: '0', numeric: true, raw: 'rotate-0' }));
      expect(parseUtility('rotate-45')).toEqual(baseUtility({ prefix: 'rotate', value: '45', numeric: true, raw: 'rotate-45' }));
      expect(parseUtility('rotate-180')).toEqual(baseUtility({ prefix: 'rotate', value: '180', numeric: true, raw: 'rotate-180' }));
      expect(parseUtility('rotate-[270deg]')).toEqual(baseUtility({ prefix: 'rotate', value: '270deg', arbitrary: true, arbitraryValue: '270deg', raw: 'rotate-[270deg]' }));
      expect(parseUtility('rotate-')).toEqual({ type: 'unknown', raw: 'rotate-' });
    });
  });

  describe('translate', () => {
    it('should parse Tailwind v4 translate classes', () => {
      expect(parseUtility('translate-x-0')).toEqual(baseUtility({ prefix: 'translate-x', value: '0', numeric: true, raw: 'translate-x-0' }));
      expect(parseUtility('translate-x-1/2')).toEqual(baseUtility({ prefix: 'translate-x', value: '1', numeric: true, slash: '2', raw: 'translate-x-1/2' }));
      expect(parseUtility('translate-y-full')).toEqual(baseUtility({ prefix: 'translate-y', value: 'full', raw: 'translate-y-full' }));
      expect(parseUtility('translate-x-[10px]')).toEqual(baseUtility({ prefix: 'translate-x', value: '10px', arbitrary: true, arbitraryValue: '10px', raw: 'translate-x-[10px]' }));
      expect(parseUtility('translate-y-[-50%]')).toEqual(baseUtility({ prefix: 'translate-y', value: '-50%', arbitrary: true, arbitraryValue: '-50%', raw: 'translate-y-[-50%]' }));
      expect(parseUtility('translate-x-')).toEqual({ type: 'unknown', raw: 'translate-x-' });
    });
  });

  describe('skew', () => {
    it('should parse Tailwind v4 skew classes', () => {
      expect(parseUtility('skew-x-0')).toEqual(baseUtility({ prefix: 'skew-x', value: '0', numeric: true, raw: 'skew-x-0' }));
      expect(parseUtility('skew-x-12')).toEqual(baseUtility({ prefix: 'skew-x', value: '12', numeric: true, raw: 'skew-x-12' }));
      expect(parseUtility('skew-y-6')).toEqual(baseUtility({ prefix: 'skew-y', value: '6', numeric: true, raw: 'skew-y-6' }));
      expect(parseUtility('skew-x-[-15deg]')).toEqual(baseUtility({ prefix: 'skew-x', value: '-15deg', arbitrary: true, arbitraryValue: '-15deg', raw: 'skew-x-[-15deg]' }));
      expect(parseUtility('skew-x-')).toEqual({ type: 'unknown', raw: 'skew-x-' });
    });
  });

  describe('perspective', () => {
    it('should parse Tailwind v4 perspective classes', () => {
      expect(parseUtility('perspective-500')).toEqual(baseUtility({ prefix: 'perspective', value: '500', numeric: true, raw: 'perspective-500' }));
      expect(parseUtility('perspective-[1000px]')).toEqual(baseUtility({ prefix: 'perspective', value: '1000px', arbitrary: true, arbitraryValue: '1000px', raw: 'perspective-[1000px]' }));
      expect(parseUtility('perspective-')).toEqual({ type: 'unknown', raw: 'perspective-' });
    });
  });

  describe('origin', () => {
    it('should parse Tailwind v4 origin classes', () => {
      expect(parseUtility('origin-center')).toEqual(baseUtility({ prefix: 'origin', value: 'center', raw: 'origin-center' }));
      expect(parseUtility('origin-top')).toEqual(baseUtility({ prefix: 'origin', value: 'top', raw: 'origin-top' }));
      expect(parseUtility('origin-bottom')).toEqual(baseUtility({ prefix: 'origin', value: 'bottom', raw: 'origin-bottom' }));
      expect(parseUtility('origin-left')).toEqual(baseUtility({ prefix: 'origin', value: 'left', raw: 'origin-left' }));
      expect(parseUtility('origin-right')).toEqual(baseUtility({ prefix: 'origin', value: 'right', raw: 'origin-right' }));
      expect(parseUtility('origin-top-left')).toEqual(baseUtility({ prefix: 'origin', value: 'top-left', raw: 'origin-top-left' }));
      expect(parseUtility('origin-bottom-right')).toEqual(baseUtility({ prefix: 'origin', value: 'bottom-right', raw: 'origin-bottom-right' }));
      expect(parseUtility('origin-[25%_75%]')).toEqual(baseUtility({ prefix: 'origin', value: '25% 75%', arbitrary: true, arbitraryValue: '25% 75%', raw: 'origin-[25%_75%]' }));
      expect(parseUtility('origin-')).toEqual({ type: 'unknown', raw: 'origin-' });
    });
  });
});

describe('backface-visibility', () => {
  it('should parse Tailwind v4 backface-visibility classes', () => {
    expect(parseUtility('backface-hidden')).toEqual(baseUtility({ prefix: 'backface', value: 'hidden', raw: 'backface-hidden' }));
    expect(parseUtility('backface-visible')).toEqual(baseUtility({ prefix: 'backface', value: 'visible', raw: 'backface-visible' }));
    expect(parseUtility('backface-hidden!')).toEqual(baseUtility({ prefix: 'backface', value: 'hidden', important: true, raw: 'backface-hidden!' }));
  });
}); 