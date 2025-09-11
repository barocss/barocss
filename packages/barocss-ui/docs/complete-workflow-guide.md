# BaroCSS UI Runtime 완전 운영 가이드

이 문서는 BaroCSS UI Runtime의 전체 데이터 흐름과 동작 과정을 단계별로 설명합니다.

## 📋 목차

1. [시스템 개요](#시스템-개요)
2. [초기화 과정](#초기화-과정)
3. [1단계: 로그인 폼 생성](#1단계-로그인-폼-생성)
4. [2단계: 폼 제출 처리](#2단계-폼-제출-처리)
5. [3단계: 대시보드 생성](#3단계-대시보드-생성)
6. [컨텍스트 누적 과정](#컨텍스트-누적-과정)
7. [실제 코드 예시](#실제-코드-예시)

---

## 시스템 개요

BaroCSS UI Runtime은 사용자의 자연어 입력을 받아서 AI가 생성한 UI를 렌더링하고, 사용자의 상호작용을 처리하여 다음 단계로 진행하는 대화형 시스템입니다.

### 핵심 구성요소

- **UIRuntime**: 전체 시스템의 오케스트레이터
- **ContextManager**: 대화 컨텍스트와 데이터 누적 관리
- **WindowStackManager**: 윈도우 생성, 포지셔닝, z-index 관리
- **DOMManager**: HTML 파싱, DOM 생성, 효과 적용
- **AIService**: 사용자 입력을 UI로 변환하는 AI 서비스

---

## 초기화 과정

### 1. UIRuntime 생성

```typescript
const uiRuntime = new UIRuntime({
  ai: new MockAIService(),
  logLevel: 'debug',
  onBeforeRender: (response) => console.log('Before render:', response),
  onAfterRender: (window) => console.log('After render:', window),
  onError: (error) => console.error('Error:', error)
});
```

### 2. 내부 매니저 초기화

```typescript
// UIRuntime 내부에서 자동으로 생성
this.dom = new DOMManager();
this.windows = new WindowStackManager(options.layoutPolicy);
this.context = new ContextManager();
this.logger = new LogManager({ level: 'debug', prefix: '[UIRuntime]' });
this.validator = new ValidationManager({ maxHtmlSize: 50000, strictMode: false });
```

---

## 1단계: 로그인 폼 생성

### 사용자 입력

```typescript
const result = await uiRuntime.processUserInput('로그인 폼을 만들어주세요');
```

### 1-1. Context 생성

**ContextManager.buildAIContext()**가 호출되어 AI에게 전달할 풍부한 컨텍스트를 생성합니다.

```typescript
const aiContext = {
  // 현재 UI 상태
  currentState: {
    windows: [],                    // 활성 윈도우 목록 (빈 배열)
    focused: null,                  // 포커스된 윈도우 ID
    workflow: {                     // 워크플로우 상태
      currentStage: 'initial',
      mainTask: '',
      subTasks: [],
      progress: 0,
      activeWindows: [],
      dataEntities: new Map()
    }
  },
  
  // 환경 정보
  environment: {
    screenSize: { width: 1920, height: 1080 },
    availableSpace: { x: 0, y: 0, width: 1920, height: 1080 },
    theme: 'light',                 // 시스템 테마 감지
    deviceType: 'desktop'           // 화면 크기 기반 디바이스 타입
  },
  
  // UI 생성 가이드라인
  guidelines: {
    preferredDisplayType: 'modal',  // 사용자 입력 분석 결과
    maxWindowSize: 'large',         // 디바이스 타입 기반
    positioningStrategy: 'center',  // 디바이스 타입 기반
    stylePreferences: {
      colorScheme: 'blue',          // 기본값 또는 사용자 설정
      animationStyle: 'subtle',     // 기본값 또는 사용자 설정
      layoutDensity: 'comfortable'  // 기본값 또는 사용자 설정
    }
  },
  
  // 사용 가능한 리소스
  resources: {
    availableEffects: ['fadeIn', 'slideInFromTop', 'scaleIn', 'bounceIn'],
    customPositioningStrategies: [],
    registeredHandlers: ['window', 'modal', 'overlay', 'inline', 'embedded']
  },
  
  // 대화 히스토리
  history: [],                      // 첫 요청이므로 빈 배열
  
  // 사용자 데이터
  entities: {},                     // 아직 수집된 데이터 없음
  
  // 의도 분석
  intentions: ['로그인 폼을 만들어주세요']
};
```

### 1-2. AI 서비스 호출

```typescript
const rawResponse = await this.ai.generateResponse(input, aiContext);
```

**AI가 받는 데이터:**
- 사용자 입력: `"로그인 폼을 만들어주세요"`
- 풍부한 컨텍스트: 위의 `aiContext` 객체

### 1-3. AI 응답 생성

AI가 컨텍스트를 분석하여 최적의 UI를 생성합니다.

```typescript
const aiResponse = {
  // 생성된 HTML (완전한 UI 구조)
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
  
  // 디스플레이 설정
  display: {
    type: 'modal',           // AI가 컨텍스트를 보고 선택
    size: 'medium',          // availableSpace를 고려
    position: 'center',      // guidelines.positioningStrategy 사용
    priority: 'high',        // 사용자 입력의 중요도
    backdrop: 'blur'         // modal이므로 backdrop 추가
  },
  
  // 컨텍스트 정보
  context: {
    id: 'login-form-1703123456789',
    parent: null,            // 독립적인 모달
    purpose: 'user_authentication',
    workflow: 'user_onboarding'
  },
  
  // 인터랙션 정의
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
  
  // 애니메이션 효과
  effects: {
    entrance: 'fadeIn',      // resources.availableEffects에서 선택
    duration: 300,           // guidelines.stylePreferences.animationStyle에 따라 조정
    easing: 'ease-out'
  },
  
  // 워크플로우 정의
  workflow: {
    currentStep: 'login_form',
    nextSteps: ['validation', 'dashboard_redirect'],
    completionCriteria: ['email', 'password'],
    dataCollection: {}
  }
};
```

### 1-4. 응답 검증 및 정규화

```typescript
// ValidationManager가 응답 검증
const validationResult = this.validator.validateAIResponse(aiResponse);
// - HTML 유효성 검사
// - 필수 필드 존재 여부 확인
// - XSS 보안 검사

// 누락된 필드들을 기본값으로 채움
const normalizedResponse = this.normalizeAIResponse(rawResponse);
```

### 1-5. DOM 생성

```typescript
// DOMManager가 HTML을 파싱하여 DOM 요소 생성
const domResult = await this.dom.process(aiResponse);

// 1. HTML 파싱
const container = document.createElement('div');
container.innerHTML = aiResponse.html;
const element = container.firstElementChild as HTMLElement;

// 2. 디스플레이 속성 적용
element.setAttribute('data-display-type', 'modal');
element.setAttribute('data-context-id', 'login-form-1703123456789');

// 3. 포지셔닝 적용
if (aiResponse.display.type === 'modal') {
  element.style.position = 'fixed';
  element.style.zIndex = '9999';
}

// 4. 애니메이션 효과 적용
this.effectManager.applyEffect(element, 'fadeIn', { duration: 300 });
```

### 1-6. 윈도우 생성 및 등록

```typescript
// WindowStackManager가 윈도우 인스턴스 생성
const windowInstance = this.windows.createWindow(
  element,
  {
    type: 'modal',
    size: 'medium',
    draggable: true,
    resizable: true,
    modal: true
  },
  'center',  // aiResponse.display.position
  null       // aiResponse.context.parent
);

// 내부적으로:
// 1. 고유 ID 생성: 'window-1703123456789-abc123'
// 2. 포지셔닝 적용: center 전략 사용
// 3. z-index 계산: 9999 + layerOffset
// 4. DOM에 삽입: document.body.appendChild(element)
// 5. 포커스 설정: focusWindow(id)
// 6. 이벤트 발생: 'window:created'
```

### 1-7. 인터랙션 핸들러 설정

```typescript
// UIRuntime이 인터랙션 핸들러 설정
this.setupInteractionHandlers(element, aiResponse);

// 1. data-action 속성을 가진 요소들 찾기
const submitElements = element.querySelectorAll('[data-action="submit"]');
const closeElements = element.querySelectorAll('[data-action="close"]');

// 2. 이벤트 리스너 등록
submitElements.forEach(el => {
  el.addEventListener('click', async (event) => {
    event.preventDefault();
    await this.handleInteraction('submit', handler, element, aiResponse);
  });
});

// 3. 폼 제출 핸들러 등록
const forms = element.querySelectorAll('form');
forms.forEach(form => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await this.handleFormSubmission(form, aiResponse);
  });
});
```

### 1-8. 대화 히스토리 저장

```typescript
// ContextManager에 대화 기록 저장
this.context.addConversation({
  id: '1703123456789',
  timestamp: 1703123456789,
  userInput: '로그인 폼을 만들어주세요',
  aiResponse: aiResponse,
  context: this.context.captureSnapshot(activeWindows, focusedId),
  windowsCreated: ['window-1703123456789-abc123'],
  windowsClosed: []
});
```

---

## 2단계: 폼 제출 처리

### 2-1. 사용자 상호작용

사용자가 로그인 폼을 작성하고 제출 버튼을 클릭합니다.

### 2-2. 자동 이벤트 처리

```typescript
// UIRuntime.handleFormSubmission() 자동 실행
async handleFormSubmission(form: HTMLFormElement, aiResponse: AIResponse) {
  // 1. 폼 데이터 추출
  const formData = new FormData(form);
  const formObject = {};
  formData.forEach((value, key) => {
    formObject[key] = value;
  });
  // 결과: { email: 'user@example.com', password: '123456' }

  // 2. 컨텍스트에 데이터 저장
  this.context.setCustomContext('form_data', formObject);

  // 3. 다음 프롬프트 생성
  const nextPrompt = this.generateFormSubmissionPrompt(formObject, aiResponse);
  // 결과: 'Form submitted with fields: email, password. Process this data and continue the workflow.'

  // 4. 다음 단계 실행
  if (nextPrompt) {
    await this.processUserInput(nextPrompt);
  }
}
```

### 2-3. 컨텍스트 누적

**이제 ContextManager에 폼 데이터가 저장됩니다:**

```typescript
// ContextManager 내부 상태
this.customContextData = new Map([
  ['form_data', { email: 'user@example.com', password: '123456' }]
]);
```

### 2-4. 다음 단계 Context 생성

```typescript
const aiContext = {
  // ... 이전과 동일한 구조
  
  // 누적된 엔티티 데이터
  entities: {
    form_data: { email: 'user@example.com', password: '123456' }
  },
  
  // 누적된 히스토리
  history: [
    {
      id: '1703123456789',
      timestamp: 1703123456789,
      userInput: '로그인 폼을 만들어주세요',
      aiResponse: { /* 이전 응답 */ },
      windowsCreated: ['window-1703123456789-abc123'],
      windowsClosed: []
    }
  ],
  
  // 현재 활성 윈도우 상태
  currentState: {
    windows: [
      { id: 'window-1703123456789-abc123', type: 'modal', purpose: 'user_authentication' }
    ],
    focused: 'window-1703123456789-abc123',
    workflow: { /* 이전 워크플로우 상태 유지 */ }
  },
  
  // 새로운 의도
  intentions: ['Form submitted with fields: email, password. Process this data and continue the workflow.']
};
```

### 2-5. AI 응답 생성 (검증 및 성공 처리)

AI가 폼 데이터를 분석하여 다음 단계를 생성합니다.

```typescript
const aiResponse = {
  html: `
    <div class="barocss-window-frame custom-positioned" 
         data-positioning-strategy="center"
         data-z-index="9999"
         data-window-data='{"user": "user@example.com", "status": "authenticated"}'>
      
      <div class="window-titlebar bg-green-50 border-b border-green-200 p-4">
        <h3 class="text-lg font-semibold text-green-800">로그인 성공!</h3>
      </div>
      
      <div class="window-content p-6">
        <div class="text-center space-y-4">
          <div class="text-green-600">
            <svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            <p class="text-xl font-medium">환영합니다, user@example.com님!</p>
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
    id: 'success-1703123456790', 
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
```

---

## 3단계: 대시보드 생성

### 3-1. 사용자 상호작용

사용자가 "대시보드로 이동" 버튼을 클릭합니다.

### 3-2. 자동 이벤트 처리

```typescript
// UIRuntime.handleInteraction() 자동 실행
async handleInteraction(action: string, handler: InteractionHandler, element: HTMLElement, aiResponse: AIResponse) {
  // 1. 액션 로깅
  this.logger.debug('Handling interaction', { action, handler });

  // 2. 데이터 추출 (필요한 경우)
  const extractedData = this.extractInteractionData(element, handler.dataExtraction);

  // 3. 컨텍스트 업데이트
  if (extractedData && Object.keys(extractedData).length > 0) {
    this.context.setCustomContext(`interaction_${action}`, extractedData);
  }

  // 4. 다음 프롬프트 실행
  const nextPrompt = handler.nextPrompt || this.generateNextPrompt(action, aiResponse);
  // 결과: '사용자 대시보드를 생성해주세요'

  if (nextPrompt) {
    await this.processUserInput(nextPrompt);
  }
}
```

### 3-3. 최종 Context 생성

**이제 모든 이전 데이터가 누적된 상태:**

```typescript
const aiContext = {
  // ... 이전과 동일한 구조
  
  // 누적된 모든 엔티티 데이터
  entities: {
    form_data: { email: 'user@example.com', password: '123456' },
    interaction_dashboard: { /* 대시보드 버튼 클릭 시점 데이터 */ }
  },
  
  // 누적된 전체 히스토리
  history: [
    {
      id: '1703123456789',
      userInput: '로그인 폼을 만들어주세요',
      aiResponse: { /* 로그인 폼 응답 */ },
      windowsCreated: ['window-1703123456789-abc123'],
      windowsClosed: []
    },
    {
      id: '1703123456790',
      userInput: 'Form submitted with fields: email, password. Process this data and continue the workflow.',
      aiResponse: { /* 로그인 성공 응답 */ },
      windowsCreated: ['window-1703123456790-def456'],
      windowsClosed: []
    }
  ],
  
  // 현재 활성 윈도우들
  currentState: {
    windows: [
      { id: 'window-1703123456789-abc123', type: 'modal', purpose: 'user_authentication' },
      { id: 'window-1703123456790-def456', type: 'window', purpose: 'login_success' }
    ],
    focused: 'window-1703123456790-def456',
    workflow: { /* 업데이트된 워크플로우 상태 */ }
  },
  
  // 새로운 의도
  intentions: ['사용자 대시보드를 생성해주세요']
};
```

### 3-4. AI 응답 생성 (대시보드)

AI가 사용자 정보와 이전 컨텍스트를 활용하여 개인화된 대시보드를 생성합니다.

```typescript
const aiResponse = {
  html: `
    <div class="barocss-window-frame custom-positioned" 
         data-positioning-strategy="smart"
         data-z-index="9999"
         data-window-data='{"type": "dashboard", "user": "user@example.com"}'>
      
      <div class="window-titlebar bg-blue-50 border-b border-blue-200 p-4">
        <h3 class="text-lg font-semibold text-blue-800">대시보드</h3>
        <div class="text-sm text-blue-600">user@example.com</div>
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
    id: 'dashboard-1703123456791', 
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
```

---

## 컨텍스트 누적 과정

### 단계별 컨텍스트 변화

| 단계 | entities | history | currentState.windows |
|------|----------|---------|---------------------|
| 1단계 | `{}` | `[]` | `[]` |
| 2단계 | `{ form_data: {...} }` | `[첫번째 대화]` | `[로그인폼]` |
| 3단계 | `{ form_data: {...}, interaction_dashboard: {...} }` | `[첫번째, 두번째 대화]` | `[로그인폼, 성공메시지]` |

### 데이터 추출 과정

```typescript
// 1단계: 사용자 입력만
intentions: ['로그인 폼을 만들어주세요']

// 2단계: 폼 데이터 추가
entities: {
  form_data: { email: 'user@example.com', password: '123456' }
}
intentions: ['Form submitted with fields: email, password. Process this data and continue the workflow.']

// 3단계: 상호작용 데이터 추가
entities: {
  form_data: { email: 'user@example.com', password: '123456' },
  interaction_dashboard: { /* 대시보드 버튼 클릭 데이터 */ }
}
intentions: ['사용자 대시보드를 생성해주세요']
```

---

## 실제 코드 예시

### 완전한 실행 예시

```typescript
import { UIRuntime } from '@barocss/ui';

// 1. UIRuntime 초기화
const uiRuntime = new UIRuntime({
  ai: new YourAIService(),
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

// 2. 1단계: 로그인 폼 생성
console.log('📋 Step 1: Initial Login Request');
const step1Result = await uiRuntime.processUserInput('로그인 폼을 만들어주세요');
console.log('Step 1 Result:', {
  success: step1Result.success,
  windowId: step1Result.window?.id,
  elementId: step1Result.element?.id
});

// 3. 2단계: 폼 제출 시뮬레이션
console.log('📋 Step 2: Simulating Form Submission');
// 실제로는 사용자가 폼을 제출하면 자동으로 실행됨
const step2Result = await uiRuntime.processUserInput('사용자 정보를 확인하고 다음 단계로 진행해주세요');
console.log('Step 2 Result:', {
  success: step2Result.success,
  windowId: step2Result.window?.id
});

// 4. 3단계: 대시보드 생성
console.log('📋 Step 3: Dashboard Request');
const step3Result = await uiRuntime.processUserInput('사용자 대시보드를 생성해주세요');
console.log('Step 3 Result:', {
  success: step3Result.success,
  windowId: step3Result.window?.id
});

// 5. 최종 상태 확인
console.log('📊 Final State');
const activeWindows = uiRuntime.windows.getActiveWindows();
const stats = uiRuntime.windows.getStats();

console.log('Active Windows:', activeWindows.map(w => ({
  id: w.id,
  type: w.type,
  state: w.state,
  createdAt: new Date(w.createdAt).toLocaleTimeString()
})));

console.log('Runtime Stats:', stats);
console.log('🎉 Workflow Complete!');
```

### 실행 결과

```
🚀 Starting Complete UI Runtime Workflow

📋 Step 1: Initial Login Request
==================================================
🤖 AI Service - Conversation #1
📥 Input: 로그인 폼을 만들어주세요
📊 Context: {
  "windowsCount": 0,
  "deviceType": "desktop",
  "availableSpace": { "x": 0, "y": 0, "width": 1920, "height": 1080 },
  "guidelines": { "preferredDisplayType": "modal", "maxWindowSize": "large" },
  "entities": [],
  "historyLength": 0
}
🎨 Before Render: { "displayType": "modal", "contextId": "login-form-1703123456789", "hasInteractions": true }
✅ After Render: { "windowId": "window-1703123456789-abc123", "windowType": "modal", "state": "focused" }
Step 1 Result: { "success": true, "windowId": "window-1703123456789-abc123", "elementId": "login-form-1703123456789" }

📋 Step 2: Simulating Form Submission
==================================================
🤖 AI Service - Conversation #2
📥 Input: 사용자 정보를 확인하고 다음 단계로 진행해주세요
📊 Context: {
  "windowsCount": 1,
  "deviceType": "desktop",
  "availableSpace": { "x": 0, "y": 0, "width": 1620, "height": 880 },
  "guidelines": { "preferredDisplayType": "modal", "maxWindowSize": "large" },
  "entities": ["form_data"],
  "historyLength": 1
}
🎨 Before Render: { "displayType": "window", "contextId": "success-1703123456790", "hasInteractions": true }
✅ After Render: { "windowId": "window-1703123456790-def456", "windowType": "window", "state": "focused" }
Step 2 Result: { "success": true, "windowId": "window-1703123456790-def456" }

📋 Step 3: Dashboard Request
==================================================
🤖 AI Service - Conversation #3
📥 Input: 사용자 대시보드를 생성해주세요
📊 Context: {
  "windowsCount": 2,
  "deviceType": "desktop",
  "availableSpace": { "x": 0, "y": 0, "width": 1320, "height": 680 },
  "guidelines": { "preferredDisplayType": "modal", "maxWindowSize": "large" },
  "entities": ["form_data", "interaction_dashboard"],
  "historyLength": 2
}
🎨 Before Render: { "displayType": "window", "contextId": "dashboard-1703123456791", "hasInteractions": true }
✅ After Render: { "windowId": "window-1703123456791-ghi789", "windowType": "window", "state": "focused" }
Step 3 Result: { "success": true, "windowId": "window-1703123456791-ghi789" }

📊 Final State
==================================================
Active Windows: [
  { "id": "window-1703123456789-abc123", "type": "modal", "state": "focused", "createdAt": "14:30:56" },
  { "id": "window-1703123456790-def456", "type": "window", "state": "blurred", "createdAt": "14:30:57" },
  { "id": "window-1703123456791-ghi789", "type": "window", "state": "focused", "createdAt": "14:30:58" }
]
Runtime Stats: { "totalWindows": 3, "focusedWindowId": "window-1703123456791-ghi789" }

🎉 Workflow Complete!
```

---

## 핵심 특징 요약

### 1. **컨텍스트 누적**
- 모든 단계에서 수집된 데이터가 다음 단계로 전달
- `context.setCustomContext()`로 데이터 저장
- `context.entities`에서 모든 누적 데이터 접근

### 2. **자동 인터랙션 처리**
- `data-action` 속성으로 이벤트 캐치
- 폼 제출 시 자동 데이터 추출
- `nextPrompt`로 다음 단계 자동 진행

### 3. **워크플로우 관리**
- `workflow.nextSteps`로 다음 단계 정의
- `workflow.completionCriteria`로 완료 조건 설정
- 단계별 진행 상태 추적

### 4. **반응형 UI 생성**
- 화면 크기와 디바이스 타입에 맞는 UI 생성
- 사용 가능한 공간을 고려한 레이아웃
- 테마와 스타일 선호도 반영

### 5. **실시간 로깅**
- 모든 과정이 상세한 로그로 기록
- 디버깅과 모니터링 용이
- 성능 분석 가능

이 시스템을 통해 **한번 배포하면 영원히 자동화**되는 대화형 AI UI 시스템을 구축할 수 있습니다! 🚀
