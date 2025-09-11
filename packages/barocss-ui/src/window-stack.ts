import { Position, WindowConfig, WindowInstance, RuntimeStats, DisplayType, LayoutPolicy } from './types';

export class WindowStackManager {
  private windows = new Map<string, WindowInstance>();
  private focusStack: string[] = [];
  private baseZ = 1000;
  private layoutPolicy: LayoutPolicy;
  private cascadeCounter = 0;
  private customPositioningStrategies: Map<string, (element: HTMLElement, options: any) => void> = new Map();

  constructor(layoutPolicy?: LayoutPolicy) {
    this.layoutPolicy = layoutPolicy || {
      positioningStrategy: 'center',
      cascadeOffset: 30,
      zIndexBase: 1000,
      zIndexLayers: {
        base: 0,
        layout: 100,
        content: 200,
        floating: 300,
        modal: 400,
        overlay: 500
      }
    };
  }

  createWindow(element: HTMLElement, config: WindowConfig, position?: string, parentId?: string | null): WindowInstance {
    const id = element.id || `window-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    
    // Apply positioning strategy (check for custom data attributes first)
    this.applyPositioning(element, position || this.layoutPolicy.positioningStrategy, parentId);
    
    const instance: WindowInstance = {
      id,
      element,
      state: 'created',
      parent: undefined,
      children: [],
      zIndex: this.calculateZIndex(config.type),
      createdAt: now,
      lastActiveAt: now,
      type: config.type
    };

    // Apply z-index (check for custom data attributes first)
    this.applyZIndex(element, instance.zIndex);
    
    // Insert element into DOM
    document.body.appendChild(element);
    
    this.windows.set(id, instance);
    this.focusWindow(id);
    
    // Dispatch lifecycle event
    this.dispatchLifecycleEvent('window:created', { windowId: instance.id });

    return instance;
  }

  focusWindow(windowId: string): void {
    const inst = this.windows.get(windowId);
    if (!inst) return;

    const prevFocused = this.getFocusedWindow();
    if (prevFocused) {
      prevFocused.state = 'blurred';
    }

    inst.state = 'focused';
    inst.lastActiveAt = Date.now();

    this.focusStack = this.focusStack.filter(id => id !== windowId);
    this.focusStack.push(windowId);

    inst.zIndex = this.baseZ + this.focusStack.length;
    inst.element.style.zIndex = String(inst.zIndex);
  }

  minimizeWindow(windowId: string): void {
    const inst = this.windows.get(windowId);
    if (!inst) return;
    inst.state = 'minimized';
  }

  maximizeWindow(windowId: string): void {
    const inst = this.windows.get(windowId);
    if (!inst) return;
    inst.state = 'maximized';
  }

  closeWindow(windowId: string): void {
    const inst = this.windows.get(windowId);
    if (!inst) return;
    
    // Remove element from DOM
    if (inst.element.parentElement) {
      inst.element.parentElement.removeChild(inst.element);
    }
    
    inst.state = 'closed';
    this.focusStack = this.focusStack.filter(id => id !== windowId);
    this.windows.delete(windowId);
    
    // Dispatch lifecycle event
    this.dispatchLifecycleEvent('window:closed', { windowId });
  }

  getActiveWindows(): WindowInstance[] {
    return Array.from(this.windows.values()).filter(w => w.state !== 'closed');
  }

  getWindowById(id: string): WindowInstance | null {
    return this.windows.get(id) ?? null;
    }

  getFocusedWindow(): WindowInstance | null {
    const id = this.focusStack[this.focusStack.length - 1];
    if (!id) return null;
    return this.windows.get(id) ?? null;
  }

  getStats(): RuntimeStats {
    const focused = this.getFocusedWindow();
    return {
      totalWindows: this.windows.size,
      focusedWindowId: focused?.id ?? null
    };
  }

  // Placeholder for layout computation
  findOptimalPosition(_position?: Position): Position {
    return { x: 0, y: 0 };
  }

  // Apply positioning - check for custom data attributes first
  private applyPositioning(element: HTMLElement, strategy: string, parentId?: string | null): void {
    // Check if custom positioning is defined via data attributes
    const customStrategy = element.getAttribute('data-positioning-strategy');
    if (customStrategy && this.customPositioningStrategies.has(customStrategy)) {
      const customHandler = this.customPositioningStrategies.get(customStrategy)!;
      customHandler(element, { parentId, strategy });
      return;
    }

    // Check if positioning is handled via CSS classes
    if (element.classList.contains('custom-positioned')) {
      // Positioning handled via CSS, just apply minimal fallback
      this.applyMinimalPositioning(element);
      return;
    }

    // Fallback to default strategies
    this.applyDefaultPositioning(element, strategy, parentId);
  }

  private applyDefaultPositioning(element: HTMLElement, strategy: string, parentId?: string | null): void {
    switch (strategy) {
      case 'center':
        this.centerElement(element);
        break;
      case 'cascade':
        this.cascadeElement(element);
        break;
      case 'beside-parent':
        this.positionBesideParent(element, parentId!);
        break;
      case 'overlay-parent':
        this.positionOverlayParent(element, parentId!);
        break;
      case 'smart':
        this.smartPosition(element);
        break;
    }
  }

  // Minimal positioning fallback when positioning is handled via CSS
  private applyMinimalPositioning(element: HTMLElement): void {
    if (!element.style.position) {
      element.style.position = 'fixed';
    }
  }

  // Apply z-index - check for custom data attributes first
  private applyZIndex(element: HTMLElement, fallbackZIndex: number): void {
    const customZIndex = element.getAttribute('data-z-index');
    if (customZIndex) {
      element.style.zIndex = customZIndex;
    } else if (!element.style.zIndex) {
      element.style.zIndex = String(fallbackZIndex);
    }
  }

  private centerElement(element: HTMLElement): void {
    element.style.position = 'fixed';
    element.style.top = '50%';
    element.style.left = '50%';
    element.style.transform = 'translate(-50%, -50%)';
  }

  private cascadeElement(element: HTMLElement): void {
    const offset = this.cascadeCounter * this.layoutPolicy.cascadeOffset;
    this.cascadeCounter++;
    
    element.style.position = 'fixed';
    element.style.top = `${100 + offset}px`;
    element.style.left = `${100 + offset}px`;
  }

  private positionBesideParent(element: HTMLElement, parentId: string | null): void {
    if (!parentId) {
      this.centerElement(element);
      return;
    }
    
    const parent = document.getElementById(parentId);
    if (!parent) {
      this.centerElement(element);
      return;
    }
    
    const rect = parent.getBoundingClientRect();
    element.style.position = 'fixed';
    element.style.top = `${rect.top}px`;
    element.style.left = `${rect.right + 10}px`;
  }

  private positionOverlayParent(element: HTMLElement, parentId: string | null): void {
    if (!parentId) {
      this.centerElement(element);
      return;
    }
    
    const parent = document.getElementById(parentId);
    if (!parent) {
      this.centerElement(element);
      return;
    }
    
    const rect = parent.getBoundingClientRect();
    element.style.position = 'fixed';
    element.style.top = `${rect.top}px`;
    element.style.left = `${rect.left}px`;
    element.style.width = `${rect.width}px`;
    element.style.height = `${rect.height}px`;
  }

  private smartPosition(element: HTMLElement): void {
    // Smart positioning based on available screen space    
    if (element.classList.contains('modal')) {
      this.centerElement(element);
    } else if (element.classList.contains('fullscreen')) {
      element.style.position = 'fixed';
      element.style.top = '0';
      element.style.left = '0';
      element.style.width = '100vw';
      element.style.height = '100vh';
    } else {
      this.cascadeElement(element);
    }
  }

  private dispatchLifecycleEvent(name: string, detail: Record<string, unknown>): void {
    const evt = new CustomEvent(name, { detail });
    window.dispatchEvent(evt);
  }

  // Customization methods for dynamic behavior
  registerCustomPositioningStrategy(name: string, handler: (element: HTMLElement, options: any) => void): void {
    this.customPositioningStrategies.set(name, handler);
  }

  // Allow custom z-index calculation
  setCustomZIndexCalculator(calculator: (element: HTMLElement, displayType: DisplayType, stackPosition: number) => number): void {
    this.customZIndexCalculator = calculator;
  }

  private customZIndexCalculator?: (element: HTMLElement, displayType: DisplayType, stackPosition: number) => number;

  // Calculate z-index - use custom calculator if available
  private calculateZIndex(displayType: DisplayType): number {
    if (this.customZIndexCalculator) {
      return this.customZIndexCalculator(document.createElement('div'), displayType, this.windows.size);
    }

    const layerOffset = this.layoutPolicy.zIndexLayers[displayType as keyof typeof this.layoutPolicy.zIndexLayers] || this.layoutPolicy.zIndexLayers.content;
    const baseZ = this.layoutPolicy.zIndexBase + layerOffset;
    const stackPosition = this.windows.size;
    
    return baseZ + stackPosition;
  }
}
