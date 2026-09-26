import { GenerateCssRulesResult } from '@barocss/kit';
import { createContext, clearAstCache, IncrementalParser, parseClassName, isDebug } from '@barocss/kit';
import type { Config, Context } from '@barocss/kit';
import { StylePartitionManager } from './style-partition-manager';
import { ChangeDetector } from './change-detector';
import { collectKeyframeNames, collectLeadingClasses } from './existing-classes';
import { ClassGc } from './class-gc';
import { acquireSharedRootSheet, ShadowRootStyles, SharedIncrementalParser } from './shadow-root-sheet';

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
  /**
   * #269: reclaim the rules of classes that no element inside the observed root carries any more.
   * On by default; it only acts on classes seen through `observe()`. A class is deleted only after
   * its refcount has stayed 0 for `gcGraceMs` and a live-DOM re-check finds no element with it.
   * Never reclaimed: classes passed to `addClass()`, classes any pre-existing (non-BaroCSS) sheet
   * defines (build output, server sheet), root/@property/preflight rules. `false` disables it.
   */
  gc?: boolean;
  /** #269: how long a class must stay unused before its rules are deleted (default 3000 ms). */
  gcGraceMs?: number;
  /**
   * #269: soft cap on cached classes. When exceeded, unused (refcount 0) classes are evicted
   * oldest-first without waiting for the grace period; classes in use are never evicted. Default: no cap.
   */
  maxRules?: number;
  /**
   * #327: a ShadowRoot to style instead of the document. The runtime observes that root (with an initial scan)
   * and places all of its CSS in it: utilities, theme variables, @property, @keyframes and a preflight rewritten
   * for the root (`html`/`:root` -> `:host`, `body` declarations re-emitted on `:host`). Nothing goes to
   * `document.head`. Runtimes with the same config share one constructable sheet adopted by every root
   * (`adoptedStyleSheets`); without constructable sheets each root gets `<style>` elements instead.
   * `insertionPoint`, `styleId` and `maxRulesPerPartition` are ignored in this mode, and server sheets (#268)
   * are not adopted. `document` (or omitting it) keeps the document mode.
   */
  root?: ShadowRoot | Document;
}

/** #268: marks a server-rendered sheet (`@barocss/server` `ssrStyleTag()`); the runtime adopts its class rules. */
export const SSR_STYLE_SELECTOR = 'style[data-barocss-ssr]';

/** Tailwind 4 layer order, declared by BaroCSS's first <style> in <head>. */
export const LAYER_ORDER = "@layer theme, base, components, utilities;";

export class BrowserRuntime {
  private cache: Map<string, GenerateCssRulesResult> = new Map(); // class name -> generated CSS mapping
  private rootCache: Set<string> = new Set(); // class name -> generated CSS mapping
  private context: Context;
  private options: Required<Omit<BrowserRuntimeOptions, 'root'>>;
  /** #327: the shadow root this runtime styles, or null in document mode. */
  private shadowRoot: ShadowRoot | null = null;
  private isDestroyed = false;
  private existing: Set<string> | null = null;
  /** #274: @keyframes names the page's own sheets define (filled with `existing`). */
  private existingKeyframes = new Set<string>();
  private existingSheetCount = -1;
  /** #269: classes requested explicitly through addClass(); never reclaimed. */
  private pinned = new Set<string>();
  private gc: ClassGc | null = null;
  private reclaimedCount = 0;
  /** #268: class rules adopted from `<style data-barocss-ssr>`, in sheet order, and the classes they lead. */
  private ssrRules: Array<{ css: string; cls: string }> = [];
  private ssrClasses = new Set<string>();
  private observedOnce = false;

  private incrementalParser: IncrementalParser;
  private changeDetector: ChangeDetector;
  private stylePartitionManager: StylePartitionManager | ShadowRootStyles;

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
      gc: options.gc ?? true,
      gcGraceMs: options.gcGraceMs ?? 3000,
      maxRules: options.maxRules ?? Infinity,
    };

    const root = options.root;
    if (root && root.nodeType === 11) this.shadowRoot = root as ShadowRoot;

    // Pass full config to createContext (defaultTheme auto-included)
    if (this.shadowRoot) {
      const shared = acquireSharedRootSheet(this.options.config);
      this.context = shared.context;
      this.incrementalParser = new SharedIncrementalParser(shared);
    } else {
      this.context = createContext(this.options.config);
      this.incrementalParser = new IncrementalParser(this.context);
    }
    this.changeDetector = new ChangeDetector(this.incrementalParser, this, this.getCategory);

    this.stylePartitionManager = this.createStyles();

    if (this.options.gc) {
      this.gc = new ClassGc({
        reclaim: classes => this.reclaim(classes),
        isPermanent: cls => this.isPermanent(cls),
        cachedCount: () => this.cache.size,
      }, this.options.gcGraceMs, this.options.maxRules);
      this.changeDetector.setGc(this.gc);
    }

    this.init();
    if (this.shadowRoot) this.observe(this.shadowRoot, { scan: true });
  }

  /** Document partitions, or (#327) this root's view of the shared shadow-root sheet. */
  private createStyles(): StylePartitionManager | ShadowRootStyles {
    if (this.shadowRoot) {
      const parser = this.incrementalParser as SharedIncrementalParser;
      let shared = parser.shared;
      // A reset after the last root released the entry: re-acquire (same key -> same or a fresh entry).
      const current = acquireSharedRootSheet(this.options.config);
      if (current !== shared) {
        shared = current;
        this.context = shared.context;
        this.incrementalParser = new SharedIncrementalParser(shared);
        this.changeDetector?.setParser(this.incrementalParser);
      }
      return new ShadowRootStyles(shared, this.shadowRoot, this.getCategory);
    }
    return new StylePartitionManager(this.getInsertionPoint(), this.options.maxRulesPerPartition, `${this.options.styleId}-partition`, this.getCategory);
  }

  // Debugging and logging helpers
  
  /**
   * Add debug logs (by level)
   */
  private debugLog(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: unknown): void {
    // Silent unless the kit debug flag is on (`debug: true` in config, or setDebug(true)).
    if (!isDebug()) return;
    // console-ok: gated by the isDebug() early return above
    // eslint-disable-next-line no-console
    const consoleMethod = console[level] || console.log;
    consoleMethod(`[BrowserRuntime:${level.toUpperCase()}] ${message}`, data || '');
  }

  private init() {
    this.debugLog('debug', 'init');
    this.injectPreflightCSS();
    this.ensureCssVars();
    this.adoptSsrSheets();
  }

  /**
   * #268: adopt the class rules of server-rendered `<style data-barocss-ssr>` sheets in <head>, at startup
   * (constructor and the first observe()). Each rule moves
   * (same task, so no paint in between) into the partition its class would get if generated here, at
   * its #254 sorted position, so a later client `sm:` rule lands before a server `lg:` rule. Its classes
   * are never regenerated and never reclaimed. `:root`, `@property` and `@keyframes` stay in the sheet.
   */
  private adoptSsrSheets(): void {
    if (typeof document === 'undefined' || this.shadowRoot) return;
    const adopted: Array<{ css: string; cls: string }> = [];
    // Only sheets in <head> at startup (constructor / observe()): a marked <style> injected later or into
    // <body> (model or user HTML) must not suppress generation or GC for its classes (#268 review).
    if (!document.head) return;
    for (const el of Array.from(document.head.querySelectorAll<HTMLStyleElement>(`${SSR_STYLE_SELECTOR}:not([data-barocss-adopted])`))) {
      const sheet = el.sheet;
      if (!sheet) continue;
      el.setAttribute('data-barocss-adopted', '');
      const moved: Array<{ css: string; cls: string }> = [];
      for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
        const rule = sheet.cssRules[i];
        const classes = collectLeadingClasses([rule]);
        if (classes.size === 0) continue;
        classes.forEach(cls => this.ssrClasses.add(cls));
        moved.unshift({ css: rule.cssText, cls: classes.values().next().value! });
        sheet.deleteRule(i);
      }
      adopted.push(...moved);
    }
    if (adopted.length === 0) return;
    this.ssrRules.push(...adopted);
    this.insertSsrRules(adopted);
  }

  private insertSsrRules(rules: Array<{ css: string; cls: string }>): void {
    for (const { css, cls } of rules) {
      const category = this.getCategory(cls);
      if (category) this.stylePartitionManager.addCategoryRule(css, category);
      else this.stylePartitionManager.addRule(css);
    }
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
    
    const classList = this.normalizeClasses(classes).filter(Boolean);
    classList.forEach(cls => this.pinned.add(cls));
    
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
    
    this.debugLog('debug', 'results', { results, classList });
    // Apply results and inject CSS
    this.applyParseResults(results, { isBrowser });
  }

  /**
   * Public method to apply parser results, update internal caches, and inject CSS
   */
  public applyParseResults(results: Array<GenerateCssRulesResult>, _opts?: { isBrowser?: boolean }): void {
    if (this.isDestroyed) return;
    if (!this.shadowRoot && this.getInsertionPoint().isConnected && this.stylePartitionManager.hasDetachedPartitions()) {
      const existingResults = Array.from(this.cache.values());
      this.reset();
      results = [...existingResults, ...results];
      results.forEach(result => this.incrementalParser.markProcessed(result.cls));
    }
    if (this.ssrClasses.size > 0) results = results.filter(result => !this.ssrClasses.has(result.cls));
    if (this.options.skipExisting && results.length > 0 && typeof document !== 'undefined') {
      const existing = this.getExistingClasses();
      results = results.filter(result => !existing.has(result.cls));
    }
    if (results.length === 0) return;
    const cssRules: GenerateCssRulesResult[] = [];
    const rootCssRules: string[] = [];
    // #274: companion mode leaves a @keyframes the page's own sheets define to them.
    const pageKeyframes = this.options.skipExisting && typeof document !== 'undefined'
      ? (this.getExistingClasses(), this.existingKeyframes) : null;

    for (const result of results) {
      if (result.css && Array.isArray(result.cssList)) {
        cssRules.push(result);
        this.cache.set(result.cls, result);
      }

      if (result.rootCss && Array.isArray(result.rootCssList)) {
        for (const rootCss of result.rootCssList) {
          if (pageKeyframes?.size) {
            const kf = /^\s*@keyframes\s+([^\s{]+)/.exec(rootCss)?.[1];
            if (kf && pageKeyframes.has(kf)) continue;
          }
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

  /** #269: a class that must never be reclaimed. */
  private isPermanent(cls: string): boolean {
    if (this.pinned.has(cls) || this.ssrClasses.has(cls)) return true;
    // #327: document sheets cannot style a shadow root, so they never make its classes permanent.
    if (this.shadowRoot) return false;
    if (typeof document === 'undefined') return true;
    return this.getExistingClasses().has(cls);
  }

  /**
   * #269: delete the generated rules of classes no live element uses. Root/@property/@keyframes rules stay
   * (they are shared and harmless); a rule text another cached class still emits is kept.
   */
  private reclaim(classes: string[]): void {
    if (this.isDestroyed) return;
    const victims = classes.filter(cls => this.cache.has(cls));
    if (victims.length === 0) return;
    const results = victims.map(cls => this.cache.get(cls)!);
    victims.forEach(cls => {
      this.cache.delete(cls);
      this.incrementalParser.unmarkProcessed(cls);
    });
    const stillUsed = new Set<string>();
    for (const result of this.cache.values()) result.cssList.forEach(css => stillUsed.add(css));
    for (const result of results) {
      const category = this.getCategory(result.cls);
      for (const css of result.cssList) {
        if (!stillUsed.has(css)) this.stylePartitionManager.removeRule(css, category);
      }
    }
    this.reclaimedCount += victims.length;
  }

  /** Class names defined by the page's own stylesheets (BaroCSS's sheets and cross-origin sheets excluded). */
  getExistingClasses(): Set<string> {
    // Our own <style> elements, matched by sheet identity too (jsdom leaves ownerNode unset).
    const own = new Set(Array.from(document.querySelectorAll<HTMLStyleElement>('style[data-barocss]'), s => s.sheet));
    const sheets = Array.from(document.styleSheets).filter(sheet => {
      if (own.has(sheet)) return false;
      const owner = sheet.ownerNode as Element | null;
      return !(owner && typeof owner.hasAttribute === 'function'
        && (owner.hasAttribute('data-barocss') || (owner.id || '').startsWith(this.options.styleId)));
    });
    if (this.existing && sheets.length === this.existingSheetCount) return this.existing;
    const out = new Set<string>();
    const keyframes = new Set<string>();
    for (const sheet of sheets) {
      let rules: CSSRuleList;
      try { rules = sheet.cssRules; } catch { continue; } // cross-origin
      collectLeadingClasses(rules, out);
      collectKeyframeNames(rules, keyframes);
    }
    this.existingKeyframes = keyframes;
    this.existing = out;
    this.existingSheetCount = sheets.length;
    return out;
  }

  /**
   * MutationObserver instance method to automatically call addClass when class attributes change in DOM
   */
  observe(root: HTMLElement | ShadowRoot = this.shadowRoot ?? document.body, options?: { scan?: boolean; onReady?: () => void }): MutationObserver {
    if (!this.observedOnce) { this.observedOnce = true; this.adoptSsrSheets(); }
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
        rootCacheSize: this.rootCache.size,
        ruleCount: this.stylePartitionManager.ruleCount,
        reclaimedClasses: this.reclaimedCount,
        gc: this.gc?.stats() ?? null,
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
    this.stylePartitionManager = this.createStyles();
    this.injectPreflightCSS();
    this.ensureCssVars();
    this.insertSsrRules(this.ssrRules);
  }


  reset(): void {
    if (this.isDestroyed) return;
    this.cache.clear();
    this.rootCache.clear();
    this.incrementalParser.clearProcessed();
    this.stylePartitionManager.cleanup();
    this.stylePartitionManager = this.createStyles();
    this.injectPreflightCSS();
    this.ensureCssVars();
    this.insertSsrRules(this.ssrRules);
  }

  updateConfig(newConfig: Config): void {
    if (this.isDestroyed) return;
    const existingClasses = Array.from(this.cache.keys());
    this.options.config = newConfig;
    if (this.shadowRoot) {
      // #327: move this root to the shared sheet of the new config.
      this.stylePartitionManager.cleanup();
      const shared = acquireSharedRootSheet(newConfig);
      this.context = shared.context;
      this.incrementalParser = new SharedIncrementalParser(shared);
    } else {
      this.context = createContext(newConfig);
      this.incrementalParser = new IncrementalParser(this.context);
    }
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
    this.gc?.cancel();
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
      /** #327: the shared shadow-root sheet this runtime uses (null in document mode). */
      sharedSheet: this.shadowRoot && this.stylePartitionManager instanceof ShadowRootStyles
        ? { roots: this.stylePartitionManager.shared.rootCount, rules: this.stylePartitionManager.shared.ruleCount, generations: this.stylePartitionManager.shared.generations, constructable: this.stylePartitionManager.shared.constructable }
        : null,
    };
    return stats;
  }
}
