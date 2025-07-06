import { describe, it, expect } from 'vitest';
import { parseUtility } from '../../src/parser/parseUtility';
import { baseUtility } from './base';

describe('parseUtility (motion)', () => {
  describe('motion-safe/reduce', () => {
    it('should parse Tailwind v4 motion-safe/reduce classes', () => {
      expect(parseUtility('motion-safe')).toEqual({ type: 'unknown', raw: 'motion-safe' });
      expect(parseUtility('motion-reduce')).toEqual({ type: 'unknown', raw: 'motion-reduce' });
      expect(parseUtility('motion-safe-')).toEqual({ type: 'unknown', raw: 'motion-safe-' });
    });
  });

  describe('animate', () => {
    it('should parse Tailwind v4 animate classes', () => {
      expect(parseUtility('animate-none')).toEqual(baseUtility({ prefix: 'animate', value: 'none', raw: 'animate-none' }));
      expect(parseUtility('animate-spin')).toEqual(baseUtility({ prefix: 'animate', value: 'spin', raw: 'animate-spin' }));
      expect(parseUtility('animate-ping')).toEqual(baseUtility({ prefix: 'animate', value: 'ping', raw: 'animate-ping' }));
      expect(parseUtility('animate-pulse')).toEqual(baseUtility({ prefix: 'animate', value: 'pulse', raw: 'animate-pulse' }));
      expect(parseUtility('animate-bounce')).toEqual(baseUtility({ prefix: 'animate', value: 'bounce', raw: 'animate-bounce' }));
      expect(parseUtility('animate-[wiggle_1s_ease-in-out_infinite]')).toEqual(baseUtility({ prefix: 'animate', value: 'wiggle 1s ease-in-out infinite', arbitrary: true, arbitraryValue: 'wiggle 1s ease-in-out infinite', raw: 'animate-[wiggle_1s_ease-in-out_infinite]' }));
      expect(parseUtility('animate-')).toEqual({ type: 'unknown', raw: 'animate-' });
    });
  });
}); 