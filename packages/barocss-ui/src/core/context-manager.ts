/**
 * Context Manager
 * AI Agent OS의 컨텍스트 관리를 담당하는 클래스
 */

import {
  ContextHierarchy,
  GlobalContext,
  SessionContext,
  SceneContext,
  ComponentContext,
  TemporaryContext,
  ContextUpdate,
  ValidationResult,
  Schema,
  ContextError,
  ValidationError
} from '../types';

export interface ContextManagerOptions {
  enableValidation?: boolean;
  enablePersistence?: boolean;
  maxHistory?: number;
  storage?: 'memory' | 'localStorage' | 'indexedDB';
}

export interface ContextDebugInfo {
  totalContexts: number;
  globalContext: GlobalContext;
  sessionContext: SessionContext;
  sceneContexts: SceneContext[];
  componentContexts: ComponentContext[];
  temporaryContexts: TemporaryContext[];
  memoryUsage: number;
  lastUpdated: number;
}

export class ContextManager {
  private contexts: ContextHierarchy;
  private subscribers: Map<string, Set<(value: any) => void>>;
  private validationSchemas: Map<string, Schema>;
  private options: ContextManagerOptions;
  private history: ContextUpdate[];
  private isInitialized: boolean = false;

  constructor(options: Partial<ContextManagerOptions> = {}) {
    this.options = {
      enableValidation: true,
      enablePersistence: true,
      maxHistory: 100,
      storage: 'memory',
      ...options
    };

    this.subscribers = new Map();
    this.validationSchemas = new Map();
    this.history = [];
    
    this.initializeContexts();
    this.setupDefaultValidationSchemas();
  }

  /**
   * 컨텍스트 초기화
   */
  private initializeContexts(): void {
    this.contexts = {
      global: this.createDefaultGlobalContext(),
      session: this.createDefaultSessionContext(),
      scene: null,
      component: null,
      temporary: null
    };
  }

  /**
   * 기본 글로벌 컨텍스트 생성
   */
  private createDefaultGlobalContext(): GlobalContext {
    return {
      application: {
        version: '1.0.0',
        environment: 'development',
        build: 'dev',
        features: {}
      },
      user: {
        id: 'anonymous',
        role: 'user',
        permissions: [],
        preferences: {
          theme: 'auto',
          language: 'en',
          fontSize: 'medium',
          animations: true,
          sounds: true,
          notifications: true
        },
        locale: 'en-US',
        timezone: 'UTC'
      },
      system: {
        platform: this.detectPlatform(),
        browser: this.detectBrowser(),
        capabilities: this.detectCapabilities(),
        performance: {
          memory: { used: 0, total: 0, limit: 0 },
          cpu: { usage: 0, cores: navigator.hardwareConcurrency || 1 },
          network: { latency: 0, bandwidth: 0 },
          rendering: { fps: 60, frameTime: 16.67 }
        }
      }
    };
  }

  /**
   * 기본 세션 컨텍스트 생성
   */
  private createDefaultSessionContext(): SessionContext {
    const now = Date.now();
    return {
      sessionId: this.generateSessionId(),
      startTime: now,
      lastActivity: now,
      duration: 0,
      navigation: {
        history: [],
        current: '/',
        previous: null
      },
      state: {
        authenticated: false,
        loading: false,
        error: null
      },
      data: {
        cache: {},
        variables: {},
        temporary: {}
      }
    };
  }

  /**
   * 컨텍스트 조회
   */
  getContext<T = any>(path: string): T | null {
    try {
      const keys = path.split('.');
      let current: any = this.contexts;

      for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
          current = current[key];
        } else {
          return null;
        }
      }

      return current as T;
    } catch (error) {
      console.error(`[ContextManager] Error getting context at path '${path}':`, error);
      return null;
    }
  }

  /**
   * 컨텍스트 설정
   */
  setContext(path: string, value: any): void {
    try {
      const oldValue = this.getContext(path);
      
      if (this.options.enableValidation) {
        this.validateContextValue(path, value);
      }

      this.updateContextValue(path, value);
      this.notifySubscribers(path, value, oldValue);
      this.addToHistory({ [path]: value });
      
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ContextError(`Failed to set context at path '${path}'`, { error, path, value });
    }
  }

  /**
   * 컨텍스트 업데이트
   */
  updateContext(path: string, updater: (current: any) => any): void {
    try {
      const currentValue = this.getContext(path);
      const newValue = updater(currentValue);
      
      if (this.options.enableValidation) {
        this.validateContextValue(path, newValue);
      }

      this.updateContextValue(path, newValue);
      this.notifySubscribers(path, newValue, currentValue);
      this.addToHistory({ [path]: newValue });
      
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ContextError(`Failed to update context at path '${path}'`, { error, path });
    }
  }

  /**
   * 컨텍스트 구독
   */
  subscribeContext(path: string, callback: (value: any) => void): () => void {
    if (!this.subscribers.has(path)) {
      this.subscribers.set(path, new Set());
    }

    this.subscribers.get(path)!.add(callback);

    // 현재 값으로 즉시 콜백 호출
    const currentValue = this.getContext(path);
    if (currentValue !== null) {
      callback(currentValue);
    }

    // 구독 해제 함수 반환
    return () => {
      const subscribers = this.subscribers.get(path);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.subscribers.delete(path);
        }
      }
    };
  }

  /**
   * 컨텍스트 값 업데이트
   */
  private updateContextValue(path: string, value: any): void {
    const keys = path.split('.');
    let current: any = this.contexts;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;
  }

  /**
   * 컨텍스트 검증
   */
  private validateContextValue(path: string, value: any): void {
    const schema = this.validationSchemas.get(path);
    if (!schema) return;

    const validation = this.validateValue(value, schema);
    if (!validation.valid) {
      throw new ValidationError(
        `Validation failed for context path '${path}'`,
        { path, value, errors: validation.errors }
      );
    }
  }

  /**
   * 값 검증
   */
  private validateValue(value: any, schema: Schema): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];

    // 기본 타입 검증
    if (schema.type && typeof value !== schema.type) {
      errors.push({
        field: 'type',
        message: `Expected ${schema.type}, got ${typeof value}`,
        code: 'TYPE_MISMATCH',
        value
      });
    }

    // 필수 필드 검증
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in value)) {
          errors.push({
            field,
            message: `Required field '${field}' is missing`,
            code: 'REQUIRED_FIELD_MISSING',
            value
          });
        }
      }
    }

    // 속성 검증
    if (schema.properties && typeof value === 'object') {
      for (const [prop, propSchema] of Object.entries(schema.properties)) {
        if (prop in value) {
          const propValidation = this.validateValue(value[prop], propSchema as Schema);
          errors.push(...propValidation.errors);
          warnings.push(...propValidation.warnings);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 구독자에게 알림
   */
  private notifySubscribers(path: string, newValue: any, oldValue: any): void {
    const subscribers = this.subscribers.get(path);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(newValue);
        } catch (error) {
          console.error(`[ContextManager] Error in subscriber for path '${path}':`, error);
        }
      });
    }
  }

  /**
   * 히스토리에 추가
   */
  private addToHistory(update: ContextUpdate): void {
    this.history.push({
      ...update,
      timestamp: Date.now()
    } as any);

    // 히스토리 크기 제한
    if (this.history.length > this.options.maxHistory!) {
      this.history = this.history.slice(-this.options.maxHistory!);
    }
  }

  /**
   * 현재 컨텍스트 계층 조회
   */
  getCurrentContext(): ContextHierarchy {
    return { ...this.contexts };
  }

  /**
   * 컨텍스트 정리
   */
  cleanup(): void {
    this.subscribers.clear();
    this.history = [];
    this.isInitialized = false;
  }

  /**
   * 디버그 정보 조회
   */
  getDebugInfo(): ContextDebugInfo {
    return {
      totalContexts: this.countTotalContexts(),
      globalContext: this.contexts.global,
      sessionContext: this.contexts.session,
      sceneContexts: this.contexts.scene ? [this.contexts.scene] : [],
      componentContexts: this.contexts.component ? [this.contexts.component] : [],
      temporaryContexts: this.contexts.temporary ? [this.contexts.temporary] : [],
      memoryUsage: this.estimateMemoryUsage(),
      lastUpdated: Date.now()
    };
  }

  /**
   * 총 컨텍스트 수 계산
   */
  private countTotalContexts(): number {
    let count = 2; // global + session
    
    if (this.contexts.scene) count++;
    if (this.contexts.component) count++;
    if (this.contexts.temporary) count++;
    
    return count;
  }

  /**
   * 메모리 사용량 추정
   */
  private estimateMemoryUsage(): number {
    const jsonString = JSON.stringify(this.contexts);
    return new Blob([jsonString]).size;
  }

  /**
   * 플랫폼 감지
   */
  private detectPlatform(): string {
    if (typeof window === 'undefined') return 'server';
    
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('win')) return 'windows';
    if (userAgent.includes('mac')) return 'macos';
    if (userAgent.includes('linux')) return 'linux';
    if (userAgent.includes('android')) return 'android';
    if (userAgent.includes('ios')) return 'ios';
    
    return 'unknown';
  }

  /**
   * 브라우저 감지
   */
  private detectBrowser(): string {
    if (typeof window === 'undefined') return 'server';
    
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('chrome')) return 'chrome';
    if (userAgent.includes('firefox')) return 'firefox';
    if (userAgent.includes('safari')) return 'safari';
    if (userAgent.includes('edge')) return 'edge';
    
    return 'unknown';
  }

  /**
   * 시스템 기능 감지
   */
  private detectCapabilities(): any {
    if (typeof window === 'undefined') {
      return {
        webgl: false,
        webRTC: false,
        webAudio: false,
        webWorkers: false,
        serviceWorkers: false,
        pushNotifications: false,
        geolocation: false,
        camera: false,
        microphone: false
      };
    }

    return {
      webgl: !!window.WebGLRenderingContext,
      webRTC: !!(window.RTCPeerConnection || window.webkitRTCPeerConnection),
      webAudio: !!(window.AudioContext || window.webkitAudioContext),
      webWorkers: typeof Worker !== 'undefined',
      serviceWorkers: 'serviceWorker' in navigator,
      pushNotifications: 'PushManager' in window,
      geolocation: 'geolocation' in navigator,
      camera: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      microphone: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    };
  }

  /**
   * 세션 ID 생성
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 기본 검증 스키마 설정
   */
  private setupDefaultValidationSchemas(): void {
    // 글로벌 컨텍스트 스키마
    this.validationSchemas.set('global', {
      type: 'object',
      properties: {
        application: { type: 'object' },
        user: { type: 'object' },
        system: { type: 'object' }
      },
      required: ['application', 'user', 'system']
    });

    // 세션 컨텍스트 스키마
    this.validationSchemas.set('session', {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        startTime: { type: 'number' },
        lastActivity: { type: 'number' },
        duration: { type: 'number' }
      },
      required: ['sessionId', 'startTime', 'lastActivity', 'duration']
    });

    // 씬 컨텍스트 스키마
    this.validationSchemas.set('scene', {
      type: 'object',
      properties: {
        sceneId: { type: 'string' },
        type: { type: 'string' },
        title: { type: 'string' }
      },
      required: ['sceneId', 'type', 'title']
    });
  }

  /**
   * 검증 스키마 등록
   */
  registerValidationSchema(path: string, schema: Schema): void {
    this.validationSchemas.set(path, schema);
  }

  /**
   * 검증 스키마 제거
   */
  unregisterValidationSchema(path: string): void {
    this.validationSchemas.delete(path);
  }

  /**
   * 히스토리 조회
   */
  getHistory(): ContextUpdate[] {
    return [...this.history];
  }

  /**
   * 히스토리 정리
   */
  clearHistory(): void {
    this.history = [];
  }
}

// ============================================================================
// 팩토리 함수
// ============================================================================

export function createContextManager(options?: Partial<ContextManagerOptions>): ContextManager {
  return new ContextManager(options);
}

export function createGlobalContext(overrides?: Partial<GlobalContext>): GlobalContext {
  const defaultContext: GlobalContext = {
    application: {
      version: '1.0.0',
      environment: 'development',
      build: 'dev',
      features: {}
    },
    user: {
      id: 'anonymous',
      role: 'user',
      permissions: [],
      preferences: {
        theme: 'auto',
        language: 'en',
        fontSize: 'medium',
        animations: true,
        sounds: true,
        notifications: true
      },
      locale: 'en-US',
      timezone: 'UTC'
    },
    system: {
      platform: 'unknown',
      browser: 'unknown',
      capabilities: {
        webgl: false,
        webRTC: false,
        webAudio: false,
        webWorkers: false,
        serviceWorkers: false,
        pushNotifications: false,
        geolocation: false,
        camera: false,
        microphone: false
      },
      performance: {
        memory: { used: 0, total: 0, limit: 0 },
        cpu: { usage: 0, cores: 1 },
        network: { latency: 0, bandwidth: 0 },
        rendering: { fps: 60, frameTime: 16.67 }
      }
    }
  };

  return { ...defaultContext, ...overrides };
}

export function createSessionContext(overrides?: Partial<SessionContext>): SessionContext {
  const now = Date.now();
  const defaultContext: SessionContext = {
    sessionId: `session_${now}_${Math.random().toString(36).substr(2, 9)}`,
    startTime: now,
    lastActivity: now,
    duration: 0,
    navigation: {
      history: [],
      current: '/',
      previous: null
    },
    state: {
      authenticated: false,
      loading: false,
      error: null
    },
    data: {
      cache: {},
      variables: {},
      temporary: {}
    }
  };

  return { ...defaultContext, ...overrides };
}
