import { GenerateCssRulesResult } from '@barocss/kit';
import { createContext, clearAstCache, IncrementalParser, parseClassName } from '@barocss/kit';
import type { Config, Context } from '@barocss/kit';
import { StylePartitionManager } from './style-partition-manager';
import { ChangeDetector } from './change-detector';
import { collectLeadingClasses } from './existing-classes';

export interface BrowserRuntimeOptions {
  config?: Config;  // full config object
  styleId?: string;
  insertionPoint?: 'head' | 'body' | HTMLElement;
  maxRulesPerPartition?: number;
  /**
   * #210: skip classes the page's existing (non-BaroCSS, same-origin) stylesheets already define,
   * so a built app plus the runtime injects only what the build is missing. Opt-in. A class counts
   * as covered only when a rule's selector starts with it (e.g. `.p-4`, `.md\:p-4` inside @media,
   * `.hover\:x:hover`), so a class seen only as a descendant (`.group:hover .x`) is not skipped.
   * The index is rebuilt when `document.styleSheets.length` changes. A page class that leads a selector
   * with the same name is treated as covered, and rules added later to an already-indexed sheet aren't seen.
   */
  skipExisting?: boolean;
}

/** Tailwind 4 layer order, declared by BaroCSS's first <style> in <head>. */
export const LAYER_ORDER = "@layer theme, base, components, utilities;";

export class BrowserRuntime {
  private cache: Map<string, GenerateCssRulesResult> = new Map(); // class name -> generated CSS mapping
  private rootCache: Set<string> = new Set(); // class name -> generated CSS mapping
  private context: Context;
  private options: Required<BrowserRuntimeOptions>;
  private isDestroyed = false;
  private existing: Set<string> | null = null;
  private existingSheetCount = -1;

  private incrementalParser: IncrementalParser;
  private changeDetector: ChangeDetector;
  private stylePartitionManager: StylePartitionManager;

  private getCategory = (cls: string) => parseClassName(cls, this.context).utility?.category;

  constructor(options: BrowserRuntimeOptions = {}) {
    // Default config - createContext handles defaultTheme automatically
    const defaultConfig: Config = {};

    this.options = {
      config: options.config || defaultConfig,
      styleId: options.styleId || 'barocss-runtime',
      insertionPoint: options.insertionPoint || 'head',
      maxRulesPerPartition: options.maxRulesPerPartition || 50,
      skipExisting: options.skipExisting ?? false,
    };

    // Pass full config to createContext (defaultTheme auto-included)
    this.context = createContext(this.options.config);

    this.incrementalParser = new IncrementalParser(this.context);
    this.changeDetector = new ChangeDetector(this.incrementalParser, this, this.getCategory);

    this.stylePartitionManager = new StylePartitionManager(this.getInsertionPoint(), this.options.maxRulesPerPartition, `${this.options.styleId}-partition`, this.getCategory);

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
    // Kit documents `preflight: true` (full) as the default; only an explicit
    // `false` disables it.
    const level = this.options.config.preflight ?? true;
    if (level) {
      const preflightCSS = this.context.getPreflightCSS(level);
      // #208: preflight joins the `base` layer from the first <style> in
      // <head>, which also fixes the layer order. Unlayered author CSS and
      // BaroCSS utilities (unlayered) beat it, and an app's own
      // `@layer base` rules come later within `base`, so they win too.
      this.stylePartitionManager.updateRuleContent(
        "preflight",
        `${LAYER_ORDER}\n@layer base {\n${preflightCSS}\n}`,
        true,
      );
    }
  }

  private ensureCssVars() {
    if (this.isDestroyed) return;

    const cssVars = this.context.themeToCssVars ? this.context.themeToCssVars() : ':root { /* CSS Variables will be generated here */ }';
    this.stylePartitionManager.updateRuleContent("css-vars", cssVars);
  }

  private getInsertionPoint(): HTMLElement {
    if (typeof this.options.insertionPoint !== 'string') {
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
    if (this.isDestroyed) return;
    if (this.getInsertionPoint().isConnected && this.stylePartitionManager.hasDetachedPartitions()) {
      const existingResults = Array.from(this.cache.values());
      this.reset();
      results = [...existingResults, ...results];
      results.forEach(result => this.incrementalParser.markProcessed(result.cls));
    }
    if (this.options.skipExisting && results.length > 0 && typeof document !== 'undefined') {
      const existing = this.getExistingClasses();
      results = results.filter(result => !existing.has(result.cls));
    }
    if (results.length === 0) return;
    const cssRules: GenerateCssRulesResult[] = [];
    const rootCssRules: string[] = [];

    for (const result of results) {
      if (result.css && Array.isArray(result.cssList)) {
        cssRules.push(result);
        this.cache.set(result.cls, result);
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

  /** Class names defined by the page's own stylesheets (BaroCSS's sheets and cross-origin sheets excluded). */
  getExistingClasses(): Set<string> {
    const sheets = Array.from(document.styleSheets).filter(sheet => {
      const owner = sheet.ownerNode as Element | null;
      return !(owner && typeof owner.hasAttribute === 'function'
        && (owner.hasAttribute('data-barocss') || (owner.id || '').startsWith(this.options.styleId)));
    });
    if (this.existing && sheets.length === this.existingSheetCount) return this.existing;
    const out = new Set<string>();
    for (const sheet of sheets) {
      let rules: CSSRuleList;
      try { rules = sheet.cssRules; } catch { continue; } // cross-origin
      collectLeadingClasses(rules, out);
    }
    this.existing = out;
    this.existingSheetCount = sheets.length;
    return out;
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
    const all = [...this.rootCache, ...Array.from(this.cache.values()).flatMap(result => result.cssList)].join('\n');
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
    const incremental = this.incrementalParser.getStats();
    return {
      runtime: {
        cachedClasses: this.cache.size,
        rootCacheSize: this.rootCache.size
      },
      ast: incremental.cacheStats.ast,
      incremental,
    };
  }

  /**
   * Clear all caches (useful for debugging or memory management)
   */
  clearCaches(): void {
    if (this.isDestroyed) return;
    this.cache.clear();
    this.rootCache.clear();
    clearAstCache(this.context);
    this.incrementalParser.clearProcessed();
    this.stylePartitionManager.cleanup();
    this.stylePartitionManager = new StylePartitionManager(this.getInsertionPoint(), this.options.maxRulesPerPartition, `${this.options.styleId}-partition`, this.getCategory);
    this.injectPreflightCSS();
    this.ensureCssVars();
  }


  reset(): void {
    if (this.isDestroyed) return;
    this.cache.clear();
    this.rootCache.clear();
    this.incrementalParser.clearProcessed();
    this.stylePartitionManager.cleanup();
    this.stylePartitionManager = new StylePartitionManager(this.getInsertionPoint(), this.options.maxRulesPerPartition, `${this.options.styleId}-partition`, this.getCategory);
    this.injectPreflightCSS();
    this.ensureCssVars();
  }

  updateConfig(newConfig: Config): void {
    if (this.isDestroyed) return;
    const existingClasses = Array.from(this.cache.keys());
    this.options.config = newConfig;
    this.context = createContext(newConfig);
    this.incrementalParser = new IncrementalParser(this.context);
    this.changeDetector.setParser(this.incrementalParser);
    this.reset();
    if (existingClasses.length > 0) {
      this.addClass(existingClasses);
    }
  }

  removeClass(classes: string | string[]): void {
    if (this.isDestroyed) return;
    const classList = new Set(this.normalizeClasses(classes));
    const retainedResults = Array.from(this.cache.values()).filter(result => !classList.has(result.cls));
    if (retainedResults.length === this.cache.size) return;

    this.reset();
    retainedResults.forEach(result => this.incrementalParser.markProcessed(result.cls));
    this.applyParseResults(retainedResults);
  }

  destroy(): void {
    if (this.isDestroyed) return;
    this.changeDetector.disconnect();
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
