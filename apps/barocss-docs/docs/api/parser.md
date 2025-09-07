---
title: Parser API
description: Class name parsing and tokenization in BaroCSS
---

# Parser API

::: tip Learning Path
This is **Step 2** in the BaroCSS API learning path. Learn how utility classes are parsed and tokenized.
:::

The Parser API handles the parsing and tokenization of CSS class names into structured data that can be processed by the BaroCSS engine. This is the first step in the CSS generation process.

## 🎯 What You'll Learn

- How utility classes are parsed and tokenized
- Understanding the parsing process step by step
- Using the IncrementalParser for efficient processing
- Error handling and validation

## 📚 Prerequisites

- **[Context API](/api/context)** - Understanding contexts and configuration

## 📚 Next Steps

After mastering the Parser API, continue with:
- **[Engine API](/api/engine)** - CSS generation and AST processing
- **[AST Processing API](/api/ast-processing)** - Advanced AST manipulation

## Core Functions

### parseClassToAst()

Parses a CSS class name into an Abstract Syntax Tree.

```typescript
import { parseClassToAst, createContext } from '@barocss/kit';

const ctx = createContext();
const ast = parseClassToAst('bg-blue-500 hover:bg-blue-600', ctx);
```

**Parameters:**
- `className` (string): CSS class name to parse
- `ctx` (Context): BaroCSS context

**Returns:**
- `AstNode[]`: Array of AST nodes representing the parsed class

**Features:**
- **Variant Parsing**: Handles pseudo-classes, media queries, and other variants
- **Value Extraction**: Extracts values from functional utilities
- **Validation**: Validates class names against registered utilities
- **Error Handling**: Returns empty array for invalid classes

**Example:**
```typescript
const ast = parseClassToAst('sm:dark:hover:bg-red-500', ctx);
// Returns AST with media query, dark mode, and hover variants
```

### parseClassName()

Tokenizes a class name into its component parts.

```typescript
import { parseClassName } from '@barocss/kit';

const tokens = parseClassName('hover:bg-blue-500');
// Returns: ['hover', 'bg-blue-500']
```

**Parameters:**
- `className` (string): Class name to tokenize

**Returns:**
- `string[]`: Array of tokens

**Use Cases:**
- **Debugging**: Understanding how classes are parsed
- **Validation**: Checking class structure before processing
- **Custom Processing**: Building custom class handling logic

## Incremental Parser

The `IncrementalParser` class provides efficient processing of CSS classes with caching and batch processing.

### Basic Usage

```typescript
import { IncrementalParser, createContext } from '@barocss/kit';

const ctx = createContext();
const parser = new IncrementalParser(ctx);

// Process single class
const result = parser.processClass('bg-blue-500');

// Process multiple classes
const results = parser.processClasses(['bg-blue-500', 'text-white', 'p-4']);
```

### Class: IncrementalParser

```typescript
class IncrementalParser {
  constructor(ctx: Context);
  
  // Process single class
  processClass(className: string): ParseResult;
  
  // Process multiple classes
  processClasses(classNames: string[]): ParseResult[];
  
  // Get processing statistics
  getStats(): ParserStats;
  
  // Clear processed classes
  clearCache(): void;
```

### Parser Statistics

```typescript
interface ParserStats {
  processedClasses: number;
  pendingClasses: number;
  cacheHits: number;
  cacheMisses: number;
  averageProcessingTime: number;
```

## Parsing Process

The parsing process follows these steps:

1. **Tokenization**: Split class name into tokens
2. **Variant Detection**: Identify variants (hover:, sm:, etc.)
3. **Utility Matching**: Match against registered utilities
4. **Value Extraction**: Extract values from functional utilities
5. **AST Building**: Create AST nodes for valid classes

### Example: Complex Class Parsing

```typescript
import { parseClassToAst, createContext } from '@barocss/kit';

const ctx = createContext();

// Parse complex class with multiple variants
const ast = parseClassToAst('sm:dark:hover:bg-red-500/50', ctx);

// AST structure:
// [
//   {
//     type: "at-rule",
//     name: "media",
//     params: "(min-width: 640px)",
//     source: "responsive",
//     nodes: [
//       {
//         type: "rule",
//         selector: ".dark &:hover",
//         source: "dark",
//         nodes: [
//           {
//             type: "decl",
//             prop: "background-color",
//             value: "rgba(239, 68, 68, 0.5)"
//           }
//         ]
//       }
//     ]
//   }
// ]
```

## Error Handling

The parser handles various error conditions gracefully:

```typescript
try {
  const ast = parseClassToAst('invalid-class', ctx);
  if (ast.length === 0) {
    console.warn('Invalid class name');
  }
} catch (error) {
  console.error('Parsing error:', error);
```

**Common Error Cases:**
- **Invalid Utilities**: Classes that don't match any registered utility
- **Malformed Variants**: Incorrectly formatted variant syntax
- **Invalid Values**: Values that don't match utility expectations
- **Context Errors**: Missing or invalid context

## Related APIs

- [Engine API](/api/engine) - CSS generation and AST processing
- [Context API](/api/context) - Configuration and theme management
- [Browser Runtime](/api/browser-runtime) - Browser integration
- [Server Runtime](/api/server-runtime) - Server-side usage
