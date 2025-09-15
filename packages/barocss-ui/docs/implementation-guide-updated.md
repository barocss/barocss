# Director 구현 가이드 (업데이트)

## 개요

이 문서는 시나리오 분석을 통해 도출된 요구사항을 바탕으로 Director의 구현 방법을 상세히 설명합니다. Scene/SubScene 시스템, 상태 관리, 렌더링 시스템의 실제 구현 방법을 다룹니다.

## 구현 단계

### Phase 1: 핵심 Scene 시스템 구현

#### 1.1 Scene Manager 구현

```typescript
// src/core/scene-manager.ts
export class SceneManager {
  private scenes: Map<string, Scene> = new Map();
  private activeSceneId: string | null = null;
  private eventEmitter: EventEmitter = new EventEmitter();

  constructor(private stateManager: StateManager) {}

  // Scene 생성
  createScene(config: SceneConfig): Scene {
    const scene: Scene = {
      id: config.id || this.generateId(),
      type: config.type || 'main',
      title: config.title || 'Untitled Scene',
      status: 'inactive',
      ui: config.ui,
      state: this.initializeSceneState(config.initialState),
      formData: config.formData || {},
      parentId: config.parentId,
      childIds: [],
      subSceneIds: [],
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        tags: config.tags || [],
        permissions: config.permissions || []
      },
      lifecycle: config.lifecycle || {}
    };

    this.scenes.set(scene.id, scene);
    this.eventEmitter.emit('scene:created', { sceneId: scene.id, scene });
    
    return scene;
  }

  // Scene 업데이트
  updateScene(sceneId: string, updates: Partial<SceneConfig>): void {
    const scene = this.scenes.get(sceneId);
    if (!scene) throw new Error(`Scene ${sceneId} not found`);

    const updatedScene = {
      ...scene,
      ...updates,
      metadata: {
        ...scene.metadata,
        updatedAt: Date.now(),
        version: scene.metadata.version + 1
      }
    };

    this.scenes.set(sceneId, updatedScene);
    this.eventEmitter.emit('scene:updated', { sceneId, updates, scene: updatedScene });
  }

  // Scene 활성화
  setActiveScene(sceneId: string | null): void {
    const previousActiveScene = this.activeSceneId;
    this.activeSceneId = sceneId;
    
    if (previousActiveScene) {
      this.updateScene(previousActiveScene, { status: 'inactive' });
    }
    
    if (sceneId) {
      this.updateScene(sceneId, { status: 'active' });
    }
    
    this.eventEmitter.emit('scene:activated', { sceneId, previousSceneId: previousActiveScene });
  }

  // Scene 상태 초기화
  private initializeSceneState(initialState?: Partial<SceneState>): SceneState {
    return {
      ui: {
        loading: false,
        error: null,
        visible: true,
        focused: false,
        scrollPosition: { x: 0, y: 0 }
      },
      forms: {},
      components: {},
      interactions: {
        lastAction: null,
        lastActionTime: 0,
        actionHistory: [],
        hoveredElement: null,
        selectedElement: null
      },
      ai: {
        lastRequest: null,
        lastResponse: null,
        conversationContext: {},
        isLoading: false,
        error: null
      },
      ...initialState
    };
  }

  private generateId(): string {
    return `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

#### 1.2 SubScene Manager 구현

```typescript
// src/core/subscene-manager.ts
export class SubSceneManager {
  private subScenes: Map<string, SubScene> = new Map();
  private eventEmitter: EventEmitter = new EventEmitter();

  constructor(private stateManager: StateManager) {}

  // SubScene 생성
  createSubScene(parentSceneId: string, config: SubSceneConfig): SubScene {
    const subScene: SubScene = {
      id: config.id || this.generateId(),
      parentSceneId,
      type: config.type || 'partial',
      selector: config.selector,
      ui: config.ui,
      state: this.initializeSubSceneState(config.initialState),
      formData: config.formData || {},
      linkedSubScenes: [],
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        autoUpdate: config.autoUpdate || false,
        updateInterval: config.updateInterval
      },
      lifecycle: config.lifecycle || {}
    };

    this.subScenes.set(subScene.id, subScene);
    this.eventEmitter.emit('subscene:created', { subSceneId: subScene.id, subScene });
    
    return subScene;
  }

  // SubScene 업데이트
  updateSubScene(subSceneId: string, updates: Partial<SubSceneConfig>): void {
    const subScene = this.subScenes.get(subSceneId);
    if (!subScene) throw new Error(`SubScene ${subSceneId} not found`);

    const updatedSubScene = {
      ...subScene,
      ...updates,
      metadata: {
        ...subScene.metadata,
        updatedAt: Date.now(),
        version: subScene.metadata.version + 1
      }
    };

    this.subScenes.set(subSceneId, updatedSubScene);
    this.eventEmitter.emit('subscene:updated', { subSceneId, updates, subScene: updatedSubScene });
  }

  // SubScene 내용 업데이트
  updateSubSceneContent(subSceneId: string, content: any): void {
    const subScene = this.subScenes.get(subSceneId);
    if (!subScene) throw new Error(`SubScene ${subSceneId} not found`);

    const updatedSubScene = {
      ...subScene,
      ui: {
        ...subScene.ui,
        content
      },
      state: {
        ...subScene.state,
        ui: {
          ...subScene.state.ui,
          updated: true
        },
        update: {
          ...subScene.state.update,
          lastUpdate: Date.now(),
          updateCount: subScene.state.update.updateCount + 1
        }
      },
      metadata: {
        ...subScene.metadata,
        updatedAt: Date.now(),
        version: subScene.metadata.version + 1
      }
    };

    this.subScenes.set(subSceneId, updatedSubScene);
    this.eventEmitter.emit('subscene:content-updated', { subSceneId, content, subScene: updatedSubScene });
  }

  // SubScene 상태 초기화
  private initializeSubSceneState(initialState?: Partial<SubSceneState>): SubSceneState {
    return {
      ui: {
        loading: false,
        error: null,
        visible: true,
        updated: false,
        animation: null
      },
      data: {},
      update: {
        lastUpdate: 0,
        updateCount: 0,
        pendingUpdates: [],
        autoUpdate: false,
        updateInterval: null
      },
      connections: {
        linkedSubScenes: [],
        eventListeners: [],
        dataBindings: []
      },
      ...initialState
    };
  }

  private generateId(): string {
    return `subscene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### Phase 2: 상태 관리 시스템 구현

#### 2.1 State Manager 구현

```typescript
// src/core/state-manager.ts
export class StateManager {
  private globalState: GlobalState;
  private sceneStates: Map<string, SceneState> = new Map();
  private subSceneStates: Map<string, SubSceneState> = new Map();
  private subscriptions: Map<string, Set<StateCallback>> = new Map();
  private eventEmitter: EventEmitter = new EventEmitter();

  constructor() {
    this.globalState = this.initializeGlobalState();
  }

  // Global State 관리
  getGlobalState(): GlobalState {
    return { ...this.globalState };
  }

  setGlobalState(state: Partial<GlobalState>): void {
    const oldState = { ...this.globalState };
    this.globalState = { ...this.globalState, ...state };
    this.notifyStateChange('global', oldState, this.globalState);
  }

  updateGlobalState(updater: (state: GlobalState) => GlobalState): void {
    const oldState = { ...this.globalState };
    this.globalState = updater(this.globalState);
    this.notifyStateChange('global', oldState, this.globalState);
  }

  // Scene State 관리
  getSceneState(sceneId: string): SceneState | null {
    return this.sceneStates.get(sceneId) || null;
  }

  setSceneState(sceneId: string, state: Partial<SceneState>): void {
    const oldState = this.sceneStates.get(sceneId);
    const newState = { ...oldState, ...state };
    this.sceneStates.set(sceneId, newState);
    this.notifyStateChange(`scene.${sceneId}`, oldState, newState);
  }

  updateSceneState(sceneId: string, updater: (state: SceneState) => SceneState): void {
    const oldState = this.sceneStates.get(sceneId);
    if (!oldState) return;
    
    const newState = updater(oldState);
    this.sceneStates.set(sceneId, newState);
    this.notifyStateChange(`scene.${sceneId}`, oldState, newState);
  }

  // SubScene State 관리
  getSubSceneState(subSceneId: string): SubSceneState | null {
    return this.subSceneStates.get(subSceneId) || null;
  }

  setSubSceneState(subSceneId: string, state: Partial<SubSceneState>): void {
    const oldState = this.subSceneStates.get(subSceneId);
    const newState = { ...oldState, ...state };
    this.subSceneStates.set(subSceneId, newState);
    this.notifyStateChange(`subscene.${subSceneId}`, oldState, newState);
  }

  // 상태 구독
  subscribeToState(path: string, callback: StateCallback): () => void {
    if (!this.subscriptions.has(path)) {
      this.subscriptions.set(path, new Set());
    }
    this.subscriptions.get(path)!.add(callback);

    return () => {
      const callbacks = this.subscriptions.get(path);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(path);
        }
      }
    };
  }

  // 상태 변경 알림
  private notifyStateChange(path: string, oldState: any, newState: any): void {
    this.eventEmitter.emit('state:changed', { path, oldState, newState, timestamp: Date.now() });
    
    const callbacks = this.subscriptions.get(path);
    if (callbacks) {
      callbacks.forEach(callback => callback(newState, oldState));
    }
  }

  // Global State 초기화
  private initializeGlobalState(): GlobalState {
    return {
      application: {
        version: '1.0.0',
        environment: 'development',
        build: '1.0.0',
        features: {},
        theme: 'light',
        language: 'ko',
        timezone: 'Asia/Seoul'
      },
      user: {
        id: 'anonymous',
        role: 'user',
        permissions: [],
        preferences: {},
        session: { isActive: false, lastActivity: Date.now() },
        profile: {}
      },
      system: {
        performance: { memoryUsage: 0, cpuUsage: 0 },
        memory: { used: 0, total: 0 },
        network: { status: 'online', latency: 0 },
        errors: []
      }
    };
  }
}
```

### Phase 3: 렌더링 시스템 구현

#### 3.1 Hybrid Renderer 구현

```typescript
// src/core/hybrid-renderer.ts
export class HybridRenderer {
  private partialUpdateEngine: PartialUpdateEngine;
  private animationEngine: AnimationEngine;
  private virtualDOM: VirtualDOM;

  constructor() {
    this.partialUpdateEngine = new PartialUpdateEngine();
    this.animationEngine = new AnimationEngine();
    this.virtualDOM = new VirtualDOM();
  }

  // 메인 렌더링 메서드
  render(content: RenderContent, container: HTMLElement, options?: RenderOptions): void {
    switch (content.type) {
      case 'html':
        this.renderHTML(content.content as string, container, options);
        break;
      case 'components':
        this.renderComponents(content.content as ComponentDefinition[], container, options);
        break;
      case 'json':
        this.renderJSON(content.content, container, options);
        break;
      case 'scene':
        this.renderScene(content.content as Scene, container, options);
        break;
      default:
        throw new Error(`Unsupported render content type: ${content.type}`);
    }
  }

  // HTML 렌더링
  renderHTML(html: string, container: HTMLElement, options?: HTMLRenderOptions): void {
    try {
      // HTML 파싱 및 검증
      const parsedHTML = this.parseHTML(html);
      
      // 스타일 적용
      if (options?.styles) {
        this.applyStyles(parsedHTML, options.styles);
      }
      
      // DOM 삽입
      container.innerHTML = parsedHTML.outerHTML;
      
      // 이벤트 바인딩
      if (options?.events) {
        this.bindEvents(container, options.events);
      }
      
      // 생명주기 실행
      this.executeLifecycle(container, options?.lifecycle);
      
    } catch (error) {
      console.error('HTML rendering failed:', error);
      throw error;
    }
  }

  // 컴포넌트 렌더링
  renderComponents(components: ComponentDefinition[], container: HTMLElement, options?: ComponentRenderOptions): void {
    try {
      // 컴포넌트 해석
      const resolvedComponents = this.resolveComponents(components);
      
      // 가상 DOM 생성
      const vnodes = resolvedComponents.map(comp => this.virtualDOM.createElement(
        comp.type,
        comp.props,
        comp.children?.map(child => this.virtualDOM.createElement(
          child.type,
          child.props,
          child.children
        ))
      ));
      
      // DOM 렌더링
      vnodes.forEach(vnode => {
        this.virtualDOM.render(vnode, container);
      });
      
      // 이벤트 바인딩
      this.bindComponentEvents(container, resolvedComponents);
      
    } catch (error) {
      console.error('Component rendering failed:', error);
      throw error;
    }
  }

  // 부분 업데이트
  updateElement(selector: string, content: string | HTMLElement): void {
    this.partialUpdateEngine.updateElement(selector, content);
  }

  updateSubScene(subSceneId: string, content: any): void {
    this.partialUpdateEngine.updateSubSceneContent(subSceneId, content);
  }

  // HTML 파싱
  private parseHTML(html: string): HTMLElement {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return doc.body.firstElementChild as HTMLElement;
  }

  // 스타일 적용
  private applyStyles(element: HTMLElement, styles: Record<string, any>): void {
    Object.entries(styles).forEach(([selector, style]) => {
      const elements = element.querySelectorAll(selector);
      elements.forEach(el => {
        Object.assign((el as HTMLElement).style, style);
      });
    });
  }

  // 이벤트 바인딩
  private bindEvents(container: HTMLElement, events: Record<string, string>): void {
    Object.entries(events).forEach(([selector, eventHandler]) => {
      const elements = container.querySelectorAll(selector);
      elements.forEach(el => {
        const [eventType, handlerName] = eventHandler.split(':');
        el.addEventListener(eventType, (e) => {
          this.handleEvent(handlerName, e);
        });
      });
    });
  }

  // 이벤트 처리
  private handleEvent(handlerName: string, event: Event): void {
    // 이벤트 핸들러 로직 구현
    console.log(`Event ${handlerName} triggered:`, event);
  }
}
```

#### 3.2 Partial Update Engine 구현

```typescript
// src/core/partial-update-engine.ts
export class PartialUpdateEngine {
  private updateQueue: UpdateOperation[] = [];
  private isProcessing = false;

  // 요소 업데이트
  updateElement(selector: string, content: string | HTMLElement): void {
    const element = document.querySelector(selector);
    if (!element) {
      console.warn(`Element not found: ${selector}`);
      return;
    }

    if (typeof content === 'string') {
      element.innerHTML = content;
    } else {
      element.innerHTML = '';
      element.appendChild(content);
    }
  }

  // 속성 업데이트
  updateAttribute(selector: string, attribute: string, value: any): void {
    const element = document.querySelector(selector);
    if (!element) return;

    element.setAttribute(attribute, value);
  }

  // 스타일 업데이트
  updateStyle(selector: string, styles: Record<string, any>): void {
    const element = document.querySelector(selector) as HTMLElement;
    if (!element) return;

    Object.assign(element.style, styles);
  }

  // 텍스트 업데이트
  updateText(selector: string, text: string): void {
    const element = document.querySelector(selector);
    if (!element) return;

    element.textContent = text;
  }

  // SubScene 업데이트
  updateSubSceneContent(subSceneId: string, content: any): void {
    // SubScene 업데이트 로직 구현
    console.log(`Updating SubScene ${subSceneId}:`, content);
  }

  // 배치 업데이트
  batchUpdate(updates: UpdateOperation[]): void {
    this.updateQueue.push(...updates);
    this.processUpdateQueue();
  }

  // 업데이트 큐 처리
  private async processUpdateQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.updateQueue.length > 0) {
      const update = this.updateQueue.shift();
      if (update) {
        await this.executeUpdate(update);
      }
    }

    this.isProcessing = false;
  }

  // 업데이트 실행
  private async executeUpdate(update: UpdateOperation): Promise<void> {
    try {
      switch (update.type) {
        case 'element':
          this.updateElement(update.target, update.content);
          break;
        case 'attribute':
          this.updateAttribute(update.target, update.content.attribute, update.content.value);
          break;
        case 'style':
          this.updateStyle(update.target, update.content);
          break;
        case 'text':
          this.updateText(update.target, update.content);
          break;
        case 'subscene':
          this.updateSubSceneContent(update.target, update.content);
          break;
        default:
          console.warn(`Unknown update type: ${update.type}`);
      }
    } catch (error) {
      console.error(`Update failed for ${update.type}:`, error);
    }
  }
}
```

### Phase 4: 통합 및 최적화

#### 4.1 AIAgentOS 통합

```typescript
// src/core/ai-agent-os.ts
export class AIAgentOS {
  private sceneManager: SceneManager;
  private subSceneManager: SubSceneManager;
  private modalManager: ModalManager;
  private stateManager: StateManager;
  private renderer: HybridRenderer;
  private animationEngine: AnimationEngine;
  private eventEmitter: EventEmitter;

  constructor(config?: Partial<AIAgentOSConfig>, agentCommunication?: AgentCommunicationInterface | ThirdPartyAgent) {
    this.stateManager = new StateManager();
    this.sceneManager = new SceneManager(this.stateManager);
    this.subSceneManager = new SubSceneManager(this.stateManager);
    this.modalManager = new ModalManager(this.stateManager);
    this.renderer = new HybridRenderer();
    this.animationEngine = new AnimationEngine();
    this.eventEmitter = new EventEmitter();
  }

  // 메인 API - 사용자 요청 처리
  async request(userInput: string): Promise<Scene> {
    try {
      // 1. 현재 상태 수집
      const currentState = this.collectCurrentState();
      
      // 2. AI 요청 생성
      const aiRequest = this.buildAIRequest(userInput, currentState);
      
      // 3. AI 응답 받기
      const aiResponse = await this.sendAIRequest(aiRequest);
      
      // 4. Scene 생성
      const scene = this.createSceneFromAIResponse(aiResponse);
      
      // 5. 렌더링
      this.renderScene(scene);
      
      return scene;
      
    } catch (error) {
      console.error('Request failed:', error);
      throw error;
    }
  }

  // Scene 생성
  createScene(config: SceneConfig): Scene {
    return this.sceneManager.createScene(config);
  }

  // SubScene 생성
  createSubScene(parentSceneId: string, config: SubSceneConfig): SubScene {
    return this.subSceneManager.createSubScene(parentSceneId, config);
  }

  // 모달 열기
  openModal(config: ModalConfig): Modal {
    return this.modalManager.openModal(config);
  }

  // 상태 관리
  getGlobalState(): GlobalState {
    return this.stateManager.getGlobalState();
  }

  setGlobalState(state: Partial<GlobalState>): void {
    this.stateManager.setGlobalState(state);
  }

  // 렌더링
  render(content: RenderContent, container: HTMLElement, options?: RenderOptions): void {
    this.renderer.render(content, container, options);
  }

  updateElement(selector: string, content: string | HTMLElement): void {
    this.renderer.updateElement(selector, content);
  }

  // 애니메이션
  async fadeIn(element: HTMLElement, duration?: number): Promise<void> {
    return this.animationEngine.fadeIn(element, duration);
  }

  async fadeOut(element: HTMLElement, duration?: number): Promise<void> {
    return this.animationEngine.fadeOut(element, duration);
  }

  // 현재 상태 수집
  private collectCurrentState(): any {
    return {
      global: this.stateManager.getGlobalState(),
      scenes: Array.from(this.sceneManager.getAllScenes()),
      subScenes: Array.from(this.subSceneManager.getAllSubScenes()),
      modals: Array.from(this.modalManager.getAllModals())
    };
  }

  // AI 요청 생성
  private buildAIRequest(userInput: string, currentState: any): any {
    return {
      input: userInput,
      context: currentState,
      timestamp: Date.now()
    };
  }

  // AI 요청 전송
  private async sendAIRequest(request: any): Promise<any> {
    // AI 요청 로직 구현
    return { ui: { type: 'html', content: '<div>AI Response</div>' } };
  }

  // AI 응답으로부터 Scene 생성
  private createSceneFromAIResponse(response: any): Scene {
    return this.sceneManager.createScene({
      id: `scene_${Date.now()}`,
      title: 'AI Generated Scene',
      ui: response.ui
    });
  }

  // Scene 렌더링
  private renderScene(scene: Scene): void {
    const container = document.getElementById('app');
    if (container) {
      this.renderer.render(scene.ui, container);
    }
  }
}
```

## 사용 예시

### 1. 기본 사용법

```typescript
// Director 초기화
const director = new AIAgentOS({
  theme: 'light',
  language: 'ko'
});

// 사용자 요청 처리
const scene = await director.request('온라인 쇼핑몰을 만들어줘');
```

### 2. SubScene 사용법

```typescript
// SubScene 생성
const subScene = director.createSubScene('shopping-mall', {
  id: 'product-list',
  type: 'partial',
  selector: '#product-list',
  ui: {
    type: 'html',
    content: '<div class="product-list">상품 목록...</div>',
    updateMode: 'replace'
  }
});

// SubScene 업데이트
director.updateSubScene('product-list', {
  ui: {
    content: '<div class="product-list">업데이트된 상품 목록...</div>'
  }
});
```

### 3. 모달 사용법

```typescript
// 모달 열기
const modal = director.openModal({
  id: 'product-detail',
  parentSceneId: 'shopping-mall',
  ui: {
    type: 'html',
    content: '<div class="modal">상품 상세 정보...</div>'
  },
  config: {
    backdrop: true,
    closable: true,
    size: 'lg',
    animation: 'fade'
  }
});

// 모달 닫기
director.closeModal('product-detail');
```

### 4. 상태 관리 사용법

```typescript
// 전역 상태 설정
director.setGlobalState({
  user: {
    id: 'john@example.com',
    role: 'admin',
    preferences: { theme: 'dark' }
  }
});

// 상태 구독
const unsubscribe = director.subscribeToState('user.preferences.theme', (theme) => {
  document.body.className = theme;
});

// 구독 해제
unsubscribe();
```

이러한 구현을 통해 시나리오에서 요구하는 모든 기능을 효율적으로 처리할 수 있습니다.
