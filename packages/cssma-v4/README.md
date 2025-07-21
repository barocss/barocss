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

#### Core Layout & Spacing
| Preset File         | Main Utility Examples             | Supported Value Types            |
|---------------------|-----------------------------------|----------------------------------|
| layout.ts           | block, inline, z-*, position-*, ... | static, number, arbitrary, ...   |
| flexbox-grid.ts     | flex-*, grid-cols-*, gap-*, ...   | static, number, fraction, ...    |
| spacing.ts          | p-*, m-*, space-x-*, ...          | static, number, negative, ...    |
| sizing.ts           | w-*, h-*, min-w-*, ...            | static, number, fraction, ...    |

#### Styling & Visual Effects
| Preset File         | Main Utility Examples             | Supported Value Types            |
|---------------------|-----------------------------------|----------------------------------|
| background.ts       | bg-*, bg-linear-*, from-*, ...    | static, arbitrary, custom prop   |
| border.ts           | border-*, rounded-*, ...          | static, number, arbitrary, ...   |
| typography.ts       | text-*, font-*, leading-*, ...    | static, number, arbitrary, ...   |
| effects.ts          | shadow-*, ring-*, opacity-*, ...  | static, arbitrary, custom prop   |

#### Advanced Features
| Preset File         | Main Utility Examples             | Supported Value Types            |
|---------------------|-----------------------------------|----------------------------------|
| transform.ts        | rotate-*, scale-*, translate-*, ... | static, number, arbitrary, ...   |
| filter.ts           | blur-*, brightness-*, ...         | static, number, arbitrary, ...   |
| backdrop-filter.ts  | backdrop-blur-*, backdrop-*, ...  | static, number, arbitrary, ...   |
| transitions.ts      | transition-*, duration-*, ...     | static, number, arbitrary, ...   |

#### Interactive & Accessibility
| Preset File         | Main Utility Examples             | Supported Value Types            |
|---------------------|-----------------------------------|----------------------------------|
| interactivity.ts    | cursor-*, select-*, ...           | static, arbitrary, ...           |
| accessibility.ts    | sr-only, not-sr-only, ...        | static, ...                      |
| table.ts            | table-*, border-collapse-*, ...   | static, ...                      |
| svg.ts              | fill-*, stroke-*, ...             | static, arbitrary, ...           |

Each preset is located in the `src/presets/` directory and includes comprehensive test coverage.

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

### Core Systems

#### Registry System
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
```

#### Parser System
A system that parses class names and separates them into utilities and modifiers.

```typescript
// Parsing example
parseClassName('hover:inset-x-4');
// {
//   modifiers: [{ type: 'hover' }],
//   utility: { prefix: 'inset-x', value: '4', negative: false }
// }
```

### Variant System

CSSMA v4 includes a comprehensive variant system organized into modular categories:

#### Basic Variants
- **pseudo-classes.ts**: `:hover`, `:focus`, `:active`, `:visited`, `:focus-visible`, `:focus-within`
- **form-states.ts**: `:checked`, `:disabled`, `:required`, `:invalid`, `:enabled`, `:indeterminate`, etc.
- **structural-selectors.ts**: `:first-child`, `:last-child`, `:only-child`, `:nth-child(odd/even)`, etc.
- **media-features.ts**: `motion-safe`, `motion-reduce`, `print`, `portrait`, `landscape`, etc.
- **group-peer.ts**: `group-hover`, `peer-hover`, `peer-checked`
- **attribute-selectors.ts**: `rtl`, `ltr`, `inert`, `open`

#### Advanced Variants
- **nth-selectors.ts**: `nth-1`, `nth-last-1`, `nth-of-type-1`, `nth-last-of-type-1`
- **functional-selectors.ts**: `is-[.foo]`, `where-[.bar]`
- **at-rules.ts**: `supports-[display:grid]`, `layer-[utilities]`, `scope-[.parent]`
- **group-peer-extensions.ts**: `group-focus`, `peer-active`, `parent-open`, `child-hover`

#### Specialized Variants
- **responsive.ts**: `sm:`, `md:`, `lg:`, `xl:`, `2xl:` breakpoints
- **dark-mode.ts**: `dark:` with configurable selectors
- **container-queries.ts**: `@sm:`, `@md:`, `@container/main:`, `@min-[475px]:`
- **has-variants.ts**: `has-[.child]`, `has-[.foo>.bar]`
- **negation-variants.ts**: `not-hover:`, `not-[open]:`, `not-[.foo]:`
- **universal-selectors.ts**: `*:`, `**:` for child/descendant selectors
- **arbitrary-variants.ts**: `[&>*]:`, `aria-[pressed=true]:`, `data-[state=open]:`
- **attribute-variants.ts**: `[open]:`, `[dir=rtl]:`, `[&>*]:`

#### Variant Registration
```typescript
// Static modifier (exact match)
staticModifier('hover', ['&:hover'], { order: 50 });

// Functional modifier (pattern match)
functionalModifier(
  (mod: string) => /^has-\[.*\]$/.test(mod),
  ({ selector, mod }) => {
    const m = /^has-\[(.+)\]$/.exec(mod.type);
    return m ? `${selector}:has(${m[1]})` : selector;
  },
  undefined,
  { order: 200 }
);
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
- Supports various value types: numbers, fractions, arbitrary values, custom properties, negative values, opacity values, etc.
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
  supportsOpacity?: boolean; // <-- NEW
  themeKey?: string;
  description?: string;
  category?: string;
  handleBareValue?: (args) => string | null;
  handleNegativeBareValue?: (args) => string | null;
  handleCustomProperty?: (value, ctx, token) => AstNode[];
  handle?: (value, ctx, token, extra?: { opacity?: string }) => AstNode[] | null;
}): void
```

**supportsOpacity:**
- If `supportsOpacity: true` is set, and the value contains a slash (e.g., `bg-red-500/75`), the opacity value after the slash is automatically extracted and passed to the handler as `extra.opacity`.
- The handler should return both a color-mix (for modern browsers) and a fallback (hex+alpha) AST node, matching Tailwind v4.1+ background-color opacity behavior.

**Example:**
```typescript
functionalUtility({
  name: 'bg',
  themeKeys: ['colors'],
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsOpacity: true,
  handle: (value, ctx, token, extra) => {
    // value: 'red-500', extra.opacity: '75'
    if (extra?.opacity) {
      return [
        {
          type: 'atrule',
          name: 'supports',
          params: '(color:color-mix(in lab, red, red))',
          nodes: [
            decl('background-color', `color-mix(in oklab, var(--color-red-500) 75%, transparent)`)
          ]
        },
        decl('background-color', '#ef4444bf') // fallback
      ];
    }
    return [decl('background-color', 'var(--color-red-500)')];
  },
});
```

**AST Output Example:**
```js
applyClassName('bg-red-500/75', ctx)
// [
//   {
//     type: 'atrule',
//     name: 'supports',
//     params: '(color:color-mix(in lab, red, red))',
//     nodes: [
//       { type: 'decl', prop: 'background-color', value: 'color-mix(in oklab, var(--color-red-500) 75%, transparent)' }
//     ]
//   },
//   { type: 'decl', prop: 'background-color', value: '#ef4444bf' }
// ]
```

**Best Practices:**
- Use supportsOpacity only for utilities that need Tailwind's bg-*-opacity syntax.
- The handler should always return both color-mix and fallback for maximum browser compatibility.
- Tests should verify that both the @supports and fallback decl are present in the AST.

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

## 🧩 Parser & Tokenizer

### Tokenizer
- Splits class names by `:` while respecting nested brackets/parentheses.
- Does **not** classify tokens; only splits.
- Example:
  ```ts
  tokenize('hover:bg-red-500') // [{ value: 'hover', ... }, { value: 'bg-red-500', ... }]
  tokenize('grid-cols-[minmax(200px,calc(100%-var(--width)))]') // [{ value: 'grid-cols-[minmax(200px,calc(100%-var(--width)))]', ... }]
  ```

### Parser
- Consumes tokens and classifies as utility or modifier.
- Supports both `modifier:utility` and `utility:modifier` (bidirectional).
- Example:
  ```ts
  parseClassName('hover:bg-red-500')
  // { modifiers: [{ type: 'hover' }], utility: { prefix: 'bg', value: 'red-500', ... } }
  ```

### Testing
- 60+ tokenizer tests (nested, arbitrary, advanced Tailwind v4)
- 10+ parser tests (bidirectional, error, edge cases)
- See `tests/tokenizer.test.ts`, `tests/parser.test.ts`, `tests/parser.basic.test.ts`

## 🧩 엔진 & CSS 변환 (engine, astToCss)

### 1. 엔진 (engine.ts)
- `applyClassName(className, ctx)`: 단일 className을 AST로 변환
- `generateUtilityCss(classList, ctx, opts?)`: 여러 className을 받아 각각 AST → CSS로 변환 (Tailwind 스타일 유틸리티 CSS 생성)
  - 옵션: `minify`, `dedup` 등 지원
- breakpoints, variant, arbitrary value, custom property 등 모든 Tailwind 문법 지원

#### 예시
```ts
import { generateUtilityCss, createContext } from 'cssma-v4';
const ctx = createContext({ theme: { breakpoints: { sm: '640px' } } });
const css = generateUtilityCss('sm:hover:bg-red-500', ctx);
console.log(css);
// @media (min-width: 640px) {
//   .sm\:hover\:bg-red-500:hover {
//     background-color: #ef4444;
//   }
// }
```

### 2. CSS 변환기 (astToCss.ts)
- AST를 표준 CSS 문자열로 변환
- selector escape(`\:` 등)는 Tailwind CSS와 100% 동일
- 중첩, at-rule(@media), 복합 selector, arbitrary value 등 완벽 지원

#### selector escape 예시
```css
.sm\:hover\:bg-red-500:hover { ... }
```
- HTML: `<div class="sm:hover:bg-red-500">`
- CSS: `.sm\:hover\:bg-red-500:hover { ... }`

### 3. style 태그 적용 예시
```js
const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);
```
- escape된 selector는 브라우저가 정확히 해석 (Tailwind, CSS-in-JS와 동일)

### 4. End-to-End 흐름
1. className → AST (`applyClassName`)
2. AST → CSS (`astToCss`)
3. 여러 className → 유틸리티 CSS (`generateUtilityCss`)
4. CSS → `<style>` 태그에 삽입

### 5. 테스트
- `engine.basic.test.ts`: className → AST → CSS → 기대값까지 end-to-end 검증
- escape, 반응형, arbitrary, variant, custom property 등 모든 케이스 커버

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
