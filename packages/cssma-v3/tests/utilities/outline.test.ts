import { describe, it, expect } from 'vitest';
import { parseUtility } from '../../src/parser/parseUtility';
import { baseUtility } from './base';

describe('parseUtility (outline)', () => {
  describe('outline-style', () => {
    it('should parse Tailwind v4 outline style classes', () => {
      expect(parseUtility('outline-none')).toEqual(baseUtility({ prefix: 'outline', value: 'none', raw: 'outline-none' }));
      expect(parseUtility('outline')).toEqual(baseUtility({ prefix: 'outline', raw: 'outline' }));
      expect(parseUtility('outline-dashed')).toEqual(baseUtility({ prefix: 'outline', value: 'dashed', raw: 'outline-dashed' }));
      expect(parseUtility('outline-dotted')).toEqual(baseUtility({ prefix: 'outline', value: 'dotted', raw: 'outline-dotted' }));
      expect(parseUtility('outline-double')).toEqual(baseUtility({ prefix: 'outline', value: 'double', raw: 'outline-double' }));
      expect(parseUtility('outline-solid')).toEqual(baseUtility({ prefix: 'outline', value: 'solid', raw: 'outline-solid' }));
      expect(parseUtility('outline-hidden')).toEqual(baseUtility({ prefix: 'outline', value: 'hidden', raw: 'outline-hidden' }));
      expect(parseUtility('outline-')).toEqual({ type: 'unknown', raw: 'outline-' });
    });
  });

  describe('outline-width', () => {
    it('should parse Tailwind v4 outline width classes', () => {
      expect(parseUtility('outline-0')).toEqual(baseUtility({ prefix: 'outline', value: '0', numeric: true, raw: 'outline-0' }));
      expect(parseUtility('outline-2')).toEqual(baseUtility({ prefix: 'outline', value: '2', numeric: true, raw: 'outline-2' }));
      expect(parseUtility('outline-4')).toEqual(baseUtility({ prefix: 'outline', value: '4', numeric: true, raw: 'outline-4' }));
      expect(parseUtility('outline-8')).toEqual(baseUtility({ prefix: 'outline', value: '8', numeric: true, raw: 'outline-8' }));
      expect(parseUtility('outline-[3px]')).toEqual(baseUtility({ prefix: 'outline', value: '3px', arbitrary: true, arbitraryValue: '3px', raw: 'outline-[3px]' }));
      expect(parseUtility('outline-[0.5rem]')).toEqual(baseUtility({ prefix: 'outline', value: '0.5rem', arbitrary: true, arbitraryValue: '0.5rem', raw: 'outline-[0.5rem]' }));
      expect(parseUtility('outline-')).toEqual({ type: 'unknown', raw: 'outline-' });
    });
  });

  describe('outline-color', () => {
    it('should parse Tailwind v4 outline color classes', () => {
      expect(parseUtility('outline-black')).toEqual(baseUtility({ prefix: 'outline', value: 'black', raw: 'outline-black' }));
      expect(parseUtility('outline-white')).toEqual(baseUtility({ prefix: 'outline', value: 'white', raw: 'outline-white' }));
      expect(parseUtility('outline-red-500')).toEqual(baseUtility({ prefix: 'outline', value: 'red-500', raw: 'outline-red-500' }));
      expect(parseUtility('outline-blue-300')).toEqual(baseUtility({ prefix: 'outline', value: 'blue-300', raw: 'outline-blue-300' }));
      expect(parseUtility('outline-[color:rebeccapurple]')).toEqual(baseUtility({ prefix: 'outline', value: 'color:rebeccapurple', arbitrary: true, arbitraryValue: 'color:rebeccapurple', raw: 'outline-[color:rebeccapurple]' }));
      expect(parseUtility('outline-')).toEqual({ type: 'unknown', raw: 'outline-' });
    });
  });

  describe('outline-offset', () => {
    it('should parse Tailwind v4 outline offset classes', () => {
      expect(parseUtility('outline-offset-0')).toEqual(baseUtility({ prefix: 'outline', value: 'offset-0', raw: 'outline-offset-0' }));
      expect(parseUtility('outline-offset-2')).toEqual(baseUtility({ prefix: 'outline', value: 'offset-2', raw: 'outline-offset-2' }));
      expect(parseUtility('outline-offset-4')).toEqual(baseUtility({ prefix: 'outline', value: 'offset-4', raw: 'outline-offset-4' }));
      expect(parseUtility('outline-offset-8')).toEqual(baseUtility({ prefix: 'outline', value: 'offset-8', raw: 'outline-offset-8' }));
      expect(parseUtility('outline-offset-[3px]')).toEqual(baseUtility({ prefix: 'outline', value: 'offset-[3px]', raw: 'outline-offset-[3px]' }));
      expect(parseUtility('outline-offset-[0.5rem]')).toEqual(baseUtility({ prefix: 'outline', value: 'offset-[0.5rem]', raw: 'outline-offset-[0.5rem]' }));
      expect(parseUtility('outline-offset-')).toEqual(baseUtility({ prefix: 'outline', value: 'offset-', raw: 'outline-offset-' }));
    });
  });
}); 