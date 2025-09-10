import type { AstNode } from '../core/ast';
import { ParsedModifier, ParsedUtility } from '../core/parser';

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
  private cache = new Map<string, { modifiers: ParsedModifier[]; utility: ParsedUtility | null }>();
  private maxSize = 2000; // Prevent memory leaks
  
  set(key: string, result: { modifiers: ParsedModifier[]; utility: ParsedUtility | null }): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entries (simple LRU)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, result);
  }
  
  get(key: string): { modifiers: ParsedModifier[]; utility: ParsedUtility | null } | undefined {
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
  parseResultCache.clear();
  utilityCache.clear();
  // eslint-disable-next-line no-console
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