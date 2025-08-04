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
- **Runtime CSS Injection**: Optimized runtime CSS injection with caching and batch processing
- **Common CSS Caching**: Efficient caching system for shared CSS variables and rules
- **Incremental Parsing**: Server and browser-compatible incremental parsing system
- **Change Detection**: Automatic DOM change detection with MutationObserver
- **Performance Monitoring**: Real-time performance tracking and optimization

## 📦 Installation

```bash
npm install cssma-v4
```

## 🔧 Usage

### Basic Usage

```typescript
import { parseClassToAst, createContext } from 'cssma-v4';

const ctx = createContext({
  theme: {
    colors: { 'red-500': '#ef4444' },
    spacing: { '4': '1rem' }
  }
});

// Static Utility
const result1 = parseClassToAst('inset-x-auto', ctx);
// [{ type: 'decl', prop: 'inset-inline', value: 'auto' }]

// Functional Utility
const result2 = parseClassToAst('inset-x-4', ctx);
// [{ type: 'decl', prop: 'inset-inline', value: 'calc(var(--spacing) * 4)' }]

// Negative Values
const result3 = parseClassToAst('-inset-x-2', ctx);
// [{ type: 'decl', prop: 'inset-inline', value: 'calc(var(--spacing) * -2)' }]

// Arbitrary Values
const result4 = parseClassToAst('bg-[#ff0000]', ctx);
// [{ type: 'decl', prop: 'background-color', value: '#ff0000' }]

// Custom Properties
const result5 = parseClassToAst('bg-(--my-bg)', ctx);
// [{ type: 'decl', prop: 'background-color', value: 'var(--my-bg)' }]
```

### Runtime CSS Injection

CSSMA v4 provides an optimized runtime system for dynamic CSS injection:

```typescript
import { StyleRuntime } from 'cssma-v4';

// Initialize runtime with custom options
const runtime = new StyleRuntime({
  theme: defaultTheme,
  styleId: 'my-app-styles',
  enableDev: true,
  insertionPoint: 'head' // or 'body' or HTMLElement
});

// Add classes dynamically
runtime.addClass('bg-red-500 text-white p-4');

// Observe DOM changes automatically
const observer = runtime.observe(document.body, {
  scan: true,        // Scan existing elements
  debounceMs: 16     // Debounce mutations
});

// Manual class management
runtime.addClass(['hover:bg-blue-500', 'focus:ring-2']);
runtime.removeClass('bg-red-500');
runtime.has('text-white'); // Check if class is cached
runtime.getCss('bg-red-500'); // Get generated CSS

// Cleanup
runtime.destroy();
```

### Incremental Parsing (Server & Browser)

CSSMA v4 provides a universal incremental parsing system that works in both server and browser environments:

```typescript
import { IncrementalParser, createContext } from 'cssma-v4';

// Create context with theme
const ctx = createContext({ theme: defaultTheme });

// Universal parser (works in Node.js and browser)
const parser = new IncrementalParser(ctx);

// Process classes synchronously
const results = parser.processClasses(['bg-blue-500', 'text-lg']);
// Returns: [{ className: 'bg-blue-500', ast: [...], css: '...' }, ...]

// Process single class
const result = parser.processClass('bg-red-500');
// Returns: { ast: [...], css: '...' }

// Get statistics
const stats = parser.getStats();
// Returns: { processedClasses: 2, pendingClasses: 0, ... }

// Clear processed classes (useful for theme changes)
parser.clearProcessed();
```

### Change Detection (Browser Only)

For browser environments, CSSMA v4 provides automatic DOM change detection:

```typescript
import { IncrementalParser, ChangeDetector, StyleRuntime } from 'cssma-v4';

// Create components
const parser = new IncrementalParser(ctx);
const styleRuntime = new StyleRuntime();
const detector = new ChangeDetector(parser, styleRuntime);

// Start observing DOM changes
const observer = detector.observe(document.body, {
  scan: true,        // Scan existing elements
  debounceMs: 16     // Debounce mutations
});

// The detector automatically:
// - Scans existing classes in the DOM
// - Monitors for new class additions
// - Processes classes and injects CSS
// - Updates StyleRuntime cache

// Disconnect when done
observer.disconnect();
```

### Runtime Features

#### **Optimized Performance**
- **Debounced MutationObserver**: Prevents excessive CSS generation during rapid DOM changes
- **Batch Processing**: Groups multiple class additions for efficient CSS injection
- **Smart Caching**: Avoids regenerating CSS for already processed classes
- **Common CSS Caching**: Shares common CSS variables and rules across multiple classes
- **Incremental Parsing**: Processes only new or changed classes
- **Memory Optimization**: Uses WeakMap and compression for efficient memory usage

#### **Flexible Style Management**
- **Multiple Style Elements**: Separate elements for regular CSS, root CSS variables, and CSS variables
- **Safe DOM Operations**: Graceful handling of style sheet access and rule insertion
- **Development Mode**: Enhanced logging and debugging capabilities
- **Custom Insertion Points**: Control where style elements are placed in the DOM

#### **Advanced Features**
- **Theme Hot Reloading**: Update theme at runtime with automatic CSS regeneration
- **Statistics Tracking**: Monitor cache size, rule count, and performance metrics
- **Memory Management**: Proper cleanup of style elements and caches
- **Error Handling**: Robust error handling for invalid CSS rules
- **Performance Monitoring**: Real-time performance tracking with alerts

### Cache Architecture

CSSMA v4 implements a comprehensive caching system for optimal performance


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
> The application order of variants is determined by the engine's source/type priority, not by registration or an `order` option. For consistent results, always rely on the engine's built-in sorting logic.

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
const ast = parseClassToAst('sm:hover:bg-red-500', ctx);

// Multiple classes to CSS
const css = generateCss('sm:hover:bg-red-500', ctx);
// @media (min-width: 640px) {
//   .sm\:hover\:bg-red-500:hover {
//     background-color: #ef4444;
//   }
// }
```

#### Runtime System
Optimized CSS injection and management:

```typescript
// Runtime initialization with custom options
const runtime = new StyleRuntime({
  theme: customTheme,
  styleId: 'app-styles',
  enableDev: process.env.NODE_ENV === 'development'
});

// Automatic DOM observation with debouncing
const observer = runtime.observe(document.body, {
  scan: true,
  debounceMs: 16
});

// Manual class management with caching
runtime.addClass(['bg-red-500', 'text-white']);
runtime.getStats(); // { cachedClasses: 2, cssRules: 2, ... }
```

#### Incremental Parser System
Universal parsing for server and browser environments:

```typescript
// Create universal parser
const parser = new IncrementalParser(ctx);

// Process classes with caching
const results = parser.processClasses(['bg-blue-500', 'text-lg']);
// Each result contains: { className, ast, css }

// Get performance statistics
const stats = parser.getStats();
// { processedClasses: 2, pendingClasses: 0, ... }
```

#### Change Detection System
Browser-only DOM change monitoring:

```typescript
// Create change detector with parser and runtime
const detector = new ChangeDetector(parser, styleRuntime);

// Start observing with options
const observer = detector.observe(document.body, {
  scan: true,        // Scan existing elements
  debounceMs: 16     // Debounce mutations
});

// Automatically processes new classes and injects CSS
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
expect(parseClassToAst('-inset-x-px', ctx)).toEqual([
  { type: 'decl', prop: 'inset-inline', value: '-1px' }
]);

// Functional Utility Tests
expect(parseClassToAst('inset-x-4', ctx)).toEqual([
  { type: 'decl', prop: 'inset-inline', value: 'calc(var(--spacing) * 4)' }
]);

// Arbitrary Value Tests
expect(parseClassToAst('bg-[#ff0000]', ctx)).toEqual([
  { type: 'decl', prop: 'background-color', value: '#ff0000' }
]);

// Runtime Tests
const runtime = new StyleRuntime();
runtime.addClass('bg-red-500');
expect(runtime.has('bg-red-500')).toBe(true);
expect(runtime.getCss('bg-red-500')).toContain('background-color');

// Incremental Parser Tests
const parser = new IncrementalParser(ctx);
const results = parser.processClasses(['bg-blue-500']);
expect(results[0].className).toBe('bg-blue-500');
expect(results[0].css).toContain('background-color');

// Change Detection Tests
const detector = new ChangeDetector(parser, runtime);
const observer = detector.observe(document.body, { scan: true });
expect(observer).toBeInstanceOf(MutationObserver);
```

## 📚 API Reference

### Core Functions

- `parseClassToAst(className: string, ctx: CssmaContext): AstNode[]`
- `generateCss(classList: string, ctx: CssmaContext, opts?: object): string`
- `parseClassName(className: string): { modifiers: ParsedModifier[], utility: ParsedUtility }`
- `createContext(config: CssmaConfig): CssmaContext`

### Runtime Functions

- `new StyleRuntime(options?: StyleRuntimeOptions): StyleRuntime`
- `runtime.addClass(classes: string | string[]): void`
- `runtime.observe(root: HTMLElement, options?: object): MutationObserver`
- `runtime.has(cls: string): boolean`
- `runtime.getCss(cls: string): string | undefined`
- `runtime.getStats(): RuntimeStats`
- `runtime.destroy(): void`

### Incremental Parser Functions

- `new IncrementalParser(ctx: CssmaContext): IncrementalParser`
- `parser.processClasses(classes: string[]): Array<{ className: string; ast: any[]; css: string }>`
- `parser.processClass(className: string): { ast: any[]; css: string } | null`
- `parser.getStats(): ParserStats`
- `parser.clearProcessed(): void`

### Change Detection Functions

- `new ChangeDetector(parser: IncrementalParser, styleRuntime?: StyleRuntime): ChangeDetector`
- `detector.observe(root: HTMLElement, options?: object): MutationObserver`
- `detector.disconnect(): void`

### Cache Functions

- `astCache.get(key: string): AstNode[] | undefined`
- `cssCache.get(key: string): string | undefined`
- `parseResultCache.get(key: string): ParsedResult | undefined`
- `utilityCache.get(key: string): boolean | undefined`

### Performance Monitoring Functions

- `new CSSMAPerformanceMonitor(): CSSMAPerformanceMonitor`
- `monitor.record(metric: string, value: number): void`
- `monitor.getStats(): PerformanceStats`
- `monitor.getDetailedReport(): DetailedReport`

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
- `StyleRuntimeOptions`: Runtime configuration options
- `RuntimeStats`: Runtime performance statistics
- `ParserStats`: Parser performance statistics
- `PerformanceStats`: Performance monitoring statistics

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
