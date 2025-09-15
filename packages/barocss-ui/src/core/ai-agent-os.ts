/**
 * AI Agent OS
 * AI 에이전트 운영체제의 메인 클래스
 */

import { ContextManager, createContextManager } from './context-manager';
import { AgentCommunicationInterface, AgentCommunicationAdapter, createAgentCommunicationAdapter } from './agent-communication-interface';
import { ThirdPartyAgent } from './third-party-agent';
import { SceneManager, createSceneManager } from './scene-manager';
import { UIRenderer, createUIRenderer } from './ui-renderer';
import { ActionHandler, createActionHandler } from './action-handler';
import { 
  AIAgentOSConfig, 
  AgentRequest, 
  AgentResponse, 
  ContextHierarchy,
  SystemEvent,
  AIAgentOSError,
  Scene,
  SceneConfig,
  UserRequest,
  AIResponse,
  SceneContext
} from '../types';

// DEFAULT_CONFIG는 순환 import를 피하기 위해 여기에 정의
const DEFAULT_CONFIG: AIAgentOSConfig = {
  version: '1.0.0',
  environment: 'development',
  debug: false,
  
  communication: {
    websocket: {
      url: 'ws://localhost:8080/agent',
      reconnect: true,
      maxReconnectAttempts: 5,
      reconnectInterval: 1000
    },
    rest: {
      baseUrl: 'http://localhost:8080/api',
      timeout: 30000,
      retries: 3
    }
  },
  
  state: {
    persistence: true,
    storage: 'localStorage',
    maxHistory: 100
  },
  
  ui: {
    theme: 'auto',
    animations: true,
    transitions: true
  },
  
  performance: {
    maxScenes: 100,
    cleanupInterval: 60000,
    gcThreshold: 0.8
  },
  
  security: {
    encryption: false,
    validation: true,
    sanitization: true
  }
};

export class AIAgentOS {
  private contextManager: ContextManager;
  private agentCommunication: AgentCommunicationInterface;
  private sceneManager: SceneManager;
  private uiRenderer: UIRenderer;
  private actionHandler: ActionHandler;
  private config: AIAgentOSConfig;
  private isInitialized: boolean = false;
  private eventListeners: Set<(event: SystemEvent) => void> = new Set();

  constructor(
    config: Partial<AIAgentOSConfig> = {},
    agentCommunication?: AgentCommunicationInterface | ThirdPartyAgent
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.contextManager = createContextManager();
    
    // ThirdPartyAgent인 경우 AgentCommunicationAdapter로 래핑
    if (agentCommunication && 'name' in agentCommunication && 'type' in agentCommunication) {
      this.agentCommunication = createAgentCommunicationAdapter();
      (this.agentCommunication as AgentCommunicationAdapter).setThirdPartyAgent(agentCommunication as ThirdPartyAgent);
    } else {
      this.agentCommunication = agentCommunication || createAgentCommunicationAdapter();
    }
    
    this.sceneManager = createSceneManager();
    this.uiRenderer = createUIRenderer();
    this.actionHandler = createActionHandler();
    
    this.setupEventHandlers();
  }

  /**
   * 이벤트 핸들러 설정
   */
  private setupEventHandlers(): void {
    // 이벤트 핸들러들은 초기화 시에 설정됨
  }

  /**
   * AI Agent OS 초기화
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // 초기 컨텍스트 설정
      await this.setupInitialContext();

      // 컴포넌트 간 의존성 설정
      this.setupComponentDependencies();

      // 이벤트 리스너 설정
      this.setupSystemEventListeners();

      this.isInitialized = true;
      
      console.log('[AIAgentOS] Initialized successfully');
      
    } catch (error) {
      throw new AIAgentOSError('Failed to initialize AI Agent OS', { error });
    }
  }

  /**
   * AI Agent OS 종료
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // 컴포넌트 정리
      this.sceneManager.cleanup();
      this.uiRenderer.cleanup();
      this.actionHandler.cleanup();
      this.contextManager.cleanup();

      // 이벤트 리스너 정리
      this.eventListeners.clear();

      this.isInitialized = false;
      
      console.log('[AIAgentOS] Shutdown successfully');
      
    } catch (error) {
      throw new AIAgentOSError('Failed to shutdown AI Agent OS', { error });
    }
  }

  /**
   * 초기화 상태 확인
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * 컨텍스트 조회
   */
  getContext<T = any>(path: string): T | null {
    return this.contextManager.getContext<T>(path);
  }

  /**
   * 컨텍스트 설정
   */
  setContext(path: string, value: any): void {
    this.contextManager.setContext(path, value);
  }

  /**
   * 컨텍스트 업데이트
   */
  updateContext(path: string, updater: (current: any) => any): void {
    this.contextManager.updateContext(path, updater);
  }

  /**
   * 컨텍스트 구독
   */
  subscribeContext(path: string, callback: (value: any) => void): () => void {
    return this.contextManager.subscribeContext(path, callback);
  }

  /**
   * 현재 컨텍스트 계층 조회
   */
  getCurrentContext(): ContextHierarchy {
    return this.contextManager.getCurrentContext();
  }

  /**
   * Agent에 요청 전송
   */
  async sendRequest(request: AgentRequest): Promise<AgentResponse> {
    if (!this.isReady()) {
      throw new AIAgentOSError('AI Agent OS is not ready');
    }

    try {
      return await this.agentCommunication.sendRequest(request);
    } catch (error) {
      throw new AIAgentOSError('Failed to send request to agent', { error, request });
    }
  }

  /**
   * 스트리밍 요청 전송
   */
  async sendStreamRequest(request: AgentRequest): Promise<AsyncIterable<AgentResponse>> {
    if (!this.isReady()) {
      throw new AIAgentOSError('AI Agent OS is not ready');
    }

    try {
      return await this.agentCommunication.sendStreamRequest(request);
    } catch (error) {
      throw new AIAgentOSError('Failed to send stream request to agent', { error, request });
    }
  }

  /**
   * 시스템 이벤트 구독
   */
  subscribeToEvents(callback: (event: SystemEvent) => void): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  /**
   * Agent 통신 상태 조회
   */
  getAgentConnectionState() {
    return {
      isConnected: this.agentCommunication.isConnected(),
      stats: this.agentCommunication.getStats()
    };
  }

  /**
   * 씬 생성
   */
  createScene(config: SceneConfig): Scene {
    const scene = this.sceneManager.createScene(config);
    this.uiRenderer.renderScene(scene);
    return scene;
  }

  /**
   * 씬 업데이트
   */
  updateScene(sceneId: string, updates: Partial<SceneConfig>): void {
    this.sceneManager.updateScene(sceneId, updates);
    const scene = this.sceneManager.getScene(sceneId);
    if (scene) {
      this.uiRenderer.updateScene(scene);
    }
  }

  /**
   * 씬 삭제
   */
  removeScene(sceneId: string, cascade: boolean = false): void {
    this.sceneManager.removeScene(sceneId, cascade);
    this.uiRenderer.removeScene(sceneId);
  }

  /**
   * 씬 조회
   */
  getScene(sceneId: string): Scene | null {
    return this.sceneManager.getScene(sceneId);
  }

  /**
   * 모든 씬 조회
   */
  getAllScenes(): Scene[] {
    return this.sceneManager.getAllScenes();
  }

  /**
   * 활성 씬 설정
   */
  setActiveScene(sceneId: string | null): void {
    this.sceneManager.setActiveScene(sceneId);
  }

  /**
   * 활성 씬 조회
   */
  getActiveScene(): Scene | null {
    return this.sceneManager.getActiveScene();
  }

  /**
   * 씬 일관성 검증
   */
  validateSceneConsistency() {
    return this.sceneManager.validateConsistency();
  }

  /**
   * 시스템 통계 조회
   */
  getStats() {
    return {
      isReady: this.isReady(),
      agentConnection: this.getAgentConnectionState(),
      contextDebugInfo: this.contextManager.getDebugInfo(),
      sceneStats: this.sceneManager.getStats(),
      renderStats: this.uiRenderer.getStats(),
      actionStats: this.actionHandler.getActionStats()
    };
  }

  /**
   * 설정 업데이트
   */
  updateConfig(updates: Partial<AIAgentOSConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Agent Communication 설정 업데이트
    this.agentCommunication.updateConfig(this.config);
  }

  /**
   * 컴포넌트 간 의존성 설정
   */
  private setupComponentDependencies(): void {
    // UIRenderer에 SceneManager 설정
    this.uiRenderer.setSceneManager(this.sceneManager);
    
    // ActionHandler에 SceneManager와 UIRenderer 설정
    this.actionHandler.setSceneManager(this.sceneManager);
    this.actionHandler.setUIRenderer(this.uiRenderer);
    
    console.log('[AIAgentOS] Component dependencies set up');
  }

  /**
   * 초기 컨텍스트 설정
   */
  private async setupInitialContext(): Promise<void> {
    // 시스템 정보 수집
    const systemInfo = this.collectSystemInfo();
    
    // 글로벌 컨텍스트 업데이트
    this.contextManager.updateContext('global.system', (current) => ({
      ...current,
      ...systemInfo
    }));

    // 세션 컨텍스트 업데이트
    this.contextManager.updateContext('session.state', (current) => ({
      ...current,
      authenticated: false,
      loading: false,
      error: null
    }));

    console.log('[AIAgentOS] Initial context set up');
  }

  /**
   * 시스템 정보 수집
   */
  private collectSystemInfo(): any {
    if (typeof window === 'undefined') {
      return {
        platform: 'server',
        browser: 'server',
        capabilities: {}
      };
    }

    return {
      platform: this.detectPlatform(),
      browser: this.detectBrowser(),
      capabilities: this.detectCapabilities(),
      performance: {
        memory: {
          used: (performance as any).memory?.usedJSHeapSize || 0,
          total: (performance as any).memory?.totalJSHeapSize || 0,
          limit: (performance as any).memory?.jsHeapSizeLimit || 0
        },
        cpu: {
          usage: 0,
          cores: navigator.hardwareConcurrency || 1
        },
        network: {
          latency: 0,
          bandwidth: 0
        },
        rendering: {
          fps: 60,
          frameTime: 16.67
        }
      }
    };
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
      webRTC: !!(window.RTCPeerConnection || (window as any).webkitRTCPeerConnection),
      webAudio: !!(window.AudioContext || (window as any).webkitAudioContext),
      webWorkers: typeof Worker !== 'undefined',
      serviceWorkers: 'serviceWorker' in navigator,
      pushNotifications: 'PushManager' in window,
      geolocation: 'geolocation' in navigator,
      camera: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      microphone: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    };
  }

  /**
   * 시스템 이벤트 리스너 설정
   */
  private setupSystemEventListeners(): void {
    // Agent Communication 이벤트 구독
    this.agentCommunication.addMessageHandler((response) => {
      this.emitSystemEvent({
        type: 'agent_response',
        timestamp: Date.now(),
        source: 'agent',
        data: response
      });
    });

    this.agentCommunication.addErrorHandler((error) => {
      this.emitSystemEvent({
        type: 'agent_error',
        timestamp: Date.now(),
        source: 'agent',
        data: { error: error.message }
      });
    });

    // 컨텍스트 변경 이벤트 구독
    this.contextManager.subscribeContext('global', (value) => {
      this.emitSystemEvent({
        type: 'context_change',
        timestamp: Date.now(),
        source: 'context',
        data: { path: 'global', newValue: value }
      });
    });

    console.log('[AIAgentOS] System event listeners set up');
  }

  /**
   * 시스템 이벤트 발생
   */
  private emitSystemEvent(event: SystemEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[AIAgentOS] Error in event listener:', error);
      }
    });
  }
}

// ============================================================================
// 팩토리 함수들
// ============================================================================

export function createAIAgentOS(
  config?: Partial<AIAgentOSConfig>,
  agentCommunication?: AgentCommunicationInterface
): AIAgentOS {
  return new AIAgentOS(config, agentCommunication);
}

export function getAIAgentOS(): AIAgentOS | null {
  return (globalThis as any).__AIAgentOSInstance || null;
}

export async function initializeAIAgentOS(
  config?: Partial<AIAgentOSConfig>,
  agentCommunication?: AgentCommunicationInterface
): Promise<AIAgentOS> {
  const instance = createAIAgentOS(config, agentCommunication);
  await instance.initialize();
  
  // 전역 인스턴스로 저장
  (globalThis as any).__AIAgentOSInstance = instance;
  
  return instance;
}

export async function shutdownAIAgentOS(): Promise<void> {
  const instance = getAIAgentOS();
  if (instance) {
    await instance.shutdown();
    (globalThis as any).__AIAgentOSInstance = null;
  }
}
