/**
 * Director
 * AI 에이전트 운영체제의 메인 진입점
 */

// ============================================================================
// 타입 정의 내보내기
// ============================================================================

export * from './types';

// ============================================================================
// 메인 클래스들
// ============================================================================

export { 
  AIAgentOS, 
  createAIAgentOS, 
  getAIAgentOS, 
  initializeAIAgentOS, 
  shutdownAIAgentOS 
} from './core/ai-agent-os';
export { ContextManager, createContextManager, createGlobalContext, createSessionContext } from './core/context-manager';
export { 
  AgentCommunicationInterface, 
  AgentCommunicationAdapter, 
  createAgentCommunicationAdapter,
  createAgentCommunicationAdapterWithAgent,
  createAgentCommunicationAdapterWithBridge,
  createAgentCommunicationAdapterWithHandlers,
  createMockAgentCommunicationAdapter
} from './core/agent-communication-interface';
export {
  AgentBridge,
  AgentBridgeConfig,
  AgentBridgeHandlers,
  createAgentBridge,
  createSimpleAgentBridge
} from './core/agent-bridge';
export {
  ThirdPartyAgent,
  ThirdPartyAgentWrapper,
  createCustomWrapper
} from './core/third-party-agent';
export {
  AgentConfig,
  AgentImplementation,
  MockAgent,
  CustomAgent,
  createMockAgent,
  createCustomAgent
} from './core/agent-types';
export { SceneManager, createSceneManager } from './core/scene-manager';
export { UIRenderer, createUIRenderer } from './core/ui-renderer';
export { ActionHandler, createActionHandler } from './core/action-handler';

// ============================================================================
// 상수 정의
// ============================================================================

export const VERSION = '1.0.0';
export const API_VERSION = '1.0.0';

// ============================================================================
// 기본 설정
// ============================================================================

export const DEFAULT_CONFIG: AIAgentOSConfig = {
  version: VERSION,
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

// ============================================================================
// 기본 내보내기
// ============================================================================

export default {
  VERSION,
  API_VERSION,
  DEFAULT_CONFIG
};
