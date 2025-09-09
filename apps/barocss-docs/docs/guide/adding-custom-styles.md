# Adding Custom Styles

::: tip Framework Extensibility
BaroCSS has been designed from the ground up to be extensible and customizable, so that no matter what you're building you never feel like you're fighting the framework.
:::

Often the biggest challenge when working with a framework is figuring out what you're supposed to do when there's something you need that the framework doesn't handle for you.

This guide covers topics like customizing your design tokens, how to break out of those constraints when necessary, adding your own custom CSS, and extending the framework with custom utilities.

## What You'll Learn

- **Theme Customization**: Modify design tokens and color palettes
- **Arbitrary Values**: Break out of design constraints when needed
- **Custom CSS**: Add base styles and component classes
- **Custom Utilities**: Create your own utility functions
- **Custom Modifiers**: Add new variants and modifiers
- **Advanced Patterns**: Complex styling scenarios and solutions

## Customizing Your Theme

::: details Purpose
Modify design tokens like colors, spacing, typography, and breakpoints to match your brand and design system.
:::

If you want to change things like your color palette, spacing scale, typography scale, or breakpoints, add your customizations using the theme configuration in your BaroCSS setup:

```typescript
import { BrowserRuntime } from '@barocss/browser';

const runtime = new BrowserRuntime({
  config: {
    theme: {
      extend: {
        fontFamily: {
          display: ['Satoshi', 'sans-serif']
        },
        screens: {
          '3xl': '120rem'
        },
        colors: {
          avocado: {
            100: '#f0fdf4',
            200: '#dcfce7',
            300: '#bbf7d0',
            400: '#86efac',
            500: '#4ade80',
            600: '#22c55e'
          }
        },
        transitionTimingFunction: {
          fluid: 'cubic-bezier(0.3, 0, 0, 1)',
          snappy: 'cubic-bezier(0.2, 0, 0, 1)'
        }
      }
    }
  }
});
```


## Using Arbitrary Values

::: details Purpose
Break out of design token constraints when you need pixel-perfect control or values not covered by your theme.
:::

While you can usually build the bulk of a well-crafted design using a constrained set of design tokens, once in a while you need to break out of those constraints to get things pixel-perfect.

When you find yourself really needing something like `top: 117px` to get a background image in just the right spot, use BaroCSS's square bracket notation to generate a class on the fly with any arbitrary value:

```html
<div class="top-[117px]">
  <!-- ... -->
</div>
```

This is basically like inline styles, with the major benefit that you can combine it with interactive modifiers like `hover` and responsive modifiers like `lg`:

```html
<div class="top-[117px] lg:top-[344px]">
  <!-- ... -->
</div>
```

This works for everything in the framework, including things like background colors, font sizes, pseudo-element content, and more:

```html
<div class="bg-[#bada55] text-[22px] before:content-['Festivus']">
  <!-- ... -->
</div>
```

### CSS Variables

::: details Custom Property Syntax
If you're referencing a CSS variable as an arbitrary value, you can use the custom property syntax:
:::

```html
<div class="fill-(--my-brand-color) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `fill-[var(--my-brand-color)]` that adds the `var()` function for you automatically.

### Arbitrary Properties

::: details Purpose
Use CSS properties that BaroCSS doesn't include utilities for out of the box.
:::

If you ever need to use a CSS property that BaroCSS doesn't include a utility for out of the box, you can also use square bracket notation to write completely arbitrary CSS:

```html
<div class="[mask-type:luminance]">
  <!-- ... -->
</div>
```

This is _really_ like inline styles, but again with the benefit that you can use modifiers:

```html
<div class="[mask-type:luminance] hover:[mask-type:alpha]">
  <!-- ... -->
</div>
```

This can be useful for things like CSS variables as well, especially when they need to change under different conditions:

```html
<div class="[--scroll-offset:56px] lg:[--scroll-offset:44px]">
  <!-- ... -->
</div>
```

### Arbitrary Variants

::: details Purpose
Create custom selectors on-the-fly using square bracket notation.
:::

Arbitrary _variants_ are like arbitrary values but for doing on-the-fly selector modification, like you can with built-in pseudo-class variants like `hover:{utility}` or responsive variants like `md:{utility}` but using square bracket notation directly in your HTML.

```html
<ul role="list">
  {#each items as item}
  <li class="lg:[&:nth-child(-n+3)]:hover:underline">{item}</li>
  {/each}
</ul>
```


### Handling Whitespace

::: details Purpose
Handle spaces in arbitrary values using underscores.
:::

When an arbitrary value needs to contain a space, use an underscore (`_`) instead and BaroCSS will automatically convert it to a space at build-time:

```html
<div class="grid grid-cols-[1fr_500px_2fr]">
  <!-- ... -->
</div>
```

In situations where underscores are meaningful (like in CSS custom property names), you can escape them with a backslash:

```html
<div class="bg-[var(--my-color_1)]">
  <!-- ... -->
</div>
```

### Resolving Ambiguities

::: details Purpose
Be explicit when BaroCSS can't determine which utility you're trying to use.
:::

When BaroCSS can't tell which utility you're trying to use, you can be more explicit by prefixing the arbitrary value with the utility type:

```html
<div class="[color:red]">
  <!-- ... -->
</div>
```

## Using Custom CSS

::: details Purpose
Add base styles, component classes, and custom CSS that works alongside BaroCSS utilities.
:::

### Adding Base Styles

::: details Purpose
Set global styles like font families, default link styles, and other base element styling.
:::

Add base styles directly to your CSS. Base styles are things like setting font families on the `html` element, setting default link styles, and so on.

```css
html {
  font-family: "Inter", sans-serif;

a {
  color: #2563eb;
  text-decoration: underline;

a:hover {
  color: #1d4ed8;
```

### Adding Component Classes

::: details Purpose
Create reusable component classes that combine multiple utilities for common UI patterns.
:::

Create component classes using regular CSS:

```css
.btn-primary {
  background-color: #3b82f6;
  color: white;
  font-weight: bold;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;

.btn-primary:hover {
  background-color: #1d4ed8;

.btn-secondary {
  background-color: #6b7280;
  color: white;
  font-weight: bold;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;

.btn-secondary:hover {
  background-color: #374151;
```

You can now use these component classes in your HTML:

```html
<button class="btn-primary">Primary Button</button>
<button class="btn-secondary">Secondary Button</button>
```

::: tip Best Practice
Component classes are great for organizing frequently used style combinations, but remember that you probably don't need these types of classes as often as you think. Consider using utility classes directly when possible.
:::

You can also add custom styles for any third-party components you're using:

```css
.select2-dropdown {
  border-radius: 0.5rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  /* ... */
```

### Using Media Queries

::: details Purpose
Apply responsive and state-based styles within custom CSS using standard CSS media queries.
:::

Use standard CSS media queries to apply responsive and state-based styles:

```css
.my-element {
  background: white;

@media (prefers-color-scheme: dark) {
  .my-element {
    background: black;
  }
```

For hover states, use the hover media query:

```css
.my-element {
  background: white;

@media (hover: hover) {
  .my-element:hover {
    background: gray;
  }
```

For responsive design, use standard breakpoint media queries:

```css
.my-element {
  padding: 1rem;

@media (min-width: 768px) {
  .my-element {
    padding: 2rem;
  }
```

## Adding Custom Utilities

::: details Purpose
Create your own utility functions that integrate seamlessly with BaroCSS's utility system.
:::

In addition to using the utilities that ship with BaroCSS, you can also add your own custom utilities using the global registry functions. This is the recommended approach for adding custom utilities programmatically.

### AST Helper Functions

::: details Purpose
BaroCSS provides helper functions for creating AST nodes that you can use in your custom utilities.
:::

```typescript
import { 
  decl,      // CSS declaration: decl('color', 'red')
  rule,      // CSS rule with & replacement: rule('&:hover', [decl('color', 'red')])
  styleRule, // CSS rule without & replacement: styleRule('&:hover', [decl('color', 'red')])
  atRule,    // @-rule: atRule('media', '(min-width: 768px)', [rule('.selector', [...])])
  atRoot,    // @at-root: atRoot([rule('.selector', [...])])
  comment,   // CSS comment: comment('This is a comment')
  raw,       // Raw CSS: raw('/* custom css */')
  property   // CSS custom property: property('--my-var', 'initial', 'length')
} from '@barocss/kit';
```

**Common patterns:**

- **`decl(prop, value)`** - Create CSS declarations
- **`rule(selector, nodes)`** - Create CSS rules where `&` is replaced with the final class name
- **`styleRule(selector, nodes)`** - Create CSS rules where `&` is kept as-is (no replacement)
- **`atRule(name, params, nodes)`** - Create @-rules like `@media`, `@keyframes`
- **`atRoot(nodes)`** - Create `@at-root` rules
- **`comment(text)`** - Add CSS comments
- **`raw(value)`** - Insert raw CSS
- **`property(name, initialValue, syntax)`** - Define CSS custom properties

### Understanding Rule Types

::: details Purpose
Learn the difference between `rule` and `styleRule` and when to use each.
:::

**Key difference between `rule` and `styleRule`:**

```typescript
// rule: & gets replaced with the final class name
rule('&:hover', [decl('color', 'red')])
// For class 'btn' → generates: .btn:hover { color: red; }

// styleRule: & stays as-is
styleRule('&:hover', [decl('color', 'red')])
// For class 'btn' → generates: &:hover { color: red; }
```

**When to use each:**

- **Use `rule`** when you want `&` to be replaced with the actual class name (most common case)
- **Use `styleRule`** when you want to keep `&` as-is, typically for global styles or when you need the literal `&` character

### Static Utilities

::: details Purpose
Create utilities with fixed CSS declarations that don't change based on input values.
:::

Use `staticUtility` to register utilities with fixed CSS declarations:

```typescript
import { staticUtility } from '@barocss/kit';
import { decl, rule, styleRule } from '@barocss/kit';

// Simple utility
staticUtility('block', [decl('display', 'block')]);

// Complex utility with selectors (using rule for & replacement)
staticUtility('space-x-custom', [
  rule('& > :not([hidden]) ~ :not([hidden])', [
    decl('margin-inline-start', 'var(--space-x)'),
    decl('margin-inline-end', 'var(--space-x)')
  ])
]);

// Utility with options
staticUtility('custom-bg', [
  decl('background-color', 'var(--custom-color)'),
  decl('border-radius', '8px')
], {
  description: 'Custom background utility',
  category: 'background'
});
```

### Functional Utilities

::: details Purpose
Create utilities that accept dynamic values and can process theme values, arbitrary values, and custom properties.
:::

Use `functionalUtility` to register utilities that accept dynamic values:

```typescript
import { functionalUtility } from '@barocss/kit';
import { decl } from '@barocss/kit';

// Basic functional utility
functionalUtility({
  name: 'custom-text',
  prop: 'color',
  handle: (value) => [decl('color', value)]
});

// Advanced functional utility with theme support
functionalUtility({
  name: 'custom-spacing',
  prop: 'margin',
  themeKey: 'spacing',
  supportsArbitrary: true,
  supportsNegative: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token) => {
    return [decl('margin', value)];
  },
  description: 'Custom spacing utility',
  category: 'spacing'
});
```

### Real-World Examples

::: details Purpose
See practical examples of custom utilities you might add to your project.
:::

Here are some real-world examples of custom utilities you might add to your project:

```typescript
import { staticUtility, functionalUtility } from '@barocss/kit';
import { decl, rule, styleRule } from '@barocss/kit';

// Custom button utilities
staticUtility('btn', [
  decl('display', 'inline-flex'),
  decl('align-items', 'center'),
  decl('justify-content', 'center'),
  decl('padding', '0.5rem 1rem'),
  decl('border-radius', '0.375rem'),
  decl('font-weight', '500'),
  decl('transition', 'all 0.2s')
]);

staticUtility('btn-primary', [
  decl('background-color', 'var(--color-primary)'),
  decl('color', 'white'),
  decl('border', '1px solid var(--color-primary)')
]);

staticUtility('btn-secondary', [
  decl('background-color', 'transparent'),
  decl('color', 'var(--color-primary)'),
  decl('border', '1px solid var(--color-primary)')
]);

// Custom spacing utilities (using rule for & replacement)
functionalUtility({
  name: 'space-x',
  prop: 'margin-inline-start',
  themeKey: 'spacing',
  supportsArbitrary: true,
  supportsNegative: true,
  handle: (value, ctx, token) => {
    const spacing = ctx.theme('spacing', value) || value;
    return [
      rule('& > :not([hidden]) ~ :not([hidden])', [
        decl('margin-inline-start', spacing)
      ])
    ];
  }
});

// Custom typography utilities
functionalUtility({
  name: 'text-fluid',
  prop: 'font-size',
  supportsArbitrary: true,
  handle: (value) => {
    return [decl('font-size', `clamp(1rem, ${value}, 2rem)`)];
  }
});
```

### When to Use Each Approach

::: details Purpose
Understand when to use static vs functional utilities based on your needs.
:::

**Use `staticUtility` when:**
- You have fixed CSS declarations that don't change
- You want simple, predictable utilities
- You need complex selectors or multiple CSS rules

**Use `functionalUtility` when:**
- You need dynamic values (theme values, arbitrary values, etc.)
- You want to support multiple value types (theme, arbitrary, custom properties)
- You need complex logic for value processing

### Advanced Examples

::: details Purpose
See complex examples with @-rules, theme integration, and advanced patterns.
:::

For more complex examples and detailed API reference, see:

- **[Static Utility API](/api/static-utility)** - Complete reference for `staticUtility`
- **[Functional Utility API](/api/functional-utility)** - Complete reference for `functionalUtility`

Here are some quick examples:

```typescript
import { staticUtility, functionalUtility } from '@barocss/kit';
import { decl, rule, atRule, property } from '@barocss/kit';

// Complex static utility with @-rules
staticUtility('dark-mode-toggle', [
  decl('position', 'relative'),
  rule('&::before', [
    decl('content', '""'),
    decl('opacity', '0'),
    decl('transition', 'opacity 0.3s ease')
  ]),
  atRule('media', '(prefers-color-scheme: dark)', [
    rule('&::before', [decl('opacity', '1')])
  ])
]);

// Functional utility with theme support
functionalUtility({
  name: 'text',
  themeKey: 'fontSize',
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token, extra) => {
    if (token.theme) {
      const themeValue = ctx.theme('fontSize', value);
      if (themeValue) return [decl('font-size', themeValue)];
    }
    if (token.arbitrary) return [decl('font-size', value)];
    if (token.customProperty) return [decl('font-size', `var(${value})`)];
    return null;
  }
});
```

## Adding Custom Modifiers

::: details Purpose
Create custom modifiers (variants) that conditionally apply styles based on states or conditions.
:::

Modifiers (also called variants) allow you to conditionally apply styles based on certain states or conditions. BaroCSS provides two ways to create custom modifiers.

### Static Modifiers

::: details Purpose
Create modifiers with fixed CSS selectors for simple, predictable behavior.
:::

Use `staticModifier` to register modifiers with fixed CSS selectors:

```typescript
import { staticModifier } from '@barocss/kit';

// Basic pseudo-class modifier
staticModifier('hover', ['&:hover']);

// Dark mode modifier
staticModifier('dark', ['.dark', '.dark *']);

// Group modifier
staticModifier('group-hover', ['.group:hover &']);

// Custom theme modifier
staticModifier('theme-midnight', ['[data-theme="midnight"]']);
```

### Functional Modifiers

::: details Purpose
Create modifiers with dynamic pattern matching for complex, flexible behavior.
:::

Use `functionalModifier` to register modifiers with dynamic pattern matching:

```typescript
import { functionalModifier } from '@barocss/kit';

// Arbitrary variant support
functionalModifier(
  (mod: string) => /^\[.*\]$/.test(mod),
  ({ selector, mod }) => {
    const m = /^\[(.+)\]$/.exec(mod.type);
    if (!m) return { selector };
    
    const inner = m[1].trim();
    if (inner.startsWith('&')) {
      return { selector: `${inner}`, wrappingType: 'rule' };
    }
    return { selector: `${inner} &`.trim(), wrappingType: 'rule' };
  }
);

// Data attribute modifiers
functionalModifier(
  (mod: string) => /^data-/.test(mod),
  ({ selector, mod }) => {
    const m = /^data-\[([a-zA-Z0-9_-]+)(?:=([^\]]+))?\]$/.exec(mod.type);
    if (m) {
      const key = m[1];
      const value = m[2] ?? 'true';
      return { selector: `&[data-${key}="${value}"]` };
    }
    return { selector };
  }
);
```


## Understanding CSS Generation

::: details Purpose
Learn how BaroCSS transforms your utility classes into optimized CSS.
:::

To understand how BaroCSS transforms your utility classes into optimized CSS, see:

- **[Engine API](/api/engine)** - CSS generation process and `@optimizeAst()` function
- **[AST Processing API](/api/ast-processing)** - Detailed AST manipulation and optimization

 
