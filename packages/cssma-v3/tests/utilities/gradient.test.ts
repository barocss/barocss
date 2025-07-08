import { describe, it, expect } from 'vitest';
import { parseUtility } from '../../src/parser/parseUtility';
import { baseUtility } from './base';
import { from, via, to } from '../../src/converter/cssmaps/gradient-stops';

describe('parseUtility (gradient)', () => {
  describe('bg-gradient', () => {
    it('should parse Tailwind v4 bg-gradient classes', () => {
      expect(parseUtility('bg-gradient-to-t')).toEqual(baseUtility({ prefix: 'bg-gradient-to', value: 't', raw: 'bg-gradient-to-t' }));
      expect(parseUtility('bg-gradient-to-b')).toEqual(baseUtility({ prefix: 'bg-gradient-to', value: 'b', raw: 'bg-gradient-to-b' }));
      expect(parseUtility('bg-gradient-to-l')).toEqual(baseUtility({ prefix: 'bg-gradient-to', value: 'l', raw: 'bg-gradient-to-l' }));
      expect(parseUtility('bg-gradient-to-r')).toEqual(baseUtility({ prefix: 'bg-gradient-to', value: 'r', raw: 'bg-gradient-to-r' }));
      expect(parseUtility('bg-gradient-')).toEqual({ type: 'unknown', raw: 'bg-gradient-' });
    });
  });

  describe('from/via/to', () => {
    it('should parse Tailwind v4 gradient color stop classes', () => {
      expect(parseUtility('from-blue-500')).toEqual(baseUtility({ prefix: 'from', value: 'blue-500', raw: 'from-blue-500' }));
      expect(parseUtility('via-green-400')).toEqual(baseUtility({ prefix: 'via', value: 'green-400', raw: 'via-green-400' }));
      expect(parseUtility('to-pink-600')).toEqual(baseUtility({ prefix: 'to', value: 'pink-600', raw: 'to-pink-600' }));
      expect(parseUtility('from-[color:rebeccapurple]')).toEqual(baseUtility({ prefix: 'from', value: 'color:rebeccapurple', arbitrary: true, arbitraryValue: 'color:rebeccapurple', raw: 'from-[color:rebeccapurple]' }));
      expect(parseUtility('via-')).toEqual({ type: 'unknown', raw: 'via-' });
    });
  });

  it('parses gradient', () => {
    expect(parseUtility('gradient')).toEqual(baseUtility({ prefix: 'gradient', raw: 'gradient' }));
  });
  it('returns unknown for invalid', () => {
    expect(parseUtility('bg-gradient-to-')).toEqual({ type: 'unknown', raw: 'bg-gradient-to-' });
    expect(parseUtility('from-')).toEqual({ type: 'unknown', raw: 'from-' });
    expect(parseUtility('via-')).toEqual({ type: 'unknown', raw: 'via-' });
    expect(parseUtility('to-')).toEqual({ type: 'unknown', raw: 'to-' });
  });
});

describe('gradient stop conversion', () => {
  it('should handle from-<color>', () => {
    expect(from({ prefix: 'from', value: 'blue-500' } as any)).toEqual({ '--tw-gradient-from': 'blue-500' });
  });
  it('should handle from-<percentage>', () => {
    expect(from({ prefix: 'from', value: '40%' } as any)).toEqual({ '--tw-gradient-from-position': '40%' });
  });
  it('should handle from-[arbitrary]', () => {
    expect(from({ prefix: 'from', arbitrary: true, arbitraryValue: 'color:rebeccapurple', value: 'color:rebeccapurple' } as any)).toEqual({ '--tw-gradient-from': 'color:rebeccapurple' });
  });
  it('should handle from-(customProperty)', () => {
    expect(from({ prefix: 'from', customProperty: true, value: '--my-gradient' } as any)).toEqual({ '--tw-gradient-from': 'var(--my-gradient)' });
  });
  it('should handle via-<color>', () => {
    expect(via({ prefix: 'via', value: 'green-400' } as any)).toEqual({ '--tw-gradient-via': 'green-400' });
  });
  it('should handle via-<percentage>', () => {
    expect(via({ prefix: 'via', value: '30%' } as any)).toEqual({ '--tw-gradient-via-position': '30%' });
  });
  it('should handle via-[arbitrary]', () => {
    expect(via({ prefix: 'via', arbitrary: true, arbitraryValue: 'color:hotpink', value: 'color:hotpink' } as any)).toEqual({ '--tw-gradient-via': 'color:hotpink' });
  });
  it('should handle via-(customProperty)', () => {
    expect(via({ prefix: 'via', customProperty: true, value: '--my-via' } as any)).toEqual({ '--tw-gradient-via': 'var(--my-via)' });
  });
  it('should handle to-<color>', () => {
    expect(to({ prefix: 'to', value: 'pink-600' } as any)).toEqual({ '--tw-gradient-to': 'pink-600' });
  });
  it('should handle to-<percentage>', () => {
    expect(to({ prefix: 'to', value: '90%' } as any)).toEqual({ '--tw-gradient-to-position': '90%' });
  });
  it('should handle to-[arbitrary]', () => {
    expect(to({ prefix: 'to', arbitrary: true, arbitraryValue: 'color:yellow', value: 'color:yellow' } as any)).toEqual({ '--tw-gradient-to': 'color:yellow' });
  });
  it('should handle to-(customProperty)', () => {
    expect(to({ prefix: 'to', customProperty: true, value: '--my-to' } as any)).toEqual({ '--tw-gradient-to': 'var(--my-to)' });
  });
  it('should return undefined for missing value', () => {
    expect(from({ prefix: 'from' } as any)).toBeUndefined();
    expect(via({ prefix: 'via' } as any)).toBeUndefined();
    expect(to({ prefix: 'to' } as any)).toBeUndefined();
  });
}); 