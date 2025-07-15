# FigmaikR

A comprehensive design system toolkit that bridges the gap between design and code with seamless Tailwind CSS integration.

## 🎯 Project Overview

FigmaikR provides a powerful, bidirectional conversion system between Tailwind CSS and Figma, enabling designers and developers to work together more efficiently.

## 📦 Packages

### [cssma-v4](./packages/cssma-v4/)
The next-generation core library providing robust CSS/Tailwind to Figma conversion with modular preset system.

**Key Features:**
- 🔄 **Bidirectional Conversion** - CSS ↔ Figma transformation
- 🧩 **Modular Preset System** - Organized utility categories for better maintainability
- 🎨 **Advanced Effects** - Full filter effects support (blur, backdrop-blur, drop-shadow)
- 📐 **Constraint System** - Figma's positioning system (MIN, MAX, CENTER, STRETCH, SCALE)
- 🎭 **Component Support** - Component variants and design system integration
- 🌈 **Variable Integration** - Native Figma variables support
- ⚡ **Performance Optimized** - Efficient parsing and processing engine

```typescript
import { applyClassName, createContext } from 'cssma-v4';

// Create context with theme
const ctx = createContext({
  theme: {
    colors: { primary: '#3B82F6', secondary: '#10B981' }
  }
});

// Apply utility classes
const styles = applyClassName('flex-col w-full bg-primary text-white rounded-lg p-4', ctx);
```

#### 🎯 Preset Categories

The library is organized into modular preset categories with comprehensive test coverage:

| **Category** | **Source** | **Tests** | **Utilities** | **Examples** |
|-------------|----------|-----------|---------------|--------------|
| **Layout** | `layout.ts` | `layout.test.ts` | Position, Display, Overflow, Z-index, Aspect Ratio | `relative`, `flex`, `hidden`, `z-10`, `aspect-video` |
| **Sizing** | `sizing.ts` | `sizing.test.ts` | Width, Height, Min/Max dimensions | `w-full`, `h-screen`, `min-h-0`, `max-w-md` |
| **Spacing** | `spacing.ts` | `spacing.test.ts` | Margin, Padding, Space between | `m-4`, `p-6`, `space-x-2`, `gap-4` |
| **Typography** | `typography.ts` | `typography.test.ts` | Font, Text, Line height, Letter spacing | `text-lg`, `font-bold`, `leading-tight`, `tracking-wide` |
| **Background** | `background.ts` | `background.test.ts` | Colors, Images, Gradients, Patterns | `bg-blue-500`, `bg-gradient-to-r`, `bg-cover` |
| **Flexbox & Grid** | `flexbox-grid.ts` | `flexbox-grid.test.ts` | Flex, Grid, Alignment, Ordering | `flex-col`, `grid-cols-3`, `justify-center`, `items-start` |

#### 🧪 Testing Architecture

Each preset category has dedicated test files ensuring reliability:

```bash
packages/cssma-v4/
├── src/presets/           # Source preset files
│   ├── layout.ts          # Layout utilities
│   ├── sizing.ts          # Sizing utilities
│   ├── spacing.ts         # Spacing utilities
│   ├── typography.ts      # Typography utilities
│   ├── background.ts      # Background utilities
│   └── flexbox-grid.ts    # Flexbox & Grid utilities
└── tests/presets/         # Comprehensive test suite
    ├── layout.test.ts     # Layout utility tests
    ├── sizing.test.ts     # Sizing utility tests
    ├── spacing.test.ts    # Spacing utility tests
    ├── typography.test.ts # Typography utility tests
    ├── background.test.ts # Background utility tests
    └── flexbox-grid.test.ts # Flexbox & Grid tests
```

### [cssma-plugin](./apps/cssma-plugin/)
A powerful Figma plugin that brings the cssma library directly into the Figma interface.

**Plugin Features:**
- ⚡ **Real-time Conversion** - Convert between CSS and Figma styles instantly
- 🔄 **Bulk Operations** - Apply styles to multiple elements simultaneously  
- 🎨 **Design System Integration** - Work with Figma variables and components
- 📤 **Code Export** - Export designs as clean Tailwind CSS code

## 🚀 Development & Release

### 📋 Release Management with Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for version management and automated releases.

#### Creating a Changeset

When you make changes that should be included in a release:

```bash
# Create a new changeset
pnpm changeset

# Check current changeset status
pnpm changeset:status
```

#### Release Process

```bash
# 1. Version packages (updates package.json and CHANGELOG.md)
pnpm changeset:version

# 2. Build and publish packages
pnpm release
```

#### Changeset Types

- **patch** - Bug fixes and small improvements
- **minor** - New features that don't break existing functionality
- **major** - Breaking changes

#### Automated Releases

The project includes GitHub Actions workflow that automatically:
- Creates release PRs when changesets are added
- Publishes packages to NPM when release PRs are merged
- Updates changelogs and version numbers

### 🔧 Development Commands

```bash
# Install dependencies
pnpm install

# Start development mode
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test

# Run tests for specific preset category
pnpm test packages/cssma-v4/tests/presets/layout.test.ts
pnpm test packages/cssma-v4/tests/presets/sizing.test.ts

# Run tests in watch mode
pnpm test --watch

# Clean build artifacts
pnpm clean
```

### 🧪 Testing Strategy

The project follows a comprehensive testing approach:

- **Unit Tests**: Each preset category has dedicated test files
- **Integration Tests**: Cross-preset functionality testing
- **Regression Tests**: Ensuring backward compatibility
- **Performance Tests**: Utility parsing and processing benchmarks

```bash
# Test coverage by category
├── Layout Tests (150+ test cases)
├── Sizing Tests (120+ test cases)  
├── Spacing Tests (80+ test cases)
├── Typography Tests (200+ test cases)
├── Background Tests (100+ test cases)
└── Flexbox & Grid Tests (180+ test cases)
```

## 📚 Documentation

### 📖 **Core Library**
- **[API Documentation](./packages/cssma-v4/README.md)** - Complete library reference
- **[Specification Docs](./docs/)** - Detailed technical specifications

### 🔧 **Getting Started**
- **[Installation Guide](./packages/cssma-v4/README.md#installation)** - Setup instructions
- **[Quick Start](./packages/cssma-v4/README.md#quick-start)** - Basic usage examples
- **[Plugin Setup](./apps/cssma-plugin/README.md)** - Figma plugin installation

## 🚀 Quick Examples

### Glass Morphism Card
```typescript
const glassCard = {
  type: 'FRAME',
  name: 'Glass Card',
  styles: 'w-[320] h-[200] bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-[24]',
  children: [
    {
      type: 'TEXT',
      name: 'Title',
      styles: 'text-white text-xl font-bold',
      text: 'Glass Effect'
    }
  ]
};
```

### Modern Button System
```typescript
const buttonVariants = {
  primary: 'px-[20] py-[12] bg-blue-600 text-white rounded-lg font-medium shadow-md',
  secondary: 'px-[20] py-[12] bg-gray-100 text-gray-900 rounded-lg font-medium',
  ghost: 'px-[20] py-[12] text-blue-600 hover:bg-blue-50 rounded-lg font-medium'
};
```

## 🎨 Supported Features

| Category | Support | Examples |
|----------|---------|----------|
| **Layout** | ✅ Complete | `flex-col`, `grid`, `w-full`, `gap-4` |
| **Colors** | ✅ Complete | `bg-blue-500`, `text-[#FF0000]`, gradients |
| **Typography** | ✅ Complete | `text-lg`, `font-bold`, `leading-tight` |
| **Effects** | ✅ Complete | `shadow-lg`, `blur-md`, `backdrop-blur-xl` |
| **Position** | ✅ Complete | `absolute`, `center-x`, `stretch-y` |
| **Borders** | ✅ Complete | `border-2`, `rounded-lg`, `border-dashed` |
| **Variables** | ✅ Complete | `bg-$[color/primary]`, variable binding |

## 🛠️ Installation

```bash
# Install the core library
npm install cssma-v4

# Or using pnpm
pnpm add cssma-v4

# Or using yarn
yarn add cssma-v4
```

## 🤝 Contributing

We welcome contributions! Please check out:

- **[Contributing Guide](./CONTRIBUTING.md)** - Guidelines for contributors
- **[Issue Tracker](https://github.com/easylogic/figmaikr/issues)** - Bug reports and feature requests
- **[Discussions](https://github.com/easylogic/figmaikr/discussions)** - Community discussions

### Contributing Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add a changeset: `pnpm changeset`
5. Commit your changes
6. Create a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **[NPM Package](https://www.npmjs.com/package/cssma-v4)**
- **[Figma Plugin](https://www.figma.com/community/plugin/cssma)**
- **[Documentation](./docs/)**
- **[Changelog](./CHANGELOG.md)**

---

**Made with ❤️ for the design and development community**
