# SolidJS Integration

BaroCSS integrates perfectly with SolidJS's fine-grained reactivity system, enabling efficient AI-driven component generation with build-free styling. The reactive primitives make real-time style updates incredibly smooth.

## Setup

### 1. Installation

```bash
npm install barocss
# or
yarn add barocss  
# or
pnpm add barocss@latest
```

### 2. Initialize in App.jsx

```jsx
import { onMount, onCleanup } from 'solid-js';
import { BrowserRuntime } from 'barocss/runtime/browser';
import AIComponentSystem from './AIComponentSystem';

function App() {
  let runtime;

  onMount(() => {
    // Initialize BaroCSS
    runtime = new BrowserRuntime();
    runtime.init();
  });

  onCleanup(() => {
    runtime?.destroy();
  });

  return (
    <main class="min-h-screen bg-[#f8fafc]">
      <AIComponentSystem />
    </main>
  );
}

export default App;
```

## Reactive AI Component System

### Signal-based AI Store

```jsx
// stores/aiStore.js
import { createSignal, createMemo, createEffect } from 'solid-js';
import { createStore, produce } from 'solid-js/store';

// Component store
const [components, setComponents] = createStore([]);
const [isGenerating, setIsGenerating] = createSignal(false);
const [selectedTemplate, setSelectedTemplate] = createSignal('card');

// Cache for AI responses
const cache = new Map();

// AI component generation
export const generateComponent = async (prompt, config = {}) => {
  setIsGenerating(true);
  
  try {
    const cacheKey = JSON.stringify({ prompt, config });
    
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      const newComponent = { ...cached, id: Date.now() };
      setComponents(prev => [...prev, newComponent]);
      return newComponent;
    }

    // Simulate AI generation
    const aiResponse = await simulateAIGeneration(prompt, config);
    
    const newComponent = {
      id: Date.now(),
      type: aiResponse.type,
      styles: aiResponse.styles,
      content: aiResponse.content,
      props: aiResponse.props || {}
    };
    
    cache.set(cacheKey, newComponent);
    setComponents(prev => [...prev, newComponent]);
    
    return newComponent;
  } finally {
    setIsGenerating(false);
  }
};

export const updateComponent = (id, updates) => {
  setComponents(
    produce(components => {
      const index = components.findIndex(comp => comp.id === id);
      if (index !== -1) {
        Object.assign(components[index], updates);
      }
    })
  );
};

export const removeComponent = (id) => {
  setComponents(prev => prev.filter(comp => comp.id !== id));
};

// Reactive component count
export const componentCount = createMemo(() => components.length);

// Reactive style updates with fine-grained reactivity
export const updateComponentStyle = async (id, instruction) => {
  const component = components.find(c => c.id === id);
  if (!component) return;
  
  const updatedStyles = await processStyleInstruction(component.styles, instruction);
  
  setComponents(
    produce(components => {
      const index = components.findIndex(c => c.id === id);
      if (index !== -1) {
        components[index].styles = updatedStyles;
      }
    })
  );
};

// Simulate AI generation
async function simulateAIGeneration(prompt, config) {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const templates = {
    'modern card': {
      type: 'card',
      styles: {
        container: `w-[${config.width || 320}px] h-[${config.height || 200}px] bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-[16px] shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-[24px] m-[12px] transition-all duration-[300ms] hover:scale-[1.02] cursor-pointer`,
        title: 'text-[24px] font-[600] text-white mb-[12px] leading-[1.2]',
        content: 'text-[16px] text-[rgba(255,255,255,0.9)] leading-[1.5] mb-[16px]',
        button: 'px-[20px] py-[8px] bg-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.3)] text-white rounded-[8px] transition-all duration-[200ms] cursor-pointer border-none font-[500]'
      },
      content: {
        title: 'SolidJS AI Card',
        description: 'Generated with SolidJS signals and BaroCSS real-time styling',
        buttonText: 'Interact'
      }
    },
    'reactive widget': {
      type: 'widget',
      styles: {
        container: `w-[${config.width || 280}px] h-[${config.height || 160}px] bg-white rounded-[12px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] border-[1px] border-[#e2e8f0] p-[20px] hover:shadow-[0_8px_40px_rgba(0,0,0,0.12)] transition-all duration-[300ms] hover:scale-[1.02]`,
        header: 'flex items-center justify-between mb-[16px]',
        title: 'text-[14px] font-[500] text-[#64748b] uppercase tracking-[0.5px]',
        value: 'text-[28px] font-[700] text-[#1e293b] mb-[8px]',
        trend: 'text-[12px] font-[500] text-[#10b981] flex items-center',
        icon: 'w-[32px] h-[32px] rounded-[8px] bg-[#3b82f6] bg-opacity-[0.1] flex items-center justify-center text-[16px]'
      },
      content: {
        title: 'Solid Metrics',
        value: '3,142',
        trend: '+22.1%',
        period: 'vs last month',
        icon: '⚡'
      }
    },
    'data chart': {
      type: 'chart',
      styles: {
        container: `w-[${config.width || 400}px] h-[${config.height || 250}px] bg-white rounded-[12px] shadow-[0_6px_30px_rgba(0,0,0,0.1)] border-[1px] border-[#e2e8f0] p-[20px]`,
        title: 'text-[16px] font-[600] text-[#1e293b] mb-[16px]',
        chart: 'flex items-end justify-between h-[150px] w-full',
        bar: 'bg-gradient-to-t from-[#3b82f6] to-[#8b5cf6] rounded-t-[4px] transition-all duration-[500ms] hover:scale-y-[1.1] cursor-pointer'
      },
      content: {
        title: 'Real-time Data',
        data: [65, 78, 45, 88, 92, 67, 83, 71, 59, 94]
      }
    }
  };
  
  const matched = Object.keys(templates).find(key => 
    prompt.toLowerCase().includes(key)
  );
  
  return templates[matched] || templates['modern card'];
}

async function processStyleInstruction(currentStyles, instruction) {
  const updates = { ...currentStyles };
  
  if (instruction.includes('vibrant')) {
    updates.container = updates.container.replace(
      'from-[#667eea] to-[#764ba2]',
      'from-[#ff6b6b] to-[#4ecdc4]'
    );
  }
  
  if (instruction.includes('shadow')) {
    updates.container = updates.container.replace(
      /shadow-\[0_\d+px_\d+px_rgba\(0,0,0,[\d.]+\)\]/,
      'shadow-[0_20px_60px_rgba(0,0,0,0.4)]'
    );
  }
  
  if (instruction.includes('larger')) {
    updates.container = updates.container.replace(
      /w-\[\d+px\]/,
      'w-[400px]'
    );
  }
  
  if (instruction.includes('animate')) {
    updates.container = updates.container.replace(
      'hover:scale-[1.02]',
      'hover:scale-[1.05] hover:rotate-[1deg]'
    );
  }
  
  return updates;
}

// Export signals and functions
export { 
  components, 
  isGenerating, 
  selectedTemplate, 
  setSelectedTemplate,
  componentCount
};
```

### Main AI Component System

```jsx
// AIComponentSystem.jsx
import { createSignal, For, Show, onMount } from 'solid-js';
import { 
  components, 
  isGenerating, 
  selectedTemplate, 
  setSelectedTemplate,
  generateComponent,
  componentCount 
} from './stores/aiStore';
import AIComponent from './AIComponent';

function AIComponentSystem() {
  const [customPrompt, setCustomPrompt] = createSignal('');

  const templates = {
    card: 'modern card',
    widget: 'reactive widget',
    chart: 'data chart'
  };

  const handleGenerate = () => {
    const prompt = templates[selectedTemplate()];
    generateComponent(prompt, { width: 320, height: 200 });
  };

  const handleCustomGenerate = () => {
    const prompt = customPrompt().trim();
    if (prompt) {
      generateComponent(prompt);
      setCustomPrompt('');
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleCustomGenerate();
    }
  };

  // Demo: Generate initial components
  onMount(() => {
    setTimeout(() => generateComponent('modern card'), 800);
    setTimeout(() => generateComponent('reactive widget'), 1200);
  });

  return (
    <div class="p-[20px]">
      {/* AI Control Panel */}
      <div class="mb-[30px] bg-white rounded-[12px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-[24px]">
        <h1 class="text-[24px] font-[700] text-[#1e293b] mb-[20px]">
          SolidJS + BaroCSS AI Generator
        </h1>
        
        {/* Real-time component count */}
        <div class="mb-[16px] text-[14px] text-[#64748b]">
          Active components: <span class="font-[600] text-[#1e293b]">{componentCount()}</span>
        </div>
        
        {/* Template Selection */}
        <div class="flex gap-[16px] mb-[20px]">
          <For each={Object.entries(templates)}>
            {([key, label]) => (
              <label class="flex items-center gap-[8px] cursor-pointer">
                <input 
                  type="radio" 
                  name="template"
                  value={key}
                  checked={selectedTemplate() === key}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  class="w-[16px] h-[16px] text-[#3b82f6]"
                />
                <span class="text-[14px] text-[#374151] capitalize">{key}</span>
              </label>
            )}
          </For>
        </div>
        
        {/* Generation Controls */}
        <div class="flex gap-[12px] mb-[16px]">
          <button
            onClick={handleGenerate}
            disabled={isGenerating()}
            class="px-[20px] py-[10px] bg-[#10b981] text-white rounded-[8px] cursor-pointer border-none hover:bg-[#059669] disabled:opacity-[0.5] disabled:cursor-not-allowed transition-all duration-[200ms]"
          >
            {isGenerating() ? 'Generating...' : 'Generate Template'}
          </button>
        </div>
        
        {/* Custom Prompt */}
        <div class="flex gap-[8px]">
          <input
            type="text"
            value={customPrompt()}
            onInput={(e) => setCustomPrompt(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Describe your component..."
            class="flex-1 px-[12px] py-[10px] border-[1px] border-[#d1d5db] rounded-[8px] text-[14px] focus:border-[#3b82f6] focus:ring-[2px] focus:ring-[rgba(59,130,246,0.2)] outline-none transition-all duration-[200ms]"
            disabled={isGenerating()}
          />
          <button
            onClick={handleCustomGenerate}
            disabled={isGenerating() || !customPrompt().trim()}
            class="px-[20px] py-[10px] bg-[#3b82f6] text-white rounded-[8px] cursor-pointer border-none hover:bg-[#2563eb] disabled:opacity-[0.5] disabled:cursor-not-allowed transition-all duration-[200ms]"
          >
            Generate
          </button>
        </div>
      </div>

      {/* Generated Components Grid */}
      <div class="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-[20px]">
        <For each={components}>
          {(component) => (
            <AIComponent component={component} />
          )}
        </For>
      </div>

      {/* Empty State */}
      <Show when={components.length === 0 && !isGenerating()}>
        <div class="text-center py-[60px]">
          <div class="text-[48px] mb-[16px]">⚡</div>
          <h3 class="text-[18px] font-[600] text-[#1e293b] mb-[8px]">
            Ready for AI Magic
          </h3>
          <p class="text-[14px] text-[#64748b]">
            Generate your first SolidJS component with AI styling
          </p>
        </div>
      </Show>

      {/* Loading Indicator */}
      <Show when={isGenerating()}>
        <div class="fixed top-[20px] right-[20px] bg-[#3b82f6] text-white px-[16px] py-[8px] rounded-[8px] shadow-[0_10px_40px_rgba(0,0,0,0.15)] z-[1000]">
          <div class="flex items-center gap-[8px]">
            <div class="w-[16px] h-[16px] border-[2px] border-white border-t-transparent rounded-full animate-spin"></div>
            <span class="text-[12px]">AI is thinking...</span>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default AIComponentSystem;
```

### Reactive AI Component

```jsx
// AIComponent.jsx
import { createSignal, createMemo, Show } from 'solid-js';
import { updateComponentStyle, removeComponent } from './stores/aiStore';

function AIComponent(props) {
  const [isEditing, setIsEditing] = createSignal(false);
  const [styleInstructions, setStyleInstructions] = createSignal('');

  const quickActions = [
    { label: 'Vibrant', instruction: 'make colors more vibrant', emoji: '🌈' },
    { label: 'Shadow', instruction: 'add dramatic shadow', emoji: '🌊' },
    { label: 'Larger', instruction: 'make it larger', emoji: '📏' },
    { label: 'Animate', instruction: 'add hover animations', emoji: '✨' }
  ];

  const handleQuickAction = (instruction) => {
    updateComponentStyle(props.component.id, instruction);
  };

  const handleCustomInstruction = () => {
    const instruction = styleInstructions().trim();
    if (instruction) {
      updateComponentStyle(props.component.id, instruction);
      setStyleInstructions('');
    }
  };

  const handleRemove = () => {
    removeComponent(props.component.id);
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleCustomInstruction();
    }
  };

  // Memoized component based on type
  const componentContent = createMemo(() => {
    const { component } = props;
    
    switch (component.type) {
      case 'card':
        return (
          <div class={component.styles.container}>
            <h3 class={component.styles.title}>
              {component.content.title}
            </h3>
            <p class={component.styles.content}>
              {component.content.description}
            </p>
            <button 
              class={component.styles.button}
              onClick={() => handleQuickAction('refresh colors')}
            >
              {component.content.buttonText}
            </button>
          </div>
        );
        
      case 'widget':
        return (
          <div class={component.styles.container}>
            <div class={component.styles.header}>
              <h4 class={component.styles.title}>
                {component.content.title}
              </h4>
              <div class={component.styles.icon}>
                {component.content.icon}
              </div>
            </div>
            <div class={component.styles.value}>
              {component.content.value}
            </div>
            <div class={component.styles.trend}>
              <span class="mr-[4px]">↗</span>
              {component.content.trend} {component.content.period}
            </div>
          </div>
        );
        
      case 'chart':
        return (
          <div class={component.styles.container}>
            <h4 class={component.styles.title}>
              {component.content.title}
            </h4>
            <div class={component.styles.chart}>
              <For each={component.content.data}>
                {(value, index) => {
                  const height = (value / 100) * 150;
                  const width = (400 - 80) / component.content.data.length - 4;
                  
                  return (
                    <div
                      class={component.styles.bar}
                      style={`
                        width: ${width}px;
                        height: ${height}px;
                      `}
                      title={`Value: ${value}`}
                    />
                  );
                }}
              </For>
            </div>
          </div>
        );
        
      default:
        return <div>Unknown component type</div>;
    }
  });

  return (
    <div 
      class="relative group"
      onMouseEnter={() => setIsEditing(true)}
      onMouseLeave={() => setIsEditing(false)}
    >
      {componentContent()}

      {/* Edit Controls Overlay */}
      <Show when={isEditing()}>
        <div class="absolute top-[8px] right-[8px] bg-[rgba(0,0,0,0.9)] rounded-[8px] p-[12px] min-w-[200px] z-[100]">
          {/* Quick Actions */}
          <div class="grid grid-cols-2 gap-[6px] mb-[12px]">
            <For each={quickActions}>
              {(action) => (
                <button
                  onClick={() => handleQuickAction(action.instruction)}
                  class="px-[8px] py-[6px] bg-[#3b82f6] text-white text-[11px] rounded-[4px] cursor-pointer border-none hover:bg-[#2563eb] transition-all duration-[200ms] flex items-center gap-[4px]"
                  title={action.instruction}
                >
                  <span>{action.emoji}</span>
                  <span>{action.label}</span>
                </button>
              )}
            </For>
          </div>
          
          {/* Custom Instruction */}
          <div class="flex gap-[4px] mb-[8px]">
            <input
              type="text"
              value={styleInstructions()}
              onInput={(e) => setStyleInstructions(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Custom style instruction..."
              class="flex-1 px-[8px] py-[6px] text-[11px] border-[1px] border-[#d1d5db] rounded-[4px] bg-white"
            />
            <button
              onClick={handleCustomInstruction}
              disabled={!styleInstructions().trim()}
              class="px-[8px] py-[6px] bg-[#10b981] text-white text-[11px] rounded-[4px] cursor-pointer border-none hover:bg-[#059669] disabled:opacity-[0.5] disabled:cursor-not-allowed"
            >
              Apply
            </button>
          </div>
          
          {/* Remove Button */}
          <button
            onClick={handleRemove}
            class="w-full px-[8px] py-[6px] bg-[#ef4444] text-white text-[11px] rounded-[4px] cursor-pointer border-none hover:bg-[#dc2626] transition-all duration-[200ms]"
          >
            🗑️ Remove Component
          </button>
        </div>
      </Show>
    </div>
  );
}

export default AIComponent;
```

## Advanced SolidJS Patterns

### Reactive Performance Monitor

```jsx
// hooks/usePerformanceMonitor.js
import { createSignal, createEffect, createMemo } from 'solid-js';

export function usePerformanceMonitor() {
  const [renderCount, setRenderCount] = createSignal(0);
  const [lastRenderTime, setLastRenderTime] = createSignal(0);
  const [averageRenderTime, setAverageRenderTime] = createSignal(0);
  
  const performanceData = createMemo(() => ({
    renders: renderCount(),
    lastRender: lastRenderTime(),
    avgRender: averageRenderTime()
  }));

  const measureRender = () => {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      setRenderCount(prev => prev + 1);
      setLastRenderTime(renderTime);
      
      // Calculate moving average
      setAverageRenderTime(prev => {
        const count = renderCount();
        return (prev * (count - 1) + renderTime) / count;
      });
    };
  };

  return {
    performanceData,
    measureRender
  };
}

// Performance Monitor Component
function PerformanceMonitor() {
  const { performanceData, measureRender } = usePerformanceMonitor();

  createEffect(() => {
    const cleanup = measureRender();
    return cleanup;
  });

  return (
    <div class="fixed bottom-[20px] left-[20px] bg-[rgba(0,0,0,0.8)] text-white p-[12px] rounded-[8px] text-[11px] font-mono z-[1000]">
      <div>Renders: {performanceData().renders}</div>
      <div>Last: {performanceData().lastRender.toFixed(2)}ms</div>
      <div>Avg: {performanceData().avgRender.toFixed(2)}ms</div>
    </div>
  );
}

export default PerformanceMonitor;
```

### Real-time Style Animation with Signals

```jsx
// hooks/useAnimatedStyles.js
import { createSignal, createEffect, onCleanup } from 'solid-js';

export function useAnimatedStyles(initialStyles) {
  const [styles, setStyles] = createSignal(initialStyles);
  const [isAnimating, setIsAnimating] = createSignal(false);

  const animateProperty = (property, targetValue, duration = 300) => {
    setIsAnimating(true);
    
    const currentStyles = styles();
    const currentValue = extractValueFromStyle(currentStyles, property);
    const startValue = parseFloat(currentValue) || 0;
    const endValue = parseFloat(targetValue);
    
    const startTime = performance.now();
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const eased = 1 - Math.pow(1 - progress, 3);
      const interpolated = startValue + (endValue - startValue) * eased;
      
      setStyles(prev => ({
        ...prev,
        [property]: updateStyleProperty(prev[property], property, interpolated)
      }));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };
    
    requestAnimationFrame(animate);
  };

  const morphStyles = (targetStyles, duration = 500) => {
    setIsAnimating(true);
    
    const startStyles = styles();
    const startTime = performance.now();
    
    const morph = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      
      const interpolatedStyles = {};
      
      Object.keys(targetStyles).forEach(key => {
        if (startStyles[key] && targetStyles[key]) {
          interpolatedStyles[key] = interpolateStyleString(
            startStyles[key], 
            targetStyles[key], 
            eased
          );
        } else {
          interpolatedStyles[key] = targetStyles[key];
        }
      });
      
      setStyles(prev => ({ ...prev, ...interpolatedStyles }));
      
      if (progress < 1) {
        requestAnimationFrame(morph);
      } else {
        setIsAnimating(false);
      }
    };
    
    requestAnimationFrame(morph);
  };

  return {
    styles,
    setStyles,
    isAnimating,
    animateProperty,
    morphStyles
  };
}

function extractValueFromStyle(styles, property) {
  const styleValue = styles[property] || styles.container || '';
  const regex = new RegExp(`${property}-\\[(\\d+)px\\]`);
  const match = styleValue.match(regex);
  return match ? match[1] : '0';
}

function updateStyleProperty(styleString, property, value) {
  const regex = new RegExp(`${property}-\\[\\d+px\\]`);
  return styleString.replace(regex, `${property}-[${Math.round(value)}px]`);
}

function interpolateStyleString(start, end, progress) {
  // Simple interpolation for numeric values in arbitrary classes
  return start.replace(/(\w+)-\[(\d+)px\]/g, (match, prop, value) => {
    const startVal = parseFloat(value);
    const endMatch = end.match(new RegExp(`${prop}-\\[(\\d+)px\\]`));
    
    if (endMatch) {
      const endVal = parseFloat(endMatch[1]);
      const interpolated = startVal + (endVal - startVal) * progress;
      return `${prop}-[${Math.round(interpolated)}px]`;
    }
    
    return match;
  });
}
```

### Reactive Style Pipeline

```jsx
// StylePipeline.jsx
import { createSignal, createMemo, For } from 'solid-js';
import { createStore } from 'solid-js/store';

function StylePipeline() {
  const [pipeline, setPipeline] = createStore([]);
  const [isProcessing, setIsProcessing] = createSignal(false);

  const addToPipeline = (instruction, targetId) => {
    setPipeline(prev => [...prev, {
      id: Date.now(),
      instruction,
      targetId,
      status: 'pending',
      timestamp: new Date().toISOString()
    }]);
  };

  const processPipeline = async () => {
    setIsProcessing(true);
    
    const pendingItems = pipeline.filter(item => item.status === 'pending');
    
    for (const item of pendingItems) {
      setPipeline(
        item => item.id === item.id,
        { status: 'processing' }
      );
      
      await processStyleInstruction(item.instruction, item.targetId);
      
      setPipeline(
        item => item.id === item.id,
        { status: 'completed' }
      );
    }
    
    setIsProcessing(false);
  };

  const clearCompleted = () => {
    setPipeline(prev => prev.filter(item => item.status !== 'completed'));
  };

  const pendingCount = createMemo(() => 
    pipeline.filter(item => item.status === 'pending').length
  );

  return (
    <div class="mb-[20px] bg-white rounded-[8px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-[16px]">
      <div class="flex items-center justify-between mb-[12px]">
        <h3 class="text-[16px] font-[600] text-[#1e293b]">
          Style Pipeline ({pendingCount()} pending)
        </h3>
        
        <div class="flex gap-[8px]">
          <button
            onClick={processPipeline}
            disabled={isProcessing() || pendingCount() === 0}
            class="px-[12px] py-[6px] bg-[#3b82f6] text-white text-[12px] rounded-[6px] cursor-pointer border-none hover:bg-[#2563eb] disabled:opacity-[0.5] disabled:cursor-not-allowed"
          >
            {isProcessing() ? 'Processing...' : 'Process All'}
          </button>
          
          <button
            onClick={clearCompleted}
            class="px-[12px] py-[6px] bg-[#6b7280] text-white text-[12px] rounded-[6px] cursor-pointer border-none hover:bg-[#4b5563]"
          >
            Clear Completed
          </button>
        </div>
      </div>

      <div class="max-h-[200px] overflow-y-auto">
        <For each={pipeline}>
          {(item) => (
            <div class="flex items-center justify-between py-[6px] px-[8px] border-b-[1px] border-[#f1f5f9] last:border-b-0">
              <div class="flex-1">
                <span class="text-[12px] text-[#374151]">{item.instruction}</span>
                <div class="text-[10px] text-[#9ca3af]">
                  Target: {item.targetId} • {new Date(item.timestamp).toLocaleTimeString()}
                </div>
              </div>
              
              <div class={`px-[8px] py-[2px] text-[10px] rounded-[4px] ${
                item.status === 'pending' 
                  ? 'bg-[#fef3c7] text-[#92400e]'
                  : item.status === 'processing'
                  ? 'bg-[#dbeafe] text-[#1e40af]'
                  : 'bg-[#d1fae5] text-[#047857]'
              }`}>
                {item.status}
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

async function processStyleInstruction(instruction, targetId) {
  // Simulate AI processing time
  await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
  
  // Update the target component's styles
  updateComponentStyle(targetId, instruction);
}

export default StylePipeline;
```

This SolidJS integration demonstrates how BaroCSS leverages SolidJS's fine-grained reactivity for efficient AI-driven component generation, with advanced features like animated style transitions, performance monitoring, and reactive style pipelines - all without any build process.
