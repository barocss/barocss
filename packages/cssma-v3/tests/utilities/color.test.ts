import { describe, it, expect } from 'vitest';
import { parseUtility } from '../../src/parser/parseUtility';
import { baseUtility } from './base';

describe('parseUtility (color)', () => {
  describe('text color', () => {
    it('should parse Tailwind v4 text color classes', () => {
      expect(parseUtility('text-red-500')).toEqual(baseUtility({ prefix: 'text', value: 'red-500', raw: 'text-red-500' }));
      expect(parseUtility('text-blue-100')).toEqual(baseUtility({ prefix: 'text', value: 'blue-100', raw: 'text-blue-100' }));
      expect(parseUtility('text-[#ff0]')).toEqual(baseUtility({ prefix: 'text', value: '#ff0', arbitrary: true, arbitraryType: 'hex', arbitraryValue: '#ff0', raw: 'text-[#ff0]' }));
      expect(parseUtility('text-[oklch(0.5_0.2_30)]')).toEqual(baseUtility({ prefix: 'text', value: 'oklch(0.5 0.2 30)', arbitrary: true, arbitraryType: 'oklch', arbitraryValue: '0.5 0.2 30', raw: 'text-[oklch(0.5_0.2_30)]' }));
      expect(parseUtility('text-red-500!')).toEqual(baseUtility({ prefix: 'text', value: 'red-500', raw: 'text-red-500!', important: true }));
      expect(parseUtility('-text-blue-100')).toEqual(baseUtility({ prefix: 'text', value: 'blue-100', raw: '-text-blue-100', negative: true }));
      expect(parseUtility('text-')).toEqual({ type: 'unknown', raw: 'text-' });
    });
  });

  describe('fill color', () => {
    it('should parse Tailwind v4 fill color classes', () => {
      expect(parseUtility('fill-blue-400')).toEqual(baseUtility({ prefix: 'fill', value: 'blue-400', raw: 'fill-blue-400' }));
      expect(parseUtility('fill-[#123456]')).toEqual(baseUtility({ prefix: 'fill', value: '#123456', arbitrary: true, arbitraryType: 'hex', arbitraryValue: '#123456', raw: 'fill-[#123456]' }));
      expect(parseUtility('fill-[oklch(0.5_0.2_30)]')).toEqual(baseUtility({ prefix: 'fill', value: 'oklch(0.5 0.2 30)', arbitrary: true, arbitraryType: 'oklch', arbitraryValue: '0.5 0.2 30', raw: 'fill-[oklch(0.5_0.2_30)]' }));
      expect(parseUtility('fill-blue-400!')).toEqual(baseUtility({ prefix: 'fill', value: 'blue-400', raw: 'fill-blue-400!', important: true }));
      expect(parseUtility('fill-')).toEqual({ type: 'unknown', raw: 'fill-' });
    });
  });

  describe('stroke color', () => {
    it('should parse Tailwind v4 stroke color classes', () => {
      expect(parseUtility('stroke-green-300')).toEqual(baseUtility({ prefix: 'stroke', value: 'green-300', raw: 'stroke-green-300' }));
      expect(parseUtility('stroke-[#abc]')).toEqual(baseUtility({ prefix: 'stroke', value: '#abc', arbitrary: true, arbitraryType: 'hex', arbitraryValue: '#abc', raw: 'stroke-[#abc]' }));
      expect(parseUtility('stroke-[oklch(0.5_0.2_30)]')).toEqual(baseUtility({ prefix: 'stroke', value: 'oklch(0.5 0.2 30)', arbitrary: true, arbitraryType: 'oklch', arbitraryValue: '0.5 0.2 30', raw: 'stroke-[oklch(0.5_0.2_30)]' }));
      expect(parseUtility('stroke-green-300!')).toEqual(baseUtility({ prefix: 'stroke', value: 'green-300', raw: 'stroke-green-300!', important: true }));
      expect(parseUtility('stroke-')).toEqual({ type: 'unknown', raw: 'stroke-' });
    });
  });

  describe('accent color', () => {
    it('should parse Tailwind v4 accent color classes', () => {
      expect(parseUtility('accent-pink-500')).toEqual(baseUtility({ prefix: 'accent', value: 'pink-500', raw: 'accent-pink-500' }));
      expect(parseUtility('accent-[#ff0]')).toEqual(baseUtility({ prefix: 'accent', value: '#ff0', raw: 'accent-[#ff0]', arbitrary: true, arbitraryType: 'hex', arbitraryValue: '#ff0' }));
      expect(parseUtility('accent-[oklch(0.5_0.2_30)]')).toEqual(baseUtility({ prefix: 'accent', value: 'oklch(0.5 0.2 30)', raw: 'accent-[oklch(0.5_0.2_30)]', arbitrary: true, arbitraryType: 'oklch', arbitraryValue: '0.5 0.2 30' }));
      expect(parseUtility('accent-pink-500!')).toEqual(baseUtility({ prefix: 'accent', value: 'pink-500', raw: 'accent-pink-500!', important: true }));
      expect(parseUtility('accent-')).toEqual({ type: 'unknown', raw: 'accent-' });
    });
  });

  describe('caret color', () => {
    it('should parse Tailwind v4 caret color classes', () => {
      expect(parseUtility('caret-red-500')).toEqual(baseUtility({ prefix: 'caret', value: 'red-500', raw: 'caret-red-500' }));
      expect(parseUtility('caret-[#ff0]')).toEqual(baseUtility({ prefix: 'caret', value: '#ff0', raw: 'caret-[#ff0]', arbitrary: true, arbitraryType: 'hex', arbitraryValue: '#ff0' }));
      expect(parseUtility('caret-[oklch(0.5_0.2_30)]')).toEqual(baseUtility({ prefix: 'caret', value: 'oklch(0.5 0.2 30)', raw: 'caret-[oklch(0.5_0.2_30)]', arbitrary: true, arbitraryType: 'oklch', arbitraryValue: '0.5 0.2 30' }));
      expect(parseUtility('caret-red-500!')).toEqual(baseUtility({ prefix: 'caret', value: 'red-500', raw: 'caret-red-500!', important: true }));
      expect(parseUtility('caret-')).toEqual({ type: 'unknown', raw: 'caret-' });
    });
  });

  describe('decoration color', () => {
    it('should parse Tailwind v4 decoration color classes', () => {
      expect(parseUtility('decoration-blue-500')).toEqual(baseUtility({ prefix: 'decoration', value: 'blue-500', raw: 'decoration-blue-500' }));
      expect(parseUtility('decoration-[#ff0]')).toEqual(baseUtility({ prefix: 'decoration', value: '#ff0', arbitrary: true, arbitraryType: 'hex', arbitraryValue: '#ff0', raw: 'decoration-[#ff0]' }));
      expect(parseUtility('decoration-[oklch(0.5_0.2_30)]')).toEqual(baseUtility({ prefix: 'decoration', value: 'oklch(0.5 0.2 30)', raw: 'decoration-[oklch(0.5_0.2_30)]', arbitrary: true, arbitraryType: 'oklch', arbitraryValue: '0.5 0.2 30' }));
      expect(parseUtility('decoration-blue-500!')).toEqual(baseUtility({ prefix: 'decoration', value: 'blue-500', raw: 'decoration-blue-500!', important: true }));
      expect(parseUtility('decoration-')).toEqual({ type: 'unknown', raw: 'decoration-' });
    });
  });
}); 