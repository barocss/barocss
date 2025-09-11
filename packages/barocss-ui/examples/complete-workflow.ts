import { UIRuntime, AIService, AIContext, AIResponse } from '../src/index';

// 1. Mock AI Service Implementation
class MockAIService implements AIService {
  private conversationCount = 0;

  async generateResponse(input: string, context: AIContext): Promise<AIResponse> {
    this.conversationCount++;
    console.log(`\n🤖 AI Service - Conversation #${this.conversationCount}`);
    console.log('📥 Input:', input);
    console.log('📊 Context:', {
      windowsCount: context.currentState.windows.length,
      deviceType: context.environment.deviceType,
      availableSpace: context.environment.availableSpace,
      guidelines: context.guidelines,
      entities: Object.keys(context.entities),
      historyLength: context.history.length
    });

    // Simulate AI processing based on input and context
    return this.generateAIResponse(input, context);
  }

  private generateAIResponse(input: string, context: AIContext): AIResponse {
    const lowerInput = input.toLowerCase();

    // Step 1: Login Form Request
    if (lowerInput.includes('로그인') || lowerInput.includes('login')) {
      return {
        html: `
          <div class="barocss-modal-frame custom-positioned" 
               data-positioning-strategy="center"
               data-z-index="9999"
               data-window-data='{"theme": "dark", "priority": "high"}'>
            
            <div class="modal-backdrop fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div class="modal-container bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full mx-4">
                
                <!-- Header -->
                <div class="modal-header flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 class="text-xl font-semibold text-gray-900 dark:text-white">로그인</h3>
                  <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" data-action="close">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                </div>
                
                <!-- Content -->
                <div class="modal-content p-6">
                  <form class="space-y-4" data-action="submit">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        이메일
                      </label>
                      <input type="email" name="email" required
                             class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                             placeholder="이메일을 입력하세요">
                    </div>
                    
                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        비밀번호
                      </label>
                      <input type="password" name="password" required
                             class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                             placeholder="비밀번호를 입력하세요">
                    </div>
                    
                    <button type="submit" 
                            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors">
                      로그인
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        `,
        display: {
          type: 'modal',
          size: 'medium',
          position: 'center',
          priority: 'high',
          backdrop: 'blur'
        },
        context: {
          id: `login-form-${Date.now()}`,
          parent: null,
          purpose: 'user_authentication',
          workflow: 'user_onboarding'
        },
        interactions: {
          'submit': {
            action: 'validate_and_submit',
            dataExtraction: { 
              email: 'input[name="email"]', 
              password: 'input[name="password"]' 
            },
            nextPrompt: '사용자 정보를 확인하고 다음 단계로 진행해주세요'
          },
          'close': {
            action: 'close_modal',
            nextPrompt: '로그인을 취소하고 처음으로 돌아가세요'
          }
        },
        effects: {
          entrance: 'fadeIn',
          duration: 300
        },
        workflow: {
          currentStep: 'login_form',
          nextSteps: ['validation', 'dashboard_redirect'],
          completionCriteria: ['email', 'password'],
          dataCollection: {}
        }
      };
    }

    // Step 2: Form Submission Processing
    if (lowerInput.includes('사용자 정보를 확인') || lowerInput.includes('form submitted')) {
      const formData = context.entities.form_data as Record<string, unknown> || {};
      const email = formData.email as string || '';
      const password = formData.password as string || '';

      // Simple validation
      if (!email || !password) {
        return {
          html: `
            <div class="barocss-overlay custom-positioned" 
                 data-positioning-strategy="center"
                 data-z-index="9998">
              <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                <strong>오류:</strong> 이메일과 비밀번호를 모두 입력해주세요.
                <button class="ml-2 text-red-500 hover:text-red-700" data-action="retry">
                  다시 시도
                </button>
              </div>
            </div>
          `,
          display: { type: 'overlay', size: 'small', position: 'center' },
          context: { id: `error-${Date.now()}`, parent: null, purpose: 'error_display' },
          interactions: {
            'retry': {
              action: 'retry_login',
              nextPrompt: '로그인 폼을 다시 표시해주세요'
            }
          }
        };
      }

      // Success case
      return {
        html: `
          <div class="barocss-window-frame custom-positioned" 
               data-positioning-strategy="center"
               data-z-index="9999"
               data-window-data='{"user": "${email}", "status": "authenticated"}'>
            
            <div class="window-titlebar bg-green-50 border-b border-green-200 p-4">
              <h3 class="text-lg font-semibold text-green-800">로그인 성공!</h3>
            </div>
            
            <div class="window-content p-6">
              <div class="text-center space-y-4">
                <div class="text-green-600">
                  <svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <p class="text-xl font-medium">환영합니다, ${email}님!</p>
                </div>
                
                <div class="space-y-2">
                  <button class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md" data-action="dashboard">
                    대시보드로 이동
                  </button>
                  <button class="w-full bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-md" data-action="profile">
                    프로필 설정
                  </button>
                </div>
              </div>
            </div>
          </div>
        `,
        display: { type: 'window', size: 'medium', position: 'center' },
        context: { 
          id: `success-${Date.now()}`, 
          parent: null, 
          purpose: 'login_success',
          workflow: 'user_onboarding'
        },
        interactions: {
          'dashboard': {
            action: 'navigate_dashboard',
            nextPrompt: '사용자 대시보드를 생성해주세요'
          },
          'profile': {
            action: 'navigate_profile',
            nextPrompt: '프로필 설정 페이지를 생성해주세요'
          }
        },
        effects: {
          entrance: 'slideInFromTop',
          duration: 500
        }
      };
    }

    // Step 3: Dashboard Creation
    if (lowerInput.includes('대시보드') || lowerInput.includes('dashboard')) {
      const userEmail = this.extractUserEmail(context);
      
      return {
        html: `
          <div class="barocss-window-frame custom-positioned" 
               data-positioning-strategy="smart"
               data-z-index="9999"
               data-window-data='{"type": "dashboard", "user": "${userEmail}"}'>
            
            <div class="window-titlebar bg-blue-50 border-b border-blue-200 p-4">
              <h3 class="text-lg font-semibold text-blue-800">대시보드</h3>
              <div class="text-sm text-blue-600">${userEmail}</div>
            </div>
            
            <div class="window-content p-6">
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <!-- Stats Cards -->
                <div class="bg-white rounded-lg shadow p-4 border">
                  <h4 class="font-semibold text-gray-800 mb-2">총 프로젝트</h4>
                  <p class="text-3xl font-bold text-blue-600">12</p>
                </div>
                
                <div class="bg-white rounded-lg shadow p-4 border">
                  <h4 class="font-semibold text-gray-800 mb-2">완료된 작업</h4>
                  <p class="text-3xl font-bold text-green-600">8</p>
                </div>
                
                <div class="bg-white rounded-lg shadow p-4 border">
                  <h4 class="font-semibold text-gray-800 mb-2">진행 중</h4>
                  <p class="text-3xl font-bold text-yellow-600">4</p>
                </div>
              </div>
              
              <div class="mt-6 space-y-2">
                <button class="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md" data-action="new_project">
                  새 프로젝트 생성
                </button>
                <button class="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-md" data-action="view_reports">
                  보고서 보기
                </button>
              </div>
            </div>
          </div>
        `,
        display: { type: 'window', size: 'large', position: 'smart' },
        context: { 
          id: `dashboard-${Date.now()}`, 
          parent: null, 
          purpose: 'main_dashboard',
          workflow: 'user_onboarding'
        },
        interactions: {
          'new_project': {
            action: 'create_project',
            nextPrompt: '새 프로젝트 생성 폼을 만들어주세요'
          },
          'view_reports': {
            action: 'view_reports',
            nextPrompt: '보고서 페이지를 생성해주세요'
          }
        },
        effects: {
          entrance: 'zoomIn',
          duration: 400
        }
      };
    }

    // Default fallback
    return {
      html: `<div class="p-4 bg-gray-100 rounded">알 수 없는 요청입니다: ${input}</div>`,
      display: { type: 'inline', size: 'small', position: 'center' },
      context: { id: `fallback-${Date.now()}`, parent: null, purpose: 'fallback' }
    };
  }

  private extractUserEmail(context: AIContext): string {
    const formData = context.entities.form_data as Record<string, unknown> || {};
    return (formData.email as string) || 'user@example.com';
  }
}

// 2. Complete Workflow Example
async function runCompleteWorkflow() {
  console.log('🚀 Starting Complete UI Runtime Workflow\n');

  // Initialize UIRuntime
  const uiRuntime = new UIRuntime({
    ai: new MockAIService(),
    logLevel: 'debug',
    onBeforeRender: (response) => {
      console.log('🎨 Before Render:', {
        displayType: response.display.type,
        contextId: response.context.id,
        hasInteractions: !!response.interactions
      });
    },
    onAfterRender: (window) => {
      console.log('✅ After Render:', {
        windowId: window.id,
        windowType: window.type,
        state: window.state
      });
    },
    onError: (error) => {
      console.error('❌ Error:', error.message);
    }
  });

  console.log('📋 Step 1: Initial Login Request');
  console.log('=' .repeat(50));
  
  // Step 1: User requests login form
  const step1Result = await uiRuntime.processUserInput('로그인 폼을 만들어주세요');
  console.log('Step 1 Result:', {
    success: step1Result.success,
    windowId: step1Result.window?.id,
    elementId: step1Result.element?.id
  });

  // Simulate user filling form and submitting
  console.log('\n📋 Step 2: Simulating Form Submission');
  console.log('=' .repeat(50));
  
  // Simulate form data extraction and next prompt
  const step2Result = await uiRuntime.processUserInput('사용자 정보를 확인하고 다음 단계로 진행해주세요');
  console.log('Step 2 Result:', {
    success: step2Result.success,
    windowId: step2Result.window?.id
  });

  // Simulate user clicking dashboard button
  console.log('\n📋 Step 3: Dashboard Request');
  console.log('=' .repeat(50));
  
  const step3Result = await uiRuntime.processUserInput('사용자 대시보드를 생성해주세요');
  console.log('Step 3 Result:', {
    success: step3Result.success,
    windowId: step3Result.window?.id
  });

  // Show final state
  console.log('\n📊 Final State');
  console.log('=' .repeat(50));
  
  const activeWindows = uiRuntime.windows.getActiveWindows();
  const stats = uiRuntime.windows.getStats();
  
  console.log('Active Windows:', activeWindows.map(w => ({
    id: w.id,
    type: w.type,
    state: w.state,
    createdAt: new Date(w.createdAt).toLocaleTimeString()
  })));
  
  console.log('Runtime Stats:', stats);
  
  console.log('\n🎉 Workflow Complete!');
}

// 3. Context Accumulation Example
async function demonstrateContextAccumulation() {
  console.log('\n🔄 Context Accumulation Demo');
  console.log('=' .repeat(50));

  const uiRuntime = new UIRuntime({
    ai: new MockAIService(),
    logLevel: 'info'
  });

  // Show how context builds up over time
  const context1 = uiRuntime.context.buildAIContext('첫 번째 요청', [], null);
  console.log('Initial Context Entities:', Object.keys(context1.entities));

  await uiRuntime.processUserInput('로그인 폼을 만들어주세요');
  
  const context2 = uiRuntime.context.buildAIContext('두 번째 요청', uiRuntime.windows.getActiveWindows(), null);
  console.log('After Login Form - Context Entities:', Object.keys(context2.entities));

  // Simulate form submission
  uiRuntime.context.setCustomContext('form_data', { email: 'user@test.com', password: '123456' });
  
  const context3 = uiRuntime.context.buildAIContext('세 번째 요청', uiRuntime.windows.getActiveWindows(), null);
  console.log('After Form Data - Context Entities:', Object.keys(context3.entities));
  console.log('Form Data in Context:', context3.entities.form_data);
}

// 4. Run Examples
if (typeof window !== 'undefined') {
  // Browser environment
  (window as any).runCompleteWorkflow = runCompleteWorkflow;
  (window as any).demonstrateContextAccumulation = demonstrateContextAccumulation;
  
  console.log('🌐 Browser environment detected');
  console.log('Run: runCompleteWorkflow() or demonstrateContextAccumulation()');
} else {
  // Node.js environment
  runCompleteWorkflow()
    .then(() => demonstrateContextAccumulation())
    .catch(console.error);
}

export { runCompleteWorkflow, demonstrateContextAccumulation, MockAIService };
