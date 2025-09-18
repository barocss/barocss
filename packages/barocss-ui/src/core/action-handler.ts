/**
 * Action Handler
 * Director의 사용자 액션 처리를 담당하는 클래스
 */

import {
  UIAction,
  ActionData,
  ISceneManager,
  IUIRenderer,
  Scene,
  ComponentProp,
  SceneState
} from '../types';

import { getService } from './service-container';
import { formDataToRecord } from '../utils/form-data-helpers';

export interface ActionHandlerOptions {
  enableEventDelegation?: boolean;
  enableActionLogging?: boolean;
  enableErrorRecovery?: boolean;
  maxRetryAttempts?: number;
  retryDelay?: number;
}

export interface ActionLog {
  id: string;
  action: string;
  target: string;
  data: ActionData;
  timestamp: number;
  success: boolean;
  error?: string;
  duration: number;
}

export class ActionHandler {
  private options: ActionHandlerOptions;
  private actionLogs: ActionLog[] = [];
  private eventListeners: Map<string, (event: Event) => void> = new Map();
  private retryAttempts: Map<string, number> = new Map();

  constructor(options: Partial<ActionHandlerOptions> = {}) {
    this.options = {
      enableEventDelegation: true,
      enableActionLogging: true,
      enableErrorRecovery: true,
      maxRetryAttempts: 3,
      retryDelay: 1000,
      ...options
    };
    
    this.setupEventListeners();
  }

  /**
   * SceneManager 조회
   */
  private getSceneManager(): ISceneManager | null {
    return getService<ISceneManager>('sceneManager');
  }

  /**
   * UIRenderer 조회
   */
  private getUIRenderer(): IUIRenderer | null {
    return getService<IUIRenderer>('uiRenderer');
  }

  /**
   * 이벤트 리스너 설정
   */
  private setupEventListeners(): void {
    // 씬 생성 이벤트
    document.addEventListener('request-new-scene', this.handleNewSceneRequest.bind(this) as EventListener);
    
    // 씬 네비게이션 이벤트
    document.addEventListener('navigate-to-scene', this.handleNavigateToScene.bind(this) as EventListener);
    
    // 씬 업데이트 이벤트
    document.addEventListener('request-scene-update', this.handleSceneUpdate.bind(this) as EventListener);
    
    // 커스텀 액션 이벤트
    document.addEventListener('custom-action', this.handleCustomAction.bind(this) as EventListener);
    
    // 폼 제출 이벤트
    document.addEventListener('form-submit', this.handleFormSubmit.bind(this) as EventListener);
    
    // 입력 변경 이벤트
    document.addEventListener('input-change', this.handleInputChange.bind(this) as EventListener);
    
    // 전역 클릭 이벤트 (이벤트 위임)
    if (this.options.enableEventDelegation) {
      document.addEventListener('click', this.handleGlobalClick.bind(this));
    }
  }

  /**
   * 새 씬 생성 요청 처리
   */
  private async handleNewSceneRequest(event: Event): Promise<void> {
    const customEvent = event as CustomEvent;
    const { action } = customEvent.detail;
    
    try {
      this.logAction('request-new-scene', action.id, action.data);
      
      // 씬 생성 로직
      const sceneManager = this.getSceneManager();
      const uiRenderer = this.getUIRenderer();
      
      if (sceneManager) {
        const sceneConfig = this.createSceneConfigFromAction(action);
        const scene = await sceneManager.createScene(sceneConfig);
        
        // UI 렌더링
        if (uiRenderer && scene) {
          uiRenderer.renderScene(scene);
        }
        
        // eslint-disable-next-line
        console.log(`[ActionHandler] Created new scene: ${scene?.id}`);
      }
      
    } catch (error) {
      // eslint-disable-next-line
      console.error('[ActionHandler] Failed to create new scene:', error);
      this.handleActionError('request-new-scene', action.id, error);
    }
  }

  /**
   * 씬 네비게이션 처리
   */
  private handleNavigateToScene(event: Event): void {
    const customEvent = event as CustomEvent;
    const { action, element } = customEvent.detail;
    
    try {
      this.logAction('navigate-to-scene', action.id, action.data);
      
      const targetSceneId = element.getAttribute('data-target-scene');
      const sceneManager = this.getSceneManager();
      if (targetSceneId && sceneManager) {
        sceneManager.setActiveScene(targetSceneId);
        // eslint-disable-next-line
        console.log(`[ActionHandler] Navigated to scene: ${targetSceneId}`);
      }
      
    } catch (error) {
      // eslint-disable-next-line
      console.error('[ActionHandler] Failed to navigate to scene:', error);
      this.handleActionError('navigate-to-scene', action.id, error);
    }
  }

  /**
   * 씬 업데이트 처리
   */
  private async handleSceneUpdate(event: Event): Promise<void> {
    const customEvent = event as CustomEvent;
    const { action, element } = customEvent.detail;
    
    try {
      this.logAction('request-scene-update', action.id, action.data);
      
      const sceneId = element.closest('[data-scene-id]')?.getAttribute('data-scene-id');
      const sceneManager = this.getSceneManager();
      const uiRenderer = this.getUIRenderer();
      
      if (sceneId && sceneManager) {
        const updates = this.createUpdateConfigFromAction(action);
        await sceneManager.updateScene(sceneId, updates);
        
        // UI 업데이트
        if (uiRenderer) {
          const scene = sceneManager.getScene(sceneId);
          if (scene) {
            uiRenderer.updateScene(sceneId, scene);
          }
        }
        
        // eslint-disable-next-line
        console.log(`[ActionHandler] Updated scene: ${sceneId}`);
      }
      
    } catch (error) {
      // eslint-disable-next-line
      console.error('[ActionHandler] Failed to update scene:', error);
      this.handleActionError('request-scene-update', action.id, error);
    }
  }

  /**
   * 커스텀 액션 처리
   */
  private handleCustomAction(event: Event): void {
    const customEvent = event as CustomEvent;
    const { action, element } = customEvent.detail;
    
    try {
      this.logAction('custom-action', action.id, action.data);
      
      // 커스텀 액션 로직
      this.executeCustomAction(action, element);
      
    } catch (error) {
      // eslint-disable-next-line
      console.error('[ActionHandler] Failed to execute custom action:', error);
      this.handleActionError('custom-action', action.id, error);
    }
  }

  /**
   * 폼 제출 처리
   */
  private async handleFormSubmit(event: Event): Promise<void> {
    const customEvent = event as CustomEvent;
    const { sceneId, data } = customEvent.detail;
    
    try {
      this.logAction('form-submit', 'form-submit', data);
      
      // 폼 데이터 처리
      const sceneManager = this.getSceneManager();
      if (sceneManager) {
        const scene = sceneManager.getScene(sceneId);
        if (scene) {
          // 폼 데이터를 씬 상태에 저장
          await sceneManager.updateScene(sceneId, {
            state: { 
              ...scene.state, 
              formData: data,
              data: { ...scene.state.data }
            }
          });
        }
      }
      
      // eslint-disable-next-line
      console.log(`[ActionHandler] Form submitted for scene: ${sceneId}`);
      
    } catch (error) {
      // eslint-disable-next-line
      console.error('[ActionHandler] Failed to handle form submit:', error);
      this.handleActionError('form-submit', 'form-submit', error);
    }
  }

  /**
   * 입력 변경 처리
   */
  private async handleInputChange(event: Event): Promise<void> {
    const customEvent = event as CustomEvent;
    const { sceneId, name, value } = customEvent.detail;
    
    try {
      this.logAction('input-change', name, { name, value });
      
      // 입력 값 처리
      const sceneManager = this.getSceneManager();
      if (sceneManager) {
        const scene = sceneManager.getScene(sceneId);
        if (scene) {
          await sceneManager.updateScene(sceneId, {
            state: { 
              ...scene.state,
              inputs: { 
                ...scene.state.inputs, 
                [name]: value 
              },
              data: { ...scene.state.data }
            }
          });
        }
      }
      
    } catch (error) {
      // eslint-disable-next-line
      console.error('[ActionHandler] Failed to handle input change:', error);
      this.handleActionError('input-change', name, error);
    }
  }

  /**
   * 전역 클릭 이벤트 처리 (이벤트 위임)
   */
  private handleGlobalClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target) return;

    // 액션 버튼 클릭 처리
    const actionButton = target.closest('[data-action]') as HTMLElement;
    if (actionButton) {
      this.handleButtonClick(actionButton);
    }
  }

  /**
   * 버튼 클릭 처리
   */
  private handleButtonClick(button: HTMLElement): void {
    const actionType = button.getAttribute('data-action');
    if (!actionType) return;

    try {
      // 액션 데이터 추출
      this.extractActionData(button);
      
      // 액션 타입에 따른 처리
      switch (actionType) {
        case 'navigate':
          this.handleNavigateAction(button);
          break;
        case 'create-scene':
          this.handleCreateSceneAction(button);
          break;
        case 'update-scene':
          this.handleUpdateSceneAction(button);
          break;
        case 'close-scene':
          this.handleCloseSceneAction(button);
          break;
        case 'submit':
          this.handleSubmitAction(button);
          break;
        case 'cancel':
          this.handleCancelAction(button);
          break;
        default:
          this.handleCustomButtonAction(button, actionType);
      }
      
    } catch (error) {
      // eslint-disable-next-line
      console.error('[ActionHandler] Failed to handle button click:', error);
      this.handleActionError('button-click', actionType, error);
    }
  }

  /**
   * 네비게이션 액션 처리
   */
  private handleNavigateAction(button: HTMLElement): void {
    const targetSceneId = button.getAttribute('data-target-scene');
    const sceneManager = this.getSceneManager();
    
    if (targetSceneId && sceneManager) {
      sceneManager.setActiveScene(targetSceneId);
      // eslint-disable-next-line
      console.log(`[ActionHandler] Navigated to scene: ${targetSceneId}`);
    }
  }

  /**
   * 씬 생성 액션 처리
   */
  private handleCreateSceneAction(button: HTMLElement): void {
    const event = new CustomEvent('request-new-scene', {
      detail: { 
        action: { 
          id: 'create-scene', 
          type: 'create-scene', 
          data: {}
        }, 
        element: button 
      }
    });
    document.dispatchEvent(event);
  }

  /**
   * 씬 업데이트 액션 처리
   */
  private handleUpdateSceneAction(button: HTMLElement): void {
    const event = new CustomEvent('request-scene-update', {
      detail: { 
        action: { 
          id: 'update-scene', 
          type: 'update-scene', 
          data: {} 
        }, 
        element: button 
      }
    });
    document.dispatchEvent(event);
  }

  /**
   * 씬 닫기 액션 처리
   */
  private handleCloseSceneAction(button: HTMLElement): void {
    const sceneId = button.closest('[data-scene-id]')?.getAttribute('data-scene-id');
    const sceneManager = this.getSceneManager();
    if (sceneId && sceneManager) {
      sceneManager.removeScene(sceneId);
      const uiRenderer = this.getUIRenderer();
      if (uiRenderer) {
        uiRenderer.removeScene(sceneId);
      }
      // eslint-disable-next-line
      console.log(`[ActionHandler] Closed scene: ${sceneId}`);
    }
  }

  /**
   * 제출 액션 처리
   */
  private handleSubmitAction(button: HTMLElement): void {
    const form = button.closest('form');
    if (form) {
      const formData = new FormData(form);
      // eslint-disable-next-line
      const data: Record<string, any> = {};
      
      const formDataRecord = formDataToRecord(formData);
      Object.assign(data, formDataRecord);
      
      const event = new CustomEvent('form-submit', {
        detail: { 
          sceneId: button.closest('[data-scene-id]')?.getAttribute('data-scene-id'),
          data 
        }
      });
      document.dispatchEvent(event);
    }
  }

  /**
   * 취소 액션 처리
   */
  private handleCancelAction(button: HTMLElement): void {
    const sceneId = button.closest('[data-scene-id]')?.getAttribute('data-scene-id');
    if (sceneId) {
      this.handleCloseSceneAction(button);
    }
  }

  /**
   * 커스텀 버튼 액션 처리
   */
  private handleCustomButtonAction(button: HTMLElement, actionType: string): void {
    const event = new CustomEvent('custom-action', {
      detail: { 
        action: { 
          id: actionType, 
          type: 'custom', 
          data: {}
        }, 
        element: button 
      }
    });
    document.dispatchEvent(event);
  }

  /**
   * 액션 데이터 추출
   */
  private extractActionData(element: HTMLElement): ActionData {
    const data: ActionData = {};
    
    // data-* 속성들 추출
    for (const attr of Array.from(element.attributes)) {
      if (attr.name.startsWith('data-') && attr.name !== 'data-action') {
        const key = attr.name.replace('data-', '');
        data[key] = attr.value;
      }
    }
    
    // 폼 데이터 추출
    const form = element.closest('form');
    if (form) {
      const formData = new FormData(form);
      const formDataRecord = formDataToRecord(formData);
      Object.assign(data, formDataRecord);
    }
    
    return data;
  }

  /**
   * 커스텀 액션 실행
   */
  private executeCustomAction(action: UIAction, element: HTMLElement): void {
    // 커스텀 액션 로직 구현
    // eslint-disable-next-line
    console.log(`[ActionHandler] Executing custom action: ${action.id}`);
    
    // 예시: 토글 액션
    if (action.id === 'toggle') {
      const target = element.querySelector(action.data?.target || '');
      if (target) {
        target.classList.toggle('hidden');
      }
    }
    
    // 예시: 애니메이션 액션
    if (action.id === 'animate') {
      element.style.transition = 'all 0.3s ease';
      element.style.transform = (action.data?.transform as string) || 'scale(1.1)';
      setTimeout(() => {
        element.style.transform = 'scale(1)';
      }, 300);
    }
  }

  /**
   * 액션 에러 처리
   */
  private handleActionError(actionType: string, actionId: string, error: unknown): void {
    // eslint-disable-next-line
    console.error(`[ActionHandler] Action error: ${actionType}.${actionId}`, error);
    
    // 에러 복구 시도
    if (this.options.enableErrorRecovery) {
      this.attemptActionRecovery(actionType, actionId);
    }
  }

  /**
   * 액션 복구 시도
   */
  private attemptActionRecovery(actionType: string, actionId: string): void {
    const retryKey = `${actionType}.${actionId}`;
    const currentAttempts = this.retryAttempts.get(retryKey) || 0;
    
    if (currentAttempts < this.options.maxRetryAttempts!) {
      this.retryAttempts.set(retryKey, currentAttempts + 1);
      
      setTimeout(() => {
        // eslint-disable-next-line
        console.log(`[ActionHandler] Retrying action: ${retryKey} (attempt ${currentAttempts + 1})`);
        // 복구 로직 구현
        this.retryAttempts.delete(retryKey);
      }, this.options.retryDelay! * (currentAttempts + 1));
    } else {
      // eslint-disable-next-line
      console.error(`[ActionHandler] Max retry attempts reached for: ${retryKey}`);
      this.retryAttempts.delete(retryKey);
    }
  }

  /**
   * 액션 로깅
   */
  private logAction(actionType: string, actionId: string, data: ActionData): void {
    if (!this.options.enableActionLogging) return;
    
    const log: ActionLog = {
      id: `${actionType}.${actionId}.${Date.now()}`,
      action: actionType,
      target: actionId,
      data,
      timestamp: Date.now(),
      success: true,
      duration: 0
    };
    
    this.actionLogs.push(log);
    
    // 로그 크기 제한
    if (this.actionLogs.length > 1000) {
      this.actionLogs = this.actionLogs.slice(-500);
    }
  }

  /**
   * 액션 로그 조회
   */
  getActionLogs(): ActionLog[] {
    return [...this.actionLogs];
  }

  /**
   * 액션 로그 정리
   */
  clearActionLogs(): void {
    this.actionLogs = [];
  }

  /**
   * 액션 통계 조회
   */
  getActionStats(): {
    totalActions: number;
    successRate: number;
    errorRate: number;
    mostCommonAction: string;
    averageDuration: number;
  } {
    const totalActions = this.actionLogs.length;
    const successfulActions = this.actionLogs.filter(log => log.success).length;
    const errorRate = totalActions > 0 ? (totalActions - successfulActions) / totalActions : 0;
    const successRate = 1 - errorRate;
    
    // 가장 많이 사용된 액션
    const actionCounts = this.actionLogs.reduce((counts, log) => {
      counts[log.action] = (counts[log.action] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    const mostCommonAction = Object.entries(actionCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none';
    
    // 평균 지속 시간
    const averageDuration = this.actionLogs.length > 0 
      ? this.actionLogs.reduce((sum, log) => sum + log.duration, 0) / this.actionLogs.length 
      : 0;
    
    return {
      totalActions,
      successRate,
      errorRate,
      mostCommonAction,
      averageDuration
    };
  }

  /**
   * 정리
   */
  cleanup(): void {
    // 이벤트 리스너 제거
    document.removeEventListener('request-new-scene', this.handleNewSceneRequest.bind(this));
    document.removeEventListener('navigate-to-scene', this.handleNavigateToScene.bind(this));
    document.removeEventListener('request-scene-update', this.handleSceneUpdate.bind(this));
    document.removeEventListener('custom-action', this.handleCustomAction.bind(this));
    document.removeEventListener('form-submit', this.handleFormSubmit.bind(this));
    document.removeEventListener('input-change', this.handleInputChange.bind(this));
    document.removeEventListener('click', this.handleGlobalClick.bind(this));
    
    // 데이터 정리
    this.actionLogs = [];
    this.retryAttempts.clear();
    this.eventListeners.clear();
  }

  /**
   * 씬 설정 생성 (액션에서)
   */
  private createSceneConfigFromAction(action: UIAction): Partial<Scene> {
    return {
      type: action.data?.sceneType || 'window',
      title: action.data?.title || 'New Scene',
      component: {
        type: 'div',
        name: 'DynamicComponent',
        props: (action.data?.props as Record<string, ComponentProp>) || {}
      },
      // parentId: action.data?.parentSceneId, // Scene 인터페이스에 없음
      // position: action.data?.position,      // Scene 인터페이스에 없음
      // size: action.data?.size,             // Scene 인터페이스에 없음
      // props: action.data?.props,           // Scene 인터페이스에 없음
      state: action.data?.state as SceneState || {
        visible: true,
        active: false,
        focused: false,
        loading: false,
        error: null,
        data: {}
      }
    };
  }

  /**
   * 업데이트 설정 생성 (액션에서)
   */
  private createUpdateConfigFromAction(action: UIAction): Partial<Scene> {
    return {
      title: action.data?.title,
      component: action.data?.component,
      // props: action.data?.props,    // Scene 인터페이스에 없음
      state: action.data?.state as SceneState || {
        visible: true,
        active: false,
        focused: false,
        loading: false,
        error: null,
        data: {}
      }
      // position: action.data?.position, // Scene 인터페이스에 없음
      // size: action.data?.size          // Scene 인터페이스에 없음
    };
  }
}

// ============================================================================
// 팩토리 함수
// ============================================================================

export function createActionHandler(options?: Partial<ActionHandlerOptions>): ActionHandler {
  return new ActionHandler(options);
}
