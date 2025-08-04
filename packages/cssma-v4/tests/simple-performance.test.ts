import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseClassName } from '../src/core/parser';
import { astCache } from '../src/utils/cache';
import { astToCss, cssCache } from '../src/core/astToCss';

describe('Simple Performance Tests', () => {
  beforeEach(() => {
    // Clear caches before each test
    astCache.clear();
    cssCache.clear();
  });

  afterEach(() => {
    // Clear caches after each test
    astCache.clear();
    cssCache.clear();
  });

  describe('Parser Caching', () => {
    it('should cache parse results for identical class names', () => {
      const className = 'mt-4:hover:sm:dark';
      
      // First call - should be cache miss
      const start1 = performance.now();
      const result1 = parseClassName(className);
      const time1 = performance.now() - start1;
      
      // Second call - should be cache hit
      const start2 = performance.now();
      const result2 = parseClassName(className);
      const time2 = performance.now() - start2;
      
      expect(result1).toEqual(result2);
      expect(time2).toBeLessThan(time1); // Cache hit should be faster
      
      // Check that parse result cache is working
      expect(result1.utility).toBeDefined();
      expect(result1.modifiers.length).toBeGreaterThan(0);
    });

    it('should handle multiple different class names', () => {
      const classes = [
        'mt-4',
        'p-2',
        'hover:mb-6',
        'sm:dark:px-8',
        'ml-auto',
        'rounded-lg'
      ];
      
      // Parse all classes
      const start = performance.now();
      classes.forEach(cls => parseClassName(cls));
      const totalTime = performance.now() - start;
      
      expect(totalTime).toBeLessThan(100); // Should be fast
      
      // Verify all classes were parsed correctly
      classes.forEach(cls => {
        const result = parseClassName(cls);
        expect(result.utility).toBeDefined();
      });
    });
  });

  describe('Cache Management', () => {
    it('should respect cache size limits', () => {
      // Generate many unique classes to test cache size limits
      const classes = [];
      for (let i = 0; i < 1500; i++) {
        classes.push(`mt-${i}`);
      }
      
      // Parse all classes
      classes.forEach(cls => parseClassName(cls));
      
      const stats = astCache.getStats();
      expect(stats.size).toBeLessThanOrEqual(stats.maxSize);
    });

    it('should handle cache clearing', () => {
      const className = 'mt-4';
      
      // Parse and cache
      parseClassName(className);
      
      // Clear cache
      astCache.clear();
      cssCache.clear();
      
      // Check cache is empty
      const statsAfter = astCache.getStats();
      expect(statsAfter.size).toBe(0);
    });
  });

  describe('Cache Statistics', () => {
    it('should provide accurate cache statistics', () => {
      const className = 'mt-4';
      
      // Generate some cache entries
      parseClassName(className);
      
      const astStats = astCache.getStats();
      const cssStats = cssCache.getStats();
      
      expect(astStats).toHaveProperty('size');
      expect(astStats).toHaveProperty('maxSize');
      expect(astStats).toHaveProperty('hitRate');
      
      expect(cssStats).toHaveProperty('size');
      expect(cssStats).toHaveProperty('maxSize');
      expect(cssStats).toHaveProperty('hitRate');
    });
  });

  describe('Performance Benefits', () => {
    it('should demonstrate cache hit benefits', () => {
      const repeatedClass = 'mt-4:hover:sm:dark';
      
      // First run - cache miss
      const start1 = performance.now();
      for (let i = 0; i < 10; i++) {
        parseClassName(repeatedClass);
      }
      const time1 = performance.now() - start1;
      
      // Clear caches
      astCache.clear();
      cssCache.clear();
      
      // Second run - cache miss again
      const start2 = performance.now();
      for (let i = 0; i < 10; i++) {
        parseClassName(repeatedClass);
      }
      const time2 = performance.now() - start2;
      
      // Third run - should have cache hits
      const start3 = performance.now();
      for (let i = 0; i < 10; i++) {
        parseClassName(repeatedClass);
      }
      const time3 = performance.now() - start3;
      
      // Cache hits should be faster than cache misses
      expect(time3).toBeLessThan(time2);
      expect(time3).toBeLessThan(time1);
    });
  });
}); 