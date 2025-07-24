# CSSMA v4

A utility class system compatible with Tailwind CSS that converts CSS class names to Figma styles.

## 🚀 Features

- **Registry-based Parsing**: Ensures safety by parsing only registered utilities
- **Static & Functional Utilities**: Supports both fixed and dynamic value processing
- **Tailwind CSS Compatibility**: Compatible with Tailwind CSS syntax
- **Arbitrary Values**: Supports arbitrary values in `bg-[red]` format
- **Custom Properties**: Supports custom properties in `bg-(--my-bg)` format
- **Negative Values**: Supports negative values in `-inset-x-2` format
- **Modular Preset System**: Organized preset structure by categories

## 📦 Installation

```bash
npm install cssma-v4
```

## 🔧 Usage

### Basic Usage

```typescript
import { applyClassName, createContext } from 'cssma-v4';

const ctx = createContext({
  theme: {
    colors: { 'red-500': '#ef4444' },
    spacing: { '4': '1rem' }
  }
});

// Static Utility
const result1 = applyClassName('inset-x-auto', ctx);
// [{ type: 'decl', prop: 'inset-inline', value: 'auto' }]

// Functional Utility
const result2 = applyClassName('inset-x-4', ctx);
// [{ type: 'decl', prop: 'inset-inline', value: 'calc(var(--spacing) * 4)' }]

// Negative Values
const result3 = applyClassName('-inset-x-2', ctx);
// [{ type: 'decl', prop: 'inset-inline', value: 'calc(var(--spacing) * -2)' }]

// Arbitrary Values
const result4 = applyClassName('bg-[#ff0000]', ctx);
// [{ type: 'decl', prop: 'background-color', value: '#ff0000' }]

// Custom Properties
const result5 = applyClassName('bg-(--my-bg)', ctx);
// [{ type: 'decl', prop: 'background-color', value: 'var(--my-bg)' }]
```

### Preset Categories

CSSMA v4 provides utilities organized by preset categories:

#### Core Layout & Spacing
- **layout.ts**: Display, position, z-index, overflow, visibility
- **flexbox-grid.ts**: Flexbox and Grid layout utilities
- **spacing.ts**: Padding, margin, and space utilities
- **sizing.ts**: Width, height, min/max dimensions

#### Styling & Visual Effects
- **background.ts**: Background colors, gradients, patterns
- **border.ts**: Border styles, colors, radius, width
- **typography.ts**: Font families, sizes, weights, text alignment
- **effects.ts**: Box shadows, ring effects, opacity

#### Advanced Features
- **transform.ts**: Transform, rotate, scale, translate, skew
- **filter.ts**: CSS filter utilities (blur, brightness, etc.)
- **backdrop-filter.ts**: Backdrop filter utilities
- **transitions.ts**: Transition properties, duration, easing

#### Interactive & Accessibility
- **interactivity.ts**: Cursor, user-select, pointer-events
- **accessibility.ts**: Screen reader utilities
- **table.ts**: Table layout and styling
- **svg.ts**: SVG fill, stroke, styling

### Utility Registration

#### staticUtility
Registers exact-match utilities with fixed CSS values:

```typescript
staticUtility('inset-x-auto', [['inset-inline', 'auto']]);
staticUtility('truncate', [
  ['overflow', 'hidden'],
  ['text-overflow', 'ellipsis'],
  ['white-space', 'nowrap'],
]);
```

#### functionalUtility
Registers prefix-based utilities with dynamic value processing:

```typescript
functionalUtility({
  name: 'w',
  prop: 'width',
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsFraction: true,
  handleBareValue: ({ value }) => {
    if (parseNumber(value)) return `calc(var(--spacing) * ${value})`;
    if (parseFractionOrNumber(value)) return `calc(${value} * 100%)`;
    return null;
  },
});
```

### Variant System

CSSMA v4 includes a comprehensive variant system:

#### Basic Variants
- **pseudo-classes.ts**: `:hover`, `:focus`, `:active`, etc.
- **form-states.ts**: `:checked`, `:disabled`, `:required`, etc.
- **structural-selectors.ts**: `:first-child`, `:last-child`, etc.
- **group-peer.ts**: `group-hover`, `peer-hover`, etc.

#### Advanced Variants
- **responsive.ts**: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`
- **dark-mode.ts**: `dark:` with configurable selectors
- **container-queries.ts**: `@sm:`, `@container/main:`
- **arbitrary-variants.ts**: `[&>*]:`, `aria-[pressed=true]:`

#### Variant Registration
```typescript
// Static modifier
staticModifier('hover', ['&:hover'], { source: 'pseudo' });

// Functional modifier
functionalModifier(
  (mod: string) => /^has-\[.*\]$/.test(mod),
  ({ selector, mod }) => {
    const m = /^has-\[(.+)\]$/.exec(mod.type);
    return m ? `${selector}:has(${m[1]})` : selector;
  }
);
```

> **Note:**
> The application order of variants is determined by the engine's source/type priority, not by registration or an `order` option. For consistent results, always rely on the engine’s built-in sorting logic.

## 🏗️ Architecture

### Core Systems

#### Registry System
Central registration for utilities and modifiers:

```typescript
registerUtility({
  name: 'my-utility',
  match: (className) => className.startsWith('my-utility-'),
  handler: (value, ctx, token) => {
    return [decl('my-property', value)];
  }
});
```

#### Parser System
Parses class names into utilities and modifiers:

```typescript
parseClassName('hover:inset-x-4');
// {
//   modifiers: [{ type: 'hover' }],
//   utility: { prefix: 'inset-x', value: '4', negative: false }
// }
```

#### Engine System
Converts class names to AST and CSS:

```typescript
// Single class to AST
const ast = applyClassName('sm:hover:bg-red-500', ctx);

// Multiple classes to CSS
const css = generateUtilityCss('sm:hover:bg-red-500', ctx);
// @media (min-width: 640px) {
//   .sm\:hover\:bg-red-500:hover {
//     background-color: #ef4444;
//   }
// }
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific tests
npm test -- --grep "inset"

# Check coverage
npm run test:coverage
```

### Test Examples

```typescript
// Static Utility Tests
expect(applyClassName('-inset-x-px', ctx)).toEqual([
  { type: 'decl', prop: 'inset-inline', value: '-1px' }
]);

// Functional Utility Tests
expect(applyClassName('inset-x-4', ctx)).toEqual([
  { type: 'decl', prop: 'inset-inline', value: 'calc(var(--spacing) * 4)' }
]);

// Arbitrary Value Tests
expect(applyClassName('bg-[#ff0000]', ctx)).toEqual([
  { type: 'decl', prop: 'background-color', value: '#ff0000' }
]);
```

## 📚 API Reference

### Core Functions

- `applyClassName(className: string, ctx: CssmaContext): AstNode[]`
- `generateUtilityCss(classList: string, ctx: CssmaContext, opts?: object): string`
- `parseClassName(className: string): { modifiers: ParsedModifier[], utility: ParsedUtility }`
- `createContext(config: CssmaConfig): CssmaContext`

### Registration Functions

- `staticUtility(name: string, decls: [string, string][], opts?: object): void`
- `functionalUtility(opts: FunctionalUtilityOptions): void`
- `staticModifier(name: string, selectors: string[], options?: object): void`
- `functionalModifier(match: Function, modifySelector: Function, wrap?: Function, options?: object): void`

### Types

- `CssmaContext`: Context object with theme and configuration
- `AstNode`: AST node type for CSS representation
- `ParsedUtility`: Parsed utility type
- `ParsedModifier`: Parsed modifier type

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
