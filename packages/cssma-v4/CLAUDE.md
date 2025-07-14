# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Run tests
npm test

# Run specific test file
npm test -- tests/engine.basic.test.ts

# Run tests with specific pattern
npm test -- --grep "inset"
```

## Project Architecture

CSSMA v4 is a utility-first CSS framework that transforms Tailwind CSS-compatible class names into CSS AST nodes for Figma styling. The system is built around a modular architecture with clear separation of concerns.

### Core Components

**Engine (`src/core/engine.ts`)**
- Main entry point: `applyClassName(className, ctx)` → `AstNode[]`
- Orchestrates the entire transformation pipeline: parse → match → transform → apply modifiers
- Uses a generator-based `modifierChain()` for flexible modifier application order
- Extensible via plugins and custom handlers

**Parser (`src/core/parser.ts`)**
- Parses class names into `{ modifiers, utility }` structure
- Supports complex syntax: arbitrary values `bg-[red]`, custom properties `bg-(--my-bg)`, negative values `-inset-x-2`, fractions `w-1/2`
- Registry-based prefix matching for dynamic utility recognition
- Handles nested syntax like `text-[color:var(--foo)]`

**Registry (`src/core/registry.ts`)**
- Central registration system for utilities and modifiers
- Two utility types:
  - `staticUtility()`: Exact name matching with fixed CSS declarations
  - `functionalUtility()`: Prefix-based matching with dynamic value processing
- Modifier registration with flexible matching and AST transformation
- Provides utility prefix lists for parser optimization

**Context (`src/core/context.ts`)**
- Manages theme values, configuration, and plugin system
- Provides theme lookup: `ctx.theme('colors', 'red', '500')`
- Handles deep merging of presets, user themes, and extensions

**Preset System (`src/presets/utilities.ts`)**
- Tailwind CSS-compatible utility definitions
- Comprehensive coverage: layout, positioning, sizing, colors, etc.
- Each utility supports multiple value types (theme, arbitrary, custom properties, fractions)

### Key Design Patterns

**Registry-Based Parsing**: All utilities and modifiers are registered in a central registry, allowing the parser to dynamically recognize new utilities without code changes.

**AST-First Approach**: All transformations produce AST nodes rather than CSS strings, enabling flexible output generation.

**Modifier Chain**: Modifiers are applied in reverse order (outermost first) using a generator pattern, allowing for dynamic modifier injection.

**Value Processing Pipeline**: Utilities handle multiple value types through a standardized pipeline: arbitrary → custom property → theme lookup → fraction → negative/bare value handlers.

## Testing Structure

Tests are organized by component:
- `engine.basic.test.ts`: Core engine functionality
- `engine.preset.test.ts`: Preset utility testing
- `parser.basic.test.ts`: Parser functionality
- `astToCss.basic.test.ts`: AST to CSS conversion

## Common Patterns

**Adding New Utilities**:
```typescript
// Static utility (exact match)
staticUtility('block', [['display', 'block']]);

// Functional utility (prefix match with dynamic values)
functionalUtility({
  name: 'z',
  supportsNegative: true,
  supportsArbitrary: true,
  handleBareValue: ({ value }) => /^-?\d+$/.test(value) ? value : null,
  handle: (value) => [decl('z-index', value)],
});
```

**Adding New Modifiers**:
```typescript
registerModifier({
  name: 'hover',
  type: 'pseudo',
  match: (mod) => mod.type === 'hover',
  handler: (nodes) => nodes.map(n => ({ ...n, selector: ':hover' })),
});
```

## Important Implementation Details

- Negative values are handled by the parser setting `utility.negative = true` and the engine prepending `-` to the value
- Prefix matching prioritizes longer prefixes first to avoid conflicts
- The system supports complex nested syntax through bracket counting in the parser
- All utilities go through the same value processing pipeline for consistency
- The modifier chain generator allows for plugin-based extension of modifier behavior