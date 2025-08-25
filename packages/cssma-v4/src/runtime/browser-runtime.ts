import { createContext, astCache, cssCache, IncrementalParser, CompressedCache, MemoryPool } from '../index';
import type { CssmaConfig } from '../core/context';

/**
 * Change detection system for DOM mutations
 * 
 * ⚠️ BROWSER-ONLY: This class is designed for browser environments only.
 * It uses MutationObserver and DOM APIs that are not available in Node.js.
 * 
 * This class monitors DOM changes and automatically processes new CSS classes
 * that are added to elements. It uses MutationObserver to detect:
 * - Class attribute changes on existing elements
 * - New elements being added to the DOM
 * - Changes in child elements
 * 
 * For server-side usage, use IncrementalParser directly with processClassesSync()
 * or processClasses() methods.
 */
export class ChangeDetector {
  /** MutationObserver instance for DOM change detection */
  private observer: MutationObserver | null = null;
  
  /** Reference to IncrementalParser for class processing */
  private incrementalParser: IncrementalParser;
  
  /** Reference to StyleRuntime for CSS injection (optional) */
  private styleRuntime?: any;
  
  /** Set of elements that have already been processed to avoid duplicates */
  private processedElements = new WeakSet<Element>();

  /**
   * Create a new ChangeDetector instance
   * 
   * @param incrementalParser - IncrementalParser instance for class processing
   * @param styleRuntime - Optional StyleRuntime instance for CSS injection
   */
  constructor(incrementalParser: IncrementalParser, styleRuntime?: any) {
    this.incrementalParser = incrementalParser;
    this.styleRuntime = styleRuntime;
  }

  /**
   * Starts observing DOM changes for new CSS classes
   * 
   * This method sets up a MutationObserver that monitors:
   * - Attribute changes (specifically class attribute modifications)
   * - Child list changes (new elements being added)
   * - Subtree changes (changes in descendant elements)
   * 
   * The observer automatically processes any new classes it discovers
   * by adding them to the IncrementalParser's pending queue.
   * 
   * @param root - The root element to observe (defaults to document.body)
   * @param options - Configuration options including scan and debounce settings
   * @returns The MutationObserver instance for external control
   */
  observe(root: HTMLElement = document.body, options?: { scan?: boolean; debounceMs?: number }): MutationObserver {
    if (typeof window === 'undefined') {
      // Return dummy observer for Node.js environment
      return new MutationObserver(() => {});
    }

    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new MutationObserver((mutations) => {
      const newClasses = new Set<string>();

      mutations.forEach(mutation => {
        // Handle attribute changes (class modifications)
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const target = mutation.target as HTMLElement;
          if (target.className) {
            const classes = target.className.split(/\s+/).filter(Boolean);
            classes.forEach(cls => {
              if (!this.incrementalParser.isProcessed(cls)) {
                newClasses.add(cls);
              }
            });
          }
        }

        // Handle new nodes
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node instanceof HTMLElement) {
              this.processElement(node, newClasses);
              // Process child elements
              node.querySelectorAll('[class]').forEach(el => {
                this.processElement(el as HTMLElement, newClasses);
              });
            }
          });
        }
      });

      // Process new classes in batch
      if (newClasses.size > 0) {
        const classesArray = Array.from(newClasses);
        
        // Process classes directly and update StyleRuntime cache
        const results = this.incrementalParser.processClasses(classesArray);
        
        // If StyleRuntime is available, inject CSS and update cache
        if (this.styleRuntime) {
          const cssRules: string[] = [];
          results.forEach(result => {
            if (result.css) {
              cssRules.push(result.css);
              // Add to StyleRuntime cache
              this.styleRuntime.cache.set(result.className, result.css);
            }
          });
          if (cssRules.length > 0) {
            this.styleRuntime.insertRules(cssRules);
          }
        }
      }
    });

    this.observer.observe(root, {
      attributes: true,
      subtree: true,
      attributeFilter: ['class'],
      childList: true
    });

    // Handle scan option - process existing classes
    if (options?.scan) {
      this.scanExistingClasses(root);
    }

    return this.observer;
  }

  /**
   * Scan existing classes in the DOM and process them
   */
  private scanExistingClasses(root: HTMLElement): void {
    const existingClasses = new Set<string>();
    
    // Include root itself
    if (root.className) {
      const classes = root.className.split(/\s+/).filter(Boolean);
      classes.forEach(cls => {
        if (!this.incrementalParser.isProcessed(cls)) {
          existingClasses.add(cls);
        }
      });
    }
    
    // Scan all child elements
    const elementsWithClass = root.querySelectorAll('[class]') as unknown as HTMLElement[];
    for (const el of elementsWithClass) {
      if (el.className) {
        // SVG 의 className 은 SVGAnimatedString 타입이므로 toString() 으로 문자열로 변환
        // HTMLElement 의 className 은 string 타입이므로 그대로 사용
        const classes = el.className.toString().split(/\s+/).filter(Boolean);
        classes.forEach(cls => {
          if (!this.incrementalParser.isProcessed(cls)) {
            existingClasses.add(cls);
          }
        });
      }
    }

    if (existingClasses.size > 0) {
      // Process classes using IncrementalParser
      const results = this.incrementalParser.processClasses(Array.from(existingClasses));
      
      // If StyleRuntime is available, inject CSS and update cache
      if (this.styleRuntime) {
        const cssRules: string[] = [];
        results.forEach(result => {
          if (result.css) {
            cssRules.push(result.css);
            // Add to StyleRuntime cache
            this.styleRuntime.cache.set(result.className, result.css);
          }
        });
        if (cssRules.length > 0) {
          this.styleRuntime.insertRules(cssRules);
        }
      }
    }
  }

  /**
   * Processes an individual element and extracts new classes
   * 
   * This method is called for each element discovered during DOM mutations.
   * It:
   * - Checks if the element has already been processed
   * - Extracts all class names from the element's className
   * - Filters out already processed classes
   * - Adds new classes to the collection for batch processing
   * - Marks the element as processed to avoid duplicates
   * 
   * @param element - The HTML element to process
   * @param newClasses - Set to collect newly discovered class names
   */
  private processElement(element: HTMLElement, newClasses: Set<string>): void {
    if (this.processedElements.has(element)) return;

    if (element.className) {
      const classes = element.className.split(/\s+/).filter(Boolean);
      classes.forEach(cls => {
        if (!this.incrementalParser.isProcessed(cls)) {
          newClasses.add(cls);
        }
      });
    }

    this.processedElements.add(element);
  }

  /**
   * Stops observing DOM changes and cleans up resources
   * 
   * This method disconnects the MutationObserver and clears the
   * observer reference to prevent memory leaks and allow the
   * ChangeDetector to be properly garbage collected.
   */
  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
} 

export interface StyleRuntimeOptions {
  config?: CssmaConfig;  // 전체 config 받기
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
    // 기본 config 설정 - createContext에서 defaultTheme 자동 처리
    const defaultConfig: CssmaConfig = {};

    this.options = {
      config: options.config || defaultConfig,
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

    // createContext에 전체 config 전달 (defaultTheme 자동 포함)
    this.context = createContext(this.options.config);

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
      const cssVars = this.context.themeToCssVars ? this.context.themeToCssVars() : ':root { /* CSS Variables will be generated here */ }';
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
      (module as any).hot.accept(() => {
        this.reset();
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
      // 각 CSS는 이미 완전한 규칙이므로 분할하지 않고 그대로 삽입
      if (this.insertRuleToSheet(sheet, css)) {
        successfulRules.push(css.trim());
      } else {
        failedRules.push(css.trim());
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

  updateConfig(newConfig: CssmaConfig): void {
    this.options.config = newConfig;
    this.context = createContext(newConfig);
    const existingClasses = Array.from(this.cache.keys());
    this.reset();
    if (existingClasses.length > 0) {
      this.addClass(existingClasses);
    }
    console.log('[StyleRuntime] updateConfig', newConfig);
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
      config: this.options.config,
      cacheStats: this.getCacheStats(),
      optimizationStats: this.getOptimizationStats()
    };
    console.log('[StyleRuntime] getStats', stats);
    return stats;
  }
}

// Export runtime with automatic defaultTheme - createContext handles it
export const runtime = new StyleRuntime();
export const addClass = (classes: string | string[]) => runtime.addClass(classes);
export const hasClass = (cls: string) => runtime.has(cls);
export const resetRuntime = () => runtime.reset(); 