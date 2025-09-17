# @barocss/robota API Reference

## Classes

### RobotaAdvancedWrapper

The main class for creating advanced Robota agents with multi-provider support.

```typescript
class RobotaAdvancedWrapper implements ThirdPartyAgent {
  constructor(config: RobotaConfig)
}
```

#### Constructor Parameters

- `config: RobotaConfig` - Configuration object for the agent

#### Methods

##### sendRequest(request: AgentRequest): Promise<AgentResponse>

Sends a single request to the agent.

##### sendStreamRequest(request: AgentRequest): Promise<AsyncIterable<AgentResponse>>

Sends a streaming request to the agent.

##### isConnected(): boolean

Returns whether the agent is connected and ready.

##### connect(): Promise<void>

Connects the agent (no-op for mock implementation).

##### disconnect(): Promise<void>

Disconnects and cleans up the agent.

##### getStats(): RobotaStats

Returns usage statistics for the agent.

##### addTool(name: string, description: string, schema: any, handler: Function): void

Adds a custom tool to the agent.

##### switchToTeamMode(teamConfig?: TeamConfig): Promise<void>

Switches the agent to team collaboration mode.

##### switchToSingleMode(): Promise<void>

Switches the agent back to single agent mode.

##### clearCache(): void

Clears the response cache.

## Interfaces

### RobotaConfig

Configuration for creating a Robota agent.

```typescript
interface RobotaConfig {
  name?: string;
  aiProviders: AIProvider[];
  defaultModel: ModelConfig;
  tools?: any[];
  plugins?: any[];
  maxRetries?: number;
  cacheEnabled?: boolean;
  teamMode?: boolean;
  teamConfig?: TeamConfig;
}
```

### AIProvider

Configuration for an AI service provider.

```typescript
interface AIProvider {
  name: string;
  apiKey: string;
  baseURL?: string;
  models?: string[];
  options?: Record<string, any>;
}
```

### ModelConfig

Configuration for an AI model.

```typescript
interface ModelConfig {
  provider: string;
  model: string;
  systemMessage?: string;
  parameters?: ModelParameters;
}
```

### ModelParameters

Parameters for AI model behavior.

```typescript
interface ModelParameters {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
}
```

### TeamConfig

Configuration for team collaboration mode.

```typescript
interface TeamConfig {
  maxMembers?: number;
  maxTokenLimit?: number;
  collaborationMode?: CollaborationMode;
  debug?: boolean;
  timeout?: number;
  consensusThreshold?: number;
}
```

### CollaborationMode

```typescript
type CollaborationMode = 
  | 'sequential'  // Agents work one after another
  | 'parallel'    // Agents work simultaneously
  | 'debate'      // Agents debate and reach consensus
  | 'hierarchical'; // Structured agent hierarchy
```

### RobotaStats

Usage statistics for the agent.

```typescript
interface RobotaStats {
  totalRequests: number;
  totalTokens: number;
  averageResponseTime: number;
  cacheHitRate: number;
  activeAgents: number;
  errorRate?: number;
  teamStats?: TeamStats;
  providerStats?: ProviderStats[];
  toolStats?: ToolStats[];
}
```

## Factory Functions

### createBasicRobotaWrapper(providers: AIProvider[]): RobotaAdvancedWrapper

Creates a basic Robota agent with default settings.

### createResearchAgent(providers: AIProvider[]): RobotaAdvancedWrapper

Creates a research-focused agent optimized for thorough analysis.

### createCreativeAgent(providers: AIProvider[]): RobotaAdvancedWrapper

Creates a creative agent optimized for artistic and design tasks.

### createTeamAgent(providers: AIProvider[], teamConfig?: TeamConfig): RobotaAdvancedWrapper

Creates a team-based collaborative agent.

## Type Definitions

### TaskType

```typescript
type TaskType = 
  | 'creative'
  | 'analytical'
  | 'research'
  | 'coding'
  | 'design'
  | 'writing'
  | 'planning'
  | 'general';
```

### RobotaTool

```typescript
interface RobotaTool {
  name: string;
  description: string;
  schema: ToolSchema;
  handler: ToolHandler;
  options?: ToolOptions;
}
```

### ToolSchema

```typescript
interface ToolSchema {
  type: 'object';
  properties: Record<string, SchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}
```

## Error Classes

### RobotaError

```typescript
class RobotaError extends Error {
  public code: string;
  public details?: any;
  public provider?: string;
  public model?: string;
  
  constructor(message: string, code?: string, details?: any)
}
```

### RobotaProviderError

```typescript
class RobotaProviderError extends RobotaError {
  constructor(message: string, provider: string, details?: any)
}
```

### RobotaTeamError

```typescript
class RobotaTeamError extends RobotaError {
  constructor(message: string, details?: any)
}
```

### RobotaToolError

```typescript
class RobotaToolError extends RobotaError {
  public tool: string;
  
  constructor(message: string, tool: string, details?: any)
}
```
