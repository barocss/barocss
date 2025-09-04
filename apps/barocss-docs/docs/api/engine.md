---
title: Engine API
description: Core CSS generation and AST processing in BaroCSS
---

# Engine API

The Engine API provides the core functionality for parsing class names, building Abstract Syntax Trees (ASTs), and generating CSS. This is the foundation that powers all CSS generation in BaroCSS.

## Core Functions

### parseClassToAst()

Parses a CSS class name into an Abstract Syntax Tree.

```typescript
import { parseClassToAst, createContext } from 'barocss';

const ctx = createContext();
const ast = parseClassToAst('bg-blue-500 hover:bg-blue-600', ctx);
```

**Parameters:**
- `className` (string): The CSS class name to parse
- `ctx` (Context): BaroCSS context

**Returns:**
- `AstNode[]`: Array of AST nodes representing the parsed class

**Example:**
```typescript
const ast = parseClassToAst('sm:dark:hover:bg-red-500', ctx);
// Returns AST with media query, dark mode, and hover variants
```

### generateCss()

Generates CSS from a space-separated list of class names.

```typescript
import { generateCss, createContext } from 'barocss';

const ctx = createContext();
const css = generateCss('bg-blue-500 text-white p-4', ctx);
```

**Parameters:**
- `classList` (string): Space-separated class names
- `ctx` (Context): BaroCSS context
- `opts` (object, optional): Generation options

**Options:**
```typescript
interface GenerateOptions {
  minify?: boolean;  // Minify CSS output
  dedup?: boolean;   // Remove duplicate classes
}
```

**Returns:**
- `string`: Generated CSS

**Example:**
```typescript
const css = generateCss('bg-blue-500 hover:bg-blue-600 focus:ring-2', ctx, {
  minify: true,
  dedup: true
});
```

### generateCssRules()

Generates detailed CSS rules for multiple classes with metadata.

```typescript
import { generateCssRules, createContext } from 'barocss';

const ctx = createContext();
const rules = generateCssRules('bg-blue-500 text-white', ctx);
```

**Parameters:**
- `classList` (string): Space-separated class names
- `ctx` (Context): BaroCSS context
- `opts` (object, optional): Generation options

**Returns:**
- `GenerateCssRulesResult[]`: Array of detailed rule objects

**Rule Object:**
```typescript
interface GenerateCssRulesResult {
  cls: string;        // Original class name
  ast: AstNode[];     // AST nodes
  css: string;        // Generated CSS
  cssList: string[];  // Individual CSS rules
  rootCss: string;    // Root CSS variables
  rootCssList: string[]; // Individual root rules
}
```

## AST Processing

### optimizeAst()

Optimizes AST by merging and organizing nodes for efficient CSS generation.

```typescript
import { optimizeAst, parseClassToAst } from 'barocss';

const ast = parseClassToAst('bg-blue-500', ctx);
const optimized = optimizeAst(ast);
```

### collectDeclPaths()

Collects all declaration paths from an AST tree.

```typescript
import { collectDeclPaths } from 'barocss';

const paths = collectDeclPaths(ast);
// Returns array of paths from root to declarations
```

### declPathToAst()

Converts a declaration path back to an AST structure.

```typescript
import { declPathToAst } from 'barocss';

const ast = declPathToAst(declPath);
```

## Incremental Parser

The `IncrementalParser` class provides efficient processing of CSS classes with caching and batch processing.

### Basic Usage

```typescript
import { IncrementalParser, createContext } from 'barocss';

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
  processClass(className: string): GenerateCssRulesResult | null;
  
  // Process multiple classes
  processClasses(classes: string[]): GenerateCssRulesResult[];
  
  // Add classes to pending queue
  addToPending(classes: string[]): void;
  
  // Get processing statistics
  getStats(): ParserStats;
  
  // Clear processed classes
  clearProcessed(): void;
  
  // Check if class is processed
  isProcessed(cls: string): boolean;
  
  // Mark class as processed
  markProcessed(cls: string): void;
  
  // Get all processed classes
  getProcessedClasses(): string[];
}
```

### Parser Statistics

```typescript
interface ParserStats {
  processedClasses: number;
  pendingClasses: number;
  cacheStats: {
    ast: CacheStats;
    css: CacheStats;
  };
}
```

## AST Node Types

BaroCSS uses a comprehensive AST system for representing CSS structures.

### AstNode Types

```typescript
type AstNode =
  | { type: "decl"; prop: string; value: string | [string, string][]; source?: string }
  | { type: "rule"; selector: string; nodes: AstNode[]; source?: string }
  | { type: "style-rule"; selector: string; nodes: AstNode[]; source?: string }
  | { type: "at-rule"; name: string; params: string; nodes: AstNode[]; source?: string }
  | { type: "at-root"; nodes: AstNode[]; source?: string }
  | { type: "comment"; text: string; source?: string }
  | { type: "raw"; value: string; source?: string }
  | { type: "wrap"; items: AstNode[]; source?: string };
```

### AST Helper Functions

```typescript
import { 
  decl, 
  rule, 
  styleRule, 
  atRule, 
  atRoot, 
  comment, 
  raw 
} from 'barocss';

// Create declaration
const colorDecl = decl('color', 'red');

// Create rule
const buttonRule = rule('.button', [colorDecl]);

// Create at-rule
const mediaRule = atRule('media', '(min-width: 768px)', [buttonRule]);

// Create at-root
const rootRule = atRoot([colorDecl]);
```

## CSS Generation Pipeline

The CSS generation process follows this pipeline:

1. **Parse**: `parseClassName()` - Tokenize and parse class names
2. **AST**: `parseClassToAst()` - Build Abstract Syntax Tree
3. **Optimize**: `optimizeAst()` - Merge and organize AST nodes
4. **Generate**: `astToCss()` - Convert AST to CSS string

```typescript
// Complete pipeline example
const className = 'sm:dark:hover:bg-red-500';

// 1. Parse class name
const { modifiers, utility } = parseClassName(className);

// 2. Build AST
const ast = parseClassToAst(className, ctx);

// 3. Optimize AST
const optimized = optimizeAst(ast);

// 4. Generate CSS
const css = astToCss(optimized, className);
```

## Performance Features

### Caching

BaroCSS includes multiple caching layers for optimal performance:

- **AST Cache**: Caches parsed ASTs
- **Parse Result Cache**: Caches parsed class names
- **Utility Cache**: Caches utility prefix lookups
- **Failure Cache**: Caches invalid class names

### Batch Processing

The IncrementalParser supports efficient batch processing:

```typescript
const parser = new IncrementalParser(ctx);

// Process classes in batches
const results = parser.processClasses([
  'bg-blue-500',
  'text-white',
  'p-4',
  'hover:bg-blue-600',
  'focus:ring-2'
]);

// Add to pending queue for async processing
parser.addToPending(['new-class-1', 'new-class-2']);
```

## Examples

### Basic CSS Generation

```typescript
import { createContext, generateCss } from 'barocss';

const ctx = createContext({
  theme: {
    extend: {
      colors: {
        brand: '#3b82f6'
      }
    }
  }
});

const css = generateCss('bg-brand text-white p-4 rounded-lg', ctx);
```

### Advanced AST Processing

```typescript
import { 
  createContext, 
  parseClassToAst, 
  optimizeAst, 
  astToCss 
} from 'barocss';

const ctx = createContext();

// Parse complex class
const ast = parseClassToAst('sm:dark:hover:bg-red-500/50', ctx);

// Optimize AST
const optimized = optimizeAst(ast);

// Generate CSS
const css = astToCss(optimized, 'sm:dark:hover:bg-red-500/50');
```

### Incremental Processing

```typescript
import { IncrementalParser, createContext } from 'barocss';

const ctx = createContext();
const parser = new IncrementalParser(ctx);

// Process classes incrementally
const results = parser.processClasses([
  'bg-blue-500',
  'text-white',
  'p-4'
]);

// Get statistics
const stats = parser.getStats();
console.log(`Processed ${stats.processedClasses} classes`);
```

## Error Handling

The Engine API includes comprehensive error handling:

```typescript
try {
  const ast = parseClassToAst('invalid-class', ctx);
  if (ast.length === 0) {
    console.warn('Invalid class name');
  }
} catch (error) {
  console.error('Parsing error:', error);
}
```

## Best Practices

1. **Reuse Contexts**: Create contexts once and reuse them
2. **Use IncrementalParser**: For applications with many classes
3. **Batch Processing**: Process multiple classes together
4. **Cache Management**: Monitor cache statistics for performance
5. **Error Handling**: Always handle parsing errors gracefully

## Related APIs

- [Context API](/api/context) - Theme and configuration management
- [Parser API](/api/parser) - Class name parsing details
- [Browser Runtime](/api/browser-runtime) - Browser integration
- [Server Runtime](/api/server-runtime) - Server-side usage
