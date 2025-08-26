import { rule, styleRule, type AstNode } from "./ast";
import { escapeClassName } from "./registry";

/**
 * Converts AST nodes to CSS string
 * @param ast { AstNode[] } - Array of AST nodes to convert
 * @param baseSelector { string } - Base selector for nested rules (e.g., ".parent" for ".parent .child")
 * @param opts { minify?: boolean } - Options for CSS generation
 * @param _indent { string } - Current indentation level for pretty formatting
 */
function astToCss(
  ast: AstNode[],
  baseSelector?: string,
  opts?: { minify?: boolean },
  _indent = ""
): string {
  const minify = opts?.minify;
  const indent = _indent;
  const nextIndent = _indent + "  "; // Next-level indentation: current + 2 spaces

  // Note: Caching is handled at a higher level (IncrementalParser); omit here

  // Debug logging for empty AST
  if (!ast || ast.length === 0) {
    console.warn('[astToCss] Empty AST received:', { ast, baseSelector, minify });
    return '';
  }

  // Deduplication logic: remove duplicates only among CSS property declarations (decl)
  // 
  // How it works:
  // 1. Iterate in reverse (the last defined property wins)
  // 2. Only check duplicates for decl nodes (skip rule/at-rule)
  // 3. Consider duplicates by property name (prop)
  // 
  // Current limitations:
  // - Does not dedupe rule or at-rule nodes
  // - When background.ts returns @supports + decl together, dedupe may not apply
  // - This can yield duplicate CSS rules in output
  let dedupedAst = [];
  if (Array.isArray(ast)) {
    const seenProps = new Map(); // Tracks property names already seen
    
    // Reverse iteration: keep the last defined property
    // Example: [color: red, color: blue] → keep only [color: blue]
    for (let i = ast.length - 1; i >= 0; i--) {
      const node = ast[i];
      
      if (node.type === "decl") {
        // Handle CSS property declaration nodes
        // node.important is not present; handle safely
        const key = node.prop; // Property name (e.g., "color", "background-color")
        
        // Skip duplicate properties
        if (seenProps.has(key)) {
          continue;
        }
        
        // Record new property
        seenProps.set(key, true);
      }
      
      // Add node to result (use unshift to preserve original order)
      dedupedAst.unshift(node);
    }
  }

  // Generate CSS string from deduped AST
  const result = dedupedAst
    .map((node) => {
      switch (node.type) {
        case "decl": {
          // Handle CSS property declaration (e.g., color: red;)
          let value = node.value;
          
          // node.important is absent; ignore
          if (node.prop.startsWith("--")) {
            // Handle CSS custom property (e.g., --primary-color: #007bff;)
            if (minify) {
              const css = `${node.prop}: ${value};`;
              // console.log("[astToCss] decl custom property minify", css);
              return css;
            } else {
              const css = `${indent}${node.prop}: ${value};`;
              // console.log("[astToCss] decl custom property pretty", css);
              return css;
            }
          } else {
            // Handle normal CSS property (e.g., color: red;)
            if (minify) {
              const css = `${node.prop}: ${value};`;
              // console.log("[astToCss] decl minify", css);
              return css;
            } else {
              const css = `${indent}${node.prop}: ${value};`;
              // console.log("[astToCss] decl pretty", css);
              return css;
            }
          }
        }
        case "rule": {
          // Handle nested rule (e.g., .parent .child { ... })
          // 
          // baseSelector handling logic:
          // 1. If baseSelector exists: combine to form ".parent .child"
          // 2. If no baseSelector: keep as standalone ".child"
          // 3. Replace '&' with baseSelector
          // 4. Pseudo selectors (e.g., :hover) append after baseSelector
          let selector = node.selector;
          
          if (baseSelector) {
            // When baseSelector exists: create nested rule
            const escBase = "." + escapeClassName(baseSelector); // Convert baseSelector to class form
            
            if (selector && selector.includes("&")) {
              // Replace '&' with baseSelector
              // Example: "&:hover" → ".parent:hover"
              selector = selector.replace(/&/g, escBase);
            } else if (!selector.startsWith(escBase)) {
              // If it does not start with baseSelector: prepend it
              selector = selector
                .split(",") // Handle multiple selectors separated by comma
                .map((sel) => {
                  sel = sel.trim();
                  
                  if (sel.startsWith(":") || sel.startsWith("::")) {
                    // Pseudo selector: append directly after baseSelector
                    // Example: ":hover" → ".parent:hover"
                    return escBase + sel;
                  } else {
                    // Normal selector: separate with space from baseSelector
                    // Example: ".child" → ".parent .child"
                    return escBase + (sel.startsWith(".") ? "" : " ") + sel;
                  }
                })
                .join(", ");
            }
          }
          
          // Create CSS rule
          if (minify) {
            const css = `${indent}${selector}{${astToCss(
              node.nodes, // Recursively process child nodes
              baseSelector, // Pass baseSelector (used in nested rules)
              opts,
              nextIndent
            )}}`;
            // console.log("[astToCss] rule minify", css);
            return css;
          } else {
            const css = `${indent}${selector} {\n${astToCss(
              node.nodes, // Recursively process child nodes
              baseSelector, // Pass baseSelector (used in nested rules)
              opts,
              nextIndent
            )}${indent}}`;
            // console.log("[astToCss] rule pretty", css);
            return css;
          }
        }
        case "style-rule": {
          // Handle style-rule: top-level rule with complete selector
          // 
          // baseSelector handling:
          // - Currently: pass baseSelector as-is
          // - Caveat: nested rules may not handle baseSelector correctly
          // - Example: .bg-white/60 { .nested { ... } } → .bg-white/60 .nested { ... }
          if (minify) {
            const css = `${indent}${node.selector} {${astToCss(
              node.nodes, // Recursively process child nodes
              baseSelector, // Pass baseSelector (used in nested rules)
              opts,
              nextIndent
            )}}`;
            // console.log("[astToCss] style-rule minify", css);
            return css;
          } else {
            const css = `${indent}${node.selector} {\n${astToCss(
              node.nodes, // Recursively process child nodes
              baseSelector, // Pass baseSelector (used in nested rules)
              opts,
              nextIndent
            )}${indent}}`;
            // console.log("[astToCss] style-rule pretty", css, JSON.stringify(node, null, 2));
            return css;
          }
        }
        case "at-rule": {
          // Handle at-rule: @media, @supports, etc.
          // 
          // baseSelector handling:
          // - Pass baseSelector to inner nodes of the at-rule
          // - Ensure nested rules get correct selectors
          // - Example: @media (min-width: 768px) { .parent .child { ... } }
          const shouldUseBaseSelector = node.name !== 'supports'; // Added logic for @supports
          if (minify) {
            const css = `${indent}@${node.name} ${node.params}{${astToCss(
              node.nodes, // Recursively process inner nodes of the at-rule
              shouldUseBaseSelector ? baseSelector : undefined, // Conditional baseSelector
              opts,
              nextIndent
            )}}`;
            // console.log("[astToCss] at-rule minify", css);
            return css;
          } else {
            const css = `${indent}@${node.name} ${node.params} {\n${astToCss(
              node.nodes, // Recursively process inner nodes of the at-rule
              shouldUseBaseSelector ? baseSelector : undefined, // Conditional baseSelector
              opts,
              nextIndent
            )}${indent}}`;
            // console.log("[astToCss] at-rule pretty", css);
            return css;
          }
        }
        case "comment":
          // Handle CSS comments (removed in minify mode)
          return minify ? "" : `${indent}/* ${node.text} */`;
        case "raw":
          // Handle raw CSS code (output as-is)
          return `${indent}${node.value}`;
        default:
          console.warn('[astToCss] Unknown node type:', node);
          return "";
      }
    })
    .filter(Boolean) // Remove empty strings
    .join(minify ? "" : "\n"); // Join nodes (minify: no whitespace, pretty: newlines)

  // Add trailing newline for consistency with expected format
  const finalResult = result + (minify ? "" : "\n");
  
  // Debug logging for empty result
  if (!finalResult || finalResult.trim() === '') {
    console.warn('[astToCss] Empty result generated:', { 
      ast, 
      baseSelector, 
      minify, 
      result, 
      finalResult,
      dedupedAst 
    });
  }
  
  return finalResult;
}

function rootToCss(nodes: AstNode[]): string {
  // console.log("[rootToCss] input", { nodes });
  return nodes
    .map((node) => {
      const list: string[] = [];

      if (node.type === "decl") {
        list.push(`${node.prop}: ${node.value};`);
      } else if (node.type === "at-rule") {
        list.push(`@${node.name} ${node.params} {
${node.nodes.map((node) => {
  // console.log("[rootToCss] node", node);
  if (node.type === "decl") {
    return `\t${node.prop}: ${node.value};`;
  }
})
.join("\n")}
}`
        );
      }

      return list.join("\n");
    })
    .join("\n");
}

export { astToCss, rootToCss };
