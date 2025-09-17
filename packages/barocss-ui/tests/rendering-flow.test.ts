/**
 * 렌더링 플로우 검증 테스트
 * AI 응답 → Scene 생성 → Stage 렌더링 → 상태 관리 전체 플로우 테스트
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Director } from '../src/core/director';
import { Stage } from '../src/core/stage';
import { UIRenderer } from '../src/core/ui-renderer';
import { createMockAgentCommunicationAdapter } from '../src/core/agent-communication-interface';
import { AgentResponse } from '../src/types';

// jsdom 환경에서 DOM 요소 생성
function createTestDOM() {
  const container = document.createElement('div');
  container.id = 'test-app';
  container.innerHTML = ''; // 깨끗한 상태로 시작
  document.body.appendChild(container);
  return container;
}

describe('Rendering Flow & State Management', () => {
  let director: Director;
  let stage: Stage;
  let testContainer: HTMLElement;
  let mockAgentComm: any;

  beforeEach(async () => {
    testContainer = createTestDOM();
    mockAgentComm = createMockAgentCommunicationAdapter({
      delay: 10,
      errorRate: 0
    });

    director = new Director({ debug: true }, mockAgentComm);
    await director.initialize();

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

  describe('AI Response → Scene Conversion', () => {
    it('should properly convert AI response to Scene with complete UI data', async () => {
      // 복잡한 AI 응답 Mock
      const complexAIResponse = `
        <div class="e-commerce-app bg-gray-50 min-h-screen">
          <header class="bg-white shadow-sm border-b p-4">
            <h1 class="text-2xl font-bold text-gray-800">🛍️ AI 쇼핑몰</h1>
            <nav class="mt-2">
              <button data-action="show-category" data-category="electronics" 
                      class="mr-4 text-blue-600 hover:text-blue-800">
                전자제품
              </button>
              <button data-action="show-category" data-category="clothing" 
                      class="mr-4 text-blue-600 hover:text-blue-800">
                의류
              </button>
              <button data-action="show-cart" 
                      class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                장바구니 (0)
              </button>
            </nav>
          </header>
          
          <main class="container mx-auto p-6">
            <div class="product-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div class="product-card bg-white p-4 rounded-lg shadow">
                <img src="https://via.placeholder.com/200" alt="상품 1" class="w-full h-48 object-cover rounded">
                <h3 class="mt-2 font-semibold">스마트폰</h3>
                <p class="text-gray-600">최신 스마트폰</p>
                <div class="mt-4 flex justify-between items-center">
                  <span class="text-lg font-bold">₩500,000</span>
                  <button data-action="add-to-cart" data-product-id="1" data-price="500000"
                          class="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">
                    담기
                  </button>
                </div>
              </div>
              
              <div class="product-card bg-white p-4 rounded-lg shadow">
                <img src="https://via.placeholder.com/200" alt="상품 2" class="w-full h-48 object-cover rounded">
                <h3 class="mt-2 font-semibold">노트북</h3>
                <p class="text-gray-600">고성능 노트북</p>
                <div class="mt-4 flex justify-between items-center">
                  <span class="text-lg font-bold">₩1,200,000</span>
                  <button data-action="add-to-cart" data-product-id="2" data-price="1200000"
                          class="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">
                    담기
                  </button>
                </div>
              </div>
            </div>
            
            <!-- 장바구니 모달 (초기에는 숨김) -->
            <div id="cart-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden">
              <div class="bg-white p-6 rounded-lg max-w-md mx-auto mt-20">
                <h2 class="text-xl font-bold mb-4">장바구니</h2>
                <div class="cart-items">
                  <!-- 동적으로 채워질 영역 -->
                </div>
                <div class="mt-4 flex justify-between">
                  <span class="font-bold">총액: ₩<span id="total-price">0</span></span>
                  <div>
                    <button data-action="close-cart" 
                            class="mr-2 bg-gray-500 text-white px-4 py-2 rounded">
                      닫기
                    </button>
                    <button data-action="checkout" 
                            class="bg-blue-500 text-white px-4 py-2 rounded">
                      결제
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      `;

      vi.spyOn(mockAgentComm, 'sendRequest').mockResolvedValue({
        id: 'response-1',
        requestId: 'request-1',
        type: 'success',
        timestamp: Date.now(),
        processingTime: 1500,
        status: { success: true, code: 200, message: 'OK' },
        data: {
          result: {
            title: 'AI 쇼핑몰',
            ui: {
              type: 'html',
              content: complexAIResponse,
              actions: {
                '[data-action="show-category"]': 'showCategory',
                '[data-action="show-cart"]': 'showCart',
                '[data-action="add-to-cart"]': 'addToCart',
                '[data-action="close-cart"]': 'closeCart',
                '[data-action="checkout"]': 'checkout'
              }
            },
            state: {
              cart: [],
              currentCategory: 'all',
              totalPrice: 0,
              products: [
                { id: 1, name: '스마트폰', price: 500000, category: 'electronics' },
                { id: 2, name: '노트북', price: 1200000, category: 'electronics' }
              ]
            }
          }
        },
        metadata: { version: '1.0.0', correlationId: 'corr-1' }
      } as AgentResponse);

      // 1. Director로 Scene 생성
      const scene = await director.request("전자제품 쇼핑몰을 만들어줘");

      // 2. Scene 구조 검증
      expect(scene).toBeDefined();
      expect(scene.id).toBeDefined();
      expect(scene.type).toBe('window');
      expect(scene.title).toBe('AI 쇼핑몰');

      // 3. UI 데이터 검증
      expect(scene.ui).toBeDefined();
      expect(scene.ui?.type).toBe('html');
      expect(scene.ui?.content).toContain('e-commerce-app');
      expect(scene.ui?.content).toContain('data-action=');

      // 4. 상태 데이터 검증
      expect(scene.state.data).toBeDefined();
      expect(scene.state.data.cart).toEqual([]);
      expect(scene.state.data.products).toHaveLength(2);
      expect(scene.state.data.totalPrice).toBe(0);

      // 5. 액션 매핑 검증 (UI에서 추출된 액션들)
      expect(scene.ui?.actions).toBeDefined();
      expect(Object.keys(scene.ui?.actions || {})).toContain('[data-action="add-to-cart"]');
      expect(Object.keys(scene.ui?.actions || {})).toContain('[data-action="show-cart"]');
    });
  });

  describe('Stage Rendering Process', () => {
    it('should render Scene to DOM with proper structure and elements', async () => {
      const shoppingMallHTML = `
        <div class="shopping-app p-4">
          <h1 class="text-2xl font-bold mb-4">상품 목록</h1>
          <div class="products grid grid-cols-2 gap-4">
            <div class="product bg-white p-4 rounded shadow">
              <h3>상품 A</h3>
              <p>₩10,000</p>
              <button data-action="buy" data-product="A" class="bg-blue-500 text-white px-4 py-2 rounded">
                구매
              </button>
            </div>
            <div class="product bg-white p-4 rounded shadow">
              <h3>상품 B</h3>
              <p>₩20,000</p>
              <button data-action="buy" data-product="B" class="bg-blue-500 text-white px-4 py-2 rounded">
                구매
              </button>
            </div>
          </div>
          <div class="total mt-4 p-4 bg-gray-100 rounded">
            <span>총 상품: <span id="product-count">2</span>개</span>
          </div>
        </div>
      `;

      vi.spyOn(mockAgentComm, 'sendRequest').mockResolvedValue({
        id: 'response-render',
        requestId: 'request-render',
        type: 'success',
        timestamp: Date.now(),
        processingTime: 1000,
        status: { success: true, code: 200, message: 'OK' },
        data: {
          result: {
            title: '상품 목록',
            ui: { type: 'html', content: shoppingMallHTML },
            state: { productCount: 2, selectedProducts: [] }
          }
        },
        metadata: { version: '1.0.0' }
      } as AgentResponse);

      // 1. Scene 생성 및 렌더링
      const scene = await director.request("상품 목록을 보여줘");
      await stage.render(scene);

      // 2. DOM 구조 검증
      expect(testContainer.children.length).toBe(1);
      
      const sceneElement = testContainer.querySelector('.scene-container');
      expect(sceneElement).toBeTruthy();
      expect(sceneElement?.getAttribute('data-scene-id')).toBe(scene.id);
      expect(sceneElement?.getAttribute('data-scene-type')).toBe('window');

      // 3. 렌더링된 콘텐츠 검증
      const appElement = testContainer.querySelector('.shopping-app');
      expect(appElement).toBeTruthy();
      
      const title = testContainer.querySelector('h1');
      expect(title?.textContent).toBe('상품 목록');

      const products = testContainer.querySelectorAll('.product');
      expect(products.length).toBe(2);

      const buyButtons = testContainer.querySelectorAll('[data-action="buy"]');
      expect(buyButtons.length).toBe(2);
      expect(buyButtons[0].getAttribute('data-product')).toBe('A');
      expect(buyButtons[1].getAttribute('data-product')).toBe('B');

      const productCount = testContainer.querySelector('#product-count');
      expect(productCount?.textContent).toBe('2');
    });

    it('should handle Scene updates and re-rendering', async () => {
      // 초기 Scene
      vi.spyOn(mockAgentComm, 'sendRequest').mockResolvedValueOnce({
        id: 'response-1',
        requestId: 'request-1',
        type: 'success',
        timestamp: Date.now(),
        processingTime: 1000,
        status: { success: true, code: 200, message: 'OK' },
        data: {
          result: {
            title: '빈 장바구니',
            ui: { 
              type: 'html', 
              content: '<div class="cart empty"><h2>장바구니가 비어있습니다</h2></div>' 
            },
            state: { items: [], total: 0 }
          }
        },
        metadata: { version: '1.0.0' }
      } as AgentResponse);

      const scene1 = await director.request("장바구니를 보여줘");
      await stage.render(scene1);

      // 초기 상태 검증
      expect(testContainer.querySelector('.cart.empty')).toBeTruthy();
      expect(testContainer.textContent).toContain('장바구니가 비어있습니다');

      // 업데이트된 Scene
      vi.spyOn(mockAgentComm, 'sendRequest').mockResolvedValueOnce({
        id: 'response-2',
        requestId: 'request-2',
        type: 'success',
        timestamp: Date.now(),
        processingTime: 1000,
        status: { success: true, code: 200, message: 'OK' },
        data: {
          result: {
            title: '장바구니 (1개 상품)',
            ui: { 
              type: 'html', 
              content: `
                <div class="cart filled">
                  <h2>장바구니</h2>
                  <div class="cart-item">
                    <span>스마트폰 - ₩500,000</span>
                    <button data-action="remove" data-item="1">제거</button>
                  </div>
                  <div class="total">총액: ₩500,000</div>
                </div>
              `
            },
            state: { 
              items: [{ id: 1, name: '스마트폰', price: 500000 }], 
              total: 500000 
            }
          }
        },
        metadata: { version: '1.0.0' }
      } as AgentResponse);

      const scene2 = await director.continueConversation("스마트폰을 장바구니에 추가해줘");
      await stage.render(scene2);

      // 업데이트된 상태 검증
      expect(testContainer.querySelector('.cart.empty')).toBeFalsy(); // 이전 상태 제거
      expect(testContainer.querySelector('.cart.filled')).toBeTruthy(); // 새 상태 추가
      expect(testContainer.textContent).toContain('스마트폰 - ₩500,000');
      expect(testContainer.textContent).toContain('총액: ₩500,000');
      expect(testContainer.querySelector('[data-action="remove"]')).toBeTruthy();
    });
  });

  describe('State Management & Persistence', () => {
    it('should maintain state across Scene transitions', async () => {
      // Scene 1: 로그인 폼
      vi.spyOn(mockAgentComm, 'sendRequest').mockResolvedValueOnce({
        id: 'response-login',
        requestId: 'request-login',
        type: 'success',
        timestamp: Date.now(),
        processingTime: 1000,
        status: { success: true, code: 200, message: 'OK' },
        data: {
          result: {
            title: '로그인',
            ui: {
              type: 'html',
              content: `
                <div class="login-form">
                  <h2>로그인</h2>
                  <form data-action="login">
                    <input name="username" placeholder="사용자명" value="">
                    <input name="password" type="password" placeholder="비밀번호">
                    <button type="submit">로그인</button>
                  </form>
                </div>
              `
            },
            state: { 
              isLoggedIn: false, 
              user: null,
              formData: { username: '', password: '' }
            }
          }
        },
        metadata: { version: '1.0.0' }
      } as AgentResponse);

      const loginScene = await director.request("로그인 페이지를 만들어줘");
      await stage.render(loginScene);

      // 로그인 상태 확인
      expect(loginScene.state.data.isLoggedIn).toBe(false);
      expect(loginScene.state.data.user).toBeNull();

      // Scene 2: 로그인 성공 후 대시보드
      vi.spyOn(mockAgentComm, 'sendRequest').mockResolvedValueOnce({
        id: 'response-dashboard',
        requestId: 'request-dashboard', 
        type: 'success',
        timestamp: Date.now(),
        processingTime: 1000,
        status: { success: true, code: 200, message: 'OK' },
        data: {
          result: {
            title: '대시보드',
            ui: {
              type: 'html',
              content: `
                <div class="dashboard">
                  <h2>환영합니다, admin님!</h2>
                  <div class="user-info">
                    <p>로그인 시간: <span id="login-time">${new Date().toLocaleTimeString()}</span></p>
                    <p>권한: <span id="user-role">관리자</span></p>
                  </div>
                  <button data-action="logout">로그아웃</button>
                </div>
              `
            },
            state: {
              isLoggedIn: true,
              user: { 
                username: 'admin', 
                role: 'admin', 
                loginTime: Date.now() 
              },
              previousScene: loginScene.id
            }
          }
        },
        metadata: { version: '1.0.0' }
      } as AgentResponse);

      const dashboardScene = await director.continueConversation("admin/password로 로그인해줘");
      await stage.render(dashboardScene);

      // 상태 전환 확인
      expect(dashboardScene.state.data.isLoggedIn).toBe(true);
      expect(dashboardScene.state.data.user).toBeDefined();
      expect(dashboardScene.state.data.user.username).toBe('admin');
      expect(dashboardScene.state.data.previousScene).toBe(loginScene.id);

      // 대화 체인에서 상태 연속성 확인
      const conversationHistory = director.getConversationHistory();
      expect(conversationHistory).toHaveLength(2);
      expect(conversationHistory[0].title).toBe('로그인');
      expect(conversationHistory[1].title).toBe('대시보드');

      // 현재 Scene의 컨텍스트에 이전 Scene 정보 포함 확인
      const currentConversation = director.getCurrentConversationChain();
      expect(currentConversation?.scenes).toHaveLength(2);
      expect(currentConversation?.currentSceneId).toBe(dashboardScene.id);
    });

    it('should handle complex state updates with nested objects', async () => {
      const complexStateHTML = `
        <div class="user-profile">
          <h2>사용자 프로필</h2>
          <div class="profile-section">
            <h3>개인 정보</h3>
            <p>이름: <span id="user-name">김철수</span></p>
            <p>이메일: <span id="user-email">kim@example.com</span></p>
          </div>
          <div class="preferences-section">
            <h3>설정</h3>
            <label>
              <input type="checkbox" data-action="toggle-notifications" checked>
              알림 받기
            </label>
            <select data-action="change-theme">
              <option value="light">라이트 테마</option>
              <option value="dark" selected>다크 테마</option>
            </select>
          </div>
          <div class="activity-section">
            <h3>최근 활동</h3>
            <ul class="activity-list">
              <li>로그인 - 2시간 전</li>
              <li>프로필 수정 - 1일 전</li>
            </ul>
            <button data-action="load-more-activity">더 보기</button>
          </div>
        </div>
      `;

      vi.spyOn(mockAgentComm, 'sendRequest').mockResolvedValue({
        id: 'response-profile',
        requestId: 'request-profile',
        type: 'success',
        timestamp: Date.now(),
        processingTime: 1000,
        status: { success: true, code: 200, message: 'OK' },
        data: {
          result: {
            title: '사용자 프로필',
            ui: { type: 'html', content: complexStateHTML },
            state: {
              user: {
                id: 123,
                name: '김철수',
                email: 'kim@example.com',
                profile: {
                  avatar: 'https://example.com/avatar.jpg',
                  bio: '개발자입니다'
                },
                preferences: {
                  notifications: true,
                  theme: 'dark',
                  language: 'ko'
                },
                activity: [
                  { action: 'login', timestamp: Date.now() - 7200000 },
                  { action: 'profile_update', timestamp: Date.now() - 86400000 }
                ]
              },
              ui: {
                activeSection: 'profile',
                expandedSections: ['preferences'],
                loadingStates: {
                  activity: false,
                  preferences: false
                }
              }
            }
          }
        },
        metadata: { version: '1.0.0' }
      } as AgentResponse);

      const scene = await director.request("사용자 프로필 페이지를 만들어줘");
      await stage.render(scene);

      // 복잡한 중첩 상태 검증
      expect(scene.state.data.user).toBeDefined();
      expect(scene.state.data.user.name).toBe('김철수');
      expect(scene.state.data.user.preferences.theme).toBe('dark');
      expect(scene.state.data.user.activity).toHaveLength(2);
      expect(scene.state.data.ui.activeSection).toBe('profile');
      expect(scene.state.data.ui.expandedSections).toContain('preferences');

      // DOM 렌더링 확인
      expect(testContainer.querySelector('#user-name')?.textContent).toBe('김철수');
      expect(testContainer.querySelector('#user-email')?.textContent).toBe('kim@example.com');
      expect(testContainer.querySelector('[data-action="toggle-notifications"]')).toBeTruthy();
      expect(testContainer.querySelector('[data-action="change-theme"]')).toBeTruthy();
      expect(testContainer.querySelector('.activity-list li')).toBeTruthy();
    });
  });

  describe('Event Handling & Interaction', () => {
    it('should capture and handle UI events with proper data extraction', async () => {
      const interactiveHTML = `
        <div class="interactive-app">
          <div class="counter-section">
            <h2>카운터: <span id="counter-value">0</span></h2>
            <button data-action="increment" data-amount="1" class="btn-increment">+1</button>
            <button data-action="increment" data-amount="5" class="btn-increment">+5</button>
            <button data-action="decrement" data-amount="1" class="btn-decrement">-1</button>
            <button data-action="reset" class="btn-reset">리셋</button>
          </div>
          
          <div class="form-section">
            <h3>설정</h3>
            <form data-action="update-settings">
              <input name="step" type="number" value="1" min="1" max="10">
              <input name="maxValue" type="number" value="100">
              <button type="submit">설정 저장</button>
            </form>
          </div>
        </div>
      `;

      vi.spyOn(mockAgentComm, 'sendRequest').mockResolvedValue({
        id: 'response-interactive',
        requestId: 'request-interactive',
        type: 'success',
        timestamp: Date.now(),
        processingTime: 1000,
        status: { success: true, code: 200, message: 'OK' },
        data: {
          result: {
            title: '인터랙티브 카운터',
            ui: { type: 'html', content: interactiveHTML },
            state: {
              counter: 0,
              settings: { step: 1, maxValue: 100 },
              history: []
            }
          }
        },
        metadata: { version: '1.0.0' }
      } as AgentResponse);

      const scene = await director.request("인터랙티브 카운터를 만들어줘");
      await stage.render(scene);

      // 이벤트 캐처 설정
      const capturedEvents: any[] = [];
      testContainer.addEventListener('ui-action', (e: any) => {
        capturedEvents.push(e.detail);
      });

      const capturedFormEvents: any[] = [];
      testContainer.addEventListener('ui-form-submit', (e: any) => {
        capturedFormEvents.push(e.detail);
      });

      // 버튼 클릭 이벤트 시뮬레이션
      const incrementBtn = testContainer.querySelector('[data-action="increment"][data-amount="5"]') as HTMLElement;
      const resetBtn = testContainer.querySelector('[data-action="reset"]') as HTMLElement;
      
      expect(incrementBtn).toBeTruthy();
      expect(resetBtn).toBeTruthy();

      // 클릭 이벤트 발생
      incrementBtn.click();
      resetBtn.click();

      // 이벤트 캐처 확인
      expect(capturedEvents).toHaveLength(2);
      
      expect(capturedEvents[0].action).toBe('increment');
      expect(capturedEvents[0].dataset.amount).toBe('5');
      expect(capturedEvents[0].sceneId).toBe(scene.id);

      expect(capturedEvents[1].action).toBe('reset');
      expect(capturedEvents[1].sceneId).toBe(scene.id);

      // 폼 제출 이벤트 시뮬레이션
      const form = testContainer.querySelector('form') as HTMLFormElement;
      expect(form).toBeTruthy();

      const submitEvent = new Event('submit', { bubbles: true });
      form.dispatchEvent(submitEvent);

      // 폼 이벤트 확인
      expect(capturedFormEvents).toHaveLength(1);
      expect(capturedFormEvents[0].action).toBe('update-settings');
      expect(capturedFormEvents[0].data.step).toBe('1');
      expect(capturedFormEvents[0].data.maxValue).toBe('100');
      expect(capturedFormEvents[0].sceneId).toBe(scene.id);
    });
  });
});
