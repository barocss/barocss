import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/core/tokenizer';

describe('tokenize', () => {
  describe('basic tokenization', () => {
    it('should tokenize modifier:utility (traditional Tailwind)', () => {
      const tokens = tokenize('hover:bg-red-500');
      expect(tokens).toEqual([
        { value: 'hover', start: 0, end: 5 },
        { value: 'bg-red-500', start: 6, end: 16 }
      ]);
    });

    it('should tokenize utility:modifier (Master CSS style)', () => {
      const tokens = tokenize('bg-red-500:hover');
      expect(tokens).toEqual([
        { value: 'bg-red-500', start: 0, end: 10 },
        { value: 'hover', start: 11, end: 16 }
      ]);
    });

    it('should tokenize utility-only classes', () => {
      const tokens = tokenize('bg-red-500');
      expect(tokens).toEqual([
        { value: 'bg-red-500', start: 0, end: 10 }
      ]);
    });

    it('should tokenize multiple modifiers', () => {
      const tokens = tokenize('group-hover:focus:bg-red-500');
      expect(tokens).toEqual([
        { value: 'group-hover', start: 0, end: 11 },
        { value: 'focus', start: 12, end: 17 },
        { value: 'bg-red-500', start: 18, end: 28 }
      ]);
    });

    it('should tokenize utility with multiple modifiers', () => {
      const tokens = tokenize('bg-red-500:hover:focus');
      expect(tokens).toEqual([
        { value: 'bg-red-500', start: 0, end: 10 },
        { value: 'hover', start: 11, end: 16 },
        { value: 'focus', start: 17, end: 22 }
      ]);
    });

    it('should handle complex nested modifiers', () => {
      const tokens = tokenize('group-hover:focus-within:active:bg-red-500');
      expect(tokens).toEqual([
        { value: 'group-hover', start: 0, end: 11 },
        { value: 'focus-within', start: 12, end: 24 },
        { value: 'active', start: 25, end: 31 },
        { value: 'bg-red-500', start: 32, end: 42 }
      ]);
    });
  });

  describe('arbitrary values', () => {
    it('should handle arbitrary values in modifier:utility', () => {
      const tokens = tokenize('hover:bg-[#ff0000]');
      expect(tokens).toEqual([
        { value: 'hover', start: 0, end: 5 },
        { value: 'bg-[#ff0000]', start: 6, end: 18 }
      ]);
    });

    it('should handle arbitrary values in utility:modifier', () => {
      const tokens = tokenize('bg-[#ff0000]:hover');
      expect(tokens).toEqual([
        { value: 'bg-[#ff0000]', start: 0, end: 12 },
        { value: 'hover', start: 13, end: 18 }
      ]);
    });

    it('should handle nested colons in arbitrary values', () => {
      const tokens = tokenize('bg-[color:var(--foo)]:hover');
      expect(tokens).toEqual([
        { value: 'bg-[color:var(--foo)]', start: 0, end: 21 },
        { value: 'hover', start: 22, end: 27 }
      ]);
    });

    it('should handle multiple arbitrary values', () => {
      const tokens = tokenize('hover:bg-[#ff0000]:text-[#00ff00]');
      expect(tokens).toEqual([
        { value: 'hover', start: 0, end: 5 },
        { value: 'bg-[#ff0000]', start: 6, end: 18 },
        { value: 'text-[#00ff00]', start: 19, end: 33 }
      ]);
    });

    it('should handle arbitrary values with spaces', () => {
      const tokens = tokenize('bg-[linear-gradient(to right, #ff0000, #00ff00)]:hover');
      expect(tokens).toEqual([
        { value: 'bg-[linear-gradient(to right, #ff0000, #00ff00)]', start: 0, end: 48 },
        { value: 'hover', start: 49, end: 54 }
      ]);
    });

    it('should handle arbitrary values with nested brackets', () => {
      const tokens = tokenize('bg-[calc(100% - 20px)]:hover');
      expect(tokens).toEqual([
        { value: 'bg-[calc(100% - 20px)]', start: 0, end: 22 },
        { value: 'hover', start: 23, end: 28 }
      ]);
    });

    it('should handle arbitrary values with CSS functions', () => {
      const tokens = tokenize('bg-[url("data:image/svg+xml,%3csvg...")]:hover');
      expect(tokens).toEqual([
        { value: 'bg-[url("data:image/svg+xml,%3csvg...")]', start: 0, end: 40 },
        { value: 'hover', start: 41, end: 46 }
      ]);
    });
  });

  describe('custom properties', () => {
    it('should handle custom properties', () => {
      const tokens = tokenize('bg-(--my-bg):hover');
      expect(tokens).toEqual([
        { value: 'bg-(--my-bg)', start: 0, end: 12 },
        { value: 'hover', start: 13, end: 18 }
      ]);
    });

    it('should handle custom properties with nested parentheses', () => {
      const tokens = tokenize('bg-(calc(var(--spacing) + 10px)):hover');
      expect(tokens).toEqual([
        { value: 'bg-(calc(var(--spacing) + 10px))', start: 0, end: 32 },
        { value: 'hover', start: 33, end: 38 }
      ]);
    });

    it('should handle multiple custom properties', () => {
      const tokens = tokenize('text-(--primary):bg-(--secondary):hover');
      expect(tokens).toEqual([
        { value: 'text-(--primary)', start: 0, end: 16 },
        { value: 'bg-(--secondary)', start: 17, end: 33 },
        { value: 'hover', start: 34, end: 39 }
      ]);
    });
  });

  describe('negative values', () => {
    it('should handle negative utilities', () => {
      const tokens = tokenize('-mt-4:hover');
      expect(tokens).toEqual([
        { value: '-mt-4', start: 0, end: 5 },
        { value: 'hover', start: 6, end: 11 }
      ]);
    });

    it('should handle negative utilities with arbitrary values', () => {
      const tokens = tokenize('-mt-[20px]:hover');
      expect(tokens).toEqual([
        { value: '-mt-[20px]', start: 0, end: 10 },
        { value: 'hover', start: 11, end: 16 }
      ]);
    });

    it('should handle negative modifiers', () => {
      const tokens = tokenize('hover:-bg-red-500');
      expect(tokens).toEqual([
        { value: 'hover', start: 0, end: 5 },
        { value: '-bg-red-500', start: 6, end: 17 }
      ]);
    });
  });

  describe('complex nested structures', () => {
    it('should handle deeply nested arbitrary values', () => {
      const tokens = tokenize('bg-[linear-gradient(45deg, rgba(255,0,0,0.5), rgba(0,255,0,0.5))]:hover');
      expect(tokens).toEqual([
        { value: 'bg-[linear-gradient(45deg, rgba(255,0,0,0.5), rgba(0,255,0,0.5))]', start: 0, end: 65 },
        { value: 'hover', start: 66, end: 71 }
      ]);
    });

    it('should handle mixed arbitrary and custom properties', () => {
      const tokens = tokenize('bg-[#ff0000]:text-(--primary):hover');
      expect(tokens).toEqual([
        { value: 'bg-[#ff0000]', start: 0, end: 12 },
        { value: 'text-(--primary)', start: 13, end: 29 },
        { value: 'hover', start: 30, end: 35 }
      ]);
    });

    it('should handle complex modifier chains', () => {
      const tokens = tokenize('group-hover:focus-within:active:bg-[#ff0000]:text-(--primary)');
      expect(tokens).toEqual([
        { value: 'group-hover', start: 0, end: 11 },
        { value: 'focus-within', start: 12, end: 24 },
        { value: 'active', start: 25, end: 31 },
        { value: 'bg-[#ff0000]', start: 32, end: 44 },
        { value: 'text-(--primary)', start: 45, end: 61 }
      ]);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const tokens = tokenize('');
      expect(tokens).toEqual([]);
    });

    it('should handle single colon', () => {
      const tokens = tokenize(':');
      expect(tokens).toEqual([]);
    });

    it('should handle multiple colons', () => {
      const tokens = tokenize('hover::bg-red-500');
      expect(tokens).toEqual([
        { value: 'hover', start: 0, end: 5 },
        { value: 'bg-red-500', start: 7, end: 17 }
      ]);
    });

    it('should handle leading colon', () => {
      const tokens = tokenize(':bg-red-500');
      expect(tokens).toEqual([
        { value: 'bg-red-500', start: 1, end: 11 }
      ]);
    });

    it('should handle trailing colon', () => {
      const tokens = tokenize('hover:');
      expect(tokens).toEqual([
        { value: 'hover', start: 0, end: 5 }
      ]);
    });

    it('should handle only colons', () => {
      const tokens = tokenize(':::');
      expect(tokens).toEqual([]);
    });

    it('should handle whitespace around colons', () => {
      const tokens = tokenize('hover : bg-red-500');
      expect(tokens).toEqual([
        { value: 'hover ', start: 0, end: 6 },
        { value: ' bg-red-500', start: 7, end: 18 }
      ]);
    });
  });

  describe('special characters', () => {
    it('should handle dots in class names', () => {
      const tokens = tokenize('group.hover:bg-red-500');
      expect(tokens).toEqual([
        { value: 'group.hover', start: 0, end: 11 },
        { value: 'bg-red-500', start: 12, end: 22 }
      ]);
    });

    it('should handle underscores in class names', () => {
      const tokens = tokenize('dark_mode:bg-red-500');
      expect(tokens).toEqual([
        { value: 'dark_mode', start: 0, end: 9 },
        { value: 'bg-red-500', start: 10, end: 20 }
      ]);
    });

    it('should handle hyphens in class names', () => {
      const tokens = tokenize('focus-within:bg-red-500');
      expect(tokens).toEqual([
        { value: 'focus-within', start: 0, end: 12 },
        { value: 'bg-red-500', start: 13, end: 23 }
      ]);
    });

    it('should handle numbers in class names', () => {
      const tokens = tokenize('md:bg-red-500');
      expect(tokens).toEqual([
        { value: 'md', start: 0, end: 2 },
        { value: 'bg-red-500', start: 3, end: 13 }
      ]);
    });
  });

  describe('performance edge cases', () => {
    it('should handle very long class names', () => {
      const longClass = 'a'.repeat(1000) + ':' + 'b'.repeat(1000);
      const tokens = tokenize(longClass);
      expect(tokens).toHaveLength(2);
      expect(tokens[0].value).toBe('a'.repeat(1000));
      expect(tokens[1].value).toBe('b'.repeat(1000));
    });

    it('should handle many colons', () => {
      const manyColons = 'a:b:c:d:e:f:g:h:i:j';
      const tokens = tokenize(manyColons);
      expect(tokens).toHaveLength(10);
      expect(tokens.map(t => t.value)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']);
    });

    it('should handle deeply nested brackets', () => {
      const nested = 'bg-[calc(100% - (20px + (10px * 2)))]:hover';
      const tokens = tokenize(nested);
      expect(tokens).toHaveLength(2);
      expect(tokens[0].value).toBe('bg-[calc(100% - (20px + (10px * 2)))]');
      expect(tokens[1].value).toBe('hover');
    });
  });

  describe('Tailwind v4 advanced features', () => {
    it('should handle container queries', () => {
      const tokens = tokenize('@container:bg-red-500');
      expect(tokens).toEqual([
        { value: '@container', start: 0, end: 10 },
        { value: 'bg-red-500', start: 11, end: 21 }
      ]);
    });

    it('should handle container query with size', () => {
      const tokens = tokenize('@container/sidebar:bg-blue-500');
      expect(tokens).toEqual([
        { value: '@container/sidebar', start: 0, end: 18 },
        { value: 'bg-blue-500', start: 19, end: 30 }
      ]);
    });

    it('should handle arbitrary container queries', () => {
      const tokens = tokenize('@container/[800px]:bg-green-500');
      expect(tokens).toEqual([
        { value: '@container/[800px]', start: 0, end: 18 },
        { value: 'bg-green-500', start: 19, end: 31 }
      ]);
    });

    it('should handle complex container queries', () => {
      const tokens = tokenize('@container/[min(800px,50vw)]:bg-purple-500');
      expect(tokens).toEqual([
        { value: '@container/[min(800px,50vw)]', start: 0, end: 28 },
        { value: 'bg-purple-500', start: 29, end: 42 }
      ]);
    });

    it('should handle logical properties', () => {
      const tokens = tokenize('hover:margin-inline-start-4');
      expect(tokens).toEqual([
        { value: 'hover', start: 0, end: 5 },
        { value: 'margin-inline-start-4', start: 6, end: 27 }
      ]);
    });

    it('should handle logical properties with arbitrary values', () => {
      const tokens = tokenize('focus:margin-inline-[20px]');
      expect(tokens).toEqual([
        { value: 'focus', start: 0, end: 5 },
        { value: 'margin-inline-[20px]', start: 6, end: 26 }
      ]);
    });

    it('should handle CSS Grid template areas', () => {
      const tokens = tokenize('grid-areas-[header_main_footer]:hover');
      expect(tokens).toEqual([
        { value: 'grid-areas-[header_main_footer]', start: 0, end: 31 },
        { value: 'hover', start: 32, end: 37 }
      ]);
    });

    it('should handle complex grid template areas', () => {
      const tokens = tokenize('grid-areas-["header header" "main sidebar" "footer footer"]:focus');
      expect(tokens).toEqual([
        { value: 'grid-areas-["header header" "main sidebar" "footer footer"]', start: 0, end: 59 },
        { value: 'focus', start: 60, end: 65 }
      ]);
    });

    it('should handle CSS Grid line names', () => {
      const tokens = tokenize('grid-cols-[sidebar-start_main-start_sidebar-end_main-end]:active');
      expect(tokens).toEqual([
        { value: 'grid-cols-[sidebar-start_main-start_sidebar-end_main-end]', start: 0, end: 57 },
        { value: 'active', start: 58, end: 64 }
      ]);
    });

    it('should handle CSS Grid line names with spaces', () => {
      const tokens = tokenize('grid-cols-["sidebar-start" "main-start" "sidebar-end" "main-end"]:hover');
      expect(tokens).toEqual([
        { value: 'grid-cols-["sidebar-start" "main-start" "sidebar-end" "main-end"]', start: 0, end: 65 },
        { value: 'hover', start: 66, end: 71 }
      ]);
    });

    it('should handle CSS Grid line names with arbitrary values', () => {
      const tokens = tokenize('grid-cols-[sidebar-start_1fr_main-start_2fr_sidebar-end_1fr_main-end_2fr]:focus');
      expect(tokens).toEqual([
        { value: 'grid-cols-[sidebar-start_1fr_main-start_2fr_sidebar-end_1fr_main-end_2fr]', start: 0, end: 73 },
        { value: 'focus', start: 74, end: 79 }
      ]);
    });

    it('should handle CSS Grid line names with complex values', () => {
      const tokens = tokenize('grid-cols-["sidebar-start" minmax(200px,1fr) "main-start" 2fr "sidebar-end" minmax(200px,1fr) "main-end" 2fr]:active');
      expect(tokens).toEqual([
        { value: 'grid-cols-["sidebar-start" minmax(200px,1fr) "main-start" 2fr "sidebar-end" minmax(200px,1fr) "main-end" 2fr]', start: 0, end: 109 },
        { value: 'active', start: 110, end: 116 }
      ]);
    });

    it('should handle CSS Grid line names with nested functions', () => {
      const tokens = tokenize('grid-cols-[sidebar-start_calc(100%-200px)_main-start_200px_sidebar-end_calc(100%-200px)_main-end_200px]:hover');
      expect(tokens).toEqual([
        { value: 'grid-cols-[sidebar-start_calc(100%-200px)_main-start_200px_sidebar-end_calc(100%-200px)_main-end_200px]', start: 0, end: 103 },
        { value: 'hover', start: 104, end: 109 }
      ]);
    });

    it('should handle CSS Grid line names with custom properties', () => {
      const tokens = tokenize('grid-cols-[sidebar-start_var(--sidebar-width)_main-start_var(--main-width)_sidebar-end_var(--sidebar-width)_main-end_var(--main-width)]:focus');
      expect(tokens).toEqual([
        { value: 'grid-cols-[sidebar-start_var(--sidebar-width)_main-start_var(--main-width)_sidebar-end_var(--sidebar-width)_main-end_var(--main-width)]', start: 0, end: 135 },
        { value: 'focus', start: 136, end: 141 }
      ]);
    });

    it('should handle CSS Grid line names with mixed values', () => {
      const tokens = tokenize('grid-cols-["sidebar-start" var(--sidebar-width) "main-start" calc(100%-var(--sidebar-width)) "sidebar-end" var(--sidebar-width) "main-end" calc(100%-var(--sidebar-width))]:active');
      expect(tokens).toEqual([
        { value: 'grid-cols-["sidebar-start" var(--sidebar-width) "main-start" calc(100%-var(--sidebar-width)) "sidebar-end" var(--sidebar-width) "main-end" calc(100%-var(--sidebar-width))]', start: 0, end: 171 },
        { value: 'active', start: 172, end: 178 }
      ]);
    });

    it('should handle CSS Grid line names with arbitrary values and modifiers', () => {
      const tokens = tokenize('hover:focus:grid-cols-[sidebar-start_1fr_main-start_2fr_sidebar-end_1fr_main-end_2fr]:active');
      expect(tokens).toEqual([
        { value: 'hover', start: 0, end: 5 },
        { value: 'focus', start: 6, end: 11 },
        { value: 'grid-cols-[sidebar-start_1fr_main-start_2fr_sidebar-end_1fr_main-end_2fr]', start: 12, end: 85 },
        { value: 'active', start: 86, end: 92 }
      ]);
    });

    it('should handle CSS Grid line names with utility:modifier syntax', () => {
      const tokens = tokenize('grid-cols-[sidebar-start_1fr_main-start_2fr_sidebar-end_1fr_main-end_2fr]:hover:focus');
      expect(tokens).toEqual([
        { value: 'grid-cols-[sidebar-start_1fr_main-start_2fr_sidebar-end_1fr_main-end_2fr]', start: 0, end: 73 },
        { value: 'hover', start: 74, end: 79 },
        { value: 'focus', start: 80, end: 85 }
      ]);
    });

    it('should handle CSS Grid line names with complex nested structures', () => {
      const tokens = tokenize('grid-cols-["sidebar-start" minmax(200px,calc(100%-var(--main-width))) "main-start" var(--main-width) "sidebar-end" minmax(200px,calc(100%-var(--main-width))) "main-end" var(--main-width)]:hover');
      expect(tokens).toEqual([
        { value: 'grid-cols-["sidebar-start" minmax(200px,calc(100%-var(--main-width))) "main-start" var(--main-width) "sidebar-end" minmax(200px,calc(100%-var(--main-width))) "main-end" var(--main-width)]', start: 0, end: 187 },
        { value: 'hover', start: 188, end: 193 }
      ]);
    });

    it('should handle CSS Grid line names with multiple arbitrary values', () => {
      const tokens = tokenize('grid-cols-[sidebar-start_1fr_main-start_2fr]:grid-rows-[header_1fr_footer]:hover');
      expect(tokens).toEqual([
        { value: 'grid-cols-[sidebar-start_1fr_main-start_2fr]', start: 0, end: 44 },
        { value: 'grid-rows-[header_1fr_footer]', start: 45, end: 74 },
        { value: 'hover', start: 75, end: 80 }
      ]);
    });

    it('should handle CSS Grid line names with custom properties and arbitrary values', () => {
      const tokens = tokenize('grid-cols-[sidebar-start_var(--sidebar-width)_main-start_calc(100%-var(--sidebar-width))]:grid-rows-[header_var(--header-height)_main_calc(100%-var(--header-height)-var(--footer-height))_footer_var(--footer-height)]:focus');
      expect(tokens).toEqual([
        { value: 'grid-cols-[sidebar-start_var(--sidebar-width)_main-start_calc(100%-var(--sidebar-width))]', start: 0, end: 89 },
        { value: 'grid-rows-[header_var(--header-height)_main_calc(100%-var(--header-height)-var(--footer-height))_footer_var(--footer-height)]', start: 90, end: 215 },
        { value: 'focus', start: 216, end: 221 }
      ]);
    });

    it('should handle CSS Grid line names with complex nested functions and custom properties', () => {
      const tokens = tokenize('grid-cols-["sidebar-start" minmax(200px,calc(100%-var(--main-width))) "main-start" var(--main-width) "sidebar-end" minmax(200px,calc(100%-var(--main-width))) "main-end" var(--main-width)]:grid-rows-["header-start" var(--header-height) "header-end" "main-start" calc(100%-var(--header-height)-var(--footer-height)) "main-end" "footer-start" var(--footer-height) "footer-end"]:active');
      expect(tokens).toEqual([
        { value: 'grid-cols-["sidebar-start" minmax(200px,calc(100%-var(--main-width))) "main-start" var(--main-width) "sidebar-end" minmax(200px,calc(100%-var(--main-width))) "main-end" var(--main-width)]', start: 0, end: 187 },
        { value: 'grid-rows-["header-start" var(--header-height) "header-end" "main-start" calc(100%-var(--header-height)-var(--footer-height)) "main-end" "footer-start" var(--footer-height) "footer-end"]', start: 188, end: 374 },
        { value: 'active', start: 375, end: 381 }
      ]);
    });

    it('should handle CSS Grid line names with multiple modifiers and utilities', () => {
      const tokens = tokenize('hover:focus:grid-cols-[sidebar-start_1fr_main-start_2fr_sidebar-end_1fr_main-end_2fr]:grid-rows-[header_1fr_footer]:active:bg-red-500');
      expect(tokens).toEqual([
        { value: 'hover', start: 0, end: 5 },
        { value: 'focus', start: 6, end: 11 },
        { value: 'grid-cols-[sidebar-start_1fr_main-start_2fr_sidebar-end_1fr_main-end_2fr]', start: 12, end: 85 },
        { value: 'grid-rows-[header_1fr_footer]', start: 86, end: 115 },
        { value: 'active', start: 116, end: 122 },
        { value: 'bg-red-500', start: 123, end: 133 }
      ]);
    });

    it('should handle CSS Grid line names with utility:modifier syntax and multiple utilities', () => {
      const tokens = tokenize('grid-cols-[sidebar-start_1fr_main-start_2fr_sidebar-end_1fr_main-end_2fr]:grid-rows-[header_1fr_footer]:hover:focus:bg-red-500');
      expect(tokens).toEqual([
        { value: 'grid-cols-[sidebar-start_1fr_main-start_2fr_sidebar-end_1fr_main-end_2fr]', start: 0, end: 73 },
        { value: 'grid-rows-[header_1fr_footer]', start: 74, end: 103 },
        { value: 'hover', start: 104, end: 109 },
        { value: 'focus', start: 110, end: 115 },
        { value: 'bg-red-500', start: 116, end: 126 }
      ]);
    });

    it('should handle ultimate complex scenario with all Tailwind v4 features', () => {
      const tokens = tokenize('@container/sidebar:hover:focus:grid-cols-["sidebar-start" minmax(200px,calc(100%-var(--main-width))) "main-start" var(--main-width)]:grid-rows-["header-start" var(--header-height) "main-start" calc(100%-var(--header-height)-var(--footer-height)) "footer-start" var(--footer-height)]:bg-[linear-gradient(45deg, rgba(255,0,0,0.5), rgba(0,255,0,0.5))]:text-(--primary):active');
      expect(tokens).toEqual([
        { value: '@container/sidebar', start: 0, end: 18 },
        { value: 'hover', start: 19, end: 24 },
        { value: 'focus', start: 25, end: 30 },
        { value: 'grid-cols-["sidebar-start" minmax(200px,calc(100%-var(--main-width))) "main-start" var(--main-width)]', start: 31, end: 132 },
        { value: 'grid-rows-["header-start" var(--header-height) "main-start" calc(100%-var(--header-height)-var(--footer-height)) "footer-start" var(--footer-height)]', start: 133, end: 282 },
        { value: 'bg-[linear-gradient(45deg, rgba(255,0,0,0.5), rgba(0,255,0,0.5))]', start: 283, end: 348 },
        { value: 'text-(--primary)', start: 349, end: 365 },
        { value: 'active', start: 366, end: 372 }
      ]);
    });
  });
}); 