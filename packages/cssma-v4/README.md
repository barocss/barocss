# CSSMA

[![npm version](https://img.shields.io/npm/v/cssma-v4.svg)](https://www.npmjs.com/package/cssma-v4)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

A **realtime CSS library** that brings Tailwind CSS JIT mode to life. CSSMA analyzes DOM classes instantly and generates styles on-the-fly, requiring no build environment. Write Tailwind classes anywhere, anytime, and see them styled immediately.

## ✨ Features

- **🚀 Realtime JIT Mode** - Generate CSS instantly as you use it
- **🔍 DOM Analysis** - Automatically detects and processes class changes
- **⚡ Zero Build Time** - No build step, no waiting, instant styling
- **🎯 95%+ Tailwind Compatible** - Use familiar Tailwind syntax everywhere
- **🌐 Universal** - Works in browsers, Node.js, and any JavaScript environment
- **🎨 Full Utility Support** - Layout, spacing, colors, typography, and more
- **📱 Responsive & Interactive** - All variants work out of the box

## 🚀 Quick Start

### Browser (CDN)

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CSSMA App</title>
  <script type="module" src="https://unpkg.com/cssma-v4/dist/browser.js"></script>
</head>
<body>
  <div class="bg-blue-500 text-white p-6 rounded-lg shadow-lg">
    <h1 class="text-3xl font-bold mb-4">Hello CSSMA!</h1>
    <p class="text-lg opacity-90">Instant styling, no build required.</p>
    <button class="mt-4 bg-white text-blue-500 px-4 py-2 rounded hover:bg-gray-100 transition-colors">
      Get Started
    </button>
  </div>
</body>
</html>
```

### Installation

```bash
npm install cssma-v4

or

pnpm add cssma-v4
```

```typescript
import { StyleRuntime } from 'cssma-v4/runtime/browser';

// Initialize runtime
const runtime = new StyleRuntime();

// Add classes and watch for changes
runtime.observe(document.body, { scan: true });
```

## 🎯 How It Works

CSSMA works like Tailwind CSS's JIT mode, but in real-time:

1. **Watch DOM Changes** - Automatically detects new classes
2. **Parse Classes** - Analyzes Tailwind syntax (95%+ compatible)
3. **Generate CSS** - Creates styles instantly using JIT approach
4. **Inject Styles** - Adds CSS to the page in real-time

```typescript
// Just add classes - CSSMA handles the rest
document.body.innerHTML = `
  <div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-8 rounded-xl">
    <h1 class="text-4xl font-bold mb-6">Real-time Styling</h1>
    <p class="text-xl opacity-90">This gets styled instantly!</p>
  </div>
`;

// CSSMA automatically:
// ✅ Detects new classes
// ✅ Generates CSS
// ✅ Applies styles
// ✅ No build step needed
```

## 🛠️ Usage Examples

### Basic Styling

```typescript
import { StyleRuntime } from 'cssma-v4/runtime/browser';

const runtime = new StyleRuntime();

// Add classes dynamically
runtime.addClass('bg-red-500 text-white p-4 rounded-lg shadow-md');

// Classes work immediately
document.body.innerHTML = `
  <div class="bg-red-500 text-white p-4 rounded-lg shadow-md">
    Styled instantly!
  </div>
`;
```

### Responsive Design

```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <div class="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
    <h3 class="text-lg font-semibold mb-2">Card 1</h3>
    <p class="text-gray-600">Responsive grid with hover effects</p>
  </div>
  <!-- More cards... -->
</div>
```

### Interactive States

```html
<button class="bg-blue-500 hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-white font-medium py-2 px-4 rounded transition-colors">
  Interactive Button
</button>
```

### Dark Mode

```html
<div class="bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-6 rounded-lg">
  <h2 class="text-xl font-semibold">Dark Mode Support</h2>
  <p>Automatically adapts to system preferences</p>
</div>
```

### Arbitrary Values

```html
<div class="w-[calc(100%-2rem)] bg-[#ff6b6b] text-[rgb(255,255,255)] p-4">
  Custom values with arbitrary value syntax
</div>
```

## 🔧 Configuration

### Custom Theme

```typescript
const runtime = new StyleRuntime({
  config: {
    theme: {
      extend: {
        colors: {
          'brand': {
            50: '#f0f9ff',
            500: '#0ea5e9',
            900: '#0c4a6e',
          }
        },
        spacing: {
          '18': '4.5rem',
          '88': '22rem',
        }
      }
    }
  }
});
```

### Dark Mode Strategy

```typescript
const runtime = new StyleRuntime({
  config: {
    darkMode: 'class', // or 'media'
    theme: {
      extend: {
        colors: {
          gray: {
            900: '#111827',
            800: '#1f2937',
          }
        }
      }
    }
  }
});
```

## 🌐 Environment Support

### Browser Runtime

```typescript
import { StyleRuntime } from 'cssma-v4/runtime/browser';

const runtime = new StyleRuntime();
runtime.observe(document.body, { scan: true });
```

### Server Runtime

```typescript
import { ServerRuntime } from 'cssma-v4/runtime/server';

const serverRuntime = new ServerRuntime();
const css = serverRuntime.generateCss('bg-blue-500 text-white p-4');
```

### Core Engine

```typescript
import { parseClassToAst, generateCss, createContext } from 'cssma-v4';

const ctx = createContext({
  theme: {
    colors: { red: { 500: '#ef4444' } },
    spacing: { 4: '1rem' }
  }
});

const css = generateCss('bg-red-500 text-white p-4', ctx);
```

## 📱 Supported Utilities

CSSMA supports **95%+ of Tailwind CSS utilities**:

- **Layout**: `container`, `columns`, `break-after`, `break-before`
- **Flexbox & Grid**: `flex`, `grid`, `order`, `gap`
- **Spacing**: `p-4`, `m-2`, `space-x-4`, `space-y-2`
- **Sizing**: `w-full`, `h-screen`, `min-h-screen`, `max-w-md`
- **Typography**: `text-sm`, `font-bold`, `leading-relaxed`
- **Backgrounds**: `bg-blue-500`, `bg-gradient-to-r`, `bg-[url(...)]`
- **Borders**: `border-2`, `rounded-lg`, `border-blue-500`
- **Effects**: `shadow-lg`, `opacity-50`, `blur-sm`
- **Transitions**: `transition-all`, `duration-300`, `ease-in-out`
- **Transforms**: `rotate-45`, `scale-110`, `translate-x-4`
- **Interactivity**: `hover:bg-blue-600`, `focus:ring-2`, `active:scale-95`

## 🚀 Performance Features

- **JIT Generation** - Only generates CSS you actually use
- **Smart Caching** - Avoids regenerating existing styles
- **Efficient Parsing** - Fast class name processing
- **Tree Shaking** - Removes unused utilities automatically
- **Minimal Output** - Generates optimized CSS

## 🔌 Plugin System

Extend CSSMA with custom utilities and variants:

```typescript
const customPlugin = (ctx: CssmaContext) => {
  // Register custom utilities
  ctx.extendTheme('colors', {
    'custom-blue': '#1e40af',
    'custom-green': '#059669'
  });
  
  // Add custom variants
  // ... plugin implementation
};

const runtime = new StyleRuntime({
  config: {
    plugins: [customPlugin]
  }
});
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### Development

```bash
# Clone the repository
git clone https://github.com/easylogic/figmaikr.git
cd figmaikr

# Install dependencies
pnpm install

# Start development
pnpm dev

# Run tests
pnpm test

# Build packages
pnpm build
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

## 🙏 Acknowledgments

- **Tailwind CSS** - For the amazing utility-first approach and JIT inspiration
- **CSS Working Group** - For advancing CSS standards
- **Community Contributors** - For feedback and contributions

---

**CSSMA** - Where Tailwind meets realtime. Style anything, anywhere, instantly.

*No build step. No waiting. Just pure, instant CSS magic.* ✨
