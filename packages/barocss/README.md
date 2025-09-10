# @barocss/kit

[![npm version](https://img.shields.io/npm/v/@barocss/kit.svg)](https://www.npmjs.com/package/@barocss/kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

**CSS Engine** - Core parsing and generation engine

@barocss/kit is the core CSS engine that parses Tailwind CSS syntax and generates CSS. It provides the fundamental parsing, AST processing, and CSS generation capabilities used by BaroCSS runtimes.

## ✨ Key Features

- **🚀 JIT Parsing** - Parse Tailwind syntax and generate CSS instantly
- **🔍 AST Processing** - Advanced Abstract Syntax Tree manipulation
- **⚡ Incremental Parsing** - Efficient parsing with caching
- **🎯 Tailwind Compatible** - Full Tailwind CSS syntax support
- **🌐 Universal** - Works in browsers, Node.js, and any JavaScript environment
- **🎨 Complete Utility Support** - Layout, spacing, colors, typography, and more
- **📱 Responsive & Interactive** - All variants work out of the box
- **🧠 Smart Caching** - Caching system for performance optimization

## 🚀 Quick Start

### NPM Installation

```bash
# npm
npm install @barocss/kit

# pnpm
pnpm add @barocss/kit

# yarn
yarn add @barocss/kit
```

### Basic Usage

```typescript
import { parseClassToAst, generateCss, createContext } from '@barocss/kit';

// Create context with theme
const ctx = createContext({
  theme: {
    colors: { 
      blue: { 500: '#3b82f6' },
      white: '#ffffff'
    },
    spacing: { 
      4: '1rem',
      8: '2rem'
    }
  }
});

// Parse and generate CSS
const ast = parseClassToAst('bg-blue-500 text-white p-4', ctx);
const css = generateCss('bg-blue-500 text-white p-4', ctx);

console.log(css);
// Output: .bg-blue-500 { background-color: #3b82f6; }
//         .text-white { color: #ffffff; }
//         .p-4 { padding: 1rem; }
```

## 🎯 How It Works

@barocss/kit provides the core parsing and generation engine:

1. **Class Parsing** - Analyzes Tailwind syntax into AST nodes
2. **AST Processing** - Manipulates and optimizes the Abstract Syntax Tree
3. **CSS Generation** - Converts AST nodes into CSS rules
4. **Context Management** - Handles theme, configuration, and caching

```typescript
import { parseClassToAst, generateCss, createContext } from '@barocss/kit';

// Parse class names into AST
const ast = parseClassToAst('bg-blue-500 hover:bg-blue-600', ctx);

// Generate CSS from AST or class names
const css = generateCss('bg-blue-500 hover:bg-blue-600', ctx);

// Result:
// .bg-blue-500 { background-color: #3b82f6; }
// .hover\:bg-blue-600:hover { background-color: #2563eb; }
```

## 🛠️ Usage Examples

### Basic CSS Generation

```typescript
import { generateCss, createContext } from '@barocss/kit';

const ctx = createContext({
  theme: {
    colors: { red: { 500: '#ef4444' } },
    spacing: { 4: '1rem' }
  }
});

const css = generateCss('bg-red-500 text-white p-4', ctx);
console.log(css);
```

### AST Processing

```typescript
import { parseClassToAst, optimizeAst, astToCss } from '@barocss/kit';

// Parse to AST
const ast = parseClassToAst('bg-blue-500 hover:bg-blue-600 p-4', ctx);

// Optimize AST
const optimizedAst = optimizeAst(ast);

// Convert to CSS
const css = astToCss(optimizedAst);
```

### Incremental Parsing

```typescript
import { IncrementalParser, createContext } from '@barocss/kit';

const ctx = createContext();
const parser = new IncrementalParser(ctx);

// Process classes incrementally
const result = parser.processClass('bg-blue-500');
const result2 = parser.processClass('text-white');
```

### Custom Theme

```typescript
import { createContext } from '@barocss/kit';

const ctx = createContext({
  theme: {
    extend: {
      colors: {
        'brand': {
          50: '#f0f9ff',
          500: '#0ea5e9',
          900: '#0c4a6e',
        }
      }
    }
  }
});
```

## 🔧 Configuration

### Context Configuration

```typescript
import { createContext } from '@barocss/kit';

const ctx = createContext({
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
  darkMode: 'class', // or 'media'
  cssVarPrefix: '--baro-'
});
```

### Theme Functions

```typescript
const ctx = createContext({
  theme: {
    spacing: (theme) => ({
      ...theme('spacing'),
      '18': '4.5rem',
      '88': '22rem',
    })
  }
});
```

## 🌐 API Reference

### Core Functions

```typescript
// Parse class to AST
parseClassToAst(className: string, ctx: Context): AstNode[]

// Generate CSS from class names
generateCss(classList: string, ctx: Context): string

// Generate CSS from AST
astToCss(ast: AstNode[]): string

// Optimize AST
optimizeAst(ast: AstNode[]): AstNode[]

// Create context
createContext(config?: Config): Context
```

### Incremental Parser

```typescript
import { IncrementalParser } from '@barocss/kit';

const parser = new IncrementalParser(ctx);

// Process single class
const result = parser.processClass('bg-blue-500');

// Process multiple classes
const results = parser.processClasses(['bg-blue-500', 'text-white']);

// Get statistics
const stats = parser.getStats();
```

## 📱 Supported Utilities

BaroCSS supports **most Tailwind CSS utilities**:

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
- **Optimized Output** - Generates efficient CSS

## 🔌 Extending the Engine

### Custom Utilities

```typescript
import { staticUtility, functionalUtility } from '@barocss/kit';

// Static utility
staticUtility('custom-shadow', [
  decl('box-shadow', '0 4px 6px -1px rgba(0, 0, 0, 0.1)')
]);

// Functional utility
functionalUtility({
  name: 'custom-spacing',
  prop: 'margin',
  themeKey: 'spacing',
  supportsArbitrary: true,
  handle: (value) => [decl('margin', value)]
});
```

### Custom Modifiers

```typescript
import { staticModifier, functionalModifier } from '@barocss/kit';

// Static modifier
staticModifier('custom-hover', ['&:hover']);

// Functional modifier
functionalModifier(
  (mod: string) => /^custom-/.test(mod),
  ({ selector, mod }) => ({
    selector: `&[data-custom="${mod.replace('custom-', '')}"]`
  })
);
```

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
- **UnoCSS** - For ideas around on-demand, utility-first generation at runtime

---

**@barocss/kit** - Core CSS parsing and generation engine.

*Parse Tailwind syntax. Generate CSS. Build amazing things.* ✨
