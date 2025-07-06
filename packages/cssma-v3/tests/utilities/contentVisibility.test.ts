import { describe, it, expect } from 'vitest';
import { parseUtility } from '../../src/parser/parseUtility';
import { baseUtility } from './base';

describe('parseUtility (content-visibility)', () => {
  describe('visibility', () => {
    it('should parse Tailwind v4 visibility classes', () => {
      expect(parseUtility('visible')).toEqual(baseUtility({ prefix: 'visible', value: '', raw: 'visible' }));
      expect(parseUtility('invisible')).toEqual(baseUtility({ prefix: 'invisible', value: '', raw: 'invisible' }));
      expect(parseUtility('collapse')).toEqual(baseUtility({ prefix: 'collapse', value: '', raw: 'collapse' }));
    });
  });
}); 