---
title: Examples
description: Real-world examples and use cases for BaroCSS
---

# BaroCSS Examples

Explore real-world examples and use cases for BaroCSS. These examples demonstrate how to use BaroCSS in different scenarios, from traditional development to AI-driven UI generation.

## 🤖 AI-Driven UI Generation

### AI Component Generation

BaroCSS is perfect for AI-generated UI components. When AI creates Tailwind-based interfaces, BaroCSS ensures they render instantly:

```typescript
// AI generates this component with complex arbitrary values
const aiGeneratedComponent = `
<div class="max-w-[28rem] mx-auto bg-white rounded-[1rem] shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04)] overflow-hidden border border-gray-200/50">
  <div class="p-[1.5rem]">
    <div class="flex items-center space-x-[1rem]">
      <img class="h-[3rem] w-[3rem] rounded-full object-cover border-2 border-gray-100" src="/avatar.jpg" alt="User">
      <div class="flex-1 min-w-0">
        <h3 class="text-[1.125rem] font-semibold text-gray-900 truncate">John Doe</h3>
        <p class="text-[0.875rem] text-gray-500 truncate">Software Engineer</p>
      </div>
    </div>
    <div class="mt-[1rem]">
      <p class="text-[0.875rem] text-gray-600 leading-[1.5]">Building the future of web development with AI-powered tools that generate beautiful interfaces instantly.</p>
    </div>
    <div class="mt-[1rem] flex space-x-[0.5rem]">
      <button class="px-[1rem] py-[0.5rem] bg-blue-500 text-white rounded-[0.5rem] hover:bg-blue-600 transition-all duration-[200ms] text-[0.875rem] font-medium min-w-[80px]">
        Follow
      </button>
      <button class="px-[1rem] py-[0.5rem] border border-gray-300 text-gray-700 rounded-[0.5rem] hover:bg-gray-50 transition-all duration-[200ms] text-[0.875rem] font-medium min-w-[80px]">
        Message
      </button>
    </div>
  </div>
</div>
`;

// BaroCSS parses all these arbitrary values instantly:
// - max-w-[28rem], p-[1.5rem], space-x-[1rem]
// - h-[3rem], w-[3rem], text-[1.125rem]
// - shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04)]
// - duration-[200ms], min-w-[80px]
// Perfect for AI tools that generate complex UI components!
```

### Dynamic AI Styling

AI can generate complex styling combinations that BaroCSS handles in real-time:

```typescript
// AI generates dynamic styles with arbitrary values based on content
function generateAICard(data: any) {
  const colors = ['blue', 'green', 'purple', 'red', 'yellow'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  const randomWidth = Math.floor(Math.random() * 200) + 300; // 300-500px
  const randomHeight = Math.floor(Math.random() * 100) + 120; // 120-220px
  
  return `
    <div class="bg-${randomColor}-50 border-l-[4px] border-${randomColor}-500 p-[1rem] rounded-r-[0.5rem] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] w-[${randomWidth}px] h-[${randomHeight}px] transition-all duration-[300ms] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)]">
      <div class="flex h-full">
        <div class="flex-shrink-0">
          <div class="h-[2rem] w-[2rem] bg-${randomColor}-500 rounded-full flex items-center justify-center shadow-[0_2px_4px_rgba(0,0,0,0.1)]">
            <span class="text-white text-[0.875rem] font-bold">${data.initials}</span>
          </div>
        </div>
        <div class="ml-[0.75rem] flex-1 min-w-0">
          <h3 class="text-[0.875rem] font-medium text-${randomColor}-800 truncate leading-[1.2]">${data.title}</h3>
          <p class="text-[0.75rem] text-${randomColor}-700 mt-[0.25rem] leading-[1.4] line-clamp-2">${data.description}</p>
        </div>
      </div>
    </div>
  `;

// BaroCSS generates all these dynamic arbitrary values instantly:
// - w-[${randomWidth}px], h-[${randomHeight}px] (dynamic dimensions)
// - border-l-[4px], p-[1rem], rounded-r-[0.5rem]
// - shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] with hover variations
// - duration-[300ms], text-[0.875rem], leading-[1.2]
// AI can generate any combination and BaroCSS handles it in real-time!
```

## 🚀 Quick Start Examples

### Basic HTML Page

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BaroCSS Example</title>
  <script type="module" src="https://unpkg.com/@barocss/browser/dist/cdn/barocss.js"></script>
</head>
<body>
  <div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-8 rounded-xl shadow-2xl">
    <h1 class="text-4xl font-bold mb-6">Hello BaroCSS!</h1>
    <p class="text-xl opacity-90">Instant styling without build</p>
    <button class="mt-6 bg-white text-blue-600 px-6 py-3 rounded-lg hover:bg-gray-100 transition-all duration-300 transform hover:scale-105">
      Get Started
    </button>
  </div>
</body>
</html>
```

### React Component

```typescript
import React, { useEffect, useRef } from 'react';
import { BrowserRuntime } from '@barocss/browser';

function App() {
  const runtimeRef = useRef<BrowserRuntime>();

  useEffect(() => {
    runtimeRef.current = new BrowserRuntime({
      config: {
        theme: {
          extend: {
            colors: {
              brand: '#3b82f6'
            }
          }
        }
      }
    });

    runtimeRef.current.observe(document.body, { scan: true });

    return () => {
      runtimeRef.current?.destroy();
    };
  }, []);

  return (
    <div className="bg-brand text-white p-8 rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold mb-4">React + BaroCSS</h1>
      <p className="text-lg opacity-90">Seamless integration with React</p>
    </div>
  );

export default App;
```

### Vue Component

```vue
<template>
  <div class="bg-gradient-to-r from-green-400 to-blue-500 text-white p-8 rounded-xl">
    <h1 class="text-3xl font-bold mb-4">Vue + BaroCSS</h1>
    <p class="text-lg opacity-90">Beautiful styling with Vue.js</p>
    <button 
      class="mt-4 bg-white text-green-600 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      @click="handleClick"
    >
      Click me
    </button>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { BrowserRuntime } from '@barocss/browser';

const runtime = ref<BrowserRuntime>();

onMounted(() => {
  runtime.value = new BrowserRuntime({
    config: {
      theme: {
        extend: {
          colors: {
            brand: '#10b981'
          }
        }
      }
    }
  });

  runtime.value.observe(document.body, { scan: true });
});

onUnmounted(() => {
  runtime.value?.destroy();
});

const handleClick = () => {
  console.log('Button clicked!');
};
</script>
```

## 🎨 UI Component Examples

### Button Components

```html
<!-- Primary Button -->
<button class="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200">
  Primary Button
</button>

<!-- Secondary Button -->
<button class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors duration-200">
  Secondary Button
</button>

<!-- Outline Button -->
<button class="border-2 border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white font-medium py-2 px-4 rounded-lg transition-all duration-200">
  Outline Button
</button>

<!-- Icon Button -->
<button class="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full transition-colors duration-200">
  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
    <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
  </svg>
</button>
```

### Card Components

```html
<!-- Basic Card -->
<div class="bg-white rounded-lg shadow-md p-6">
  <h3 class="text-lg font-semibold mb-2">Card Title</h3>
  <p class="text-gray-600">Card description goes here.</p>
</div>

<!-- Card with Image -->
<div class="bg-white rounded-lg shadow-md overflow-hidden">
  <img src="image.jpg" alt="Card image" class="w-full h-48 object-cover">
  <div class="p-6">
    <h3 class="text-lg font-semibold mb-2">Card with Image</h3>
    <p class="text-gray-600">Description with image.</p>
  </div>
</div>

<!-- Interactive Card -->
<div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer">
  <h3 class="text-lg font-semibold mb-2">Interactive Card</h3>
  <p class="text-gray-600">Hover to see shadow effect.</p>
</div>
```

### Form Components

```html
<!-- Input Field -->
<div class="mb-4">
  <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
  <input 
    type="email" 
    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    placeholder="Enter your email"
  >
</div>

<!-- Select Dropdown -->
<div class="mb-4">
  <label class="block text-sm font-medium text-gray-700 mb-2">Country</label>
  <select class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
    <option>Select a country</option>
    <option>United States</option>
    <option>Canada</option>
    <option>United Kingdom</option>
  </select>
</div>

<!-- Textarea -->
<div class="mb-4">
  <label class="block text-sm font-medium text-gray-700 mb-2">Message</label>
  <textarea 
    rows="4" 
    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    placeholder="Enter your message"
  ></textarea>
</div>
```

## 📱 Layout Examples

### Grid Layout

```html
<!-- Basic Grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <div class="bg-white p-6 rounded-lg shadow-md">Item 1</div>
  <div class="bg-white p-6 rounded-lg shadow-md">Item 2</div>
  <div class="bg-white p-6 rounded-lg shadow-md">Item 3</div>
</div>

<!-- Auto-fit Grid -->
<div class="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-6">
  <div class="bg-white p-6 rounded-lg shadow-md">Auto-fit item</div>
  <div class="bg-white p-6 rounded-lg shadow-md">Auto-fit item</div>
  <div class="bg-white p-6 rounded-lg shadow-md">Auto-fit item</div>
</div>
```

### Flexbox Layout

```html
<!-- Flex Container -->
<div class="flex flex-col md:flex-row gap-4">
  <div class="flex-1 bg-white p-6 rounded-lg shadow-md">Flex item 1</div>
  <div class="flex-1 bg-white p-6 rounded-lg shadow-md">Flex item 2</div>
</div>

<!-- Centered Content -->
<div class="flex items-center justify-center min-h-screen">
  <div class="bg-white p-8 rounded-lg shadow-lg">
    <h1 class="text-2xl font-bold text-center">Centered Content</h1>
  </div>
</div>
```

### Responsive Layout

```html
<!-- Responsive Navigation -->
<nav class="bg-white shadow-md">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between h-16">
      <div class="flex items-center">
        <h1 class="text-xl font-bold">Logo</h1>
      </div>
      <div class="hidden md:flex items-center space-x-8">
        <a href="#" class="text-gray-700 hover:text-blue-600">Home</a>
        <a href="#" class="text-gray-700 hover:text-blue-600">About</a>
        <a href="#" class="text-gray-700 hover:text-blue-600">Contact</a>
      </div>
    </div>
  </div>
</nav>
```

## 🎭 Animation Examples

### Hover Effects

```html
<!-- Scale on Hover -->
<div class="bg-blue-500 text-white p-6 rounded-lg transform hover:scale-105 transition-transform duration-200">
  Hover to scale
</div>

<!-- Color Transition -->
<div class="bg-gray-200 hover:bg-blue-500 text-gray-800 hover:text-white p-6 rounded-lg transition-colors duration-300">
  Hover for color change
</div>

<!-- Shadow Effect -->
<div class="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300">
  Hover for shadow effect
</div>
```

### Loading Animations

```html
<!-- Spinner -->
<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>

<!-- Pulse -->
<div class="animate-pulse bg-gray-300 h-4 rounded w-3/4"></div>

<!-- Bounce -->
<div class="animate-bounce bg-blue-500 text-white p-4 rounded-lg">
  Bouncing element
</div>
```

## 🌙 Dark Mode Examples

### Dark Mode Toggle

```html
<!-- Toggle Button -->
<button 
  id="dark-mode-toggle"
  class="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white p-2 rounded-lg transition-colors"
>
  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
  </svg>
</button>

<!-- Dark Mode Content -->
<div class="bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-6 rounded-lg">
  <h2 class="text-xl font-semibold mb-4">Dark Mode Example</h2>
  <p class="text-gray-600 dark:text-gray-300">This content adapts to dark mode.</p>
</div>
```

### Dark Mode JavaScript

```javascript
// Dark mode toggle functionality
const darkModeToggle = document.getElementById('dark-mode-toggle');
const html = document.documentElement;

darkModeToggle.addEventListener('click', () => {
  html.classList.toggle('dark');
  
  // Save preference
  const isDark = html.classList.contains('dark');
  localStorage.setItem('darkMode', isDark);
});

// Load saved preference
const savedDarkMode = localStorage.getItem('darkMode');
if (savedDarkMode === 'true') {
  html.classList.add('dark');
```

## 🔧 Custom Configuration Examples

### Brand Colors

```typescript
import { BrowserRuntime } from '@barocss/browser';

const runtime = new BrowserRuntime({
  config: {
    theme: {
      extend: {
        colors: {
          brand: {
            50: '#eff6ff',
            100: '#dbeafe',
            500: '#3b82f6',
            900: '#1e3a8a'
          }
        }
      }
    }
  }
});
```

### Custom Spacing

```typescript
const runtime = new BrowserRuntime({
  config: {
    theme: {
      extend: {
        spacing: {
          '18': '4.5rem',
          '88': '22rem',
          '128': '32rem'
        }
      }
    }
  }
});
```

### Custom Animations

```typescript
const runtime = new BrowserRuntime({
  config: {
    theme: {
      extend: {
        animation: {
          'fade-in': 'fade-in 0.5s ease-in-out',
          'slide-up': 'slide-up 0.3s ease-out'
        },
        keyframes: {
          'fade-in': {
            '0%': { opacity: '0' },
            '100%': { opacity: '1' }
          },
          'slide-up': {
            '0%': { transform: 'translateY(100%)' },
            '100%': { transform: 'translateY(0)' }
          }
        }
      }
    }
  }
});
```

## 🚀 Framework Integration Examples

### Next.js Integration

```typescript
// pages/_app.tsx
import { useEffect, useRef } from 'react';
import { BrowserRuntime } from '@barocss/browser';

function MyApp({ Component, pageProps }) {
  const runtimeRef = useRef<BrowserRuntime>();

  useEffect(() => {
    runtimeRef.current = new BrowserRuntime({
      config: {
        theme: {
          extend: {
            colors: {
              brand: '#3b82f6'
            }
          }
        }
      }
    });

    runtimeRef.current.observe(document.body, { scan: true });

    return () => {
      runtimeRef.current?.destroy();
    };
  }, []);

  return <Component {...pageProps} />;

export default MyApp;
```

### Nuxt.js Integration

```typescript
// plugins/@barocss/kit.client.ts
import { BrowserRuntime } from '@barocss/browser';

export default defineNuxtPlugin(() => {
  const runtime = new BrowserRuntime({
    config: {
      theme: {
        extend: {
          colors: {
            brand: '#3b82f6'
          }
        }
      }
    }
  });

  runtime.observe(document.body, { scan: true });

  return {
    provide: {
      @barocss/kit: runtime
    }
  };
});
```

### Svelte Integration

```svelte
<!-- App.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { BrowserRuntime } from '@barocss/browser';

  let runtime;

  onMount(() => {
    runtime = new BrowserRuntime({
      config: {
        theme: {
          extend: {
            colors: {
              brand: '#3b82f6'
            }
          }
        }
      }
    });

    runtime.observe(document.body, { scan: true });
  });

  onDestroy(() => {
    runtime?.destroy();
  });
</script>

<div class="bg-brand text-white p-8 rounded-lg">
  <h1 class="text-3xl font-bold">Svelte + BaroCSS</h1>
  <p class="text-lg opacity-90">Beautiful styling with Svelte</p>
</div>
```

## 📊 Performance Examples

### Lazy Loading

```typescript
// Lazy load BaroCSS for better performance
const loadBaroCSS = async () => {
  const { BrowserRuntime } = await import('@barocss/browser');
  
  const runtime = new BrowserRuntime({
    config: {
      theme: {
        extend: {
          colors: {
            brand: '#3b82f6'
          }
        }
      }
    }
  });

  runtime.observe(document.body, { scan: true });
  
  return runtime;
};

// Load when needed
loadBaroCSS().then(runtime => {
  console.log('BaroCSS loaded!');
});
```

### Conditional Loading

```typescript
// Only load BaroCSS in development
if (process.env.NODE_ENV === 'development') {
  const { BrowserRuntime } = await import('@barocss/browser');
  
  const runtime = new BrowserRuntime();
  runtime.observe(document.body, { scan: true });
```

## 🔗 Related Documentation

- [API Reference](/api/) - Complete API documentation
- [Configuration](/api/configuration) - Configuration options
- [Custom Utilities](/guide/adding-custom-styles) - Extending BaroCSS
- [Browser Runtime](/api/browser-runtime) - Browser integration
- [Server Runtime](/api/server-runtime) - Server-side usage
