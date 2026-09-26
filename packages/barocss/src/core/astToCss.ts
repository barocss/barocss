import { debugWarn } from "../utils/debug";
import { type AstNode } from "./ast";
import { escapeClassName } from "./registry";
import { isStructureSafeValue, hasCommentDelimiter } from "./parser";

// #273: a selector or at-rule prelude that contains a comment delimiter is never emitted (with its whole subtree).
const isSafePrelude = (text: unknown): boolean => !hasCommentDelimiter(String(text ?? ""));

// #224 defensive layer: a declaration whose property or value could end or open a block is dropped.
const isSafeDecl = (prop: unknown, value: unknown): boolean =>
  isStructureSafeValue(String(prop)) && isStructureSafeValue(String(value ?? ""));

const importantPrefix = "!important";

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
  opts?: { minify?: boolean, important?: boolean },
  _indent = ""
): string {
  const minify = opts?.minify;
  const indent = _indent;
  const nextIndent = _indent + "  "; // Next-level indentation: current + 2 spaces
  const important = opts?.important ?? false;
  const importantString = important ? ` ${importantPrefix}` : "";
  // Note: Caching is handled at a higher level (IncrementalParser); omit here

  // Debug logging for empty AST
  if (!ast || ast.length === 0) {
    debugWarn('[astToCss] Empty AST received:', { ast, baseSelector, minify });
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
  const dedupedAst = [];
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
          const value = node.value;
          if (!isSafeDecl(node.prop, value)) return "";
          // node.important is absent; ignore
          if (node.prop.startsWith("--")) {
            // Handle CSS custom property (e.g., --primary-color: #007bff;)
            if (minify) {
              const css = `${node.prop}: ${value}${importantString};`;
              // console.log("[astToCss] decl custom property minify", css);
              return css;
            } else {
              const css = `${indent}${node.prop}: ${value}${importantString};`;
              // console.log("[astToCss] decl custom property pretty", css);
              return css;
            }
          } else {
            const localIndent = minify ? "" : indent;
            const css = `${localIndent}${node.prop}: ${value}${importantString};`;
            return css;
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
          
          if (!isSafePrelude(selector)) return "";
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
          if (!isSafePrelude(node.selector)) return "";
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
          if (!isSafePrelude(node.name) || !isSafePrelude(node.params)) return "";
          if (minify) {
            const css = `${indent}@${node.name} ${node.params}{${astToCss(
              node.nodes, // Recursively process inner nodes of the at-rule
              baseSelector, // Always propagate baseSelector so '&' resolves inside at-rules
              opts,
              nextIndent
            )}}`;
            // console.log("[astToCss] at-rule minify", css);
            return css;
          } else {
            const css = `${indent}@${node.name} ${node.params} {\n${astToCss(
              node.nodes, // Recursively process inner nodes of the at-rule
              baseSelector, // Always propagate baseSelector so '&' resolves inside at-rules
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
          debugWarn('[astToCss] Unknown node type:', node);
          return "";
      }
    })
    .filter(Boolean) // Remove empty strings
    .join(minify ? "" : "\n"); // Join nodes (minify: no whitespace, pretty: newlines)

  // Add trailing newline for consistency with expected format
  const finalResult = result + (minify ? "" : "\n");
  
  // Debug logging for empty result
  if (!finalResult || finalResult.trim() === '') {
    debugWarn('[astToCss] Empty result generated:', { 
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

function rootToCss(nodes: AstNode[], opts?: { minify?: boolean }): string {
  const minify = opts?.minify === true;
  const result = nodes
    .map((node) => {
      const list: string[] = [];

      if (node.type === "decl") {
        if (isSafeDecl(node.prop, node.value)) {
          list.push(minify ? `${node.prop}:${node.value};` : `${node.prop}: ${node.value};`);
        }
      } else if (node.type === "at-rule" && isSafePrelude(node.name) && isSafePrelude(node.params)) {
        if (minify) {
          const body = node.nodes
            .filter((child) => child.type === "decl" && isSafeDecl(child.prop, child.value))
            .map((child) => child.type === "decl" ? `${child.prop}:${child.value};` : "")
            .join("");
          list.push(`@${node.name} ${node.params}{${body}}`);
        } else {
          list.push(`@${node.name} ${node.params} {
${node.nodes.map((node) => {
  if (node.type === "decl" && isSafeDecl(node.prop, node.value)) {
    return `\t${node.prop}: ${node.value};`;
  }
})
.join("\n")}
}`
          );
        }
      }

      return list.join(minify ? "" : "\n");
    })
    .join(minify ? "" : "\n");

  return result;
}

export { astToCss, rootToCss };
