# CSSMA v4

A utility class system compatible with Tailwind CSS that converts CSS class names to Figma styles.

## 🚀 Features

- **Registry-based Parsing**: Ensures safety by parsing only registered utilities
- **Static & Functional Utilities**: Supports both fixed and dynamic value processing
- **Tailwind CSS Compatibility**: Compatible with Tailwind CSS syntax
- **Arbitrary Values**: Supports arbitrary values in `bg-[red]` format
- **Custom Properties**: Supports custom properties in `bg-(--my-bg)` format
- **Negative Values**: Supports negative values in `-inset-x-2` format
- **Preset-based Modular System**: Organized preset structure by categories like background, flexbox, grid, spacing, sizing, typography

## 📦 Installation

```bash
npm install cssma-v4
```

## 🔧 Usage

### Basic Usage

```typescript
import { applyClassName } from 'cssma-v4';

const ctx = {
  theme: (key: string, value: string) => {
    // Theme value return logic
    return `var(--${key}-${value})`;
  }
};

// Static Utility
const result1 = applyClassName('inset-x-auto', ctx);
// [{ type: 'decl', prop: 'inset-inline', value: 'auto' }]

// Functional Utility
const result2 = applyClassName('inset-x-4', ctx);
// [{ type: 'decl', prop: 'inset-inline', value: 'calc(var(--spacing) * 4)' }]

// Negative Static Utility
const result3 = applyClassName('-inset-x-px', ctx);
// [{ type: 'decl', prop: 'inset-inline', value: '-1px' }]

// Negative Functional Utility
const result4 = applyClassName('-inset-x-2', ctx);
// [{ type: 'decl', prop: 'inset-inline', value: 'calc(var(--spacing) * -2)' }]
```

### Preset Structure & Utility Categories

CSSMA v4 provides utilities organized by preset categories.

| Preset File         | Main Utility Examples             | Supported Value Types            |
|---------------------|-----------------------------------|----------------------------------|
| background.ts       | bg-*, bg-linear-*, from-*, ...    | static, arbitrary, custom prop   |
| flexbox-grid.ts     | flex-*, grid-cols-*, gap-*, ...   | static, number, fraction, ...    |
| layout.ts           | block, inline, z-*, ...           | static, number, arbitrary, ...   |
| sizing.ts           | w-*, h-*, min-w-*, ...            | static, number, fraction, ...    |
| spacing.ts          | p-*, m-*, space-x-*, ...          | static, number, negative, ...    |
| typography.ts       | text-*, font-*, leading-*, ...    | static, number, arbitrary, ...   |

Each preset is located in the `src/presets/` directory

### Utility Handler Priority & Patterns

Handler functions operate with the following priority:

1. **Arbitrary Value** (`[value]`)
   - If `handle` exists, call handle → return AstNode[]
   - Otherwise, decl(prop, value)
2. **Custom Property** (`(--my-prop)`)
   - If `handleCustomProperty` exists, call handleCustomProperty → return AstNode[]
   - Otherwise, decl(prop, var(--my-prop))
3. **Bare Value** (numbers, fractions, etc.)
   - Call `handleNegativeBareValue`(negative) → `handleBareValue`(positive) in order
   - Otherwise, decl(prop, value)

#### Example

```typescript
functionalUtility({
  name: "col-span",
  prop: "grid-column",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => {
    if (parseNumber(value)) return `span ${value} / span ${value}`;
    return null;
  },
  handleCustomProperty: (value) => [
    decl("grid-column", `span var(${value}) / span var(${value})`),
  ],
  handle: (value) => {
    if (parseNumber(value))
      return [decl("grid-column", `span ${value} / span ${value}`)];
    return null;
  },
});
```

### Test Examples (Based on Actual Implementation)

```typescript
expect(applyClassName("bg-linear-[25deg,red_5%,yellow_60%]", ctx)).toEqual([
  { type: "decl", prop: "background-image", value: "linear-gradient(var(--tw-gradient-stops, 25deg,red 5%,yellow 60%))" },
]);
expect(applyClassName("gap-x-(--my-gap-x)", ctx)).toEqual([
  { type: "decl", prop: "column-gap", value: "var(--my-gap-x)" },
]);
expect(applyClassName("w-1/2", ctx)).toEqual([
  { type: "decl", prop: "width", value: "calc(1/2 * 100%)" },
]);
expect(applyClassName("space-x-2", ctx)).toEqual([
  {
    type: "rule",
    selector: "& > :not([hidden]) ~ :not([hidden])",
    nodes: [
      { type: "decl", prop: "--tw-space-x-reverse", value: "0" },
      { type: "decl", prop: "margin-inline-start", value: "calc(var(--spacing) * 2 * calc(1 - var(--tw-space-x-reverse)))" },
      { type: "decl", prop: "margin-inline-end", value: "calc(var(--spacing) * 2 * var(--tw-space-x-reverse))" },
    ],
  },
]);
```

### Preset Extension and Testing

- When adding new utilities, register them as static/functionalUtility in the corresponding preset file
- All utilities should have tests written for all possible combinations: static, number, arbitrary, custom property, negative, etc. (tests/presets/)
- When extending presets, follow existing preset structure/handler patterns

### Theme Function Usage & Best Practices

#### Theme Lookup Pattern

When using the `theme` function (e.g., `ctx.theme('colors', 'red-500')`), **always provide both the category (theme key) and the value key**. This ensures correct and unambiguous theme value resolution.

**Theme structure example:**
```js
const theme = {
  colors: {
    'red-500': '#ef4444',
    'blue-400': '#60a5fa',
    // ...
  },
  fontSize: { ... },
  spacing: { ... },
  // ...
};
```

**Correct usage:**
```ts
ctx.theme('colors', 'red-500'); // '#ef4444'
ctx.theme('fontSize', 'lg');    // '1.125rem'
```

**Incorrect usage:**
```ts
ctx.theme('red-500'); // ❌ undefined or wrong value
```

#### Why category/key is required
- Keys like 'red-500' may exist in multiple categories (e.g., colors, borderColor, etc.).
- Omitting the category can lead to ambiguous or incorrect lookups.
- Always specify the category for reliable and maintainable handler logic.

#### Handler Implementation Example

In utility handler code, you may see patterns like:
```ts
for (const key of opts.themeKeys) {
  const themeValue = ctx.theme(key, value);
  if (themeValue !== undefined) break;
}
```
- Here, `opts.themeKeys` is an array of possible categories (e.g., ['colors', 'backgroundColor']).
- The handler tries each category in order, returning the first match.
- This is safe only if theme keys are unique across categories, or if the order is well-defined.

#### Best Practices
- **Always use** `theme('category', 'key')` for lookups.
- **Never rely on** just the value key (e.g., 'red-500') alone.
- When writing handlers, pass the correct category (or try a prioritized list if needed).
- If you extend the theme, avoid duplicate keys across categories, or document/handle them explicitly.
- Consider adding warnings or errors if a lookup is ambiguous or missing a category.

#### Example Pitfall
```ts
// BAD: ambiguous, may return undefined or wrong value
ctx.theme('red-500');

// GOOD: always specify category
ctx.theme('colors', 'red-500');
```

## 🏗️ Architecture

### Registry System

A system for registering and managing utilities and modifiers.

```typescript
// Register utility
registerUtility({
  name: 'my-utility',
  match: (className) => className.startsWith('my-utility-'),
  handler: (value, ctx, token) => {
    // Processing logic
    return [decl('my-property', value)];
  }
});

// Register modifier
registerModifier({
  name: 'hover',
  type: 'pseudo',
  match: (mod) => mod.type === 'hover',
  handler: (nodes, mod, ctx) => {
    // Modifier processing logic
    return nodes;
  }
});
```

### Parser System

A system that parses class names and separates them into utilities and modifiers.

```typescript
// Parsing example
parseClassName('hover:inset-x-4');
// {
//   modifiers: [{ type: 'hover' }],
//   utility: { prefix: 'inset-x', value: '4', negative: false }
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

// Negative Functional Utility Tests
expect(applyClassName('-inset-x-2', ctx)).toEqual([
  { type: 'decl', prop: 'inset-inline', value: 'calc(var(--spacing) * -2)' }
]);
```

## 📚 API Reference

### Core Functions

- `applyClassName(className: string, ctx: CssmaContext): AstNode[]`
- `parseClassName(className: string): { modifiers: ParsedModifier[], utility: ParsedUtility }`
- `registerUtility(util: UtilityRegistration): void`
- `registerModifier(mod: ModifierRegistration): void`

### Helper Functions

- `staticUtility(name: string, decls: [string, string][], opts?: object): void`
- `functionalUtility(opts: FunctionalUtilityOptions): void`

### Types

- `CssmaContext`: Context object
- `AstNode`: AST node type
- `ParsedUtility`: Parsed utility type
- `ParsedModifier`: Parsed modifier type

## 🏗️ Utility Registration: staticUtility & functionalUtility

### staticUtility

**Definition:**
- Registers utilities that return fixed CSS values.
- The entire class name must match exactly, and values are fixed at registration time.
- Negative static utilities must also be registered with their full name (e.g., `-inset-x-px`).

**Signature:**
```typescript
staticUtility(
  name: string,
  decls: [string, string][] | [string, string][][],
  opts?: {
    description?: string;
    category?: string;
  }
): void
```

**Parameters:**
- `name`: Class name to register (exact match)
- `decls`: Array of CSS declarations or array of selector+declarations pairs
- `opts`: (Optional) Metadata such as description, category

**Examples:**
```typescript
// Single declaration
staticUtility('inset-x-auto', [['inset-inline', 'auto']]);
// Multiple declarations
staticUtility('truncate', [
  ['overflow', 'hidden'],
  ['text-overflow', 'ellipsis'],
  ['white-space', 'nowrap'],
]);
// selector + declarations (space-x, etc.)
staticUtility('space-x-px', [
  [
    '& > :not([hidden]) ~ :not([hidden])',
    [
      ['--tw-space-x-reverse', '0'],
      ['margin-inline-start', 'calc(1px * calc(1 - var(--tw-space-x-reverse)))'],
      ['margin-inline-end', 'calc(1px * var(--tw-space-x-reverse))'],
    ],
  ],
]);
// Negative static
staticUtility('-inset-x-px', [['inset-inline', '-1px']]);
```

**Features/Best Practices:**
- Only supports exact class name matching (no prefix matching)
- Negative static utilities must be registered with their full name
- Supports multiple CSS declarations and selector+declarations
- Suitable for simple/fixed utilities

---

### functionalUtility

**Definition:**
- Registers utilities that process values dynamically.
- Prefix-based matching (`className.startsWith(name + '-')`)
- Supports various value types: numbers, fractions, arbitrary values, custom properties, negative values, etc.
- Implements dynamic conversion logic with handler functions

**Signature:**
```typescript
functionalUtility({
  name: string;
  prop?: string;
  supportsNegative?: boolean;
  supportsArbitrary?: boolean;
  supportsCustomProperty?: boolean;
  supportsFraction?: boolean;
  themeKey?: string;
  description?: string;
  category?: string;
  handleBareValue?: (args) => string | null;
  handleNegativeBareValue?: (args) => string | null;
  handleCustomProperty?: (value, ctx, token) => AstNode[];
  handle?: (value, ctx, token) => AstNode[] | null;
}): void
```

**Handler Priority:**
1. `handle` (direct processing of all values)
2. `handleCustomProperty` (custom property)
3. `handleNegativeBareValue` (negative)
4. `handleBareValue` (positive/general)

**Handler Parameters:**
- `value`: Parsed value (string)
- `ctx`: Context object
- `token`: Parsed utility information (negative, arbitrary, etc.)

**Examples:**
```typescript
// Supports spacing scale, fraction, arbitrary, custom property
functionalUtility({
  name: 'w',
  prop: 'width',
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsFraction: true,
  handleBareValue: ({ value }) => {
    if (parseNumber(value)) {
      return `calc(var(--spacing) * ${value})`;
    }
    if (parseFractionOrNumber(value)) return `calc(${value} * 100%)`;
    return null;
  },
  description: 'width utility (supports spacing, fraction, arbitrary, custom property, container scale, static)',
  category: 'sizing',
});

// grid-column span (number, arbitrary, custom property)
functionalUtility({
  name: 'col-span',
  prop: 'grid-column',
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => {
    if (parseNumber(value)) return `span ${value} / span ${value}`;
    return null;
  },
  handleCustomProperty: (value) => [
    decl('grid-column', `span var(${value}) / span var(${value})`),
  ],
  handle: (value) => {
    if (parseNumber(value))
      return [decl('grid-column', `span ${value} / span ${value}`)];
    return null;
  },
});
```

**Option Descriptions:**
- `supportsNegative`: Whether -prefix is supported
- `supportsArbitrary`: Whether [value] arbitrary values are supported
- `supportsCustomProperty`: Whether (--) custom properties are supported
- `supportsFraction`: Whether fraction values like 1/2 are supported
- `themeKey`: Key for theme lookup
- `description`, `category`: For documentation/classification

**Best Practices:**
- Most utilities are sufficient with handleBareValue/handleNegativeBareValue/handleCustomProperty only
- Use handle only when you want to directly handle all cases with branching logic
- Custom properties must be handled in handleCustomProperty
- Distinguish registration methods for static/functional utilities (exact matching vs prefix matching)
- Maintain consistent patterns across presets

**Real Preset Usage Examples:**
- w-*, h-*, min-w-* etc. in `src/presets/sizing.ts`
- grid-cols-*, gap-*, col-span-* etc. in `src/presets/flexbox-grid.ts`
- space-x-*, space-y-* etc. in `src/presets/spacing.ts`

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
