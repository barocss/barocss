---
title: Automatic DOM Change Detection
description: How BaroCSS automatically detects and processes DOM changes in real-time
---

# Automatic DOM Change Detection

BaroCSS features an intelligent DOM change detection system that automatically monitors your page for new CSS classes and generates styles instantly, without any manual intervention.

## The Challenge with Dynamic Content

Traditional CSS frameworks require you to manually specify which files contain your classes:

```javascript
// Traditional Tailwind CSS approach
// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{html,js,ts,jsx,tsx}', // Must specify file patterns
  ],
```

This approach has limitations:
- **Static file scanning** - Can't detect dynamically added classes
- **Build-time only** - No runtime class detection
- **Manual configuration** - Must specify all file patterns
- **No dynamic content support** - Classes added via JavaScript aren't detected

## BaroCSS Solution: Automatic Detection

BaroCSS automatically detects DOM changes using the MutationObserver API:

```typescript
import { BrowserRuntime } from '@barocss/browser';

const runtime = new BrowserRuntime();

// Start automatic DOM monitoring
runtime.observe(document.body, { scan: true });

// BaroCSS automatically detects and processes these changes:
document.body.innerHTML = `
  <div class="bg-blue-500 text-white p-4 rounded-lg">
    <h1 class="text-2xl font-bold">Auto-detected!</h1>
  </div>
`;
// CSS is generated instantly for all classes
```

## How DOM Change Detection Works

### 1. MutationObserver Integration

BaroCSS uses the native MutationObserver API to watch for DOM changes:

```typescript
class ChangeDetector {
  private observer: MutationObserver;
  
  constructor(parser: IncrementalParser, runtime: BrowserRuntime) {
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          // New elements added
          this.processNewElements(mutation.addedNodes);
        }
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          // Class attributes changed
          this.processClassChanges(mutation.target);
        }
      });
    });
  }
```

### 2. Intelligent Class Extraction

When changes are detected, BaroCSS extracts and processes new classes:

```typescript
function processNewElements(nodes: NodeList) {
  nodes.forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      
      // Extract classes from the element
      const classes = element.className.split(/\s+/).filter(Boolean);
      
      // Process new classes
      classes.forEach(cls => {
        if (!processedClasses.has(cls)) {
          const css = generateCss(cls, ctx);
          injectCSS(css);
          processedClasses.add(cls);
        }
      });
      
      // Recursively process child elements
      processNewElements(element.children);
    }
  });
```

### 3. Real-time CSS Injection

Generated CSS is immediately injected into the page:

```typescript
function injectCSS(css: string) {
  const styleElement = document.getElementById('@barocss/kit-runtime') || 
    createStyleElement();
  
  styleElement.textContent += css;
```

## Configuration Options

### Basic Monitoring

```typescript
const runtime = new BrowserRuntime();

// Monitor entire document
runtime.observe(document.body, { scan: true });
```

### Selective Monitoring

```typescript
// Monitor specific elements only
const container = document.querySelector('#dynamic-content');
runtime.observe(container, { scan: true });
```

### Advanced Configuration

```typescript
const runtime = new BrowserRuntime();

runtime.observe(document.body, {
  scan: true,
  subtree: true,        // Monitor child elements
  childList: true,      // Watch for new/removed elements
  attributes: true,     // Watch for attribute changes
  attributeFilter: ['class'] // Only watch class attribute
});
```

## Performance Optimizations

### Debounced Processing

BaroCSS debounces rapid DOM changes to avoid excessive processing:

```typescript
class ChangeDetector {
  private debounceTimer: number | null = null;
  
  private handleMutation(mutations: MutationRecord[]) {
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    // Debounce processing
    this.debounceTimer = setTimeout(() => {
      this.processMutations(mutations);
      this.debounceTimer = null;
    }, 16); // ~60fps
  }
```

### Batch Processing

Multiple changes are processed together for efficiency:

```typescript
function processMutations(mutations: MutationRecord[]) {
  const allClasses = new Set<string>();
  
  // Collect all new classes
  mutations.forEach(mutation => {
    extractClasses(mutation).forEach(cls => allClasses.add(cls));
  });
  
  // Process all classes in one batch
  const results = parser.processClasses(Array.from(allClasses));
  results.forEach(result => injectCSS(result.css));
```

### Smart Caching

Already processed classes are skipped:

```typescript
function processClass(className: string) {
  if (processedClasses.has(className)) {
    return; // Skip already processed classes
  }
  
  const css = generateCss(className, ctx);
  injectCSS(css);
  processedClasses.add(className);
```

## Use Cases

### 1. Dynamic Content Loading

Perfect for applications that load content dynamically:

```typescript
// Content loaded via AJAX
fetch('/api/posts')
  .then(response => response.json())
  .then(posts => {
    posts.forEach(post => {
      const element = document.createElement('div');
      element.className = 'post-card bg-white shadow-md rounded-lg p-6';
      element.innerHTML = `
        <h2 class="text-xl font-bold text-gray-800">${post.title}</h2>
        <p class="text-gray-600 mt-2">${post.excerpt}</p>
      `;
      document.body.appendChild(element);
      // BaroCSS automatically detects and styles these classes
    });
  });
```

### 2. Component Libraries

Build dynamic component systems:

```typescript
class Modal {
  show() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center';
    modal.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 class="text-2xl font-bold mb-4">Modal Title</h2>
        <p class="text-gray-600 mb-6">Modal content goes here</p>
        <button class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
          Close
        </button>
      </div>
    `;
    document.body.appendChild(modal);
    // All classes are automatically processed
  }
```

### 3. Theme Switching

Change themes dynamically:

```typescript
function switchTheme(theme: 'light' | 'dark') {
  document.documentElement.className = theme;
  
  // Update all elements with theme-specific classes
  const elements = document.querySelectorAll('[class*="theme-"]');
  elements.forEach(element => {
    const newClasses = element.className.replace(/theme-\w+/g, `theme-${theme}`);
    element.className = newClasses;
    // BaroCSS detects the class changes and generates new CSS
  });
```

### 4. User-Generated Content

Handle user-created content:

```typescript
// User creates a new post with custom styling
function createUserPost(content: string, styles: string) {
  const post = document.createElement('article');
  post.className = `user-post ${styles}`;
  post.innerHTML = content;
  
  document.querySelector('#posts').appendChild(post);
  // BaroCSS processes the user's custom classes automatically
```

## Advanced Features

### Custom Change Handlers

```typescript
const runtime = new BrowserRuntime();

// Add custom change handler
runtime.onClassChange((className, element) => {
  console.log(`New class detected: ${className} on`, element);
  
  // Custom processing logic
  if (className.startsWith('animate-')) {
    // Handle animation classes specially
    element.classList.add('will-change-transform');
  }
});
```

### Performance Monitoring

```typescript
const runtime = new BrowserRuntime();

// Monitor detection performance
runtime.onMutation((mutations) => {
  const startTime = performance.now();
  
  // Process mutations
  runtime.processMutations(mutations);
  
  const endTime = performance.now();
  console.log(`Processed ${mutations.length} mutations in ${endTime - startTime}ms`);
});
```

### Selective Processing

```typescript
const runtime = new BrowserRuntime();

// Only process specific class patterns
runtime.observe(document.body, {
  scan: true,
  classFilter: (className) => {
    // Only process utility classes, skip component classes
    return /^(bg-|text-|p-|m-|w-|h-)/.test(className);
  }
});
```

## Browser Compatibility

BaroCSS's DOM change detection works in all modern browsers:

| Browser | MutationObserver Support | Performance |
|---------|-------------------------|-------------|
| **Chrome** | ✅ Full support | Excellent |
| **Firefox** | ✅ Full support | Excellent |
| **Safari** | ✅ Full support | Good |
| **Edge** | ✅ Full support | Excellent |
| **IE 11** | ❌ Not supported | N/A |

For older browsers, BaroCSS falls back to manual class processing.

## Conclusion

Automatic DOM change detection is one of BaroCSS's most powerful features, enabling truly dynamic CSS generation without any manual configuration or build processes.

The system intelligently monitors your page, processes only new classes, and provides excellent performance through debouncing, batching, and caching.

Ready to experience automatic DOM detection? Check out the [Quick Start Guide](/guide/installation) to get started with BaroCSS.
