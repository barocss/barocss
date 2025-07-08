import { describe, it, expect } from 'vitest';
import type { ParsedClassToken } from '../../src/parser/utils';
import type { CssmaContext } from '../../src/theme-types';

// Import border converters
import {
  border,
  borderT,
  borderR,
  borderB,
  borderL,
  borderX,
  borderY,
  borderS,
  borderE
} from '../../src/converter/cssmaps/border';

// Border color functions are integrated into border.ts - no separate imports needed

// Import rounded converters
import {
  rounded,
  roundedS,
  roundedE,
  roundedT,
  roundedR,
  roundedB,
  roundedL,
  roundedTl,
  roundedTr,
  roundedBr,
  roundedBl,
  roundedSs,
  roundedSe,
  roundedEs,
  roundedEe
} from '../../src/converter/cssmaps/rounded';

// Import divide converters
import {
  divideX,
  divideY
} from '../../src/converter/cssmaps/divide';

// Mock context for testing
const mockContext: CssmaContext = {
  theme: (category: string, value: string) => {
    if (category === 'colors') {
      const colorMap: Record<string, string> = {
        'red-500': '#f56565',
        'blue-600': '#3182ce',
        'gray-300': '#d2d6dc'
      };
      return colorMap[value];
    }
    if (category === 'borderRadius') {
      const radiusMap: Record<string, string> = {
        'none': '0px',
        'sm': '0.125rem',
        'md': '0.375rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        'full': '9999px'
      };
      return radiusMap[value];
    }
    return undefined;
  }
};

describe('Border Converters (Integrated)', () => {
  describe('border function (handles width, color, and style)', () => {
    it('should handle no value (default to 1px)', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: '', 
        numeric: false, 
        important: false 
      };
      expect(border(utility, mockContext)).toEqual({ borderWidth: '1px' });
    });

    it('should handle numeric values (width)', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: '2', 
        numeric: true, 
        important: false 
      };
      expect(border(utility, mockContext)).toEqual({ borderWidth: '2px' });
    });

    it('should handle zero value', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: '0', 
        numeric: false, 
        important: false 
      };
      expect(border(utility, mockContext)).toEqual({ borderWidth: '0' });
    });

    it('should handle theme colors', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: 'red-500', 
        numeric: false, 
        important: false 
      };
      expect(border(utility, mockContext)).toEqual({ borderColor: '#f56565' });
    });

    it('should handle border styles - solid', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: 'solid', 
        numeric: false, 
        important: false 
      };
      expect(border(utility, mockContext)).toEqual({ borderStyle: 'solid' });
    });

    it('should handle border styles - dashed', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: 'dashed', 
        numeric: false, 
        important: false 
      };
      expect(border(utility, mockContext)).toEqual({ borderStyle: 'dashed' });
    });

    it('should handle border styles - dotted', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: 'dotted', 
        numeric: false, 
        important: false 
      };
      expect(border(utility, mockContext)).toEqual({ borderStyle: 'dotted' });
    });

    it('should handle border styles - groove', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: 'groove', 
        numeric: false, 
        important: false 
      };
      expect(border(utility, mockContext)).toEqual({ borderStyle: 'groove' });
    });

    it('should handle border styles - ridge', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: 'ridge', 
        numeric: false, 
        important: false 
      };
      expect(border(utility, mockContext)).toEqual({ borderStyle: 'ridge' });
    });

    it('should handle border styles - inset', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: 'inset', 
        numeric: false, 
        important: false 
      };
      expect(border(utility, mockContext)).toEqual({ borderStyle: 'inset' });
    });

    it('should handle border styles - outset', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: 'outset', 
        numeric: false, 
        important: false 
      };
      expect(border(utility, mockContext)).toEqual({ borderStyle: 'outset' });
    });

    it('should handle arbitrary width values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: '', 
        numeric: false, 
        important: false,
        arbitrary: true,
        arbitraryValue: '3px'
      };
      expect(border(utility, mockContext)).toEqual({ borderWidth: '3px' });
    });

    it('should handle arbitrary color values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: '', 
        numeric: false, 
        important: false,
        arbitrary: true,
        arbitraryValue: '#123456'
      };
      expect(border(utility, mockContext)).toEqual({ borderColor: '#123456' });
    });

    it('should handle arbitrary style values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: '', 
        numeric: false, 
        important: false,
        arbitrary: true,
        arbitraryValue: 'groove'
      };
      expect(border(utility, mockContext)).toEqual({ borderStyle: 'groove' });
    });

    it('should handle custom properties', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: '--my-width', 
        numeric: false, 
        important: false,
        customProperty: true
      };
      expect(border(utility, mockContext)).toEqual({ borderWidth: 'var(--my-width)' });
    });

    it('should handle important flag', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: '2', 
        numeric: true, 
        important: true 
      };
      expect(border(utility, mockContext)).toEqual({ borderWidth: '2px !important' });
    });

    it('should handle important flag with colors', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: 'red-500', 
        numeric: false, 
        important: true 
      };
      expect(border(utility, mockContext)).toEqual({ borderColor: '#f56565 !important' });
    });

    it('should handle important flag with styles', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: 'solid', 
        numeric: false, 
        important: true 
      };
      expect(border(utility, mockContext)).toEqual({ borderStyle: 'solid !important' });
    });

    it('should return empty object for unknown values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: 'unknown-value', 
        numeric: false, 
        important: false 
      };
      expect(border(utility, mockContext)).toEqual({});
    });
  });

  describe('directional border functions', () => {
    it('should handle borderT with numeric values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border-t', 
        value: '2', 
        numeric: true, 
        important: false 
      };
      expect(borderT(utility, mockContext)).toEqual({ borderTopWidth: '2px' });
    });

    it('should handle borderT with colors', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border-t', 
        value: 'red-500', 
        numeric: false, 
        important: false 
      };
      expect(borderT(utility, mockContext)).toEqual({ borderTopColor: '#f56565' });
    });

    it('should handle borderT with styles', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border-t', 
        value: 'groove', 
        numeric: false, 
        important: false 
      };
      expect(borderT(utility, mockContext)).toEqual({ borderTopStyle: 'groove' });
    });

    it('should handle borderR with styles', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border-r', 
        value: 'ridge', 
        numeric: false, 
        important: false 
      };
      expect(borderR(utility, mockContext)).toEqual({ borderRightStyle: 'ridge' });
    });

    it('should handle borderB with styles', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border-b', 
        value: 'inset', 
        numeric: false, 
        important: false 
      };
      expect(borderB(utility, mockContext)).toEqual({ borderBottomStyle: 'inset' });
    });

    it('should handle borderL with styles', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border-l', 
        value: 'outset', 
        numeric: false, 
        important: false 
      };
      expect(borderL(utility, mockContext)).toEqual({ borderLeftStyle: 'outset' });
    });

    it('should handle borderX with styles', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border-x', 
        value: 'dashed', 
        numeric: false, 
        important: false 
      };
      expect(borderX(utility, mockContext)).toEqual({
        borderInlineStyle: 'dashed'
      });
    });

    it('should handle borderY with styles', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border-y', 
        value: 'dotted', 
        numeric: false, 
        important: false 
      };
      expect(borderY(utility, mockContext)).toEqual({
        borderBlockStyle: 'dotted'
      });
    });
  });
});

describe('Border Width Converters', () => {
  describe('border (from border-width.ts)', () => {
    it('should handle no value (default to 1px)', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: '', 
        numeric: false, 
        important: false 
      };
      expect(border(utility, mockContext)).toEqual({ borderWidth: '1px' });
    });

    it('should handle numeric values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: '2', 
        numeric: true, 
        important: false 
      };
      expect(border(utility, mockContext)).toEqual({ borderWidth: '2px' });
    });

    it('should handle zero value', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: '0', 
        numeric: false, 
        important: false 
      };
      expect(border(utility, mockContext)).toEqual({ borderWidth: '0' });
    });

    it('should handle arbitrary values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: '', 
        numeric: false, 
        important: false,
        arbitrary: true,
        arbitraryValue: '3px'
      };
      expect(border(utility, mockContext)).toEqual({ borderWidth: '3px' });
    });

    it('should handle custom properties', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: '--my-width', 
        numeric: false, 
        important: false,
        customProperty: true
      };
      expect(border(utility, mockContext)).toEqual({ borderWidth: 'var(--my-width)' });
    });

    it('should handle important flag', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border', 
        value: '2', 
        numeric: true, 
        important: true 
      };
      expect(border(utility, mockContext)).toEqual({ borderWidth: '2px !important' });
    });
  });

  describe('borderX (from border.ts)', () => {
    it('should handle numeric values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border-x', 
        value: '2', 
        numeric: true, 
        important: false 
      };
      expect(borderX(utility, mockContext)).toEqual({
        borderInlineWidth: '2px'
      });
    });
  });

  describe('borderY (from border.ts)', () => {
    it('should handle numeric values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border-y', 
        value: '2', 
        numeric: true, 
        important: false 
      };
      expect(borderY(utility, mockContext)).toEqual({
        borderBlockWidth: '2px'
      });
    });
  });

  describe('borderT (from border.ts)', () => {
    it('should handle numeric values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border-t', 
        value: '2', 
        numeric: true, 
        important: false 
      };
      expect(borderT(utility, mockContext)).toEqual({ borderTopWidth: '2px' });
    });
  });

  describe('borderR (from border.ts)', () => {
    it('should handle numeric values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border-r', 
        value: '2', 
        numeric: true, 
        important: false 
      };
      expect(borderR(utility, mockContext)).toEqual({ borderRightWidth: '2px' });
    });
  });

  describe('borderB (from border.ts)', () => {
    it('should handle numeric values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border-b', 
        value: '2', 
        numeric: true, 
        important: false 
      };
      expect(borderB(utility, mockContext)).toEqual({ borderBottomWidth: '2px' });
    });
  });

  describe('borderL (from border.ts)', () => {
    it('should handle numeric values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border-l', 
        value: '2', 
        numeric: true, 
        important: false 
      };
      expect(borderL(utility, mockContext)).toEqual({ borderLeftWidth: '2px' });
    });
  });

  describe('borderS (logical start from border-width.ts)', () => {
    it('should handle numeric values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border-s', 
        value: '2', 
        numeric: true, 
        important: false 
      };
      expect(borderS(utility, mockContext)).toEqual({ borderInlineStartWidth: '2px' });
    });
  });

  describe('borderE (logical end from border-width.ts)', () => {
    it('should handle numeric values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'border-e', 
        value: '2', 
        numeric: true, 
        important: false 
      };
      expect(borderE(utility, mockContext)).toEqual({ borderInlineEndWidth: '2px' });
    });
  });
});

describe('Border Radius Converters', () => {
  describe('rounded', () => {
    it('should handle no value (default to 0.25rem)', () => {
      const utility: ParsedClassToken = { 
        prefix: 'rounded', 
        value: '', 
        numeric: false, 
        important: false 
      };
      expect(rounded(utility, mockContext)).toEqual({ borderRadius: '0.25rem' });
    });

    it('should handle theme values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'rounded', 
        value: 'md', 
        numeric: false, 
        important: false 
      };
      expect(rounded(utility, mockContext)).toEqual({ borderRadius: '0.375rem' });
    });

    it('should handle arbitrary values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'rounded', 
        value: '', 
        numeric: false, 
        important: false,
        arbitrary: true,
        arbitraryValue: '4px'
      };
      expect(rounded(utility, mockContext)).toEqual({ borderRadius: '4px' });
    });

    it('should handle custom properties', () => {
      const utility: ParsedClassToken = { 
        prefix: 'rounded', 
        value: '--my-radius', 
        numeric: false, 
        important: false,
        customProperty: true
      };
      expect(rounded(utility, mockContext)).toEqual({ borderRadius: 'var(--my-radius)' });
    });

    it('should handle important flag', () => {
      const utility: ParsedClassToken = { 
        prefix: 'rounded', 
        value: 'md', 
        numeric: false, 
        important: true 
      };
      expect(rounded(utility, mockContext)).toEqual({ borderRadius: '0.375rem !important' });
    });
  });

  describe('roundedT', () => {
    it('should handle no value (default to 0.25rem)', () => {
      const utility: ParsedClassToken = { 
        prefix: 'rounded-t', 
        value: '', 
        numeric: false, 
        important: false 
      };
      expect(roundedT(utility, mockContext)).toEqual({
        borderTopLeftRadius: '0.25rem',
        borderTopRightRadius: '0.25rem'
      });
    });

    it('should handle theme values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'rounded-t', 
        value: 'md', 
        numeric: false, 
        important: false 
      };
      expect(roundedT(utility, mockContext)).toEqual({
        borderTopLeftRadius: '0.375rem',
        borderTopRightRadius: '0.375rem'
      });
    });
  });

  describe('roundedTl', () => {
    it('should handle no value (default to 0.25rem)', () => {
      const utility: ParsedClassToken = { 
        prefix: 'rounded-tl', 
        value: '', 
        numeric: false, 
        important: false 
      };
      expect(roundedTl(utility, mockContext)).toEqual({ borderTopLeftRadius: '0.25rem' });
    });

    it('should handle theme values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'rounded-tl', 
        value: 'md', 
        numeric: false, 
        important: false 
      };
      expect(roundedTl(utility, mockContext)).toEqual({ borderTopLeftRadius: '0.375rem' });
    });
  });

  describe('roundedTr', () => {
    it('should handle theme values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'rounded-tr', 
        value: 'md', 
        numeric: false, 
        important: false 
      };
      expect(roundedTr(utility, mockContext)).toEqual({ borderTopRightRadius: '0.375rem' });
    });
  });

  describe('roundedBr', () => {
    it('should handle theme values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'rounded-br', 
        value: 'md', 
        numeric: false, 
        important: false 
      };
      expect(roundedBr(utility, mockContext)).toEqual({ borderBottomRightRadius: '0.375rem' });
    });
  });

  describe('roundedBl', () => {
    it('should handle theme values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'rounded-bl', 
        value: 'md', 
        numeric: false, 
        important: false 
      };
      expect(roundedBl(utility, mockContext)).toEqual({ borderBottomLeftRadius: '0.375rem' });
    });
  });

  describe('Logical Property Functions', () => {
    describe('roundedSs', () => {
      it('should handle no value (default to 0.25rem)', () => {
        const utility: ParsedClassToken = { 
          prefix: 'rounded-ss', 
          value: '', 
          numeric: false, 
          important: false 
        };
        expect(roundedSs(utility, mockContext)).toEqual({ borderStartStartRadius: '0.25rem' });
      });

      it('should handle theme values', () => {
        const utility: ParsedClassToken = { 
          prefix: 'rounded-ss', 
          value: 'md', 
          numeric: false, 
          important: false 
        };
        expect(roundedSs(utility, mockContext)).toEqual({ borderStartStartRadius: '0.375rem' });
      });

      it('should handle arbitrary values', () => {
        const utility: ParsedClassToken = { 
          prefix: 'rounded-ss', 
          value: '', 
          numeric: false, 
          important: false,
          arbitrary: true,
          arbitraryValue: '8px'
        };
        expect(roundedSs(utility, mockContext)).toEqual({ borderStartStartRadius: '8px' });
      });
    });

    describe('roundedSe', () => {
      it('should handle no value (default to 0.25rem)', () => {
        const utility: ParsedClassToken = { 
          prefix: 'rounded-se', 
          value: '', 
          numeric: false, 
          important: false 
        };
        expect(roundedSe(utility, mockContext)).toEqual({ borderStartEndRadius: '0.25rem' });
      });

      it('should handle theme values', () => {
        const utility: ParsedClassToken = { 
          prefix: 'rounded-se', 
          value: 'lg', 
          numeric: false, 
          important: false 
        };
        expect(roundedSe(utility, mockContext)).toEqual({ borderStartEndRadius: '0.5rem' });
      });
    });

    describe('roundedEs', () => {
      it('should handle no value (default to 0.25rem)', () => {
        const utility: ParsedClassToken = { 
          prefix: 'rounded-es', 
          value: '', 
          numeric: false, 
          important: false 
        };
        expect(roundedEs(utility, mockContext)).toEqual({ borderEndStartRadius: '0.25rem' });
      });

      it('should handle custom properties', () => {
        const utility: ParsedClassToken = { 
          prefix: 'rounded-es', 
          value: '--my-radius', 
          numeric: false, 
          important: false,
          customProperty: true
        };
        expect(roundedEs(utility, mockContext)).toEqual({ borderEndStartRadius: 'var(--my-radius)' });
      });
    });

    describe('roundedEe', () => {
      it('should handle no value (default to 0.25rem)', () => {
        const utility: ParsedClassToken = { 
          prefix: 'rounded-ee', 
          value: '', 
          numeric: false, 
          important: false 
        };
        expect(roundedEe(utility, mockContext)).toEqual({ borderEndEndRadius: '0.25rem' });
      });

      it('should handle important flag', () => {
        const utility: ParsedClassToken = { 
          prefix: 'rounded-ee', 
          value: 'xl', 
          numeric: false, 
          important: true 
        };
        expect(roundedEe(utility, mockContext)).toEqual({ borderEndEndRadius: '0.75rem !important' });
      });
    });
  });
});

describe('Divide Converters', () => {
  describe('divideX', () => {
    it('should handle no value (default to 1px)', () => {
      const utility: ParsedClassToken = { 
        prefix: 'divide-x', 
        value: '', 
        numeric: false, 
        important: false 
      };
      expect(divideX(utility, mockContext)).toEqual({
        '& > :not(:last-child)': {
          borderInlineStartWidth: '0px',
          borderInlineEndWidth: '1px'
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
          borderInlineEndWidth: '2px'
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
          borderInlineEndWidth: '0px'
        }
      });
    });

    it('should handle arbitrary values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'divide-x', 
        value: '', 
        numeric: false, 
        important: false,
        arbitrary: true,
        arbitraryValue: '3px'
      };
      expect(divideX(utility, mockContext)).toEqual({
        '& > :not(:last-child)': {
          borderInlineStartWidth: '0px',
          borderInlineEndWidth: '3px'
        }
      });
    });
  });

  describe('divideY', () => {
    it('should handle no value (default to 1px)', () => {
      const utility: ParsedClassToken = { 
        prefix: 'divide-y', 
        value: '', 
        numeric: false, 
        important: false 
      };
      expect(divideY(utility, mockContext)).toEqual({
        '& > :not(:last-child)': {
          borderTopWidth: '0px',
          borderBottomWidth: '1px'
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
          borderBottomWidth: '2px'
        }
      });
    });
  });
});

describe('Edge Cases and Error Handling', () => {
  it('should handle undefined values gracefully', () => {
    const utility: ParsedClassToken = { 
      prefix: 'border', 
      value: undefined as any, 
      numeric: false, 
      important: false 
    };
    expect(border(utility, mockContext)).toEqual({ borderWidth: '1px' });
  });

  it('should handle empty context gracefully', () => {
    const emptyContext: CssmaContext = {
      theme: () => undefined
    };
    const utility: ParsedClassToken = { 
      prefix: 'border', 
      value: 'red-500', 
      numeric: false, 
      important: false 
    };
    expect(border(utility, emptyContext)).toEqual({});
  });

  it('should handle missing arbitraryValue', () => {
    const utility: ParsedClassToken = { 
      prefix: 'border', 
      value: '', 
      numeric: false, 
      important: false,
      arbitrary: true
      // arbitraryValue is missing
    };
    expect(border(utility, mockContext)).toEqual({});
  });

  it('should handle negative values for border width', () => {
    const utility: ParsedClassToken = { 
      prefix: 'border', 
      value: '2', 
      numeric: true, 
      important: false,
      negative: true
    };
    expect(border(utility, mockContext)).toEqual({ borderWidth: '-2px' });
  });
}); 