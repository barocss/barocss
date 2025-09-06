# Svelte Integration

BaroCSS pairs beautifully with Svelte's reactive stores and simple syntax, enabling effortless AI-driven component generation with build-free styling. Perfect for lightweight, high-performance applications.

## Setup

### 1. Installation

```bash
npm install @barocss/kit
# or
yarn add @barocss/kit
# or
pnpm add @barocss/kit@latest
```

### 2. Initialize in App.svelte

```svelte
<!-- App.svelte -->
<script>
  import { onMount } from 'svelte';
  import { BrowserRuntime } from '@barocss/kit/runtime/browser';
  import AIComponentSystem from './AIComponentSystem.svelte';

  let runtime;

  onMount(() => {
    // Initialize BaroCSS
    runtime = new BrowserRuntime();
    runtime.init();

    return () => {
      runtime?.destroy();
    };
  });
</script>

<main class="min-h-screen bg-[#f8fafc]">
  <AIComponentSystem />
</main>

<style>
  /* Global styles if needed */
</style>
```

## Reactive AI Component System

### AI Store with Svelte Stores

```javascript
// stores/aiStore.js
import { writable, derived, get } from 'svelte/store';

// Component store
export const components = writable([]);
export const isGenerating = writable(false);
export const selectedTemplate = writable('card');

// Cache for AI responses
const cache = new Map();

// AI component generation
export const generateComponent = async (prompt, config = {}) => {
  isGenerating.set(true);
  
  try {
    const cacheKey = JSON.stringify({ prompt, config });
    
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      const newComponent = { ...cached, id: Date.now() };
      components.update(list => [...list, newComponent]);
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
    components.update(list => [...list, newComponent]);
    
    return newComponent;
  } finally {
    isGenerating.set(false);
  }
};

export const updateComponent = (id, updates) => {
  components.update(list => 
    list.map(comp => 
      comp.id === id 
        ? { ...comp, ...updates }
        : comp
    )
  );
};

export const removeComponent = (id) => {
  components.update(list => list.filter(comp => comp.id !== id));
};

// AI style updates
export const updateComponentStyle = async (id, instruction) => {
  const currentComponents = get(components);
  const component = currentComponents.find(c => c.id === id);
  
  if (!component) return;
  
  const updatedStyles = await processStyleInstruction(component.styles, instruction);
  updateComponent(id, { styles: updatedStyles });
};

// Simulate AI generation
async function simulateAIGeneration(prompt, config) {
  await new Promise(resolve => setTimeout(resolve, 600));
  
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
        title: 'Svelte AI Card',
        description: 'Generated with Svelte stores and BaroCSS real-time styling',
        buttonText: 'Click Me'
      }
    },
    'data widget': {
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
        title: 'Svelte Metrics',
        value: '1,248',
        trend: '+8.2%',
        period: 'vs last week',
        icon: '📈'
      }
    },
    'notification': {
      type: 'notification',
      styles: {
        container: `w-[${config.width || 350}px] min-h-[80px] bg-[#dbeafe] border-l-[4px] border-[#3b82f6] rounded-[8px] shadow-[0_10px_40px_rgba(0,0,0,0.15)] p-[16px] m-[8px] transition-all duration-[300ms] hover:scale-[1.02]`,
        title: 'text-[14px] font-[600] text-[#1e40af] mb-[4px]',
        content: 'text-[12px] text-[#1e40af] opacity-[0.8] leading-[1.4]',
        icon: 'absolute top-[12px] right-[12px] text-[16px] cursor-pointer opacity-[0.6] hover:opacity-[1]'
      },
      content: {
        title: 'AI Notification',
        description: 'This notification was generated by AI with Svelte',
        icon: '💡'
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
  
  return updates;
}
```

### Main AI Component System

```svelte
<!-- AIComponentSystem.svelte -->
<script>
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { components, isGenerating, selectedTemplate, generateComponent } from '../stores/aiStore.js';
  import AIComponent from './AIComponent.svelte';

  let customPrompt = '';

  const templates = {
    card: 'modern card',
    widget: 'data widget',
    notification: 'notification'
  };

  const handleGenerate = () => {
    const prompt = templates[$selectedTemplate];
    generateComponent(prompt, { width: 320, height: 200 });
  };

  const handleCustomGenerate = () => {
    if (customPrompt.trim()) {
      generateComponent(customPrompt.trim());
      customPrompt = '';
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleCustomGenerate();
    }
  };

  // Demo: Generate initial components
  onMount(() => {
    setTimeout(() => generateComponent('modern card'), 1000);
    setTimeout(() => generateComponent('data widget'), 1500);
  });
</script>

<div class="p-[20px]">
  <!-- AI Control Panel -->
  <div class="mb-[30px] bg-white rounded-[12px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-[24px]">
    <h1 class="text-[24px] font-[700] text-[#1e293b] mb-[20px]">
      Svelte + BaroCSS AI Generator
    </h1>
    
    <!-- Template Selection -->
    <div class="flex gap-[16px] mb-[20px]">
      {#each Object.entries(templates) as [key, label]}
        <label class="flex items-center gap-[8px] cursor-pointer">
          <input 
            bind:group={$selectedTemplate} 
            type="radio" 
            value={key}
            class="w-[16px] h-[16px] text-[#3b82f6]"
          />
          <span class="text-[14px] text-[#374151] capitalize">{key}</span>
        </label>
      {/each}
    </div>
    
    <!-- Generation Controls -->
    <div class="flex gap-[12px] mb-[16px]">
      <button
        on:click={handleGenerate}
        disabled={$isGenerating}
        class="px-[20px] py-[10px] bg-[#10b981] text-white rounded-[8px] cursor-pointer border-none hover:bg-[#059669] disabled:opacity-[0.5] disabled:cursor-not-allowed transition-all duration-[200ms]"
      >
        {$isGenerating ? 'Generating...' : 'Generate Template'}
      </button>
    </div>
    
    <!-- Custom Prompt -->
    <div class="flex gap-[8px]">
      <input
        bind:value={customPrompt}
        on:keypress={handleKeyPress}
        type="text"
        placeholder="Describe your component..."
        class="flex-1 px-[12px] py-[10px] border-[1px] border-[#d1d5db] rounded-[8px] text-[14px] focus:border-[#3b82f6] focus:ring-[2px] focus:ring-[rgba(59,130,246,0.2)] outline-none transition-all duration-[200ms]"
        disabled={$isGenerating}
      />
      <button
        on:click={handleCustomGenerate}
        disabled={$isGenerating || !customPrompt.trim()}
        class="px-[20px] py-[10px] bg-[#3b82f6] text-white rounded-[8px] cursor-pointer border-none hover:bg-[#2563eb] disabled:opacity-[0.5] disabled:cursor-not-allowed transition-all duration-[200ms]"
      >
        Generate
      </button>
    </div>
  </div>

  <!-- Generated Components Grid -->
  <div class="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-[20px]">
    {#each $components as component (component.id)}
      <div
        in:fly="{{ y: 20, duration: 300 }}"
        out:fade="{{ duration: 200 }}"
      >
        <AIComponent {component} />
      </div>
    {/each}
  </div>

  <!-- Empty State -->
  {#if $components.length === 0 && !$isGenerating}
    <div 
      class="text-center py-[60px]"
      in:fade="{{ duration: 300 }}"
    >
      <div class="text-[48px] mb-[16px]">⚡</div>
      <h3 class="text-[18px] font-[600] text-[#1e293b] mb-[8px]">
        Ready for AI Magic
      </h3>
      <p class="text-[14px] text-[#64748b]">
        Generate your first Svelte component with AI styling
      </p>
    </div>
  {/if}

  <!-- Loading Animation -->
  {#if $isGenerating}
    <div 
      class="fixed top-[20px] right-[20px] bg-[#3b82f6] text-white px-[16px] py-[8px] rounded-[8px] shadow-[0_10px_40px_rgba(0,0,0,0.15)] z-[1000]"
      in:fly="{{ x: 300, duration: 200 }}"
      out:fly="{{ x: 300, duration: 200 }}"
    >
      <div class="flex items-center gap-[8px]">
        <div class="w-[16px] h-[16px] border-[2px] border-white border-t-transparent rounded-full animate-spin"></div>
        <span class="text-[12px]">AI is thinking...</span>
      </div>
    </div>
  {/if}
</div>

<style>
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .animate-spin {
    animation: spin 1s linear infinite;
  }
</style>
```

### Individual AI Component

```svelte
<!-- AIComponent.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import { updateComponentStyle, removeComponent } from '../stores/aiStore.js';

  export let component;

  const dispatch = createEventDispatcher();
  
  let isEditing = false;
  let styleInstructions = '';

  const quickActions = [
    { label: 'Vibrant', instruction: 'make colors more vibrant', emoji: '🌈' },
    { label: 'Shadow', instruction: 'add dramatic shadow', emoji: '🌊' },
    { label: 'Larger', instruction: 'make it larger', emoji: '📏' },
    { label: 'Animate', instruction: 'add hover animations', emoji: '✨' }
  ];

  const handleQuickAction = (instruction) => {
    updateComponentStyle(component.id, instruction);
  };

  const handleCustomInstruction = () => {
    if (styleInstructions.trim()) {
      updateComponentStyle(component.id, styleInstructions.trim());
      styleInstructions = '';
    }
  };

  const handleRemove = () => {
    removeComponent(component.id);
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleCustomInstruction();
    }
  };
</script>

<div 
  class="relative group"
  on:mouseenter={() => isEditing = true}
  on:mouseleave={() => isEditing = false}
>
  <!-- Card Component -->
  {#if component.type === 'card'}
    <div class={component.styles.container}>
      <h3 class={component.styles.title}>
        {component.content.title}
      </h3>
      <p class={component.styles.content}>
        {component.content.description}
      </p>
      <button 
        class={component.styles.button}
        on:click={() => handleQuickAction('refresh colors')}
      >
        {component.content.buttonText}
      </button>
    </div>

  <!-- Widget Component -->
  {:else if component.type === 'widget'}
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

  <!-- Notification Component -->
  {:else if component.type === 'notification'}
    <div class={component.styles.container}>
      <div class="flex items-start gap-[12px]">
        <div class="text-[20px]">{component.content.icon}</div>
        <div class="flex-1">
          <h5 class={component.styles.title}>
            {component.content.title}
          </h5>
          <p class={component.styles.content}>
            {component.content.description}
          </p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Edit Controls Overlay -->
  {#if isEditing}
    <div 
      class="absolute top-[8px] right-[8px] bg-[rgba(0,0,0,0.9)] rounded-[8px] p-[12px] min-w-[200px] z-[100]"
      in:scale="{{ duration: 200 }}"
      out:scale="{{ duration: 150 }}"
    >
      <!-- Quick Actions -->
      <div class="grid grid-cols-2 gap-[6px] mb-[12px]">
        {#each quickActions as action}
          <button
            on:click={() => handleQuickAction(action.instruction)}
            class="px-[8px] py-[6px] bg-[#3b82f6] text-white text-[11px] rounded-[4px] cursor-pointer border-none hover:bg-[#2563eb] transition-all duration-[200ms] flex items-center gap-[4px]"
            title={action.instruction}
          >
            <span>{action.emoji}</span>
            <span>{action.label}</span>
          </button>
        {/each}
      </div>
      
      <!-- Custom Instruction -->
      <div class="flex gap-[4px] mb-[8px]">
        <input
          bind:value={styleInstructions}
          on:keypress={handleKeyPress}
          type="text"
          placeholder="Custom style instruction..."
          class="flex-1 px-[8px] py-[6px] text-[11px] border-[1px] border-[#d1d5db] rounded-[4px] bg-white"
        />
        <button
          on:click={handleCustomInstruction}
          disabled={!styleInstructions.trim()}
          class="px-[8px] py-[6px] bg-[#10b981] text-white text-[11px] rounded-[4px] cursor-pointer border-none hover:bg-[#059669] disabled:opacity-[0.5] disabled:cursor-not-allowed"
        >
          Apply
        </button>
      </div>
      
      <!-- Remove Button -->
      <button
        on:click={handleRemove}
        class="w-full px-[8px] py-[6px] bg-[#ef4444] text-white text-[11px] rounded-[4px] cursor-pointer border-none hover:bg-[#dc2626] transition-all duration-[200ms]"
      >
        🗑️ Remove Component
      </button>
    </div>
  {/if}
</div>
```

## Advanced Svelte Patterns

### Real-time Style Animation Store

```javascript
// stores/animationStore.js
import { writable, derived } from 'svelte/store';
import { tweened } from 'svelte/motion';
import { cubicOut } from 'svelte/easing';

// Animation configuration store
export const animationConfig = writable({
  duration: 300,
  easing: cubicOut,
  enabled: true
});

// Create animated styles
export const createAnimatedStyles = (initialStyles) => {
  const baseStyles = writable(initialStyles);
  
  // Tweened values for smooth animations
  const animatedWidth = tweened(320, { duration: 300, easing: cubicOut });
  const animatedHeight = tweened(200, { duration: 300, easing: cubicOut });
  const animatedOpacity = tweened(1, { duration: 200, easing: cubicOut });
  
  // Derived style string
  const computedStyles = derived(
    [baseStyles, animatedWidth, animatedHeight, animatedOpacity],
    ([$base, $width, $height, $opacity]) => {
      return {
        ....$base,
        container: $base.container
          .replace(/w-\[\d+px\]/, `w-[${Math.round($width)}px]`)
          .replace(/h-\[\d+px\]/, `h-[${Math.round($height)}px]`)
          .replace(/opacity-\[[\d.]+\]/, `opacity-[${$opacity}]`)
      };
    }
  );
  
  // Animation controls
  const animateResize = (width, height) => {
    animatedWidth.set(width);
    animatedHeight.set(height);
  };
  
  const animateFade = (opacity) => {
    animatedOpacity.set(opacity);
  };
  
  const updateBaseStyles = (newStyles) => {
    baseStyles.set(newStyles);
  };
  
  return {
    styles: computedStyles,
    animateResize,
    animateFade,
    updateBaseStyles
  };
};

// Global animation manager
export const animationManager = (() => {
  const activeAnimations = writable(new Map());
  
  const registerComponent = (id, animatedStyles) => {
    activeAnimations.update(map => map.set(id, animatedStyles));
  };
  
  const unregisterComponent = (id) => {
    activeAnimations.update(map => {
      map.delete(id);
      return map;
    });
  };
  
  const animateAll = (instruction) => {
    activeAnimations.update(map => {
      map.forEach((animatedStyles, id) => {
        // Apply animation based on instruction
        if (instruction.includes('grow')) {
          animatedStyles.animateResize(400, 250);
        } else if (instruction.includes('shrink')) {
          animatedStyles.animateResize(280, 180);
        } else if (instruction.includes('fade')) {
          animatedStyles.animateFade(0.5);
        } else if (instruction.includes('show')) {
          animatedStyles.animateFade(1);
        }
      });
      return map;
    });
  };
  
  return {
    activeAnimations,
    registerComponent,
    unregisterComponent,
    animateAll
  };
})();
```

### Performance-Optimized Virtual List

```svelte
<!-- VirtualAIList.svelte -->
<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import AIComponent from './AIComponent.svelte';

  export let components = [];
  export let itemHeight = 220;
  export let containerHeight = 600;

  let containerElement;
  let scrollTop = 0;

  // Calculate visible range
  $: visibleCount = Math.ceil(containerHeight / itemHeight) + 2;
  $: startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 1);
  $: endIndex = Math.min(components.length, startIndex + visibleCount);
  $: visibleComponents = components.slice(startIndex, endIndex);
  $: totalHeight = components.length * itemHeight;

  // Scroll handler
  const handleScroll = (e) => {
    scrollTop = e.target.scrollTop;
  };

  // Smooth scroll to component
  const scrollToComponent = (index) => {
    if (containerElement) {
      containerElement.scrollTo({
        top: index * itemHeight,
        behavior: 'smooth'
      });
    }
  };

  // Auto-scroll to new components
  let previousLength = 0;
  $: if (components.length > previousLength) {
    tick().then(() => {
      if (containerElement && components.length > 0) {
        scrollToComponent(components.length - 1);
      }
    });
    previousLength = components.length;
  }
</script>

<div class="flex flex-col h-full">
  <!-- Virtual List Header -->
  <div class="p-[16px] bg-white border-b-[1px] border-[#e2e8f0] flex items-center justify-between">
    <div>
      <h3 class="text-[16px] font-[600] text-[#1e293b]">
        AI Components ({components.length})
      </h3>
      <p class="text-[12px] text-[#64748b]">
        Showing {startIndex + 1}-{endIndex} of {components.length}
      </p>
    </div>
    
    {#if components.length > 10}
      <button
        on:click={() => scrollToComponent(0)}
        class="px-[12px] py-[6px] bg-[#f1f5f9] text-[#374151] text-[12px] rounded-[6px] cursor-pointer border-none hover:bg-[#e2e8f0]"
      >
        Back to Top
      </button>
    {/if}
  </div>

  <!-- Virtual Scrolling Container -->
  <div 
    bind:this={containerElement}
    class="flex-1 overflow-auto"
    style="height: {containerHeight}px;"
    on:scroll={handleScroll}
  >
    <div 
      class="relative"
      style="height: {totalHeight}px;"
    >
      <!-- Visible Items -->
      {#each visibleComponents as component, index (component.id)}
        <div
          class="absolute w-full px-[12px]"
          style="
            top: {(startIndex + index) * itemHeight}px;
            height: {itemHeight}px;
          "
        >
          <div class="h-full flex items-center">
            <AIComponent {component} />
          </div>
        </div>
      {/each}
      
      <!-- Loading Placeholder -->
      {#if visibleComponents.length === 0}
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="text-center">
            <div class="text-[32px] mb-[8px]">🔮</div>
            <p class="text-[14px] text-[#64748b]">No AI components yet</p>
          </div>
        </div>
      {/if}
    </div>
  </div>
  
  <!-- Scroll Indicator -->
  {#if components.length > visibleCount}
    <div class="h-[4px] bg-[#f1f5f9] relative">
      <div 
        class="h-full bg-[#3b82f6] transition-all duration-[100ms]"
        style="
          width: {(visibleCount / components.length) * 100}%;
          left: {(startIndex / components.length) * 100}%;
        "
      ></div>
    </div>
  {/if}
</div>
```

## Build-free Hot Reloading

```svelte
<!-- HotReloadDemo.svelte -->
<script>
  import { onMount } from 'svelte';
  import { components, generateComponent } from '../stores/aiStore.js';

  let isLiveMode = false;
  let updateInterval;

  // Live demo with automatic AI generation
  const startLiveDemo = () => {
    isLiveMode = true;
    
    const prompts = [
      'modern card with blue gradient',
      'data widget showing sales',
      'notification with success message',
      'dashboard card with metrics',
      'alert with warning colors'
    ];
    
    let promptIndex = 0;
    
    updateInterval = setInterval(() => {
      if (promptIndex < prompts.length) {
        generateComponent(prompts[promptIndex]);
        promptIndex++;
      } else {
        stopLiveDemo();
      }
    }, 2000);
  };

  const stopLiveDemo = () => {
    isLiveMode = false;
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  };

  onMount(() => {
    return () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
    };
  });
</script>

<div class="p-[20px]">
  <div class="mb-[20px] bg-[#f8fafc] rounded-[8px] p-[16px] border-[1px] border-[#e2e8f0]">
    <h3 class="text-[16px] font-[600] text-[#1e293b] mb-[8px]">
      🔥 Live AI Generation Demo
    </h3>
    <p class="text-[12px] text-[#64748b] mb-[12px]">
      Watch BaroCSS generate styles in real-time without any build process
    </p>
    
    <div class="flex gap-[8px]">
      <button
        on:click={startLiveDemo}
        disabled={isLiveMode}
        class="px-[12px] py-[6px] bg-[#10b981] text-white text-[12px] rounded-[6px] cursor-pointer border-none hover:bg-[#059669] disabled:opacity-[0.5] disabled:cursor-not-allowed"
      >
        {isLiveMode ? 'Demo Running...' : 'Start Live Demo'}
      </button>
      
      {#if isLiveMode}
        <button
          on:click={stopLiveDemo}
          class="px-[12px] py-[6px] bg-[#ef4444] text-white text-[12px] rounded-[6px] cursor-pointer border-none hover:bg-[#dc2626]"
        >
          Stop Demo
        </button>
      {/if}
    </div>
  </div>

  <!-- Real-time component count -->
  <div class="text-[14px] text-[#64748b] mb-[16px]">
    Active components: <span class="font-[600] text-[#1e293b]">{$components.length}</span>
    {#if isLiveMode}
      <span class="ml-[8px] text-[#10b981]">● Live</span>
    {/if}
  </div>
</div>
```

This Svelte integration showcases how BaroCSS enables seamless AI-driven development with Svelte's reactive stores, smooth animations, and build-free styling - perfect for creating dynamic, high-performance applications.
