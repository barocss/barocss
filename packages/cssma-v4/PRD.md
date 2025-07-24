# CSSMA v4 Product Requirements Document (PRD)

## Overview

CSSMA v4 is a utility-first CSS framework that transforms Tailwind CSS-compatible class names into CSS AST nodes for Figma styling. The system is built around a modular architecture with clear separation of concerns.

## Core Systems

### 1. Engine System (`engine.ts`)

**Design Intent:**
- **Single Entry Point:** All class name transformations start here
- **Extensibility:** Plugins/custom parsers/handlers can easily hook into the process

**Main Functions:**
- `parseClassToAst(className, ctx): AstNode[]` - Parses single utility class and returns AST nodes
- `generateCss(classList, ctx, opts?): string` - Converts multiple classes to CSS
- Handles modifiers, negative values, arbitrary values, and custom properties

### 2. AST System (`ast.ts`)

**AST Node Types:**
- `decl`: CSS property declaration (e.g., `{ type: 'decl', prop: 'color', value: '#fff' }`)
- `atrule`: CSS at-rule (e.g., `{ type: 'atrule', name: 'supports', params: '...', nodes: [...] }`)
- `rule`: CSS selector rule (e.g., `{ type: 'rule', selector: '.foo', nodes: [...] }`)
- `comment`: Comment node

**AST Construction:**
- All handler functions must return AST nodes in this format
- AST is designed to be serializable to CSS or Figma style objects

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
> The application order of variants is determined by the engine's source/type priority, not by registration or an 
**Variant Testing:**
- Each variant category has comprehensive tests covering all supported patterns
- Tests include modifier combinations, nesting, and edge cases
- All 148 variant tests pass, ensuring complete functionality

### 7. Theme System

**Theme Lookup:**
- Always use both category and key for theme lookups (e.g., `ctx.theme('colors', 'red-500')`)
- Never look up by key only (e.g., `'red-500'`), as keys may overlap across categories
- Handlers must reference the correct theme category for each utility

### 8. Engine & CSS Conversion

#### Engine (`engine.ts`)
- className → AST conversion (`parseClassToAst`)
- Multiple classNames → utility CSS (`generateCss`)
- Supports breakpoints, variants, arbitrary values, custom properties, and all Tailwind v4 syntax

#### CSS Converter (`astToCss.ts`)
- AST → standard CSS string conversion
- Selector escaping (`\:` etc.) is 100% identical to Tailwind CSS
- Supports at-rules (@media), nesting, complex selectors, arbitrary values, etc.

#### Style Tag Application
- generateCss output can be directly inserted into `<style>` tag
- Escaped selectors are correctly interpreted by browsers (identical to Tailwind, CSS-in-JS)

#### End-to-End Flow
1. className → AST (`parseClassToAst`)
2. AST → CSS (`astToCss`)
3. Multiple classNames → utility CSS (`generateCss`)
4. CSS → insert into `<style>` tag

#### Testing Strategy
- `engine.basic.test.ts`: End-to-end validation from className → AST → CSS → expected value
- Covers selector escaping, responsive, arbitrary, variants, custom properties, and all cases
- Expected values match actual CSS output 1:1 (fully compatible with Tailwind)

## Extensibility & Best Practices

- All utility registration and handler logic should be modular and easily extendable
- New utility categories or custom plugins can be added by creating new preset files and registering them in the registry
- All new features must include comprehensive tests and documentation

## Testing & Quality Assurance

- 100% test coverage for all core logic and presets
- Tests must cover static, functional, arbitrary, custom property, and modifier cases
- All tests must be written in clear, unambiguous language, specifying exact expected AST output

## Documentation

- All core systems, presets, and handler patterns must be documented in README.md and PRD.md
- Documentation must include API signatures, usage examples, handler design notes, and test examples
- All documentation must be in English for international contributors 