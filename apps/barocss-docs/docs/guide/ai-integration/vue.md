# Vue Integration

BaroCSS integrates seamlessly with Vue 3, enabling reactive AI-driven component generation with build-free styling. Perfect for dynamic applications where styles need to update in real-time based on AI responses.

## Setup

### 1. Installation

```bash
npm install @barocss/kit
# or
yarn add @barocss/kit
# or
pnpm add @barocss/kit@latest
```

### 2. Vue Integration Setup

```javascript
// plugins/barocss.js
import { BrowserRuntime } from '@barocss/kit/runtime/browser';

export function setupBaroCSS(options) {
  const runtime = new BrowserRuntime(options);
  
  return runtime;
}
```

```javascript
// main.js
import { createApp } from 'vue';
import App from './App.vue';
import { setupBaroCSS } from './plugins/barocss.js';

const app = createApp(App);

// Initialize BaroCSS
const barocssRuntime = setupBaroCSS({
  config: {
    theme: {
      extend: {
        colors: {
          'brand-primary': '#3b82f6',
          'brand-secondary': '#64748b'
        }
      }
    }
  }
});

app.config.globalProperties.$barocss = barocssRuntime;

app.mixin({
  mounted() {
    if (!window.__barocss_initialized) {
      barocssRuntime.observe(document.body, { scan: true });
      window.__barocss_initialized = true;
    }
  }
});

app.mount('#app');
```

## Reactive AI Component System

### AI Component Generator Composable

```vue
<script setup>
import { ref, reactive, computed, nextTick } from 'vue';

// Composable for AI component generation
function useAIComponentGenerator() {
  const components = ref([]);
  const isGenerating = ref(false);
  const cache = reactive(new Map());

  // Simulate AI component generation
  const generateComponent = async (prompt, config = {}) => {
    isGenerating.value = true;
    
    try {
      const cacheKey = JSON.stringify({ prompt, config });
      
      if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        components.value.push({ ...cached, id: Date.now() });
        return;
      }

      // Simulate AI API call
      const aiResponse = await simulateAIGeneration(prompt, config);
      
      const newComponent = {
        id: Date.now(),
        type: aiResponse.type,
        styles: reactive(aiResponse.styles),
        content: reactive(aiResponse.content),
        props: reactive(aiResponse.props || {})
      };
      
      cache.set(cacheKey, newComponent);
      components.value.push(newComponent);
      
    } finally {
      isGenerating.value = false;
    }
  };

  const updateComponent = (id, updates) => {
    const component = components.value.find(c => c.id === id);
    if (component) {
      Object.assign(component, updates);
    }
  };

  const removeComponent = (id) => {
    const index = components.value.findIndex(c => c.id === id);
    if (index > -1) {
      components.value.splice(index, 1);
    }
  };

  return {
    components,
    isGenerating,
    generateComponent,
    updateComponent,
    removeComponent
  };
}

// AI simulation function
async function simulateAIGeneration(prompt, config) {
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const templates = {
    'modern card': {
      type: 'card',
      styles: {
        container: `w-[${config.width || 320}px] h-[${config.height || 200}px] bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-[16px] shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-[24px] m-[12px] transition-all duration-[300ms] hover:scale-[1.02]`,
        title: 'text-[24px] font-[600] text-white mb-[12px] leading-[1.2]',
        content: 'text-[16px] text-[rgba(255,255,255,0.9)] leading-[1.5] mb-[16px]',
        button: 'px-[20px] py-[8px] bg-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.3)] text-white rounded-[8px] transition-all duration-[200ms] cursor-pointer border-none'
      },
      content: {
        title: 'Vue AI Card',
        description: 'Generated with Vue 3 reactivity and BaroCSS',
        buttonText: 'Interact'
      }
    },
    'dashboard widget': {
      type: 'widget',
      styles: {
        container: `w-[${config.width || 280}px] h-[${config.height || 160}px] bg-white rounded-[12px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] border-[1px] border-[#e2e8f0] p-[20px] hover:shadow-[0_8px_40px_rgba(0,0,0,0.12)] transition-all duration-[300ms]`,
        header: 'flex items-center justify-between mb-[16px]',
        title: 'text-[14px] font-[500] text-[#64748b] uppercase tracking-[0.5px]',
        value: 'text-[28px] font-[700] text-[#1e293b] mb-[8px]',
        trend: 'text-[12px] font-[500] text-[#10b981] flex items-center'
      },
      content: {
        title: 'Vue Metrics',
        value: '2,847',
        trend: '+15.3%',
        period: 'vs last month'
      }
    }
  };
  
  const matched = Object.keys(templates).find(key => 
    prompt.toLowerCase().includes(key)
  );
  
  return templates[matched] || templates['modern card'];
}

// Main component logic
const { components, isGenerating, generateComponent, updateComponent, removeComponent } = useAIComponentGenerator();

const selectedTemplate = ref('card');
const customPrompt = ref('');

const templates = {
  card: 'modern card',
  widget: 'dashboard widget'
};

const handleGenerate = () => {
  const prompt = templates[selectedTemplate.value];
  generateComponent(prompt, { width: 320, height: 200 });
};

const handleCustomGenerate = () => {
  if (customPrompt.value.trim()) {
    generateComponent(customPrompt.value.trim());
    customPrompt.value = '';
  }
};
</script>

<template>
  <div class="min-h-screen bg-[#f8fafc] p-[20px]">
    <!-- AI Control Panel -->
    <div class="mb-[30px] bg-white rounded-[12px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-[24px]">
      <h1 class="text-[24px] font-[700] text-[#1e293b] mb-[20px]">
        Vue + BaroCSS AI Generator
      </h1>
      
      <div class="flex gap-[16px] mb-[20px]">
        <label class="flex items-center gap-[8px] cursor-pointer">
          <input 
            v-model="selectedTemplate" 
            type="radio" 
            value="card"
            class="w-[16px] h-[16px] text-[#3b82f6]"
          >
          <span class="text-[14px] text-[#374151]">Modern Card</span>
        </label>
        
        <label class="flex items-center gap-[8px] cursor-pointer">
          <input 
            v-model="selectedTemplate" 
            type="radio" 
            value="widget"
            class="w-[16px] h-[16px] text-[#3b82f6]"
          >
          <span class="text-[14px] text-[#374151]">Dashboard Widget</span>
        </label>
      </div>
      
      <div class="flex gap-[12px] mb-[16px]">
        <button
          @click="handleGenerate"
          :disabled="isGenerating"
          class="px-[20px] py-[10px] bg-[#10b981] text-white rounded-[8px] cursor-pointer border-none hover:bg-[#059669] disabled:opacity-[0.5] disabled:cursor-not-allowed transition-all duration-[200ms]"
        >
          {{ isGenerating ? 'Generating...' : 'Generate Template' }}
        </button>
      </div>
      
      <div class="flex gap-[8px]">
        <input
          v-model="customPrompt"
          @keyup.enter="handleCustomGenerate"
          type="text"
          placeholder="Describe your component..."
          class="flex-1 px-[12px] py-[10px] border-[1px] border-[#d1d5db] rounded-[8px] text-[14px] focus:border-[#3b82f6] focus:ring-[2px] focus:ring-[rgba(59,130,246,0.2)] outline-none transition-all duration-[200ms]"
          :disabled="isGenerating"
        >
        <button
          @click="handleCustomGenerate"
          :disabled="isGenerating || !customPrompt.trim()"
          class="px-[20px] py-[10px] bg-[#3b82f6] text-white rounded-[8px] cursor-pointer border-none hover:bg-[#2563eb] disabled:opacity-[0.5] disabled:cursor-not-allowed transition-all duration-[200ms]"
        >
          Generate
        </button>
      </div>
    </div>

    <!-- Generated Components -->
    <div class="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-[20px]">
      <AIComponent
        v-for="component in components"
        :key="component.id"
        :component="component"
        @update="updateComponent"
        @remove="removeComponent"
      />
    </div>

    <!-- Empty State -->
    <div 
      v-if="components.length === 0 && !isGenerating"
      class="text-center py-[60px]"
    >
      <div class="text-[48px] mb-[16px]">🚀</div>
      <h3 class="text-[18px] font-[600] text-[#1e293b] mb-[8px]">
        Ready for AI Magic
      </h3>
      <p class="text-[14px] text-[#64748b]">
        Generate your first Vue component with AI styling
      </p>
    </div>
  </div>
</template>
```

### Reactive AI Component

```vue
<!-- AIComponent.vue -->
<script setup>
import { ref, reactive, computed, watch } from 'vue';

const props = defineProps({
  component: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['update', 'remove']);

const isEditing = ref(false);
const styleInstructions = ref('');

// Reactive style editor
const useStyleEditor = () => {
  const updateStyle = async (instruction) => {
    // Simulate AI style processing
    const updates = await processStyleInstruction(instruction);
    
    if (updates.styles) {
      Object.assign(props.component.styles, updates.styles);
    }
    
    if (updates.content) {
      Object.assign(props.component.content, updates.content);
    }
  };

  return { updateStyle };
};

const { updateStyle } = useStyleEditor();

// Quick style actions
const quickActions = [
  { label: 'Make Vibrant', instruction: 'use vibrant colors' },
  { label: 'Add Shadow', instruction: 'add dramatic shadow' },
  { label: 'Round Corners', instruction: 'make more rounded' },
  { label: 'Animate', instruction: 'add hover animations' }
];

const handleQuickAction = (instruction) => {
  updateStyle(instruction);
};

const handleCustomInstruction = () => {
  if (styleInstructions.value.trim()) {
    updateStyle(styleInstructions.value.trim());
    styleInstructions.value = '';
  }
};

// Process style instructions (AI simulation)
async function processStyleInstruction(instruction) {
  const updates = {};
  
  if (instruction.includes('vibrant')) {
    updates.styles = {
      container: props.component.styles.container.replace(
        'from-[#667eea] to-[#764ba2]',
        'from-[#ff6b6b] to-[#4ecdc4]'
      )
    };
  }
  
  if (instruction.includes('shadow')) {
    updates.styles = {
      container: props.component.styles.container.replace(
        'shadow-[0_8px_32px_rgba(0,0,0,0.3)]',
        'shadow-[0_20px_60px_rgba(0,0,0,0.4)]'
      )
    };
  }
  
  if (instruction.includes('rounded')) {
    updates.styles = {
      container: props.component.styles.container.replace(
        'rounded-[16px]',
        'rounded-[24px]'
      )
    };
  }
  
  if (instruction.includes('animate')) {
    updates.styles = {
      container: props.component.styles.container.replace(
        'hover:scale-[1.02]',
        'hover:scale-[1.05] hover:rotate-[1deg]'
      )
    };
  }
  
  return updates;
}
</script>

<template>
  <div 
    class="relative group"
    @mouseenter="isEditing = true"
    @mouseleave="isEditing = false"
  >
    <!-- Card Component -->
    <div 
      v-if="component.type === 'card'"
      :class="component.styles.container"
    >
      <h3 :class="component.styles.title">
        {{ component.content.title }}
      </h3>
      <p :class="component.styles.content">
        {{ component.content.description }}
      </p>
      <button 
        :class="component.styles.button"
        @click="updateStyle('refresh colors')"
      >
        {{ component.content.buttonText }}
      </button>
    </div>

    <!-- Widget Component -->
    <div 
      v-else-if="component.type === 'widget'"
      :class="component.styles.container"
    >
      <div :class="component.styles.header">
        <h4 :class="component.styles.title">
          {{ component.content.title }}
        </h4>
        <div class="w-[32px] h-[32px] rounded-[8px] bg-[#3b82f6] bg-opacity-[0.1] flex items-center justify-center text-[16px]">
          📊
        </div>
      </div>
      <div :class="component.styles.value">
        {{ component.content.value }}
      </div>
      <div :class="component.styles.trend">
        <span class="mr-[4px]">↗</span>
        {{ component.content.trend }} {{ component.content.period }}
      </div>
    </div>

    <!-- Edit Controls Overlay -->
    <div 
      v-show="isEditing"
      class="absolute top-[8px] right-[8px] flex flex-col gap-[4px] bg-[rgba(0,0,0,0.8)] rounded-[6px] p-[8px] opacity-0 group-hover:opacity-100 transition-all duration-[200ms]"
    >
      <div class="flex gap-[4px] mb-[8px]">
        <button
          v-for="action in quickActions"
          :key="action.label"
          @click="handleQuickAction(action.instruction)"
          class="px-[8px] py-[4px] bg-[#3b82f6] text-white text-[10px] rounded-[4px] cursor-pointer border-none hover:bg-[#2563eb] transition-all duration-[200ms]"
          :title="action.label"
        >
          {{ action.label }}
        </button>
      </div>
      
      <div class="flex gap-[4px]">
        <input
          v-model="styleInstructions"
          @keyup.enter="handleCustomInstruction"
          type="text"
          placeholder="Custom style..."
          class="w-[120px] px-[6px] py-[4px] text-[10px] border-[1px] border-[#d1d5db] rounded-[4px] bg-white"
        >
        <button
          @click="handleCustomInstruction"
          class="px-[6px] py-[4px] bg-[#10b981] text-white text-[10px] rounded-[4px] cursor-pointer border-none hover:bg-[#059669]"
        >
          Apply
        </button>
      </div>
      
      <button
        @click="$emit('remove', component.id)"
        class="w-full px-[6px] py-[4px] bg-[#ef4444] text-white text-[10px] rounded-[4px] cursor-pointer border-none hover:bg-[#dc2626] mt-[4px]"
      >
        Remove
      </button>
    </div>
  </div>
</template>
```

## Advanced Reactive Patterns

### Reactive Style Store with Watchers

```vue
<script setup>
import { ref, reactive, watch, computed, provide, inject } from 'vue';

// Global style store for AI-generated styles
const createStyleStore = () => {
  const styles = reactive(new Map());
  const activeComponent = ref(null);
  const history = reactive([]);
  
  const addStyle = (id, styleObj) => {
    styles.set(id, reactive(styleObj));
    history.push({ action: 'add', id, timestamp: Date.now() });
  };
  
  const updateStyle = (id, updates) => {
    const existing = styles.get(id);
    if (existing) {
      Object.assign(existing, updates);
      history.push({ action: 'update', id, updates, timestamp: Date.now() });
    }
  };
  
  const removeStyle = (id) => {
    styles.delete(id);
    history.push({ action: 'remove', id, timestamp: Date.now() });
  };
  
  // Watch for style changes and trigger BaroCSS updates
  watch(
    () => Array.from(styles.entries()),
    (newStyles) => {
      // BaroCSS automatically handles the DOM changes
      console.log('Styles updated:', newStyles.length, 'components');
    },
    { deep: true }
  );
  
  return {
    styles,
    activeComponent,
    history,
    addStyle,
    updateStyle,
    removeStyle
  };
};

// Provide the store
const styleStore = createStyleStore();
provide('styleStore', styleStore);

// Component that uses the store
const AIStyleConsumer = {
  setup() {
    const styleStore = inject('styleStore');
    const componentId = ref(`component-${Date.now()}`);
    
    // Initialize component styles
    styleStore.addStyle(componentId.value, {
      container: 'w-[300px] h-[200px] bg-[#ffffff] rounded-[8px] p-[16px]',
      title: 'text-[18px] font-[600] text-[#1e293b] mb-[8px]',
      content: 'text-[14px] text-[#64748b] leading-[1.5]'
    });
    
    // Computed style getter
    const componentStyles = computed(() => 
      styleStore.styles.get(componentId.value) || {}
    );
    
    // AI style updater
    const updateWithAI = async (instruction) => {
      const updates = await processAIInstruction(instruction);
      styleStore.updateStyle(componentId.value, updates);
    };
    
    return {
      componentId,
      componentStyles,
      updateWithAI
    };
  }
};

async function processAIInstruction(instruction) {
  // Simulate AI processing
  const updates = {};
  
  if (instruction.includes('blue')) {
    updates.container = updates.container?.replace(/bg-\[#[a-f0-9]{6}\]/, 'bg-[#3b82f6]') || 'bg-[#3b82f6]';
  }
  
  if (instruction.includes('larger')) {
    updates.container = updates.container?.replace(/w-\[\d+px\]/, 'w-[400px]') || 'w-[400px]';
  }
  
  return updates;
}
</script>

<template>
  <div class="vue-ai-app">
    <h1 class="text-[32px] font-[700] text-[#1e293b] mb-[24px]">
      Vue + BaroCSS Reactive AI Styling
    </h1>
    
    <!-- Style store debug info -->
    <div class="mb-[20px] p-[16px] bg-[#f1f5f9] rounded-[8px]">
      <h3 class="text-[14px] font-[600] text-[#374151] mb-[8px]">
        Active Styles: {{ styleStore.styles.size }}
      </h3>
      <p class="text-[12px] text-[#6b7280]">
        Last action: {{ styleStore.history[styleStore.history.length - 1]?.action || 'None' }}
      </p>
    </div>
    
    <!-- Component instances -->
    <div class="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-[20px]">
      <component 
        v-for="n in 3" 
        :key="n"
        :is="AIStyleConsumer"
      />
    </div>
  </div>
</template>
```

## Performance Optimization

### Lazy Loading and Virtual Scrolling

```vue
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const useVirtualAIComponents = (itemHeight = 200) => {
  const containerRef = ref(null);
  const scrollTop = ref(0);
  const containerHeight = ref(800);
  const allComponents = ref([]);
  
  // Calculate visible range
  const visibleRange = computed(() => {
    const start = Math.floor(scrollTop.value / itemHeight);
    const visibleCount = Math.ceil(containerHeight.value / itemHeight);
    const end = Math.min(start + visibleCount + 2, allComponents.value.length);
    
    return { start: Math.max(0, start - 1), end };
  });
  
  // Get visible components
  const visibleComponents = computed(() => {
    const { start, end } = visibleRange.value;
    return allComponents.value.slice(start, end).map((component, index) => ({
      ...component,
      virtualIndex: start + index,
      top: (start + index) * itemHeight
    }));
  });
  
  // Total height for scrollbar
  const totalHeight = computed(() => allComponents.value.length * itemHeight);
  
  const handleScroll = (e) => {
    scrollTop.value = e.target.scrollTop;
  };
  
  const addAIComponent = async (prompt) => {
    const component = await generateComponent(prompt);
    allComponents.value.push(component);
  };
  
  onMounted(() => {
    if (containerRef.value) {
      containerHeight.value = containerRef.value.clientHeight;
    }
  });
  
  return {
    containerRef,
    visibleComponents,
    totalHeight,
    handleScroll,
    addAIComponent
  };
};

const { containerRef, visibleComponents, totalHeight, handleScroll, addAIComponent } = useVirtualAIComponents();

// Generate initial components
onMounted(async () => {
  for (let i = 0; i < 100; i++) {
    await addAIComponent(`AI component ${i + 1}`);
  }
});
</script>

<template>
  <div class="h-screen flex flex-col">
    <div class="p-[20px] bg-white border-b-[1px] border-[#e2e8f0]">
      <h1 class="text-[24px] font-[700] text-[#1e293b] mb-[16px]">
        Virtual AI Components
      </h1>
      <button
        @click="addAIComponent('New AI component')"
        class="px-[16px] py-[8px] bg-[#3b82f6] text-white rounded-[8px] cursor-pointer border-none hover:bg-[#2563eb]"
      >
        Add AI Component
      </button>
    </div>
    
    <div 
      ref="containerRef"
      class="flex-1 overflow-auto"
      @scroll="handleScroll"
    >
      <div 
        class="relative"
        :style="{ height: `${totalHeight}px` }"
      >
        <div
          v-for="component in visibleComponents"
          :key="component.id"
          class="absolute w-full"
          :style="{ 
            top: `${component.top}px`,
            height: '200px'
          }"
        >
          <div :class="component.styles.container">
            <h3 :class="component.styles.title">
              Component {{ component.virtualIndex + 1 }}
            </h3>
            <p :class="component.styles.content">
              {{ component.content.description }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

This Vue integration demonstrates the power of reactive AI component generation with BaroCSS, showing how Vue's reactivity system perfectly complements build-free styling for dynamic, AI-driven user interfaces.
