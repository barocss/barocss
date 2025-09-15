# AI Agent OS Implementation Guide

## 구현 순서

### 1단계: 핵심 타입 정의
- 기본 타입 (ID, Timestamp, Version)
- 컨텍스트 타입 (Global, Session, Scene, Component, Temporary)
- 통신 타입 (Request, Response)
- 이벤트 타입
- 설정 타입

### 2단계: Context Manager
- 컨텍스트 저장소 구현
- 컨텍스트 조회/설정/업데이트
- 구독 시스템
- 검증 시스템

### 3단계: Agent Communication
- Third-party Agent 인터페이스 구현
- AgentCommunicationAdapter 구현
- 요청/응답 변환 로직
- 에러 처리 및 스트리밍 지원

### 4단계: Scene Manager (대화형 Scene 체인)
- 대화형 Scene 체인 관리
- 이전 대화 컨텍스트 자동 집계
- AI 요청/응답을 통한 Scene 자동 생성
- 씬 생성/수정/삭제
- 씬 관계 관리
- 일관성 검증
- 씬 검색 및 필터링

### 5단계: UI Renderer
- DOM 렌더링
- 컴포넌트 렌더링
- 스타일링 및 포지셔닝
- 액션 핸들링

### 6단계: Action Handler
- 이벤트 처리
- 액션 라우팅
- 에러 복구
- 로깅 시스템

### 7단계: Interaction Layer
- AIStateManager 구현
- AIConversationManager 구현
- 상태 관리 시스템
- 연속 대화 처리

### 8단계: Rendering Layer
- HybridUIRenderer 구현
- AISceneProcessor 구현
- 다중 렌더링 방식 지원

### 9단계: 메인 클래스
- 컴포넌트 통합
- 생명주기 관리
- 이벤트 시스템
- 설정 관리

### 10단계: 테스트
- 단위 테스트
- 통합 테스트
- E2E 테스트
- 성능 테스트

## 파일 구조

```
packages/
├── barocss-ui/               # 핵심 패키지
│   ├── src/
│   │   ├── types/
│   │   │   ├── index.ts              # 모든 타입 정의
│   │   │   ├── context.ts            # 컨텍스트 타입
│   │   │   ├── scene.ts              # 씬 관련 타입
│   │   │   ├── communication.ts      # 통신 타입
│   │   │   ├── events.ts             # 이벤트 타입
│   │   │   └── config.ts             # 설정 타입
│   │   ├── core/
│   │   │   ├── context-manager.ts    # 컨텍스트 관리
│   │   │   ├── agent-communication-interface.ts # Agent 통신 인터페이스
│   │   │   ├── third-party-agent.ts  # Third-party Agent 인터페이스
│   │   │   ├── agent-bridge.ts       # Agent Bridge 패턴
│   │   │   ├── agent-types.ts        # Agent 타입 정의
│   │   │   ├── scene-manager.ts      # 씬 관리
│   │   │   ├── ui-renderer.ts        # UI 렌더링
│   │   │   ├── action-handler.ts     # 액션 처리
│   │   │   ├── ai-state-manager.ts   # AI 상태 관리
│   │   │   ├── ai-conversation-manager.ts # AI 대화 관리
│   │   │   ├── hybrid-ui-renderer.ts # 하이브리드 UI 렌더러
│   │   │   ├── ai-scene-processor.ts # AI 씬 프로세서
│   │   │   └── ai-agent-os.ts        # 메인 클래스
│   │   ├── utils/
│   │   │   ├── validation.ts         # 검증 유틸리티
│   │   │   ├── error-handling.ts     # 에러 처리
│   │   │   ├── performance.ts        # 성능 모니터링
│   │   │   └── debugging.ts          # 디버깅 도구
│   │   ├── testing/
│   │   │   ├── mocks.ts              # Mock 객체
│   │   │   ├── test-utils.ts         # 테스트 유틸리티
│   │   │   └── fixtures.ts           # 테스트 데이터
│   │   └── index.ts                  # 메인 진입점
│   └── package.json
├── barocss-openai/           # OpenAI 래퍼 패키지
│   ├── src/
│   │   └── index.ts
│   └── package.json
├── barocss-anthropic/        # Anthropic Claude 래퍼 패키지
│   ├── src/
│   │   └── index.ts
│   └── package.json
└── barocss-google/           # Google Gemini 래퍼 패키지 (향후)
    ├── src/
    │   └── index.ts
    └── package.json
```

## 구현 세부사항

### Context Manager 구현

```typescript
export class ContextManager {
  private contexts: ContextHierarchy;
  private subscribers: Map<string, Set<(value: any) => void>>;
  private validationSchemas: Map<string, Schema>;

  // 컨텍스트 조회
  getContext<T>(path: string): T | null;
  
  // 컨텍스트 설정
  setContext(path: string, value: any): void;
  
  // 컨텍스트 업데이트
  updateContext(path: string, updater: (current: any) => any): void;
  
  // 컨텍스트 구독
  subscribe(path: string, callback: (value: any) => void): () => void;
  
  // 검증
  validateContext(path: string, schema: Schema): ValidationResult;
}
```

### Agent Communication 구현

```typescript
// Third-party Agent 인터페이스
export interface ThirdPartyAgent {
  name: string;
  type: string;
  sendRequest(request: AgentRequest): Promise<AgentResponse>;
  sendStreamRequest?(request: AgentRequest): Promise<AsyncIterable<AgentResponse>>;
  isConnected(): boolean;
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;
  getStats?(): Record<string, any>;
}

// Agent Communication Adapter
export class AgentCommunicationAdapter implements AgentCommunicationInterface {
  private agentImplementation: AgentImplementation | null = null;
  private isInitialized: boolean = false;
  private options: AgentCommunicationOptions;

  // Third-party Agent 설정
  async setThirdPartyAgent(agent: ThirdPartyAgent): Promise<void>;
  
  // Agent Bridge 설정
  async setAgentBridge(bridge: AgentBridge): Promise<void>;
  async setAgentBridgeHandlers(name: string, handlers: AgentBridgeHandlers): Promise<void>;

  // 요청 전송
  async sendRequest(request: AgentRequest): Promise<AgentResponse>;
  async sendStreamRequest(request: AgentRequest): Promise<AsyncIterable<AgentResponse>>;

  // 연결 관리
  isConnected(): boolean;
  getStats(): Record<string, any>;
}
```

### Scene Manager 구현 (대화형 Scene 체인)

```typescript
export class SceneManager {
  private scenes: Map<string, Scene>;
  private sceneRelations: Map<string, SceneRelations>;
  private activeSceneId: string | null;
  
  // 대화형 Scene 체인 관리
  private conversationChain: ConversationChain | null = null;
  private contextAggregator: ConversationContextAggregator;
  private aiRequestBuilder: AIRequestBuilder;
  private aiAgentOS: AIAgentOS;

  // 메인 API - 대화형 Scene 생성
  async request(userInput: string): Promise<Scene>;
  getCurrentConversationChain(): ConversationChain | null;
  getConversationHistory(): Scene[];
  async continueConversation(userInput: string): Promise<Scene>;

  // 기존 씬 관리 (고급 사용자용)
  createScene(config: SceneConfig): Scene;
  updateScene(sceneId: string, updates: Partial<SceneConfig>): void;
  removeScene(sceneId: string, cascade?: boolean): void;
  getScene(sceneId: string): Scene | null;

  // 관계 관리
  setParent(childId: string, parentId: string | undefined): void;
  addChild(parentId: string, childId: string): void;
  removeChild(parentId: string, childId: string): void;

  // 검색 및 필터링
  findScenes(predicate: (scene: Scene) => boolean): Scene[];
  getRootScenes(): Scene[];
  getChildScenes(parentId: string): Scene[];

  // 일관성 검증
  validateConsistency(): SceneValidationResult;

  // 내부 메서드들
  private createNewConversationChain(userInput: string): ConversationChain;
  private createSceneFromAIResponse(aiResponse: AgentResponse): Scene;
  private addSceneToChain(scene: Scene): void;
}
```

### 대화형 Scene 체인 구현 세부사항

#### ConversationContextAggregator 구현

```typescript
export class ConversationContextAggregator {
  // 이전 대화 Scene들의 컨텍스트 수집
  aggregateContext(conversationChain: ConversationChain): AggregatedContext {
    return {
      conversation: {
        id: conversationChain.id,
        step: conversationChain.scenes.length,
        totalSteps: conversationChain.metadata.totalSteps
      },
      scenes: conversationChain.scenes.map(scene => ({
        id: scene.id,
        type: scene.type,
        title: scene.title,
        state: scene.state,
        userInputs: this.extractUserInputs(scene),
        aiOutputs: this.extractAIOutputs(scene)
      })),
      currentScene: {
        id: conversationChain.currentSceneId,
        context: this.getCurrentSceneContext(conversationChain.currentSceneId)
      },
      global: this.getGlobalState()
    };
  }

  private extractUserInputs(scene: Scene): UserInput[] {
    // Scene에서 사용자 입력 이력 추출
    return scene.context?.userInputs || [];
  }

  private extractAIOutputs(scene: Scene): AIOutput[] {
    // Scene에서 AI 출력 이력 추출
    return scene.context?.aiOutputs || [];
  }

  private getCurrentSceneContext(sceneId: string): Record<string, any> {
    // 현재 Scene의 상세 컨텍스트 반환
    return {};
  }

  private getGlobalState(): Record<string, any> {
    // 전역 상태 반환
    return {};
  }
}
```

#### AIRequestBuilder 구현

```typescript
export class AIRequestBuilder {
  // 컨텍스트를 포함한 AI 요청 생성
  buildRequest(
    userInput: string, 
    conversationChain: ConversationChain
  ): AgentRequest {
    const contextAggregator = new ConversationContextAggregator();
    const aggregatedContext = contextAggregator.aggregateContext(conversationChain);

    return {
      id: `request-${Date.now()}`,
      type: 'ai_query',
      timestamp: Date.now(),
      priority: 'normal',
      source: 'user',
      context: this.buildContextHierarchy(aggregatedContext),
      metadata: {
        version: '1.0.0',
        correlationId: `corr-${Date.now()}`,
        parentRequestId: null,
        tags: ['conversation', 'scene_generation']
      },
      payload: {
        query: userInput,
        conversationHistory: aggregatedContext.scenes,
        currentContext: aggregatedContext.currentScene,
        globalState: aggregatedContext.global,
        options: {
          generateUI: true,
          preserveContext: true,
          sceneType: 'interactive'
        }
      }
    };
  }

  private buildContextHierarchy(aggregatedContext: AggregatedContext): ContextHierarchy {
    return {
      global: aggregatedContext.global,
      session: {},
      scene: {
        sceneId: aggregatedContext.currentScene.id,
        state: aggregatedContext.currentScene.context
      },
      component: null,
      temporary: null
    };
  }
}
```

#### SceneManager의 request 메서드 구현

```typescript
export class SceneManager {
  // 메인 API - 대화형 Scene 생성
  async request(userInput: string): Promise<Scene> {
    // 1. 대화 체인이 없으면 새로 생성
    if (!this.conversationChain) {
      this.conversationChain = this.createNewConversationChain(userInput);
    }

    // 2. 컨텍스트 집계
    const aggregatedContext = this.contextAggregator.aggregateContext(this.conversationChain);

    // 3. AI 요청 생성
    const request = this.aiRequestBuilder.buildRequest(userInput, this.conversationChain);

    // 4. AI Agent에 요청
    const aiResponse = await this.aiAgentOS.sendRequest(request);

    // 5. AI 응답을 Scene으로 변환
    const newScene = this.createSceneFromAIResponse(aiResponse);

    // 6. 대화 체인에 추가
    this.addSceneToChain(newScene);

    // 7. Scene 등록
    this.scenes.set(newScene.id, newScene);

    return newScene;
  }

  // 대화 이력 조회
  getConversationHistory(): Scene[] {
    return this.conversationChain?.scenes || [];
  }

  // 현재 대화 체인 조회
  getCurrentConversationChain(): ConversationChain | null {
    return this.conversationChain;
  }

  // 대화 계속하기
  async continueConversation(userInput: string): Promise<Scene> {
    return await this.request(userInput);
  }

  // 내부 메서드들
  private createNewConversationChain(userInput: string): ConversationChain {
    const chainId = `chain-${Date.now()}`;
    return {
      id: chainId,
      scenes: [],
      currentSceneId: '',
      context: {
        userInputs: [],
        aiOutputs: [],
        globalState: {},
        sceneStates: {}
      },
      metadata: {
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        totalSteps: 0
      }
    };
  }

  private createSceneFromAIResponse(aiResponse: AgentResponse): Scene {
    const sceneProcessor = new AISceneProcessor();
    const aiScene = sceneProcessor.processAIResponse(aiResponse);
    
    return {
      id: `scene-${Date.now()}`,
      type: 'window',
      title: aiScene.title || 'AI Generated Scene',
      component: this.convertToComponentDefinition(aiScene),
      state: { 
        visible: true, 
        active: true, 
        focused: false, 
        loading: false, 
        error: null, 
        data: {} 
      },
      context: {
        userInputs: [],
        aiOutputs: [{
          id: `output-${Date.now()}`,
          response: aiResponse,
          timestamp: Date.now(),
          sceneId: `scene-${Date.now()}`,
          metadata: {}
        }]
      } as any,
      relationships: { parent: undefined, children: [], siblings: [] },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'ai',
        version: 1
      }
    };
  }

  private addSceneToChain(scene: Scene): void {
    if (this.conversationChain) {
      this.conversationChain.scenes.push(scene);
      this.conversationChain.currentSceneId = scene.id;
      this.conversationChain.metadata.lastUpdated = Date.now();
      this.conversationChain.metadata.totalSteps++;
    }
  }

  private convertToComponentDefinition(aiScene: AISceneDefinition): ComponentDefinition {
    return {
      type: 'div',
      name: 'AIScene',
      props: { className: aiScene.className },
      children: aiScene.components || []
    };
  }
}
```

### UI Renderer 구현

```typescript
export class UIRenderer {
  private container: HTMLElement;
  private renderedScenes: Map<string, HTMLElement>;
  private sceneManager: SceneManager;
  private options: RenderOptions;

  // 렌더링
  renderScene(scene: Scene): void;
  updateScene(scene: Scene): void;
  removeScene(sceneId: string): void;
  clearAll(): void;

  // 스타일링
  private applySceneStyles(element: HTMLElement, scene: Scene): void;
  private renderComponent(container: HTMLElement, component: ComponentDefinition): void;

  // 액션 핸들링
  private attachActionHandlers(element: HTMLElement, scene: Scene): void;
  private handleUIAction(action: UIAction, element: HTMLElement, event: Event): void;
}
```

### Action Handler 구현

```typescript
export class ActionHandler {
  private sceneManager: SceneManager;
  private uiRenderer: UIRenderer;
  private options: ActionHandlerOptions;
  private actionLogs: ActionLog[];

  // 이벤트 처리
  private setupEventListeners(): void;
  private handleGlobalClick(event: Event): void;
  private handleButtonClick(button: HTMLElement, event: Event): void;

  // 액션 처리
  private handleNavigateAction(button: HTMLElement, data: any): void;
  private handleCreateSceneAction(button: HTMLElement, data: any): void;
  private handleUpdateSceneAction(button: HTMLElement, data: any): void;

  // 로깅 및 통계
  getActionLogs(): ActionLog[];
  getActionStats(): ActionStats;
}
```

### Interaction Layer 구현

#### AIStateManager 구현

```typescript
export class AIStateManager {
  private sceneStates: Map<string, Map<string, any>> = new Map();
  private globalStates: Map<string, any> = new Map();
  private conversationContexts: Map<string, any> = new Map();

  // Scene별 상태 관리
  setSceneState(sceneId: string, key: string, value: any): void {
    if (!this.sceneStates.has(sceneId)) {
      this.sceneStates.set(sceneId, new Map());
    }
    this.sceneStates.get(sceneId)!.set(key, value);
  }

  getSceneState(sceneId: string, key: string): any {
    return this.sceneStates.get(sceneId)?.get(key);
  }

  getAllSceneStates(sceneId: string): Record<string, any> {
    const sceneState = this.sceneStates.get(sceneId);
    return sceneState ? Object.fromEntries(sceneState) : {};
  }

  clearSceneState(sceneId: string): void {
    this.sceneStates.delete(sceneId);
  }

  // 전역 상태 관리
  setGlobalState(key: string, value: any): void {
    this.globalStates.set(key, value);
  }

  getGlobalState(key: string): any {
    return this.globalStates.get(key);
  }

  getAllGlobalStates(): Record<string, any> {
    return Object.fromEntries(this.globalStates);
  }

  clearGlobalState(key: string): void {
    this.globalStates.delete(key);
  }

  // 대화 컨텍스트 관리
  setConversationContext(key: string, value: any): void {
    this.conversationContexts.set(key, value);
  }

  getConversationContext(key: string): any {
    return this.conversationContexts.get(key);
  }

  getAllConversationContexts(): Record<string, any> {
    return Object.fromEntries(this.conversationContexts);
  }

  clearConversationContext(key: string): void {
    this.conversationContexts.delete(key);
  }

  // 상태 수집 (AI 요청용)
  collectStateForAI(sceneId: string): AIStateData {
    return {
      sceneState: this.getAllSceneStates(sceneId),
      globalState: this.getAllGlobalStates(),
      conversationContext: this.getAllConversationContexts()
    };
  }

  collectAllStates(): AIStateData {
    return {
      sceneState: {},
      globalState: this.getAllGlobalStates(),
      conversationContext: this.getAllConversationContexts()
    };
  }

  // Scene 정리
  cleanupScene(sceneId: string): void {
    this.sceneStates.delete(sceneId);
  }

  cleanupAllScenes(): void {
    this.sceneStates.clear();
  }
}
```

#### AIConversationManager 구현

```typescript
export class AIConversationManager {
  private stateManager: AIStateManager;
  private agentCommunication: AgentCommunicationInterface;
  private conversationStep: number = 0;

  constructor(
    stateManager: AIStateManager,
    agentCommunication: AgentCommunicationInterface
  ) {
    this.stateManager = stateManager;
    this.agentCommunication = agentCommunication;
  }

  // 연속 대화 처리
  async handleUserAction(
    action: string, 
    data: any, 
    sceneId: string
  ): Promise<void> {
    // 1. 현재 상태 저장
    this.stateManager.setSceneState(sceneId, 'lastAction', action);
    this.stateManager.setSceneState(sceneId, 'actionData', data);
    
    // 2. 다음 AI 요청 준비
    const currentState = this.stateManager.collectStateForAI(sceneId);
    
    // 3. AI에게 요청 전송
    const request: AgentRequest = {
      id: `action-${Date.now()}`,
      type: 'user_action',
      timestamp: Date.now(),
      priority: 'normal',
      source: 'user',
      context: this.buildContextHierarchy(sceneId),
      metadata: {
        version: '1.0.0',
        correlationId: `corr-${Date.now()}`,
        parentRequestId: null,
        tags: ['user_action']
      },
      payload: {
        action,
        target: sceneId,
        data,
        currentState
      }
    };

    // 4. AI 응답 받기
    const response = await this.agentCommunication.sendRequest(request);
    
    // 5. AI 응답 처리
    await this.processAIResponse(response);
  }

  // AI 응답 처리
  async processAIResponse(response: AgentResponse): Promise<void> {
    if (response.type === 'success' && response.data?.result?.ui) {
      // UI 렌더링은 HybridUIRenderer에서 처리
      // 여기서는 상태 업데이트만 처리
      const ui = response.data.result.ui;
      
      if (ui.state) {
        // AI가 제공한 상태 업데이트
        Object.entries(ui.state).forEach(([key, value]) => {
          this.stateManager.setGlobalState(key, value);
        });
      }

      if (ui.context) {
        // AI가 제공한 컨텍스트 업데이트
        Object.entries(ui.context).forEach(([key, value]) => {
          this.stateManager.setConversationContext(key, value);
        });
      }
    }
  }

  // 대화 컨텍스트 관리
  setConversationStep(step: number): void {
    this.conversationStep = step;
    this.stateManager.setConversationContext('step', step);
  }

  getConversationStep(): number {
    return this.conversationStep;
  }

  resetConversation(): void {
    this.conversationStep = 0;
    this.stateManager.clearConversationContext('step');
  }

  // 상태 전달
  async sendStateToAI(sceneId: string): Promise<AgentResponse> {
    const currentState = this.stateManager.collectStateForAI(sceneId);
    
    const request: AgentRequest = {
      id: `state-${Date.now()}`,
      type: 'ai_query',
      timestamp: Date.now(),
      priority: 'normal',
      source: 'system',
      context: this.buildContextHierarchy(sceneId),
      metadata: {
        version: '1.0.0',
        correlationId: `corr-${Date.now()}`,
        parentRequestId: null,
        tags: ['state_sync']
      },
      payload: {
        query: 'Update UI based on current state',
        context: { currentState },
        options: { preserveState: true }
      }
    };

    return await this.agentCommunication.sendRequest(request);
  }

  private buildContextHierarchy(sceneId: string): ContextHierarchy {
    // ContextHierarchy 빌드 로직
    return {
      global: this.stateManager.getAllGlobalStates(),
      session: {},
      scene: { sceneId, state: this.stateManager.getAllSceneStates(sceneId) },
      component: null,
      temporary: null
    };
  }
}
```

### Rendering Layer 구현

#### HybridUIRenderer 구현

```typescript
export class HybridUIRenderer {
  private sceneManager: SceneManager;
  private stateManager: AIStateManager;
  private sceneProcessor: AISceneProcessor;

  constructor(
    sceneManager: SceneManager,
    stateManager: AIStateManager
  ) {
    this.sceneManager = sceneManager;
    this.stateManager = stateManager;
    this.sceneProcessor = new AISceneProcessor();
  }

  // AI 응답 렌더링
  async renderAIResponse(response: AgentResponse): Promise<void> {
    const ui = response.data?.result?.ui;
    if (!ui) return;

    const aiScene = this.sceneProcessor.processAIResponse(response);
    if (aiScene) {
      await this.renderAIScene(aiScene);
    }
  }

  // AI Scene 렌더링
  async renderAIScene(aiScene: AISceneDefinition): Promise<Scene> {
    const scene = this.sceneManager.createScene({
      type: 'window',
      title: aiScene.title || 'AI Generated UI',
      component: this.convertToComponentDefinition(aiScene)
    });

    // 렌더링 방식에 따라 처리
    switch (aiScene.type) {
      case 'html':
        await this.renderHTML(aiScene.content!, { sceneId: scene.id });
        break;
      case 'components':
        await this.renderComponents(aiScene.components!, { sceneId: scene.id });
        break;
      case 'scene':
        await this.renderScene(aiScene.scene!, { sceneId: scene.id });
        break;
    }

    // 액션 핸들러 연결
    if (aiScene.actions) {
      this.attachActionHandlers(aiScene.actions, scene.id);
    }

    return scene;
  }

  // HTML + Tailwind 렌더링
  async renderHTML(content: string, options?: RenderOptions): Promise<Scene> {
    const scene = this.sceneManager.createScene({
      type: 'window',
      title: options?.sceneId || 'HTML UI',
      component: { type: 'div', name: 'HTMLContent', props: {} }
    });

    const element = this.sceneManager.getSceneElement(scene.id);
    if (element) {
      element.innerHTML = content;
    }

    return scene;
  }

  // 컴포넌트 기반 렌더링
  async renderComponents(components: ComponentDefinition[], options?: RenderOptions): Promise<Scene> {
    const scene = this.sceneManager.createScene({
      type: 'window',
      title: options?.sceneId || 'Component UI',
      component: { type: 'div', name: 'ComponentContainer', props: {} }
    });

    const element = this.sceneManager.getSceneElement(scene.id);
    if (element) {
      this.renderComponentTree(element, components);
    }

    return scene;
  }

  // Scene 기반 렌더링
  async renderScene(sceneDef: SceneDefinition, options?: RenderOptions): Promise<Scene> {
    const scene = this.sceneManager.createScene({
      type: sceneDef.type,
      title: sceneDef.title || 'Scene UI',
      component: this.convertSceneToComponent(sceneDef)
    });

    return scene;
  }

  // 액션 핸들러 연결
  attachActionHandlers(actions: Record<string, string>, sceneId: string): void {
    Object.entries(actions).forEach(([selector, action]) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        element.addEventListener('click', async (e) => {
          e.preventDefault();
          
          // 폼 데이터 수집
          const formData = this.collectFormData(element);
          
          // AI와의 연속 대화 시작
          // 이 부분은 AIConversationManager와 연동되어야 함
          console.log('Action triggered:', action, formData);
        });
      });
    });
  }


  // 유틸리티 메서드들
  private convertToComponentDefinition(aiScene: AISceneDefinition): ComponentDefinition {
    // AI Scene을 Component Definition으로 변환
    return {
      type: 'div',
      name: 'AIScene',
      props: { className: aiScene.className },
      children: aiScene.components || []
    };
  }


  private collectFormData(element: Element): Record<string, any> {
    // 폼 데이터 수집 로직
    const formData: Record<string, any> = {};
    const inputs = element.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      const name = (input as HTMLInputElement).name;
      const value = (input as HTMLInputElement).value;
      if (name) {
        formData[name] = value;
      }
    });
    
    return formData;
  }
}
```

#### AISceneProcessor 구현

```typescript
export class AISceneProcessor {
  // AI 응답 파싱
  processAIResponse(response: AgentResponse): AISceneDefinition | null {
    const ui = response.data?.result?.ui;
    if (!ui) return null;

    return {
      type: this.detectUIType(ui),
      title: ui.title,
      content: ui.content,
      components: ui.components,
      scene: ui.scene,
      actions: ui.actions,
      state: ui.state,
      context: ui.context
    };
  }

  // UI 타입 감지
  detectUIType(ui: any): 'html' | 'components' | 'scene' {
    if (ui.content && typeof ui.content === 'string') {
      return 'html';
    } else if (ui.components && Array.isArray(ui.components)) {
      return 'components';
    } else if (ui.scene && typeof ui.scene === 'object') {
      return 'scene';
    }
    
    // 기본값
    return 'html';
  }

  // UI 타입별 처리
  processHTMLUI(content: string): AISceneDefinition {
    return {
      type: 'html',
      content,
      actions: this.extractActionsFromHTML(content)
    };
  }

  processComponentUI(components: ComponentDefinition[]): AISceneDefinition {
    return {
      type: 'components',
      components,
      actions: this.extractActionsFromComponents(components)
    };
  }

  processJSONUI(scene: SceneDefinition): AISceneDefinition {
    return {
      type: 'scene',
      scene,
      actions: this.extractActionsFromScene(scene)
    };
  }

  // Scene 생성
  createSceneFromAI(aiScene: AISceneDefinition): Scene {
    // AI Scene을 실제 Scene으로 변환
    return {
      id: `ai-scene-${Date.now()}`,
      type: 'window',
      title: aiScene.title || 'AI Generated',
      component: this.convertToComponentDefinition(aiScene),
      state: { visible: true, active: true, focused: false, loading: false, error: null, data: {} },
      context: {} as SceneContext,
      relationships: { parent: undefined, children: [], siblings: [] },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'ai',
        version: 1
      }
    };
  }

  // 검증
  validateAIScene(aiScene: AISceneDefinition): ValidationResult {
    const errors: string[] = [];
    
    if (!aiScene.type) {
      errors.push('UI type is required');
    }
    
    if (aiScene.type === 'html' && !aiScene.content) {
      errors.push('HTML content is required for html type');
    }
    
    if (aiScene.type === 'components' && !aiScene.components) {
      errors.push('Components are required for components type');
    }
    
    if (aiScene.type === 'scene' && !aiScene.scene) {
      errors.push('Scene definition is required for scene type');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // 액션 추출 유틸리티들
  private extractActionsFromHTML(html: string): Record<string, string> {
    // HTML에서 액션 추출
    const actions: Record<string, string> = {};
    const actionRegex = /data-action="([^"]*)"[^>]*>/g;
    let match;
    
    while ((match = actionRegex.exec(html)) !== null) {
      const action = match[1];
      const selector = `[data-action="${action}"]`;
      actions[selector] = action;
    }
    
    return actions;
  }

  private extractActionsFromComponents(components: ComponentDefinition[]): Record<string, string> {
    // 컴포넌트에서 액션 추출
    const actions: Record<string, string> = {};
    
    const extractFromComponent = (component: ComponentDefinition, path: string = '') => {
      if (component.events) {
        Object.entries(component.events).forEach(([event, action]) => {
          const selector = path ? `${path} .${component.name}` : `.${component.name}`;
          actions[selector] = action;
        });
      }
      
      if (component.children) {
        component.children.forEach((child, index) => {
          extractFromComponent(child, `${path} .${component.name}:nth-child(${index + 1})`);
        });
      }
    };
    
    components.forEach(component => extractFromComponent(component));
    return actions;
  }

  private extractActionsFromScene(scene: SceneDefinition): Record<string, string> {
    // Scene에서 액션 추출
    if (scene.children) {
      return this.extractActionsFromComponents(scene.children);
    }
    return {};
  }
}
```


## 테스트 전략

### 단위 테스트

```typescript
// Context Manager 테스트
describe('ContextManager', () => {
  it('should get and set context', () => {
    const manager = new ContextManager();
    manager.setContext('global.user.id', 'test-user');
    expect(manager.getContext('global.user.id')).toBe('test-user');
  });

  it('should subscribe to context changes', (done) => {
    const manager = new ContextManager();
    const unsubscribe = manager.subscribe('global.user.id', (value) => {
      expect(value).toBe('new-user');
      unsubscribe();
      done();
    });
    manager.setContext('global.user.id', 'new-user');
  });
});
```

### 통합 테스트

```typescript
// AI Agent OS 통합 테스트
describe('AIAgentOS Integration', () => {
  it('should handle complete workflow with Third-party Agent', async () => {
    // Mock Third-party Agent 생성
    const mockAgent = createMockAgentCommunicationAdapter({
      delay: 100,
      errorRate: 0.1
    });

    const aiAgentOS = new AIAgentOS({ debug: true }, mockAgent);
    await aiAgentOS.initialize();

    // 씬 생성
    const scene = aiAgentOS.createScene({
      type: 'window',
      title: 'Test Scene',
      component: { type: 'div', name: 'TestComponent', props: {} }
    });

    // Agent 요청
    const response = await aiAgentOS.sendRequest({
      id: 'test-request',
      type: 'create_scene',
      payload: { message: 'Create a test scene' }
    });

    expect(response.status.success).toBe(true);
    await aiAgentOS.shutdown();
  });

  it('should work with OpenAI wrapper', async () => {
    const openai = new OpenAI({ apiKey: 'test-key' });
    const openaiWrapper = createOpenAIWrapper(openai, { model: 'gpt-4' });
    
    const aiAgentOS = new AIAgentOS({ debug: true }, openaiWrapper);
    await aiAgentOS.initialize();

    // 테스트 로직...
    await aiAgentOS.shutdown();
  });
});
```

### E2E 테스트

```typescript
// End-to-End 테스트
describe('E2E Workflow', () => {
  it('should handle user interaction flow', async () => {
    // 1. AI Agent OS 초기화
    // 2. 사용자 액션 시뮬레이션
    // 3. AI 응답 처리
    // 4. UI 업데이트 확인
    // 5. 상태 검증
  });
});
```

## 성능 최적화

### 메모리 관리

```typescript
// 메모리 사용량 모니터링
class MemoryManager {
  private maxMemoryUsage: number;
  private cleanupThreshold: number;

  checkMemoryUsage(): boolean {
    const usage = this.getCurrentMemoryUsage();
    if (usage > this.cleanupThreshold) {
      this.performCleanup();
      return true;
    }
    return false;
  }

  private performCleanup(): void {
    // 오래된 씬들 제거
    // 사용하지 않는 컨텍스트 정리
    // 캐시 정리
  }
}
```

### 캐싱 전략

```typescript
// LRU 캐시 구현
class LRUCache<T> {
  private cache: Map<string, T>;
  private maxSize: number;

  get(key: string): T | null {
    if (this.cache.has(key)) {
      const value = this.cache.get(key)!;
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return null;
  }

  set(key: string, value: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}
```

## 에러 처리

### 에러 분류

```typescript
// 에러 타입별 처리
class ErrorHandler {
  handleError(error: Error, context: any): void {
    if (error instanceof CommunicationError) {
      this.handleCommunicationError(error, context);
    } else if (error instanceof ValidationError) {
      this.handleValidationError(error, context);
    } else if (error instanceof SceneError) {
      this.handleSceneError(error, context);
    } else {
      this.handleGenericError(error, context);
    }
  }

  private handleCommunicationError(error: CommunicationError, context: any): void {
    // 재연결 시도
    // 요청 재시도
    // 사용자 알림
  }
}
```

### 복구 전략

```typescript
// 자동 복구 시스템
class RecoveryManager {
  private retryAttempts: Map<string, number>;
  private maxRetries: number;

  async attemptRecovery(error: Error, context: any): Promise<boolean> {
    const errorKey = this.getErrorKey(error);
    const attempts = this.retryAttempts.get(errorKey) || 0;

    if (attempts < this.maxRetries) {
      this.retryAttempts.set(errorKey, attempts + 1);
      return await this.executeRecoveryStrategy(error, context);
    }

    return false;
  }
}
```

## 디버깅 도구

### 개발자 도구

```typescript
// 브라우저 개발자 도구
class DevTools {
  static enableDebugMode(): void {
    (window as any).AIAgentOS = {
      getInstance: () => globalInstance,
      getStats: () => globalInstance?.getStats(),
      getContext: (path: string) => globalInstance?.getContext(path),
      setContext: (path: string, value: any) => globalInstance?.setContext(path, value)
    };
  }
}
```

### 로깅 시스템

```typescript
// 구조화된 로깅
class Logger {
  private logs: LogEntry[] = [];

  log(level: LogLevel, message: string, context?: any): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      context,
      stack: new Error().stack
    };
    
    this.logs.push(entry);
    this.outputToConsole(entry);
  }
}
```

## 배포 및 빌드

### 빌드 설정

```json
{
  "scripts": {
    "build": "tsc && rollup -c",
    "build:types": "tsc --declaration --emitDeclarationOnly",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts"
  }
}
```

### 패키지 설정

#### 핵심 패키지 (@barocss/ui)
```json
{
  "name": "@barocss/ui",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.esm.js",
      "require": "./dist/index.cjs.js",
      "types": "./dist/index.d.ts"
    }
  },
  "peerDependencies": {
    "typescript": "^5.0.0"
  }
}
```

#### AI 제공업체별 래퍼 패키지
```json
// @barocss/openai
{
  "name": "@barocss/openai",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "dependencies": {
    "@barocss/ui": "workspace:*",
    "openai": "^4.0.0"
  },
  "peerDependencies": {
    "openai": "^4.0.0"
  }
}

// @barocss/anthropic
{
  "name": "@barocss/anthropic",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "dependencies": {
    "@barocss/ui": "workspace:*",
    "@anthropic-ai/sdk": "^0.20.0"
  },
  "peerDependencies": {
    "@anthropic-ai/sdk": "^0.20.0"
  }
}
```
