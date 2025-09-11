# BaroCSS UI Runtime Examples

이 디렉토리는 BaroCSS UI Runtime의 사용법을 보여주는 예제들을 포함합니다.

## 파일 구조

- `complete-workflow.ts` - TypeScript로 작성된 완전한 워크플로우 예제
- `demo.html` - 브라우저에서 실행할 수 있는 인터랙티브 데모
- `README.md` - 이 파일

## 실행 방법

### 1. TypeScript 예제 실행

```bash
# Node.js 환경에서 실행
npx tsx examples/complete-workflow.ts

# 또는 컴파일 후 실행
npx tsc examples/complete-workflow.ts --target es2020 --module esnext --moduleResolution node
node examples/complete-workflow.js
```

### 2. 브라우저 데모 실행

```bash
# 간단한 HTTP 서버 실행
npx serve examples/
# 또는
python -m http.server 8000 --directory examples/

# 브라우저에서 http://localhost:8000/demo.html 접속
```

## 예제 시나리오

### 1단계: 로그인 폼 생성
```typescript
const result = await uiRuntime.processUserInput('로그인 폼을 만들어주세요');
```

**AI가 받는 Context:**
```typescript
{
  currentState: { windows: [], focused: null, workflow: {...} },
  environment: { 
    screenSize: { width: 1920, height: 1080 },
    deviceType: 'desktop',
    theme: 'light'
  },
  guidelines: {
    preferredDisplayType: 'modal',
    maxWindowSize: 'large',
    positioningStrategy: 'center'
  },
  resources: {
    availableEffects: ['fadeIn', 'slideInFromTop', 'zoomIn'],
    registeredHandlers: ['window', 'modal', 'overlay', 'inline', 'embedded']
  },
  entities: {},
  history: [],
  intentions: ['로그인 폼을 만들어주세요']
}
```

**AI가 생성하는 응답:**
```typescript
{
  html: `<div class="barocss-modal-frame">...</div>`,
  display: { type: 'modal', size: 'medium', position: 'center' },
  context: { id: 'login-form-123', purpose: 'user_authentication' },
  interactions: {
    'submit': {
      action: 'validate_and_submit',
      dataExtraction: { email: 'input[name="email"]', password: 'input[name="password"]' },
      nextPrompt: '사용자 정보를 확인하고 다음 단계로 진행해주세요'
    }
  },
  effects: { entrance: 'fadeIn', duration: 300 }
}
```

### 2단계: 폼 제출 처리
```typescript
// 사용자가 폼을 제출하면 자동으로 실행됨
// 1. 폼 데이터 추출: { email: 'user@example.com', password: '123456' }
// 2. 컨텍스트에 저장: context.setCustomContext('form_data', formData)
// 3. 다음 프롬프트 실행: '사용자 정보를 확인하고 다음 단계로 진행해주세요'
```

**누적된 Context:**
```typescript
{
  // ... 이전 context 유지
  entities: {
    form_data: { email: 'user@example.com', password: '123456' }
  },
  history: [
    {
      userInput: '로그인 폼을 만들어주세요',
      aiResponse: { /* 이전 응답 */ },
      windowsCreated: ['login-form-123']
    }
  ]
}
```

### 3단계: 대시보드 생성
```typescript
const result = await uiRuntime.processUserInput('사용자 대시보드를 생성해주세요');
```

**AI가 받는 Context (누적됨):**
```typescript
{
  // ... 이전 모든 context 유지
  entities: {
    form_data: { email: 'user@example.com', password: '123456' },
    interaction_submit: { /* 제출 시점 데이터 */ }
  },
  history: [
    // ... 이전 대화들
  ]
}
```

## 핵심 특징

### 1. 컨텍스트 누적
- 각 단계에서 수집된 데이터가 다음 단계로 전달됨
- `context.setCustomContext()`로 데이터 저장
- `context.entities`에서 모든 누적 데이터 접근

### 2. 자동 인터랙션 처리
- `data-action` 속성으로 이벤트 캐치
- 폼 제출 시 자동 데이터 추출
- `nextPrompt`로 다음 단계 자동 진행

### 3. 워크플로우 관리
- `workflow.nextSteps`로 다음 단계 정의
- `workflow.completionCriteria`로 완료 조건 설정
- 단계별 진행 상태 추적

### 4. 반응형 UI 생성
- 화면 크기와 디바이스 타입에 맞는 UI 생성
- 사용 가능한 공간을 고려한 레이아웃
- 테마와 스타일 선호도 반영

## 실제 사용 예시

```typescript
import { UIRuntime } from '@barocss/ui';

// 1. UIRuntime 초기화
const uiRuntime = new UIRuntime({
  ai: new YourAIService(),
  logLevel: 'debug',
  onBeforeRender: (response) => console.log('Before render:', response),
  onAfterRender: (window) => console.log('After render:', window),
  onError: (error) => console.error('Error:', error)
});

// 2. 사용자 입력 처리
const result = await uiRuntime.processUserInput('로그인 폼을 만들어주세요');

// 3. 결과 확인
if (result.success) {
  console.log('UI 생성 완료:', result.window.id);
} else {
  console.error('UI 생성 실패:', result.error);
}

// 4. 활성 윈도우 확인
const activeWindows = uiRuntime.windows.getActiveWindows();
console.log('활성 윈도우:', activeWindows.length);
```

이 예제들을 통해 BaroCSS UI Runtime의 강력한 기능들을 체험해보세요!
