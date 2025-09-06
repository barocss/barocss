---
title: Functional Modifier API
description: Complete reference for creating dynamic modifiers with functionalModifier
---

# Functional Modifier API

The `functionalModifier` function allows you to create dynamic modifiers that can handle complex logic, pattern matching, and conditional selector generation. This is the most powerful way to extend BaroCSS modifier functionality.

## Basic Syntax

```typescript
import { functionalModifier } from '@barocss/kit';

functionalModifier(
  (mod: string, context: Context) => boolean,  // match function
  ({ selector, fullClassName, mod, context, variantChain, index }) => {
    // modifySelector function
    return { selector: string, wrappingType?: string, source?: string };
  },
  (mod: ParsedModifier, context: Context) => AstNode[],  // wrap function (optional)
  {
    // Optional configuration
  }
);
```

## Parameters

### Required Parameters

- **`match`** (function): Function that determines if a modifier should be applied
- **`modifySelector`** (function): Function that modifies the CSS selector

### Optional Parameters

- **`wrap`** (function): Function that wraps the AST nodes (advanced usage)
- **`options`** (object): Configuration options including `sort`, `astHandler`, etc.

## Handler Functions

### Match Function

::: details Purpose
Determines whether a modifier should be applied based on the modifier string and context.
:::

```typescript
(mod: string, context: Context) => boolean
```

### ModifySelector Function

::: details Purpose
Modifies the CSS selector based on the modifier and context. Returns either a simple string selector or an object with additional configuration.
:::

```typescript
({ 
  selector: string; 
  fullClassName: string; 
  mod: ParsedModifier; 
  context: Context; 
  variantChain?: ParsedModifier[]; 
  index?: number 
}) => string | { 
  selector: string; 
  flatten?: boolean; 
  wrappingType?: 'rule' | 'style-rule' | 'at-rule'; 
  override?: boolean; 
  source?: string 
}
```

### Wrap Function

::: details Purpose
Wraps AST nodes with additional CSS rules (advanced usage). This is used for complex modifiers that need to generate media queries or other at-rules.
:::

```typescript
(mod: ParsedModifier, context: Context) => AstNode[]
```

### Additional Options

```typescript
interface ModifierConfig {
  match: (mod: string, context: Context) => boolean;
  modifySelector?: (params: ModifySelectorParams) => string | SelectorResult;
  wrap?: (mod: ParsedModifier, context: Context) => AstNode[];
  astHandler?: (ast: AstNode[], mod: ParsedModifier, context: Context, variantChain?: ParsedModifier[], index?: number) => AstNode[];
  sort?: number;
}
```

- **`astHandler`**: Advanced handler for modifying AST nodes directly
- **`sort`**: Sort order for modifier processing (higher numbers processed first)

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
return { 
  selector: '&:hover', 
  wrappingType: 'rule' 
};
```

**Use when**: The `&` placeholder should be replaced with the actual class name to create proper CSS selectors.

#### `'style-rule'`

::: details Purpose
Creates a style rule where the `&` placeholder remains as-is, preserving the structural selector.
:::

```typescript
// Input: [&>*]:bg-blue-500
// Output: .\[\&\>\*\]\:bg-blue-500 > * { background-color: #3b82f6; }
return { 
  selector: '& > *', 
  wrappingType: 'style-rule' 
};
```

**Use when**: The `&` placeholder should remain as-is to create structural selectors like child or sibling selectors.

#### `'at-rule'`

::: details Purpose
Creates an at-rule (like `@media` or `@supports`) that wraps the utility, creating the proper CSS structure for conditional styling.
:::

```typescript
// Input: sm:bg-blue-500
// Output: @media (min-width: 640px) { .sm\:bg-blue-500 { background-color: #3b82f6; } }
// This is handled by the wrap function, not modifySelector
```

**Use when**: Creating media queries, container queries, or other at-rules that need to wrap the utility in a conditional structure. Note that this is typically handled by the `wrap` function rather than `modifySelector`.

### When to Use Each Type

| Wrapping Type | Use Case | Example Selector | Result |
|---------------|----------|------------------|---------|
| `'rule'` | Standard pseudo-classes | `&:hover` | `.class:hover` |
| `'rule'` | Attribute selectors | `&[data-state="open"]` | `.class[data-state="open"]` |
| `'rule'` | Parent selectors | `.parent &` | `.parent .class` |
| `'style-rule'` | Child selectors | `& > *` | `.class > *` |
| `'style-rule'` | Sibling selectors | `& ~ .sibling` | `.class ~ .sibling` |
| `'at-rule'` | Media queries | `@media (min-width: 640px)` | `@media (min-width: 640px) { .class { ... } }` |

### Examples by Use Case

#### Pseudo-classes (use `'rule'`)
```typescript
functionalModifier(
  (mod: string) => mod === 'hover',
  ({ selector }) => ({
    selector: '&:hover',
    wrappingType: 'rule',
    source: 'pseudo'
  })
);
```

#### Attribute selectors (use `'rule'`)
```typescript
functionalModifier(
  (mod: string) => /^data-/.test(mod),
  ({ selector, mod }) => {
    const m = /^data-\[(.+)\]$/.exec(mod.type);
    if (m) {
      return {
        selector: `&[data-${m[1]}]`,
        wrappingType: 'rule',
        source: 'data'
      };
    }
    return { selector };
  }
);
```

#### Child selectors (use `'style-rule'`)
```typescript
functionalModifier(
  (mod: string) => mod === '[&>*]',
  ({ selector }) => ({
    selector: '& > *',
    wrappingType: 'style-rule',
    source: 'child'
  })
);
```

#### Parent selectors (use `'rule'`)
```typescript
functionalModifier(
  (mod: string) => /^group-/.test(mod),
  ({ selector, mod }) => {
    const m = /^group-(.+)$/.exec(mod.type);
    return {
      selector: `.group:${m[1]} &`,
      wrappingType: 'rule',
      source: 'group'
    };
  }
);
```

#### Media queries (use `'at-rule'` in wrap function)
```typescript
functionalModifier(
  (mod: string, context: Context) => {
    const breakpoints = context.theme('breakpoints') || {};
    return Object.keys(breakpoints).includes(mod);
  },
  undefined, // No modifySelector needed
  (mod: ParsedModifier, context: Context) => {
    const breakpoint = mod.type;
    const value = context.theme(`breakpoints.${breakpoint}`);
    return [atRule('media', `(min-width: ${value})`, [], 'responsive')];
  }
);
```

### Common Mistakes

::: warning ❌ Wrong: Using `'style-rule'` for simple selectors
```typescript
// Don't do this
return { selector: '&:hover', wrappingType: 'style-rule' };
```
:::

::: tip ✅ Correct: Using `'rule'` for simple selectors
```typescript
// Do this instead
return { selector: '&:hover', wrappingType: 'rule' };
```
:::

::: warning ❌ Wrong: Using `'rule'` for complex child selectors
```typescript
// Don't do this
return { selector: '& > *', wrappingType: 'rule' };
```
:::

::: tip ✅ Correct: Using `'style-rule'` for complex child selectors
```typescript
// Do this instead
return { selector: '& > *', wrappingType: 'style-rule' };
```
:::

## Real-World Examples

### 1. Arbitrary Variants

```typescript
import { functionalModifier } from '@barocss/kit';

// Master CSS-style arbitrary variant ([...]) support
functionalModifier(
  (mod: string) => /^\[.*\]$/.test(mod),
  ({ selector, mod }) => {
    const m = /^\[(.+)\]$/.exec(mod.type);
    if (!m) return { selector };
    
    const inner = m[1].trim();
    
    // For attribute selectors (attr=val) or simple attributes ([open])
    if (/^[a-zA-Z0-9_-]+(=.+)?$/.test(inner)) {
      return { 
        selector: `&[${inner}]`, 
        wrappingType: 'rule', 
        source: 'attribute' 
      };
    }

    if (inner === '&>*') {
      return { 
        selector: `${inner}`, 
        wrappingType: 'style-rule', 
        source: 'peer' 
      };
    }

    // For pseudo-selectors (&:hover, &::before)
    if (inner.startsWith('&')) {
      return { 
        selector: `${inner}`, 
        wrappingType: 'rule', 
        source: 'pseudo' 
      };
    }

    // For parent selectors
    return { 
      selector: `${inner} &`.trim(), 
      wrappingType: 'rule', 
      source: 'base' 
    };
  },
  undefined  // No wrap function needed
);
```

### 2. Data Attribute Modifiers

```typescript
import { functionalModifier } from '@barocss/kit';

// data-* modifiers
functionalModifier(
  (mod: string) => /^data-/.test(mod),
  ({ selector, mod }) => {
    // data-[state=open] → [data-state="open"] & { ... }
    const bracket = /^data-\[([a-zA-Z0-9_-]+)(?:=([^\]]+))?\]$/.exec(mod.type);
    if (bracket) {
      const key = bracket[1];
      const value = bracket[2] ?? 'true';
      return {
        selector: `&[data-${key}="${value}"]`,
        source: 'data'
      };
    }
    
    // data-avatar → [data-avatar] & { ... }
    const m2 = /^data-([a-zA-Z0-9_]+)$/.exec(mod.type);
    if (m2) {
      const key = m2[1];
      return {
        selector: `&[data-${key}]`,
        source: 'data'
      };
    }
    
    return { selector, source: 'attribute' };
  },
  undefined  // No wrap function needed
);
```

### 3. Responsive Modifiers

```typescript
import { functionalModifier } from '@barocss/kit';
import { atRule } from '@barocss/kit';

// Responsive modifiers with dynamic breakpoints
functionalModifier(
  (mod: string, context: Context) => {
    const breakpoints = context.theme('breakpoints') || context.config('theme.breakpoints') || {};
    const breakpointKeys = Object.keys(breakpoints);
    
    // Check basic breakpoints
    if (breakpointKeys.includes(mod)) {
      return true;
    }
    
    // Check max-width breakpoints
    if (mod.startsWith('max-')) {
      const baseBreakpoint = mod.replace('max-', '');
      if (breakpointKeys.includes(baseBreakpoint) || /^\[.*\]$/.test(baseBreakpoint)) {
        return true;
      }
    }
    
    // Check arbitrary min-width
    if (/^min-\[.*\]$/.test(mod)) {
      return true;
    }
    
    return false;
  },
  undefined, // No selector modification needed
  (mod: ParsedModifier, context: Context) => {
    const breakpoint = mod.type;
    
    // Handle basic breakpoints
    const breakpoints = context.theme('breakpoints') || context.config('theme.breakpoints') || {};
    if (Object.keys(breakpoints).includes(breakpoint)) {
      let mediaQuery: string = context.theme(`breakpoints.${breakpoint}`) as string;
      // If only a number (px/em/rem etc.) is provided, wrap with (min-width: ...)
      if (/^\d+(px|em|rem)?$/.test(mediaQuery)) {
        mediaQuery = `(min-width: ${mediaQuery})`;
      }
      return [atRule('media', mediaQuery, [], 'responsive')];
    }
    
    // Handle max-width breakpoints
    if (breakpoint.startsWith('max-')) {
      const baseBreakpoint = breakpoint.replace('max-', '');
      const breakpoints = context.theme('breakpoints') || {};
      const value = breakpoints[baseBreakpoint] || baseBreakpoint;
      
      return [
        atRule('media', `(max-width: ${value})`, [], 'responsive')
      ];
    }
    
    // Handle arbitrary min-width
    if (breakpoint.startsWith('min-')) {
      const value = breakpoint.replace('min-', '');
      return [
        atRule('media', `(min-width: ${value})`, [], 'responsive')
      ];
    }
    
    return [];
  }
);
```

### 4. Group/Peer Modifiers

```typescript
import { functionalModifier } from '@barocss/kit';

// Group modifiers (group-hover, group-focus, etc.)
functionalModifier(
  (mod: string) => /^group-(hover|focus|active|visited|checked|disabled|aria-[^:]+)$/.test(mod),
  ({ selector, mod }) => {
    const m = /^group-(.+)$/.exec(mod.type);
    return m ? {
      selector: `.group:${m[1]} &`,
      wrappingType: 'rule',
      source: 'group'
    } : {
      selector,
      source: 'group'
    };
  },
  undefined  // No wrap function needed
);

// Peer modifiers (peer-hover, peer-focus, etc.)
functionalModifier(
  (mod: string) => /^peer-(hover|focus|active|visited|checked|disabled|aria-[^:]+)$/.test(mod),
  ({ selector, mod }) => {
    const m = /^peer-(.+)$/.exec(mod.type);
    return m ? {
      selector: `.peer:${m[1]} ~ &`,
      wrappingType: 'rule',
      source: 'peer'
    } : {
      selector,
      source: 'peer'
    };
  },
  undefined  // No wrap function needed
);
```

### 5. Aria Modifiers

```typescript
import { functionalModifier } from '@barocss/kit';

// aria-* modifiers
functionalModifier(
  (mod: string) => /^aria-/.test(mod),
  ({ selector, mod }) => {
    // aria-[expanded=true] → &[aria-expanded="true"] { ... }
    const bracket = /^aria-\[([a-zA-Z0-9_-]+)(?:=([^\]]+))?\]$/.exec(mod.type);
    if (bracket) {
      const key = bracket[1];
      const value = bracket[2] ?? 'true';
      return {
        selector: `&[aria-${key}="${value}"]`,
        source: 'aria'
      };
    }
    // aria-pressed → &[aria-pressed="true"] { ... }
    const m2 = /^aria-([a-zA-Z0-9_]+)$/.exec(mod.type);
    if (m2) {
      const key = m2[1];
      return {
        selector: `&[aria-${key}="true"]`,
        source: 'aria'
      };
    }
    return {
      selector,
      source: 'aria'
    };
  },
  undefined  // No wrap function needed
);
```

### 6. Negation Modifiers

```typescript
import { functionalModifier } from '@barocss/kit';

// :not() pseudo-class modifiers
functionalModifier(
  (mod: string) => mod.startsWith('not-'),
  ({ selector, mod }) => {
    const pseudo = mod.type.replace('not-', '');
    if (pseudo.startsWith('[')) {
      const inner = pseudo.slice(1, -1);
      // Attribute pattern: identifier(=value)? (e.g., open, dir=rtl, aria-pressed=true)
      if (/^[a-zA-Z0-9_-]+(=.+)?$/.test(inner)) {
        return {
          selector: `&:not([${inner}])`,
          source: 'attribute'
        };
      } else {
        // Otherwise, treat as a selector
        return {
          selector: `&:not(${inner})`,
          source: 'attribute'
        };
      }
    } else {
      // not-hover → :not(:hover)
      return {
        selector: `&:not(:${pseudo})`,
        source: 'attribute'
      };
    }
  },
  undefined  // No wrap function needed
);
```

### 7. Custom Pattern Modifiers

```typescript
import { functionalModifier } from '@barocss/kit';

// Custom pattern for theme variants
functionalModifier(
  (mod: string) => /^theme-/.test(mod),
  ({ selector, mod }) => {
    const m = /^theme-(.+)$/.exec(mod.type);
    if (m) {
      const theme = m[1];
      return {
        selector: `[data-theme="${theme}"] &`,
        wrappingType: 'rule',
        source: 'theme'
      };
    }
    return { selector, source: 'theme' };
  },
  undefined  // No wrap function needed
);

// Custom pattern for state variants
functionalModifier(
  (mod: string) => /^state-/.test(mod),
  ({ selector, mod }) => {
    const m = /^state-(.+)$/.exec(mod.type);
    if (m) {
      const state = m[1];
      return {
        selector: `[data-state="${state}"] &`,
        wrappingType: 'rule',
        source: 'state'
      };
    }
    return { selector, source: 'state' };
  },
  undefined  // No wrap function needed
);
```

## Advanced Patterns

### 1. Complex Pattern Matching

```typescript
import { functionalModifier } from '@barocss/kit';

// Complex pattern for responsive + state combinations
functionalModifier(
  (mod: string) => /^(sm|md|lg|xl|2xl)-(hover|focus|active)$/.test(mod),
  ({ selector, mod }) => {
    const m = /^(sm|md|lg|xl|2xl)-(hover|focus|active)$/.exec(mod.type);
    if (m) {
      const [breakpoint, state] = m;
      const breakpoints = {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px'
      };
      
      return {
        selector: `@media (min-width: ${breakpoints[breakpoint]}) { &:${state} }`,
        wrappingType: 'at-rule',
        source: 'responsive-state'
      };
    }
    return { selector };
  },
  undefined  // No wrap function needed
);
```

### 2. Context-Aware Modifiers

```typescript
import { functionalModifier } from '@barocss/kit';

// Modifier that depends on context configuration
functionalModifier(
  (mod: string, context: Context) => {
    const customModifiers = context.config('customModifiers') || [];
    return customModifiers.includes(mod);
  },
  ({ selector, mod, context }) => {
    const modifierConfig = context.config(`customModifiers.${mod}`) || {};
    const selector = modifierConfig.selector || `&:${mod}`;
    
    return {
      selector,
      wrappingType: modifierConfig.wrappingType || 'rule',
      source: 'custom'
    };
  },
  undefined  // No wrap function needed
);
```

### 3. Chain-Aware Modifiers

```typescript
import { functionalModifier } from '@barocss/kit';

// Modifier that considers the variant chain
functionalModifier(
  (mod: string) => mod === 'important',
  ({ selector, variantChain }) => {
    // Only apply if it's the last modifier in the chain
    const isLast = variantChain && variantChain.length === 1;
    if (isLast) {
      return {
        selector: `${selector} !important`,
        source: 'important'
      };
    }
    return { selector };
  },
  undefined  // No wrap function needed
);
```

## Best Practices

### 1. Use Efficient Pattern Matching

```typescript
// Good - efficient regex
functionalModifier(
  (mod: string) => /^data-/.test(mod),
  // ...
);

// Avoid - inefficient string operations
functionalModifier(
  (mod: string) => mod.startsWith('data-') && mod.length > 5,
  // ...
);
```

### 2. Provide Clear Source Identifiers

```typescript
functionalModifier(
  (mod: string) => /^group-/.test(mod),
  ({ selector, mod }) => ({
    selector: `.group:${mod.replace('group-', '')} &`,
    source: 'group'
  })
);
```

### 3. Handle Edge Cases

```typescript
functionalModifier(
  (mod: string) => /^data-/.test(mod),
  ({ selector, mod }) => {
    const m = /^data-\[(.+)\]$/.exec(mod);
    if (!m) {
      // Fallback for invalid patterns
      return { selector, source: 'data' };
    }
    
    const key = m[1];
    return {
      selector: `&[data-${key}]`,
      source: 'data'
    };
  }
);
```

### 4. Use Appropriate Wrapping Types

Choose the correct `wrappingType` based on your selector pattern:

```typescript
// ✅ Use 'rule' for standard pseudo-classes and attributes
return { selector: '&:hover', wrappingType: 'rule' };
return { selector: '&[data-state="open"]', wrappingType: 'rule' };
return { selector: '.parent &', wrappingType: 'rule' };

// ✅ Use 'style-rule' for complex child/sibling selectors
return { selector: '& > *', wrappingType: 'style-rule' };
return { selector: '& ~ .sibling', wrappingType: 'style-rule' };
return { selector: '&:has(.child)', wrappingType: 'style-rule' };

// ✅ Use 'at-rule' for media queries (in wrap function)
// This is handled by the wrap function, not modifySelector
```

**Decision Tree**:
- Does your selector need `&` to be replaced with the actual class name? → Use `'rule'`
- Does your selector need `&` to remain as-is for structural purposes? → Use `'style-rule'`
- Are you creating conditional CSS structures like media queries? → Use `'at-rule'` in wrap function

### 5. Handle Edge Cases Properly

```typescript
functionalModifier(
  (mod: string) => /^data-/.test(mod),
  ({ selector, mod }) => {
    const m = /^data-\[(.+)\]$/.exec(mod);
    if (!m) {
      // Fallback for invalid patterns
      return { selector, source: 'data' };
    }
    
    const key = m[1];
    return {
      selector: `&[data-${key}]`,
      source: 'data'
    };
  },
  undefined
);
```


### 3. Choose Wrapping Type Based on Structure

```typescript
// Use 'rule' when & should be replaced with the actual class name
return { selector: '&:hover', wrappingType: 'rule' };

// Use 'style-rule' when & should remain as-is for structural selectors
return { selector: '& > *', wrappingType: 'style-rule' };

// Use 'at-rule' for media queries and other at-rules (in wrap function)
// This creates the proper CSS structure for responsive design
```

## Related APIs

- [Static Modifier API](/api/static-modifier) - For simple, fixed modifiers
- [Static Utility API](/api/static-utility) - For creating utilities
- [Functional Utility API](/api/functional-utility) - For dynamic utilities
