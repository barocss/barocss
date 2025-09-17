/**
 * UI Renderer
 * Director의 UI 렌더링을 담당하는 클래스
 */

import {
  Scene,
  ComponentDefinition,
  UIAction,
  Position,
  Size,
  ISceneManager,
  AgentResponse
} from '../types';

import { getService } from './service-container';
import { formDataToRecord } from '../utils/form-data-helpers';

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
   * SceneManager 조회
   */
  private getSceneManager(): ISceneManager | null {
    return getService<ISceneManager>('sceneManager');
  }

  /**
   * 씬 렌더링
   */
  renderScene(scene: Scene): void {
    const startTime = performance.now();
    
    try {
      // 기존 씬들 모두 제거 (새 Scene으로 교체)
      this.clearAll();

      // 새 씬 렌더링
      const element = this.createSceneElement(scene);
      this.container.appendChild(element);
      this.renderedScenes.set(scene.id, element);

      // 액션 핸들러 설정
      this.attachActionHandlers(element, scene);

      // 렌더링 통계 업데이트
      this.updateRenderStats(startTime);

      // eslint-disable-next-line
      console.log(`[UIRenderer] Rendered scene: ${scene.id}`);
      
    } catch (error) {
      // eslint-disable-next-line
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

      // eslint-disable-next-line
      console.log(`[UIRenderer] Updated scene: ${scene.id}`);
      
    } catch (error) {
      // eslint-disable-next-line
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
      // eslint-disable-next-line
      console.log(`[UIRenderer] Removed scene: ${sceneId}`);
    }
  }

  /**
   * 모든 씬 제거
   */
  clearAll(): void {
    for (const [, element] of Array.from(this.renderedScenes)) {
      this.removeActionHandlers(element);
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
    this.renderedScenes.clear();
    // eslint-disable-next-line
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
    // AI 응답에서 HTML 추출 시도
    const aiHtml = this.extractAIHtmlContent(scene);
    
    if (aiHtml) {
      container.innerHTML = aiHtml;
    } else if (scene.ui && 'html' in scene.ui && typeof scene.ui.html === 'string') {
      container.innerHTML = scene.ui.html;
    } else {
      // 컴포넌트 기반 렌더링
      this.renderComponent(container, scene.component);
    }
  }

  /**
   * Scene에서 AI가 생성한 HTML 콘텐츠 추출
   */
  private extractAIHtmlContent(scene: Scene): string | null {
    // Scene.ui.content에서 직접 추출 (가장 우선순위)
    if (scene.ui?.content && typeof scene.ui.content === 'string') {
      return scene.ui.content;
    }

    // state.data.aiHtml에서 추출
    if (scene.state?.data?.aiHtml) {
      return scene.state.data.aiHtml as string;
    }
    
    // context에서 AI HTML 찾기
    if (scene.context?.data?.state?.aiHtml) {
      return scene.context.data.state.aiHtml;
    }

    // ComponentDefinition에서 AI HTML 추출
    if (scene.component?.props?.['data-ui-type'] === 'html') {
      // SceneManager에서 AI 응답 HTML을 저장한 위치를 찾기
      const metadata = scene.metadata;
      if (metadata && 'aiResponse' in metadata) {
        const aiResponse = metadata.aiResponse as AgentResponse;
        if (aiResponse.type === 'success' && 'result' in aiResponse.data) {
          const result = aiResponse.data.result;
          if (result && typeof result === 'object' && 'ui' in result && result.ui && typeof result.ui === 'object' && 'content' in result.ui) {
            return result.ui.content as string || null;
          }
          return null;
        }
        return null;
      }
    }
    
    // 기본 HTML 렌더링을 위한 fallback
    if (scene.component?.name === 'AIGeneratedContent') {
      return `<div class="ai-scene p-4 bg-gray-50 rounded">
        <h2 class="text-lg font-bold mb-2">${scene.title}</h2>
        <p class="text-gray-600">AI 응답을 렌더링 중...</p>
      </div>`;
    }
    
    return null;
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
          // 표준 HTML 속성으로 설정
          if (key in element) {
            // eslint-disable-next-line
            (element as Record<string, any>)[key] = value;
          } else {
            element.setAttribute(key, String(value));
          }
        }
      });
    }

    // 자식 컴포넌트 렌더링
    if (component.children && component.children.length > 0) {
      component.children.forEach(child => {
        const childContainer = document.createElement('div');
        this.renderComponent(childContainer, child);
        // childContainer의 첫 번째 자식을 현재 element에 추가
        if (childContainer.firstChild) {
          element.appendChild(childContainer.firstChild);
        }
      });
    }

    container.appendChild(element);
  }

  /**
   * 씬 내용 업데이트
   */
  private updateSceneContent(element: HTMLElement, scene: Scene): void {
    // HTML 업데이트
    if (scene.ui && 'html' in scene.ui && typeof scene.ui.html === 'string') {
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

    // 새 핸들러 설정 - actions는 Record<string, string> 형태
    if (scene.ui?.actions && typeof scene.ui.actions === 'object') {
      Object.entries(scene.ui.actions).forEach(([selector, actionName]) => {
        // selector: '[data-action="save"]', actionName: 'save'
        const actionElements = element.querySelectorAll(selector);
        actionElements.forEach(actionElement => {
          this.attachSelectorActionHandler(actionElement as HTMLElement, actionName as string, scene);
        });
      });
    }

    // 일반적인 UI 액션들 설정
    this.attachCommonActionHandlers(element, scene);
  }

  /**
   * 셀렉터 기반 액션 핸들러 설정
   */
  private attachSelectorActionHandler(element: HTMLElement, actionName: string, scene: Scene): void {
    const handler = (event: Event) => {
      event.preventDefault();
      // eslint-disable-next-line
      console.log(`[UIRenderer] Action triggered: ${actionName}`);
      
      // ActionHandler가 있으면 위임, 없으면 기본 처리
      const sceneManager = this.getSceneManager();
      if (sceneManager?.getActionHandler) {
        const actionHandler = sceneManager.getActionHandler();
        actionHandler.executeAction(actionName, {
          element: element,
          scene: scene,
          event: event
        });
      }
    };

    element.addEventListener('click', handler);
    
    // 정리를 위해 핸들러 저장
    const handlerId = `${scene.id}-${actionName}-${Date.now()}`;
    this.eventListeners.set(handlerId, handler);
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
      this.handleUIAction(action, actionElement as HTMLElement);
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
      const handler = () => {
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
    for (const [key, handler] of Array.from(this.eventListeners)) {
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
  private handleUIAction(action: UIAction, element: HTMLElement): void {
    // eslint-disable-next-line
    console.log(`[UIRenderer] Handling action: ${action.id} (${action.type})`);
    
    try {
      switch (action.type) {
        case 'navigate':
          this.handleNavigateAction(element);
          break;
        case 'create-scene':
          this.handleCreateSceneAction(action, element);
          break;
        case 'update-scene':
          this.handleUpdateSceneAction(action, element);
          break;
        case 'close-scene':
          this.handleCloseSceneAction(element);
          break;
        case 'custom':
          this.handleCustomAction(action, element);
          break;
        default:
          // eslint-disable-next-line
          console.warn(`[UIRenderer] Unknown action type: ${action.type}`);
      }
    } catch (error) {
      // eslint-disable-next-line
      console.error(`[UIRenderer] Error handling action ${action.id}:`, error);
    }
  }

  /**
   * 네비게이션 액션 처리
   */
  private handleNavigateAction(element: HTMLElement): void {
    const targetSceneId = element.getAttribute('data-target-scene');
    const sceneManager = this.getSceneManager();
    if (targetSceneId && sceneManager) {
      sceneManager.setActiveScene(targetSceneId);
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
  private handleCloseSceneAction(element: HTMLElement): void {
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
    const sceneManager = this.getSceneManager();
    if (sceneManager) {
      sceneManager.removeScene(sceneId);
    }
    this.removeScene(sceneId);
  }

  /**
   * 폼 제출 처리
   */
  private handleFormSubmit(form: HTMLFormElement, scene: Scene): void {
    const formData = new FormData(form);
    // eslint-disable-next-line
    const data: Record<string, any> = {};
    
    const formDataRecord = formDataToRecord(formData);
    Object.assign(data, formDataRecord);

    // 폼 데이터를 씬 상태에 저장
    const sceneManager = this.getSceneManager();
    if (sceneManager) {
      sceneManager.updateScene(scene.id, {
        state: { 
          ...scene.state, 
          formData: data,
          data: { ...scene.state.data }
        }
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
    const sceneManager = this.getSceneManager();
    if (sceneManager) {
      sceneManager.updateScene(scene.id, {
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
    for (const element of Array.from(this.renderedScenes.values())) {
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
