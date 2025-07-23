import { describe, it, expect, beforeAll } from 'vitest';
import { parseClassName } from '../src/core/parser';
import { functionalUtility, staticModifier } from '../src/core/registry';

describe('parseClassName - tokenizer based', () => {
  beforeAll(() => {
    // Register utilities with functionalUtility (정확한 match 함수)
    functionalUtility({
      name: 'bg',
      prop: 'background-color',
      supportsArbitrary: true,
      supportsNegative: true,
      handle: (value) => [{ type: 'declaration', prop: 'background-color', value }]
    });
    
    functionalUtility({
      name: 'text',
      prop: 'color',
      supportsArbitrary: true,
      supportsNegative: true,
      handle: (value) => [{ type: 'declaration', prop: 'color', value }]
    });
    
    functionalUtility({
      name: 'min-w',
      prop: 'min-width',
      supportsArbitrary: true,
      supportsNegative: true,
      handle: (value) => [{ type: 'declaration', prop: 'min-width', value }]
    });
    
    // Register modifiers (모디파이어 등록)
    staticModifier('hover', ['&:hover']);
    staticModifier('focus', ['&:focus']);
    staticModifier('active', ['&:active']);
    staticModifier('group', ['&.group']);
  });

  describe('tokenizer-based bidirectional parsing', () => {
    it('should parse modifier:utility (traditional Tailwind)', () => {
      const result = parseClassName('hover:bg-red-500');
      expect(result.modifiers).toEqual([{ type: 'hover', negative: false }]);
      expect(result.utility).toEqual({
        prefix: 'bg',
        value: 'red-500',
        arbitrary: false,
        customProperty: false,
        negative: false,
        opacity: '',
      });
    });

    it('should parse utility:modifier (Master CSS style)', () => {
      const result = parseClassName('bg-red-500:hover');
      expect(result.modifiers).toEqual([{ type: 'hover', negative: false }]);
      expect(result.utility).toEqual({
        prefix: 'bg',
        value: 'red-500',
        arbitrary: false,
        customProperty: false,
        negative: false,
        opacity: '',
      });
    });

    it('should handle utility-only classes', () => {
      const result = parseClassName('bg-red-500');
      expect(result.modifiers).toEqual([]);
      expect(result.utility).toEqual({
        prefix: 'bg',
        value: 'red-500',
        arbitrary: false,
        customProperty: false,
        negative: false,
        opacity: '',
      });
    });

    it('should handle arbitrary values in both directions', () => {
      // modifier:utility with arbitrary
      const result1 = parseClassName('hover:bg-[#ff0000]');
      expect(result1.modifiers).toEqual([{ type: 'hover', negative: false }]);
      expect(result1.utility?.arbitrary).toBe(true);
      expect(result1.utility?.value).toBe('#ff0000');

      // utility:modifier with arbitrary
      const result2 = parseClassName('bg-[#ff0000]:hover');
      expect(result2.modifiers).toEqual([{ type: 'hover', negative: false }]);
      expect(result2.utility?.arbitrary).toBe(true);
      expect(result2.utility?.value).toBe('#ff0000');
    });

    it('should handle multiple modifiers', () => {
      const result = parseClassName('group-hover:focus:bg-red-500');
      expect(result.modifiers).toEqual([
        { type: 'group-hover', negative: false },
        { type: 'focus', negative: false }
      ]);
      expect(result.utility).toEqual({
        prefix: 'bg',
        value: 'red-500',
        arbitrary: false,
        customProperty: false,
        negative: false,
        opacity: '',
      });
    });

    it('should handle utility with multiple modifiers', () => {
      const result = parseClassName('bg-red-500:hover:focus');
      expect(result.modifiers).toEqual([
        { type: 'hover', negative: false },
        { type: 'focus', negative: false }
      ]);
      expect(result.utility).toEqual({
        prefix: 'bg',
        value: 'red-500',
        arbitrary: false,
        customProperty: false,
        negative: false,
        opacity: '',
      });
    });
  });
}); 