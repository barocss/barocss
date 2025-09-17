/**
 * Agent Types
 * 간단한 Agent 타입 정의 (Third-party Agent 패턴 사용)
 */

import { AgentRequest, AgentResponse } from '../types';

// ============================================================================
// 기본 Agent 타입들
// ============================================================================

/**
 * Mock Agent (테스트용)
 */
export interface MockAgent {
  type: 'mock';
  name: string;
  responses?: Map<string, AgentResponse>;
  delay?: number;
  errorRate?: number;
  capabilities?: string[];
}

/**
 * 커스텀 Agent (사용자 정의)
 */
export interface CustomAgent {
  type: 'custom';
  name: string;
  implementation: {
    sendRequest: (request: AgentRequest) => Promise<AgentResponse>;
    sendStreamRequest?: (request: AgentRequest) => Promise<AsyncIterable<AgentResponse>>;
    isConnected: () => boolean;
    connect?: () => Promise<void>;
    disconnect?: () => Promise<void>;
  };
}

// ============================================================================
// 통합 Agent 타입
// ============================================================================

export type AgentConfig = MockAgent | CustomAgent;

// ============================================================================
// Agent 구현체 인터페이스
// ============================================================================

export interface AgentImplementation {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  sendRequest(request: AgentRequest): Promise<AgentResponse>;
  sendStreamRequest?(request: AgentRequest): Promise<AsyncIterable<AgentResponse>>;
  getStats?(): Record<string, any>;
}

// ============================================================================
// Mock Agent 구현체
// ============================================================================

export class MockAgentImplementation implements AgentImplementation {
  private responses: Map<string, AgentResponse>;
  private delay: number;
  private errorRate: number;
  private connected: boolean = false;
  private name: string;
  private capabilities: string[];

  constructor(config: MockAgent) {
    this.name = config.name;
    this.responses = config.responses || new Map();
    this.delay = config.delay || 0;
    this.errorRate = config.errorRate || 0;
    this.capabilities = config.capabilities || ['text-generation', 'ui-creation'];
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async sendRequest(request: AgentRequest): Promise<AgentResponse> {
    if (!this.connected) {
      throw new Error('Agent not connected');
    }

    if (Math.random() < this.errorRate) {
      throw new Error('Mock agent error');
    }

    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }

    return this.responses.get(request.id) || {
      type: 'success',
      id: `mock-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      requestId: request.id,
      timestamp: Date.now(),
      processingTime: this.delay,
      status: { success: true, code: 200, message: 'OK' },
      data: { 
        result: { 
          content: 'Mock response',
          type: 'text',
          metadata: { requestType: request.type }
        } 
      },
      metadata: { version: '1.0.0', correlationId: request.metadata?.correlationId || 'mock' }
    };
  }

  getStats() {
    return {
      type: 'mock',
      name: this.name,
      connected: this.connected,
      capabilities: this.capabilities,
      responseCount: this.responses.size,
      delay: this.delay,
      errorRate: this.errorRate
    };
  }
}

/**
 * Custom Agent 구현체
 */
export class CustomAgentImplementation implements AgentImplementation {
  private name: string;
  private implementation: CustomAgent['implementation'];

  constructor(config: CustomAgent) {
    this.name = config.name;
    this.implementation = config.implementation;
  }

  async connect(): Promise<void> {
    await this.implementation.connect?.();
  }

  async disconnect(): Promise<void> {
    await this.implementation.disconnect?.();
  }

  isConnected(): boolean {
    return this.implementation.isConnected();
  }

  async sendRequest(request: AgentRequest): Promise<AgentResponse> {
    return this.implementation.sendRequest(request);
  }

  async sendStreamRequest(request: AgentRequest): Promise<AsyncIterable<AgentResponse>> {
    if (!this.implementation.sendStreamRequest) {
      throw new Error('Stream requests not supported');
    }
    return this.implementation.sendStreamRequest(request);
  }

  getStats() {
    return { type: 'custom', name: this.name };
  }
}

// ============================================================================
// 팩토리 함수들
// ============================================================================

export const createMockAgent = (config: MockAgent): AgentImplementation => {
  return new MockAgentImplementation(config);
};

export const createCustomAgent = (config: CustomAgent): AgentImplementation => {
  return new CustomAgentImplementation(config);
};