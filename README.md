# FigmaikR

A powerful CSS-in-JS framework with plugin system, TypeScript support, and modern development experience.

## 📚 Documentation

Visit our comprehensive documentation site: **[Barocss Documentation](https://your-username.github.io/barocss/)**

The documentation includes:
- Getting Started guide
- Installation instructions
- Core concepts explanation
- Plugin system documentation
- Complete API reference
- Real-world examples

## 🚀 Features

- **Plugin System**: Extensible architecture for custom utilities, variants, and theme extensions
- **TypeScript Support**: Full TypeScript support with comprehensive type definitions
- **Performance Optimized**: Lightning-fast CSS generation with intelligent caching
- **Modern API**: Clean, intuitive API designed for modern development workflows
- **AST-based**: Uses Abstract Syntax Tree for precise CSS control and optimization

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add barocss@latest

# Using npm
npm install barocss@latest

# Using yarn
yarn add barocss@latest
```

## 🎯 Quick Start

```typescript
import { createContext, parseClassToAst, astToCss } from 'barocss'

// Create a context with your configuration
const ctx = createContext({
  theme: {
    colors: {
      primary: '#3b82f6',
      secondary: '#64748b',
    },
    spacing: {
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
    },
  },
})

// Parse CSS classes to AST
const ast = parseClassToAst('bg-primary p-md text-white', ctx)

// Convert AST to CSS
const css = astToCss(ast)
console.log(css)
```

## 🔌 Plugin System

Extend BAROCSS with custom utilities and variants:

```typescript
import { createUtilityPlugin, staticUtility, decl } from 'barocss'

const customPlugin = createUtilityPlugin({
  name: 'custom-plugin',
  version: '1.0.0',
  utilities: (ctx) => {
    staticUtility('custom-bg', [
      decl('background-color', 'var(--custom-color)'),
      decl('border-radius', '8px'),
    ])
  },
})

const ctx = createContext({
  plugins: [customPlugin],
})
```

## 📁 Project Structure

```
barocss/
├── apps/
│   ├── barocss-docs/          # Documentation site
│   ├── barocss-plugin/        # Figma plugin
│   └── figmai-landing/      # Landing page
├── packages/
│   └── barocss/           # Core BAROCSS framework
└── docs/                    # Project documentation
```

## 🛠️ Development

### Prerequisites

- Node.js 18+
- pnpm

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/barocss.git
cd barocss

# Install dependencies
pnpm install

# Run tests
pnpm test

# Start development servers
pnpm dev
```

### Documentation Site

The documentation site is built with Next.js and deployed to GitHub Pages:

```bash
# Navigate to docs directory
cd apps/barocss-docs

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

## 📖 Documentation

For detailed documentation, visit our [documentation site](https://your-username.github.io/barocss/) or check the local docs:

- [Getting Started](apps/barocss-docs/src/app/docs/getting-started/page.tsx)
- [Installation Guide](apps/barocss-docs/src/app/docs/installation/page.tsx)
- [Core Concepts](apps/barocss-docs/src/app/docs/core-concepts/page.tsx)
- [Plugin System](apps/barocss-docs/src/app/docs/plugin-system/page.tsx)
- [API Reference](apps/barocss-docs/src/app/docs/api-reference/page.tsx)
- [Examples](apps/barocss-docs/src/app/docs/examples/page.tsx)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📚 [Documentation](https://your-username.github.io/barocss/)
- 🐛 [Issue Tracker](https://github.com/your-username/barocss/issues)
- 💬 [Discussions](https://github.com/your-username/barocss/discussions)
