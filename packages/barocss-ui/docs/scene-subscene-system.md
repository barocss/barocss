# Scene/SubScene 시스템 설계

## 개요

Scene/SubScene 시스템은 AI Agent OS의 핵심 UI 관리 시스템으로, 사용자 인터페이스를 계층적으로 구성하고 관리합니다. 이 시스템은 시나리오 분석을 통해 도출된 요구사항을 충족하도록 설계되었습니다.

## 핵심 개념

### Scene (씬)
- **정의**: 완전한 UI 화면을 나타내는 최상위 컨테이너
- **특징**: 독립적인 생명주기를 가지며, 사용자 요청에 따라 생성/삭제
- **예시**: 온라인 쇼핑몰 메인 페이지, 프로젝트 관리 대시보드

### SubScene (서브씬)
- **정의**: Scene 내의 특정 부분을 나타내는 하위 컨테이너
- **특징**: 부모 Scene에 종속되며, 부분 업데이트 가능
- **예시**: 실시간 차트, 폼 단계, 모달 내용

### Modal (모달)
- **정의**: Scene 위에 오버레이 형태로 표시되는 특별한 SubScene
- **특징**: 독립적인 포커스 관리, 배경 클릭으로 닫기
- **예시**: 프로젝트 상세 정보 모달, 작업 추가 폼

## 시스템 아키텍처

### 1. Scene Manager

```typescript
interface SceneManager {
  // Scene 생명주기
  createScene(config: SceneConfig): Scene
  updateScene(sceneId: string, updates: Partial<SceneConfig>): void
  removeScene(sceneId: string, cascade?: boolean): void
  getScene(sceneId: string): Scene | null
  getAllScenes(): Scene[]
  setActiveScene(sceneId: string | null): void
  getActiveScene(): Scene | null

  // Scene 관계 관리
  setParentScene(sceneId: string, parentId: string): void
  getChildScenes(sceneId: string): Scene[]
  getParentScene(sceneId: string): Scene | null

  // Scene 검증
  validateSceneConsistency(): ValidationResult
  validateSceneHierarchy(): ValidationResult
}
```

### 2. SubScene Manager

```typescript
interface SubSceneManager {
  // SubScene 생명주기
  createSubScene(parentSceneId: string, config: SubSceneConfig): SubScene
  updateSubScene(subSceneId: string, updates: Partial<SubSceneConfig>): void
  removeSubScene(subSceneId: string): void
  getSubScene(subSceneId: string): SubScene | null
  getSubScenesByParent(parentSceneId: string): SubScene[]

  // SubScene 업데이트
  updateSubSceneContent(subSceneId: string, content: any): void
  updateSubSceneState(subSceneId: string, state: Partial<SubSceneState>): void

  // SubScene 간 상호작용
  linkSubScenes(sourceId: string, targetId: string, config: LinkConfig): void
  unlinkSubScenes(sourceId: string, targetId: string): void
  getLinkedSubScenes(subSceneId: string): SubScene[]
}
```

### 3. Modal Manager

```typescript
interface ModalManager {
  // 모달 생명주기
  openModal(config: ModalConfig): Modal
  closeModal(modalId: string): void
  getModal(modalId: string): Modal | null
  getAllModals(): Modal[]

  // 모달 스택 관리
  pushModal(config: ModalConfig): Modal
  popModal(): Modal | null
  getModalStack(): Modal[]

  // 모달 상호작용
  setModalFocus(modalId: string): void
  handleModalEscape(): void
  handleModalBackdropClick(): void
}
```

## 데이터 모델

### Scene 정의

```typescript
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
  
  // 생명주기
  lifecycle: {
    onMount?: () => void
    onUnmount?: () => void
    onUpdate?: (updates: any) => void
    onDestroy?: () => void
  }
}
```

### SubScene 정의

```typescript
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
  
  // 생명주기
  lifecycle: {
    onMount?: () => void
    onUnmount?: () => void
    onUpdate?: (updates: any) => void
    onDestroy?: () => void
  }
}
```

### Modal 정의

```typescript
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

## 상태 관리

### Scene State

```typescript
interface SceneState {
  // UI 상태
  ui: {
    loading: boolean
    error: string | null
    visible: boolean
    focused: boolean
  }
  
  // 폼 상태
  forms: Record<string, FormState>
  
  // 컴포넌트 상태
  components: Record<string, ComponentState>
  
  // 사용자 상호작용 상태
  interactions: {
    lastAction: string | null
    lastActionTime: number
    actionHistory: ActionHistory[]
  }
  
  // AI 연동 상태
  ai: {
    lastRequest: string | null
    lastResponse: any | null
    conversationContext: ConversationContext
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
  }
  
  // 데이터 상태
  data: Record<string, any>
  
  // 업데이트 상태
  update: {
    lastUpdate: number
    updateCount: number
    pendingUpdates: UpdateQueue[]
  }
  
  // 연결 상태
  connections: {
    linkedSubScenes: string[]
    eventListeners: EventListener[]
  }
}
```

## 렌더링 시스템

### Scene 렌더링

```typescript
interface SceneRenderer {
  // Scene 렌더링
  renderScene(scene: Scene, container: HTMLElement): void
  updateScene(sceneId: string, updates: Partial<Scene>): void
  destroyScene(sceneId: string): void
  
  // SubScene 렌더링
  renderSubScene(subScene: SubScene, parentElement: HTMLElement): void
  updateSubScene(subSceneId: string, updates: Partial<SubScene>): void
  destroySubScene(subSceneId: string): void
  
  // 모달 렌더링
  renderModal(modal: Modal): void
  updateModal(modalId: string, updates: Partial<Modal>): void
  destroyModal(modalId: string): void
}
```

### 부분 업데이트 엔진

```typescript
interface PartialUpdateEngine {
  // DOM 업데이트
  updateElement(selector: string, content: string | HTMLElement): void
  updateAttribute(selector: string, attribute: string, value: any): void
  updateStyle(selector: string, styles: Record<string, any>): void
  
  // SubScene 업데이트
  updateSubSceneContent(subSceneId: string, content: any): void
  updateSubSceneState(subSceneId: string, state: Partial<SubSceneState>): void
  
  // 배치 업데이트
  batchUpdate(updates: UpdateOperation[]): void
  
  // 애니메이션
  animateUpdate(element: HTMLElement, changes: any, options?: AnimationOptions): Promise<void>
}
```

## 이벤트 시스템

### Scene 이벤트

```typescript
interface SceneEvent {
  type: 'scene:created' | 'scene:updated' | 'scene:destroyed' | 'scene:activated' | 'scene:deactivated'
  sceneId: string
  data: any
  timestamp: number
}

interface SubSceneEvent {
  type: 'subscene:created' | 'subscene:updated' | 'subscene:destroyed' | 'subscene:linked' | 'subscene:unlinked'
  subSceneId: string
  parentSceneId: string
  data: any
  timestamp: number
}

interface ModalEvent {
  type: 'modal:opened' | 'modal:closed' | 'modal:focus' | 'modal:blur'
  modalId: string
  data: any
  timestamp: number
}
```

### 이벤트 핸들러

```typescript
interface EventHandler {
  // 이벤트 구독
  subscribe(eventType: string, callback: EventCallback): () => void
  subscribeToScene(sceneId: string, eventType: string, callback: EventCallback): () => void
  subscribeToSubScene(subSceneId: string, eventType: string, callback: EventCallback): () => void
  
  // 이벤트 발생
  emit(event: SceneEvent | SubSceneEvent | ModalEvent): void
  emitToScene(sceneId: string, event: any): void
  emitToSubScene(subSceneId: string, event: any): void
  
  // 이벤트 전파
  propagate(event: any, from: string, to: string[]): void
}
```

## 사용 예시

### 1. 기본 Scene 생성

```typescript
// Scene 생성
const scene = sceneManager.createScene({
  id: 'shopping-mall',
  type: 'main',
  title: '온라인 쇼핑몰',
  ui: {
    type: 'html',
    content: '<div class="shopping-mall">...</div>'
  },
  state: {
    ui: { loading: false, error: null, visible: true, focused: true },
    forms: {},
    components: {},
    interactions: { lastAction: null, lastActionTime: 0, actionHistory: [] },
    ai: { lastRequest: null, lastResponse: null, conversationContext: {} }
  }
});
```

### 2. SubScene 생성 및 업데이트

```typescript
// SubScene 생성
const subScene = subSceneManager.createSubScene('shopping-mall', {
  id: 'product-list',
  type: 'partial',
  selector: '#product-list',
  ui: {
    type: 'html',
    content: '<div class="product-list">...</div>',
    updateMode: 'replace'
  },
  state: {
    ui: { loading: false, error: null, visible: true, updated: false },
    data: { products: [] },
    update: { lastUpdate: 0, updateCount: 0, pendingUpdates: [] },
    connections: { linkedSubScenes: [], eventListeners: [] }
  }
});

// SubScene 업데이트
subSceneManager.updateSubSceneContent('product-list', {
  type: 'html',
  content: '<div class="product-list">업데이트된 상품 목록...</div>'
});
```

### 3. 모달 생성

```typescript
// 모달 생성
const modal = modalManager.openModal({
  id: 'product-detail',
  parentSceneId: 'shopping-mall',
  type: 'modal',
  selector: '#modal-container',
  ui: {
    type: 'html',
    content: '<div class="modal">상품 상세 정보...</div>'
  },
  config: {
    backdrop: true,
    closable: true,
    keyboard: true,
    focus: true,
    size: 'lg',
    position: 'center',
    animation: 'fade'
  }
});
```

이러한 Scene/SubScene 시스템을 통해 시나리오에서 요구하는 다양한 UI 패턴을 효율적으로 구현할 수 있습니다.
