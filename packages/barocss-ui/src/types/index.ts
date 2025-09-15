/**
 * AI Agent OS - Core Types
 * AI 에이전트 운영체제의 핵심 타입 정의
 */

// ============================================================================
// 기본 타입 정의
// ============================================================================

export type ID = string;
export type Timestamp = number;
export type Version = string;

export interface BaseEntity {
  id: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}

// ============================================================================
// Context Management Types
// ============================================================================

export interface GlobalContext {
  application: {
    version: string;
    environment: 'development' | 'staging' | 'production';
    build: string;
    features: Record<string, boolean>;
  };
  
  user: {
    id: string;
    role: string;
    permissions: string[];
    preferences: UserPreferences;
    locale: string;
    timezone: string;
  };
  
  system: {
    platform: string;
    browser: string;
    capabilities: SystemCapabilities;
    performance: PerformanceMetrics;
  };
}

export interface SessionContext {
  sessionId: string;
  startTime: Timestamp;
  lastActivity: Timestamp;
  duration: number;
  
  navigation: {
    history: NavigationEntry[];
    current: string;
    previous: string | null;
  };
  
  state: {
    authenticated: boolean;
    loading: boolean;
    error: Error | null;
  };
  
  data: {
    cache: Record<string, any>;
    variables: Record<string, any>;
    temporary: Record<string, any>;
  };
}

export interface SceneContext {
  sceneId: string;
  type: SceneType;
  title: string;
  
  parent: {
    sceneId: string | null;
    relationship: 'parent' | 'child' | 'sibling' | 'modal';
  };
  
  children: {
    sceneIds: string[];
    relationships: Record<string, string>;
  };
  
  state: {
    visible: boolean;
    active: boolean;
    focused: boolean;
    loading: boolean;
  };
  
  data: {
    props: Record<string, any>;
    state: Record<string, any>;
    computed: Record<string, any>;
  };
  
  metadata: {
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdBy: 'user' | 'ai' | 'system';
    version: number;
  };
}

export interface ComponentContext {
  componentId: string;
  type: string;
  name: string;
  
  parent: {
    componentId: string | null;
    sceneId: string;
  };
  
  children: {
    componentIds: string[];
    order: number[];
  };
  
  props: Record<string, any>;
  state: Record<string, any>;
  refs: Record<string, any>;
  
  lifecycle: {
    mounted: boolean;
    updated: boolean;
    destroyed: boolean;
  };
}

export interface TemporaryContext {
  requestId: string;
  timestamp: Timestamp;
  expiresAt: Timestamp;
  
  data: Record<string, any>;
  metadata: {
    source: 'user' | 'ai' | 'system';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    tags: string[];
  };
}

export interface ContextHierarchy {
  global: GlobalContext;
  session: SessionContext;
  scene: SceneContext | null;
  component: ComponentContext | null;
  temporary: TemporaryContext | null;
}

export interface ContextUpdate {
  global?: Partial<GlobalContext>;
  session?: Partial<SessionContext>;
  scene?: Partial<SceneContext>;
  component?: Partial<ComponentContext>;
  temporary?: Partial<TemporaryContext>;
}

// ============================================================================
// Scene Management Types
// ============================================================================

export type SceneType = 'window' | 'modal' | 'popover' | 'overlay' | 'page';

export interface SceneState {
  visible: boolean;
  active: boolean;
  focused: boolean;
  loading: boolean;
  error: Error | null;
  data: Record<string, any>;
}

export interface ComponentDefinition {
  type: string;
  name: string;
  props: Record<string, any>;
  children?: ComponentDefinition[];
  events?: Record<string, string>;
  styles?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface Scene extends BaseEntity {
  type: SceneType;
  title: string;
  component: ComponentDefinition;
  state: SceneState;
  context: SceneContext;
  relationships: {
    parent?: string;
    children: string[];
    siblings: string[];
  };
  metadata: {
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdBy: 'user' | 'ai' | 'system';
    version: number;
  };
}

export interface SceneConfig {
  id?: string;
  type: SceneType;
  title: string;
  component: ComponentDefinition;
  parentId?: string;
  position?: Position;
  size?: Size;
  props?: Record<string, any>;
  state?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface Position {
  x: number;
  y: number;
  z?: number;
}

export interface Size {
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

// ============================================================================
// Communication Types
// ============================================================================

export interface BaseRequest extends BaseEntity {
  type: RequestType;
  timestamp: Timestamp;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  source: 'user' | 'ai' | 'system';
  
  context: ContextHierarchy;
  
  metadata: {
    version: string;
    correlationId: string;
    parentRequestId: string | null;
    tags: string[];
  };
}

export interface CreateSceneRequest extends BaseRequest {
  type: 'create_scene';
  payload: {
    sceneType: SceneType;
    title: string;
    component: ComponentDefinition;
    parentSceneId?: string;
    position?: Position;
    size?: Size;
    props?: Record<string, any>;
    state?: Record<string, any>;
  };
}

export interface UpdateSceneRequest extends BaseRequest {
  type: 'update_scene';
  payload: {
    sceneId: string;
    updates: {
      title?: string;
      component?: Partial<ComponentDefinition>;
      props?: Record<string, any>;
      state?: Record<string, any>;
      position?: Position;
      size?: Size;
    };
  };
}

export interface DeleteSceneRequest extends BaseRequest {
  type: 'delete_scene';
  payload: {
    sceneId: string;
    cascade?: boolean;
  };
}

export interface NavigateRequest extends BaseRequest {
  type: 'navigate';
  payload: {
    target: string;
    method: 'push' | 'replace' | 'back' | 'forward';
    params?: Record<string, any>;
    options?: NavigationOptions;
  };
}

export interface UserActionRequest extends BaseRequest {
  type: 'user_action';
  payload: {
    action: string;
    target: string;
    data: Record<string, any>;
    event: UserEvent;
  };
}

export interface AIQueryRequest extends BaseRequest {
  type: 'ai_query';
  payload: {
    query: string;
    context: AIContext;
    options: AIQueryOptions;
  };
}

export interface CustomRequest extends BaseRequest {
  type: 'custom';
  payload: {
    action: string;
    data: any;
    handler: string;
  };
}

export type RequestType = 
  | 'create_scene'
  | 'update_scene'
  | 'delete_scene'
  | 'navigate'
  | 'user_action'
  | 'ai_query'
  | 'custom';

export type AgentRequest = 
  | CreateSceneRequest
  | UpdateSceneRequest
  | DeleteSceneRequest
  | NavigateRequest
  | UserActionRequest
  | AIQueryRequest
  | CustomRequest;

export interface BaseResponse extends BaseEntity {
  requestId: string;
  type: ResponseType;
  timestamp: Timestamp;
  processingTime: number;
  
  status: {
    success: boolean;
    code: number;
    message: string;
  };
  
  data: any;
  metadata: {
    version: string;
    correlationId: string;
    confidence?: number;
    warnings?: string[];
  };
}

export interface SuccessResponse extends BaseResponse {
  type: 'success';
  data: {
    result: any;
    context?: ContextUpdate;
    sideEffects?: SideEffect[];
  };
}

export interface ErrorResponse extends BaseResponse {
  type: 'error';
  data: {
    error: {
      code: string;
      message: string;
      details?: any;
      stack?: string;
    };
    recovery?: RecoveryAction[];
  };
}

export interface PartialResponse extends BaseResponse {
  type: 'partial';
  data: {
    chunk: any;
    progress: number;
    total?: number;
  };
}

export interface RedirectResponse extends BaseResponse {
  type: 'redirect';
  data: {
    target: string;
    method: 'push' | 'replace';
    params?: Record<string, any>;
  };
}

export type ResponseType = 'success' | 'error' | 'partial' | 'redirect';

export type AgentResponse = 
  | SuccessResponse
  | ErrorResponse
  | PartialResponse
  | RedirectResponse;

// ============================================================================
// Event Types
// ============================================================================

export interface BaseEvent {
  type: string;
  timestamp: Timestamp;
  source: string;
  data: any;
}

export interface ContextChangeEvent extends BaseEvent {
  type: 'context_change';
  data: {
    path: string;
    oldValue: any;
    newValue: any;
  };
}

export interface SceneCreateEvent extends BaseEvent {
  type: 'scene_create';
  data: {
    scene: Scene;
  };
}

export interface SceneUpdateEvent extends BaseEvent {
  type: 'scene_update';
  data: {
    scene: Scene;
    changes: Record<string, any>;
  };
}

export interface SceneDeleteEvent extends BaseEvent {
  type: 'scene_delete';
  data: {
    sceneId: string;
  };
}

export interface UserActionEvent extends BaseEvent {
  type: 'user_action';
  data: {
    action: string;
    target: string;
    data: Record<string, any>;
  };
}

export type SystemEvent = 
  | ContextChangeEvent
  | SceneCreateEvent
  | SceneUpdateEvent
  | SceneDeleteEvent
  | UserActionEvent;

// ============================================================================
// Configuration Types
// ============================================================================

export interface AIAgentOSConfig {
  version: string;
  environment: 'development' | 'staging' | 'production';
  debug: boolean;
  
  communication: {
    websocket: {
      url: string;
      reconnect: boolean;
      maxReconnectAttempts: number;
      reconnectInterval: number;
    };
    rest: {
      baseUrl: string;
      timeout: number;
      retries: number;
    };
  };
  
  state: {
    persistence: boolean;
    storage: 'memory' | 'localStorage' | 'indexedDB';
    maxHistory: number;
  };
  
  ui: {
    theme: 'light' | 'dark' | 'auto';
    animations: boolean;
    transitions: boolean;
  };
  
  performance: {
    maxScenes: number;
    cleanupInterval: number;
    gcThreshold: number;
  };
  
  security: {
    encryption: boolean;
    validation: boolean;
    sanitization: boolean;
  };
}

// ============================================================================
// Utility Types
// ============================================================================

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  fontSize: 'small' | 'medium' | 'large';
  animations: boolean;
  sounds: boolean;
  notifications: boolean;
}

export interface SystemCapabilities {
  webgl: boolean;
  webRTC: boolean;
  webAudio: boolean;
  webWorkers: boolean;
  serviceWorkers: boolean;
  pushNotifications: boolean;
  geolocation: boolean;
  camera: boolean;
  microphone: boolean;
}

export interface PerformanceMetrics {
  memory: {
    used: number;
    total: number;
    limit: number;
  };
  cpu: {
    usage: number;
    cores: number;
  };
  network: {
    latency: number;
    bandwidth: number;
  };
  rendering: {
    fps: number;
    frameTime: number;
  };
}

export interface NavigationEntry {
  id: string;
  path: string;
  title: string;
  timestamp: Timestamp;
  data?: Record<string, any>;
}

export interface NavigationOptions {
  replace?: boolean;
  state?: Record<string, any>;
  scroll?: boolean;
  animation?: string;
}

export interface UserEvent {
  type: string;
  target: string;
  data: Record<string, any>;
  timestamp: Timestamp;
  source: 'mouse' | 'keyboard' | 'touch' | 'voice' | 'gesture';
}

export interface AIContext {
  model: string;
  capabilities: AICapabilities;
  context: Record<string, any>;
  history: ConversationHistory;
}

export interface AICapabilities {
  textGeneration: boolean;
  imageGeneration: boolean;
  codeGeneration: boolean;
  reasoning: boolean;
  memory: boolean;
}

export interface ConversationHistory {
  messages: ConversationMessage[];
  maxLength: number;
  currentLength: number;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Timestamp;
  metadata?: Record<string, any>;
}

export interface AIQueryOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  context?: Record<string, any>;
}

export interface SideEffect {
  type: string;
  action: string;
  data: any;
  delay?: number;
}

export interface RecoveryAction {
  type: string;
  description: string;
  action: () => Promise<void>;
  priority: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface Schema {
  type: string;
  properties: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

export class AIAgentOSError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
    public recovery?: RecoveryAction[]
  ) {
    super(message);
    this.name = 'AIAgentOSError';
  }
}

export class ContextError extends AIAgentOSError {
  constructor(message: string, details?: any) {
    super(message, 'CONTEXT_ERROR', details);
    this.name = 'ContextError';
  }
}

export class SceneError extends AIAgentOSError {
  constructor(message: string, details?: any) {
    super(message, 'SCENE_ERROR', details);
    this.name = 'SceneError';
  }
}

export class CommunicationError extends AIAgentOSError {
  constructor(message: string, details?: any) {
    super(message, 'COMMUNICATION_ERROR', details);
    this.name = 'CommunicationError';
  }
}

export class ValidationError extends AIAgentOSError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}
