---
title: Real-time CSS Generation
description: How BaroCSS generates CSS instantly without build processes
---

# Real-time CSS Generation

BaroCSS revolutionizes CSS development by generating styles in real-time, eliminating the need for build processes while maintaining the performance benefits of JIT compilation.

## The Problem with Traditional CSS Frameworks

Traditional utility-first CSS frameworks require a build step that can take 30+ seconds:

```bash
# Traditional utility-first CSS workflow
npm run build  # 30+ seconds of waiting
# CSS is generated from source files
# Changes require rebuilding
```

This creates several pain points:
- **Slow development cycles** - Wait for builds to see changes
- **Build complexity** - Configure webpack, PostCSS, etc.
- **Static limitations** - Can't generate CSS for dynamic content
- **Development friction** - Context switching between code and build tools

## BaroCSS Solution: Real-time Generation

BaroCSS generates CSS instantly as you use it, with zero build time:

```typescript
import { BrowserRuntime } from 'barocss/runtime/browser';

const runtime = new BrowserRuntime();

// CSS is generated instantly - no build step needed!
document.body.innerHTML = `
  <div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-8 rounded-xl">
    <h1 class="text-4xl font-bold mb-6">Real-time Styling</h1>
    <p class="text-xl opacity-90">This gets styled instantly!</p>
  </div>
`;
```

## How Real-time Generation Works

### 1. DOM Change Detection

BaroCSS automatically detects when new classes are added to the DOM:

```typescript
// BaroCSS automatically detects these changes
const element = document.createElement('div');
element.className = 'bg-red-500 text-white p-4'; // CSS generated instantly
document.body.appendChild(element);
```

### 2. Instant CSS Generation

When a new class is detected, BaroCSS immediately:

1. **Parses** the class name (`bg-red-500`)
2. **Generates** the corresponding CSS
3. **Injects** the CSS into the page
4. **Caches** the result for future use

```typescript
// This happens automatically in milliseconds
const css = generateCss('bg-red-500', ctx);
// Result: .bg-red-500 { background-color: rgb(239 68 68); }
```

### 3. Smart Caching

BaroCSS caches generated CSS to avoid redundant work:

```typescript
// First time: generates CSS
element.className = 'bg-blue-500'; // ~1ms

// Second time: uses cache
element2.className = 'bg-blue-500'; // ~0.1ms
```

## Performance Comparison

| Aspect | Traditional CSS | BaroCSS |
|--------|----------------|---------|
| **Build Time** | 30s+ | 0ms |
| **Change Detection** | Manual file scanning | Automatic DOM monitoring |
| **CSS Generation** | Build-time | Real-time |
| **Development Speed** | Slow (rebuild required) | Instant |
| **Dynamic Content** | Limited | Full support |
| **Bundle Size** | Large (all utilities) | Minimal (only used) |

## Real-time Generation Benefits

### ⚡ Instant Feedback

See changes immediately as you develop:

```html
<!-- Change this class and see the result instantly -->
<div class="bg-blue-500 hover:bg-blue-600 transition-colors">
  Hover me!
</div>
```

### 🎯 JIT Optimization

Only generate CSS for classes you actually use:

```typescript
// Only these classes generate CSS
const classes = ['bg-red-500', 'text-white', 'p-4'];
// Unused classes like 'bg-green-500' don't generate any CSS
```

### 🔄 Dynamic Content Support

Generate CSS for dynamically created content:

```typescript
// This works seamlessly with BaroCSS
const dynamicElement = document.createElement('div');
dynamicElement.className = 'bg-gradient-to-r from-purple-500 to-pink-500';
document.body.appendChild(dynamicElement); // CSS generated instantly
```

### 🚀 No Build Configuration

Start using BaroCSS immediately without complex setup:

```html
<!-- Just include the script and start styling -->
<script type="module" src="https://unpkg.com/barocss/dist/cdn/barocss.js"></script>
```

## Advanced Real-time Features

### Batch Processing

BaroCSS efficiently processes multiple classes at once:

```typescript
const runtime = new BrowserRuntime();

// Process multiple classes efficiently
runtime.addClass('bg-blue-500 text-white p-4 rounded-lg shadow-md');
```

### Incremental Updates

Only process new or changed classes:

```typescript
// First render
element.className = 'bg-red-500'; // Generates CSS

// Update
element.className = 'bg-red-500 text-white'; // Only processes 'text-white'
```

### Performance Monitoring

Monitor CSS generation performance:

```typescript
const stats = runtime.getStats();
console.log(stats);
// {
//   totalClasses: 150,
//   generatedCSS: '2.3KB',
//   cacheHitRate: 0.85,
//   averageGenerationTime: '0.8ms'
// }
```

## Use Cases

### 1. Rapid Prototyping

Perfect for quick iterations and experimentation:

```typescript
// Try different styles instantly
const button = document.querySelector('.btn');
button.className = 'bg-blue-500 hover:bg-blue-600'; // Instant
button.className = 'bg-green-500 hover:bg-green-600'; // Instant
button.className = 'bg-purple-500 hover:bg-purple-600'; // Instant
```

### 2. Dynamic Theming

Change themes in real-time:

```typescript
function switchTheme(theme) {
  document.documentElement.className = theme;
  // All theme-specific classes are generated instantly
}
```

### 3. Component Libraries

Build dynamic component libraries:

```typescript
function createButton(variant, size) {
  const button = document.createElement('button');
  button.className = `btn-${variant} btn-${size}`;
  // CSS is generated automatically
  return button;
}
```

## Best Practices

### 1. Use Semantic Class Names

```typescript
// Good: Semantic and maintainable
element.className = 'btn-primary btn-large';

// Avoid: Too specific
element.className = 'bg-blue-500 text-white px-4 py-2 rounded';
```

### 2. Leverage Caching

```typescript
// Reuse common class combinations
const commonStyles = 'bg-white shadow-md rounded-lg p-4';
element1.className = commonStyles;
element2.className = commonStyles; // Uses cache
```

### 3. Monitor Performance

```typescript
// Check performance in development
if (process.env.NODE_ENV === 'development') {
  const stats = runtime.getStats();
  console.log('CSS Generation Stats:', stats);
}
```

## Migration from Build-based Frameworks

### From Tailwind CSS

```typescript
// Before: Tailwind with build process
// tailwind.config.js, webpack config, etc.

// After: BaroCSS with real-time generation
import { BrowserRuntime } from 'barocss/runtime/browser';
const runtime = new BrowserRuntime();
// That's it! No build configuration needed
```

### From Other CSS Frameworks

```typescript
// Before: Static CSS classes
element.className = 'my-custom-button';

// After: Dynamic utility classes
element.className = 'bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded';
// CSS generated instantly
```

## Conclusion

Real-time CSS generation is the future of CSS development. BaroCSS eliminates build complexity while providing instant feedback, making development faster and more enjoyable.

Ready to experience real-time CSS generation? Check out the [Quick Start Guide](/guide/quick-start) to get started with BaroCSS.
