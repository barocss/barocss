# Integration Guide

This guide explains how to integrate the Robota SDK with BaroCSS Director.

## Installation

```bash
npm install @barocss/robota @barocss/ui
```

For actual Robota SDK integration (optional):
```bash
npm install @robota-sdk/agents @robota-sdk/openai @robota-sdk/anthropic @robota-sdk/team
```

## Basic Integration

### 1. Setup AI Providers

```typescript
import { AIProvider } from '@barocss/robota';

const providers: AIProvider[] = [
  {
    name: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    models: ['gpt-4', 'gpt-3.5-turbo']
  },
  {
    name: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    models: ['claude-3-sonnet-20240229']
  }
];
```

### 2. Create and Configure Agent

```typescript
import { RobotaAdvancedWrapper } from '@barocss/robota';

const robotaAgent = new RobotaAdvancedWrapper({
  name: 'My Robota Agent',
  aiProviders: providers,
  defaultModel: {
    provider: 'openai',
    model: 'gpt-4',
    systemMessage: 'You are a helpful UI/UX assistant.'
  },
  cacheEnabled: true,
  maxRetries: 3
});
```

### 3. Connect to Director

```typescript
import { Director } from '@barocss/ui';

const director = new Director();
await director.initialize();
director.setThirdPartyAgent(robotaAgent);
```

### 4. Use the System

```typescript
const scene = await director.request("Create a modern dashboard");
console.log('Generated scene:', scene);
```

## Advanced Configuration

### Multi-Provider Smart Selection

The agent automatically selects the best provider based on task type:

```typescript
const smartAgent = new RobotaAdvancedWrapper({
  name: 'Smart Agent',
  aiProviders: providers,
  defaultModel: { provider: 'openai', model: 'gpt-4' },
  cacheEnabled: true
});

// Creative task → Uses Anthropic Claude
await director.request("Design an artistic portfolio website");

// Complex analysis → Uses OpenAI GPT-4
await director.request("Analyze user behavior data and create insights dashboard");

// General task → Uses default model
await director.request("Create a contact form");
```

### Team Collaboration Mode

For complex projects requiring multiple agents:

```typescript
import { createTeamAgent } from '@barocss/robota';

const teamAgent = createTeamAgent(providers, {
  maxMembers: 6,
  maxTokenLimit: 150000,
  collaborationMode: 'sequential',
  debug: true
});

director.setThirdPartyAgent(teamAgent);

// Complex project handled by team
const result = await director.request(`
  Create a complete e-commerce platform with:
  - User authentication
  - Product catalog
  - Shopping cart
  - Payment processing
  - Admin dashboard
`);
```

### Custom Tools Integration

Add domain-specific tools to enhance agent capabilities:

```typescript
// Add a component generation tool
robotaAgent.addTool(
  'generateReactComponent',
  'Generate React component with TypeScript',
  {
    type: 'object',
    properties: {
      componentName: { type: 'string' },
      props: { type: 'array', items: { type: 'string' } }
    },
    required: ['componentName']
  },
  async (params) => {
    const { componentName, props = [] } = params;
    
    return {
      componentCode: `
export const ${componentName}: React.FC = () => {
  return <div className="${componentName.toLowerCase()}">{/* ${componentName} */}</div>;
};`,
      fileName: `${componentName}.tsx`
    };
  }
);
```

## Environment Configuration

### Development Environment

```typescript
const devConfig = {
  name: 'Development Agent',
  aiProviders: providers,
  defaultModel: {
    provider: 'openai',
    model: 'gpt-3.5-turbo', // Faster, cheaper for development
  },
  cacheEnabled: true,
  maxRetries: 2,
  teamConfig: {
    debug: true // Enable debug logging
  }
};
```

### Production Environment

```typescript
const prodConfig = {
  name: 'Production Agent',
  aiProviders: providers,
  defaultModel: {
    provider: 'openai',
    model: 'gpt-4', // Higher quality for production
  },
  cacheEnabled: true,
  maxRetries: 3,
  teamConfig: {
    debug: false,
    maxTokenLimit: 200000
  }
};
```

## Performance Optimization

### Caching Strategy

```typescript
const optimizedAgent = new RobotaAdvancedWrapper({
  // ... other config
  cacheEnabled: true
});

// Monitor cache performance
const stats = optimizedAgent.getStats();
console.log(`Cache hit rate: ${stats.cacheHitRate}%`);

// Clear cache when needed (e.g., daily)
setInterval(() => {
  optimizedAgent.clearCache();
}, 24 * 60 * 60 * 1000); // 24 hours
```

### Request Optimization

```typescript
// Use appropriate models for different tasks
const taskBasedConfig = {
  aiProviders: providers,
  defaultModel: {
    provider: 'openai',
    model: 'gpt-3.5-turbo' // Default to faster model
  }
  // Let smart selection choose GPT-4 when needed
};
```

## Error Handling

### Graceful Degradation

```typescript
async function createSceneWithFallback(request: string) {
  try {
    return await director.request(request);
  } catch (error) {
    console.warn('Primary agent failed, trying fallback:', error.message);
    
    // Switch to simpler agent
    const fallbackAgent = createBasicRobotaWrapper([
      { name: 'openai', apiKey: process.env.BACKUP_OPENAI_KEY }
    ]);
    
    director.setThirdPartyAgent(fallbackAgent);
    return await director.request(request);
  }
}
```

### Provider Failover

```typescript
const robustAgent = new RobotaAdvancedWrapper({
  name: 'Robust Agent',
  aiProviders: [
    { name: 'openai', apiKey: process.env.OPENAI_API_KEY },
    { name: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY },
    { name: 'openai-backup', apiKey: process.env.BACKUP_OPENAI_KEY }
  ],
  defaultModel: { provider: 'openai', model: 'gpt-4' },
  maxRetries: 3 // Automatic retry with different providers
});
```

## Monitoring and Analytics

### Usage Statistics

```typescript
// Get detailed statistics
const stats = robotaAgent.getStats();

console.log('Agent Performance:', {
  totalRequests: stats.totalRequests,
  averageResponseTime: stats.averageResponseTime,
  cacheHitRate: stats.cacheHitRate,
  activeAgents: stats.activeAgents
});

// Team-specific stats (if using team mode)
if (stats.teamStats) {
  console.log('Team Performance:', {
    totalAgentsCreated: stats.teamStats.totalAgentsCreated,
    collaborationSuccessRate: stats.teamStats.collaborationSuccessRate,
    preferredMode: stats.teamStats.preferredCollaborationMode
  });
}
```

### Health Monitoring

```typescript
// Regular health checks
setInterval(() => {
  if (!robotaAgent.isConnected()) {
    console.error('Agent disconnected, attempting reconnection...');
    robotaAgent.connect().catch(console.error);
  }
  
  const stats = robotaAgent.getStats();
  if (stats.errorRate && stats.errorRate > 0.1) {
    console.warn('High error rate detected:', stats.errorRate);
  }
}, 60000); // Check every minute
```

## Migration from Legacy

### From Simple RobotaWrapper

```typescript
// Old way (deprecated)
const oldAgent = new RobotaWrapper(robotaInstance);

// New way
const newAgent = new RobotaAdvancedWrapper({
  name: 'Migrated Agent',
  aiProviders: providers,
  defaultModel: { provider: 'openai', model: 'gpt-4' }
});
```

### Backward Compatibility

The new implementation maintains compatibility with the existing Director interface:

```typescript
// This still works the same way
director.setThirdPartyAgent(robotaAgent);
const scene = await director.request("Create something");
```

## Troubleshooting

### Common Issues

1. **Agent not responding**
   ```typescript
   if (!agent.isConnected()) {
     await agent.connect();
   }
   ```

2. **High latency**
   ```typescript
   // Enable caching
   const config = { ...existingConfig, cacheEnabled: true };
   
   // Use faster models for simple tasks
   const quickAgent = createBasicRobotaWrapper(providers);
   ```

3. **Token limits exceeded**
   ```typescript
   const limitedAgent = new RobotaAdvancedWrapper({
     // ... config
     teamConfig: {
       maxTokenLimit: 50000, // Reduce limit
       maxMembers: 3 // Use fewer agents
     }
   });
   ```

4. **Provider API errors**
   ```typescript
   // Add multiple providers for redundancy
   const resilientConfig = {
     aiProviders: [
       { name: 'openai', apiKey: key1 },
       { name: 'anthropic', apiKey: key2 },
       { name: 'openai-backup', apiKey: key3 }
     ],
     maxRetries: 3
   };
   ```
