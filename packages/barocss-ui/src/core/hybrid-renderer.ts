/**
 * Hybrid Renderer
 * 다중 렌더링 방식 지원 (HTML, Virtual DOM, Component)
 */

import { 
  Scene, 
  UIContent, 
  ComponentDefinition,
  RenderingMode
} from '../types';
import { VirtualDOM } from './virtual-dom';
import { AnimationEngine } from './animation-engine';
import { SubSceneManager } from './subscene-manager';
import { ModalManager } from './modal-manager';

export interface HybridRendererOptions {
  defaultMode: RenderingMode;
  enableVirtualDOM: boolean;
  enableAnimation: boolean;
  enableSubScenes: boolean;
  enableModals: boolean;
  performanceThreshold: number;
  autoModeSwitch: boolean;
}

export class HybridRenderer {
  private virtualDOM: VirtualDOM;
  private animationEngine: AnimationEngine;
  private subSceneManager: SubSceneManager;
  private modalManager: ModalManager;
  private options: HybridRendererOptions;
  private currentMode: RenderingMode;
  private performanceMetrics: {
    renderTime: number[];
    frameRate: number[];
    memoryUsage: number[];
  } = {
    renderTime: [],
    frameRate: [],
    memoryUsage: []
  };

  constructor(options: Partial<HybridRendererOptions> = {}) {
    this.options = {
      defaultMode: 'html',
      enableVirtualDOM: true,
      enableAnimation: true,
      enableSubScenes: true,
      enableModals: true,
      performanceThreshold: 16, // 16ms = 60fps
      autoModeSwitch: true,
      ...options
    };

    this.currentMode = this.options.defaultMode;

    // 서브 시스템 초기화
    this.virtualDOM = new VirtualDOM();
    this.animationEngine = new AnimationEngine();
    this.subSceneManager = new SubSceneManager();
    this.modalManager = new ModalManager();
  }

  // ============================================================================
  // 메인 렌더링 메서드
  // ============================================================================

  /**
   * Scene 렌더링
   */
  async renderScene(scene: Scene, container: HTMLElement): Promise<void> {
    const startTime = performance.now();

    try {
      // 렌더링 모드 결정
      const mode = this.determineRenderingMode(scene);

      // 렌더링 실행
      switch (mode) {
        case 'html':
          await this.renderHTMLScene(scene, container);
          break;
        case 'virtual-dom':
          await this.renderVirtualDOMScene(scene, container);
          break;
        case 'component':
          await this.renderComponentScene(scene, container);
          break;
        case 'hybrid':
          await this.renderHybridScene(scene, container);
          break;
      }

      // 성능 메트릭 기록
      this.recordPerformanceMetrics(performance.now() - startTime);

      // 자동 모드 전환
      if (this.options.autoModeSwitch) {
        this.considerModeSwitch();
      }

    } catch (error) {
      // eslint-disable-next-line
      console.error('[HybridRenderer] Failed to render scene:', error);
      throw error;
    }
  }

  /**
   * Scene 업데이트
   */
  async updateScene(scene: Scene, container: HTMLElement): Promise<void> {
    const startTime = performance.now();

    try {
      const mode = this.determineRenderingMode(scene);
      
      switch (mode) {
        case 'html':
          await this.updateHTMLScene(scene, container);
          break;
        case 'virtual-dom':
          await this.updateVirtualDOMScene(scene, container);
          break;
        case 'component':
          await this.updateComponentScene(scene, container);
          break;
        case 'hybrid':
          await this.updateHybridScene(scene, container);
          break;
      }

      this.recordPerformanceMetrics(performance.now() - startTime);

    } catch (error) {
      // eslint-disable-next-line
      console.error('[HybridRenderer] Failed to update scene:', error);
      throw error;
    }
  }

  /**
   * SubScene 렌더링
   */
  async renderSubScene(subSceneId: string, container: HTMLElement): Promise<void> {
    if (!this.options.enableSubScenes) return;

    const subScene = this.subSceneManager.getSubScene(subSceneId);
    if (!subScene) return;

    const targetElement = container.querySelector(subScene.selector);
    if (!targetElement) return;

    await this.renderSubSceneContent(subScene, targetElement as HTMLElement);
  }

  /**
   * Modal 렌더링
   */
  async renderModal(modalId: string): Promise<void> {
    if (!this.options.enableModals) return;

    const modal = this.modalManager.getModal(modalId);
    if (!modal) return;

    await this.renderModalContent(modal);
  }

  // ============================================================================
  // 렌더링 모드별 구현
  // ============================================================================

  /**
   * HTML 모드 렌더링
   */
  private async renderHTMLScene(scene: Scene, container: HTMLElement): Promise<void> {
    if (!scene.ui || !scene.ui.content) return;

    const content = typeof scene.ui.content === 'string' ? scene.ui.content : '';
    container.innerHTML = content;

    // 액션 핸들러 연결
    this.attachActionHandlers(container, scene);
  }

  /**
   * Virtual DOM 모드 렌더링
   */
  private async renderVirtualDOMScene(scene: Scene, container: HTMLElement): Promise<void> {
    if (!scene.ui || !scene.ui.content) return;

    const content = typeof scene.ui.content === 'string' ? scene.ui.content : '';
    const newVirtualNode = this.virtualDOM.parseHTML(content);
    const oldVirtualNode = this.virtualDOM.getVirtualNode(scene.id);

    if (oldVirtualNode) {
      // 차이점 계산 및 적용
      const patches = this.virtualDOM.diff(oldVirtualNode, newVirtualNode);
      this.virtualDOM.applyPatches(patches);
    } else {
      // 처음 렌더링
      const domElement = this.virtualDOM.virtualNodeToDOM(newVirtualNode);
      container.appendChild(domElement);
    }

    this.virtualDOM.setVirtualNode(scene.id, newVirtualNode);
    this.attachActionHandlers(container, scene);
  }

  /**
   * Component 모드 렌더링
   */
  private async renderComponentScene(scene: Scene, container: HTMLElement): Promise<void> {
    if (!scene.ui || !scene.ui.components) return;

    const components = scene.ui.components;
    
    for (const component of components) {
      const element = await this.renderComponent(component, container);
      if (element) {
        container.appendChild(element);
      }
    }

    this.attachActionHandlers(container, scene);
  }

  /**
   * Hybrid 모드 렌더링
   */
  private async renderHybridScene(scene: Scene, container: HTMLElement): Promise<void> {
    if (!scene.ui) return;

    // HTML 콘텐츠가 있으면 먼저 렌더링
    if (scene.ui.content) {
      await this.renderHTMLScene(scene, container);
    }

    // 컴포넌트가 있으면 추가 렌더링
    if (scene.ui.components) {
      const components = scene.ui.components;
      for (const component of components) {
        const element = await this.renderComponent(component, container);
        if (element) {
          container.appendChild(element);
        }
      }
    }

    // SubScene이 있으면 렌더링
    if (this.options.enableSubScenes) {
      const subScenes = this.subSceneManager.getSubScenesByParent(scene.id);
      for (const subScene of subScenes) {
        await this.renderSubScene(subScene.id, container);
      }
    }

    this.attachActionHandlers(container, scene);
  }

  // ============================================================================
  // 업데이트 메서드들
  // ============================================================================

  /**
   * HTML Scene 업데이트
   */
  private async updateHTMLScene(scene: Scene, container: HTMLElement): Promise<void> {
    if (!scene.ui || !scene.ui.content) return;

    const content = scene.ui.content as string;
    
    // 애니메이션 적용
    if (this.options.enableAnimation) {
      await this.animationEngine.fadeOut(container);
      container.innerHTML = content;
      await this.animationEngine.fadeIn(container);
    } else {
      container.innerHTML = content;
    }

    this.attachActionHandlers(container, scene);
  }

  /**
   * Virtual DOM Scene 업데이트
   */
  private async updateVirtualDOMScene(scene: Scene, container: HTMLElement): Promise<void> {
    if (!scene.ui || !scene.ui.content) return;

    const content = scene.ui.content as string;
    const newVirtualNode = this.virtualDOM.parseHTML(content);
    const oldVirtualNode = this.virtualDOM.getVirtualNode(scene.id);

    if (oldVirtualNode) {
      const patches = this.virtualDOM.diff(oldVirtualNode, newVirtualNode);
      this.virtualDOM.applyPatches(patches);
    } else {
      const domElement = this.virtualDOM.virtualNodeToDOM(newVirtualNode);
      container.appendChild(domElement);
    }

    this.virtualDOM.setVirtualNode(scene.id, newVirtualNode);
    this.attachActionHandlers(container, scene);
  }

  /**
   * Component Scene 업데이트
   */
  private async updateComponentScene(scene: Scene, container: HTMLElement): Promise<void> {
    // 기존 컴포넌트 제거
    container.innerHTML = '';

    // 새 컴포넌트 렌더링
    await this.renderComponentScene(scene, container);
  }

  /**
   * Hybrid Scene 업데이트
   */
  private async updateHybridScene(scene: Scene, container: HTMLElement): Promise<void> {
    // 각 부분별로 업데이트
    if (scene.ui && scene.ui.content) {
      await this.updateHTMLScene(scene, container);
    }

    if (scene.ui && scene.ui.components) {
      await this.updateComponentScene(scene, container);
    }

    // SubScene 업데이트
    if (this.options.enableSubScenes) {
      const subScenes = this.subSceneManager.getSubScenesByParent(scene.id);
      for (const subScene of subScenes) {
        await this.renderSubScene(subScene.id, container);
      }
    }
  }

  // ============================================================================
  // 서브 렌더링 메서드들
  // ============================================================================

  /**
   * SubScene 콘텐츠 렌더링
   */
  private async renderSubSceneContent(subScene: any, targetElement: HTMLElement): Promise<void> {
    if (!subScene.ui || !subScene.ui.content) return;

    const content = subScene.ui.content as string;
    
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
        // 더 정교한 병합 로직 필요
        targetElement.innerHTML = content;
        break;
    }
  }

  /**
   * Modal 콘텐츠 렌더링
   */
  private async renderModalContent(modal: any): Promise<void> {
    if (!modal.ui || !modal.ui.content) return;

    const content = modal.ui.content as string;
    const modalElement = document.querySelector(`[data-modal-id="${modal.id}"]`);
    
    if (modalElement) {
      const contentElement = modalElement.querySelector('.modal-content');
      if (contentElement) {
        contentElement.innerHTML = content;
      }
    }
  }

  /**
   * 컴포넌트 렌더링
   */
  private async renderComponent(component: ComponentDefinition, container: HTMLElement): Promise<HTMLElement | null> {
    try {
      const element = document.createElement(component.type);
      
      // 속성 설정
      if (component.props) {
        Object.entries(component.props).forEach(([key, value]) => {
          if (key === 'className') {
            element.className = value as string;
          } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
          } else {
            element.setAttribute(key, value as string);
          }
        });
      }

      // 자식 요소 렌더링
      if (component.children) {
        for (const child of component.children) {
          if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
          } else if (typeof child === 'object') {
            const childElement = await this.renderComponent(child, container);
            if (childElement) {
              element.appendChild(childElement);
            }
          }
        }
      }

      return element;

    } catch (error) {
      // eslint-disable-next-line
      console.error('[HybridRenderer] Failed to render component:', error);
      return null;
    }
  }

  // ============================================================================
  // 렌더링 모드 결정
  // ============================================================================

  /**
   * 렌더링 모드 결정
   */
  private determineRenderingMode(scene: Scene): RenderingMode {
    // 명시적으로 설정된 모드가 있으면 사용
    if (scene.ui?.renderingMode) {
      return scene.ui.renderingMode;
    }

    // 성능 기반 모드 전환
    if (this.options.autoModeSwitch) {
      const avgRenderTime = this.getAverageRenderTime();
      if (avgRenderTime > this.options.performanceThreshold) {
        return 'virtual-dom'; // 성능이 떨어지면 Virtual DOM 사용
      }
    }

    // 콘텐츠 타입 기반 결정
    if (scene.ui?.components && scene.ui.components.length > 0) {
      return 'component';
    }

    if (scene.ui?.content && scene.ui?.components) {
      return 'hybrid';
    }

    return this.currentMode;
  }

  /**
   * 평균 렌더링 시간 계산
   */
  private getAverageRenderTime(): number {
    if (this.performanceMetrics.renderTime.length === 0) return 0;
    
    const sum = this.performanceMetrics.renderTime.reduce((a, b) => a + b, 0);
    return sum / this.performanceMetrics.renderTime.length;
  }

  /**
   * 모드 전환 고려
   */
  private considerModeSwitch(): void {
    const avgRenderTime = this.getAverageRenderTime();
    
    if (avgRenderTime > this.options.performanceThreshold * 2) {
      // 성능이 매우 나쁘면 Virtual DOM으로 전환
      this.currentMode = 'virtual-dom';
    } else if (avgRenderTime < this.options.performanceThreshold / 2) {
      // 성능이 좋으면 HTML 모드로 전환
      this.currentMode = 'html';
    }
  }

  // ============================================================================
  // 성능 모니터링
  // ============================================================================

  /**
   * 성능 메트릭 기록
   */
  private recordPerformanceMetrics(renderTime: number): void {
    this.performanceMetrics.renderTime.push(renderTime);
    
    // 최근 100개만 유지
    if (this.performanceMetrics.renderTime.length > 100) {
      this.performanceMetrics.renderTime = this.performanceMetrics.renderTime.slice(-100);
    }

    // 프레임 레이트 계산
    const frameRate = 1000 / renderTime;
    this.performanceMetrics.frameRate.push(frameRate);
    
    if (this.performanceMetrics.frameRate.length > 100) {
      this.performanceMetrics.frameRate = this.performanceMetrics.frameRate.slice(-100);
    }

    // 메모리 사용량 기록
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.performanceMetrics.memoryUsage.push(memory.usedJSHeapSize);
      
      if (this.performanceMetrics.memoryUsage.length > 100) {
        this.performanceMetrics.memoryUsage = this.performanceMetrics.memoryUsage.slice(-100);
      }
    }
  }

  /**
   * 성능 통계 조회
   */
  getPerformanceStats(): {
    averageRenderTime: number;
    averageFrameRate: number;
    averageMemoryUsage: number;
    currentMode: RenderingMode;
  } {
    return {
      averageRenderTime: this.getAverageRenderTime(),
      averageFrameRate: this.performanceMetrics.frameRate.length > 0 
        ? this.performanceMetrics.frameRate.reduce((a, b) => a + b, 0) / this.performanceMetrics.frameRate.length 
        : 0,
      averageMemoryUsage: this.performanceMetrics.memoryUsage.length > 0 
        ? this.performanceMetrics.memoryUsage.reduce((a, b) => a + b, 0) / this.performanceMetrics.memoryUsage.length 
        : 0,
      currentMode: this.currentMode
    };
  }

  // ============================================================================
  // 유틸리티 메서드
  // ============================================================================

  /**
   * 액션 핸들러 연결
   */
  private attachActionHandlers(container: HTMLElement, scene: Scene): void {
    if (!scene.ui?.actions) return;

    Object.entries(scene.ui.actions).forEach(([actionId, actionType]) => {
      const element = container.querySelector(`[data-action-id="${actionId}"]`);
      if (element) {
        element.addEventListener('click', () => {
          // 액션 처리 로직
          this.handleAction(actionId, actionType, scene);
        });
      }
    });
  }

  /**
   * 액션 처리
   */
  private handleAction(actionId: string, actionType: string, scene: Scene): void {
    // 액션 처리 로직 구현
    // eslint-disable-next-line
    console.log(`Action ${actionId} of type ${actionType} triggered in scene ${scene.id}`);
  }

  /**
   * 렌더링 모드 설정
   */
  setRenderingMode(mode: RenderingMode): void {
    this.currentMode = mode;
  }

  /**
   * 정리
   */
  cleanup(): void {
    this.virtualDOM.cleanup();
    this.animationEngine.cleanup();
    this.subSceneManager.cleanup();
    this.modalManager.cleanup();
    
    this.performanceMetrics = {
      renderTime: [],
      frameRate: [],
      memoryUsage: []
    };
  }
}

// 팩토리 함수
export function createHybridRenderer(options?: Partial<HybridRendererOptions>): HybridRenderer {
  return new HybridRenderer(options);
}
