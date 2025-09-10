import { GenerateCssRulesResult } from '@barocss/kit';
import { createContext, astCache, IncrementalParser } from '@barocss/kit';
import type { Config, Context } from '@barocss/kit';
import { StylePartitionManager } from './style-partition-manager';
import { ChangeDetector } from './change-detector';

export interface BrowserRuntimeOptions {
  config?: Config;  // full config object
  styleId?: string;
  insertionPoint?: 'head' | 'body' | HTMLElement;
  maxRulesPerPartition?: number;
}

export class BrowserRuntime {
  private cache: Map<string, GenerateCssRulesResult> = new Map(); // class name -> generated CSS mapping
  private rootCache: Set<string> = new Set(); // class name -> generated CSS mapping
  private context: Context;
  private options: Required<BrowserRuntimeOptions>;
  private isDestroyed = false;

  private incrementalParser: IncrementalParser;
  private changeDetector: ChangeDetector;
  private stylePartitionManager: StylePartitionManager;

  constructor(options: BrowserRuntimeOptions = {}) {
    // Default config - createContext handles defaultTheme automatically
    const defaultConfig: Config = {};

    this.options = {
      config: options.config || defaultConfig,
      styleId: options.styleId || 'barocss-runtime',
      insertionPoint: options.insertionPoint || 'head',
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
  private debugLog(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: unknown): void {
    // Console output
    // eslint-disable-next-line no-console
    const consoleMethod = console[level] || console.log;
    consoleMethod(`[BrowserRuntime:${level.toUpperCase()}] ${message}`, data || '');
  }

  private init() {
    // eslint-disable-next-line no-console
    console.log('[BrowserRuntime] init');
    this.injectPreflightCSS();
    this.ensureCssVars();
  }

  private injectPreflightCSS() {
    if (this.options.config.preflight) {
      const preflightCSS = this.context.getPreflightCSS(this.options.config.preflight);
      this.stylePartitionManager.updateRuleContent("preflight", preflightCSS);
    }
  }

  private ensureCssVars() {
    if (this.isDestroyed) return;

    const cssVars = this.context.themeToCssVars ? this.context.themeToCssVars() : ':root { /* CSS Variables will be generated here */ }';
    this.stylePartitionManager.updateRuleContent("css-vars", cssVars);
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

  /**
   * Dynamically add one or more class names and generate/insert CSS
   */
  addClass(classes: string | string[]): void {
    if (this.isDestroyed) return;
    
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
    
    // eslint-disable-next-line no-console
    console.log('[BrowserRuntime] results', results, ...classList);
    // Apply results and inject CSS
    this.applyParseResults(results, { isBrowser });
  }

  /**
   * Public method to apply parser results, update internal caches, and inject CSS
   */
  public applyParseResults(results: Array<GenerateCssRulesResult>, _opts?: { isBrowser?: boolean }): void {
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
      this.stylePartitionManager.addRootRules(rootCssRules.filter(Boolean));
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
  observe(root: HTMLElement = document.body, options?: { scan?: boolean; onReady?: () => void }): MutationObserver {
    return this.changeDetector.observe(root, options);
  }

  private normalizeClasses(classes: string | string[]): string[] {
    return Array.isArray(classes)
      ? classes.flatMap(cls => cls.split(/\s+/))
      : classes.split(/\s+/);
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
    this.cache.clear();
    this.rootCache.clear();
    this.stylePartitionManager.cleanup();
    
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
  }

  destroy(): void {

    this.stylePartitionManager.cleanup();

    this.cache.clear();
    this.rootCache.clear();
    this.isDestroyed = true;

  }

  getStats() {
    const stats = {
      cachedClasses: this.cache.size,
      styleElementId: this.options.styleId,
      isDestroyed: this.isDestroyed,
      config: this.options.config,
      cacheStats: this.getCacheStats(),
    };
    return stats;
  }
}