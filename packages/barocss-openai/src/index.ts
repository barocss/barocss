/**
 * @barocss/openai
 * OpenAI wrapper for AI Agent OS
 */

import { ThirdPartyAgent } from '@barocss/ui';
import { AgentRequest, AgentResponse } from '@barocss/ui';

// ============================================================================
// OpenAI Wrapper 클래스
// ============================================================================

export class OpenAIWrapper implements ThirdPartyAgent {
  private openai: any;
  private model: string;
  private name: string;
  private type: string;

  constructor(openai: any, options?: { model?: string; name?: string }) {
    this.openai = openai;
    this.model = options?.model || 'gpt-4';
    this.name = options?.name || 'OpenAI Agent';
    this.type = 'openai';
  }

  async sendRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      const transformedRequest = this.transformRequest(request);
      const response = await this.openai.chat.completions.create(transformedRequest);
      return this.transformResponse(response, request.id);
    } catch (error: any) {
      throw new Error(`OpenAI error: ${error.message}`);
    }
  }

  async sendStreamRequest(request: AgentRequest): Promise<AsyncIterable<AgentResponse>> {
    try {
      const transformedRequest = {
        ...this.transformRequest(request),
        stream: true
      };

      const stream = await this.openai.chat.completions.create(transformedRequest);

      return {
        async *[Symbol.asyncIterator]() {
          for await (const chunk of stream) {
            yield this.transformResponse(chunk, request.id);
          }
        }
      };
    } catch (error: any) {
      throw new Error(`OpenAI stream error: ${error.message}`);
    }
  }

  isConnected(): boolean {
    return this.openai && typeof this.openai === 'object';
  }

  async connect(): Promise<void> {
    // OpenAI는 이미 초기화되어 있음
  }

  async disconnect(): Promise<void> {
    // OpenAI는 연결 해제가 필요 없음
  }

  getStats(): Record<string, any> {
    return {
      type: this.type,
      name: this.name,
      model: this.model,
      connected: this.isConnected()
    };
  }

  private transformRequest(request: AgentRequest): any {
    return {
      model: this.model,
      messages: [
        { role: 'user', content: request.payload?.message || 'Hello' }
      ],
      temperature: 0.7,
      max_tokens: 2000
    };
  }

  private transformResponse(response: any, requestId: string): AgentResponse {
    return {
      type: 'success',
      id: `openai-${Date.now()}`,
      requestId: requestId,
      timestamp: Date.now(),
      processingTime: 1000,
      status: { success: true, code: 200, message: 'OK' },
      data: {
        result: {
          message: response.choices?.[0]?.message?.content || 'No response',
          usage: response.usage,
          model: response.model
        }
      },
      metadata: {
        version: '1.0.0',
        agent: 'openai',
        model: response.model
      }
    };
  }
}

// ============================================================================
// 팩토리 함수
// ============================================================================

/**
 * OpenAI 래퍼 생성
 */
export function createOpenAIWrapper(
  openai: any, 
  options?: { model?: string; name?: string }
): ThirdPartyAgent {
  return new OpenAIWrapper(openai, options);
}

/**
 * 기본 OpenAI 래퍼 생성 (gpt-4)
 */
export function createDefaultOpenAIWrapper(openai: any): ThirdPartyAgent {
  return new OpenAIWrapper(openai, { model: 'gpt-4' });
}

// ============================================================================
// 타입 export
// ============================================================================

export type { ThirdPartyAgent } from '@barocss/ui';
export type { AgentRequest, AgentResponse } from '@barocss/ui';
