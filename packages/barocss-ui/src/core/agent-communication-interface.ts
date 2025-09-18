/**
 * Agent Communication Interface
 * AI Agent와의 통신을 위한 인터페이스 정의
 */

import {
  AgentRequest,
  AgentResponse,
  SystemEvent
} from '../types';
import { ThirdPartyAgent } from './third-party-agent';
import { 
  AgentConfig, 
  AgentImplementation,
  createMockAgent,
  createCustomAgent
} from './agent-types';
import { 
  AgentBridge, 
  AgentBridgeConfig, 
  AgentBridgeHandlers,
  createAgentBridge,
  createSimpleAgentBridge
} from './agent-bridge';

export interface AgentCommunicationInterface {
  /**
   * Agent에 요청 전송
   */
  sendRequest(request: AgentRequest): Promise<AgentResponse>;

  /**
   * 스트리밍 요청 전송
   */
  sendStreamRequest(request: AgentRequest): Promise<AsyncIterable<AgentResponse>>;

  /**
   * 연결 상태 조회
   */
  isConnected(): boolean;

  /**
   * 메시지 핸들러 추가
   */
  addMessageHandler(handler: (response: AgentResponse) => void): () => void;

  /**
   * 에러 핸들러 추가
   */
  addErrorHandler(handler: (error: Error) => void): () => void;

  /**
   * 설정 업데이트
   */
  updateConfig(config: any): void;

  /**
   * 통계 조회
   */
  getStats(): {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    lastRequestTime: number;
  };
}

export interface AgentCommunicationOptions {
  enableLogging?: boolean;
  enableRetry?: boolean;
  maxRetryAttempts?: number;
  retryDelay?: number;
}

/**
 * 개선된 Agent Communication Adapter
 * 다양한 Agent 타입을 지원하는 통합 인터페이스
 */
export class AgentCommunicationAdapter implements AgentCommunicationInterface {
  private messageHandlers: Set<(response: AgentResponse) => void> = new Set();
  private errorHandlers: Set<(error: Error) => void> = new Set();
  private options: AgentCommunicationOptions;
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    lastRequestTime: 0
  };

  // Agent 구현체
  private agentImplementation?: AgentImplementation;
  private isInitialized: boolean = false;

  constructor(options: AgentCommunicationOptions = {}) {
    this.options = {
      enableLogging: true,
      enableRetry: true,
      maxRetryAttempts: 3,
      retryDelay: 1000,
      ...options
    };
  }

  /**
   * Agent 설정
   */
  setAgent(implementation: AgentImplementation): void {
    this.agentImplementation = implementation;
    this.isInitialized = true;
  }

  /**
   * Agent Bridge 설정 (새로운 방식)
   */
  async setAgentBridge(bridge: AgentBridge): Promise<void> {
    await bridge.initialize();
    this.agentImplementation = {
      connect: async () => {},
      disconnect: async () => bridge.shutdown(),
      isConnected: () => bridge.isConnected(),
      sendRequest: () => bridge.sendRequest(),
      sendStreamRequest: () => bridge.sendStreamRequest(),
      getStats: () => bridge.getStats()
    };
    this.isInitialized = true;
  }

  /**
   * 간편한 Agent Bridge 설정
   */
  async setAgentBridgeHandlers(): Promise<void> {
    const bridge = createSimpleAgentBridge();
    await this.setAgentBridge(bridge);
  }

  /**
   * Third-party Agent 설정
   */
  async setThirdPartyAgent(agent: ThirdPartyAgent): Promise<void> {
    this.agentImplementation = {
      connect: agent.connect || (async () => {}),
      disconnect: agent.disconnect || (async () => {}),
      isConnected: agent.isConnected,
      sendRequest: agent.sendRequest,
      sendStreamRequest: agent.sendStreamRequest,
      getStats: agent.getStats || (() => ({ type: agent.type, name: agent.name }))
    };
  }

  /**
   * 커스텀 Agent 구현체 직접 설정 (기존 방식 지원)
   */
  setImplementation(impl: {
    sendRequest?: (request: AgentRequest) => Promise<AgentResponse>;
    sendStreamRequest?: (request: AgentRequest) => Promise<AsyncIterable<AgentResponse>>;
    isConnected?: () => boolean;
  }): void {
    this.agentImplementation = {
      connect: async () => {},
      disconnect: async () => {},
      isConnected: impl.isConnected || (() => true),
      sendRequest: impl.sendRequest || (async () => {
        throw new Error('sendRequest not implemented');
      }),
      sendStreamRequest: impl.sendStreamRequest,
      getStats: () => ({ type: 'custom-legacy' })
    };
    this.isInitialized = true;
  }

  async sendRequest(request: AgentRequest): Promise<AgentResponse> {
    if (!this.agentImplementation) {
      throw new Error('Agent not initialized. Call setAgent() or setImplementation() first.');
    }

    const startTime = performance.now();
    this.stats.totalRequests++;
    this.stats.lastRequestTime = Date.now();

    try {
      const response = await this.agentImplementation.sendRequest(request);
      this.stats.successfulRequests++;
      
      const responseTime = performance.now() - startTime;
      this.updateAverageResponseTime(responseTime);
      
      // 메시지 핸들러들에게 알림
      this.messageHandlers.forEach(handler => {
        try {
          handler(response);
        } catch (error) {
          console.error('[AgentCommunicationAdapter] Error in message handler:', error);
        }
      });

      return response;
    } catch (error) {
      this.stats.failedRequests++;
      
      // 에러 핸들러들에게 알림
      this.errorHandlers.forEach(handler => {
        try {
          handler(error as Error);
        } catch (handlerError) {
          console.error('[AgentCommunicationAdapter] Error in error handler:', handlerError);
        }
      });

      throw error;
    }
  }

  async sendStreamRequest(request: AgentRequest): Promise<AsyncIterable<AgentResponse>> {
    if (!this.agentImplementation) {
      throw new Error('Agent not initialized. Call setAgent() or setImplementation() first.');
    }

    if (!this.agentImplementation.sendStreamRequest) {
      throw new Error('Stream requests not supported by this agent');
    }

    this.stats.totalRequests++;
    this.stats.lastRequestTime = Date.now();

    try {
      const stream = await this.agentImplementation.sendStreamRequest(request);
      this.stats.successfulRequests++;
      return stream;
    } catch (error) {
      this.stats.failedRequests++;
      
      this.errorHandlers.forEach(handler => {
        try {
          handler(error as Error);
        } catch (handlerError) {
          console.error('[AgentCommunicationAdapter] Error in error handler:', handlerError);
        }
      });

      throw error;
    }
  }

  isConnected(): boolean {
    if (!this.agentImplementation) {
      return false;
    }
    return this.agentImplementation.isConnected();
  }

  addMessageHandler(handler: (response: AgentResponse) => void): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  addErrorHandler(handler: (error: Error) => void): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  getStats() {
    const baseStats = { ...this.stats };
    const agentStats = this.agentImplementation?.getStats?.() || {};
    
    return {
      ...baseStats,
      agent: agentStats,
      isInitialized: this.isInitialized
    };
  }

  /**
   * Agent 연결 해제
   */
  async disconnect(): Promise<void> {
    if (this.agentImplementation) {
      await this.agentImplementation.disconnect();
    }
    this.isInitialized = false;
  }

  /**
   * Agent 재연결
   */
  async reconnect(): Promise<void> {
    if (this.agentImplementation) {
      await this.agentImplementation.disconnect();
      await this.agentImplementation.connect();
    }
  }

  /**
   * Agent 타입 조회
   */
  getAgentType(): string | null {
    return this.agentImplementation?.getStats?.()?.type || null;
  }

  /**
   * 설정 업데이트
   */
  updateConfig(config: any): void {
    // 기본 구현 - 필요시 ThirdPartyAgent에서 오버라이드
    // eslint-disable-next-line
    console.log('[AgentCommunicationInterface] Config updated:', config);
  }

  private updateAverageResponseTime(responseTime: number): void {
    const totalTime = this.stats.averageResponseTime * (this.stats.totalRequests - 1) + responseTime;
    this.stats.averageResponseTime = totalTime / this.stats.totalRequests;
  }
}

// ============================================================================
// 팩토리 함수들
// ============================================================================

export function createAgentCommunicationAdapter(
  options?: AgentCommunicationOptions
): AgentCommunicationAdapter {
  return new AgentCommunicationAdapter(options);
}

/**
 * Agent 설정과 함께 Adapter 생성
 */
export function createAgentCommunicationAdapterWithAgent(
  implementation: AgentImplementation,
  options?: AgentCommunicationOptions
): AgentCommunicationAdapter {
  const adapter = new AgentCommunicationAdapter(options);
  adapter.setAgent(implementation);
  return adapter;
}

/**
 * Agent Bridge와 함께 Adapter 생성 (새로운 방식)
 */
export async function createAgentCommunicationAdapterWithBridge(
  bridge: AgentBridge,
  options?: AgentCommunicationOptions
): Promise<AgentCommunicationAdapter> {
  const adapter = new AgentCommunicationAdapter(options);
  await adapter.setAgentBridge(bridge);
  return adapter;
}

/**
 * Agent Bridge 핸들러와 함께 Adapter 생성 (간편한 방식)
 */
export async function createAgentCommunicationAdapterWithHandlers(
  options?: AgentCommunicationOptions
): Promise<AgentCommunicationAdapter> {
  const adapter = new AgentCommunicationAdapter(options);
  await adapter.setAgentBridgeHandlers();
  return adapter;
}

/**
 * Mock Agent와 함께 Adapter 생성 (테스트용)
 */
export function createMockAgentCommunicationAdapter(
  mockConfig?: {
    responses?: Map<string, AgentResponse>;
    delay?: number;
    errorRate?: number;
  },
  options?: AgentCommunicationOptions
): AgentCommunicationAdapter {
  const adapter = new AgentCommunicationAdapter(options);
  adapter.setImplementation({
    sendRequest: async (request) => {
      if (mockConfig?.errorRate && Math.random() < mockConfig.errorRate) {
        throw new Error('Mock agent error');
      }
      
      if (mockConfig?.delay) {
        await new Promise(resolve => setTimeout(resolve, mockConfig.delay));
      }
      
      return mockConfig?.responses?.get(request.id) || {
        type: 'success' as const,
        id: `mock-${Date.now()}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        requestId: request.id,
        timestamp: Date.now(),
        processingTime: mockConfig?.delay || 0,
        status: { success: true, code: 200, message: 'OK' },
        data: { 
          result: { 
            content: 'Mock response',
            type: 'text',
            metadata: {}
          } 
        },
        metadata: { version: '1.0.0', correlationId: 'mock' }
      };
    },
    isConnected: () => true
  });
  
  return adapter;
}
