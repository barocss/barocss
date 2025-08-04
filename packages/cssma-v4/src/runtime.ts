import { createContext } from './core/context';
import { defaultTheme } from './theme';
import { astCache } from './utils/cache';
import { cssCache } from './utils/cache';
import { IncrementalParser, ChangeDetector } from './core/incremental-parser';
import { CompressedCache, MemoryPool } from './utils/cache';

export interface StyleRuntimeOptions {
  theme?: any;
  styleId?: string;
  enableDev?: boolean;
  insertionPoint?: 'head' | 'body' | HTMLElement;
  cacheSize?: {
    ast?: number;
    css?: number;
    parseResult?: number;
  };
  optimization?: {
    // 기본 최적화 (항상 활성화)
    performanceMonitoring?: boolean;
    
    // 고급 최적화 (선택적)
    advancedCompression?: boolean;  // 더 강력한 압축
    aggressiveMemoryPool?: boolean; // 더 적극적인 메모리 풀 사용
    customCacheStrategies?: boolean; // 사용자 정의 캐시 전략
  };
}

export class StyleRuntime {
  private styleEl: HTMLStyleElement | null = null;
  private styleRootEl: HTMLStyleElement | null = null;
  private styleCssVarsEl: HTMLStyleElement | null = null;
  private sheet: CSSStyleSheet | null = null;
  private rootSheet: CSSStyleSheet | null = null;
  private cache: Map<string, string> = new Map(); // class name -> generated CSS mapping
  private rootCache: Set<string> = new Set(); // class name -> generated CSS mapping
  private context: any;
  private options: Required<StyleRuntimeOptions>;
  private isDestroyed = false;

  // Optimization components
  private incrementalParser: IncrementalParser;
  private changeDetector: ChangeDetector;
  private compressedCache: CompressedCache;
  private memoryPool: MemoryPool<any>;

  constructor(options: StyleRuntimeOptions = {}) {
    this.options = {
      theme: options.theme || defaultTheme,
      styleId: options.styleId || 'cssma-runtime',
      enableDev: options.enableDev ?? (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development'),
      insertionPoint: options.insertionPoint || 'head',
      cacheSize: {
        ast: options.cacheSize?.ast || 1000,
        css: options.cacheSize?.css || 2000,
        parseResult: options.cacheSize?.parseResult || 500
      },
      optimization: {
        // 기본 최적화 (항상 활성화)
        performanceMonitoring: options.optimization?.performanceMonitoring ?? true,
        
        // 고급 최적화 (선택적)
        advancedCompression: options.optimization?.advancedCompression ?? false,
        aggressiveMemoryPool: options.optimization?.aggressiveMemoryPool ?? false,
        customCacheStrategies: options.optimization?.customCacheStrategies ?? false
      }
    };

    this.context = createContext({ theme: this.options.theme });

    // Initialize optimization components
    this.incrementalParser = new IncrementalParser(this.context);
    this.changeDetector = new ChangeDetector(this.incrementalParser, this);
    this.compressedCache = new CompressedCache();
    this.memoryPool = new MemoryPool(() => ({}), 100);

    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private init() {
    this.ensureCssVars();
    this.ensureSheet();
    if (this.options.enableDev && typeof window !== 'undefined') {
      this.setupHMR();
    }
  }

  /**
   * Common method to create and insert style elements into DOM
   */
  private createStyleElement(id: string, content?: string): HTMLStyleElement {
    let styleEl = document.getElementById(id) as HTMLStyleElement;
    
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = id;
      styleEl.setAttribute('data-cssma', 'runtime');
      
      if (content) {
        styleEl.textContent = content;
      }
      
      const insertionPoint = this.getInsertionPoint();
      insertionPoint.appendChild(styleEl);
      console.log(`[StyleRuntime] ${id} created and appended`, styleEl);
    }
    
    return styleEl;
  }

  /**
   * Safely get CSSStyleSheet from style element
   */
  private getStyleSheet(styleEl: HTMLStyleElement): CSSStyleSheet | null {
    try {
      return styleEl.sheet as CSSStyleSheet;
    } catch (error) {
      console.warn('[StyleRuntime] Failed to get stylesheet for', styleEl.id, error);
      return null;
    }
  }

  /**
   * Safely remove style element
   */
  private removeStyleElement(styleEl: HTMLStyleElement | null): void {
    if (styleEl && styleEl.parentNode) {
      styleEl.parentNode.removeChild(styleEl);
    }
  }

  private ensureCssVars() {
    if (this.isDestroyed) return;

    if (!this.styleCssVarsEl) {
      const cssVars = this.context.themeToCssVars();
      this.styleCssVarsEl = this.createStyleElement(
        `${this.options.styleId}-css-vars`,
        cssVars
      );
      console.log('[StyleRuntime] styleCssVarsEl created', cssVars);
    }
  }

  private ensureSheet() {
    if (this.isDestroyed) return;
    
    if (!this.styleEl) {
      this.styleEl = this.createStyleElement(this.options.styleId);
    }
    
    if (!this.styleRootEl) {
      this.styleRootEl = this.createStyleElement(`${this.options.styleId}-root`);
    }
    
    if (!this.sheet && this.styleEl) {
      this.sheet = this.getStyleSheet(this.styleEl);
      console.log('[StyleRuntime] sheet initialized', this.sheet);
    }
    
    if (!this.rootSheet && this.styleRootEl) {
      this.rootSheet = this.getStyleSheet(this.styleRootEl);
      console.log('[StyleRuntime] rootSheet initialized', this.rootSheet);
    }
  }

  private getInsertionPoint(): HTMLElement {
    if (this.options.insertionPoint instanceof HTMLElement) {
      return this.options.insertionPoint;
    }
    switch (this.options.insertionPoint) {
      case 'body':
        return document.body || document.head;
      case 'head':
      default:
        return document.head;
    }
  }

  private setupHMR() {
    if (typeof module !== 'undefined' && (module as any).hot) {
      (module as any).hot.accept('./theme', () => {
        this.updateTheme(defaultTheme);
      });
    }
  }

  /**
   * Dynamically add one or more class names and generate/insert CSS
   * Optimizations: batch processing, deduplication, cache checking, common CSS caching
   */
  addClass(classes: string | string[]): void {
    if (this.isDestroyed) return;

    const isBrowser = typeof window !== 'undefined';
    
    if (isBrowser) {
      this.ensureSheet();
    }
    
    const classList = this.normalizeClasses(classes);
    // console.log('[StyleRuntime] addClass called with:', classList);
    
    this.processClasses(classList);
  }

  /**
   * Process classes with performance monitoring
   */
  private processClasses(classList: string[]): void {
    const isBrowser = typeof window !== 'undefined';
    
    // 기본적으로 incremental parsing 사용 (항상 활성화)
    // console.log('[StyleRuntime] Using incremental parsing');
    
    this.processClassesIncremental(classList);
  }

  /**
   * Process classes using incremental parsing
   */
  private processClassesIncremental(classList: string[]): void {
    const isBrowser = typeof window !== 'undefined';
    
    // Process classes immediately for testing environment
    const results = this.incrementalParser.processClasses(classList);
    // console.log('[StyleRuntime] Incremental parser results:', results.length);
    
    // Add processed results to cache and generate CSS
    const cssRules: string[] = [];
    const rootCssRules: string[] = [];
    
    for (const result of results) {
      if (result.css) {
        cssRules.push(result.css);
        this.cache.set(result.className, result.css);
        // console.log('[StyleRuntime] Added to cache:', result.className);
        
        // Use compressed cache if enabled
        if (this.options.optimization.advancedCompression) {
          this.compressedCache.setAst(result.className, result.ast);
          this.compressedCache.setCss(result.className, result.css);
        }
        
        // Use memory pool if enabled
        if (this.options.optimization.aggressiveMemoryPool) {
          const obj = this.memoryPool.acquire();
          // Use the object briefly and then release it back to the pool
          this.memoryPool.release(obj);
        }
      }
    }
    
    // Insert CSS in batch only in browser environment
    if (cssRules.length > 0 && isBrowser) {
      this.insertRules(cssRules);
      // console.log('[StyleRuntime] Incremental processed', { 
      //   processed: results.length,
      //   classes: results.map(r => r.className) 
      // });
    }
    
    if (rootCssRules.length > 0 && isBrowser) {
      this.insertRootRules(rootCssRules.filter(Boolean));
    }
  }

  /**
   * MutationObserver instance method to automatically call addClass when class attributes change in DOM
   * Optimizations: debouncing, deduplication, batch processing
   */
  observe(root: HTMLElement = document.body, options?: { scan?: boolean; debounceMs?: number }): MutationObserver {
    console.log('[StyleRuntime] observe called', { root, options });
    
    // ChangeDetector가 이미 MutationObserver를 생성하므로 그대로 반환
    return this.changeDetector.observe(root, options);
  }

  private normalizeClasses(classes: string | string[]): string[] {
    return Array.isArray(classes)
      ? classes.flatMap(cls => cls.split(/\s+/))
      : classes.split(/\s+/);
  }

  /**
   * Safely insert CSS rule into stylesheet
   */
  private insertRuleToSheet(sheet: CSSStyleSheet, rule: string): boolean {
    try {
      sheet.insertRule(rule.trim(), sheet.cssRules.length);
      console.log('[StyleRuntime] insertRule', rule.trim());
      return true;
    } catch (error) {
      if (this.options.enableDev) {
        console.warn('[StyleRuntime] Failed to insert rule:', rule, error);
      }
      return false;
    }
  }

  /**
   * Insert multiple CSS rules in batch
   */
  private insertRulesToSheet(sheet: CSSStyleSheet, cssRules: string[]): { successful: string[], failed: string[] } {
    const successfulRules: string[] = [];
    const failedRules: string[] = [];
    
    for (const css of cssRules) {
      const rules = css.split(/(?<=})\s*/).filter(Boolean);
      for (const rule of rules) {
        if (this.insertRuleToSheet(sheet, rule)) {
          successfulRules.push(rule.trim());
        } else {
          failedRules.push(rule.trim());
        }
      }
    }
    
    return { successful: successfulRules, failed: failedRules };
  }

  /**
   * Synchronize style element's textContent with cache
   */
  private syncStyleElementContent(styleEl: HTMLStyleElement, cssRules: string[]): void {
    if (styleEl) {
      styleEl.textContent = cssRules.join('\n');
    }
  }

  private insertRules(cssRules: string[]) {
    if (!this.sheet || cssRules.length === 0) return;
    
    const { successful, failed } = this.insertRulesToSheet(this.sheet, cssRules);
    
    // Success/failure statistics
    if (this.options.enableDev) {
      console.log('[StyleRuntime] insertRules stats', {
        total: cssRules.length,
        successful: successful.length,
        failed: failed.length,
        failedRules: failed
      });
    }
    
    // Always sync all CSS from cache to textContent
    if (this.styleEl) {
      this.syncStyleElementContent(this.styleEl, Array.from(this.cache.values()));
    }
  }

  private insertRootRules(cssRules: string[]) {
    console.log('[StyleRuntime] insertRootRules', this.rootSheet);
    if (!this.rootSheet || cssRules.length === 0) return;

    // Add to rootCache
    for (const css of cssRules) {
      this.rootCache.add(css);
    }

    // Combine all root CSS
    const allRootCss = Array.from(this.rootCache).join('\n');
    
    // Sync style element content
    this.syncStyleElementContent(this.styleRootEl!, [allRootCss]);
    
    // Insert as :root, :host rule
    const rootRule = `:root,:host {${allRootCss}}`;
    this.insertRuleToSheet(this.rootSheet, rootRule);
  }

  has(cls: string): boolean {
    const result = this.cache.has(cls);
    console.log('[StyleRuntime] has', { cls, result });
    return result;
  }

  getCss(cls: string): string | undefined {
    const css = this.cache.get(cls);
    console.log('[StyleRuntime] getCss', { cls, css });
    return css;
  }

  getAllCss(): string {
    const all = Array.from(this.cache.values()).join('\n');
    console.log('[StyleRuntime] getAllCss', all);
    return all;
  }

  getClasses(): string[] {
    const keys = Array.from(this.cache.keys());
    console.log('[StyleRuntime] getClasses', keys);
    return keys;
  }

  /**
   * Get comprehensive cache statistics
   */
  getCacheStats() {
    return {
      runtime: {
        cachedClasses: this.cache.size,
        rootCacheSize: this.rootCache.size
      },
      ast: astCache.getStats(),
      css: cssCache.getStats(),
      incremental: this.incrementalParser.getStats(),
      compressed: this.compressedCache.getStats(),
      memoryPool: this.memoryPool.getStats()
    };
  }

  /**
   * Clear all caches (useful for debugging or memory management)
   */
  clearCaches(): void {
    this.cache.clear();
    this.rootCache.clear();
    astCache.clear();
    cssCache.clear();
    this.incrementalParser.clearProcessed();
    this.compressedCache.clear();
    this.memoryPool.clear();
    console.log('[StyleRuntime] All caches cleared');
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats() {
    return {
      // 기본 최적화 (항상 활성화)
      performanceMonitoring: this.options.optimization.performanceMonitoring,
      
      // 고급 최적화 (선택적)
      advancedCompression: this.options.optimization.advancedCompression,
      aggressiveMemoryPool: this.options.optimization.aggressiveMemoryPool,
      customCacheStrategies: this.options.optimization.customCacheStrategies,
      
      stats: this.getCacheStats()
    };
  }

  reset(): void {
    if (this.styleEl) {
      this.styleEl.textContent = '';
    }
    if (this.styleRootEl) {
      this.styleRootEl.textContent = '';
    }
    this.cache.clear();
    this.rootCache.clear();
    
    // Reinitialize stylesheets
    if (this.styleEl) {
      this.sheet = this.getStyleSheet(this.styleEl);
    }
    if (this.styleRootEl) {
      this.rootSheet = this.getStyleSheet(this.styleRootEl);
    }
    console.log('[StyleRuntime] reset');
  }

  updateTheme(newTheme: any): void {
    this.context = createContext({ theme: newTheme });
    const existingClasses = Array.from(this.cache.keys());
    this.reset();
    if (existingClasses.length > 0) {
      this.addClass(existingClasses);
    }
    console.log('[StyleRuntime] updateTheme', newTheme);
  }

  removeClass(classes: string | string[]): void {
    const classList = this.normalizeClasses(classes);
    for (const cls of classList) {
      this.cache.delete(cls);
    }
    if (this.options.enableDev) {
      console.info('[StyleRuntime] Classes removed from cache:', classList);
    }
    console.log('[StyleRuntime] removeClass', classList);
  }

  destroy(): void {
    this.removeStyleElement(this.styleEl);
    this.removeStyleElement(this.styleRootEl);
    this.removeStyleElement(this.styleCssVarsEl);
    
    this.styleEl = null;
    this.styleRootEl = null;
    this.styleCssVarsEl = null;
    this.sheet = null;
    this.rootSheet = null;
    this.cache.clear();
    this.rootCache.clear();
    this.isDestroyed = true;
    console.log('[StyleRuntime] destroy');
  }

  getStats() {
    const stats = {
      cachedClasses: this.cache.size,
      styleElementId: this.options.styleId,
      isDestroyed: this.isDestroyed,
      cssRules: this.sheet?.cssRules.length || 0,
      theme: this.options.theme,
      cacheStats: this.getCacheStats(),
      optimizationStats: this.getOptimizationStats()
    };
    console.log('[StyleRuntime] getStats', stats);
    return stats;
  }
}

export const runtime = new StyleRuntime();
export const addClass = (classes: string | string[]) => runtime.addClass(classes);
export const hasClass = (cls: string) => runtime.has(cls);
export const resetRuntime = () => runtime.reset(); 