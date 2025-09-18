# @barocss/robota

Advanced AI Agent integration for BaroCSS Director using the Robota SDK.

## Features

🤖 **Multi-Provider Support** - Seamlessly switch between OpenAI, Anthropic, and other AI providers  
🧠 **Smart Model Selection** - Automatically chooses optimal models based on task type  
👥 **Team Collaboration** - Multi-agent workflows for complex tasks  
🎯 **Specialized Agents** - Pre-configured agents for research, creative work, and more  
⚡ **Performance Optimization** - Built-in caching and response optimization  
🔧 **Tool Integration** - Easy custom tool integration  
📊 **Analytics** - Comprehensive usage statistics and performance monitoring  

## Installation

```bash
npm install @barocss/robota @robota-sdk/agents @robota-sdk/openai @robota-sdk/anthropic
```

## Quick Start

```typescript
import { Director } from '@barocss/ui';
import { RobotaAdvancedWrapper } from '@barocss/robota';

// Configure AI providers
const providers = [
  {
    name: 'openai',
    apiKey: 'your-openai-key',
    models: ['gpt-4', 'gpt-3.5-turbo']
  },
  {
    name: 'anthropic', 
    apiKey: 'your-anthropic-key',
    models: ['claude-3-sonnet-20240229']
  }
];

// Create advanced Robota agent
const robotaAgent = new RobotaAdvancedWrapper({
  name: 'Smart Assistant',
  aiProviders: providers,
  defaultModel: {
    provider: 'openai',
    model: 'gpt-4',
    systemMessage: 'You are a helpful AI assistant specializing in UI generation.'
  },
  cacheEnabled: true,
  maxRetries: 3
});

// Connect to Director
const director = new Director();
await director.initialize();
director.setThirdPartyAgent(robotaAgent);

// Use with automatic model selection
const scene = await director.request("Create a modern e-commerce homepage");
```

## Documentation

- 📚 **[Examples](./docs/examples.md)** - Comprehensive usage examples
- 📖 **[API Reference](./docs/api-reference.md)** - Complete API documentation  
- 🔧 **[Integration Guide](./docs/integration-guide.md)** - Step-by-step integration instructions

## Advanced Features

### Smart Model Selection

The agent automatically selects the best AI model based on your request:

- **Creative tasks** → Anthropic Claude (creative writing, design)
- **Complex reasoning** → OpenAI GPT-4 (analysis, planning, problem-solving)
- **General tasks** → Default model (efficient for everyday requests)

### Custom Tools Integration

```typescript
// Add custom tools to enhance agent capabilities
robotaAgent.addTool(
  'generateComponent',
  'Generate React component code',
  {
    type: 'object',
    properties: {
      componentName: { type: 'string' },
      props: { type: 'array' }
    }
  },
  async (params) => {
    // Your custom tool implementation
    return generateReactComponent(params);
  }
);
```

### Performance Monitoring

```typescript
// Get detailed statistics
const stats = robotaAgent.getStats();
console.log(`Total requests: ${stats.totalRequests}`);
console.log(`Average response time: ${stats.averageResponseTime}ms`);
console.log(`Cache hit rate: ${stats.cacheHitRate}%`);
console.log(`Active agents: ${stats.activeAgents}`);
```

### Caching & Optimization

```typescript
const optimizedAgent = new RobotaAdvancedWrapper({
  name: 'Optimized Agent',
  aiProviders: providers,
  defaultModel: { provider: 'openai', model: 'gpt-4' },
  cacheEnabled: true,  // Enable response caching
  maxRetries: 3        // Automatic retry on failures
});

// Clear cache when needed
optimizedAgent.clearCache();
```

### Dynamic Mode Switching

```typescript
// Switch between single agent and team mode
await robotaAgent.switchToTeamMode({
  maxMembers: 8,
  collaborationMode: 'parallel'
});

// Back to single agent mode
await robotaAgent.switchToSingleMode();
```

## Configuration

### RobotaConfig Options

```typescript
interface RobotaConfig {
  name?: string;                    // Agent name
  aiProviders: AIProvider[];        // AI service providers
  defaultModel: {                   // Default model configuration
    provider: string;
    model: string;
    systemMessage?: string;
  };
  tools?: any[];                    // Custom tools
  plugins?: any[];                  // Robota plugins
  maxRetries?: number;              // Retry attempts (default: 3)
  cacheEnabled?: boolean;           // Enable caching (default: true)
  teamMode?: boolean;               // Enable team collaboration
  teamConfig?: TeamConfig;          // Team configuration
}
```

### AI Provider Configuration

```typescript
interface AIProvider {
  name: string;                     // Provider name ('openai', 'anthropic', etc.)
  apiKey: string;                   // API key
  baseURL?: string;                 // Custom API endpoint
  models?: string[];                // Available models
}
```

### Team Configuration

```typescript
interface TeamConfig {
  maxMembers?: number;              // Maximum team size (default: 5)
  maxTokenLimit?: number;           // Token limit (default: 100000)
  collaborationMode?: 'sequential' | 'parallel' | 'debate';
  debug?: boolean;                  // Enable debug logging
}
```

## Examples

### E-commerce Platform Generator

```typescript
const ecommerceAgent = new RobotaAdvancedWrapper({
  name: 'E-commerce Specialist',
  aiProviders: providers,
  defaultModel: {
    provider: 'openai',
    model: 'gpt-4',
    systemMessage: `You are an e-commerce platform specialist. 
    Create modern, user-friendly interfaces with excellent UX.`
  },
  teamMode: true,
  teamConfig: {
    maxMembers: 6,
    collaborationMode: 'sequential'
  }
});

const scenes = await Promise.all([
  director.request("Create a product catalog page"),
  director.request("Design a shopping cart interface"),
  director.request("Build a checkout flow"),
  director.request("Generate a user dashboard")
]);
```

### Multi-Step Workflow

```typescript
// Sequential complex workflow
const workflowAgent = createTeamAgent(providers, {
  maxMembers: 8,
  collaborationMode: 'sequential'
});

director.setThirdPartyAgent(workflowAgent);

const result = await director.request(`
  Create a complete social media dashboard:
  1. User authentication system
  2. Post creation and editing
  3. Real-time notifications
  4. Analytics dashboard
  5. Mobile-responsive design
`);
```

## Error Handling

```typescript
try {
  const scene = await director.request("Create a complex application");
} catch (error) {
  if (error.code === 'ROBOTA_ERROR') {
    console.error('Robota SDK error:', error.message);
    
    // Fallback to different provider
    robotaAgent.selectOptimalModel('fallback mode');
    const fallbackScene = await director.request("Create a simple interface");
  }
}
```

## Performance Tips

1. **Enable Caching** - For repeated similar requests
2. **Use Team Mode** - For complex, multi-step tasks
3. **Smart Model Selection** - Let the agent choose optimal models
4. **Monitor Stats** - Track performance and optimize accordingly
5. **Custom Tools** - Extend capabilities with domain-specific tools

## Migration from Legacy

If upgrading from the legacy `RobotaWrapper`:

```typescript
// Old way (deprecated)
const oldAgent = new RobotaWrapper(robotaInstance);

// New way (recommended)
const newAgent = new RobotaAdvancedWrapper({
  name: 'Advanced Agent',
  aiProviders: providers,
  defaultModel: { provider: 'openai', model: 'gpt-4' }
});
```

## License

MIT