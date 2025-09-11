import { WindowInstance, ConversationEntry, WorkflowState, WorkflowStage, ContextSnapshot, AIContext, WindowSize, PositioningStrategy, DisplayType } from './types';

export class ContextManager {
  private history: ConversationEntry[] = [];
  private maxHistorySize = 100;
  private currentWorkflow: WorkflowState | null = null;
  private customContextData: Map<string, unknown> = new Map();

  addConversation(entry: ConversationEntry): void {
    this.history.push(entry);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  getConversationHistory(count: number = 5): ConversationEntry[] {
    return this.history.slice(-count);
  }

  // Workflow management - supports dynamic workflow structure
  updateWorkflowState(stage: WorkflowStage, data: Partial<WorkflowState>): void {
    if (!this.currentWorkflow) {
      this.currentWorkflow = {
        currentStage: stage,
        mainTask: data.mainTask || '',
        subTasks: data.subTasks || [],
        progress: data.progress || 0,
        activeWindows: data.activeWindows || [],
        dataEntities: data.dataEntities || new Map<string, unknown>()
      };
      return;
    }
    this.currentWorkflow = {
      ...this.currentWorkflow,
      ...data,
      currentStage: stage
    };
  }

  // Allow custom context data to be stored
  setCustomContext(key: string, value: unknown): void {
    this.customContextData.set(key, value);
  }

  getCustomContext(key: string): unknown {
    return this.customContextData.get(key);
  }

  getAllCustomContext(): Record<string, unknown> {
    return Object.fromEntries(this.customContextData);
  }

  getCurrentWorkflow(): WorkflowState | null {
    return this.currentWorkflow;
  }

  // Capture snapshot - minimal structure, supports dynamic data extraction
  captureSnapshot(active: WindowInstance[] = [], focusedId: string | null = null): ContextSnapshot {
    return {
      timestamp: Date.now(),
      activeWindows: active.map(w => ({ 
        id: w.id, 
        type: w.type,
        purpose: w.element.getAttribute('data-purpose') || undefined,
        data: this.extractWindowData(w.element)
      })),
      focusedWindow: focusedId,
      userData: this.getAllCustomContext(),
      workflowState: this.currentWorkflow || {
        currentStage: 'initial',
        mainTask: '',
        subTasks: [],
        progress: 0,
        activeWindows: [],
        dataEntities: new Map<string, unknown>()
      },
      environmentState: {
        screenSize: { width: window.innerWidth, height: window.innerHeight },
        windowCount: active.length,
        memoryUsage: ((performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize) ?? 0
      }
    };
  }

  // Extract data from window element - supports custom data structure
  private extractWindowData(element: HTMLElement): unknown {
    const dataAttr = element.getAttribute('data-window-data');
    if (dataAttr) {
      try {
        return JSON.parse(dataAttr);
      } catch {
        return dataAttr;
      }
    }
    return undefined;
  }

  // Build comprehensive AI context for effective UI generation
  buildAIContext(userInput: string, active: WindowInstance[] = [], focusedId: string | null = null): AIContext {
    const snapshot = this.captureSnapshot(active, focusedId);
    
    return {
      // Current UI state
      currentState: {
        windows: snapshot.activeWindows,
        focused: snapshot.focusedWindow,
        workflow: snapshot.workflowState
      },
      
      // Conversation history
      history: this.getConversationHistory(5),
      
      // User data and entities
      entities: this.getAllCustomContext(),
      intentions: userInput ? [userInput] : [],
      
      // Screen and environment info
      environment: {
        screenSize: snapshot.environmentState.screenSize,
        availableSpace: this.calculateAvailableSpace(active),
        theme: this.detectTheme(),
        deviceType: this.detectDeviceType()
      },
      
      // UI generation guidelines
      guidelines: {
        preferredDisplayType: this.getPreferredDisplayType(userInput),
        maxWindowSize: this.getMaxWindowSize(),
        positioningStrategy: this.getPositioningStrategy(),
        stylePreferences: {
          colorScheme: this.getColorScheme(),
          animationStyle: this.getAnimationStyle(),
          layoutDensity: this.getLayoutDensity()
        }
      },
      
      // Available resources
      resources: {
        availableEffects: this.getAvailableEffects(),
        customPositioningStrategies: this.getCustomPositioningStrategies(),
        registeredHandlers: this.getRegisteredHandlers()
      }
    };
  }

  // Helper methods for context building
  private calculateAvailableSpace(active: WindowInstance[]): { x: number; y: number; width: number; height: number } {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // Simple calculation - can be enhanced
    const usedWidth = active.length * 300; // Assume 300px per window
    const usedHeight = active.length * 200; // Assume 200px per window
    
    return {
      x: 0,
      y: 0,
      width: Math.max(300, screenWidth - usedWidth),
      height: Math.max(200, screenHeight - usedHeight)
    };
  }

  private detectTheme(): 'light' | 'dark' | 'auto' {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  private detectDeviceType(): 'desktop' | 'tablet' | 'mobile' {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  private getPreferredDisplayType(userInput: string): DisplayType {
    // Simple heuristic - can be enhanced with ML
    if (userInput.toLowerCase().includes('modal') || userInput.toLowerCase().includes('dialog')) {
      return 'modal';
    }
    if (userInput.toLowerCase().includes('overlay') || userInput.toLowerCase().includes('popup')) {
      return 'overlay';
    }
    if (userInput.toLowerCase().includes('window') || userInput.toLowerCase().includes('panel')) {
      return 'window';
    }
    return 'inline';
  }

  private getMaxWindowSize(): WindowSize {
    const deviceType = this.detectDeviceType();
    switch (deviceType) {
      case 'mobile': return 'small';
      case 'tablet': return 'medium';
      case 'desktop': return 'large';
      default: return 'medium';
    }
  }

  private getPositioningStrategy(): PositioningStrategy {
    const deviceType = this.detectDeviceType();
    switch (deviceType) {
      case 'mobile': return 'center';
      case 'tablet': return 'cascade';
      case 'desktop': return 'smart';
      default: return 'center';
    }
  }

  private getColorScheme(): string {
    return this.getCustomContext('colorScheme') as string || 'blue';
  }

  private getAnimationStyle(): 'subtle' | 'dynamic' | 'minimal' {
    return this.getCustomContext('animationStyle') as 'subtle' | 'dynamic' | 'minimal' || 'subtle';
  }

  private getLayoutDensity(): 'compact' | 'comfortable' | 'spacious' {
    return this.getCustomContext('layoutDensity') as 'compact' | 'comfortable' | 'spacious' || 'comfortable';
  }

  private getAvailableEffects(): string[] {
    return this.getCustomContext('availableEffects') as string[] || ['fadeIn', 'slideInFromTop', 'scaleIn'];
  }

  private getCustomPositioningStrategies(): string[] {
    return this.getCustomContext('customPositioningStrategies') as string[] || [];
  }

  private getRegisteredHandlers(): DisplayType[] {
    return ['window', 'modal', 'overlay', 'inline', 'embedded'];
  }

  // Allow custom context extraction strategies
  setContextExtractor(extractor: (element: HTMLElement) => unknown): void {
    this.customContextExtractor = extractor;
  }

  private customContextExtractor?: (element: HTMLElement) => unknown;
}
