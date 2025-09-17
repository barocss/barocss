/**
 * Virtual DOM
 * 성능 최적화를 위한 가상 DOM 구현
 */

export interface VirtualNode {
  type: string;
  props: Record<string, any>;
  children: (VirtualNode | string)[];
  key?: string;
  ref?: HTMLElement;
}

export interface Patch {
  type: 'INSERT' | 'UPDATE' | 'REMOVE' | 'REORDER' | 'REPLACE';
  target: string | HTMLElement;
  content?: VirtualNode | string;
  patches?: Patch[];
  oldIndex?: number;
  newIndex?: number;
}

export interface VirtualDOMOptions {
  enableKeyedDiffing: boolean;
  enableBatchUpdates: boolean;
  batchUpdateDelay: number;
  enableMemoryOptimization: boolean;
}

export class VirtualDOM {
  private virtualNodes: Map<string, VirtualNode> = new Map();
  private realNodes: Map<string, HTMLElement> = new Map();
  private updateQueue: Patch[] = [];
  private isProcessingUpdates = false;
  private options: VirtualDOMOptions;

  constructor(options: Partial<VirtualDOMOptions> = {}) {
    this.options = {
      enableKeyedDiffing: true,
      enableBatchUpdates: true,
      batchUpdateDelay: 16, // 60fps
      enableMemoryOptimization: true,
      ...options
    };
  }

  // ============================================================================
  // Virtual Node 생성 및 관리
  // ============================================================================

  /**
   * HTML을 Virtual Node로 변환
   */
  parseHTML(html: string): VirtualNode {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const element = doc.body.firstElementChild;
    
    if (!element) {
      throw new Error('Invalid HTML: No root element found');
    }

    return this.domToVirtualNode(element);
  }

  /**
   * DOM 요소를 Virtual Node로 변환
   */
  domToVirtualNode(element: Element): VirtualNode {
    const props: Record<string, any> = {};
    const children: (VirtualNode | string)[] = [];

    // 속성 추출
    Array.from(element.attributes).forEach(attr => {
      props[attr.name] = attr.value;
    });

    // 자식 요소 처리
    Array.from(element.childNodes).forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        children.push(this.domToVirtualNode(child as Element));
      } else if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent?.trim();
        if (text) {
          children.push(text);
        }
      }
    });

    return {
      type: element.tagName.toLowerCase(),
      props,
      children
    };
  }

  /**
   * Virtual Node를 DOM 요소로 변환
   */
  virtualNodeToDOM(virtualNode: VirtualNode): HTMLElement {
    const element = document.createElement(virtualNode.type);

    // 속성 설정
    Object.entries(virtualNode.props).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else if (key.startsWith('on')) {
        // 이벤트 리스너는 별도 처리
        element.addEventListener(key.slice(2).toLowerCase(), value);
      } else {
        element.setAttribute(key, value);
      }
    });

    // 자식 요소 처리
    virtualNode.children.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else {
        element.appendChild(this.virtualNodeToDOM(child));
      }
    });

    return element;
  }

  // ============================================================================
  // Diff 알고리즘
  // ============================================================================

  /**
   * 두 Virtual Node 비교
   */
  diff(oldNode: VirtualNode, newNode: VirtualNode): Patch[] {
    const patches: Patch[] = [];
    this.diffNodes(oldNode, newNode, patches, '');
    return patches;
  }

  /**
   * 노드 비교 (재귀)
   */
  private diffNodes(
    oldNode: VirtualNode, 
    newNode: VirtualNode, 
    patches: Patch[], 
    path: string
  ): void {
    // 타입이 다르면 교체
    if (oldNode.type !== newNode.type) {
      patches.push({
        type: 'REPLACE',
        target: path,
        content: newNode
      });
      return;
    }

    // 속성 비교
    const propPatches = this.diffProps(oldNode.props, newNode.props);
    if (propPatches.length > 0) {
      patches.push({
        type: 'UPDATE',
        target: path,
        patches: propPatches
      });
    }

    // 자식 요소 비교
    this.diffChildren(oldNode.children, newNode.children, patches, path);
  }

  /**
   * 속성 비교
   */
  private diffProps(oldProps: Record<string, any>, newProps: Record<string, any>): Patch[] {
    const patches: Patch[] = [];
    const allKeys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);

    allKeys.forEach(key => {
      const oldValue = oldProps[key];
      const newValue = newProps[key];

      if (oldValue !== newValue) {
        patches.push({
          type: 'UPDATE',
          target: key,
          content: newValue
        });
      }
    });

    return patches;
  }

  /**
   * 자식 요소 비교
   */
  private diffChildren(
    oldChildren: (VirtualNode | string)[], 
    newChildren: (VirtualNode | string)[], 
    patches: Patch[], 
    path: string
  ): void {
    if (this.options.enableKeyedDiffing) {
      this.diffChildrenWithKeys(oldChildren, newChildren, patches, path);
    } else {
      this.diffChildrenSimple(oldChildren, newChildren, patches, path);
    }
  }

  /**
   * 키 기반 자식 요소 비교
   */
  private diffChildrenWithKeys(
    oldChildren: (VirtualNode | string)[], 
    newChildren: (VirtualNode | string)[], 
    patches: Patch[], 
    path: string
  ): void {
    const oldKeyMap = new Map<string, number>();
    const newKeyMap = new Map<string, number>();

    // 키 매핑 생성
    oldChildren.forEach((child, index) => {
      if (typeof child === 'object' && child.key) {
        oldKeyMap.set(child.key, index);
      }
    });

    newChildren.forEach((child, index) => {
      if (typeof child === 'object' && child.key) {
        newKeyMap.set(child.key, index);
      }
    });

    // 키가 있는 요소들 처리
    newKeyMap.forEach((newIndex, key) => {
      const oldIndex = oldKeyMap.get(key);
      if (oldIndex !== undefined) {
        // 기존 요소 업데이트
        const oldChild = oldChildren[oldIndex];
        const newChild = newChildren[newIndex];
        if (typeof oldChild === 'object' && typeof newChild === 'object') {
          this.diffNodes(oldChild, newChild, patches, `${path}.${newIndex}`);
        }
      } else {
        // 새 요소 추가
        patches.push({
          type: 'INSERT',
          target: `${path}.${newIndex}`,
          content: newChildren[newIndex]
        });
      }
    });

    // 제거된 요소들 처리
    oldKeyMap.forEach((oldIndex, key) => {
      if (!newKeyMap.has(key)) {
        patches.push({
          type: 'REMOVE',
          target: `${path}.${oldIndex}`
        });
      }
    });
  }

  /**
   * 단순 자식 요소 비교
   */
  private diffChildrenSimple(
    oldChildren: (VirtualNode | string)[], 
    newChildren: (VirtualNode | string)[], 
    patches: Patch[], 
    path: string
  ): void {
    const maxLength = Math.max(oldChildren.length, newChildren.length);

    for (let i = 0; i < maxLength; i++) {
      const oldChild = oldChildren[i];
      const newChild = newChildren[i];

      if (!oldChild) {
        // 새 요소 추가
        patches.push({
          type: 'INSERT',
          target: `${path}.${i}`,
          content: newChild
        });
      } else if (!newChild) {
        // 요소 제거
        patches.push({
          type: 'REMOVE',
          target: `${path}.${i}`
        });
      } else if (typeof oldChild === 'string' && typeof newChild === 'string') {
        // 텍스트 노드 비교
        if (oldChild !== newChild) {
          patches.push({
            type: 'UPDATE',
            target: `${path}.${i}`,
            content: newChild
          });
        }
      } else if (typeof oldChild === 'object' && typeof newChild === 'object') {
        // Virtual Node 비교
        this.diffNodes(oldChild, newChild, patches, `${path}.${i}`);
      }
    }
  }

  // ============================================================================
  // Patch 적용
  // ============================================================================

  /**
   * 패치 적용
   */
  applyPatches(patches: Patch[]): void {
    if (this.options.enableBatchUpdates) {
      this.updateQueue.push(...patches);
      if (!this.isProcessingUpdates) {
        this.processBatchUpdates();
      }
    } else {
      patches.forEach(patch => this.applyPatch(patch));
    }
  }

  /**
   * 배치 업데이트 처리
   */
  private async processBatchUpdates(): Promise<void> {
    if (this.isProcessingUpdates) return;
    this.isProcessingUpdates = true;

    while (this.updateQueue.length > 0) {
      const patch = this.updateQueue.shift();
      if (patch) {
        await this.applyPatch(patch);
      }
    }

    this.isProcessingUpdates = false;
  }

  /**
   * 단일 패치 적용
   */
  private async applyPatch(patch: Patch): Promise<void> {
    try {
      switch (patch.type) {
        case 'INSERT':
          await this.applyInsertPatch(patch);
          break;
        case 'REPLACE':
          await this.applyReplacePatch(patch);
          break;
        case 'UPDATE':
          await this.applyUpdatePatch(patch);
          break;
        case 'REMOVE':
          await this.applyRemovePatch(patch);
          break;
        case 'REORDER':
          await this.applyReorderPatch(patch);
          break;
      }
    } catch (error) {
      // eslint-disable-next-line
      console.error('[VirtualDOM] Failed to apply patch:', error);
    }
  }

  /**
   * REPLACE 패치 적용
   */
  private async applyReplacePatch(patch: Patch): Promise<void> {
    const targetElement = this.findElementByPath(patch.target as string);
    if (!targetElement || !targetElement.parentNode) return;

    let newNode: Node | null = null;
    if (typeof patch.content === 'string') {
      const container = document.createElement('div');
      container.innerHTML = patch.content;
      newNode = container.firstChild;
    } else if (patch.content) {
      newNode = this.virtualNodeToDOM(patch.content);
    }

    if (newNode) {
      targetElement.parentNode.replaceChild(newNode, targetElement);
    }
  }

  /**
   * INSERT 패치 적용
   */
  private async applyInsertPatch(patch: Patch): Promise<void> {
    const targetElement = this.findElementByPath(patch.target as string);
    if (!targetElement) return;

    let content: string | HTMLElement;
    if (typeof patch.content === 'string') {
      content = patch.content;
    } else if (patch.content) {
      content = this.virtualNodeToDOM(patch.content);
    } else {
      return;
    }

    if (typeof content === 'string') {
      targetElement.insertAdjacentHTML('beforeend', content);
    } else {
      targetElement.appendChild(content);
    }
  }

  /**
   * UPDATE 패치 적용
   */
  private async applyUpdatePatch(patch: Patch): Promise<void> {
    if (patch.patches) {
      // 하위 패치들 처리
      patch.patches.forEach(subPatch => {
        this.applyPatch(subPatch);
      });
    } else {
      // 속성 업데이트
      const targetElement = this.findElementByPath(patch.target as string);
      if (!targetElement) return;

      if (patch.target === 'className') {
        targetElement.className = patch.content as string;
      } else if (patch.target === 'style') {
        Object.assign(targetElement.style, patch.content);
      } else {
        targetElement.setAttribute(patch.target as string, patch.content as string);
      }
    }
  }

  /**
   * REMOVE 패치 적용
   */
  private async applyRemovePatch(patch: Patch): Promise<void> {
    const targetElement = this.findElementByPath(patch.target as string);
    if (targetElement && targetElement.parentNode) {
      targetElement.parentNode.removeChild(targetElement);
    }
  }

  /**
   * REORDER 패치 적용
   */
  private async applyReorderPatch(patch: Patch): Promise<void> {
    const targetElement = this.findElementByPath(patch.target as string);
    if (!targetElement || !targetElement.parentNode) return;

    const parent = targetElement.parentNode;
    const newIndex = patch.newIndex || 0;
    const oldIndex = patch.oldIndex || 0;

    if (newIndex !== oldIndex) {
      const children = Array.from(parent.children);
      const element = children[oldIndex];
      if (element) {
        parent.insertBefore(element, children[newIndex] || null);
      }
    }
  }

  // ============================================================================
  // 유틸리티 메서드
  // ============================================================================

  /**
   * 경로로 요소 찾기
   */
  private findElementByPath(path: string): HTMLElement | null {
    // 간단한 구현 - 실제로는 더 정교한 경로 해석 필요
    const parts = path.split('.');
    let element = document.body;

    for (const part of parts) {
      if (part === '') continue;
      
      const index = parseInt(part);
      if (!isNaN(index)) {
        element = element.children[index] as HTMLElement;
      } else {
        element = element.querySelector(part) as HTMLElement;
      }

      if (!element) return null;
    }

    return element;
  }

  /**
   * Virtual Node 저장
   */
  setVirtualNode(id: string, virtualNode: VirtualNode): void {
    this.virtualNodes.set(id, virtualNode);
  }

  /**
   * Virtual Node 조회
   */
  getVirtualNode(id: string): VirtualNode | null {
    return this.virtualNodes.get(id) || null;
  }

  /**
   * Virtual Node 제거
   */
  removeVirtualNode(id: string): void {
    this.virtualNodes.delete(id);
    this.realNodes.delete(id);
  }

  /**
   * 메모리 최적화
   */
  optimizeMemory(): void {
    if (!this.options.enableMemoryOptimization) return;

    // 사용하지 않는 Virtual Node 정리
    const usedIds = new Set<string>();
    this.virtualNodes.forEach((node, id) => {
      if (this.isNodeInUse(node)) {
        usedIds.add(id);
      }
    });

    // 사용하지 않는 노드 제거
    this.virtualNodes.forEach((_, id) => {
      if (!usedIds.has(id)) {
        this.removeVirtualNode(id);
      }
    });
  }

  /**
   * 노드 사용 여부 확인
   */
  private isNodeInUse(node: VirtualNode): boolean {
    // 간단한 구현 - 실제로는 더 정교한 사용 여부 확인 필요
    return this.realNodes.has(node.key || '');
  }

  /**
   * 정리
   */
  cleanup(): void {
    this.virtualNodes.clear();
    this.realNodes.clear();
    this.updateQueue = [];
    this.isProcessingUpdates = false;
  }
}

// 팩토리 함수
export function createVirtualDOM(options?: Partial<VirtualDOMOptions>): VirtualDOM {
  return new VirtualDOM(options);
}

