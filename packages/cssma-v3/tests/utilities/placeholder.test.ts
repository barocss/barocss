import { describe, it, expect } from 'vitest';
import { parseUtility } from '../../src/parser/parseUtility';
import { baseUtility } from './base';

describe('parseUtility (placeholder)', () => {
  describe('placeholder-color', () => {
    it('should parse Tailwind v4 placeholder color classes', () => {
      expect(parseUtility('placeholder-black')).toEqual(baseUtility({ prefix: 'placeholder', value: 'black', raw: 'placeholder-black' }));
      expect(parseUtility('placeholder-white')).toEqual(baseUtility({ prefix: 'placeholder', value: 'white', raw: 'placeholder-white' }));
      expect(parseUtility('placeholder-red-500')).toEqual(baseUtility({ prefix: 'placeholder', value: 'red-500', raw: 'placeholder-red-500' }));
      expect(parseUtility('placeholder-[color:rebeccapurple]')).toEqual(baseUtility({ prefix: 'placeholder', value: '[color:rebeccapurple]', raw: 'placeholder-[color:rebeccapurple]' }));
      expect(parseUtility('placeholder-')).toEqual({ type: 'unknown', raw: 'placeholder-' });
      expect(parseUtility('placeholder-foo')).toEqual({ type: 'unknown', raw: 'placeholder-foo' });
    });
  });

  describe('placeholder-opacity', () => {
    it('should parse Tailwind v4 placeholder opacity classes', () => {
      expect(parseUtility('placeholder-opacity-0')).toEqual(baseUtility({ prefix: 'placeholder-opacity', value: '0', raw: 'placeholder-opacity-0' }));
      expect(parseUtility('placeholder-opacity-50')).toEqual(baseUtility({ prefix: 'placeholder-opacity', value: '50', raw: 'placeholder-opacity-50' }));
      expect(parseUtility('placeholder-opacity-100')).toEqual(baseUtility({ prefix: 'placeholder-opacity', value: '100', raw: 'placeholder-opacity-100' }));
      expect(parseUtility('placeholder-opacity-[.25]')).toEqual(baseUtility({ prefix: 'placeholder-opacity', value: '[.25]', raw: 'placeholder-opacity-[.25]' }));
      expect(parseUtility('placeholder-opacity-')).toEqual({ type: 'unknown', raw: 'placeholder-opacity-' });
      expect(parseUtility('placeholder-opacity-foo')).toEqual({ type: 'unknown', raw: 'placeholder-opacity-foo' });
    });
  });
}); 