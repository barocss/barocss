# @barocss/server

[![npm version](https://img.shields.io/npm/v/@barocss/server.svg)](https://www.npmjs.com/package/@barocss/server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

**Server Runtime** - Server-side CSS generation and processing

@barocss/server provides server-side utilities for parsing Tailwind classes and generating CSS without browser-specific features. Perfect for SSR, static site generation, and server-side CSS processing.

## ✨ Key Features

- **🚀 Server-Side CSS Generation** - Generate CSS on the server without browser APIs
- **⚡ Batch Processing** - Process multiple classes efficiently
- **📱 SSR Support** - Perfect for server-side rendering scenarios
- **🎯 Static Generation** - Generate CSS for static sites and build processes
- **🌐 Node.js Optimized** - Designed specifically for Node.js environments

## 🚀 Quick Start

### NPM Installation

```bash
# npm
npm install @barocss/server

# pnpm
pnpm add @barocss/server

# yarn
yarn add @barocss/server
```

### Basic Usage

```typescript
import { ServerRuntime } from '@barocss/server';

// Initialize server runtime
const runtime = new ServerRuntime();

// Generate CSS for a single class
const css = runtime.generateCss('bg-blue-500 text-white p-4');
console.log(css);
// Output: .bg-blue-500 { background-color: #3b82f6; }
//         .text-white { color: #ffffff; }
//         .p-4 { padding: 1rem; }
```

### Batch Processing

```typescript
import { ServerRuntime } from '@barocss/server';

const runtime = new ServerRuntime();

// Process multiple classes at once
const classes = [
  'bg-blue-500',
  'text-white',
  'p-4',
  'rounded-lg',
  'shadow-md'
];

const results = runtime.generateCssForClasses(classes);
results.forEach(({ className, css }) => {
  console.log(`${className}: ${css}`);
});
```

## 🎯 How It Works

The server runtime provides server-side CSS generation:

1. **Class Parsing** - Parses Tailwind classes using @barocss/kit
2. **CSS Generation** - Generates CSS rules without browser dependencies
3. **Batch Processing** - Efficiently processes multiple classes
4. **Static Output** - Returns CSS strings ready for server use

```typescript
import { ServerRuntime } from '@barocss/server';

const runtime = new ServerRuntime();

// Parse and generate CSS
const css = runtime.generateCss('bg-red-500 hover:bg-red-600 text-white p-4');

// Result:
// .bg-red-500 { background-color: #ef4444; }
// .hover\:bg-red-600:hover { background-color: #dc2626; }
// .text-white { color: #ffffff; }
// .p-4 { padding: 1rem; }
```

## 🛠️ Usage Examples

### Basic Server Usage

```typescript
import { ServerRuntime } from '@barocss/server';

const runtime = new ServerRuntime({
  theme: {
    extend: {
      colors: {
        'brand': {
          500: '#0ea5e9',
          600: '#0284c7'
        }
      }
    }
  }
});

// Generate CSS for specific classes
const css = runtime.generateCss('bg-brand-500 text-white p-4');
console.log(css);
```

### Processing Multiple Classes

```typescript
import { ServerRuntime } from '@barocss/server';

const runtime = new ServerRuntime();

// Process a list of classes
const classes = [
  'bg-blue-500',
  'text-white',
  'p-4',
  'rounded-lg',
  'shadow-md'
];

const results = runtime.generateCssForClasses(classes);
results.forEach(({ className, css }) => {
  console.log(`${className}: ${css}`);
});
```

## 🔧 Configuration

### Server Runtime Options

```typescript
import { ServerRuntime } from '@barocss/server';

const runtime = new ServerRuntime({
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
  },
  darkMode: 'class',
  cssVarPrefix: '--baro-'
});
```

### Custom Theme Functions

```typescript
const runtime = new ServerRuntime({
  theme: {
    spacing: (theme) => ({
      ...theme('spacing'),
      '18': '4.5rem',
      '88': '22rem',
    }),
    colors: (theme) => ({
      ...theme('colors'),
      'brand': {
        500: '#0ea5e9',
        600: '#0284c7'
      }
    })
  }
});
```

## 🌐 API Reference

### ServerRuntime

```typescript
class ServerRuntime {
  constructor(config?: Config)
  
  // Parse a class name and return its AST
  parseClass(className: string): AstNode[]
  
  // Generate CSS for a single class
  generateCss(className: string): string
  
  // Generate CSS for multiple classes
  generateCssForClasses(classes: string[]): Array<{
    className: string;
    css: string;
  }>
}
```

### Usage Examples

```typescript
import { ServerRuntime } from '@barocss/server';

const runtime = new ServerRuntime();

// Parse class to AST
const ast = runtime.parseClass('bg-blue-500 hover:bg-blue-600');
console.log(ast);

// Generate CSS for single class
const css = runtime.generateCss('bg-blue-500 text-white p-4');
console.log(css);

// Generate CSS for multiple classes
const results = runtime.generateCssForClasses([
  'bg-blue-500',
  'text-white',
  'p-4'
]);
console.log(results);
```

## 🚀 Performance Features

- **Batch Processing** - Efficiently processes multiple classes
- **Memory Optimization** - Optimized for server environments
- **Static Generation** - Perfect for build-time CSS generation
- **No Browser Dependencies** - Runs entirely in Node.js

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

### Development

```bash
# Clone repository
git clone https://github.com/easylogic/barocss.git
cd barocss

# Install dependencies
pnpm install

# Start development server
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

**@barocss/server** - Server-side CSS generation and processing.

*Parse. Generate. Serve. Efficiently.* ✨
