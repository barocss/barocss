/**
 * Scene Manager
 * Director의 씬 관리를 담당하는 클래스
 */

import {
  Scene,
  SceneConfig,
  ComponentDefinition,
  Position,
  Size,
  SceneError,
  Schema,
  ConversationChain,
  AgentResponse,
  IDirector,
  UIContent
} from '../types';
import { ConversationContextAggregator } from './conversation-context-aggregator';
import { AIRequestBuilder } from './ai-request-builder';
import { getService } from './service-container';
import { generateId, getCurrentTimestamp } from '../utils/id-generator';

export interface SceneRelations {
  parent?: string;
  children: string[];
  siblings: string[];
  groups: string[];
}

export interface SceneValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    totalScenes: number;
    rootScenes: number;
    orphanedScenes: number;
    circularReferences: number;
  };
}

export interface SceneStats {
  totalScenes: number;
  activeScenes: number;
  rootScenes: number;
  maxDepth: number;
  memoryUsage: number;
}

export class SceneManager {
  private scenes: Map<string, Scene> = new Map();
  private sceneRelations: Map<string, SceneRelations> = new Map();
  private activeSceneId: string | null = null;
  private sceneCounter: number = 0;
  
  // 대화형 Scene 체인 관리
  private conversationChain: ConversationChain | null = null;
  private contextAggregator: ConversationContextAggregator;
  private aiRequestBuilder: AIRequestBuilder;
  private validationSchemas: Map<string, Schema> = new Map();

  constructor() {
    this.contextAggregator = new ConversationContextAggregator();
    this.aiRequestBuilder = new AIRequestBuilder();
    this.setupDefaultValidationSchemas();
  }

  // ============================================================================
  // 대화형 Scene 생성 API (핵심 기능)
  // ============================================================================

  /**
   * 메인 API - 대화형 Scene 생성
   * 사용자 입력을 받아 AI를 통해 새로운 Scene을 생성합니다.
   */
  async request(userInput: string): Promise<Scene> {
    try {
      // 1. 대화 체인이 없으면 새로 생성
      if (!this.conversationChain) {
        this.conversationChain = this.createNewConversationChain(userInput);
      }

      // 2. AI 요청 생성
      const request = this.conversationChain.scenes.length === 0
        ? this.aiRequestBuilder.buildInitialRequest(userInput)
        : this.aiRequestBuilder.buildRequest(userInput, this.conversationChain);

      // 3. AI Agent에 요청 (Director를 통해)
      const director = getService<IDirector>('director');
      if (!director || !director.sendRequest) {
        throw new SceneError('Director instance or sendRequest method not available');
      }
      const aiResponse = await director.sendRequest(request);

      // 4. AI 응답을 Scene으로 변환
      const newScene = this.createSceneFromAIResponse(aiResponse);

      // 5. 대화 체인에 추가
      this.addSceneToChain(newScene, userInput, aiResponse);

      // 6. Scene 등록
      this.scenes.set(newScene.id, newScene);

      return newScene;
    } catch (error) {
      // eslint-disable-next-line
      console.error('Scene request failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new SceneError(`Failed to process request: ${errorMessage}`, error as Record<string, unknown>);
    }
  }

  /**
   * 대화 이력 조회
   */
  getConversationHistory(): Scene[] {
    return this.conversationChain?.scenes || [];
  }

  /**
   * 현재 대화 체인 조회
   */
  getCurrentConversationChain(): ConversationChain | null {
    return this.conversationChain;
  }

  /**
   * 대화 계속하기 (alias for request)
   */
  async continueConversation(userInput: string): Promise<Scene> {
    return await this.request(userInput);
  }

  // ============================================================================
  // 내부 메서드들
  // ============================================================================

  private createNewConversationChain(userInput: string): ConversationChain {
    const chainId = generateId('chain');
    const timestamp = getCurrentTimestamp();
    
    return {
      id: chainId,
      scenes: [],
      currentSceneId: '',
      context: {
        userInputs: [{
          id: generateId('input'),
          input: userInput,
          timestamp,
          sceneId: '', // 아직 씬이 생성되지 않았으므로 빈 문자열
          metadata: {
            isInitial: true,
            source: 'user'
          }
        }],
        aiOutputs: [],
        globalState: {},
        sceneStates: {}
      },
      metadata: {
        createdAt: timestamp,
        lastUpdated: timestamp,
        totalSteps: 0
      }
    };
  }

  private createSceneFromAIResponse(aiResponse: AgentResponse): Scene {
    const sceneId = generateId('scene');
    const timestamp = getCurrentTimestamp();
    
    // AI 응답에서 UI 정보 추출
    const responseData = aiResponse.data && 'result' in aiResponse.data ? aiResponse.data.result : null;
    const ui = responseData?.ui || {
      type: 'html',
      content: '<div class="p-4 bg-gray-100 rounded">AI 응답을 처리할 수 없습니다.</div>'
    };
    
    return {
      id: sceneId,
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      type: 'window',
      title: responseData?.title || `AI Scene - ${new Date().toLocaleTimeString()}`,
      component: this.convertUIToComponentDefinition(ui),
      state: { 
        visible: true, 
        active: true, 
        focused: false, 
        loading: false, 
        error: null, 
        data: { 
          ...responseData?.state || {},
          aiHtml: ui.content // AI 생성 HTML을 상태에 저장
        }
      },
      ui: {
        type: ui.type || 'html',
        content: ui.content as string,
        actions: ui.actions || this.extractActionsFromHTML(ui.content as string),
        metadata: ui.metadata || {}
      },
      context: {
        sceneId,
        type: 'window',
        title: responseData?.title || 'AI Generated Scene',
        parent: {
          sceneId: null,
          relationship: 'parent'
        },
        children: {
          sceneIds: [],
          relationships: {}
        },
        state: {
          visible: true,
          active: true,
          focused: false,
          loading: false
        },
        data: {
          props: {},
          state: {
            ...responseData?.state || {},
            aiHtml: ui.content // context에도 저장
          },
          computed: {}
        },
        metadata: {
          createdAt: timestamp,
          updatedAt: timestamp,
          createdBy: 'ai',
          version: 1
        }
      },
      relationships: { 
        parent: undefined, 
        children: [], 
        siblings: [] 
      },
      metadata: {
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: 'ai',
        version: 1,
        aiResponse: aiResponse // AI 응답 전체를 메타데이터에 저장
      }
    };
  }

  private extractActionsFromHTML(html: string): Record<string, string> {
    if (!html || typeof html !== 'string') {
      return {};
    }

    const actions: Record<string, string> = {};
    const actionMatches = html.matchAll(/data-action="([^"]+)"/g);
    
    for (const match of Array.from(actionMatches)) {
      const actionName = match[1];
      actions[`[data-action="${actionName}"]`] = actionName;
    }
    
    return actions;
  }

  private convertUIToComponentDefinition(ui: UIContent): ComponentDefinition {
    return {
        id: generateId('comp'),
      type: 'div',
      name: 'AIGeneratedContent',
      props: { 
        className: 'ai-generated-scene',
        'data-ui-type': ui.type 
      },
      children: ui.type === 'html' ? undefined : [],
      events: ui.actions || {},
      styles: {}
    };
  }

  private addSceneToChain(scene: Scene, userInput: string, aiResponse: AgentResponse): void {
    if (this.conversationChain) {
      // UserInput 추가
      const userInputObj = {
        id: generateId('input'),
        input: userInput,
        timestamp: getCurrentTimestamp(),
        sceneId: scene.id,
        metadata: {}
      };

      // AIOutput 추가
      const aiOutputObj = {
        id: generateId('output'),
        response: aiResponse,
        timestamp: getCurrentTimestamp(),
        sceneId: scene.id,
        metadata: {}
      };

      // 대화 체인 업데이트
      this.conversationChain.scenes.push(scene);
      this.conversationChain.currentSceneId = scene.id;
      this.conversationChain.context.userInputs.push(userInputObj);
      this.conversationChain.context.aiOutputs.push(aiOutputObj);
      this.conversationChain.metadata.lastUpdated = getCurrentTimestamp();
      this.conversationChain.metadata.totalSteps++;
    }
  }

  // ============================================================================
  // 기존 Scene 관리 (고급 사용자용)
  // ============================================================================

  /**
   * 씬 생성
   */
  createScene(config: SceneConfig): Scene {
    const sceneId = config.id || generateId('scene');
    
    // 중복 ID 검사
    if (this.scenes.has(sceneId)) {
      throw new SceneError(`Scene with ID '${sceneId}' already exists`);
    }

    // 씬 검증
    this.validateSceneConfig(config);

    const now = Date.now();
    const scene: Scene = {
      id: sceneId,
      createdAt: now,
      updatedAt: now,
      version: 1,
      type: config.type,
      title: config.title,
      component: config.component,
      state: {
        visible: true,
        active: false,
        focused: false,
        loading: false,
        error: null,
        data: config.state || {}
      },
      context: {
        sceneId,
        type: config.type,
        title: config.title,
        parent: {
          sceneId: config.parentId || null,
          relationship: 'parent'
        },
        children: {
          sceneIds: [],
          relationships: {}
        },
        state: {
          visible: true,
          active: false,
          focused: false,
          loading: false
        },
        data: {
          props: config.props || {},
          state: config.state || {},
          computed: {}
        },
        metadata: {
          createdAt: now,
          updatedAt: now,
          createdBy: 'user',
          version: 1
        }
      },
      relationships: {
        parent: config.parentId,
        children: [],
        siblings: []
      },
      metadata: {
        createdAt: now,
        updatedAt: now,
        createdBy: 'user',
        version: 1
      }
    };

    // 씬 저장
    this.scenes.set(sceneId, scene);
    this.sceneRelations.set(sceneId, {
      parent: config.parentId,
      children: [],
      siblings: [],
      groups: []
    });

    // 부모-자식 관계 설정
    if (config.parentId) {
      this.setParent(sceneId, config.parentId);
    }

    // 위치 및 크기 설정
    if (config.position) {
      this.setScenePosition(sceneId, config.position);
    }
    if (config.size) {
      this.setSceneSize(sceneId, config.size);
    }

    return scene;
  }

  /**
   * 씬 업데이트
   */
  updateScene(sceneId: string, updates: Partial<SceneConfig>): void {
    const scene = this.scenes.get(sceneId);
    if (!scene) {
      throw new SceneError(`Scene '${sceneId}' not found`);
    }

    // 업데이트 적용
    if (updates.title !== undefined) {
      scene.title = updates.title;
      scene.context.title = updates.title;
    }

    if (updates.component !== undefined) {
      scene.component = { ...scene.component, ...updates.component };
    }

    if (updates.props !== undefined) {
      scene.context.data.props = { ...scene.context.data.props, ...updates.props };
    }

    if (updates.state !== undefined) {
      scene.context.data.state = { ...scene.context.data.state, ...updates.state };
      scene.state.data = { ...scene.state.data, ...updates.state };
    }

    if (updates.position !== undefined) {
      this.setScenePosition(sceneId, updates.position);
    }

    if (updates.size !== undefined) {
      this.setSceneSize(sceneId, updates.size);
    }

    // 메타데이터 업데이트
    scene.metadata.updatedAt = Date.now();
    scene.metadata.version++;
    scene.context.metadata.updatedAt = scene.metadata.updatedAt;
    scene.context.metadata.version = scene.metadata.version;
  }

  /**
   * 씬 삭제
   */
  removeScene(sceneId: string, cascade: boolean = false): void {
    const scene = this.scenes.get(sceneId);
    if (!scene) {
      throw new SceneError(`Scene '${sceneId}' not found`);
    }

    // 자식 씬들 처리
    const relations = this.sceneRelations.get(sceneId);
    if (relations && relations.children.length > 0) {
      if (cascade) {
        // 자식 씬들도 함께 삭제
        for (const childId of relations.children) {
          this.removeScene(childId, true);
        }
      } else {
        // 자식 씬들을 부모의 부모로 이동
        const parentId = relations.parent;
        for (const childId of relations.children) {
          if (parentId) {
            this.setParent(childId, parentId);
          } else {
            this.setParent(childId, undefined);
          }
        }
      }
    }

    // 부모에서 제거
    if (relations && relations.parent) {
      this.removeChild(relations.parent, sceneId);
    }

    // 씬 제거
    this.scenes.delete(sceneId);
    this.sceneRelations.delete(sceneId);

    // 활성 씬이 삭제된 경우
    if (this.activeSceneId === sceneId) {
      this.activeSceneId = null;
    }
  }

  /**
   * 씬 조회
   */
  getScene(sceneId: string): Scene | null {
    return this.scenes.get(sceneId) || null;
  }

  /**
   * 모든 씬 조회
   */
  getAllScenes(): Scene[] {
    return Array.from(this.scenes.values());
  }

  /**
   * 부모-자식 관계 설정
   */
  setParent(childId: string, parentId: string | undefined): void {
    const childScene = this.scenes.get(childId);
    if (!childScene) {
      throw new SceneError(`Child scene '${childId}' not found`);
    }

    if (parentId) {
      const parentScene = this.scenes.get(parentId);
      if (!parentScene) {
        throw new SceneError(`Parent scene '${parentId}' not found`);
      }

      // 순환 참조 검사
      if (this.wouldCreateCircularReference(childId, parentId)) {
        throw new SceneError(`Setting parent would create circular reference`);
      }
    }

    // 기존 부모에서 제거
    const childRelations = this.sceneRelations.get(childId);
    if (childRelations && childRelations.parent) {
      this.removeChild(childRelations.parent, childId);
    }

    // 새 부모 설정
    if (parentId) {
      this.addChild(parentId, childId);
    }

    // 관계 업데이트
    if (childRelations) {
      childRelations.parent = parentId;
      childScene.relationships.parent = parentId;
      childScene.context.parent.sceneId = parentId || null;
    }
  }

  /**
   * 자식 씬 추가
   */
  addChild(parentId: string, childId: string): void {
    const parentRelations = this.sceneRelations.get(parentId);
    if (!parentRelations) {
      throw new SceneError(`Parent scene '${parentId}' not found`);
    }

    if (!parentRelations.children.includes(childId)) {
      parentRelations.children.push(childId);
      
      const parentScene = this.scenes.get(parentId);
      if (parentScene) {
        parentScene.relationships.children.push(childId);
        parentScene.context.children.sceneIds.push(childId);
      }
    }
  }

  /**
   * 자식 씬 제거
   */
  removeChild(parentId: string, childId: string): void {
    const parentRelations = this.sceneRelations.get(parentId);
    if (parentRelations) {
      const index = parentRelations.children.indexOf(childId);
      if (index > -1) {
        parentRelations.children.splice(index, 1);
        
        const parentScene = this.scenes.get(parentId);
        if (parentScene) {
          const childIndex = parentScene.relationships.children.indexOf(childId);
          if (childIndex > -1) {
            parentScene.relationships.children.splice(childIndex, 1);
          }
          
          const contextChildIndex = parentScene.context.children.sceneIds.indexOf(childId);
          if (contextChildIndex > -1) {
            parentScene.context.children.sceneIds.splice(contextChildIndex, 1);
          }
        }
      }
    }
  }

  /**
   * 자식 씬들 조회
   */
  getChildScenes(parentId: string): Scene[] {
    const relations = this.sceneRelations.get(parentId);
    if (!relations) {
      return [];
    }

    return relations.children
      .map(childId => this.scenes.get(childId))
      .filter((scene): scene is Scene => scene !== undefined);
  }

  /**
   * 루트 씬들 조회
   */
  getRootScenes(): Scene[] {
    return Array.from(this.scenes.values()).filter(scene => 
      !scene.relationships.parent
    );
  }

  /**
   * 활성 씬 설정
   */
  setActiveScene(sceneId: string | null): void {
    // 이전 활성 씬 비활성화
    if (this.activeSceneId) {
      const previousScene = this.scenes.get(this.activeSceneId);
      if (previousScene) {
        previousScene.state.active = false;
        previousScene.context.state.active = false;
      }
    }

    // 새 활성 씬 설정
    this.activeSceneId = sceneId;
    if (sceneId) {
      const scene = this.scenes.get(sceneId);
      if (scene) {
        scene.state.active = true;
        scene.context.state.active = true;
      }
    }
  }

  /**
   * 활성 씬 조회
   */
  getActiveScene(): Scene | null {
    return this.activeSceneId ? this.scenes.get(this.activeSceneId) || null : null;
  }

  /**
   * 씬 검색
   */
  findScenes(predicate: (scene: Scene) => boolean): Scene[] {
    return Array.from(this.scenes.values()).filter(predicate);
  }

  /**
   * 씬 일관성 검증
   */
  validateConsistency(): SceneValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let totalScenes = 0;
    let rootScenes = 0;
    let orphanedScenes = 0;
    let circularReferences = 0;

    // 모든 씬 검사
    for (const [sceneId, scene] of Array.from(this.scenes)) {
      totalScenes++;

      // 루트 씬 카운트
      if (!scene.relationships.parent) {
        rootScenes++;
      }

      // 부모 씬 존재 검사
      if (scene.relationships.parent) {
        const parentScene = this.scenes.get(scene.relationships.parent);
        if (!parentScene) {
          errors.push(`Scene '${sceneId}' has missing parent '${scene.relationships.parent}'`);
          orphanedScenes++;
        }
      }

      // 자식 씬들 검사
      for (const childId of scene.relationships.children) {
        const childScene = this.scenes.get(childId);
        if (!childScene) {
          errors.push(`Scene '${sceneId}' has missing child '${childId}'`);
        } else if (childScene.relationships.parent !== sceneId) {
          errors.push(`Scene '${childId}' parent mismatch: expected '${sceneId}', got '${childScene.relationships.parent}'`);
        }
      }

      // 순환 참조 검사
      if (this.hasCircularReference(sceneId)) {
        errors.push(`Scene '${sceneId}' has circular reference`);
        circularReferences++;
      }
    }

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      summary: {
        totalScenes,
        rootScenes,
        orphanedScenes,
        circularReferences
      }
    };
  }

  /**
   * 씬 위치 설정
   */
  private setScenePosition(sceneId: string, position: Position): void {
    const scene = this.scenes.get(sceneId);
    if (scene) {
      scene.context.data.props = {
        ...scene.context.data.props,
        position
      };
    }
  }

  /**
   * 씬 크기 설정
   */
  private setSceneSize(sceneId: string, size: Size): void {
    const scene = this.scenes.get(sceneId);
    if (scene) {
      scene.context.data.props = {
        ...scene.context.data.props,
        size
      };
    }
  }

  /**
   * 순환 참조 검사
   */
  private wouldCreateCircularReference(childId: string, parentId: string): boolean {
    let currentId = parentId;
    while (currentId) {
      if (currentId === childId) {
        return true;
      }
      const relations = this.sceneRelations.get(currentId);
      currentId = relations?.parent || '';
    }
    return false;
  }

  /**
   * 순환 참조 존재 검사
   */
  private hasCircularReference(sceneId: string): boolean {
    const visited = new Set<string>();
    let currentId = sceneId;
    
    while (currentId) {
      if (visited.has(currentId)) {
        return true;
      }
      visited.add(currentId);
      const relations = this.sceneRelations.get(currentId);
      currentId = relations?.parent || '';
    }
    
    return false;
  }

  /**
   * 씬 설정 검증
   */
  private validateSceneConfig(config: SceneConfig): void {
    if (!config.title || config.title.trim() === '') {
      throw new SceneError('Scene title is required');
    }

    if (!config.component || !config.component.type) {
      throw new SceneError('Scene component is required');
    }

    if (config.parentId && !this.scenes.has(config.parentId)) {
      throw new SceneError(`Parent scene '${config.parentId}' not found`);
    }
  }

  /**
   * 기본 검증 스키마 설정
   */
  private setupDefaultValidationSchemas(): void {
    this.validationSchemas.set('scene', {
      type: 'object',
      properties: {
        id: { type: 'string' },
        type: { type: 'string', enum: ['window', 'modal', 'popover', 'overlay', 'page'] },
        title: { type: 'string' },
        component: { type: 'object' }
      },
      required: ['type', 'title', 'component']
    });
  }

  /**
   * 씬 ID 생성
   */

  /**
   * 통계 정보 조회
   */
  getStats(): SceneStats {
    const totalScenes = this.scenes.size;
    const activeScenes = Array.from(this.scenes.values()).filter(scene => scene.state.active).length;
    const rootScenes = this.getRootScenes().length;
    const maxDepth = this.calculateMaxDepth();
    const memoryUsage = this.estimateMemoryUsage();

    return {
      totalScenes,
      activeScenes,
      rootScenes,
      maxDepth,
      memoryUsage
    };
  }

  /**
   * 최대 깊이 계산
   */
  private calculateMaxDepth(): number {
    let maxDepth = 0;
    
    for (const scene of Array.from(this.scenes.values())) {
      if (!scene.relationships.parent) {
        const depth = this.calculateSceneDepth(scene.id);
        maxDepth = Math.max(maxDepth, depth);
      }
    }
    
    return maxDepth;
  }

  /**
   * 씬 깊이 계산
   */
  private calculateSceneDepth(sceneId: string): number {
    let depth = 0;
    let currentId = sceneId;
    
    while (currentId) {
      const relations = this.sceneRelations.get(currentId);
      currentId = relations?.parent || '';
      depth++;
    }
    
    return depth;
  }

  /**
   * 메모리 사용량 추정
   */
  private estimateMemoryUsage(): number {
    const jsonString = JSON.stringify(Array.from(this.scenes.values()));
    return new Blob([jsonString]).size;
  }

  /**
   * 정리
   */
  cleanup(): void {
    this.scenes.clear();
    this.sceneRelations.clear();
    this.activeSceneId = null;
    this.sceneCounter = 0;
  }
}

/**
 * SceneManager 팩토리 함수
 */
export function createSceneManager(): SceneManager {
  return new SceneManager();
}

