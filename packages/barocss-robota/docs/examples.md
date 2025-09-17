# @barocss/robota Examples

This document contains practical examples for using the Robota SDK integration with BaroCSS Director.

## Basic Usage

### Simple Agent Setup

```typescript
import { Director } from '@barocss/ui';
import { createBasicRobotaWrapper } from '@barocss/robota';

const providers = [
  {
    name: 'openai',
    apiKey: 'your-openai-key',
    models: ['gpt-4', 'gpt-3.5-turbo']
  }
];

const robotaAgent = createBasicRobotaWrapper(providers);

const director = new Director();
await director.initialize();
director.setThirdPartyAgent(robotaAgent);

const scene = await director.request("Create a modern login form");
console.log('Generated scene:', scene.title);
```

### Advanced Multi-Provider Agent

```typescript
import { RobotaAdvancedWrapper } from '@barocss/robota';

const smartAgent = new RobotaAdvancedWrapper({
  name: 'Smart Multi-Provider Agent',
  aiProviders: [
    { name: 'openai', apiKey: 'your-openai-key' },
    { name: 'anthropic', apiKey: 'your-anthropic-key' }
  ],
  defaultModel: {
    provider: 'openai',
    model: 'gpt-4',
    systemMessage: 'You are an expert UI/UX designer and developer.'
  },
  cacheEnabled: true,
  maxRetries: 3
});

director.setThirdPartyAgent(smartAgent);

// Creative task (auto-selects Anthropic)
const creativeScene = await director.request(
  "Design an innovative landing page for a luxury fashion brand"
);

// Complex reasoning (auto-selects GPT-4)
const analysisScene = await director.request(
  "Analyze user behavior patterns and create a data dashboard"
);
```

## Team Collaboration

### Creating a Team Agent

```typescript
import { createTeamAgent } from '@barocss/robota';

const teamAgent = createTeamAgent(providers, {
  maxMembers: 6,
  maxTokenLimit: 150000,
  collaborationMode: 'sequential',
  debug: true
});

director.setThirdPartyAgent(teamAgent);

const complexProject = await director.request(`
  Create a complete e-commerce platform with:
  1. User Authentication & Registration
  2. Product Catalog with Search & Filtering
  3. Shopping Cart & Checkout Process
  4. Order Management & Tracking
  5. Admin Dashboard for Inventory
  6. Payment Integration Interface
`);
```

## Specialized Agents

### Research Agent

```typescript
import { createResearchAgent } from '@barocss/robota';

const researchAgent = createResearchAgent(providers);
director.setThirdPartyAgent(researchAgent);

const researchResult = await director.request(
  "Research the latest trends in web accessibility and create a comprehensive guide"
);
```

### Creative Agent

```typescript
import { createCreativeAgent } from '@barocss/robota';

const creativeAgent = createCreativeAgent(providers);
director.setThirdPartyAgent(creativeAgent);

const creativeResult = await director.request(
  "Design a futuristic dashboard for space mission control"
);
```

## Custom Tools Integration

```typescript
const agent = new RobotaAdvancedWrapper({
  name: 'Tool-Enhanced Agent',
  aiProviders: providers,
  defaultModel: { provider: 'openai', model: 'gpt-4' }
});

// Add custom component generator tool
agent.addTool(
  'generateReactComponent',
  'Generate React component code with TypeScript',
  {
    type: 'object',
    properties: {
      componentName: { type: 'string', description: 'Component name' },
      props: { type: 'array', items: { type: 'string' } },
      styling: { type: 'string', enum: ['css', 'styled-components', 'tailwind'] }
    },
    required: ['componentName']
  },
  async (params) => {
    const { componentName, props = [], styling = 'css' } = params;
    
    const component = `
export const ${componentName}: React.FC = () => {
  return (
    <div className="${componentName.toLowerCase()}">
      <h1>Hello from ${componentName}!</h1>
    </div>
  );
};`;
    
    return {
      componentCode: component,
      fileName: `${componentName}.tsx`,
      styling
    };
  }
);

const result = await director.request(
  "Create a user profile card component with avatar, name, and bio"
);
```

## Performance Optimization

### Caching and Statistics

```typescript
const optimizedAgent = new RobotaAdvancedWrapper({
  name: 'Optimized Agent',
  aiProviders: providers,
  defaultModel: { provider: 'openai', model: 'gpt-3.5-turbo' },
  cacheEnabled: true,
  maxRetries: 2
});

// First request (not cached)
console.time('First request');
await director.request("Create a todo list interface");
console.timeEnd('First request');

// Second request (cached)
console.time('Cached request');
await director.request("Create a todo list interface");
console.timeEnd('Cached request');

// Get performance statistics
const stats = optimizedAgent.getStats();
console.log('Performance stats:', {
  totalRequests: stats.totalRequests,
  averageResponseTime: stats.averageResponseTime,
  cacheHitRate: stats.cacheHitRate
});

// Clear cache when needed
optimizedAgent.clearCache();
```

## Dynamic Mode Switching

```typescript
const flexibleAgent = new RobotaAdvancedWrapper({
  name: 'Flexible Agent',
  aiProviders: providers,
  defaultModel: { provider: 'openai', model: 'gpt-4' }
});

// Start in single agent mode
const simpleResult = await director.request("Create a button component");

// Switch to team mode for complex task
await flexibleAgent.switchToTeamMode({
  maxMembers: 4,
  collaborationMode: 'parallel'
});

const complexResult = await director.request(
  "Design a complete social media platform architecture"
);

// Switch back to single mode
await flexibleAgent.switchToSingleMode();

const finalResult = await director.request("Create a footer component");
```

## Error Handling

```typescript
try {
  const scene = await director.request("Create a complex application");
} catch (error) {
  if (error.code === 'ROBOTA_ERROR') {
    console.error('Robota SDK error:', error.message);
    
    // Fallback to different provider or simpler model
    const fallbackAgent = createBasicRobotaWrapper([
      { name: 'openai', apiKey: 'backup-key' }
    ]);
    
    director.setThirdPartyAgent(fallbackAgent);
    const fallbackScene = await director.request("Create a simple interface");
  }
}
```

## E-commerce Platform Complete Example

```typescript
// Specialized e-commerce agent
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

director.setThirdPartyAgent(ecommerceAgent);

// Generate complete e-commerce scenes
const scenes = await Promise.all([
  director.request("Create a product catalog page"),
  director.request("Design a shopping cart interface"),
  director.request("Build a checkout flow"),
  director.request("Generate a user dashboard")
]);

console.log('E-commerce platform completed with', scenes.length, 'scenes');
```

## Best Practices

1. **Choose the Right Agent Type**
   - Use `createBasicRobotaWrapper` for simple tasks
   - Use `RobotaAdvancedWrapper` for complex multi-provider scenarios
   - Use `createTeamAgent` for large, complex projects

2. **Enable Caching for Repeated Tasks**
   ```typescript
   const agent = new RobotaAdvancedWrapper({
     // ... config
     cacheEnabled: true
   });
   ```

3. **Monitor Performance**
   ```typescript
   const stats = agent.getStats();
   console.log('Agent performance:', stats);
   ```

4. **Handle Errors Gracefully**
   ```typescript
   try {
     const result = await director.request(input);
   } catch (error) {
     // Implement fallback strategy
   }
   ```

5. **Clean Up Resources**
   ```typescript
   await agent.disconnect();
   ```
