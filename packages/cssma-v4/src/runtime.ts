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
  private styleCssVarsEl: HTMLStyleElement | null = null;
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
    this.ensureCssVars();
    this.ensureSheet();
    if (this.options.enableDev && typeof window !== 'undefined') {
      this.setupHMR();
    }
  }

  private ensureCssVars() {
    if (this.isDestroyed) return;

    if (!this.styleCssVarsEl) {
      this.styleCssVarsEl = document.getElementById(`${this.options.styleId}-css-vars`) as HTMLStyleElement;
      if (!this.styleCssVarsEl) {
        this.styleCssVarsEl = document.createElement('style');
        this.styleCssVarsEl.id = `${this.options.styleId}-css-vars`;
        this.styleCssVarsEl.setAttribute('data-cssma', 'runtime');
        const cssVars = this.context.themeToCssVars();
        this.styleCssVarsEl.textContent = cssVars;
        console.log('[StyleRuntime] styleCssVarsEl created', cssVars);
        const insertionPoint = this.getInsertionPoint();
        insertionPoint.appendChild(this.styleCssVarsEl);
        console.log('[StyleRuntime] styleCssVarsEl created and appended', this.styleCssVarsEl);
      }
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
        console.log('[StyleRuntime] styleEl created and appended', this.styleEl);
      }
    }
    if (!this.sheet && this.styleEl) {
      this.sheet = this.styleEl.sheet as CSSStyleSheet;
      console.log('[StyleRuntime] sheet initialized', this.sheet);
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
   * 최적화: 배치 처리, 중복 제거, 캐시 확인
   */
  addClass(classes: string | string[]): void {
    if (typeof window === 'undefined' || this.isDestroyed) return;
    this.ensureSheet();
    
    const classList = this.normalizeClasses(classes);
    
    // 중복 제거 및 캐시되지 않은 클래스만 필터링
    const newClasses = classList.filter(cls => {
      return cls && !this.cache.has(cls);
    });
    
    if (!this.sheet || newClasses.length === 0) return;

    console.log('[StyleRuntime] addClass input', { 
      classList, 
      newClasses
    });

    // 배치로 CSS 생성
    const rules = generateCssRules(newClasses.join(' '), this.context, { dedup: false });
    const cssRules: string[] = [];
    const processedClasses: string[] = [];
    
    for (const { cls, css } of rules) {
      if (!css) {
        console.warn('[StyleRuntime] No CSS generated for:', cls);
        continue;
      }
      cssRules.push(css);
      this.cache.set(cls, css);
      processedClasses.push(cls);
      console.log('[StyleRuntime] CSS generated', { cls, css });
    }
    
    // 배치로 CSS 삽입
    if (cssRules.length > 0) {
      this.insertRules(cssRules);
      console.log('[StyleRuntime] Batch processed', { 
        processed: processedClasses.length,
        classes: processedClasses 
      });
    }
  }

  /**
   * DOM 내 class 속성 변화를 감지하여 자동으로 addClass를 호출하는 MutationObserver 인스턴스 메서드
   * 최적화: 디바운싱, 중복 제거, 배치 처리
   */
  observe(root: HTMLElement = document.body, options?: { scan?: boolean; debounceMs?: number }): MutationObserver {
    console.log('[StyleRuntime] observe called', { root, options });
    
    // 디바운싱을 위한 타이머
    let debounceTimer: number | null = null;
    const debounceMs = options?.debounceMs ?? 16; // 기본 16ms (1프레임)
    
    // 중복 제거를 위한 Set
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
      // 변경된 요소들의 클래스만 수집
      const changedElements = new Set<HTMLElement>();
      
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const target = mutation.target as HTMLElement;
          changedElements.add(target);
        }
        
        // childList 변화도 감지 (새로운 노드의 class)
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node instanceof HTMLElement) {
              changedElements.add(node);
              // 하위 요소들도 포함
              node.querySelectorAll('[class]').forEach(el => {
                changedElements.add(el as HTMLElement);
              });
            }
          });
        }
      }
      
      // 변경된 요소들의 클래스만 처리
      for (const element of changedElements) {
        if (element.classList && element.className) {
          element.classList.forEach(cls => {
            if (cls && !this.cache.has(cls)) {
              pendingClasses.add(cls);
            }
          });
        }
      }
      
      // 디바운싱된 처리
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
      // 초기 스캔을 배치로 처리
      const scanClasses = new Set<string>();
      
      // root 자신도 포함
      if (root.classList && root.className) {
        console.log('[StyleRuntime] observe scan root', root.className);
        root.classList.forEach(cls => {
          if (cls && !this.cache.has(cls)) {
            scanClasses.add(cls);
          }
        });
      }
      
      // 모든 하위 요소들을 한 번에 수집
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
      
      // 배치 처리
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

  private insertRules(cssRules: string[]) {
    if (!this.sheet || cssRules.length === 0) return;
    
    const successfulRules: string[] = [];
    const failedRules: string[] = [];
    
    // 배치로 규칙 삽입
    for (const css of cssRules) {
      const rules = css.split(/(?<=})\s*/).filter(Boolean);
      for (const rule of rules) {
        try {
          this.sheet.insertRule(rule.trim(), this.sheet.cssRules.length);
          successfulRules.push(rule.trim());
          console.log('[StyleRuntime] insertRule', rule.trim());
        } catch (error) {
          failedRules.push(rule.trim());
          if (this.options.enableDev) {
            console.warn('[StyleRuntime] Failed to insert rule:', rule, error);
          }
        }
      }
    }
    
    // 성공/실패 통계
    if (this.options.enableDev) {
      console.log('[StyleRuntime] insertRules stats', {
        total: cssRules.length,
        successful: successfulRules.length,
        failed: failedRules.length,
        failedRules
      });
    }
    
    // 항상 cache의 모든 CSS를 합쳐서 textContent에 동기화
    if (this.styleEl) {
      this.styleEl.textContent = Array.from(this.cache.values()).join('\n');
    }
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
    this.cache.clear();
    if (this.styleEl && this.styleEl.sheet) {
      this.sheet = this.styleEl.sheet as CSSStyleSheet;
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
    if (this.styleEl && this.styleEl.parentNode) {
      this.styleEl.parentNode.removeChild(this.styleEl);
    }
    this.styleEl = null;
    this.sheet = null;
    this.cache.clear();
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