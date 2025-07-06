import { describe, it, expect } from 'vitest';
import { parseUtility } from '../../src/parser/parseUtility';
import { baseUtility } from './base';

describe('parseUtility (forced-color-adjust)', () => {
  describe('forced-color-adjust', () => {
    it('should parse Tailwind v4 forced-color-adjust classes', () => {
      expect(parseUtility('forced-color-adjust-auto')).toEqual(baseUtility({ prefix: 'forced-color-adjust-auto', value: '', raw: 'forced-color-adjust-auto' }));
      expect(parseUtility('forced-color-adjust-none')).toEqual(baseUtility({ prefix: 'forced-color-adjust-none', value: '', raw: 'forced-color-adjust-none' }));
      expect(parseUtility('forced-color-adjust-')).toEqual({ type: 'unknown', raw: 'forced-color-adjust-' });
    });
  });
}); 