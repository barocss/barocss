import { describe, it, expect } from 'vitest';
import { parseUtility } from '../../src/parser/parseUtility';
import { baseUtility } from './base';

describe('parseUtility (content)', () => {
  describe('content', () => {
    it('should parse Tailwind v4 content classes', () => {
      expect(parseUtility('content-none')).toEqual(baseUtility({ prefix: 'content', value: 'none', raw: 'content-none' }));
      expect(parseUtility('content-[attr(data-content)]')).toEqual(baseUtility({ prefix: 'content', value: 'attr(data-content)', raw: 'content-[attr(data-content)]', arbitrary: true, arbitraryType: 'attr', arbitraryValue: 'data-content' }));
      expect(parseUtility('content-')).toEqual({ type: 'unknown', raw: 'content-' });
    });
  });
}); 