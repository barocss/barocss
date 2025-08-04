import { describe, it, expect, beforeEach } from 'vitest';
import "../src/presets"
import { IncrementalParser } from '../src/core/incremental-parser';
import { createContext } from '../src/core/context';
import { defaultTheme } from '../src/theme';

describe('IncrementalParser Universal Usage', () => {
  let parser: IncrementalParser;
  let ctx: any;

  beforeEach(() => {
    // Use default theme which has proper utilities registered
    ctx = createContext({
      theme: defaultTheme
    });
    
    // Create parser without StyleRuntime (universal mode)
    parser = new IncrementalParser(ctx);
  });

  describe('Universal methods', () => {
    it('should process classes without StyleRuntime dependency', () => {
      const results = parser.processClasses(['bg-blue-500', 'text-lg']);
      
      expect(results).toHaveLength(2);
      expect(results[0].className).toBe('bg-blue-500');
      expect(results[0].css).toContain('background-color');
      expect(results[1].className).toBe('text-lg');
      expect(results[1].css).toContain('font-size');
    });

    it('should process single class without StyleRuntime dependency', () => {
      const result = parser.processClass('bg-red-500');
      
      expect(result).not.toBeNull();
      expect(result?.css).toContain('background-color');
      expect(result?.css).toContain('oklch');
    });

    it('should track processed classes', () => {
      parser.processClass('bg-blue-500');
      
      expect(parser.isProcessed('bg-blue-500')).toBe(true);
      expect(parser.isProcessed('bg-red-500')).toBe(false);
    });

    it('should provide statistics', () => {
      parser.processClasses(['bg-blue-500', 'text-lg', 'p-4']);
      
      const stats = parser.getStats();
      
      expect(stats.processedClasses).toBe(3);
      expect(stats.pendingClasses).toBe(0);
      expect(stats.cacheStats.ast.size).toBeGreaterThan(0);
    });

    it('should handle empty class arrays', () => {
      const results = parser.processClasses([]);
      
      expect(results).toHaveLength(0);
    });

    it('should handle invalid class names gracefully', () => {
      const result = parser.processClass('invalid-class');
      
      expect(result).toBeNull();
    });

    it('should clear processed classes for theme changes', () => {
      parser.processClasses(['bg-blue-500', 'text-lg']);
      
      expect(parser.isProcessed('bg-blue-500')).toBe(true);
      
      parser.clearProcessed();
      
      expect(parser.isProcessed('bg-blue-500')).toBe(false);
      expect(parser.getStats().processedClasses).toBe(0);
    });

    it('should return all processed classes', () => {
      const classes = ['bg-blue-500', 'text-lg', 'p-4'];
      parser.processClasses(classes);
      
      const processed = parser.getProcessedClasses();
      
      expect(processed).toHaveLength(3);
      expect(processed).toContain('bg-blue-500');
      expect(processed).toContain('text-lg');
      expect(processed).toContain('p-4');
    });
  });

  describe('Performance', () => {
    it('should handle large class lists efficiently', () => {
      const largeClassList = Array.from({ length: 100 }, (_, i) => `bg-blue-500`);
      
      const startTime = Date.now();
      const results = parser.processClasses(largeClassList);
      const endTime = Date.now();
      
      expect(results).toHaveLength(1); // Only unique classes
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should avoid duplicate processing', () => {
      const classes = ['bg-blue-500', 'text-lg'];
      
      // Process same classes twice
      const results1 = parser.processClasses(classes);
      const results2 = parser.processClasses(classes);
      
      expect(results1).toHaveLength(2);
      expect(results2).toHaveLength(0); // Should be empty as classes already processed
    });
  });

  describe('Environment detection', () => {
    it('should work in Node.js environment', () => {
      // This test verifies that the parser works without browser APIs
      expect(typeof window).toBe('undefined');
      
      const result = parser.processClass('bg-blue-500');
      
      expect(result).not.toBeNull();
      expect(result?.css).toContain('background-color');
    });
  });
}); 