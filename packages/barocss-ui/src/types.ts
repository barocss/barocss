export type DisplayType = 'window' | 'modal' | 'overlay' | 'inline' | 'embedded';
export type WindowSize = 'small' | 'medium' | 'large' | 'fullscreen' | 'auto';
export type Priority = 'low' | 'normal' | 'high' | 'critical';

export interface DisplayConfig {
  type: DisplayType;
  size: WindowSize;
  position?: 'center' | 'beside-parent' | 'overlay-parent' | 'smart';
  priority?: Priority;
  backdrop?: 'none' | 'blur' | 'dim';
}

export interface ContextInfo {
  id: string;
  parent?: string | null;
  purpose?: string | null;
  workflow?: string | null;
}

export interface AIResponse {
  html: string;
  display: DisplayConfig;
  context: ContextInfo;
  interactions?: Record<string, InteractionHandler>;
  effects?: {
    entrance?: string;
    exit?: string;
    duration?: number;
  };
  // Multi-step workflow support
  workflow?: {
    currentStep: string;
    nextSteps: string[];
    completionCriteria: string[];
    dataCollection: Record<string, unknown>;
  };
}

export interface InteractionHandler {
  action: string;
  validation?: string[];
  onSuccess?: string;
  onError?: string;
  dataExtraction?: Record<string, string>;
  nextPrompt?: string;
}

export interface ProcessResult {
  success: boolean;
  element?: HTMLElement;
  id?: string;
  error?: string;
  fallback?: HTMLElement;
}

export interface Position { x: number; y: number; }
export interface Rectangle { x: number; y: number; width: number; height: number; }

export type WindowState =
  | 'created'
  | 'visible'
  | 'minimized'
  | 'maximized'
  | 'focused'
  | 'blurred'
  | 'closed';

export interface WindowConfig {
  type: DisplayType;
  size: WindowSize;
  position?: Position;
  draggable?: boolean;
  resizable?: boolean;
  modal?: boolean;
}

export interface WindowInstance {
  id: string;
  element: HTMLElement;
  state: WindowState;
  parent?: string;
  children: string[];
  zIndex: number;
  createdAt: number;
  lastActiveAt: number;
  type: DisplayType;
}

export interface RuntimeStats {
  totalWindows: number;
  focusedWindowId: string | null;
}

export interface AIService {
  generateResponse(input: string, context: AIContext): Promise<AIResponse>;
}

export interface OrchestrateResult {
  success: boolean;
  element?: HTMLElement;
  window?: WindowInstance;
  error?: string;
}


export interface ConversationEntry {
  id: string;
  timestamp: number;
  userInput: string;
  aiResponse: AIResponse;
  context: ContextSnapshot;
  windowsCreated: string[];
  windowsClosed: string[];
}

export type WorkflowStage = 'initial' | 'exploring' | 'focusing' | 'editing' | 'confirming' | 'completing';

export interface WorkflowState {
  currentStage: WorkflowStage;
  mainTask: string;
  subTasks: string[];
  progress: number;
  activeWindows: string[];
  dataEntities: Map<string, unknown>;
}

export interface WindowInfo {
  id: string;
  type: DisplayType;
  purpose?: string;
  data?: unknown;
}

export interface ContextSnapshot {
  timestamp: number;
  activeWindows: WindowInfo[];
  focusedWindow: string | null;
  userData: Record<string, unknown>;
  workflowState: WorkflowState;
  environmentState: {
    screenSize: { width: number; height: number };
    windowCount: number;
    memoryUsage: number;
  };
}

export interface AIContext {
  // Current UI state
  currentState: {
    windows: WindowInfo[];
    focused: string | null;
    workflow: WorkflowState;
  };
  
  // Conversation history
  history: ConversationEntry[];
  
  // User data and entities
  entities: Record<string, unknown>;
  intentions: string[];
  
  // Screen and environment info
  environment: {
    screenSize: { width: number; height: number };
    availableSpace: { x: number; y: number; width: number; height: number };
    theme: 'light' | 'dark' | 'auto';
    deviceType: 'desktop' | 'tablet' | 'mobile';
  };
  
  // UI generation guidelines
  guidelines: {
    preferredDisplayType: DisplayType;
    maxWindowSize: WindowSize;
    positioningStrategy: PositioningStrategy;
    stylePreferences: {
      colorScheme: string;
      animationStyle: 'subtle' | 'dynamic' | 'minimal';
      layoutDensity: 'compact' | 'comfortable' | 'spacious';
    };
  };
  
  // Available resources
  resources: {
    availableEffects: string[];
    customPositioningStrategies: string[];
    registeredHandlers: DisplayType[];
  };
}

export interface UIRuntimeOptions {
  ai: AIService;
  onBeforeRender?: (response: AIResponse) => void;
  onAfterRender?: (win: WindowInstance) => void;
  onError?: (error: Error) => void;
  layoutPolicy?: LayoutPolicy;
  errorPolicy?: ErrorPolicy;
  logLevel?: 'silent' | 'error' | 'warn' | 'info' | 'debug';
  validationOptions?: {
    maxHtmlSize?: number;
    strictMode?: boolean;
  };
}

export type PositioningStrategy = 'center' | 'cascade' | 'beside-parent' | 'overlay-parent' | 'smart';

export interface LayoutPolicy {
  positioningStrategy: PositioningStrategy;
  cascadeOffset: number;
  zIndexBase: number;
  zIndexLayers: {
    base: number;
    layout: number;
    content: number;
    floating: number;
    modal: number;
    overlay: number;
  };
}

export interface ErrorPolicy {
  showUserFriendlyErrors: boolean;
  fallbackUI: (error: Error) => HTMLElement;
}