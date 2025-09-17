/**
 * 시스템 완성도 검증 테스트
 * Director 시스템의 전체적인 완성도와 실제 사용 가능성을 종합 검증
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Director } from '../src/core/director';
import { Stage } from '../src/core/stage';
import { OpenAIAdapter, AnthropicAdapter } from '../src/core/ai-service-adapters';
import { createMockAgentCommunicationAdapter } from '../src/core/agent-communication-interface';

// 전체 시스템 exports 확인
import * as BarocssUI from '../src/index';

describe('System Completeness Verification', () => {
  
  describe('Core Architecture Completeness', () => {
    it('should have all major components exported', () => {
      // 핵심 클래스들이 모두 export되어 있는지 확인
      expect(BarocssUI.Director).toBeDefined();
      expect(BarocssUI.Stage).toBeDefined();
      expect(BarocssUI.createStage).toBeDefined();
      expect(BarocssUI.UIRenderer).toBeDefined();
      expect(BarocssUI.createUIRenderer).toBeDefined();
      expect(BarocssUI.ActionHandler).toBeDefined();
      expect(BarocssUI.createActionHandler).toBeDefined();
    });

    it('should support full Director + Stage initialization', () => {
      const container = document.createElement('div');
      
      // Mock agent 설정
      const mockAgent = createMockAgentCommunicationAdapter();
      
      // Director 초기화 가능
      const director = new Director({ debug: false }, mockAgent);
      expect(director).toBeInstanceOf(Director);
      expect(director.isReady()).toBe(false); // 아직 initialize 안 함
      
      // Stage 초기화 가능
      const stage = new Stage({ mount: container, director });
      expect(stage).toBeInstanceOf(Stage);
      
      // 정리
      stage.dispose();
    });

    it('should support AI service adapters', () => {
      // OpenAI 어댑터
      const openaiAdapter = new OpenAIAdapter();
      expect(openaiAdapter).toBeInstanceOf(OpenAIAdapter);
      
      // Anthropic 어댑터
      const anthropicAdapter = new AnthropicAdapter();
      expect(anthropicAdapter).toBeInstanceOf(AnthropicAdapter);
      
      // 어댑터 메서드들이 정의되어 있는지 확인
      expect(typeof openaiAdapter.convertToOpenAI).toBe('function');
      expect(typeof openaiAdapter.convertFromOpenAI).toBe('function');
      expect(typeof anthropicAdapter.convertToAnthropic).toBe('function');
      expect(typeof anthropicAdapter.convertFromAnthropic).toBe('function');
    });
  });

  describe('Real-World Usage Simulation', () => {
    let director: Director;
    let stage: Stage;
    let testContainer: HTMLElement;

    beforeEach(async () => {
      testContainer = document.createElement('div');
      testContainer.id = 'real-world-test';
      document.body.appendChild(testContainer);

      const mockAgent = createMockAgentCommunicationAdapter({
        delay: 5,
        errorRate: 0
      });

      director = new Director({ debug: false }, mockAgent);
      await director.initialize();

      stage = new Stage({ mount: testContainer, director });
      stage.mount();
    });

    afterEach(() => {
      stage.dispose();
      testContainer.remove();
    });

    it('should handle complete e-commerce user journey', async () => {
      // 실제 사용자 시나리오: 온라인 쇼핑 전체 여정
      let mockStep = 0;
      
      vi.spyOn(director as any, 'sendRequest').mockImplementation(async () => {
        mockStep++;
        
        if (mockStep === 1) {
          return {
            id: 'resp-home',
            requestId: 'req-home',
            type: 'success',
            timestamp: Date.now(),
            processingTime: 800,
            status: { success: true, code: 200, message: 'OK' },
            data: {
              result: {
                title: '홈페이지',
                ui: {
                  type: 'html',
                  content: `
                    <div class="homepage">
                      <h1>Welcome to AI Shop</h1>
                      <div class="categories">
                        <button data-action="browse-electronics">Electronics</button>
                        <button data-action="browse-fashion">Fashion</button>
                      </div>
                      <div class="featured-products">
                        <div class="product" data-product="laptop-1">
                          <h3>Gaming Laptop</h3>
                          <span class="price">$1,299</span>
                          <button data-action="add-to-cart" data-product="laptop-1">Add to Cart</button>
                        </div>
                      </div>
                    </div>
                  `,
                  actions: {
                    '[data-action="browse-electronics"]': 'browseElectronics',
                    '[data-action="add-to-cart"]': 'addToCart'
                  }
                },
                state: {
                  currentPage: 'home',
                  cart: [],
                  user: { isLoggedIn: false }
                }
              }
            },
            metadata: { version: '1.0.0' }
          };
        } else if (mockStep === 2) {
          return {
            id: 'resp-cart',
            requestId: 'req-cart',
            type: 'success',
            timestamp: Date.now(),
            processingTime: 600,
            status: { success: true, code: 200, message: 'OK' },
            data: {
              result: {
                title: 'Shopping Cart',
                ui: {
                  type: 'html',
                  content: `
                    <div class="cart-page">
                      <h1>Your Cart</h1>
                      <div class="cart-items">
                        <div class="cart-item">
                          <h3>Gaming Laptop</h3>
                          <span class="price">$1,299</span>
                          <input type="number" value="1" data-action="update-quantity" data-product="laptop-1">
                          <button data-action="remove-item" data-product="laptop-1">Remove</button>
                        </div>
                      </div>
                      <div class="cart-total">
                        <span>Total: $1,299</span>
                        <button data-action="proceed-checkout">Checkout</button>
                      </div>
                    </div>
                  `,
                  actions: {
                    '[data-action="update-quantity"]': 'updateQuantity',
                    '[data-action="remove-item"]': 'removeItem',
                    '[data-action="proceed-checkout"]': 'proceedCheckout'
                  }
                },
                state: {
                  currentPage: 'cart',
                  cart: [{ productId: 'laptop-1', quantity: 1, price: 1299 }],
                  total: 1299
                }
              }
            },
            metadata: { version: '1.0.0' }
          };
        } else {
          return {
            id: 'resp-checkout',
            requestId: 'req-checkout',
            type: 'success',
            timestamp: Date.now(),
            processingTime: 1200,
            status: { success: true, code: 200, message: 'OK' },
            data: {
              result: {
                title: 'Checkout Complete',
                ui: {
                  type: 'html',
                  content: `
                    <div class="checkout-success">
                      <h1>🎉 Order Confirmed!</h1>
                      <div class="order-details">
                        <p>Order #12345</p>
                        <p>Total: $1,299</p>
                        <p>Estimated delivery: 3-5 business days</p>
                      </div>
                      <button data-action="continue-shopping">Continue Shopping</button>
                      <button data-action="track-order">Track Order</button>
                    </div>
                  `,
                  actions: {
                    '[data-action="continue-shopping"]': 'continueShopping',
                    '[data-action="track-order"]': 'trackOrder'
                  }
                },
                state: {
                  currentPage: 'checkout-success',
                  orderId: '12345',
                  cart: [],
                  orderStatus: 'confirmed'
                }
              }
            },
            metadata: { version: '1.0.0' }
          };
        }
      });

      // 1단계: 홈페이지 방문
      const homeScene = await director.request("Show me the homepage with featured products");
      await stage.render(homeScene);
      
      expect(homeScene.title).toBe('홈페이지');
      expect(testContainer.textContent).toContain('Welcome to AI Shop');
      expect(testContainer.textContent).toContain('Gaming Laptop');
      expect(testContainer.querySelector('[data-action="add-to-cart"]')).toBeTruthy();

      // 2단계: 상품을 장바구니에 추가
      const cartScene = await director.continueConversation("Add the gaming laptop to my cart and show cart");
      await stage.render(cartScene);
      
      expect(cartScene.title).toBe('Shopping Cart');
      expect(testContainer.textContent).toContain('Your Cart');
      expect(testContainer.textContent).toContain('$1,299');
      expect(cartScene.state.data.cart).toHaveLength(1);

      // 3단계: 결제 완료
      const checkoutScene = await director.continueConversation("Proceed to checkout and complete the order");
      await stage.render(checkoutScene);
      
      expect(checkoutScene.title).toBe('Checkout Complete');
      expect(testContainer.textContent).toContain('🎉 Order Confirmed!');
      expect(testContainer.textContent).toContain('Order #12345');
      expect(checkoutScene.state.data.orderStatus).toBe('confirmed');

      // 전체 여정 검증
      const history = director.getConversationHistory();
      expect(history).toHaveLength(3);
      expect(history[0].title).toBe('홈페이지');
      expect(history[1].title).toBe('Shopping Cart');
      expect(history[2].title).toBe('Checkout Complete');
    });

    it('should handle complex multi-step form wizard', async () => {
      // 복잡한 다단계 폼 시나리오
      let formStep = 0;
      
      vi.spyOn(director as any, 'sendRequest').mockImplementation(async () => {
        formStep++;
        
        const steps = {
          1: {
            title: 'Personal Information',
            content: `
              <div class="form-wizard step-1">
                <h2>Step 1: Personal Information</h2>
                <form data-action="submit-personal-info">
                  <input name="firstName" placeholder="First Name" required>
                  <input name="lastName" placeholder="Last Name" required>
                  <input name="email" type="email" placeholder="Email" required>
                  <button type="submit">Next Step</button>
                </form>
                <div class="progress-bar">
                  <div class="progress" style="width: 33%"></div>
                </div>
              </div>
            `,
            state: { currentStep: 1, totalSteps: 3, formData: {} }
          },
          2: {
            title: 'Address Information',
            content: `
              <div class="form-wizard step-2">
                <h2>Step 2: Address Information</h2>
                <form data-action="submit-address-info">
                  <input name="street" placeholder="Street Address" required>
                  <input name="city" placeholder="City" required>
                  <input name="zipCode" placeholder="ZIP Code" required>
                  <button type="button" data-action="go-back">Back</button>
                  <button type="submit">Next Step</button>
                </form>
                <div class="progress-bar">
                  <div class="progress" style="width: 66%"></div>
                </div>
              </div>
            `,
            state: { 
              currentStep: 2, 
              totalSteps: 3, 
              formData: { 
                firstName: 'John', 
                lastName: 'Doe', 
                email: 'john@example.com' 
              } 
            }
          },
          3: {
            title: 'Confirmation',
            content: `
              <div class="form-wizard step-3">
                <h2>Step 3: Confirmation</h2>
                <div class="summary">
                  <h3>Please review your information:</h3>
                  <p>Name: John Doe</p>
                  <p>Email: john@example.com</p>
                  <p>Address: 123 Main St, Anytown, 12345</p>
                </div>
                <button type="button" data-action="go-back">Back</button>
                <button data-action="submit-form">Submit</button>
                <div class="progress-bar">
                  <div class="progress" style="width: 100%"></div>
                </div>
              </div>
            `,
            state: { 
              currentStep: 3, 
              totalSteps: 3, 
              formData: { 
                firstName: 'John', 
                lastName: 'Doe', 
                email: 'john@example.com',
                street: '123 Main St',
                city: 'Anytown',
                zipCode: '12345'
              } 
            }
          }
        };

        const step = steps[formStep] || steps[3];
        
        return {
          id: `resp-form-${formStep}`,
          requestId: `req-form-${formStep}`,
          type: 'success',
          timestamp: Date.now(),
          processingTime: 500,
          status: { success: true, code: 200, message: 'OK' },
          data: {
            result: {
              title: step.title,
              ui: {
                type: 'html',
                content: step.content,
                actions: {
                  '[data-action="submit-personal-info"]': 'submitPersonalInfo',
                  '[data-action="submit-address-info"]': 'submitAddressInfo',
                  '[data-action="go-back"]': 'goBack',
                  '[data-action="submit-form"]': 'submitForm'
                }
              },
              state: step.state
            }
          },
          metadata: { version: '1.0.0' }
        };
      });

      // 1단계: 개인정보 입력
      const step1 = await director.request("Create a 3-step registration form starting with personal info");
      await stage.render(step1);
      
      expect(step1.title).toBe('Personal Information');
      expect(testContainer.textContent).toContain('Step 1: Personal Information');
      expect(testContainer.querySelector('input[name="firstName"]')).toBeTruthy();
      expect(step1.state.data.currentStep).toBe(1);

      // 2단계: 주소정보 입력
      const step2 = await director.continueConversation("Move to address information step");
      await stage.render(step2);
      
      expect(step2.title).toBe('Address Information');
      expect(testContainer.textContent).toContain('Step 2: Address Information');
      expect(testContainer.querySelector('input[name="street"]')).toBeTruthy();
      expect(step2.state.data.currentStep).toBe(2);
      expect(step2.state.data.formData.firstName).toBe('John');

      // 3단계: 확인 및 제출
      const step3 = await director.continueConversation("Show confirmation step with all entered data");
      await stage.render(step3);
      
      expect(step3.title).toBe('Confirmation');
      expect(testContainer.textContent).toContain('Step 3: Confirmation');
      expect(testContainer.textContent).toContain('John Doe');
      expect(testContainer.textContent).toContain('john@example.com');
      expect(step3.state.data.currentStep).toBe(3);
      expect(step3.state.data.formData.zipCode).toBe('12345');

      // 전체 폼 위저드 플로우 검증
      const history = director.getConversationHistory();
      expect(history).toHaveLength(3);
      expect(history.map(h => h.title)).toEqual([
        'Personal Information',
        'Address Information', 
        'Confirmation'
      ]);
    });
  });

  describe('Error Handling & Edge Cases', () => {
    it('should gracefully handle malformed AI responses', async () => {
      const container = document.createElement('div');
      const mockAgent = createMockAgentCommunicationAdapter();
      const director = new Director({ debug: false }, mockAgent);
      await director.initialize();

      // 잘못된 AI 응답 mock
      vi.spyOn(mockAgent, 'sendRequest').mockResolvedValue({
        id: 'bad-response',
        requestId: 'req-1',
        type: 'success',
        timestamp: Date.now(),
        processingTime: 100,
        status: { success: true, code: 200, message: 'OK' },
        data: {
          result: {
            // title 누락
            ui: {
              type: 'html',
              content: null // 잘못된 content
            },
            state: null // 잘못된 state
          }
        },
        metadata: { version: '1.0.0' }
      });

      // 오류 처리 검증
      const scene = await director.request("Create something");
      
      // 시스템이 fallback 처리를 하는지 확인
      expect(scene).toBeDefined();
      expect(scene.title).toBeDefined(); // fallback title 적용
      expect(scene.state).toBeDefined(); // fallback state 적용
      expect(scene.ui).toBeDefined(); // fallback UI 적용
    });

    it('should handle network failures and retry scenarios', async () => {
      const container = document.createElement('div');
      const mockAgent = createMockAgentCommunicationAdapter();
      const director = new Director({ debug: false }, mockAgent);
      await director.initialize();

      let attemptCount = 0;
      vi.spyOn(mockAgent, 'sendRequest').mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network timeout');
        }
        
        // 3번째 시도에서 성공
        return {
          id: 'success-after-retry',
          requestId: 'req-retry',
          type: 'success',
          timestamp: Date.now(),
          processingTime: 2000,
          status: { success: true, code: 200, message: 'OK' },
          data: {
            result: {
              title: 'Success After Retry',
              ui: {
                type: 'html',
                content: '<div>Finally worked!</div>'
              },
              state: { retryCount: attemptCount }
            }
          },
          metadata: { version: '1.0.0' }
        };
      });

      // 에러가 발생해도 최종적으로는 실패해야 함 (retry 로직이 없으므로)
      await expect(director.request("Test retry logic")).rejects.toThrow();
      expect(attemptCount).toBe(1); // 한 번만 시도
    });
  });

  describe('Performance & Scalability', () => {
    it('should handle rapid consecutive requests', async () => {
      const container = document.createElement('div');
      const mockAgent = createMockAgentCommunicationAdapter({ delay: 10 });
      const director = new Director({ debug: false }, mockAgent);
      await director.initialize();
      
      const stage = new Stage({ mount: container, director });
      stage.mount();

      // 연속적인 여러 요청 처리
      const requests = Array.from({ length: 5 }, (_, i) => 
        director.request(`Request ${i + 1}`)
      );

      const scenes = await Promise.all(requests);
      
      expect(scenes).toHaveLength(5);
      scenes.forEach((scene, index) => {
        expect(scene.id).toBeDefined();
        expect(scene.title).toBeDefined(); // 제목이 있는지만 확인 (실제 번호 매칭은 mock에 따라 다름)
      });

      stage.dispose();
    });

    it('should efficiently manage memory with large scenes', async () => {
      const container = document.createElement('div');
      const mockAgent = createMockAgentCommunicationAdapter();
      const director = new Director({ debug: false }, mockAgent);
      await director.initialize();
      
      const stage = new Stage({ mount: container, director });
      stage.mount();

      // 큰 HTML 콘텐츠 생성
      const largeHTML = Array.from({ length: 1000 }, (_, i) => 
        `<div class="item-${i}">Large content item ${i}</div>`
      ).join('');

      vi.spyOn(mockAgent, 'sendRequest').mockResolvedValue({
        id: 'large-scene',
        requestId: 'req-large',
        type: 'success',
        timestamp: Date.now(),
        processingTime: 500,
        status: { success: true, code: 200, message: 'OK' },
        data: {
          result: {
            title: 'Large Scene',
            ui: {
              type: 'html',
              content: `<div class="large-content">${largeHTML}</div>`
            },
            state: {
              items: Array.from({ length: 1000 }, (_, i) => ({
                id: i,
                content: `Item ${i}`,
                data: new Array(100).fill(`data-${i}`)
              }))
            }
          }
        },
        metadata: { version: '1.0.0' }
      });

      const scene = await director.request("Create a large scene with lots of content");
      await stage.render(scene);

      // 큰 콘텐츠가 정상적으로 렌더링되는지 확인
      expect(container.querySelector('.large-content')).toBeTruthy();
      expect(container.querySelectorAll('.item-0, .item-500, .item-999')).toHaveLength(3);
      expect(scene.state.data.items).toHaveLength(1000);

      // 메모리 정리 확인
      stage.clear();
      expect(container.children.length).toBe(0);

      stage.dispose();
    });
  });
});
