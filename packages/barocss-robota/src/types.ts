/**
 * Type definitions for @barocss/robota
 */

// Re-export core types from @barocss/ui for convenience
export type { 
  ThirdPartyAgent, 
  AgentRequest, 
  AgentResponse 
} from '@barocss/ui';

// ============================================================================
// Robota-specific Types
// ============================================================================

export interface RobotaConfig {
  /** Agent name for identification */
  name?: string;
  
  /** AI service providers configuration */
  aiProviders: AIProvider[];
  
  /** Default model configuration */
  defaultModel: ModelConfig;
  
  /** Custom tools to enhance agent capabilities */
  tools?: RobotaTool[];
  
  /** Robota SDK plugins */
  plugins?: RobotaPlugin[];
  
  /** Maximum retry attempts for failed requests */
  maxRetries?: number;
  
  /** Enable response caching for performance */
  cacheEnabled?: boolean;
  
  /** Enable team collaboration mode */
  teamMode?: boolean;
  
  /** Team configuration when teamMode is enabled */
  teamConfig?: TeamConfig;
}

export interface AIProvider {
  /** Provider identifier (e.g., 'openai', 'anthropic') */
  name: string;
  
  /** API key for authentication */
  apiKey: string;
  
  /** Custom API endpoint URL */
  baseURL?: string;
  
  /** Available model names for this provider */
  models?: string[];
  
  /** Additional provider-specific options */
  options?: Record<string, any>;
}

export interface ModelConfig {
  /** AI provider name */
  provider: string;
  
  /** Model name */
  model: string;
  
  /** System message to define agent behavior */
  systemMessage?: string;
  
  /** Model-specific parameters */
  parameters?: ModelParameters;
}

export interface ModelParameters {
  /** Temperature for response randomness (0.0 - 2.0) */
  temperature?: number;
  
  /** Maximum tokens for response */
  maxTokens?: number;
  
  /** Top-p sampling parameter */
  topP?: number;
  
  /** Frequency penalty */
  frequencyPenalty?: number;
  
  /** Presence penalty */
  presencePenalty?: number;
  
  /** Stop sequences */
  stop?: string[];
}

export interface TeamConfig {
  /** Maximum number of agents in the team */
  maxMembers?: number;
  
  /** Total token limit for team operations */
  maxTokenLimit?: number;
  
  /** How agents collaborate */
  collaborationMode?: CollaborationMode;
  
  /** Enable debug logging */
  debug?: boolean;
  
  /** Timeout for team operations (ms) */
  timeout?: number;
  
  /** Minimum consensus required for decisions */
  consensusThreshold?: number;
}

export type CollaborationMode = 
  | 'sequential'  // Agents work one after another
  | 'parallel'    // Agents work simultaneously
  | 'debate'      // Agents debate and reach consensus
  | 'hierarchical'; // Structured agent hierarchy

export interface RobotaTool {
  /** Tool name */
  name: string;
  
  /** Tool description */
  description: string;
  
  /** JSON schema for tool parameters */
  schema: ToolSchema;
  
  /** Tool implementation function */
  handler: ToolHandler;
  
  /** Tool configuration options */
  options?: ToolOptions;
}

export interface ToolSchema {
  type: 'object';
  properties: Record<string, SchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export type JSONSchemaType = 
  | 'string'
  | 'number' 
  | 'integer'
  | 'boolean'
  | 'array'
  | 'object'
  | 'null';

export interface SchemaProperty {
  type: JSONSchemaType;
  description?: string;
  enum?: string[];
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

export type ToolHandler = (params: any) => Promise<any>;

export interface ToolOptions {
  /** Timeout for tool execution (ms) */
  timeout?: number;
  
  /** Enable caching of tool results */
  cache?: boolean;
  
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
  
  /** Retry attempts on failure */
  retries?: number;
}

export interface RobotaPlugin {
  /** Plugin name */
  name: string;
  
  /** Plugin version */
  version: string;
  
  /** Plugin initialization options */
  options?: Record<string, any>;
}

// ============================================================================
// Statistics and Monitoring
// ============================================================================

export interface RobotaStats {
  /** Total number of requests processed */
  totalRequests: number;
  
  /** Total tokens consumed */
  totalTokens: number;
  
  /** Average response time in milliseconds */
  averageResponseTime: number;
  
  /** Cache hit rate (0.0 - 1.0) */
  cacheHitRate: number;
  
  /** Number of active agents */
  activeAgents: number;
  
  /** Error rate (0.0 - 1.0) */
  errorRate?: number;
  
  /** Team-specific statistics */
  teamStats?: TeamStats;
  
  /** Provider usage statistics */
  providerStats?: ProviderStats[];
  
  /** Tool usage statistics */
  toolStats?: ToolStats[];
}

export interface TeamStats {
  /** Number of agents created */
  totalAgentsCreated: number;
  
  /** Total execution time for team operations */
  totalExecutionTime: number;
  
  /** Success rate for team collaborations */
  collaborationSuccessRate: number;
  
  /** Average team size used */
  averageTeamSize: number;
  
  /** Most used collaboration mode */
  preferredCollaborationMode: CollaborationMode;
}

export interface ProviderStats {
  /** Provider name */
  provider: string;
  
  /** Number of requests to this provider */
  requests: number;
  
  /** Total tokens used */
  tokens: number;
  
  /** Average response time */
  averageResponseTime: number;
  
  /** Error rate for this provider */
  errorRate: number;
  
  /** Most used model */
  mostUsedModel: string;
}

export interface ToolStats {
  /** Tool name */
  tool: string;
  
  /** Number of times tool was called */
  calls: number;
  
  /** Success rate */
  successRate: number;
  
  /** Average execution time */
  averageExecutionTime: number;
  
  /** Cache hit rate for this tool */
  cacheHitRate: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export type TaskType = 
  | 'creative'
  | 'analytical'
  | 'research'
  | 'coding'
  | 'design'
  | 'writing'
  | 'planning'
  | 'general';

export interface TaskClassification {
  type: TaskType;
  complexity: 'low' | 'medium' | 'high';
  confidence: number; // 0.0 - 1.0
  suggestedProvider?: string;
  suggestedModel?: string;
  teamRecommended?: boolean;
}

export interface CacheEntry {
  key: string;
  value: any;
  timestamp: number;
  ttl: number;
  hits: number;
}

export interface PerformanceMetrics {
  latency: number;
  throughput: number;
  memoryUsage: number;
  cpuUsage: number;
  networkLatency: number;
}