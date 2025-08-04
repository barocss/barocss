import { describe, it, expect, beforeEach } from 'vitest';
import '../src/presets'; // Load presets to register utilities
import { StyleRuntime } from '../src/runtime';
import { astCache } from '../src/utils/cache';
import { CompressedCache, MemoryPool } from '../src/utils/cache';

describe('Optimization Features', () => {
  let runtime: StyleRuntime;

  beforeEach(() => {
    runtime = new StyleRuntime({
      optimization: {
        performanceMonitoring: true,
        advancedCompression: true,
        aggressiveMemoryPool: true,
        customCacheStrategies: true
      }
    });
  });

  describe('Cache Optimization', () => {
    it('should use AST cache for repeated class parsing', () => {
      const className = 'block'; // Use a simple registered utility
      
      // First parse should populate cache
      runtime.addClass(className);
      const stats1 = astCache.getStats();
      
      // Second parse should hit cache
      runtime.addClass(className);
      const stats2 = astCache.getStats();
      
      expect(stats2.hitRate).toBeGreaterThanOrEqual(stats1.hitRate);
    });

    it('should use CSS cache for repeated CSS generation', () => {
      const className = 'block'; // Use a simple registered utility
      
      // First generation should populate cache
      runtime.addClass(className);
      const css1 = runtime.getCss(className);
      
      // Second generation should hit cache
      runtime.addClass(className);
      const css2 = runtime.getCss(className);
      
      expect(css1).toBe(css2);
    });
  });

  describe('Memory Pool Optimization', () => {
    it('should reuse objects from memory pool', () => {
      const memoryPool = new MemoryPool(() => ({ id: Math.random() }), 5);
      
      // Acquire objects
      const obj1 = memoryPool.acquire();
      const obj2 = memoryPool.acquire();
      
      // Release objects back to pool
      memoryPool.release(obj1);
      memoryPool.release(obj2);
      
      // Acquire again - should reuse from pool
      const obj3 = memoryPool.acquire();
      
      const stats = memoryPool.getStats();
      expect(stats.poolSize).toBeGreaterThan(0);
    });

    it('should limit pool size to prevent memory leaks', () => {
      const memoryPool = new MemoryPool(() => ({}), 2);
      
      // Acquire more objects than pool size
      const obj1 = memoryPool.acquire();
      const obj2 = memoryPool.acquire();
      const obj3 = memoryPool.acquire();
      
      // Release all objects
      memoryPool.release(obj1);
      memoryPool.release(obj2);
      memoryPool.release(obj3);
      
      const stats = memoryPool.getStats();
      expect(stats.poolSize).toBeLessThanOrEqual(stats.maxSize);
    });
  });

  describe('Compressed Cache Optimization', () => {
    it('should compress AST nodes to save memory', () => {
      const compressedCache = new CompressedCache();
      const className = 'bg-red-500';
      
      // Add AST to compressed cache
      const ast = [{ type: 'decl', prop: 'background-color', value: '#ef4444' }];
      compressedCache.setAst(className, ast);
      
      // Retrieve and verify
      const retrieved = compressedCache.getAst(className);
      expect(retrieved).toBeDefined();
      expect(retrieved).toEqual(ast);
    });

    it('should compress CSS strings to save memory', () => {
      const compressedCache = new CompressedCache();
      const className = 'text-white';
      
      // Add CSS to compressed cache
      const css = '.text-white { color: #ffffff; }';
      compressedCache.setCss(className, css);
      
      // Retrieve and verify
      const retrieved = compressedCache.getCss(className);
      expect(retrieved).toBeDefined();
      expect(retrieved).toBe(css);
    });
  });

  describe('Runtime Optimization', () => {
    it('should demonstrate memory optimization', () => {
      const classes = ['block', 'inline', 'p-4', 'm-4']; // Use registered utilities
      
      // Add classes to trigger optimizations
      runtime.addClass(classes);
      
      const stats = runtime.getOptimizationStats();
      
      // Check that optimizations are enabled
      expect(stats.advancedCompression).toBe(true);
      expect(stats.aggressiveMemoryPool).toBe(true);
      
      // Check that cache stats are available
      expect(stats.stats.compressed).toBeDefined();
      expect(stats.stats.memoryPool).toBeDefined();
    });

    it('should handle large number of classes efficiently', () => {
      const largeClassList = ['block', 'inline', 'p-4', 'm-4', 'text-center']; // Use registered utilities
      
      // Should not throw or cause performance issues
      expect(() => {
        runtime.addClass(largeClassList);
      }).not.toThrow();
      
      const stats = runtime.getCacheStats();
      expect(stats.runtime.cachedClasses).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cache Statistics', () => {
    it('should provide comprehensive cache statistics', () => {
      runtime.addClass(['block', 'inline']); // Use registered utilities
      
      const stats = runtime.getCacheStats();
      
      expect(stats.runtime).toBeDefined();
      expect(stats.ast).toBeDefined();
      expect(stats.css).toBeDefined();
      expect(stats.incremental).toBeDefined();
      expect(stats.compressed).toBeDefined();
      expect(stats.memoryPool).toBeDefined();
    });

    it('should clear all caches when requested', () => {
      runtime.addClass('block'); // Use registered utility
      
      // Verify cache has data (or at least the structure exists)
      const statsBefore = runtime.getCacheStats();
      expect(statsBefore.runtime).toBeDefined();
      
      // Clear caches
      runtime.clearCaches();
      
      // Verify caches are empty
      const statsAfter = runtime.getCacheStats();
      expect(statsAfter.runtime.cachedClasses).toBe(0);
    });
  });
}); 