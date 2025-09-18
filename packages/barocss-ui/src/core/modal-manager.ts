/**
 * Modal Manager
 * 모달 오버레이 관리
 */

import { 
  Modal, 
  ModalConfig,
  SubSceneState
} from '../types';
import { generateId, getCurrentTimestamp } from '../utils/id-generator';

export interface ModalManagerOptions {
  maxModals: number;
  zIndexStart: number;
  backdropClose: boolean;
  keyboardClose: boolean;
  focusTrap: boolean;
}

export class ModalManager {
  private modals: Map<string, Modal> = new Map();
  private activeModalId: string | null = null;
  private zIndexCounter: number;
  private options: ModalManagerOptions;

  constructor(options: Partial<ModalManagerOptions> = {}) {
    this.options = {
      maxModals: 10,
      zIndexStart: 1000,
      backdropClose: true,
      keyboardClose: true,
      focusTrap: true,
      ...options
    };
    this.zIndexCounter = this.options.zIndexStart;

    // 키보드 이벤트 리스너
    this.setupKeyboardListeners();
  }

  /**
   * 모달 열기
   */
  openModal(config: ModalConfig): Modal {
    if (this.modals.size >= this.options.maxModals) {
      this.closeOldestModal();
    }

    const modal: Modal = {
      id: config.id || generateId('modal'),
      parentSceneId: (config as any).parentSceneId || '',
      type: 'modal',
      selector: config.selector || `[data-modal-id="${config.id}"]`,
      ui: {
        type: config.ui.type || 'html',
        content: typeof config.ui.content === 'string' ? config.ui.content : '',
        updateMode: 'replace'
      },
      state: this.initializeSubSceneState((config as any).initialState),
      formData: config.formData || {},
      linkedSubScenes: [],
      metadata: {
        createdAt: getCurrentTimestamp(),
        updatedAt: getCurrentTimestamp(),
        version: 1,
        autoUpdate: false,
        updateInterval: undefined
      },
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp(),
      version: 1,
      config: {
        backdrop: config.config?.backdrop === undefined ? true : !!config.config?.backdrop,
        closable: config.config?.closable === undefined ? true : !!config.config?.closable,
        keyboard: config.config?.keyboard === undefined ? true : !!config.config?.keyboard,
        focus: config.config?.focus === undefined ? true : !!config.config?.focus,
        size: config.config?.size || 'md',
        position: config.config?.position || 'center',
        animation: config.config?.animation || 'fade'
      },
      modalState: {
        isOpen: false,
        isAnimating: false,
        zIndex: this.getNextZIndex(),
        focusTrap: this.options.focusTrap
      }
    };

    this.modals.set(modal.id, modal);
    this.renderModal(modal);
    this.openModalInDOM(modal);

    return modal;
  }

  /**
   * 모달 닫기
   */
  closeModal(modalId: string): void {
    const modal = this.modals.get(modalId);
    if (!modal) return;

    this.closeModalInDOM(modal);
    this.modals.delete(modalId);

    if (this.activeModalId === modalId) {
      this.activeModalId = null;
    }
  }

  /**
   * 모달 조회
   */
  getModal(modalId: string): Modal | null {
    return this.modals.get(modalId) || null;
  }

  /**
   * 모든 모달 조회
   */
  getAllModals(): Modal[] {
    return Array.from(this.modals.values());
  }

  /**
   * 활성 모달 조회
   */
  getActiveModal(): Modal | null {
    return this.activeModalId ? this.modals.get(this.activeModalId) || null : null;
  }

  /**
   * 모달 업데이트
   */
  updateModal(modalId: string, updates: Partial<ModalConfig>): void {
    const modal = this.modals.get(modalId);
    if (!modal) return;

    const mergedConfig = {
      backdrop: updates.config?.backdrop === undefined ? modal.config.backdrop : !!updates.config?.backdrop,
      closable: updates.config?.closable === undefined ? modal.config.closable : !!updates.config?.closable,
      keyboard: updates.config?.keyboard === undefined ? modal.config.keyboard : !!updates.config?.keyboard,
      focus: updates.config?.focus === undefined ? modal.config.focus : !!updates.config?.focus,
      size: updates.config?.size || modal.config.size,
      position: updates.config?.position || modal.config.position,
      animation: updates.config?.animation || modal.config.animation
    };

    const updatedModal: Modal = {
      ...modal,
      selector: updates.selector || modal.selector,
      ui: {
        ...modal.ui,
        type: (updates.ui && updates.ui.type) || modal.ui.type,
        content: (updates.ui && typeof updates.ui.content === 'string' ? updates.ui.content : modal.ui.content),
        updateMode: (updates.ui && updates.ui.updateMode) || modal.ui.updateMode
      },
      formData: updates.formData || modal.formData,
      config: mergedConfig,
      metadata: {
        ...modal.metadata,
        updatedAt: getCurrentTimestamp(),
        version: modal.metadata.version + 1
      }
    };

    this.modals.set(modalId, updatedModal);
    this.updateModalInDOM(updatedModal);
  }

  /**
   * 모달 내용 업데이트
   */
  updateModalContent(modalId: string, content: any): void {
    const modal = this.modals.get(modalId);
    if (!modal) return;

    modal.ui.content = typeof content === 'string' ? content : '';
    modal.metadata.updatedAt = getCurrentTimestamp();
    modal.metadata.version += 1;

    this.updateModalInDOM(modal);
  }

  /**
   * 모든 모달 닫기
   */
  closeAllModals(): void {
    const modalIds = Array.from(this.modals.keys());
    modalIds.forEach(id => this.closeModal(id));
  }

  /**
   * 모달 렌더링
   */
  private renderModal(modal: Modal): void {
    const modalElement = this.createModalElement(modal);
    document.body.appendChild(modalElement);
  }

  /**
   * 모달 DOM 요소 생성
   */
  private createModalElement(modal: Modal): HTMLElement {
    const modalElement = document.createElement('div');
    modalElement.className = 'modal-overlay';
    modalElement.setAttribute('data-modal-id', modal.id);
    modalElement.style.zIndex = modal.modalState.zIndex.toString();

    // 백드롭
    if (modal.config.backdrop) {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      backdrop.addEventListener('click', () => {
        if (modal.config.backdrop) {
          this.closeModal(modal.id);
        }
      });
      modalElement.appendChild(backdrop);
    }

    // 모달 컨테이너
    const container = document.createElement('div');
    container.className = `modal-container modal-${modal.config.size} modal-${modal.config.position}`;
    
    // 닫기 버튼
    if (modal.config.closable) {
      const closeButton = document.createElement('button');
      closeButton.className = 'modal-close';
      closeButton.innerHTML = '×';
      closeButton.addEventListener('click', () => this.closeModal(modal.id));
      container.appendChild(closeButton);
    }

    // 모달 내용
    const content = document.createElement('div');
    content.className = 'modal-content';
    content.innerHTML = typeof modal.ui.content === 'string' ? modal.ui.content : '';
    container.appendChild(content);

    modalElement.appendChild(container);
    return modalElement;
  }

  /**
   * 모달 열기 (DOM)
   */
  private openModalInDOM(modal: Modal): void {
    const modalElement = document.querySelector(`[data-modal-id="${modal.id}"]`) as HTMLElement;
    if (!modalElement) return;

    modal.modalState.isOpen = true;
    modal.modalState.isAnimating = true;

    // 애니메이션 적용
    this.applyOpenAnimation(modalElement, modal.config.animation);

    // 포커스 트랩 설정
    if (modal.modalState.focusTrap) {
      this.setupFocusTrap(modalElement);
    }

    this.activeModalId = modal.id;

    // 애니메이션 완료 후 상태 업데이트
    setTimeout(() => {
      modal.modalState.isAnimating = false;
    }, 300);
  }

  /**
   * 모달 닫기 (DOM)
   */
  private closeModalInDOM(modal: Modal): void {
    const modalElement = document.querySelector(`[data-modal-id="${modal.id}"]`) as HTMLElement;
    if (!modalElement) return;

    modal.modalState.isOpen = false;
    modal.modalState.isAnimating = true;

    // 애니메이션 적용
    this.applyCloseAnimation(modalElement, modal.config.animation, () => {
      modalElement.remove();
    });

    // 포커스 트랩 해제
    this.removeFocusTrap();
  }

  /**
   * 모달 업데이트 (DOM)
   */
  private updateModalInDOM(modal: Modal): void {
    const modalElement = document.querySelector(`[data-modal-id="${modal.id}"]`) as HTMLElement;
    if (!modalElement) return;

    const content = modalElement.querySelector('.modal-content');
    if (content) {
      content.innerHTML = modal.ui.content as string;
    }
  }

  /**
   * 열기 애니메이션 적용
   */
  private applyOpenAnimation(element: HTMLElement, animation: string): void {
    element.style.display = 'block';
    element.style.opacity = '0';

    switch (animation) {
      case 'fade':
        element.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
          element.style.opacity = '1';
        }, 10);
        break;
      case 'slide':
        element.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        element.style.transform = 'translateY(-50px)';
        setTimeout(() => {
          element.style.transform = 'translateY(0)';
          element.style.opacity = '1';
        }, 10);
        break;
      case 'zoom':
        element.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        element.style.transform = 'scale(0.8)';
        setTimeout(() => {
          element.style.transform = 'scale(1)';
          element.style.opacity = '1';
        }, 10);
        break;
      default:
        element.style.opacity = '1';
    }
  }

  /**
   * 닫기 애니메이션 적용
   */
  private applyCloseAnimation(element: HTMLElement, animation: string, callback: () => void): void {
    switch (animation) {
      case 'fade':
        element.style.transition = 'opacity 0.3s ease';
        element.style.opacity = '0';
        setTimeout(callback, 300);
        break;
      case 'slide':
        element.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        element.style.transform = 'translateY(-50px)';
        element.style.opacity = '0';
        setTimeout(callback, 300);
        break;
      case 'zoom':
        element.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        element.style.transform = 'scale(0.8)';
        element.style.opacity = '0';
        setTimeout(callback, 300);
        break;
      default:
        callback();
    }
  }

  /**
   * 포커스 트랩 설정
   */
  private setupFocusTrap(element: HTMLElement): void {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    element.addEventListener('keydown', handleTabKey);
    firstElement.focus();
  }

  /**
   * 포커스 트랩 해제
   */
  private removeFocusTrap(): void {
    // 이벤트 리스너는 요소가 제거될 때 자동으로 해제됨
  }

  /**
   * 키보드 이벤트 리스너 설정
   */
  private setupKeyboardListeners(): void {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.options.keyboardClose && this.activeModalId) {
        this.closeModal(this.activeModalId);
      }
    });
  }

  /**
   * 다음 z-index 가져오기
   */
  private getNextZIndex(): number {
    return ++this.zIndexCounter;
  }

  /**
   * 가장 오래된 모달 닫기
   */
  private closeOldestModal(): void {
    const modals = Array.from(this.modals.values())
      .sort((a, b) => a.metadata.createdAt - b.metadata.createdAt);
    
    if (modals.length > 0) {
      this.closeModal(modals[0].id);
    }
  }

  /**
   * 모달 상태 초기화
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
    this.closeAllModals();
    this.modals.clear();
    this.activeModalId = null;
  }
}

// 팩토리 함수
export function createModalManager(options?: Partial<ModalManagerOptions>): ModalManager {
  return new ModalManager(options);
}
