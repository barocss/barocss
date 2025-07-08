import { describe, it, expect } from 'vitest';
import type { ParsedClassToken } from '../../src/parser/utils';
import { createContext } from '../../src/config/context';
import type { CssmaConfig } from '../../src/theme-types';

// Import outline converters
import {
  outline,
  outlineOffset
} from '../../src/converter/cssmaps/outline';

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

describe('Outline Converters', () => {
  describe('outline (integrated)', () => {
    it('should handle no value (default to 1px)', () => {
      const utility: ParsedClassToken = { 
        prefix: 'outline', 
        value: '', 
        numeric: false, 
        important: false 
      };
      expect(outline(utility, mockContext)).toEqual({ outlineWidth: '1px' });
    });

    it('should handle numeric values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'outline', 
        value: '2', 
        numeric: true, 
        important: false 
      };
      expect(outline(utility, mockContext)).toEqual({ outlineWidth: '2px' });
    });

    it('should handle arbitrary width values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'outline', 
        value: '', 
        arbitrary: true,
        arbitraryValue: '3px',
        numeric: false, 
        important: false 
      };
      expect(outline(utility, mockContext)).toEqual({ outlineWidth: '3px' });
    });

    it('should handle arbitrary color values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'outline', 
        value: '', 
        arbitrary: true,
        arbitraryValue: '#ff0000',
        numeric: false, 
        important: false 
      };
      expect(outline(utility, mockContext)).toEqual({ outlineColor: '#ff0000' });
    });

    it('should handle arbitrary style values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'outline', 
        value: '', 
        arbitrary: true,
        arbitraryValue: 'dashed',
        numeric: false, 
        important: false 
      };
      expect(outline(utility, mockContext)).toEqual({ outlineStyle: 'dashed' });
    });

    it('should handle theme colors', () => {
      const utility: ParsedClassToken = { 
        prefix: 'outline', 
        value: 'red-500', 
        numeric: false, 
        important: false 
      };
      expect(outline(utility, mockContext)).toEqual({ outlineColor: '#ef4444' });
    });

    it('should handle outline styles', () => {
      const utility: ParsedClassToken = { 
        prefix: 'outline', 
        value: 'solid', 
        numeric: false, 
        important: false 
      };
      expect(outline(utility, mockContext)).toEqual({ outlineStyle: 'solid' });
    });

    it('should handle outline-hidden special case', () => {
      const utility: ParsedClassToken = { 
        prefix: 'outline', 
        value: 'hidden', 
        numeric: false, 
        important: false 
      };
      expect(outline(utility, mockContext)).toEqual({ 
        outline: '2px solid transparent',
        outlineOffset: '2px'
      });
    });

    it('should handle custom properties with type prefix', () => {
      const utility: ParsedClassToken = { 
        prefix: 'outline', 
        value: 'length:--my-width',
        customProperty: true,
        numeric: false, 
        important: false 
      };
      expect(outline(utility, mockContext)).toEqual({ outlineWidth: 'var(--my-width)' });
    });

    it('should handle custom properties for color', () => {
      const utility: ParsedClassToken = { 
        prefix: 'outline', 
        value: 'color:--my-color',
        customProperty: true,
        numeric: false, 
        important: false 
      };
      expect(outline(utility, mockContext)).toEqual({ outlineColor: 'var(--my-color)' });
    });

    it('should handle important flag', () => {
      const utility: ParsedClassToken = { 
        prefix: 'outline', 
        value: '2', 
        numeric: true, 
        important: true 
      };
      expect(outline(utility, mockContext)).toEqual({ outlineWidth: '2px !important' });
    });

    it('should handle CSS color keywords', () => {
      const utility: ParsedClassToken = { 
        prefix: 'outline', 
        value: 'transparent', 
        numeric: false, 
        important: false 
      };
      expect(outline(utility, mockContext)).toEqual({ outlineColor: 'transparent' });
    });
  });

  describe('outlineOffset', () => {
    it('should handle no value (default to 2px)', () => {
      const utility: ParsedClassToken = { 
        prefix: 'outline-offset', 
        value: '', 
        numeric: false, 
        important: false 
      };
      expect(outlineOffset(utility, mockContext)).toEqual({ outlineOffset: '2px' });
    });

    it('should handle numeric values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'outline-offset', 
        value: '4', 
        numeric: true, 
        important: false 
      };
      expect(outlineOffset(utility, mockContext)).toEqual({ outlineOffset: '4px' });
    });

    it('should handle zero value', () => {
      const utility: ParsedClassToken = { 
        prefix: 'outline-offset', 
        value: '0', 
        numeric: true, 
        important: false 
      };
      expect(outlineOffset(utility, mockContext)).toEqual({ outlineOffset: '0px' });
    });

    it('should handle negative values', () => {
      const utility: ParsedClassToken = { 
        prefix: '-outline-offset', 
        value: '-2', 
        numeric: false, 
        important: false 
      };
      expect(outlineOffset(utility, mockContext)).toEqual({ outlineOffset: 'calc(2px * -1)' });
    });

    it('should handle arbitrary values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'outline-offset', 
        value: '', 
        arbitrary: true,
        arbitraryValue: '3px',
        numeric: false, 
        important: false 
      };
      expect(outlineOffset(utility, mockContext)).toEqual({ outlineOffset: '3px' });
    });

    it('should handle custom properties', () => {
      const utility: ParsedClassToken = { 
        prefix: 'outline-offset', 
        value: '--my-offset',
        customProperty: true,
        numeric: false, 
        important: false 
      };
      expect(outlineOffset(utility, mockContext)).toEqual({ outlineOffset: 'var(--my-offset)' });
    });

    it('should handle important flag', () => {
      const utility: ParsedClassToken = { 
        prefix: 'outline-offset', 
        value: '4', 
        numeric: true, 
        important: true 
      };
      expect(outlineOffset(utility, mockContext)).toEqual({ outlineOffset: '4px !important' });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle undefined values gracefully', () => {
      const utility: ParsedClassToken = { 
        prefix: 'outline', 
        numeric: false, 
        important: false 
      };
      expect(outline(utility, mockContext)).toEqual({ outlineWidth: '1px' });
    });

    it('should handle non-existent theme colors', () => {
      const utility: ParsedClassToken = { 
        prefix: 'outline', 
        value: 'purple-999', 
        numeric: false, 
        important: false 
      };
      expect(outline(utility, mockContext)).toEqual({ outlineWidth: 'purple-999' });
    });

    it('should handle empty arbitrary values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'outline', 
        value: '', 
        arbitrary: true,
        arbitraryValue: '',
        numeric: false, 
        important: false 
      };
      expect(outline(utility, mockContext)).toEqual({});
    });

    it('should handle complex arbitrary values', () => {
      const utility: ParsedClassToken = { 
        prefix: 'outline', 
        value: '', 
        arbitrary: true,
        arbitraryValue: 'rgba(255,0,0,0.5)',
        numeric: false, 
        important: false 
      };
      expect(outline(utility, mockContext)).toEqual({ outlineColor: 'rgba(255,0,0,0.5)' });
    });
  });
}); 