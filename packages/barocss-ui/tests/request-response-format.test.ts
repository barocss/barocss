/**
 * Request/Response 포맷 검증 테스트
 * 실제 AI 서비스들과의 호환성 확인
 */

import { describe, it, expect } from 'vitest';
import { AgentRequest, AgentResponse } from '../src/types';

describe('Request/Response Format Validation', () => {
  
  describe('AgentRequest Format', () => {
    it('should have standard request structure', () => {
      const request: AgentRequest = {
        id: 'req-123',
        type: 'ai_query',
        timestamp: Date.now(),
        priority: 'normal',
        source: 'user',
        context: {
          conversation: {
            id: 'conv-456',
            step: 1,
            totalSteps: 5
          },
          scenes: [],
          currentScene: {
            id: 'scene-789',
            type: 'window',
            state: {}
          },
          global: {},
          session: {},
          component: {}
        },
        payload: {
          message: '온라인 쇼핑몰을 만들어줘',
          instructions: 'HTML과 Tailwind CSS를 사용해서 만들어줘',
          constraints: {
            maxTokens: 4000,
            format: 'html',
            style: 'modern'
          }
        },
        metadata: {
          userId: 'user-123',
          sessionId: 'session-456',
          apiVersion: '1.0.0',
          correlationId: 'corr-789'
        }
      };

      // 필수 필드 검증
      expect(request.id).toBeDefined();
      expect(request.type).toBeDefined();
      expect(request.timestamp).toBeDefined();
      expect(request.payload).toBeDefined();
      expect(request.payload.message).toBeDefined();
      
      // 타입 검증
      expect(typeof request.id).toBe('string');
      expect(typeof request.type).toBe('string');
      expect(typeof request.timestamp).toBe('number');
      expect(typeof request.payload.message).toBe('string');
    });

    it('should support OpenAI-compatible format', () => {
      const request: AgentRequest = {
        id: 'req-openai-123',
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
          message: '간단한 투두 앱을 만들어줘',
          instructions: 'React 컴포넌트 형태로 만들어줘',
          constraints: {
            maxTokens: 2000,
            format: 'jsx',
            framework: 'react'
          }
        },
        metadata: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.7,
          apiVersion: '1.0.0'
        }
      };

      // OpenAI 특화 메타데이터 검증
      expect(request.metadata.provider).toBe('openai');
      expect(request.metadata.model).toBeDefined();
      expect(request.payload.constraints?.maxTokens).toBeDefined();
    });

    it('should support Anthropic-compatible format', () => {
      const request: AgentRequest = {
        id: 'req-anthropic-123',
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
          instructions: 'HTML과 CSS를 사용해서 반응형으로 만들어줘',
          constraints: {
            maxTokens: 4000,
            format: 'html',
            responsive: true
          }
        },
        metadata: {
          provider: 'anthropic',
          model: 'claude-3-sonnet',
          systemPrompt: 'You are a UI designer that creates beautiful web interfaces.',
          apiVersion: '1.0.0'
        }
      };

      // Anthropic 특화 메타데이터 검증
      expect(request.metadata.provider).toBe('anthropic');
      expect(request.metadata.model).toBeDefined();
      expect(request.metadata.systemPrompt).toBeDefined();
    });
  });

  describe('AgentResponse Format', () => {
    it('should have standard response structure', () => {
      const response: AgentResponse = {
        id: 'resp-123',
        requestId: 'req-123',
        type: 'success',
        timestamp: Date.now(),
        processingTime: 1500,
        status: {
          success: true,
          code: 200,
          message: 'Request processed successfully'
        },
        data: {
          result: {
            title: 'AI 생성 쇼핑몰',
            type: 'html_ui',
            ui: {
              type: 'html',
              content: '<div class="shopping-mall">...</div>',
              styles: {},
              scripts: [],
              actions: {
                '[data-action="add-to-cart"]': 'addToCart',
                '[data-action="checkout"]': 'checkout'
              }
            },
            state: {
              cartItems: [],
              currentCategory: 'all',
              totalPrice: 0
            },
            metadata: {
              complexity: 'medium',
              tokens_used: 1200,
              model_version: 'gpt-4'
            }
          },
          reasoning: '사용자가 요청한 온라인 쇼핑몰을 HTML로 구현했습니다.',
          suggestions: [
            '상품 필터링 기능을 추가해보세요',
            '결제 시스템을 연동해보세요'
          ]
        },
        metadata: {
          version: '1.0.0',
          correlationId: 'corr-123',
          provider: 'openai',
          model: 'gpt-4'
        }
      };

      // 필수 필드 검증
      expect(response.id).toBeDefined();
      expect(response.requestId).toBeDefined();
      expect(response.type).toBeDefined();
      expect(response.timestamp).toBeDefined();
      expect(response.status).toBeDefined();
      expect(response.data).toBeDefined();

      // 상태 검증
      expect(response.status.success).toBe(true);
      expect(response.status.code).toBe(200);
      
      // 데이터 구조 검증
      expect(response.data.result).toBeDefined();
      expect(response.data.result.ui).toBeDefined();
      expect(response.data.result.ui.type).toBe('html');
      expect(response.data.result.ui.content).toBeDefined();
    });

    it('should handle error responses properly', () => {
      const errorResponse: AgentResponse = {
        id: 'resp-error-123',
        requestId: 'req-123',
        type: 'error',
        timestamp: Date.now(),
        processingTime: 100,
        status: {
          success: false,
          code: 400,
          message: 'Invalid request format',
          details: 'Missing required field: payload.message'
        },
        data: {
          error: {
            type: 'validation_error',
            code: 'MISSING_FIELD',
            message: 'payload.message is required',
            field: 'payload.message'
          }
        },
        metadata: {
          version: '1.0.0',
          correlationId: 'corr-123'
        }
      };

      expect(errorResponse.type).toBe('error');
      expect(errorResponse.status.success).toBe(false);
      expect(errorResponse.status.code).toBe(400);
      expect(errorResponse.data.error).toBeDefined();
    });

    it('should support streaming responses', () => {
      const streamingResponse: AgentResponse = {
        id: 'resp-stream-123',
        requestId: 'req-123',
        type: 'partial',
        timestamp: Date.now(),
        processingTime: 500,
        status: {
          success: true,
          code: 200,
          message: 'Partial response',
          progress: 0.3
        },
        data: {
          partial: {
            content: '<div class="header">헤더 부분...</div>',
            completed_sections: ['header'],
            remaining_sections: ['navigation', 'content', 'footer']
          }
        },
        metadata: {
          version: '1.0.0',
          correlationId: 'corr-123',
          streaming: true,
          chunk_index: 1,
          total_chunks: 4
        }
      };

      expect(streamingResponse.type).toBe('partial');
      expect(streamingResponse.status.progress).toBeDefined();
      expect(streamingResponse.data.partial).toBeDefined();
      expect(streamingResponse.metadata.streaming).toBe(true);
    });
  });

  describe('UI Content Format Validation', () => {
    it('should validate HTML UI format', () => {
      const htmlUI = {
        type: 'html',
        content: `
          <div class="todo-app p-6 max-w-md mx-auto bg-white rounded-lg shadow-lg">
            <h1 class="text-2xl font-bold mb-4">할 일 목록</h1>
            <div class="add-todo mb-4">
              <form data-action="add-todo">
                <input name="task" placeholder="새로운 할 일" 
                       class="w-full p-2 border rounded mb-2">
                <button type="submit" 
                        class="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600">
                  추가
                </button>
              </form>
            </div>
            <ul class="todo-list space-y-2">
              <li class="todo-item flex items-center p-2 bg-gray-50 rounded">
                <input type="checkbox" class="mr-2">
                <span>샘플 할 일</span>
                <button data-action="delete-todo" data-id="1" 
                        class="ml-auto text-red-500 hover:text-red-700">
                  삭제
                </button>
              </li>
            </ul>
          </div>
        `,
        styles: {
          '.todo-app': {
            fontFamily: 'system-ui, sans-serif'
          }
        },
        scripts: [],
        actions: {
          '[data-action="add-todo"]': 'addTodo',
          '[data-action="delete-todo"]': 'deleteTodo'
        }
      };

      // HTML 구조 검증
      expect(htmlUI.type).toBe('html');
      expect(htmlUI.content).toContain('data-action');
      expect(htmlUI.actions).toBeDefined();
      expect(Object.keys(htmlUI.actions).length).toBeGreaterThan(0);

      // CSS 클래스 검증 (Tailwind CSS)
      expect(htmlUI.content).toMatch(/class="[^"]*p-\d+[^"]*"/); // padding
      expect(htmlUI.content).toMatch(/class="[^"]*bg-\w+-\d+[^"]*"/); // background
      expect(htmlUI.content).toMatch(/class="[^"]*rounded[^"]*"/); // border-radius
    });

    it('should validate component UI format', () => {
      const componentUI = {
        type: 'component',
        content: {
          name: 'ShoppingCart',
          props: {
            items: [
              { id: 1, name: '상품 1', price: 10000, quantity: 2 },
              { id: 2, name: '상품 2', price: 20000, quantity: 1 }
            ],
            total: 40000,
            currency: 'KRW'
          },
          children: [
            {
              name: 'CartHeader',
              props: { title: '장바구니' }
            },
            {
              name: 'CartItems',
              props: { items: '{{items}}' }
            },
            {
              name: 'CartTotal',
              props: { total: '{{total}}', currency: '{{currency}}' }
            }
          ]
        },
        actions: {
          'updateQuantity': 'updateCartItemQuantity',
          'removeItem': 'removeCartItem',
          'checkout': 'proceedToCheckout'
        }
      };

      expect(componentUI.type).toBe('component');
      expect(componentUI.content.name).toBeDefined();
      expect(componentUI.content.props).toBeDefined();
      expect(componentUI.content.children).toBeDefined();
      expect(Array.isArray(componentUI.content.children)).toBe(true);
    });

    it('should validate JSON UI format', () => {
      const jsonUI = {
        type: 'json',
        content: {
          layout: 'vertical',
          components: [
            {
              type: 'header',
              content: '프로젝트 대시보드',
              style: 'text-3xl font-bold text-gray-800'
            },
            {
              type: 'grid',
              columns: 3,
              gap: 4,
              children: [
                {
                  type: 'card',
                  title: '총 프로젝트',
                  value: 12,
                  color: 'blue'
                },
                {
                  type: 'card',
                  title: '진행 중',
                  value: 8,
                  color: 'green'
                },
                {
                  type: 'card',
                  title: '완료',
                  value: 4,
                  color: 'gray'
                }
              ]
            }
          ]
        },
        actions: {
          'card-click': 'showProjectDetails',
          'add-project': 'createNewProject'
        }
      };

      expect(jsonUI.type).toBe('json');
      expect(jsonUI.content.layout).toBeDefined();
      expect(jsonUI.content.components).toBeDefined();
      expect(Array.isArray(jsonUI.content.components)).toBe(true);
    });
  });

  describe('Cross-Service Compatibility', () => {
    it('should convert between different AI service formats', () => {
      // OpenAI 스타일 요청
      const openaiRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a UI designer.' },
          { role: 'user', content: '쇼핑몰을 만들어줘' }
        ],
        max_tokens: 4000,
        temperature: 0.7
      };

      // 우리 포맷으로 변환
      const ourRequest: AgentRequest = {
        id: 'req-converted-123',
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
          message: openaiRequest.messages[1].content,
          instructions: openaiRequest.messages[0].content,
          constraints: {
            maxTokens: openaiRequest.max_tokens,
            temperature: openaiRequest.temperature,
            format: 'html'
          }
        },
        metadata: {
          provider: 'openai',
          model: openaiRequest.model,
          originalFormat: 'openai_chat',
          apiVersion: '1.0.0'
        }
      };

      expect(ourRequest.payload.message).toBe('쇼핑몰을 만들어줘');
      expect(ourRequest.payload.constraints?.maxTokens).toBe(4000);
      expect(ourRequest.metadata.provider).toBe('openai');
    });

    it('should handle response format conversion', () => {
      // OpenAI 스타일 응답
      const openaiResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '<div class="shopping-mall">...</div>'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 500,
          total_tokens: 600
        }
      };

      // 우리 포맷으로 변환
      const ourResponse: AgentResponse = {
        id: 'resp-converted-123',
        requestId: 'req-123',
        type: 'success',
        timestamp: Date.now(),
        processingTime: 1000,
        status: {
          success: true,
          code: 200,
          message: 'Conversion successful'
        },
        data: {
          result: {
            title: 'AI 생성 쇼핑몰',
            type: 'html_ui',
            ui: {
              type: 'html',
              content: openaiResponse.choices[0].message.content,
              styles: {},
              scripts: [],
              actions: {}
            },
            state: {},
            metadata: {
              tokens_used: openaiResponse.usage.total_tokens,
              model_version: openaiResponse.model,
              finish_reason: openaiResponse.choices[0].finish_reason
            }
          }
        },
        metadata: {
          version: '1.0.0',
          provider: 'openai',
          originalFormat: 'openai_chat',
          originalId: openaiResponse.id
        }
      };

      expect(ourResponse.data.result.ui.content).toBe('<div class="shopping-mall">...</div>');
      expect(ourResponse.data.result.metadata.tokens_used).toBe(600);
      expect(ourResponse.metadata.provider).toBe('openai');
    });
  });
});
