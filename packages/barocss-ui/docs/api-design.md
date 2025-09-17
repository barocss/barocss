# Director API Design

## 개요

Director의 API는 직관적이고 일관성 있는 인터페이스를 제공하여 개발자가 쉽게 사용할 수 있도록 설계되었습니다.

## 메인 API

### Stage 클래스

```typescript
class Stage {
  constructor(options: { mount: string | HTMLElement; director?: Director; renderer?: UIRenderer })
  mount(): void
  render(scene: Scene): Promise<void>
  update(scene: Scene): void
  clear(): void
  dispose(): void
}
```

### Director 클래스

```typescript
class Director {
  // 초기화 및 생명주기
  constructor(config?: Partial<DirectorConfig>, agentCommunication?: AgentCommunicationInterface | ThirdPartyAgent)
  async initialize(): Promise<void>
  async shutdown(): Promise<void>
  isReady(): boolean

  // 메인 API - 사용자 요청 처리
  request(userInput: string): Promise<Scene>
  getCurrentConversationChain(): ConversationChain | null
  getConversationHistory(): Scene[]
  continueConversation(userInput: string): Promise<Scene>

  // Scene 관리
  createScene(config: SceneConfig): Scene
  updateScene(sceneId: string, updates: Partial<SceneConfig>): void
  removeScene(sceneId: string, cascade?: boolean): void
  getScene(sceneId: string): Scene | null
  getAllScenes(): Scene[]
  setActiveScene(sceneId: string | null): void
  getActiveScene(): Scene | null

  // SubScene 관리
  createSubScene(parentSceneId: string, config: SubSceneConfig): SubScene
  updateSubScene(subSceneId: string, updates: Partial<SubSceneConfig>): void
  removeSubScene(subSceneId: string): void
  getSubScene(subSceneId: string): SubScene | null
  getSubScenesByParent(parentSceneId: string): SubScene[]

  // 모달 관리
  openModal(config: ModalConfig): Modal
  closeModal(modalId: string): void
  getModal(modalId: string): Modal | null
  getAllModals(): Modal[]

  // 상태 관리
  getGlobalState(): GlobalState
  setGlobalState(state: Partial<GlobalState>): void
  getSceneState(sceneId: string): SceneState | null
  setSceneState(sceneId: string, state: Partial<SceneState>): void
  getSubSceneState(subSceneId: string): SubSceneState | null
  setSubSceneState(subSceneId: string, state: Partial<SubSceneState>): void

  // 상태 구독
  subscribeToState(path: string, callback: StateCallback): () => void
  subscribeToGlobalState(callback: GlobalStateCallback): () => void
  subscribeToSceneState(sceneId: string, callback: SceneStateCallback): () => void
  subscribeToSubSceneState(subSceneId: string, callback: SubSceneStateCallback): () => void

  // 상태 동기화
  syncStates(source: string, target: string, mapping?: StateMapping): void
  linkStates(sourcePath: string, targetPath: string, transform?: StateTransform): void

  // 렌더링
  render(content: RenderContent, container: HTMLElement, options?: RenderOptions): void
  updateElement(selector: string, content: string | HTMLElement): void
  updateSubScene(subSceneId: string, content: any): void
  updateModal(modalId: string, content: any): void

  // 애니메이션
  fadeIn(element: HTMLElement, duration?: number): Promise<void>
  fadeOut(element: HTMLElement, duration?: number): Promise<void>
  slideIn(element: HTMLElement, direction: 'up' | 'down' | 'left' | 'right', duration?: number): Promise<void>
  slideOut(element: HTMLElement, direction: 'up' | 'down' | 'left' | 'right', duration?: number): Promise<void>

  // 이벤트 시스템
  subscribeToEvents(callback: (event: SystemEvent) => void): () => void
  emitEvent(event: SystemEvent): void

  // 시스템 정보
  getAgentConnectionState(): { isConnected: boolean; stats: any }
  getStats(): SystemStats
  updateConfig(updates: Partial<DirectorConfig>): void

  // 내부 컴포넌트 접근 (고급 사용자용)
  getSceneManager(): SceneManager
  getSubSceneManager(): SubSceneManager
  getModalManager(): ModalManager
  getStateManager(): StateManager
  getRenderer(): HybridRenderer
  getAnimationEngine(): AnimationEngine
}
```

## 핵심 타입 정의

### 기본 타입

```typescript
// 기본 식별자
type ID = string;
type Timestamp = number;
type Version = string;

// 기본 엔티티
interface BaseEntity {
  id: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}
```

### Scene/SubScene 타입

```typescript
// Scene 정의
interface Scene {
  id: string
  type: 'main' | 'overlay' | 'popup'
  title: string
  status: 'active' | 'inactive' | 'hidden' | 'destroyed'
  
  // UI 정의
  ui: {
    type: 'html' | 'components' | 'json'
    content: string | ComponentDefinition[] | any
    styles?: Record<string, any>
    scripts?: string[]
  }
  
  // 상태 관리
  state: SceneState
  formData?: Record<string, any>
  
  // 관계
  parentId?: string
  childIds: string[]
  subSceneIds: string[]
  
  // 메타데이터
  metadata: {
    createdAt: number
    updatedAt: number
    version: number
    tags: string[]
    permissions: string[]
  }
}

// SubScene 정의
interface SubScene {
  id: string
  parentSceneId: string
  type: 'partial' | 'modal' | 'overlay' | 'form-step'
  selector: string // DOM 선택자
  
  // UI 정의
  ui: {
    type: 'html' | 'components' | 'json'
    content: string | ComponentDefinition[] | any
    updateMode: 'replace' | 'append' | 'prepend' | 'merge'
  }
  
  // 상태 관리
  state: SubSceneState
  formData?: Record<string, any>
  
  // 관계
  linkedSubScenes: string[]
  
  // 메타데이터
  metadata: {
    createdAt: number
    updatedAt: number
    version: number
    autoUpdate: boolean
    updateInterval?: number
  }
}

// Modal 정의
interface Modal extends SubScene {
  type: 'modal'
  config: {
    backdrop: boolean
    closable: boolean
    keyboard: boolean
    focus: boolean
    size: 'sm' | 'md' | 'lg' | 'xl' | 'full'
    position: 'center' | 'top' | 'bottom'
    animation: 'fade' | 'slide' | 'zoom' | 'none'
  }
  
  // 모달 특화 상태
  modalState: {
    isOpen: boolean
    isAnimating: boolean
    zIndex: number
    focusTrap: boolean
  }
}
```

### 상태 관리 타입

```typescript
// Global State
interface GlobalState {
  application: ApplicationState
  user: UserState
  system: SystemState
}

interface ApplicationState {
  version: string
  environment: 'development' | 'staging' | 'production'
  build: string
  features: Record<string, boolean>
  theme: 'light' | 'dark' | 'auto'
  language: string
  timezone: string
}

interface UserState {
  id: string
  role: string
  permissions: string[]
  preferences: UserPreferences
  session: SessionState
  profile: UserProfile
}

// Scene State
interface SceneState {
  // UI 상태
  ui: {
    loading: boolean
    error: string | null
    visible: boolean
    focused: boolean
    scrollPosition: { x: number; y: number }
  }
  
  // 폼 상태
  forms: Record<string, FormState>
  
  // 컴포넌트 상태
  components: Record<string, ComponentState>
  
  // 상호작용 상태
  interactions: {
    lastAction: string | null
    lastActionTime: number
    actionHistory: ActionHistory[]
    hoveredElement: string | null
    selectedElement: string | null
  }
  
  // AI 연동 상태
  ai: {
    lastRequest: string | null
    lastResponse: any | null
    conversationContext: ConversationContext
    isLoading: boolean
    error: string | null
  }
}

// SubScene State
interface SubSceneState {
  // UI 상태
  ui: {
    loading: boolean
    error: string | null
    visible: boolean
    updated: boolean
    animation: AnimationState | null
  }
  
  // 데이터 상태
  data: Record<string, any>
  
  // 업데이트 상태
  update: {
    lastUpdate: number
    updateCount: number
    pendingUpdates: UpdateQueue[]
    autoUpdate: boolean
    updateInterval: number | null
  }
  
  // 연결 상태
  connections: {
    linkedSubScenes: string[]
    eventListeners: EventListener[]
    dataBindings: DataBinding[]
  }
}
```

### 렌더링 타입

```typescript
// Render Content
interface RenderContent {
  type: 'html' | 'components' | 'json' | 'scene'
  content: string | ComponentDefinition[] | any
  metadata?: RenderMetadata
}

// Component Definition
interface ComponentDefinition {
  id: string
  type: string
  name: string
  props: Record<string, any>
  children?: ComponentDefinition[]
  events?: Record<string, string>
  styles?: Record<string, any>
  lifecycle?: ComponentLifecycle
}

// Update Operation
interface UpdateOperation {
  type: 'element' | 'attribute' | 'style' | 'text' | 'subscene' | 'modal'
  target: string
  content: any
  options?: UpdateOptions
}

// Animation Options
interface AnimationOptions {
  duration: number
  easing: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear' | string
  delay?: number
  fill?: 'none' | 'forwards' | 'backwards' | 'both'
  direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse'
  iterations?: number | 'infinite'
}
```

### 컨텍스트 타입

```typescript
// 글로벌 컨텍스트
interface GlobalContext {
  application: {
    version: string;
    environment: 'development' | 'staging' | 'production';
    build: string;
    features: Record<string, boolean>;
  };
  user: {
    id: string;
    role: string;
    permissions: string[];
    preferences: UserPreferences;
    locale: string;
    timezone: string;
  };
  system: {
    platform: string;
    browser: string;
    capabilities: SystemCapabilities;
    performance: PerformanceMetrics;
  };
}

// 세션 컨텍스트
interface SessionContext {
  sessionId: string;
  startTime: Timestamp;
  lastActivity: Timestamp;
  duration: number;
  navigation: {
    history: NavigationEntry[];
    current: string;
    previous: string | null;
  };
  state: {
    authenticated: boolean;
    loading: boolean;
    error: Error | null;
  };
  data: {
    cache: Record<string, any>;
    variables: Record<string, any>;
    temporary: Record<string, any>;
  };
}

// 씬 컨텍스트
interface SceneContext {
  sceneId: string;
  type: SceneType;
  title: string;
  parent: {
    sceneId: string | null;
    relationship: 'parent' | 'child' | 'sibling' | 'modal';
  };
  children: {
    sceneIds: string[];
    relationships: Record<string, string>;
  };
  state: {
    visible: boolean;
    active: boolean;
    focused: boolean;
    loading: boolean;
  };
  data: {
    props: Record<string, any>;
    state: Record<string, any>;
    computed: Record<string, any>;
  };
  metadata: {
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdBy: 'user' | 'ai' | 'system';
    version: number;
  };
}

// 컴포넌트 컨텍스트
interface ComponentContext {
  componentId: string;
  type: string;
  name: string;
  parent: {
    componentId: string | null;
    sceneId: string;
  };
  children: {
    componentIds: string[];
    order: number[];
  };
  props: Record<string, any>;
  state: Record<string, any>;
  refs: Record<string, any>;
  lifecycle: {
    mounted: boolean;
    updated: boolean;
    destroyed: boolean;
  };
}

// 임시 컨텍스트
interface TemporaryContext {
  requestId: string;
  timestamp: Timestamp;
  expiresAt: Timestamp;
  data: Record<string, any>;
  metadata: {
    source: 'user' | 'ai' | 'system';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    tags: string[];
  };
}

// 컨텍스트 계층
interface ContextHierarchy {
  global: GlobalContext;
  session: SessionContext;
  scene: SceneContext | null;
  component: ComponentContext | null;
  temporary: TemporaryContext | null;
}
```

### 씬 관리 타입

```typescript
// 씬 타입
type SceneType = 'window' | 'modal' | 'popover' | 'overlay' | 'page';

// 씬 상태
interface SceneState {
  visible: boolean;
  active: boolean;
  focused: boolean;
  loading: boolean;
  error: Error | null;
  data: Record<string, any>;
}

// 컴포넌트 정의
interface ComponentDefinition {
  type: string;
  name: string;
  props: Record<string, any>;
  children?: ComponentDefinition[];
  events?: Record<string, string>;
  styles?: Record<string, any>;
  metadata?: Record<string, any>;
}

// 씬
interface Scene extends BaseEntity {
  type: SceneType;
  title: string;
  component: ComponentDefinition;
  state: SceneState;
  context: SceneContext;
  relationships: {
    parent?: string;
    children: string[];
    siblings: string[];
  };
  metadata: {
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdBy: 'user' | 'ai' | 'system';
    version: number;
  };
}

// 씬 설정
interface SceneConfig {
  id?: string;
  type: SceneType;
  title: string;
  component: ComponentDefinition;
  parentId?: string;
  position?: Position;
  size?: Size;
  props?: Record<string, any>;
  state?: Record<string, any>;
  metadata?: Record<string, any>;
}
```

### 통신 타입

```typescript
// 기본 요청
interface BaseRequest extends BaseEntity {
  type: RequestType;
  timestamp: Timestamp;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  source: 'user' | 'ai' | 'system';
  context: ContextHierarchy;
  metadata: {
    version: string;
    correlationId: string;
    parentRequestId: string | null;
    tags: string[];
  };
}

// 요청 타입
type RequestType = 
  | 'create_scene'
  | 'update_scene'
  | 'delete_scene'
  | 'navigate'
  | 'user_action'
  | 'ai_query'
  | 'custom';

// 씬 생성 요청
interface CreateSceneRequest extends BaseRequest {
  type: 'create_scene';
  payload: {
    sceneType: SceneType;
    title: string;
    component: ComponentDefinition;
    parentSceneId?: string;
    position?: Position;
    size?: Size;
    props?: Record<string, any>;
    state?: Record<string, any>;
  };
}

// 씬 업데이트 요청
interface UpdateSceneRequest extends BaseRequest {
  type: 'update_scene';
  payload: {
    sceneId: string;
    updates: {
      title?: string;
      component?: Partial<ComponentDefinition>;
      props?: Record<string, any>;
      state?: Record<string, any>;
      position?: Position;
      size?: Size;
    };
  };
}

// 사용자 액션 요청
interface UserActionRequest extends BaseRequest {
  type: 'user_action';
  payload: {
    action: string;
    target: string;
    data: Record<string, any>;
    event: UserEvent;
  };
}

// AI 쿼리 요청
interface AIQueryRequest extends BaseRequest {
  type: 'ai_query';
  payload: {
    query: string;
    context: AIContext;
    options: AIQueryOptions;
  };
}

// 통합 요청 타입
type AgentRequest = 
  | CreateSceneRequest
  | UpdateSceneRequest
  | DeleteSceneRequest
  | NavigateRequest
  | UserActionRequest
  | AIQueryRequest
  | CustomRequest;

// 기본 응답
interface BaseResponse extends BaseEntity {
  requestId: string;
  type: ResponseType;
  timestamp: Timestamp;
  processingTime: number;
  status: {
    success: boolean;
    code: number;
    message: string;
  };
  data: any;
  metadata: {
    version: string;
    correlationId: string;
    confidence?: number;
    warnings?: string[];
  };
}

// 응답 타입
type ResponseType = 'success' | 'error' | 'partial' | 'redirect';

// 성공 응답
interface SuccessResponse extends BaseResponse {
  type: 'success';
  data: {
    result: any;
    context?: ContextUpdate;
    sideEffects?: SideEffect[];
  };
}

// 에러 응답
interface ErrorResponse extends BaseResponse {
  type: 'error';
  data: {
    error: {
      code: string;
      message: string;
      details?: any;
      stack?: string;
    };
    recovery?: RecoveryAction[];
  };
}

// 부분 응답
interface PartialResponse extends BaseResponse {
  type: 'partial';
  data: {
    chunk: any;
    progress: number;
    total?: number;
  };
}

// 통합 응답 타입
type AgentResponse = 
  | SuccessResponse
  | ErrorResponse
  | PartialResponse
  | RedirectResponse;
```

### 이벤트 타입

```typescript
// 기본 이벤트
interface BaseEvent {
  type: string;
  timestamp: Timestamp;
  source: string;
  data: any;
}

// 컨텍스트 변경 이벤트
interface ContextChangeEvent extends BaseEvent {
  type: 'context_change';
  data: {
    path: string;
    oldValue: any;
    newValue: any;
  };
}

// 씬 생성 이벤트
interface SceneCreateEvent extends BaseEvent {
  type: 'scene_create';
  data: {
    scene: Scene;
  };
}

// 씬 업데이트 이벤트
interface SceneUpdateEvent extends BaseEvent {
  type: 'scene_update';
  data: {
    scene: Scene;
    changes: Record<string, any>;
  };
}

// 씬 삭제 이벤트
interface SceneDeleteEvent extends BaseEvent {
  type: 'scene_delete';
  data: {
    sceneId: string;
  };
}

// 사용자 액션 이벤트
interface UserActionEvent extends BaseEvent {
  type: 'user_action';
  data: {
    action: string;
    target: string;
    data: Record<string, any>;
  };
}

// 통합 이벤트 타입
type SystemEvent = 
  | ContextChangeEvent
  | SceneCreateEvent
  | SceneUpdateEvent
  | SceneDeleteEvent
  | UserActionEvent;
```

### 설정 타입

```typescript
// Director 설정
interface DirectorConfig {
  version: string;
  environment: 'development' | 'staging' | 'production';
  debug: boolean;
  
  state: {
    persistence: boolean;
    storage: 'memory' | 'localStorage' | 'indexedDB';
    maxHistory: number;
  };
  
  ui: {
    theme: 'light' | 'dark' | 'auto';
    animations: boolean;
    transitions: boolean;
  };
  
  performance: {
    maxScenes: number;
    cleanupInterval: number;
    gcThreshold: number;
  };
  
  security: {
    encryption: boolean;
    validation: boolean;
    sanitization: boolean;
  };
}

// Third-party Agent 설정
interface ThirdPartyAgentConfig {
  name: string;
  type: string;
  options?: Record<string, any>;
}

## 대화형 Scene 체인 타입

### ConversationChain 타입

```typescript
// 대화 체인 - Scene들의 연결
interface ConversationChain {
  id: string;
  scenes: Scene[];
  currentSceneId: string;
  context: ConversationContext;
  metadata: {
    createdAt: number;
    lastUpdated: number;
    totalSteps: number;
  };
}

// 대화 컨텍스트
interface ConversationContext {
  userInputs: UserInput[];
  aiOutputs: AIOutput[];
  globalState: Record<string, any>;
  sceneStates: Record<string, Record<string, any>>;
}

// 사용자 입력
interface UserInput {
  id: string;
  input: string;
  timestamp: number;
  sceneId: string;
  metadata?: Record<string, any>;
}

// AI 출력
interface AIOutput {
  id: string;
  response: AgentResponse;
  timestamp: number;
  sceneId: string;
  metadata?: Record<string, any>;
}

// 집계된 컨텍스트
interface AggregatedContext {
  conversation: {
    id: string;
    step: number;
    totalSteps: number;
  };
  scenes: SceneContextSummary[];
  currentScene: {
    id: string;
    context: Record<string, any>;
  };
  global: Record<string, any>;
}

// Scene 컨텍스트 요약
interface SceneContextSummary {
  id: string;
  type: string;
  title: string;
  state: Record<string, any>;
  userInputs: UserInput[];
  aiOutputs: AIOutput[];
}
```

## Interaction Layer API

### AIStateManager 클래스

```typescript
class AIStateManager {
  // Scene별 상태 관리
  setSceneState(sceneId: string, key: string, value: any): void
  getSceneState(sceneId: string, key: string): any
  getAllSceneStates(sceneId: string): Record<string, any>
  clearSceneState(sceneId: string): void

  // 전역 상태 관리
  setGlobalState(key: string, value: any): void
  getGlobalState(key: string): any
  getAllGlobalStates(): Record<string, any>
  clearGlobalState(key: string): void

  // 대화 컨텍스트 관리
  setConversationContext(key: string, value: any): void
  getConversationContext(key: string): any
  getAllConversationContexts(): Record<string, any>
  clearConversationContext(key: string): void

  // 상태 수집 (AI 요청용)
  collectStateForAI(sceneId: string): AIStateData
  collectAllStates(): AIStateData

  // Scene 정리
  cleanupScene(sceneId: string): void
  cleanupAllScenes(): void
}
```

### AIConversationManager 클래스

```typescript
class AIConversationManager {
  // 연속 대화 처리
  async handleUserAction(
    action: string, 
    data: any, 
    sceneId: string
  ): Promise<void>

  // AI 응답 처리
  async processAIResponse(response: AgentResponse): Promise<void>

  // 대화 컨텍스트 관리
  setConversationStep(step: number): void
  getConversationStep(): number
  resetConversation(): void

  // 상태 전달
  async sendStateToAI(sceneId: string): Promise<AgentResponse>
}
```

### Interaction Layer 타입

```typescript
// AI 상태 데이터
interface AIStateData {
  sceneState: Record<string, any>;
  globalState: Record<string, any>;
  conversationContext: Record<string, any>;
}

// 사용자 액션
interface UserAction {
  type: string;
  target: string;
  data: any;
  sceneId: string;
  timestamp: number;
}

// AI 응답 처리 옵션
interface AIResponseProcessingOptions {
  renderMode: 'html' | 'components' | 'scene';
  updateMode: 'replace' | 'append' | 'merge';
  preserveState: boolean;
}
```

## Rendering Layer API

### HybridUIRenderer 클래스

```typescript
class HybridUIRenderer {
  // AI 응답 렌더링
  async renderAIResponse(response: AgentResponse): Promise<void>
  async renderAIScene(aiScene: AISceneDefinition): Promise<Scene>

  // 다중 렌더링 방식
  async renderHTML(content: string, options?: RenderOptions): Promise<Scene>
  async renderComponents(components: ComponentDefinition[]): Promise<Scene>
  async renderScene(scene: SceneDefinition): Promise<Scene>

  // 액션 핸들러 연결
  attachActionHandlers(actions: Record<string, string>): void
  detachActionHandlers(sceneId: string): void

}
```

### AISceneProcessor 클래스

```typescript
class AISceneProcessor {
  // AI 응답 파싱
  processAIResponse(response: AgentResponse): AISceneDefinition | null
  detectUIType(ui: any): 'html' | 'components' | 'scene'

  // UI 타입별 처리
  processHTMLUI(content: string): AISceneDefinition
  processComponentUI(components: ComponentDefinition[]): AISceneDefinition
  processJSONUI(scene: SceneDefinition): AISceneDefinition

  // Scene 생성
  createSceneFromAI(aiScene: AISceneDefinition): Scene
  validateAIScene(aiScene: AISceneDefinition): ValidationResult
}
```


### Rendering Layer 타입

```typescript
// AI Scene 정의
interface AISceneDefinition {
  type: 'html' | 'components' | 'scene';
  title?: string;
  content?: string; // HTML + Tailwind
  components?: ComponentDefinition[];
  scene?: SceneDefinition;
  actions?: Record<string, string>;
  state?: Record<string, any>;
  context?: Record<string, any>;
}

// 렌더링 옵션
interface RenderOptions {
  sceneId?: string;
  parentId?: string;
  position?: Position;
  size?: Size;
  theme?: 'light' | 'dark';
  responsive?: boolean;
}

// 컴포넌트 정의
interface ComponentDefinition {
  type: string;
  name?: string;
  props?: Record<string, any>;
  children?: ComponentDefinition[];
  className?: string;
  style?: Record<string, any>;
  events?: Record<string, string>;
  metadata?: Record<string, any>;
}

// Scene 정의
interface SceneDefinition {
  type: 'window' | 'modal' | 'popover' | 'overlay' | 'page';
  title?: string;
  className?: string;
  children?: ComponentDefinition[];
  props?: Record<string, any>;
  state?: Record<string, any>;
  metadata?: Record<string, any>;
}
```
```

## 사용 예제

### 기본 사용법

#### 1. 간단한 대화형 Scene 생성 (권장)

```typescript
import OpenAI from 'openai';
import { Director } from '@barocss/ui';
import { createOpenAIWrapper } from '@barocss/openai';

// Director 초기화
const openai = new OpenAI({ apiKey: 'your-openai-api-key' });
const director = new Director(
  { debug: true },
  createOpenAIWrapper(openai, { model: 'gpt-4' })
);

await director.initialize();

// 간단한 사용법 - 모든 복잡한 로직이 내부에서 처리됨
const loginScene = await director.request("로그인 폼을 만들어줘");
const dashboardScene = await director.request("이제 대시보드를 만들어줘");
const profileScene = await director.request("사용자 프로필 페이지도 추가해줘");

// 대화 이력 확인
const history = director.getConversationHistory();
console.log('생성된 Scene들:', history);

// 현재 대화 체인 확인
const currentChain = director.getCurrentConversationChain();
console.log('대화 체인:', currentChain);
```

#### 2. Claude 사용 예시

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { Director } from '@barocss/ui';
import { createAnthropicWrapper } from '@barocss/anthropic';

const anthropic = new Anthropic({ apiKey: 'your-claude-api-key' });
const director = new Director(
  { debug: true },
  createAnthropicWrapper(anthropic, { model: 'claude-3-sonnet-20240229' })
);

await director.initialize();

// 동일한 간단한 API 사용
const scene1 = await director.request("쇼핑몰 메인 페이지를 만들어줘");
const scene2 = await director.request("상품 목록 페이지도 추가해줘");
const scene3 = await director.request("장바구니 기능도 구현해줘");
```

#### 3. Mock Agent 사용 (개발/테스트)

```typescript
import { Director, createMockAgentCommunicationAdapter } from '@barocss/ui';

// Mock Agent로 테스트
const agentComm = createMockAgentCommunicationAdapter({
  delay: 100,
  errorRate: 0.1
});

const director = new Director({ debug: true }, agentComm);
await director.initialize();

// 테스트용 Scene 생성
const testScene = await director.request("테스트용 폼을 만들어줘");
```

#### 4. 고급 사용법 (기존 Scene 관리)

```typescript
// 고급 사용자를 위한 기존 Scene 관리 API
const customScene = director.createScene({
  type: 'window',
  title: 'Custom Scene',
  component: {
    type: 'div',
    name: 'CustomComponent',
    props: { className: 'custom-component' }
  }
});

// Scene 업데이트
director.updateScene(customScene.id, {
  title: 'Updated Custom Scene'
});

// 모든 Scene 조회
const allScenes = director.getAllScenes();

// 정리
await director.shutdown();
```

### Interaction Layer 사용법

```typescript
// 상태 관리
const stateManager = director.getStateManager();
const conversationManager = director.getConversationManager();

// Scene별 상태 저장
stateManager.setSceneState('scene-1', 'formData', { 
  email: 'user@example.com',
  password: 'password123'
});

// 전역 상태 저장
stateManager.setGlobalState('user', { 
  id: 1, 
  name: 'John Doe',
  role: 'admin'
});

// 대화 컨텍스트 저장
stateManager.setConversationContext('lastAction', 'login');
stateManager.setConversationContext('step', 2);

// 사용자 액션 처리
await conversationManager.handleUserAction(
  'formSubmit',
  { email: 'user@example.com', password: 'password123' },
  'scene-1'
);

// AI 응답 처리
const aiResponse = await director.sendRequest({
  type: 'ai_query',
  payload: { query: 'Create a dashboard for the user' }
});

await conversationManager.processAIResponse(aiResponse);
```

### Rendering Layer 사용법

```typescript
// 렌더러와 프로세서 가져오기
const uiRenderer = director.getUIRenderer();
const sceneProcessor = director.getSceneProcessor();

// AI 응답 렌더링
const aiResponse = await director.sendRequest({
  type: 'ai_query',
  payload: { query: 'Create a login form' }
});

// AI 응답을 UI로 변환
const aiScene = sceneProcessor.processAIResponse(aiResponse);
if (aiScene) {
  await uiRenderer.renderAIScene(aiScene);
}

// HTML + Tailwind 직접 렌더링
await uiRenderer.renderHTML(`
  <div class="max-w-md mx-auto bg-white rounded-xl shadow-md p-6">
    <h2 class="text-2xl font-bold mb-4">Login</h2>
    <form class="space-y-4">
      <input type="email" placeholder="Email" 
             class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
      <button type="submit" 
              class="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors">
        Login
      </button>
    </form>
  </div>
`);

// 컴포넌트 기반 렌더링
const components = [
  {
    type: 'div',
    className: 'max-w-md mx-auto bg-white rounded-xl shadow-md p-6',
    children: [
      {
        type: 'h2',
        content: 'Dashboard',
        className: 'text-2xl font-bold mb-4'
      },
      {
        type: 'button',
        content: 'Click me',
        className: 'bg-blue-500 text-white px-4 py-2 rounded-md',
        events: { click: 'handleClick' }
      }
    ]
  }
];

await uiRenderer.renderComponents(components);
```

### 고급 사용법

```typescript
// 이벤트 구독
const unsubscribe = director.subscribeToEvents((event) => {
  console.log('System event:', event);
});

// 컨텍스트 구독
const unsubscribeContext = director.subscribeContext('global.user', (user) => {
  console.log('User updated:', user);
});

// 스트리밍 요청
const stream = await director.sendStreamRequest(request);
for await (const chunk of stream) {
  console.log('Stream chunk:', chunk);
}
```

## 에러 처리

### 에러 타입

```typescript
// 기본 에러 클래스
class DirectorError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
    public recovery?: RecoveryAction[]
  );
}

// 특화된 에러 클래스들
class ContextError extends DirectorError;
class SceneError extends DirectorError;
class CommunicationError extends DirectorError;
class ValidationError extends DirectorError;
```

### 에러 처리 예제

```typescript
try {
  const response = await director.sendRequest(request);
} catch (error) {
  if (error instanceof CommunicationError) {
    console.error('Communication failed:', error.message);
    // 재연결 시도
    if (error.code === 'CONNECTION_LOST') {
      await director.initialize();
    }
  } else if (error instanceof ValidationError) {
    console.error('Validation failed:', error.details);
  }
}
```

## 성능 최적화

### 메모리 관리

```typescript
// 메모리 사용량 모니터링
const stats = director.getStats();
console.log('Memory usage:', stats.sceneStats.memoryUsage);

// 메모리 정리
if (stats.sceneStats.memoryUsage > threshold) {
  // 오래된 씬들 제거
  const oldScenes = director.getAllScenes()
    .filter(scene => Date.now() - scene.metadata.updatedAt > maxAge);
  oldScenes.forEach(scene => director.removeScene(scene.id));
}
```

### 캐싱

```typescript
// 컨텍스트 캐싱
director.setContext('cache.scene-templates', templates);

// 씬 캐싱
const cachedScene = director.getScene('cached-scene-id');
if (cachedScene) {
  // 캐시된 씬 사용
}
```

## 테스트 지원

### Mock 객체

```typescript
import { createMockDirector } from '@barocss/ui/testing';

const mockOS = createMockDirector({
  // Mock 설정
});
```

### 테스트 유틸리티

```typescript
import { 
  createTestScene, 
  createTestRequest, 
  createTestResponse 
} from '@barocss/ui/testing';

const testScene = createTestScene({
  type: 'window',
  title: 'Test Scene'
});
```
