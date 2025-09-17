/**
 * @barocss/anthropic
 * Anthropic Claude wrapper for AI Agent OS
 */

import { ThirdPartyAgent } from '@barocss/ui';
import { AgentRequest, AgentResponse } from '@barocss/ui';

// ============================================================================
// Anthropic Claude Wrapper 클래스
// ============================================================================

export class AnthropicWrapper implements ThirdPartyAgent {
  private anthropic: any;
  private model: string;
  public name: string;
  public type: string;

  constructor(anthropic: any, options?: { model?: string; name?: string }) {
    this.anthropic = anthropic;
    this.model = options?.model || 'claude-3-sonnet-20240229';
    this.name = options?.name || 'Claude Agent';
    this.type = 'anthropic';
  }

  async sendRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      const transformedRequest = this.transformRequest(request);
      const response = await this.anthropic.messages.create(transformedRequest);
      return this.transformResponse(response, request.id);
    } catch (error: any) {
      throw new Error(`Anthropic error: ${error.message}`);
    }
  }

  async sendStreamRequest(request: AgentRequest): Promise<AsyncIterable<AgentResponse>> {
    try {
      const transformedRequest = {
        ...this.transformRequest(request),
        stream: true
      };

      const stream = await this.anthropic.messages.create(transformedRequest);

      const self = this;
      return {
        async *[Symbol.asyncIterator]() {
          for await (const chunk of stream) {
            yield self.transformResponse(chunk, request.id);
          }
        }
      };
    } catch (error: any) {
      throw new Error(`Anthropic stream error: ${error.message}`);
    }
  }

  isConnected(): boolean {
    return this.anthropic && typeof this.anthropic === 'object';
  }

  async connect(): Promise<void> {
    // Anthropic은 이미 초기화되어 있음
  }

  async disconnect(): Promise<void> {
    // Anthropic은 연결 해제가 필요 없음
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
      max_tokens: 1000,
      messages: [
        { role: 'user', content: (request.payload as any)?.message || 'Hello' }
      ]
    };
  }

  private transformResponse(response: any, requestId: string): AgentResponse {
    return {
      type: 'success',
      id: `claude-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      requestId: requestId,
      timestamp: Date.now(),
      processingTime: 1200,
      status: { success: true, code: 200, message: 'OK' },
      data: {
        result: {
          message: response.content?.[0]?.text || 'No response',
          usage: response.usage,
          model: response.model
        }
      },
      metadata: {
        version: '1.0.0',
        correlationId: `anthropic-${Date.now()}`,
        agent: 'anthropic'
      }
    };
  }
}

// ============================================================================
// 팩토리 함수
// ============================================================================

/**
 * Anthropic Claude 래퍼 생성
 */
export function createAnthropicWrapper(
  anthropic: any, 
  options?: { model?: string; name?: string }
): ThirdPartyAgent {
  return new AnthropicWrapper(anthropic, options);
}