import type { AstNode } from '../core/ast';

/**
 * CSS cache management
 */
export class CssCache {
  private cache = new Map<string, string>();
  private maxSize = 2000; // Prevent memory leaks
  
  set(key: string, css: string): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entries (simple LRU)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, css);
  }
  
  get(key: string): string | undefined {
    return this.cache.get(key);
  }
  
  has(key: string): boolean {
    return this.cache.has(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.cache.size / this.maxSize
    };
  }
}

// Global CSS cache instance
export const cssCache = new CssCache();

/**
 * AST cache management
 */
export class AstCache {
  private cache = new Map<string, AstNode[]>();
  private maxSize = 1000; // Prevent memory leaks
  
  set(key: string, ast: AstNode[]): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entries (simple LRU)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, ast);
  }
  
  get(key: string): AstNode[] | undefined {
    return this.cache.get(key);
  }
  
  has(key: string): boolean {
    return this.cache.has(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.cache.size / this.maxSize
    };
  }
}

// Global AST cache instance
export const astCache = new AstCache();

/**
 * Parse result cache management
 */
export class ParseResultCache {
  private cache = new Map<string, { modifiers: any[]; utility: any | null }>();
  private maxSize = 2000; // Prevent memory leaks
  
  set(key: string, result: { modifiers: any[]; utility: any | null }): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entries (simple LRU)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, result);
  }
  
  get(key: string): { modifiers: any[]; utility: any | null } | undefined {
    return this.cache.get(key);
  }
  
  has(key: string): boolean {
    return this.cache.has(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.cache.size / this.maxSize
    };
  }
}

// Global parse result cache instance
export const parseResultCache = new ParseResultCache();

/**
 * Utility cache management
 */
export class UtilityCache {
  private cache = new Map<string, boolean>();
  private maxSize = 1000; // Prevent memory leaks
  
  set(key: string, value: boolean): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entries (simple LRU)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }
  
  get(key: string): boolean | undefined {
    return this.cache.get(key);
  }
  
  has(key: string): boolean {
    return this.cache.has(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.cache.size / this.maxSize
    };
  }
}

// Global utility cache instance
export const utilityCache = new UtilityCache();

/**
 * Clear all caches (for context changes or testing)
 */
export function clearAllCaches(): void {
  astCache.clear();
  cssCache.clear();
  parseResultCache.clear();
  utilityCache.clear();
  console.log('[clearAllCaches] All caches cleared');
}

/**
 * WeakMap-based cache for memory optimization
 */
export class WeakCache<T> {
  private cache = new WeakMap<object, T>();
  private keyMap = new Map<string, object>();
  private maxSize = 1000;

  set(key: string, value: T): void {
    if (this.keyMap.size >= this.maxSize) {
      // Remove oldest entry
      const firstKey = this.keyMap.keys().next().value;
      if (firstKey) {
        const obj = this.keyMap.get(firstKey);
        if (obj) {
          this.cache.delete(obj);
        }
        this.keyMap.delete(firstKey);
      }
    }

    const obj = { key };
    this.cache.set(obj, value);
    this.keyMap.set(key, obj);
  }

  get(key: string): T | undefined {
    const obj = this.keyMap.get(key);
    if (obj) {
      return this.cache.get(obj);
    }
    return undefined;
  }

  has(key: string): boolean {
    return this.keyMap.has(key);
  }

  clear(): void {
    this.keyMap.clear();
  }

  getStats() {
    return {
      size: this.keyMap.size,
      maxSize: this.maxSize,
      hitRate: this.keyMap.size / this.maxSize
    };
  }
}

/**
 * Compressed cache for AST and CSS storage
 */
export class CompressedCache {
  private astCache = new WeakCache<AstNode[]>();
  private cssCache = new WeakCache<string>();
  private compressionEnabled = true;

  /**
   * Simple compression for AST nodes
   */
  private compressAst(ast: AstNode[]): AstNode[] {
    if (!this.compressionEnabled) return ast;

    return ast.map(node => {
      // Remove source property to save memory
      const { source, ...compressedNode } = node as any;
      return compressedNode;
    });
  }

  /**
   * Simple compression for CSS strings
   */
  private compressCss(css: string): string {
    if (!this.compressionEnabled) return css;
    
    // Remove unnecessary whitespace and comments
    return css
      .replace(/\s+/g, ' ')
      .replace(/\/\*.*?\*\//g, '')
      .trim();
  }

  /**
   * Decompress AST nodes
   */
  private decompressAst(ast: AstNode[]): AstNode[] {
    if (!this.compressionEnabled) return ast;

    return ast.map(node => ({
      ...node,
      source: undefined // Restore source property if needed
    }));
  }

  setAst(key: string, ast: AstNode[]): void {
    const compressed = this.compressAst(ast);
    this.astCache.set(key, compressed);
  }

  getAst(key: string): AstNode[] | undefined {
    const compressed = this.astCache.get(key);
    if (compressed) {
      return this.decompressAst(compressed);
    }
    return undefined;
  }

  setCss(key: string, css: string): void {
    const compressed = this.compressCss(css);
    this.cssCache.set(key, compressed);
  }

  getCss(key: string): string | undefined {
    return this.cssCache.get(key);
  }

  hasAst(key: string): boolean {
    return this.astCache.has(key);
  }

  hasCss(key: string): boolean {
    return this.cssCache.has(key);
  }

  clear(): void {
    this.astCache.clear();
    this.cssCache.clear();
  }

  getStats() {
    return {
      ast: this.astCache.getStats(),
      css: this.cssCache.getStats(),
      compressionEnabled: this.compressionEnabled
    };
  }

  setCompression(enabled: boolean): void {
    this.compressionEnabled = enabled;
  }
}

/**
 * Memory pool for efficient object reuse
 */
export class MemoryPool<T> {
  private pool: T[] = [];
  private maxSize = 100;
  private factory: () => T;

  constructor(factory: () => T, maxSize = 100) {
    this.factory = factory;
    this.maxSize = maxSize;
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.pool.push(obj);
    }
  }

  clear(): void {
    this.pool.length = 0;
  }

  getStats() {
    return {
      poolSize: this.pool.length,
      maxSize: this.maxSize
    };
  }
}

/**
 * Performance monitoring system
 */
export class PerformanceMonitor {
  private metrics = new Map<string, number[]>();
  private alerts = new Map<string, (metric: number) => void>();

  /**
   * Record a performance metric
   */
  record(metric: string, value: number): void {
    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, []);
    }
    this.metrics.get(metric)!.push(value);

    // Check for alerts
    const alert = this.alerts.get(metric);
    if (alert) {
      alert(value);
    }
  }

  /**
   * Get average for a metric
   */
  getAverage(metric: string): number {
    const values = this.metrics.get(metric);
    if (!values || values.length === 0) return 0;
    
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Get statistics for a metric
   */
  getStats(metric: string): { min: number; max: number; avg: number; count: number } {
    const values = this.metrics.get(metric);
    if (!values || values.length === 0) {
      return { min: 0, max: 0, avg: 0, count: 0 };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = this.getAverage(metric);

    return { min, max, avg, count: values.length };
  }

  /**
   * Set up performance alert
   */
  setAlert(metric: string, threshold: number, callback: (value: number) => void): void {
    this.alerts.set(metric, (value: number) => {
      if (value > threshold) {
        callback(value);
      }
    });
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, number[]> {
    return new Map(this.metrics);
  }
} 