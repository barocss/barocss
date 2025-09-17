/**
 * 시나리오 검증 테스트
 * 실제 시나리오 문서의 AI 응답을 사용해서 전체 플로우 검증
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Director } from '../src/core/director';
import { Stage } from '../src/core/stage';
import { createMockAgentCommunicationAdapter } from '../src/core/agent-communication-interface';
import { AgentResponse } from '../src/types';

// jsdom 환경에서 DOM 요소 생성
function createTestDOM() {
  const container = document.createElement('div');
  container.id = 'scenario-test-app';
  container.innerHTML = '';
  document.body.appendChild(container);
  return container;
}

describe('Scenario Validation: Online Shopping Mall', () => {
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

  describe('Step 1: Main Shopping Mall Page', () => {
    it('should render complete shopping mall homepage from scenario document', async () => {
      // 시나리오 문서의 실제 HTML 응답
      const mainPageHTML = `
        <div class="min-h-screen bg-gray-50">
          <header class="bg-white shadow">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div class="flex justify-between items-center py-6">
                <h1 class="text-3xl font-bold text-gray-900">🛍️ AI 쇼핑몰</h1>
                <div class="flex items-center space-x-4">
                  <button class="text-gray-700 hover:text-gray-900" 
                          data-action="show-login">로그인</button>
                  <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700" 
                          data-action="show-register">회원가입</button>
                </div>
              </div>
            </div>
          </header>

          <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <!-- 검색 바 -->
            <div class="mb-8">
              <div class="flex">
                <input type="text" placeholder="상품을 검색하세요..." 
                       class="flex-1 px-4 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                       data-action="search-products">
                <button class="bg-blue-600 text-white px-6 py-2 rounded-r-md hover:bg-blue-700" 
                        data-action="search-products">
                  검색
                </button>
              </div>
            </div>

            <!-- 카테고리 -->
            <div class="mb-8">
              <h2 class="text-2xl font-bold text-gray-900 mb-4">카테고리</h2>
              <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div class="text-center p-4 bg-white rounded-lg shadow hover:shadow-md cursor-pointer" 
                     data-action="filter-category" data-category="electronics">
                  <div class="text-4xl mb-2">📱</div>
                  <div class="text-sm font-medium">전자제품</div>
                </div>
                <div class="text-center p-4 bg-white rounded-lg shadow hover:shadow-md cursor-pointer" 
                     data-action="filter-category" data-category="clothing">
                  <div class="text-4xl mb-2">👕</div>
                  <div class="text-sm font-medium">의류</div>
                </div>
                <div class="text-center p-4 bg-white rounded-lg shadow hover:shadow-md cursor-pointer" 
                     data-action="filter-category" data-category="home">
                  <div class="text-4xl mb-2">🏠</div>
                  <div class="text-sm font-medium">홈&리빙</div>
                </div>
                <div class="text-center p-4 bg-white rounded-lg shadow hover:shadow-md cursor-pointer" 
                     data-action="filter-category" data-category="books">
                  <div class="text-4xl mb-2">📚</div>
                  <div class="text-sm font-medium">도서</div>
                </div>
                <div class="text-center p-4 bg-white rounded-lg shadow hover:shadow-md cursor-pointer" 
                     data-action="filter-category" data-category="sports">
                  <div class="text-4xl mb-2">⚽</div>
                  <div class="text-sm font-medium">스포츠</div>
                </div>
                <div class="text-center p-4 bg-white rounded-lg shadow hover:shadow-md cursor-pointer" 
                     data-action="filter-category" data-category="beauty">
                  <div class="text-4xl mb-2">💄</div>
                  <div class="text-sm font-medium">뷰티</div>
                </div>
              </div>
            </div>

            <!-- 인기 상품 -->
            <div class="mb-8">
              <h2 class="text-2xl font-bold text-gray-900 mb-4">인기 상품</h2>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="bg-white rounded-lg shadow-md overflow-hidden">
                  <img src="/api/placeholder/300/200" alt="iPhone 15 Pro" class="w-full h-48 object-cover">
                  <div class="p-4">
                    <h3 class="font-semibold text-lg">iPhone 15 Pro</h3>
                    <p class="text-gray-600">Apple</p>
                    <div class="mt-2 flex justify-between items-center">
                      <span class="text-xl font-bold text-blue-600">₩1,350,000</span>
                      <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700" 
                              data-action="add-to-cart" data-product="iphone-15-pro">
                        장바구니
                      </button>
                    </div>
                  </div>
                </div>
                <div class="bg-white rounded-lg shadow-md overflow-hidden">
                  <img src="/api/placeholder/300/200" alt="Galaxy S24" class="w-full h-48 object-cover">
                  <div class="p-4">
                    <h3 class="font-semibold text-lg">Galaxy S24</h3>
                    <p class="text-gray-600">Samsung</p>
                    <div class="mt-2 flex justify-between items-center">
                      <span class="text-xl font-bold text-blue-600">₩1,200,000</span>
                      <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700" 
                              data-action="add-to-cart" data-product="galaxy-s24">
                        장바구니
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      `;

      // 시나리오 상태 데이터
      const scenarioState = {
        user: {
          userId: "anonymous",
          preferences: {
            language: "ko",
            currency: "KRW",
            theme: "light"
          }
        },
        cart: [],
        wishlist: [],
        recentSearches: [],
        products: [
          {
            id: "iphone-15-pro",
            name: "iPhone 15 Pro",
            brand: "Apple",
            price: 1350000,
            category: "electronics",
            image: "/api/placeholder/300/200"
          },
          {
            id: "galaxy-s24",
            name: "Galaxy S24",
            brand: "Samsung",
            price: 1200000,
            category: "electronics",
            image: "/api/placeholder/300/200"
          }
        ],
        categories: [
          { id: "electronics", name: "전자제품", icon: "📱" },
          { id: "clothing", name: "의류", icon: "👕" },
          { id: "home", name: "홈&리빙", icon: "🏠" },
          { id: "books", name: "도서", icon: "📚" },
          { id: "sports", name: "스포츠", icon: "⚽" },
          { id: "beauty", name: "뷰티", icon: "💄" }
        ]
      };

      vi.spyOn(mockAgentComm, 'sendRequest').mockResolvedValue({
        id: 'response-shopping-main',
        requestId: 'request-shopping-main',
        type: 'success',
        timestamp: Date.now(),
        processingTime: 1500,
        status: { success: true, code: 200, message: 'OK' },
        data: {
          result: {
            title: '🛍️ AI 쇼핑몰',
            ui: {
              type: 'html',
              content: mainPageHTML,
              actions: {
                '[data-action="show-login"]': 'showLogin',
                '[data-action="show-register"]': 'showRegister', 
                '[data-action="search-products"]': 'searchProducts',
                '[data-action="filter-category"]': 'filterCategory',
                '[data-action="add-to-cart"]': 'addToCart'
              }
            },
            state: scenarioState
          }
        },
        metadata: { version: '1.0.0', correlationId: 'scenario-1-step-1' }
      } as AgentResponse);

      // 1. 시나리오 1단계: 메인 페이지 요청
      const scene1 = await director.request("온라인 쇼핑몰을 만들어줘. 상품을 검색하고 구매할 수 있게 해줘");
      await stage.render(scene1);

      // 2. Scene 구조 검증
      expect(scene1.title).toBe('🛍️ AI 쇼핑몰');
      expect(scene1.state.data.user.preferences.language).toBe('ko');
      expect(scene1.state.data.products).toHaveLength(2);
      expect(scene1.state.data.categories).toHaveLength(6);

      // 3. DOM 렌더링 검증
      expect(testContainer.querySelector('h1')?.textContent).toBe('🛍️ AI 쇼핑몰');
      
      // 헤더 버튼들
      const loginBtn = testContainer.querySelector('[data-action="show-login"]');
      const registerBtn = testContainer.querySelector('[data-action="show-register"]');
      expect(loginBtn?.textContent?.trim()).toBe('로그인');
      expect(registerBtn?.textContent?.trim()).toBe('회원가입');

      // 검색 기능
      const searchInput = testContainer.querySelector('input[placeholder="상품을 검색하세요..."]');
      const searchButtons = testContainer.querySelectorAll('[data-action="search-products"]');
      expect(searchInput).toBeTruthy();
      expect(searchButtons.length).toBeGreaterThan(0);
      
      // 두 번째 검색 버튼 (실제 "검색" 텍스트가 있는 버튼)
      const searchBtn = searchButtons[1] as HTMLElement; // input 다음의 button
      expect(searchBtn?.textContent?.trim()).toBe('검색');

      // 카테고리 검증
      const categories = testContainer.querySelectorAll('[data-action="filter-category"]');
      expect(categories).toHaveLength(6);
      expect(categories[0].getAttribute('data-category')).toBe('electronics');
      expect(categories[0].textContent).toContain('전자제품');

      // 상품 카드 검증
      const products = testContainer.querySelectorAll('[data-action="add-to-cart"]');
      expect(products).toHaveLength(2);
      expect(products[0].getAttribute('data-product')).toBe('iphone-15-pro');
      expect(products[1].getAttribute('data-product')).toBe('galaxy-s24');

      // 가격 표시 검증
      expect(testContainer.textContent).toContain('₩1,350,000');
      expect(testContainer.textContent).toContain('₩1,200,000');

      // 액션 매핑 검증
      expect(scene1.ui?.actions).toHaveProperty('[data-action="filter-category"]', 'filterCategory');
      expect(scene1.ui?.actions).toHaveProperty('[data-action="add-to-cart"]', 'addToCart');
    });
  });

  describe('Step 2: Category Filtering', () => {
    it('should handle electronics category filtering from scenario', async () => {
      // 2단계: 전자제품 카테고리 페이지
      const electronicsPageHTML = `
        <div class="min-h-screen bg-gray-50">
          <header class="bg-white shadow">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div class="flex justify-between items-center py-6">
                <h1 class="text-3xl font-bold text-gray-900">🛍️ AI 쇼핑몰 - 전자제품</h1>
                <div class="flex items-center space-x-4">
                  <button class="text-gray-700 hover:text-gray-900" 
                          data-action="go-back">← 뒤로가기</button>
                  <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700" 
                          data-action="show-cart">장바구니 (0)</button>
                </div>
              </div>
            </div>
          </header>

          <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <!-- 필터 및 정렬 -->
            <div class="mb-8 bg-white p-4 rounded-lg shadow">
              <div class="flex flex-wrap items-center justify-between gap-4">
                <div class="flex items-center space-x-4">
                  <span class="text-sm font-medium text-gray-700">필터:</span>
                  <select class="px-3 py-2 border border-gray-300 rounded-md" data-action="filter-price">
                    <option value="">가격대</option>
                    <option value="0-100000">10만원 이하</option>
                    <option value="100000-500000">10-50만원</option>
                    <option value="500000-1000000">50-100만원</option>
                    <option value="1000000+">100만원 이상</option>
                  </select>
                  <select class="px-3 py-2 border border-gray-300 rounded-md" data-action="filter-brand">
                    <option value="">브랜드</option>
                    <option value="apple">Apple</option>
                    <option value="samsung">Samsung</option>
                    <option value="lg">LG</option>
                  </select>
                </div>
                <div class="flex items-center space-x-4">
                  <span class="text-sm font-medium text-gray-700">정렬:</span>
                  <select class="px-3 py-2 border border-gray-300 rounded-md" data-action="sort-products">
                    <option value="popularity">인기순</option>
                    <option value="price-low">가격 낮은순</option>
                    <option value="price-high">가격 높은순</option>
                    <option value="newest">최신순</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- 상품 목록 -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <div class="bg-white rounded-lg shadow-md overflow-hidden">
                <img src="/api/placeholder/300/200" alt="iPhone 15 Pro" class="w-full h-48 object-cover">
                <div class="p-4">
                  <h3 class="font-semibold text-lg">iPhone 15 Pro</h3>
                  <p class="text-gray-600">Apple</p>
                  <div class="mt-2 flex justify-between items-center">
                    <span class="text-xl font-bold text-blue-600">₩1,350,000</span>
                    <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700" 
                            data-action="add-to-cart" data-product="iphone-15-pro">
                      장바구니
                    </button>
                  </div>
                </div>
              </div>
              <div class="bg-white rounded-lg shadow-md overflow-hidden">
                <img src="/api/placeholder/300/200" alt="Galaxy S24" class="w-full h-48 object-cover">
                <div class="p-4">
                  <h3 class="font-semibold text-lg">Galaxy S24</h3>
                  <p class="text-gray-600">Samsung</p>
                  <div class="mt-2 flex justify-between items-center">
                    <span class="text-xl font-bold text-blue-600">₩1,200,000</span>
                    <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700" 
                            data-action="add-to-cart" data-product="galaxy-s24">
                      장바구니
                    </button>
                  </div>
                </div>
              </div>
              <div class="bg-white rounded-lg shadow-md overflow-hidden">
                <img src="/api/placeholder/300/200" alt="MacBook Pro" class="w-full h-48 object-cover">
                <div class="p-4">
                  <h3 class="font-semibold text-lg">MacBook Pro 14"</h3>
                  <p class="text-gray-600">Apple</p>
                  <div class="mt-2 flex justify-between items-center">
                    <span class="text-xl font-bold text-blue-600">₩2,890,000</span>
                    <button class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700" 
                            data-action="add-to-cart" data-product="macbook-pro-14">
                      장바구니
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-8 text-center">
              <p class="text-gray-600">총 3개의 전자제품이 있습니다.</p>
            </div>
          </main>
        </div>
      `;

      const electronicsState = {
        currentCategory: "electronics",
        filteredProducts: [
          { id: "iphone-15-pro", name: "iPhone 15 Pro", brand: "Apple", price: 1350000 },
          { id: "galaxy-s24", name: "Galaxy S24", brand: "Samsung", price: 1200000 },
          { id: "macbook-pro-14", name: "MacBook Pro 14\"", brand: "Apple", price: 2890000 }
        ],
        cart: [],
        filters: {
          priceRange: "",
          brand: "",
          sortBy: "popularity"
        }
      };

      vi.spyOn(mockAgentComm, 'sendRequest').mockResolvedValue({
        id: 'response-electronics',
        requestId: 'request-electronics',
        type: 'success',
        timestamp: Date.now(),
        processingTime: 1200,
        status: { success: true, code: 200, message: 'OK' },
        data: {
          result: {
            title: '🛍️ AI 쇼핑몰 - 전자제품',
            ui: {
              type: 'html',
              content: electronicsPageHTML,
              actions: {
                '[data-action="go-back"]': 'goBack',
                '[data-action="show-cart"]': 'showCart',
                '[data-action="filter-price"]': 'filterPrice',
                '[data-action="filter-brand"]': 'filterBrand',
                '[data-action="sort-products"]': 'sortProducts',
                '[data-action="add-to-cart"]': 'addToCart'
              }
            },
            state: electronicsState
          }
        },
        metadata: { version: '1.0.0', correlationId: 'scenario-1-step-2' }
      } as AgentResponse);

      // 2단계: 전자제품 카테고리 필터링
      const scene2 = await director.continueConversation("전자제품 카테고리의 상품들을 보여줘");
      await stage.render(scene2);

      // Scene 구조 검증
      expect(scene2.title).toBe('🛍️ AI 쇼핑몰 - 전자제품');
      expect(scene2.state.data.currentCategory).toBe('electronics');
      expect(scene2.state.data.filteredProducts).toHaveLength(3);

      // DOM 렌더링 검증
      expect(testContainer.querySelector('h1')?.textContent).toBe('🛍️ AI 쇼핑몰 - 전자제품');
      
      // 필터 옵션들
      const priceFilter = testContainer.querySelector('[data-action="filter-price"]');
      const brandFilter = testContainer.querySelector('[data-action="filter-brand"]');
      const sortSelect = testContainer.querySelector('[data-action="sort-products"]');
      expect(priceFilter).toBeTruthy();
      expect(brandFilter).toBeTruthy();
      expect(sortSelect).toBeTruthy();

      // 전자제품들 확인
      const productCards = testContainer.querySelectorAll('[data-action="add-to-cart"]');
      expect(productCards).toHaveLength(3);
      expect(testContainer.textContent).toContain('iPhone 15 Pro');
      expect(testContainer.textContent).toContain('Galaxy S24');
      expect(testContainer.textContent).toContain('MacBook Pro 14"');
      expect(testContainer.textContent).toContain('총 3개의 전자제품이 있습니다');

      // 대화 이력 확인 (continueConversation이므로 1개 Scene)
      const conversationHistory = director.getConversationHistory();
      expect(conversationHistory).toHaveLength(1);
      expect(conversationHistory[0].title).toBe('🛍️ AI 쇼핑몰 - 전자제품');
    });
  });

  describe('Step 3: Shopping Cart and Checkout', () => {
    it('should handle add to cart and checkout process from scenario', async () => {
      // 3단계: 장바구니 페이지
      const cartPageHTML = `
        <div class="min-h-screen bg-gray-50">
          <header class="bg-white shadow">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div class="flex justify-between items-center py-6">
                <h1 class="text-3xl font-bold text-gray-900">🛍️ 장바구니</h1>
                <div class="flex items-center space-x-4">
                  <button class="text-gray-700 hover:text-gray-900" 
                          data-action="continue-shopping">← 쇼핑 계속하기</button>
                  <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                    1개 상품
                  </span>
                </div>
              </div>
            </div>
          </header>

          <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <!-- 장바구니 상품 목록 -->
              <div class="lg:col-span-2">
                <div class="bg-white rounded-lg shadow">
                  <div class="p-6">
                    <h2 class="text-lg font-medium text-gray-900 mb-4">장바구니 상품</h2>
                    
                    <div class="border rounded-lg p-4">
                      <div class="flex items-center">
                        <img src="/api/placeholder/100/100" alt="iPhone 15 Pro" class="w-20 h-20 object-cover rounded">
                        <div class="ml-4 flex-1">
                          <h3 class="text-lg font-medium">iPhone 15 Pro</h3>
                          <p class="text-gray-600">Apple</p>
                          <p class="text-lg font-bold text-blue-600 mt-1">₩1,350,000</p>
                        </div>
                        <div class="flex items-center space-x-3">
                          <button class="text-gray-400 hover:text-gray-600" 
                                  data-action="decrease-quantity" data-product="iphone-15-pro">
                            <span class="text-xl">−</span>
                          </button>
                          <span class="text-lg font-medium px-3">1</span>
                          <button class="text-gray-400 hover:text-gray-600" 
                                  data-action="increase-quantity" data-product="iphone-15-pro">
                            <span class="text-xl">+</span>
                          </button>
                          <button class="text-red-500 hover:text-red-700 ml-4" 
                                  data-action="remove-from-cart" data-product="iphone-15-pro">
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 주문 요약 -->
              <div class="lg:col-span-1">
                <div class="bg-white rounded-lg shadow">
                  <div class="p-6">
                    <h2 class="text-lg font-medium text-gray-900 mb-4">주문 요약</h2>
                    
                    <div class="space-y-2">
                      <div class="flex justify-between">
                        <span>상품 금액</span>
                        <span>₩1,350,000</span>
                      </div>
                      <div class="flex justify-between">
                        <span>배송비</span>
                        <span>무료</span>
                      </div>
                      <div class="border-t pt-2 mt-2">
                        <div class="flex justify-between text-lg font-bold">
                          <span>총 결제 금액</span>
                          <span class="text-blue-600">₩1,350,000</span>
                        </div>
                      </div>
                    </div>

                    <button class="w-full mt-6 bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 font-medium" 
                            data-action="proceed-checkout">
                      결제하기
                    </button>
                    
                    <div class="mt-4 text-center">
                      <button class="text-blue-600 hover:text-blue-800 text-sm" 
                              data-action="apply-coupon">
                        쿠폰 / 할인코드 적용
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      `;

      const cartState = {
        cart: [
          {
            productId: "iphone-15-pro",
            name: "iPhone 15 Pro",
            brand: "Apple",
            price: 1350000,
            quantity: 1,
            image: "/api/placeholder/100/100"
          }
        ],
        totals: {
          subtotal: 1350000,
          shipping: 0,
          tax: 0,
          total: 1350000
        },
        user: {
          isLoggedIn: false,
          address: null,
          paymentMethod: null
        }
      };

      vi.spyOn(mockAgentComm, 'sendRequest').mockResolvedValue({
        id: 'response-cart',
        requestId: 'request-cart',
        type: 'success',
        timestamp: Date.now(),
        processingTime: 1000,
        status: { success: true, code: 200, message: 'OK' },
        data: {
          result: {
            title: '🛍️ 장바구니',
            ui: {
              type: 'html',
              content: cartPageHTML,
              actions: {
                '[data-action="continue-shopping"]': 'continueShopping',
                '[data-action="decrease-quantity"]': 'decreaseQuantity',
                '[data-action="increase-quantity"]': 'increaseQuantity',
                '[data-action="remove-from-cart"]': 'removeFromCart',
                '[data-action="proceed-checkout"]': 'proceedCheckout',
                '[data-action="apply-coupon"]': 'applyCoupon'
              }
            },
            state: cartState
          }
        },
        metadata: { version: '1.0.0', correlationId: 'scenario-1-step-3' }
      } as AgentResponse);

      // 3단계: 장바구니 및 결제
      const scene3 = await director.continueConversation("iPhone 15 Pro를 장바구니에 추가했어. 장바구니를 보여줘");
      await stage.render(scene3);

      // Scene 구조 검증
      expect(scene3.title).toBe('🛍️ 장바구니');
      expect(scene3.state.data.cart).toHaveLength(1);
      expect(scene3.state.data.cart[0].productId).toBe('iphone-15-pro');
      expect(scene3.state.data.totals.total).toBe(1350000);

      // DOM 렌더링 검증
      expect(testContainer.querySelector('h1')?.textContent).toBe('🛍️ 장바구니');
      expect(testContainer.textContent).toContain('1개 상품');
      
      // 장바구니 상품 확인
      expect(testContainer.textContent).toContain('iPhone 15 Pro');
      expect(testContainer.textContent).toContain('Apple');
      expect(testContainer.textContent).toContain('₩1,350,000');

      // 수량 조절 버튼들
      const decreaseBtn = testContainer.querySelector('[data-action="decrease-quantity"]');
      const increaseBtn = testContainer.querySelector('[data-action="increase-quantity"]');
      const removeBtn = testContainer.querySelector('[data-action="remove-from-cart"]');
      expect(decreaseBtn).toBeTruthy();
      expect(increaseBtn).toBeTruthy();
      expect(removeBtn?.textContent?.trim()).toBe('삭제');

      // 주문 요약
      expect(testContainer.textContent).toContain('주문 요약');
      expect(testContainer.textContent).toContain('총 결제 금액');
      expect(testContainer.textContent).toContain('배송비');
      expect(testContainer.textContent).toContain('무료');

      // 결제 버튼
      const checkoutBtn = testContainer.querySelector('[data-action="proceed-checkout"]');
      expect(checkoutBtn?.textContent?.trim()).toBe('결제하기');

      // 액션 검증
      expect(scene3.ui?.actions).toHaveProperty('[data-action="proceed-checkout"]', 'proceedCheckout');
      expect(scene3.ui?.actions).toHaveProperty('[data-action="increase-quantity"]', 'increaseQuantity');

      // 전체 대화 체인 확인
      const conversationHistory = director.getConversationHistory();
      expect(conversationHistory).toHaveLength(1); // continueConversation으로 시작했으므로 1개
      
      const currentChain = director.getCurrentConversationChain();
      expect(currentChain?.scenes).toHaveLength(1);
      expect(currentChain?.currentSceneId).toBe(scene3.id);
    });
  });

  describe('Complete Scenario Flow', () => {
    it('should handle the complete shopping flow with state persistence', async () => {
      // 전체 시나리오 플로우를 연속으로 검증
      let mockCallCount = 0;
      
      vi.spyOn(mockAgentComm, 'sendRequest').mockImplementation(async (request) => {
        mockCallCount++;
        
        if (mockCallCount === 1) {
          // 메인 페이지
          return {
            id: 'response-main',
            requestId: request.id,
            type: 'success',
            timestamp: Date.now(),
            processingTime: 1000,
            status: { success: true, code: 200, message: 'OK' },
            data: {
              result: {
                title: '🛍️ AI 쇼핑몰',
                ui: { type: 'html', content: '<div class="main-page">메인 페이지</div>' },
                state: { step: 'main', cart: [] }
              }
            },
            metadata: { version: '1.0.0' }
          } as AgentResponse;
        } else if (mockCallCount === 2) {
          // 전자제품 카테고리
          return {
            id: 'response-electronics',
            requestId: request.id,
            type: 'success',
            timestamp: Date.now(),
            processingTime: 1000,
            status: { success: true, code: 200, message: 'OK' },
            data: {
              result: {
                title: '전자제품 카테고리',
                ui: { type: 'html', content: '<div class="electronics-page">전자제품 목록</div>' },
                state: { step: 'category', category: 'electronics', cart: [] }
              }
            },
            metadata: { version: '1.0.0' }
          } as AgentResponse;
        } else {
          // 장바구니
          return {
            id: 'response-cart',
            requestId: request.id,
            type: 'success',
            timestamp: Date.now(),
            processingTime: 1000,
            status: { success: true, code: 200, message: 'OK' },
            data: {
              result: {
                title: '장바구니',
                ui: { type: 'html', content: '<div class="cart-page">장바구니</div>' },
                state: { 
                  step: 'cart', 
                  cart: [{ productId: 'iphone-15-pro', quantity: 1 }] 
                }
              }
            },
            metadata: { version: '1.0.0' }
          } as AgentResponse;
        }
      });

      // 1단계: 메인 페이지
      const scene1 = await director.request("온라인 쇼핑몰을 만들어줘");
      await stage.render(scene1);
      expect(scene1.title).toBe('🛍️ AI 쇼핑몰');
      expect(scene1.state.data.step).toBe('main');

      // 2단계: 카테고리 필터링
      const scene2 = await director.continueConversation("전자제품을 보여줘");
      await stage.render(scene2);
      expect(scene2.title).toBe('전자제품 카테고리');
      expect(scene2.state.data.step).toBe('category');

      // 3단계: 장바구니
      const scene3 = await director.continueConversation("상품을 장바구니에 담아줘");
      await stage.render(scene3);
      expect(scene3.title).toBe('장바구니');
      expect(scene3.state.data.step).toBe('cart');
      expect(scene3.state.data.cart).toHaveLength(1);

      // 전체 대화 체인 검증
      const conversationHistory = director.getConversationHistory();
      expect(conversationHistory).toHaveLength(3);
      expect(conversationHistory[0].title).toBe('🛍️ AI 쇼핑몰');
      expect(conversationHistory[1].title).toBe('전자제품 카테고리');
      expect(conversationHistory[2].title).toBe('장바구니');

      // 현재 대화 체인의 연속성 검증
      const currentChain = director.getCurrentConversationChain();
      expect(currentChain?.scenes).toHaveLength(3);
      expect(currentChain?.currentSceneId).toBe(scene3.id);

      // Mock 호출 횟수 확인
      expect(mockCallCount).toBe(3);
    });
  });
});
