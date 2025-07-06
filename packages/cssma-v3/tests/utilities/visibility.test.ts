import { describe, it, expect } from 'vitest';
import { parseUtility } from '../../src/parser/parseUtility';
import { baseUtility } from './base';

describe('parseUtility (visibility)', () => {
  describe('visibility', () => {
    it('should parse Tailwind v4 visibility classes', () => {
      expect(parseUtility('visible')).toEqual(baseUtility({ prefix: 'visible', raw: 'visible' }));
      expect(parseUtility('invisible')).toEqual(baseUtility({ prefix: 'invisible', raw: 'invisible' }));
      expect(parseUtility('collapse')).toEqual(baseUtility({ prefix: 'collapse', raw: 'collapse' }));
      expect(parseUtility('visible!')).toEqual(baseUtility({ prefix: 'visible', raw: 'visible!', important: true }));
      expect(parseUtility('invisible!')).toEqual(baseUtility({ prefix: 'invisible', raw: 'invisible!', important: true }));
      expect(parseUtility('collapse!')).toEqual(baseUtility({ prefix: 'collapse', raw: 'collapse!', important: true }));
    });
  });

  describe('screen reader only', () => {
    it('should parse Tailwind v4 sr-only classes', () => {
      expect(parseUtility('sr-only')).toEqual(baseUtility({ prefix: 'sr-only', raw: 'sr-only' }));
      expect(parseUtility('not-sr-only')).toEqual(baseUtility({ prefix: 'not-sr-only', value: '', raw: 'not-sr-only' }));
      expect(parseUtility('sr-only!')).toEqual(baseUtility({ prefix: 'sr-only', raw: 'sr-only!', important: true }));
      expect(parseUtility('not-sr-only!')).toEqual(baseUtility({ prefix: 'not-sr-only', value: '', raw: 'not-sr-only!', important: true }));
      expect(parseUtility('sr-only-')).toEqual({ type: 'unknown', raw: 'sr-only-' });
      expect(parseUtility('not-sr-only-')).toEqual({ type: 'unknown', raw: 'not-sr-only-' });
    });
  });

  it('parses isolation', () => {
    expect(parseUtility('isolation-auto')).toEqual(baseUtility({ prefix: 'isolation', value: 'auto', raw: 'isolation-auto' }));
    expect(parseUtility('isolate')).toEqual(baseUtility({ prefix: 'isolate', raw: 'isolate' }));
  });
  it('returns unknown for invalid', () => {
    expect(parseUtility('visible-')).toEqual({ type: 'unknown', raw: 'visible-' });
    expect(parseUtility('invisible-')).toEqual({ type: 'unknown', raw: 'invisible-' });
    expect(parseUtility('collapse-')).toEqual({ type: 'unknown', raw: 'collapse-' });
    expect(parseUtility('isolation-')).toEqual({ type: 'unknown', raw: 'isolation-' });
  });
}); 