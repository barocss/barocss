import { describe, it, expect } from 'vitest';
import { parseUtility } from '../../src/parser/parseUtility';
import { baseUtility } from './base';

describe('parseUtility (box)', () => {
  describe('box-decoration', () => {
    it('should parse Tailwind v4 box decoration classes', () => {
      expect(parseUtility('box-decoration-slice')).toEqual(baseUtility({ prefix: 'box-decoration', value: 'slice', raw: 'box-decoration-slice' }));
      expect(parseUtility('box-decoration-clone')).toEqual(baseUtility({ prefix: 'box-decoration', value: 'clone', raw: 'box-decoration-clone' }));
      expect(parseUtility('box-decoration-')).toEqual({ type: 'unknown', raw: 'box-decoration-' });
    });
  });

  describe('box-sizing', () => {
    it('should parse Tailwind v4 box sizing classes', () => {
      expect(parseUtility('box-border')).toEqual(baseUtility({ prefix: 'box', value: 'border', raw: 'box-border' }));
      expect(parseUtility('box-content')).toEqual(baseUtility({ prefix: 'box', value: 'content', raw: 'box-content' }));
      expect(parseUtility('box-')).toEqual({ type: 'unknown', raw: 'box-' });
    });
  });

  describe('box-shadow', () => {
    it('should parse Tailwind v4 box shadow classes', () => {
      expect(parseUtility('shadow')).toEqual(baseUtility({ prefix: 'shadow', raw: 'shadow' }));
      expect(parseUtility('shadow-md')).toEqual(baseUtility({ prefix: 'shadow', value: 'md', raw: 'shadow-md' }));
      expect(parseUtility('shadow-lg')).toEqual(baseUtility({ prefix: 'shadow', value: 'lg', raw: 'shadow-lg' }));
      expect(parseUtility('shadow-inner')).toEqual(baseUtility({ prefix: 'shadow', value: 'inner', raw: 'shadow-inner' }));
      expect(parseUtility('shadow-none')).toEqual(baseUtility({ prefix: 'shadow', value: 'none', raw: 'shadow-none' }));
      expect(parseUtility('shadow-[0_2px_4px_#000]')).toEqual(baseUtility({ prefix: 'shadow', value: '0 2px 4px #000', arbitrary: true, arbitraryValue: '0 2px 4px #000', raw: 'shadow-[0_2px_4px_#000]' }));
      expect(parseUtility('shadow-')).toEqual({ type: 'unknown', raw: 'shadow-' });
    });
  });

  it('parses border-collapse/separate', () => {
    expect(parseUtility('border-collapse')).toEqual(baseUtility({ prefix: 'border-collapse', raw: 'border-collapse' }));
    expect(parseUtility('border-separate')).toEqual(baseUtility({ prefix: 'border-separate', raw: 'border-separate' }));
  });
  it('parses drop-shadow', () => {
    expect(parseUtility('drop-shadow')).toEqual(baseUtility({ prefix: 'drop-shadow', value: '', raw: 'drop-shadow', preset: false }));
  });
  it('returns unknown for invalid', () => {
    expect(parseUtility('box-decoration-')).toEqual({ type: 'unknown', raw: 'box-decoration-' });
    expect(parseUtility('border-collapse-')).toEqual({ type: 'unknown', raw: 'border-collapse-' });
    expect(parseUtility('drop-shadow-')).toEqual({ type: 'unknown', raw: 'drop-shadow-' });
  });
}); 