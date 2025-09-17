/**
 * Director
 * AI 에이전트 운영체제의 메인 클래스
 */

import { ContextManager, createContextManager } from './context-manager';
import { AgentCommunicationInterface, AgentCommunicationAdapter, createAgentCommunicationAdapter } from './agent-communication-interface';
import { ThirdPartyAgent } from './third-party-agent';
import { SceneManager, createSceneManager } from './scene-manager';
import { UIRenderer, createUIRenderer } from './ui-renderer';
import { ActionHandler, createActionHandler } from './action-handler';
import { SubSceneManager, createSubSceneManager } from './subscene-manager';
import { ModalManager, createModalManager } from './modal-manager';
import { AnimationEngine, createAnimationEngine } from './animation-engine';
import { AIStateManager, createAIStateManager } from './ai-state-manager';
import { AIConversationManager, createAIConversationManager } from './ai-conversation-manager';
import { VirtualDOM, createVirtualDOM } from './virtual-dom';
import { HybridRenderer, createHybridRenderer } from './hybrid-renderer';
import { 
  DirectorConfig, 
  AgentRequest, 
  AgentResponse, 
  ContextHierarchy,
  SystemEvent,
  DirectorError,
  Scene,
  SceneConfig,
  DirectorGlobalThis,
  ConversationChain
} from '../types';
import { registerServiceInstance } from './service-container';

// DEFAULT_CONFIG는 순환 import를 피하기 위해 여기에 정의
const DEFAULT_CONFIG: DirectorConfig = {
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

export class Director {
  private contextManager: ContextManager;
  private agentCommunication: AgentCommunicationInterface;
  private sceneManager: SceneManager;
  private uiRenderer: UIRenderer;
  private actionHandler: ActionHandler;
  private subSceneManager: SubSceneManager;
  private modalManager: ModalManager;
  private animationEngine: AnimationEngine;
  private aiStateManager: AIStateManager;
  private aiConversationManager: AIConversationManager;
  private virtualDOM: VirtualDOM;
  private hybridRenderer: HybridRenderer;
  private config: DirectorConfig;
  private isInitialized: boolean = false;
  private eventListeners: Set<(event: SystemEvent) => void> = new Set();

  constructor(
    config: Partial<DirectorConfig> = {},
    agentCommunication?: AgentCommunicationInterface | ThirdPartyAgent
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.contextManager = createContextManager();
    
    // ThirdPartyAgent인 경우 AgentCommunicationAdapter로 래핑
    if (agentCommunication && 'name' in agentCommunication && 'type' in agentCommunication) {
      this.agentCommunication = createAgentCommunicationAdapter();
      (this.agentCommunication as AgentCommunicationAdapter).setThirdPartyAgent(agentCommunication as ThirdPartyAgent);
    } else {
      this.agentCommunication = agentCommunication as AgentCommunicationInterface || createAgentCommunicationAdapter();
    }
    
    this.sceneManager = createSceneManager();
    this.uiRenderer = createUIRenderer();
    this.actionHandler = createActionHandler();
    this.subSceneManager = createSubSceneManager();
    this.modalManager = createModalManager();
    this.animationEngine = createAnimationEngine();
    this.aiStateManager = createAIStateManager();
    this.virtualDOM = createVirtualDOM();
    this.hybridRenderer = createHybridRenderer();
    
    // AI Conversation Manager는 다른 시스템들이 초기화된 후에 생성
    this.aiConversationManager = createAIConversationManager(
      this.aiStateManager,
      this.agentCommunication
    );
    
    this.setupEventHandlers();
  }

  /**
   * 이벤트 핸들러 설정
   */
  private setupEventHandlers(): void {
    // 이벤트 핸들러들은 초기화 시에 설정됨
  }

  /**
   * Director 초기화
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
      
      // eslint-disable-next-line
      console.log('[Director] Initialized successfully');
      
    } catch (error) {
      throw new DirectorError('Failed to initialize Director', 'INIT_ERROR', { error });
    }
  }

  /**
   * Director 종료
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
      
      // eslint-disable-next-line
      console.log('[Director] Shutdown successfully');
      
    } catch (error) {
      throw new DirectorError('Failed to shutdown Director', 'SHUTDOWN_ERROR', { error });
    }
  }

  /**
   * 초기화 상태 확인
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  // ============================================================================
  // 메인 API - 사용자 요청 처리
  // ============================================================================

  /**
   * 메인 API - 사용자 요청을 AI를 통해 Scene으로 변환
   */
  async request(userInput: string): Promise<Scene> {
    if (!this.isInitialized) {
      throw new DirectorError('Director is not initialized. Call initialize() first.', 'NOT_INITIALIZED');
    }

    try {
      return await this.sceneManager.request(userInput);
    } catch (error) {
      // eslint-disable-next-line
      console.error('[Director] Request failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new DirectorError(`Request failed: ${errorMessage}`, 'REQUEST_ERROR', error as Record<string, unknown>);
    }
  }

  /**
   * 현재 대화 체인 조회
   */
  getCurrentConversationChain(): ConversationChain | null {
    return this.sceneManager.getCurrentConversationChain();
  }

  /**
   * 대화 이력 조회
   */
  getConversationHistory(): Scene[] {
    return this.sceneManager.getConversationHistory();
  }

  /**
   * 대화 계속하기
   */
  async continueConversation(userInput: string): Promise<Scene> {
    return await this.request(userInput);
  }

  // ============================================================================
  // Agent 통신 API (SceneManager에서 사용)
  // ============================================================================

  /**
   * Agent에 요청 전송 (SceneManager에서 사용)
   */
  async sendRequest(request: AgentRequest): Promise<AgentResponse> {
    if (!this.agentCommunication) {
      throw new DirectorError('Agent communication not configured', 'NO_AGENT_COMM');
    }

    try {
      return await this.agentCommunication.sendRequest(request);
    } catch (error) {
      // eslint-disable-next-line
      console.error('[Director] Agent request failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new DirectorError(`Agent request failed: ${errorMessage}`, 'AGENT_REQUEST_ERROR', error as Record<string, unknown>);
    }
  }

  /**
   * 컨텍스트 조회
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getContext<T = any>(path: string): T | null {
    return this.contextManager.getContext<T>(path);
  }

  /**
   * 컨텍스트 설정
   */
  setContext(path: string, value: unknown): void {
    this.contextManager.setContext(path, value);
  }

  /**
   * 컨텍스트 업데이트
   */
  updateContext(path: string, updater: (current: unknown) => unknown): void {
    this.contextManager.updateContext(path, updater);
  }

  /**
   * 컨텍스트 구독
   */
  subscribeContext(path: string, callback: (value: unknown) => void): () => void {
    return this.contextManager.subscribeContext(path, callback);
  }

  /**
   * 현재 컨텍스트 계층 조회
   */
  getCurrentContext(): ContextHierarchy {
    return this.contextManager.getCurrentContext();
  }


  /**
   * 스트리밍 요청 전송
   */
  async sendStreamRequest(request: AgentRequest): Promise<AsyncIterable<AgentResponse>> {
    if (!this.isReady()) {
      throw new DirectorError('Director is not ready', 'NOT_READY');
    }

    try {
      return await this.agentCommunication.sendStreamRequest(request);
    } catch (error) {
      throw new DirectorError('Failed to send stream request to agent', 'STREAM_REQUEST_ERROR', { error, request });
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
  updateConfig(updates: Partial<DirectorConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Agent Communication 설정 업데이트
    if (this.agentCommunication) {
      this.agentCommunication.updateConfig(this.config);
    }
  }

  /**
   * 컴포넌트 간 의존성 설정
   */
  private setupComponentDependencies(): void {
    // 서비스 컨테이너에 인스턴스 등록
    registerServiceInstance('director', this);
    registerServiceInstance('sceneManager', this.sceneManager);
    registerServiceInstance('uiRenderer', this.uiRenderer);
    
    // eslint-disable-next-line
    console.log('[Director] Component dependencies set up');
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

    // eslint-disable-next-line
    console.log('[Director] Initial context set up');
  }

  /**
   * 시스템 정보 수집
   */
  private collectSystemInfo(): Record<string, unknown> {
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
          used: ('memory' in performance && performance.memory && typeof performance.memory === 'object' && performance.memory !== null) ? (performance.memory as any).usedJSHeapSize || 0 : 0,
          total: ('memory' in performance && performance.memory && typeof performance.memory === 'object' && performance.memory !== null) ? (performance.memory as any).totalJSHeapSize || 0 : 0,
          limit: ('memory' in performance && performance.memory && typeof performance.memory === 'object' && performance.memory !== null) ? (performance.memory as any).jsHeapSizeLimit || 0 : 0
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
  private detectCapabilities(): Record<string, boolean> {
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
      webRTC: !!(window.RTCPeerConnection || ('webkitRTCPeerConnection' in window)),
      webAudio: !!(window.AudioContext || ('webkitAudioContext' in window)),
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
        data: {
          response: response
        }
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
        data: { path: 'global', oldValue: null, newValue: value }
      });
    });

    // eslint-disable-next-line
    console.log('[Director] System event listeners set up');
  }

  /**
   * 시스템 이벤트 발생
   */
  private emitSystemEvent(event: SystemEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        // eslint-disable-next-line
        console.error('[Director] Error in event listener:', error);
      }
    });
  }

  // ============================================================================
  // SubScene 관리
  // ============================================================================

  /**
   * SubScene 생성
   */
  createSubScene(parentSceneId: string, config: any): any {
    return this.subSceneManager.createSubScene(parentSceneId, config);
  }

  /**
   * SubScene 업데이트
   */
  updateSubScene(subSceneId: string, updates: any): void {
    this.subSceneManager.updateSubScene(subSceneId, updates);
  }

  /**
   * SubScene 제거
   */
  removeSubScene(subSceneId: string): void {
    this.subSceneManager.removeSubScene(subSceneId);
  }

  /**
   * SubScene 조회
   */
  getSubScene(subSceneId: string): any {
    return this.subSceneManager.getSubScene(subSceneId);
  }

  // ============================================================================
  // Modal 관리
  // ============================================================================

  /**
   * Modal 열기
   */
  openModal(config: any): any {
    return this.modalManager.openModal(config);
  }

  /**
   * Modal 닫기
   */
  closeModal(modalId: string): void {
    this.modalManager.closeModal(modalId);
  }

  /**
   * Modal 조회
   */
  getModal(modalId: string): any {
    return this.modalManager.getModal(modalId);
  }

  /**
   * 모든 Modal 닫기
   */
  closeAllModals(): void {
    this.modalManager.closeAllModals();
  }

  // 애니메이션 제어는 렌더러/엔진 내부로 캡슐화합니다.

  // ============================================================================
  // AI 상태 관리
  // ============================================================================

  /**
   * Scene 상태 설정
   */
  setSceneState(sceneId: string, key: string, value: any): void {
    this.aiStateManager.setSceneState(sceneId, key, value);
  }

  /**
   * Scene 상태 조회
   */
  getSceneState(sceneId: string, key: string): any {
    return this.aiStateManager.getSceneState(sceneId, key);
  }

  /**
   * 전역 상태 설정
   */
  setGlobalState(key: string, value: any): void {
    this.aiStateManager.setGlobalState(key, value);
  }

  /**
   * 전역 상태 조회
   */
  getGlobalState(key: string): any {
    return this.aiStateManager.getGlobalState(key);
  }

  /**
   * 대화 컨텍스트 설정
   */
  setConversationContext(key: string, value: any): void {
    this.aiStateManager.setConversationContext(key, value);
  }

  /**
   * 대화 컨텍스트 조회
   */
  getConversationContext(key: string): any {
    return this.aiStateManager.getConversationContext(key);
  }

  // ============================================================================
  // AI 대화 관리
  // ============================================================================

  /**
   * 사용자 액션 처리
   */
  async handleUserAction(action: string, data: any, sceneId: string): Promise<AgentResponse> {
    return this.aiConversationManager.handleUserAction(action, data, sceneId);
  }

  /**
   * 사용자 입력 처리
   */
  async handleUserInput(userInput: string, sceneId: string): Promise<AgentResponse> {
    return this.aiConversationManager.handleUserInput(userInput, sceneId);
  }

  /**
   * 대화 단계 조회
   */
  getConversationStep(): number {
    return this.aiConversationManager.getConversationStep();
  }

  /**
   * 대화 초기화
   */
  resetConversation(): void {
    this.aiConversationManager.resetConversation();
  }

  // ============================================================================
  // 하이브리드 렌더러 관리
  // ============================================================================

  /**
   * 렌더링 모드 설정
   */
  setRenderingMode(mode: 'html' | 'virtual-dom' | 'component' | 'hybrid'): void {
    this.hybridRenderer.setRenderingMode(mode);
  }

  /**
   * 성능 통계 조회
   */
  getPerformanceStats(): any {
    return this.hybridRenderer.getPerformanceStats();
  }

  // ============================================================================
  // 정리
  // ============================================================================

  /**
   * 모든 시스템 정리
   */
  cleanup(): void {
    this.subSceneManager.cleanup();
    this.modalManager.cleanup();
    this.animationEngine.cleanup();
    this.aiStateManager.cleanup();
    this.aiConversationManager.cleanup();
    this.virtualDOM.cleanup();
    this.hybridRenderer.cleanup();
    
    // 기존 시스템들도 정리
    this.contextManager.cleanup();
    this.sceneManager.cleanup();
    this.uiRenderer.cleanup();
    this.actionHandler.cleanup();
  }
}

// ============================================================================
// 팩토리 함수들
// ============================================================================

export function createDirector(
  config?: Partial<DirectorConfig>,
  agentCommunication?: AgentCommunicationInterface
): Director {
  return new Director(config, agentCommunication);
}

export function getDirector(): Director | null {
  return (globalThis as DirectorGlobalThis).__DirectorInstance || null;
}

export async function initializeDirector(
  config?: Partial<DirectorConfig>,
  agentCommunication?: AgentCommunicationInterface
): Promise<Director> {
  const instance = createDirector(config, agentCommunication);
  await instance.initialize();
  
  // 전역 인스턴스로 저장
  (globalThis as DirectorGlobalThis).__DirectorInstance = instance;
  
  return instance;
}

export async function shutdownDirector(): Promise<void> {
  const instance = getDirector();
  if (instance) {
    await instance.shutdown();
    (globalThis as DirectorGlobalThis).__DirectorInstance = null;
  }
}
