/* eslint-disable */
/**
 * Director - Core Types
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

// SubScene Types
export interface SubScene extends BaseEntity {
  parentSceneId: string;
  type: 'partial' | 'overlay' | 'modal';
  selector: string;
  ui: UIContent;
  state: SubSceneState;
  formData: Record<string, FormDataEntryValue>;
  linkedSubScenes: string[];
  metadata: {
    createdAt: number;
    updatedAt: number;
    version: number;
    autoUpdate: boolean;
    updateInterval?: number;
  };
}

export interface SubSceneConfig {
  id?: string;
  type?: 'partial' | 'overlay' | 'modal';
  selector: string;
  ui: {
    type: 'html' | 'component';
    content: string | ComponentDefinition[];
    updateMode?: 'replace' | 'append' | 'prepend' | 'merge';
  };
  initialState?: Partial<SubSceneState>;
  formData?: Record<string, FormDataEntryValue>;
  autoUpdate?: boolean;
  updateInterval?: number;
}

export interface SubSceneState {
  ui: {
    loading: boolean;
    error: string | null;
    visible: boolean;
    updated: boolean;
    animation: string | null;
  };
  data: Record<string, any>;
  update: {
    lastUpdate: number;
    updateCount: number;
    pendingUpdates: any[];
    autoUpdate: boolean;
    updateInterval: any;
  };
  connections: {
    linkedSubScenes: string[];
    eventListeners: any[];
    dataBindings: any[];
  };
}

// Modal Types
export interface Modal extends SubScene {
  config: {
    backdrop: boolean;
    closable: boolean;
    keyboard: boolean;
    focus: boolean;
    size: 'sm' | 'md' | 'lg' | 'xl';
    position: 'center' | 'top' | 'bottom' | 'left' | 'right';
    animation: 'fade' | 'slide' | 'zoom';
  };
  modalState: {
    isOpen: boolean;
    isAnimating: boolean;
    zIndex: number;
    focusTrap: boolean;
  };
}

export interface ModalConfig extends SubSceneConfig {
  config?: {
    backdrop?: boolean;
    closable?: boolean;
    keyboard?: boolean;
    focus?: boolean;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
    animation?: 'fade' | 'slide' | 'zoom';
  };
}

// Animation Types
export interface AnimationOptions {
  duration: number;
  easing: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
  properties: Record<string, { from: any; to: any }>;
  onComplete?: () => void;
  onUpdate?: (progress: number) => void;
}

export interface AnimationState {
  id: string;
  element: HTMLElement;
  isRunning: boolean;
  startTime: number;
  duration: number;
  easing: string;
  properties: Record<string, { from: any; to: any }>;
  onComplete?: () => void;
  onUpdate?: (progress: number) => void;
}

// AI State Management Types
export interface AIStateData {
  sceneState: Record<string, any>;
  globalState: Record<string, any>;
  conversationContext: Record<string, any>;
}

export interface UserAction extends BaseEntity {
  type: string;
  target: string;
  data: any;
  sceneId: string;
  timestamp: number;
}

export interface AIResponseProcessingOptions {
  renderMode?: 'html' | 'component' | 'hybrid';
  updateMode?: 'replace' | 'append' | 'prepend' | 'merge';
  preserveState?: boolean;
}

// Virtual DOM Types
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

// Hybrid Renderer Types
export type RenderingMode = 'html' | 'virtual-dom' | 'component' | 'hybrid';

export interface HybridRendererOptions {
  defaultMode: RenderingMode;
  enableVirtualDOM: boolean;
  enableAnimation: boolean;
  enableSubScenes: boolean;
  enableModals: boolean;
  performanceThreshold: number;
  autoModeSwitch: boolean;
}

// Update Operation Types
export interface UpdateOperation {
  type: 'subscene' | 'modal' | 'animation' | 'state';
  target: string;
  content: any;
  timestamp?: number;
}

// Global State Types
export interface GlobalState {
  application: Record<string, any>;
  user: Record<string, any>;
  system: Record<string, any>;
}

// Modal State Types
export interface ModalState {
  isOpen: boolean;
  isAnimating: boolean;
  zIndex: number;
  focusTrap: boolean;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  fontSize: 'small' | 'medium' | 'large';
  animations: boolean;
  sounds: boolean;
  notifications: boolean;
  accessibility: Record<string, any>;
  ui: Record<string, any>;
}

export interface SystemCapabilities {
  webGL: boolean;
  webRTC: boolean;
  webAudio: boolean;
  fullscreen: boolean;
  clipboard: boolean;
  geolocation: boolean;
  camera: boolean;
  microphone: boolean;
  webgl: boolean;
  webWorkers: boolean;
  serviceWorkers: boolean;
  pushNotifications: boolean;
}

export interface PerformanceMetrics {
  memory: {
    used: number;
    total: number;
    limit: number;
  };
  timing: number;
  fps: number;
  bandwidth: number;
  cpu?: {
    usage: number;
    cores: number;
  };
  network?: {
    latency: number;
    bandwidth: number;
  };
  rendering?: {
    fps: number;
    frameTime: number;
  };
}

export interface NavigationEntry {
  path: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

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
  conversationHistory?: ConversationMessage[];
}

export interface ContextUpdate {
  global?: Partial<GlobalContext>;
  session?: Partial<SessionContext>;
  scene?: Partial<SceneContext>;
  component?: Partial<ComponentContext>;
  temporary?: Partial<TemporaryContext>;
  timestamp?: number;
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
  data: Record<string, unknown>;
  formData?: Record<string, FormDataEntryValue>;
  inputs?: Record<string, unknown>;
}

export interface ComponentDefinition {
  id?: string;
  type: string;
  name: string;
  props: Record<string, ComponentProp>;
  children?: ComponentDefinition[];
  events?: Record<string, string>;
  styles?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export type ComponentProp = 
  | string 
  | number 
  | boolean 
  | null 
  | undefined 
  | ComponentProp[] 
  | { [key: string]: ComponentProp };

export interface AIGeneratedContent {
  type: 'html' | 'component' | 'scene' | 'data' | 'text' | 'html_ui';
  content: string | ComponentDefinition | Scene | Record<string, unknown>;
  
  // Scene 생성을 위한 추가 속성들
  ui?: UIContent;
  title?: string;
  state?: SceneState;
  message?: string; // agent-types.ts에서 필요
  
  metadata?: {
    model?: string;
    provider?: string;
    tokens?: number;
    confidence?: number;
    [key: string]: unknown;
  };
}

// Browser API extensions removed - using direct property checks instead

export interface DirectorGlobalThis {
  __DirectorInstance?: any;
}

// FormData helper types
export type FormDataEntries = IterableIterator<[string, FormDataEntryValue]>;

export interface UIContent {
  type: 'html' | 'component' | 'json';
  content: string | Record<string, unknown> | ComponentDefinition[];
  actions?: Record<string, string>;
  metadata?: Record<string, unknown>;
  renderingMode?: RenderingMode;
  components?: ComponentDefinition[];
  updateMode?: 'replace' | 'append' | 'prepend' | 'merge';
}

export interface UIAction {
  id?: string;
  type: string;
  handler: string;
  data?: ActionData;
  target?: string;
}

export interface ActionData {
  sceneId?: string;
  url?: string;
  target?: string;
  sceneType?: SceneType;
  title?: string;
  component?: ComponentDefinition;
  updateType?: 'partial' | 'full' | 'merge';
  path?: string;
  value?: unknown;
  formId?: string;
  formData?: Record<string, FormDataEntryValue>;
  confirmMessage?: string;
  recoveryAction?: string;
  [key: string]: unknown;
}

export interface Scene extends BaseEntity {
  type: SceneType;
  title: string;
  component: ComponentDefinition;
  ui?: UIContent;
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
    [key: string]: any;
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
    model?: string;
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
    message: string;
    instructions?: string;
    constraints?: {
      maxTokens?: number;
      temperature?: number;
      model?: string;
      stream?: boolean;
    };
  };
}

export interface CustomRequest extends BaseRequest {
  type: 'custom';
  payload: {
    action: string;
    data: ActionData;
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

// Legacy aliases for backward compatibility
export type UserRequest = UserActionRequest;
export type AIResponse = AgentResponse;

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
  
  data: Record<string, unknown>;
  metadata: {
    version: string;
    correlationId: string;
    confidence?: number;
    warnings?: string[];
    provider?: string;
    agent?: string;
  };
}

export interface SuccessResponse extends BaseResponse {
  type: 'success';
  data: {
    result: AIGeneratedContent;
    context?: ContextUpdate;
    sideEffects?: SideEffect[];
    reasoning?: string;
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
    chunk: Partial<AIGeneratedContent>;
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
  data: Record<string, unknown>;
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

export interface AgentResponseEvent extends BaseEvent {
  type: 'agent_response';
  data: {
    response: AgentResponse;
  };
}

export interface AgentErrorEvent extends BaseEvent {
  type: 'agent_error';
  data: {
    error: string;
    details?: any;
  };
}

export type SystemEvent = 
  | ContextChangeEvent
  | SceneCreateEvent
  | SceneUpdateEvent
  | SceneDeleteEvent
  | UserActionEvent
  | AgentResponseEvent
  | AgentErrorEvent;

// ============================================================================
// Configuration Types
// ============================================================================

export interface DirectorConfig {
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
// Utility Types - Removed duplicates
// ============================================================================

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

// ============================================================================
// 대화형 Scene 체인 타입
// ============================================================================

export interface ConversationChain {
  id: string;
  scenes: Scene[];
  currentSceneId: string;
  context: ConversationContext;
  metadata: {
    createdAt: number;
    lastUpdated: number;
    totalSteps: number;
  };
}

export interface ConversationContext {
  userInputs: UserInput[];
  aiOutputs: AIOutput[];
  globalState: Record<string, unknown>;
  sceneStates: Record<string, Record<string, unknown>>;
}

// ============================================================================
// Core Service Interfaces (분리된 인터페이스들)
// ============================================================================

// Scene 관리 인터페이스 (분리)
export interface ISceneRepository {
  createScene(config: Partial<Scene>): Promise<Scene>;
  updateScene(sceneId: string, updates: Partial<Scene>): Promise<Scene | null>;
  deleteScene(sceneId: string): Promise<boolean>;
  getScene(sceneId: string): Scene | null;
  getAllScenes(): Scene[];
}

export interface ISceneNavigation {
  navigateToScene(sceneId: string, options?: NavigationOptions): Promise<void>;
  setActiveScene(sceneId: string): void;
  getActiveScene(): Scene | null;
}

export interface IConversationManager {
  getCurrentConversationChain(): ConversationChain | null;
  startNewConversation(sceneId: string): ConversationChain;
  continueConversation(input: string): Promise<Scene>;
}

// 통합 SceneManager 인터페이스
export interface ISceneManager extends ISceneRepository, ISceneNavigation, IConversationManager {
  removeScene(sceneId: string): void;
  getActionHandler?(): any; // ActionHandler 참조를 위한 선택적 메서드
}

// UI 렌더링 인터페이스 (분리)
export interface ISceneRenderer {
  renderScene(scene: Scene, container?: HTMLElement): HTMLElement;
  updateScene(sceneId: string, updates: Partial<Scene>): void;
  removeScene(sceneId: string): void;
}

export interface IRenderingEngine {
  clearAll(): void;
  getRenderedScenes(): Map<string, HTMLElement>;
  attachEventHandlers(element: HTMLElement, scene: Scene): void;
}

// 통합 UIRenderer 인터페이스
export interface IUIRenderer extends ISceneRenderer, IRenderingEngine {}

// Agent 통신 인터페이스 (분리)
export interface IAgentCommunication {
  sendRequest(request: AgentRequest): Promise<AgentResponse>;
  sendStreamRequest(request: AgentRequest): Promise<AsyncIterable<AgentResponse>>;
  updateConfig(config: DirectorConfig): void;
}

export interface IAgentManagement {
  setThirdPartyAgent(agent: any): void; // ThirdPartyAgent 순환 참조 문제로 임시 any
  getAgent(): any | null;
}

// Director 인터페이스 (분리)
export interface IDirectorCore {
  request(input: string, options?: Partial<DirectorConfig>): Promise<Scene>;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface IDirectorContext {
  setContext(path: string, value: unknown): void;
  getContext(path: string): unknown;
  updateContext(path: string, updater: (current: unknown) => unknown): void;
  subscribeContext(path: string, callback: (value: unknown) => void): () => void;
}

// 통합 Director 인터페이스
export interface IDirector extends IDirectorCore, IAgentCommunication, IAgentManagement, IDirectorContext {
  getCurrentConversationChain(): ConversationChain | null;
}

export interface UserInput {
  id: string;
  input: string;
  timestamp: number;
  sceneId: string;
  metadata?: Record<string, any>;
}

export interface AIOutput {
  id: string;
  response: AgentResponse;
  timestamp: number;
  sceneId: string;
  metadata?: Record<string, any>;
}

export interface AggregatedContext {
  conversation: {
    id: string;
    step: number;
    totalSteps: number;
  };
  scenes: SceneContextSummary[];
  currentScene: {
    id: string;
    context: Record<string, any>;
  };
  global: Record<string, any>;
}

export interface SceneContextSummary {
  id: string;
  type: string;
  title: string;
  state: Record<string, any>;
  userInputs: UserInput[];
  aiOutputs: AIOutput[];
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
  data: ActionData;
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

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  value?: unknown;
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

export class DirectorError extends Error {
  constructor(
    message: string,
    public code: string = 'DIRECTOR_ERROR',
    public details?: Record<string, unknown>,
    public recovery?: RecoveryAction[]
  ) {
    super(message);
    this.name = 'DirectorError';
  }
}

export class ContextError extends DirectorError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONTEXT_ERROR', details);
    this.name = 'ContextError';
  }
}

export class SceneError extends DirectorError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'SCENE_ERROR', details);
    this.name = 'SceneError';
  }
}

export class CommunicationError extends DirectorError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'COMMUNICATION_ERROR', details);
    this.name = 'CommunicationError';
  }
}

export class ValidationError extends DirectorError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}
