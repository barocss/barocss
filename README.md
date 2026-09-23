# BaroCSS

[![npm version](https://img.shields.io/npm/v/@barocss/kit.svg)](https://www.npmjs.com/package/@barocss/kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

**Instant CSS** - AI-powered CSS utilities with baroque elegance

BaroCSS generates utility CSS in the browser or on a server. It has a CSS engine, a browser runtime, and a server runtime. See the [Tailwind compatibility report](packages/barocss/docs/tailwind-compatibility.md) for measured coverage.

## ✨ Key Features

- **🚀 Real-time JIT Mode** - Generate CSS instantly as you use it
- **🔍 Automatic DOM Detection** - Automatically detects and processes class changes
- **⚡ Zero Build Time** - No build step, immediate styling
- **🎯 Tailwind-style classes** - Use the supported utilities and variants in the [compatibility report](packages/barocss/docs/tailwind-compatibility.md)
- **🌐 Universal** - Works in browsers, Node.js, and any JavaScript environment
- **🎨 Utility support** - Layout, spacing, colors, typography, and more
- **📱 Variants** - Responsive and interactive variants are available
- **🧠 Smart Caching** - Intelligent caching system for performance optimization

## 📚 Documentation

Visit our comprehensive documentation site: **[BaroCSS Documentation](https://barocss.com/)**

The documentation includes:
- Getting Started guide
- Installation instructions
- Core concepts explanation
- Complete API reference
- Real-world examples

## 🚀 Quick Start

### CDN Usage (Browser)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BaroCSS App</title>
  <script type="module">
    import { baroStart } from 'https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.js';
    baroStart();
  </script>
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

### Package Installation

Choose the package for your environment:

| Package | Use |
| --- | --- |
| `@barocss/kit` | Parse classes and generate CSS |
| `@barocss/browser` | Watch DOM changes and insert CSS |
| `@barocss/server` | Generate CSS in Node.js |

The browser and server packages depend on `@barocss/kit`. Install the runtime you use:

```bash
# Using pnpm (recommended)
pnpm add @barocss/browser@latest

# Using npm
npm install @barocss/browser@latest

# Using yarn
yarn add @barocss/browser@latest
```

For server code, install `@barocss/server`. For direct engine use, install `@barocss/kit`.

### Basic Usage

```typescript
import { BrowserRuntime } from '@barocss/browser';

// Initialize runtime
const runtime = new BrowserRuntime();

// Watch DOM changes and auto-style
runtime.observe(document.body, { scan: true });
```

## 🎯 How It Works

BaroCSS works like Tailwind CSS's JIT mode but processes everything in real-time:

1. **DOM Change Detection** - Automatically detects new classes
2. **Class Parsing** - Parses supported Tailwind-style classes
3. **CSS Generation** - Creates styles instantly using JIT approach
4. **Style Injection** - Adds CSS to the page in real-time

```typescript
// Just add classes - BaroCSS handles the rest
document.body.innerHTML = `
  <div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-8 rounded-xl">
    <h1 class="text-4xl font-bold mb-6">Real-time Styling</h1>
    <p class="text-xl opacity-90">This gets styled instantly!</p>
  </div>
`;

// BaroCSS automatically:
// ✅ Detects new classes
// ✅ Generates CSS
// ✅ Applies styles
// ✅ No build step needed
```

## 🛠️ Usage Examples

### Basic Styling

```typescript
import { BrowserRuntime } from '@barocss/browser';

const runtime = new BrowserRuntime();

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
const runtime = new BrowserRuntime({
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
const runtime = new BrowserRuntime({
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
import { BrowserRuntime } from '@barocss/browser';

const runtime = new BrowserRuntime();
runtime.observe(document.body, { scan: true });
```

### Server Runtime

```typescript
import { ServerRuntime } from '@barocss/server';

const serverRuntime = new ServerRuntime();
const css = serverRuntime.generateCss('bg-blue-500 text-white p-4');
```

### Core Engine

```typescript
import { parseClassToAst, generateCss, createContext } from '@barocss/kit';

const ctx = createContext({
  theme: {
    colors: { red: { 500: '#ef4444' } },
    spacing: { 4: '1rem' }
  }
});

const css = generateCss('bg-red-500 text-white p-4', ctx);
```

## 📱 Supported Utilities

BaroCSS supports the utility groups below. See the [compatibility report](packages/barocss/docs/tailwind-compatibility.md) for the tested Tailwind version, cases, and results.

### Layout
- `container`, `columns`, `break-after`, `break-before`
- `block`, `inline-block`, `inline`, `flex`, `inline-flex`
- `grid`, `inline-grid`, `contents`, `hidden`

### Flexbox & Grid
- `flex`, `grid`, `order`, `gap`
- `justify-start`, `justify-center`, `justify-end`
- `items-start`, `items-center`, `items-end`

### Spacing
- `p-4`, `m-2`, `space-x-4`, `space-y-2`
- `px-6`, `py-3`, `pt-2`, `pb-4`

### Sizing
- `w-full`, `h-screen`, `min-h-screen`, `max-w-md`
- `w-1/2`, `h-16`, `min-w-0`, `max-h-96`

### Typography
- `text-sm`, `font-bold`, `leading-relaxed`
- `text-center`, `text-left`, `text-right`
- `uppercase`, `lowercase`, `capitalize`

### Backgrounds
- `bg-blue-500`, `bg-gradient-to-r`, `bg-[url(...)]`
- `bg-opacity-50`, `bg-blend-multiply`

### Borders
- `border-2`, `rounded-lg`, `border-blue-500`
- `border-opacity-25`, `border-dashed`

### Effects
- `shadow-lg`, `opacity-50`, `blur-sm`
- `backdrop-blur`, `backdrop-filter`

### Transitions & Transforms
- `transition-all`, `duration-300`, `ease-in-out`
- `rotate-45`, `scale-110`, `translate-x-4`

### Interactivity
- `hover:bg-blue-600`, `focus:ring-2`, `active:scale-95`
- `group`, `peer`, `group-hover:`, `peer-focus:`

## 🚀 Performance Features

- **JIT Generation** - Only generates CSS you actually use
- **Smart Caching** - Avoids regenerating existing styles
- **Efficient Parsing** - Fast class name processing
- **Tree Shaking** - Removes unused utilities automatically
- **Minimal Output** - Generates optimized CSS

## 🔧 Custom Utilities

Extend BaroCSS with custom utilities using the global registry functions:

```typescript
import { staticUtility, functionalUtility } from '@barocss/kit';

// Register static utilities
staticUtility('custom-bg', [
  ['background-color', 'var(--custom-color)'],
  ['border-radius', '8px']
]);

// Register functional utilities
functionalUtility({
  name: 'custom-text',
  prop: 'color',
  handle: (value) => [decl('color', value)]
});
```

## 📁 Project Structure

```
barocss/
├── apps/
│   └── barocss-docs/          # Documentation site
├── packages/
│   ├── barocss/               # @barocss/kit CSS engine
│   ├── barocss-browser/       # @barocss/browser DOM runtime
│   └── barocss-server/        # @barocss/server Node runtime
└── docs/                      # Project documentation
```

## 🛠️ Development

### Prerequisites

- Node.js 22.12+
- pnpm 9

### Setup

```bash
# Clone the repository
git clone https://github.com/barocss/barocss.git
cd barocss

# Install dependencies
pnpm install

# Run tests
pnpm test

# Start development servers
pnpm dev
```

### Documentation Site

The documentation site is built with VitePress and deployed to GitHub Pages:

```bash
# Navigate to docs directory
cd apps/barocss-docs

# Start development server
pnpm docs:dev

# Build for production
pnpm docs:build
```

## 📖 Documentation

For detailed documentation, visit our [documentation site](https://barocss.com/) or check the local docs:

- [Getting Started](apps/barocss-docs/docs/guide/getting-started.md)
- [Installation Guide](apps/barocss-docs/docs/guide/installation.md)
- [Core Concepts](apps/barocss-docs/docs/guide/index.md)
- [API Reference](apps/barocss-docs/docs/api/index.md)
- [Examples](apps/barocss-docs/docs/examples/index.md)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📚 [Documentation](https://barocss.com/)
- 🐛 [Issue Tracker](https://github.com/barocss/barocss/issues)
- 💬 [Discussions](https://github.com/barocss/barocss/discussions)

## 🙏 Acknowledgments

- **Tailwind CSS** - For the amazing utility-first approach and JIT inspiration
- **UnoCSS** - For ideas around on-demand, utility-first generation at runtime

---

**BaroCSS** - Where Tailwind meets realtime. Style anything, anywhere, instantly.

*No build step. No waiting. Just pure, instant CSS magic.* ✨
