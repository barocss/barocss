import { describe, it, expect } from 'vitest';
import { parseUtility } from '../../src/parser/parseUtility';
import { baseUtility } from './base';

describe('parseUtility (border)', () => {
  describe('border width', () => {
    it('should parse Tailwind v4 border width classes', () => {
      expect(parseUtility('border')).toEqual(baseUtility({ prefix: 'border', raw: 'border' }));
      expect(parseUtility('border-0')).toEqual(baseUtility({ prefix: 'border', value: '0', numeric: true, raw: 'border-0' }));
      expect(parseUtility('border-2')).toEqual(baseUtility({ prefix: 'border', value: '2', numeric: true, raw: 'border-2' }));
      expect(parseUtility('border-x-4')).toEqual(baseUtility({ prefix: 'border-x', value: '4', numeric: true, raw: 'border-x-4' }));
      expect(parseUtility('border-y-8')).toEqual(baseUtility({ prefix: 'border-y', value: '8', numeric: true, raw: 'border-y-8' }));
      expect(parseUtility('border-t')).toEqual(baseUtility({ prefix: 'border-t', raw: 'border-t' }));
      expect(parseUtility('border-b-2')).toEqual(baseUtility({ prefix: 'border-b', value: '2', numeric: true, raw: 'border-b-2' }));
      expect(parseUtility('border-l-[5px]')).toEqual(baseUtility({ prefix: 'border-l', value: '5px', arbitrary: true, arbitraryValue: '5px', raw: 'border-l-[5px]' }));
      expect(parseUtility('border-4!')).toEqual(baseUtility({ prefix: 'border', value: '4', numeric: true, raw: 'border-4!', important: true }));
      expect(parseUtility('-border-2')).toEqual(baseUtility({ prefix: 'border', value: '2', numeric: true, raw: '-border-2', negative: true }));
      expect(parseUtility('border-')).toEqual({ type: 'unknown', raw: 'border-' });
    });
  });

  describe('border color', () => {
    it('should parse Tailwind v4 border color classes', () => {
      expect(parseUtility('border-red-500')).toEqual(baseUtility({ prefix: 'border', value: 'red-500', raw: 'border-red-500' }));
      expect(parseUtility('border-[#123456]')).toEqual(baseUtility({ prefix: 'border', value: '#123456', arbitrary: true, arbitraryType: 'hex', arbitraryValue: '#123456', raw: 'border-[#123456]' }));
      expect(parseUtility('border-[oklch(0.5_0.2_30)]')).toEqual(baseUtility({ prefix: 'border', value: 'oklch(0.5 0.2 30)', arbitrary: true, arbitraryType: 'oklch', arbitraryValue: '0.5 0.2 30', raw: 'border-[oklch(0.5_0.2_30)]' }));
      expect(parseUtility('border-red-500!')).toEqual(baseUtility({ prefix: 'border', value: 'red-500', raw: 'border-red-500!', important: true }));
      expect(parseUtility('border-')).toEqual({ type: 'unknown', raw: 'border-' });
    });
  });

  describe('border opacity', () => {
    it('should parse Tailwind v4 border opacity classes', () => {
      expect(parseUtility('border-opacity-50')).toEqual(baseUtility({ prefix: 'border', value: 'opacity-50', raw: 'border-opacity-50' }));
      expect(parseUtility('border-opacity-[.25]')).toEqual(baseUtility({ prefix: 'border', value: 'opacity-[.25]', raw: 'border-opacity-[.25]' }));
      expect(parseUtility('border-opacity-')).toEqual(baseUtility({ prefix: 'border', value: 'opacity-', raw: 'border-opacity-' }));
    });
  });

  describe('border style', () => {
    it('should parse Tailwind v4 border style classes', () => {
      expect(parseUtility('border-solid')).toEqual(baseUtility({ prefix: 'border', value: 'solid', raw: 'border-solid' }));
      expect(parseUtility('border-dashed')).toEqual(baseUtility({ prefix: 'border', value: 'dashed', raw: 'border-dashed' }));
      expect(parseUtility('border-dotted')).toEqual(baseUtility({ prefix: 'border', value: 'dotted', raw: 'border-dotted' }));
      expect(parseUtility('border-double')).toEqual(baseUtility({ prefix: 'border', value: 'double', raw: 'border-double' }));
      expect(parseUtility('border-hidden')).toEqual(baseUtility({ prefix: 'border', value: 'hidden', raw: 'border-hidden' }));
      expect(parseUtility('border-none')).toEqual(baseUtility({ prefix: 'border', value: 'none', raw: 'border-none' }));
      expect(parseUtility('border-style-')).toEqual(baseUtility({ prefix: 'border', value: 'style-', raw: 'border-style-' }));
    });
  });

  describe('divide', () => {
    it('should parse Tailwind v4 divide classes', () => {
      expect(parseUtility('divide-x')).toEqual(baseUtility({ prefix: 'divide-x', raw: 'divide-x' }));
      expect(parseUtility('divide-y-2')).toEqual(baseUtility({ prefix: 'divide-y', value: '2', numeric: true, raw: 'divide-y-2' }));
      expect(parseUtility('divide-x-reverse')).toEqual(baseUtility({ prefix: 'divide-x', value: 'reverse', raw: 'divide-x-reverse' }));
      expect(parseUtility('divide-y-[3px]')).toEqual(baseUtility({ prefix: 'divide-y', value: '3px', arbitrary: true, arbitraryValue: '3px', raw: 'divide-y-[3px]' }));
      expect(parseUtility('divide-x-')).toEqual({ type: 'unknown', raw: 'divide-x-' });
    });
  });

  describe('ring', () => {
    it('should parse Tailwind v4 ring classes', () => {
      expect(parseUtility('ring')).toEqual(baseUtility({ prefix: 'ring', raw: 'ring' }));
      expect(parseUtility('ring-2')).toEqual(baseUtility({ prefix: 'ring', value: '2', numeric: true, raw: 'ring-2' }));
      expect(parseUtility('ring-inset')).toEqual(baseUtility({ prefix: 'ring', value: 'inset', raw: 'ring-inset' }));
      expect(parseUtility('ring-offset-4')).toEqual(baseUtility({ prefix: 'ring', value: 'offset-4', raw: 'ring-offset-4' }));
      expect(parseUtility('ring-red-500')).toEqual(baseUtility({ prefix: 'ring', value: 'red-500', raw: 'ring-red-500' }));
      expect(parseUtility('ring-opacity-50')).toEqual(baseUtility({ prefix: 'ring', value: 'opacity-50', raw: 'ring-opacity-50' }));
      expect(parseUtility('ring-')).toEqual({ type: 'unknown', raw: 'ring-' });
    });
  });
}); 