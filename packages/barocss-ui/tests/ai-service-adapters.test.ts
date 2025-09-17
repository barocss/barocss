/**
 * AI Service Adapters 테스트
 * OpenAI, Anthropic 등 실제 AI 서비스와의 포맷 변환 검증
 */

import { describe, it, expect } from 'vitest';
import { 
  OpenAIAdapter, 
  AnthropicAdapter, 
  AIServiceAdapterFactory,
  type OpenAIResponse,
  type AnthropicResponse
} from '../src/core/ai-service-adapters';
import { AgentRequest } from '../src/types';

describe('AI Service Adapters', () => {
  
  describe('OpenAI Adapter', () => {
    const adapter = new OpenAIAdapter();

    it('should convert AgentRequest to OpenAI format', () => {
      const agentRequest: AgentRequest = {
        id: 'req-123',
        type: 'ai_query',
        timestamp: Date.now(),
        priority: 'normal',
        source: 'user',
        context: {
          conversation: { id: 'conv-1', step: 1, totalSteps: 1 },
          scenes: [],
          currentScene: { id: 'scene-1', type: 'window', state: {} },
          global: {},
          session: {},
          component: {}
        },
        payload: {
          message: '간단한 로그인 폼을 만들어줘',
          instructions: 'HTML과 Tailwind CSS를 사용해서 반응형으로 만들어줘',
          constraints: {
            maxTokens: 2000,
            temperature: 0.8,
            format: 'html'
          }
        },
        metadata: {
          model: 'gpt-4',
          apiVersion: '1.0.0'
        }
      };

      const openaiRequest = adapter.convertToOpenAI(agentRequest);

      expect(openaiRequest.model).toBe('gpt-4');
      expect(openaiRequest.max_tokens).toBe(2000);
      expect(openaiRequest.temperature).toBe(0.8);
      expect(openaiRequest.messages).toHaveLength(2); // system + user
      expect(openaiRequest.messages[0].role).toBe('system');
      expect(openaiRequest.messages[1].role).toBe('user');
      expect(openaiRequest.messages[1].content).toContain('간단한 로그인 폼을 만들어줘');
      expect(openaiRequest.messages[1].content).toContain('HTML과 Tailwind CSS를 사용해서');
    });

    it('should convert OpenAI response to AgentResponse', () => {
      const openaiResponse: OpenAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: `
                <div class="login-form max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
                  <h1 class="text-2xl font-bold mb-6 text-center">로그인</h1>
                  <form data-action="login">
                    <div class="mb-4">
                      <label class="block text-gray-700 text-sm font-bold mb-2">
                        이메일
                      </label>
                      <input name="email" type="email" 
                             class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500">
                    </div>
                    <div class="mb-6">
                      <label class="block text-gray-700 text-sm font-bold mb-2">
                        비밀번호
                      </label>
                      <input name="password" type="password" 
                             class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500">
                    </div>
                    <button type="submit" 
                            class="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600">
                      로그인
                    </button>
                  </form>
                  <p class="mt-4 text-center">
                    <a href="#" data-action="signup" class="text-blue-500 hover:underline">
                      회원가입
                    </a>
                  </p>
                </div>
              `
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 150,
          completion_tokens: 300,
          total_tokens: 450
        }
      };

      const agentResponse = adapter.convertFromOpenAI(openaiResponse, 'req-123');

      expect(agentResponse.id).toContain('openai-');
      expect(agentResponse.requestId).toBe('req-123');
      expect(agentResponse.type).toBe('success');
      expect(agentResponse.status.success).toBe(true);
      expect(agentResponse.data.result.type).toBe('html_ui');
      expect(agentResponse.data.result.ui.type).toBe('html');
      expect(agentResponse.data.result.ui.content).toContain('login-form');
      expect(agentResponse.data.result.ui.actions).toHaveProperty('[data-action="login"]');
      expect(agentResponse.data.result.ui.actions).toHaveProperty('[data-action="signup"]');
      expect(agentResponse.data.result.title).toContain('로그인');
      expect(agentResponse.data.result.metadata.tokens_used).toBe(450);
      expect(agentResponse.metadata.provider).toBe('openai');
    });

    it('should handle conversation history', () => {
      const agentRequest: AgentRequest = {
        id: 'req-456',
        type: 'ai_query',
        timestamp: Date.now(),
        priority: 'normal',
        source: 'user',
        context: {
          conversation: { id: 'conv-1', step: 2, totalSteps: 5 },
          scenes: [
            {
              id: 'scene-1',
              ui: { content: '<div>이전 로그인 폼</div>' },
              metadata: { userInput: '로그인 폼을 만들어줘' }
            }
          ],
          currentScene: { id: 'scene-2', type: 'window', state: {} },
          global: {},
          session: {},
          component: {}
        },
        payload: {
          message: '이제 회원가입 폼도 추가해줘',
          constraints: { maxTokens: 3000 }
        },
        metadata: { apiVersion: '1.0.0' }
      };

      const openaiRequest = adapter.convertToOpenAI(agentRequest);

      expect(openaiRequest.messages).toHaveLength(4); // system + user + assistant + user
      expect(openaiRequest.messages[1].role).toBe('user');
      expect(openaiRequest.messages[1].content).toBe('로그인 폼을 만들어줘');
      expect(openaiRequest.messages[2].role).toBe('assistant');
      expect(openaiRequest.messages[2].content).toBe('<div>이전 로그인 폼</div>');
      expect(openaiRequest.messages[3].role).toBe('user');
      expect(openaiRequest.messages[3].content).toContain('이제 회원가입 폼도 추가해줘');
    });
  });

  describe('Anthropic Adapter', () => {
    const adapter = new AnthropicAdapter();

    it('should convert AgentRequest to Anthropic format', () => {
      const agentRequest: AgentRequest = {
        id: 'req-789',
        type: 'ai_query',
        timestamp: Date.now(),
        priority: 'normal',
        source: 'user',
        context: {
          conversation: { id: 'conv-1', step: 1, totalSteps: 1 },
          scenes: [],
          currentScene: { id: 'scene-1', type: 'window', state: {} },
          global: {},
          session: {},
          component: {}
        },
        payload: {
          message: '대시보드를 만들어줘',
          instructions: '차트와 테이블이 포함된 관리자 대시보드',
          constraints: {
            maxTokens: 4000,
            temperature: 0.5
          }
        },
        metadata: {
          model: 'claude-3-sonnet-20240229',
          apiVersion: '1.0.0'
        }
      };

      const anthropicRequest = adapter.convertToAnthropic(agentRequest);

      expect(anthropicRequest.model).toBe('claude-3-sonnet-20240229');
      expect(anthropicRequest.max_tokens).toBe(4000);
      expect(anthropicRequest.temperature).toBe(0.5);
      expect(anthropicRequest.system).toBeDefined();
      expect(anthropicRequest.messages).toHaveLength(1); // user message only
      expect(anthropicRequest.messages[0].role).toBe('user');
      expect(anthropicRequest.messages[0].content).toContain('대시보드를 만들어줘');
      expect(anthropicRequest.messages[0].content).toContain('차트와 테이블이 포함된');
    });

    it('should convert Anthropic response to AgentResponse', () => {
      const anthropicResponse: AnthropicResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: `
              <div class="dashboard p-6 bg-gray-100 min-h-screen">
                <header class="mb-8">
                  <h1 class="text-3xl font-bold text-gray-800">관리자 대시보드</h1>
                </header>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div class="stat-card bg-white p-6 rounded-lg shadow">
                    <h3 class="text-lg font-semibold mb-2">총 사용자</h3>
                    <p class="text-3xl font-bold text-blue-600">1,234</p>
                  </div>
                  <div class="stat-card bg-white p-6 rounded-lg shadow">
                    <h3 class="text-lg font-semibold mb-2">일일 활성 사용자</h3>
                    <p class="text-3xl font-bold text-green-600">567</p>
                  </div>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div class="chart-container bg-white p-6 rounded-lg shadow">
                    <h2 class="text-xl font-semibold mb-4">사용자 증가 추이</h2>
                    <div class="chart-placeholder h-64 bg-gray-50 rounded flex items-center justify-center">
                      <button data-action="load-chart" class="bg-blue-500 text-white px-4 py-2 rounded">
                        차트 로드
                      </button>
                    </div>
                  </div>
                  
                  <div class="table-container bg-white p-6 rounded-lg shadow">
                    <h2 class="text-xl font-semibold mb-4">최근 활동</h2>
                    <table class="w-full">
                      <thead>
                        <tr class="border-b">
                          <th class="text-left py-2">사용자</th>
                          <th class="text-left py-2">활동</th>
                          <th class="text-left py-2">시간</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr class="border-b">
                          <td class="py-2">김철수</td>
                          <td class="py-2">로그인</td>
                          <td class="py-2">2분 전</td>
                        </tr>
                      </tbody>
                    </table>
                    <button data-action="refresh-table" class="mt-4 bg-gray-500 text-white px-3 py-1 rounded text-sm">
                      새로고침
                    </button>
                  </div>
                </div>
              </div>
            `
          }
        ],
        model: 'claude-3-sonnet-20240229',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 200,
          output_tokens: 600
        }
      };

      const agentResponse = adapter.convertFromAnthropic(anthropicResponse, 'req-789');

      expect(agentResponse.id).toContain('anthropic-');
      expect(agentResponse.requestId).toBe('req-789');
      expect(agentResponse.type).toBe('success');
      expect(agentResponse.status.success).toBe(true);
      expect(agentResponse.data.result.type).toBe('html_ui');
      expect(agentResponse.data.result.ui.type).toBe('html');
      expect(agentResponse.data.result.ui.content).toContain('dashboard');
      expect(agentResponse.data.result.ui.actions).toHaveProperty('[data-action="load-chart"]');
      expect(agentResponse.data.result.ui.actions).toHaveProperty('[data-action="refresh-table"]');
      expect(agentResponse.data.result.title).toContain('관리자 대시보드');
      expect(agentResponse.data.result.metadata.tokens_used).toBe(800);
      expect(agentResponse.metadata.provider).toBe('anthropic');
    });
  });

  describe('AIServiceAdapterFactory', () => {
    it('should create OpenAI adapter', () => {
      const adapter = AIServiceAdapterFactory.createAdapter({
        provider: 'openai',
        model: 'gpt-4',
        systemPrompt: 'Custom system prompt'
      });

      expect(adapter).toBeInstanceOf(OpenAIAdapter);
    });

    it('should create Anthropic adapter', () => {
      const adapter = AIServiceAdapterFactory.createAdapter({
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229'
      });

      expect(adapter).toBeInstanceOf(AnthropicAdapter);
    });

    it('should throw error for unsupported provider', () => {
      expect(() => {
        AIServiceAdapterFactory.createAdapter({
          provider: 'unsupported' as any
        });
      }).toThrow('Unsupported AI service provider');
    });

    it('should validate compatibility', () => {
      expect(AIServiceAdapterFactory.validateCompatibility('openai')).toBe(true);
      expect(AIServiceAdapterFactory.validateCompatibility('anthropic')).toBe(true);
      expect(AIServiceAdapterFactory.validateCompatibility('unsupported' as any)).toBe(false);
    });

    it('should validate request format', () => {
      const validRequest: AgentRequest = {
        id: 'req-123',
        type: 'ai_query',
        timestamp: Date.now(),
        priority: 'normal',
        source: 'user',
        context: {
          conversation: { id: 'conv-1', step: 1, totalSteps: 1 },
          scenes: [],
          currentScene: { id: 'scene-1', type: 'window', state: {} },
          global: {},
          session: {},
          component: {}
        },
        payload: {
          message: 'test message'
        },
        metadata: {}
      };

      const validation = AIServiceAdapterFactory.validateRequest(validRequest);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      const invalidRequest = {
        type: 'ai_query',
        payload: {}
      } as any;

      const invalidValidation = AIServiceAdapterFactory.validateRequest(invalidRequest);
      expect(invalidValidation.valid).toBe(false);
      expect(invalidValidation.errors.length).toBeGreaterThan(0);
      expect(invalidValidation.errors).toContain('Request ID is required');
      expect(invalidValidation.errors).toContain('Request message is required');
      expect(invalidValidation.errors).toContain('Request timestamp is required');
    });
  });

  describe('Format Compatibility', () => {
    it('should maintain consistent UI structure across adapters', () => {
      const openaiAdapter = new OpenAIAdapter();
      const anthropicAdapter = new AnthropicAdapter();

      const htmlContent = `
        <div class="app">
          <h1>Test App</h1>
          <button data-action="test">Test</button>
        </div>
      `;

      const openaiResponse = {
        id: 'openai-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [{ index: 0, message: { role: 'assistant', content: htmlContent }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 }
      } as OpenAIResponse;

      const anthropicResponse = {
        id: 'anthropic-123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: htmlContent }],
        model: 'claude-3-sonnet-20240229',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 200 }
      } as AnthropicResponse;

      const openaiResult = openaiAdapter.convertFromOpenAI(openaiResponse, 'req-1');
      const anthropicResult = anthropicAdapter.convertFromAnthropic(anthropicResponse, 'req-2');

      // 두 결과의 UI 구조가 동일한지 확인
      expect(openaiResult.data.result.ui.type).toBe(anthropicResult.data.result.ui.type);
      expect(openaiResult.data.result.ui.content).toBe(anthropicResult.data.result.ui.content);
      expect(Object.keys(openaiResult.data.result.ui.actions)).toEqual(
        Object.keys(anthropicResult.data.result.ui.actions)
      );
      expect(openaiResult.data.result.title).toBe(anthropicResult.data.result.title);
    });

    it('should extract actions consistently', () => {
      const adapter = new OpenAIAdapter();
      const htmlWithActions = `
        <div>
          <button data-action="save">저장</button>
          <button data-action="cancel">취소</button>
          <form data-action="submit-form">
            <input type="text">
          </form>
        </div>
      `;

      const response = {
        id: 'test-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [{ index: 0, message: { role: 'assistant', content: htmlWithActions }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 }
      } as OpenAIResponse;

      const result = adapter.convertFromOpenAI(response, 'req-test');
      const actions = result.data.result.ui.actions;

      expect(actions).toHaveProperty('[data-action="save"]', 'save');
      expect(actions).toHaveProperty('[data-action="cancel"]', 'cancel');
      expect(actions).toHaveProperty('[data-action="submit-form"]', 'submit-form');
      expect(Object.keys(actions)).toHaveLength(3);
    });
  });
});
