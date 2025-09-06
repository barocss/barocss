---
title: Static Modifier API
description: Complete reference for creating fixed modifiers with staticModifier
---

# Static Modifier API

The `staticModifier` function allows you to create modifiers with fixed CSS selectors. This is the simplest way to add custom modifiers (variants) to BaroCSS.

## Basic Syntax

```typescript
import { staticModifier } from '@barocss/kit';

staticModifier('modifier-name', [
  'selector1',
  'selector2'
], {
  // Optional configuration
});
```

## Parameters

### Required Parameters

- **`name`** (string): The modifier name (e.g., 'hover', 'focus', 'dark')
- **`selectors`** (string[]): Array of CSS selectors to apply when the modifier is used

### Optional Parameters

```typescript
interface StaticModifierOptions {
  source?: string;     // Source identifier for debugging
  sort?: number;       // Sort order for modifier processing
}
```

## Wrapping Types

::: tip Understanding Wrapping Types
The `wrappingType` parameter controls how the modifier's selector is applied to the utility's CSS. This is crucial for creating the correct CSS structure and ensuring proper selector behavior.
:::

### Available Wrapping Types

#### `'rule'` (Default)

::: details Purpose
Creates a standard CSS rule where the `&` placeholder is replaced with the actual class name.
:::

```typescript
// Input: hover:bg-blue-500
// Output: .hover\:bg-blue-500:hover { background-color: #3b82f6; }
staticModifier('hover', ['&:hover'], { source: 'pseudo' });
```

**Use when**: The `&` placeholder should be replaced with the actual class name to create proper CSS selectors.

#### `'style-rule'`

::: details Purpose
Creates a style rule where the `&` placeholder remains as-is, preserving the structural selector.
:::

```typescript
// Input: [&>*]:bg-blue-500
// Output: .\[\&\>\*\]\:bg-blue-500 > * { background-color: #3b82f6; }
staticModifier('[&>*]', ['& > *'], { source: 'child' });
```

**Use when**: The `&` placeholder should remain as-is to create structural selectors like child or sibling selectors.

#### `'at-rule'`

::: details Purpose
Creates an at-rule (like `@media` or `@supports`) that wraps the utility, creating the proper CSS structure for conditional styling.
:::

```typescript
// Input: print:bg-blue-500
// Output: @media print { .print\:bg-blue-500 { background-color: #3b82f6; } }
staticModifier('print', ['@media print'], { source: 'media' });
```

**Use when**: Creating media queries, container queries, or other at-rules that need to wrap the utility in a conditional structure.

### When to Use Each Type

| Wrapping Type | Use Case | Example Selector | Result |
|---------------|----------|------------------|---------|
| `'rule'` | Standard pseudo-classes | `&:hover` | `.class:hover` |
| `'rule'` | Attribute selectors | `&[data-state="open"]` | `.class[data-state="open"]` |
| `'rule'` | Parent selectors | `.parent &` | `.parent .class` |
| `'style-rule'` | Child selectors | `& > *` | `.class > *` |
| `'style-rule'` | Sibling selectors | `& ~ .sibling` | `.class ~ .sibling` |
| `'at-rule'` | Media queries | `@media print` | `@media print { .class { ... } }` |

### Examples by Use Case

#### Pseudo-classes (use `'rule'`)
```typescript
staticModifier('hover', ['&:hover'], { source: 'pseudo' });
staticModifier('focus', ['&:focus'], { source: 'pseudo' });
staticModifier('active', ['&:active'], { source: 'pseudo' });
```

#### Attribute selectors (use `'rule'`)
```typescript
staticModifier('data-open', ['&[data-open]'], { source: 'data' });
staticModifier('aria-pressed', ['&[aria-pressed="true"]'], { source: 'aria' });
```

#### Child selectors (use `'style-rule'`)
```typescript
staticModifier('[&>*]', ['& > *'], { source: 'child' });
staticModifier('[&~.sibling]', ['& ~ .sibling'], { source: 'sibling' });
```

#### Parent selectors (use `'rule'`)
```typescript
staticModifier('group-hover', ['.group:hover &'], { source: 'group' });
staticModifier('peer-focus', ['.peer:focus ~ &'], { source: 'peer' });
```

#### Media queries (use `'at-rule'`)
```typescript
staticModifier('print', ['@media print'], { source: 'media' });
staticModifier('screen', ['@media screen'], { source: 'media' });
```

### Common Mistakes

::: warning ❌ Wrong: Using `'style-rule'` for simple selectors
```typescript
// Don't do this
staticModifier('hover', ['&:hover'], { wrappingType: 'style-rule' });
```
:::

::: tip ✅ Correct: Using `'rule'` for simple selectors
```typescript
// Do this instead
staticModifier('hover', ['&:hover'], { source: 'pseudo' });
```
:::

::: warning ❌ Wrong: Using `'rule'` for complex child selectors
```typescript
// Don't do this
staticModifier('[&>*]', ['& > *'], { source: 'child' });
```
:::

::: tip ✅ Correct: Using `'style-rule'` for complex child selectors
```typescript
// Do this instead
staticModifier('[&>*]', ['& > *'], { wrappingType: 'style-rule', source: 'child' });
```
:::

## How Modifiers Work

Modifiers are used to conditionally apply styles based on certain states or conditions. When you use a modifier like `hover:bg-blue-500`, BaroCSS:

1. Detects the `hover:` modifier
2. Finds the corresponding modifier registration
3. Applies the registered selectors to wrap the utility's CSS

## Real-World Examples

### 1. Basic Pseudo-class Modifiers

```typescript
import { staticModifier } from '@barocss/kit';

// Hover modifier
staticModifier('hover', ['&:hover'], { source: 'pseudo' });

// Focus modifier
staticModifier('focus', ['&:focus'], { source: 'pseudo' });

// Active modifier
staticModifier('active', ['&:active'], { source: 'pseudo' });

// Visited modifier
staticModifier('visited', ['&:visited'], { source: 'pseudo' });
```

### 2. Pseudo-element Modifiers

```typescript
import { staticModifier } from '@barocss/kit';

// Before pseudo-element
staticModifier('before', ['&::before'], { source: 'pseudo' });

// After pseudo-element
staticModifier('after', ['&::after'], { source: 'pseudo' });

// First-line pseudo-element
staticModifier('first-line', ['&::first-line'], { source: 'pseudo' });

// First-letter pseudo-element
staticModifier('first-letter', ['&::first-letter'], { source: 'pseudo' });
```

### 3. Dark Mode Modifier

```typescript
import { staticModifier } from '@barocss/kit';

// Class-based dark mode
staticModifier('dark', ['.dark', '.dark *'], { source: 'theme' });

// Data attribute-based dark mode
staticModifier('dark', ['[data-theme="dark"]', '[data-theme="dark"] *'], { source: 'theme' });

// Media query-based dark mode
staticModifier('dark', ['@media (prefers-color-scheme: dark)'], { source: 'media' });
```

### 4. Group Modifiers

```typescript
import { staticModifier } from '@barocss/kit';

// Group hover - applies when parent has hover
staticModifier('group-hover', ['.group:hover &'], { source: 'group' });

// Group focus - applies when parent has focus
staticModifier('group-focus', ['.group:focus &'], { source: 'group' });

// Group active - applies when parent has active
staticModifier('group-active', ['.group:active &'], { source: 'group' });
```

### 5. Peer Modifiers

```typescript
import { staticModifier } from '@barocss/kit';

// Peer hover - applies when sibling has hover
staticModifier('peer-hover', ['.peer:hover ~ &'], { source: 'peer' });

// Peer focus - applies when sibling has focus
staticModifier('peer-focus', ['.peer:focus ~ &'], { source: 'peer' });

// Peer checked - applies when sibling is checked
staticModifier('peer-checked', ['.peer:checked ~ &'], { source: 'peer' });
```

### 6. Complex Selector Modifiers

```typescript
import { staticModifier } from '@barocss/kit';

// Not modifier - applies when element doesn't match selector
staticModifier('not-first', [':not(:first-child)'], { source: 'structural' });

// Not last modifier
staticModifier('not-last', [':not(:last-child)'], { source: 'structural' });

// Only child modifier
staticModifier('only-child', [':only-child'], { source: 'structural' });

// Empty modifier
staticModifier('empty', [':empty'], { source: 'structural' });
```

### 7. Form State Modifiers

```typescript
import { staticModifier } from '@barocss/kit';

// Checked modifier
staticModifier('checked', ['&:checked'], { source: 'form' });

// Disabled modifier
staticModifier('disabled', ['&:disabled'], { source: 'form' });

// Required modifier
staticModifier('required', ['&:required'], { source: 'form' });

// Invalid modifier
staticModifier('invalid', ['&:invalid'], { source: 'form' });

// Valid modifier
staticModifier('valid', ['&:valid'], { source: 'form' });
```

### 8. Media Query Modifiers

```typescript
import { staticModifier } from '@barocss/kit';

// Print modifier
staticModifier('print', ['@media print'], { source: 'media' });

// Screen modifier
staticModifier('screen', ['@media screen'], { source: 'media' });

// Reduced motion modifier
staticModifier('motion-reduce', ['@media (prefers-reduced-motion: reduce)'], { source: 'media' });

// High contrast modifier
staticModifier('motion-safe', ['@media (prefers-reduced-motion: no-preference)'], { source: 'media' });
```

### 9. Custom Theme Modifiers

```typescript
import { staticModifier } from '@barocss/kit';

// Custom theme modifier
staticModifier('theme-midnight', ['[data-theme="midnight"]'], { source: 'theme' });

// Custom state modifier
staticModifier('loading', ['[data-state="loading"]'], { source: 'state' });

// Custom variant modifier
staticModifier('variant-primary', ['[data-variant="primary"]'], { source: 'variant' });
```

## Advanced Patterns

### 1. Multiple Selectors

```typescript
import { staticModifier } from '@barocss/kit';

// Modifier with multiple selectors
staticModifier('focus-visible', [
  '&:focus-visible',
  '&:focus:not(:focus-visible)'
], { source: 'pseudo' });
```

### 2. Complex Group Modifiers

```typescript
import { staticModifier } from '@barocss/kit';

// Group modifier with complex selector
staticModifier('group-hover', [
  '.group:hover &',
  '.group:focus-within &'
], { source: 'group' });
```

### 3. Conditional Modifiers

```typescript
import { staticModifier } from '@barocss/kit';

// Modifier that works with different parent classes
staticModifier('parent-hover', [
  '.parent:hover &',
  '[data-parent="hover"] &'
], { source: 'parent' });
```

## Best Practices

### 1. Use Descriptive Names

```typescript
// Good
staticModifier('hover', ['&:hover']);
staticModifier('dark', ['.dark', '.dark *']);
staticModifier('group-focus', ['.group:focus &']);

// Avoid
staticModifier('h', ['&:hover']);
staticModifier('d', ['.dark']);
staticModifier('gf', ['.group:focus &']);
```

### 2. Use Source Identifiers

```typescript
staticModifier('hover', ['&:hover'], { source: 'pseudo' });
staticModifier('dark', ['.dark'], { source: 'theme' });
staticModifier('group-hover', ['.group:hover &'], { source: 'group' });
```

### 3. Order Matters

```typescript
// Higher sort numbers are processed first
staticModifier('important', ['&:important'], { sort: 1000 });
staticModifier('hover', ['&:hover'], { sort: 100 });
staticModifier('focus', ['&:focus'], { sort: 50 });
```

### 4. Use Appropriate Selectors

```typescript
// Good - specific and clear
staticModifier('dark', ['.dark', '.dark *']);

// Avoid - too broad
staticModifier('dark', ['*']);

// Good - proper pseudo-class
staticModifier('hover', ['&:hover']);

// Avoid - incorrect syntax
staticModifier('hover', [':hover']);
```

## Common Use Cases

### 1. Interactive States

```typescript
// Basic interactive states
staticModifier('hover', ['&:hover']);
staticModifier('focus', ['&:focus']);
staticModifier('active', ['&:active']);
staticModifier('visited', ['&:visited']);
```

### 2. Form States

```typescript
// Form input states
staticModifier('checked', ['&:checked']);
staticModifier('disabled', ['&:disabled']);
staticModifier('required', ['&:required']);
staticModifier('invalid', ['&:invalid']);
staticModifier('valid', ['&:valid']);
```

### 3. Structural Selectors

```typescript
// Structural pseudo-classes
staticModifier('first-child', ['&:first-child']);
staticModifier('last-child', ['&:last-child']);
staticModifier('only-child', ['&:only-child']);
staticModifier('empty', ['&:empty']);
```

### 4. Theme Variants

```typescript
// Theme-based modifiers
staticModifier('dark', ['.dark', '.dark *']);
staticModifier('light', ['.light', '.light *']);
staticModifier('theme-brand', ['[data-theme="brand"]']);
```


## Related APIs

- [Functional Modifier API](/api/functional-modifier) - For dynamic modifiers
- [Static Utility API](/api/static-utility) - For creating utilities
- [Functional Utility API](/api/functional-utility) - For dynamic utilities
