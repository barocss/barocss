/**
 * UI Renderer
 * Director의 UI 렌더링을 담당하는 클래스
 */

import {
  Scene,
  ComponentDefinition,
  UIAction,
  UserEvent,
  Position,
  Size
} from '../types';

export interface RenderOptions {
  container?: HTMLElement;
  position?: Position;
  size?: Size;
  theme?: 'light' | 'dark' | 'auto';
  animations?: boolean;
  transitions?: boolean;
}

export interface RenderStats {
  totalScenes: number;
  renderedScenes: number;
  memoryUsage: number;
  renderTime: number;
  lastRender: number;
}

export class UIRenderer {
  private container: HTMLElement;
  private renderedScenes: Map<string, HTMLElement> = new Map();
  private sceneManager: any; // SceneManager 타입은 순환 참조를 피하기 위해 any 사용
  private options: RenderOptions;
  private renderStats: RenderStats;
  private eventListeners: Map<string, (event: Event) => void> = new Map();

  constructor(container?: HTMLElement, options: Partial<RenderOptions> = {}) {
    this.container = container || document.body;
    this.options = {
      theme: 'auto',
      animations: true,
      transitions: true,
      ...options
    };
    this.renderStats = {
      totalScenes: 0,
      renderedScenes: 0,
      memoryUsage: 0,
      renderTime: 0,
      lastRender: 0
    };
  }

  /**
   * SceneManager 설정
   */
  setSceneManager(sceneManager: any): void {
    this.sceneManager = sceneManager;
  }

  /**
   * 씬 렌더링
   */
  renderScene(scene: Scene): void {
    const startTime = performance.now();
    
    try {
      // 기존 렌더링 제거
      this.removeScene(scene.id);

      // 새 씬 렌더링
      const element = this.createSceneElement(scene);
      this.container.appendChild(element);
      this.renderedScenes.set(scene.id, element);

      // 액션 핸들러 설정
      this.attachActionHandlers(element, scene);

      // 렌더링 통계 업데이트
      this.updateRenderStats(startTime);

      console.log(`[UIRenderer] Rendered scene: ${scene.id}`);
      
    } catch (error) {
      console.error(`[UIRenderer] Failed to render scene ${scene.id}:`, error);
      throw error;
    }
  }

  /**
   * 씬 업데이트
   */
  updateScene(scene: Scene): void {
    const existingElement = this.renderedScenes.get(scene.id);
    if (!existingElement) {
      // 씬이 렌더링되지 않은 경우 새로 렌더링
      this.renderScene(scene);
      return;
    }

    try {
      // 씬 내용 업데이트
      this.updateSceneContent(existingElement, scene);
      
      // 액션 핸들러 재설정
      this.attachActionHandlers(existingElement, scene);

      console.log(`[UIRenderer] Updated scene: ${scene.id}`);
      
    } catch (error) {
      console.error(`[UIRenderer] Failed to update scene ${scene.id}:`, error);
      throw error;
    }
  }

  /**
   * 씬 제거
   */
  removeScene(sceneId: string): void {
    const element = this.renderedScenes.get(sceneId);
    if (element) {
      // 이벤트 리스너 정리
      this.removeActionHandlers(element);
      
      // DOM에서 제거
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
      
      this.renderedScenes.delete(sceneId);
      console.log(`[UIRenderer] Removed scene: ${sceneId}`);
    }
  }

  /**
   * 모든 씬 제거
   */
  clearAll(): void {
    for (const [sceneId, element] of this.renderedScenes) {
      this.removeActionHandlers(element);
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
    this.renderedScenes.clear();
    console.log('[UIRenderer] Cleared all scenes');
  }

  /**
   * 씬 요소 생성
   */
  private createSceneElement(scene: Scene): HTMLElement {
    const element = document.createElement('div');
    element.className = `scene-container scene-${scene.type}`;
    element.setAttribute('data-scene-id', scene.id);
    element.setAttribute('data-scene-type', scene.type);
    
    // 씬 스타일 적용
    this.applySceneStyles(element, scene);
    
    // 씬 내용 렌더링
    this.renderSceneContent(element, scene);
    
    return element;
  }

  /**
   * 씬 내용 렌더링
   */
  private renderSceneContent(container: HTMLElement, scene: Scene): void {
    // HTML 렌더링
    if (scene.ui?.html) {
      container.innerHTML = scene.ui.html;
    } else {
      // 컴포넌트 기반 렌더링
      this.renderComponent(container, scene.component);
    }
  }

  /**
   * 컴포넌트 렌더링
   */
  private renderComponent(container: HTMLElement, component: ComponentDefinition): void {
    const element = document.createElement(component.type);
    
    // 속성 설정
    if (component.props) {
      Object.entries(component.props).forEach(([key, value]) => {
        if (key === 'className' || key === 'class') {
          element.className = value as string;
        } else if (key === 'style' && typeof value === 'object') {
          Object.assign(element.style, value);
        } else if (key.startsWith('data-')) {
          element.setAttribute(key, String(value));
        } else {
          (element as any)[key] = value;
        }
      });
    }

    // 자식 컴포넌트 렌더링
    if (component.children && component.children.length > 0) {
      component.children.forEach(child => {
        const childElement = this.renderComponent(document.createElement('div'), child);
        element.appendChild(childElement);
      });
    }

    container.appendChild(element);
  }

  /**
   * 씬 내용 업데이트
   */
  private updateSceneContent(element: HTMLElement, scene: Scene): void {
    // HTML 업데이트
    if (scene.ui?.html) {
      element.innerHTML = scene.ui.html;
    } else {
      // 컴포넌트 업데이트
      element.innerHTML = '';
      this.renderComponent(element, scene.component);
    }
  }

  /**
   * 씬 스타일 적용
   */
  private applySceneStyles(element: HTMLElement, scene: Scene): void {
    const styles: Record<string, string> = {};

    // 위치 설정
    if (scene.context.data.props?.position) {
      const pos = scene.context.data.props.position;
      styles.position = 'absolute';
      styles.left = `${pos.x}px`;
      styles.top = `${pos.y}px`;
      if (pos.z !== undefined) {
        styles.zIndex = pos.z.toString();
      }
    }

    // 크기 설정
    if (scene.context.data.props?.size) {
      const size = scene.context.data.props.size;
      styles.width = `${size.width}px`;
      styles.height = `${size.height}px`;
      if (size.minWidth) styles.minWidth = `${size.minWidth}px`;
      if (size.minHeight) styles.minHeight = `${size.minHeight}px`;
      if (size.maxWidth) styles.maxWidth = `${size.maxWidth}px`;
      if (size.maxHeight) styles.maxHeight = `${size.maxHeight}px`;
    }

    // 씬 타입별 스타일
    switch (scene.type) {
      case 'window':
        styles.border = '1px solid #e5e7eb';
        styles.borderRadius = '8px';
        styles.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
        styles.backgroundColor = 'white';
        break;
      case 'modal':
        styles.position = 'fixed';
        styles.top = '50%';
        styles.left = '50%';
        styles.transform = 'translate(-50%, -50%)';
        styles.zIndex = '1000';
        styles.backgroundColor = 'white';
        styles.borderRadius = '8px';
        styles.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';
        break;
      case 'popover':
        styles.position = 'absolute';
        styles.zIndex = '100';
        styles.backgroundColor = 'white';
        styles.border = '1px solid #e5e7eb';
        styles.borderRadius = '6px';
        styles.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
        break;
      case 'overlay':
        styles.position = 'fixed';
        styles.top = '0';
        styles.left = '0';
        styles.width = '100%';
        styles.height = '100%';
        styles.zIndex = '999';
        styles.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        break;
    }

    // 스타일 적용
    Object.assign(element.style, styles);
  }

  /**
   * 액션 핸들러 설정
   */
  private attachActionHandlers(element: HTMLElement, scene: Scene): void {
    // 기존 핸들러 제거
    this.removeActionHandlers(element);

    // 새 핸들러 설정
    if (scene.ui?.actions) {
      scene.ui.actions.forEach(action => {
        this.attachActionHandler(element, action);
      });
    }

    // 일반적인 UI 액션들 설정
    this.attachCommonActionHandlers(element, scene);
  }

  /**
   * 개별 액션 핸들러 설정
   */
  private attachActionHandler(element: HTMLElement, action: UIAction): void {
    const actionElement = element.querySelector(`[data-action="${action.id}"]`);
    if (!actionElement) return;

    const handler = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      this.handleUIAction(action, actionElement as HTMLElement, event);
    };

    actionElement.addEventListener('click', handler);
    this.eventListeners.set(`${action.id}_click`, handler);
  }

  /**
   * 공통 액션 핸들러 설정
   */
  private attachCommonActionHandlers(element: HTMLElement, scene: Scene): void {
    // 씬 닫기 버튼
    const closeButton = element.querySelector('[data-action="close"]');
    if (closeButton) {
      const handler = (event: Event) => {
        event.preventDefault();
        this.handleCloseScene(scene.id);
      };
      closeButton.addEventListener('click', handler);
      this.eventListeners.set(`${scene.id}_close`, handler);
    }

    // 폼 제출
    const forms = element.querySelectorAll('form[data-action]');
    forms.forEach(form => {
      const handler = (event: Event) => {
        event.preventDefault();
        this.handleFormSubmit(form as HTMLFormElement, scene);
      };
      form.addEventListener('submit', handler);
      this.eventListeners.set(`${scene.id}_form_${form.getAttribute('data-action')}`, handler);
    });

    // 입력 필드 변경
    const inputs = element.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      const handler = (event: Event) => {
        this.handleInputChange(input as HTMLInputElement, scene);
      };
      input.addEventListener('change', handler);
      input.addEventListener('input', handler);
      this.eventListeners.set(`${scene.id}_input_${input.getAttribute('name')}`, handler);
    });
  }

  /**
   * 액션 핸들러 제거
   */
  private removeActionHandlers(element: HTMLElement): void {
    // 이벤트 리스너 정리
    for (const [key, handler] of this.eventListeners) {
      if (key.startsWith(element.getAttribute('data-scene-id') || '')) {
        element.removeEventListener('click', handler);
        element.removeEventListener('submit', handler);
        element.removeEventListener('change', handler);
        element.removeEventListener('input', handler);
        this.eventListeners.delete(key);
      }
    }
  }

  /**
   * UI 액션 처리
   */
  private handleUIAction(action: UIAction, element: HTMLElement, event: Event): void {
    console.log(`[UIRenderer] Handling action: ${action.id} (${action.type})`);
    
    try {
      switch (action.type) {
        case 'navigate':
          this.handleNavigateAction(action, element);
          break;
        case 'create-scene':
          this.handleCreateSceneAction(action, element);
          break;
        case 'update-scene':
          this.handleUpdateSceneAction(action, element);
          break;
        case 'close-scene':
          this.handleCloseSceneAction(action, element);
          break;
        case 'custom':
          this.handleCustomAction(action, element);
          break;
        default:
          console.warn(`[UIRenderer] Unknown action type: ${action.type}`);
      }
    } catch (error) {
      console.error(`[UIRenderer] Error handling action ${action.id}:`, error);
    }
  }

  /**
   * 네비게이션 액션 처리
   */
  private handleNavigateAction(action: UIAction, element: HTMLElement): void {
    const targetSceneId = element.getAttribute('data-target-scene');
    if (targetSceneId && this.sceneManager) {
      this.sceneManager.setActiveScene(targetSceneId);
    }
  }

  /**
   * 씬 생성 액션 처리
   */
  private handleCreateSceneAction(action: UIAction, element: HTMLElement): void {
    // 커스텀 이벤트 발생
    const event = new CustomEvent('request-new-scene', {
      detail: { action, element }
    });
    document.dispatchEvent(event);
  }

  /**
   * 씬 업데이트 액션 처리
   */
  private handleUpdateSceneAction(action: UIAction, element: HTMLElement): void {
    // 커스텀 이벤트 발생
    const event = new CustomEvent('request-scene-update', {
      detail: { action, element }
    });
    document.dispatchEvent(event);
  }

  /**
   * 씬 닫기 액션 처리
   */
  private handleCloseSceneAction(action: UIAction, element: HTMLElement): void {
    const sceneId = element.closest('[data-scene-id]')?.getAttribute('data-scene-id');
    if (sceneId) {
      this.handleCloseScene(sceneId);
    }
  }

  /**
   * 커스텀 액션 처리
   */
  private handleCustomAction(action: UIAction, element: HTMLElement): void {
    // 커스텀 이벤트 발생
    const event = new CustomEvent('custom-action', {
      detail: { action, element }
    });
    document.dispatchEvent(event);
  }

  /**
   * 씬 닫기 처리
   */
  private handleCloseScene(sceneId: string): void {
    if (this.sceneManager) {
      this.sceneManager.removeScene(sceneId);
    }
    this.removeScene(sceneId);
  }

  /**
   * 폼 제출 처리
   */
  private handleFormSubmit(form: HTMLFormElement, scene: Scene): void {
    const formData = new FormData(form);
    const data: Record<string, any> = {};
    
    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }

    // 폼 데이터를 씬 상태에 저장
    if (this.sceneManager) {
      this.sceneManager.updateScene(scene.id, {
        state: { ...scene.state.data, formData: data }
      });
    }

    // 커스텀 이벤트 발생
    const event = new CustomEvent('form-submit', {
      detail: { sceneId: scene.id, data }
    });
    document.dispatchEvent(event);
  }

  /**
   * 입력 변경 처리
   */
  private handleInputChange(input: HTMLInputElement, scene: Scene): void {
    const name = input.getAttribute('name');
    if (!name) return;

    const value = input.type === 'checkbox' ? input.checked : input.value;
    
    // 입력 값을 씬 상태에 저장
    if (this.sceneManager) {
      this.sceneManager.updateScene(scene.id, {
        state: { 
          ...scene.state.data, 
          inputs: { 
            ...scene.state.data.inputs, 
            [name]: value 
          } 
        }
      });
    }

    // 커스텀 이벤트 발생
    const event = new CustomEvent('input-change', {
      detail: { sceneId: scene.id, name, value }
    });
    document.dispatchEvent(event);
  }

  /**
   * 렌더링 통계 업데이트
   */
  private updateRenderStats(startTime: number): void {
    const endTime = performance.now();
    this.renderStats.renderTime = endTime - startTime;
    this.renderStats.lastRender = Date.now();
    this.renderStats.renderedScenes = this.renderedScenes.size;
    this.renderStats.memoryUsage = this.estimateMemoryUsage();
  }

  /**
   * 메모리 사용량 추정
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    for (const element of this.renderedScenes.values()) {
      totalSize += element.innerHTML.length * 2; // 대략적인 계산
    }
    return totalSize;
  }

  /**
   * 렌더링 통계 조회
   */
  getStats(): RenderStats {
    return { ...this.renderStats };
  }

  /**
   * 렌더링된 씬 조회
   */
  getRenderedScenes(): string[] {
    return Array.from(this.renderedScenes.keys());
  }

  /**
   * 씬 요소 조회
   */
  getSceneElement(sceneId: string): HTMLElement | null {
    return this.renderedScenes.get(sceneId) || null;
  }

  /**
   * 정리
   */
  cleanup(): void {
    this.clearAll();
    this.eventListeners.clear();
  }
}

// ============================================================================
// 팩토리 함수
// ============================================================================

export function createUIRenderer(container?: HTMLElement, options?: Partial<RenderOptions>): UIRenderer {
  return new UIRenderer(container, options);
}
