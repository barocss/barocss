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
  private sheet: CSSStyleSheet | null = null;
  private cache: Map<string, string> = new Map(); // 클래스명 -> 생성된 CSS 매핑
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
    this.ensureSheet();
    if (this.options.enableDev && typeof window !== 'undefined') {
      this.setupHMR();
    }
  }

  private ensureSheet() {
    if (this.isDestroyed) return;
    if (!this.styleEl) {
      this.styleEl = document.getElementById(this.options.styleId) as HTMLStyleElement;
      if (!this.styleEl) {
        this.styleEl = document.createElement('style');
        this.styleEl.id = this.options.styleId;
        this.styleEl.setAttribute('data-cssma', 'runtime');
        const insertionPoint = this.getInsertionPoint();
        insertionPoint.appendChild(this.styleEl);
      }
    }
    if (!this.sheet && this.styleEl) {
      this.sheet = this.styleEl.sheet as CSSStyleSheet;
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
   * 동적으로 하나 이상의 클래스명을 받아 CSS를 생성/삽입합니다.
   */
  addClass(classes: string | string[]): void {
    if (typeof window === 'undefined' || this.isDestroyed) return;
    this.ensureSheet();
    const classList = this.normalizeClasses(classes);
    const newClasses = classList.filter(cls => cls && !this.cache.has(cls));
    if (!this.sheet || newClasses.length === 0) return;

    // generateCssRules 사용
    const rules = generateCssRules(newClasses.join(' '), this.context, { dedup: false });
    const cssRules: string[] = [];
    for (const { cls, css } of rules) {
      if (!css) continue;
      cssRules.push(css);
      this.cache.set(cls, css);
    }
    this.insertRules(cssRules);
  }

  /**
   * DOM 내 class 속성 변화를 감지하여 자동으로 addClass를 호출하는 MutationObserver 인스턴스 메서드
   *
   * 사용 예시:
   *   runtime.observe(document.body);
   *
   * @param root 관찰할 루트 엘리먼트 (기본값: document.body)
   * @returns MutationObserver 인스턴스
   */
  observe(root: HTMLElement = document.body): MutationObserver {
    const observer = new MutationObserver(mutations => {
      const classNames = new Set<string>();
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const target = mutation.target as HTMLElement;
          target.classList.forEach(cls => classNames.add(cls));
        }
        // childList 변화도 감지 (새로운 노드의 class)
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node instanceof HTMLElement) {
              node.classList.forEach(cls => classNames.add(cls));
            }
          });
        }
      }
      if (classNames.size > 0) {
        this.addClass(Array.from(classNames));
      }
    });
    observer.observe(root, {
      attributes: true,
      subtree: true,
      attributeFilter: ['class'],
      childList: true
    });
    return observer;
  }

  private normalizeClasses(classes: string | string[]): string[] {
    return Array.isArray(classes)
      ? classes.flatMap(cls => cls.split(/\s+/))
      : classes.split(/\s+/);
  }

  private insertRules(cssRules: string[]) {
    if (!this.sheet || cssRules.length === 0) return;
    for (const css of cssRules) {
      const rules = css.split(/(?<=})\s*/).filter(Boolean);
      for (const rule of rules) {
        try {
          this.sheet.insertRule(rule.trim(), this.sheet.cssRules.length);
        } catch (error) {
          if (this.styleEl) {
            this.styleEl.textContent += rule + '\n';
          }
          if (this.options.enableDev) {
            console.warn('[StyleRuntime] Failed to insert rule:', rule, error);
          }
        }
      }
    }
  }

  has(cls: string): boolean {
    return this.cache.has(cls);
  }

  getCss(cls: string): string | undefined {
    return this.cache.get(cls);
  }

  getAllCss(): string {
    return Array.from(this.cache.values()).join('\n');
  }

  reset(): void {
    if (this.styleEl) {
      this.styleEl.textContent = '';
    }
    this.cache.clear();
    if (this.styleEl && this.styleEl.sheet) {
      this.sheet = this.styleEl.sheet as CSSStyleSheet;
    }
  }

  updateTheme(newTheme: any): void {
    this.context = createContext({ theme: newTheme });
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
    if (this.styleEl && this.styleEl.parentNode) {
      this.styleEl.parentNode.removeChild(this.styleEl);
    }
    this.styleEl = null;
    this.sheet = null;
    this.cache.clear();
    this.isDestroyed = true;
  }

  getStats() {
    return {
      cachedClasses: this.cache.size,
      styleElementId: this.options.styleId,
      isDestroyed: this.isDestroyed,
      cssRules: this.sheet?.cssRules.length || 0,
      theme: this.options.theme
    };
  }
}

export const runtime = new StyleRuntime();
export const addClass = (classes: string | string[]) => runtime.addClass(classes);
export const hasClass = (cls: string) => runtime.has(cls);
export const resetRuntime = () => runtime.reset(); 