import { describe, it, expect } from 'vitest';
import { parseUtility } from '../../src/parser/parseUtility';
import { baseUtility } from './base';

describe('parseUtility (scroll snap)', () => {
  describe('scroll-snap-type', () => {
    it('should parse Tailwind v4 scroll snap type classes', () => {
      expect(parseUtility('snap-none')).toEqual(baseUtility({ prefix: 'snap', value: 'none', raw: 'snap-none' }));
      expect(parseUtility('snap-x')).toEqual(baseUtility({ prefix: 'snap-x', value: '', raw: 'snap-x' }));
      expect(parseUtility('snap-y')).toEqual(baseUtility({ prefix: 'snap-y', value: '', raw: 'snap-y' }));
      expect(parseUtility('snap-both')).toEqual(baseUtility({ prefix: 'snap', value: 'both', raw: 'snap-both' }));
      expect(parseUtility('snap-mandatory')).toEqual(baseUtility({ prefix: 'snap', value: 'mandatory', raw: 'snap-mandatory' }));
      expect(parseUtility('snap-proximity')).toEqual(baseUtility({ prefix: 'snap', value: 'proximity', raw: 'snap-proximity' }));
      expect(parseUtility('snap-')).toEqual({ type: 'unknown', raw: 'snap-' });
    });
  });

  describe('scroll-snap-align', () => {
    it('should parse Tailwind v4 scroll snap align classes', () => {
      expect(parseUtility('snap-start')).toEqual(baseUtility({ prefix: 'snap', value: 'start', raw: 'snap-start' }));
      expect(parseUtility('snap-end')).toEqual(baseUtility({ prefix: 'snap', value: 'end', raw: 'snap-end' }));
      expect(parseUtility('snap-center')).toEqual(baseUtility({ prefix: 'snap', value: 'center', raw: 'snap-center' }));
      expect(parseUtility('snap-align-')).toEqual({ type: 'unknown', raw: 'snap-align-' });
    });
  });
}); 