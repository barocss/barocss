/**
 * Scene Manager
 * Director의 씬 관리를 담당하는 클래스
 */

import {
  Scene,
  SceneConfig,
  SceneType,
  SceneState,
  ComponentDefinition,
  Position,
  Size,
  SceneError,
  ValidationResult,
  Schema
} from '../types';

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
  private validationSchemas: Map<string, Schema> = new Map();

  constructor() {
    this.setupDefaultValidationSchemas();
  }

  /**
   * 씬 생성
   */
  createScene(config: SceneConfig): Scene {
    const sceneId = config.id || this.generateSceneId();
    
    // 중복 ID 검사
    if (this.scenes.has(sceneId)) {
      throw new SceneError(`Scene with ID '${sceneId}' already exists`);
    }

    // 씬 검증
    this.validateSceneConfig(config);

    const now = Date.now();
    const scene: Scene = {
      id: sceneId,
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
      childScene.context.parent.sceneId = parentId;
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
    for (const [sceneId, scene] of this.scenes) {
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
      currentId = relations?.parent;
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
      currentId = relations?.parent;
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
  private generateSceneId(): string {
    return `scene_${++this.sceneCounter}_${Date.now()}`;
  }

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
    
    for (const scene of this.scenes.values()) {
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
      currentId = relations?.parent;
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

// ============================================================================
// 팩토리 함수
// ============================================================================

export function createSceneManager(): SceneManager {
  return new SceneManager();
}
