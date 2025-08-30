import { GenerateCssRulesResult } from './../core/engine';
import { createContext, astCache, IncrementalParser } from '../index';
import type { Config, Context } from '../core/context';
import { StylePartitionManager } from './style-partition-manager';

function normalizeClassName(className: any): string {
  if (!className) return '';

  if (className instanceof SVGAnimatedString) {
    return className.baseVal.toString();
  }

  return className.toString();
}

function normalizeClassNameList(className: any): string[] {
  if (!className) return [];
  return normalizeClassName(className).split(/\s+/).filter(Boolean);
}

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
  private styleRuntime?: StyleRuntime;
  
  /** Set of elements that have already been processed to avoid duplicates */
  private processedElements = new WeakSet<Element>();

  /**
   * Create a new ChangeDetector instance
   * 
   * @param incrementalParser - IncrementalParser instance for class processing
   * @param styleRuntime - Optional StyleRuntime instance for CSS injection
   */
  constructor(incrementalParser: IncrementalParser, styleRuntime?: StyleRuntime) {
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
            // SVG className is SVGAnimatedString; convert to string with toString()
            // HTMLElement className is string; use as-is
            const classes = normalizeClassNameList(target.className);
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
        // If StyleRuntime is available, apply results via public API
        this.styleRuntime?.applyParseResults(results);
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
      const classes = normalizeClassNameList(root.className);
      classes.forEach(cls => {
        if (!this.incrementalParser.isProcessed(cls)) {
          existingClasses.add(cls);
        }
      });
    }
    
    // Scan all child elements
    const elementsWithClass = root.querySelectorAll('[class]') as unknown as HTMLElement[];
    // console.log('[StyleRuntime] scanExistingClasses', elementsWithClass);
    for (const el of elementsWithClass) {
      if (el.className) {
        // SVG className is SVGAnimatedString; convert to string with toString()
        // HTMLElement className is string; use as-is
        const classes = normalizeClassNameList(el.className);
        // console.log('[StyleRuntime] scanExistingClasses', classes);
        classes.forEach(cls => {
          if (!this.incrementalParser.isProcessed(cls)) {
            existingClasses.add(cls);
          }
        });
      }
    }

    // console.log('[StyleRuntime] scanExistingClasses', existingClasses);

    if (existingClasses.size > 0) {
      // Process classes using IncrementalParser
      const results = this.incrementalParser.processClasses(Array.from(existingClasses));

      // console.log('[StyleRuntime] scanExistingClasses results', results);
      
      // Apply results via public API
      this.styleRuntime?.applyParseResults(results);
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
      // SVG className is SVGAnimatedString; convert to string with toString()
      // HTMLElement className is string; use as-is
      const classes = normalizeClassNameList(element.className);
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
  config?: Config;  // full config object
  styleId?: string;
  enableDev?: boolean;
  insertionPoint?: 'head' | 'body' | HTMLElement;
  cacheSize?: {
    ast?: number;
    css?: number;
    parseResult?: number;
  };
  maxRulesPerPartition?: number;
}

export class StyleRuntime {
  private styleEl: HTMLStyleElement | null = null;
  private styleRootEl: HTMLStyleElement | null = null;
  private styleCssVarsEl: HTMLStyleElement | null = null;
  private sheet: CSSStyleSheet | null = null;
  private rootSheet: CSSStyleSheet | null = null;
  private cache: Map<string, GenerateCssRulesResult> = new Map(); // class name -> generated CSS mapping
  private rootCache: Set<string> = new Set(); // class name -> generated CSS mapping
  private context: Context;
  private options: Required<StyleRuntimeOptions>;
  private isDestroyed = false;

  private incrementalParser: IncrementalParser;
  private changeDetector: ChangeDetector;
  private stylePartitionManager: StylePartitionManager;

  constructor(options: StyleRuntimeOptions = {}) {
    // Default config - createContext handles defaultTheme automatically
    const defaultConfig: Config = {};

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
      maxRulesPerPartition: options.maxRulesPerPartition || 50,
    };

    // Pass full config to createContext (defaultTheme auto-included)
    this.context = createContext(this.options.config);

    this.incrementalParser = new IncrementalParser(this.context);
    this.changeDetector = new ChangeDetector(this.incrementalParser, this);

    this.stylePartitionManager = new StylePartitionManager(this.getInsertionPoint(), this.options.maxRulesPerPartition, `${this.options.styleId}-partition`);

    this.init();
  }

  // Debugging and logging helpers
  
  /**
   * Add debug logs (by level)
   */
  private debugLog(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any): void {
    
    
    // Console output
    const consoleMethod = console[level] || console.log;
    consoleMethod(`[StyleRuntime:${level.toUpperCase()}] ${message}`, data || '');
  }

  private init() {
    this.injectPreflightCSS();
    this.ensureSheet();
    this.ensureCssVars();    
    if (this.options.enableDev && typeof window !== 'undefined') {
      this.setupHMR();
    }
  }

  private injectPreflightCSS() {
    if (this.options.config.preflight) {
      const preflightCSS = this.context.getPreflightCSS(this.options.config.preflight);
      this.createStyleElement(`${this.options.styleId}-preflight-${this.options.config.preflight}`, preflightCSS);
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
    }
  }

  private ensureSheet() {
    if (this.isDestroyed) return;
    
    if (!this.styleRootEl) {
      this.styleRootEl = this.createStyleElement(`${this.options.styleId}-root`);
    }

    if (!this.styleEl) {
      this.styleEl = this.createStyleElement(this.options.styleId);
    }
    
    if (!this.sheet && this.styleEl) {
      this.sheet = this.getStyleSheet(this.styleEl);
    }
    
    if (!this.rootSheet && this.styleRootEl) {
      this.rootSheet = this.getStyleSheet(this.styleRootEl);
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
   */
  addClass(classes: string | string[]): void {
    if (this.isDestroyed) return;

    const isBrowser = typeof window !== 'undefined';
    
    if (isBrowser) {
      this.ensureSheet();
    }
    
    const classList = this.normalizeClasses(classes);
    
    this.processClasses(classList);
  }

  /**
   * Process classes
   */
  private processClasses(classList: string[]): void {    
    // Use incremental parsing by default (always enabled)
    
    this.processClassesIncremental(classList);
  }

  /**
   * Process classes using incremental parsing
   */
  private processClassesIncremental(classList: string[]): void {
    const isBrowser = typeof window !== 'undefined';
    
    // Process classes immediately for testing environment
    const results = this.incrementalParser.processClasses(classList);
    
    console.log('[StyleRuntime] results', results, ...classList);
    // Apply results and inject CSS
    this.applyParseResults(results, { isBrowser });
  }

  /**
   * Public method to apply parser results, update internal caches, and inject CSS
   */
  public applyParseResults(results: Array<GenerateCssRulesResult>, opts?: { isBrowser?: boolean }): void {
    const isBrowser = opts?.isBrowser ?? (typeof window !== 'undefined');

    const cssRules: GenerateCssRulesResult[] = [];
    const rootCssRules: string[] = [];

    for (const result of results) {
      if (result.css && Array.isArray(result.cssList)) {
        cssRules.push(result);
        // this.cache.set(normalizeClassName(result.cls), result);
      }

      if (result.rootCss && Array.isArray(result.rootCssList)) {

        for (const rootCss of result.rootCssList) {
          if (!this.rootCache.has(rootCss)) {
            this.rootCache.add(rootCss);
            rootCssRules.push(rootCss);
          }
        }
      }
    }

    if (rootCssRules.length > 0) {
      this.insertRootRules(rootCssRules.filter(Boolean));
    }

    if (cssRules.length > 0) {
      this.stylePartitionManager.addRules(cssRules);
    }

    this.debugLog('info', `Applied ${results.length} parser results`, {
      cssRuleCount: cssRules.length,
      rootCssCount: rootCssRules.length,
    });
  }

  /**
   * MutationObserver instance method to automatically call addClass when class attributes change in DOM
   */
  observe(root: HTMLElement = document.body, options?: { scan?: boolean; debounceMs?: number }): MutationObserver {
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
      // Skip empty or whitespace-only rules
      if (!rule || rule.trim() === '') {
        if (this.options.enableDev) {
          console.warn('[StyleRuntime] Skipping empty rule:', { rule, length: rule.length, trimmed: rule.trim() });
        }
        return false;
      }

      const escapedRule = this.escapeCssRule(rule);
      
      sheet.insertRule(escapedRule.trim(), sheet.cssRules.length);
      return true;
    } catch (error) {
      if (this.options.enableDev) {
        console.warn('[StyleRuntime] Failed to insert rule:', { 
          rule, 
          length: rule.length, 
          trimmed: rule.trim(),
          error: error instanceof Error ? error.message : String(error)
        });
      }
      return false;
    }
  }

  /**
   * Escape CSS rule text
   * - Properly escape special characters
   * - Prevent CSS syntax errors
   */
  private escapeCssRule(rule: string): string {
    // Basic CSS string normalization
    let escaped = rule.replace(/\\\//g, '\\/');

    return escaped;
  }

  /**
   * Insert multiple CSS rules in batch
   */
  private insertRulesToSheet(sheet: CSSStyleSheet, cssRules: string[]): { successful: number; failed: number } {
    let successful = 0;
    let failed = 0;

    for (const rule of cssRules) {
      // Skip empty rules
      if (!rule || rule.trim() === '') {
        if (this.options.enableDev) {
          console.warn('[StyleRuntime] Skipping empty rule in batch:', { rule, length: rule.length });
        }
        failed++;
        continue;
      }

      if (this.insertRuleToSheet(sheet, rule)) {
        successful++;
      } else {
        failed++;
      }
    }

    return { successful, failed };
  }

  /**
   * Synchronize style element's textContent with cache
   */
  private syncStyleElementContent(styleEl: HTMLStyleElement, cssRules: string[]): void {
    if (styleEl) {
      styleEl.textContent = cssRules.join('\n');
    }
  }

  public insertRootRules(cssRules: string[]) {
    if (!this.rootSheet || cssRules.length === 0) return;

    for (const css of cssRules) {
      // console.log('[StyleRuntime] insertRootRules', css);
      this.insertRuleToSheet(this.rootSheet, css);
    }
  }

  has(cls: string): boolean {
    const result = this.cache.has(cls);
    return result;
  }

  getCss(cls: string): string | undefined {
    const css = this.cache.get(cls)?.cssList.join('\n');
    return css;
  }

  getAllCss(): string {
    const all = Array.from(this.cache.values()).flatMap(result => result.cssList).join('\n');
    return all;
  }

  getClasses(): string[] {
    const keys = Array.from(this.cache.keys());
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
      incremental: this.incrementalParser.getStats(),
    };
  }

  /**
   * Clear all caches (useful for debugging or memory management)
   */
  clearCaches(): void {
    this.cache.clear();
    this.rootCache.clear();
    astCache.clear();
    this.incrementalParser.clearProcessed();
    this.stylePartitionManager.cleanup();
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
    this.stylePartitionManager.cleanup();
    
    // Reinitialize stylesheets
    if (this.styleEl) {
      this.sheet = this.getStyleSheet(this.styleEl);
    }
    if (this.styleRootEl) {
      this.rootSheet = this.getStyleSheet(this.styleRootEl);
    }
  }

  updateConfig(newConfig: Config): void {
    this.options.config = newConfig;
    this.context = createContext(newConfig);
    const existingClasses = Array.from(this.cache.keys());
    this.reset();
    if (existingClasses.length > 0) {
      this.addClass(existingClasses);
    }
  }

  removeClass(classes: string | string[]): void {
    const classList = this.normalizeClasses(classes);
    for (const cls of classList) {
      this.cache.delete(cls);
    }
    if (this.options.enableDev) {
      console.info('[StyleRuntime] Classes removed from cache:', classList);
    }
  }

  destroy(): void {
    this.removeStyleElement(this.styleEl);
    this.removeStyleElement(this.styleRootEl);
    this.removeStyleElement(this.styleCssVarsEl);

    this.stylePartitionManager.cleanup();

    this.styleEl = null;
    this.styleRootEl = null;
    this.styleCssVarsEl = null;
    this.sheet = null;
    this.rootSheet = null;
    this.cache.clear();
    this.rootCache.clear();
    this.isDestroyed = true;

  }

  getStats() {
    const stats = {
      cachedClasses: this.cache.size,
      styleElementId: this.options.styleId,
      isDestroyed: this.isDestroyed,
      cssRules: this.sheet?.cssRules.length || 0,
      config: this.options.config,
      cacheStats: this.getCacheStats(),
    };
    return stats;
  }
}

// Export runtime with automatic defaultTheme - createContext handles it
export const runtime = new StyleRuntime();
export const addClass = (classes: string | string[]) => runtime.addClass(classes);
export const hasClass = (cls: string) => runtime.has(cls);
export const resetRuntime = () => runtime.reset();