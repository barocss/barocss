/**
 * Director + Stage 통합 테스트
 * AI 요청부터 DOM 렌더링까지 전체 파이프라인 검증
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Director } from '../src/core/director';
import { Stage } from '../src/core/stage';
import { createMockAgentCommunicationAdapter } from '../src/core/agent-communication-interface';
import { AgentResponse } from '../src/types';

// jsdom 환경에서 DOM 요소 생성
function createTestDOM() {
  const container = document.createElement('div');
  container.id = 'test-app';
  document.body.appendChild(container);
  return container;
}

describe('Director + Stage Integration', () => {
  let director: Director;
  let stage: Stage;
  let mockAgentComm: any;
  let testContainer: HTMLElement;

  beforeEach(async () => {
    // DOM 환경 설정
    testContainer = createTestDOM();

    // Mock Agent Communication 설정
    mockAgentComm = createMockAgentCommunicationAdapter({
      delay: 10,
      errorRate: 0
    });

    // Director 설정
    director = new Director({ debug: true }, mockAgentComm);
    await director.initialize();

    // Stage 설정 (Director와 연결)
    stage = new Stage({ 
      mount: testContainer,
      director 
    });
    stage.mount();
  });

  afterEach(() => {
    stage.dispose();
    testContainer.remove();
  });

  it('should render AI-generated Scene to DOM', async () => {
    // AI 응답 Mock 설정
    const aiResponseHTML = `
      <div class="shopping-mall p-6 bg-white rounded-lg shadow-lg">
        <h1 class="text-3xl font-bold text-blue-600 mb-4">🛍️ AI 쇼핑몰</h1>
        <div class="grid grid-cols-2 gap-4">
          <button class="bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600" 
                  data-action="search-products">
            상품 검색
          </button>
          <button class="bg-green-500 text-white p-3 rounded-lg hover:bg-green-600" 
                  data-action="view-cart">
            장바구니
          </button>
        </div>
        <div class="mt-6 text-gray-600">
          <p>AI가 생성한 온라인 쇼핑몰입니다.</p>
        </div>
      </div>
    `;

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
          title: 'AI 쇼핑몰',
          ui: {
            type: 'html',
            content: aiResponseHTML,
            actions: {
              '[data-action="search-products"]': 'searchProducts',
              '[data-action="view-cart"]': 'viewCart'
            }
          },
          state: {
            cartItems: [],
            searchQuery: '',
            currentPage: 'home'
          }
        }
      },
      metadata: {
        version: '1.0.0',
        correlationId: 'corr-1'
      }
    } as AgentResponse);

    // 1. Director에 요청
    const scene = await director.request("온라인 쇼핑몰을 만들어줘");

    // 2. Stage로 렌더링
    await stage.render(scene);

    // 3. DOM에 렌더링되었는지 확인
    expect(testContainer.children.length).toBe(1);
    
    const sceneElement = testContainer.querySelector('.scene-container');
    expect(sceneElement).toBeTruthy();
    expect(sceneElement?.getAttribute('data-scene-id')).toBe(scene.id);

    // 4. AI가 생성한 HTML 내용이 렌더링되었는지 확인
    const shoppingMallElement = testContainer.querySelector('.shopping-mall');
    expect(shoppingMallElement).toBeTruthy();
    
    const title = testContainer.querySelector('h1');
    expect(title?.textContent).toContain('🛍️ AI 쇼핑몰');

    // 5. 버튼들이 렌더링되었는지 확인
    const searchButton = testContainer.querySelector('[data-action="search-products"]');
    const cartButton = testContainer.querySelector('[data-action="view-cart"]');
    expect(searchButton).toBeTruthy();
    expect(cartButton).toBeTruthy();
    expect(searchButton?.textContent?.trim()).toBe('상품 검색');
    expect(cartButton?.textContent?.trim()).toBe('장바구니');
  });

  it('should handle multiple scenes and updates', async () => {
    // 첫 번째 Scene
    vi.spyOn(mockAgentComm, 'sendRequest').mockResolvedValueOnce({
      id: 'response-1',
      requestId: 'request-1',
      type: 'success',
      timestamp: Date.now(),
      processingTime: 100,
      status: { success: true, code: 200, message: 'OK' },
      data: {
        result: {
          title: 'Home Page',
          ui: {
            type: 'html',
            content: '<div class="home-page"><h1>홈페이지</h1></div>'
          }
        }
      },
      metadata: { version: '1.0.0', correlationId: 'corr-1' }
    } as AgentResponse);

    const scene1 = await director.request("홈페이지를 만들어줘");
    await stage.render(scene1);

    // 첫 번째 Scene 확인
    expect(testContainer.querySelector('.home-page')).toBeTruthy();

    // 두 번째 Scene으로 업데이트
    vi.spyOn(mockAgentComm, 'sendRequest').mockResolvedValueOnce({
      id: 'response-2',
      requestId: 'request-2',
      type: 'success',
      timestamp: Date.now(),
      processingTime: 100,
      status: { success: true, code: 200, message: 'OK' },
      data: {
        result: {
          title: 'Product List',
          ui: {
            type: 'html',
            content: '<div class="product-list"><h2>상품 목록</h2><div class="products">상품들...</div></div>'
          }
        }
      },
      metadata: { version: '1.0.0', correlationId: 'corr-2' }
    } as AgentResponse);

    const scene2 = await director.continueConversation("이제 상품 목록을 보여줘");
    await stage.render(scene2);

    // 두 번째 Scene으로 교체되었는지 확인
    expect(testContainer.querySelector('.home-page')).toBeFalsy();
    expect(testContainer.querySelector('.product-list')).toBeTruthy();
    expect(testContainer.querySelector('h2')?.textContent).toBe('상품 목록');

    // 대화 이력 확인
    const history = director.getConversationHistory();
    expect(history).toHaveLength(2);
    expect(history[0].title).toBe('Home Page');
    expect(history[1].title).toBe('Product List');
  });

  it('should handle DOM event delegation', async () => {
    // 이벤트가 있는 Scene 생성
    vi.spyOn(mockAgentComm, 'sendRequest').mockResolvedValue({
      id: 'response-1',
      requestId: 'request-1',
      type: 'success',
      timestamp: Date.now(),
      processingTime: 100,
      status: { success: true, code: 200, message: 'OK' },
      data: {
        result: {
          title: 'Interactive Page',
          ui: {
            type: 'html',
            content: `
              <div class="interactive-page">
                <button id="test-button" data-action="test-click" class="test-btn">
                  클릭하세요
                </button>
                <form data-action="test-form">
                  <input name="testInput" value="test value">
                  <button type="submit">제출</button>
                </form>
              </div>
            `
          }
        }
      },
      metadata: { version: '1.0.0', correlationId: 'corr-1' }
    } as AgentResponse);

    const scene = await director.request("인터랙티브 페이지를 만들어줘");
    await stage.render(scene);

    // DOM 이벤트 리스너 설정 확인
    const button = testContainer.querySelector('#test-button') as HTMLElement;
    const form = testContainer.querySelector('form') as HTMLFormElement;
    
    expect(button).toBeTruthy();
    expect(form).toBeTruthy();

    // 커스텀 이벤트 리스너 설정
    let capturedEvent: any = null;
    testContainer.addEventListener('ui-action', (e: any) => {
      capturedEvent = e.detail;
    });

    let capturedFormEvent: any = null;
    testContainer.addEventListener('ui-form-submit', (e: any) => {
      capturedFormEvent = e.detail;
    });

    // 버튼 클릭 이벤트 시뮬레이션
    button.click();
    
    // 이벤트가 캐치되었는지 확인
    expect(capturedEvent).toBeTruthy();
    expect(capturedEvent.action).toBe('test-click');

    // 폼 제출 이벤트 시뮬레이션
    const submitEvent = new Event('submit', { bubbles: true });
    form.dispatchEvent(submitEvent);

    // 폼 이벤트가 캐치되었는지 확인
    expect(capturedFormEvent).toBeTruthy();
    expect(capturedFormEvent.action).toBe('test-form');
    expect(capturedFormEvent.data.testInput).toBe('test value');
  });

  it('should clean up properly on stage disposal', async () => {
    // Scene 렌더링
    vi.spyOn(mockAgentComm, 'sendRequest').mockResolvedValue({
      id: 'response-1',
      requestId: 'request-1',
      type: 'success',
      timestamp: Date.now(),
      processingTime: 100,
      status: { success: true, code: 200, message: 'OK' },
      data: {
        result: {
          title: 'Test Scene',
          ui: {
            type: 'html',
            content: '<div class="test-scene">테스트 Scene</div>'
          }
        }
      },
      metadata: { version: '1.0.0', correlationId: 'corr-1' }
    } as AgentResponse);

    const scene = await director.request("테스트 Scene을 만들어줘");
    await stage.render(scene);

    // 렌더링 확인
    expect(testContainer.querySelector('.test-scene')).toBeTruthy();

    // Stage 정리
    stage.clear();

    // DOM이 정리되었는지 확인
    expect(testContainer.querySelector('.test-scene')).toBeFalsy();
    expect(testContainer.children.length).toBe(0);
  });
});
