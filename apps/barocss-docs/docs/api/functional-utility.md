---
title: Functional Utility API
description: Complete reference for creating dynamic utilities with functionalUtility
---

# Functional Utility API

The `functionalUtility` function allows you to create dynamic utilities that can handle various value types, theme integration, and complex logic. This is the most powerful way to extend BaroCSS functionality.

## Basic Syntax

```typescript
import { functionalUtility } from '@barocss/kit';
import { decl, rule, atRule } from '@barocss/kit';

functionalUtility({
  name: 'utility-name',
  prop: 'css-property',
  handle: (value, context, token, extra) => {
    // Return AstNode[] or null
  }
});
```

## Core Parameters

### Required Parameters

- **`name`** (string): The utility name (e.g., 'bg', 'text', 'spacing')
- **`handle`** (function): The handler function that processes values

### Optional Parameters

- **`prop`** (string): The CSS property this utility affects
- **`themeKey`** (string): Theme key to look up values (e.g., 'colors', 'spacing')
- **`themeKeys`** (string[]): Multiple theme keys to check
- **`supportsArbitrary`** (boolean): Whether to support arbitrary values like `bg-[#ff0000]`
- **`supportsNegative`** (boolean): Whether to support negative values like `-m-4`
- **`supportsCustomProperty`** (boolean): Whether to support custom properties like `bg-(--my-color)`
- **`supportsOpacity`** (boolean): Whether to support opacity modifiers like `bg-red-500/50`
- **`description`** (string): Description for documentation
- **`category`** (string): Category for organization
- **`priority`** (number): Priority for utility ordering
- **`handleCustomProperty`** (function): Special handler for custom properties

## Handler Function

::: tip Understanding the Handler Function
The `handle` function is the core of functional utilities. It receives four parameters and returns AST nodes or null.
:::

```typescript
handle: (value, context, token, extra) => {
  // value: string - The input value
  // context: Context - BaroCSS context for theme access
  // token: Token - Parsed token information
  // extra: Extra - Additional metadata (opacity, realThemeValue, etc.)
  
  return AstNode[] | null; // Return AST nodes or null if not handled
```

### Token Object

::: details Purpose
Contains information about how the value was parsed and what type it represents.
:::

```typescript
interface Token {
  theme?: boolean;        // true if value comes from theme
  arbitrary?: boolean;    // true if value is arbitrary (e.g., [value])
  customProperty?: boolean; // true if value is custom property (e.g., (--var))
  negative?: boolean;     // true if value is negative
```

### Extra Object

::: details Purpose
Contains additional metadata that can be used for advanced value processing.
:::

```typescript
interface Extra {
  opacity?: string;       // Opacity value if supportsOpacity is true
  realThemeValue?: string; // Actual theme value if found
```

## Advanced Patterns

### 1. Complex Value Processing

::: details Purpose
Handle multiple value types with validation and theme integration.
:::

```typescript
functionalUtility({
  name: 'custom-shadow',
  themeKey: 'boxShadow',
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, context, token, extra) => {
    // Handle theme values
    if (token.theme) {
      const shadowValue = context.theme('boxShadow', value);
      if (shadowValue) {
        return [decl('box-shadow', shadowValue)];
      }
    }

    // Handle arbitrary values with validation
    if (token.arbitrary) {
      // Validate shadow format
      if (isValidShadow(value)) {
        return [decl('box-shadow', value)];
      }
    }

    // Handle custom properties
    if (token.customProperty) {
      return [decl('box-shadow', `var(${value})`)];
    }

    return null;
  }
});
```

### 2. Multi-Property Utilities

::: details Purpose
Create utilities that generate multiple CSS properties from a single value.
:::

```typescript
functionalUtility({
  name: 'inset',
  handle: (value, context, token) => {
    if (value === '') {
      return [
        decl('top', '0'),
        decl('right', '0'),
        decl('bottom', '0'),
        decl('left', '0')
      ];
    }
    return null;
  }
});
```

### 3. Conditional CSS Generation

::: details Purpose
Generate CSS with feature detection and fallbacks for progressive enhancement.
:::

```typescript
functionalUtility({
  name: 'supports-grid',
  handle: (value, context, token) => {
    return [
      atRule('supports', '(display: grid)', [
        rule('&', [
          decl('display', 'grid'),
          decl('grid-template-columns', value)
        ])
      ]),
      // Fallback
      rule('&', [
        decl('display', 'flex'),
        decl('flex-direction', 'column')
      ])
    ];
  }
});
```

## Common Utility Patterns

### Color Utilities
- Theme integration with `themeKeys: ['colors']`
- Opacity support with `supportsOpacity: true`
- Color parsing with `parseColor()`

### Spacing Utilities
- Theme integration with `themeKey: 'spacing'`
- Negative support with `supportsNegative: true`
- Length parsing with `parseLength()`

### Size Utilities
- Theme integration with `themeKey: 'sizing'`
- Arbitrary support with `supportsArbitrary: true`
- Number parsing with `parseNumber()`

### Complex Utilities
- Multiple theme keys with `themeKeys: ['colors', 'spacing']`
- Custom property support with `supportsCustomProperty: true`
- Special handlers with `handleCustomProperty`

## Related APIs

- [Static Utility API](/api/static-utility) - For simple, fixed utilities
- [AST Helper Functions](/guide/adding-custom-styles#ast-helper-functions) - For creating AST nodes
- [Theme API](/api/context) - For accessing theme values
- [Configuration](/api/configuration) - For utility configuration
