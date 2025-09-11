# AIOS 핵심 컴포넌트 구현 PRD

## 📋 개요

### 목적
AI 기반 OS 스타일 UI 시스템의 3개 핵심 컴포넌트 구현
- DOM 매니저 (JSON → UI 변환)
- 윈도우 스택 관리 (OS 수준 멀티태스킹)
- 컨텍스트 관리 (대화 연속성)

### 전제 조건
- ✅ Realtime Tailwind 엔진 완료
- ✅ 기본 HTML/CSS 인프라 구축
- ✅ AI API 연동 기반 작업 완료

---

## 🎯 컴포넌트 1: DOM 매니저

### 책임과 역할
AI가 생성한 JSON 응답을 실제 DOM 요소로 변환하고 화면에 렌더링

### 기능 요구사항

#### 1.1 AI 응답 정규화
```javascript
Input: {
  html: "<div>content</div>",
  display: { type: "modal", size: "large" },
  context: { id: "user-form" }
}

Output: {
  html: "<div>content</div>",
  display: {
    type: "modal",
    size: "large", 
    position: "center",
    priority: "normal",
    backdrop: "blur"
  },
  context: {
    id: "user-form",
    parent: null,
    purpose: "general",
    workflow: null
  },
  interactions: {},
  effects: {
    entrance: "fadeIn",
    exit: "fadeOut",
    duration: 300
  }
}
```

**검증 규칙:**
- `html`: 필수, 50KB 이하, XSS 안전 검증
- `display.type`: window|modal|overlay|inline|embedded 중 하나
- `display.size`: small|medium|large|fullscreen|auto 중 하나
- `context.id`: 중복 시 자동 고유 ID 생성

#### 1.2 DOM 요소 생성
```javascript
// 타입별 핸들러 시스템
class WindowHandler {
  create(aiResponse) {
    // 윈도우 프레임 + 타이틀바 + 컨텐츠 + 컨트롤
  }
}

class ModalHandler {
  create(aiResponse) {  
    // 백드롭 + 모달 컨테이너 + 헤더 + 컨텐츠
  }
}

class OverlayHandler {
  create(aiResponse) {
    // 포지셔닝 + 임시 표시 + 자동 제거
  }
}
```

#### 1.3 Realtime Tailwind 통합
```javascript
applyStyles(element, aiResponse) {
  // 1. AI 생성 HTML의 모든 클래스 추출
  const classes = this.extractAllClasses(element);
  
  // 2. 기존 Tailwind 엔진에 클래스 등록 요청
  classes.forEach(className => {
    realtimeTailwind.ensureClass(className);
  });
  
  // 3. 동적 클래스 변경 감지
  this.observeClassChanges(element);
}
```

#### 1.4 위치 계산 및 배치
```javascript
calculateOptimalPosition(displayConfig, context) {
  const strategies = {
    center: () => this.getCenterPosition(),
    'beside-parent': () => this.getBesideParentPosition(context.parent),
    'overlay-parent': () => this.getOverlayPosition(context.parent),
    smart: () => this.getSmartPosition(context)
  };
  
  const position = strategies[displayConfig.position]();
  return this.adjustForScreenBounds(position);
}
```

### 성능 요구사항
- JSON 파싱 → DOM 생성: 100ms 이내
- 대형 HTML (10KB): 500ms 이내
- 메모리 사용량: 페이지당 5MB 이하
- Tailwind 클래스 적용: 50ms 이내

### API 인터페이스
```javascript
class DOMManager {
  // 메인 처리 메서드
  async process(aiResponse: AIResponse): Promise<ProcessResult>
  
  // 요소 제거
  async remove(elementId: string): Promise<boolean>
  
  // 요소 업데이트
  async update(elementId: string, newAIResponse: AIResponse): Promise<ProcessResult>
  
  // 상태 조회
  getActiveElements(): Map<string, Element>
  getElementById(id: string): Element | null
}

interface ProcessResult {
  success: boolean;
  element?: Element;
  id?: string;
  error?: string;
  fallback?: Element;
}
```

### 테스트 케이스
```javascript
describe('DOM Manager', () => {
  test('윈도우 타입 UI 생성', async () => {
    const aiResponse = {
      html: '<table>사용자 목록</table>',
      display: { type: 'window', size: 'large' },
      context: { id: 'user-table' }
    };
    
    const result = await domManager.process(aiResponse);
    
    expect(result.success).toBe(true);
    expect(result.element.classList).toContain('window');
    expect(result.element.querySelector('table')).toBeTruthy();
  });
  
  test('잘못된 AI 응답 처리', async () => {
    const invalidResponse = { html: '' };
    
    const result = await domManager.process(invalidResponse);
    
    expect(result.success).toBe(false);
    expect(result.fallback).toBeTruthy();
  });
});
```

---

## 🪟 컴포넌트 2: 윈도우 스택 관리

### 책임과 역할
OS 수준의 멀티태스킹 환경을 웹에서 구현 - 윈도우 생성, 스택 관리, z-index 자동 계산, 포커스 관리

### 기능 요구사항

#### 2.1 윈도우 생명주기 관리
```javascript
enum WindowState {
  CREATED = 'created',
  VISIBLE = 'visible', 
  MINIMIZED = 'minimized',
  MAXIMIZED = 'maximized',
  FOCUSED = 'focused',
  BLURRED = 'blurred',
  CLOSED = 'closed'
}

class Window {
  id: string;
  element: HTMLElement;
  state: WindowState;
  parent?: string;
  children: string[] = [];
  zIndex: number;
  createdAt: number;
  lastActiveAt: number;
}
```

#### 2.2 Z-Index 자동 관리
```javascript
class ZIndexManager {
  private baseIndex = 1000;
  private layerOffsets = {
    base: 0,       // 1000~
    layout: 100,   // 1100~  
    content: 200,  // 1200~
    floating: 300, // 1300~
    modal: 400,    // 1400~
    overlay: 500   // 1500~
  };
  
  calculateZIndex(type: DisplayType, priority: Priority): number {
    const layerBase = this.baseIndex + this.layerOffsets[type];
    const priorityOffset = this.getPriorityOffset(priority);
    const stackPosition = this.getCurrentStackPosition(type);
    
    return layerBase + priorityOffset + stackPosition;
  }
}
```

#### 2.3 포커스 관리 시스템
```javascript
class FocusManager {
  private focusStack: string[] = [];
  private activeWindow: string | null = null;
  
  focusWindow(windowId: string): void {
    // 1. 이전 활성 윈도우 blur 처리
    this.blurCurrentWindow();
    
    // 2. 새 윈도우 focus 처리
    this.activateWindow(windowId);
    
    // 3. 스택 순서 재정렬
    this.updateFocusStack(windowId);
    
    // 4. z-index 재계산
    this.updateZIndexes();
  }
  
  getNextFocusableWindow(): string | null {
    // ESC/Close 시 다음 포커스 대상 결정
  }
}
```

#### 2.4 윈도우 배치 및 충돌 방지
```javascript
class LayoutManager {
  private occupiedAreas: Rectangle[] = [];
  private cascadeOffset = 30;
  
  findOptimalPosition(window: Window): Position {
    const strategies = [
      this.tryOriginalPosition,
      this.tryCascadePosition,
      this.tryQuadrantPosition,
      this.tryFallbackPosition
    ];
    
    for (const strategy of strategies) {
      const position = strategy(window);
      if (this.isPositionValid(position, window.size)) {
        return position;
      }
    }
    
    return this.getFallbackPosition();
  }
  
  preventOverlap(newWindow: Window): void {
    const conflicts = this.detectConflicts(newWindow);
    if (conflicts.length > 0) {
      this.resolveConflicts(newWindow, conflicts);
    }
  }
}
```

#### 2.5 윈도우 그룹핑 및 워크스페이스
```javascript
class WindowGroupManager {
  private groups = new Map<string, WindowGroup>();
  
  createGroup(parentWindowId: string, purpose: string): string {
    const groupId = this.generateGroupId();
    const group = new WindowGroup(groupId, parentWindowId, purpose);
    this.groups.set(groupId, group);
    return groupId;
  }
  
  addWindowToGroup(windowId: string, groupId: string): void {
    const group = this.groups.get(groupId);
    if (group) {
      group.addWindow(windowId);
      this.establishRelationship(windowId, group);
    }
  }
  
  closeGroup(groupId: string): void {
    // 그룹 내 모든 윈도우 순차 닫기
  }
}
```

### 성능 요구사항
- 윈도우 생성: 50ms 이내
- z-index 계산: 10ms 이내
- 포커스 전환: 30ms 이내
- 동시 윈도우 수: 50개까지
- 메모리: 윈도우당 1MB 이하

### API 인터페이스
```javascript
class WindowStackManager {
  // 윈도우 생성
  createWindow(element: HTMLElement, config: WindowConfig): Window
  
  // 윈도우 상태 변경
  focusWindow(windowId: string): void
  minimizeWindow(windowId: string): void
  maximizeWindow(windowId: string): void
  closeWindow(windowId: string): void
  
  // 그룹 관리
  createGroup(parentId: string, purpose: string): string
  addToGroup(windowId: string, groupId: string): void
  
  // 상태 조회
  getActiveWindows(): Window[]
  getWindowById(id: string): Window | null
  getFocusedWindow(): Window | null
}

interface WindowConfig {
  type: DisplayType;
  size: WindowSize;
  position?: Position;
  draggable?: boolean;
  resizable?: boolean;
  modal?: boolean;
}
```

### 이벤트 시스템
```javascript
// 윈도우 이벤트
window.addEventListener('window:created', (e) => {
  console.log('윈도우 생성됨:', e.detail.windowId);
});

window.addEventListener('window:focused', (e) => {
  // 다른 윈도우들 스타일 조정
});

window.addEventListener('window:closed', (e) => {
  // 자식 윈도우들 처리
});
```

---

## 🧠 컴포넌트 3: 컨텍스트 관리

### 책임과 역할
사용자 대화의 연속성을 유지하고 워크플로우 상태를 추적하여 자연스러운 AI 상호작용 제공

### 기능 요구사항

#### 3.1 대화 히스토리 관리
```javascript
interface ConversationEntry {
  id: string;
  timestamp: number;
  userInput: string;
  aiResponse: AIResponse;
  context: ContextSnapshot;
  windowsCreated: string[];
  windowsClosed: string[];
}

class ConversationManager {
  private history: ConversationEntry[] = [];
  private maxHistorySize = 100;
  
  addEntry(entry: ConversationEntry): void {
    this.history.push(entry);
    this.maintainHistorySize();
    this.saveToStorage();
  }
  
  getRecentEntries(count: number = 5): ConversationEntry[] {
    return this.history.slice(-count);
  }
  
  searchHistory(query: string): ConversationEntry[] {
    // 의미 기반 검색 (임베딩 활용)
  }
}
```

#### 3.2 워크플로우 상태 추적
```javascript
enum WorkflowStage {
  INITIAL = 'initial',
  EXPLORING = 'exploring',
  FOCUSING = 'focusing',
  EDITING = 'editing',
  CONFIRMING = 'confirming',
  COMPLETING = 'completing'
}

interface WorkflowState {
  currentStage: WorkflowStage;
  mainTask: string;
  subTasks: string[];
  progress: number;
  activeWindows: string[];
  dataEntities: Map<string, any>;
}

class WorkflowTracker {
  private currentWorkflow: WorkflowState | null = null;
  
  detectWorkflowTransition(
    userInput: string, 
    previousContext: ContextSnapshot
  ): WorkflowStage {
    const patterns = {
      exploring: /보여줘|확인해|찾아|목록|리스트/,
      focusing: /상세|자세히|더|클릭|선택/,
      editing: /편집|수정|바꿔|업데이트|입력/,
      confirming: /저장|확인|완료|제출|보내/
    };
    
    // 패턴 매칭 + 컨텍스트 분석으로 단계 결정
  }
  
  updateWorkflow(stage: WorkflowStage, data: any): void {
    if (!this.currentWorkflow) {
      this.initializeWorkflow(stage, data);
    } else {
      this.transitionWorkflow(stage, data);
    }
  }
}
```

#### 3.3 컨텍스트 스냅샷 시스템
```javascript
interface ContextSnapshot {
  timestamp: number;
  activeWindows: WindowInfo[];
  focusedWindow: string | null;
  userData: Record<string, any>;
  workflowState: WorkflowState;
  environmentState: {
    screenSize: { width: number; height: number };
    windowCount: number;
    memoryUsage: number;
  };
}

class ContextCapture {
  captureSnapshot(): ContextSnapshot {
    return {
      timestamp: Date.now(),
      activeWindows: this.getActiveWindowsInfo(),
      focusedWindow: this.getFocusedWindowId(),
      userData: this.collectUserData(),
      workflowState: this.getCurrentWorkflowState(),
      environmentState: this.getEnvironmentState()
    };
  }
  
  private getActiveWindowsInfo(): WindowInfo[] {
    return Array.from(windowStack.getActiveWindows()).map(window => ({
      id: window.id,
      type: window.type,
      purpose: window.purpose,
      data: this.extractWindowData(window)
    }));
  }
}
```

#### 3.4 지능형 컨텍스트 구성
```javascript
class ContextBuilder {
  buildAIContext(userInput: string): AIContext {
    const snapshot = this.contextCapture.captureSnapshot();
    const relevantHistory = this.findRelevantHistory(userInput);
    const workflowContext = this.buildWorkflowContext(snapshot.workflowState);
    
    return {
      currentState: {
        windows: snapshot.activeWindows,
        focused: snapshot.focusedWindow,
        workflow: snapshot.workflowState
      },
      history: relevantHistory,
      entities: this.extractRelevantEntities(userInput, snapshot),
      intentions: this.analyzeUserIntention(userInput, relevantHistory)
    };
  }
  
  private findRelevantHistory(userInput: string): ConversationEntry[] {
    // 1. 키워드 매칭
    const keywordMatches = this.searchByKeywords(userInput);
    
    // 2. 시간적 연관성 (최근 5개)
    const recentEntries = this.conversationManager.getRecentEntries(5);
    
    // 3. 의미적 유사도 (임베딩 기반)
    const semanticMatches = this.searchBySemantic(userInput);
    
    // 가중치 기반 조합
    return this.combineRelevantEntries(keywordMatches, recentEntries, semanticMatches);
  }
}
```

#### 3.5 상태 영속성 및 복원
```javascript
class ContextPersistence {
  private storageKey = 'aios_context';
  
  async saveContext(context: ContextSnapshot): Promise<void> {
    // 1. 로컬 스토리지에 즉시 저장
    localStorage.setItem(this.storageKey, JSON.stringify(context));
    
    // 2. IndexedDB에 상세 히스토리 저장
    await this.indexedDB.put('contexts', context);
    
    // 3. 서버에 백업 (옵션)
    if (this.isUserLoggedIn()) {
      await this.syncToServer(context);
    }
  }
  
  async restoreContext(sessionId?: string): Promise<ContextSnapshot | null> {
    try {
      // 1. 세션 기반 복원 시도
      if (sessionId) {
        const sessionContext = await this.restoreFromSession(sessionId);
        if (sessionContext) return sessionContext;
      }
      
      // 2. 로컬 스토리지에서 복원
      const localContext = this.restoreFromLocal();
      if (localContext) return localContext;
      
      return null;
    } catch (error) {
      console.warn('컨텍스트 복원 실패:', error);
      return null;
    }
  }
}
```

### 성능 요구사항
- 컨텍스트 스냅샷 생성: 50ms 이내
- 히스토리 검색: 100ms 이내  
- 컨텍스트 저장: 200ms 이내
- 메모리 사용량: 10MB 이하
- 히스토리 크기: 최대 100개 엔트리

### API 인터페이스
```javascript
class ContextManager {
  // 컨텍스트 구성
  buildAIContext(userInput: string): AIContext
  
  // 대화 관리
  addConversation(entry: ConversationEntry): void
  getConversationHistory(count?: number): ConversationEntry[]
  
  // 워크플로우 추적
  updateWorkflowState(stage: WorkflowStage, data: any): void
  getCurrentWorkflow(): WorkflowState | null
  
  // 스냅샷 관리
  captureSnapshot(): ContextSnapshot
  restoreFromSnapshot(snapshot: ContextSnapshot): void
  
  // 영속성
  saveToStorage(): Promise<void>
  loadFromStorage(): Promise<void>
}

interface AIContext {
  currentState: {
    windows: WindowInfo[];
    focused: string | null;
    workflow: WorkflowState;
  };
  history: ConversationEntry[];
  entities: Record<string, any>;
  intentions: string[];
}
```

---

## 🔧 컴포넌트 간 통합

### 통합 아키텍처
```javascript
class AIOSCore {
  constructor() {
    this.domManager = new DOMManager();
    this.windowStack = new WindowStackManager();
    this.contextManager = new ContextManager();
    
    this.setupEventHandlers();
  }
  
  async processUserInput(input: string): Promise<ProcessResult> {
    // 1. 컨텍스트 구성
    const aiContext = this.contextManager.buildAIContext(input);
    
    // 2. AI 호출 (외부 시스템)
    const aiResponse = await this.callAI(input, aiContext);
    
    // 3. DOM 생성
    const domResult = await this.domManager.process(aiResponse);
    if (!domResult.success) {
      return domResult;
    }
    
    // 4. 윈도우 등록 및 관리
    const windowConfig = this.buildWindowConfig(aiResponse);
    const window = this.windowStack.createWindow(domResult.element, windowConfig);
    
    // 5. 컨텍스트 업데이트
    this.contextManager.addConversation({
      id: generateId(),
      timestamp: Date.now(),
      userInput: input,
      aiResponse: aiResponse,
      context: this.contextManager.captureSnapshot(),
      windowsCreated: [window.id],
      windowsClosed: []
    });
    
    return {
      success: true,
      window: window,
      element: domResult.element
    };
  }
}
```

### 이벤트 흐름
```
사용자 입력
    ↓
컨텍스트 수집 (ContextManager)
    ↓ 
AI API 호출
    ↓
DOM 생성 (DOMManager)
    ↓
윈도우 등록 (WindowStackManager)
    ↓
컨텍스트 업데이트 (ContextManager)
    ↓
화면 표시 완료
```

---

## 📊 테스트 전략

### 단위 테스트
```javascript
// DOM 매니저 테스트
describe('DOMManager', () => {
  test('정상적인 AI 응답 처리');
  test('잘못된 HTML 검증');
  test('XSS 공격 방지');
  test('대용량 HTML 처리');
});

// 윈도우 스택 매니저 테스트  
describe('WindowStackManager', () => {
  test('윈도우 생성 및 z-index 할당');
  test('포커스 전환 및 스택 재정렬');
  test('윈도우 충돌 감지 및 해결');
  test('메모리 누수 방지');
});

// 컨텍스트 매니저 테스트
describe('ContextManager', () => {
  test('대화 히스토리 저장 및 검색');
  test('워크플로우 상태 전환');
  test('컨텍스트 스냅샷 생성');
  test('영속성 저장 및 복원');
});
```

### 통합 테스트
```javascript
describe('AIOS Core Integration', () => {
  test('전체 플로우: 입력 → AI → DOM → 윈도우 → 컨텍스트');
  test('다중 윈도우 생성 및 관리');
  test('워크플로우 연속성 유지');
  test('오류 상황에서의 시스템 안정성');
});
```

### 성능 테스트
- 부하 테스트: 동시 윈도우 50개
- 메모리 테스트: 장시간 사용 시 누수 검증
- 응답시간 테스트: 각 컴포넌트별 성능 기준 검증

---

## 🚀 구현 일정

### Week 1-2: DOM 매니저
- AI 응답 정규화 및 검증 로직
- 타입별 핸들러 구현
- Tailwind 엔진 통합

### Week 3-4: 윈도우 스택 관리  
- 기본 윈도우 생명주기 구현
- Z-index 자동 계산 시스템
- 포커스 관리 시스템

### Week 5-6: 컨텍스트 관리
- 대화 히스토리 시스템
- 워크플로우 상태 추적  
- 영속성 및 복원 기능

### Week 7-8: 통합 및 테스트
- 컴포넌트 간 통합
- 전체 시스템 테스트
- 성능 최적화

---

## 📈 성공 지표

### 기능적 지표
- DOM 생성 성공률: 99% 이상
- 윈도우 배치 정확도: 95% 이상  
- 컨텍스트 연속성 유지율: 90% 이상

### 성능 지표
- DOM 생성 시간: 평균 200ms 이하
- 윈도우 포커스 전환: 평균 30ms 이하
- 메모리 사용량: 윈도우당 1MB 이하

### 사용자 경험 지표
- 오류 발생률: 5% 이하
- 시스템 응답성 만족도: 4.5/5.0 이상
- 워크플로우 완료율: 85% 이상

---

**승인자**: 개발팀 리드  
**문서 버전**: 1.0  
**작성일**: 2025-01-27