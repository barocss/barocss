# 상태 관리 시스템 설계

## 개요

상태 관리 시스템은 Director의 모든 상태를 중앙에서 관리하고, Scene/SubScene 간 상태 공유와 동기화를 담당합니다. 시나리오 분석을 통해 도출된 다층적 상태 관리 요구사항을 충족하도록 설계되었습니다.

## 핵심 개념

### 상태 계층 구조
```
Global State (전역 상태)
├── Application State (앱 상태)
├── User State (사용자 상태)
└── System State (시스템 상태)

Scene State (씬 상태)
├── UI State (UI 상태)
├── Form State (폼 상태)
├── Component State (컴포넌트 상태)
└── Interaction State (상호작용 상태)

SubScene State (서브씬 상태)
├── Data State (데이터 상태)
├── Update State (업데이트 상태)
└── Connection State (연결 상태)

Temporary State (임시 상태)
├── Request State (요청 상태)
├── Cache State (캐시 상태)
└── Session State (세션 상태)
```

## 시스템 아키텍처

### 1. State Manager

```typescript
interface StateManager {
  // Global State 관리
  getGlobalState(): GlobalState
  setGlobalState(state: Partial<GlobalState>): void
  updateGlobalState(updater: (state: GlobalState) => GlobalState): void
  
  // Scene State 관리
  getSceneState(sceneId: string): SceneState | null
  setSceneState(sceneId: string, state: Partial<SceneState>): void
  updateSceneState(sceneId: string, updater: (state: SceneState) => SceneState): void
  
  // SubScene State 관리
  getSubSceneState(subSceneId: string): SubSceneState | null
  setSubSceneState(subSceneId: string, state: Partial<SubSceneState>): void
  updateSubSceneState(subSceneId: string, updater: (state: SubSceneState) => SubSceneState): void
  
  // 상태 구독
  subscribeToState(path: string, callback: StateCallback): () => void
  subscribeToGlobalState(callback: GlobalStateCallback): () => void
  subscribeToSceneState(sceneId: string, callback: SceneStateCallback): () => void
  subscribeToSubSceneState(subSceneId: string, callback: SubSceneStateCallback): () => void
  
  // 상태 동기화
  syncStates(source: string, target: string, mapping?: StateMapping): void
  linkStates(sourcePath: string, targetPath: string, transform?: StateTransform): void
  
  // 상태 검증
  validateState(state: any, schema: StateSchema): ValidationResult
  validateStateConsistency(): ValidationResult
}
```

### 2. Global State Manager

```typescript
interface GlobalStateManager {
  // Application State
  getApplicationState(): ApplicationState
  setApplicationState(state: Partial<ApplicationState>): void
  
  // User State
  getUserState(): UserState
  setUserState(state: Partial<UserState>): void
  
  // System State
  getSystemState(): SystemState
  setSystemState(state: Partial<SystemState>): void
  
  // 상태 지속성
  persistState(): void
  restoreState(): void
  clearState(): void
}
```

### 3. Scene State Manager

```typescript
interface SceneStateManager {
  // Scene별 상태 관리
  createSceneState(sceneId: string, initialState: Partial<SceneState>): void
  getSceneState(sceneId: string): SceneState | null
  updateSceneState(sceneId: string, updates: Partial<SceneState>): void
  deleteSceneState(sceneId: string): void
  
  // 폼 상태 관리
  getFormState(sceneId: string, formId: string): FormState | null
  setFormState(sceneId: string, formId: string, state: Partial<FormState>): void
  validateFormState(sceneId: string, formId: string): ValidationResult
  
  // 컴포넌트 상태 관리
  getComponentState(sceneId: string, componentId: string): ComponentState | null
  setComponentState(sceneId: string, componentId: string, state: Partial<ComponentState>): void
}
```

### 4. SubScene State Manager

```typescript
interface SubSceneStateManager {
  // SubScene별 상태 관리
  createSubSceneState(subSceneId: string, parentSceneId: string, initialState: Partial<SubSceneState>): void
  getSubSceneState(subSceneId: string): SubSceneState | null
  updateSubSceneState(subSceneId: string, updates: Partial<SubSceneState>): void
  deleteSubSceneState(subSceneId: string): void
  
  // 상태 연결
  linkSubSceneStates(sourceId: string, targetId: string, config: LinkConfig): void
  unlinkSubSceneStates(sourceId: string, targetId: string): void
  
  // 실시간 업데이트
  enableAutoUpdate(subSceneId: string, interval: number): void
  disableAutoUpdate(subSceneId: string): void
}
```

## 데이터 모델

### Global State

```typescript
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

interface SystemState {
  performance: PerformanceState
  memory: MemoryState
  network: NetworkState
  errors: ErrorState[]
}
```

### Scene State

```typescript
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
  
  // 메타데이터
  metadata: {
    createdAt: number
    updatedAt: number
    version: number
    tags: string[]
  }
}
```

### SubScene State

```typescript
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
  
  // 메타데이터
  metadata: {
    createdAt: number
    updatedAt: number
    version: number
    parentSceneId: string
  }
}
```

### Form State

```typescript
interface FormState {
  // 폼 데이터
  data: Record<string, any>
  
  // 유효성 검사
  validation: {
    isValid: boolean
    errors: Record<string, string[]>
    warnings: Record<string, string[]>
    touched: Record<string, boolean>
    dirty: Record<string, boolean>
  }
  
  // 폼 상태
  status: {
    isSubmitting: boolean
    isDirty: boolean
    isTouched: boolean
    isSubmitted: boolean
  }
  
  // 필드 상태
  fields: Record<string, FieldState>
}

interface FieldState {
  value: any
  error: string | null
  warning: string | null
  touched: boolean
  dirty: boolean
  focused: boolean
  disabled: boolean
  required: boolean
}
```

## 상태 동기화

### 1. 상태 연결 (State Linking)

```typescript
interface StateLink {
  id: string
  source: {
    path: string
    sceneId?: string
    subSceneId?: string
  }
  target: {
    path: string
    sceneId?: string
    subSceneId?: string
  }
  transform?: StateTransform
  bidirectional: boolean
  debounce?: number
}

interface StateTransform {
  input: (value: any) => any
  output: (value: any) => any
  validate?: (value: any) => boolean
}
```

### 2. 상태 전파 (State Propagation)

```typescript
interface StatePropagation {
  // 상태 전파
  propagate(source: string, target: string[], data: any): void
  propagateToScene(sceneId: string, data: any): void
  propagateToSubScene(subSceneId: string, data: any): void
  
  // 상태 브로드캐스트
  broadcast(data: any, filter?: StateFilter): void
  broadcastToScenes(data: any, sceneIds: string[]): void
  broadcastToSubScenes(data: any, subSceneIds: string[]): void
  
  // 상태 수집
  collectFromScenes(sceneIds: string[], aggregator: StateAggregator): any
  collectFromSubScenes(subSceneIds: string[], aggregator: StateAggregator): any
}
```

### 3. 상태 캐싱

```typescript
interface StateCache {
  // 캐시 관리
  set(key: string, value: any, ttl?: number): void
  get(key: string): any | null
  delete(key: string): void
  clear(): void
  
  // 캐시 전략
  strategy: 'lru' | 'lfu' | 'fifo' | 'ttl'
  maxSize: number
  defaultTTL: number
  
  // 캐시 통계
  getStats(): CacheStats
}
```

## 이벤트 시스템

### 1. 상태 변경 이벤트

```typescript
interface StateChangeEvent {
  type: 'state:changed'
  path: string
  oldValue: any
  newValue: any
  timestamp: number
  source: string
}

interface StateSubscriptionEvent {
  type: 'state:subscribed' | 'state:unsubscribed'
  path: string
  subscriber: string
  timestamp: number
}
```

### 2. 상태 동기화 이벤트

```typescript
interface StateSyncEvent {
  type: 'state:synced'
  source: string
  target: string
  data: any
  timestamp: number
}

interface StateLinkEvent {
  type: 'state:linked' | 'state:unlinked'
  linkId: string
  source: string
  target: string
  timestamp: number
}
```

## 성능 최적화

### 1. 상태 업데이트 최적화

```typescript
interface StateOptimization {
  // 배치 업데이트
  batchUpdate(updates: StateUpdate[]): void
  
  // 디바운싱
  debounceUpdate(path: string, delay: number): void
  
  // 쓰로틀링
  throttleUpdate(path: string, interval: number): void
  
  // 메모이제이션
  memoizeComputedValue(path: string, computeFn: () => any): any
}
```

### 2. 메모리 관리

```typescript
interface MemoryManagement {
  // 상태 정리
  cleanupUnusedStates(): void
  cleanupExpiredStates(): void
  
  // 메모리 사용량 모니터링
  getMemoryUsage(): MemoryUsage
  getStateSize(state: any): number
  
  // 가비지 컬렉션
  forceGarbageCollection(): void
}
```

## 사용 예시

### 1. 기본 상태 관리

```typescript
// Global State 설정
stateManager.setGlobalState({
  user: {
    id: 'john@example.com',
    role: 'admin',
    permissions: ['read', 'write'],
    preferences: { theme: 'dark', language: 'ko' }
  }
});

// Scene State 설정
stateManager.setSceneState('shopping-mall', {
  ui: { loading: false, error: null, visible: true, focused: true },
  forms: {
    'product-search': {
      data: { query: '', category: 'all' },
      validation: { isValid: true, errors: {}, warnings: {}, touched: {}, dirty: {} },
      status: { isSubmitting: false, isDirty: false, isTouched: false, isSubmitted: false }
    }
  },
  components: {},
  interactions: { lastAction: null, lastActionTime: 0, actionHistory: [] },
  ai: { lastRequest: null, lastResponse: null, conversationContext: {} }
});
```

### 2. 상태 구독

```typescript
// Global State 구독
const unsubscribeGlobal = stateManager.subscribeToGlobalState((state) => {
  console.log('Global state changed:', state);
});

// Scene State 구독
const unsubscribeScene = stateManager.subscribeToSceneState('shopping-mall', (state) => {
  console.log('Scene state changed:', state);
});

// 특정 경로 구독
const unsubscribePath = stateManager.subscribeToState('user.preferences.theme', (theme) => {
  document.body.className = theme;
});
```

### 3. 상태 동기화

```typescript
// SubScene 간 상태 연결
stateManager.linkStates(
  'shopping-mall.product-list.selectedProduct',
  'shopping-mall.product-detail.currentProduct',
  {
    input: (product) => product,
    output: (product) => product,
    validate: (product) => product && product.id
  }
);

// 상태 전파
stateManager.propagate(
  'shopping-mall.product-list',
  ['shopping-mall.cart', 'shopping-mall.recommendations'],
  { selectedProduct: product }
);
```

### 4. 폼 상태 관리

```typescript
// 폼 상태 업데이트
stateManager.setFormState('shopping-mall', 'product-search', {
  data: { query: 'iPhone', category: 'electronics' },
  validation: {
    isValid: true,
    errors: {},
    warnings: {},
    touched: { query: true, category: true },
    dirty: { query: true, category: false }
  },
  status: {
    isSubmitting: false,
    isDirty: true,
    isTouched: true,
    isSubmitted: false
  }
});

// 폼 유효성 검사
const validation = stateManager.validateFormState('shopping-mall', 'product-search');
if (!validation.isValid) {
  console.log('Form validation errors:', validation.errors);
}
```

이러한 상태 관리 시스템을 통해 시나리오에서 요구하는 복잡한 상태 관리와 동기화를 효율적으로 처리할 수 있습니다.
