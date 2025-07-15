# CSSMA v4 Product Requirements Document (PRD)

---

## 1. Engine System (`engine.ts`)

### 1.1 Design Intent
- **Single Entry Point:** All class name transformations start here. Handles parsing, matching, AST transformation, and modifier application in a unified flow.
- **Extensibility:** Designed so plugins/custom parsers/handlers can easily hook into the process.

### 1.2 Main Functions and Internal Flow

#### `applyClassName(className, ctx): AstNode[]`
- Parses a single utility class name and returns the corresponding AST nodes.
- Handles modifiers, negative values, arbitrary values, and custom properties.

#### `applyClassList(classList, ctx): AstNode[]`
- Parses a space-separated list of class names and returns the merged AST nodes.

#### `applyClassNames(classNames: string[], ctx): AstNode[]`
- Parses an array of class names and returns the merged AST nodes.

---

## 2. AST System (`ast.ts`)

### 2.1 AST Node Types
- `decl`: CSS property declaration (e.g., `{ type: 'decl', prop: 'color', value: '#fff' }`)
- `atrule`: CSS at-rule (e.g., `{ type: 'atrule', name: 'supports', params: '...', nodes: [...] }`)
- `rule`: CSS selector rule (e.g., `{ type: 'rule', selector: '.foo', nodes: [...] }`)
- `comment`: Comment node

### 2.2 AST Construction
- All handler functions must return AST nodes in this format.
- AST is designed to be serializable to CSS or Figma style objects.

---

## 3. Parser System (`parser.ts`)

### 3.1 Class Name Parsing
- Splits class name into prefix, value, negative, arbitrary, custom property, and modifiers.
- Does **not** parse opacity (e.g., `bg-red-500/75` is passed as value: `red-500/75`).
- Returns a `ParsedUtility` object with all parsed fields.

### 3.2 Modifier Parsing
- Handles responsive, state, and arbitrary modifiers (e.g., `md:hover:bg-red-500`).
- Modifiers are applied in order of appearance.

---

## 4. Registry System (`registry.ts`)

### 4.1 Utility Registration
- **staticUtility:** Registers exact-match utilities (e.g., `block`, `inline-block`).
- **functionalUtility:** Registers prefix-based utilities (e.g., `bg-`, `text-`, `m-`).
- Utilities are registered with handler functions and options (supportsArbitrary, supportsCustomProperty, supportsNegative, supportsOpacity, etc.).

### 4.2 Handler Resolution
- On class name match, the corresponding handler is called with the parsed value and context.
- Handler returns AST nodes for the utility.

---

## 5. Preset System (`presets/`)

### 5.1 Preset Structure
- Each preset file (e.g., `background.ts`, `typography.ts`) registers a group of related utilities.
- Presets are imported and registered in the main registry.

### 5.2 Utility Categories
- Backgrounds, borders, colors, effects, layout, spacing, typography, etc.
- Each category covers all Tailwind-compatible utilities, including static, functional, arbitrary, and custom property cases.

### 5.3 Test Coverage
- Each preset has a corresponding test file (e.g., `background.test.ts`) with comprehensive test cases for all supported utilities and edge cases.

### 5.4 Handler Design Principles (based on real implementation)

- Most utilities can be covered with handleBareValue, handleNegativeBareValue, and handleCustomProperty only.
- Use handle only for advanced or special cases.
- Custom properties must always be handled in handleCustomProperty.
- Distinguish static/functional utility registration (exact match vs prefix match).
- If `supportsOpacity: true` is set on functionalUtility, and the value contains a slash (e.g., `bg-red-500/75`), the opacity value after the slash is automatically extracted and passed to the handler as `extra.opacity`.
- The handler must return both a color-mix (for modern browsers) and a fallback (hex+alpha) AST node, matching Tailwind v4.1+ background-color opacity behavior.
- **Example:**

```typescript
functionalUtility({
  name: 'bg',
  themeKeys: ['colors'],
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsOpacity: true,
  handle: (value, ctx, token, extra) => {
    let main = value;
    let opacity = extra?.opacity;
    if (!opacity && typeof value === 'string' && value.includes('/')) {
      [main, opacity] = value.split('/');
    }
    // ...resolve color...
    if (opacity) {
      return [
        {
          type: 'atrule',
          name: 'supports',
          params: '(color:color-mix(in lab, red, red))',
          nodes: [
            { type: 'decl', prop: 'background-color', value: `color-mix(in oklab, ${main} ${opacity}%, transparent)` }
          ]
        },
        { type: 'decl', prop: 'background-color', value: '#hexalpha' }
      ];
    }
    // ...fallback for no opacity...
  }
});
```

- **Test Example:**

```typescript
it('bg-red-500/75 → background-color: var(--color-red-500) with opacity', () => {
  expect(applyClassName('bg-red-500/75', ctx)).toEqual([
    {
      type: 'atrule',
      name: 'supports',
      params: '(color:color-mix(in lab, red, red))',
      nodes: [
        { type: 'decl', prop: 'background-color', value: 'color-mix(in oklab, var(--color-red-500) 75%, transparent)' }
      ]
    },
    { type: 'decl', prop: 'background-color', value: '#ef4444bf' }
  ]);
});
```

---

## 6. Theme System

### 6.1 Theme Lookup
- Always use both category and key for theme lookups (e.g., `ctx.theme('colors', 'red-500')`).
- Never look up by key only (e.g., `'red-500'`), as keys may overlap across categories.
- Handlers must reference the correct theme category for each utility.

---

## 7. Extensibility & Best Practices

- All utility registration and handler logic should be modular and easily extendable.
- New utility categories or custom plugins can be added by creating new preset files and registering them in the registry.
- All new features must include comprehensive tests and documentation.

---

## 8. Testing & Quality Assurance

- 100% test coverage for all core logic and presets.
- Tests must cover static, functional, arbitrary, custom property, and modifier cases.
- All tests must be written in clear, unambiguous language, specifying exact expected AST output.

---

## 9. Documentation

- All core systems, presets, and handler patterns must be documented in README.md and PRD.md.
- Documentation must include API signatures, usage examples, handler design notes, and test examples.
- All documentation must be in English for international contributors. 