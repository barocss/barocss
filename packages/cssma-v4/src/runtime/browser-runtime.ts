import { createContext, astCache, cssCache, IncrementalParser, CompressedCache, MemoryPool } from '../index';
import type { CssmaConfig, CssmaContext } from '../core/context';

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
  private styleRuntime?: any;
  
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
            // SVG 의 className 은 SVGAnimatedString 타임이므로 toString() 으로 문자열로 변환
            // HTMLElement 의 className 은 string 타임이므로 그대로 사용
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
        
        // If StyleRuntime is available, inject CSS and update cache
        if (this.styleRuntime) {
          const cssRules: string[] = [];
          results.forEach(result => {
            if (result.css) {
              cssRules.push(...result.cssList);
              // Add to StyleRuntime cache
              // SVG 의 className 은 SVGAnimatedString 타임이므로 toString() 으로 문자열로 변환
              // HTMLElement 의 className 은 string 타임이므로 그대로 사용
              const className = normalizeClassName(result.className);
              this.styleRuntime.cache.set(className, result.cssList);
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
      const classes = normalizeClassNameList(root.className);
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
        const classes = normalizeClassNameList(el.className);
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
            cssRules.push(...result.cssList);
            // Add to StyleRuntime cache
            const className = normalizeClassName(result.className);
            this.styleRuntime.cache.set(className, result.cssList);
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
      // SVG 의 className 은 SVGAnimatedString 타임이므로 toString() 으로 문자열로 변환
      // HTMLElement 의 className 은 string 타임이므로 그대로 사용
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
  debugging?: {
    // 디버깅 기능 (enableDev가 true일 때 기본 활성화)
    disableParseFailureTracking?: boolean;     // 파싱 실패 추적 비활성화
    disablePerformanceMetrics?: boolean;       // 성능 메트릭 추적 비활성화
    disableDetailedLogging?: boolean;          // 상세한 로그 출력 비활성화
    disableConsoleGrouping?: boolean;          // 콘솔 그룹핑 비활성화
    disableCacheLogging?: boolean;             // 캐시 작업 로깅 비활성화
    disableDOMLogging?: boolean;               // DOM 작업 로깅 비활성화
  };
}

export class StyleRuntime {
  private styleEl: HTMLStyleElement | null = null;
  private styleRootEl: HTMLStyleElement | null = null;
  private styleCssVarsEl: HTMLStyleElement | null = null;
  private sheet: CSSStyleSheet | null = null;
  private rootSheet: CSSStyleSheet | null = null;
  private cache: Map<string, string[]> = new Map(); // class name -> generated CSS mapping
  private rootCache: Set<string> = new Set(); // class name -> generated CSS mapping
  private context: CssmaContext;
  private options: Required<StyleRuntimeOptions>;
  private isDestroyed = false;

  // Optimization components
  private incrementalParser: IncrementalParser;
  private changeDetector: ChangeDetector;
  private compressedCache: CompressedCache;
  private memoryPool: MemoryPool<any>;

  // 🔍 디버깅 및 모니터링 속성들
  private parseFailures: Map<string, { error: string; timestamp: number; count: number }> = new Map();
  private performanceMetrics: {
    parseTimes: number[];
    cacheHits: number;
    cacheMisses: number;
    domOperations: number;
    cssInsertions: number;
    lastReset: number;
  } = {
    parseTimes: [],
    cacheHits: 0,
    cacheMisses: 0,
    domOperations: 0,
    cssInsertions: 0,
    lastReset: Date.now()
  };
  private debugLogs: Array<{ timestamp: number; level: 'info' | 'warn' | 'error' | 'debug'; message: string; data?: any }> = [];

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
      },
      debugging: {
        // 🔍 enableDev가 true일 때 모든 디버깅 기능 기본 활성화
        // 개별적으로 비활성화하려면 disable* 옵션 사용
        disableParseFailureTracking: options.debugging?.disableParseFailureTracking ?? false,
        disablePerformanceMetrics: options.debugging?.disablePerformanceMetrics ?? false,
        disableDetailedLogging: options.debugging?.disableDetailedLogging ?? false,
        disableConsoleGrouping: options.debugging?.disableConsoleGrouping ?? false,
        disableCacheLogging: options.debugging?.disableCacheLogging ?? false,
        disableDOMLogging: options.debugging?.disableDOMLogging ?? false
      }
    };

    // 🔍 enableDev 모드일 때 디버깅 옵션 자동 활성화
    if (this.options.enableDev) {
      // 개발 모드에서는 모든 디버깅 기능 기본 활성화
      // (개별적으로 disable* 옵션으로 끌 수 있음)
      console.log('[StyleRuntime] Development mode enabled - all debugging features active');
    }

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

  // 🔍 디버깅 및 로깅 메서드들
  
  /**
   * 디버깅 로그 추가 (레벨별)
   */
  private debugLog(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any): void {
    if (this.options.debugging.disableDetailedLogging) return;
    
    const logEntry = {
      timestamp: Date.now(),
      level,
      message,
      data
    };
    
    this.debugLogs.push(logEntry);
    
    // 최대 로그 개수 제한 (메모리 관리)
    if (this.debugLogs.length > 1000) {
      this.debugLogs = this.debugLogs.slice(-500);
    }
    
    // 콘솔 출력
    if (!this.options.debugging.disableConsoleGrouping) {
      console.group(`[StyleRuntime:${level.toUpperCase()}] ${message}`);
      if (data) console.log('Data:', data);
      console.groupEnd();
    } else {
      const consoleMethod = console[level] || console.log;
      consoleMethod(`[StyleRuntime:${level.toUpperCase()}] ${message}`, data || '');
    }
  }

  /**
   * 파싱 실패 추적
   */
  private trackParseFailure(className: string, error: string): void {
    if (this.options.debugging.disableParseFailureTracking) return;
    
    const existing = this.parseFailures.get(className);
    if (existing) {
      existing.count++;
      existing.timestamp = Date.now();
    } else {
      this.parseFailures.set(className, {
        error,
        timestamp: Date.now(),
        count: 1
      });
    }
    
    this.debugLog('warn', `Parse failure tracked for class: ${className}`, { error, count: this.parseFailures.get(className)?.count });
  }

  /**
   * 성능 메트릭 업데이트
   */
  private updatePerformanceMetrics(type: 'parse' | 'cacheHit' | 'cacheMiss' | 'domOp' | 'cssInsert', value?: number): void {
    if (this.options.debugging.disablePerformanceMetrics) return;
    
    switch (type) {
      case 'parse':
        if (value !== undefined) {
          this.performanceMetrics.parseTimes.push(value);
          // 최대 100개만 유지
          if (this.performanceMetrics.parseTimes.length > 100) {
            this.performanceMetrics.parseTimes = this.performanceMetrics.parseTimes.slice(-100);
          }
        }
        break;
      case 'cacheHit':
        this.performanceMetrics.cacheHits++;
        break;
      case 'cacheMiss':
        this.performanceMetrics.cacheMisses++;
        break;
      case 'domOp':
        this.performanceMetrics.domOperations++;
        break;
      case 'cssInsert':
        this.performanceMetrics.cssInsertions++;
        break;
    }
  }

  /**
   * 파싱 실패 통계 조회
   */
  getParseFailureStats(): { totalFailures: number; failures: Map<string, { error: string; timestamp: number; count: number }> } {
    return {
      totalFailures: Array.from(this.parseFailures.values()).reduce((sum, f) => sum + f.count, 0),
      failures: new Map(this.parseFailures)
    };
  }

  /**
   * 성능 메트릭 조회
   */
  getPerformanceMetrics(): {
    parseTimes: number[];
    averageParseTime: number;
    cacheHitRate: number;
    domOperations: number;
    cssInsertions: number;
    uptime: number;
  } {
    const totalCacheOps = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses;
    const cacheHitRate = totalCacheOps > 0 ? (this.performanceMetrics.cacheHits / totalCacheOps) * 100 : 0;
    const averageParseTime = this.performanceMetrics.parseTimes.length > 0 
      ? this.performanceMetrics.parseTimes.reduce((sum, time) => sum + time, 0) / this.performanceMetrics.parseTimes.length 
      : 0;
    
    return {
      parseTimes: [...this.performanceMetrics.parseTimes],
      averageParseTime,
      cacheHitRate,
      domOperations: this.performanceMetrics.domOperations,
      cssInsertions: this.performanceMetrics.cssInsertions,
      uptime: Date.now() - this.performanceMetrics.lastReset
    };
  }

  /**
   * 디버그 로그 조회
   */
  getDebugLogs(level?: 'info' | 'warn' | 'error' | 'debug', limit: number = 100): Array<{ timestamp: number; level: string; message: string; data?: any }> {
    let logs = [...this.debugLogs];
    
    if (level) {
      logs = logs.filter(log => log.level === level);
    }
    
    return logs.slice(-limit);
  }

  /**
   * 파싱 실패 목록 출력 (콘솔)
   */
  logParseFailures(): void {
    if (this.options.debugging.disableDetailedLogging) return;
    
    const stats = this.getParseFailureStats();
    
    if (stats.totalFailures === 0) {
      console.log('✅ [StyleRuntime] No parse failures detected');
      return;
    }
    
    console.group('🚨 [StyleRuntime] Parse Failures Summary');
    console.log(`Total failures: ${stats.totalFailures}`);
    console.table(Array.from(stats.failures.entries()).map(([className, data]) => ({
      className,
      error: data.error,
      count: data.count,
      lastOccurrence: new Date(data.timestamp).toLocaleString()
    })));
    console.groupEnd();
  }

  /**
   * 성능 메트릭 출력 (콘솔)
   */
  logPerformanceMetrics(): void {
    if (this.options.debugging.disablePerformanceMetrics) return;
    
    const metrics = this.getPerformanceMetrics();
    
    console.group('📊 [StyleRuntime] Performance Metrics');
    console.log(`Uptime: ${Math.round(metrics.uptime / 1000)}s`);
    console.log(`Average parse time: ${metrics.averageParseTime.toFixed(2)}ms`);
    console.log(`Cache hit rate: ${metrics.cacheHitRate.toFixed(1)}%`);
    console.log(`DOM operations: ${metrics.domOperations}`);
    console.log(`CSS insertions: ${metrics.cssInsertions}`);
    console.log(`Parse times (last 10):`, metrics.parseTimes.slice(-10));
    console.groupEnd();
  }

  /**
   * 전체 디버깅 정보 출력
   */
  logDebugInfo(): void {
    console.group('🔍 [StyleRuntime] Debug Information');
    
    // 기본 정보
    console.log('Runtime ID:', this.options.styleId);
    console.log('Config:', this.options.config);
    console.log('Debug options:', this.options.debugging);
    
    // 파싱 실패 정보
    this.logParseFailures();
    
    // 성능 메트릭
    this.logPerformanceMetrics();
    
    // 캐시 정보
    console.log('Cache size:', this.cache.size);
    console.log('Root cache size:', this.rootCache.size);
    
    // 스타일 요소 정보
    console.log('Style elements:', {
      main: this.styleEl?.id,
      root: this.styleRootEl?.id,
      cssVars: this.styleCssVarsEl?.id
    });
    
    console.groupEnd();
  }

  private init() {
    this.injectPreflightCSS();
    this.ensureCssVars();
    this.ensureSheet();
    if (this.options.enableDev && typeof window !== 'undefined') {
      this.setupHMR();
    }
  }

  private injectPreflightCSS() {
    if (this.options.config.preflight) {
      const preflightCSS = this.context.getPreflightCSS(this.options.config.preflight);
      this.createStyleElement(`${this.options.styleId}-preflight-${this.options.config.preflight}`, preflightCSS);
      console.log('[StyleRuntime] preflightCSS injected', preflightCSS);
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
    const startTime = performance.now();
    const results = this.incrementalParser.processClasses(classList);
    const parseTime = performance.now() - startTime;
    
    // 🔍 성능 메트릭 업데이트
    this.updatePerformanceMetrics('parse', parseTime);
    
    console.log('[StyleRuntime] Incremental parser results:', results.length);
    
    // Add processed results to cache and generate CSS
    const cssRules: string[] = [];
    const rootCssRules: string[] = [];
    
    for (const result of results) {
      console.log('[StyleRuntime] result', result);
      if (result.css) {
        console.log('[StyleRuntime] result.cssList', result.cssList);
        cssRules.push(...result.cssList);
        this.cache.set(normalizeClassName(result.className), result.cssList);
        
        // 🔍 캐시 히트/미스 추적
        this.updatePerformanceMetrics('cacheHit');
        
        // console.log('[StyleRuntime] Added to cache:', result.className);
        
        // Use compressed cache if enabled
        if (this.options.optimization.advancedCompression) {
          this.compressedCache.setAst(normalizeClassName(result.className), result.ast);
          this.compressedCache.setCss(normalizeClassName(result.className), result.css);
        }
        
        // Use memory pool if enabled
        if (this.options.optimization.aggressiveMemoryPool) {
          const obj = this.memoryPool.acquire();
          // Use the object briefly and then release it back to the pool
          this.memoryPool.release(obj);
        }
      } else {
        // 🔍 파싱 실패 추적
        this.trackParseFailure(normalizeClassName(result.className), 'CSS generation failed');
        this.updatePerformanceMetrics('cacheMiss');
      }
    }
    
    // Insert CSS in batch only in browser environment
    if (cssRules.length > 0 && isBrowser) {
      this.insertRules(cssRules);
      this.updatePerformanceMetrics('cssInsert');
      // console.log('[StyleRuntime] Incremental processed', { 
      //   processed: results.length,
      //   classes: results.map(r => r.className) 
      // });
    }
    
    if (rootCssRules.length > 0 && isBrowser) {
      this.insertRootRules(rootCssRules.filter(Boolean));
    }
    
    // 🔍 디버깅 로그
    this.debugLog('info', `Processed ${classList.length} classes`, {
      successful: cssRules.length,
      failed: results.length - cssRules.length,
      parseTime: parseTime.toFixed(2) + 'ms'
    });
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
      // 빈 문자열이나 공백만 있는 규칙은 건너뛰기
      if (!rule || rule.trim() === '') {
        if (this.options.enableDev) {
          console.warn('[StyleRuntime] Skipping empty rule:', { rule, length: rule.length, trimmed: rule.trim() });
        }
        return false;
      }

      const escapedRule = this.escapeCssRule(rule);
      
      if (this.options.enableDev) {
        console.log('[StyleRuntime] insertRule', { 
          original: rule, 
          escaped: escapedRule, 
          length: rule.length,
          trimmedLength: rule.trim().length 
        });
      }
      
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
   * 🔍 CSS 규칙 escape 처리
   * - 특수 문자들을 올바르게 escape
   * - CSS 문법 오류 방지
   */
  private escapeCssRule(rule: string): string {
    // 🔍 기본적인 CSS 문자열 정리
    let escaped = rule.replace(/\\\//g, '\\/');

    return escaped;
  }

  /**
   * Insert multiple CSS rules in batch
   */
  private insertRulesToSheet(sheet: CSSStyleSheet, cssRules: string[]): { successful: number; failed: number } {
    let successful = 0;
    let failed = 0;

    if (this.options.enableDev) {
      console.log('[StyleRuntime] insertRulesToSheet called with:', {
        totalRules: cssRules.length,
        rules: cssRules.map((rule, index) => ({ index, rule, length: rule.length, isEmpty: !rule || rule.trim() === '' }))
      });
    }

    for (const rule of cssRules) {
      // 빈 규칙은 건너뛰기
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

    if (this.options.enableDev) {
      console.log('[StyleRuntime] insertRulesToSheet result:', { successful, failed, total: cssRules.length });
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

  private insertRules(cssRules: string[]) {
    if (!this.sheet || cssRules.length === 0) return;
    
    if (this.options.enableDev) {
      console.log('[StyleRuntime] insertRules called with:', {
        totalRules: cssRules.length,
        rules: cssRules.map((rule, index) => ({ index, rule, length: rule.length, isEmpty: !rule || rule.trim() === '' }))
      });
    }

    const { successful, failed } = this.insertRulesToSheet(this.sheet, cssRules);
    
    if (this.options.enableDev) {
      console.log('[StyleRuntime] insertRules result:', { successful, failed, total: cssRules.length });
    }

    if (this.styleEl) {
      this.syncStyleElementContent(this.styleEl, Array.from(this.cache.values()).flat());
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
    const css = this.cache.get(cls)?.join('\n');
    console.log('[StyleRuntime] getCss', { cls, css });
    return css;
  }

  getAllCss(): string {
    const all = Array.from(this.cache.values()).flat().join('\n');
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

  /**
   * 🔍 상세한 디버깅 통계 조회
   */
  getDebugStats() {
    const stats = {
      ...this.getStats(),
      debugging: {
        parseFailures: this.getParseFailureStats(),
        performance: this.getPerformanceMetrics(),
        debugLogs: this.getDebugLogs(undefined, 50), // 최근 50개 로그
        options: {
          developmentMode: this.options.enableDev,
          parseFailureTracking: !this.options.debugging.disableParseFailureTracking,
          performanceMetrics: !this.options.debugging.disablePerformanceMetrics,
          detailedLogging: !this.options.debugging.disableDetailedLogging,
          consoleGrouping: !this.options.debugging.disableConsoleGrouping,
          cacheLogging: !this.options.debugging.disableCacheLogging,
          domLogging: !this.options.debugging.disableDOMLogging
        }
      }
    };
    
    if (!this.options.debugging.disableDetailedLogging) {
      console.log('[StyleRuntime] getDebugStats', stats);
    }
    
    return stats;
  }

  /**
   * 🔍 디버깅 모드 토글
   */
  toggleDebugMode(): void {
    const currentMode = !this.options.debugging.disableDetailedLogging;
    this.options.debugging.disableDetailedLogging = !currentMode;
    
    console.log(`[StyleRuntime] Debug mode ${!currentMode ? 'enabled' : 'disabled'}`);
    
    if (!currentMode) {
      // 디버그 모드 활성화 시 현재 상태 출력
      this.logDebugInfo();
    }
  }

  /**
   * 🔍 파싱 실패 클래스들 재시도
   */
  retryFailedClasses(): void {
    if (this.options.debugging.disableParseFailureTracking) {
      console.warn('[StyleRuntime] Parse failure tracking is disabled');
      return;
    }
    
    const failedClasses = Array.from(this.parseFailures.keys());
    
    if (failedClasses.length === 0) {
      console.log('[StyleRuntime] No failed classes to retry');
      return;
    }
    
    console.log(`[StyleRuntime] Retrying ${failedClasses.length} failed classes:`, failedClasses);
    
    // 파싱 실패 기록 초기화
    this.parseFailures.clear();
    
    // 실패한 클래스들 재처리
    this.addClass(failedClasses);
  }
}

// Export runtime with automatic defaultTheme - createContext handles it
export const runtime = new StyleRuntime();
export const addClass = (classes: string | string[]) => runtime.addClass(classes);
export const hasClass = (cls: string) => runtime.has(cls);
export const resetRuntime = () => runtime.reset();

// 🔍 디버깅 관련 export 추가
export const getDebugStats = () => runtime.getDebugStats();
export const logDebugInfo = () => runtime.logDebugInfo();
export const logParseFailures = () => runtime.logParseFailures();
export const logPerformanceMetrics = () => runtime.logPerformanceMetrics();
export const toggleDebugMode = () => runtime.toggleDebugMode();
export const retryFailedClasses = () => runtime.retryFailedClasses();
export const getParseFailureStats = () => runtime.getParseFailureStats();
export const getPerformanceMetrics = () => runtime.getPerformanceMetrics(); 
