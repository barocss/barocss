# BaroCSS UI Runtime - 기본 UI 패턴 가이드

이 문서는 BaroCSS UI Runtime에서 사용되는 기본 UI 패턴과 각 패턴의 특성을 설명합니다.

## 📋 목차

1. [UI 타입별 기본 패턴](#ui-타입별-기본-패턴)
2. [포지셔닝 전략](#포지셔닝-전략)
3. [Z-Index 레이어링](#z-index-레이어링)
4. [커스텀 포지셔닝](#커스텀-포지셔닝)
5. [모달 패턴](#모달-패턴)
6. [윈도우 패턴](#윈도우-패턴)
7. [오버레이 패턴](#오버레이-패턴)

---

## UI 타입별 기본 패턴

### 1. Modal (모달)
**특성**: 전체 화면을 덮는 대화상자
- **백드롭**: 반투명 배경으로 뒤의 콘텐츠를 차단
- **중앙 정렬**: 화면 중앙에 위치
- **전체 화면 덮기**: `100vw`, `100vh` 크기
- **Z-Index**: 가장 높은 우선순위 (modal layer)

```html
<div class="custom-positioned" data-component="modal-frame">
  <div data-component="modal-backdrop"></div>
  <div data-component="modal-container">
    <!-- 모달 내용 -->
  </div>
</div>
```

### 2. Window (윈도우)
**특성**: 독립적인 창으로 동작
- **드래그 가능**: 제목 표시줄을 통해 이동
- **크기 조절**: 리사이즈 가능
- **카스케이드**: 여러 윈도우가 겹치지 않게 배치
- **Z-Index**: 일반적인 우선순위 (floating layer)

```html
<div class="custom-positioned" data-component="window-frame">
  <div data-component="window-titlebar">
    <!-- 제목 표시줄 -->
  </div>
  <div data-component="window-content">
    <!-- 윈도우 내용 -->
  </div>
</div>
```

### 3. Overlay (오버레이)
**특성**: 기존 콘텐츠 위에 표시되는 요소
- **비침습적**: 기존 레이아웃을 방해하지 않음
- **스마트 포지셔닝**: 사용 가능한 공간에 자동 배치
- **낮은 Z-Index**: 콘텐츠 위에만 표시

```html
<div class="custom-positioned" data-component="overlay">
  <!-- 오버레이 내용 -->
</div>
```

---

## 포지셔닝 전략

### 1. Center (중앙 정렬)
```typescript
// 화면 중앙에 정확히 배치
element.style.position = 'fixed';
element.style.top = '50%';
element.style.left = '50%';
element.style.transform = 'translate(-50%, -50%)';
```

### 2. Cascade (카스케이드)
```typescript
// 이전 윈도우와 겹치지 않게 오프셋 적용
const offset = this.cascadeCounter * this.layoutPolicy.cascadeOffset;
element.style.position = 'fixed';
element.style.top = `${100 + offset}px`;
element.style.left = `${100 + offset}px`;
```

### 3. Beside Parent (부모 옆)
```typescript
// 부모 요소 옆에 배치
const parentRect = parentElement.getBoundingClientRect();
element.style.position = 'fixed';
element.style.top = `${parentRect.top}px`;
element.style.left = `${parentRect.right + 10}px`;
```

### 4. Overlay Parent (부모 위)
```typescript
// 부모 요소 위에 오버레이
const parentRect = parentElement.getBoundingClientRect();
element.style.position = 'fixed';
element.style.top = `${parentRect.top}px`;
element.style.left = `${parentRect.left}px`;
element.style.width = `${parentRect.width}px`;
element.style.height = `${parentRect.height}px`;
```

### 5. Smart (스마트)
```typescript
// 사용 가능한 공간을 분석하여 최적 위치 선택
// 1. 중앙 시도
// 2. 공간 부족시 다른 위치 시도
// 3. 가장 적합한 위치 선택
```

---

## Z-Index 레이어링

BaroCSS는 계층적 Z-Index 시스템을 사용합니다:

```typescript
const zIndexLayers = {
  base: 0,           // 기본 레이어
  layout: 100,       // 레이아웃 요소
  content: 200,      // 콘텐츠
  floating: 300,     // 플로팅 요소 (윈도우)
  modal: 400,        // 모달
  overlay: 500       // 오버레이
};

const zIndexBase = 1000;  // 기본 Z-Index 시작점
```

### Z-Index 계산 규칙
1. **기본 계산**: `zIndexBase + zIndexLayers[type] + (stackPosition * 10)`
2. **커스텀 Z-Index**: `data-z-index` 속성이 있으면 우선 사용
3. **레이어별 우선순위**: overlay > modal > floating > content > layout > base
4. **스택 내 순서**: 같은 타입 내에서는 나중에 생성된 것이 위에

### 실제 Z-Index 값 예시
- **기본 윈도우**: 1000 + 300 + 0 = 1300
- **모달**: 1000 + 400 + 0 = 1400  
- **오버레이**: 1000 + 500 + 0 = 1500
- **두 번째 윈도우**: 1000 + 300 + 10 = 1310

---

## 커스텀 포지셔닝

### 1. CSS 클래스 기반
```html
<div class="custom-positioned">
  <!-- CSS로 포지셔닝 처리 -->
</div>
```

### 2. Data 속성 기반
```html
<div data-positioning-strategy="center" data-z-index="9999">
  <!-- BaroCSS가 자동 처리 -->
</div>
```

### 3. 커스텀 전략 등록
```typescript
windowStackManager.registerCustomPositioningStrategy('my-strategy', (element, options) => {
  // 커스텀 포지셔닝 로직
  element.style.position = 'fixed';
  element.style.top = '100px';
  element.style.left = '100px';
});
```

---

## 모달 패턴

### 기본 구조
```html
<div class="custom-positioned" data-component="modal-frame">
  <!-- 백드롭: 전체 화면을 덮는 반투명 배경 -->
  <div data-component="modal-backdrop"></div>
  
  <!-- 컨테이너: 실제 모달 내용 -->
  <div data-component="modal-container">
    <!-- 헤더: 제목과 닫기 버튼 -->
    <div data-component="modal-header">
      <h3>제목</h3>
      <button data-action="close">×</button>
    </div>
    
    <!-- 내용: 모달의 주요 콘텐츠 -->
    <div data-component="modal-content">
      <!-- 폼, 메시지 등 -->
    </div>
  </div>
</div>
```

### 모달 특별 처리
- **전체 화면 덮기**: `100vw`, `100vh`
- **중앙 정렬**: Flexbox 사용
- **백드롭**: `position: absolute`로 부모 내 전체 영역
- **최고 Z-Index**: 다른 모든 요소 위에 표시

---

## 윈도우 패턴

### 기본 구조
```html
<div class="custom-positioned" data-component="window-frame">
  <!-- 제목 표시줄: 드래그 핸들과 컨트롤 -->
  <div data-component="window-titlebar">
    <div class="title">윈도우 제목</div>
    <div class="controls">
      <button data-action="minimize">−</button>
      <button data-action="maximize">□</button>
      <button data-action="close">×</button>
    </div>
  </div>
  
  <!-- 내용 영역: 실제 윈도우 콘텐츠 -->
  <div data-component="window-content">
    <!-- 윈도우 내용 -->
  </div>
</div>
```

### 윈도우 특별 처리
- **카스케이드 배치**: 겹치지 않게 자동 배치
- **드래그 가능**: 제목 표시줄을 통한 이동
- **크기 조절**: 모서리/가장자리 리사이즈
- **포커스 관리**: 클릭시 최상위로 이동

---

## 오버레이 패턴

### 기본 구조
```html
<div class="custom-positioned" data-component="overlay">
  <!-- 오버레이 내용 -->
  <div class="overlay-content">
    <!-- 툴팁, 드롭다운, 알림 등 -->
  </div>
</div>
```

### 오버레이 특별 처리
- **비침습적**: 기존 레이아웃 방해하지 않음
- **스마트 포지셔닝**: 공간에 따라 자동 조정
- **낮은 우선순위**: 모달/윈도우보다 아래
- **자동 숨김**: 외부 클릭시 사라짐

---

## 윈도우 생명주기와 상태 관리

### 윈도우 상태 (WindowState)
```typescript
type WindowState = 'created' | 'visible' | 'minimized' | 'maximized' | 'focused' | 'blurred' | 'closed';
```

### 상태 전환 흐름
```
created → visible → focused
   ↓        ↓         ↓
minimized ← → maximized
   ↓        ↓
  closed ← blurred
```

### 상태별 특성

#### 1. Created (생성됨)
- 윈도우가 생성되었지만 아직 표시되지 않음
- DOM에 추가되었지만 `display: none` 상태일 수 있음

#### 2. Visible (표시됨)
- 윈도우가 화면에 표시됨
- 기본 상태로 사용자와 상호작용 가능

#### 3. Focused (포커스됨)
- 현재 활성화된 윈도우
- 가장 높은 Z-Index를 가짐
- 키보드 입력을 받음

#### 4. Blurred (포커스 해제됨)
- 다른 윈도우가 포커스를 받은 상태
- 여전히 표시되지만 비활성 상태

#### 5. Minimized (최소화됨)
- 윈도우가 최소화된 상태
- 보통 작업 표시줄이나 최소화 영역에 표시

#### 6. Maximized (최대화됨)
- 윈도우가 전체 화면을 차지하는 상태
- 원래 크기로 복원 가능

#### 7. Closed (닫힘)
- 윈도우가 완전히 제거된 상태
- DOM에서도 제거됨

### 포커스 스택 관리
```typescript
// 포커스 스택: 가장 최근에 포커스된 순서
private focusStack: string[] = [];

// 포커스 시 Z-Index 재계산
inst.zIndex = this.baseZ + this.focusStack.length;
```

### 윈도우 이벤트
```typescript
// 윈도우 생성 시
this.dispatchLifecycleEvent('created', instance);

// 윈도우 포커스 시  
this.dispatchLifecycleEvent('focused', instance);

// 윈도우 닫힘 시
this.dispatchLifecycleEvent('closed', instance);
```

---

## 사용 권장사항

### 1. 모달 사용 시
- 중요한 작업이나 확인이 필요한 경우
- 사용자의 주의를 집중시켜야 하는 경우
- 전체 화면을 덮어야 하는 경우

### 2. 윈도우 사용 시
- 독립적인 작업 공간이 필요한 경우
- 여러 작업을 동시에 진행하는 경우
- 사용자가 자유롭게 조작할 수 있어야 하는 경우

### 3. 오버레이 사용 시
- 기존 콘텐츠를 방해하지 않아야 하는 경우
- 빠른 참조나 도움말이 필요한 경우
- 임시적인 정보 표시가 필요한 경우

---

## 커스터마이징

### 1. 스타일 커스터마이징
```css
/* 모달 백드롭 커스터마이징 */
[data-component="modal-backdrop"] {
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
}

/* 윈도우 제목 표시줄 커스터마이징 */
[data-component="window-titlebar"] {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}
```

### 2. 동작 커스터마이징
```typescript
// 커스텀 포지셔닝 전략
windowStackManager.registerCustomPositioningStrategy('my-modal', (element) => {
  element.style.position = 'fixed';
  element.style.top = '10%';
  element.style.left = '50%';
  element.style.transform = 'translateX(-50%)';
});

// 커스텀 Z-Index 계산기
windowStackManager.setCustomZIndexCalculator((element, displayType, stackPosition) => {
  if (displayType === 'modal') return 10000 + stackPosition;
  return 1000 + stackPosition;
});
```

---

## 실제 사용 예시

### 1. 로그인 모달 생성
```typescript
const loginModal = new UIRuntime({
  ai: new MockAIService(),
  onAfterRender: (window) => {
    console.log('Login modal created:', window.id);
  }
});

const result = await loginModal.processUserInput('로그인 폼을 만들어주세요');
```

### 2. 대시보드 윈도우 생성
```typescript
const dashboardWindow = new UIRuntime({
  ai: new MockAIService(),
  onAfterRender: (window) => {
    // 윈도우 포커스 설정
    windowStackManager.focusWindow(window.id);
  }
});

const result = await dashboardWindow.processUserInput('대시보드를 보여주세요');
```

### 3. 알림 오버레이 표시
```typescript
const notificationOverlay = new UIRuntime({
  ai: new MockAIService(),
  onAfterRender: (window) => {
    // 3초 후 자동 닫기
    setTimeout(() => {
      windowStackManager.closeWindow(window.id);
    }, 3000);
  }
});

const result = await notificationOverlay.processUserInput('성공 메시지를 보여주세요');
```

---

## 베스트 프랙티스

### 1. 성능 최적화
- **윈도우 수 제한**: 동시에 열린 윈도우는 10개 이하로 유지
- **메모리 관리**: 사용하지 않는 윈도우는 즉시 닫기
- **이벤트 정리**: 윈도우 닫을 때 이벤트 리스너 제거

### 2. 사용자 경험
- **일관된 포지셔닝**: 같은 타입의 UI는 일관된 위치에 표시
- **키보드 접근성**: ESC 키로 모달 닫기, Tab 키로 포커스 이동
- **반응형 디자인**: 모바일과 데스크톱에서 적절한 크기 조정

### 3. 코드 구조
- **컴포넌트 분리**: 각 UI 타입별로 별도 컴포넌트 생성
- **재사용 가능한 템플릿**: 공통 UI 패턴을 템플릿으로 분리
- **타입 안정성**: TypeScript 타입 정의 활용

### 4. 디버깅 팁
- **개발자 도구**: 브라우저 개발자 도구에서 Z-Index 확인
- **로그 활용**: `onBeforeRender`, `onAfterRender` 콜백으로 디버깅
- **상태 추적**: `getActiveWindows()`, `getFocusedWindow()` 메서드 활용

이 문서는 BaroCSS UI Runtime의 기본 UI 패턴을 이해하고 효과적으로 활용하는 데 도움이 될 것입니다.
