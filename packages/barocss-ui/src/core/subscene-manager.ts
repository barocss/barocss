/**
 * SubScene Manager
 * 부분 업데이트를 위한 SubScene 관리
 */

import { 
  SubScene, 
  SubSceneConfig, 
  SubSceneState, 
  Scene,
  ComponentDefinition,
  UpdateOperation
} from '../types';
import { generateId, getCurrentTimestamp } from '../utils/id-generator';

export interface SubSceneManagerOptions {
  maxSubScenes: number;
  autoCleanup: boolean;
  updateInterval: number;
}

export class SubSceneManager {
  private subScenes: Map<string, SubScene> = new Map();
  private parentSubScenes: Map<string, string[]> = new Map(); // parentSceneId -> subSceneIds[]
  private updateQueue: UpdateOperation[] = [];
  private isProcessingUpdates = false;
  private options: SubSceneManagerOptions;

  constructor(options: Partial<SubSceneManagerOptions> = {}) {
    this.options = {
      maxSubScenes: 100,
      autoCleanup: true,
      updateInterval: 16, // 60fps
      ...options
    };
  }

  /**
   * SubScene 생성
   */
  createSubScene(parentSceneId: string, config: SubSceneConfig): SubScene {
    if (this.subScenes.size >= this.options.maxSubScenes) {
      this.cleanupOldSubScenes();
    }

    const subScene: SubScene = {
      id: config.id || generateId('subscene'),
      parentSceneId,
      type: config.type || 'partial',
      selector: config.selector,
      ui: {
        type: config.ui.type || 'html',
        content: typeof config.ui.content === 'string' ? config.ui.content : '',
        updateMode: config.ui.updateMode || 'replace'
      },
      state: this.initializeSubSceneState(config.initialState),
      formData: config.formData || {},
      linkedSubScenes: [],
      metadata: {
        createdAt: getCurrentTimestamp(),
        updatedAt: getCurrentTimestamp(),
        version: 1,
        autoUpdate: config.autoUpdate || false,
        updateInterval: config.updateInterval
      },
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp(),
      version: 1
    };

    this.subScenes.set(subScene.id, subScene);
    this.addSubSceneToParent(parentSceneId, subScene.id);

    // 자동 업데이트 설정
    if (subScene.metadata.autoUpdate && subScene.metadata.updateInterval) {
      this.setupAutoUpdate(subScene.id);
    }

    return subScene;
  }

  /**
   * SubScene 업데이트
   */
  updateSubScene(subSceneId: string, updates: Partial<SubSceneConfig>): void {
    const subScene = this.subScenes.get(subSceneId);
    if (!subScene) {
      throw new Error(`SubScene ${subSceneId} not found`);
    }

    const updatedSubScene: SubScene = {
      ...subScene,
      ...updates,
      ui: {
        ...subScene.ui,
        ...(updates.ui || {}),
        content: typeof updates.ui?.content === 'string' ? updates.ui.content : subScene.ui.content
      },
      metadata: {
        ...subScene.metadata,
        updatedAt: getCurrentTimestamp(),
        version: subScene.metadata.version + 1
      }
    };

    this.subScenes.set(subSceneId, updatedSubScene);
    this.queueUpdate({
      type: 'subscene',
      target: subSceneId,
      content: updatedSubScene
    });
  }

  /**
   * SubScene 내용 업데이트
   */
  updateSubSceneContent(subSceneId: string, content: any): void {
    const subScene = this.subScenes.get(subSceneId);
    if (!subScene) {
      throw new Error(`SubScene ${subSceneId} not found`);
    }

    const updatedSubScene: SubScene = {
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
          lastUpdate: getCurrentTimestamp(),
          updateCount: subScene.state.update.updateCount + 1
        }
      },
      metadata: {
        ...subScene.metadata,
        updatedAt: getCurrentTimestamp(),
        version: subScene.metadata.version + 1
      }
    };

    this.subScenes.set(subSceneId, updatedSubScene);
    this.queueUpdate({
      type: 'subscene',
      target: subSceneId,
      content: updatedSubScene
    });
  }

  /**
   * SubScene 제거
   */
  removeSubScene(subSceneId: string): void {
    const subScene = this.subScenes.get(subSceneId);
    if (!subScene) return;

    // 부모에서 제거
    this.removeSubSceneFromParent(subScene.parentSceneId, subSceneId);
    
    // 연결된 SubScene들도 제거
    subScene.linkedSubScenes.forEach(linkedId => {
      this.removeSubScene(linkedId);
    });

    this.subScenes.delete(subSceneId);
  }

  /**
   * SubScene 조회
   */
  getSubScene(subSceneId: string): SubScene | null {
    return this.subScenes.get(subSceneId) || null;
  }

  /**
   * 부모 Scene의 SubScene들 조회
   */
  getSubScenesByParent(parentSceneId: string): SubScene[] {
    const subSceneIds = this.parentSubScenes.get(parentSceneId) || [];
    return subSceneIds.map(id => this.subScenes.get(id)!).filter(Boolean);
  }

  /**
   * 모든 SubScene 조회
   */
  getAllSubScenes(): SubScene[] {
    return Array.from(this.subScenes.values());
  }

  /**
   * SubScene 연결
   */
  linkSubScenes(subSceneId1: string, subSceneId2: string): void {
    const subScene1 = this.subScenes.get(subSceneId1);
    const subScene2 = this.subScenes.get(subSceneId2);
    
    if (!subScene1 || !subScene2) return;

    if (!subScene1.linkedSubScenes.includes(subSceneId2)) {
      subScene1.linkedSubScenes.push(subSceneId2);
    }
    if (!subScene2.linkedSubScenes.includes(subSceneId1)) {
      subScene2.linkedSubScenes.push(subSceneId1);
    }
  }

  /**
   * SubScene 연결 해제
   */
  unlinkSubScenes(subSceneId1: string, subSceneId2: string): void {
    const subScene1 = this.subScenes.get(subSceneId1);
    const subScene2 = this.subScenes.get(subSceneId2);
    
    if (!subScene1 || !subScene2) return;

    subScene1.linkedSubScenes = subScene1.linkedSubScenes.filter(id => id !== subSceneId2);
    subScene2.linkedSubScenes = subScene2.linkedSubScenes.filter(id => id !== subSceneId1);
  }

  /**
   * 부모 Scene 제거 시 모든 SubScene 정리
   */
  cleanupByParent(parentSceneId: string): void {
    const subSceneIds = this.parentSubScenes.get(parentSceneId) || [];
    subSceneIds.forEach(id => this.removeSubScene(id));
    this.parentSubScenes.delete(parentSceneId);
  }

  /**
   * 업데이트 큐 처리
   */
  private async processUpdateQueue(): Promise<void> {
    if (this.isProcessingUpdates) return;
    this.isProcessingUpdates = true;

    while (this.updateQueue.length > 0) {
      const update = this.updateQueue.shift();
      if (update) {
        await this.executeUpdate(update);
      }
    }

    this.isProcessingUpdates = false;
  }

  /**
   * 업데이트 큐에 추가
   */
  private queueUpdate(update: UpdateOperation): void {
    this.updateQueue.push(update);
    if (this.updateQueue.length === 1) {
      setTimeout(() => this.processUpdateQueue(), this.options.updateInterval);
    }
  }

  /**
   * 업데이트 실행
   */
  private async executeUpdate(update: UpdateOperation): Promise<void> {
    try {
      switch (update.type) {
        case 'subscene':
          await this.updateSubSceneInDOM(update.target);
          break;
        default:
          // eslint-disable-next-line
          console.warn(`Unknown update type: ${update.type}`);
      }
    } catch (error) {
      // eslint-disable-next-line
      console.error(`SubScene update failed:`, error);
    }
  }

  /**
   * DOM에서 SubScene 업데이트
   */
  private async updateSubSceneInDOM(subSceneId: string): Promise<void> {
    const subScene = this.subScenes.get(subSceneId);
    if (!subScene) return;

    const parentElement = document.querySelector(`[data-scene-id="${subScene.parentSceneId}"]`);
    if (!parentElement) return;

    const targetElement = parentElement.querySelector(subScene.selector);
    if (!targetElement) return;

    const content = typeof subScene.ui.content === 'string' ? subScene.ui.content : '';
    
    switch (subScene.ui.updateMode) {
      case 'replace':
        targetElement.innerHTML = content;
        break;
      case 'append':
        targetElement.insertAdjacentHTML('beforeend', content);
        break;
      case 'prepend':
        targetElement.insertAdjacentHTML('afterbegin', content);
        break;
      case 'merge':
        // TODO: 더 정교한 병합 로직 구현
        targetElement.innerHTML = content;
        break;
    }
  }

  /**
   * 자동 업데이트 설정
   */
  private setupAutoUpdate(subSceneId: string): void {
    const subScene = this.subScenes.get(subSceneId);
    if (!subScene || !subScene.metadata.updateInterval) return;

    const interval = setInterval(() => {
      const currentSubScene = this.subScenes.get(subSceneId);
      if (!currentSubScene || !currentSubScene.metadata.autoUpdate) {
        clearInterval(interval);
        return;
      }

      // 자동 업데이트 로직 (예: 데이터 새로고침)
      this.triggerAutoUpdate();
    }, subScene.metadata.updateInterval);

    // 정리용으로 interval ID 저장
    subScene.state.update.updateInterval = interval as any;
  }

  /**
   * 자동 업데이트 트리거
   */
  private triggerAutoUpdate(): void {
    // TODO: 실제 자동 업데이트 로직 구현
    // 예: API 호출, 데이터 새로고침 등
  }

  /**
   * 오래된 SubScene 정리
   */
  private cleanupOldSubScenes(): void {
    const subScenes = Array.from(this.subScenes.values())
      .sort((a, b) => a.metadata.updatedAt - b.metadata.updatedAt);

    const toRemove = subScenes.slice(0, Math.floor(this.options.maxSubScenes * 0.1));
    toRemove.forEach(subScene => this.removeSubScene(subScene.id));
  }

  /**
   * 부모에 SubScene 추가
   */
  private addSubSceneToParent(parentSceneId: string, subSceneId: string): void {
    if (!this.parentSubScenes.has(parentSceneId)) {
      this.parentSubScenes.set(parentSceneId, []);
    }
    this.parentSubScenes.get(parentSceneId)!.push(subSceneId);
  }

  /**
   * 부모에서 SubScene 제거
   */
  private removeSubSceneFromParent(parentSceneId: string, subSceneId: string): void {
    const subSceneIds = this.parentSubScenes.get(parentSceneId);
    if (subSceneIds) {
      const index = subSceneIds.indexOf(subSceneId);
      if (index > -1) {
        subSceneIds.splice(index, 1);
      }
      if (subSceneIds.length === 0) {
        this.parentSubScenes.delete(parentSceneId);
      }
    }
  }

  /**
   * SubScene 상태 초기화
   */
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

  /**
   * 정리
   */
  cleanup(): void {
    this.subScenes.clear();
    this.parentSubScenes.clear();
    this.updateQueue = [];
  }
}

// 팩토리 함수
export function createSubSceneManager(options?: Partial<SubSceneManagerOptions>): SubSceneManager {
  return new SubSceneManager(options);
}
