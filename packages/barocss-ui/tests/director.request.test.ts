/**
 * Director.request() 메서드 테스트
 * 핵심 AI 대화형 Scene 생성 기능 검증
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Director } from '../src/core/director';
import { createMockAgentCommunicationAdapter } from '../src/core/agent-communication-interface';
import { AgentResponse } from '../src/types';

describe('Director.request() - 핵심 기능', () => {
  let director: Director;
  let mockAgentComm: any;

  beforeEach(async () => {
    // Mock Agent Communication 설정
    mockAgentComm = createMockAgentCommunicationAdapter({
      delay: 50,
      errorRate: 0 // 테스트에서는 에러 없음
    });

    // 성공적인 AI 응답 mock
    vi.spyOn(mockAgentComm, 'sendRequest').mockResolvedValue({
      id: 'response-1',
      requestId: 'request-1',
      type: 'success',
      timestamp: Date.now(),
      processingTime: 100,
      status: {
        success: true,
        code: 200,
        message: 'OK'
      },
      data: {
        result: {
          title: 'AI Generated Shopping Mall',
          ui: {
            type: 'html',
            content: `
              <div class="shopping-mall p-4 bg-white rounded-lg shadow">
                <h1 class="text-2xl font-bold mb-4">🛍️ AI 쇼핑몰</h1>
                <div class="grid grid-cols-2 gap-4">
                  <button class="bg-blue-500 text-white p-2 rounded" data-action="search-products">
                    상품 검색
                  </button>
                  <button class="bg-green-500 text-white p-2 rounded" data-action="view-cart">
                    장바구니
                  </button>
                </div>
              </div>
            `,
            actions: {
              '[data-action="search-products"]': 'searchProducts',
              '[data-action="view-cart"]': 'viewCart'
            }
          },
          state: {
            cartItems: [],
            searchQuery: ''
          }
        }
      },
      metadata: {
        version: '1.0.0',
        correlationId: 'corr-1'
      }
    } as AgentResponse);

    director = new Director({ debug: true }, mockAgentComm);
    await director.initialize();
  });

  it('should create Scene from user request', async () => {
    // 첫 번째 요청
    const scene = await director.request("온라인 쇼핑몰을 만들어줘");

    // Scene이 생성되었는지 확인
    expect(scene).toBeDefined();
    expect(scene.id).toMatch(/^scene-/);
    expect(scene.title).toBe('AI Generated Shopping Mall');
    expect(scene.type).toBe('window');
    expect(scene.state.visible).toBe(true);
    expect(scene.state.active).toBe(true);

    // AI 응답 내용이 Scene에 반영되었는지 확인
    expect(scene.component).toBeDefined();
    expect(scene.component.name).toBe('AIGeneratedContent');
    expect(scene.component.props?.['data-ui-type']).toBe('html');
  });

  it('should maintain conversation chain', async () => {
    // 첫 번째 요청
    await director.request("온라인 쇼핑몰을 만들어줘");
    
    // 대화 체인 확인
    const chain = director.getCurrentConversationChain();
    expect(chain).toBeDefined();
    expect(chain.scenes).toHaveLength(1);
    expect(chain.context.userInputs).toHaveLength(1);
    expect(chain.context.aiOutputs).toHaveLength(1);

    // 대화 이력 확인
    const history = director.getConversationHistory();
    expect(history).toHaveLength(1);
    expect(history[0].title).toBe('AI Generated Shopping Mall');
  });

  it('should handle continuous conversation', async () => {
    // 첫 번째 요청
    await director.request("온라인 쇼핑몰을 만들어줘");

    // 두 번째 요청을 위한 새로운 mock 응답
    vi.spyOn(mockAgentComm, 'sendRequest').mockResolvedValueOnce({
      id: 'response-2',
      requestId: 'request-2', 
      type: 'success',
      timestamp: Date.now(),
      processingTime: 100,
      status: {
        success: true,
        code: 200,
        message: 'OK'
      },
      data: {
        result: {
          title: 'Product Search Page',
          ui: {
            type: 'html',
            content: `
              <div class="product-search p-4">
                <h2 class="text-xl font-bold mb-4">상품 검색</h2>
                <input type="text" placeholder="상품을 검색하세요..." class="w-full p-2 border rounded mb-4">
                <div class="products grid grid-cols-3 gap-4">
                  <div class="product bg-gray-100 p-2 rounded">iPhone 15</div>
                  <div class="product bg-gray-100 p-2 rounded">MacBook Pro</div>
                  <div class="product bg-gray-100 p-2 rounded">AirPods</div>
                </div>
              </div>
            `
          }
        }
      },
      metadata: {
        version: '1.0.0',
        correlationId: 'corr-2'
      }
    } as AgentResponse);

    // 두 번째 요청
    const scene2 = await director.continueConversation("상품 검색 페이지를 보여줘");

    // 대화 체인이 확장되었는지 확인
    const chain = director.getCurrentConversationChain();
    expect(chain.scenes).toHaveLength(2);
    expect(chain.context.userInputs).toHaveLength(2);
    expect(chain.context.aiOutputs).toHaveLength(2);

    // 두 번째 Scene 확인
    expect(scene2.title).toBe('Product Search Page');
    expect(scene2.id).not.toBe(chain.scenes[0].id); // 다른 Scene이어야 함
  });

  it('should handle Agent communication errors', async () => {
    // Agent 에러 mock
    vi.spyOn(mockAgentComm, 'sendRequest').mockRejectedValueOnce(
      new Error('AI Agent connection failed')
    );

    // 에러가 적절히 처리되는지 확인
    await expect(director.request("에러 테스트")).rejects.toThrow(/Request failed/);
  });

  it('should require initialization', async () => {
    // 초기화되지 않은 Director
    const uninitializedDirector = new Director({}, mockAgentComm);
    
    await expect(uninitializedDirector.request("테스트"))
      .rejects.toThrow(/not initialized/);
  });
});
