import { describe, it, expect } from 'vitest';
import type { ParsedClassToken } from '../../src/parser/utils';
import { createContext } from '../../src/config/context';
import type { CssmaConfig } from '../../src/theme-types';

// Import divide converters
import { divideX, divideY } from '../../src/converter/cssmaps/divide';

// Create proper context with theme colors
const config: CssmaConfig = {
  theme: {
    colors: {
      red: {
        '50': '#fef2f2',
        '100': '#fee2e2',
        '500': '#ef4444',
        '900': '#7f1d1d'
      },
      blue: {
        '100': '#dbeafe',
        '500': '#3b82f6',
        '600': '#2563eb'
      },
      gray: {
        '200': '#e5e7eb',
        '400': '#9ca3af'
      }
    }
  }
};

const mockContext = createContext(config);

describe('Divide Converters', () => {
  describe('divideX (horizontal dividers)', () => {
    it('should handle no value (default 1px)', () => {
      const utility: ParsedClassToken = { 
        prefix: 'divide-x', 
        value: undefined, 
        numeric: false, 
        important: false 
      };
      expect(divideX(utility, mockContext)).toEqual({
        '& > :not(:last-child)': {
          borderInlineStartWidth: '0px',
          borderInlineEndWidth: '1px',
        }
      });
    });

    it('should handle numeric values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'divide-x', 
        value: '2', 
        numeric: true, 
        important: false 
      };
      expect(divideX(utility, mockContext)).toEqual({
        '& > :not(:last-child)': {
          borderInlineStartWidth: '0px',
          borderInlineEndWidth: '2px',
        }
      });
    });

    it('should handle zero value', () => {
      const utility: ParsedClassToken = { 
        prefix: 'divide-x', 
        value: '0', 
        numeric: false, 
        important: false 
      };
      expect(divideX(utility, mockContext)).toEqual({
        '& > :not(:last-child)': {
          borderInlineStartWidth: '0px',
          borderInlineEndWidth: '0px',
        }
      });
    });

    it('should handle reverse', () => {
      const utility: ParsedClassToken = { 
        prefix: 'divide-x', 
        value: 'reverse', 
        numeric: false, 
        important: false 
      };
      expect(divideX(utility, mockContext)).toEqual({
        '--tw-divide-x-reverse': '1'
      });
    });

    it('should handle theme colors', () => {
      const utility: ParsedClassToken = { 
        prefix: 'divide-x', 
        value: 'red-500', 
        numeric: false, 
        important: false 
      };
      expect(divideX(utility, mockContext)).toEqual({
        '& > :not(:last-child)': {
          borderColor: '#ef4444'
        }
      });
    });

    it('should handle arbitrary color values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'divide-x', 
        value: '#123456', 
        numeric: false, 
        important: false,
        arbitrary: true,
        arbitraryValue: '#123456'
      };
      expect(divideX(utility, mockContext)).toEqual({
        '& > :not(:last-child)': {
          borderColor: '#123456'
        }
      });
    });

    it('should handle arbitrary width values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'divide-x', 
        value: '3px', 
        numeric: false, 
        important: false,
        arbitrary: true,
        arbitraryValue: '3px'
      };
      expect(divideX(utility, mockContext)).toEqual({
        '& > :not(:last-child)': {
          borderInlineStartWidth: '0px',
          borderInlineEndWidth: '3px',
        }
      });
    });

    it('should handle style values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'divide-x', 
        value: 'dashed', 
        numeric: false, 
        important: false 
      };
      expect(divideX(utility, mockContext)).toEqual({
        '& > :not(:last-child)': {
          borderStyle: 'dashed'
        }
      });
    });

    it('should handle important flag', () => {
      const utility: ParsedClassToken = { 
        prefix: 'divide-x', 
        value: '2', 
        numeric: true, 
        important: true 
      };
      expect(divideX(utility, mockContext)).toEqual({
        '& > :not(:last-child)': {
          borderInlineStartWidth: '0px !important',
          borderInlineEndWidth: '2px !important',
        }
      });
    });
  });

  describe('divideY (vertical dividers)', () => {
    it('should handle no value (default 1px)', () => {
      const utility: ParsedClassToken = { 
        prefix: 'divide-y', 
        value: undefined, 
        numeric: false, 
        important: false 
      };
      expect(divideY(utility, mockContext)).toEqual({
        '& > :not(:last-child)': {
          borderTopWidth: '0px',
          borderBottomWidth: '1px',
        }
      });
    });

    it('should handle numeric values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'divide-y', 
        value: '2', 
        numeric: true, 
        important: false 
      };
      expect(divideY(utility, mockContext)).toEqual({
        '& > :not(:last-child)': {
          borderTopWidth: '0px',
          borderBottomWidth: '2px',
        }
      });
    });

    it('should handle zero value', () => {
      const utility: ParsedClassToken = { 
        prefix: 'divide-y', 
        value: '0', 
        numeric: false, 
        important: false 
      };
      expect(divideY(utility, mockContext)).toEqual({
        '& > :not(:last-child)': {
          borderTopWidth: '0px',
          borderBottomWidth: '0px',
        }
      });
    });

    it('should handle reverse', () => {
      const utility: ParsedClassToken = { 
        prefix: 'divide-y', 
        value: 'reverse', 
        numeric: false, 
        important: false 
      };
      expect(divideY(utility, mockContext)).toEqual({
        '--tw-divide-y-reverse': '1'
      });
    });

    it('should handle theme colors', () => {
      const utility: ParsedClassToken = { 
        prefix: 'divide-y', 
        value: 'blue-500', 
        numeric: false, 
        important: false 
      };
      expect(divideY(utility, mockContext)).toEqual({
        '& > :not(:last-child)': {
          borderColor: '#3b82f6'
        }
      });
    });

    it('should handle arbitrary color values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'divide-y', 
        value: '#abcdef', 
        numeric: false, 
        important: false,
        arbitrary: true,
        arbitraryValue: '#abcdef'
      };
      expect(divideY(utility, mockContext)).toEqual({
        '& > :not(:last-child)': {
          borderColor: '#abcdef'
        }
      });
    });

    it('should handle arbitrary width values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'divide-y', 
        value: '4px', 
        numeric: false, 
        important: false,
        arbitrary: true,
        arbitraryValue: '4px'
      };
      expect(divideY(utility, mockContext)).toEqual({
        '& > :not(:last-child)': {
          borderTopWidth: '0px',
          borderBottomWidth: '4px',
        }
      });
    });

    it('should handle style values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'divide-y', 
        value: 'solid', 
        numeric: false, 
        important: false 
      };
      expect(divideY(utility, mockContext)).toEqual({
        '& > :not(:last-child)': {
          borderStyle: 'solid'
        }
      });
    });

    it('should handle important flag', () => {
      const utility: ParsedClassToken = { 
        prefix: 'divide-y', 
        value: '3', 
        numeric: true, 
        important: true 
      };
      expect(divideY(utility, mockContext)).toEqual({
        '& > :not(:last-child)': {
          borderTopWidth: '0px !important',
          borderBottomWidth: '3px !important',
        }
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should return empty object for unknown style values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'divide-x', 
        value: 'unknown-style', 
        numeric: false, 
        important: false 
      };
      expect(divideX(utility, mockContext)).toEqual({});
    });

    it('should handle missing context gracefully', () => {
      const utility: ParsedClassToken = { 
        prefix: 'divide-x', 
        value: 'red-500', 
        numeric: false, 
        important: false 
      };
      const emptyContext = createContext({});
      expect(divideX(utility, emptyContext)).toEqual({});
    });
  });
}); 