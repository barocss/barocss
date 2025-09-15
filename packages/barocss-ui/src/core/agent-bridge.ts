/**
 * Agent Bridge
 * AI Agent와의 연계 지점을 설정하는 브리지 패턴
 */

import { AgentRequest, AgentResponse } from '../types';

// ============================================================================
// Agent Bridge 인터페이스
// ============================================================================

export interface AgentBridgeHandlers {
  /**
   * Agent에 요청을 보낼 때 호출되는 핸들러
   * @param request - Director에서 생성된 요청
   * @returns - Agent에 전달할 실제 요청 데이터
   */
  request?: (request: AgentRequest) => Promise<any> | any;

  /**
   * Agent로부터 응답을 받을 때 호출되는 핸들러
   * @param response - Agent로부터 받은 원시 응답
   * @returns - Director 형식으로 변환된 응답
   */
  response?: (response: any) => Promise<AgentResponse> | AgentResponse;

  /**
   * 스트리밍 요청을 보낼 때 호출되는 핸들러
   * @param request - Director에서 생성된 요청
   * @returns - Agent에 전달할 실제 스트리밍 요청 데이터
   */
  streamRequest?: (request: AgentRequest) => Promise<any> | any;

  /**
   * 스트리밍 응답을 받을 때 호출되는 핸들러
   * @param chunk - Agent로부터 받은 스트림 청크
   * @returns - Director 형식으로 변환된 응답 청크
   */
  streamResponse?: (chunk: any) => Promise<AgentResponse> | AgentResponse;

  /**
   * 연결 상태 확인 핸들러
   * @returns - 연결 상태
   */
  isConnected?: () => boolean;

  /**
   * 연결 설정 핸들러
   */
  connect?: () => Promise<void>;

  /**
   * 연결 해제 핸들러
   */
  disconnect?: () => Promise<void>;

  /**
   * 에러 처리 핸들러
   * @param error - 발생한 에러
   * @returns - 처리된 에러 또는 null (에러 무시)
   */
  onError?: (error: Error) => Promise<Error | null> | Error | null;
}

export interface AgentBridgeConfig {
  /**
   * Agent 식별자
   */
  name: string;

  /**
   * Agent 타입 (선택사항)
   */
  type?: string;

  /**
   * Agent 메타데이터
   */
  metadata?: Record<string, any>;

  /**
   * 연계 핸들러들
   */
  handlers: AgentBridgeHandlers;
}

// ============================================================================
// Agent Bridge 구현체
// ============================================================================

export class AgentBridge {
  private config: AgentBridgeConfig;
  private isInitialized: boolean = false;
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    lastRequestTime: 0
  };

  constructor(config: AgentBridgeConfig) {
    this.config = config;
  }

  /**
   * Bridge 초기화
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      if (this.config.handlers.connect) {
        await this.config.handlers.connect();
      }
      this.isInitialized = true;
      console.log(`[AgentBridge] Initialized for agent: ${this.config.name}`);
    } catch (error) {
      throw new Error(`Failed to initialize agent bridge for ${this.config.name}: ${error}`);
    }
  }

  /**
   * Bridge 종료
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      if (this.config.handlers.disconnect) {
        await this.config.handlers.disconnect();
      }
      this.isInitialized = false;
      console.log(`[AgentBridge] Shutdown for agent: ${this.config.name}`);
    } catch (error) {
      console.error(`[AgentBridge] Error during shutdown: ${error}`);
    }
  }

  /**
   * 요청 전송
   */
  async sendRequest(request: AgentRequest): Promise<AgentResponse> {
    if (!this.isInitialized) {
      throw new Error('Agent bridge not initialized');
    }

    const startTime = performance.now();
    this.stats.totalRequests++;
    this.stats.lastRequestTime = Date.now();

    try {
      // 요청 변환
      const agentRequest = this.config.handlers.request 
        ? await this.config.handlers.request(request)
        : request;

      // 실제 Agent 호출 (사용자가 구현)
      const agentResponse = await this.callAgent(agentRequest);

      // 응답 변환
      const response = this.config.handlers.response
        ? await this.config.handlers.response(agentResponse)
        : this.defaultResponseTransform(agentResponse, request);

      this.stats.successfulRequests++;
      
      const responseTime = performance.now() - startTime;
      this.updateAverageResponseTime(responseTime);

      return response;
    } catch (error) {
      this.stats.failedRequests++;
      
      // 에러 처리
      if (this.config.handlers.onError) {
        const processedError = await this.config.handlers.onError(error as Error);
        if (processedError) {
          throw processedError;
        }
        // null이면 에러 무시
        return this.createErrorResponse(request, 'Error ignored by handler');
      }

      throw error;
    }
  }

  /**
   * 스트리밍 요청 전송
   */
  async sendStreamRequest(request: AgentRequest): Promise<AsyncIterable<AgentResponse>> {
    if (!this.isInitialized) {
      throw new Error('Agent bridge not initialized');
    }

    this.stats.totalRequests++;
    this.stats.lastRequestTime = Date.now();

    try {
      // 요청 변환
      const agentRequest = this.config.handlers.streamRequest || this.config.handlers.request
        ? await (this.config.handlers.streamRequest || this.config.handlers.request)!(request)
        : request;

      // 실제 Agent 스트림 호출 (사용자가 구현)
      const agentStream = await this.callAgentStream(agentRequest);

      this.stats.successfulRequests++;

      return {
        async *[Symbol.asyncIterator]() {
          for await (const chunk of agentStream) {
            const response = this.config.handlers.streamResponse || this.config.handlers.response
              ? await (this.config.handlers.streamResponse || this.config.handlers.response)!(chunk)
              : this.defaultResponseTransform(chunk, request);
            
            yield response;
          }
        }
      };
    } catch (error) {
      this.stats.failedRequests++;
      
      if (this.config.handlers.onError) {
        const processedError = await this.config.handlers.onError(error as Error);
        if (processedError) {
          throw processedError;
        }
        return {
          async *[Symbol.asyncIterator]() {
            yield this.createErrorResponse(request, 'Stream error ignored by handler');
          }
        };
      }

      throw error;
    }
  }

  /**
   * 연결 상태 확인
   */
  isConnected(): boolean {
    if (!this.isInitialized) {
      return false;
    }
    return this.config.handlers.isConnected ? this.config.handlers.isConnected() : true;
  }

  /**
   * 통계 조회
   */
  getStats() {
    return {
      ...this.stats,
      agent: {
        name: this.config.name,
        type: this.config.type,
        metadata: this.config.metadata,
        isInitialized: this.isInitialized
      }
    };
  }

  /**
   * Agent 호출 (사용자가 구현해야 함)
   * 이 메서드는 추상 메서드로, 실제 Agent 호출 로직을 구현해야 함
   */
  protected async callAgent(request: any): Promise<any> {
    throw new Error('callAgent method must be implemented by subclass');
  }

  /**
   * Agent 스트림 호출 (사용자가 구현해야 함)
   */
  protected async callAgentStream(request: any): Promise<AsyncIterable<any>> {
    throw new Error('callAgentStream method must be implemented by subclass');
  }

  /**
   * 기본 응답 변환
   */
  private defaultResponseTransform(agentResponse: any, originalRequest: AgentRequest): AgentResponse {
    return {
      type: 'success',
      id: `bridge-${Date.now()}`,
      requestId: originalRequest.id,
      timestamp: Date.now(),
      processingTime: 0,
      status: {
        success: true,
        code: 200,
        message: 'OK'
      },
      data: {
        result: agentResponse
      },
      metadata: {
        version: '1.0.0',
        agent: this.config.name,
        bridge: true
      }
    };
  }

  /**
   * 에러 응답 생성
   */
  private createErrorResponse(request: AgentRequest, message: string): AgentResponse {
    return {
      type: 'error',
      id: `bridge-error-${Date.now()}`,
      requestId: request.id,
      timestamp: Date.now(),
      processingTime: 0,
      status: {
        success: false,
        code: 500,
        message
      },
      data: {
        error: message
      },
      metadata: {
        version: '1.0.0',
        agent: this.config.name,
        bridge: true
      }
    };
  }

  /**
   * 평균 응답 시간 업데이트
   */
  private updateAverageResponseTime(responseTime: number): void {
    const totalTime = this.stats.averageResponseTime * (this.stats.totalRequests - 1) + responseTime;
    this.stats.averageResponseTime = totalTime / this.stats.totalRequests;
  }
}

// ============================================================================
// 팩토리 함수들
// ============================================================================

/**
 * Agent Bridge 생성
 */
export function createAgentBridge(config: AgentBridgeConfig): AgentBridge {
  return new AgentBridge(config);
}

/**
 * 간편한 Agent Bridge 생성 (핸들러만 전달)
 */
export function createSimpleAgentBridge(
  name: string,
  handlers: AgentBridgeHandlers,
  metadata?: Record<string, any>
): AgentBridge {
  return new AgentBridge({
    name,
    handlers,
    metadata
  });
}
