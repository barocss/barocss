/**
 * Third-party Agent Wrapper
 * 기존 AI 라이브러리를 AIAgentOS와 연동하기 위한 래퍼
 */

import { AgentRequest, AgentResponse } from '../types';

// ============================================================================
// Third-party Agent 인터페이스
// ============================================================================

export interface ThirdPartyAgent {
  /**
   * Agent 이름
   */
  name: string;

  /**
   * Agent 타입
   */
  type: string;

  /**
   * 요청 전송
   */
  sendRequest(request: AgentRequest): Promise<AgentResponse>;

  /**
   * 스트리밍 요청 전송
   */
  sendStreamRequest?(request: AgentRequest): Promise<AsyncIterable<AgentResponse>>;

  /**
   * 연결 상태 확인
   */
  isConnected(): boolean;

  /**
   * 연결
   */
  connect?(): Promise<void>;

  /**
   * 연결 해제
   */
  disconnect?(): Promise<void>;

  /**
   * 통계 정보
   */
  getStats?(): Record<string, any>;
}

// ============================================================================
// Third-party Agent 래퍼 클래스
// ============================================================================

export class ThirdPartyAgentWrapper implements ThirdPartyAgent {
  private agent: any;
  private name: string;
  private type: string;
  private requestTransformer: (request: AgentRequest) => any;
  private responseTransformer: (response: any) => AgentResponse;

  constructor(
    agent: any,
    options: {
      name: string;
      type: string;
      requestTransformer: (request: AgentRequest) => any;
      responseTransformer: (response: any) => AgentResponse;
    }
  ) {
    this.agent = agent;
    this.name = options.name;
    this.type = options.type;
    this.requestTransformer = options.requestTransformer;
    this.responseTransformer = options.responseTransformer;
  }

  async sendRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      const transformedRequest = this.requestTransformer(request);
      const response = await this.agent.chat.completions.create(transformedRequest);
      return this.responseTransformer(response);
    } catch (error) {
      throw new Error(`Third-party agent error: ${error.message}`);
    }
  }

  async sendStreamRequest(request: AgentRequest): Promise<AsyncIterable<AgentResponse>> {
    if (!this.agent.chat.completions.create) {
      throw new Error('Stream requests not supported by this agent');
    }

    try {
      const transformedRequest = this.requestTransformer(request);
      const stream = await this.agent.chat.completions.create({
        ...transformedRequest,
        stream: true
      });

      return {
        async *[Symbol.asyncIterator]() {
          for await (const chunk of stream) {
            yield this.responseTransformer(chunk);
          }
        }
      };
    } catch (error) {
      throw new Error(`Third-party agent stream error: ${error.message}`);
    }
  }

  isConnected(): boolean {
    return this.agent && typeof this.agent === 'object';
  }

  async connect(): Promise<void> {
    // Third-party agent는 이미 초기화되어 있음
  }

  async disconnect(): Promise<void> {
    // Third-party agent는 연결 해제가 필요 없음
  }

  getStats(): Record<string, any> {
    return {
      type: this.type,
      name: this.name,
      connected: this.isConnected()
    };
  }
}

// ============================================================================
// 팩토리 함수들
// ============================================================================

/**
 * 커스텀 Third-party Agent 래퍼 생성
 */
export function createCustomWrapper(
  agent: any,
  options: {
    name: string;
    type: string;
    requestTransformer: (request: AgentRequest) => any;
    responseTransformer: (response: any) => AgentResponse;
  }
) {
  return new ThirdPartyAgentWrapper(agent, options);
}
