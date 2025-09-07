---
title: AST Processing API
description: Advanced AST manipulation and optimization functions in BaroCSS
---

# AST Processing API

::: tip Learning Path
This is **Step 4** in the BaroCSS API learning path. Advanced concepts for understanding internal mechanisms.
:::

::: tip Conceptual Importance
While you may not use these functions directly in your applications, understanding the AST processing pipeline is crucial for comprehending how BaroCSS transforms utility classes into optimized CSS. This knowledge helps you understand the internal workings and make informed decisions about utility design and CSS generation.
:::

## 🎯 What You'll Learn

- How ASTs are processed and optimized
- Internal functions used by the CSS generation process
- Complex examples of multi-value utilities
- Deep understanding of BaroCSS internals

## 📚 Prerequisites

- **[Context API](/api/context)** - Understanding contexts
- **[Engine API](/api/engine)** - Understanding CSS generation

## 📚 Related APIs

- **[Engine API](/api/engine)** - Main CSS generation functions
- **[Context API](/api/context)** - Configuration and theme management

The AST Processing API provides advanced functions for manipulating and optimizing Abstract Syntax Trees in BaroCSS. These functions are used internally by the CSS generation process but are also available for advanced use cases.

## Core Functions

### collectDeclPaths()

::: details Purpose
Collects all paths from AST tree to declaration nodes (leaves), including variant chains.
:::

```typescript
import { collectDeclPaths } from '@barocss/kit';

const declPaths = collectDeclPaths(ast);
```

**Parameters:**
- `nodes` (AstNode[]): AST tree to process
- `path` (PathNode[]): Recursive use (initial value omitted)

**Returns:**
- `DeclPath[]`: Array of paths to each declaration

**What it does:**
- Extracts all declaration paths from complex AST structures
- Used for path extraction for AST optimization/merging
- Creates flat list of all declaration-to-root paths

**Example:**
```typescript
const ast = [
  {
    type: "rule",
    selector: "&:hover",
    source: "pseudo",
    nodes: [
      { type: "decl", prop: "background-color", value: "#3b82f6" }
    ]
  }
];

const declPaths = collectDeclPaths(ast);
// Returns: [
//   [
//     { type: "rule", selector: "&:hover", source: "pseudo" },
//     { type: "decl", prop: "background-color", value: "#3b82f6" }
//   ]
// ]
```

### declPathToAst()

::: details Purpose
Converts a declaration-to-root path (variant chain) to actual nested AST structure.
:::

```typescript
import { declPathToAst } from '@barocss/kit';

const ast = declPathToAst(declPath);
```

**Parameters:**
- `declPath` (DeclPath): Declaration path from `collectDeclPaths`

**Returns:**
- `AstNode[]`: Nested AST structure

::: tip Key Features
- **Sorting**: Variants are sorted by priority (at-rule > style-rule > rule > decl)
- **Merging**: Consecutive same variants are merged
- **Nesting**: Variants are nested in outside→inside order
- **Selector Merging**: Multiple selectors are merged by source
:::

**Example:**
```typescript
const declPath = [
  { type: "rule", selector: "&:hover", source: "pseudo" },
  { type: "decl", prop: "background-color", value: "#3b82f6" }
];

const ast = declPathToAst(declPath);
// Returns: [
//   {
//     type: "rule",
//     selector: "&:hover",
//     source: "pseudo",
//     nodes: [
//       { type: "decl", prop: "background-color", value: "#3b82f6" }
//     ]
//   }
// ]
```

### mergeAstTreeList()

::: details Purpose
Takes a list of `declPathToAst` results and merges them into a single optimized AST tree.
:::

```typescript
import { mergeAstTreeList } from '@barocss/kit';

const merged = mergeAstTreeList(astList);
```

**Parameters:**
- `astList` (AstNode[][]): Array of AST trees from `declPathToAst`

**Returns:**
- `AstNode[]`: Merged and optimized AST tree

::: warning Optimization Features
- **Deduplication**: Removes duplicate rules and declarations
- **Grouping**: Groups similar rules together
- **Merging**: Merges compatible selectors and properties
- **Structure**: Maintains proper CSS nesting structure
:::

**Example:**
```typescript
const astList = [
  [
    { type: "rule", selector: "&:hover", nodes: [...] }
  ],
  [
    { type: "rule", selector: "&:focus", nodes: [...] }
  ]
];

const merged = mergeAstTreeList(astList);
// Returns: Merged AST with both hover and focus rules
```

### optimizeAst()

::: tip Main Function
The main function that orchestrates the entire AST optimization process.
:::

```typescript
import { optimizeAst } from '@barocss/kit';

const optimized = optimizeAst(ast);
```

**Parameters:**
- `ast` (AstNode[]): Raw AST from `parseClassToAst`

**Returns:**
- `AstNode[]`: Optimized AST tree

::: details Process Steps
1. Calls `collectDeclPaths()` to extract declaration paths
2. Calls `declPathToAst()` for each path to create nested structures
3. Calls `mergeAstTreeList()` to merge and optimize the final tree
:::

**Example:**
```typescript
const ast = parseClassToAst('hover:bg-blue-500 focus:ring-2', ctx);
const optimized = optimizeAst(ast);
// Returns: Optimized AST with merged hover and focus rules
```

## Complex AST Processing Example

::: warning Advanced Example
Let's walk through how `optimizeAst()` processes a complex AST with multiple variants and utilities. This example demonstrates the real-world complexity that BaroCSS handles internally.
:::

### Input: Complex Utility Classes

```typescript
// Input utility classes: "sm:dark:hover:bg-linear-to-r from-blue-500 to-red-500 focus:ring-2"
const ast = parseClassToAst('sm:dark:hover:bg-linear-to-r from-blue-500 to-red-500 focus:ring-2', ctx);
```

### Step 1: Raw AST from parseClassToAst

```typescript
// Raw AST structure - Multiple values exist simultaneously in a single utility
const rawAst = [
  {
    type: "rule",
    selector: "&:hover",
    source: "pseudo",
    nodes: [
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        source: "responsive",
        nodes: [
          {
            type: "rule",
            selector: ".dark &",
            source: "dark",
            nodes: [
              // bg-linear-to-r utility - Multiple CSS properties and variable definitions
              {
                type: "at-root",
                nodes: [
                  { type: "property", prop: "--baro-gradient-position" },
                  { type: "property", prop: "--baro-gradient-from", value: "#0000", syntax: "<color>" },
                  { type: "property", prop: "--baro-gradient-via", value: "#0000", syntax: "<color>" },
                  { type: "property", prop: "--baro-gradient-to", value: "#0000", syntax: "<color>" },
                  { type: "property", prop: "--baro-gradient-stops", value: "transparent" },
                  { type: "property", prop: "--baro-gradient-from-position", value: "0%", syntax: "<length-percentage>" },
                  { type: "property", prop: "--baro-gradient-via-position", value: "50%", syntax: "<length-percentage>" },
                  { type: "property", prop: "--baro-gradient-to-position", value: "100%", syntax: "<length-percentage>" }
                ]
              },
              {
                type: "decl",
                prop: "--baro-gradient-position",
                value: "to right"
              },
              {
                type: "style-rule",
                selector: "@supports (background-image: linear-gradient(in lab, red, red))",
                nodes: [
                  {
                    type: "decl",
                    prop: "--baro-gradient-position",
                    value: "to right in oklab"
                  }
                ]
              },
              {
                type: "decl",
                prop: "background-image",
                value: "linear-gradient(to right, var(--baro-gradient-stops))"
              }
            ]
          }
        ]
      }
    ]
  },
  // from-blue-500 utility - Gradient stop definition
  {
    type: "at-root",
    nodes: [
      { type: "property", prop: "--baro-gradient-position" },
      { type: "property", prop: "--baro-gradient-from", value: "#0000", syntax: "<color>" },
      { type: "property", prop: "--baro-gradient-via", value: "#0000", syntax: "<color>" },
      { type: "property", prop: "--baro-gradient-to", value: "#0000", syntax: "<color>" },
      { type: "property", prop: "--baro-gradient-stops", value: "transparent" },
      { type: "property", prop: "--baro-gradient-from-position", value: "0%", syntax: "<length-percentage>" },
      { type: "property", prop: "--baro-gradient-via-position", value: "50%", syntax: "<length-percentage>" },
      { type: "property", prop: "--baro-gradient-to-position", value: "100%", syntax: "<length-percentage>" }
    ]
  },
  {
    type: "decl",
    prop: "--baro-gradient-from",
    value: "#3b82f6"
  },
  {
    type: "decl",
    prop: "--baro-gradient-to",
    value: "transparent"
  },
  {
    type: "decl",
    prop: "--baro-gradient-stops",
    value: "var(--baro-gradient-from),var(--baro-gradient-to)"
  },
  // to-red-500 utility - Gradient stop definition
  {
    type: "at-root",
    nodes: [
      { type: "property", prop: "--baro-gradient-position" },
      { type: "property", prop: "--baro-gradient-from", value: "#0000", syntax: "<color>" },
      { type: "property", prop: "--baro-gradient-via", value: "#0000", syntax: "<color>" },
      { type: "property", prop: "--baro-gradient-to", value: "#0000", syntax: "<color>" },
      { type: "property", prop: "--baro-gradient-stops", value: "transparent" },
      { type: "property", prop: "--baro-gradient-from-position", value: "0%", syntax: "<length-percentage>" },
      { type: "property", prop: "--baro-gradient-via-position", value: "50%", syntax: "<length-percentage>" },
      { type: "property", prop: "--baro-gradient-to-position", value: "100%", syntax: "<length-percentage>" }
    ]
  },
  {
    type: "decl",
    prop: "--baro-gradient-to",
    value: "#ef4444"
  },
  // focus:ring-2 utility
  {
    type: "rule",
    selector: "&:focus",
    source: "pseudo",
    nodes: [
      {
        type: "decl",
        prop: "box-shadow",
        value: "0 0 0 2px #3b82f6"
      }
    ]
  }
];
```

### Step 2: collectDeclPaths() - Extract Declaration Paths

```typescript
const declPaths = collectDeclPaths(rawAst);
// Returns: [
//   // Multiple declarations from bg-linear-to-r
//   [
//     { type: "rule", selector: "&:hover", source: "pseudo" },
//     { type: "at-rule", name: "media", params: "(min-width: 640px)", source: "responsive" },
//     { type: "rule", selector: ".dark &", source: "dark" },
//     { type: "at-root", nodes: [...] },
//     { type: "decl", prop: "--baro-gradient-position", value: "to right" }
//   ],
//   [
//     { type: "rule", selector: "&:hover", source: "pseudo" },
//     { type: "at-rule", name: "media", params: "(min-width: 640px)", source: "responsive" },
//     { type: "rule", selector: ".dark &", source: "dark" },
//     { type: "style-rule", selector: "@supports (background-image: linear-gradient(in lab, red, red))" },
//     { type: "decl", prop: "--baro-gradient-position", value: "to right in oklab" }
//   ],
//   [
//     { type: "rule", selector: "&:hover", source: "pseudo" },
//     { type: "at-rule", name: "media", params: "(min-width: 640px)", source: "responsive" },
//     { type: "rule", selector: ".dark &", source: "dark" },
//     { type: "decl", prop: "background-image", value: "linear-gradient(to right, var(--baro-gradient-stops))" }
//   ],
//   // Declarations from from-blue-500
//   [
//     { type: "at-root", nodes: [...] },
//     { type: "decl", prop: "--baro-gradient-from", value: "#3b82f6" }
//   ],
//   [
//     { type: "at-root", nodes: [...] },
//     { type: "decl", prop: "--baro-gradient-to", value: "transparent" }
//   ],
//   [
//     { type: "at-root", nodes: [...] },
//     { type: "decl", prop: "--baro-gradient-stops", value: "var(--baro-gradient-from),var(--baro-gradient-to)" }
//   ],
//   // Declarations from to-red-500
//   [
//     { type: "at-root", nodes: [...] },
//     { type: "decl", prop: "--baro-gradient-to", value: "#ef4444" }
//   ],
//   // Declaration from focus:ring-2
//   [
//     { type: "rule", selector: "&:focus", source: "pseudo" },
//     { type: "decl", prop: "box-shadow", value: "0 0 0 2px #3b82f6" }
//   ]
// ]
```

### Step 3: declPathToAst() - Convert to Nested Structures

```typescript
const astList = declPaths.map(declPathToAst);
// Returns: [
//   // Nested structure from bg-linear-to-r
//   [
//     {
//       type: "at-rule",
//       name: "media",
//       params: "(min-width: 640px)",
//       source: "responsive",
//       nodes: [
//         {
//           type: "rule",
//           selector: ".dark &:hover",
//           source: "dark",
//           nodes: [
//             {
//               type: "at-root",
//               nodes: [
//                 { type: "property", prop: "--baro-gradient-position" },
//                 { type: "property", prop: "--baro-gradient-from", value: "#0000", syntax: "<color>" },
//                 // ... other gradient variables
//               ]
//             },
//             {
//               type: "decl",
//               prop: "--baro-gradient-position",
//               value: "to right"
//             },
//             {
//               type: "style-rule",
//               selector: "@supports (background-image: linear-gradient(in lab, red, red))",
//               nodes: [
//                 {
//                   type: "decl",
//                   prop: "--baro-gradient-position",
//                   value: "to right in oklab"
//                 }
//               ]
//             },
//             {
//               type: "decl",
//               prop: "background-image",
//               value: "linear-gradient(to right, var(--baro-gradient-stops))"
//             }
//           ]
//         }
//       ]
//     }
//   ],
//   // Nested structure from from-blue-500
//   [
//     {
//       type: "at-root",
//       nodes: [
//         { type: "property", prop: "--baro-gradient-position" },
//         { type: "property", prop: "--baro-gradient-from", value: "#0000", syntax: "<color>" },
//         // ... other gradient variables
//       ]
//     },
//     {
//       type: "decl",
//       prop: "--baro-gradient-from",
//       value: "#3b82f6"
//     }
//   ],
//   // Nested structure from to-red-500
//   [
//     {
//       type: "at-root",
//       nodes: [
//         { type: "property", prop: "--baro-gradient-position" },
//         { type: "property", prop: "--baro-gradient-from", value: "#0000", syntax: "<color>" },
//         // ... other gradient variables
//       ]
//     },
//     {
//       type: "decl",
//       prop: "--baro-gradient-to",
//       value: "#ef4444"
//     }
//   ],
//   // Nested structure from focus:ring-2
//   [
//     {
//       type: "rule",
//       selector: "&:focus",
//       source: "pseudo",
//       nodes: [
//         {
//           type: "decl",
//           prop: "box-shadow",
//           value: "0 0 0 2px #3b82f6"
//         }
//       ]
//     }
//   ]
// ]
```

### Step 4: mergeAstTreeList() - Merge and Optimize

```typescript
const merged = mergeAstTreeList(astList);
// Returns: [
//   // Gradient variable definitions (placed at top level with at-root)
//   {
//     type: "at-root",
//     nodes: [
//       { type: "property", prop: "--baro-gradient-position" },
//       { type: "property", prop: "--baro-gradient-from", value: "#0000", syntax: "<color>" },
//       { type: "property", prop: "--baro-gradient-via", value: "#0000", syntax: "<color>" },
//       { type: "property", prop: "--baro-gradient-to", value: "#0000", syntax: "<color>" },
//       { type: "property", prop: "--baro-gradient-stops", value: "transparent" },
//       { type: "property", prop: "--baro-gradient-from-position", value: "0%", syntax: "<length-percentage>" },
//       { type: "property", prop: "--baro-gradient-via-position", value: "50%", syntax: "<length-percentage>" },
//       { type: "property", prop: "--baro-gradient-to-position", value: "100%", syntax: "<length-percentage>" }
//     ]
//   },
//   // Gradient stops from from-blue-500
//   {
//     type: "decl",
//     prop: "--baro-gradient-from",
//     value: "#3b82f6"
//   },
//   {
//     type: "decl",
//     prop: "--baro-gradient-to",
//     value: "transparent"
//   },
//   {
//     type: "decl",
//     prop: "--baro-gradient-stops",
//     value: "var(--baro-gradient-from),var(--baro-gradient-to)"
//   },
//   // Gradient stops from to-red-500 (overwrites existing to value)
//   {
//     type: "decl",
//     prop: "--baro-gradient-to",
//     value: "#ef4444"
//   },
//   // Media query and gradient background
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
//             prop: "--baro-gradient-position",
//             value: "to right"
//           },
//           {
//             type: "style-rule",
//             selector: "@supports (background-image: linear-gradient(in lab, red, red))",
//             nodes: [
//               {
//                 type: "decl",
//                 prop: "--baro-gradient-position",
//                 value: "to right in oklab"
//               }
//             ]
//           },
//           {
//             type: "decl",
//             prop: "background-image",
//             value: "linear-gradient(to right, var(--baro-gradient-stops))"
//           }
//         ]
//       }
//     ]
//   },
//   // focus:ring-2
//   {
//     type: "rule",
//     selector: "&:focus",
//     source: "pseudo",
//     nodes: [
//       {
//         type: "decl",
//         prop: "box-shadow",
//         value: "0 0 0 2px #3b82f6"
//       }
//     ]
//   }
// ]
```

### Step 5: Final CSS Output

```typescript
const css = astToCss(merged);
// Output:
// @property --baro-gradient-position;
// @property --baro-gradient-from {
//   syntax: "<color>";
//   initial-value: #0000;
// }
// @property --baro-gradient-via {
//   syntax: "<color>";
//   initial-value: #0000;
// }
// @property --baro-gradient-to {
//   syntax: "<color>";
//   initial-value: #0000;
// }
// @property --baro-gradient-stops {
//   initial-value: transparent;
// }
// @property --baro-gradient-from-position {
//   syntax: "<length-percentage>";
//   initial-value: 0%;
// }
// @property --baro-gradient-via-position {
//   syntax: "<length-percentage>";
//   initial-value: 50%;
// }
// @property --baro-gradient-to-position {
//   syntax: "<length-percentage>";
//   initial-value: 100%;
// }
// 
// --baro-gradient-from: #3b82f6;
// --baro-gradient-to: transparent;
// --baro-gradient-stops: var(--baro-gradient-from),var(--baro-gradient-to);
// --baro-gradient-to: #ef4444;
// 
// @media (min-width: 640px) {
//   .dark .sm\\:dark\\:hover\\:bg-linear-to-r:hover {
//     --baro-gradient-position: to right;
//   }
//   .dark .sm\\:dark\\:hover\\:bg-linear-to-r:hover {
//     --baro-gradient-position: to right in oklab;
//   }
//   .dark .sm\\:dark\\:hover\\:bg-linear-to-r:hover {
//     background-image: linear-gradient(to right, var(--baro-gradient-stops));
//   }
// }
// .focus\\:ring-2:focus {
//   box-shadow: 0 0 0 2px #3b82f6;
// }
```

::: tip Key Transformations
1. **Multi-Value Utilities**: `bg-linear-to-r` creates multiple CSS properties and variables
2. **CSS Custom Properties**: `@property` declarations for gradient variables with syntax definitions
3. **Variable Dependencies**: `from-blue-500` and `to-red-500` work together through shared variables
4. **Variant Nesting**: `sm:dark:hover` becomes nested `@media` → `.dark &` → `&:hover`
5. **Selector Merging**: Multiple selectors are properly merged (`.dark &:hover`)
6. **Source Priority**: Variants are sorted by priority (at-rule > style-rule > rule > decl)
7. **Class Name Generation**: Final class names are generated with proper escaping
8. **CSS Structure**: Proper CSS nesting, media queries, and @supports rules
:::

::: info Why This Complexity is Needed
The `@background.ts` example shows why `optimizeAst()` is essential:

- **Single Utility, Multiple Values**: `bg-linear-to-r` generates 8+ CSS properties and variables
- **Interdependent Variables**: `from-*` and `to-*` utilities share the same CSS custom properties
- **Progressive Enhancement**: `@supports` rules for modern CSS features
- **Variable Overrides**: Later utilities can override earlier variable values
- **Structural Organization**: `@property` declarations must be at the root level

This example demonstrates how `optimizeAst()` transforms complex utility classes with multiple interdependent values into well-structured, optimized CSS output.
:::


## Related APIs

- [Engine API](/api/engine) - Main CSS generation functions
- [Context API](/api/context) - Configuration and theme management
