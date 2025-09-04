# React Integration

BaroCSS integrates seamlessly with React applications, enabling build-free UI generation and real-time styling without any compilation step. Perfect for AI-driven component systems and dynamic user interfaces.

## Setup

### 1. Installation

```bash
npm install barocss
# or
yarn add barocss
# or
pnpm add barocss@latest
```

### 2. Initialize BaroCSS

```jsx
import React, { useEffect } from 'react';
import { BrowserRuntime } from 'barocss/runtime/browser';

function App() {
  useEffect(() => {
    // Initialize BaroCSS runtime
    const runtime = new BrowserRuntime();
    runtime.init();
    
    // Cleanup on unmount
    return () => {
      runtime.destroy();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <AIComponentSystem />
    </div>
  );
}

export default App;
```

## AI-Driven Component Generation

### Dynamic Component Generator Hook

```jsx
import { useState, useCallback, useMemo } from 'react';

function useAIComponentGenerator() {
  const [components, setComponents] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Simulate AI component generation
  const generateComponent = useCallback(async (prompt, config = {}) => {
    setIsGenerating(true);
    
    try {
      // This would call your AI service
      const aiResponse = await simulateAIGeneration(prompt, config);
      
      const newComponent = {
        id: Date.now(),
        type: aiResponse.type,
        props: aiResponse.props,
        styles: aiResponse.styles,
        content: aiResponse.content
      };
      
      setComponents(prev => [...prev, newComponent]);
      return newComponent;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const removeComponent = useCallback((id) => {
    setComponents(prev => prev.filter(comp => comp.id !== id));
  }, []);

  const updateComponent = useCallback((id, updates) => {
    setComponents(prev => 
      prev.map(comp => 
        comp.id === id 
          ? { ...comp, ...updates }
          : comp
      )
    );
  }, []);

  return {
    components,
    generateComponent,
    removeComponent,
    updateComponent,
    isGenerating
  };
}

// Simulate AI generation
async function simulateAIGeneration(prompt, config) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const componentTypes = {
    'modern card': {
      type: 'card',
      styles: {
        container: `w-[${config.width || 320}px] h-[${config.height || 200}px] bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-[16px] shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-[24px] backdrop-blur-[10px] border-[1px] border-[rgba(255,255,255,0.2)]`,
        title: 'text-[24px] font-[600] text-white mb-[12px] leading-[1.2]',
        content: 'text-[16px] text-[rgba(255,255,255,0.9)] leading-[1.5]',
        button: 'mt-[16px] px-[20px] py-[8px] bg-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.3)] text-white rounded-[8px] transition-all duration-[200ms] cursor-pointer border-none backdrop-blur-[5px]'
      },
      content: {
        title: 'AI Generated Card',
        description: 'This card was generated using AI with build-free styling.',
        buttonText: 'Learn More'
      }
    },
    'dashboard widget': {
      type: 'widget',
      styles: {
        container: `w-[${config.width || 280}px] h-[${config.height || 160}px] bg-white rounded-[12px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] border-[1px] border-[#e2e8f0] p-[20px] hover:shadow-[0_8px_40px_rgba(0,0,0,0.12)] transition-all duration-[300ms] hover:scale-[1.02]`,
        header: 'flex items-center justify-between mb-[16px]',
        title: 'text-[14px] font-[500] text-[#64748b] uppercase tracking-[0.5px]',
        value: 'text-[28px] font-[700] text-[#1e293b] mb-[8px]',
        trend: 'text-[12px] font-[500] text-[#10b981] flex items-center',
        icon: 'w-[32px] h-[32px] rounded-[8px] bg-[#3b82f6] bg-opacity-[0.1] flex items-center justify-center'
      },
      content: {
        title: 'Total Revenue',
        value: '$45,234',
        trend: '+12.5%',
        icon: '💰'
      }
    }
  };
  
  const matchedType = Object.keys(componentTypes).find(key => 
    prompt.toLowerCase().includes(key)
  );
  
  return componentTypes[matchedType] || componentTypes['modern card'];
}
```

### AI Component Renderer

```jsx
function AIComponentRenderer({ component, onUpdate, onRemove }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editableProps, setEditableProps] = useState(component.props || {});

  const handleStyleUpdate = useCallback(async (instruction) => {
    // Simulate AI style modification
    const updatedStyles = await simulateStyleUpdate(component.styles, instruction);
    onUpdate(component.id, { styles: updatedStyles });
  }, [component, onUpdate]);

  const renderCard = () => (
    <div className={component.styles.container}>
      <h3 className={component.styles.title}>
        {component.content.title}
      </h3>
      <p className={component.styles.content}>
        {component.content.description}
      </p>
      <button 
        className={component.styles.button}
        onClick={() => handleStyleUpdate('make it more vibrant')}
      >
        {component.content.buttonText}
      </button>
      
      {/* Edit overlay */}
      {isEditing && (
        <div className="absolute top-[8px] right-[8px] flex gap-[4px]">
          <button
            className="w-[24px] h-[24px] bg-[rgba(0,0,0,0.5)] text-white rounded-[4px] text-[12px] cursor-pointer border-none"
            onClick={() => handleStyleUpdate('change colors')}
          >
            🎨
          </button>
          <button
            className="w-[24px] h-[24px] bg-[rgba(255,0,0,0.5)] text-white rounded-[4px] text-[12px] cursor-pointer border-none"
            onClick={() => onRemove(component.id)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );

  const renderWidget = () => (
    <div className={component.styles.container}>
      <div className={component.styles.header}>
        <h4 className={component.styles.title}>
          {component.content.title}
        </h4>
        <div className={component.styles.icon}>
          {component.content.icon}
        </div>
      </div>
      <div className={component.styles.value}>
        {component.content.value}
      </div>
      <div className={component.styles.trend}>
        <span className="mr-[4px]">↗</span>
        {component.content.trend} from last month
      </div>
    </div>
  );

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsEditing(true)}
      onMouseLeave={() => setIsEditing(false)}
    >
      {component.type === 'card' && renderCard()}
      {component.type === 'widget' && renderWidget()}
    </div>
  );
}

async function simulateStyleUpdate(currentStyles, instruction) {
  // Simulate AI processing the style update instruction
  const updates = { ...currentStyles };
  
  if (instruction.includes('vibrant')) {
    updates.container = updates.container.replace(
      'from-[#667eea] to-[#764ba2]',
      'from-[#ff6b6b] to-[#4ecdc4]'
    );
  }
  
  if (instruction.includes('change colors')) {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffd93d'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    updates.container = updates.container.replace(
      /from-\[#[a-f0-9]{6}\]/,
      `from-[${randomColor}]`
    );
  }
  
  return updates;
}
```

## Real-time Style Editor

### Live Style Modification Hook

```jsx
import { useState, useRef, useCallback } from 'react';

function useLiveStyleEditor(initialClassName = '') {
  const [className, setClassName] = useState(initialClassName);
  const elementRef = useRef(null);

  const updateStyle = useCallback((property, value) => {
    // Remove existing classes for this property
    const currentClasses = className.split(' ').filter(cls => {
      const propertyPrefixes = {
        width: /^w-/,
        height: /^h-/,
        padding: /^p[xy]?-/,
        margin: /^m[xy]?-/,
        background: /^bg-/,
        text: /^text-/,
        border: /^border-/,
        rounded: /^rounded-/
      };
      
      const regex = propertyPrefixes[property];
      return regex ? !regex.test(cls) : true;
    });

    // Add new class with arbitrary value
    const newClass = `${property}-[${value}]`;
    const updatedClasses = [...currentClasses, newClass].join(' ');
    
    setClassName(updatedClasses);
  }, [className]);

  const addArbitraryClass = useCallback((arbitraryClass) => {
    setClassName(prev => `${prev} ${arbitraryClass}`.trim());
  }, []);

  const removeClasses = useCallback((classesToRemove) => {
    setClassName(prev => 
      prev.split(' ')
        .filter(cls => !classesToRemove.includes(cls))
        .join(' ')
    );
  }, []);

  const resetStyles = useCallback(() => {
    setClassName(initialClassName);
  }, [initialClassName]);

  return {
    className,
    elementRef,
    updateStyle,
    addArbitraryClass,
    removeClasses,
    resetStyles
  };
}

// Usage example
function EditableComponent({ children, initialClass = '' }) {
  const { className, elementRef, updateStyle, addArbitraryClass } = useLiveStyleEditor(initialClass);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const handleQuickStyle = (instruction) => {
    // Parse natural language instructions
    if (instruction.includes('bigger')) {
      updateStyle('text', '24px');
    }
    if (instruction.includes('blue')) {
      updateStyle('bg', '#3b82f6');
    }
    if (instruction.includes('rounded')) {
      updateStyle('rounded', '12px');
    }
    if (instruction.includes('shadow')) {
      addArbitraryClass('shadow-[0_10px_40px_rgba(0,0,0,0.15)]');
    }
  };

  return (
    <div className="relative group">
      <div ref={elementRef} className={className}>
        {children}
      </div>
      
      {/* Style editor overlay */}
      <div className="absolute top-[8px] right-[8px] opacity-0 group-hover:opacity-100 transition-opacity duration-[200ms]">
        <button
          className="px-[8px] py-[4px] bg-[rgba(0,0,0,0.8)] text-white text-[12px] rounded-[4px] cursor-pointer border-none"
          onClick={() => setIsEditorOpen(!isEditorOpen)}
        >
          Edit Styles
        </button>
        
        {isEditorOpen && (
          <div className="absolute top-[32px] right-[0] w-[200px] bg-white rounded-[8px] shadow-[0_10px_40px_rgba(0,0,0,0.15)] p-[12px] border-[1px] border-[#e2e8f0] z-[1000]">
            <div className="space-y-[8px]">
              <button
                className="w-full px-[8px] py-[4px] bg-[#3b82f6] text-white text-[12px] rounded-[4px] cursor-pointer border-none hover:bg-[#2563eb]"
                onClick={() => handleQuickStyle('make it bigger and blue')}
              >
                Make Bigger & Blue
              </button>
              <button
                className="w-full px-[8px] py-[4px] bg-[#10b981] text-white text-[12px] rounded-[4px] cursor-pointer border-none hover:bg-[#059669]"
                onClick={() => handleQuickStyle('add rounded corners and shadow')}
              >
                Add Rounded & Shadow
              </button>
              <input
                type="text"
                placeholder="Custom instruction..."
                className="w-full px-[8px] py-[4px] border-[1px] border-[#d1d5db] rounded-[4px] text-[12px]"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleQuickStyle(e.target.value);
                    e.target.value = '';
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

## Advanced AI Component System

### Complete AI-Driven Dashboard

```jsx
import React, { useState, useEffect, useCallback } from 'react';

function AIDashboard() {
  const { components, generateComponent, removeComponent, updateComponent, isGenerating } = useAIComponentGenerator();
  const [selectedTemplate, setSelectedTemplate] = useState('dashboard');

  const templates = {
    dashboard: {
      name: 'Dashboard Layout',
      description: 'Professional dashboard with widgets',
      components: [
        { type: 'dashboard widget', config: { width: 280, height: 160 } },
        { type: 'dashboard widget', config: { width: 280, height: 160 } },
        { type: 'dashboard widget', config: { width: 280, height: 160 } },
      ]
    },
    landing: {
      name: 'Landing Page',
      description: 'Modern landing page components',
      components: [
        { type: 'modern card', config: { width: 400, height: 250 } },
        { type: 'modern card', config: { width: 400, height: 250 } },
      ]
    }
  };

  const generateTemplate = useCallback(async (templateKey) => {
    const template = templates[templateKey];
    
    for (const componentConfig of template.components) {
      await generateComponent(componentConfig.type, componentConfig.config);
    }
  }, [generateComponent]);

  const handleAIPrompt = useCallback(async (prompt) => {
    await generateComponent(prompt, { width: 320, height: 200 });
  }, [generateComponent]);

  return (
    <div className="min-h-screen bg-[#f8fafc] p-[20px]">
      {/* AI Control Panel */}
      <div className="mb-[30px] bg-white rounded-[12px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-[24px]">
        <h1 className="text-[24px] font-[700] text-[#1e293b] mb-[20px]">
          AI Component Generator
        </h1>
        
        <div className="flex gap-[16px] mb-[20px]">
          {Object.entries(templates).map(([key, template]) => (
            <button
              key={key}
              className={`px-[16px] py-[8px] rounded-[8px] border-[1px] transition-all duration-[200ms] cursor-pointer ${
                selectedTemplate === key
                  ? 'bg-[#3b82f6] text-white border-[#3b82f6]'
                  : 'bg-white text-[#6b7280] border-[#d1d5db] hover:border-[#3b82f6]'
              }`}
              onClick={() => setSelectedTemplate(key)}
            >
              {template.name}
            </button>
          ))}
        </div>
        
        <div className="flex gap-[12px]">
          <button
            className="px-[20px] py-[10px] bg-[#10b981] text-white rounded-[8px] cursor-pointer border-none hover:bg-[#059669] disabled:opacity-[0.5] disabled:cursor-not-allowed transition-all duration-[200ms]"
            onClick={() => generateTemplate(selectedTemplate)}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate Template'}
          </button>
          
          <AIPromptInput onSubmit={handleAIPrompt} disabled={isGenerating} />
        </div>
      </div>

      {/* Generated Components Grid */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-[20px]">
        {components.map(component => (
          <AIComponentRenderer
            key={component.id}
            component={component}
            onUpdate={updateComponent}
            onRemove={removeComponent}
          />
        ))}
      </div>

      {/* Empty State */}
      {components.length === 0 && !isGenerating && (
        <div className="text-center py-[60px]">
          <div className="text-[48px] mb-[16px]">🤖</div>
          <h3 className="text-[18px] font-[600] text-[#1e293b] mb-[8px]">
            No Components Yet
          </h3>
          <p className="text-[14px] text-[#64748b]">
            Generate your first AI component using the controls above
          </p>
        </div>
      )}
    </div>
  );
}

function AIPromptInput({ onSubmit, disabled }) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (prompt.trim() && !disabled) {
      onSubmit(prompt.trim());
      setPrompt('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-[8px] flex-1">
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the component you want to generate..."
        className="flex-1 px-[12px] py-[10px] border-[1px] border-[#d1d5db] rounded-[8px] text-[14px] focus:border-[#3b82f6] focus:ring-[2px] focus:ring-[rgba(59,130,246,0.2)] outline-none transition-all duration-[200ms]"
        disabled={disabled}
      />
      <button
        type="submit"
        className="px-[20px] py-[10px] bg-[#3b82f6] text-white rounded-[8px] cursor-pointer border-none hover:bg-[#2563eb] disabled:opacity-[0.5] disabled:cursor-not-allowed transition-all duration-[200ms]"
        disabled={disabled || !prompt.trim()}
      >
        Generate
      </button>
    </form>
  );
}
```

## Performance Optimization

### Component Memoization for BaroCSS

```jsx
import React, { memo, useMemo } from 'react';

// Memoized component that only re-renders when styles actually change
const OptimizedAIComponent = memo(function OptimizedAIComponent({ 
  type, 
  styles, 
  content, 
  onUpdate 
}) {
  // Memoize class strings to prevent unnecessary re-renders
  const memoizedClasses = useMemo(() => ({
    container: styles.container,
    title: styles.title,
    content: styles.content
  }), [styles]);

  // Memoize event handlers
  const handleUpdate = useCallback((instruction) => {
    onUpdate(instruction);
  }, [onUpdate]);

  return (
    <div className={memoizedClasses.container}>
      <h3 className={memoizedClasses.title}>
        {content.title}
      </h3>
      <p className={memoizedClasses.content}>
        {content.description}
      </p>
      <button onClick={() => handleUpdate('refresh styles')}>
        Update Styles
      </button>
    </div>
  );
});

// Custom hook for batching BaroCSS updates
function useBatchedUpdates() {
  const [pendingUpdates, setPendingUpdates] = useState([]);
  const timeoutRef = useRef(null);

  const batchUpdate = useCallback((updateFn) => {
    setPendingUpdates(prev => [...prev, updateFn]);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setPendingUpdates(current => {
        // Execute all pending updates in batch
        current.forEach(update => update());
        return [];
      });
    }, 16); // Next frame
  }, []);

  return batchUpdate;
}
```

This React integration demonstrates how BaroCSS enables build-free AI-driven component generation with real-time styling, performance optimization, and seamless developer experience.
