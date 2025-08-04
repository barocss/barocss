import { generateCssRules } from './core/engine';
import { createContext } from './core/context';
import { defaultTheme } from './theme';

export interface StyleRuntimeOptions {
  theme?: any;
  styleId?: string;
  enableDev?: boolean;
  insertionPoint?: 'head' | 'body' | HTMLElement;
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

  constructor(options: StyleRuntimeOptions = {}) {
    this.options = {
      theme: options.theme || defaultTheme,
      styleId: options.styleId || 'cssma-runtime',
      enableDev: options.enableDev ?? (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development'),
      insertionPoint: options.insertionPoint || 'head'
    };

    this.context = createContext({ theme: this.options.theme });

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
    if (typeof window === 'undefined' || this.isDestroyed) return;
    this.ensureSheet();
    
    const classList = this.normalizeClasses(classes);
    
    // Filter out duplicates and classes not in cache
    const newClasses = classList.filter(cls => {
      return cls && !this.cache.has(cls);
    });
    
    if (!this.sheet || newClasses.length === 0) return;

    console.log('[StyleRuntime] addClass input', { 
      classList, 
      newClasses
    });

    // Generate CSS in batch
    const rules = generateCssRules(newClasses.join(' '), this.context, { dedup: false });
    const rootCssRules: string[] = [];
    const cssRules: string[] = [];
    const processedClasses: string[] = [];
    
    for (const { cls, css, rootCss } of rules) {
      if (!css) {
        console.warn('[StyleRuntime] No CSS generated for:', cls);
        continue;
      }
      cssRules.push(css);
      rootCssRules.push(rootCss);
      this.cache.set(cls, css);
      processedClasses.push(cls);
      console.log('[StyleRuntime] CSS generated', { cls, css });
    }
    
    // Insert CSS in batch
    if (cssRules.length > 0) {
      this.insertRules(cssRules);
      console.log('[StyleRuntime] Batch processed', { 
        processed: processedClasses.length,
        classes: processedClasses 
      });
    }

    if (rootCssRules.length > 0) {
      this.insertRootRules(rootCssRules.filter(Boolean));
    }
  }

  /**
   * MutationObserver instance method to automatically call addClass when class attributes change in DOM
   * Optimizations: debouncing, deduplication, batch processing
   */
  observe(root: HTMLElement = document.body, options?: { scan?: boolean; debounceMs?: number }): MutationObserver {
    console.log('[StyleRuntime] observe called', { root, options });
    
    // Timer for debouncing
    let debounceTimer: number | null = null;
    const debounceMs = options?.debounceMs ?? 16; // Default 16ms (1 frame)
    
    // Set for deduplication
    const pendingClasses = new Set<string>();
    
    const processPendingClasses = () => {
      if (pendingClasses.size > 0) {
        const classes = Array.from(pendingClasses);
        pendingClasses.clear();
        console.log('[StyleRuntime] observe batch processing', classes);
        this.addClass(classes);
      }
    };
    
    const debouncedProcess = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = window.setTimeout(() => {
        processPendingClasses();
        debounceTimer = null;
      }, debounceMs);
    };
    
    const observer = new MutationObserver(mutations => {
      // Collect only changed elements' classes
      const changedElements = new Set<HTMLElement>();
      
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const target = mutation.target as HTMLElement;
          changedElements.add(target);
        }
        
        // Detect childList changes (new nodes' classes)
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node instanceof HTMLElement) {
              changedElements.add(node);
              // Include child elements
              node.querySelectorAll('[class]').forEach(el => {
                changedElements.add(el as HTMLElement);
              });
            }
          });
        }
      }
      
      // Process only changed elements' classes
      for (const element of changedElements) {
        if (element.classList && element.className) {
          element.classList.forEach(cls => {
            if (cls && !this.cache.has(cls)) {
              pendingClasses.add(cls);
            }
          });
        }
      }
      
      // Debounced processing
      if (pendingClasses.size > 0) {
        debouncedProcess();
      }
    });
    
    observer.observe(root, {
      attributes: true,
      subtree: true,
      attributeFilter: ['class'],
      childList: true
    });
    
    if (options?.scan) {
      // Initial scan in batch
      const scanClasses = new Set<string>();
      
      // Include root itself
      if (root.classList && root.className) {
        console.log('[StyleRuntime] observe scan root', root.className);
        root.classList.forEach(cls => {
          if (cls && !this.cache.has(cls)) {
            scanClasses.add(cls);
          }
        });
      }
      
      // Collect all child elements at once
      const elementsWithClass = root.querySelectorAll('[class]');
      for (const el of elementsWithClass) {
        if (el.className) {
          console.log('[StyleRuntime] observe scan el', el.className);
          el.classList.forEach(cls => {
            if (cls && !this.cache.has(cls)) {
              scanClasses.add(cls);
            }
          });
        }
      }
      
      // Batch processing
      if (scanClasses.size > 0) {
        console.log('[StyleRuntime] observe scan batch processing', Array.from(scanClasses));
        this.addClass(Array.from(scanClasses));
      }
    }
    
    return observer;
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
      theme: this.options.theme
    };
    console.log('[StyleRuntime] getStats', stats);
    return stats;
  }
}

export const runtime = new StyleRuntime();
export const addClass = (classes: string | string[]) => runtime.addClass(classes);
export const hasClass = (cls: string) => runtime.has(cls);
export const resetRuntime = () => runtime.reset(); 