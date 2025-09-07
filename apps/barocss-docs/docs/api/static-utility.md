---
title: Static Utility API
description: Complete reference for creating fixed utilities with staticUtility
---

# Static Utility API

::: tip Learning Path
This is **Step 3** in the BaroCSS API learning path. Learn how to create custom utilities with fixed CSS output.
:::

The `staticUtility` function allows you to create utilities with fixed CSS declarations. This is the simplest and most performant way to add custom utilities to BaroCSS.

## 🎯 What You'll Learn

- How to create utilities with fixed CSS
- When to use static vs functional utilities
- AST helper functions for building CSS
- Best practices for utility design

## 📚 Prerequisites

- **[Context API](/api/context)** - Understanding contexts
- **[Engine API](/api/engine)** - Understanding CSS generation

## 📚 Next Steps

After mastering Static Utility API, continue with:
- **[Functional Utility API](/api/functional-utility)** - Creating dynamic utilities
- **[Static Modifier API](/api/static-modifier)** - Creating fixed modifiers
- **[Functional Modifier API](/api/functional-modifier)** - Creating dynamic modifiers

## Basic Syntax

```typescript
import { staticUtility } from '@barocss/kit';
import { decl, rule, styleRule } from '@barocss/kit';

staticUtility('utility-name', [
  // CSS declarations or rules
], {
  // Optional configuration
});
```

## Parameters

### Required Parameters

- **`name`** (string): The utility name (e.g., 'block', 'hidden', 'btn')
- **`decls`** (AstNode[]): Array of AST nodes representing CSS declarations

### Optional Parameters

```typescript
interface StaticUtilityOptions {
  description?: string;  // Description for documentation
  category?: string;     // Category for organization
  priority?: number;     // Priority for utility ordering
```

## Declaration Types

### Simple Declarations

::: details Purpose
Create utilities with basic CSS property-value pairs.
:::

```typescript
import { decl } from '@barocss/kit';

// Single property-value pair
staticUtility('block', [decl('display', 'block')]);

// Multiple properties
staticUtility('btn', [
  decl('display', 'inline-flex'),
  decl('align-items', 'center'),
  decl('padding', '0.5rem 1rem'),
  decl('border-radius', '0.375rem')
]);
```

### Complex Selectors with rule()

::: details Purpose
Create utilities with pseudo-classes, pseudo-elements, and complex selectors.
:::

```typescript
import { rule } from '@barocss/kit';

// Pseudo-elements and pseudo-classes
staticUtility('btn-hover', [
  rule('&:hover', [
    decl('background-color', 'var(--color-primary-dark)'),
    decl('transform', 'translateY(-1px)')
  ]),
  rule('&:active', [
    decl('transform', 'translateY(0)')
  ])
]);

// Complex selectors
staticUtility('space-x', [
  rule('& > :not([hidden]) ~ :not([hidden])', [
    decl('margin-inline-start', 'var(--spacing-x)')
  ])
]);
```

### Global Styles with styleRule()

::: details Purpose
Create utilities with global styles where the `&` placeholder is not replaced.
:::

```typescript
import { styleRule } from '@barocss/kit';

// Global styles (no & replacement)
staticUtility('global-focus', [
  styleRule('&:focus', [
    decl('outline', '2px solid var(--color-primary)'),
    decl('outline-offset', '2px')
  ])
]);
```

### @-Rules with atRule()

::: details Purpose
Create utilities with media queries and other at-rules for responsive design.
:::

```typescript
import { atRule } from '@barocss/kit';

// Media queries
staticUtility('responsive-grid', [
  decl('display', 'grid'),
  atRule('media', '(min-width: 768px)', [
    rule('&', [
      decl('grid-template-columns', 'repeat(2, 1fr)')
    ])
  ]),
  atRule('media', '(min-width: 1024px)', [
    rule('&', [
      decl('grid-template-columns', 'repeat(3, 1fr)')
    ])
  ])
]);
```

### CSS Custom Properties with property()

::: details Purpose
Create utilities that define and use CSS custom properties for theming.
:::

```typescript
import { property } from '@barocss/kit';

// Define custom properties
staticUtility('theme-vars', [
  property('--primary-color', '#3b82f6', 'color'),
  property('--secondary-color', '#64748b', 'color'),
  property('--spacing-unit', '1rem', 'length'),
  decl('color', 'var(--primary-color)'),
  decl('background-color', 'var(--secondary-color)'),
  decl('padding', 'calc(var(--spacing-unit) * 2)')
]);
```



## Related APIs

- [Functional Utility API](/api/functional-utility) - For dynamic utilities
- [AST Helper Functions](/guide/adding-custom-styles#ast-helper-functions) - For creating AST nodes
- [Configuration](/api/configuration) - For utility configuration
