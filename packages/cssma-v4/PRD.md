# CSSMA v4 Product Requirements Document (PRD)

## Overview

CSSMA v4 is a utility-first CSS framework that transforms Tailwind CSS-compatible class names into CSS AST nodes for Figma styling. The system is built around a modular architecture with clear separation of concerns, including an optimized runtime system for dynamic CSS injection, universal incremental parsing, and comprehensive caching architecture.

## Core Systems

### 1. Engine System (`engine.ts`)

**Design Intent:**
- **Single Entry Point:** All class name transformations start here
- **Extensibility:** Plugins/custom parsers/handlers can easily hook into the process
- **Common CSS Caching:** Efficient caching system for shared CSS variables and rules

**Main Functions:**
- `parseClassToAst(className, ctx): AstNode[]` - Parses single utility class and returns AST nodes
- `generateCss(classList, ctx, opts?): string` - Converts multiple classes to CSS with common CSS caching
- Handles modifiers, negative values, arbitrary values, and custom properties
- Supports atRoot nodes for common CSS variable management

### 2. AST System (`ast.ts`)

**AST Node Types:**
- `decl`: CSS property declaration (e.g., `{ type: 'decl', prop: 'color', value: '#fff' }`)
- `atrule`: CSS at-rule (e.g., `{ type: 'atrule', name: 'supports', params: '...', nodes: [...] }`)
- `rule`: CSS selector rule (e.g., `{ type: 'rule', selector: '.foo', nodes: [...] }`)
- `atRoot`: Common CSS variables and rules (e.g., `{ type: 'atRoot', nodes: [...] }`)
- `comment`: Comment node

**AST Construction:**
- All handler functions must return AST nodes in this format
- AST is designed to be serializable to CSS or Figma style objects
- atRoot nodes are automatically collected and cached for efficiency

### 3. Parser System (`parser.ts`)

**Components:**
- **Tokenizer**: Splits class names by `:` while respecting nested brackets/parentheses
- **Parser**: Consumes tokens, classifies as utility/modifier, supports bidirectional parsing
- **Error Handling**: Returns null/empty for invalid or malformed input

**Test Coverage:**
- 60+ tokenizer tests (nested, arbitrary, advanced Tailwind v4)
- 10+ parser tests (bidirectional, error, edge cases)

### 4. Registry System (`registry.ts`)

**Utility Registration:**
- **staticUtility:** Registers exact-match utilities (e.g., `block`, `inline-block`)
- **functionalUtility:** Registers prefix-based utilities (e.g., `bg-`, `text-`, `m-`)
- Utilities are registered with handler functions and options

**Handler Resolution:**
- On class name match, corresponding handler is called with parsed value and context
- Handler returns AST nodes for the utility

### 5. Preset System (`presets/`)

**Structure:**
- Each preset file registers a group of related utilities with comprehensive functionality
- Presets are imported and registered in the main registry (`src/presets/index.ts`)
- All presets support static, functional, arbitrary, and custom property cases

**Utility Categories:**

#### Core Layout & Spacing
- **layout.ts**: Display, position, z-index, overflow, visibility utilities
- **flexbox-grid.ts**: Flexbox and Grid layout utilities (flex, grid, gap, etc.)
- **spacing.ts**: Padding, margin, and space utilities
- **sizing.ts**: Width, height, min/max dimensions utilities

#### Styling & Visual Effects
- **background.ts**: Background colors, gradients, and patterns
- **border.ts**: Border styles, colors, radius, and width utilities
- **typography.ts**: Font families, sizes, weights, text alignment, and line height
- **effects.ts**: Box shadows, ring effects, and opacity utilities

#### Advanced Features
- **transform.ts**: Transform, rotate, scale, translate, skew utilities
- **filter.ts**: CSS filter utilities (blur, brightness, contrast, etc.)
- **backdrop-filter.ts**: Backdrop filter utilities for overlays
- **transitions.ts**: Transition properties, duration, easing utilities

#### Interactive & Accessibility
- **interactivity.ts**: Cursor, user-select, pointer-events utilities
- **accessibility.ts**: Screen reader utilities (sr-only, not-sr-only)
- **table.ts**: Table layout and styling utilities
- **svg.ts**: SVG fill, stroke, and styling utilities

**Test Coverage:**
- Each preset has a corresponding test file with comprehensive test cases
- Tests cover static, functional, arbitrary, custom property, and negative value cases
- All utilities include edge cases and error handling validation

### 6. Variant System (`presets/variants/`)

**Modular Structure:**

#### Basic Variants
- **pseudo-classes.ts**: Basic pseudo-class variants (`:hover`, `:focus`, `:active`, etc.)
- **form-states.ts**: Form state variants (`:checked`, `:disabled`, `:required`, etc.)
- **structural-selectors.ts**: Structural selector variants (`:first-child`, `:last-child`, etc.)
- **media-features.ts**: Media feature variants (`motion-safe`, `print`, `portrait`, etc.)
- **group-peer.ts**: Group and peer variants (`group-hover`, `peer-hover`, etc.)
- **attribute-selectors.ts**: Attribute selector variants (`rtl`, `ltr`, `inert`, `open`)

#### Advanced Variants
- **nth-selectors.ts**: Nth-child selector variants (`nth-1`, `nth-last-1`, etc.)
- **functional-selectors.ts**: Functional selector variants (`is-[.foo]`, `where-[.bar]`)
- **at-rules.ts**: At-rule variants (`supports-[display:grid]`, `layer-[utilities]`, `scope-[.parent]`)
- **group-peer-extensions.ts**: Extended group/peer variants (`group-focus`, `peer-active`, etc.)

#### Specialized Variants
- **responsive.ts**: Responsive breakpoint variants (`sm:`, `md:`, `lg:`, etc.)
- **dark-mode.ts**: Dark mode variants with configurable selectors
- **container-queries.ts**: Container query variants (`@sm:`, `@container/main:`, etc.)
- **has-variants.ts**: Has selector variants (`has-[.child]`, `has-[.foo>.bar]`)
- **negation-variants.ts**: Negation variants (`not-hover:`, `not-[open]:`, etc.)
- **universal-selectors.ts**: Universal selector variants (`*:`, `**:`)
- **arbitrary-variants.ts**: Arbitrary variants (`[&>*]:`, `aria-[pressed=true]:`, etc.)
- **attribute-variants.ts**: Attribute variants (`[open]:`, `[dir=rtl]:`, etc.)

**Variant Registration Patterns:**

```typescript
// Static modifiers
staticModifier('hover', ['&:hover'], { source: 'pseudo' });
staticModifier('focus', ['&:focus'], { source: 'pseudo' });
staticModifier('disabled', ['&:disabled'], { source: 'pseudo' });

// Functional modifiers
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

**Variant Testing:**
- Each variant category has comprehensive tests covering all supported patterns
- Tests include modifier combinations, nesting, and edge cases
- All 148 variant tests pass, ensuring complete functionality

### 7. Runtime System (`runtime.ts`)

**Design Intent:**
- **Optimized Performance:** Efficient CSS injection with debouncing and batch processing
- **Smart Caching:** Avoids regenerating CSS for already processed classes
- **Common CSS Management:** Shares common CSS variables and rules across multiple classes
- **Safe DOM Operations:** Graceful handling of style sheet access and rule insertion

**Core Features:**

#### **Style Element Management**
- **Multiple Style Elements:** Separate elements for regular CSS, root CSS variables, and CSS variables
- **Safe Creation:** `createStyleElement()` method for consistent style element creation
- **Flexible Insertion:** Custom insertion points (head, body, or specific HTMLElement)
- **Memory Management:** Proper cleanup of style elements and caches

#### **CSS Rule Injection**
- **Safe Rule Insertion:** `insertRuleToSheet()` with error handling and logging
- **Batch Processing:** `insertRulesToSheet()` for efficient multiple rule insertion
- **Content Synchronization:** `syncStyleElementContent()` for consistent textContent management
- **Success/Failure Tracking:** Comprehensive statistics for rule insertion success rates

#### **Performance Optimizations**
- **Debounced MutationObserver:** Prevents excessive CSS generation during rapid DOM changes
- **Smart Caching:** Avoids regenerating CSS for already processed classes
- **Batch Processing:** Groups multiple class additions for efficient CSS injection
- **Common CSS Caching:** Shares common CSS variables and rules across multiple classes

#### **Advanced Features**
- **Theme Hot Reloading:** Update theme at runtime with automatic CSS regeneration
- **Statistics Tracking:** Monitor cache size, rule count, and performance metrics
- **Development Mode:** Enhanced logging and debugging capabilities
- **Error Handling:** Robust error handling for invalid CSS rules

**Runtime API:**
```typescript
// Runtime initialization
const runtime = new StyleRuntime({
  theme: customTheme,
  styleId: 'app-styles',
  enableDev: process.env.NODE_ENV === 'development',
  insertionPoint: 'head'
});

// Class management
runtime.addClass('bg-red-500 text-white');
runtime.removeClass('bg-red-500');
runtime.has('text-white');
runtime.getCss('bg-red-500');

// DOM observation
const observer = runtime.observe(document.body, {
  scan: true,
  debounceMs: 16
});

// Statistics and cleanup
runtime.getStats();
runtime.destroy();
```

### 8. Incremental Parser System (`incremental-parser.ts`)

**Design Intent:**
- **Universal Compatibility:** Works in both Node.js and browser environments
- **Efficient Processing:** Processes only new or changed classes to avoid redundant work
- **Smart Caching:** Tracks processed classes to prevent duplicate processing
- **Batch Processing:** Groups multiple operations for optimal performance

**Core Components:**

#### **IncrementalParser Class**
- **Universal Design:** Pure CSS processing logic without browser dependencies
- **Class Tracking:** Maintains set of processed classes to avoid duplicates
- **Batch Processing:** Configurable batch size for optimal performance
- **Debouncing:** Server-appropriate debouncing (immediate processing in Node.js)

**Key Methods:**
```typescript
// Process multiple classes with caching
const results = parser.processClasses(['bg-blue-500', 'text-lg']);
// Returns: [{ className: 'bg-blue-500', ast: [...], css: '...' }, ...]

// Process single class
const result = parser.processClass('bg-red-500');
// Returns: { ast: [...], css: '...' }

// Get performance statistics
const stats = parser.getStats();
// Returns: { processedClasses: 2, pendingClasses: 0, ... }

// Clear processed classes (useful for theme changes)
parser.clearProcessed();
```

#### **ChangeDetector Class**
- **Browser-Only:** Uses MutationObserver for DOM change detection
- **Automatic Processing:** Scans existing classes and monitors for new additions
- **StyleRuntime Integration:** Directly updates StyleRuntime cache and injects CSS
- **Flexible Configuration:** Supports scan options and debouncing

**Key Features:**
```typescript
// Create change detector with parser and runtime
const detector = new ChangeDetector(parser, styleRuntime);

// Start observing with options
const observer = detector.observe(document.body, {
  scan: true,        // Scan existing elements
  debounceMs: 16     // Debounce mutations
});

// Automatically:
// - Scans existing classes in the DOM
// - Monitors for new class additions
// - Processes classes and injects CSS
// - Updates StyleRuntime cache
```

**Architecture Benefits:**
- **Separation of Concerns:** Parser handles pure logic, ChangeDetector handles DOM
- **Server Compatibility:** IncrementalParser works in Node.js environments
- **Performance Optimization:** Avoids redundant processing through smart tracking
- **Memory Efficiency:** Uses WeakMap and compression for optimal memory usage

### 9. Cache System (`utils/cache.ts`)

**Design Intent:**
- **Comprehensive Caching:** Multiple cache types for different performance needs
- **Memory Optimization:** Uses WeakMap and compression for efficient memory usage
- **Performance Monitoring:** Real-time cache statistics and hit rate tracking
- **Modular Design:** Centralized cache management with clear separation of concerns

**Cache Components:**

#### **Core Caches**
- **AstCache:** Caches parsed AST nodes for class names
- **CssCache:** Caches generated CSS strings for AST nodes
- **ParseResultCache:** Caches parsed class name results
- **UtilityCache:** Caches utility prefix checks

#### **Advanced Cache Features**
- **CompressedCache:** Memory-optimized storage with compression
- **MemoryPool:** Object reuse for garbage collection optimization
- **WeakCache:** Memory-optimized cache using WeakMap

**Cache API:**
```typescript
// Core caches
import { astCache, cssCache, parseResultCache, utilityCache } from 'cssma-v4/utils/cache';

const ast = astCache.get('bg-blue-500');
const css = cssCache.get('bg-blue-500');
const parsed = parseResultCache.get('bg-blue-500');
const isUtility = utilityCache.get('bg-');

// Advanced caches
import { CompressedCache, MemoryPool, WeakCache } from 'cssma-v4/utils/cache';

const compressedCache = new CompressedCache();
compressedCache.setAst('bg-blue-500', ast);
compressedCache.setCss('bg-blue-500', css);

const memoryPool = new MemoryPool(() => ({}), 100);
const obj = memoryPool.acquire();
// Use object...
memoryPool.release(obj);

const weakCache = new WeakCache();
weakCache.set(element, css);
```

### 10. Performance Monitoring System (`utils/performance.ts`)

**Design Intent:**
- **Real-time Monitoring:** Track performance metrics across all operations
- **Comprehensive Statistics:** Detailed performance analysis and reporting
- **Alert System:** Performance threshold monitoring with alerts
- **Memory Tracking:** Monitor memory usage and optimization opportunities

**Core Components:**

#### **CSSMAPerformanceMonitor**
- **Metric Recording:** Track parser, AST, CSS generation times
- **Statistics Calculation:** Average, total, count for each metric
- **Memory Monitoring:** Track memory usage and garbage collection
- **Alert System:** Performance threshold monitoring

#### **PerformanceMixin**
- **Composition Pattern:** Mixin for performance monitoring without inheritance
- **Automatic Integration:** Easy integration with existing classes
- **Minimal Overhead:** Efficient performance tracking with minimal impact

**Performance API:**
```typescript
import { CSSMAPerformanceMonitor } from 'cssma-v4/utils/performance';

const monitor = new CSSMAPerformanceMonitor();

// Record performance metrics
monitor.record('parser', 1.5);
monitor.record('ast', 2.1);
monitor.record('css', 0.8);

// Get statistics
const stats = monitor.getStats();
// { parser: { count: 1, total: 1.5, average: 1.5 }, ... }

// Get detailed report
const report = monitor.getDetailedReport();
// Comprehensive performance analysis
```

### 11. Theme System

**Theme Lookup:**
- Always use both category and key for theme lookups (e.g., `ctx.theme('colors', 'red-500')`)
- Never look up by key only (e.g., `'red-500'`), as keys may overlap across categories
- Handlers must reference the correct theme category for each utility

### 12. Engine & CSS Conversion

#### Engine (`engine.ts`)
- className → AST conversion (`parseClassToAst`)
- Multiple classNames → utility CSS (`generateCss`)
- Supports breakpoints, variants, arbitrary values, custom properties, and all Tailwind v4 syntax
- Common CSS caching for shared variables and rules

#### CSS Converter (`astToCss.ts`)
- AST → standard CSS string conversion
- Selector escaping (`\:` etc.) is 100% identical to Tailwind CSS
- Supports at-rules (@media), nesting, complex selectors, arbitrary values, etc.
- atRoot nodes converted to `:root` or `:host` selectors

#### Style Tag Application
- generateCss output can be directly inserted into `<style>` tag
- Escaped selectors are correctly interpreted by browsers (identical to Tailwind, CSS-in-JS)
- Runtime system provides optimized CSS injection with caching and batch processing

#### End-to-End Flow
1. className → AST (`parseClassToAst`)
2. AST → CSS (`astToCss`)
3. Multiple classNames → utility CSS (`generateCss`)
4. CSS → insert into `<style>` tag (via runtime system)

#### Testing Strategy
- `engine.basic.test.ts`: End-to-end validation from className → AST → CSS → expected value
- Covers selector escaping, responsive, arbitrary, variants, custom properties, and all cases
- Expected values match actual CSS output 1:1 (fully compatible with Tailwind)
- Runtime tests cover CSS injection, caching, and performance optimizations

## Extensibility & Best Practices

- All utility registration and handler logic should be modular and easily extendable
- New utility categories or custom plugins can be added by creating new preset files and registering them in the registry
- All new features must include comprehensive tests and documentation
- Runtime system provides hooks for custom CSS injection strategies
- Common CSS caching can be extended for custom caching strategies
- Incremental parser can be extended for custom processing strategies
- Performance monitoring can be customized for specific use cases

## Testing & Quality Assurance

- 100% test coverage for all core logic and presets
- Tests must cover static, functional, arbitrary, custom property, and modifier cases
- All tests must be written in clear, unambiguous language, specifying exact expected AST output
- Runtime tests cover CSS injection, caching, performance, and error handling
- Incremental parser tests cover server and browser compatibility
- Change detection tests cover DOM observation and automatic processing
- Cache tests cover memory optimization and performance
- Performance benchmarks for large-scale CSS generation and injection

## Documentation

- All core systems, presets, and handler patterns must be documented in README.md and PRD.md
- Documentation must include API signatures, usage examples, handler design notes, and test examples
- All documentation must be in English for international contributors
- Runtime system documentation includes performance optimization strategies and best practices
- Incremental parser documentation includes server/browser compatibility guidelines
- Cache system documentation includes memory optimization strategies
- Performance monitoring documentation includes alert configuration and optimization tips 